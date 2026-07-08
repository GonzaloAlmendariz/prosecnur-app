/**
 * Disclosure para controles expertos (semilla, corridas de auditoría, pools):
 * separa lo que el usuario DECIDE de lo que solo ajusta un técnico, sin
 * esconder nada — un clic y está todo.
 */
import type { ReactNode } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import "./ui.css";

export function PanelAvanzado({
  titulo,
  descripcion,
  children,
  defaultOpen = false,
}: {
  titulo: string;
  descripcion?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="cmv2-uni-avanzado" open={defaultOpen || undefined}>
      <summary>
        <SlidersHorizontal size={13} aria-hidden="true" />
        {titulo}
        {descripcion && <span className="cmv2-uni-avanzado-desc">{descripcion}</span>}
        <ChevronDown size={14} className="cmv2-uni-avanzado-chevron" aria-hidden="true" />
      </summary>
      <div className="cmv2-uni-avanzado-body">{children}</div>
    </details>
  );
}
