import { Popover } from "../../../components/Popover";
import { PulsoButton } from "../../../components/PulsoButton";
import type { ChromeStatusChip, ChromeStatusTone } from "../../../components/ModuleCommandBar";
import { Bell } from "../../../vendor/lucide-react";
import "./avisosDeLaBarra.css";

/** El tono que manda: el más fuerte de los avisos. */
const RANGO: Record<ChromeStatusTone, number> = { danger: 4, warn: 3, info: 2, success: 1, neutral: 0 };

export function tonoDeLosAvisos(chips: readonly ChromeStatusChip[]): ChromeStatusTone {
  return chips.reduce<ChromeStatusTone>((peor, c) => (RANGO[c.tone] > RANGO[peor] ? c.tone : peor), "neutral");
}

/**
 * Los avisos de la barra de Hojas de ruta en un solo botón (Gonzalo, 3/11:
 * «estos tres deben estar en un solo botón como avisos para ocupar menos
 * espacio»). El botón lleva cuántos son y el tono del más fuerte; el panel,
 * cada aviso con lo que explica y su enlace. Ninguno se pierde: sólo se
 * recogen.
 */
export function AvisosDeLaBarra({ chips }: { chips: readonly ChromeStatusChip[] }) {
  if (!chips.length) return null;
  const tono = tonoDeLosAvisos(chips);
  const nombre = `Avisos (${chips.length})`;
  return (
    <Popover
      side="bottom"
      align="end"
      maxWidth={340}
      ariaLabel="Avisos de Hojas de ruta"
      trigger={
        <PulsoButton variant="secondary" size="sm" className="hr-avisos-boton" data-tone={tono} aria-label={nombre} title={chips.map((c) => c.label).join(", ")}>
          <Bell size={15} aria-hidden />
          Avisos
          <span className="hr-avisos-cuenta" aria-hidden="true">{chips.length}</span>
        </PulsoButton>
      }
    >
      <ul className="hr-avisos-lista" aria-label="Avisos">
        {chips.map((chip) => (
          <li key={chip.id}>
            <button type="button" className="hr-avisos-item" data-tone={chip.tone} onClick={chip.onSelect} disabled={!chip.onSelect}>
              <i aria-hidden="true" />
              <span>
                <b>{chip.label}</b>
                {chip.detail ? <small>{chip.detail}</small> : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Popover>
  );
}
