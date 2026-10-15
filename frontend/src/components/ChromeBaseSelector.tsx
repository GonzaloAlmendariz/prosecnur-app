/**
 * Selector de base activa para la banda de Procesamiento.
 *
 * Las cinco secciones tratan el mismo estudio, y hasta ahora cada una resolvía la
 * base a su manera: Validación con un componente propio, Codificación con un
 * disparador escrito a mano dentro de su page-file, y Analítica y Gráficos con la
 * zona de contexto vacía. Se veía como que la banda cambiaba de forma al moverse
 * entre secciones, cuando lo único que cambiaba era quién había escrito el
 * control.
 *
 * La regla que fija esto: **todas las secciones llevan selector de base menos
 * Carga**, que es donde se dan de alta las bases y por eso lleva el control de
 * multibase en su lugar. Una sección no elige si mostrarlo — lo muestra si el
 * estudio tiene más de una base, y se calla si no hay nada que elegir.
 *
 * El componente se cablea solo: lee el estudio, cambia la base por la API canónica
 * y emite `pulso:active-base-changed` para que las páginas recarguen su estado
 * scoped. Así una sección nueva no tiene que aprender el protocolo ni volver a
 * inventarse el aspecto.
 */

import { useCallback, useEffect, useState } from "react";

import { BaseSelectorTrigger, BasesInspectorMenu, basesDesdeEstudio } from "./BasesInspectorMenu";
import { apiEstudioActiveBaseSet, apiEstudioGet, type EstudioPayload } from "../api/client";
import { processingBaseScopePresentation } from "../features/procesamiento/baseScopeModel";
import { useSession } from "../lib/SessionContext";

export function ChromeBaseSelector() {
  const { refresh } = useSession();
  const [estudio, setEstudio] = useState<EstudioPayload | null>(null);
  // Cambiar de base tarda 20–40 s en un estudio grande (F8): se guarda A QUÉ
  // base se cambia para decirlo en el chip y en el menú, no sólo deshabilitar.
  const [cambiandoA, setCambiandoA] = useState<string | null>(null);
  const cambiando = cambiandoA !== null;

  const cargar = useCallback(async () => {
    try {
      setEstudio(await apiEstudioGet());
    } catch {
      // Sin estudio no hay nada que elegir: el selector simplemente no aparece.
      setEstudio(null);
    }
  }, []);

  useEffect(() => {
    void cargar();
    const onCambio = () => void cargar();
    window.addEventListener("pulso:active-base-changed", onCambio);
    window.addEventListener("pulso:session-changed", onCambio);
    return () => {
      window.removeEventListener("pulso:active-base-changed", onCambio);
      window.removeEventListener("pulso:session-changed", onCambio);
    };
  }, [cargar]);

  if (!estudio || estudio.n_bases <= 1) return null;

  const alcance = processingBaseScopePresentation(
    estudio.processing_mode ?? null,
    estudio.n_bases,
  );
  const bases = Object.values(estudio.bases);
  const activa = estudio.active_base ?? bases[0]?.nombre ?? null;
  const base = bases.find((b) => b.nombre === activa) ?? bases[0];
  const etiquetaDe = (b: (typeof bases)[number]) => b.source_alias || b.source_title || b.nombre;
  const etiqueta = base ? etiquetaDe(base) : "Elegir base";
  const destino = cambiandoA ? bases.find((b) => b.nombre === cambiandoA) : undefined;
  const textoCambio = cambiandoA ? `Cambiando a ${destino ? etiquetaDe(destino) : cambiandoA}…` : null;

  async function seleccionar(nombre: string) {
    if (!nombre || nombre === activa || cambiando) return;
    setCambiandoA(nombre);
    try {
      const resultado = await apiEstudioActiveBaseSet(nombre);
      await refresh();
      // Las páginas de Procesamiento sirven estado scoped por base; sin este
      // aviso se quedarían mostrando el de la base anterior.
      window.dispatchEvent(new CustomEvent("pulso:active-base-changed", {
        detail: { active: resultado.active, processing_mode: resultado.processing_mode },
      }));
      await cargar();
    } finally {
      setCambiandoA(null);
    }
  }

  return (
    <>
      <BasesInspectorMenu
        bases={basesDesdeEstudio(estudio)}
        activa={activa}
        onSeleccionar={(nombre) => void seleccionar(nombre)}
        deshabilitado={cambiando}
        cambiandoA={cambiandoA}
        textoCambio={textoCambio}
        modo={alcance.summaryLabel}
        disparador={
          <BaseSelectorTrigger etiqueta={etiqueta} total={estudio.n_bases} cambiando={textoCambio} />
        }
      />
      {/* Anuncio para lector de pantalla: el popover puede estar cerrado. */}
      <span className="pulso-sr-only" role="status" aria-live="polite">
        {textoCambio ?? ""}
      </span>
    </>
  );
}
