// Tarjeta de una regla escrita como oración (ADR 0142, etapa P1). Arriba, una línea
// con el ícono, el nombre del tipo o la clase y, si hace falta, una acción al extremo;
// debajo, la frase: texto con FichaPregunta intercaladas. Dentro de la frase un valor
// va en <strong> y la palabra que decide en <em>.

import type { ReactNode } from "react";

import "./piezas-procesamiento.css";

export type FraseReglaProps = {
  /** Nombre del tipo de regla ("Condiciones combinadas") o su clase y origen. */
  tipo: ReactNode;
  /** Ícono del tipo, de 14 o 15 px. Va en su caja con el acento del módulo. */
  icono?: ReactNode;
  /** Acción de la línea superior: "Cambiar", "Ver la regla". */
  accion?: ReactNode;
  tamano?: "normal" | "compacto";
  className?: string;
  /** La frase. */
  children: ReactNode;
};

export function FraseRegla({ tipo, icono, accion, tamano = "normal", className, children }: FraseReglaProps) {
  return (
    <div className={["pulso-frase-regla", className].filter(Boolean).join(" ")} data-tamano={tamano}>
      <div className="pulso-frase-regla-tipo">
        {icono ? (
          <span className="pulso-frase-regla-icono" aria-hidden="true">
            {icono}
          </span>
        ) : null}
        <span className="pulso-frase-regla-nombre">{tipo}</span>
        {accion ? <span className="pulso-frase-regla-accion">{accion}</span> : null}
      </div>
      <p className="pulso-frase-regla-frase">{children}</p>
    </div>
  );
}
