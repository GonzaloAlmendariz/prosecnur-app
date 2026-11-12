// Una pregunta que se aplica: su ficha, el campo que agrega a la base y sus
// cifras (códigos y respuestas con código). Cada celda se lee sola, sin cabecera
// de columnas; lo que el plan no trae no se pinta.
//
// Es una opción de la lista: se elige con clic o con las flechas, y la elegida
// es la que muestra su desglose por código en el panel de detalle.

import type { KeyboardEvent } from "react";

import { FichaDePlan } from "./FichaDePlan";
import { rotuloDeCampo, type FilaDeAplicar } from "./modeloAplicar";
import type { EstadoDeFila } from "./gruposDeAplicar";
import { NombreDeCampo } from "./NombreDeCampo";

type Props = {
  fila: FilaDeAplicar;
  elegida: boolean;
  onElegir: () => void;
  onTecla: (evento: KeyboardEvent<HTMLLIElement>) => void;
  /** "Lista" o "Faltan N", si se sabe el avance de la pregunta. */
  estado?: EstadoDeFila | null;
};

export function FilaAplicar({ fila, elegida, onElegir, onTecla, estado = null }: Props) {
  return (
    <li
      className="pulso-aplicar-fila"
      role="option"
      aria-selected={elegida}
      // Una sola parada de tabulador en la lista: la fila elegida. Las demás se alcanzan con las flechas.
      tabIndex={elegida ? 0 : -1}
      onClick={onElegir}
      onKeyDown={onTecla}
    >
      <div className="pulso-aplicar-celda pulso-aplicar-celda--pregunta">
        <FichaDePlan tipo={fila.tipo} codigo={fila.codigo} etiqueta={fila.etiqueta} />
        {fila.tipoEnPalabras ? <span className="pulso-aplicar-tipo">{fila.tipoEnPalabras}</span> : null}
      </div>
      <div className="pulso-aplicar-celda pulso-aplicar-celda--campo">
        {fila.campo ? (
          <>
            <span className="pulso-aplicar-rotulo">{rotuloDeCampo(fila.variosCampos)}</span>
            <NombreDeCampo className="pulso-aplicar-campo" nombre={fila.campo} titulo={fila.campoTitulo} />
          </>
        ) : null}
      </div>
      <div className="pulso-aplicar-celda pulso-aplicar-celda--cifras">
        {fila.codigos ? <span className="pulso-aplicar-codigos-de-fila">{fila.codigos}</span> : null}
        {fila.respuestas ? <span className="pulso-aplicar-respuestas-de-fila">{fila.respuestas}</span> : null}
        {estado ? (
          <span className="pulso-aplicar-estado" data-tono={estado.tono}>
            {estado.texto}
          </span>
        ) : null}
      </div>
    </li>
  );
}
