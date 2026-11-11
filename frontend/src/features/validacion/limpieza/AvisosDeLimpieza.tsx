/**
 * Los avisos de la mesa de limpieza: decisiones preservadas tras recargar el
 * formulario, el resultado de la última acción, su error y la falta de
 * auditoría. Salieron de `tabs/LimpiezaTab.tsx` para que Hallazgos y Cierre
 * (rebanada V2 de P6) los muestren igual, cada una con su mesa.
 */
import { AlertTriangle, CheckCircle2 } from "../../../vendor/lucide-react";
import { describirDecisionesPreservadas } from "./modeloLimpieza";
import { InlineMessage } from "./MensajeEnLinea";
import type { MesaDeLimpieza } from "./useMesaDeLimpieza";

export default function AvisosDeLimpieza({
  mesa,
  auditReady,
  conPreservadas,
  onIrAHallazgos,
}: {
  mesa: MesaDeLimpieza;
  auditReady: boolean;
  /** Las decisiones preservadas hablan de la cola: solo las muestra Hallazgos. */
  conPreservadas: boolean;
  /** En Cierre la auditoría no está a la vista: el aviso dice dónde se corre y lleva allí. */
  onIrAHallazgos?: () => void;
}) {
  const { data, notice, actionError } = mesa;
  const preservadas = conPreservadas && data ? describirDecisionesPreservadas(data.decisiones_preservadas) : null;
  return (
    <>
      {/* En verde a propósito: no es una alerta sino la buena noticia de que
          recargar el instrumento ya no cuesta las exclusiones. Además la banda
          de "Corre la auditoría" que va debajo es ámbar, y dos del mismo tono
          pegadas se leen como una sola. */}
      {preservadas && (
        <InlineMessage
          tone={preservadas.tone}
          icon={preservadas.tone === "success" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          text={preservadas.texto}
        />
      )}
      {notice && (
        <InlineMessage tone="success" icon={<CheckCircle2 size={14} />} text={notice} />
      )}
      {actionError && (
        <InlineMessage tone="danger" icon={<AlertTriangle size={14} />} text={actionError} />
      )}
      {!auditReady && (
        <InlineMessage
          tone="warn"
          icon={<AlertTriangle size={14} />}
          text={onIrAHallazgos
            ? "Corre la auditoría en Hallazgos para habilitar las decisiones y el cierre de base."
            : "Corre la auditoría para habilitar las decisiones y el cierre de base."}
          accion={onIrAHallazgos && (
            <button type="button" className="pulso-secondary" onClick={onIrAHallazgos}>
              Ir a Hallazgos
            </button>
          )}
        />
      )}
    </>
  );
}
