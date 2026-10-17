import type { ReactNode } from "react";
import type { Glifo } from "./glifosTipo";
import "./sello.css";

// Pinta las formas de un glifo (rejilla de 24). Las clases g-* las colorea sello.css: el trazo y el acento van en
// `currentColor` y lo que «tapa» en `--xfk-occ`, el fondo sobre el que se dibuja.

export function FormasGlifo({ formas }: { formas: Glifo }): ReactNode {
  return formas.map((f, i) => {
    const className = f.c ? `g-${f.c}` : undefined;
    switch (f.e) {
      case "path":
        return <path key={i} {...f.a} className={className} />;
      case "circle":
        return <circle key={i} {...f.a} className={className} />;
      case "rect":
        return <rect key={i} {...f.a} className={className} />;
      case "text":
        return <text key={i} {...f.a} className={className}>{f.texto}</text>;
      case "g":
        return <g key={i} {...f.a} className={className}>{f.h ? <FormasGlifo formas={f.h} /> : null}</g>;
      default:
        return null;
    }
  });
}
