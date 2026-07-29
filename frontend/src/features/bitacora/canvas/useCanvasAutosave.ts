import { useEffect, useRef } from "react";

import { apiBitacoraCanvasGuardar, type CanvasLienzo } from "../../../api/bitacora";
import { toast } from "../../../components/toasterStore";
import { useCanvasStore } from "./store";

/**
 * Autosave del lienzo (ADR 0047).
 *
 * Calcado de `useGraficosAutosave`: debounce y flush en `beforeunload`.
 *
 * Incremental de dos maneras: se guarda SOLO el lienzo tocado —no el módulo
 * entero— y solo cuando el usuario deja de mover cosas. Sin el debounce, un
 * arrastre de dos segundos serían ~120 escrituras al `.pulso`.
 */
const DEBOUNCE_MS = 1200;

export function useCanvasAutosave(lienzo: CanvasLienzo | null, camara: { x: number; y: number; zoom: number }) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const sucio = useCanvasStore((s) => s.sucio);
  const limpiarSucio = useCanvasStore((s) => s.limpiarSucio);

  // El guardado lee de una ref para que el flush de `beforeunload` mande el
  // estado del momento y no el que había cuando se registró el listener.
  const pendienteRef = useRef<CanvasLienzo | null>(null);
  pendienteRef.current = lienzo ? { ...lienzo, nodes, edges, viewport: camara } : null;

  const guardandoRef = useRef(false);

  useEffect(() => {
    if (!sucio || !lienzo) return;
    const id = window.setTimeout(() => {
      const payload = pendienteRef.current;
      if (!payload || guardandoRef.current) return;
      guardandoRef.current = true;
      void apiBitacoraCanvasGuardar(payload)
        .then(() => limpiarSucio())
        .catch((err) => {
          // Un fallo de guardado del lienzo tiene que verse: si se tragara, el
          // usuario seguiría trabajando sobre algo que no se está persistiendo.
          toast.error("El lienzo no se pudo guardar", {
            detalle: err instanceof Error ? err.message : undefined,
          });
        })
        .finally(() => {
          guardandoRef.current = false;
        });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [sucio, nodes, edges, camara, lienzo, limpiarSucio]);

  // Cerrar la ventana con el debounce pendiente perdería el último gesto.
  // `keepalive` permite que la petición sobreviva a la descarga de la página.
  useEffect(() => {
    function alSalir() {
      if (!useCanvasStore.getState().sucio) return;
      const payload = pendienteRef.current;
      if (!payload) return;
      const sid = localStorage.getItem("pulso.sessionId") ?? "";
      void fetch(`/api/bitacora/canvas/${encodeURIComponent(payload.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Pulso-Session": sid },
        body: JSON.stringify({ lienzo: payload }),
        keepalive: true,
      });
    }
    window.addEventListener("beforeunload", alSalir);
    return () => {
      alSalir();
      window.removeEventListener("beforeunload", alSalir);
    };
  }, []);
}
