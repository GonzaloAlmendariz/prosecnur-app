// Un campo de etiqueta que muestra el texto entero (H3 del QA de Datos): una
// etiqueta larga baja de línea dentro del campo en vez de cortarse contra el
// borde. Lleva el aspecto del campo del kit (`pulso-input`) y crece con su
// contenido; Enter no inserta saltos, porque una etiqueta es una sola línea.

import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

export type CampoDeEtiquetaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "rows" | "value" | "onChange"> & {
  value: string;
  onValor: (valor: string) => void;
  invalid?: boolean;
};

export function CampoDeEtiqueta({ value, onValor, invalid, className, onKeyDown, ...props }: CampoDeEtiquetaProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  // Alto al de su contenido. `field-sizing: content` lo hace solo en Chromium
  // reciente; esto cubre el resto y el primer pintado.
  useLayoutEffect(() => {
    const nodo = ref.current;
    if (!nodo) return;
    nodo.style.height = "auto";
    nodo.style.height = `${nodo.scrollHeight + nodo.offsetHeight - nodo.clientHeight}px`;
  }, [value]);
  return (
    <textarea
      {...props}
      ref={ref}
      rows={1}
      value={value}
      aria-invalid={invalid ? true : undefined}
      className={["pulso-input", "datos-campo-etiqueta", className].filter(Boolean).join(" ")}
      onChange={(e) => onValor(e.target.value.replace(/\r?\n/g, " "))}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.preventDefault();
        onKeyDown?.(e);
      }}
    />
  );
}
