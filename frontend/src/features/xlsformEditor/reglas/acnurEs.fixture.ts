// Fixture de pruebas: filas REALES del cuestionario ACNUR en español (prueba de estrés del 2026-10-17).
// Sólo las filas que reproducen los hallazgos S1–S8, con sus textos y reglas tal cual (las repeticiones,
// la fila rota REG02_Other_recod, el filtro fijo REF02CO = 'kk', las comillas tipográficas de IDP01). Las listas
// largas van recortadas: Country conserva tres países con kk y uno sin marcar. No contiene datos de personas.

import { buildXlsformIndex } from "../parsing/buildIndex";
import type { CatalogSummary, XlsformEditorWorkbook } from "../types";
import type { LogicScope } from "../logic";
import { enriquecerAlcance } from "../logic";

const SURVEY_COLS = ["type", "name", "label", "hint", "relevant", "constraint", "constraint_message", "calculation", "choice_filter", "required", "appearance", "repeat_count"] as const;
type Col = (typeof SURVEY_COLS)[number];
const fila = (v: Partial<Record<Col, string>>) => SURVEY_COLS.map((c) => v[c] ?? "");
const ROTA = "REG02_Other_recod";

export const ACNUR_SURVEY: string[][] = [
  fila({ type: "select_one yes_no", name: "attempt1", label: "¿Se logró el contacto?" }),
  fila({ type: "select_one Country", name: "Country", label: "Seleccione el país en el que se realiza la entrevista" }),
  fila({ type: "calculate", name: "countryname", calculation: "jr:choice-name(selected-at(${Country}, 0), '${Country}')", required: "false" }),
  fila({ type: "begin_group", name: "Part1", label: "Parte 1. Indicadores Sociodemográficos & Composición del Hogar", relevant: "${attempt1} = '1'" }),
  fila({ type: "text", name: "HHH01_aux", label: "Por favor, anote todos los nombres **del/de la jefe de hogar**" }),
  fila({ type: "begin_repeat", name: "rpt_hhmnames", label: "Lista de los miembros del hogar" }),
  fila({ type: "calculate", name: "hhmnames_pos", label: "Número de registro secuencial del miembro dentro del hogar", calculation: "position(..)" }),
  fila({ type: "text", name: "HH01_aux", label: "Por favor, anote todos los nombres de este miembro del hogar" }),
  fila({ type: "calculate", name: "HH01_2_aux", label: "Nombre del miembro del hogar", calculation: "if(${hhmnames_pos}=1, ${HHH01_aux}, ${HH01_aux})" }),
  fila({ type: "end_repeat" }),
  fila({ type: "select_one ${HH01_2_aux}", name: "respondent", label: "Sólo para encuestadores *por favor no leer*: ¿Cuál es el nombre del encuestado(a)?", required: "true" }),
  fila({ type: "begin_repeat", name: "S1", repeat_count: "count(${rpt_hhmnames})" }),
  fila({ type: "calculate", name: "HH01", calculation: "indexed-repeat(${HH01_2_aux}, ${rpt_hhmnames}, position(..))" }),
  fila({ type: "select_one yes_no", name: "HH05", label: "4. ¿Conoce ${HH01} su fecha de nacimiento?" }),
  fila({ type: "date", name: "HH06", label: "5. ¿Cuál es la fecha de nacimiento de ${HH01}?", relevant: "${HH05} = '1'", constraint: ". <= today()", constraint_message: "Date cannot be in the future", appearance: "month-year" }),
  fila({ type: "calculate", name: "HH07", calculation: "if (${HH05}=\"1\", 10, 20)" }),
  fila({ type: "calculate", name: "women_b", label: "women_b", calculation: "if ((${HH07} >= 13), ${HH01}, \"\")" }),
  fila({ type: "calculate", name: "child_edu_calcul_r", calculation: "if(${HH07}>=5 and ${HH07}<=17,1,0)" }),
  fila({ type: "end_repeat" }),
  fila({ type: "calculate", name: "women_name_b", label: "women_name_b", calculation: "join(\" \", ${women_b})" }),
  fila({ type: "calculate", name: "nochild_edu_calcul", calculation: "sum(${child_edu_calcul_r})" }),
  fila({ type: "calculate", name: "listbelow5", calculation: "join('',${HH07})" }),
  fila({ type: "calculate", name: "n_selected_below5", calculation: "count-selected(${listbelow5})" }),
  fila({ type: "calculate", name: "selected_below5", calculation: "selected-at(${listbelow5},int(random()*${n_selected_below5}))" }),
  fila({ type: "calculate", name: "name_selectedbelow5", calculation: "indexed-repeat(${HH01}, ${S1},${selected_below5})" }),
  fila({ type: "end_group" }),
  fila({ type: "begin_group", name: "S2_respondent", label: "S2: Preguntas a nivel individual", relevant: "${attempt1} = '1'" }),
  fila({ type: "select_one Country", name: "REF02", label: "2. ¿Cuál es su nacionalidad?", choice_filter: "REF02CO= 'kk'", required: "true", appearance: "minimal" }),
  fila({ type: "text", name: "REF10b", label: "10b. En caso negativo, ¿puede estimar cuándo vino usted a residir por primera vez en ${countryname}?", constraint: "regex(., '^[0-9]{2}[/][0-9]{4}$')", constraint_message: "The date format is MM/YYYY", required: "true" }),
  fila({ type: "select_one legalbasis", name: "REF16", label: "16. ¿Cuál es el documento principal que le permite a usted permanecer en ${countryname}?", choice_filter: "(${Country} = 'PER' and (name = '1' or name = '13'))", required: "true" }),
  fila({ type: "begin_group", name: "P1_S4", label: "S4: Documentación", relevant: "${attempt1} = '1'" }),
  fila({ type: "select_multiple idp01", name: "IDP01", label: "1. ¿Se ha mudado usted alguna vez de domicilio en ${countryname} por alguna de las siguientes razones?", constraint: "not(count-selected(.) > 1 and (selected(., ‘6’) or selected(., ‘7’) or selected(., ‘98’) or selected(., ‘99’)))", constraint_message: "You cannot select \"Have moved home voluntarily\" with other choices.", required: "true" }),
  fila({ type: "select_one yesnoPr", name: "REG02", label: "2. ¿Tiene usted algún otro documento que acredite su identidad legal?", required: "true" }),
  fila({ type: `select_multiple ${ROTA}`, name: ROTA, label: "2a. ¿Qué otro documento acredita de identidad legal?", hint: ROTA, relevant: ROTA, constraint: ROTA, constraint_message: ROTA, calculation: ROTA, choice_filter: ROTA, required: ROTA, appearance: ROTA, repeat_count: ROTA }),
  fila({ type: "end_group" }),
  fila({ type: "end_group" }),
  fila({ type: "select_multiple Cash_spent_on", name: "mand_Cash_spent_on", label: "¿En qué ha gastado el dinero recibido del ACNUR?" }),
  fila({ type: "select_one Cash_spent_on", name: "Spent_1st", label: "1ra opción", choice_filter: "selected(${mand_Cash_spent_on},filter_Spent)", required: "true" }),
  fila({ type: "select_one Cash_spent_on", name: "Spent_2nd", label: "2da opción", choice_filter: "selected(${mand_Cash_spent_on},filter_Spent)" }),
  fila({ type: "select_one Cash_spent_on", name: "Spent_3rd", label: "3ra opción", choice_filter: "selected(${mand_Cash_spent_on},filter_Spent)" }),
  fila({ type: "select_one Cash_spent_on", name: "Spent_4th", label: "4ta opción", choice_filter: "selected(${mand_Cash_spent_on},filter_Spent)" }),
  fila({ type: "select_one Cash_spent_on", name: "Spent_5th", label: "5ta opción", choice_filter: "selected(${mand_Cash_spent_on},filter_Spent)", constraint: "${Spent_5th} != ${Spent_4th} and ${Spent_5th} != ${Spent_3rd} and ${Spent_5th} != ${Spent_2nd} and ${Spent_5th} != ${Spent_1st}", constraint_message: "Cannot select the same item multiple times" }),
  fila({ type: "calculate", name: "name_ppl", calculation: "pulldata('cbiproteccion', 'nombre', 'progres', ${attempt1})" }),
  fila({ type: "select_one Yes_no", name: "Registered_person_available", label: "¿Se encuentra **${name_ppl}** u otro miembro de su hogar mayor de 18 años que tenga conocimiento sobre la asistencia en efectivo, disponible para esta encuesta?", required: "true" }),
  fila({ type: "select_one ${HH01_2_aux}", name: "name_respondent", label: "ENCUESTADOR/A: ¿QUIÉN ERA EL O LA ENCUESTADO/A PRINCIPAL?", required: "true" }),
  fila({ type: "select_one yes_no", name: "verifica", label: "Verificación", relevant: "${name_respondent} != ''" }),
];

const CHOICE_COLS = ["list_name", "name", "label", "REF02CO", "filter_Spent"];
export const ACNUR_CHOICES: string[][] = [
  ["yes_no", "1", "Sí", "", ""],
  ["yes_no", "0", "No", "", ""],
  ["Yes_no", "Si", "Sí", "", ""],
  ["Yes_no", "No", "No", "", ""],
  ["yesnoPr", "1", "Sí", "", ""],
  ["yesnoPr", "0", "No", "", ""],
  ["Country", "PER", "Perú", "kk", ""],
  ["Country", "VEN", "Venezuela", "kk", ""],
  ["Country", "COL", "Colombia", "kk", ""],
  ["Country", "91", "No en ${countryname} pero no sabe qué país", "", ""],
  ["idp01", "1", "Desastres naturales", "", ""],
  ["idp01", "6", "Otros desplazamientos voluntarios", "", ""],
  ["idp01", "7", "Nunca se ha mudado de casa mientras estaba en ${countryname}", "", ""],
  ["idp01", "98", "No sabe", "", ""],
  ["idp01", "99", "Prefiere no responder", "", ""],
  ["legalbasis", "1", "Carné de extranjería", "", ""],
  ["legalbasis", "13", "Permiso temporal de permanencia", "", ""],
  ["legalbasis", "2", "Pasaporte", "", ""],
  ["Cash_spent_on", "1", "Alimentos", "", "1"],
  ["Cash_spent_on", "2", "Alquiler", "", "2"],
  ["Cash_spent_on", "3", "Salud", "", "3"],
  ["Cash_spent_on", "4", "Educación", "", "4"],
  ["Cash_spent_on", "5", "Transporte", "", "5"],
  ["Cash_spent_on", "6", "Deudas", "", "6"],
  [ROTA, "a", "Licencia de conducir", "", ""],
];

export const ACNUR_WORKBOOK: XlsformEditorWorkbook = {
  survey: { columns: [...SURVEY_COLS], rows: ACNUR_SURVEY },
  choices: { columns: CHOICE_COLS, rows: ACNUR_CHOICES },
  settings: { columns: ["form_title", "form_id"], rows: [["Tipo 3 · ACNUR monitoreo y RMS", "acnur_es"]] },
} as XlsformEditorWorkbook;

export function acnur() {
  const idx = buildXlsformIndex(ACNUR_WORKBOOK);
  const structure = idx.structure;
  const catalogs: CatalogSummary[] = idx.catalogs;
  const base: LogicScope = {
    variables: structure.outline
      .filter((n) => n.name && n.kind !== "section" && n.kind !== "repeat")
      .map((n) => ({ rowIndex: n.rowIndex, name: n.name, label: n.label, baseType: n.typeInfo.base, listName: n.typeInfo.listName || undefined })),
    catalogsByListName: new Map(catalogs.map((c) => [c.listName, { listName: c.listName, items: c.items }])),
    allowCurrent: false,
  };
  const scope = enriquecerAlcance(base, structure);
  const nodo = (name: string) => {
    const n = structure.outline.find((x) => x.name === name);
    if (!n) throw new Error(`No está en el fixture: ${name}`);
    return n;
  };
  return { idx, structure, catalogs, base, scope, nodo, workbook: ACNUR_WORKBOOK };
}
