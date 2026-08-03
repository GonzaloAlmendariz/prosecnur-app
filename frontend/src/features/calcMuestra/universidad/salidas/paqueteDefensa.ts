import type {
  CalcMuestraAulasState,
  CalcMuestraEstudio,
  CalcMuestraWorkspace,
} from "../../../../api/client";
import { historialCorridas } from "../../corridas";
import { safeNumber } from "../../sharedCore";
import { resolveClassroomArtifactStatus } from "../aulas/classroomHandoff";
import {
  classroomSelectionForState,
} from "../shared/frame";
import {
  UNIVERSITY_FACULTY_COMPONENT_ID,
  UNIVERSITY_TOTAL_COMPONENT_ID,
} from "../shared/constants";

export type PaqueteDefensaFingerprint = {
  escenario: "e1" | "e2";
  target: number;
  frameHash: string;
  selectionRunId: string;
};

type PaqueteDefensaContext = {
  estudio: CalcMuestraEstudio;
  workspace: CalcMuestraWorkspace;
  aulasState: CalcMuestraAulasState | null;
  marcoDesactualizado?: boolean;
};

/**
 * Refresca primero los artefactos de aulas y solo después lee el estudio local.
 * Ese orden hace que un cambio E1↔E2 ocurrido durante el await se combine con
 * la respuesta remota anterior y falle cerrado al construir el fingerprint.
 */
export async function leerContextoPaqueteTrasRefresco({
  refrescarAulas,
  leerContextoLocal,
}: {
  refrescarAulas: () => Promise<CalcMuestraAulasState | null>;
  leerContextoLocal: () => Pick<PaqueteDefensaContext, "estudio" | "workspace">;
}): Promise<PaqueteDefensaContext> {
  const aulasState = await refrescarAulas();
  const contextoLocal = leerContextoLocal();
  return { ...contextoLocal, aulasState };
}

function contextoAcreditado({
  estudio,
  workspace,
  aulasState,
  marcoDesactualizado = false,
}: PaqueteDefensaContext) {
  const totalComp = estudio.componentes.find((component) => component.actor_id === UNIVERSITY_TOTAL_COMPONENT_ID);
  const facultyComp = estudio.componentes.find((component) => component.actor_id === UNIVERSITY_FACULTY_COMPONENT_ID);
  if (!totalComp || !facultyComp) return null;
  const status = resolveClassroomArtifactStatus({
    workspace,
    totalComp,
    facultyComp,
    aulasState,
    marcoDesactualizado,
  });
  const selection = classroomSelectionForState(aulasState);
  const frameHash = String(aulasState?.frame?.frame_hash ?? "").trim();
  const selectionRunId = String(selection?.selection_run_id ?? "").trim();
  if (!status.selectedResultReady || !status.selectionReady || !frameHash || !selectionRunId || !selection) return null;
  return { status, selection, frameHash, selectionRunId };
}

export function paqueteDefensaFingerprint(context: PaqueteDefensaContext): PaqueteDefensaFingerprint | null {
  const acreditado = contextoAcreditado(context);
  if (!acreditado) return null;
  return {
    escenario: acreditado.status.aulasScenario,
    target: acreditado.status.currentAulasTarget,
    frameHash: acreditado.frameHash,
    selectionRunId: acreditado.selectionRunId,
  };
}

export function paqueteDefensaFingerprintIgual(
  inicial: PaqueteDefensaFingerprint,
  actual: PaqueteDefensaFingerprint | null,
): boolean {
  return Boolean(
    actual &&
    inicial.escenario === actual.escenario &&
    inicial.target === actual.target &&
    inicial.frameHash === actual.frameHash &&
    inicial.selectionRunId === actual.selectionRunId,
  );
}

export function construirMemoriaPaqueteDefensa(
  context: PaqueteDefensaContext & { timestamp?: string },
) {
  const acreditado = contextoAcreditado(context);
  if (!acreditado) {
    throw new Error("El escenario, el marco o la selección cambiaron; vuelve a generar el paquete.");
  }
  const { estudio, workspace } = context;
  const { status, selection, frameHash } = acreditado;
  const selectedComp = status.selectedComp;
  return {
    schema: "prosecnur_paquete_defensa_v1",
    proyecto: estudio.titulo,
    cliente: estudio.contexto.cliente || null,
    timestamp: context.timestamp ?? new Date().toISOString(),
    escenario: status.aulasScenario,
    actor_id: selectedComp.actor_id,
    semilla: safeNumber(selection.seed, safeNumber(workspace.aulas_config?.semilla)) || null,
    firma_marco: frameHash,
    metodo: String(selection.selector_engine_used ?? selection.selector_engine ?? "") || null,
    parametros_calculo: {
      z: selectedComp.parametros.z,
      p: selectedComp.parametros.p,
      e: selectedComp.parametros.e,
      deff: selectedComp.parametros.deff,
      sobremuestra: selectedComp.parametros.oversample_pct,
    },
    n_objetivo: safeNumber(selectedComp.resultado?.n_objetivo, 0),
    decision_log: estudio.decision_log ?? null,
    historial_corridas: historialCorridas(workspace),
  };
}
