// =============================================================================
// shell/HubOutputs.tsx — pills informativas sobre el archivo de salida
// =============================================================================
// Aclaran qué tipo de archivo produce el editor. Pills horizontales, no
// botones — son descripciones del entregable.
// =============================================================================

import { FileSpreadsheet, Lock } from "lucide-react";

const OUTPUTS = [
  {
    icon: FileSpreadsheet,
    text: "Genera un .xlsx en formato XLSForm estándar",
    accent: "#0f766e",
  },
  {
    icon: Lock,
    text: "El archivo queda en tu equipo",
    accent: "#2457d6",
  },
];

export function HubOutputs() {
  return (
    <div className="pulso-hub-outputs">
      <span className="pulso-hub-outputs-eyebrow">
        El archivo final
      </span>
      <div className="pulso-hub-outputs-list">
        {OUTPUTS.map(({ icon: Icon, text, accent }) => (
          <div key={text} className="pulso-hub-outputs-pill">
            <span
              className="pulso-hub-outputs-icon"
              style={{ color: accent, background: hexToSoft(accent, 0.1) }}
            >
              <Icon size={14} strokeWidth={2} />
            </span>
            <span>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function hexToSoft(hex: string, alpha: number): string {
  const m = hex.replace("#", "");
  if (m.length !== 6) return `rgba(36, 87, 214, ${alpha})`;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
