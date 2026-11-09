// graficosDiferencias.ts — la regla de diferencias del estudio y su resultado por lámina (ADR 0128 §5).
//
// Contrato congelado: `router_graficos_diferencias.R`. Todo campo es opcional para el normalizador: un payload vacío,
// un campo que falta o un valor que esta versión no conoce cae a un valor seguro (nunca a «marcada»). Patrón de
// `normalizeGraficosShareInspect`. Se reexporta desde `graficos.ts`.

import { apiFetch, handle, headers } from "./core";
import { normalizeLaminaEntrePublicos, type LaminaEntrePublicos } from "./graficosDiferenciasPublicos";

export * from "./graficosDiferenciasPublicos";

// ---------- Regla del estudio (§1) ----------

export type PruebaDiferencias = "rao_scott" | "z";
export type CorreccionDiferencias = "bh_informe" | "bonferroni_fila";
export type FragilesDiferencias = "contorno" | "ocultar";

export type ReglaDiferencias = {
  version: number;
  prueba: PruebaDiferencias;
  correccion: CorreccionDiferencias;
  alfa: number;
  umbral_puntos: number;
  base_minima: number;
  conglomerados_minimos: number;
  fragiles: FragilesDiferencias;
  conglomerado: string | null;
  estrato: string | null;
  tendencia: boolean;
  incluir_ns: boolean;
  max_letras: number;
};

/** Los valores por defecto de la regla (ADR 0128 §1) sin diseño declarado: la prueba z con Bonferroni por fila. */
export const REGLA_DIFERENCIAS_POR_DEFECTO: ReglaDiferencias = {
  version: 1,
  prueba: "z",
  correccion: "bonferroni_fila",
  alfa: 0.05,
  umbral_puntos: 10,
  base_minima: 30,
  conglomerados_minimos: 8,
  fragiles: "contorno",
  conglomerado: null,
  estrato: null,
  tendencia: false,
  incluir_ns: false,
  max_letras: 6,
};

export type ColumnaCandidata = { valor: string; etiqueta: string };

export type ColumnasDiferencias = { conglomerado: ColumnaCandidata[]; estrato: ColumnaCandidata[] };

export type ReglaDiferenciasRespuesta = {
  regla: ReglaDiferencias;
  /** La que propondría el diseño (Rao-Scott por la columna de conglomerado reconocible, o la z de siempre). */
  propuesta: ReglaDiferencias;
  /** De dónde sale la regla vigente: «estudio» (guardada en el proyecto) o «propuesta»; `null` si no lo dice. */
  origen: string | null;
  columnas: ColumnasDiferencias;
  /** Comparaciones de la familia de Benjamini-Hochberg, si el backend la informa. */
  familia: number | null;
};

export type CambiosTablas = {
  cambian: number;
  total: number | null;
  ganan_marca: number | null;
  pierden_marca: number | null;
  cambian_letras: number | null;
};

export type VistaPreviaRegla = { regla: ReglaDiferencias; origen: string | null; cambios_tablas: CambiosTablas; nota: string; familia: number | null };

// ---------- Resultado por lámina (§5) ----------

export type ModoLetras = "letras" | "frente_al_resto" | "entre_publicos";
export type EstadoLaminaDiferencias = "con_marcas" | "ninguna" | "abstencion" | "sin_cruce" | "error";
export type VeredictoPar = "marcada" | "fragil" | "bajo_umbral" | "no_significativa" | "no_comparable";
export type CodigoRevisar = "titulo_afirma_fragil" | "sin_diferencias" | "bajo_umbral" | "base_chica" | "sin_prueba";

export type ErrorDiferencias = { code: string; message: string; error_id: string | null };

export type GrupoDiferencias = {
  letra: string;
  /** Código del cruce para ese grupo. */
  codigo: string | null;
  etiqueta: string;
  n: number | null;
  conglomerados: number | null;
  comparable: boolean;
  motivo: string | null;
};

export type ParDiferencias = {
  fila: string;
  a: string;
  b: string;
  p_a: number | null;
  p_b: number | null;
  n_a: number | null;
  n_b: number | null;
  dif: number | null;
  p: number | null;
  p_ajustado: number | null;
  deff: number | null;
  ic: [number, number] | null;
  veredicto: VeredictoPar;
  redaccion: string;
};

/** El resultado de la prueba sobre una ranura con cruce: lo común a la lámina (primera ranura) y a cada ranura. */
export type ResultadoDiferencias = {
  slide_id: string;
  titulo: string;
  estado: EstadoLaminaDiferencias;
  /** El interruptor `mostrar_significancia` de la lámina, según el backend. */
  activo: boolean;
  motivo: string | null;
  error: ErrorDiferencias | null;
  variable: string | null;
  cruce: string | null;
  /** «entre_publicos»: la lámina compara el mismo tema entre bases (ADR 0138) y trae `entre_publicos`. */
  modo_letras: ModoLetras;
  grupos: GrupoDiferencias[];
  pares: ParDiferencias[];
  nota: string;
  /** Códigos de `revisar`; los que esta versión no conoce se conservan para que el filtro «Para revisar» los cuente. */
  revisar: string[];
};

/** Una ranura con cruce de la lámina (ADR 0128 «Familia por base»), probada sobre su base y la familia de esa base. */
export type RanuraDiferencias = ResultadoDiferencias & {
  /** Nombre de la ranura en el payload (`grafico_1`…) o su posición si no tiene nombre. */
  ranura: string;
  /** Posición 1-based en el payload. */
  indice: number;
  graficador: string;
  /** La base de la ranura; `null` si no se pudo resolver (la entrada viene en error). */
  base: string | null;
};

export type LaminaDiferencias = ResultadoDiferencias & {
  /** Temas, pares y familia de la lámina entre públicos; `null` en una lámina de grupos de una base. */
  entre_publicos: LaminaEntrePublicos | null;
  /**
   * Toda ranura con cruce, en el orden del payload. Sin `ranuras` en la respuesta (backend anterior), la primera
   * ranura: los campos de arriba. Vacía en la lámina entre públicos y en la que no tiene cruce.
   */
  ranuras: RanuraDiferencias[];
};

export type ResumenInformeDiferencias = {
  cruces: number;
  marcadas: number;
  fragiles: number;
  ninguna: number;
  bases_chicas: number;
  sin_prueba: number;
  familia: number;
};

export type DiferenciasLaminaRespuesta = { regla: ReglaDiferencias; lamina: LaminaDiferencias };

export type DiferenciasInformeRespuesta = {
  regla: ReglaDiferencias;
  laminas: LaminaDiferencias[];
  resumen: ResumenInformeDiferencias;
};

// ---------- Normalizadores ----------

type Registro = Record<string, unknown>;

const esRegistro = (v: unknown): v is Registro => !!v && typeof v === "object" && !Array.isArray(v);
const registro = (v: unknown): Registro => (esRegistro(v) ? v : {});
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const texto = (v: unknown, defecto = ""): string => (typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : defecto);
const textoONulo = (v: unknown): string | null => {
  const t = texto(v).trim();
  return t ? t : null;
};
const numeroONulo = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
const numero = (v: unknown, defecto: number): number => numeroONulo(v) ?? defecto;
const booleano = (v: unknown, defecto: boolean): boolean => (typeof v === "boolean" ? v : defecto);
function deEntre<T extends string>(v: unknown, validos: readonly T[], defecto: T): T {
  return typeof v === "string" && (validos as readonly string[]).includes(v) ? (v as T) : defecto;
}

const PRUEBAS = ["rao_scott", "z"] as const;
const CORRECCIONES = ["bh_informe", "bonferroni_fila"] as const;
const FRAGILES = ["contorno", "ocultar"] as const;
const ESTADOS = ["con_marcas", "ninguna", "abstencion", "sin_cruce", "error"] as const;
const VEREDICTOS = ["marcada", "fragil", "bajo_umbral", "no_significativa", "no_comparable"] as const;
export const CODIGOS_REVISAR: readonly CodigoRevisar[] = ["titulo_afirma_fragil", "sin_diferencias", "bajo_umbral", "base_chica", "sin_prueba"];

/** Una regla con todos sus campos; lo que falta o no se reconoce toma el valor de `base` (por defecto, la z de siempre). */
export function normalizeDiferenciasRegla(raw: unknown, base: ReglaDiferencias = REGLA_DIFERENCIAS_POR_DEFECTO): ReglaDiferencias {
  const r = registro(raw);
  const alfa = numero(r.alfa, base.alfa);
  return {
    version: numero(r.version, base.version),
    prueba: deEntre(r.prueba, PRUEBAS, base.prueba),
    correccion: deEntre(r.correccion, CORRECCIONES, base.correccion),
    // Un nivel fuera de (0, 1) no es un nivel: vuelve al de la base.
    alfa: alfa > 0 && alfa < 1 ? alfa : base.alfa,
    umbral_puntos: Math.max(0, numero(r.umbral_puntos, base.umbral_puntos)),
    base_minima: Math.max(0, numero(r.base_minima, base.base_minima)),
    conglomerados_minimos: Math.max(0, numero(r.conglomerados_minimos, base.conglomerados_minimos)),
    fragiles: deEntre(r.fragiles, FRAGILES, base.fragiles),
    conglomerado: "conglomerado" in r ? textoONulo(r.conglomerado) : base.conglomerado,
    estrato: "estrato" in r ? textoONulo(r.estrato) : base.estrato,
    tendencia: booleano(r.tendencia, base.tendencia),
    incluir_ns: booleano(r.incluir_ns, base.incluir_ns),
    max_letras: Math.max(1, numero(r.max_letras, base.max_letras)),
  };
}

function normalizeColumna(v: unknown): ColumnaCandidata | null {
  if (typeof v === "string") return v.trim() ? { valor: v, etiqueta: v } : null;
  const r = registro(v);
  const valor = textoONulo(r.valor ?? r.value ?? r.name ?? r.columna);
  if (!valor) return null;
  const n = numeroONulo(r.n_valores);
  const base = textoONulo(r.etiqueta ?? r.label) ?? valor;
  return { valor, etiqueta: n !== null ? `${base} (${n} ${n === 1 ? "valor" : "valores"})` : base };
}

const columnasDe = (v: unknown): ColumnaCandidata[] => {
  const vistas = new Set<string>();
  return lista(v).map(normalizeColumna).filter((c): c is ColumnaCandidata => {
    if (!c || vistas.has(c.valor)) return false;
    vistas.add(c.valor);
    return true;
  });
};

/**
 * Columnas candidatas: `{ conglomerado: [...], estrato: [...] }` o, si llega una sola lista, la misma para las dos.
 * Cada columna puede venir como texto o como `{ valor|value|name, etiqueta|label }`.
 */
export function normalizeDiferenciasColumnas(raw: unknown): ColumnasDiferencias {
  if (Array.isArray(raw)) {
    const todas = columnasDe(raw);
    return { conglomerado: todas, estrato: todas };
  }
  const r = registro(raw);
  return { conglomerado: columnasDe(r.conglomerado), estrato: columnasDe(r.estrato) };
}

export function normalizeDiferenciasReglaRespuesta(raw: unknown): ReglaDiferenciasRespuesta {
  const r = registro(raw);
  const propuesta = normalizeDiferenciasRegla(r.propuesta);
  return {
    regla: normalizeDiferenciasRegla(r.regla, propuesta),
    propuesta,
    origen: textoONulo(r.origen),
    columnas: normalizeDiferenciasColumnas(r.columnas),
    familia: numeroONulo(r.familia),
  };
}

/** `cambios_tablas`: `{ celdas_cambian, celdas_total, ganan_marca, pierden_marca, cambian_letras }` (o un número suelto). */
export function normalizeCambiosTablas(raw: unknown): CambiosTablas {
  const directo = numeroONulo(raw);
  if (directo !== null) return { cambian: Math.max(0, directo), total: null, ganan_marca: null, pierden_marca: null, cambian_letras: null };
  const r = registro(raw);
  const cambian = numeroONulo(r.celdas_cambian ?? r.cambian);
  const total = numeroONulo(r.celdas_total ?? r.total);
  return {
    cambian: Math.max(0, cambian ?? 0),
    total: total !== null && total >= 0 ? total : null,
    ganan_marca: numeroONulo(r.ganan_marca),
    pierden_marca: numeroONulo(r.pierden_marca),
    cambian_letras: numeroONulo(r.cambian_letras),
  };
}

export function normalizeVistaPreviaRegla(raw: unknown): VistaPreviaRegla {
  const r = registro(raw);
  return {
    regla: normalizeDiferenciasRegla(r.regla),
    origen: textoONulo(r.origen),
    cambios_tablas: normalizeCambiosTablas(r.cambios_tablas),
    nota: texto(r.nota),
    familia: numeroONulo(r.familia),
  };
}

function normalizeGrupo(v: unknown, i: number): GrupoDiferencias {
  const r = registro(v);
  const letra = textoONulo(r.letra) ?? String.fromCharCode(65 + (i % 26));
  return {
    letra,
    codigo: textoONulo(r.codigo),
    etiqueta: textoONulo(r.etiqueta) ?? letra,
    n: numeroONulo(r.n),
    conglomerados: numeroONulo(r.conglomerados),
    // Sin la marca explícita, el grupo no se da por comparable.
    comparable: r.comparable === true,
    motivo: textoONulo(r.motivo),
  };
}

function normalizeIntervalo(v: unknown): [number, number] | null {
  const l = lista(v);
  const a = numeroONulo(l[0]);
  const b = numeroONulo(l[1]);
  return a !== null && b !== null ? [a, b] : null;
}

function normalizePar(v: unknown): ParDiferencias {
  const r = registro(v);
  return {
    fila: texto(r.fila),
    a: texto(r.a),
    b: texto(r.b),
    p_a: numeroONulo(r.p_a),
    p_b: numeroONulo(r.p_b),
    n_a: numeroONulo(r.n_a),
    n_b: numeroONulo(r.n_b),
    dif: numeroONulo(r.dif),
    p: numeroONulo(r.p),
    p_ajustado: numeroONulo(r.p_ajustado),
    deff: numeroONulo(r.deff),
    ic: normalizeIntervalo(r.ic),
    // Un veredicto que no se reconoce no se dibuja como marca.
    veredicto: deEntre(r.veredicto, VEREDICTOS, "no_comparable"),
    redaccion: texto(r.redaccion),
  };
}

function normalizeError(v: unknown): ErrorDiferencias | null {
  if (!esRegistro(v)) return null;
  return { code: texto(v.code), message: texto(v.message), error_id: textoONulo(v.error_id) };
}

function normalizeResultado(r: Registro): ResultadoDiferencias {
  const estadoCrudo = r.estado;
  const conocido = typeof estadoCrudo === "string" && (ESTADOS as readonly string[]).includes(estadoCrudo);
  // Un estado que esta versión no conoce es un error visible, no una abstención ni un vacío: no se afirma nada.
  const estado: EstadoLaminaDiferencias = conocido ? (estadoCrudo as EstadoLaminaDiferencias) : "error";
  const modo = deEntre(r.modo_letras, ["letras", "frente_al_resto", "entre_publicos"] as const, "letras");
  const error = normalizeError(r.error) ?? (estado === "error"
    ? { code: "", message: conocido ? "La prueba no devolvió el detalle del error." : `El motor devolvió un estado que esta versión no reconoce${typeof estadoCrudo === "string" && estadoCrudo ? ` ("${estadoCrudo}")` : ""}.`, error_id: null }
    : null);
  return {
    slide_id: texto(r.slide_id),
    titulo: texto(r.titulo),
    estado,
    activo: r.activo === true,
    motivo: textoONulo(r.motivo),
    error: estado === "error" ? error : null,
    variable: textoONulo(r.variable),
    cruce: textoONulo(r.cruce),
    modo_letras: modo,
    grupos: lista(r.grupos).map(normalizeGrupo),
    pares: lista(r.pares).map(normalizePar),
    nota: texto(r.nota),
    revisar: [...new Set(lista(r.revisar).map((c) => texto(c).trim()).filter(Boolean))],
  };
}

/** Una ranura de `ranuras`; lo que no trae la lámina (slide_id, título) lo hereda de ella. */
export function normalizeRanuraDiferencias(raw: unknown, i: number, lamina?: Pick<ResultadoDiferencias, "slide_id" | "titulo">): RanuraDiferencias {
  const r = registro(raw);
  const indice = Math.max(1, Math.round(numero(r.indice, i + 1)));
  const resultado = normalizeResultado(r);
  return {
    ...resultado,
    slide_id: resultado.slide_id || lamina?.slide_id || "",
    titulo: resultado.titulo || lamina?.titulo || "",
    ranura: textoONulo(r.ranura) ?? String(indice),
    indice,
    graficador: texto(r.graficador).trim(),
    base: textoONulo(r.base),
  };
}

/** La primera ranura armada con los campos de la lámina: lo que se muestra cuando el backend no manda `ranuras`. */
export function ranuraDeLaLamina(resultado: ResultadoDiferencias): RanuraDiferencias {
  return { ...resultado, ranura: "", indice: 1, graficador: "", base: null };
}

export function normalizeDiferenciasLamina(raw: unknown): LaminaDiferencias {
  const r = registro(raw);
  const resultado = normalizeResultado(r);
  const entre = resultado.modo_letras === "entre_publicos";
  const tieneCruce = resultado.cruce !== null || resultado.estado !== "sin_cruce";
  // `ranuras` presente (aun vacía) manda; sin ella, la primera ranura si la lámina tiene cruce. Entre públicos, ninguna.
  const ranuras = entre ? [] : Array.isArray(r.ranuras)
    ? r.ranuras.map((x, i) => normalizeRanuraDiferencias(x, i, resultado))
    : tieneCruce ? [ranuraDeLaLamina(resultado)] : [];
  return { ...resultado, entre_publicos: entre ? normalizeLaminaEntrePublicos(r) : null, ranuras };
}

export function normalizeDiferenciasLaminaRespuesta(raw: unknown): DiferenciasLaminaRespuesta {
  const r = registro(raw);
  return { regla: normalizeDiferenciasRegla(r.regla), lamina: normalizeDiferenciasLamina(r.lamina) };
}

/** Resumen del informe; un conteo que falta se deriva de las láminas (nunca se inventa un cero que el motor no dio). */
export function normalizeResumenInforme(raw: unknown, laminasInforme: readonly LaminaDiferencias[]): ResumenInformeDiferencias {
  const r = registro(raw);
  // El backend cuenta cada ranura con cruce; el respaldo cuenta lo mismo. Como `.sig_resumen`, `marcadas` son sólo las
  // firmes y `fragiles` va aparte: sumarlas en `marcadas` contaba dos veces cada frágil en el resumen.
  const laminas: readonly ResultadoDiferencias[] = laminasInforme.flatMap<ResultadoDiferencias>((l) => (l.ranuras.length ? l.ranuras : [l]));
  const pares = laminas.flatMap((l) => l.pares);
  const cuenta = (codigo: string) => laminas.filter((l) => l.revisar.includes(codigo)).length;
  return {
    cruces: numero(r.cruces, laminas.filter((l) => l.estado !== "sin_cruce").length),
    marcadas: numero(r.marcadas, pares.filter((p) => p.veredicto === "marcada").length),
    fragiles: numero(r.fragiles, pares.filter((p) => p.veredicto === "fragil").length),
    ninguna: numero(r.ninguna, laminas.filter((l) => l.estado === "ninguna").length),
    bases_chicas: numero(r.bases_chicas, cuenta("base_chica")),
    sin_prueba: numero(r.sin_prueba, cuenta("sin_prueba")),
    familia: numero(r.familia, 0),
  };
}

export function normalizeDiferenciasInforme(raw: unknown): DiferenciasInformeRespuesta {
  const r = registro(raw);
  const laminas = lista(r.laminas).map(normalizeDiferenciasLamina);
  return { regla: normalizeDiferenciasRegla(r.regla), laminas, resumen: normalizeResumenInforme(r.resumen, laminas) };
}

// ---------- Endpoints ----------

const BASE = "/api/graficos/diferencias";

export async function getDiferenciasRegla(): Promise<ReglaDiferenciasRespuesta> {
  const raw = await handle<unknown>(await apiFetch(`${BASE}/regla`, { headers: headers() }));
  return normalizeDiferenciasReglaRespuesta(raw);
}

/** Sin guardar: cuántas celdas de las tablas cambian con esa regla y la nota que leerá el cliente. */
export async function previsualizarDiferenciasRegla(regla: ReglaDiferencias, init?: Pick<RequestInit, "signal">): Promise<VistaPreviaRegla> {
  const raw = await handle<unknown>(await apiFetch(`${BASE}/regla/vista-previa`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ regla }),
    signal: init?.signal,
  }));
  return normalizeVistaPreviaRegla(raw);
}

/** Guarda la regla en `graficos_config$significancia` del proyecto (marca `project_dirty`). */
export async function guardarDiferenciasRegla(regla: ReglaDiferencias): Promise<VistaPreviaRegla> {
  const raw = await handle<unknown>(await apiFetch(`${BASE}/regla`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ regla }),
  }));
  return normalizeVistaPreviaRegla(raw);
}

export async function getDiferencias(slideId: string, init?: Pick<RequestInit, "signal">): Promise<DiferenciasLaminaRespuesta> {
  const raw = await handle<unknown>(await apiFetch(`${BASE}?slide=${encodeURIComponent(slideId)}`, { headers: headers(), signal: init?.signal }));
  return normalizeDiferenciasLaminaRespuesta(raw);
}

export async function getDiferenciasInforme(init?: Pick<RequestInit, "signal">): Promise<DiferenciasInformeRespuesta> {
  const raw = await handle<unknown>(await apiFetch(`${BASE}/informe`, { headers: headers(), signal: init?.signal }));
  return normalizeDiferenciasInforme(raw);
}
