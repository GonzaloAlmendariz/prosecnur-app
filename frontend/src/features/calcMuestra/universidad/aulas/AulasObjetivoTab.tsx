/**
 * Pestaña "Objetivo de muestra" (id objetivo) de la sección Aulas. Jerarquía
 * en dos niveles: PRIMARIO lo que el usuario decide (modalidad, mínimo por
 * aula, reemplazos, extra operativo y grupos de tamaño) y AVANZADO lo que solo
 * ajusta un técnico (semilla, corridas, candidatas, penalización y pesos del
 * objetivo) dentro de un PanelAvanzado. El visual central traduce la cuota
 * calculada por facultad en aulas: cuota n_h → titulares → + reemplazos →
 * + extra, con datos validados del motor cuando existen. Aquí se explican por
 * única vez "cuota de aulas por facultad" y "reemplazo (M1, M2…)".
 */
import { CheckCircle2 } from "lucide-react";
import type {
  CalcMuestraWorkspace,
  CalcMuestraWorkspaceAulasConfig,
  CalcMuestraWorkspaceAulasModalidad,
} from "../../../../api/client";
import { fmtInt, safeNumber } from "../../sharedCore";
import { AvisoModulo } from "../shared/AvisoModulo";
import { UNIVERSITY_AULAS_MODALIDAD_OPTIONS } from "../shared/constants";
import { normalizeUniversityAulasConfig } from "../shared/study";
import { CifraFila, CifraMotor, PanelAvanzado } from "../ui";
import { CadenaAulas } from "./CadenaAulas";
import { NumberCell, ObjectiveWeightsPanel, type ClassroomLabModel } from "./aulasParts";
import {
  AulasStageNotice,
  resolveAulasStageNotice,
  type AulasNavigate,
} from "./aulasSurfaceState";
import "../../didactica/didactica.css";
import "./aulas.css";

export function AulasObjetivoTab({
  workspace,
  model,
  onWorkspace,
  onNavigate,
}: {
  workspace: CalcMuestraWorkspace;
  model: ClassroomLabModel;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
  onNavigate?: AulasNavigate;
}) {
  const {
    config,
    modalidad,
    objectiveVariables,
    aulasPorEstrato,
    facultades,
    selectorFields,
  } = model;

  function updateConfig(patch: Partial<CalcMuestraWorkspaceAulasConfig>) {
    onWorkspace({
      ...workspace,
      aulas_config: normalizeUniversityAulasConfig({ ...config, ...patch }),
    });
  }

  function setUseSizeGroups(value: boolean) {
    const base = ["faculty", "sex_top_1"];
    updateConfig({
      usar_grupos_tamano: value,
      estratos_selector: value ? [...base, "size_group"] : base,
    });
  }

  // Traducción por facultad: preferimos las filas VALIDADAS del motor
  // (resultado.aulas_por_estrato, TODAS las facultades para que los totales
  // cuadren con el objetivo); si aún no hay cálculo, caemos a los estratos del
  // marco con cuotas fijadas.
  const filasMotor = aulasPorEstrato.filter(
    (row) => safeNumber(row.cuota, 0) > 0 || safeNumber(row.aulas_base, 0) > 0,
  );
  const cuotaValidada = filasMotor.length > 0;
  const decisionAlumnosPorCh = Boolean(config.alumnos_por_ch_decision);
  const filasTabla = cuotaValidada
    ? filasMotor.map((row) => ({
        estrato: String(row.estrato),
        cuota: safeNumber(row.cuota, 0),
        estAula: safeNumber(row.avg_conglomerado, 0),
        titulares: safeNumber(row.aulas_base, 0),
        reemplazos: safeNumber(row.aulas_reemplazo, 0),
        extra: safeNumber(row.aulas_extra_operativas, 0) || config.aulas_extra_operativas_default,
        total: safeNumber(row.aulas_total, 0),
      }))
    : decisionAlumnosPorCh ? [] : facultades
        .filter((row) => safeNumber(row.cuota_fija, 0) > 0 || safeNumber(row.aulas_base_fijas, 0) > 0)
        .map((row) => ({
          estrato: String(row.label),
          cuota: safeNumber(row.cuota_fija, 0),
          estAula: 0,
          titulares: safeNumber(row.aulas_base_fijas, 0),
          reemplazos: 0,
          extra: safeNumber(row.aulas_extra_operativas, 0),
          total: safeNumber(row.aulas_base_fijas, 0) + safeNumber(row.aulas_extra_operativas, 0),
        }));
  const result = model.selectedComp.resultado;
  const resultReady = model.selectedResultReady && Boolean(result);
  const showEstAula = filasTabla.some((row) => row.estAula > 0);
  const showReemplazos = filasTabla.some((row) => row.reemplazos > 0);
  const showExtra = filasTabla.some((row) => row.extra > 0);
  const showTotal = filasTabla.some((row) => row.total > 0);
  const stageNotice = resolveAulasStageNotice(model, "objetivo");

  return (
    <div className="cmv2-aulas-stack">
      <section className="cmv2-panel cmv2-aulas-panel cmv2-aulas-hero-panel">
        <div className="cmv2-subhead">
          <strong>Objetivo vigente</strong>
          <small>resultado acreditado del escenario activo</small>
        </div>
        <div>
          <CifraFila>
            <CifraMotor
              label="Escenario"
              value={model.aulasScenario === "e2" ? "P2 · por facultad" : "P1 · universidad"}
              detalle="componente que manda en cursos-horario"
            />
            <CifraMotor
              label="n objetivo"
              value={resultReady ? fmtInt(result?.n_objetivo) : "pendiente"}
              detalle="entrevistas completas requeridas"
              origen={resultReady ? "motor" : undefined}
            />
            <CifraMotor
              label="n operativo"
              value={resultReady ? fmtInt(result?.n_operativo) : "pendiente"}
              detalle="incluye la cobertura prevista por el engine"
              origen={resultReady ? "motor" : undefined}
            />
            <CifraMotor
              label="Cursos-horario titulares"
              value={model.currentAulasTarget > 0 ? fmtInt(model.currentAulasTarget) : "pendiente"}
              detalle="target CH publicado por el engine R"
              origen={model.currentAulasTarget > 0 ? "motor" : undefined}
              hero
            />
          </CifraFila>
        </div>
      </section>

      {stageNotice && (
        <AulasStageNotice notice={stageNotice} onNavigate={onNavigate} />
      )}

      <section className="cmv2-panel cmv2-aulas-panel">
        <div className="cmv2-subhead">
          <strong>Conversión de N a cursos-horario</strong>
        </div>
        {cuotaValidada && (
          <CadenaAulas
            rows={filasMotor}
            reemplazosPorTitular={config.bolsas_reemplazo}
            extraOperativo={config.aulas_extra_operativas_default}
          />
        )}

        <div
          className="cmv2-aulas-cuota-flujos"
          aria-label="Cursos-horario requeridos"
        >
          <div className="cmv2-aulas-cuota-head">
            <strong>Detalle por facultad</strong>
            <small>{cuotaValidada ? "cuotas y cursos-horario validados por la calculadora" : "con cuotas fijadas del marco; calcula la muestra para validar"}</small>
          </div>
          {!filasTabla.length ? (
            <p className="cmv2-aulas-nota-suave">
              {resultReady
                ? "El cálculo vigente todavía no incluye un desglose de cursos-horario por facultad. Recalcula la propuesta para materializarlo."
                : "Cuando Cálculo publique el objetivo, aquí aparecerá la conversión por facultad."}
            </p>
          ) : (
            <div className="cmv2-table-wrap">
              <table className="cmv2-table cmv2-table--university cmv2-aulas-tabla">
                <thead>
                  <tr>
                    <th>Facultad</th>
                    <th>Cuota</th>
                    {showEstAula && <th>Est./curso-horario</th>}
                    <th>Titulares</th>
                    {showReemplazos && <th>Reservas</th>}
                    {showExtra && <th>Extra</th>}
                    {showTotal && <th>A coordinar</th>}
                  </tr>
                </thead>
                <tbody>
                  {filasTabla.map((row) => (
                    <tr key={row.estrato}>
                      <td><strong>{row.estrato}</strong></td>
                      <td>{fmtInt(row.cuota)}</td>
                      {showEstAula && <td>{row.estAula > 0 ? Math.round(row.estAula) : "—"}</td>}
                      <td>{fmtInt(row.titulares)}</td>
                      {showReemplazos && <td>{row.reemplazos > 0 ? fmtInt(row.reemplazos) : "—"}</td>}
                      {showExtra && <td>{row.extra > 0 ? fmtInt(row.extra) : "—"}</td>}
                      {showTotal && <td><strong>{row.total > 0 ? fmtInt(row.total) : "—"}</strong></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="cmv2-panel cmv2-aulas-panel">
        <div className="cmv2-subhead">
          {/* K2: «Criterios de selección» colisionaba con los criterios del
              Marco; esto son los PESOS del sorteo. */}
          <strong>Parámetros del sorteo</strong>
        </div>
        <div
          className="cmv2-classroom-control-grid"
          data-qa-geometry-group="aulas-objetivo-controles"
          data-qa-geometry-contract="intrinsic"
        >
          <label className="cmv2-compact-field cmv2-classroom-field-wide">
            <span>Modalidad</span>
            <select
              value={config.modalidad}
              onChange={(e) => {
                const nextModalidad = e.currentTarget.value as CalcMuestraWorkspaceAulasModalidad;
                updateConfig({
                  modalidad: nextModalidad,
                  require_in_person: nextModalidad !== "online_controlado",
                });
              }}
            >
              {UNIVERSITY_AULAS_MODALIDAD_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            <em>{modalidad.detail}</em>
          </label>
          <div className="cmv2-compact-field">
            <span>Mínimo por curso-horario</span>
            <NumberCell value={config.min_elegibles_aula} min={1} step={1} onChange={(v) => updateConfig({ min_elegibles_aula: Math.round(v) })} />
            {/* VARA 3: once facultades declaran mínimo propio (10–20 en
                HSVG2026) y este campo solo mueve el GENERAL. Sin la nota, el
                «15» a secas presenta como uniforme lo que es heterogéneo por
                diseño — y editar aquí parecería pisar los propios. */}
            {(() => {
              const propios = Object.values(config.criterios_seleccion?.minEligible?.byFaculty ?? {})
                .map(Number)
                .filter((v) => Number.isFinite(v) && v > 0);
              if (!propios.length) {
                return <em>Descarta cursos demasiado pequeños para sostener una aplicación presencial.</em>;
              }
              const rango = propios.length > 1 && Math.min(...propios) !== Math.max(...propios)
                ? `${fmtInt(Math.min(...propios))}–${fmtInt(Math.max(...propios))}`
                : fmtInt(propios[0]);
              return (
                <em>
                  Es el mínimo general; {fmtInt(propios.length)} facultades declaran uno propio ({rango}),
                  decidido en Marco › Criterios — este campo no los toca.
                </em>
              );
            })()}
          </div>
          <div className="cmv2-compact-field">
            <span>Reemplazos por curso-horario</span>
            <NumberCell value={config.bolsas_reemplazo} min={0} step={1} onChange={(v) => updateConfig({ bolsas_reemplazo: Math.round(v) })} />
            <em>Crea Rn.1, Rn.2... como alternativas equivalentes para cada curso-horario titular.</em>
          </div>
          <div className="cmv2-compact-field">
            <span>Techo de visitas del estudio</span>
            <NumberCell value={config.techo_aulas_visitadas ?? 0} min={0} step={5} onChange={(v) => updateConfig({ techo_aulas_visitadas: Math.max(0, Math.round(v)) })} />
            <em>«No pasarnos de N aulas»: titulares + reemplazos activados no deberían superarlo. 0 = sin techo declarado.</em>
          </div>
          <div className="cmv2-compact-field">
            <span>Extra operativo por estrato</span>
            <NumberCell value={config.aulas_extra_operativas_default} min={0} step={1} onChange={(v) => updateConfig({ aulas_extra_operativas_default: Math.round(v) })} />
            <em>Refuerzo de agenda; no cambia el N estadístico ni la muestra titular.</em>
          </div>
        </div>
        <label className="cmv2-classroom-toggle">
          <input
            type="checkbox"
            checked={config.usar_grupos_tamano}
            onChange={(e) => setUseSizeGroups(e.currentTarget.checked)}
          />
          <span>
            <strong>Usar grupos de tamaño del curso-horario</strong>
            <em>Recomendado cuando la selección puede sesgarse hacia cursos grandes.</em>
          </span>
        </label>
        <label className="cmv2-classroom-toggle">
          <input
            type="checkbox"
            checked={config.docente_unico !== false}
            onChange={(e) => updateConfig({ docente_unico: e.currentTarget.checked })}
          />
          <span>
            <strong>Docente único entre titulares</strong>
            {/* EF2 · «no molestar al docente»: un docente contactado dos veces
                puede negarse a la segunda, y la selección no tiene vuelta
                atrás. El ajuste es post-sorteo, en la misma celda, y queda
                registrado en la selección (sacrificio declarado). */}
            <em>Si un docente dicta dos cursos-horario sorteados, uno se intercambia por el mejor candidato de su misma celda; cada ajuste queda registrado.</em>
          </span>
        </label>
        {config.usar_grupos_tamano && (
          <div className="cmv2-classroom-groups" aria-label="Grupos de tamaño de curso-horario">
            {config.grupos_tamano.map((group) => (
              <span key={group.id}>
                <strong>{group.label}</strong>
                {group.min}{group.max == null ? "+" : `-${group.max}`} elegibles
              </span>
            ))}
          </div>
        )}
        <AvisoModulo tone="neutral" icon={CheckCircle2}>
          El extra operativo no cambia el N estadístico: refuerza la agenda de campo sin alterar cuotas ni
          pesos del diseño.
        </AvisoModulo>

        {/* F103 · Abierto por defecto. Aquí viven la semilla y los pesos: la
            semilla DETERMINA la muestra, y este módulo existe para que la
            selección sea defendible. Plegar la reproducibilidad esconde
            exactamente aquello por lo que se responde. Sigue siendo plegable
            —quien no la use la cierra—, pero el estado inicial no la oculta. */}
        <PanelAvanzado
          titulo="Auditoría y reproducibilidad"
          descripcion="semilla, corridas, candidatas y pesos del objetivo"
          defaultOpen
        >
          <div className="cmv2-classroom-control-grid">
            <div className="cmv2-compact-field">
              <span>Semilla</span>
              <NumberCell value={config.semilla} min={1} step={1} onChange={(v) => updateConfig({ semilla: Math.round(v) })} />
              <em>Permite reproducir la misma selección en auditoría.</em>
            </div>
            <div className="cmv2-compact-field">
              <span>Corridas de auditoría</span>
              <NumberCell value={config.simulation_runs ?? config.monte_carlo_n} min={0} step={50} onChange={(v) => updateConfig({ simulation_runs: Math.round(v), monte_carlo_n: Math.round(v) })} />
              <em>Estima estabilidad, pesos y probabilidades cuando hay optimización.</em>
            </div>
            <div className="cmv2-compact-field">
              <span>Candidatas a comparar</span>
              <NumberCell value={config.candidate_pool_size ?? 500} min={1} step={25} onChange={(v) => updateConfig({ candidate_pool_size: Math.round(v) })} />
              <em>Solo afecta el pool controlado; obliga a auditar probabilidades por simulación.</em>
            </div>
            <div className="cmv2-compact-field">
              <span>Evitar repetidos</span>
              <NumberCell value={config.penalizacion_repetidos} min={0} step={0.05} onChange={(v) => updateConfig({ penalizacion_repetidos: v })} />
              <em>Más alto prioriza estudiantes únicos cuando aparecen en varios cursos.</em>
            </div>
          </div>
          <div className="cmv2-classroom-groups" aria-label="Criterios activos del selector">
            <strong>Criterios activos</strong>
            {selectorFields.map((field) => <span key={field}>{field}</span>)}
          </div>
          <ObjectiveWeightsPanel variables={objectiveVariables as Array<Record<string, unknown>>} />
        </PanelAvanzado>
      </section>
    </div>
  );
}
