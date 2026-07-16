/**
 * Stepper de cantidad (Anexo A.3): botones −/+ alrededor de un número que, al
 * cambiar, hace un pop (scale 1.3 al 40% del keyframe → asienta con la curva
 * productiva tokenizada). El botón presionado se hunde (scale 0.9) en :active y los
 * dígitos usan tabular-nums para no bailar de ancho. Controlado: el padre posee
 * el valor y persiste el cambio.
 */
import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";

export function Stepper({
  value,
  min = 0,
  max = 2,
  onChange,
  ariaLabel,
  disabled,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  ariaLabel: string;
  disabled?: boolean;
}) {
  const [pop, setPop] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    if (value !== prev.current) {
      setPop(true);
      prev.current = value;
    }
  }, [value]);

  const clamp = (next: number) => Math.max(min, Math.min(max, next));

  return (
    <div className="cmv2-stepper" role="group" aria-label={ariaLabel}>
      <button
        type="button"
        className="cmv2-stepper-btn"
        aria-label="Quitar uno"
        disabled={disabled || value <= min}
        onClick={() => onChange(clamp(value - 1))}
      >
        <Minus size={13} aria-hidden="true" />
      </button>
      <output
        className="cmv2-stepper-valor"
        data-pop={pop || undefined}
        onAnimationEnd={() => setPop(false)}
      >
        {value}
      </output>
      <button
        type="button"
        className="cmv2-stepper-btn"
        aria-label="Añadir uno"
        disabled={disabled || value >= max}
        onClick={() => onChange(clamp(value + 1))}
      >
        <Plus size={13} aria-hidden="true" />
      </button>
    </div>
  );
}
