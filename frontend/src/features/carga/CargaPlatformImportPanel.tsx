import type { ReactNode } from "react";
import { CloudDownload } from "../../vendor/lucide-react";
import type { MultiBaseStrategy } from "./store";

export function CargaPlatformImportPanel({
  strategy,
  single,
  plannedInputCount,
  onUseManual,
  children,
}: {
  strategy: MultiBaseStrategy;
  single: boolean;
  plannedInputCount: number;
  onUseManual?: () => void;
  children?: ReactNode;
}) {
  const separatePlan = strategy === "separate" && plannedInputCount > 1;
  const destination = separatePlan
    ? `${plannedInputCount} destinos separados planificados`
    : single
    ? "Destino: base del estudio"
    : strategy === "integrated"
      ? `Destino: 1 base integrada desde ${plannedInputCount} orígenes`
      : strategy === "independent"
        ? `Destino: ${plannedInputCount} bases independientes`
        : "Destino: una base separada por entrada";
  const detail = separatePlan
    ? `${plannedInputCount} slots disponibles en Manual. Cada destino necesita su propio formulario y sus respuestas para evitar sobrescrituras.`
    : "El catálogo se consulta únicamente al pulsar su botón de actualización.";

  return (
    <section
      className="pulso-carga-platform-shell"
      aria-label="Importación desde plataforma"
      data-platform-strategy={single ? "single" : strategy}
    >
      <div className="pulso-carga-platform-shell-context" role="status">
        <CloudDownload size={15} aria-hidden="true" />
        <span>
          <strong>{destination}</strong>
          <small>{detail}</small>
        </span>
        {separatePlan && onUseManual ? (
          <button type="button" onClick={onUseManual}>Ir a Manual</button>
        ) : null}
      </div>
      {separatePlan ? null : children}
    </section>
  );
}
