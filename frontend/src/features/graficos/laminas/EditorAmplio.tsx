// Panel ancho sobre visor e inspector para lo que no cabe en una tarjeta de 400 px (F6.1, parte 2): los bloques de
// las multiapiladas y los filtros de respuestas. Reusa los editores existentes tal cual. Acabado W2-A (2026-11-08):
// cabecera CabeceraPanel con la X del kit; «Listo» y la X no conviven, así que queda la X. Escape y la X cierran por la
// misma vía y el foco vuelve al control que lo abrió.

import { useCallback, useEffect, useId, useRef } from "react";
import type { GraficadorRef } from "../../../api/graficos";
import { CabeceraPanel } from "../../../components/CabeceraPanel";
import MultiApiladasBuilder from "../MultiApiladasBuilder";
import { usePlanStore } from "../store";
import { useVariables } from "../useVariables";
import { FiltersPanel } from "../v2/inspector/FiltersPanel";
import { useLaminasUi } from "./laminasStore";
import "./editorAmplio.css";

export function EditorAmplio() {
  const editor = useLaminasUi((s) => s.editorAmplio);
  const setEditor = useLaminasUi((s) => s.setEditorAmplio);
  const slide = usePlanStore((s) => (editor ? s.plan.slides.find((x) => x.id === editor.slideId) : undefined));
  const updateSlotArgs = usePlanStore((s) => s.updateSlotArgs);
  const { variables } = useVariables();
  const ref = useRef<HTMLElement>(null);
  const disparadorRef = useRef<HTMLElement | null>(null);
  const tituloId = useId();
  const abierto = !!editor;

  // Al abrir se recuerda quién lo abrió (el control de la tarjeta) y el foco entra al panel.
  useEffect(() => {
    if (!abierto) return;
    const activo = document.activeElement;
    disparadorRef.current = activo instanceof HTMLElement && activo !== document.body && !ref.current?.contains(activo) ? activo : null;
    ref.current?.focus();
  }, [abierto]);

  const cerrar = useCallback(() => {
    setEditor(null);
    const destino = disparadorRef.current;
    disparadorRef.current = null;
    if (destino?.isConnected) requestAnimationFrame(() => destino.focus({ preventScroll: true }));
  }, [setEditor]);

  if (!editor || !slide) return null;
  const valor = (slide.payload as Record<string, unknown>)[editor.slot] as GraficadorRef | undefined;
  const titulo = editor.tipo === "bloques" ? "Bloques del gráfico" : "Filtrar respuestas";

  return (
    <section
      ref={ref}
      className="pulso-f6-editor-amplio"
      role="dialog"
      aria-labelledby={tituloId}
      tabIndex={-1}
      onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); cerrar(); } }}
    >
      <CabeceraPanel
        className="pulso-f6-editor-amplio-cabecera"
        titulo={titulo}
        tituloId={tituloId}
        onCerrar={cerrar}
        etiquetaCerrar={editor.tipo === "bloques" ? "Cerrar bloques del gráfico" : "Cerrar filtro de respuestas"}
      />
      <div className="pulso-f6-editor-amplio-cuerpo">
        {editor.tipo === "bloques" && valor?.graficador
          ? <MultiApiladasBuilder graf={valor} memoriaKey={`${slide.id}:${editor.slot}`} onArgs={(patch) => updateSlotArgs(slide.id, editor.slot, patch)} />
          : <FiltersPanel slide={slide} variables={variables} slotNames={[editor.slot]} />}
      </div>
    </section>
  );
}
