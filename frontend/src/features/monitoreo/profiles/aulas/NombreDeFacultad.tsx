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
export function NombreDeFacultad({ facultad, className, enFoco, onFoco, rol, children, ejeClave = "facultad" }: {
  facultad: string;
  /** La clase de la celda, que conserva la maquetación de esa lista. */
  className: string;
  enFoco: boolean;
  /** Sin esto, no hay botón: sólo texto. */
  onFoco?: (foco: FocoDeCuota) => void;
  /**
   * La clave del eje de cuotas del estudio (`avance_cuota.eje.clave`).
   *
   * El foco se ESCRIBE con ella y no con un literal: HSVG sigue poniendo
   * `facultad:` en sus enlaces byte a byte y un estudio por nivel pone `nivel:`.
   * Por defecto `facultad`, que es lo que era.
   */
  ejeClave?: string;
  /**
   * El rol ARIA de la celda cuando su lista declara semántica de tabla
   * (`rowheader`). Sin esto la fila no tiene quién la identifique y el lector
   * de pantalla lee cinco cifras sin saber de qué facultad son.
   *
   * **Coste declarado**: sobre el botón, `rowheader` sustituye al rol `button`,
   * así que algunos lectores dejan de anunciarlo como pulsable. Se acepta
   * porque identificar la fila es lo que hace legible la tabla entera, y el
   * botón conserva `aria-pressed` y su `title`, que dicen qué hace.
   */
  rol?: "rowheader" | "cell";
  /** El contenido de la celda cuando lleva más que el nombre. */
  children?: ReactNode;
}) {
  const contenido = children ?? facultad;
  if (!onFoco) {
    return <span className={className} role={rol} title={facultad}>{contenido}</span>;
  }
  return (
    <button
      type="button"
      role={rol}
      className={`${className} aulas-foco-boton`}
      // `aria-pressed` y no `aria-selected`: es un interruptor —se pulsa otra vez
      // y se suelta el foco—, no una opción dentro de un conjunto.
      aria-pressed={enFoco}
      title={enFoco ? `Dejar de seguir ${facultad}` : `Seguir ${facultad} en toda la sección`}
      onClick={() => onFoco(enFoco ? null : { tipo: ejeClave as NonNullable<FocoDeCuota>["tipo"], valor: facultad })}
    >
      {contenido}
    </button>
  );
}
