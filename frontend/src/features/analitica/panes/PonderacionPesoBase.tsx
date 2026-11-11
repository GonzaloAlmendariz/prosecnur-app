// Peso base que la calibración ajusta (ADR 0131 §6): ninguno (peso 1), una
// columna de la base (1/π por caso) o el reequilibrio por estrato. La tabla del
// estrato la monta el panel debajo cuando corresponde.

import type { VariableInstrumento } from "../../../api/client";
import { PulsoSelect } from "../../../components/PulsoSelect";
import { Segmentado, type OpcionDeSegmentado } from "../ponderacion/Segmentado";
import type { OrigenPesoBase } from "../ponderacionConfigModel";
import { columnasCandidatasAPeso } from "./PesoPorColumna";
import "./PonderacionControles.css";

const OPCIONES: OpcionDeSegmentado<OrigenPesoBase>[] = [
  { valor: "ninguno", rotulo: "Ninguno", ayuda: "Cada caso parte con peso 1." },
  { valor: "columna", rotulo: "Columna de la base", ayuda: "El peso de diseño de cada caso (1/π), por ejemplo el de la muestra de manzanas." },
  { valor: "estrato", rotulo: "Reequilibrio por estrato", ayuda: "Cuando la muestra se repartió distinto de la población (igual número de casos por distrito con distritos de tamaño distinto)." },
];

export function PonderacionPesoBase({ origen, columna, variables, variablesLeidas = true, onOrigen, onColumna }: {
  origen: OrigenPesoBase;
  columna: string;
  variables: readonly VariableInstrumento[];
  /** Falso mientras la lista de variables se lee o si su lectura falló: no se afirma que no hay columnas. */
  variablesLeidas?: boolean;
  onOrigen: (o: OrigenPesoBase) => void;
  onColumna: (c: string) => void;
}) {
  const candidatas = columnasCandidatasAPeso(variables);
  const fuera = !!columna && !candidatas.some((v) => v.name === columna);
  return (
    <div className="pond-card pond-peso-base">
      <div className="pond-ajuste">
        <span className="pond-ajuste-rotulo" id="pond-peso-base-rotulo">Peso base</span>
        <Segmentado etiquetadoPor="pond-peso-base-rotulo" valor={origen} opciones={OPCIONES} onCambio={onOrigen} />
      </div>
      {origen === "columna" && (candidatas.length > 0 || fuera) ? (
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
      ) : null}
      {origen === "columna" && variablesLeidas && !candidatas.length ? (
        <p className="pond-copy">Esta base no tiene columnas numéricas.</p>
      ) : null}
    </div>
  );
}
