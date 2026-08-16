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
import type {
  CalcMuestraReferenciaAsistencia,
  CalcMuestraWorkspaceAulasConfig,
} from "../../../../api/client";
import { CadenasReemplazoVisual } from "../../didactica/CadenasReemplazoVisual";
import { fmtInt, fmtRatio } from "../../sharedCore";
import { rendimientoAgenda } from "../definicion/rendimientoAgendaModel";
import { profundidadReserva } from "./profundidadReservaModel";
import { AvisoModulo } from "../shared/AvisoModulo";
import { classroomRowNumber, classroomRowText } from "../shared/format";
import { CifraFila, CifraMotor, FlujoVertical, type FlujoEtapa } from "../ui";
import {
  ClassroomLabCommandBar,
  ClassroomOperationalHandoffPanel,
  ClassroomReplacementBlueprintPanel,
  ClassroomReplacementChainPanel,
  profundidadCadenaPedida,
  ClassroomReplacementTables,
  classroomWaveNumber,
  type ClassroomLabModel,
} from "./aulasParts";
import {
  AulasStageNotice,
  resolveAulasStageNotice,
  type AulasNavigate,
} from "./aulasSurfaceState";
import "../../didactica/didactica.css";
import "./aulas.css";

/**
 * Cabecera de reservas: profundidad mínima por celda con semáforo.
 *
 * La pestaña pregunta «¿alcanzan las reservas?» y hasta ahora la respondía con
 * un umbral de la casa —menos de 1 alerta, 2 o más holgado— sin ningún punto de
 * comparación medido. El estudio previo tiene el único que existe: cuántas
 * aulas hubo que agendar por cada una que se llegó a aplicar. Ponerlo junto a
 * las reservas por titular convierte una regla de dedo en una comparación.
 */
function ReserveDepthHeader({
  model,
  referencia,
  objetivoReserva,
}: {
  model: ClassroomLabModel;
  referencia: CalcMuestraReferenciaAsistencia | null;
  /** Objetivo declarado de reservas por titular; manda sobre el del semáforo. */
  objetivoReserva: number | null;
}) {
  const rows = model.reserveDepthRows;
  if (!rows.length) return null;
  const ratios = rows.map((row) => classroomRowNumber(row, ["depth_ratio"]));
  const minRatio = Math.min(...ratios);
  const prof = profundidadReserva(minRatio, objetivoReserva);
  const objetivo = prof?.objetivo ?? 1;
  const sinReserva = rows.filter((row) => classroomRowNumber(row, ["reservas"]) <= 0 || classroomRowNumber(row, ["depth_ratio"]) < objetivo);
  const titulares = rows.reduce((sum, row) => sum + classroomRowNumber(row, ["titulares"]), 0);
  const reservas = rows.reduce((sum, row) => sum + classroomRowNumber(row, ["reservas"]), 0);
  const peorCelda = rows.find((row) => classroomRowNumber(row, ["depth_ratio"]) === minRatio);
  // El histórico se cita, no se convierte en umbral: es lo que costó UN estudio
  // previo, no una regla. Quien decide compara; el motor no decide por él.
  const historico = rendimientoAgenda(
    referencia?.cobertura.agendados,
    referencia?.cobertura.aplicados,
  );
  return (
    <section
      className="cmv2-panel cmv2-aulas-panel"
      aria-label="Profundidad de reservas por celda"
      data-qa-geometry-group="aulas-reemplazos-profundidad"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="cmv2-subhead">
        <strong>Profundidad de reemplazos por celda</strong>
      </div>
      <CifraFila>
        <CifraMotor
          label="Profundidad mínima"
          value={fmtRatio(minRatio)}
          detalle={[
            prof?.tono === "alerta"
              ? "hay celdas por debajo del objetivo"
              : prof?.tono === "ok"
                ? "todas las celdas con colchón holgado"
                : `celda más ajustada: ${classroomRowText(peorCelda ?? {}, ["stratum"]) || "—"}`,
            // Un tono sólo se puede leer si se sabe contra qué se mide, y este
            // objetivo es configurable: callarlo deja el color sin referencia.
            prof?.objetivoExplicito ? `objetivo declarado: ${fmtRatio(objetivo)} por titular` : null,
          ].filter(Boolean).join(" · ")}
          origen="motor"
          tono={prof?.tono}
          hero
        />
        <CifraMotor
          label="Celdas sin reserva"
          value={fmtInt(sinReserva.length)}
          detalle={sinReserva.length
            ? `de ${fmtInt(rows.length)} celdas: si su titular cae, se usa la reserva extra`
            : `las ${fmtInt(rows.length)} celdas alcanzan el objetivo`}
          origen="motor"
          tono={sinReserva.length ? "alerta" : "ok"}
        />
        <CifraMotor
          label="Reservas por titular"
          value={titulares > 0 ? fmtRatio(reservas / titulares) : "—"}
          detalle={historico
            ? `${fmtInt(reservas)} reservas para ${fmtInt(titulares)} titulares · en ${referencia?.estudio.label ?? "el estudio previo"} se agendaron ${historico.porAplicada.toFixed(1)} por cada aula aplicada`
            : `${fmtInt(reservas)} reservas para ${fmtInt(titulares)} titulares`}
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
    <div
      className="cmv2-aulas-olas"
      aria-label="Olas del plan de reemplazos"
      data-qa-geometry-group="aulas-reemplazos-olas"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="cmv2-subhead">
        <strong>Olas del plan</strong>
      </div>
      <FlujoVertical etapas={etapas} orientacion="adaptive" ariaLabel="Olas M1 a Extra con cursos-horario por ola" />
    </div>
  );
}

export function AulasReemplazosTab({
  model,
  busy,
  onSimulateReplacements,
  onNavigate,
  referencia = null,
}: {
  model: ClassroomLabModel;
  busy: string | null;
  onSimulateReplacements: (config: CalcMuestraWorkspaceAulasConfig) => void | Promise<void>;
  onNavigate?: AulasNavigate;
  /** Estudio previo: el único punto de comparación medido para la cadena. */
  referencia?: CalcMuestraReferenciaAsistencia | null;
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
  const stageNotice = resolveAulasStageNotice(model, "reemplazos");
  return (
    <div className="cmv2-aulas-stack">
      {stageNotice && (
        <AulasStageNotice
          notice={stageNotice}
          onNavigate={onNavigate}
          onAction={stageNotice.localAction === "replace"
            ? () => void onSimulateReplacements(config)
            : undefined}
          disabled={Boolean(stageNotice.localAction) && (Boolean(busy) || !selectionReady)}
        />
      )}

      {replacementReady && (
        <ClassroomLabCommandBar
          model={model}
          busy={busy}
          acciones={["reemplazos"]}
          onSimulateReplacements={onSimulateReplacements}
        />
      )}

      <ReserveDepthHeader
        model={model}
        referencia={referencia}
        objetivoReserva={config?.objective?.reserve_depth_target ?? null}
      />

      {!selectionReady ? (
        <section
          className="cmv2-panel cmv2-aulas-panel"
        >
          <div className="cmv2-subhead">
            <strong>Ruta ilustrativa, todavía no operativa</strong>
            <small>la cadena real aparecerá solo con una selección acreditada</small>
          </div>
          <ClassroomReplacementBlueprintPanel
            depth={config.bolsas_reemplazo}
            titularCount={0}
            reserveCount={0}
            extraReserveCount={0}
          />
        </section>
      ) : (
        <>
          <CadenasReemplazoVisual seleccion={selection} simulacion={replacementSimulation} />
          <div className="cmv2-classroom-lab-grid cmv2-classroom-lab-grid--routes">
            <div className="cmv2-classroom-lab-main">
              <div className="cmv2-subhead">
                <strong>Efecto esperado de los reemplazos</strong>
              </div>
              <WavesTimeline model={model} />
              <div
                data-qa-geometry-group="aulas-reemplazos-rutas"
                data-qa-geometry-contract="intrinsic"
              >
            <ClassroomReplacementChainPanel
              selectionRows={selectionRows}
              simulation={replacementSimulation}
              depth={profundidadCadenaPedida(config.bolsas_reemplazo)}
            />
              </div>
              {!m1Rows.length && (
                <ClassroomReplacementBlueprintPanel
                  depth={config.bolsas_reemplazo}
                  titularCount={m1Rows.length}
                  reserveCount={reserveRows.length}
                  extraReserveCount={extraReserveRows.length}
                />
              )}
              {replacementReady && replacementSimulation && (
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
        </>
      )}
    </div>
  );
}
