import { useMemo } from "react";
import type { EstrategiaImport, ImportExitoso, PeticionImport, ProveedorPlataforma } from "./modeloPlataforma";
import { useImportPlataforma, type UseImportPlataforma } from "./useImportPlataforma";
import type { ImportTerminado, usePlataformaStore } from "./usePlataformaStore";

/**
 * L5b: los cuatro caminos de import de plataforma de Carga (SurveyMonkey/Kobo ×
 * base del estudio/base separada) pasan por el importador único de L5a. El job
 * vive en el store: sobrevive a cambiar de pestaña, se puede cancelar y su
 * desenlace llega una sola vez a `onTerminado` aunque la pantalla se haya
 * desmontado mientras corría.
 */

export type DesenlaceImportCarga = {
  proveedor: ProveedorPlataforma;
  estrategia: EstrategiaImport;
  etiqueta: string;
  terminado: ImportTerminado;
};

export type ImportActivo = {
  proveedor: ProveedorPlataforma;
  estrategia: EstrategiaImport;
  importacion: UseImportPlataforma;
};

export type UseImportsDeCarga = {
  lanzar: (
    proveedor: ProveedorPlataforma,
    estrategia: EstrategiaImport,
    peticion: Omit<PeticionImport, "proveedor" | "estrategia">,
  ) => Promise<string | null>;
  /** El import que hay que mostrar: el que corre o el último que terminó. */
  activo: ImportActivo | null;
  /** Hay un import corriendo en cualquiera de los cuatro caminos. */
  jobEnCurso: boolean;
};

/** Lo que el import dejó en el estudio, si dejó algo. */
export function exitoDe(terminado: ImportTerminado): ImportExitoso | null {
  const r = terminado.resultado;
  return r.tipo === "importado" || r.tipo === "cancelado-importado" ? r : null;
}

export function useImportsDeCarga(
  onTerminado: (desenlace: DesenlaceImportCarga) => void,
  /** Inyectable para tests; por defecto, la instancia de la app. */
  store?: typeof usePlataformaStore,
): UseImportsDeCarga {
  const avisar = (proveedor: ProveedorPlataforma, estrategia: EstrategiaImport) => (terminado: ImportTerminado) =>
    onTerminado({ proveedor, estrategia, etiqueta: terminado.etiqueta, terminado });

  const smUnica = useImportPlataforma({ proveedor: "surveymonkey", estrategia: "unica", onTerminado: avisar("surveymonkey", "unica"), store });
  const smSeparada = useImportPlataforma({ proveedor: "surveymonkey", estrategia: "separada", onTerminado: avisar("surveymonkey", "separada"), store });
  const koboUnica = useImportPlataforma({ proveedor: "kobo", estrategia: "unica", onTerminado: avisar("kobo", "unica"), store });
  const koboSeparada = useImportPlataforma({ proveedor: "kobo", estrategia: "separada", onTerminado: avisar("kobo", "separada"), store });

  const caminos: ImportActivo[] = [
    { proveedor: "surveymonkey", estrategia: "unica", importacion: smUnica },
    { proveedor: "surveymonkey", estrategia: "separada", importacion: smSeparada },
    { proveedor: "kobo", estrategia: "unica", importacion: koboUnica },
    { proveedor: "kobo", estrategia: "separada", importacion: koboSeparada },
  ];

  // El que corre manda; si ninguno corre, el desenlace más reciente.
  const corriendo = caminos.find((c) => c.importacion.estado === "lanzando" || c.importacion.estado === "en-curso");
  const terminados = caminos
    .filter((c) => c.importacion.estado === "terminado" && c.importacion.terminado)
    .sort((a, b) => (b.importacion.terminado?.terminadoEn ?? 0) - (a.importacion.terminado?.terminadoEn ?? 0));
  const activo = corriendo ?? terminados[0] ?? null;

  const porClave = useMemo(
    () => ({
      "surveymonkey:unica": smUnica.importar,
      "surveymonkey:separada": smSeparada.importar,
      "kobo:unica": koboUnica.importar,
      "kobo:separada": koboSeparada.importar,
    }),
    [smUnica.importar, smSeparada.importar, koboUnica.importar, koboSeparada.importar],
  );

  return {
    lanzar: (proveedor, estrategia, peticion) => porClave[`${proveedor}:${estrategia}`](peticion),
    activo,
    jobEnCurso: smUnica.jobEnCurso,
  };
}
