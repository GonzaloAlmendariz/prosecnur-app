import { useEffect, useRef } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

// Componente para renderizar LaTeX con KaTeX.
// Modos:
//   - inline (default): se mezcla en el flujo de texto
//   - display (block): centrado en su propio bloque, tamaño mayor
//
// Falla gracefully a texto plano si la fórmula no parsea (no rompe la UI).

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
      className={`enc-math ${display ? "enc-math--display" : ""} ${className ?? ""}`}
    />
  );
}
