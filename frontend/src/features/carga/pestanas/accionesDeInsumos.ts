import {
  apiCargaData,
  apiCargaInstrumento,
  apiQuitarData,
  apiQuitarInstrumento,
  apiUpload,
  uploadKindForDataFile,
  type ChoiceCodeMapReview,
  type Pregunta,
  type Seccion,
} from "../../../api/client";
import type { CambiosDeRespuestas } from "../../../api/estudio";
import { apiCargaInstrumentoDelEditor } from "../../../api/xlsformEditor";
import { useEmparejamientoTexto } from "./bases/useEmparejamientoTexto";
import type { DataPreview } from "../RespuestasResumen";
import { choiceMappingReviewFromPreview, type InstrumentoResumen } from "./cargaPaginaModelo";

/** Lo que subir o quitar un insumo deja en la página. */
export type EfectosDeInsumos = {
  setError: (mensaje: string) => void;
  setBusy: (mensaje: string) => void;
  setInstrumento: (resumen: InstrumentoResumen | null) => void;
  setEstructura: (estructura: { secciones: Seccion[]; preguntas: Pregunta[] } | null) => void;
  setDataPreview: (vista: DataPreview | null) => void;
  setCambiosRespuestas: (cambios: CambiosDeRespuestas | null) => void;
  setChoiceMappingReview: (revision: ChoiceCodeMapReview | null) => void;
  refresh: () => Promise<void>;
  /** Relee la revisión y abre las variables extra si las hay. */
  leerRevision: (abrirSiHayExtra: boolean) => Promise<void>;
};

export async function quitarInsumo(kind: "xlsform" | "data", efectos: EfectosDeInsumos) {
  const { setError, setBusy, setInstrumento, setEstructura, setDataPreview, setChoiceMappingReview, refresh } = efectos;
  const label = kind === "xlsform" ? "el formulario" : "las respuestas";
  // Borrar el instrumento vuelve inválidos a la data + estudio; borrar
  // la data también invalida el estudio multi-base. Confirmamos para
  // evitar pérdidas accidentales cuando el usuario ya avanzó.
  if (!window.confirm(
    `¿Quitar ${label}?\n\nSe vaciará lo que depende de esto:\n` +
    (kind === "xlsform"
      ? "el formulario, su lectura, las respuestas y el estudio.\n\n" +
        "Podrás volver a cargar otro formulario después."
      : "las respuestas y el estudio. El formulario se queda cargado.\n\n" +
        "Podrás subir otra base de respuestas después."
    )
  )) return;

  setError("");
  setBusy(`Quitando ${label}`);
  try {
    if (kind === "xlsform") {
      await apiQuitarInstrumento();
      setInstrumento(null);
      setEstructura(null);
      // Quitar XLSForm también invalida la data a nivel UI porque
      // el backend la tiró de la sesión.
      setDataPreview(null);
      setChoiceMappingReview(null);
    } else {
      await apiQuitarData();
      setDataPreview(null);
      setChoiceMappingReview(null);
    }
    await refresh();
  } catch (e: unknown) {
    setError((e as Error).message);
  } finally {
    setBusy("");
  }
}

export async function subirInsumo(
  kind: "xlsform" | "data",
  file: File | undefined,
  efectos: EfectosDeInsumos & { tieneFormulario: boolean },
) {
  const { setError, setBusy, setInstrumento, setEstructura, refresh, tieneFormulario } = efectos;
  if (!file) return;
  if (kind === "data" && !tieneFormulario) {
    setError("Primero carga el formulario. Las respuestas se preparan y validan usando esa estructura.");
    return;
  }
  setError("");
  useEmparejamientoTexto.getState().limpiar();
  setBusy(`Subiendo ${file.name}`);
  const uploadKind = kind === "data" ? uploadKindForDataFile(file) : kind;
  try {
    const up = await apiUpload(file, uploadKind);
    setBusy(`Procesando ${file.name}`);
    if (kind === "xlsform") {
      const r = await apiCargaInstrumento(up.file_id);
      setInstrumento(r.resumen);
      setEstructura(null);
      await refresh();
    } else {
      await aplicarRespuestasCargadas(await apiCargaData(up.file_id), efectos);
    }
  } catch (e: unknown) {
    setError((e as Error).message);
    // Una base de Excel o CSV que no calza puede traer el texto de las
    // preguntas como encabezado: se ofrece emparejarla por ese texto.
    if (kind === "data" && uploadKind === "data" && (e as { code?: string }).code === "E_DATA_XLSFORM_INCOMPATIBLE") {
      void useEmparejamientoTexto.getState().ofrecer(file, async (r) => {
        setError("");
        await aplicarRespuestasCargadas(r, efectos);
      });
    }
  } finally {
    setBusy("");
  }
}

/** Lo que deja en la página una base de respuestas recién cargada. */
async function aplicarRespuestasCargadas(
  r: { preview: DataPreview; cambios: CambiosDeRespuestas | null },
  efectos: EfectosDeInsumos,
) {
  efectos.setDataPreview(r.preview);
  efectos.setCambiosRespuestas(r.cambios);
  const review = choiceMappingReviewFromPreview(r.preview);
  efectos.setChoiceMappingReview(review?.requires_confirmation ? review : null);
  await efectos.refresh();
  // Revisa si trae variables ajenas al formulario y abre la reconciliación si las hay.
  await efectos.leerRevision(true);
}

/** El formulario hecho en el editor del proyecto pasa a ser el formulario de la base. */
export async function usarFormularioDelEditor(
  formulario: { id: string; nombre: string },
  efectos: Pick<EfectosDeInsumos, "setError" | "setBusy" | "setInstrumento" | "setEstructura" | "refresh">,
) {
  const { setError, setBusy, setInstrumento, setEstructura, refresh } = efectos;
  setError("");
  setBusy(`Usando el formulario "${formulario.nombre}" del editor`);
  try {
    const r = await apiCargaInstrumentoDelEditor(formulario.id);
    setInstrumento(r.resumen);
    setEstructura(null);
    await refresh();
  } catch (e: unknown) {
    setError((e as Error).message);
  } finally {
    setBusy("");
  }
}
