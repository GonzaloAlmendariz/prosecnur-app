/**
 * La malla de OFERTA: quién puede estar en campo, por día y franja de 30 min.
 *
 * Es el espejo de la malla de demanda de Carga de campo (dictado 2026-09-02:
 * «deben haber tres cuadros/visualizaciones: Patrón semanal, Calendario y
 * Disponibilidad de aplicadores»). El motor
 * (`monitoreo_aulas_disponibilidad_bloque`, B29) ya decidió todo lo difícil
 * —fusionó bloques del Excel, resolvió el mediodía ambiguo, ordenó nombres
 * alfabéticamente—; aquí solo se coloca cada franja sobre EL MISMO eje horario
 * que la demanda (`franjasDeMalla`), porque la lectura conjunta —¿alcanza la
 * gente para el pico?— exige que las dos mallas compartan geometría.
 *
 * Tres estados que no se confunden:
 * - **Bloque ausente** (`null`): la sesión no cargó la disponibilidad. No hay
 *   malla; la vista declara qué falta y de dónde sale (C5).
 * - **Bloque vacío**: la disponibilidad se cargó y nadie declaró horas. Marco
 *   con ceros, no un null que se lea como «falta cargar».
 * - **Lo que no cabe**: franjas fuera del eje o días ilegibles se CUENTAN
 *   (`fueraDeEje`, `ilegibles`) — la lista cerrada que se traga filas es el
 *   defecto documentado de este perfil.
 *
 * Defensivo en la frontera jsonlite —escalares envueltos en arrays de uno—
 * por el mismo motivo que `mapaDeHoras`.
 */
import type { MonitoreoAulasDisponibilidad } from "../../../../api/monitoreo";
import { comoHora, franjasDeMalla } from "./cargaDeCampo";
import { minutosDeHora } from "./mapaDeHoras";

const uno = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v);

const texto = (v: unknown): string => {
  const crudo = uno(v);
  return typeof crudo === "string" ? crudo.trim() : "";
};

const num = (v: unknown): number | null => {
  const crudo = uno(v);
  if (crudo === null || crudo === undefined || crudo === "") return null;
  const n = typeof crudo === "number" ? crudo : Number(crudo);
  return Number.isFinite(n) ? n : null;
};

export type FilaDeOferta = {
  /** La clave del motor, minúscula y sin tilde («miercoles»). */
  clave: string;
  /** La palabra bien escrita, como la fila homóloga de la demanda. */
  etiqueta: string;
};

export type MallaDeOferta = {
  /** El MISMO eje horario que la malla de demanda: un solo dueño. */
  franjas: number[];
  filas: FilaDeOferta[];
  /** Aplicadores disponibles por fila y franja. */
  disponibles: number[][];
  /** Quiénes, con el orden alfabético del motor. Mismos índices que arriba. */
  nombres: string[][][];
  /** El mejor momento de la oferta; `null` con todo en cero. */
  pico: { fila: number; franja: number; disponibles: number } | null;
  /** Cuántas personas distintas aparecen en la malla. */
  aplicadores: number;
  /** Franjas del motor sin columna en el eje 07:00–22:00: declaradas. */
  fueraDeEje: number;
  /** Días o franjas ilegibles: declarados, no tragados. */
  ilegibles: number;
};

/**
 * Lunes→sábado SIEMPRE, aunque un día no tenga cobertura: es el marco de la
 * demanda y el vacío de un día es un dato («ese día no hay nadie»), no una
 * fila que desaparece (C2). El domingo no existe en la malla de demanda, así
 * que solo se añade cuando el motor lo trae.
 */
const DIAS_DE_OFERTA: ReadonlyArray<FilaDeOferta> = [
  { clave: "lunes", etiqueta: "lunes" },
  { clave: "martes", etiqueta: "martes" },
  { clave: "miercoles", etiqueta: "miércoles" },
  { clave: "jueves", etiqueta: "jueves" },
  { clave: "viernes", etiqueta: "viernes" },
  { clave: "sabado", etiqueta: "sábado" },
];
const DOMINGO: FilaDeOferta = { clave: "domingo", etiqueta: "domingo" };

const leerNombres = (v: unknown): string[] => {
  // jsonlite puede simplificar la lista de uno a un escalar suelto.
  if (typeof v === "string") return v.trim() ? [v.trim()] : [];
  if (!Array.isArray(v)) return [];
  return v.map((n) => texto(n)).filter(Boolean);
};

export function mallaDeOferta(
  crudo: MonitoreoAulasDisponibilidad | null | undefined,
): MallaDeOferta | null {
  if (crudo === null || crudo === undefined) return null;
  const raiz = crudo as unknown as Record<string, unknown>;
  const diasCrudos = Array.isArray(raiz.dias) ? raiz.dias : [];

  const franjas = franjasDeMalla();
  const columna = new Map(franjas.map((m, j) => [m, j]));

  const hayDomingo = diasCrudos.some(
    (d) => texto(((d ?? {}) as Record<string, unknown>).dia) === DOMINGO.clave,
  );
  const filas = hayDomingo ? [...DIAS_DE_OFERTA, DOMINGO] : [...DIAS_DE_OFERTA];
  const filaDe = new Map(filas.map((f, i) => [f.clave, i]));

  const disponibles = filas.map(() => franjas.map(() => 0));
  const nombres: string[][][] = filas.map(() => franjas.map(() => []));
  let fueraDeEje = 0;
  let ilegibles = 0;
  const gente = new Set<string>();

  for (const diaCrudo of diasCrudos) {
    const d = (diaCrudo ?? {}) as Record<string, unknown>;
    const i = filaDe.get(texto(d.dia));
    if (i === undefined) {
      ilegibles += 1;
      continue;
    }
    for (const fCruda of Array.isArray(d.franjas) ? d.franjas : []) {
      const f = (fCruda ?? {}) as Record<string, unknown>;
      const min = minutosDeHora(texto(f.inicio));
      if (min === null) {
        ilegibles += 1;
        continue;
      }
      const j = columna.get(min);
      if (j === undefined) {
        fueraDeEje += 1;
        continue;
      }
      const quienes = leerNombres(f.nombres);
      for (const n of quienes) gente.add(n);
      // La cifra del motor manda; los nombres son su detalle. Una franja que
      // llegó sin nombres no se queda muda: se pinta con su conteo.
      disponibles[i][j] = num(f.disponibles) ?? quienes.length;
      nombres[i][j] = quienes;
    }
  }

  // El mejor momento de la oferta. `>` estricto: en empate gana el más
  // temprano —día de semana primero, hora después—, la misma convención que
  // el pico de la demanda.
  let pico: MallaDeOferta["pico"] = null;
  filas.forEach((_, i) => {
    franjas.forEach((m, j) => {
      if (disponibles[i][j] > (pico?.disponibles ?? 0)) {
        pico = { fila: i, franja: m, disponibles: disponibles[i][j] };
      }
    });
  });

  return {
    franjas,
    filas,
    disponibles,
    nombres,
    pico,
    aplicadores: gente.size,
    fueraDeEje,
    ilegibles,
  };
}

/**
 * Qué columnas del eje se pintan: las ocupadas por CUALQUIERA de las matrices.
 *
 * La demanda sola filtraba por sus propias matrices; con la oferta en juego,
 * las tres vistas de la malla tienen que compartir columnas — quien conmuta
 * entre «Patrón semanal» y «Disponibilidad» compara posiciones, y dos juegos
 * de columnas distintos convierten ese vistazo en una mentira silenciosa.
 */
export function columnasVivas(
  nFranjas: number,
  matrices: ReadonlyArray<ReadonlyArray<ReadonlyArray<number>>>,
): number[] {
  const out: number[] = [];
  for (let j = 0; j < nFranjas; j += 1) {
    if (matrices.some((m) => m.some((fila) => (fila[j] ?? 0) > 0))) out.push(j);
  }
  return out;
}

/**
 * B76 (dictado 2026-09-03: «debería tener un desplegable para poder ver
 * disponibilidad por aplicador»): los nombres de la malla, únicos y en
 * alfabeto es-PE — las opciones del desplegable.
 */
export function aplicadoresDeLaOferta(oferta: MallaDeOferta): string[] {
  const vistos = new Set<string>();
  for (const fila of oferta.nombres) {
    for (const celda of fila) for (const n of celda) if (n) vistos.add(n);
  }
  return [...vistos].sort((a, b) => a.localeCompare(b, "es"));
}

/**
 * B76: la semana de UNA persona, legible — por día, sus franjas contiguas
 * fusionadas en bloques «HH:MM–HH:MM» (el fin es el cierre de la última
 * franja de 30). Solo días donde declaró algo; el orden es el de la malla.
 */
export function semanaDelAplicador(
  oferta: MallaDeOferta,
  nombre: string,
): Array<{ etiqueta: string; bloques: string[] }> {
  const out: Array<{ etiqueta: string; bloques: string[] }> = [];
  oferta.filas.forEach((fila, i) => {
    const bloques: string[] = [];
    let inicio: number | null = null;
    let fin: number | null = null;
    oferta.franjas.forEach((f, j) => {
      const suya = (oferta.nombres[i]?.[j] ?? []).includes(nombre);
      if (suya && inicio === null) { inicio = f; fin = f + 30; return; }
      if (suya && fin === f) { fin = f + 30; return; }
      if (inicio !== null) bloques.push(`${comoHora(inicio)}–${comoHora(fin!)}`);
      inicio = suya ? f : null;
      fin = suya ? f + 30 : null;
    });
    if (inicio !== null) bloques.push(`${comoHora(inicio)}–${comoHora(fin!)}`);
    if (bloques.length) out.push({ etiqueta: fila.etiqueta, bloques });
  });
  return out;
}
