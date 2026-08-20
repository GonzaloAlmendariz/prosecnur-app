import type { ReactNode } from "react";

import type { FocoDeCuota } from "./AulasCuotasResumen";

/**
 * El nombre de una facultad en una lista, que además **pone el foco**.
 *
 * `foco` viaja en la URL y cruza toda la sección, pero sólo se podía ELEGIR en
 * un sitio: la pirámide de cuota, en su propia pestaña. Quien estaba mirando
 * «A quién hay que agendar» y quería seguir a Derecho tenía que irse a Cuotas,
 * pulsar su fila y volver. Un foco que se ve en cinco listas y se pone en una
 * es media función.
 *
 * Se envuelve **sólo el nombre** y no la fila entera: la fila es una rejilla con
 * cifras alineadas y convertirla en botón obligaría a rehacer las cinco
 * maquetaciones. El nombre es además la identidad de la fila, que es lo que se
 * pulsa cuando uno quiere «ver esta».
 *
 * Sin `onFoco` se comporta exactamente como el `span` que había: las listas que
 * no participan del foco no cambian.
 */
export function NombreDeFacultad({ facultad, className, enFoco, onFoco, children }: {
  facultad: string;
  /** La clase de la celda, que conserva la maquetación de esa lista. */
  className: string;
  enFoco: boolean;
  /** Sin esto, no hay botón: sólo texto. */
  onFoco?: (foco: FocoDeCuota) => void;
  /** El contenido de la celda cuando lleva más que el nombre. */
  children?: ReactNode;
}) {
  const contenido = children ?? facultad;
  if (!onFoco) {
    return <span className={className} title={facultad}>{contenido}</span>;
  }
  return (
    <button
      type="button"
      className={`${className} aulas-foco-boton`}
      // `aria-pressed` y no `aria-selected`: es un interruptor —se pulsa otra vez
      // y se suelta el foco—, no una opción dentro de un conjunto.
      aria-pressed={enFoco}
      title={enFoco ? `Dejar de seguir ${facultad}` : `Seguir ${facultad} en toda la sección`}
      onClick={() => onFoco(enFoco ? null : { tipo: "facultad", valor: facultad })}
    >
      {contenido}
    </button>
  );
}
