// =============================================================================
// shell/ToastDeck.tsx — stack de notificaciones flotantes con auto-dismiss
// =============================================================================
// Reemplaza al `setStatus("...")` que el monolito actual usa para mostrar
// mensajes efímeros tras un import/export. Los toasts:
//   - Aparecen en la esquina inferior-derecha con `slide-in-up`.
//   - Se auto-dismissan tras 3s (configurable por toast).
//   - Tienen tonos `success` / `info` / `warn` / `danger`.
//   - Soportan acción opcional (un botón al lado del mensaje, ej. "Descargar").
//   - Se cierran manualmente con la X o Esc cuando el último tiene foco.
//
// API (hook):
//   const toasts = useToastDeck();
//   toasts.push({ kind: "success", title: "Formulario importado", detail: "..." });
//
// Renderizado:
//   <ToastDeck items={toasts.items} onDismiss={toasts.dismiss} />
//
// El shell del editor monta el deck una sola vez y comparte el hook con los
// callbacks que disparan acciones.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ToastKind = "success" | "info" | "warn" | "danger";

export type Toast = {
  id: string;
  kind: ToastKind;
  title: string;
  detail?: string;
  /** ms hasta auto-dismiss. 0 = no auto. Default 3500. */
  durationMs?: number;
  /** Acción opcional: botón al lado del mensaje. */
  action?: {
    label: string;
    onClick: () => void;
  };
};

export type ToastInput = Omit<Toast, "id">;

export type UseToastDeck = {
  items: Toast[];
  push: (input: ToastInput) => string;
  dismiss: (id: string) => void;
  clear: () => void;
};

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useToastDeck(): UseToastDeck {
  const [items, setItems] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((input: ToastInput): string => {
    counterRef.current += 1;
    const id = `t-${Date.now()}-${counterRef.current}`;
    const toast: Toast = { ...input, id };
    setItems((prev) => [...prev, toast]);
    const duration = toast.durationMs ?? 3500;
    if (duration > 0) {
      window.setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const clear = useCallback(() => setItems([]), []);

  return { items, push, dismiss, clear };
}

// -----------------------------------------------------------------------------
// Componente
// -----------------------------------------------------------------------------

const KIND_META: Record<
  ToastKind,
  { bg: string; border: string; fg: string; Icon: LucideIcon }
> = {
  success: {
    bg: "var(--pulso-success-bg)",
    border: "var(--pulso-success-border)",
    fg: "var(--pulso-success-fg)",
    Icon: CheckCircle2,
  },
  info: {
    bg: "var(--pulso-info-bg)",
    border: "var(--pulso-info-border)",
    fg: "var(--pulso-info-fg)",
    Icon: Info,
  },
  warn: {
    bg: "var(--pulso-warn-bg)",
    border: "var(--pulso-warn-border)",
    fg: "var(--pulso-warn-fg)",
    Icon: AlertTriangle,
  },
  danger: {
    bg: "var(--pulso-danger-bg)",
    border: "var(--pulso-danger-border)",
    fg: "var(--pulso-danger-fg)",
    Icon: AlertCircle,
  },
};

export function ToastDeck({
  items,
  onDismiss,
}: {
  items: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div
      role="region"
      aria-label="Notificaciones"
      style={{
        position: "fixed",
        right: 24,
        bottom: 24,
        zIndex: 800,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxWidth: 420,
        pointerEvents: "none",
      }}
    >
      {items.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const meta = KIND_META[toast.kind];
  const Icon = meta.Icon;
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    // Si el padre quita el toast del array, este componente se desmonta antes
    // de que la animación termine. Para el caso de cierre manual, hacemos
    // un fade-out de 180ms y luego el dismiss.
    if (!closing) return;
    const t = window.setTimeout(() => onDismiss(toast.id), 180);
    return () => window.clearTimeout(t);
  }, [closing, onDismiss, toast.id]);

  return (
    <div
      role="status"
      className={closing ? "pulso-toast-out" : "pulso-toast-in"}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 10,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        boxShadow: "0 8px 24px rgba(15,23,42,0.12)",
        color: "var(--pulso-text)",
        fontSize: 13,
        pointerEvents: "auto",
      }}
    >
      <Icon size={16} color={meta.fg} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, lineHeight: 1.35 }}>{toast.title}</div>
        {toast.detail && (
          <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", marginTop: 2, lineHeight: 1.45 }}>
            {toast.detail}
          </div>
        )}
      </div>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.onClick();
            setClosing(true);
          }}
          style={{
            fontSize: 12,
            fontWeight: 700,
            padding: "4px 10px",
            background: "white",
            border: `1px solid ${meta.border}`,
            color: meta.fg,
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={() => setClosing(true)}
        aria-label="Cerrar notificación"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 22,
          height: 22,
          padding: 0,
          background: "transparent",
          border: "none",
          color: "var(--pulso-text-soft)",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
