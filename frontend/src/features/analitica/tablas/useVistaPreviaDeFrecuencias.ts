// Los pedidos de la vista previa de Frecuencias: la hoja de las primeras 50
// tablas del archivo (hasta 500) y, cuando la pregunta elegida no está entre
// ellas, esa sola tabla. La mecánica, común con Cruces, vive en
// `useVistaPreviaDeTablas`.

import {
  apiAnaliticaFrecuenciasPreview,
  type FrecuenciasPreview,
  type FrecuenciasPreviewTabla,
} from "../../../api/analitica";
import { useVistaPreviaDeTablas, type PedidoDeTablas, type VistaPreviaDeTablas } from "./useVistaPreviaDeTablas";
import { esLaVariable, LIMITE_DEL_SERVICIO, TABLAS_POR_PEDIDO } from "./vistaPreviaModelo";

export type VistaPreviaDeFrecuencias = VistaPreviaDeTablas<FrecuenciasPreview>;

const pedirFrecuencias = (pedido: PedidoDeTablas) => apiAnaliticaFrecuenciasPreview(pedido);

export function useVistaPreviaDeFrecuencias(foco: string | null): VistaPreviaDeFrecuencias {
  return useVistaPreviaDeTablas<FrecuenciasPreviewTabla, FrecuenciasPreview>({
    foco,
    pedir: pedirFrecuencias,
    esLa: esLaVariable,
    porPedido: TABLAS_POR_PEDIDO,
    tope: LIMITE_DEL_SERVICIO,
  });
}
