/**
 * Aviso unificado del módulo Cálculo de muestra (revamp QA H7): una sola voz
 * visual para todos los mensajes de estado de la mesa — info, éxito,
 * advertencia y notas neutras — en lugar de los 6+ lenguajes que convivían
 * (chip verde, strip con ícono, banner de compatibilidad, alerta ámbar, nota
 * suave...). Presentacional puro: no decide tonos ni contenido.
 *
 * Uso:
 *   <AvisoModulo tone="warn" title="El marco cambió">detalle…</AvisoModulo>
 *   <AvisoModulo tone="success" compact>El marco está al día.</AvisoModulo>
 */
import type { ReactNode } from "react";
import { CheckCircle2, Info, NotepadText, TriangleAlert, type LucideIcon } from "lucide-react";
import "./aviso.css";

export type AvisoTone = "info" | "success" | "warn" | "neutral";

const TONE_ICON: Record<AvisoTone, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warn: TriangleAlert,
  neutral: NotepadText,
};

/** Rol ARIA por defecto según el tono (warn interrumpe; el resto informa). */
const TONE_ROLE: Record<AvisoTone, "alert" | "status" | "note"> = {
  info: "note",
  success: "status",
  warn: "alert",
  neutral: "note",
};

export function AvisoModulo({
  tone,
  icon,
  title,
  children,
  actions,
  compact = false,
  role,
  className,
}: {
  tone: AvisoTone;
  /** Ícono alternativo (lucide, vía el shim) si el del tono no comunica. */
  icon?: LucideIcon;
  title?: ReactNode;
  children?: ReactNode;
  /** Acciones alineadas a la derecha (botones existentes; el aviso no las estiliza). */
  actions?: ReactNode;
  /** Variante de una línea para estados inline (chips de frescura, badges). */
  compact?: boolean;
  role?: "alert" | "status" | "note";
  className?: string;
}) {
  const IconComponent = icon ?? TONE_ICON[tone];
  return (
    <div
      className={["cmv2-aviso", compact ? "cmv2-aviso--compact" : "", className ?? ""].filter(Boolean).join(" ")}
      data-tone={tone}
      role={role ?? TONE_ROLE[tone]}
    >
      <IconComponent size={15} aria-hidden="true" className="cmv2-aviso-icon" />
      <div className="cmv2-aviso-body">
        {title ? <strong className="cmv2-aviso-title">{title}</strong> : null}
        {children ? <div className="cmv2-aviso-copy">{children}</div> : null}
      </div>
      {actions ? <div className="cmv2-aviso-actions">{actions}</div> : null}
    </div>
  );
}
