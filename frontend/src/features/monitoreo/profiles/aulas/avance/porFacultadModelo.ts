import type { MonitoreoAulasDashboard, MonitoreoAulasDesenlace, MonitoreoAulasRefuerzosTablero } from "../../../../../api/monitoreo";
import { avanceCuota, numeroONulo } from "../avanceCuota";
import { composicionReferencial } from "../composicionReferencial";
import { colchonPorFacultad, SIN_VALOR_DEL_EJE } from "../consumoDeCadena";
import { fmt, pctPerfil } from "../kpisDeAulas";
import { readinessDeAulas } from "../navegacion/readinessDeAulas";
import { personasProyectadas } from "../redondeoConservador";
import { sexoEnPalabra } from "../tresLecturasDeCuota";
import { etiquetaDeVariable, gruposPorCruce, variablesDeCuota, type GrupoDeCruce } from "./cuotaPorCruce";
import { nombreDelGrupo, type EjeDelResumen } from "./resumenAulasModelo";

/**
 * Avance › Por facultad (Por nivel) de Cursos-horario (ficha A2 de
 * `docs/qa/revamp-monitoreo/aulas.md`), listo para pintar.
 *
 * Pregunta de la pestaña: ¿qué grupo no llega? Todo sale del tablero que ya
 * publica el motor; aquí sólo se ordena, se rotula y se dice la causa de lo
 * que no llega.
 *
 * - Eje facultad (HSVG): «Cuota por facultad y sexo» con `avance_sexo_facultad`
 *   —logradas, cuota, «Al cierre» (`proyeccion`, decisión P10) y la frase del
 *   motor (`etiqueta`)—; al lado, los desenlaces (`reemplazos_por_tipo`), qué
 *   rindió cada tipo (`refuerzos.rendimiento`) y el consumo de la reserva por
 *   facultad (de la agenda, con `colchonPorFacultad`).
 * - Otro eje (CCSS, nivel): «Cuota por nivel» con `avance_cuota.facultades` y
 *   «A quién se está alcanzando» con `avance_cuota.composicion`.
 *
 * Un dato que no llega se dice con su causa, nunca como un 0 que parezca medido.
 */

export const MARCA_POR_FACULTAD_AULAS = readinessDeAulas("avance", "porfacultad");

export type Tono = "ok" | "aviso" | "riesgo" | "neutro";

/** Un vacío de superficie con su clase (C5): legítimo o desconexión. */
export type Vacio = { causa: string; clase: "legitimo" | "desconexion" };

export type FilaDeSexo = {
  clave: string;
  /** «Mujeres», «Hombres». */
  sexo: string;
  logradas: number;
  cuota: number | null;
  /** Relleno de la barra, logradas contra cuota, capado a 100. */
  relleno: number;
  cumple: boolean;
  /** `proyeccion` del motor en personas enteras hacia abajo, o «—». */
  alCierre: string;
  /** La frase del motor (`etiqueta`). */
  lectura: string;
  tono: Tono;
  aria: string;
};

export type GrupoDeSexo = {
  clave: string;
  /** El valor del eje como lo publica el motor; es el que va al `foco`. */
  valor: string;
  nombre: string;
  filas: FilaDeSexo[];
};

export type FilaDelEje = {
  clave: string;
  valor: string;
  nombre: string;
  efectivas: number;
  /** «119» o «Sin meta». */
  cuotaTexto: string;
  relleno: number;
  /** «127.7 %» o «—». */
  avanceTexto: string;
  estado: { tono: Tono; texto: string };
  /** No tiene cuota en el diseño: va atenuada y al final. */
  fuera: boolean;
  aria: string;
};

export type CuotaDeLaPestana =
  | {
    tipo: "sexo";
    titulo: string;
    sub: string;
    grupos: GrupoDeSexo[];
    /** Rótulo de la columna de la segunda variable declarada: «Sexo», «Nivel». */
    segunda: string;
  }
  | { tipo: "eje"; titulo: string; sub: string; filas: FilaDelEje[] }
  | { tipo: "vacio"; titulo: string; vacio: Vacio };

export type CifraDeLaFranja = { clave: string; rotulo: string; valor: string; titulo: string };

export type FilaDeRendimiento = {
  clave: string;
  tipo: string;
  aulas: string;
  elegibles: string;
  efectivas: string;
  /** «52.6 %» o «—» cuando el tipo no tiene elegibles. */
  tasa: string;
  sinAulas: boolean;
};

export type FilaDeConsumo = {
  clave: string;
  valor: string;
  nombre: string;
  usadas: number;
  libres: number;
  total: number;
  /** Ancho del carril, el total del grupo contra el más grande (0–100). */
  carril: number;
  aria: string;
};

export type FilaDeAlcance = {
  clave: string;
  etiqueta: string;
  /** Porcentajes del padrón y de las efectivas; `null` cuando no se declaran. */
  padron: number | null;
  efectivas: number | null;
  /** Ancho de cada barra contra el tope de su dimensión (0–100). */
  anchoPadron: number;
  anchoEfectivas: number;
};

export type DimensionDeAlcance = { clave: string; etiqueta: string; filas: FilaDeAlcance[] };

export type Lateral =
  | {
    tipo: "operativo";
    franja: { cifras: CifraDeLaFranja[]; vacio: Vacio | null };
    rendimiento: { filas: FilaDeRendimiento[]; vacio: Vacio | null; nota: string | null };
    consumo: { filas: FilaDeConsumo[]; sub: string; vacio: Vacio | null };
  }
  | { tipo: "alcance"; dimensiones: DimensionDeAlcance[]; sub: string; vacio: Vacio | null };

export type ModeloPorFacultad = {
  estado: "sin-tablero" | "sin-avance" | "listo";
  eje: EjeDelResumen;
  /** «Por facultad», «Por nivel»: el rótulo que declara el eje. */
  rotulo: string;
  cuota: CuotaDeLaPestana;
  /**
   * De dónde sale la cuota y si su sello se pudo verificar. Viaja con la tabla
   * que la usa como denominador (venía de Avance › Metas, donde se mudó por la
   * misma razón el 2026-09-18).
   */
  procedencia: { chip: string; detalle: string; degradada: boolean } | null;
  /** Por qué ninguna respuesta va a caer en su celda, dicho antes del campo. */
  avisoDelEje: string | null;
  lateral: Lateral;
};

function texto(valor: unknown): string {
  if (typeof valor === "string") return valor.trim();
  if (typeof valor === "number" && Number.isFinite(valor)) return String(valor);
  return "";
}

function registro(valor: unknown): Record<string, unknown> | null {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? (valor as Record<string, unknown>) : null;
}

/** Clave estable de un valor del eje: sin tildes, mayúsculas y espacios simples. */
export function claveDeGrupo(valor: string): string {
  return valor.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
}

function ejeDe(dashboard: MonitoreoAulasDashboard | null): EjeDelResumen & { columna: string; fuenteValor: string } {
  const eje = dashboard?.avance_cuota?.eje ?? null;
  const etiqueta = texto(eje?.etiqueta) || "Facultad";
  return {
    clave: texto(eje?.clave) || "facultad",
    etiqueta,
    plural: texto(eje?.etiqueta_plural) || `${etiqueta}es`,
    sin: texto(eje?.etiqueta_sin) || `Sin ${etiqueta.toLocaleLowerCase("es")}`,
    columna: texto(eje?.columna) || "faculty",
    fuenteValor: texto(eje?.fuente_valor),
  };
}

const enMinuscula = (s: string) => s.toLocaleLowerCase("es");

// ---------------------------------------------------------------------------
// Cuota por facultad y sexo (eje facultad)

const RANGO_DE_ESTADO: Record<string, number> = {
  deficit_no_subsanable: 0,
  deficit_proyectado: 1,
  ajustada: 2,
  asegurada: 3,
  sin_cuota: 4,
};

function tonoDelEstado(estado: string): Tono {
  if (estado === "asegurada") return "ok";
  if (estado === "ajustada") return "aviso";
  if (estado === "deficit_proyectado" || estado === "deficit_no_subsanable") return "riesgo";
  return "neutro";
}

/** Orden de las dos filas de una facultad: Mujeres, Hombres, el resto. */
function rangoDeSexo(sex: string): number {
  const s = sex.toUpperCase();
  return s === "F" ? 0 : s === "M" ? 1 : 2;
}

type CeldaDeSexo = {
  facultad: string;
  sex: string;
  cuota: number | null;
  logrado: number;
  proyeccion: number | null;
  estado: string;
  etiqueta: string;
};

/** Las celdas facultad × sexo del motor; las del eje (`grano = "eje"`) no entran. */
function celdasDeSexo(dashboard: MonitoreoAulasDashboard | null): CeldaDeSexo[] {
  const brutas = Array.isArray(dashboard?.avance_sexo_facultad) ? dashboard.avance_sexo_facultad : [];
  const celdas: CeldaDeSexo[] = [];
  for (const bruta of brutas) {
    const c = registro(bruta);
    if (!c || texto(c.grano) === "eje") continue;
    const facultad = texto(c.faculty);
    const sex = texto(c.sex);
    if (!facultad || !sex) continue;
    celdas.push({
      facultad,
      sex,
      cuota: numeroONulo(c.cuota),
      logrado: numeroONulo(c.logrado) ?? 0,
      proyeccion: numeroONulo(c.proyeccion),
      estado: texto(c.estado),
      etiqueta: texto(c.etiqueta),
    });
  }
  return celdas;
}

function cuotaPorSexo(celdas: CeldaDeSexo[], eje: EjeDelResumen): CuotaDeLaPestana {
  const porGrupo = new Map<string, { valor: string; celdas: CeldaDeSexo[] }>();
  for (const c of celdas) {
    const clave = claveDeGrupo(c.facultad);
    const g = porGrupo.get(clave) ?? { valor: c.facultad, celdas: [] };
    g.celdas.push(c);
    porGrupo.set(clave, g);
  }
  const peor = (g: { celdas: CeldaDeSexo[] }) => Math.min(...g.celdas.map((c) => RANGO_DE_ESTADO[c.estado] ?? 4));
  const tamano = (g: { celdas: CeldaDeSexo[] }) => g.celdas.reduce((s, c) => s + (c.cuota ?? 0), 0);
  // Primero el grupo que peor llega al cierre; entre iguales, el que más pide.
  const ordenados = [...porGrupo.entries()].sort(([ca, a], [cb, b]) =>
    peor(a) - peor(b) || tamano(b) - tamano(a) || ca.localeCompare(cb, "es"));

  let conCuota = 0;
  let cumplen = 0;
  const grupos: GrupoDeSexo[] = ordenados.map(([clave, g]) => {
    const nombre = nombreDelGrupo(g.valor, eje);
    const filas = [...g.celdas]
      .sort((a, b) => rangoDeSexo(a.sex) - rangoDeSexo(b.sex))
      .map((c): FilaDeSexo => {
        const cuota = c.cuota != null && c.cuota > 0 ? c.cuota : null;
        const cumple = cuota != null && c.logrado >= cuota;
        if (cuota != null) {
          conCuota += 1;
          if (cumple) cumplen += 1;
        }
        const sexo = sexoEnPalabra(c.sex);
        const alCierre = c.proyeccion == null ? "—" : personasProyectadas(c.proyeccion);
        const lectura = c.etiqueta || (cuota == null ? "Sin cuota trazada" : "Sin lectura del motor");
        return {
          clave: `${clave}|${c.sex.toUpperCase()}`,
          sexo,
          logradas: c.logrado,
          cuota,
          relleno: cuota == null ? 0 : Math.max(0, Math.min(100, (100 * c.logrado) / cuota)),
          cumple,
          alCierre,
          lectura,
          tono: cuota == null ? "neutro" : tonoDelEstado(c.estado),
          aria: `${nombre}, ${enMinuscula(sexo)}: ${fmt(c.logrado)}` +
            (cuota == null ? " sin cuota" : ` de ${fmt(cuota)}`) +
            (c.proyeccion == null ? "" : `; al cierre, ${alCierre}`) +
            `. ${lectura}`,
        };
      });
    return { clave, valor: g.valor, nombre, filas };
  });

  const sub = !conCuota
    ? "Ningún grupo tiene cuota trazada"
    : cumplen === conCuota
      ? `${fmt(conCuota)} grupos; ${fmt(cumplen)} ya cumplen`
      : cumplen === 0
        ? `${fmt(conCuota)} grupos; ninguno cumple todavía`
        : `${fmt(conCuota)} grupos; ${fmt(cumplen)} ya cumplen y ${fmt(conCuota - cumplen)} todavía no`;
  return { tipo: "sexo", titulo: `Cuota por ${enMinuscula(eje.etiqueta)} y sexo`, sub, grupos, segunda: "Sexo" };
}

// ---------------------------------------------------------------------------
// Cuota por cualquier otra combinación declarada (ADR 0121)

function cuotaDesdeCruce(grupos: GrupoDeCruce[], eje: EjeDelResumen, segundas: string[]): CuotaDeLaPestana {
  let conCuota = 0;
  let cumplen = 0;
  const comoSexo: GrupoDeSexo[] = grupos.map((g) => ({
    clave: g.clave,
    valor: g.valor,
    nombre: g.nombre,
    filas: g.filas.map((f): FilaDeSexo => {
      if (f.cuota != null) {
        conCuota += 1;
        if (f.cumple) cumplen += 1;
      }
      return {
        clave: f.clave, sexo: f.rotulo, logradas: f.logradas, cuota: f.cuota, relleno: f.relleno, cumple: f.cumple,
        // Las celdas declaradas no traen proyección todavía: se dice con la raya.
        alCierre: "—", lectura: f.lectura, tono: f.tono, aria: f.aria,
      };
    }),
  }));
  const sub = !conCuota
    ? "Ninguna celda tiene cuota trazada"
    : `${fmt(conCuota)} celdas; ${fmt(cumplen)} ya cumplen`;
  const nombres = segundas.map(enMinuscula).join(" y ");
  return {
    tipo: "sexo",
    titulo: `Cuota por ${enMinuscula(eje.etiqueta)} y ${nombres}`,
    sub,
    grupos: comoSexo,
    segunda: segundas.join(" y "),
  };
}

// ---------------------------------------------------------------------------
// Cuota por nivel (otro eje)

function cuotaPorEje(dashboard: MonitoreoAulasDashboard | null, eje: EjeDelResumen & { fuenteValor: string }): CuotaDeLaPestana {
  const titulo = `Cuota por ${enMinuscula(eje.etiqueta)}`;
  const bloque = dashboard?.avance_cuota ?? null;
  if (!bloque) {
    return {
      tipo: "vacio",
      titulo,
      vacio: { causa: "El tablero de este corte no trae el avance contra la cuota del diseño.", clase: "desconexion" },
    };
  }
  const vista = avanceCuota(bloque);
  if (!vista.filas.length) {
    return { tipo: "vacio", titulo, vacio: { causa: vista.vacio ?? "El diseño no traza cuotas por grupo.", clase: "legitimo" } };
  }
  const rango = (estado: string) => (estado === "fuera_del_diseno" ? 2 : estado === "sin_cuota" ? 1 : 0);
  const filas = [...vista.filas]
    .sort((a, b) => rango(a.estado) - rango(b.estado) || a.facultad.localeCompare(b.facultad, "es", { numeric: true }))
    .map((f): FilaDelEje => {
      const nombre = nombreDelGrupo(f.facultad, eje);
      const fuera = f.estado === "fuera_del_diseno" || f.estado === "sin_cuota" || f.cuota == null;
      if (fuera) {
        const estado = f.estado === "fuera_del_diseno"
          ? { tono: "neutro" as const, texto: "Fuera del diseño" }
          : { tono: "neutro" as const, texto: "Sin cuota" };
        return {
          clave: f.clave, valor: f.facultad, nombre, efectivas: f.validas, cuotaTexto: "Sin meta", relleno: 0,
          avanceTexto: "—", estado, fuera: true,
          aria: `${nombre}: ${fmt(f.validas)} efectivas sin meta en el diseño; no cuentan para ninguna cuota`,
        };
      }
      const estado = f.cumplida
        ? { tono: "ok" as const, texto: "Cumplida" }
        : { tono: "aviso" as const, texto: `Faltan ${fmt(f.brecha)}` };
      const avanceTexto = pctPerfil(f.avance ?? 0);
      return {
        clave: f.clave, valor: f.facultad, nombre, efectivas: f.validas, cuotaTexto: fmt(f.cuota), relleno: f.relleno,
        avanceTexto, estado, fuera: false,
        aria: `${nombre}: ${fmt(f.validas)} de ${fmt(f.cuota)}, ${avanceTexto}, ${enMinuscula(estado.texto)}`,
      };
    });
  const conMeta = filas.filter((f) => !f.fuera);
  const cumplen = conMeta.filter((f) => f.estado.tono === "ok").length;
  const plural = enMinuscula(eje.plural);
  const cuenta = conMeta.length
    ? `${fmt(cumplen)} de ${fmt(conMeta.length)} ${plural} con meta ya cumplen`
    : `Ningún ${enMinuscula(eje.etiqueta)} tiene meta`;
  const origen = eje.fuenteValor === "padron"
    ? `; el ${enMinuscula(eje.etiqueta)} sale del padrón con el código del alumno`
    : eje.fuenteValor === "plan"
      ? `; el ${enMinuscula(eje.etiqueta)} sale del plan de cursos-horario`
      : "";
  return { tipo: "eje", titulo, sub: `${cuenta}${origen}`, filas };
}

// ---------------------------------------------------------------------------
// Lateral del eje facultad: desenlaces, rendimiento por tipo y reserva

function totalDe(desenlace: MonitoreoAulasDesenlace | undefined): string {
  const n = numeroONulo(desenlace?.total);
  return n == null ? "—" : fmt(n);
}

function franjaDe(dashboard: MonitoreoAulasDashboard | null): { cifras: CifraDeLaFranja[]; vacio: Vacio | null } {
  const bloque = dashboard?.reemplazos_por_tipo ?? null;
  const caidos = numeroONulo(bloque?.caidos_sin_relevo);
  const cifras: CifraDeLaFranja[] = [
    { clave: "reemplazos", rotulo: "Reemplazos", valor: totalDe(bloque?.reemplazadas), titulo: "Titulares caídos con otro curso-horario en su lugar (caso A)" },
    { clave: "complementos", rotulo: "Complementos", valor: totalDe(bloque?.complementadas), titulo: "Titulares que rindieron poco y sumaron una reserva (caso B)" },
    { clave: "refuerzos", rotulo: "Refuerzos", valor: totalDe(bloque?.refuerzos), titulo: "Reservas a las que se salió por cuota, sin titular caído (caso C)" },
    { clave: "caidos", rotulo: "Caídos sin relevo", valor: caidos == null ? "—" : fmt(caidos), titulo: "Titulares caídos a los que todavía no se activó ningún relevo" },
  ];
  return {
    cifras,
    vacio: bloque ? null : { causa: "Este corte no trae los desenlaces del libro: los publica el motor al leer el libro del operativo.", clase: "desconexion" },
  };
}

const TIPOS_DE_RENDIMIENTO: ReadonlyArray<[keyof NonNullable<MonitoreoAulasRefuerzosTablero["rendimiento"]>, string]> = [
  ["titulares", "Titulares"],
  ["reemplazo", "Reemplazos"],
  ["complemento", "Complementos"],
  ["refuerzo", "Refuerzos"],
  ["adicional", "Adicionales sin declarar"],
  ["banco", "Banco de extras"],
];

/**
 * `refuerzos.rendimiento` del motor (`monitoreo_aulas_refuerzos.R`), tipado en
 * `MonitoreoAulasRefuerzosTablero`. Cada cifra se sigue leyendo con
 * `numeroONulo`: jsonlite puede mandar un NA como cadena.
 */
function rendimientoDe(dashboard: MonitoreoAulasDashboard | null): { filas: FilaDeRendimiento[]; vacio: Vacio | null; nota: string | null } {
  const refuerzos = dashboard?.refuerzos ?? null;
  if (!refuerzos) {
    return {
      filas: [],
      vacio: { causa: "Este corte no trae el rendimiento por tipo de curso-horario: lo publica el motor al recalcular el tablero.", clase: "desconexion" },
      nota: null,
    };
  }
  if (refuerzos.ok === false) {
    const motivo = texto(refuerzos.motivo);
    return {
      filas: [],
      vacio: { causa: motivo ? `Sin rendimiento por tipo: ${motivo}` : "El motor no pudo medir el rendimiento por tipo.", clase: "legitimo" },
      nota: null,
    };
  }
  const rendimiento = refuerzos.rendimiento ?? {};
  const filas = TIPOS_DE_RENDIMIENTO.map(([clave, tipo]): FilaDeRendimiento => {
    const r = rendimiento[clave];
    const n = numeroONulo(r?.n) ?? 0;
    const elegibles = numeroONulo(r?.elegibles) ?? 0;
    const efectivas = numeroONulo(r?.efectivas) ?? 0;
    const tasa = numeroONulo(r?.tasa);
    return {
      clave,
      tipo,
      aulas: fmt(n),
      elegibles: fmt(elegibles),
      efectivas: fmt(efectivas),
      tasa: tasa == null ? "—" : pctPerfil(100 * tasa),
      sinAulas: n === 0,
    };
  });
  // Cada tipo se elige de forma distinta y cae en otra mezcla de facultades:
  // la diferencia entre sus tasas no es efecto del tipo (revisión metodológica,
  // 2026-10-31). Se dice al pie en vez de dejar que se lea como ranking.
  return { filas, vacio: null, nota: "Las tasas no se comparan entre tipos: cada uno cae en otra mezcla de facultades." };
}

function consumoDe(
  dashboard: MonitoreoAulasDashboard | null,
  eje: EjeDelResumen & { columna: string },
): { filas: FilaDeConsumo[]; sub: string; vacio: Vacio | null } {
  const agenda = Array.isArray(dashboard?.agenda) ? dashboard.agenda : [];
  const sub = `reservas de cadena por ${enMinuscula(eje.etiqueta)}`;
  if (!agenda.length) {
    return { filas: [], sub, vacio: { causa: "El plan todavía no trae cursos-horario.", clase: "legitimo" } };
  }
  const colchon = colchonPorFacultad(agenda, eje.columna).filter((f) => f.gastadas + f.libres > 0);
  if (!colchon.length) {
    return { filas: [], sub, vacio: { causa: "El sorteo no dotó de reservas de cadena a ningún titular.", clase: "legitimo" } };
  }
  const maximo = Math.max(...colchon.map((f) => f.gastadas + f.libres));
  const filas = colchon
    .map((f): FilaDeConsumo => {
      const total = f.gastadas + f.libres;
      const nombre = f.facultad === SIN_VALOR_DEL_EJE ? eje.sin : nombreDelGrupo(f.facultad, eje);
      return {
        clave: f.facultad,
        valor: f.facultad === SIN_VALOR_DEL_EJE ? "" : f.facultad,
        nombre,
        usadas: f.gastadas,
        libres: f.libres,
        total,
        carril: (100 * total) / maximo,
        aria: `${nombre}: ${fmt(f.gastadas)} usadas de ${fmt(total)}, ${fmt(f.libres)} libres`,
      };
    })
    .sort((a, b) => b.usadas - a.usadas || b.total - a.total || a.nombre.localeCompare(b.nombre, "es"));
  const usadas = filas.reduce((s, f) => s + f.usadas, 0);
  const total = filas.reduce((s, f) => s + f.total, 0);
  return { filas, sub: `${fmt(usadas)} ${usadas === 1 ? "usada" : "usadas"} de ${fmt(total)}`, vacio: null };
}

// ---------------------------------------------------------------------------
// Lateral de otro eje: a quién se está alcanzando

function alcanceDe(dashboard: MonitoreoAulasDashboard | null): Extract<Lateral, { tipo: "alcance" }> {
  const vista = composicionReferencial(dashboard?.avance_cuota ?? null);
  const sub = "padrón frente a efectivas, como marco y no como cuota";
  if (vista.vacio) {
    // Sin bloque es una desconexión del corte; con bloque y sin padrón o sin
    // cruce, el vacío es del estudio y es legítimo.
    const clase = dashboard?.avance_cuota?.composicion ? "legitimo" : "desconexion";
    return { tipo: "alcance", dimensiones: [], sub, vacio: { causa: vista.vacio, clase } };
  }
  const dimensiones = vista.dimensiones.map((d): DimensionDeAlcance => ({
    clave: d.clave,
    etiqueta: d.etiqueta,
    filas: d.filas.map((f) => ({
      clave: f.categoria,
      etiqueta: f.etiqueta,
      padron: d.poblacionDeclarada ? f.poblacionPct : null,
      efectivas: f.obtenidasPct,
      anchoPadron: d.poblacionDeclarada ? Math.min(100, (100 * (f.poblacionPct ?? 0)) / d.tope) : 0,
      anchoEfectivas: Math.min(100, (100 * (f.obtenidasPct ?? 0)) / d.tope),
    })),
  }));
  return { tipo: "alcance", dimensiones, sub: `${fmt(vista.personas)} personas cruzadas con el padrón`, vacio: null };
}

// ---------------------------------------------------------------------------

export function construirPorFacultad(dashboard: MonitoreoAulasDashboard | null): ModeloPorFacultad {
  const eje = ejeDe(dashboard);
  const rotulo = `Por ${enMinuscula(eje.etiqueta)}`;
  // **Qué se cruza lo declara el estudio (ADR 0121), no el nombre del eje.**
  // Con «eje × sexo» se usan las celdas del motor con su proyección al cierre
  // (HSVG queda igual); con cualquier otra combinación, las celdas declaradas;
  // con una sola variable, la cuota por el eje.
  const variables = variablesDeCuota(dashboard, eje);
  // Un corte anterior a la declaración (sin `celdas_declaradas` ni
  // `representatividad_declarada`) conserva lo de siempre: si el motor publica
  // celdas por sexo, se cruzan.
  const declarado = variables.length > 1 || Boolean(dashboard?.avance_cuota?.celdas_declaradas || dashboard?.representatividad_declarada);
  const celdas = (variables.length === 2 && variables[1] === "sexo") || !declarado ? celdasDeSexo(dashboard) : [];
  const cruce = variables.length >= 2 && !celdas.length ? gruposPorCruce(dashboard, eje) : [];
  const cuota = celdas.length
    ? cuotaPorSexo(celdas, eje)
    : cruce.length
      ? cuotaDesdeCruce(cruce, eje, variables.slice(1).map((k) => etiquetaDeVariable(dashboard, k)))
      : cuotaPorEje(dashboard, eje);
  // El lateral depende de dónde sale el valor del eje: del AULA (lo operativo
  // del plan: reemplazos, rendimiento, reserva) o de la PERSONA (a quién se
  // alcanza contra el padrón). Antes se decidía por «¿es facultad?».
  const porAula = (dashboard?.avance_cuota?.eje?.atribucion ?? "aula") !== "persona";
  const lateral: Lateral = porAula
    ? { tipo: "operativo", franja: franjaDe(dashboard), rendimiento: rendimientoDe(dashboard), consumo: consumoDe(dashboard, eje) }
    : alcanceDe(dashboard);
  const estado: ModeloPorFacultad["estado"] = !dashboard
    ? "sin-tablero"
    : cuota.tipo === "vacio" && cuota.vacio.clase === "desconexion"
      ? "sin-avance"
      : "listo";
  const bloque = dashboard?.avance_cuota ?? null;
  const procedencia = bloque ? avanceCuota(bloque).procedencia : null;
  const avisoDelEje = texto(bloque?.aviso_eje) || null;
  return {
    estado, eje, rotulo, cuota,
    procedencia: procedencia && procedencia.chip ? procedencia : null,
    avisoDelEje,
    lateral,
  };
}

/**
 * La marca de readiness: `false` sólo mientras carga, la dirección cuando pintó
 * contenido real y `vacio:<motivo>` en un terminal sin contenido, para no
 * colgar la captura (readinessAnidada).
 */
export function readinessDePorFacultad(modelo: ModeloPorFacultad | null, cargando: boolean): string {
  if (cargando || !modelo) return "false";
  if (modelo.estado === "listo") return MARCA_POR_FACULTAD_AULAS;
  return `vacio:${modelo.estado}`;
}
