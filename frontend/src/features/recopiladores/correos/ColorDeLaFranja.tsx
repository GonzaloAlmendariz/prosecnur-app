// Color propio de la franja de logos oscura (GOAL editor profesional, L15): la
// franja de una institución no siempre es el acento del correo (Acreditación
// 2026: franja #022051, acento #004dac). Sin color propio, la franja es el acento.

import { useId } from "react";

import { AlertCircle, CheckCircle2 } from "../../../vendor/lucide-react";
import { Cuentagotas } from "./Cuentagotas";
import { contraste, hexCanonico } from "./modeloEstilo";
import "./correosPiezas.css";

type Props = {
  /** El color propio de la franja; `undefined` si sigue al acento. */
  color: string | undefined;
  acento: string;
  /** `null` vuelve al acento. */
  onColor: (color: string | null) => void;
};

/** Sobre la franja oscura van el texto alternativo y, si se eligen, los logos en blanco: el blanco tiene que leerse. */
export function lecturaDeLaFranja(color: string): { tono: "ok" | "warning"; frase: string } {
  const razon = contraste("#ffffff", color);
  if (razon !== null && razon < 3) {
    return { tono: "warning", frase: "Muy claro para una franja oscura: los logos en blanco no se verían. Elige uno más oscuro o el fondo Claro" };
  }
  return { tono: "ok", frase: "Los logos en blanco se leen sobre este color" };
}

export function ColorDeLaFranja({ color, acento, onColor }: Props) {
  const id = useId();
  const efectivo = color ?? acento;
  const lectura = lecturaDeLaFranja(efectivo);
  return (
    <div className="rec-mail-ajuste rec-pieza-color">
      <span id={`${id}-rotulo`}>Color de la franja</span>
      <span className="rec-mail-acento">
        <input
          type="color"
          aria-labelledby={`${id}-rotulo`}
          aria-invalid={lectura.tono === "warning" || undefined}
          aria-describedby={`${id}-lectura`}
          title="Elegir el color de la franja"
          value={efectivo}
          onChange={(e) => onColor(e.target.value)}
        />
        <Cuentagotas nombre="el color de la franja" onChange={(c) => onColor(c)} />
        <span className="xfk-mono">{hexCanonico(efectivo)}</span>
      </span>
      <span className="rec-pieza-color-pie">
        <span id={`${id}-lectura`} className={`rec-mail-estado-linea is-${lectura.tono}`} role="status">
          {lectura.tono === "ok" ? <CheckCircle2 size={13} aria-hidden /> : <AlertCircle size={13} aria-hidden />}
          {lectura.frase}
        </span>
        {color ? (
          <button type="button" className="rec-mail-link" onClick={() => onColor(null)}>
            Usar el acento ({hexCanonico(acento)})
          </button>
        ) : (
          <span className="rec-capa-img-ayuda">Sigue el acento del correo mientras no elijas otro.</span>
        )}
      </span>
    </div>
  );
}
