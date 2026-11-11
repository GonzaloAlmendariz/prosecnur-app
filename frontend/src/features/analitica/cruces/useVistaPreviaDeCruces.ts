// Los pedidos de la vista previa de Cruces: la hoja con las primeras 20 tablas
// cruzadas del archivo (hasta 200) y, cuando la pregunta en foco no está entre
// ellas, esa sola tabla. Se piden todas las variables de cruce: elegir cuál se
// ve no vuelve a pedir nada. La mecánica, común con Frecuencias, vive en
// `useVistaPreviaDeTablas`.

import { apiAnaliticaCrucesPreview, type CrucesPreview, type CrucesPreviewTabla } from "../../../api/analitica";
import { useVistaPreviaDeTablas, type PedidoDeTablas, type VistaPreviaDeTablas } from "../tablas/useVistaPreviaDeTablas";
import { CRUCES_POR_PEDIDO, esLaTablaDe, TOPE_DE_CRUCES } from "./crucesModelo";

export type VistaPreviaDeCruces = VistaPreviaDeTablas<CrucesPreview>;

const pedirCruces = (pedido: PedidoDeTablas) => apiAnaliticaCrucesPreview(pedido);

export function useVistaPreviaDeCruces(foco: string | null): VistaPreviaDeCruces {
  return useVistaPreviaDeTablas<CrucesPreviewTabla, CrucesPreview>({
    foco,
    pedir: pedirCruces,
    esLa: esLaTablaDe,
    porPedido: CRUCES_POR_PEDIDO,
    tope: TOPE_DE_CRUCES,
  });
}
