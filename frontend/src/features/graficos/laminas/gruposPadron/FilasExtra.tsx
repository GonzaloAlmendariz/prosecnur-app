// Filas extra de la cobertura (ADR 0135 §6): lo que va en la columna izquierda sin barra, como «34 egresados(as) en 4
// grupos focales». Cada fila con su cifra, su rótulo y su detalle; se agregan y se quitan. Se guardan como lista de
// `{cifra, rotulo, detalle}` (el motor descarta la que no tiene cifra).

import { useId } from "react";
import { Plus, X } from "../../../../vendor/lucide-react";
import { PulsoInput } from "../../../../components/PulsoInput";
import { AyudaGlobo } from "../AyudaGlobo";
import { conExtras, extrasDe, type FilaExtra } from "./modeloPadron";

type Props = {
  args: Readonly<Record<string, unknown>>;
  onCambio: (patch: Record<string, unknown>) => void;
};

const AYUDA = "Van en la columna izquierda, sin barra. Ej. 34, egresados(as), en 4 grupos focales.";

export function FilasExtra({ args, onCambio }: Props) {
  const id = useId();
  const filas = extrasDe(args);
  const cambiar = (i: number, campo: keyof FilaExtra, v: string) =>
    onCambio(conExtras(filas.map((f, j) => (j === i ? { ...f, [campo]: v } : f))));
  return (
    <div className="pulso-f6-extras" data-qa-geometry-group="graficos/f6-filas-extra" data-qa-geometry-contract="intrinsic">
      <span className="pulso-f6-dato-rotulo" id={`${id}-rotulo`}>
        Filas extra
        <AyudaGlobo rotulo="Filas extra" detalle={AYUDA} />
      </span>
      {filas.length > 0 && (
        <ul className="pulso-f6-extras-filas" aria-labelledby={`${id}-rotulo`}>
          {filas.map((f, i) => (
            <li key={i} className="pulso-f6-extras-fila" data-qa-geometry-member>
              <PulsoInput size="sm" numeric aria-label={`Cifra de la fila ${i + 1}`} placeholder="34" value={f.cifra}
                onChange={(e) => cambiar(i, "cifra", e.target.value)} />
              <PulsoInput size="sm" aria-label={`Rótulo de la fila ${i + 1}`} placeholder="egresados(as)" value={f.rotulo}
                onChange={(e) => cambiar(i, "rotulo", e.target.value)} />
              <button type="button" className="pulso-f6-icono-boton" aria-label={`Quitar la fila ${i + 1}`}
                onClick={() => onCambio(conExtras(filas.filter((_, j) => j !== i)))}>
                <X size={14} aria-hidden="true" />
              </button>
              <PulsoInput size="sm" className="pulso-f6-extras-detalle" aria-label={`Detalle de la fila ${i + 1}`}
                placeholder="en 4 grupos focales" value={f.detalle} onChange={(e) => cambiar(i, "detalle", e.target.value)} />
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="pulso-f6-boton pulso-f6-dato-accion"
        onClick={() => onCambio(conExtras([...filas, { cifra: "", rotulo: "", detalle: "" }]))}>
        <Plus size={14} aria-hidden="true" />
        Agregar fila
      </button>
    </div>
  );
}
