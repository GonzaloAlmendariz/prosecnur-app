import { useId } from "react";

import type { MailFeatureBlock, MailTheme } from "../../../api/materialMail";
import { Cuentagotas } from "./Cuentagotas";
import { hexCanonico } from "./modeloEstilo";
import "./correosPiezas.css";

type Props = {
  block: MailFeatureBlock;
  theme: MailTheme;
  /** `null` vuelve al botón del tema. */
  onColor: (color: string | null) => void;
};

/**
 * El color del botón de un Destacado: el mismo camino que el color de una pieza
 * (selector, cuentagotas, `#rrggbb`). La letra no se elige: el render toma la
 * de más contraste entre blanco y el grafito de la casa.
 */
export function ColorDelBoton({ block, theme, onColor }: Props) {
  const id = useId();
  const color = block.button_color ?? theme.accent;
  return (
    <div className="rec-mail-ajuste rec-pieza-color">
      <span id={`${id}-rotulo`}>Color del botón</span>
      <span className="rec-mail-acento">
        <input
          type="color"
          aria-labelledby={`${id}-rotulo`}
          title="Elegir el color del botón"
          value={color}
          onChange={(e) => onColor(e.target.value.toLowerCase())}
        />
        <Cuentagotas nombre="el color del botón" onChange={(c) => onColor(c.toLowerCase())} />
        <span className="xfk-mono">{hexCanonico(color)}</span>
      </span>
      <span className="rec-pieza-color-pie">
        {block.button_color ? (
          <button type="button" className="rec-mail-link" onClick={() => onColor(null)}>
            Usar el del correo ({hexCanonico(theme.accent)})
          </button>
        ) : (
          <span className="rec-capa-img-ayuda">Sigue el color del correo mientras no elijas otro.</span>
        )}
      </span>
    </div>
  );
}
