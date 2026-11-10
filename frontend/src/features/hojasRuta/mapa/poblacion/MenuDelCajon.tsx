import { useState, type ReactNode } from "react";
import { Popover } from "../../../../components/Popover";
import { PulsoButton } from "../../../../components/PulsoButton";
import { Check, ChevronDown } from "../../../../vendor/lucide-react";
import "./menuDelCajon.css";

/**
 * Menú plegado del cajón de Población. A 1024 los tres renglones de controles
 * (dos lecturas, cuatro agrupaciones, Excel, CSV y cerrar) dejaban una sola fila
 * a la tabla; la agrupación y las descargas se pliegan aquí y el botón dice lo
 * que está elegido. Reusa el `Popover` de la casa.
 */

export type OpcionDelMenu = {
  id: string;
  rotulo: ReactNode;
  /** Marca la opción vigente (agrupación); sin él, es una acción. */
  elegida?: boolean;
  deshabilitada?: boolean;
  alElegir: () => void;
};

export function MenuDelCajon({ rotulo, icono, aria, opciones, deshabilitado = false }: {
  rotulo: ReactNode;
  icono?: ReactNode;
  aria: string;
  opciones: readonly OpcionDelMenu[];
  /** El disparador mismo se deshabilita (una descarga en curso): sólo eso, sin cambiar su rótulo. */
  deshabilitado?: boolean;
}) {
  // Cada elección cierra el menú: el que lo abrió ya obtuvo lo que pidió.
  const [elecciones, setElecciones] = useState(0);
  const conMarca = opciones.some((o) => o.elegida !== undefined);
  return (
    <Popover
      side="bottom"
      align="end"
      maxWidth={260}
      ariaLabel={aria}
      cerrarAlCambiar={elecciones}
      trigger={
        <PulsoButton variant="secondary" size="sm" className="hr-cajon-menu-boton" disabled={deshabilitado} data-con-icono={icono ? "" : undefined} aria-label={typeof rotulo === "string" ? `${aria}: ${rotulo}` : aria} title={aria}>
          {icono}
          <span className="hr-cajon-menu-rotulo">{rotulo}</span>
          <ChevronDown size={14} aria-hidden />
        </PulsoButton>
      }
    >
      <ul className="hr-cajon-menu" role={conMarca ? "group" : undefined} aria-label={aria}>
        {opciones.map((o) => (
          <li key={o.id}>
            <button
              type="button"
              className="hr-cajon-menu-item"
              aria-pressed={o.elegida}
              disabled={o.deshabilitada}
              onClick={() => {
                o.alElegir();
                setElecciones((n) => n + 1);
              }}
            >
              {conMarca ? <Check size={14} aria-hidden className="hr-cajon-menu-marca" /> : null}
              <span>{o.rotulo}</span>
            </button>
          </li>
        ))}
      </ul>
    </Popover>
  );
}
