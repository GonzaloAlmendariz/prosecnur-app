import { useEffect, useRef, useState, type FormEvent } from "react";
import { useDroppable } from "@dnd-kit/core";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoInput } from "../../../components/PulsoInput";
import { formatoConteo } from "../../../lib/formatoNumero";
import { Plus } from "../../../vendor/lucide-react";
import { ZONA_CODIGO_NUEVO } from "./asignacionEnLote";

export type TarjetaCodigoNuevoProps = {
  /** El número que llevará el código. */
  numero: string;
  /** La pregunta todavía no tiene códigos: la tarjeta es también el vacío del panel. */
  unica?: boolean;
  /** Se está arrastrando un lote de respuestas. */
  esDestino: boolean;
  /** Con el nombre pedido: cuántas respuestas esperan el código (0 al crearlo desde el botón). */
  pendientes: number | null;
  onAbrir: () => void;
  onCrear: (nombre: string) => void;
  onCancelar: () => void;
};

/**
 * La tarjeta punteada del final: se pulsa para crear un código o se sueltan respuestas sobre ella. En
 * los dos casos pide el nombre ahí mismo; el código se crea al confirmarlo.
 */
export function TarjetaCodigoNuevo({ numero, unica = false, esDestino, pendientes, onAbrir, onCrear, onCancelar }: TarjetaCodigoNuevoProps) {
  const zona = useDroppable({ id: ZONA_CODIGO_NUEVO });
  const [nombre, setNombre] = useState("");
  const campo = useRef<HTMLInputElement | null>(null);
  const tarjeta = useRef<HTMLDivElement | null>(null);
  const abierta = pendientes !== null;

  useEffect(() => {
    if (!abierta) return;
    setNombre("");
    campo.current?.focus({ preventScroll: true });
    // El formulario puede quedar bajo el pliegue de la lista de códigos.
    if (typeof tarjeta.current?.scrollIntoView === "function") tarjeta.current.scrollIntoView({ block: "nearest" });
  }, [abierta]);

  function alEnviar(evento: FormEvent) {
    evento.preventDefault();
    const limpio = nombre.replace(/\s+/g, " ").trim();
    if (limpio) onCrear(limpio);
  }

  return (
    <div
      ref={(nodo) => {
        zona.setNodeRef(nodo);
        tarjeta.current = nodo;
      }}
      className="pulso-cc-nuevo"
      data-destino={esDestino ? "" : undefined}
      data-sobre={esDestino && zona.isOver ? "" : undefined}
      data-abierta={abierta ? "" : undefined}
    >
      {abierta ? (
        <form className="pulso-cc-nuevo-form" onSubmit={alEnviar} aria-label={`Código ${numero}`}>
          <span className="pulso-ct-numero pulso-cc-codigo-ficha">{numero}</span>
          <PulsoInput
            ref={campo}
            size="sm"
            className="pulso-cc-codigo-nombre"
            value={nombre}
            onChange={(evento) => setNombre(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key === "Escape") {
                evento.preventDefault();
                onCancelar();
              }
            }}
            placeholder="Nombre del código"
            aria-label={`Nombre del código ${numero}`}
            autoComplete="off"
          />
          {pendientes ? (
            <span className="pulso-cc-nuevo-lote">
              Con {formatoConteo(pendientes)} {pendientes === 1 ? "respuesta" : "respuestas"}
            </span>
          ) : null}
          <span className="pulso-cc-nuevo-acciones">
            <PulsoButton variant="ghost" size="sm" type="button" onClick={onCancelar}>
              Cancelar
            </PulsoButton>
            <PulsoButton variant="primary" size="sm" type="submit" disabled={nombre.trim() === ""}>
              Crear código
            </PulsoButton>
          </span>
        </form>
      ) : (
        <button type="button" className="pulso-cc-nuevo-boton" onClick={onAbrir} data-unica={unica ? "" : undefined}>
          <span className="pulso-cc-nuevo-rotulo">
            <Plus size={15} aria-hidden="true" />
            {esDestino ? "Suelta aquí para crear un código" : "Nuevo código"}
          </span>
          {unica && !esDestino ? <span className="pulso-cc-nuevo-apoyo">También puedes soltar aquí las respuestas que llevará</span> : null}
        </button>
      )}
    </div>
  );
}
