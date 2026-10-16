// Estado de un segmento en una base: el mismo indicador (icono + texto) que la
// presencia de una pregunta en el Mapa de bases. El texto lo dice; el color
// sólo lo acompaña.

import { CheckCircle2, AlertTriangle, Minus } from "../../../vendor/lucide-react";
import type { TonoCelda } from "./segmentosModel";

const CLASE: Record<TonoCelda, string> = {
  ok: "is-presente",
  aviso: "is-falta",
  neutro: "is-no-comparable",
};

export function EstadoChip({ tono, texto, detalle }: { tono: TonoCelda; texto: string; detalle?: string }) {
  const icono = tono === "ok"
    ? <CheckCircle2 size={12} aria-hidden="true" />
    : tono === "aviso"
      ? <AlertTriangle size={12} aria-hidden="true" />
      : <Minus size={12} aria-hidden="true" />;
  return (
    <span className="pulso-seg-estado">
      <span className={`pulso-mapa-presencia ${CLASE[tono]}`}>
        {icono}
        <span>{texto}</span>
      </span>
      {detalle && <small title={detalle}>{detalle}</small>}
    </span>
  );
}
