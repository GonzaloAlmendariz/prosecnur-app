import { TriangleAlert } from "lucide-react";
import type { MuestraEnviada } from "../../../../../api/monitoreoMuestraEnviada";

/**
 * I4: Monitoreo y Material miden contra la muestra enviada (ADR 0118 §3,
 * enmienda 2026-11-01). Si la de Hojas de ruta ya es otra, Monitoreo lo dice al
 * lado de la muestra de campo, con la causa, cuándo se volvió a sortear, cuándo
 * se envió la que se mide y qué UMP cambian. No corrige nada: el remedio es
 * reenviar desde Hojas de ruta. Sólo aparece cuando difieren.
 */
export function AvisoDeMuestraEnviada({ muestra, onAbrirHojas }: { muestra: MuestraEnviada | null; onAbrirHojas: () => void }) {
  if (!muestra || muestra.estado !== "distinta" || !muestra.texto) return null;
  return (
    <div className="mon-ins-aviso-muestra" role="status">
      <strong><TriangleAlert size={14} aria-hidden="true" />Hojas de ruta tiene otra muestra</strong>
      <p>{muestra.texto}</p>
      <button type="button" className="mon-ins-boton is-primario" onClick={onAbrirHojas}>Reenviar desde Hojas de ruta</button>
    </div>
  );
}
