import { AlertCircle, Check, CheckCircle2, Loader2 } from "lucide-react";

// Indicador de estado de autosave unificado entre Fases 3/4/5.
//
// Antes existían 3 implementaciones paralelas:
//   - `SaveBadge` en RespuestasCodificador + IntegerCodificador (pill con
//      5 estados idle/dirty/saving/saved/error).
//   - `SaveStatusIndicator` local en GraficosHeader (span inline con 3
//     estados saved/saving/loading).
//   - `<span>` inline en AnaliticaHeader con CheckCircle hardcoded.
//
// Ahora un solo componente con:
//   - **Estados unificados**: idle | dirty | saving | saved | loading | error.
//   - **Variantes**: "inline" (span con icon + label uppercase, marco cero)
//     y "badge" (pill con background y border, denser).
//
// El contenido es consistente (labels, tokens de color, íconos) para
// que el ojo aprenda el patrón una vez y lo reconozca en cualquier fase.

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "loading" | "error";

type Props = {
  state: SaveState;
  /**
   * "inline" — span transparente con icon + label uppercase (default,
   *   apto para headers/toolbars donde no se quiere marco propio).
   * "badge" — pill con background y border (apto para posicionar al
   *   lado del título de un pane de edición, ej. RespuestasCodificador).
   */
  variant?: "inline" | "badge";
  /**
   * Label personalizado en estado `saved`. Algunas fases dicen
   * "Autoguardado" en header global y "Guardado" en un pane granular.
   * Default: "Guardado".
   */
  savedLabel?: string;
};

type Cfg = {
  label: string;
  icon: JSX.Element | null;
  /** Color del ícono + texto (cuando variant=inline). */
  color: string;
  /** Background del pill (variant=badge). */
  bg: string;
  /** Border del pill (variant=badge). */
  border: string;
};

function cfgFor(state: SaveState, savedLabel: string): Cfg {
  switch (state) {
    case "saved":
      return {
        label: savedLabel,
        icon: <CheckCircle2 size={12} />,
        color: "var(--pulso-success-fg)",
        bg: "var(--pulso-success-bg)",
        border: "var(--pulso-success-border)",
      };
    case "saving":
      return {
        label: "Guardando…",
        icon: <Loader2 size={12} className="pulso-spin" />,
        color: "var(--pulso-info-fg)",
        bg: "var(--pulso-info-bg)",
        border: "var(--pulso-info-border)",
      };
    case "dirty":
      return {
        label: "Cambios sin guardar",
        icon: null,
        color: "var(--pulso-warn-fg)",
        bg: "var(--pulso-warn-bg)",
        border: "var(--pulso-warn-border)",
      };
    case "error":
      return {
        label: "Error al guardar",
        icon: <AlertCircle size={12} />,
        color: "var(--pulso-danger-fg)",
        bg: "var(--pulso-danger-bg)",
        border: "var(--pulso-danger-border)",
      };
    case "loading":
      return {
        label: "Cargando…",
        icon: <Loader2 size={12} className="pulso-spin" />,
        color: "var(--pulso-text-soft)",
        bg: "var(--pulso-surface-2)",
        border: "var(--pulso-border)",
      };
    case "idle":
    default:
      return {
        label: "Sin cambios",
        icon: <Check size={12} />,
        color: "var(--pulso-text-soft)",
        bg: "var(--pulso-surface-2)",
        border: "var(--pulso-border)",
      };
  }
}

export function SaveStatusIndicator({
  state,
  variant = "inline",
  savedLabel = "Guardado",
}: Props) {
  const cfg = cfgFor(state, savedLabel);
  if (variant === "badge") {
    return (
      <span
        role="status"
        style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "2px 8px", borderRadius: 4,
          fontSize: 11, fontWeight: 600,
          color: cfg.color,
          background: cfg.bg,
          border: `1px solid ${cfg.border}`,
          whiteSpace: "nowrap",
        }}
      >
        {cfg.icon}
        {cfg.label}
      </span>
    );
  }
  // inline
  return (
    <span
      role="status"
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        color: cfg.color,
        fontSize: 11, fontWeight: 700,
        textTransform: "uppercase", letterSpacing: 0.4,
        whiteSpace: "nowrap",
      }}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}
