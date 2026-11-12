import { GlidingRadioGroup } from "../../../../components/GlidingRadioGroup";
import type { LecturaDeDistribucion } from "./lecturaDeDistribucion";

const VALORES: readonly { valor: LecturaDeDistribucion["valor"]; etiqueta: string }[] = [
  { valor: "porcentaje", etiqueta: "Porcentaje" },
  { valor: "casos", etiqueta: "Casos" },
];

const VISTAS: readonly { valor: LecturaDeDistribucion["vista"]; etiqueta: string }[] = [
  { valor: "grafico", etiqueta: "Gráfico" },
  { valor: "tabla", etiqueta: "Tabla" },
];

/** "Porcentaje / Casos" y "Gráfico / Tabla", a la derecha de la barra de lectura. */
export default function ConmutadoresDeLectura({
  lectura,
  onCambio,
}: {
  lectura: LecturaDeDistribucion;
  onCambio: (lectura: LecturaDeDistribucion) => void;
}) {
  return (
    <>
      <GlidingRadioGroup
        value={lectura.valor}
        options={VALORES}
        getOptionValue={(o) => o.valor}
        onValueChange={(valor) => onCambio({ ...lectura, valor })}
        className="vx-seg"
        aria-label="Cifra de la distribución"
      >
        {(o) => <span>{o.etiqueta}</span>}
      </GlidingRadioGroup>
      <GlidingRadioGroup
        value={lectura.vista}
        options={VISTAS}
        getOptionValue={(o) => o.valor}
        onValueChange={(vista) => onCambio({ ...lectura, vista })}
        className="vx-seg"
        aria-label="Forma de la distribución"
      >
        {(o) => <span>{o.etiqueta}</span>}
      </GlidingRadioGroup>
    </>
  );
}
