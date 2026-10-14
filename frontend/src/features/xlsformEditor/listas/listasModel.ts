// Listas de opciones del formulario (checklist importación SM 2026-10-14, H7).
//
// Una importación de SurveyMonkey crea una lista por pregunta aunque veinte
// preguntas usen la misma escala de acuerdo. Este módulo puro detecta las
// listas IDÉNTICAS —mismas filas en `choices` salvo `list_name`, en el mismo
// orden—, cuenta en cuántas preguntas se usa cada una, propone un nombre
// legible y aplica dos transformaciones inmutables sobre el workbook:
//
// - `unificarListas`: reescribe el `type` de las preguntas a la lista nueva,
//   deja UNA sola copia de las opciones y borra las duplicadas.
// - `renombrarLista`: cambia el nombre de una lista suelta.
//
// Los mapas de códigos de SurveyMonkey (`surveyMonkeyLogic.choice_code_maps`)
// se resuelven por VARIABLE (`variable`), no por lista; su `list_name` es sólo
// metadato descriptivo y se actualiza para que no mienta tras la unificación.
// Los `mappings` (código origen → código XLSForm) no cambian: las opciones de
// las listas unificadas son idénticas por definición.

import type { XlsformEditorSheet, XlsformEditorWorkbook } from "../../../api/multiIntegrado";

export const NOMBRE_LISTA_VALIDO = /^[A-Za-z_][A-Za-z0-9_]*$/;

export type OpcionLista = {
  codigo: string;
  etiqueta: string;
};

export type ListaOpciones = {
  nombre: string;
  opciones: OpcionLista[];
  /** Nombres (`name`) de las preguntas que la usan, en orden del formulario. */
  preguntas: string[];
};

export type GrupoListasRepetidas = {
  /** Clave estable del contenido (sirve de `key` en React). */
  firma: string;
  /** Listas idénticas, en el orden en que aparecen en `choices`. */
  listas: string[];
  opciones: OpcionLista[];
  /** Preguntas que usan cualquiera de las listas del grupo. */
  preguntas: string[];
  /** Nombre propuesto, ya libre en el formulario. */
  sugerencia: string;
};

export type AnalisisListas = {
  grupos: GrupoListasRepetidas[];
  /** Listas sin gemela, en el orden de `choices`. */
  unicas: ListaOpciones[];
};

export type ResultadoTransformacion =
  | { ok: true; workbook: XlsformEditorWorkbook }
  | { ok: false; motivo: string };

// ---------------------------------------------------------------------------
// Lectura de hojas
// ---------------------------------------------------------------------------

function indiceColumna(sheet: XlsformEditorSheet, nombre: string): number {
  return sheet.columns.findIndex((col) => col.trim().toLowerCase() === nombre);
}

function indiceEtiqueta(sheet: XlsformEditorSheet): number {
  const exacta = indiceColumna(sheet, "label");
  if (exacta >= 0) return exacta;
  return sheet.columns.findIndex((col) => col.trim().toLowerCase().startsWith("label::"));
}

function celda(row: readonly string[], idx: number): string {
  if (idx < 0) return "";
  const value = row[idx];
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

const TIPO_CON_LISTA = /^(select_one|select_multiple|rank)\s+(\S+)(.*)$/;
const TIPO_SOLO = /^(select_one|select_multiple|rank)$/;

type UsoLista = { rowIndex: number; lista: string; viaColumna: boolean };

/** Lista que usa una fila de `survey`, por `type` o por `select_from_list_name`. */
function usoDeFila(
  row: readonly string[],
  idxType: number,
  idxFromList: number,
  rowIndex: number,
): UsoLista | null {
  const type = celda(row, idxType).trim();
  const conLista = TIPO_CON_LISTA.exec(type);
  if (conLista) return { rowIndex, lista: conLista[2], viaColumna: false };
  if (TIPO_SOLO.test(type)) {
    const lista = celda(row, idxFromList).trim();
    if (lista) return { rowIndex, lista, viaColumna: true };
  }
  return null;
}

function usosEnSurvey(survey: XlsformEditorSheet): UsoLista[] {
  const idxType = indiceColumna(survey, "type");
  if (idxType < 0) return [];
  const idxFromList = indiceColumna(survey, "select_from_list_name");
  const usos: UsoLista[] = [];
  survey.rows.forEach((row, i) => {
    const uso = usoDeFila(row, idxType, idxFromList, i);
    if (uso) usos.push(uso);
  });
  return usos;
}

/** Nombres de lista presentes en `choices`, en orden de aparición. */
export function nombresDeListas(workbook: XlsformEditorWorkbook): string[] {
  const choices = workbook.choices;
  const idxList = indiceColumna(choices, "list_name");
  if (idxList < 0) return [];
  const vistos = new Set<string>();
  for (const row of choices.rows) {
    const nombre = celda(row, idxList).trim();
    if (nombre) vistos.add(nombre);
  }
  return [...vistos];
}

type ListaLeida = ListaOpciones & { firma: string };

function leerListas(workbook: XlsformEditorWorkbook): ListaLeida[] {
  const choices = workbook.choices;
  const idxList = indiceColumna(choices, "list_name");
  if (idxList < 0) return [];
  const idxName = indiceColumna(choices, "name");
  const idxLabel = indiceEtiqueta(choices);
  // La firma usa TODAS las columnas salvo `list_name`: dos listas con las
  // mismas etiquetas pero otro filtro o medio no son la misma lista.
  const columnasFirma = choices.columns.map((_, i) => i).filter((i) => i !== idxList);

  const porNombre = new Map<string, { opciones: OpcionLista[]; filas: string[] }>();
  for (const row of choices.rows) {
    const nombre = celda(row, idxList).trim();
    if (!nombre) continue;
    let entrada = porNombre.get(nombre);
    if (!entrada) {
      entrada = { opciones: [], filas: [] };
      porNombre.set(nombre, entrada);
    }
    entrada.opciones.push({ codigo: celda(row, idxName).trim(), etiqueta: celda(row, idxLabel).trim() });
    entrada.filas.push(JSON.stringify(columnasFirma.map((i) => celda(row, i).trim())));
  }

  const preguntasPorLista = new Map<string, string[]>();
  const idxNameSurvey = indiceColumna(workbook.survey, "name");
  for (const uso of usosEnSurvey(workbook.survey)) {
    const nombrePregunta = celda(workbook.survey.rows[uso.rowIndex] ?? [], idxNameSurvey).trim()
      || `fila ${uso.rowIndex + 2}`;
    const lista = preguntasPorLista.get(uso.lista) ?? [];
    lista.push(nombrePregunta);
    preguntasPorLista.set(uso.lista, lista);
  }

  return [...porNombre.entries()].map(([nombre, { opciones, filas }]) => ({
    nombre,
    opciones,
    preguntas: preguntasPorLista.get(nombre) ?? [],
    firma: filas.join("\n"),
  }));
}

/** Listas del formulario con sus opciones y preguntas, en orden de `choices`. */
export function listasDelFormulario(workbook: XlsformEditorWorkbook): ListaOpciones[] {
  return leerListas(workbook).map(({ nombre, opciones, preguntas }) => ({ nombre, opciones, preguntas }));
}

// ---------------------------------------------------------------------------
// Sugerencia de nombre
// ---------------------------------------------------------------------------

/** Etiqueta comparable: sin tildes, mayúsculas, HTML ni espacios repetidos. */
export function normalizarEtiqueta(texto: string): string {
  return normalizar(texto);
}

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slug(texto: string): string {
  return normalizar(texto)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const SI_NO_COMPLEMENTOS = new Set([
  "no sabe", "no responde", "no sabe no responde", "ns nr", "ns/nr", "no se", "no aplica",
  "prefiero no responder", "no sabe / no responde", "no sabe/no responde",
]);

function esSiNo(etiquetas: string[]): boolean {
  const limpias = etiquetas.map((e) => e.replace(/[.¡!¿?]/g, "").trim());
  const tieneSi = limpias.includes("si");
  const tieneNo = limpias.includes("no");
  return tieneSi && tieneNo && limpias.every((e) => e === "si" || e === "no" || SI_NO_COMPLEMENTOS.has(e));
}

/** Nombre base sugerido por el contenido de las etiquetas (sin resolver choques). */
export function nombreBaseDesdeEtiquetas(opciones: readonly OpcionLista[]): string {
  const etiquetas = opciones.map((o) => normalizar(o.etiqueta || o.codigo)).filter(Boolean);
  const todas = etiquetas.join(" | ");
  if (/\b(des)?acuerdo\b/.test(todas)) return "acuerdo";
  if (/satisfech|satisfacci|insatisf/.test(todas)) return "satisfaccion";
  if (esSiNo(etiquetas)) return "si_no";
  // Variables de caracterización que se repiten entre públicos: el nombre
  // común es lo que permite analizarlas juntas (Listas entre formularios).
  if (/\b(masculino|femenino|hombre|mujer|varon)\b/.test(todas)) return "genero";
  if (/\bfacultad\b/.test(todas)) return "facultad";
  if (/\bciclo\b/.test(todas)) return "ciclo";
  if (/\bbachiller|licenciad|maestri?a\b|magister|doctorado|\bgrado\b/.test(todas)) return "grado";
  if (/\bconoc/.test(todas)) return "conocimiento";
  if (/frecuen|\bsiempre\b|\bnunca\b|a veces|casi siempre/.test(todas)) return "frecuencia";
  if (/calidad|\bbuen[oa]?\b|\bmal[oa]?\b|excelente|pesim/.test(todas)) return "calidad";
  const base = etiquetas.slice(0, 2).map(slug).filter(Boolean).join("_").slice(0, 32).replace(/_+$/, "");
  if (!base) return "lista";
  return /^[a-z_]/.test(base) ? base : `lista_${base}`;
}

/** Primer nombre libre a partir de `base`: `base`, `base_2`, `base_3`… */
export function nombreLibre(base: string, ocupados: ReadonlySet<string>): string {
  if (!ocupados.has(base)) return base;
  let n = 2;
  while (ocupados.has(`${base}_${n}`)) n += 1;
  return `${base}_${n}`;
}

// ---------------------------------------------------------------------------
// Análisis
// ---------------------------------------------------------------------------

export function analizarListas(workbook: XlsformEditorWorkbook): AnalisisListas {
  const listas = leerListas(workbook);
  const porFirma = new Map<string, ListaLeida[]>();
  for (const lista of listas) {
    const grupo = porFirma.get(lista.firma) ?? [];
    grupo.push(lista);
    porFirma.set(lista.firma, grupo);
  }
  const todosLosNombres = new Set(listas.map((l) => l.nombre));
  const reservados = new Set<string>();
  const grupos: GrupoListasRepetidas[] = [];
  const unicas: ListaOpciones[] = [];
  for (const miembros of porFirma.values()) {
    if (miembros.length < 2) {
      const [sola] = miembros;
      unicas.push({ nombre: sola.nombre, opciones: sola.opciones, preguntas: sola.preguntas });
      continue;
    }
    const propios = new Set(miembros.map((m) => m.nombre));
    const ocupados = new Set(
      [...todosLosNombres, ...reservados].filter((n) => !propios.has(n)),
    );
    const sugerencia = nombreLibre(nombreBaseDesdeEtiquetas(miembros[0].opciones), ocupados);
    reservados.add(sugerencia);
    grupos.push({
      firma: miembros[0].firma,
      listas: miembros.map((m) => m.nombre),
      opciones: miembros[0].opciones,
      preguntas: miembros.flatMap((m) => m.preguntas),
      sugerencia,
    });
  }
  // Las escalas más usadas primero: es donde unificar rinde más.
  grupos.sort((a, b) => b.preguntas.length - a.preguntas.length);
  return { grupos, unicas };
}

/** Cuántas escalas se repiten (grupos de listas idénticas). Para el botón del editor. */
export function contarEscalasRepetidas(workbook: XlsformEditorWorkbook | null | undefined): number {
  if (!workbook) return 0;
  return analizarListas(workbook).grupos.length;
}

// ---------------------------------------------------------------------------
// Validación
// ---------------------------------------------------------------------------

/**
 * Motivo por el que `nombre` no sirve, o `null` si sirve. `propias` son las
 * listas que el nombre va a reemplazar: pueden conservarlo sin chocar.
 * `reservados` evita que dos escalas pendientes terminen con el mismo nombre.
 */
export function validarNombreLista(
  workbook: XlsformEditorWorkbook,
  nombre: string,
  propias: readonly string[] = [],
  /** Nombres propuestos para OTRAS escalas repetidas, aún sin aplicar. */
  reservados: readonly string[] = [],
): string | null {
  const limpio = nombre.trim();
  if (!limpio) return "Escribe un nombre para la lista.";
  if (!NOMBRE_LISTA_VALIDO.test(limpio)) {
    return /^[0-9]/.test(limpio)
      ? "El nombre no puede empezar con un número."
      : "Usa sólo letras sin tildes, números y guion bajo (sin espacios).";
  }
  const propiasSet = new Set(propias);
  if (!propiasSet.has(limpio) && nombresDeListas(workbook).includes(limpio)) {
    return `Ya existe otra lista llamada «${limpio}».`;
  }
  if (!propiasSet.has(limpio) && reservados.includes(limpio)) {
    return `«${limpio}» ya está propuesto para otra escala repetida.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Transformaciones
// ---------------------------------------------------------------------------

function reescribirSurvey(
  survey: XlsformEditorSheet,
  listas: ReadonlySet<string>,
  nombreNuevo: string,
): XlsformEditorSheet {
  const idxType = indiceColumna(survey, "type");
  if (idxType < 0) return survey;
  const idxFromList = indiceColumna(survey, "select_from_list_name");
  let cambio = false;
  const rows = survey.rows.map((row, i) => {
    const uso = usoDeFila(row, idxType, idxFromList, i);
    if (!uso || !listas.has(uso.lista) || uso.lista === nombreNuevo) return row;
    cambio = true;
    const next = [...row];
    if (uso.viaColumna) {
      next[idxFromList] = nombreNuevo;
    } else {
      const match = TIPO_CON_LISTA.exec(celda(row, idxType).trim());
      if (match) next[idxType] = `${match[1]} ${nombreNuevo}${match[3]}`;
    }
    return next;
  });
  return cambio ? { ...survey, rows } : survey;
}

function reescribirMapasDeCodigos(
  workbook: XlsformEditorWorkbook,
  listas: ReadonlySet<string>,
  nombreNuevo: string,
): XlsformEditorWorkbook["surveyMonkeyLogic"] {
  const logic = workbook.surveyMonkeyLogic;
  const maps = logic?.choice_code_maps;
  if (!logic || !maps?.some((m) => listas.has(m.list_name) && m.list_name !== nombreNuevo)) return logic;
  return {
    ...logic,
    choice_code_maps: maps.map((m) => (
      listas.has(m.list_name) ? { ...m, list_name: nombreNuevo } : m
    )),
  };
}

function aplicarNombre(
  workbook: XlsformEditorWorkbook,
  listas: readonly string[],
  nombreNuevo: string,
): XlsformEditorWorkbook {
  const conjunto = new Set(listas);
  const choices = workbook.choices;
  const idxList = indiceColumna(choices, "list_name");
  // Se conserva la copia de la primera lista del grupo que aparece en
  // `choices`; las filas de las demás se eliminan.
  let conservada: string | null = null;
  for (const row of choices.rows) {
    const nombre = celda(row, idxList).trim();
    if (conjunto.has(nombre)) { conservada = nombre; break; }
  }
  const rows: string[][] = [];
  let cambioChoices = false;
  for (const row of choices.rows) {
    const nombre = celda(row, idxList).trim();
    if (!conjunto.has(nombre)) { rows.push(row); continue; }
    if (nombre !== conservada) { cambioChoices = true; continue; }
    if (nombre === nombreNuevo) { rows.push(row); continue; }
    cambioChoices = true;
    const next = [...row];
    next[idxList] = nombreNuevo;
    rows.push(next);
  }
  const survey = reescribirSurvey(workbook.survey, conjunto, nombreNuevo);
  const surveyMonkeyLogic = reescribirMapasDeCodigos(workbook, conjunto, nombreNuevo);
  if (!cambioChoices && survey === workbook.survey && surveyMonkeyLogic === workbook.surveyMonkeyLogic) {
    return workbook;
  }
  const next: XlsformEditorWorkbook = {
    ...workbook,
    survey,
    choices: cambioChoices ? { ...choices, rows } : choices,
  };
  if (surveyMonkeyLogic !== workbook.surveyMonkeyLogic) next.surveyMonkeyLogic = surveyMonkeyLogic;
  return next;
}

/**
 * Unifica listas idénticas bajo `nombreNuevo`. Falla —sin tocar nada— si las
 * listas no son idénticas, si alguna no existe o si el nombre no es válido.
 * Idempotente: unificar de nuevo el resultado devuelve el mismo workbook.
 */
export function unificarListas(
  workbook: XlsformEditorWorkbook,
  listas: readonly string[],
  nombreNuevo: string,
): ResultadoTransformacion {
  const nombre = nombreNuevo.trim();
  const unicasPedidas = [...new Set(listas.map((l) => l.trim()).filter(Boolean))];
  if (!unicasPedidas.length) return { ok: false, motivo: "No hay listas que unificar." };
  const leidas = new Map(leerListas(workbook).map((l) => [l.nombre, l]));
  const faltante = unicasPedidas.find((l) => !leidas.has(l));
  if (faltante) return { ok: false, motivo: `La lista «${faltante}» ya no está en el formulario.` };
  const firmas = new Set(unicasPedidas.map((l) => leidas.get(l)?.firma));
  if (firmas.size > 1) {
    return { ok: false, motivo: "Las listas ya no son idénticas; revisa sus opciones antes de unificarlas." };
  }
  const motivo = validarNombreLista(workbook, nombre, unicasPedidas);
  if (motivo) return { ok: false, motivo };
  return { ok: true, workbook: aplicarNombre(workbook, unicasPedidas, nombre) };
}

/** Renombra una lista (choices + preguntas que la usan). */
export function renombrarLista(
  workbook: XlsformEditorWorkbook,
  lista: string,
  nombreNuevo: string,
): ResultadoTransformacion {
  const actual = lista.trim();
  if (!nombresDeListas(workbook).includes(actual)) {
    return { ok: false, motivo: `La lista «${actual}» ya no está en el formulario.` };
  }
  const nombre = nombreNuevo.trim();
  const motivo = validarNombreLista(workbook, nombre, [actual]);
  if (motivo) return { ok: false, motivo };
  return { ok: true, workbook: aplicarNombre(workbook, [actual], nombre) };
}
