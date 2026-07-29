import { useEffect } from "react";

import { AlertTriangle, CheckCheck, Info, X, XCircle } from "../vendor/lucide-react";
import { useToasterStore, type Toast, type TonoToast } from "./toasterStore";
import "./toaster.css";

const ICONO: Record<TonoToast, typeof Info> = {
  info: Info,
  exito: CheckCheck,
  aviso: AlertTriangle,
  error: XCircle,
};

/**
 * Host único del deck de toasts (ADR 0047).
 *
 * Se monta una sola vez en `Layout.tsx`, junto a los demás hosts globales. No
 * expone props ni Provider: quien quiera emitir importa `toast` del store.
 *
 * Accesibilidad: el contenedor es `aria-live="polite"` para que un lector de
 * pantalla anuncie sin interrumpir; los errores suben a `assertive` porque sí
 * interrumpen. Ningún toast roba el foco — aparecer no debe sacar al usuario de
 * donde está escribiendo.
 */
export function Toaster() {
  const toasts = useToasterStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="pulso-toaster" data-toast-count={toasts.length}>
      <div className="pulso-toaster-deck" role="status" aria-live="polite" aria-atomic="false">
        {toasts.filter((t) => t.tono !== "error").map((t) => (
          <ToastCard key={t.id} toast={t} />
        ))}
      </div>
      <div className="pulso-toaster-deck" role="alert" aria-live="assertive" aria-atomic="false">
        {toasts.filter((t) => t.tono === "error").map((t) => (
          <ToastCard key={t.id} toast={t} />
        ))}
      </div>
    </div>
  );
}

function ToastCard({ toast: t }: { toast: Toast }) {
  const cerrar = useToasterStore((s) => s.cerrar);
  const Icono = ICONO[t.tono];

  useEffect(() => {
    if (t.duracion <= 0) return;
    const id = window.setTimeout(() => cerrar(t.id), t.duracion);
    return () => window.clearTimeout(id);
  }, [t.id, t.duracion, cerrar]);

  return (
    <div
      className={`pulso-toast is-${t.tono}`}
      // Escape cierra el toast que tiene el foco dentro, sin capturarlo cuando
      // el usuario está en otra parte de la pantalla.
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          cerrar(t.id);
        }
      }}
    >
      <span className="pulso-toast-icono" aria-hidden="true">
        <Icono size={16} />
      </span>
      <span className="pulso-toast-cuerpo">
        <strong>{t.mensaje}</strong>
        {t.detalle && <small>{t.detalle}</small>}
      </span>
      {t.accion && (
        <button
          type="button"
          className="pulso-toast-accion"
          onClick={() => {
            t.accion?.onSelect();
            cerrar(t.id);
          }}
        >
          {t.accion.label}
        </button>
      )}
      <button
        type="button"
        className="pulso-toast-cerrar"
        onClick={() => cerrar(t.id)}
        aria-label={`Cerrar aviso: ${t.mensaje}`}
      >
        <X size={14} />
      </button>
    </div>
  );
}
