// El contenido del hueco 16:9 de una tarjeta del selector (detalle y «Comparar»): la miniatura real con los datos del
// estudio si llegó (useMiniaturasSelector) y, si no, el glifo o la composición de siempre. La caja la pone quien lo
// usa; su tamaño no depende de que haya imagen (C2). Sin imagen y con un motivo (error del dibujo, imagen sin gráfico o
// lámina incompleta: «Sin vista previa: falta elegir preguntas»), el glifo lleva debajo una línea visible con él (R5-1);
// el `title` de la caja (`atributosHueco`) lo repite.

import type { ReactNode } from "react";
import type { MiniaturaSelector } from "./modeloMiniaturasSelector";
import "./huecoMiniatura.css";

type Props = {
  miniatura: MiniaturaSelector | undefined;
  nombre: string;
  /** Lo que se pinta sin imagen: el glifo del gráfico o la composición del tipo. */
  children: ReactNode;
};

export function HuecoMiniatura({ miniatura, nombre, children }: Props) {
  if (!miniatura?.src) {
    return (
      <>
        {children}
        {miniatura?.error ? <p className="pulso-f6-hueco-nota" data-hueco-nota="">{miniatura.error}</p> : null}
      </>
    );
  }
  return <img src={miniatura.src} alt={`Vista previa de “${nombre}” con los datos del estudio`} decoding="async" />;
}

/** Estado (`data-miniatura`, que el CSS lee) y `title` de la caja del hueco según su miniatura. */
export function atributosHueco(miniatura: MiniaturaSelector | undefined): {
  "data-miniatura": "imagen" | "error" | "glifo";
  title?: string;
} {
  if (miniatura?.src) return { "data-miniatura": "imagen" };
  if (miniatura?.error) return { "data-miniatura": "error", title: miniatura.error };
  return { "data-miniatura": "glifo" };
}
