// Peso base que el raking calibra (ADR 0131 §6): ninguno (peso 1), una
// columna de la base (1/π por caso) o el reequilibrio por estrato. El editor
// del estrato lo monta el panel debajo cuando corresponde.

import type { VariableInstrumento } from "../../../api/client";
import { PulsoSelect } from "../../../components/PulsoSelect";
import type { OrigenPesoBase } from "../ponderacionConfigModel";
import { columnasCandidatasAPeso } from "./PesoPorColumna";
import "./PonderacionControles.css";

const OPCIONES: { valor: OrigenPesoBase; rotulo: string; ayuda: string }[] = [
  { valor: "ninguno", rotulo: "Ninguno", ayuda: "Cada caso parte con peso 1." },
  { valor: "columna", rotulo: "Columna de la base", ayuda: "El peso de diseño de cada caso (1/π), p. ej. el de la muestra de manzanas." },
  { valor: "estrato", rotulo: "Reequilibrio por estrato", ayuda: "Cuando muestreaste distinto de la población (n igual por distrito con distritos de tamaño distinto)." },
];

export function PonderacionPesoBase({ origen, columna, variables, onOrigen, onColumna }: {
  origen: OrigenPesoBase;
  columna: string;
  variables: readonly VariableInstrumento[];
  onOrigen: (o: OrigenPesoBase) => void;
  onColumna: (c: string) => void;
}) {
  const candidatas = columnasCandidatasAPeso(variables);
  const fuera = !!columna && !candidatas.some((v) => v.name === columna);
  return (
    <div className="pond-card pond-peso-base">
      <div className="analitica-segmented" role="radiogroup" aria-label="Peso base">
        {OPCIONES.map((o) => (
          <button key={o.valor} type="button" role="radio" aria-checked={origen === o.valor}
            className={origen === o.valor ? "is-on" : ""} title={o.ayuda} onClick={() => onOrigen(o.valor)}>
            {o.rotulo}
          </button>
        ))}
      </div>
      {origen === "columna" && (candidatas.length > 0 || fuera) && (
        <span className="pond-ajuste-campo"
          title="Numérica y mayor que 0 en todos los casos; si no, el cálculo se detiene y dice cuántos fallan.">
          <span>Columna</span>
          <PulsoSelect size="sm" ariaLabel="Columna del peso base" value={columna || undefined}
            placeholder="Elige una columna numérica" onValueChange={onColumna}
            options={[
              ...(fuera ? [{ value: columna, label: `${columna} (no está en la base)` }] : []),
              ...candidatas.map((v) => ({ value: v.name, label: v.name })),
            ]} />
        </span>
      )}
      {origen === "columna" && !candidatas.length && (
        <p className="pond-copy">Esta base no tiene columnas numéricas.</p>
      )}
    </div>
  );
}
