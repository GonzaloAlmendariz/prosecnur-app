import { projectRelTime } from "./tiempoRelativo";
import { areaDeMotivo, type MotivoSinGuardar } from "./modeloMotivosSinGuardar";
import "./motivos-sin-guardar.css";

// Qué dejó el proyecto «sin guardar» (L22): una fila por cambio, con el área
// en palabras y la clave cruda debajo para rastrearla. Vive dentro del diálogo
// del proyecto, que es lo que abre el chip.
const MAXIMO_VISIBLE = 6;

export function MotivosSinGuardar({ motivos }: { motivos: readonly MotivoSinGuardar[] }) {
  if (!motivos.length) return null;
  const visibles = motivos.slice(0, MAXIMO_VISIBLE);
  const resto = motivos.length - visibles.length;
  return (
    <div className="pulso-motivos-sin-guardar" data-testid="motivos-sin-guardar">
      <span className="pulso-motivos-sin-guardar-titulo">Qué cambió</span>
      <ul>
        {visibles.map((motivo) => (
          <li key={motivo.motivo}>
            <span className="pulso-motivos-sin-guardar-area">{areaDeMotivo(motivo.motivo)}</span>
            <span className="pulso-motivos-sin-guardar-cuando">
              {motivo.veces > 1 ? `${motivo.veces} veces · ` : ""}
              {projectRelTime(motivo.ultima)}
            </span>
            <code className="pulso-motivos-sin-guardar-clave" title={motivo.motivo}>{motivo.motivo}</code>
          </li>
        ))}
      </ul>
      {resto > 0 && <span className="pulso-motivos-sin-guardar-resto">y {resto} más</span>}
    </div>
  );
}
