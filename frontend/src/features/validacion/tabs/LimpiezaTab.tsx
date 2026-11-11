import { AlertTriangle, CheckCircle2 } from "../../../vendor/lucide-react";
import { EmptyState, LoadingBlock } from "../../../components/States";
import { VacioListo } from "../components/VacioListo";
import { describirDecisionesPreservadas } from "../limpieza/modeloLimpieza";
import { useMesaDeLimpieza } from "../limpieza/useMesaDeLimpieza";
import CierreDeBase from "../limpieza/CierreDeBase";
import ColaYDecision from "../limpieza/ColaYDecision";
import { InlineMessage } from "../limpieza/MensajeEnLinea";

// =============================================================================
// Limpieza y transformación
// =============================================================================
// Tab de cierre: decide qué hacer con cada hallazgo (documentar, excluir
// o corregir valores) y genera la base final.
//
// Composición delgada (rebanada V1 de P6). El estado y las acciones viven en
// `limpieza/useMesaDeLimpieza.ts`; las piezas, en `limpieza/`:
//   1. CierreDeBase: banda de cierre (estado, progreso, "Cerrar y generar
//      base") con los archivos, el efecto de las decisiones y la promoción.
//   2. ColaYDecision: cola de hallazgos + editor de decisión con flujo
//      "Guardar y siguiente" (Cmd/Ctrl+Enter) que auto-avanza al siguiente
//      pendiente.
// =============================================================================

export default function LimpiezaTab() {
  const mesa = useMesaDeLimpieza();
  const { loading, error, data, notice, actionError } = mesa;

  if (loading) return <LoadingBlock label="Cargando Limpieza y transformación…" />;

  if (error) {
    return (
      <VacioListo marca="validacion-limpieza">
        <EmptyState
          icon={<AlertTriangle size={20} />}
          title="No se pudo cargar la sección"
          hint={error}
        />
      </VacioListo>
    );
  }

  if (!data) return null;

  const auditReady = !!data.progreso.auditoria_corrida;
  const preservadas = describirDecisionesPreservadas(data.decisiones_preservadas);

  return (
    <div
      data-audit-ready="validacion-limpieza"
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      <CierreDeBase mesa={mesa} auditReady={auditReady} />

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
          text="Corre la auditoría para habilitar las decisiones y el cierre de base."
        />
      )}

      <ColaYDecision mesa={mesa} auditReady={auditReady} />
    </div>
  );
}
