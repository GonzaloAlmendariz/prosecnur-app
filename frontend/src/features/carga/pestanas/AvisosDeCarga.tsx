import type { Ref } from "react";
import { CheckCircle2 } from "../../../vendor/lucide-react";
import { ErrorBlock, LoadingBlock } from "../../../components/States";
import { OfertaEmparejamientoPorTexto } from "./bases/OfertaEmparejamientoPorTexto";

/** Lo que está pasando o salió mal en la carga: operación en curso, error o aviso del traspaso. */
export function AvisosDeCarga({
  ocupado,
  error,
  avisoDeTraspaso,
  refAvisos,
}: {
  ocupado: string;
  error: string;
  avisoDeTraspaso: string;
  /** Para llevar el error a la vista cuando aparece. */
  refAvisos: Ref<HTMLDivElement>;
}) {
  return (
    <div ref={refAvisos} className="pulso-feedback-stack pulso-feedback-stack--upload">
      {ocupado && <LoadingBlock variant="inline" label={ocupado} />}
      {error && <ErrorBlock label="No se pudo completar la carga" detail={error} />}
      {error && <OfertaEmparejamientoPorTexto />}
      {!ocupado && !error && avisoDeTraspaso && (
        <div className="pulso-carga-handoff-done" role="status">
          <CheckCircle2 size={15} aria-hidden="true" />
          <span>{avisoDeTraspaso}</span>
        </div>
      )}
    </div>
  );
}
