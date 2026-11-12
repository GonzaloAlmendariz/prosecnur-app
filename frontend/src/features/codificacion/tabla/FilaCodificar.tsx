import { memo, type ReactNode } from "react";
import { formatoConteo } from "../../../lib/formatoNumero";
import { InsigniaCodigo } from "./InsigniaCodigo";
import type { FilaTabla } from "./tablaCodificarModelo";
import "./tablaCodificar.css";

export type FilaCodificarProps = {
  fila: FilaTabla;
  /** Posición entre todo lo que pinta la tabla (filas y separador), contando desde cero. */
  indice: number;
  activa: boolean;
  /** Con casillas: si la fila está elegida. Sin casillas, `undefined`. */
  elegida?: boolean;
  onElegir?: () => void;
  /** El campo donde se escribe el código; solo lo recibe la fila activa. */
  campo?: ReactNode;
  /** La propuesta de código para una fila sin código ("Aceptar"), como en tarjetas. */
  sugerencia?: ReactNode;
  onActivar: (clave: string) => void;
  onQuitar: (clave: string, grupoId: string) => void;
  /** Recibe el elemento de la fila: lo usan la medición de la lista virtual y el desplazamiento a la fila activa. */
  alMontar?: (elemento: HTMLDivElement | null) => void;
};

/** Una fila de la tabla: el texto de la respuesta, sus veces y la celda de sus códigos. */
export const FilaCodificar = memo(function FilaCodificar({
  fila,
  indice,
  activa,
  sugerencia,
  elegida,
  onElegir,
  campo,
  onActivar,
  onQuitar,
  alMontar,
}: FilaCodificarProps) {
  return (
    <div
      ref={alMontar}
      role="row"
      // La cabecera es la fila 1.
      aria-rowindex={indice + 2}
      aria-current={activa ? "true" : undefined}
      data-index={indice}
      data-activa={activa ? "" : undefined}
      className="pulso-ct-fila"
      data-elegida={elegida ? "" : undefined}
      onClick={() => onActivar(fila.clave)}
    >
      {onElegir ? (
        <div role="cell" className="pulso-ct-c-elegir">
          {/* Elegir la fila no la activa: el clic se queda en la casilla. */}
          <button
            type="button"
            className="pulso-ct-casilla"
            aria-pressed={Boolean(elegida)}
            aria-label={`${elegida ? "Soltar" : "Elegir"} "${fila.texto}"`}
            onClick={(evento) => {
              evento.stopPropagation();
              onElegir();
            }}
          />
        </div>
      ) : null}
      <div role="cell" className="pulso-ct-c-resp">
        <span className="pulso-ct-texto" title={fila.titulo}>
          {fila.codigoDeRespuesta ? <code className="pulso-cv2-resp-code">{fila.codigoDeRespuesta}</code> : null}
          {fila.texto}
        </span>
        {fila.variantes > 1 ? (
          <span className="pulso-ct-variantes">{formatoConteo(fila.variantes)} variantes</span>
        ) : null}
        {fila.miembros?.length ? (
          // Las parecidas que la fila junta, debajo del texto, como en el prototipo.
          <span className="pulso-ct-miembros" title={fila.miembros.map((m) => `${m.texto} (${formatoConteo(m.veces)})`).join(", ")}>
            {fila.miembros.map((m) => m.texto).join(", ")}
          </span>
        ) : null}
      </div>
      <div role="cell" className="pulso-ct-c-veces">
        {formatoConteo(fila.veces)}
      </div>
      <div role="cell" className="pulso-ct-c-cod">
        <div className="pulso-ct-codigos">
          {fila.codigos.map((codigo) => (
            <InsigniaCodigo
              key={codigo.id}
              codigo={codigo}
              respuesta={fila.texto}
              enfocable={activa}
              onQuitar={() => onQuitar(fila.clave, codigo.id)}
            />
          ))}
          {/* La fila activa también dice su estado: con el campo a la vista, una respuesta sin código seguía sin rótulo. */}
          {fila.codigos.length === 0 && !sugerencia ? <span className="pulso-ct-vacia">Sin código</span> : null}
          {fila.codigos.length === 0 && sugerencia ? (
            <span className="pulso-ct-sugerencia" onClick={(evento) => evento.stopPropagation()}>{sugerencia}</span>
          ) : null}
          {campo}
        </div>
      </div>
    </div>
  );
});
