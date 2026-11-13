import { projectRelTime } from "./tiempoRelativo";
import { accionDeMotivo } from "./accionesDeMotivo";
import type { MotivoSinGuardar } from "./modeloMotivosSinGuardar";
import "./motivos-sin-guardar.css";

// Los cambios sin guardar del proyecto (L22): una fila por cambio, con lo que
// hizo el usuario en palabras (accionesDeMotivo.ts). El identificador del
// backend no se muestra; queda en `data-motivo` para rastrearlo. Vive dentro
// del diálogo del proyecto, que es lo que abre el chip.
const MAXIMO_VISIBLE = 6;

export function MotivosSinGuardar({ motivos }: { motivos: readonly MotivoSinGuardar[] }) {
  if (!motivos.length) return null;
  const visibles = motivos.slice(0, MAXIMO_VISIBLE);
  const resto = motivos.length - visibles.length;
  return (
    <div className="pulso-motivos-sin-guardar" data-testid="motivos-sin-guardar">
      <span className="pulso-motivos-sin-guardar-titulo">Cambios desde el último guardado</span>
      <ul>
        {visibles.map((motivo) => (
          <li key={motivo.motivo} data-motivo={motivo.motivo}>
            <span className="pulso-motivos-sin-guardar-accion">{accionDeMotivo(motivo.motivo)}</span>
            <span className="pulso-motivos-sin-guardar-cuando">
              {motivo.veces > 1 ? `${motivo.veces} veces, ` : ""}
              {projectRelTime(motivo.ultima)}
            </span>
          </li>
        ))}
      </ul>
      {resto > 0 && <span className="pulso-motivos-sin-guardar-resto">y {resto} más</span>}
    </div>
  );
}
