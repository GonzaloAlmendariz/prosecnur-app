import { useEffect, useRef } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

// Renderizador de LaTeX con KaTeX.
//
// Vivía en `features/enciclopedia/shared/components/`, que es lo que lo volvió
// un problema: envoltorio de una librería de terceros —infraestructura, no
// dominio— enterrado dentro de una feature, y Cálculo de muestra importándolo
// a través de tres niveles de `../`. Al retirarse Enciclopedia habría caído con
// ella un componente del que depende otro módulo. Su sitio es el kit.
//
// Modos:
//   - inline (default): se mezcla en el flujo de texto
//   - display (block): centrado en su propio bloque, tamaño mayor
//
// Falla a texto plano si la fórmula no parsea, para no tumbar la vista por una
// expresión mal escrita.

type Props = {
  expression: string;          // string LaTeX (sin $ ni $$)
  display?: boolean;
  className?: string;
};

export function Math({ expression, display = false, className }: Props) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    try {
      katex.render(expression, ref.current, {
        displayMode: display,
        throwOnError: false,
        strict: "ignore",
        output: "html",
        trust: false,
      });
    } catch (err) {
      // Fallback: texto plano si algo sale mal
      if (ref.current) {
        ref.current.textContent = expression;
      }
      // eslint-disable-next-line no-console
      console.warn("KaTeX render error:", err);
    }
  }, [expression, display]);

  return (
    <span
      ref={ref}
      className={`pulso-math ${display ? "pulso-math--display" : ""} ${className ?? ""}`}
    />
  );
}
