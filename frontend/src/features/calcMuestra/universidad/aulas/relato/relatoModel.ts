/**
 * Modelo PURO del Relato de la selección (ADR 0067).
 *
 * (selection, selectionRows, frame, frameRows, estratos del cálculo, foco) →
 * seis escenas en el orden del motor (ADR 0058): marco → estratos y cuotas →
 * probabilidades (el bombo) → sorteo (el ensamblaje) → titulares y cadenas →
 * cierre.
 *
 * Regla 1 del ADR 0067: cada cuadro es un hecho del sorteo ejecutado. Toda
 * cifra de este modelo sale de los datos persistidos de la corrida; el orden
 * de los pasos viene de `discount_step` (nunca se genera un orden propio) y lo
 * que la corrida no registró se publica como hueco declarado, no se inventa.
 *
 * Metáfora goo (dirección congelada 2026-08-07): cada bola es un curso-horario
 * real y su TAMAÑO son sus elegibles publicados (`eligible_n` — el PPS hecho
 * visible). El bombo curso a curso sale de `aula_frame`, que el `.pulso`
 * conserva (project_pulso.R solo poda `population`); si aun así no está en
 * memoria, las no sorteadas se agregan como masa rotulada — un hecho, no
 * bolas con tamaños imaginados. El encogimiento SOLO existe cuando la corrida
 * registró el descuento secuencial: encoger es publicar `eligible_n_neto`.
 */
import type {
  CalcMuestraAulasFrame,
  CalcMuestraAulasSelection,
  CalcMuestraEstrato,
} from "../../../../../api/client";
import { safeNumber } from "../../../sharedCore";
import { frameAuditNumber } from "../../shared/frame";
import {
  classroomRowNumber,
  classroomRowText,
  compareUniversityFacultyLabels,
  rowKeyForCandidates,
} from "../../shared/format";
import { canonicalClassroomOperationalCode } from "../classroomOperationalCode";
import { classroomProbabilitySourceLabel, classroomWaveNumber } from "../classroomLabels";
import { isBalancedEngine, resolveDiscountMode, type DiscountMode } from "../descuentoRepetidosModel";
import { buildDiscountNarrative } from "../descuentoSecuencialNarrativaModel";

/** Cap de bolas por vista (restricción de DOM): el resto se agrega y declara. */
export const RELATO_BOLAS_MAX = 60;
/** Cap de cadenas colgantes visibles; el resto se declara como oculto. */
export const RELATO_SLOTS_MAX = 24;

export type RelatoEscenaId =
  | "marco"
  | "estratos"
  | "probabilidades"
  | "sorteo"
  | "titulares"
  | "cierre";

export type RelatoMarcoFacultad = {
  facultad: string;
  /** Elegibles validados por el cálculo para la facultad (estrato N). */
  elegibles: number;
  enFoco: boolean;
};

export type RelatoEstratoCuota = {
  estrato: string;
  facultad: string;
  /** Cursos-horario titulares que el sorteo asignó al estrato (conteo M1). */
  cuota: number;
  /** `stratum_eligible_n` publicado por la corrida; null = no publicado. */
  elegiblesEstrato: number | null;
};

/** Una bola del bombo: un curso-horario real, con su tamaño real. */
export type RelatoBola = {
  code: string;
  etiqueta: string;
  facultad: string;
  /** Elegibles publicados (`eligible_n`): el tamaño de la bola. */
  elegibles: number | null;
  /** π publicada del sorteo ejecutado; solo las sorteadas la traen. */
  pi: number | null;
  /** π = 1: entra DIRECTO a la estructura, sin pasar por el sorteo. */
  certeza: boolean;
  seleccionada: boolean;
};

/** Resto del bombo agregado y rotulado (facultad "" = todo el estudio). */
export type RelatoMasaBombo = {
  facultad: string;
  aulas: number;
  /** Suma de `eligible_n` publicados de esas aulas; null si no viajan. */
  elegibles: number | null;
};

export type RelatoResumenPiFacultad = {
  facultad: string;
  aulas: number;
  certezas: number;
  piMin: number | null;
  piMax: number | null;
};

export type RelatoPasoSorteo = {
  /** `discount_step` publicado: el orden real del sorteo ejecutado. */
  paso: number;
  code: string;
  etiqueta: string;
  facultad: string;
  bruto: number | null;
  yaCubiertos: number | null;
  neto: number | null;
  /** π = 1 en la fila: la bola se ensambla rotulada «certeza · sin sorteo». */
  certeza: boolean;
};

export type RelatoCadenaFacultad = {
  facultad: string;
  titulares: number;
  reservas: number;
  extras: number;
  /** Máxima `chain_depth` publicada en la facultad; null = no publicada. */
  profundidadMax: number | null;
};

export type RelatoReservaCadena = {
  code: string;
  /** `replacement_order` publicado (fallback: número de ola M2+ − 1). */
  orden: number;
  /** `activation_weight_status` publicado; "" = no publicado. */
  estado: string;
};

/** Una cadena colgante: el slot titular y sus reservas en orden publicado. */
export type RelatoSlotCadena = {
  slot: string;
  titularCode: string;
  facultad: string;
  elegibles: number | null;
  reservas: RelatoReservaCadena[];
};

export type RelatoEstadoActivacion = {
  estado: string;
  reservas: number;
};

/** Una categoría del balance: CONTEOS de filas publicadas, marco vs muestra. */
export type RelatoBalanceCategoria = {
  categoria: string;
  marcoN: number;
  /** Proporción descriptiva marcoN / total del marco (composición, no HT). */
  marcoPct: number;
  muestraN: number;
  muestraPct: number;
};

export type RelatoBalanceVariable = {
  variable: string;
  etiqueta: string;
  /** Composición final, ordenada por peso en el marco. */
  categorias: RelatoBalanceCategoria[];
  /**
   * Valor de la variable por bola titular, en el ORDEN PUBLICADO de las filas
   * — la secuencia de RENDER del ensamblaje simultáneo, no un orden de sorteo.
   */
  porBola: string[];
};

/**
 * «El ensamblaje balanceado» (cube / local pivotal): el perfil de la muestra
 * convergiendo al del marco en las variables que la corrida DECLARÓ
 * (`selector.balance_vars`). Las barras son composición descriptiva por
 * conteo de filas publicadas; la métrica ACREDITADA de parecido es la que R
 * publica (`representativity_score`/`distance`) — aquí no se calcula ningún
 * estimador (regla I20).
 */
export type RelatoBalance = {
  /** Eco completo de balance_vars declarado por la corrida. */
  declaradas: string[];
  /** Las 2–3 variables legibles con columna publicada en marco y muestra. */
  variables: RelatoBalanceVariable[];
  /** `representativity_score` publicado por R, tal cual; null = no publicado. */
  score: number | null;
  distancia: number | null;
  /** local pivotal: spread_vars como procedencia declarativa; null = cube. */
  dispersion: string[] | null;
  /** El sorteo balanceado se resuelve de una vez; la escena lo dice. */
  notaOrden: string;
  huecos: string[];
};

type EscenaBase = { titulo: string; huecos: string[] };

export type RelatoEscenaMarco = EscenaBase & {
  id: "marco";
  filasArchivo: number | null;
  elegibles: number | null;
  cursosHorario: number | null;
  porFacultad: RelatoMarcoFacultad[];
};

export type RelatoEscenaEstratos = EscenaBase & {
  id: "estratos";
  variablesEstrato: string[];
  estratos: RelatoEstratoCuota[];
  cuotaTotal: number;
};

export type RelatoEscenaProbabilidades = EscenaBase & {
  id: "probabilidades";
  fuenteCorrida: string;
  /** Las sorteadas con su π (paridad con Sustento/Titulares). */
  aulas: RelatoBola[];
  /** Bombo visible (cap RELATO_BOLAS_MAX), ordenado por tamaño publicado. */
  bolas: RelatoBola[];
  /** Aulas del bombo que no caben como bolas, agregadas y rotuladas. */
  masa: RelatoMasaBombo[];
  /** true = el marco curso a curso está en memoria (candidatas reales). */
  bomboConocido: boolean;
  porFacultad: RelatoResumenPiFacultad[];
  certezas: number;
};

export type RelatoEscenaSorteo = EscenaBase & {
  id: "sorteo";
  /** "pasos" = la corrida registró el orden; "agregado" = hueco declarado. */
  modo: "pasos" | "agregado";
  descuento: DiscountMode | null;
  /**
   * true SOLO con descuento secuencial: la bola sorteada se encoge al neto
   * REAL de su paso. En post-hoc no se encoge (en la realidad no lo hizo): el
   * traslape se anota al ensamblarse (`ya_cubiertos`).
   */
  encoge: boolean;
  pasos: RelatoPasoSorteo[];
  porEstrato: RelatoEstratoCuota[];
  ajustesTamano: string[];
  /** Solo engines balanceados; null conserva intacta la coreografía secuencial/pool. */
  balance: RelatoBalance | null;
};

export type RelatoEscenaTitulares = EscenaBase & {
  id: "titulares";
  porFacultad: RelatoCadenaFacultad[];
  /** Cadenas colgantes visibles (cap RELATO_SLOTS_MAX). */
  slots: RelatoSlotCadena[];
  /** Slots titulares que no caben en la vista; se declaran, no se ocultan. */
  slotsOcultos: number;
  titulares: number;
  reservas: number;
  extras: number;
  estadosActivacion: RelatoEstadoActivacion[];
};

export type RelatoEscenaCierre = EscenaBase & {
  id: "cierre";
  runId: string;
  semilla: string | null;
  motor: string;
  generadoEn: string;
  frameHash: string;
  advertencias: string[];
  pesoEjemplo: { code: string; pi: number; peso: number } | null;
};

export type RelatoEscena =
  | RelatoEscenaMarco
  | RelatoEscenaEstratos
  | RelatoEscenaProbabilidades
  | RelatoEscenaSorteo
  | RelatoEscenaTitulares
  | RelatoEscenaCierre;

export type RelatoModel = {
  runId: string;
  semilla: string | null;
  /** Facultades del sorteo, en el orden institucional; el lente disponible. */
  facultades: string[];
  /** Facultad enfocada resuelta contra las del sorteo; null = estudio completo. */
  foco: string | null;
  escenas: RelatoEscena[];
  huecosDeclarados: string[];
};

export type RelatoFuente = {
  selection: CalcMuestraAulasSelection | null;
  selectionRows: Array<Record<string, unknown>>;
  frame: CalcMuestraAulasFrame | null | undefined;
  /** El bombo curso a curso (`aula_frame`); [] cuando no está en memoria. */
  frameRows: Array<Record<string, unknown>>;
  /** Estratos por facultad del componente calculado (N elegibles validados). */
  estratosCalculo: CalcMuestraEstrato[];
  /** Etiquetas de las variables de estratificación del selector. */
  selectorFields: string[];
  foco: string | null;
};

/** Slug canónico del param `foco` para una facultad (ADR 0044: kebab, sin tildes). */
export function focoDeFacultad(facultad: string): string {
  return facultad
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Resuelve el `foco` de la dirección contra las facultades reales del sorteo.
 * Acepta el slug canónico o la etiqueta literal; un foco que no corresponde a
 * ninguna facultad cae al estudio completo (no rompe).
 */
export function resolverFocoRelato(
  foco: string | null | undefined,
  facultades: string[],
): string | null {
  const pedido = String(foco ?? "").trim();
  if (!pedido) return null;
  const slug = focoDeFacultad(pedido);
  return facultades.find((facultad) => focoDeFacultad(facultad) === slug) ?? null;
}

function esTitular(row: Record<string, unknown>): boolean {
  return (
    classroomRowText(row, ["sample_role"]) === "titular" ||
    classroomRowText(row, ["wave"]) === "M1"
  );
}

function esReservaEncadenada(row: Record<string, unknown>): boolean {
  const role = classroomRowText(row, ["sample_role"]);
  const wave = classroomRowText(row, ["wave"]);
  return role === "chain_reserve" || Boolean(wave && wave !== "M1" && role !== "extra_reserve_pool");
}

function esBolsaExtra(row: Record<string, unknown>): boolean {
  return classroomRowText(row, ["sample_role"]) === "extra_reserve_pool";
}

function facultadDeFila(row: Record<string, unknown>): string {
  return classroomRowText(row, ["faculty", "facultad", "stratum"]) || "Sin facultad";
}

/** Número publicado en la fila o null. Nunca convierte ausencia en cero. */
function numeroPublicado(row: Record<string, unknown>, keys: string[]): number | null {
  const key = rowKeyForCandidates(row, keys);
  if (!key) return null;
  const n = safeNumber(row[key], Number.NaN);
  return Number.isFinite(n) ? n : null;
}

function codigoDeFila(row: Record<string, unknown>, fallback: string): string {
  return canonicalClassroomOperationalCode(
    classroomRowText(row, ["operational_code", "codigo_operativo", "codigo_aula_operativa"]),
    fallback,
  );
}

function etiquetaDeFila(row: Record<string, unknown>): string {
  return classroomRowText(row, ["course_name", "label", "classroom_id"]) || "Curso-horario";
}

function esCerteza(pi: number | null): boolean {
  return pi != null && pi >= 1 - 1e-9;
}

/** Orden determinista del bombo: tamaño publicado desc, desempate por código. */
function compararBolas(a: RelatoBola, b: RelatoBola): number {
  return (
    (b.elegibles ?? -1) - (a.elegibles ?? -1) ||
    a.code.localeCompare(b.code, "es", { sensitivity: "base", numeric: true })
  );
}

export function facultadesDelSorteo(selectionRows: Array<Record<string, unknown>>): string[] {
  const set = new Set<string>();
  for (const row of selectionRows) {
    if (!esTitular(row)) continue;
    set.add(facultadDeFila(row));
  }
  return Array.from(set).sort(compareUniversityFacultyLabels);
}

function escenaMarco(
  fuente: RelatoFuente,
  foco: string | null,
): RelatoEscenaMarco {
  const { frame, estratosCalculo } = fuente;
  const huecos: string[] = [];
  const filasArchivo = frameAuditNumber(frame, "input_rows") || null;
  const elegibles = frameAuditNumber(frame, "population_n") || null;
  const cursosHorario =
    frameAuditNumber(frame, "classroom_included_n") ||
    frameAuditNumber(frame, "classroom_n") ||
    null;
  if (!frame) {
    huecos.push("El marco vigente no está en memoria: esta escena muestra solo lo que la corrida registró.");
  }
  const porFacultad = estratosCalculo
    .map((estrato) => ({
      facultad: estrato.label,
      elegibles: safeNumber(estrato.N, 0),
      enFoco: foco != null && focoDeFacultad(estrato.label) === focoDeFacultad(foco),
    }))
    .sort((a, b) => compareUniversityFacultyLabels(a.facultad, b.facultad));
  if (!porFacultad.length) {
    huecos.push("El cálculo no publicó elegibles por facultad (estratos vacíos).");
  }
  return {
    id: "marco",
    titulo: "El marco",
    huecos,
    filasArchivo,
    elegibles,
    cursosHorario,
    porFacultad,
  };
}

function estratosDelSorteo(
  titulares: Array<Record<string, unknown>>,
): RelatoEstratoCuota[] {
  const porEstrato = new Map<string, RelatoEstratoCuota>();
  for (const row of titulares) {
    const estrato = classroomRowText(row, ["stratum"]) || facultadDeFila(row);
    const previo = porEstrato.get(estrato);
    const elegibles = numeroPublicado(row, ["stratum_eligible_n"]);
    if (previo) {
      previo.cuota += 1;
      if (previo.elegiblesEstrato == null && elegibles != null) previo.elegiblesEstrato = elegibles;
    } else {
      porEstrato.set(estrato, {
        estrato,
        facultad: facultadDeFila(row),
        cuota: 1,
        elegiblesEstrato: elegibles,
      });
    }
  }
  return Array.from(porEstrato.values()).sort(
    (a, b) =>
      compareUniversityFacultyLabels(a.facultad, b.facultad) ||
      a.estrato.localeCompare(b.estrato, "es", { sensitivity: "base", numeric: true }),
  );
}

function escenaEstratos(
  titulares: Array<Record<string, unknown>>,
  selectorFields: string[],
): RelatoEscenaEstratos {
  const estratos = estratosDelSorteo(titulares);
  const huecos: string[] = [];
  if (estratos.some((item) => item.elegiblesEstrato == null)) {
    huecos.push("La corrida no publicó los elegibles de cada estrato (stratum_eligible_n).");
  }
  return {
    id: "estratos",
    titulo: "Estratos y cuotas",
    huecos,
    variablesEstrato: selectorFields,
    estratos,
    cuotaTotal: titulares.length,
  };
}

/**
 * El bombo de E3: bolas reales para las sorteadas y —cuando `aula_frame` está
 * en memoria— para las candidatas más grandes hasta el cap; el resto se agrega
 * como masa rotulada por facultad. Sin el marco curso a curso NO se fabrican
 * bolas: se declara el hueco y, si el total auditado existe, el resto del
 * bombo se publica como una sola masa del estudio (un hecho, no una invención).
 */
function bomboDelSorteo(
  fuente: RelatoFuente,
  titulares: Array<Record<string, unknown>>,
  bolasSorteadas: RelatoBola[],
  foco: string | null,
): Pick<RelatoEscenaProbabilidades, "bolas" | "masa" | "bomboConocido" | "huecos"> {
  const huecos: string[] = [];
  const slugFoco = foco ? focoDeFacultad(foco) : null;
  const idsSorteados = new Set(
    titulares.map((row) => classroomRowText(row, ["classroom_id"])).filter(Boolean),
  );

  if (fuente.frameRows.length) {
    const candidatas: RelatoBola[] = fuente.frameRows
      .filter((row) => {
        if (slugFoco != null && focoDeFacultad(facultadDeFila(row)) !== slugFoco) return false;
        const id = classroomRowText(row, ["classroom_id"]);
        return !id || !idsSorteados.has(id);
      })
      .map((row) => ({
        code: codigoDeFila(row, classroomRowText(row, ["classroom_id"]) || "CH"),
        etiqueta: etiquetaDeFila(row),
        facultad: facultadDeFila(row),
        elegibles: numeroPublicado(row, ["eligible_n"]),
        pi: null,
        certeza: false,
        seleccionada: false,
      }))
      .sort(compararBolas);
    const cupoCandidatas = Math.max(0, RELATO_BOLAS_MAX - bolasSorteadas.length);
    const visibles = candidatas.slice(0, cupoCandidatas);
    const restantes = candidatas.slice(cupoCandidatas);
    const masaPorFacultad = new Map<string, RelatoMasaBombo>();
    for (const bola of restantes) {
      const previo = masaPorFacultad.get(bola.facultad) ?? {
        facultad: bola.facultad,
        aulas: 0,
        elegibles: null,
      };
      previo.aulas += 1;
      if (bola.elegibles != null) previo.elegibles = (previo.elegibles ?? 0) + bola.elegibles;
      masaPorFacultad.set(bola.facultad, previo);
    }
    return {
      bolas: [...bolasSorteadas, ...visibles].sort(compararBolas),
      masa: Array.from(masaPorFacultad.values()).sort((a, b) =>
        compareUniversityFacultyLabels(a.facultad, b.facultad),
      ),
      bomboConocido: true,
      huecos,
    };
  }

  // Sin `aula_frame` en memoria no hay tamaños individuales que mostrar.
  const totalMarco = frameAuditNumber(fuente.frame, "classroom_included_n") ||
    frameAuditNumber(fuente.frame, "classroom_n");
  if (slugFoco == null && totalMarco > idsSorteados.size) {
    huecos.push(
      "El proyecto no conserva el bombo curso a curso: las no sorteadas se muestran como masa agregada del marco auditado.",
    );
    return {
      bolas: [...bolasSorteadas].sort(compararBolas),
      masa: [{ facultad: "", aulas: totalMarco - idsSorteados.size, elegibles: null }],
      bomboConocido: false,
      huecos,
    };
  }
  huecos.push(
    slugFoco == null
      ? "El proyecto no conserva el bombo curso a curso ni un total auditado del marco: se muestran solo las bolas sorteadas."
      : "El proyecto no conserva el bombo curso a curso de esta facultad: se muestran solo las bolas sorteadas.",
  );
  return {
    bolas: [...bolasSorteadas].sort(compararBolas),
    masa: [],
    bomboConocido: false,
    huecos,
  };
}

function escenaProbabilidades(
  fuente: RelatoFuente,
  titulares: Array<Record<string, unknown>>,
  selection: CalcMuestraAulasSelection,
  foco: string | null,
): RelatoEscenaProbabilidades {
  const fuenteCorrida = classroomProbabilitySourceLabel(selection.probability_source);
  const aulas: RelatoBola[] = titulares.map((row, index) => {
    const pi = numeroPublicado(row, ["pi_final"]);
    return {
      code: codigoDeFila(row, `CH ${index + 1}`),
      etiqueta: etiquetaDeFila(row),
      facultad: facultadDeFila(row),
      elegibles: numeroPublicado(row, ["eligible_n", "eligible_n_bruto"]),
      pi,
      certeza: esCerteza(pi),
      seleccionada: true,
    };
  });
  const porFacultad = new Map<string, RelatoResumenPiFacultad>();
  for (const aula of aulas) {
    const previo = porFacultad.get(aula.facultad) ?? {
      facultad: aula.facultad,
      aulas: 0,
      certezas: 0,
      piMin: null,
      piMax: null,
    };
    previo.aulas += 1;
    if (aula.certeza) previo.certezas += 1;
    if (aula.pi != null) {
      previo.piMin = previo.piMin == null ? aula.pi : Math.min(previo.piMin, aula.pi);
      previo.piMax = previo.piMax == null ? aula.pi : Math.max(previo.piMax, aula.pi);
    }
    porFacultad.set(aula.facultad, previo);
  }
  const huecos: string[] = [];
  const sinPi = aulas.filter((aula) => aula.pi == null).length;
  if (sinPi > 0) {
    huecos.push(`${sinPi} de ${aulas.length} cursos-horario no traen π publicada en esta corrida.`);
  }
  const bombo = bomboDelSorteo(fuente, titulares, aulas, foco);
  return {
    id: "probabilidades",
    titulo: "Las probabilidades",
    huecos: [...huecos, ...bombo.huecos],
    fuenteCorrida,
    aulas,
    bolas: bombo.bolas,
    masa: bombo.masa,
    bomboConocido: bombo.bomboConocido,
    porFacultad: Array.from(porFacultad.values()).sort((a, b) =>
      compareUniversityFacultyLabels(a.facultad, b.facultad),
    ),
    certezas: aulas.filter((aula) => aula.certeza).length,
  };
}

/** Lista de textos de un eco `selector` (Record desconocido); [] si no viaja. */
function listaDelEco(selector: Record<string, unknown> | null | undefined, clave: string): string[] {
  const crudo = selector?.[clave];
  if (!Array.isArray(crudo)) return [];
  return crudo.map((item) => String(item ?? "").trim()).filter(Boolean);
}

/** Etiquetas legibles de las variables de balance del selector. */
const BALANCE_VAR_LABELS: Record<string, string> = {
  faculty: "Facultad",
  size_group: "Tamaño del curso-horario",
  schedule: "Turno",
  sex_top_1: "Sexo esperado",
  program: "Programa",
  level: "Nivel",
  modality: "Modalidad",
  campus: "Sede",
};

/** Prioridad de legibilidad pedida por la dirección: facultad, tamaño, turno. */
const BALANCE_VARS_PREFERIDAS = ["faculty", "size_group", "schedule"];

function conteoPorCategoria(
  rows: Array<Record<string, unknown>>,
  variable: string,
): Map<string, number> {
  const conteo = new Map<string, number>();
  for (const row of rows) {
    const valor = classroomRowText(row, [variable]);
    if (!valor) continue;
    conteo.set(valor, (conteo.get(valor) ?? 0) + 1);
  }
  return conteo;
}

/**
 * Composición acumulada de la muestra tras cada bola ensamblada, en el orden
 * publicado de las filas. Es la serie que anima las barras: determinista y
 * derivada solo de conteos de filas reales.
 */
export function serieDeConvergencia(
  variable: RelatoBalanceVariable,
): Array<Record<string, number>> {
  const serie: Array<Record<string, number>> = [];
  const acumulado: Record<string, number> = {};
  for (const valor of variable.porBola) {
    if (valor) acumulado[valor] = (acumulado[valor] ?? 0) + 1;
    serie.push({ ...acumulado });
  }
  return serie;
}

/**
 * El balance del ensamblaje (solo engines balanceados). Barras = CONTEOS de
 * filas publicadas (marco: candidatas de `aula_frame`; muestra: titulares
 * M1); la cifra oficial de parecido es la publicada por R. Nada se pondera
 * por π en el cliente (regla I20).
 */
function balanceDelEnsamblaje(
  fuente: RelatoFuente,
  titulares: Array<Record<string, unknown>>,
  selection: CalcMuestraAulasSelection,
  foco: string | null,
): RelatoBalance | null {
  const engine = String(selection.selector_engine_used ?? selection.selector_engine ?? "").trim();
  if (!isBalancedEngine(engine)) return null;

  const huecos: string[] = [];
  const eco = (selection.selector ?? null) as Record<string, unknown> | null;
  const declaradas = listaDelEco(eco, "balance_vars");
  if (!declaradas.length) {
    huecos.push("La corrida no trae el eco de sus variables de balance (selector.balance_vars).");
  }

  const slugFoco = foco ? focoDeFacultad(foco) : null;
  const marcoRows = fuente.frameRows.filter(
    (row) => slugFoco == null || focoDeFacultad(facultadDeFila(row)) === slugFoco,
  );
  if (!marcoRows.length) {
    huecos.push("Sin el marco curso a curso en memoria no hay composición del marco que comparar.");
  }

  const candidatasOrdenadas = [...declaradas].sort((a, b) => {
    const pa = BALANCE_VARS_PREFERIDAS.indexOf(a);
    const pb = BALANCE_VARS_PREFERIDAS.indexOf(b);
    return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
  });
  const variables: RelatoBalanceVariable[] = [];
  if (marcoRows.length) {
    for (const variable of candidatasOrdenadas) {
      if (variables.length >= 3) break;
      const marco = conteoPorCategoria(marcoRows, variable);
      const muestra = conteoPorCategoria(titulares, variable);
      // La variable declarada sin columna publicada no se dibuja: se declara.
      if (!marco.size || !muestra.size) continue;
      const marcoTotal = Array.from(marco.values()).reduce((a, b) => a + b, 0);
      const muestraTotal = Array.from(muestra.values()).reduce((a, b) => a + b, 0);
      const categorias = Array.from(new Set([...marco.keys(), ...muestra.keys()]))
        .map((categoria) => ({
          categoria,
          marcoN: marco.get(categoria) ?? 0,
          marcoPct: marcoTotal > 0 ? (marco.get(categoria) ?? 0) / marcoTotal : 0,
          muestraN: muestra.get(categoria) ?? 0,
          muestraPct: muestraTotal > 0 ? (muestra.get(categoria) ?? 0) / muestraTotal : 0,
        }))
        .sort(
          (a, b) =>
            b.marcoN - a.marcoN ||
            a.categoria.localeCompare(b.categoria, "es", { sensitivity: "base", numeric: true }),
        );
      variables.push({
        variable,
        etiqueta: BALANCE_VAR_LABELS[variable] ?? variable.replace(/_/g, " "),
        categorias,
        porBola: titulares.map((row) => classroomRowText(row, [variable])),
      });
    }
    const sinColumna = candidatasOrdenadas.filter(
      (variable) => !variables.some((item) => item.variable === variable),
    );
    if (declaradas.length && !variables.length) {
      huecos.push(
        `Las variables de balance declaradas (${declaradas.join(", ")}) no tienen columna publicada en marco y muestra.`,
      );
    } else if (sinColumna.length) {
      huecos.push(
        `Balance también declarado sobre ${sinColumna.join(", ")}: sin columna publicada en ambas tablas, no se dibujan.`,
      );
    }
  }

  const score =
    numeroPublicado(selection as unknown as Record<string, unknown>, ["representativity_score"]) ??
    numeroPublicado(
      (selection.representativity ?? {}) as Record<string, unknown>,
      ["representativity_score", "overall_score"],
    );
  const distancia =
    numeroPublicado(selection as unknown as Record<string, unknown>, ["representativity_distance"]) ??
    numeroPublicado(
      (selection.representativity ?? {}) as Record<string, unknown>,
      ["weighted_distance"],
    );
  if (score == null) {
    huecos.push("La corrida no publicó su métrica de representatividad (representativity_score).");
  }

  let dispersion: string[] | null = null;
  if (engine === "local_pivotal_balanceado") {
    dispersion = listaDelEco(eco, "spread_vars");
    huecos.push(
      dispersion.length
        ? `La dispersión se aplicó con ${dispersion.join(", ")}; el motor no publica métrica por par.`
        : "La dispersión se aplicó, pero el eco del selector no trae spread_vars.",
    );
  }

  return {
    declaradas,
    variables,
    score,
    distancia,
    dispersion,
    notaOrden:
      "Sorteo simultáneo: el orden visual del ensamblaje es de lectura, no del sorteo.",
    huecos,
  };
}

function escenaSorteo(
  fuente: RelatoFuente,
  selection: CalcMuestraAulasSelection,
  titulares: Array<Record<string, unknown>>,
  foco: string | null,
): RelatoEscenaSorteo {
  const huecos: string[] = [];
  // El orden viene ÍNTEGRO del dato: buildDiscountNarrative ordena por el
  // `discount_step` que persistió el motor. Este modelo solo filtra por foco.
  const narrativa = buildDiscountNarrative(selection, titulares);
  const slugFoco = foco ? focoDeFacultad(foco) : null;
  const pasos: RelatoPasoSorteo[] = (narrativa?.steps ?? [])
    .filter((step) => slugFoco == null || focoDeFacultad(step.faculty) === slugFoco)
    .map((step) => ({
      paso: step.step,
      code: step.code,
      etiqueta: step.label,
      facultad: step.faculty || "Sin facultad",
      bruto: step.bruto,
      yaCubiertos: step.yaCubiertos,
      neto: step.neto,
      certeza: esCerteza(numeroPublicado(step.row, ["pi_final"])),
    }));
  const porEstrato = estratosDelSorteo(titulares);
  const modo: RelatoEscenaSorteo["modo"] = pasos.length ? "pasos" : "agregado";
  if (modo === "agregado") {
    huecos.push("Esta corrida no registró el orden del sorteo (sin discount_step): se muestra el agregado por estrato.");
  }
  const advertencias = (selection.methodological_warning ?? [])
    .map((texto) => String(texto ?? "").trim())
    .filter(Boolean);
  const ajustesTamano = advertencias.filter((texto) =>
    /tama|size/i.test(texto),
  );
  const descuento = resolveDiscountMode(selection);
  const balance = balanceDelEnsamblaje(fuente, titulares, selection, foco);
  if (balance) huecos.push(...balance.huecos);
  return {
    id: "sorteo",
    // Con engine balanceado la escena gana su coreografía propia: mostrar QUÉ
    // significa balancear (dirección congelada 2026-08-07, iteración cube).
    titulo: balance ? "El ensamblaje balanceado" : "El sorteo",
    huecos,
    modo,
    descuento,
    // El encogimiento ES el dato: solo el descuento secuencial encogió la
    // bola en la realidad. En post-hoc el traslape se anota al ensamblarse.
    encoge: modo === "pasos" && descuento === "sequential",
    pasos,
    porEstrato,
    ajustesTamano,
    balance,
  };
}

/** Cadenas colgantes: cada slot titular con sus reservas en orden publicado. */
function slotsDeCadenas(
  titulares: Array<Record<string, unknown>>,
  reservas: Array<Record<string, unknown>>,
): { slots: RelatoSlotCadena[]; slotsOcultos: number } {
  const ordenDeReserva = (row: Record<string, unknown>) =>
    classroomRowNumber(row, ["replacement_order"]) ||
    Math.max(1, classroomWaveNumber(classroomRowText(row, ["wave"])) - 1);
  const todos: RelatoSlotCadena[] = titulares
    .map((titular, index) => {
      const slot = classroomRowText(titular, ["selection_slot_id"]);
      const titularId = classroomRowText(titular, ["classroom_id"]);
      const propias = reservas
        .filter((reserva) =>
          (slot && classroomRowText(reserva, ["selection_slot_id"]) === slot) ||
          (titularId && classroomRowText(reserva, ["replacement_for"]) === titularId),
        )
        .sort((a, b) => ordenDeReserva(a) - ordenDeReserva(b))
        .map((reserva, reservaIndex) => ({
          code: codigoDeFila(reserva, `R ${index + 1}.${reservaIndex + 1}`),
          orden: ordenDeReserva(reserva),
          estado: classroomRowText(reserva, ["activation_weight_status"]),
        }));
      return {
        slot: slot || titularId || `slot-${index + 1}`,
        titularCode: codigoDeFila(titular, `CH ${index + 1}`),
        facultad: facultadDeFila(titular),
        elegibles: numeroPublicado(titular, ["eligible_n", "eligible_n_bruto"]),
        reservas: propias,
      };
    })
    .sort(
      (a, b) =>
        compareUniversityFacultyLabels(a.facultad, b.facultad) ||
        a.titularCode.localeCompare(b.titularCode, "es", { sensitivity: "base", numeric: true }),
    );
  return {
    slots: todos.slice(0, RELATO_SLOTS_MAX),
    slotsOcultos: Math.max(0, todos.length - RELATO_SLOTS_MAX),
  };
}

function escenaTitulares(
  titulares: Array<Record<string, unknown>>,
  reservas: Array<Record<string, unknown>>,
  extras: Array<Record<string, unknown>>,
): RelatoEscenaTitulares {
  const porFacultad = new Map<string, RelatoCadenaFacultad>();
  const registrar = (
    facultad: string,
    patch: (item: RelatoCadenaFacultad) => void,
  ) => {
    const previo = porFacultad.get(facultad) ?? {
      facultad,
      titulares: 0,
      reservas: 0,
      extras: 0,
      profundidadMax: null,
    };
    patch(previo);
    porFacultad.set(facultad, previo);
  };
  for (const row of titulares) {
    registrar(facultadDeFila(row), (item) => {
      item.titulares += 1;
      const profundidad = numeroPublicado(row, ["chain_depth"]);
      if (profundidad != null) {
        item.profundidadMax = item.profundidadMax == null
          ? profundidad
          : Math.max(item.profundidadMax, profundidad);
      }
    });
  }
  const estados = new Map<string, number>();
  for (const row of reservas) {
    registrar(facultadDeFila(row), (item) => {
      item.reservas += 1;
      const profundidad = numeroPublicado(row, ["chain_depth", "replacement_order"]);
      if (profundidad != null) {
        item.profundidadMax = item.profundidadMax == null
          ? profundidad
          : Math.max(item.profundidadMax, profundidad);
      }
    });
    const estado = classroomRowText(row, ["activation_weight_status"]);
    if (estado) estados.set(estado, (estados.get(estado) ?? 0) + 1);
  }
  for (const row of extras) {
    registrar(facultadDeFila(row), (item) => {
      item.extras += 1;
    });
  }
  const huecos: string[] = [];
  if (reservas.length && estados.size === 0) {
    huecos.push("La corrida no publicó el estado de activación de las reservas (activation_weight_status).");
  }
  const cadenas = slotsDeCadenas(titulares, reservas);
  return {
    id: "titulares",
    titulo: "Titulares y cadenas",
    huecos,
    porFacultad: Array.from(porFacultad.values()).sort((a, b) =>
      compareUniversityFacultyLabels(a.facultad, b.facultad),
    ),
    slots: cadenas.slots,
    slotsOcultos: cadenas.slotsOcultos,
    titulares: titulares.length,
    reservas: reservas.length,
    extras: extras.length,
    estadosActivacion: Array.from(estados.entries())
      .map(([estado, cantidad]) => ({ estado, reservas: cantidad }))
      .sort((a, b) => b.reservas - a.reservas),
  };
}

function escenaCierre(
  selection: CalcMuestraAulasSelection,
  titulares: Array<Record<string, unknown>>,
  semilla: string | null,
): RelatoEscenaCierre {
  const huecos: string[] = [];
  if (semilla == null) huecos.push("La corrida no publicó su semilla.");
  const advertencias = (selection.methodological_warning ?? [])
    .map((texto) => String(texto ?? "").trim())
    .filter(Boolean);
  const filaEjemplo = titulares.find((row) => {
    const pi = numeroPublicado(row, ["pi_final"]);
    const peso = numeroPublicado(row, ["weight_classroom"]);
    return pi != null && pi > 0 && peso != null && peso > 0;
  });
  const pesoEjemplo = filaEjemplo
    ? {
        code: codigoDeFila(filaEjemplo, "CH"),
        pi: numeroPublicado(filaEjemplo, ["pi_final"]) ?? 0,
        peso: numeroPublicado(filaEjemplo, ["weight_classroom"]) ?? 0,
      }
    : null;
  if (!pesoEjemplo && titulares.length) {
    huecos.push("La corrida no publicó pesos por curso-horario (weight_classroom).");
  }
  return {
    id: "cierre",
    titulo: "El cierre",
    huecos,
    runId: String(selection.selection_run_id ?? "").trim(),
    semilla,
    motor: String(selection.selector_engine_used ?? selection.selector_engine ?? "").trim(),
    generadoEn: String(selection.generated_at ?? "").trim(),
    frameHash: String(selection.frame_hash ?? "").trim(),
    advertencias,
    pesoEjemplo,
  };
}

/**
 * Construye el relato de la corrida vigente. Devuelve null cuando no hay una
 * selección persistida con titulares: ese vacío lo gobierna el resolutor común
 * de la sección (`aulasSurfaceState`, etapa `relato`), no este modelo.
 */
export function construirRelato(fuente: RelatoFuente): RelatoModel | null {
  const { selection, selectionRows, selectorFields } = fuente;
  if (!selection) return null;
  const titularesTodos = selectionRows.filter(esTitular);
  if (!titularesTodos.length) return null;

  const facultades = facultadesDelSorteo(selectionRows);
  const foco = resolverFocoRelato(fuente.foco, facultades);
  const slugFoco = foco ? focoDeFacultad(foco) : null;
  const enFoco = (row: Record<string, unknown>) =>
    slugFoco == null || focoDeFacultad(facultadDeFila(row)) === slugFoco;

  const titulares = titularesTodos.filter(enFoco);
  const reservas = selectionRows.filter(esReservaEncadenada).filter(enFoco);
  const extras = selectionRows.filter(esBolsaExtra).filter(enFoco);

  const semillaNumero = safeNumber(selection.seed, Number.NaN);
  const semilla = Number.isFinite(semillaNumero) ? String(selection.seed) : null;

  const escenas: RelatoEscena[] = [
    escenaMarco(fuente, foco),
    escenaEstratos(titulares, selectorFields),
    escenaProbabilidades(fuente, titulares, selection, foco),
    escenaSorteo(fuente, selection, titulares, foco),
    escenaTitulares(titulares, reservas, extras),
    escenaCierre(selection, titulares, semilla),
  ];

  return {
    runId: String(selection.selection_run_id ?? "").trim(),
    semilla,
    facultades,
    foco,
    escenas,
    huecosDeclarados: escenas.flatMap((escena) => escena.huecos),
  };
}
