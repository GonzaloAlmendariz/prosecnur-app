import type { CalcMuestraModoTrabajo } from "../../../api/client";

type Props = {
  actual: CalcMuestraModoTrabajo;
  onChange: (m: CalcMuestraModoTrabajo) => void;
};

const PASOS: { id: CalcMuestraModoTrabajo; label: string; sublabel: string; orden: number }[] = [
  {
    id: "estimacion_preliminar",
    label: "1. Estimación preliminar",
    sublabel: "Propuesta inicial con universos estimados",
    orden: 1,
  },
  {
    id: "diseno_validado",
    label: "2. Diseño validado",
    sublabel: "Propuesta cerrada con marcos confirmados",
    orden: 2,
  },
];

export function ModoTrabajoStepper({ actual, onChange }: Props) {
  const actualOrden = PASOS.find((p) => p.id === actual)?.orden ?? 1;
  return (
    <div className="cm-stepper">
      {PASOS.map((p) => {
        const completed = p.orden < actualOrden;
        const active = p.orden === actualOrden;
        const cls = active ? "is-active" : completed ? "is-completed" : "";
        return (
          <button
            key={p.id}
            onClick={() => onChange(p.id)}
            className={`cm-step ${cls}`}
            title={p.sublabel}
          >
            <span style={{ display: "block", fontSize: 13 }}>
              {completed && "✓ "}{p.label}
            </span>
            <span style={{ display: "block", fontSize: 11, opacity: 0.85, fontWeight: 400, marginTop: 2 }}>
              {p.sublabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}
