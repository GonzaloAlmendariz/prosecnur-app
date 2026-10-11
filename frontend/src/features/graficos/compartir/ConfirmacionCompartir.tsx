// Paso de confirmación antes de escribir: aparece en el lugar de la acción, recibe el foco y se cancela con Cancelar.

import { useEffect, useId, useRef } from "react";
import { AlertTriangle, Check, Loader2 } from "../../../vendor/lucide-react";
import type { TextoConfirmacion } from "./textosConfirmacion";
import "./compartir.css";

export function ConfirmacionCompartir({ texto, ocupado, onConfirmar, onCancelar }: {
  texto: TextoConfirmacion;
  ocupado: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const tituloId = useId();
  const detalleId = useId();
  const confirmarRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { confirmarRef.current?.focus(); }, []);
  return (
    <div className="pulso-f6-compartir-confirmar" role="group" aria-labelledby={tituloId} aria-describedby={detalleId}>
      <AlertTriangle size={14} aria-hidden="true" />
      <div className="pulso-f6-compartir-confirmar-texto">
        <strong id={tituloId}>{texto.titulo}</strong>
        <small id={detalleId}>{texto.detalle}</small>
      </div>
      <div className="pulso-f6-compartir-confirmar-acciones">
        <button type="button" className="pulso-gv2-share-action" onClick={onCancelar} disabled={ocupado}>Cancelar</button>
        <button ref={confirmarRef} type="button" className="pulso-gv2-share-action is-primary" onClick={onConfirmar} disabled={ocupado}>
          {ocupado ? <Loader2 size={12} className="pulso-spin" aria-hidden="true" /> : <Check size={12} aria-hidden="true" />}
          {texto.accion}
        </button>
      </div>
    </div>
  );
}

/** Motivo por el que una acción no se puede usar en este alcance; las acciones lo enlazan con `aria-describedby`. */
export function MotivoNoDisponible({ id, motivo }: { id: string; motivo: string }) {
  return <p id={id} className="pulso-f6-compartir-motivo">{motivo}</p>;
}
