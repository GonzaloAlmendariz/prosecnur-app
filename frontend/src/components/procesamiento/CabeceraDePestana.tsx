// La cabecera de una pestaña de Procesamiento como contenedor (ADR 0142, plan de
// fidelidad de Validación, V0; `tabHeading` del prototipo): la tesela con el
// ícono de la pestaña, el antetítulo del módulo, el título, el estado dicho en
// palabra al lado, la tira de cifras y las acciones al extremo derecho.
//
// Se monta sobre el TabHeading del kit, que pone la tesela, el antetítulo y el
// `h2`; el estado, las cifras y las acciones van en su control. La hoja
// reacomoda esas piezas en una rejilla (`display: contents` en la copia y en el
// control) para que el estado quede en la línea del título sin un segundo
// marcado de cabecera. El `h2` es solo el nombre de la pestaña: el estado va
// fuera, como en TabHeading.
//
// El marco no deriva de los datos (C2): mide lo mismo con cero, dos o cuatro
// cifras. Las que no caben se recogen a un menú (`CifrasDePestana`).

import { useLayoutEffect, useState, type ReactNode } from "react";

import { Panel } from "../Panel";
import { TabHeading, densidadPorAncho, type TabHeadingDensidad } from "../TabHeading";
import type { LucideIcon } from "../../vendor/lucide-react";
import { CifrasDePestana, type CifraDePestana } from "./CifrasDePestana";
import "./mesa-procesamiento.css";

/**
 * El tono del punto del estado. `neutro` es un estado sin juicio ("Sin
 * auditar" antes de tener reglas); `listo`, conforme; `parcial` y `atencion`,
 * algo por hacer; `bloqueado`, no se puede seguir.
 */
export type TonoDeEstadoDePestana = "listo" | "parcial" | "atencion" | "bloqueado" | "neutro";

export type EstadoDePestana = {
  tono: TonoDeEstadoDePestana;
  /** En palabra: "Por decidir", "Cerrada el 6 nov", "Sin auditar". */
  texto: string;
};

export type CabeceraDePestanaProps = {
  /** La sección del módulo a la que pertenece la pestaña: "Validación". */
  seccion: string;
  titulo: string;
  /** El mismo ícono que la pestaña activa del riel. */
  icono: LucideIcon;
  estado?: EstadoDePestana | null;
  cifras?: readonly CifraDePestana[];
  /** Nombre del grupo de cifras; por defecto "Cifras de <título>". */
  ariaCifras?: string;
  /** El hueco declarado de las cifras que faltan, con su causa. Ver `CifrasDePestana`. */
  cifrasPendientes?: string;
  /** Botones de la pestaña: la acción principal y, si hay, la secundaria. */
  acciones?: ReactNode;
  /** Solo para el QA o un anclaje de layout. */
  className?: string;
};

/** El ancho de la cabecera manda cuántas cifras quedan sueltas. Sin medida (servidor, prueba) es `normal`. */
function useDensidad(conAcciones: boolean): [(nodo: HTMLDivElement | null) => void, TabHeadingDensidad] {
  const [nodo, setNodo] = useState<HTMLDivElement | null>(null);
  const [densidad, setDensidad] = useState<TabHeadingDensidad>("normal");
  useLayoutEffect(() => {
    if (!nodo || typeof ResizeObserver === "undefined") return undefined;
    const medir = () => {
      const ancho = nodo.getBoundingClientRect().width;
      if (ancho > 0) setDensidad(densidadPorAncho(ancho, conAcciones));
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(nodo);
    return () => observador.disconnect();
  }, [nodo, conAcciones]);
  return [setNodo, densidad];
}

export function CabeceraDePestana({
  seccion,
  titulo,
  icono,
  estado,
  cifras = [],
  ariaCifras,
  cifrasPendientes,
  acciones,
  className,
}: CabeceraDePestanaProps) {
  const conAcciones = acciones !== undefined && acciones !== null && acciones !== false;
  const [medir, densidad] = useDensidad(conAcciones);

  return (
    <div ref={medir} className={["pulso-cabecera-pestana", className].filter(Boolean).join(" ")}>
      <Panel noPadding className="pulso-cabecera-pestana-panel">
        <TabHeading
          eyebrow={seccion}
          titulo={titulo}
          icono={icono}
          densidad="normal"
          control={(
            <div className="pulso-cabecera-pestana-control">
              {estado ? (
                <span className="pulso-cabecera-pestana-estado" data-tono={estado.tono}>
                  {estado.texto}
                </span>
              ) : null}
              <CifrasDePestana
                cifras={cifras}
                ariaLabel={ariaCifras ?? `Cifras de ${titulo}`}
                densidad={densidad}
                pendientes={cifrasPendientes}
              />
              {conAcciones ? <div className="pulso-cabecera-pestana-acciones">{acciones}</div> : null}
            </div>
          )}
        />
      </Panel>
    </div>
  );
}
