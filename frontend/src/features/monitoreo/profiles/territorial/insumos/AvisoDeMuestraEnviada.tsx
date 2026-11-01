import { TriangleAlert } from "lucide-react";
import type { MuestraEnviada } from "../../../../../api/monitoreoMuestraEnviada";

/**
 * I4: si la muestra viva de Hojas de ruta ya no es la que se envió a Material,
 * Monitoreo lo dice al lado de la muestra de campo, con la causa, la fecha del
 * envío y cuántas UMP cambian. No corrige nada: el remedio es reenviar desde
 * Hojas de ruta. Sólo aparece cuando difieren.
 */
export function AvisoDeMuestraEnviada({ muestra, onAbrirHojas }: { muestra: MuestraEnviada | null; onAbrirHojas: () => void }) {
  if (!muestra || muestra.estado !== "distinta" || !muestra.texto) return null;
  return (
    <div className="mon-ins-aviso-muestra" role="status">
      <strong><TriangleAlert size={14} aria-hidden="true" />No es la muestra que tiene Material</strong>
      <p>{muestra.texto}</p>
      <button type="button" className="mon-ins-boton is-primario" onClick={onAbrirHojas}>Reenviar desde Hojas de ruta</button>
    </div>
  );
}
