/**
 * Marco de un gráfico de ritmo con los ejes fuera del scroll.
 *
 * Tres columnas: eje de valores, área desplazable, eje de acumulado. El gráfico
 * vive SOLO en la del medio, así que al desplazar el campo los dos ejes se
 * quedan donde están —no hay superposición ni capas que tapar: simplemente no
 * están dentro de lo que se mueve—.
 *
 * Se desplaza con la caja y no con el `dragmode` de Plotly a propósito: el
 * scroll del contenedor responde al gesto de dos dedos del trackpad y no deja
 * salirse del contenido, mientras que el pan de Plotly ignoraba el trackpad y
 * permitía arrastrar el gráfico indefinidamente hacia el vacío.
 *
 * Las marcas las calcula `marcasDeEje` a partir de la misma geometría que usa
 * Plotly (alto y márgenes), no se le preguntan a la librería: preguntárselas
 * obligaría a esperar a que pinte y a re-leerlas en cada relayout.
 */

import type { ReactNode } from "react";

import { marcasDeEje } from "./marcasDeEje";

import "./marcoDeRitmo.css";

export type EjeDeRitmo = {
  titulo?: string;
  maximo: number;
  formatear?: (valor: number) => string;
};

export function MarcoDeRitmo({
  alto,
  margenSuperior,
  margenInferior,
  ejeIzquierdo,
  ejeDerecho,
  anchoMinimoContenido,
  children,
}: {
  alto: number;
  margenSuperior: number;
  margenInferior: number;
  ejeIzquierdo: EjeDeRitmo;
  ejeDerecho?: EjeDeRitmo;
  /** Ancho del gráfico; si supera la caja, la columna central se desplaza. */
  anchoMinimoContenido: number;
  children: ReactNode;
}) {
  const izquierdas = marcasDeEje(ejeIzquierdo.maximo, alto, margenSuperior, margenInferior, ejeIzquierdo.formatear);
  const derechas = ejeDerecho
    ? marcasDeEje(ejeDerecho.maximo, alto, margenSuperior, margenInferior, ejeDerecho.formatear)
    : [];

  return (
    <div className="mon-ritmo-marco" style={{ height: alto }}>
      <div className="mon-ritmo-eje is-izquierdo" aria-hidden="true">
        {ejeIzquierdo.titulo ? <span className="mon-ritmo-eje-titulo">{ejeIzquierdo.titulo}</span> : null}
        {izquierdas.map((marca) => (
          <b key={marca.valor} style={{ top: marca.y }}>{marca.etiqueta}</b>
        ))}
      </div>

      <div className="mon-ritmo-scroll">
        <div className="mon-ritmo-lienzo" style={{ minWidth: anchoMinimoContenido }}>
          {children}
        </div>
      </div>

      {ejeDerecho ? (
        <div className="mon-ritmo-eje is-derecho" aria-hidden="true">
          {ejeDerecho.titulo ? <span className="mon-ritmo-eje-titulo">{ejeDerecho.titulo}</span> : null}
          {derechas.map((marca) => (
            <b key={marca.valor} style={{ top: marca.y }}>{marca.etiqueta}</b>
          ))}
        </div>
      ) : null}
    </div>
  );
}
