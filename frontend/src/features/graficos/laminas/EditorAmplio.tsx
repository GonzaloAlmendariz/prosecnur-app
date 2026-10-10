// Panel ancho sobre visor e inspector para lo que no cabe en una tarjeta de 400 px (F6.1, parte 2): los bloques de
// las multiapiladas y los filtros de respuestas. Reusa los editores existentes tal cual; se cierra con Esc o la X.

import { useEffect, useRef } from "react";
import { X } from "../../../vendor/lucide-react";
import type { GraficadorRef } from "../../../api/graficos";
import MultiApiladasBuilder from "../MultiApiladasBuilder";
import { usePlanStore } from "../store";
import { useVariables } from "../useVariables";
import { FiltersPanel } from "../v2/inspector/FiltersPanel";
import { useLaminasUi } from "./laminasStore";
import "./editorAmplio.css";

export function EditorAmplio() {
  const editor = useLaminasUi((s) => s.editorAmplio);
  const cerrar = useLaminasUi((s) => s.setEditorAmplio);
  const slide = usePlanStore((s) => (editor ? s.plan.slides.find((x) => x.id === editor.slideId) : undefined));
  const updateSlotArgs = usePlanStore((s) => s.updateSlotArgs);
  const { variables } = useVariables();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => { if (editor) ref.current?.focus(); }, [editor]);
  if (!editor || !slide) return null;
  const valor = (slide.payload as Record<string, unknown>)[editor.slot] as GraficadorRef | undefined;
  const titulo = editor.tipo === "bloques" ? "Bloques del gráfico" : "Filtrar respuestas";

  return (
    <section
      ref={ref}
      className="pulso-f6-editor-amplio"
      role="dialog"
      aria-label={titulo}
      tabIndex={-1}
      onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); cerrar(null); } }}
    >
      <header className="pulso-f6-col-head">
        <h2>{titulo}</h2>
        <span className="pulso-f6-col-sp" />
        <button type="button" className="pulso-f6-boton" onClick={() => cerrar(null)}>Listo</button>
        <button type="button" className="pulso-f6-icono-boton" aria-label="Cerrar" onClick={() => cerrar(null)}>
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <div className="pulso-f6-editor-amplio-cuerpo">
        {editor.tipo === "bloques" && valor?.graficador
          ? <MultiApiladasBuilder graf={valor} onArgs={(patch) => updateSlotArgs(slide.id, editor.slot, patch)} />
          : <FiltersPanel slide={slide} variables={variables} slotNames={[editor.slot]} />}
      </div>
    </section>
  );
}
