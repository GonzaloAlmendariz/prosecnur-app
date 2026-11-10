// =============================================================================
// impreso/storePrevia.ts — la previa real del cuestionario impreso
// =============================================================================
// «Previsualizar» lanza el mismo job de export-pdf que «Exportar PDF»
// (`esperarExportPapel`), baja el archivo y lo muestra embebido. No hay backend
// nuevo: la descarga sale con `Content-Disposition: attachment`, así que el PDF
// se lee como blob y se muestra desde una URL de objeto (un `<iframe>` con la URL
// de descarga la bajaría en vez de mostrarla).
//
// El estado vive en un store de la pestaña —efímero, no se persiste— para que
// la previa sobreviva a cambiar de pestaña y se descarte al cambiar de
// formulario. Caduca cuando cambian las opciones o el formulario.
// =============================================================================

import { conEjemploParaPapel } from "../cuestionario/ejemploSorteo";
import { create } from "zustand";
import { urlDelArchivo } from "../../../api/core";
import {
  apiXlsformEditorPreviaPdf,
  apiXlsformEditorWordVisor,
  normalizeXlsformWordVisor,
  type XlsformPaperExportOptions,
  type XlsformWordVisor,
} from "../../../api/xlsformEditor";
import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import { esperarExportPapel } from "../shell/paperExportJob";
import { contarPaginasPdf, firmaOpciones, type CifrasPrevia } from "./modeloImpreso";

export type FasePrevia = "inactiva" | "generando" | "descargando" | "lista" | "error";

/** L36 · DOC.2: la previa se lee como el PDF embebido o como las páginas reales del Word. */
export type LecturaPrevia = "pdf" | "word";

export type EstadoPrevia = {
  /** Formulario al que pertenece la previa; otro formulario la descarta. */
  formId: string | null;
  fase: FasePrevia;
  /** Fase legible del job («Armando el modelo», «Dibujando»…). */
  detalle: string;
  url: string | null;
  cifras: CifrasPrevia | null;
  /** Firma de las opciones con que se generó. */
  firma: string | null;
  /** El workbook con que se generó: si el formulario cambia, la previa queda vieja. */
  workbook: XlsformEditorWorkbook | null;
  error: string;
  /** La lectura elegida en la pestaña. */
  lectura: LecturaPrevia;
  /** Con qué lectura se generó lo que hay: si no coincide con la elegida, no se muestra. */
  lecturaGenerada: LecturaPrevia | null;
  /** Páginas del Word (data URI) y en qué página empieza cada pregunta. */
  word: XlsformWordVisor | null;
};

const INICIAL: EstadoPrevia = {
  formId: null,
  fase: "inactiva",
  detalle: "",
  url: null,
  cifras: null,
  firma: null,
  workbook: null,
  error: "",
  lectura: "pdf",
  lecturaGenerada: null,
  word: null,
};

type StorePrevia = EstadoPrevia & {
  parchar: (p: Partial<EstadoPrevia>) => void;
  /** Vacía la previa (y libera su URL de objeto). */
  descartar: () => void;
};

export const usePreviaImpreso = create<StorePrevia>((set, get) => ({
  ...INICIAL,
  parchar: (p) => set(p),
  descartar: () => {
    const url = get().url;
    if (url) URL.revokeObjectURL(url);
    // La lectura elegida es una preferencia de la pestaña: sobrevive a descartar.
    set({ ...INICIAL, lectura: get().lectura });
  },
}));

/** ¿La previa quedó vieja respecto de lo que hoy se exportaría? */
export function previaVieja(
  previa: Pick<EstadoPrevia, "fase" | "firma" | "workbook">,
  opciones: XlsformPaperExportOptions,
  workbook: XlsformEditorWorkbook | null,
): boolean {
  if (previa.fase !== "lista") return false;
  return previa.firma !== firmaOpciones(opciones) || previa.workbook !== workbook;
}

type DepsPrevia = {
  exportar: typeof apiXlsformEditorPreviaPdf;
  visorWord: typeof apiXlsformEditorWordVisor;
  esperar: typeof esperarExportPapel;
  descargar: (fileId: string) => Promise<Uint8Array>;
  crearUrl: (bytes: Uint8Array) => string;
};

const DEPS: DepsPrevia = {
  exportar: apiXlsformEditorPreviaPdf,
  visorWord: apiXlsformEditorWordVisor,
  esperar: esperarExportPapel,
  descargar: async (fileId) => {
    const res = await fetch(urlDelArchivo(fileId));
    if (!res.ok) throw new Error(`No se pudo leer el PDF generado (HTTP ${res.status}).`);
    return new Uint8Array(await res.arrayBuffer());
  },
  crearUrl: (bytes) => URL.createObjectURL(new Blob([bytes.slice().buffer], { type: "application/pdf" })),
};

/** Genera la previa. Los pasos: job de export-pdf → descarga → URL de objeto + cifras. */
export async function generarPrevia(
  entrada: {
    formId: string | null;
    workbook: XlsformEditorWorkbook;
    filename: string;
    opciones: XlsformPaperExportOptions;
  },
  deps: DepsPrevia = DEPS,
): Promise<void> {
  const store = usePreviaImpreso.getState();
  const anterior = store.url;
  const lectura = store.lectura;
  store.parchar({ formId: entrada.formId, fase: "generando", detalle: "", error: "" });
  if (lectura === "word") {
    try {
      let crudo: unknown = null;
      const job = await deps.visorWord(conEjemploParaPapel({ ...entrada.workbook, diagnostico: null }), entrada.filename.replace(/\.pdf$/i, ".docx"), entrada.opciones);
      const resultado = await deps.esperar(job.job_id, {
        onFase: (fase) => usePreviaImpreso.getState().parchar({ detalle: fase }),
        onCrudo: (r) => { crudo = r; },
      });
      const word = normalizeXlsformWordVisor(crudo);
      if (!word.paginas.length) throw new Error("El Word se generó, pero no llegaron sus páginas.");
      usePreviaImpreso.getState().parchar({
        fase: "lista",
        lecturaGenerada: "word",
        word,
        cifras: { paginas: word.paginas.length, preguntas: resultado.summary.n_questions },
        firma: firmaOpciones(entrada.opciones),
        workbook: entrada.workbook,
        detalle: "",
      });
    } catch (e) {
      usePreviaImpreso.getState().parchar({
        fase: "error",
        error: e instanceof Error && e.message ? e.message : "No se pudo armar las páginas del Word.",
      });
    }
    return;
  }
  try {
    const job = await deps.exportar(conEjemploParaPapel({ ...entrada.workbook, diagnostico: null }), entrada.filename, entrada.opciones);
    const resultado = await deps.esperar(job.job_id, {
      onFase: (fase) => usePreviaImpreso.getState().parchar({ detalle: fase }),
    });
    usePreviaImpreso.getState().parchar({ fase: "descargando", detalle: "" });
    const bytes = await deps.descargar(resultado.file_id);
    const url = deps.crearUrl(bytes);
    if (anterior) URL.revokeObjectURL(anterior);
    usePreviaImpreso.getState().parchar({
      fase: "lista",
      lecturaGenerada: "pdf",
      url,
      cifras: { paginas: await contarPaginasPdf(bytes), preguntas: resultado.summary.n_questions },
      firma: firmaOpciones(entrada.opciones),
      workbook: entrada.workbook,
      detalle: "",
    });
  } catch (e) {
    usePreviaImpreso.getState().parchar({
      fase: "error",
      error: e instanceof Error && e.message ? e.message : "No se pudo generar la previa.",
    });
  }
}
