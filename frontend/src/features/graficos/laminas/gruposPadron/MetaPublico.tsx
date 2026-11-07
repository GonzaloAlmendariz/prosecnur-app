// La meta de un público en la cobertura (ADR 0135 §6): un número con su unidad a la vista, porcentaje del padrón o
// casos. La unidad elegida sin número todavía no se puede guardar («Docentes: %» no es una meta), así que se recuerda
// aquí hasta que se escribe la cifra.

import { useId, useState } from "react";
import type { UnidadMeta } from "../../../../api/graficosPadron";
import { PulsoInput } from "../../../../components/PulsoInput";
import { Segmentado } from "../../subpestanas/Segmentado";
import { numeroDeMeta, type Meta } from "./modeloPadron";

type Props = {
  nombre: string;
  meta: Meta | null;
  onCambio: (m: Meta | null) => void;
};

const UNIDADES: readonly { clave: UnidadMeta; rotulo: string }[] = [
  { clave: "porcentaje", rotulo: "% del padrón" },
  { clave: "casos", rotulo: "Casos" },
];

export function MetaPublico({ nombre, meta, onCambio }: Props) {
  const id = useId();
  const [unidadSinCifra, setUnidadSinCifra] = useState<UnidadMeta>("porcentaje");
  const unidad = meta?.unidad ?? unidadSinCifra;
  return (
    <div className="pulso-f6-padron pulso-f6-meta">
      <label className="pulso-f6-padron-rotulo" htmlFor={id}>Meta</label>
      <PulsoInput id={id} size="sm" numeric inputMode="decimal" autoComplete="off" aria-label={`Meta de ${nombre}`}
        value={meta === null ? "" : String(meta.valor)} placeholder="Sin meta"
        onChange={(e) => {
          const valor = numeroDeMeta(e.target.value);
          onCambio(valor === null ? null : { valor, unidad });
        }} />
      <Segmentado etiqueta={`Unidad de la meta de ${nombre}`} opciones={UNIDADES} valor={unidad}
        onCambiar={(u) => { setUnidadSinCifra(u); if (meta) onCambio({ valor: meta.valor, unidad: u }); }} />
    </div>
  );
}
