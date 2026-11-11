// La pregunta de una fila de Aplicar: la ficha del kit con el color de su tipo.
// Un tipo que la ficha no conoce (una agrupación de categorías) va sin color:
// no se le atribuye un tipo que el plan no declara.

import { FichaPregunta, type TipoDePregunta } from "../../../components/procesamiento/FichaPregunta";

export function FichaDePlan({ tipo, codigo, etiqueta }: { tipo: TipoDePregunta | null; codigo: string; etiqueta: string }) {
  // Sin etiqueta en el formulario, el código hace de etiqueta y no se repite.
  const codigoAparte = etiqueta !== codigo ? codigo : undefined;
  if (tipo) return <FichaPregunta tipo={tipo} codigo={codigoAparte} etiqueta={etiqueta} />;
  return (
    <span className="pulso-aplicar-ficha-neutra">
      {codigoAparte ? <code>{codigoAparte}</code> : null}
      <span>{etiqueta}</span>
    </span>
  );
}
