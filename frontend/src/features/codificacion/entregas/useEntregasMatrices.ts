// Las salidas de la barra de Matrices (ADR 0133, fase 5): las tres matrices
// Excel y el respaldo JSON, con `useGeneracion` del kit. Un solo contenedor
// anclado a la barra: una generación a la vez, y el disparador sólo se
// deshabilita mientras dura (la línea del contenedor es lo único que se mueve).

import { apiCodifExportJson, apiCodifMatricesExport } from "../../../api/dashboard";
import { useGeneracion, type Generacion, type ResultadoGeneracion } from "../../../components/entregables/useGeneracion";
import { MATRICES, MODULO_PROCESAMIENTO, TITULO_RESPALDO, conNombre, respaldoComoArchivo, type VisibilidadMatriz } from "./modeloEntrega";

export type EntregasMatrices = Generacion & {
  enCurso: boolean;
  matriz: (visibilidad: VisibilidadMatriz, variables: string[], base: string) => Promise<ResultadoGeneracion>;
  respaldo: () => Promise<ResultadoGeneracion>;
};

export function useEntregasMatrices(): EntregasMatrices {
  const gen = useGeneracion({ titulo: MATRICES.work.titulo, modulo: MODULO_PROCESAMIENTO, formato: "xlsx", articulo: "la" });
  const matriz: EntregasMatrices["matriz"] = (visibilidad, variables, base) => {
    const { titulo, articulo, respaldo } = MATRICES[visibilidad];
    return gen.ejecutar(
      async () => conNombre(await apiCodifMatricesExport(visibilidad, variables, base), respaldo),
      { titulo, articulo, formato: "xlsx" },
    );
  };
  const respaldo: EntregasMatrices["respaldo"] = () =>
    gen.ejecutar(async () => respaldoComoArchivo(await apiCodifExportJson()), { titulo: TITULO_RESPALDO, articulo: "el", formato: "json" });
  return { ...gen, enCurso: gen.estado.fase === "en_curso", matriz, respaldo };
}
