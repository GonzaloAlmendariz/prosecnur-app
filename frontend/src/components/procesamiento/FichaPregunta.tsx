// Ficha en línea de una pregunta (ADR 0142, etapa P1): su código, si lo trae, y su
// etiqueta, teñidos con el color de su tipo (tokens --tipo-* de app/tokens.css). Va
// intercalada en una frase de regla, en una celda o en una lista.

import "./piezas-procesamiento.css";

export type TipoDePregunta = "unica" | "multiple" | "numerica" | "texto";

export type FichaPreguntaProps = {
  tipo: TipoDePregunta;
  etiqueta: string;
  /** El nombre de la variable en el formulario: "p4". */
  codigo?: string;
  className?: string;
};

export function FichaPregunta({ tipo, etiqueta, codigo, className }: FichaPreguntaProps) {
  return (
    <span className={["pulso-ficha-pregunta", className].filter(Boolean).join(" ")} data-tipo={tipo}>
      {codigo ? <code className="pulso-ficha-pregunta-codigo">{codigo}</code> : null}
      <span className="pulso-ficha-pregunta-etiqueta">{etiqueta}</span>
    </span>
  );
}
