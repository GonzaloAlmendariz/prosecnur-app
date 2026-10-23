import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, CircleAlert, Info } from "../../../vendor/lucide-react";
import "./notaDelModo.css";

export type TonoDeNota = "info" | "aviso" | "error" | "exito" | "neutro";

const ICONO = { info: Info, aviso: AlertTriangle, error: CircleAlert, exito: CheckCircle2, neutro: Info } as const;

/**
 * Nota o advertencia del modo, con ícono, tono de token y fondo suave.
 *
 * Ninguna nota del telefónico queda como texto plano coloreado flotando: va
 * en este componente, alineada con el contenido de su panel. Los estados de
 * una acción (guardando, guardado, error) usan el mismo componente con
 * `role="status"`.
 */
export function NotaDelModo({
  tono = "info",
  children,
  className = "",
  estado = false,
}: {
  tono?: TonoDeNota;
  children: ReactNode;
  className?: string;
  /** Es el resultado de una acción: se anuncia a lectores de pantalla. */
  estado?: boolean;
}) {
  const Icono = ICONO[tono];
  return (
    <div className={`mon-nota is-${tono}${className ? ` ${className}` : ""}`} role={estado ? "status" : undefined}>
      <Icono size={14} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
