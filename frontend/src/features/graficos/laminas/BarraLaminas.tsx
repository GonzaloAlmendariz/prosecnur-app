// Barra de la pestaña Láminas (F6.1, parte 2). Reemplaza allí a la barra del Editor anterior con sólo lo que cambia la
// salida o la sigue: informe y alcance, láminas y partes, guardado, deshacer, avisos, cobertura, plan sugerido y
// Exportar como primario único. Lo que era de la era ggplot (estilo global, guías como entregable) sale; lo que todavía
// no tiene superficie nueva (compartir, vaciar, estilo del cliente) va al menú ⋯ y abre el Editor anterior.

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, History, Layers3, MoreHorizontal, Palette, Redo2, Undo2 } from "../../../vendor/lucide-react";
import { SaveStatusIndicator } from "../../../components/SaveStatusIndicator";
import { useSession } from "../../../lib/SessionContext";
import { usePanelDireccionable } from "../../../lib/navegacion/paneles";
import { ExportarInformeMenu, type ExportarInformeMenuProps } from "../ExportarInformeMenu";
import { modoMultibaseDelPlan } from "../modoMultibase";
import { PANEL_AVISOS_INFORME } from "../panelesGraficos";
import { PlanCoverageBadge } from "../PlanCoverageBadge";
import { usePlanStore } from "../store";
import { SuggestedPlanButton } from "../SuggestedPlanButton";
import { usePlanValidator } from "../usePlanValidator";
import { useLaminasUi } from "./laminasStore";
import { agruparAvisos, rotuloLaminasYPartes, totalAvisos } from "./resumenInforme";
import "./barraLaminas.css";

type Props = Omit<ExportarInformeMenuProps, "canExportFinal"> & {
  canExport: boolean;
  onIrEditorAnterior: () => void;
};

const esMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = esMac ? "⌘" : "Ctrl";

export function BarraLaminas({ canExport, onIrEditorAnterior, ...exportar }: Props) {
  const { state } = useSession();
  const slides = usePlanStore((s) => s.plan.slides);
  const dirty = usePlanStore((s) => s.dirty);
  const hydrated = usePlanStore((s) => s.hydrated);
  const past = usePlanStore((s) => s.past.length);
  const future = usePlanStore((s) => s.future.length);
  const undo = usePlanStore((s) => s.undo);
  const redo = usePlanStore((s) => s.redo);
  const resumenes = useLaminasUi((s) => s.resumenes);
  const validator = usePlanValidator();
  const avisosPanel = usePanelDireccionable(PANEL_AVISOS_INFORME);

  const ids = useMemo(() => slides.map((s) => s.id), [slides]);
  const titulo = useMemo(() => {
    const portada = slides.find((s) => s.tipo === "p_slide_portada");
    const t = portada?.payload?.titulo;
    return typeof t === "string" && t.trim() ? t.trim() : "Informe";
  }, [slides]);
  const modo = modoMultibaseDelPlan(state?.estudio_processing_mode, state?.n_bases, state?.active_base);
  const grupos = useMemo(() => agruparAvisos(validator.issues, resumenes, ids), [validator.issues, resumenes, ids]);
  const nAvisos = totalAvisos(grupos);

  return (
    <div className="pulso-f6-barra-host">
    <div className="pulso-f6-barra" role="toolbar" aria-label="Informe">
      <div className="pulso-f6-barra-id">
        <strong className="pulso-f6-barra-titulo" title={titulo}>{titulo}</strong>
        {modo.visible && (
          <span className={`pulso-f6-barra-alcance is-${modo.clave}`} title={modo.explicacion}>
            <Layers3 size={13} aria-hidden="true" />
            {modo.etiqueta}
            <span className="pulso-sr-only">: {modo.explicacion}</span>
          </span>
        )}
        <span className="pulso-f6-barra-meta pulso-f6-barra-ancho">{rotuloLaminasYPartes(ids, resumenes)}</span>
        <span className="pulso-f6-barra-ancho">
          <SaveStatusIndicator state={!hydrated ? "loading" : dirty ? "dirty" : "saved"} savedLabel="Guardado" />
        </span>
      </div>

      <div className="pulso-f6-barra-acciones">
        <span className="pulso-f6-barra-ancho pulso-f6-barra-grupo">
          <button type="button" className="pulso-f6-icono-boton" onClick={undo} disabled={past === 0}
            aria-label="Deshacer" title={past === 0 ? "Nada que deshacer" : `Deshacer (${MOD}+Z)`}>
            <Undo2 size={16} aria-hidden="true" />
          </button>
          <button type="button" className="pulso-f6-icono-boton" onClick={redo} disabled={future === 0}
            aria-label="Rehacer" title={future === 0 ? "Nada que rehacer" : `Rehacer (${MOD}+Shift+Z)`}>
            <Redo2 size={16} aria-hidden="true" />
          </button>
        </span>
        <button
          type="button"
          className={`pulso-f6-boton pulso-f6-barra-avisos${grupos.bloquean.length ? " is-bloquea" : ""}`}
          aria-expanded={avisosPanel.abierto}
          onClick={avisosPanel.alternar}
          title={grupos.bloquean.length ? `${grupos.bloquean.length} bloquean la exportación` : "Avisos del informe"}
        >
          <AlertTriangle size={14} aria-hidden="true" />
          {nAvisos === 1 ? "1 aviso" : `${nAvisos} avisos`}
        </button>
        <span className="pulso-f6-barra-ancho"><PlanCoverageBadge conNombre /></span>
        <SuggestedPlanButton />
        <ExportarInformeMenu {...exportar} canExportFinal={canExport && validator.canExport} />
        <MenuMas
          undo={{ disabled: past === 0, run: undo }}
          redo={{ disabled: future === 0, run: redo }}
          onIrEditorAnterior={onIrEditorAnterior}
        />
      </div>
    </div>
    </div>
  );
}

function MenuMas({ undo, redo, onIrEditorAnterior }: {
  undo: { disabled: boolean; run: () => void };
  redo: { disabled: boolean; run: () => void };
  onIrEditorAnterior: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("keydown", esc); };
  }, [abierto]);
  const item = (fn: () => void) => () => { setAbierto(false); fn(); };
  return (
    <div className="pulso-f6-mas" ref={ref}>
      <button type="button" className="pulso-f6-icono-boton" aria-label="Más acciones" aria-haspopup="menu"
        aria-expanded={abierto} onClick={() => setAbierto((v) => !v)}>
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>
      {abierto && (
        <div className="pulso-f6-mas-menu" role="menu" aria-label="Más acciones">
          <button type="button" role="menuitem" className="pulso-f6-solo-compacto-barra" disabled={undo.disabled} onClick={item(undo.run)}>
            <Undo2 size={14} aria-hidden="true" /> Deshacer
          </button>
          <button type="button" role="menuitem" className="pulso-f6-solo-compacto-barra" disabled={redo.disabled} onClick={item(redo.run)}>
            <Redo2 size={14} aria-hidden="true" /> Rehacer
          </button>
          <button type="button" role="menuitem" onClick={item(onIrEditorAnterior)}>
            <Palette size={14} aria-hidden="true" />
            <span>Estilo del cliente<small>Mientras llega su pestaña, en el Editor anterior</small></span>
          </button>
          <button type="button" role="menuitem" onClick={item(onIrEditorAnterior)}>
            <History size={14} aria-hidden="true" />
            <span>Compartir, importar o vaciar el plan<small>En el Editor anterior</small></span>
          </button>
        </div>
      )}
    </div>
  );
}
