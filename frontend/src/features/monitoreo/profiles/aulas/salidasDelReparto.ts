/**
 * **Por qué una cita no tiene quién la aplique, y qué se puede hacer.**
 *
 * Dictado del 2026-09-04: «los avisos [tienen que] significar o permitirnos
 * hacer algo. Ahí pones que hay [gente] que se queda libre porque no tienen
 * aplicaciones en sus horarios. ¿Pero qué aplicaciones? ¿Qué cursos se quedan
 * sin aula? ¿Por qué no hay disponibilidad a esa hora? ¿Quiénes tienen
 * disponibilidad a esa hora? No me estás dando soluciones ni formas de poder
 * yo resolver las cosas».
 *
 * El reparto ya declaraba el HECHO (`no_cubiertos`, cuántos quedan libres).
 * Aquí se cruza ese hecho con la malla de OFERTA para decir la CAUSA y la
 * salida, que son dos cosas distintas y sólo una es accionable:
 *
 * - `sin-oferta`: nadie declaró disponibilidad ese día a esa hora. La salida
 *   no está en el reparto: hay que mover la cita o conseguir gente.
 * - `ocupados`: sí hay gente con ese horario, pero ya están en otra
 *   aplicación. La salida SÍ está en la vista: se nombran esas personas y la
 *   cita que las tiene, para soltarlas desde la tabla.
 *
 * Y para quien queda libre se dice qué cubre, que es lo que permite decidir
 * si conviene reagendar una cita hacia sus horas o dejarlo fuera de esta
 * tanda.
 *
 * Todo se calcula sobre lo que YA viajó al cliente: el reparto, la malla de
 * oferta (`mallaDeOferta`) y las ventanas del bloque `franjas`. No hay una
 * segunda verdad del horario.
 */
import type { MallaDeOferta } from "./disponibilidadDeAplicadores";
import { fechaIsoReal } from "./agendaPorDia";
import { minutosDeHora } from "./mapaDeHoras";
import type { RepartoVista } from "./repartoDeAplicadores";

/** Las claves del motor, sin tilde, en el orden de `Date.getUTCDay()`. */
const CLAVE_DE_DIA = [
  "domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado",
];

/** `2026-09-07` → `lunes`; una fecha imposible no inventa día. */
export function diaDeSemanaDe(fecha: string): string | null {
  const partes = fechaIsoReal(fecha);
  return partes ? (CLAVE_DE_DIA[partes.fecha.getUTCDay()] ?? null) : null;
}

/** La ventana pactada de una cita, por `fecha` y código. */
export type VentanaDeCita = { inicio: string; fin: string };

/** La clave del mapa de ventanas: fecha y código no se confunden entre días. */
export const claveDeCita = (fecha: string, codigo: string) => `${fecha}\r${codigo}`;

/**
 * Quién declaró disponibilidad en TODAS las franjas que cubre `[ini, fin)` de
 * ese día. La oferta viene en tramos de 30 min; una cita que cruza dos tramos
 * exige a la persona en los dos, que es lo que el motor exige también.
 */
function quienesCubren(
  malla: MallaDeOferta,
  dia: string,
  iniMin: number,
  finMin: number,
): string[] {
  const i = malla.filas.findIndex((f) => f.clave === dia);
  if (i < 0) return [];
  const tocadas: number[] = [];
  malla.franjas.forEach((min, j) => {
    // Un tramo cuenta si se solapa con la cita, no si empieza dentro.
    if (min < finMin && min + 30 > iniMin) tocadas.push(j);
  });
  if (tocadas.length === 0) return [];
  let comunes: string[] | null = null;
  for (const j of tocadas) {
    const aqui = new Set(malla.nombres[i]?.[j] ?? []);
    comunes = comunes === null
      ? [...aqui]
      : comunes.filter((n) => aqui.has(n));
  }
  return comunes ?? [];
}

export type SalidaDeDescubierto = {
  codigo: string;
  fecha: string;
  etiqueta: string;
  /** La hora pactada, cuando el bloque de ventanas la trae. */
  inicio: string;
  fin: string;
  /** Quiénes declararon ese día y esa hora, según el libro de disponibilidad. */
  conHorario: string[];
  /** De ésos, quiénes ya están en otra aplicación a esa hora, y en cuál. */
  ocupados: Array<{ aplicador: string; porCodigo: string }>;
  causa: "sin-oferta" | "ocupados" | "sin-hora";
};

/**
 * Las citas que nadie cubre, con su causa y con la gente que podría cubrirlas
 * si se le suelta la cita que la tiene.
 */
export function salidasDeDescubiertos(
  reparto: RepartoVista,
  malla: MallaDeOferta | null,
  ventanas: ReadonlyMap<string, VentanaDeCita>,
): SalidaDeDescubierto[] {
  const salidas: SalidaDeDescubierto[] = [];
  for (const d of reparto.dias) {
    if (d.noCubiertos.length === 0) continue;
    const dia = diaDeSemanaDe(d.fecha);
    for (const codigo of d.noCubiertos) {
      const v = ventanas.get(claveDeCita(d.fecha, codigo));
      const iniMin = v ? minutosDeHora(v.inicio) : null;
      const finMin = v ? minutosDeHora(v.fin) : null;
      if (!v || iniMin === null || finMin === null || dia === null || malla === null) {
        // Sin hora legible no se puede decir QUIÉN podría: se declara así, en
        // vez de afirmar «nadie tiene disponibilidad», que sería inventar.
        salidas.push({
          codigo, fecha: d.fecha, etiqueta: d.etiqueta,
          inicio: v?.inicio ?? "", fin: v?.fin ?? "",
          conHorario: [], ocupados: [], causa: "sin-hora",
        });
        continue;
      }
      const conHorario = quienesCubren(malla, dia, iniMin, finMin);
      // Quién de ésos ya está tomado a esa misma hora, y por qué cita: es el
      // par (persona, cita) que el usuario puede soltar desde la tabla.
      const ocupados: Array<{ aplicador: string; porCodigo: string }> = [];
      for (const a of d.asignaciones) {
        if (!conHorario.includes(a.aplicador)) continue;
        const aIni = minutosDeHora(a.inicio);
        const aFin = minutosDeHora(a.fin);
        if (aIni === null || aFin === null) continue;
        if (aIni < finMin && aFin > iniMin) {
          ocupados.push({ aplicador: a.aplicador, porCodigo: a.codigo });
        }
      }
      salidas.push({
        codigo, fecha: d.fecha, etiqueta: d.etiqueta,
        inicio: v.inicio, fin: v.fin,
        conHorario, ocupados,
        causa: conHorario.length === 0 ? "sin-oferta" : "ocupados",
      });
    }
  }
  return salidas;
}

export type SalidaDeLibre = {
  aplicador: string;
  /** Los días de semana que cubre, con su tramo de punta a punta. */
  cubre: Array<{ dia: string; desde: string; hasta: string }>;
};

/**
 * Qué cubre cada persona que quedó sin nada. Con esto el aviso deja de decir
 * «no tienen aplicaciones en sus horarios» y pasa a decir DÓNDE sí estarían,
 * que es lo que permite mover una cita hacia ellas o descartarlas de la tanda.
 */
export function salidasDeLibres(
  reparto: RepartoVista,
  malla: MallaDeOferta | null,
): SalidaDeLibre[] {
  const libres = reparto.equidad.filter((e) => e.asignadas === 0);
  if (libres.length === 0 || malla === null) {
    return libres.map((e) => ({ aplicador: e.aplicador, cubre: [] }));
  }
  const horaDe = (min: number) =>
    `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
  return libres.map((e) => {
    const cubre: Array<{ dia: string; desde: string; hasta: string }> = [];
    malla.filas.forEach((fila, i) => {
      const suyas = malla.franjas
        .map((min, j) => ((malla.nombres[i]?.[j] ?? []).includes(e.aplicador) ? min : null))
        .filter((m): m is number => m !== null);
      if (suyas.length === 0) return;
      cubre.push({
        dia: fila.etiqueta,
        desde: horaDe(Math.min(...suyas)),
        hasta: horaDe(Math.max(...suyas) + 30),
      });
    });
    return { aplicador: e.aplicador, cubre };
  });
}

/**
 * El mapa `fecha+codigo → ventana` a partir del bloque `franjas` del
 * dashboard. Defensivo en la frontera jsonlite, igual que `mapaDeHoras`.
 */
export function ventanasPorCita(crudo: unknown): Map<string, VentanaDeCita> {
  const out = new Map<string, VentanaDeCita>();
  const uno = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v);
  const texto = (v: unknown): string => {
    const c = uno(v);
    return typeof c === "string" ? c.trim() : "";
  };
  const raiz = (crudo ?? {}) as Record<string, unknown>;
  for (const dCrudo of Array.isArray(raiz.dias) ? raiz.dias : []) {
    const d = (dCrudo ?? {}) as Record<string, unknown>;
    const fecha = texto(d.fecha);
    if (fecha === "") continue;
    for (const vCrudo of Array.isArray(d.ventanas) ? d.ventanas : []) {
      const v = (vCrudo ?? {}) as Record<string, unknown>;
      const codigo = texto(v.codigo);
      const inicio = texto(v.inicio);
      if (codigo === "" || inicio === "") continue;
      out.set(claveDeCita(fecha, codigo), { inicio, fin: texto(v.fin) });
    }
  }
  return out;
}
