// Bloque de una pregunta (ADR 0142, etapa P3a): arriba, en un renglón, su código, su tipo en palabras y
// una cifra; debajo, la pregunta. Va teñido con el color de su tipo (tokens --tipo-* de app/tokens.css), suave.
// Es la forma grande de `FichaPregunta`: aquella va dentro de una frase; este hace de lado de una fila.
//
// Solo usa `span`, para poder ir dentro de un botón de fila.

import type { ReactNode } from "react";

import type { TipoDePregunta } from "./FichaPregunta";
import "./piezas-procesamiento.css";

const TIPO_EN_PALABRAS: Record<TipoDePregunta, string> = {
  unica: "Única",
  multiple: "Múltiple",
  numerica: "Numérica",
  texto: "Texto",
};

/** El tipo de pregunta dicho en palabras, como lo rotula el bloque. */
export function tipoEnPalabras(tipo: TipoDePregunta): string {
  return TIPO_EN_PALABRAS[tipo];
}

export type BloquePreguntaProps = {
  tipo: TipoDePregunta;
  /** El nombre de la variable en el formulario: "p4". */
  codigo?: string;
  /** La pregunta. Ocupa hasta dos líneas; el texto entero va en el `title`. */
  etiqueta: string;
  /** La cifra: "426 respuestas, 425 únicas". Comparte renglón con el código y el tipo. Sin dato no se pinta. */
  detalle?: ReactNode;
  /** `lado`: llena su celda. `completo`: además ocupa toda la fila de la rejilla que lo contiene. */
  ancho?: "lado" | "completo";
  className?: string;
};

export function BloquePregunta({ tipo, codigo, etiqueta, detalle, ancho = "lado", className }: BloquePreguntaProps) {
  return (
    <span
      className={["pulso-bloque-pregunta", className].filter(Boolean).join(" ")}
      data-tipo={tipo}
      data-ancho={ancho}
    >
      <span className="pulso-bloque-pregunta-cab">
        {codigo ? <code className="pulso-bloque-pregunta-codigo">{codigo}</code> : null}
        <span className="pulso-bloque-pregunta-tipo">{TIPO_EN_PALABRAS[tipo]}</span>
        {detalle === undefined || detalle === null || detalle === "" ? null : (
          <span className="pulso-bloque-pregunta-detalle">{detalle}</span>
        )}
      </span>
      <span className="pulso-bloque-pregunta-etiqueta" title={etiqueta}>
        {etiqueta}
      </span>
    </span>
  );
}
