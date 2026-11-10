// Las generaciones de Cálculo de muestra que viven en la página (ADR 0133,
// fase 5): el reporte metodológico (job de Quarto), el anexo de cursos-horario
// y las tres piezas del paquete de defensa (la memoria JSON, archivo local). La página las
// crea una vez y las pasa a la mesa que esté montada; cada tarjeta dibuja su
// contenedor con `estado` y `cerrar`. El poll del job lo hace el kit
// (`useGeneracion` sigue el `job_id` que devuelve el arranque): se retira el
// `setInterval` propio de la página.

import { useCallback } from "react";
import { apiCalcMuestraAulasExportar, apiCalcMuestraReporteIniciar, type CalcMuestraState } from "../../../api/calcMuestra";
import { useGeneracion, type Generacion, type ResultadoGeneracion } from "../../../components/entregables/useGeneracion";
import { MODULO_CALC_MUESTRA, TITULO_REPORTE } from "./modeloEntrega";

type Formato = "html" | "pdf";

export type EntregasCalcMuestra = {
  reporte: Generacion;
  anexo: Generacion;
  paqueteReporte: Generacion;
  paqueteAnexo: Generacion;
  paqueteMemoria: Generacion;
  /** Guarda el estudio y genera el reporte; `antes` corre primero (p. ej. comprobar el contexto del paquete). */
  generarReporte: (formato: Formato, gen?: Generacion, antes?: () => Promise<unknown>) => Promise<ResultadoGeneracion>;
  /** Exporta el anexo; `antes` corre primero. */
  exportarAnexo: (gen?: Generacion, antes?: () => Promise<unknown>) => Promise<ResultadoGeneracion>;
};

export function useEntregasCalcMuestra({ persistir, alReporte, alEstadoAulas }: {
  /** Guarda el estudio vigente antes de generar el reporte (el job lee el estado guardado). */
  persistir: () => Promise<unknown>;
  /** El job del reporte arrancó (`disponible: false`) o terminó bien (`disponible: true`). */
  alReporte: (meta: { disponible: boolean; jobId: string }) => void;
  /** El motor devuelve el estado de aulas al exportar el anexo. */
  alEstadoAulas: (state: CalcMuestraState) => void;
}): EntregasCalcMuestra {
  const reporte = useGeneracion({ titulo: TITULO_REPORTE, modulo: MODULO_CALC_MUESTRA, articulo: "el" });
  const anexo = useGeneracion({ titulo: "Anexo de cursos-horario", modulo: MODULO_CALC_MUESTRA, formato: "xlsx", articulo: "el" });
  const paqueteReporte = useGeneracion({ titulo: TITULO_REPORTE, modulo: MODULO_CALC_MUESTRA, articulo: "el" });
  const paqueteAnexo = useGeneracion({ titulo: "Anexo de cursos-horario", modulo: MODULO_CALC_MUESTRA, formato: "xlsx", articulo: "el" });
  const paqueteMemoria = useGeneracion({ titulo: "Memoria JSON de reproducibilidad", modulo: MODULO_CALC_MUESTRA, formato: "json", articulo: "la" });

  const generarReporte = useCallback<EntregasCalcMuestra["generarReporte"]>(async (formato, gen = reporte, antes) => {
    let jobId = "";
    const resultado = await gen.ejecutar(async () => {
      if (antes) await antes();
      await persistir();
      const res = await apiCalcMuestraReporteIniciar(formato);
      jobId = res.job_id;
      alReporte({ disponible: false, jobId });
      return res;
    }, { formato });
    if (resultado.ok && jobId) alReporte({ disponible: true, jobId });
    return resultado;
  }, [reporte, persistir, alReporte]);

  const exportarAnexo = useCallback<EntregasCalcMuestra["exportarAnexo"]>((gen = anexo, antes) => gen.ejecutar(async () => {
    if (antes) await antes();
    const res = await apiCalcMuestraAulasExportar();
    alEstadoAulas(res.state);
    return res.export;
  }), [anexo, alEstadoAulas]);

  return { reporte, anexo, paqueteReporte, paqueteAnexo, paqueteMemoria, generarReporte, exportarAnexo };
}
