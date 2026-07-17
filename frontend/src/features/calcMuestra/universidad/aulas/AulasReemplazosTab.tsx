/**
 * Pestaña "Reemplazos por aula" (id reemplazos) de la sección Aulas. Arriba la
 * capa didáctica (CadenasReemplazoVisual); la cabecera responde "¿alcanzan las
 * reservas?" con la profundidad por celda (reserve_depth) como cifras con
 * semáforo; las olas del plan (M1 → M2 → … → Extra) se leen como timeline
 * compacto; y se conservan las rutas operativas por titular, las tablas de
 * sugerencias/impacto y el handoff a Monitoreo. El término "reemplazo" ya se
 * explicó en Objetivo; aquí solo se referencia.
 */
import { Route } from "lucide-react";
import type { CalcMuestraWorkspaceAulasConfig } from "../../../../api/client";
import { CadenasReemplazoVisual } from "../../didactica/CadenasReemplazoVisual";
import { fmtInt, fmtRatio } from "../../sharedCore";
import { AvisoModulo } from "../shared/AvisoModulo";
import { classroomRowNumber, classroomRowText } from "../shared/format";
import { CifraFila, CifraMotor, FlujoVertical, type FlujoEtapa } from "../ui";
import {
  ClassroomEmptyState,
  ClassroomLabCommandBar,
  ClassroomOperationalHandoffPanel,
  ClassroomReplacementBlueprintPanel,
  ClassroomReplacementChainPanel,
  ClassroomReplacementTables,
  classroomWaveNumber,
  type ClassroomLabModel,
} from "./aulasParts";
import "../../didactica/didactica.css";
import "./aulas.css";

/** Cabecera de reservas: profundidad mínima por celda con semáforo. */
function ReserveDepthHeader({ model }: { model: ClassroomLabModel }) {
  const rows = model.reserveDepthRows;
  if (!rows.length) return null;
  const ratios = rows.map((row) => classroomRowNumber(row, ["depth_ratio"]));
  const minRatio = Math.min(...ratios);
  const sinReserva = rows.filter((row) => classroomRowNumber(row, ["reservas"]) <= 0 || classroomRowNumber(row, ["depth_ratio"]) < 1);
  const titulares = rows.reduce((sum, row) => sum + classroomRowNumber(row, ["titulares"]), 0);
  const reservas = rows.reduce((sum, row) => sum + classroomRowNumber(row, ["reservas"]), 0);
  const peorCelda = rows.find((row) => classroomRowNumber(row, ["depth_ratio"]) === minRatio);
  return (
    <section className="cmv2-panel cmv2-aulas-panel" aria-label="Profundidad de reservas por celda">
      <div className="cmv2-subhead">
        <strong>Profundidad de reemplazos por celda</strong>
      </div>
      <CifraFila>
        <CifraMotor
          label="Profundidad mínima"
          value={fmtRatio(minRatio)}
          detalle={minRatio < 1
            ? "hay celdas sin reserva completa"
            : minRatio >= 2
              ? "todas las celdas con colchón holgado"
              : `celda más ajustada: ${classroomRowText(peorCelda ?? {}, ["stratum"]) || "—"}`}
          origen="motor"
          tono={minRatio < 1 ? "alerta" : minRatio >= 2 ? "ok" : undefined}
          hero
        />
        <CifraMotor
          label="Celdas sin reserva"
          value={fmtInt(sinReserva.length)}
          detalle={sinReserva.length
            ? `de ${fmtInt(rows.length)} celdas: si su titular cae, se usa la reserva extra`
            : `las ${fmtInt(rows.length)} celdas tienen al menos un reemplazo`}
          origen="motor"
          tono={sinReserva.length ? "alerta" : "ok"}
        />
        <CifraMotor
          label="Reservas por titular"
          value={titulares > 0 ? fmtRatio(reservas / titulares) : "—"}
          detalle={`${fmtInt(reservas)} reservas para ${fmtInt(titulares)} titulares`}
          origen="motor"
        />
      </CifraFila>
    </section>
  );
}

/** Olas del plan como timeline compacto: M1 → M2 → … → Extra. */
function WavesTimeline({ model }: { model: ClassroomLabModel }) {
  const totals = new Map<string, number>();
  model.waveRows.forEach((row) => {
    const wave = classroomRowText(row, ["wave"]) || "M?";
    totals.set(wave, (totals.get(wave) ?? 0) + classroomRowNumber(row, ["aulas"]));
  });
  if (!totals.size) return null;
  const orden = [...totals.keys()].sort((a, b) => {
    const extraA = a.toLowerCase().startsWith("extra") ? 1 : 0;
    const extraB = b.toLowerCase().startsWith("extra") ? 1 : 0;
    if (extraA !== extraB) return extraA - extraB;
    return classroomWaveNumber(a) - classroomWaveNumber(b);
  }).slice(0, 9);
  const etapas: FlujoEtapa[] = orden.map((wave, index) => ({
    id: wave,
    label: wave.toLowerCase().startsWith("extra") ? "Extra" : wave,
    valor: `${fmtInt(totals.get(wave) ?? 0)} cursos-horario`,
    detalle: index === 0 ? "titulares" : wave.toLowerCase().startsWith("extra") ? "reserva suelta" : `ola ${fmtInt(index)} de reemplazo`,
    estado: index === 0 ? "ready" : "working",
  }));
  return (
    <div className="cmv2-aulas-olas" aria-label="Olas del plan de reemplazos">
      <div className="cmv2-subhead">
        <strong>Olas del plan</strong>
      </div>
      <FlujoVertical etapas={etapas} orientacion="horizontal" ariaLabel="Olas M1 a Extra con cursos-horario por ola" />
    </div>
  );
}

export function AulasReemplazosTab({
  model,
  busy,
  onSimulateReplacements,
}: {
  model: ClassroomLabModel;
  busy: string | null;
  onSimulateReplacements: (config: CalcMuestraWorkspaceAulasConfig) => void | Promise<void>;
}) {
  const {
    selection,
    selectionReady,
    selectionRows,
    replacementSimulation,
    replacementReady,
    config,
    m1Rows,
    reserveRows,
    extraReserveRows,
  } = model;
  return (
    <div className="cmv2-aulas-stack">
      <CadenasReemplazoVisual seleccion={selection} simulacion={replacementSimulation} />

      <ClassroomLabCommandBar
        model={model}
        busy={busy}
        acciones={["reemplazos"]}
        onSimulateReplacements={onSimulateReplacements}
      />

      <ReserveDepthHeader model={model} />

      <div className="cmv2-classroom-lab-grid cmv2-classroom-lab-grid--routes">
        <div className="cmv2-classroom-lab-main">
          <div className="cmv2-subhead">
            <strong>Efecto esperado de los reemplazos</strong>
          </div>
          <WavesTimeline model={model} />
          {selectionReady && (
            <ClassroomReplacementChainPanel
              selectionRows={selectionRows}
              simulation={replacementSimulation}
              depth={Math.min(6, Math.max(1, config.bolsas_reemplazo || 6))}
            />
          )}
          {(!selectionReady || !m1Rows.length) && (
            <ClassroomReplacementBlueprintPanel
              depth={config.bolsas_reemplazo}
              titularCount={m1Rows.length}
              reserveCount={reserveRows.length}
              extraReserveCount={extraReserveRows.length}
            />
          )}
          {!replacementReady || !replacementSimulation ? (
            <ClassroomEmptyState
              icon={Route}
              title="Simulación pendiente"
              detail="Después de generar una selección, simula reemplazos sugeridos por celda, balance, repetidos y tamaño efectivo."
              actionLabel="Simular reemplazos"
              onAction={() => void onSimulateReplacements(config)}
              disabled={Boolean(busy) || !selectionReady}
            />
          ) : (
            <ClassroomReplacementTables simulation={replacementSimulation} />
          )}
        </div>
        <aside className="cmv2-classroom-lab-side">
          <AvisoModulo tone="neutral" icon={Route}>
            Calc-Muestra propone titulares y reemplazos; Monitoreo solo activa reemplazos, registra motivos
            y recalcula brechas sin rediseñar silenciosamente el marco base.
          </AvisoModulo>
          <ClassroomOperationalHandoffPanel selection={selection} replacementSimulation={replacementSimulation} />
        </aside>
      </div>
    </div>
  );
}
