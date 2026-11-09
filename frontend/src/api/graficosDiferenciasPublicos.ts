// graficosDiferenciasPublicos.ts — la lámina entre públicos del inspector (ADR 0138), dentro de
// `GET /api/graficos/diferencias?slide=<id>` cuando `lamina.modo_letras` es «entre_publicos».
//
// Contrato: `.tpub_lamina_json` y `.tpub_tema_json` (api/R/graficos_tarjetas_publicos*.R). Patrón de
// `normalizeGraficosShareInspect`: todo campo es opcional; lo que falta o esta versión no conoce cae a un valor seguro.
// Un veredicto desconocido nunca se lee como marca (queda «desconocido» con su texto crudo para decirlo), un público sin
// la marca explícita de comparable no se da por comparable y una equivalencia que no se reconoce cuenta como no declarada.
// Lo comparten `graficosDiferencias.ts` (que lo llama desde `normalizeDiferenciasLamina`) y el inspector.

export const VEREDICTOS_PUBLICOS = [
  "marcada",
  "fragil",
  "bajo_umbral",
  "no_significativa",
  "no_comparable",
  "escalas_distintas",
  "sin_equivalencia",
  "fuera_de_familia",
] as const;

/** El veredicto de un par entre públicos; «desconocido» si el motor manda uno que esta versión no conoce. */
export type VeredictoPublico = (typeof VEREDICTOS_PUBLICOS)[number] | "desconocido";

export const ESTADOS_TEMA_PUBLICOS = ["evaluable", "sin_equivalencia", "escalas_distintas", "abstencion", "fuera_de_familia"] as const;

/** El estado de un tema; «desconocido» si el motor manda uno que esta versión no conoce (nunca se lee como comparado). */
export type EstadoTemaPublicos = (typeof ESTADOS_TEMA_PUBLICOS)[number] | "desconocido";

/** De dónde sale la equivalencia del tema: un par confirmado en el emparejado o una fila de la matriz. */
export type EquivalenciaTema = "emparejado" | "matriz";

export type GrupoPublico = {
  base: string;
  etiqueta: string;
  /** Porcentaje del público en el indicador (0-100), redondeado como en la lámina. */
  p: number | null;
  n: number | null;
  comparable: boolean;
  motivo: string | null;
};

export type ParPublico = {
  a: string;
  b: string;
  p_a: number | null;
  p_b: number | null;
  /** Diferencia en puntos porcentuales (a − b). */
  dif_pp: number | null;
  p: number | null;
  p_ajustado: number | null;
  veredicto: VeredictoPublico;
  /** El texto que mandó el motor cuando el veredicto es «desconocido». */
  veredicto_crudo: string | null;
  /** Intervalo de Newcombe de la diferencia, en puntos: dato informativo, nunca la marca. */
  ic_newcombe: [number, number] | null;
};

export type TemaEntrePublicos = {
  fila: string;
  indicador: string | null;
  estado: EstadoTemaPublicos;
  estado_crudo: string | null;
  motivo: string | null;
  equivalencia: EquivalenciaTema | null;
  grupos: GrupoPublico[];
  pares: ParPublico[];
  nota: string;
};

export type FamiliaPublicos = {
  /** Comparaciones en la familia de Benjamini-Hochberg entre públicos (0 si no aplica). */
  m: number;
  /** `true`: la familia es la de esta lámina (no la del plan). */
  local: boolean;
};

/** Lo propio de la lámina entre públicos; estado, nota, motivo y `revisar` viven en `LaminaDiferencias`. */
export type LaminaEntrePublicos = {
  familia: FamiliaPublicos;
  temas: TemaEntrePublicos[];
  /** Los temas que llevan tarjeta en la lámina, en el orden en que salen. */
  tarjetas: TemaEntrePublicos[];
};

type Registro = Record<string, unknown>;

const esRegistro = (v: unknown): v is Registro => !!v && typeof v === "object" && !Array.isArray(v);
const registro = (v: unknown): Registro => (esRegistro(v) ? v : {});
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
/** R serializa un escalar como vector de largo uno: `["x"]` vale `"x"`. */
const escalar = (v: unknown): unknown => (Array.isArray(v) && v.length === 1 ? v[0] : v);
const texto = (v: unknown): string => {
  const x = escalar(v);
  return typeof x === "string" ? x : typeof x === "number" && Number.isFinite(x) ? String(x) : "";
};
const textoONulo = (v: unknown): string | null => {
  const t = texto(v).trim();
  return t && t !== "NA" ? t : null;
};
const numeroONulo = (v: unknown): number | null => {
  const x = escalar(v);
  if (x === null || x === undefined || x === "" || typeof x === "boolean") return null;
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : null;
};

function intervalo(v: unknown): [number, number] | null {
  const l = lista(v);
  const a = numeroONulo(l[0]);
  const b = numeroONulo(l[1]);
  return a !== null && b !== null ? [Math.min(a, b), Math.max(a, b)] : null;
}

function veredictoDe(v: unknown): { veredicto: VeredictoPublico; crudo: string | null } {
  const t = textoONulo(v);
  if (t && (VEREDICTOS_PUBLICOS as readonly string[]).includes(t)) return { veredicto: t as VeredictoPublico, crudo: null };
  return { veredicto: "desconocido", crudo: t };
}

function estadoDe(v: unknown): { estado: EstadoTemaPublicos; crudo: string | null } {
  const t = textoONulo(v);
  if (t && (ESTADOS_TEMA_PUBLICOS as readonly string[]).includes(t)) return { estado: t as EstadoTemaPublicos, crudo: null };
  return { estado: "desconocido", crudo: t };
}

export function normalizeGrupoPublico(v: unknown): GrupoPublico {
  const r = registro(v);
  const base = texto(r.base);
  return {
    base,
    etiqueta: textoONulo(r.etiqueta) ?? base,
    p: numeroONulo(r.p),
    n: numeroONulo(r.n),
    comparable: escalar(r.comparable) === true,
    motivo: textoONulo(r.motivo),
  };
}

export function normalizeParPublico(v: unknown): ParPublico {
  const r = registro(v);
  const { veredicto, crudo } = veredictoDe(r.veredicto);
  return {
    a: texto(r.a),
    b: texto(r.b),
    p_a: numeroONulo(r.p_a),
    p_b: numeroONulo(r.p_b),
    dif_pp: numeroONulo(r.dif_pp),
    p: numeroONulo(r.p),
    p_ajustado: numeroONulo(r.p_ajustado),
    veredicto,
    veredicto_crudo: crudo,
    ic_newcombe: intervalo(r.ic_newcombe),
  };
}

export function normalizeTemaEntrePublicos(v: unknown): TemaEntrePublicos {
  const r = registro(v);
  const { estado, crudo } = estadoDe(r.estado);
  const eq = textoONulo(r.equivalencia);
  return {
    fila: texto(r.fila),
    indicador: textoONulo(r.indicador),
    estado,
    estado_crudo: crudo,
    motivo: textoONulo(r.motivo),
    equivalencia: eq === "emparejado" || eq === "matriz" ? eq : null,
    grupos: lista(r.grupos).map(normalizeGrupoPublico),
    pares: lista(r.pares).map(normalizeParPublico),
    nota: texto(r.nota),
  };
}

/** Lo entre públicos de la lámina cruda (`lamina` de la respuesta). Un campo ausente deja la lista vacía, nunca la inventa. */
export function normalizeLaminaEntrePublicos(raw: unknown): LaminaEntrePublicos {
  const r = registro(raw);
  const f = registro(r.familia);
  const m = numeroONulo(f.m);
  return {
    familia: { m: m !== null && m > 0 ? Math.trunc(m) : 0, local: escalar(f.local) === true },
    temas: lista(r.temas).map(normalizeTemaEntrePublicos),
    tarjetas: lista(r.tarjetas).map(normalizeTemaEntrePublicos),
  };
}
