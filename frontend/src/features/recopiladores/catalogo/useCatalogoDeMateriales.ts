import { useCallback, useEffect, useReducer, useRef } from "react";

import {
  apiMaterialCatalog,
  apiMaterialCatalogPreview,
  apiMaterialCatalogUsar,
  type MaterialCatalogPreset,
} from "../../../api/materialCatalog";
import { ESTADO_INICIAL_CATALOGO, reducirCatalogo } from "./estadoCatalogo";
import { claveDeVista } from "./modeloCatalogo";

function mensajeDe(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

/**
 * Carga del catálogo, caché de miniaturas y acción «Usar este tipo».
 *
 * Las miniaturas se piden una vez por página y se recuerdan mientras la vista
 * viva: cambiar de filtro o de selección no vuelve a llamar al compilador.
 */
export function useCatalogoDeMateriales(opts: {
  expectedRevision: number | null;
  onStateRefresh: () => Promise<void>;
}) {
  const [estado, dispatch] = useReducer(reducirCatalogo, ESTADO_INICIAL_CATALOGO);
  const pedidas = useRef(new Set<string>());
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  const cargar = useCallback(async () => {
    dispatch({ type: "carga-inicio" });
    try {
      const catalogo = await apiMaterialCatalog();
      if (vivo.current) dispatch({ type: "carga-ok", catalogo });
    } catch (cause) {
      if (vivo.current) dispatch({ type: "carga-error", mensaje: mensajeDe(cause, "No se pudo leer el catálogo.") });
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  useEffect(() => {
    const onSession = () => {
      pedidas.current.clear();
      void cargar();
    };
    window.addEventListener("pulso:session-changed", onSession);
    return () => window.removeEventListener("pulso:session-changed", onSession);
  }, [cargar]);

  const pedirVista = useCallback((presetId: string, page: number) => {
    const clave = claveDeVista(presetId, page);
    if (pedidas.current.has(clave)) return;
    pedidas.current.add(clave);
    dispatch({ type: "vista-inicio", clave });
    apiMaterialCatalogPreview({ preset_id: presetId, page }).then(
      (vista) => { if (vivo.current) dispatch({ type: "vista-ok", clave, vista }); },
      (cause: unknown) => {
        // Un error no queda cacheado como pedido: el próximo intento vuelve a llamar.
        pedidas.current.delete(clave);
        if (vivo.current) dispatch({ type: "vista-error", clave, mensaje: mensajeDe(cause, "Sin vista previa.") });
      },
    );
  }, []);

  const { expectedRevision, onStateRefresh } = opts;
  const usar = useCallback(async (preset: MaterialCatalogPreset) => {
    if (expectedRevision === null) return;
    dispatch({ type: "usar-inicio", presetId: preset.preset_id });
    try {
      await apiMaterialCatalogUsar({ preset, expected_revision: expectedRevision });
      await onStateRefresh();
      if (vivo.current) dispatch({ type: "usar-fin" });
      await cargar();
    } catch (cause) {
      if (vivo.current) dispatch({ type: "usar-fin", error: mensajeDe(cause, "No se pudo usar este tipo.") });
    }
  }, [cargar, expectedRevision, onStateRefresh]);

  return { estado, dispatch, cargar, pedirVista, usar };
}
