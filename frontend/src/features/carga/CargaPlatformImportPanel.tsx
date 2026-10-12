import type { ReactNode } from "react";
import { CloudDownload } from "../../vendor/lucide-react";
import type { MultiBaseStrategy } from "./store";

export function CargaPlatformImportPanel({
  strategy,
  single,
  plannedInputCount,
  basesCreadas = 0,
  onUseManual,
  children,
}: {
  strategy: MultiBaseStrategy;
  single: boolean;
  plannedInputCount: number;
  /** «Bases separadas»: cuántas bases ya existen, para decir cuántas faltan. */
  basesCreadas?: number;
  onUseManual?: () => void;
  children?: ReactNode;
}) {
  const separatePlan = strategy === "separate" && plannedInputCount > 1;
  const faltan = Math.max(0, plannedInputCount - basesCreadas);
  const destination = separatePlan
    ? faltan > 0
      ? `Cada encuesta entra como una base nueva: van ${basesCreadas} de ${plannedInputCount}`
      : `Las ${plannedInputCount} bases ya están creadas`
    : single
    ? "Destino: base del estudio"
    : strategy === "integrated"
      ? `Destino: 1 base integrada desde ${plannedInputCount} orígenes`
      : strategy === "independent"
        ? `Destino: ${plannedInputCount} bases independientes`
        : "Destino: una base separada por entrada";
  const detail = separatePlan
    ? "Elige una encuesta e impórtala; su formulario y sus respuestas quedan en su propia base, con el nombre del actor (por ejemplo «docentes»)."
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
          <button type="button" onClick={onUseManual}>Subir archivos</button>
        ) : null}
      </div>
      {children}
    </section>
  );
}
