// Efectos del flujo «Formulario publicado» (ADR 0102): subir el archivo de
// respuestas, pedir la vista previa cuando hay con qué y crear la base. La
// importación desde SurveyMonkey vuelve como job y se espera con el poller de la
// casa (`esperarResultadoImport`), igual que los imports de plataforma de Carga.

import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  apiCargaFormularioPublicadoImportar,
  apiCargaFormularioPublicadoVistaPrevia,
  normalizeImportarResultado,
  normalizeVistaPreviaFormularioPublicado,
  type CuerpoVistaPrevia,
  type FormularioPublicado,
  type FuenteRespuestas,
  type ImportarFormularioPublicadoResultado,
} from "../../../api/cargaFormularioPublicado";
import { ApiError } from "../../../api/core";
import { apiUpload } from "../../../api/estudio";
import { esperarResultadoImport } from "../importEnSegundoPlano";
import {
  ESTADO_INICIAL,
  nombreBaseSugerido,
  puedePrevisualizar,
  reducirFlujo,
  type EstadoFlujo,
} from "./formularioPublicadoModel";

function mensaje(e: unknown, porDefecto: string): string {
  return e instanceof Error && e.message ? e.message : porDefecto;
}

export type FlujoFormularioPublicado = {
  estado: EstadoFlujo;
  elegirFormulario: (f: FormularioPublicado) => void;
  elegirFuente: (fuente: FuenteRespuestas) => void;
  incluirCampanas: (incluir: boolean) => void;
  cambiarNombre: (nombre: string) => void;
  subir: (archivo: File) => Promise<void>;
  crear: () => Promise<ImportarFormularioPublicadoResultado | null>;
  reintentar: () => void;
  reiniciar: () => void;
};

export function useFormularioPublicadoFlujo(): FlujoFormularioPublicado {
  const [estado, dispatch] = useReducer(reducirFlujo, ESTADO_INICIAL);
  // Cada vista previa lleva su turno: una respuesta vieja no pisa la nueva.
  const turno = useRef(0);
  const montado = useRef(true);
  // El setup vuelve a marcarlo: StrictMode desmonta y remonta en dev, y sin esto
  // la ref quedaba en false y ningún resultado (subida, vista previa) se pintaba.
  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);

  const { revisionId, fuente, archivo, incluirCampanas } = estado;
  const listaParaVista = puedePrevisualizar(estado) && !estado.vistaPrevia && !estado.error;

  useEffect(() => {
    if (!listaParaVista || !revisionId || !fuente) return;
    const mio = ++turno.current;
    const body: CuerpoVistaPrevia = { revision_id: revisionId, fuente };
    if (fuente === "surveymonkey") body.incluir_campanas = incluirCampanas;
    else if (archivo) body.file_id = archivo.file_id;
    dispatch({ tipo: "previsualizando" });
    apiCargaFormularioPublicadoVistaPrevia(body)
      .then((vistaPrevia) => {
        if (montado.current && mio === turno.current) dispatch({ tipo: "vistaPrevia", vistaPrevia });
      })
      .catch((e: unknown) => {
        if (!montado.current || mio !== turno.current) return;
        // El backend puede responder el bloqueo como 409 en vez de en el cuerpo.
        if (e instanceof ApiError && e.code === "E_FUENTE_NO_CALZA") {
          dispatch({ tipo: "vistaPrevia", vistaPrevia: normalizeVistaPreviaFormularioPublicado({ bloqueo: { codigo: e.code, mensaje: e.message } }) });
          return;
        }
        dispatch({ tipo: "error", mensaje: mensaje(e, "No se pudo leer la fuente.") });
      });
  }, [listaParaVista, revisionId, fuente, archivo, incluirCampanas]);

  const elegirFormulario = useCallback((f: FormularioPublicado) => {
    turno.current += 1;
    dispatch({ tipo: "formulario", revisionId: f.revision_id, nombreSugerido: nombreBaseSugerido(f.form_name) });
  }, []);

  const subir = useCallback(async (file: File) => {
    if (!fuente || fuente === "surveymonkey") return;
    turno.current += 1;
    dispatch({ tipo: "subiendo" });
    try {
      const subido = await apiUpload(file, fuente === "sav" ? "sav" : "data");
      if (montado.current) dispatch({ tipo: "subido", archivo: { file_id: subido.file_id, nombre: subido.original_name || file.name } });
    } catch (e) {
      if (montado.current) dispatch({ tipo: "error", mensaje: mensaje(e, "No se pudo subir el archivo.") });
    }
  }, [fuente]);

  const crear = useCallback(async (): Promise<ImportarFormularioPublicadoResultado | null> => {
    if (!revisionId || !fuente) return null;
    dispatch({ tipo: "creando" });
    try {
      const respuesta = await apiCargaFormularioPublicadoImportar({
        revision_id: revisionId,
        fuente,
        base_name: estado.nombreBase,
        ...(fuente === "surveymonkey" ? { incluir_campanas: incluirCampanas } : { file_id: archivo?.file_id ?? "" }),
      });
      const resultado = respuesta.tipo === "job"
        ? normalizeImportarResultado(await esperarResultadoImport<{ ok: boolean }>(respuesta.job_id, {
            onProgress: (progreso) => { if (montado.current) dispatch({ tipo: "progreso", progreso }); },
          }))
        : respuesta.resultado;
      if (montado.current) dispatch({ tipo: "reiniciar" });
      return resultado;
    } catch (e) {
      if (montado.current) dispatch({ tipo: "error", mensaje: mensaje(e, "No se pudo crear la base.") });
      return null;
    }
  }, [revisionId, fuente, incluirCampanas, archivo, estado.nombreBase]);

  return {
    estado,
    elegirFormulario,
    elegirFuente: useCallback((f: FuenteRespuestas) => { turno.current += 1; dispatch({ tipo: "fuente", fuente: f }); }, []),
    incluirCampanas: useCallback((incluir: boolean) => { turno.current += 1; dispatch({ tipo: "campanas", incluir }); }, []),
    cambiarNombre: useCallback((nombre: string) => dispatch({ tipo: "nombre", nombre }), []),
    subir,
    crear,
    reintentar: useCallback(() => dispatch({ tipo: "limpiarError" }), []),
    reiniciar: useCallback(() => { turno.current += 1; dispatch({ tipo: "reiniciar" }); }, []),
  };
}
