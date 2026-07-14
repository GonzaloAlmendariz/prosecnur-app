/**
 * Capa de dominio del motor muestral — MODELO EVALUABLE de criterios por
 * categoría (alumno y aula).
 *
 * Complementa (no reemplaza) el modelo DIDÁCTICO `CriterioAula` de `tipos.ts`
 * (regla como texto): aquí la selección es dato operable que viaja al motor R.
 * El académico marca qué categorías/umbrales de cada variable entran y en qué
 * capa (marco/instrumento/procesamiento); el motor evalúa población y marco.
 * Estas funciones son PURAS (patrón territorialSummaryModel): dado el catálogo
 * emitido por el motor + la selección, computan defaults, toggles inmutables y
 * un conteo por aula CLIENTE (estimación previa a reconstruir; la cifra final
 * siempre la fija R).
 *
 * Principio: cero lógica específica de estudio. La selección canónica es solo
 * un preset seleccionable; aquí no se hardcodea ninguna categoría concreta.
 *
 * Los tipos del contrato (`CriteriosCatalogo`, `CriterioSeleccion`,
 * `CriteriosSeleccionMarco`, …) viven en el boundary `api/client.ts` — este
 * módulo opera sobre ellos, como el adaptador con `CalcMuestraAulasFrame`.
 */
import type {
  CriterioCategoria,
  CriterioLayer,
  CriterioSeleccion,
  CriterioThreshold,
  CriterioVariable,
  CriteriosCatalogo,
  CriteriosSeleccionMarco,
} from "../../../api/client";

/** Estado de marca de un grupo jerárquico respecto de sus hijos. */
export type EstadoGrupo = "all" | "some" | "none";

/** Resumen por variable para la UI: seleccionadas, total y conteo por aula. */
export type ResumenVariable = {
  variableId: string;
  kind: CriterioVariable["kind"];
  /** Categorías seleccionadas (según mode include/exclude). */
  seleccionadas: number;
  /** Categorías totales de la variable. */
  total: number;
  /** Aulas cubiertas por la selección (estimación cliente, unión de sets). */
  aulasCubiertas: number;
  /** Aulas totales enumeradas en la variable (denominador informativo). */
  aulasTotales: number;
};

/** Umbral válido solo si trae una operación conocida (defensivo vs `{}` de R). */
function thresholdValido(t: CriterioSeleccion["threshold"]): boolean {
  return Boolean(t) && (t!.op === ">=" || t!.op === "<=" || t!.op === "between");
}

/**
 * Selección de una variable con defaults (mode include, sin categorías).
 * Defensivo contra el JSON de R/jsonlite: `fromValue: "NA"` y `threshold: {}`
 * llegan en selecciones persistidas y deben tratarse como AUSENTES (si no,
 * `ordinalIncluido` con fromValue "NA" excluye a todos y el conteo cae a 0).
 */
export function seleccionVariable(
  seleccion: CriteriosSeleccionMarco | null | undefined,
  variableId: string,
): CriterioSeleccion {
  const actual = seleccion?.byVariable?.[variableId];
  const fromValue = actual?.fromValue;
  return {
    mode: actual?.mode ?? "include",
    categories: actual?.categories ? [...actual.categories] : [],
    ...(actual?.match ? { match: actual.match } : {}),
    ...(actual?.exceptions ? { exceptions: actual.exceptions } : {}),
    ...(thresholdValido(actual?.threshold) ? { threshold: actual!.threshold } : {}),
    ...(actual?.includeValues ? { includeValues: [...actual.includeValues] } : {}),
    ...(typeof fromValue === "number" && Number.isFinite(fromValue) ? { fromValue } : {}),
    ...(actual?.layer ? { layer: actual.layer } : {}),
  };
}

/** Aplana las categorías de una variable (flat o jerárquica). */
export function categoriasDeVariable(variable: CriterioVariable): CriterioCategoria[] {
  if (variable.kind === "hierarchical") {
    return (variable.groups ?? []).flatMap((g) => g.children);
  }
  return variable.categories ?? [];
}

/** Claves de todas las categorías de una variable. */
export function clavesDeVariable(variable: CriterioVariable): string[] {
  return categoriasDeVariable(variable).map((c) => c.key);
}

/**
 * Selección inicial: por defecto TODO incluido (población y marco sin filtrar,
 * retro-compat con el path legacy). El match de una variable jerárquica nace en
 * "any" (un aula pasa si ≥1 de sus valores cae en el set). Todo criterio de
 * alumno se aplica SIEMPRE al marco (recorta la población N): la UI ya no expone
 * un selector de capa, así que la selección fija `layer: "marco"`.
 */
export function seleccionInicial(catalogo: CriteriosCatalogo | null | undefined): CriteriosSeleccionMarco {
  const byVariable: Record<string, CriterioSeleccion> = {};
  for (const variable of catalogo?.variables ?? []) {
    if (variable.kind === "range") continue; // usa courseLevelRanges, no byVariable
    const sel: CriterioSeleccion = { mode: "include" };
    if (variable.kind === "flat" || variable.kind === "hierarchical") {
      sel.categories = clavesDeVariable(variable);
      if (variable.kind === "hierarchical") sel.match = "any";
    } else if (variable.kind === "ordinal") {
      sel.includeValues = [...(variable.values ?? [])];
    }
    // numeric: sin threshold = incluye todo el rango observado.
    if (variable.scope === "alumno") sel.layer = "marco";
    byVariable[variable.id] = sel;
  }
  return { byVariable };
}

/**
 * Categorías canónicas (universidad) por rol de variable, según los criterios
 * de inclusión de la doc definitiva HST (03.3): pregrado · regular · presencial
 * · tipos de curso válidos (teórico/laboratorio/taller/obligatorio) · docente
 * estable. Devuelve las CLAVES a incluir, o `null` si la variable no reconoce
 * ninguna categoría canónica — en ese caso se incluye TODO (no restringe), para
 * que en bases distintas (motor general) el default no filtre de más.
 */
function categoriasCanonicasFlat(variable: CriterioVariable): string[] | null {
  const cats = categoriasDeVariable(variable);
  const txt = (c: (typeof cats)[number]) => `${c.label ?? ""} ${c.key ?? ""}`.toLowerCase();
  const has = (t: string, ...subs: string[]) => subs.some((s) => t.includes(s));
  const pick = (test: (t: string) => boolean) => cats.filter((c) => test(txt(c))).map((c) => c.key);
  let keys: string[] = [];
  switch (variable.id) {
    case "formation":
      keys = pick((t) => t.includes("pregrado") && !has(t, "posgrado", "maestr", "doctor", "diplom", "especialidad"));
      break;
    case "condition":
      keys = pick((t) => t.includes("regular") && !has(t, "reincorpor", "movilidad", "ingreso", "traslado", "incorpor", "consorcio", "especial", "electivo", "obligator"));
      break;
    case "modality":
      keys = pick((t) => t.includes("presencial") && !has(t, "semi", "virtual", "distancia", "online", "remoto"));
      break;
    case "session_type":
    case "course_type":
      // Válidos (03.3 §B.3): teóricos, teórico-prácticos, laboratorios, talleres.
      // Ojo: "teórico-práctico" es VÁLIDO, así que la exclusión de prácticas
      // apunta a "práctica supervisada/preprofesional", no al genérico "practic".
      keys = pick(
        (t) =>
          has(t, "teoric", "teóric", "laborator", "taller", "obligator") &&
          !has(t, "seminario", "tesis", "asesor", "investigac", "actividad", "supervisad", "preprofesional", "campo", "artist", "artíst", "idiom"),
      );
      break;
    case "condicion_curso":
      keys = pick((t) => has(t, "obligator", "especialidad", "taller"));
      break;
    case "teacher_type":
      // Canónico (03.3): DOCENTE CONTRATADO + DOCENTE ORDINARIO (Principal/
      // Asociado/Auxiliar). EXCLUIR DOCENTE EXTRAORDINARIO (el substring
      // "ordinario" matchea "EXTRA-ordinario") y PRE-DOCENTE (ya cae fuera).
      keys = pick((t) => has(t, "ordinario", "contratad") && !has(t, "extraordinar"));
      break;
    default:
      return null; // sin canónico conocido → incluir todo (no restringe)
  }
  return keys.length ? keys : null;
}

/**
 * Selección CANÓNICA por defecto: parte de la selección inicial (todo incluido)
 * y aplica los criterios canónicos universitarios en las variables que los
 * reconocen (pregrado/regular/presencial/tipos válidos/edad ≥18). En bases sin
 * esas categorías cae con gracia a "todo incluido" por variable. Es un punto de
 * partida defendible (reproduce el marco de referencia), no una restricción
 * silenciosa: el usuario lo ve marcado y puede cambiarlo.
 */
export function seleccionCanonica(catalogo: CriteriosCatalogo | null | undefined): CriteriosSeleccionMarco {
  const byVariable: Record<string, CriterioSeleccion> = {};
  for (const variable of catalogo?.variables ?? []) {
    if (variable.kind === "range") continue;
    const sel: CriterioSeleccion = { mode: "include" };
    if (variable.kind === "flat" || variable.kind === "hierarchical") {
      sel.categories = categoriasCanonicasFlat(variable) ?? clavesDeVariable(variable);
      if (variable.kind === "hierarchical") sel.match = "any";
    } else if (variable.kind === "ordinal") {
      sel.includeValues = [...(variable.values ?? [])];
    } else if (variable.kind === "numeric" && (variable.id === "age" || variable.id === "edad")) {
      sel.threshold = { op: ">=", min: 18 };
    }
    if (variable.scope === "alumno") sel.layer = "marco";
    byVariable[variable.id] = sel;
  }
  return { byVariable };
}

/**
 * Claves de match VÁLIDAS de una variable contra el catálogo vigente. flat:
 * claves de sus categorías; hierarchical: clave de cada GRUPO y de cada HIJO
 * (el motor arma group.key + children[].key en `.cm_criterios_enum_teacher`);
 * ordinal/numeric/range: sin claves de categoría (se reconcilian por su propio
 * dominio, no por este set). Sirve para detectar una selección 100% STALE
 * heredada de otra columna tras remapear un rol.
 */
function clavesValidasDeVariable(variable: CriterioVariable): Set<string> {
  if (variable.kind === "hierarchical") {
    const keys = new Set<string>();
    for (const g of variable.groups ?? []) {
      if (g.key) keys.add(g.key);
      for (const c of g.children) keys.add(c.key);
    }
    return keys;
  }
  if (variable.kind === "flat") {
    return new Set((variable.categories ?? []).map((c) => c.key));
  }
  return new Set();
}

/**
 * Reconcilia una selección persistida contra el catálogo ACTUAL. Motivo: al
 * remapear el rol de una variable (p. ej. teacher_type pasa de leer "Condición"
 * a "Tipo de docente"), la selección guardada conserva claves de la columna
 * vieja que ya no matchean ninguna categoría real; en modo include eso excluye
 * TODOS los cursos-horario y el marco elegible cae a 0.
 *
 * Regla, por variable no-range del catálogo:
 *  - Sin selección guardada → toma la canónica de esa variable (default
 *    defendible; una variable nueva no debe quedar sin criterio).
 *  - Selección 100% STALE (su set no intersecta NINGUNA clave/valor válido) →
 *    se reemplaza por la canónica de esa variable.
 *  - Intersección parcial (el usuario deseleccionó válidos a propósito) → se
 *    CONSERVA intacta.
 * `courseLevelRanges` y `minEligible` se preservan sin tocar. Es idempotente:
 * reconciliar dos veces produce el mismo resultado (la canónica usa claves
 * válidas), lo que permite compararla contra la guardada para persistir el
 * saneo sin entrar en bucle.
 */
/**
 * Coerción defensiva a array. El .pulso persistido pasa por jsonlite, que puede
 * desempacar un array de 1 elemento a escalar; sin esto, `categories`/`includeValues`
 * llegan como string/number sueltos y `.some()` revienta (crash de la app al abrir
 * un proyecto con selección de una sola categoría).
 */
function comoArray<T>(x: T[] | T | null | undefined): T[] {
  return Array.isArray(x) ? x : x == null ? [] : [x];
}

export function reconciliarSeleccionConCatalogo(
  seleccion: CriteriosSeleccionMarco,
  catalogo: CriteriosCatalogo | null | undefined,
): CriteriosSeleccionMarco {
  const canon = seleccionCanonica(catalogo);
  const byVariable: Record<string, CriterioSeleccion> = { ...seleccion.byVariable };
  for (const variable of catalogo?.variables ?? []) {
    if (variable.kind === "range") continue; // usa courseLevelRanges, no byVariable
    const canonVar = canon.byVariable[variable.id];
    const guardada = seleccion.byVariable?.[variable.id];
    if (!guardada) {
      if (canonVar) byVariable[variable.id] = canonVar;
      continue;
    }
    if (variable.kind === "flat" || variable.kind === "hierarchical") {
      const marcadas = comoArray(guardada.categories);
      if (marcadas.length === 0) continue; // nada marcado: es "vacío", no stale
      const validas = clavesValidasDeVariable(variable);
      if (validas.size > 0 && !marcadas.some((k) => validas.has(k)) && canonVar) {
        byVariable[variable.id] = canonVar;
      }
    } else if (variable.kind === "ordinal") {
      const marcados = comoArray(guardada.includeValues);
      if (marcados.length === 0) continue; // fromValue / sin set: no stale
      const validos = new Set(variable.values ?? []);
      if (validos.size > 0 && !marcados.some((v) => validos.has(v)) && canonVar) {
        byVariable[variable.id] = canonVar;
      }
    }
    // numeric: umbral con dominio propio; no se reconcilia por claves.
  }
  return { ...seleccion, byVariable };
}

// ---------------------------------------------------------------------------
// flat / hierarchical
// ---------------------------------------------------------------------------

/** true si la categoría `key` está marcada (según mode include/exclude). */
export function categoriaMarcada(sel: CriterioSeleccion, key: string): boolean {
  const inSet = (sel.categories ?? []).includes(key);
  return sel.mode === "exclude" ? !inSet : inSet;
}

/**
 * Alterna una categoría preservando la semántica de `mode`. Trabaja siempre
 * sobre el set de claves incluidas: en modo include toggle directo; en modo
 * exclude, marcar = quitar del set de excluidas.
 */
export function toggleCategoria(sel: CriterioSeleccion, key: string): CriterioSeleccion {
  const marcada = categoriaMarcada(sel, key);
  const debeEstarEnSet = sel.mode === "exclude" ? marcada : !marcada;
  const set = new Set(sel.categories ?? []);
  if (debeEstarEnSet) set.add(key);
  else set.delete(key);
  return { ...sel, categories: [...set] };
}

/** Estado de un grupo jerárquico según cuántos hijos están marcados. */
export function estadoGrupo(sel: CriterioSeleccion, childKeys: string[]): EstadoGrupo {
  if (childKeys.length === 0) return "none";
  const marcadas = childKeys.filter((k) => categoriaMarcada(sel, k)).length;
  if (marcadas === 0) return "none";
  if (marcadas === childKeys.length) return "all";
  return "some";
}

/**
 * Marca o desmarca todos los hijos de un grupo de una vez. Si el grupo está
 * completo, los desmarca; si está parcial o vacío, los marca todos.
 */
export function toggleGrupo(sel: CriterioSeleccion, childKeys: string[]): CriterioSeleccion {
  const estado = estadoGrupo(sel, childKeys);
  const marcarTodos = estado !== "all";
  return childKeys.reduce((acc, key) => {
    const yaMarcada = categoriaMarcada(acc, key);
    if (marcarTodos === yaMarcada) return acc;
    return toggleCategoria(acc, key);
  }, sel);
}

/** Fija el match ("any"/"all") de una variable multi-valor. */
export function setMatch(sel: CriterioSeleccion, match: "any" | "all"): CriterioSeleccion {
  return { ...sel, match };
}

// ---------------------------------------------------------------------------
// numeric (edad): umbral o rango
// ---------------------------------------------------------------------------

/** Fija el umbral/rango numérico de forma inmutable (undefined = sin filtro). */
export function setThreshold(
  sel: CriterioSeleccion,
  threshold: CriterioThreshold | undefined,
): CriterioSeleccion {
  const next = { ...sel };
  if (threshold) next.threshold = threshold;
  else delete next.threshold;
  return next;
}

// ---------------------------------------------------------------------------
// ordinal (ciclo): set de valores o "desde N"
// ---------------------------------------------------------------------------

/** true si el valor ordinal `v` está incluido (por set o por fromValue). */
export function ordinalIncluido(sel: CriterioSeleccion, v: number): boolean {
  if (sel.fromValue != null) return v >= sel.fromValue;
  if (sel.includeValues) return sel.includeValues.includes(v);
  return true; // sin restricción declarada = incluye todo
}

/** Alterna un valor ordinal del set (cambia a modo set si estaba en fromValue). */
export function toggleOrdinal(
  sel: CriterioSeleccion,
  v: number,
  todos: number[],
): CriterioSeleccion {
  // Materializa el set actual (respeta fromValue si estaba activo).
  const base = sel.includeValues ?? (sel.fromValue != null ? todos.filter((x) => x >= sel.fromValue!) : [...todos]);
  const set = new Set(base);
  if (set.has(v)) set.delete(v);
  else set.add(v);
  const next = { ...sel };
  delete next.fromValue;
  next.includeValues = todos.filter((x) => set.has(x));
  return next;
}

/** Fija "desde N en adelante" (limpia el set explícito). undefined = sin filtro. */
export function setFromValue(sel: CriterioSeleccion, from: number | undefined): CriterioSeleccion {
  const next = { ...sel };
  delete next.includeValues;
  if (from != null) next.fromValue = from;
  else delete next.fromValue;
  return next;
}

// ---------------------------------------------------------------------------
// capa (alumno)
// ---------------------------------------------------------------------------

/** Capa vigente de la variable (selección > default de la variable > marco). */
export function capaDe(sel: CriterioSeleccion, variable: CriterioVariable): CriterioLayer {
  return sel.layer ?? variable.defaultLayer ?? "marco";
}

/** Fija la capa del criterio de forma inmutable. */
export function setLayer(sel: CriterioSeleccion, layer: CriterioLayer): CriterioSeleccion {
  return { ...sel, layer };
}

// ---------------------------------------------------------------------------
// excepciones por facultad
// ---------------------------------------------------------------------------

/**
 * Agrega o reemplaza la excepción por facultad de una variable. `op` = "add"
 * suma categorías al set base para esa facultad; "replace" define un set propio.
 */
export function upsertExcepcion(
  sel: CriterioSeleccion,
  facultad: string,
  override: { categories: string[]; op?: "add" | "replace" },
): CriterioSeleccion {
  const exceptions = { ...(sel.exceptions ?? {}) };
  exceptions[facultad] = { categories: [...override.categories], ...(override.op ? { op: override.op } : {}) };
  return { ...sel, exceptions };
}

/** Elimina la excepción por facultad de una variable. */
export function removeExcepcion(sel: CriterioSeleccion, facultad: string): CriterioSeleccion {
  if (!sel.exceptions?.[facultad]) return sel;
  const exceptions = { ...sel.exceptions };
  delete exceptions[facultad];
  return { ...sel, exceptions: Object.keys(exceptions).length ? exceptions : undefined };
}

// ---------------------------------------------------------------------------
// conteos cliente y resúmenes
// ---------------------------------------------------------------------------

/**
 * Conteo por aula CLIENTE de una variable: suma de aulas de las categorías
 * marcadas. Es la unión de sets (no del embudo secuencial), útil como pista en
 * vivo antes de reconstruir; la cifra dura la produce el motor R. En variables
 * jerárquicas con match "any" la unión sobre-cuenta si un aula mezcla docentes
 * de varios grupos, por eso se rotula como estimación.
 */
export function aulasCubiertas(variable: CriterioVariable, sel: CriterioSeleccion): number {
  return categoriasDeVariable(variable)
    .filter((c) => categoriaMarcada(sel, c.key))
    .reduce((sum, c) => sum + (Number.isFinite(c.aulas) ? c.aulas : 0), 0);
}

/** Aulas totales enumeradas de una variable (denominador informativo). */
export function aulasTotales(variable: CriterioVariable): number {
  return categoriasDeVariable(variable).reduce((sum, c) => sum + (Number.isFinite(c.aulas) ? c.aulas : 0), 0);
}

/** Resumen por variable para las cabeceras de la suite. */
export function resumenVariable(
  variable: CriterioVariable,
  seleccion: CriteriosSeleccionMarco | null | undefined,
): ResumenVariable {
  const sel = seleccionVariable(seleccion, variable.id);
  if (variable.kind === "ordinal") {
    const valores = variable.values ?? [];
    return {
      variableId: variable.id,
      kind: variable.kind,
      seleccionadas: valores.filter((v) => ordinalIncluido(sel, v)).length,
      total: valores.length,
      aulasCubiertas: 0,
      aulasTotales: 0,
    };
  }
  const claves = clavesDeVariable(variable);
  return {
    variableId: variable.id,
    kind: variable.kind,
    seleccionadas: claves.filter((k) => categoriaMarcada(sel, k)).length,
    total: claves.length,
    aulasCubiertas: aulasCubiertas(variable, sel),
    aulasTotales: aulasTotales(variable),
  };
}

// ---------------------------------------------------------------------------
// range (nivel de curso por facultad) y umbral de elegibles
// ---------------------------------------------------------------------------

/** Rangos de nivel admitidos para una facultad (range var course_level). */
export function rangosFacultad(
  seleccion: CriteriosSeleccionMarco | null | undefined,
  facultad: string,
): Array<[number, number]> {
  return (seleccion?.courseLevelRanges?.[facultad] ?? []).map((r) => [r[0], r[1]] as [number, number]);
}

/** Fija (reemplaza) los rangos de nivel de una facultad de forma inmutable. */
export function setRangosFacultad(
  seleccion: CriteriosSeleccionMarco,
  facultad: string,
  rangos: Array<[number, number]>,
): CriteriosSeleccionMarco {
  const courseLevelRanges = { ...(seleccion.courseLevelRanges ?? {}) };
  if (rangos.length === 0) {
    delete courseLevelRanges[facultad];
  } else {
    courseLevelRanges[facultad] = rangos.map((r) => [r[0], r[1]] as [number, number]);
  }
  return {
    ...seleccion,
    courseLevelRanges: Object.keys(courseLevelRanges).length ? courseLevelRanges : undefined,
  };
}

/** Reemplaza la selección de UNA variable dentro del marco, inmutable. */
export function setSeleccionVariable(
  seleccion: CriteriosSeleccionMarco | null | undefined,
  variableId: string,
  sel: CriterioSeleccion,
): CriteriosSeleccionMarco {
  const base: CriteriosSeleccionMarco = seleccion
    ? { ...seleccion, byVariable: { ...seleccion.byVariable } }
    : { byVariable: {} };
  base.byVariable[variableId] = sel;
  return base;
}

/** Umbral de elegibles por aula vigente (default del contrato: 10). */
export function minEligibleThreshold(
  seleccion: CriteriosSeleccionMarco | null | undefined,
  fallback = 10,
): number {
  const t = seleccion?.minEligible?.threshold;
  return typeof t === "number" && Number.isFinite(t) ? t : fallback;
}

/** Fija el umbral global de elegibles por aula, inmutable. */
export function setMinEligible(
  seleccion: CriteriosSeleccionMarco,
  threshold: number,
): CriteriosSeleccionMarco {
  return {
    ...seleccion,
    minEligible: { ...(seleccion.minEligible ?? {}), threshold: Math.max(0, Math.round(threshold)) },
  };
}
