// Pinta un rótulo de formulario con su énfasis markdown como `em`/`strong`.
// La lógica de parseo vive en `enfasisTexto.ts`; aquí sólo hay render.

import { segmentosDeEnfasis } from "./enfasisTexto";

export function TextoConEnfasis({ texto }: { texto: string | null | undefined }) {
  return (
    <>
      {segmentosDeEnfasis(texto).map((s, i) =>
        s.enfasis === "fuerte" ? (
          <strong key={i}>{s.texto}</strong>
        ) : s.enfasis === "cursiva" ? (
          <em key={i}>{s.texto}</em>
        ) : (
          s.texto
        ),
      )}
    </>
  );
}
