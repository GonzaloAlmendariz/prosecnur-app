// =============================================================================
// impreso/modeloImpreso.ts — lógica pura de la pestaña «Impreso»
// =============================================================================
// La pestaña reemplaza al diálogo «Configurar PDF» (2026-10-15). Sus elecciones
// siguen siendo `PdfDialogState` (pdfExportPreference.ts, con su persistencia);
// aquí sólo vive lo que la pestaña añade: las partes y su resumen de una línea,
// el reparto de matrices (las de 2+ preguntas primero; las de una, aparte), el
// inventario de filas con ajustes `paper_*` y las cifras de la última previa.
// =============================================================================

import type { MatrixCandidate } from "../parsing/detectMatrixCandidates";
import type { ConsentQuestion } from "../parsing/detectConsentQuestions";
import type { BuilderNode, BuilderStructure } from "../types";
import { matrixChoiceFor, type PdfDialogState } from "../shell/pdfExportPreference";

export type ParteImpreso = "formato" | "logica" | "contenido" | "matrices" | "papel";

export const PARTES_IMPRESO: readonly { clave: ParteImpreso; rotulo: string }[] = [
  { clave: "formato", rotulo: "Formato" },
  { clave: "logica", rotulo: "Lógica" },
  { clave: "contenido", rotulo: "Contenido" },
  { clave: "matrices", rotulo: "Matrices" },
  { clave: "papel", rotulo: "Papel por pregunta" },
];

export function esParteImpreso(valor: string | null | undefined): valor is ParteImpreso {
  return PARTES_IMPRESO.some((p) => p.clave === valor);
}

// ── Matrices ────────────────────────────────────────────────────────────────

/** Las candidatas de 2+ preguntas van primero (orden del formulario); las de una sola, aparte. */
export function separarCandidatas(candidatas: readonly MatrixCandidate[]): {
  matrices: MatrixCandidate[];
  sueltas: MatrixCandidate[];
} {
  return {
    matrices: candidatas.filter((c) => c.count >= 2),
    sueltas: candidatas.filter((c) => c.count < 2),
  };
}

export function matricesActivas(
  candidatas: readonly MatrixCandidate[],
  matrices: PdfDialogState["matrices"],
): number {
  return candidatas.filter((c) => matrixChoiceFor(c, matrices).enabled).length;
}

// ── Papel por pregunta ──────────────────────────────────────────────────────

const CAMPOS_PAPEL: readonly { campo: keyof BuilderNode; columna: string }[] = [
  { campo: "paperNumber", columna: "paper_number" },
  { campo: "paperLabel", columna: "paper_label" },
  { campo: "paperSkip", columna: "paper_skip" },
  { campo: "paperGroup", columna: "paper_group" },
  { campo: "paperSubgroup", columna: "paper_subgroup" },
  { campo: "paperSubletter", columna: "paper_subletter" },
  { campo: "paperLayout", columna: "paper_layout" },
  { campo: "paperOnly", columna: "paper_only" },
];

export type FilaConPapel = {
  rowIndex: number;
  name: string;
  label: string;
  /** Columnas `paper_*` con valor en la fila, en orden fijo. */
  columnas: string[];
};

/** Filas del survey que traen algún ajuste `paper_*`, en orden del formulario. */
export function filasConPapel(structure: BuilderStructure | null): FilaConPapel[] {
  if (!structure) return [];
  const filas: FilaConPapel[] = [];
  for (const node of structure.outline) {
    const columnas = CAMPOS_PAPEL
      .filter(({ campo }) => {
        const valor = node[campo];
        return typeof valor === "string" && valor.trim() !== "";
      })
      .map(({ columna }) => columna);
    if (columnas.length === 0) continue;
    filas.push({ rowIndex: node.rowIndex, name: node.name, label: node.label, columnas });
  }
  return filas;
}

/**
 * Filas que muestra «Papel por pregunta»: las que traen ajustes y, además, la abierta (ítem 50) aunque todavía no
 * tenga ninguno o acabe de borrar el último: la ficha que se está editando no desaparece bajo el cursor.
 */
export function filasPapelVisibles(structure: BuilderStructure | null, abierta: number | null): FilaConPapel[] {
  const filas = filasConPapel(structure);
  if (abierta == null || filas.some((f) => f.rowIndex === abierta)) return filas;
  const nodo = structure?.byRow.get(abierta);
  if (!nodo) return filas;
  return [...filas, { rowIndex: nodo.rowIndex, name: nodo.name, label: nodo.label, columnas: [] }]
    .sort((a, b) => a.rowIndex - b.rowIndex);
}

/** Filas que todavía no traen ajustes de papel: las que se pueden ajustar desde «Impreso». Los cálculos no se imprimen. */
export function filasSinPapel(structure: BuilderStructure | null): Omit<FilaConPapel, "columnas">[] {
  if (!structure) return [];
  const conPapel = new Set(filasConPapel(structure).map((f) => f.rowIndex));
  return structure.outline
    .filter((n) => n.kind !== "calculate" && n.name && !conPapel.has(n.rowIndex))
    .map((n) => ({ rowIndex: n.rowIndex, name: n.name, label: n.label }));
}

// ── Resúmenes de una línea ──────────────────────────────────────────────────

function columnasCorto(columns: PdfDialogState["columns"]): string {
  if (columns === "auto") return "Columnas automáticas";
  return columns === 1 ? "Una columna" : "Dos columnas";
}

export type ContextoResumen = {
  candidatas: readonly MatrixCandidate[];
  consentimiento: readonly ConsentQuestion[];
  filasPapel: number;
};

export function resumenDeParte(parte: ParteImpreso, estado: PdfDialogState, ctx: ContextoResumen): string {
  switch (parte) {
    case "formato":
      return `${columnasCorto(estado.columns)} · ${estado.showQuestionnaireNumber ? "con N.º" : "sin N.º"}`;
    case "logica": {
      const consent = ctx.consentimiento.some((q) => q.name === estado.consentVar) ? "con consentimiento" : "sin consentimiento";
      return `${estado.logicLanguage === "saltos" ? "Saltos" : "Condiciones"} · ${consent}`;
    }
    case "contenido":
      return `${estado.defaultIntro ? "Instrucciones" : "Sin instrucciones"} · ${estado.maxOptionsPerQuestion} opciones`;
    case "matrices": {
      const { matrices, sueltas } = separarCandidatas(ctx.candidatas);
      if (matrices.length === 0 && sueltas.length === 0) return "Ninguna detectada";
      const activas = matricesActivas(ctx.candidatas, estado.matrices);
      return `${activas} de ${ctx.candidatas.length} como tabla`;
    }
    case "papel":
      return ctx.filasPapel === 0
        ? "Ninguna fila con ajustes"
        : `${ctx.filasPapel} ${ctx.filasPapel === 1 ? "fila con ajustes" : "filas con ajustes"}`;
  }
}

// ── Previa ──────────────────────────────────────────────────────────────────

const RE_PAGINA = /\/Type\s*\/Page(?![a-zA-Z])/g;

function comoTexto(bytes: Uint8Array): string {
  // latin1 conserva los bytes 1:1; el diccionario de objetos va en ASCII.
  let texto = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    texto += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return texto;
}

/** Los flujos `/ObjStm` (objetos comprimidos) del PDF, sin inflar. */
function flujosDeObjetos(texto: string, bytes: Uint8Array): Uint8Array[] {
  const flujos: Uint8Array[] = [];
  let desde = 0;
  for (;;) {
    const marca = texto.indexOf("/ObjStm", desde);
    if (marca < 0) break;
    const kw = texto.indexOf("stream", marca);
    if (kw < 0) break;
    let inicio = kw + "stream".length;
    if (texto[inicio] === "\r") inicio += 1;
    if (texto[inicio] === "\n") inicio += 1;
    const fin = texto.indexOf("endstream", inicio);
    if (fin < 0) break;
    let corte = fin;
    while (corte > inicio && (texto[corte - 1] === "\n" || texto[corte - 1] === "\r")) corte -= 1;
    flujos.push(bytes.subarray(inicio, corte));
    desde = fin;
  }
  return flujos;
}

async function inflar(datos: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === "undefined") return null;
  try {
    const flujo = new Blob([datos.slice().buffer]).stream().pipeThrough(new DecompressionStream("deflate"));
    return new Uint8Array(await new Response(flujo).arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Páginas de un PDF, contadas en el propio archivo: los objetos `/Type /Page` (no `/Pages`, el árbol), también los
 * que el motor guarda comprimidos en flujos de objetos (`/ObjStm`, PDF 1.5+). Es una cifra del artefacto, no una
 * estimación; si el archivo no se puede leer, devuelve null y no se dice nada.
 */
export async function contarPaginasPdf(bytes: Uint8Array): Promise<number | null> {
  if (bytes.length < 5) return null;
  const texto = comoTexto(bytes);
  if (!texto.startsWith("%PDF")) return null;
  let n = (texto.match(RE_PAGINA) ?? []).length;
  for (const flujo of flujosDeObjetos(texto, bytes)) {
    const plano = await inflar(flujo);
    if (plano) n += (comoTexto(plano).match(RE_PAGINA) ?? []).length;
  }
  return n > 0 ? n : null;
}

export type CifrasPrevia = { paginas: number | null; preguntas: number };

/** «A4 · 12 páginas · 87 preguntas». Sin previa, sólo el formato: no se inventan cifras. */
export function resumenCabecera(cifras: CifrasPrevia | null): string {
  if (!cifras) return "A4 · el número de páginas sale con el PDF";
  const partes = ["A4"];
  if (cifras.paginas) partes.push(`${cifras.paginas} ${cifras.paginas === 1 ? "página" : "páginas"}`);
  partes.push(`${cifras.preguntas} ${cifras.preguntas === 1 ? "pregunta" : "preguntas"}`);
  return partes.join(" · ");
}

/** Firma de las opciones de una previa: si cambia, la previa quedó vieja. */
export function firmaOpciones(opciones: unknown): string {
  return JSON.stringify(opciones);
}
