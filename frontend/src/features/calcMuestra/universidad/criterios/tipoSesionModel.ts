/**
 * Modelo PURO de la vista «Tipo de sesión por facultad» (reunión con el asesor
 * muestral §4, 2026-07-15): la decisión de tipo de sesión no puede ser global a
 * ciegas — se ve y se decide POR FACULTAD. Patrón territorialSummaryModel:
 * lógica calculable con test; el .tsx solo presenta.
 *
 * La matriz por facultad COMPILA a la estructura que YA persiste
 * (`byVariable.session_type.exceptions[facKey] = { categories, op }`): cero
 * migración. «Hereda el global» = sin entrada; «propia» = entrada con
 * op "replace" (override completo). Entradas legacy con op "add" se leen como
 * unión global ∪ categorías y al primer toque se compilan a "replace".
 */
import type {
  CalcMuestraAulasExploracion,
  CalcMuestraAulasParticularidadSessionType,
  CalcMuestraSessionTypeImpacto,
  CriterioSeleccion,
  CriterioVariable,
} from "../../../../api/client";
import {
  categoriaMarcada,
  categoriasDeVariable,
  removeExcepcion,
  upsertExcepcion,
} from "../../dominio";
import { UNIVERSITY_SESSION_TYPE_EXCLUIDOS_MARCO, type SessionTypeSugerencia } from "../shared/constants";

/** Id de la variable del catálogo que gobierna esta vista. */
export const SESSION_TYPE_VARIABLE_ID = "session_type";

/**
 * Coerción defensiva a array (jsonlite desempaca arrays de 1 a escalares en el
 * round-trip por disco: `exceptions.categories` puede llegar como string).
 */
function asArray<T>(x: T[] | T | null | undefined): T[] {
  return Array.isArray(x) ? x : x == null ? [] : [x];
}

/**
 * Clave de texto para joins DEFENSIVOS por label entre catálogo, Explorador,
 * impacto y sugerencias: minúsculas, sin tildes, espacios colapsados.
 */
export function textKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s_]+/g, " ")
    .trim();
}

/** true si algún patrón (ya normalizado) aparece en el texto normalizado. */
function matchea(texto: string, patterns: readonly string[]): boolean {
  const t = textKey(texto);
  return patterns.some((p) => p && t.includes(textKey(p)));
}

/** Detección de subtipos agrupados entre paréntesis, p. ej. "TEORICO(A,B)". */
const RE_SUBTIPOS_AGRUPADOS = /\([^)]{2,}\)/;

/**
 * true si el label es de naturaleza TEÓRICA (incluido el agrupado por DTI
 * "TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)"). El teórico es el tipo
 * objetivo del marco, nunca un tipo a EXCLUIR: por eso protege a la naturaleza
 * teórico-práctica del sello "practica" si la base viene desagregada con una
 * categoría propia "TEORICO-PRACTICO". Detectar por prefijo del label.
 */
function esTipoTeorico(label: string): boolean {
  return textKey(label).startsWith("teorico");
}

/**
 * true si el label es la etiqueta PARAGUAS agrupada por DTI (subtipos entre
 * paréntesis, misma detección que `senalAgrupamientoDti`). El paraguas
 * representa TODO el teórico: matchear un subtipo interno por substring
 * ("laborator"/"practic") desde una regla no-teórica sugeriría el teórico
 * entero (falso positivo, ya es el default global). CLAVE: la guarda es «es
 * paraguas», no «empieza por teorico» — cuando la base venga DESAGREGADA
 * (solicitud DTI 2026), "TEORICO-LABORATORIO" y "TEORICO-PRACTICO" llegan SIN
 * paréntesis, no son paraguas, y la regla de Ingeniería SÍ debe sugerirlos (§4).
 */
function esTipoAgrupadoDti(label: string): boolean {
  return RE_SUBTIPOS_AGRUPADOS.test(label);
}

/**
 * true si el label lleva un sello de exclusión del marco (§8.2). Nunca marca al
 * teórico: la naturaleza teórico-práctica no es una «práctica» excluida. Doble
 * red: (1) `esTipoTeorico` corta cualquier sello sobre la familia teórica;
 * (2) el sello "practica" (con -a) no matchea "teorico-practico" (con -o), así
 * que la práctica preprofesional se veta sin tocar la naturaleza teórica.
 */
function tipoExcluidoDelMarco(label: string): boolean {
  if (esTipoTeorico(label)) return false;
  const t = textKey(label);
  return UNIVERSITY_SESSION_TYPE_EXCLUIDOS_MARCO.some((sello) => t.includes(textKey(sello)));
}

/**
 * Filtro de elegibilidad de un tipo como candidato de una regla de sugerencia:
 *  (a) el paraguas agrupado por DTI solo lo sugiere una regla que apunte al
 *      teórico — mata el falso positivo del agrupado desde reglas no-teóricas
 *      sin bloquear los subtipos teóricos desagregados (que no son paraguas);
 *  (b) los tipos que §8.2 excluye del marco no se sugieren nunca.
 */
function tipoElegibleParaSugerencia(label: string, reglaApuntaAlTeorico: boolean): boolean {
  if (esTipoAgrupadoDti(label)) return reglaApuntaAlTeorico;
  return !tipoExcluidoDelMarco(label);
}

// ---------------------------------------------------------------------------
// Decisión por facultad: herencia vs set propio, y su compilación a exceptions
// ---------------------------------------------------------------------------

export type DecisionFacultad = {
  decision: "hereda" | "propia";
  /** Set EFECTIVO de claves de tipo activas en la facultad (orden del catálogo). */
  tipos: string[];
};

/** Set global de la variable: claves marcadas según mode include/exclude. */
export function setGlobalDeVariable(variable: CriterioVariable, sel: CriterioSeleccion): string[] {
  return categoriasDeVariable(variable)
    .filter((c) => categoriaMarcada(sel, c.key))
    .map((c) => c.key);
}

/**
 * Decisión efectiva de una facultad: sin entrada en `exceptions` HEREDA el set
 * global; con entrada es PROPIA (op "replace" = su set exacto; op "add"/ausente
 * = unión con el global, semántica legacy). El resultado siempre se proyecta
 * sobre las claves vigentes del catálogo (claves stale de un remapeo no cuentan).
 */
export function decisionFacultad(
  variable: CriterioVariable,
  sel: CriterioSeleccion,
  facKey: string,
): DecisionFacultad {
  const global = setGlobalDeVariable(variable, sel);
  const exc = sel.exceptions?.[facKey];
  if (!exc) return { decision: "hereda", tipos: global };
  const propias = asArray(exc.categories);
  const set = new Set(exc.op === "replace" ? propias : [...global, ...propias]);
  return {
    decision: "propia",
    tipos: categoriasDeVariable(variable)
      .map((c) => c.key)
      .filter((k) => set.has(k)),
  };
}

/**
 * Fija el set PROPIO de una facultad (override completo, op "replace"),
 * proyectado sobre claves válidas del catálogo y deduplicado.
 */
export function aplicarTiposEnFacultad(
  variable: CriterioVariable,
  sel: CriterioSeleccion,
  facKey: string,
  tipos: readonly string[],
): CriterioSeleccion {
  const pedidas = new Set(tipos);
  const categories = categoriasDeVariable(variable)
    .map((c) => c.key)
    .filter((k) => pedidas.has(k));
  return upsertExcepcion(sel, facKey, { categories, op: "replace" });
}

/**
 * Alterna un tipo en UNA facultad: parte del set efectivo (herede o no) y
 * compila SIEMPRE a una decisión propia op "replace". Volver a heredar es una
 * acción explícita aparte (`heredarFacultad`).
 */
export function toggleTipoEnFacultad(
  variable: CriterioVariable,
  sel: CriterioSeleccion,
  facKey: string,
  tipoKey: string,
): CriterioSeleccion {
  const efectivo = new Set(decisionFacultad(variable, sel, facKey).tipos);
  if (efectivo.has(tipoKey)) efectivo.delete(tipoKey);
  else efectivo.add(tipoKey);
  return aplicarTiposEnFacultad(variable, sel, facKey, [...efectivo]);
}

/** Elimina la decisión propia: la facultad vuelve a heredar el set global. */
export function heredarFacultad(sel: CriterioSeleccion, facKey: string): CriterioSeleccion {
  return removeExcepcion(sel, facKey);
}

// ---------------------------------------------------------------------------
// Filas por facultad: distribución de tipos (CH del catálogo + elegibles del
// Explorador, joins defensivos por label) y estado de la decisión
// ---------------------------------------------------------------------------

export type TipoFacultadDato = {
  key: string;
  label: string;
  /** CH del tipo en la facultad (catálogo `por_facultad`); null si el catálogo no trae la distribución. */
  ch: number | null;
  /** Elegibles del Explorador para tipo×facultad; null sin marco o sin join. */
  elegibles: number | null;
  /** true si el tipo está activo para esta facultad (efectivo, herede o no). */
  activo: boolean;
};

export type FilaFacultad = {
  facKey: string;
  facLabel: string;
  decision: "hereda" | "propia";
  tipos: TipoFacultadDato[];
  /** Suma de CH conocidos de la fila (denominador de las mini-barras). */
  chTotal: number;
};

export function filasPorFacultad(args: {
  variable: CriterioVariable;
  sel: CriterioSeleccion;
  facultades: ReadonlyArray<{ key: string; label: string }>;
  exploracion?: CalcMuestraAulasExploracion | null;
}): FilaFacultad[] {
  const { variable, sel, facultades, exploracion } = args;
  const cats = categoriasDeVariable(variable);
  // La radiografía `por_tipo_sesion` del Explorador está keyed por *tipo de
  // sesión* (Tipo Curso); su join por nombre solo es válido para session_type.
  // Reusarla para otra variable flat (p. ej. condicion_curso) cruza por
  // homónimo: valores que existen en AMBAS columnas —TALLER/SEMINARIO/ACTIVIDAD—
  // matchearían y arrastrarían el CH y los elegibles del TIPO DE SESIÓN a la
  // categoría de condición (dato ajeno y engañoso). Fuera de session_type el CH
  // sale solo del catálogo del propio criterio y no hay elegibles.
  const usaExploracionTipos = variable.id === SESSION_TYPE_VARIABLE_ID;
  return facultades.map((fac) => {
    const { decision, tipos: activos } = decisionFacultad(variable, sel, fac.key);
    const activoSet = new Set(activos);
    const facTexto = textKey(fac.label);
    const expFac = usaExploracionTipos
      ? (exploracion?.por_facultad ?? []).find((f) => textKey(f.facultad) === facTexto) ?? null
      : null;
    const tipos: TipoFacultadDato[] = cats.map((cat) => {
      // CH del catálogo del criterio: facultad ausente = 0 real; sin
      // distribución (catálogo viejo) el dato es desconocido → null.
      const dist = cat.por_facultad;
      const catCh =
        dist === undefined
          ? null
          : dist.find((pf) => textKey(pf.facultad) === facTexto)?.ch ?? 0;
      const expTipo = expFac?.por_tipo_sesion.find(
        (t) => textKey(t.tipo) === textKey(cat.label) || textKey(t.tipo) === textKey(cat.key),
      );
      // Si la exploración lista el tipo (tipo de sesión en el marco vigente),
      // el CH sale de ahí para cuadrar con la radiografía de arriba, que usa la
      // misma fuente. El catálogo queda de respaldo para tipos que la
      // exploración no trae (fuera del marco), donde no hay dato de exploración.
      const ch = expTipo ? expTipo.ch : catCh;
      return {
        key: cat.key,
        label: cat.label,
        ch,
        elegibles: expTipo ? expTipo.elegibles : null,
        activo: activoSet.has(cat.key),
      };
    });
    return {
      facKey: fac.key,
      facLabel: fac.label,
      decision,
      tipos,
      chTotal: tipos.reduce((sum, t) => sum + (t.ch ?? 0), 0),
    };
  });
}

// ---------------------------------------------------------------------------
// Sugerencias de la reunión (matching defensivo; nunca auto-aplicadas)
// ---------------------------------------------------------------------------

export type SugerenciaResuelta = {
  modo: SessionTypeSugerencia["modo"];
  /** Claves del catálogo recomendadas (orden del catálogo). */
  tipos: string[];
  /** Labels legibles de esas claves (para el chip «Sugerido: …»). */
  labels: string[];
  porque: string;
};

/**
 * Primera regla cuyo patrón de facultad matchea (el orden del arreglo es la
 * precedencia), resuelta contra las categorías REALES del catálogo. Antes de
 * matchear los `tipoPatterns`, cada categoría pasa por `tipoElegibleParaSugerencia`:
 * el teórico agrupado por DTI no se sugiere desde reglas no-teóricas (falso
 * positivo por substring interno) y los tipos que §8.2 excluye del marco
 * (seminario, tesis, asesoría, investigación, prácticas, artísticas) nunca se
 * ofrecen. Si ningún tipo recomendado existe/es elegible en la base, no hay
 * sugerencia (null): jamás se ofrece un «usar» que dejaría a la facultad sin
 * tipos o que recomendaría un tipo fuera del marco.
 */
export function sugerenciaParaFacultad(
  variable: CriterioVariable,
  facLabel: string,
  sugerencias: readonly SessionTypeSugerencia[],
): SugerenciaResuelta | null {
  const regla = sugerencias.find((s) => matchea(facLabel, s.facultadPatterns));
  if (!regla) return null;
  const reglaApuntaAlTeorico = regla.tipoPatterns.some((p) => textKey(p).startsWith("teoric"));
  const matched = categoriasDeVariable(variable).filter(
    (c) =>
      tipoElegibleParaSugerencia(c.label, reglaApuntaAlTeorico) &&
      matchea(`${c.label} ${c.key}`, regla.tipoPatterns),
  );
  if (!matched.length) return null;
  return {
    modo: regla.modo,
    tipos: matched.map((c) => c.key),
    labels: matched.map((c) => c.label),
    porque: regla.porque,
  };
}

/** Set propio que produciría «usar» la sugerencia en esa facultad. */
function setDeSugerencia(
  variable: CriterioVariable,
  sel: CriterioSeleccion,
  facKey: string,
  sugerencia: SugerenciaResuelta,
): string[] {
  if (sugerencia.modo === "solo") return [...sugerencia.tipos];
  const efectivo = new Set(decisionFacultad(variable, sel, facKey).tipos);
  for (const k of sugerencia.tipos) efectivo.add(k);
  return [...efectivo];
}

/** Aplica la sugerencia como decisión propia de la facultad (op "replace"). */
export function aplicarSugerencia(
  variable: CriterioVariable,
  sel: CriterioSeleccion,
  facKey: string,
  sugerencia: SugerenciaResuelta,
): CriterioSeleccion {
  return aplicarTiposEnFacultad(variable, sel, facKey, setDeSugerencia(variable, sel, facKey, sugerencia));
}

/** true si «usar» la sugerencia no cambiaría el set efectivo de la facultad. */
export function sugerenciaAplicada(
  variable: CriterioVariable,
  sel: CriterioSeleccion,
  facKey: string,
  sugerencia: SugerenciaResuelta,
): boolean {
  const actual = decisionFacultad(variable, sel, facKey).tipos;
  const objetivo = new Set(setDeSugerencia(variable, sel, facKey, sugerencia));
  return actual.length === objetivo.size && actual.every((k) => objetivo.has(k));
}

// ---------------------------------------------------------------------------
// Aviso de la trampa del taller (frame.session_type_impacto)
// ---------------------------------------------------------------------------

export type AvisoImpactoFacultad = {
  facultad: string;
  /** Clave de la facultad para exceptuar desde el aviso; null si no se pudo resolver. */
  facKey: string | null;
  ch: number;
  elegibles: number;
};

export type AvisoTipoExcluido = {
  tipo: string;
  /** Labels de facultades donde el tipo YA está exceptuado. */
  exceptuadoEn: string[];
  /** Facultades que pierden CH (>0) porque el tipo sigue excluido ahí. */
  perdidoEn: AvisoImpactoFacultad[];
};

/**
 * Gating del aviso: solo tipos excluidos con `perdido_en` de ch > 0. Estado
 * sin impacto (payload ausente, sin tipos, o pérdidas en 0) ⇒ lista vacía y
 * la tarjeta no muestra nada.
 */
export function avisosImpacto(
  impacto: CalcMuestraSessionTypeImpacto | null | undefined,
  facultades: ReadonlyArray<{ key: string; label: string }>,
): AvisoTipoExcluido[] {
  if (!impacto) return [];
  const facPorTexto = new Map(facultades.map((f) => [textKey(f.label), f.key]));
  return (impacto.tipos_excluidos ?? [])
    .map((t): AvisoTipoExcluido => ({
      tipo: t.tipo,
      exceptuadoEn: [...t.exceptuado_en],
      perdidoEn: t.perdido_en
        .filter((p) => p.ch > 0)
        .map((p) => ({
          facultad: p.facultad,
          facKey: facPorTexto.get(textKey(p.facultad)) ?? null,
          ch: p.ch,
          elegibles: p.elegibles,
        })),
    }))
    .filter((t) => t.perdidoEn.length > 0);
}

/** Clave del catálogo cuyo label (o clave) matchea el texto del tipo, o null. */
export function resolverTipoKey(variable: CriterioVariable, tipoTexto: string): string | null {
  const objetivo = textKey(tipoTexto);
  const cat = categoriasDeVariable(variable).find(
    (c) => textKey(c.label) === objetivo || textKey(c.key) === objetivo,
  );
  return cat ? cat.key : null;
}

/** true si el tipo (por texto) ya está activo en la facultad (borrador). */
export function tipoActivoEnFacultad(
  variable: CriterioVariable,
  sel: CriterioSeleccion,
  facKey: string,
  tipoTexto: string,
): boolean {
  const key = resolverTipoKey(variable, tipoTexto);
  if (!key) return false;
  return decisionFacultad(variable, sel, facKey).tipos.includes(key);
}

/**
 * Acción del aviso «Exceptuar también en …»: agrega el tipo al set efectivo de
 * la facultad como decisión propia. Si el tipo no existe en el catálogo (labels
 * desincronizados), devuelve la selección intacta — nunca inventa una clave.
 */
export function exceptuarTipoEnFacultad(
  variable: CriterioVariable,
  sel: CriterioSeleccion,
  facKey: string,
  tipoTexto: string,
): CriterioSeleccion {
  const key = resolverTipoKey(variable, tipoTexto);
  if (!key) return sel;
  const efectivo = decisionFacultad(variable, sel, facKey).tipos;
  if (efectivo.includes(key)) return sel;
  return aplicarTiposEnFacultad(variable, sel, facKey, [...efectivo, key]);
}

// ---------------------------------------------------------------------------
// Señal de agrupamiento DTI (tipo de curso agrupado en la base)
// ---------------------------------------------------------------------------

export type SenalAgrupamientoDti = {
  origen: "particularidades" | "catalogo";
  /** Categoría que evidencia el agrupamiento (dominante o con paréntesis). */
  categoria: string;
};

/**
 * La base trae el tipo de curso AGRUPADO por DTI cuando el marco lo detectó
 * (`particularidades.session_type_dominante`) o cuando una categoría del
 * catálogo contiene paréntesis con subtipos, p. ej. "TEORICO(TEORICO-PRACTICO,…)".
 */
export function senalAgrupamientoDti(
  variable: CriterioVariable | null | undefined,
  dominante: CalcMuestraAulasParticularidadSessionType | null | undefined,
): SenalAgrupamientoDti | null {
  if (dominante?.categoria) return { origen: "particularidades", categoria: dominante.categoria };
  if (!variable) return null;
  const agrupada = categoriasDeVariable(variable).find((c) => esTipoAgrupadoDti(c.label));
  return agrupada ? { origen: "catalogo", categoria: agrupada.label } : null;
}
