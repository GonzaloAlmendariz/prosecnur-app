// Las tres etapas del tablero sobre la compuerta de fuente (5 nov 2026, pulido de UI). Son las mismas que la
// tarjeta del Home cuenta como «0/3 etapas» (Datos, Curación, Publicación): aquí se ven con la primera en curso,
// para que quien llega a Dashboard sin fuente sepa que esto es el primer paso y qué viene después.
import "./etapasDelTablero.css";

const ETAPAS = [
  { id: "datos", rotulo: "Datos", detalle: "XLSForm y base" },
  { id: "curacion", rotulo: "Curación", detalle: "Dimensiones e indicadores" },
  { id: "publicacion", rotulo: "Publicación", detalle: "Tablero para el cliente" },
] as const;

export function EtapasDelTablero() {
  return (
    <ol className="dash-etapas" aria-label="Etapas del tablero">
      {ETAPAS.map((etapa, idx) => (
        <li key={etapa.id} className={`dash-etapa${idx === 0 ? " is-actual" : ""}`} aria-current={idx === 0 ? "step" : undefined}>
          <span className="dash-etapa-n" aria-hidden="true">{idx + 1}</span>
          <span className="dash-etapa-texto">
            <strong>{etapa.rotulo}</strong>
            <small>{etapa.detalle}</small>
          </span>
        </li>
      ))}
    </ol>
  );
}
