// Un índice o un bloque en la lista de la izquierda: nombre, puntaje medio del
// motor, de qué se compone y la barra de 0 a 100.

import { formatoConteoDe, formatoDecimal } from "../../../lib/formatoNumero";
import { preguntasDeLaEntrada, type EntradaDeDimension } from "./modeloDeDimensiones";

export function FilaDeIndice({ entrada, elegida, onElegir }: {
  entrada: EntradaDeDimension;
  elegida: boolean;
  onElegir: (columna: string) => void;
}) {
  const media = entrada.cobertura?.media ?? null;
  const preguntas = formatoConteoDe(preguntasDeLaEntrada(entrada).length, "pregunta", "preguntas");
  const detalle = entrada.tipo === "indice"
    ? `${formatoConteoDe(entrada.bloques.length, "bloque", "bloques")}, ${preguntas}`
    : preguntas;
  return (
    <li>
      <button
        type="button"
        className="dimensiones-indice"
        aria-current={elegida ? "true" : undefined}
        onClick={() => onElegir(entrada.columna)}
      >
        <span className="dimensiones-indice-linea">
          <b>{entrada.etiqueta}</b>
          <em>{media === null ? "Sin puntaje" : formatoDecimal(media, 1)}</em>
        </span>
        <span className="dimensiones-indice-detalle">{detalle}</span>
        <span className="dimensiones-barra" aria-hidden="true">
          <i style={{ inlineSize: `${Math.max(0, Math.min(100, media ?? 0))}%` }} />
        </span>
      </button>
    </li>
  );
}
