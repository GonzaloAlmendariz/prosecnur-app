import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { apiMaterialTemplatePreview, type MaterialPreview, type MaterialPreviewDpi } from "../../../api/materialPreview";
import type { CollectionMaterialTemplate } from "../../../api/recopiladores";
import {
  ESTADO_INICIAL_DE_VISTA,
  claveDePedido,
  crearPlanificadorDeVista,
  type EstadoDeVista,
  type PedidoDeVista,
  type PlanificadorDeVista,
} from "./planificadorDeVista";

export const DPI_DEL_EDITOR: MaterialPreviewDpi = 90;

type Opciones = {
  /** El borrador; `null` mientras la receta no llega. */
  borrador: CollectionMaterialTemplate | null;
  /** Sin cambios, se pide la receta guardada y no se manda el borrador. */
  conCambios: boolean;
  huella: string;
  /** Página de la cara activa (1-based). */
  page: number;
  /** Cuántas caras tiene la receta, para precargar las demás. */
  caras: number;
  unidad: string | null;
};

export type VistaDelPliego = EstadoDeVista & {
  /** La vista de ESTA cara, si la hay (aunque sea de un borrador anterior). */
  deEstaCara: MaterialPreview | null;
  /** Corresponde exactamente a lo que se está editando. */
  alDia: boolean;
  reintentar: () => void;
};

/**
 * La página real de la cara activa, pedida al backend con espera, turno,
 * cancelación y caché (ver `planificadorDeVista.ts`).
 */
export function useVistaDelPliego({ borrador, conCambios, huella, page, caras, unidad }: Opciones): VistaDelPliego {
  const [estado, setEstado] = useState<EstadoDeVista>(ESTADO_INICIAL_DE_VISTA);
  const planificador = useRef<PlanificadorDeVista | null>(null);
  const contexto = useRef({ borrador, conCambios, huella, unidad, caras });
  contexto.current = { borrador, conCambios, huella, unidad, caras };

  const pedidoDe = useCallback((pagina: number): PedidoDeVista => {
    const actual = contexto.current;
    return {
      clave: claveDePedido({ huella: actual.huella, unidad: actual.unidad, page: pagina, dpi: DPI_DEL_EDITOR }),
      request: {
        page: pagina,
        template: actual.conCambios ? actual.borrador : null,
        unit_id: actual.unidad,
        dpi: DPI_DEL_EDITOR,
      },
    };
  }, []);

  useEffect(() => {
    const instancia = crearPlanificadorDeVista({
      pedir: (request, signal) => apiMaterialTemplatePreview(request, { signal }),
      alCambiar: setEstado,
      alListo: (pedido) => {
        // La otra cara, perezosa: sólo cuando la activa ya está dibujada.
        const total = contexto.current.caras;
        const activa = pedido.request.page;
        const otras: PedidoDeVista[] = [];
        for (let pagina = 1; pagina <= total; pagina += 1) if (pagina !== activa) otras.push(pedidoDe(pagina));
        planificador.current?.precargar(otras);
      },
    });
    planificador.current = instancia;
    return () => {
      instancia.destruir();
      planificador.current = null;
    };
  }, [pedidoDe]);

  const clave = claveDePedido({ huella, unidad, page, dpi: DPI_DEL_EDITOR });
  const listo = borrador !== null;

  useEffect(() => {
    if (!listo || !planificador.current) return;
    // El primer dibujo no espera: no hay ráfaga que agrupar todavía.
    const primero = planificador.current.estado().vista === null;
    planificador.current.solicitar(pedidoDe(page), { inmediato: primero });
  }, [clave, listo, page, pedidoDe]);

  const reintentar = useCallback(() => {
    planificador.current?.solicitar(pedidoDe(page), { inmediato: true });
  }, [page, pedidoDe]);

  return useMemo(() => {
    const deEstaCara = estado.vista && estado.vista.page === page ? estado.vista : null;
    return {
      ...estado,
      deEstaCara,
      alDia: deEstaCara !== null && estado.claveDeVista === clave && !estado.cargando,
      reintentar,
    };
  }, [clave, estado, page, reintentar]);
}
