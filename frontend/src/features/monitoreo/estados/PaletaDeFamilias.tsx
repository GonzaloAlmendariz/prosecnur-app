// Editor del color de cada familia de llamada.
//
// No es una leyenda: cada color se cambia y lo guarda la declaración de
// estados. Lo montan el definidor común (Acreditación) e Insumos › Estados de
// Telefónico; antes cada uno tenía su copia con el `input type="color"` nativo
// a la vista, que se pintaba como un cuadrado dentro de otra caja.
//
// Cada familia es una fila: muestra redonda, rótulo y un lápiz que aparece al
// pasar el mouse. El input nativo cubre la fila entera con opacidad cero, así
// que el clic en cualquier punto abre el selector anclado a la fila, y el
// control accesible sigue siendo el input con su `aria-label`.

import type { CSSProperties } from "react";
import { Pencil } from "../../../vendor/lucide-react";
import { ACREDITACION_ORDEN_FAMILIAS, acreditacionEtiquetaDeFamilia } from "./familiasDeLlamada";
import type { AcreditacionFamiliaLlamada } from "./familiasDeLlamada";
import "./paletaDeFamilias.css";

export function PaletaDeFamilias({
  colorDe,
  colorear,
  className,
}: {
  colorDe: (familia: AcreditacionFamiliaLlamada) => string;
  colorear: (familia: AcreditacionFamiliaLlamada, color: string) => void;
  className?: string;
}) {
  return (
    <div className={`mon-paleta-marco${className ? ` ${className}` : ""}`}>
    <ul className="mon-paleta">
      {ACREDITACION_ORDEN_FAMILIAS.map((familia) => {
        const color = colorDe(familia);
        const etiqueta = acreditacionEtiquetaDeFamilia(familia);
        return (
          <li key={familia}>
            <label className="mon-paleta-fila" style={{ "--mon-paleta-muestra": color } as CSSProperties}>
              <span className="mon-paleta-muestra" aria-hidden="true" />
              <span className="mon-paleta-rotulo">{etiqueta}</span>
              <Pencil size={12} className="mon-paleta-lapiz" aria-hidden="true" />
              <input
                type="color"
                value={color}
                onChange={(event) => {
                  // El valor se lee aquí y no dentro de un updater: para
                  // entonces React ya soltó el evento y `currentTarget` es null.
                  const elegido = event.currentTarget.value;
                  colorear(familia, elegido);
                }}
                aria-label={`Color de ${etiqueta}`}
              />
            </label>
          </li>
        );
      })}
    </ul>
    </div>
  );
}
