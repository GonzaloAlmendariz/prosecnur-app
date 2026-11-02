import { fmtValor, posicion } from "./explorarModelo";

/** Una caja horizontal (min · p25 · mediana · p75 · max) sobre una escala dada. */
export default function CajaResumen({
  min,
  p25,
  mediana,
  p75,
  max,
  escala,
  etiqueta,
}: {
  min: number;
  p25: number;
  mediana: number;
  p75: number;
  max: number;
  escala: { min: number; max: number };
  etiqueta: string;
}) {
  const x = (v: number) => posicion(v, escala.min, escala.max);
  return (
    <div
      className="vx-caja"
      role="img"
      aria-label={`${etiqueta}: mínimo ${fmtValor(min)}, p25 ${fmtValor(p25)}, mediana ${fmtValor(mediana)}, p75 ${fmtValor(p75)}, máximo ${fmtValor(max)}`}
    >
      <span className="vx-caja-bigote" style={{ left: `${x(min)}%`, width: `${Math.max(0, x(max) - x(min))}%` }} />
      <span className="vx-caja-cuerpo" style={{ left: `${x(p25)}%`, width: `${Math.max(0, x(p75) - x(p25))}%` }} />
      <span className="vx-caja-mediana" style={{ left: `${x(mediana)}%` }} />
    </div>
  );
}
