import { ClipboardCheck, CloudDownload, Upload } from "../../../vendor/lucide-react";
import { GlidingTabList } from "../../../components/GlidingTabList";
import type { SourceMode } from "./cargaPaginaModelo";

/** Selector del origen de la carga: archivos, plataforma o Monitoreo. */
export function OrigenesDeCarga({
  modo,
  modos,
  onModo,
}: {
  modo: SourceMode;
  modos: SourceMode[];
  onModo: (modo: SourceMode) => void;
}) {
  return (
    <GlidingTabList
      activeKey={modo}
      mode="tabs"
      onRovingKeyChange={(key) => onModo(key as SourceMode)}
      className="pulso-carga-source-switch pulso-compact-tabs pulso-carga-origin-tabs"
      role="radiogroup"
      aria-label="Origen de carga"
    >
      {modos.map((mode) => (
        <button
          key={mode}
          type="button"
          className={`pulso-compact-tab pulso-carga-origin-tab${modo === mode ? " is-active" : ""}`}
          onClick={() => onModo(mode)}
          role="radio"
          aria-checked={modo === mode}
          data-gliding-key={mode}
          title={mode === "files"
            ? "Manual - formulario y respuestas desde archivos locales"
            : mode === "platform"
              ? "Plataforma - SurveyMonkey o KoboToolbox"
              : "Monitoreo - revisar el snapshot local antes de materializar"}
        >
          {mode === "files"
            ? <Upload size={14} />
            : mode === "platform"
              ? <CloudDownload size={14} />
              : <ClipboardCheck size={14} />}
          <span className="pulso-carga-tab-label">
            {mode === "files" ? "Manual" : mode === "platform" ? "Plataforma" : "Monitoreo"}
          </span>
        </button>
      ))}
    </GlidingTabList>
  );
}
