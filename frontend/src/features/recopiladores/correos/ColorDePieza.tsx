import { useId } from "react";

import type { MailBandBlock, MailCheck, MailOrnamentBlock, MailTheme } from "../../../api/materialMail";
import { AlertCircle, CheckCircle2 } from "../../../vendor/lucide-react";
import { Cuentagotas } from "./Cuentagotas";
import { hexCanonico } from "./modeloEstilo";
import { colorDePieza, colorPorDefecto, fondoDeLasPiezas, lecturaDePieza } from "./piezasGraficas";
import "./correosPiezas.css";

type Props = {
  block: MailBandBlock | MailOrnamentBlock;
  theme: MailTheme;
  /** `piezas_contrast` de la revisión si nombra este bloque: manda sobre el cálculo local. */
  chequeo: MailCheck | null;
  /** `null` vuelve al color de la casa (el acento o el relleno del botón). */
  onColor: (color: string | null) => void;
};

/** `data-foco` del color de una pieza: a él lleva «Ir al bloque» desde la Revisión. */
export const FOCO_COLOR_DE_PIEZA = "pieza-color";

/**
 * El color de una banda o de un separador: el mismo camino que los colores de
 * Identidad (selector, cuentagotas, `#rrggbb`) y, debajo, si se distingue del
 * fondo en que va —la tarjeta blanca en Sobrio, el fondo de la página en Campaña—.
 */
export function ColorDePieza({ block, theme, chequeo, onColor }: Props) {
  const id = useId();
  const color = colorDePieza(block, theme);
  const propio = Boolean(block.color);
  const local = lecturaDePieza(color, fondoDeLasPiezas(theme));
  const tono = chequeo && chequeo.status !== "ok" ? "warning" : local.tono;
  const frase = tono === local.tono ? local.frase : "Casi no se distingue del fondo: elige un color que resalte";
  return (
    <div className="rec-mail-ajuste rec-pieza-color">
      <span id={`${id}-rotulo`}>Color</span>
      <span className="rec-mail-acento">
        <input
          type="color"
          data-foco={FOCO_COLOR_DE_PIEZA}
          aria-labelledby={`${id}-rotulo`}
          aria-invalid={tono === "warning" || undefined}
          aria-describedby={`${id}-lectura`}
          title="Elegir el color"
          value={color}
          onChange={(e) => onColor(e.target.value)}
        />
        <Cuentagotas nombre="el color de la pieza" onChange={(c) => onColor(c)} />
        <span className="xfk-mono">{hexCanonico(color)}</span>
      </span>
      <span className="rec-pieza-color-pie">
        <span
          id={`${id}-lectura`}
          className={`rec-mail-estado-linea is-${tono}`}
          role="status"
          title={local.razon !== null ? `Contraste ${local.razon.toFixed(1)}:1` : undefined}
        >
          {tono === "ok" ? <CheckCircle2 size={13} aria-hidden /> : <AlertCircle size={13} aria-hidden />}
          {frase}
        </span>
        {propio ? (
          <button type="button" className="rec-mail-link" onClick={() => onColor(null)}>
            Usar el de la casa ({hexCanonico(colorPorDefecto(theme))})
          </button>
        ) : (
          <span className="rec-capa-img-ayuda">Sigue el color de Identidad mientras no elijas otro.</span>
        )}
      </span>
    </div>
  );
}
