import { useEffect, useRef, useState, type ReactNode } from "react";
import "./avisos.css";

type Lado = "derecha" | "izquierda" | "ambos";

/** Qué bordes esconden columnas, a partir de lo que el marco mide. */
export function ladoDelDesborde(scrollLeft: number, scrollWidth: number, clientWidth: number): Lado | null {
  const maximo = scrollWidth - clientWidth;
  if (maximo <= 2) return null;
  const izquierda = scrollLeft > 2;
  const derecha = scrollLeft < maximo - 2;
  if (izquierda && derecha) return "ambos";
  if (derecha) return "derecha";
  return izquierda ? "izquierda" : null;
}

/**
 * El marco de una tabla de la familia `acr-pub-tabla` (C4). La tabla cabe en
 * su tarjeta en los anchos de la matriz; si en un ancho menor no cabe, el
 * desplazamiento queda contenido en este marco y señalado: una sombra en el
 * borde que esconde columnas y el marco se vuelve una región enfocable que se
 * recorre con las flechas.
 */
export function MarcoDesplazable({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [lado, setLado] = useState<Lado | null>(null);
  useEffect(() => {
    const marco = ref.current;
    if (!marco) return undefined;
    const medir = () => setLado(ladoDelDesborde(marco.scrollLeft, marco.scrollWidth, marco.clientWidth));
    medir();
    const observador = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(medir);
    observador?.observe(marco);
    if (marco.firstElementChild) observador?.observe(marco.firstElementChild);
    marco.addEventListener("scroll", medir, { passive: true });
    return () => {
      observador?.disconnect();
      marco.removeEventListener("scroll", medir);
    };
  }, []);
  return (
    <div className="acr-desplazable" data-desborda={lado ?? undefined}>
      <div
        ref={ref}
        className="acr-pr-cola-marco"
        data-qa-geometry-capacity="owned"
        role={lado ? "region" : undefined}
        aria-label={lado ? `${etiqueta}: desplázate a los lados para ver todas las columnas` : undefined}
        tabIndex={lado ? 0 : undefined}
      >
        {children}
      </div>
    </div>
  );
}
