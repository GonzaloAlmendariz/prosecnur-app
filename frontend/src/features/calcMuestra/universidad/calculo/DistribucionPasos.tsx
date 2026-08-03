import "./calculo.css";

/**
 * S7-bis · Las tres lecturas de la distribución se recorren, no se apilan.
 *
 * Composición, precisión y sensibilidad son un recorrido metodológico; resueltas
 * como pila sumaban 2.253 px sobre 645 visibles. El riel conserva el orden a la
 * vista y solo la lectura activa ocupa layout; las tres siguen en el DOM, así
 * que el contrato completo se mantiene verificable.
 *
 * Owner propio: el peaje estructural del loop prohíbe crecer
 * `CalculoDistribucionTab` con una pieza extraíble.
 */
export type DistribucionPasoId = "composicion" | "precision" | "sensibilidad";

export const DISTRIBUCION_PASOS: ReadonlyArray<{ id: DistribucionPasoId; label: string }> = [
  { id: "composicion", label: "Composición" },
  { id: "precision", label: "Precisión" },
  { id: "sensibilidad", label: "Sensibilidad" },
];

export function DistribucionPasos({
  activo,
  onPaso,
}: {
  activo: DistribucionPasoId;
  onPaso: (paso: DistribucionPasoId) => void;
}) {
  return (
    <nav className="cmv2-dist-pasos" aria-label="Lecturas de la distribución">
      {DISTRIBUCION_PASOS.map((paso, index) => (
        <button
          type="button"
          key={paso.id}
          data-paso={paso.id}
          aria-pressed={paso.id === activo}
          onClick={() => onPaso(paso.id)}
        >
          <span>{index + 1}</span>
          {paso.label}
        </button>
      ))}
    </nav>
  );
}
