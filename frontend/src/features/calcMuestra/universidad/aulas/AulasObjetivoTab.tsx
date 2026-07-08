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
import { UNIVERSITY_AULAS_MODALIDAD_OPTIONS } from "../shared/constants";
import { normalizeUniversityAulasConfig } from "../shared/study";
import { CifraFila, CifraMotor, FlujoVertical, PanelAvanzado, TerminoChip, type FlujoEtapa } from "../ui";
import { NumberCell, ObjectiveWeightsPanel, type ClassroomLabModel } from "./aulasParts";
import "../../didactica/didactica.css";
import "./aulas.css";

export function AulasObjetivoTab({
  workspace,
  model,
  onWorkspace,
}: {
  workspace: CalcMuestraWorkspace;
  model: ClassroomLabModel;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
}) {
  const {
    config,
    modalidad,
    objectiveVariables,
    extraOperativo,
    targetForDisplay,
    m1ForDisplay,
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

  const expectedYield = targetForDisplay > 0 && m1ForDisplay > 0 ? targetForDisplay / m1ForDisplay : 0;

  // Traducción por facultad: preferimos las filas VALIDADAS del motor
  // (resultado.aulas_por_estrato); si aún no hay cálculo, caemos a los
  // estratos del marco con cuotas fijadas.
  const filasMotor = aulasPorEstrato
    .filter((row) => safeNumber(row.cuota, 0) > 0 || safeNumber(row.aulas_base, 0) > 0)
    .slice(0, 10);
  const filasFallback = facultades
    .filter((row) => safeNumber(row.cuota_fija, 0) > 0 || safeNumber(row.aulas_base_fijas, 0) > 0)
    .slice(0, 10)
    .map((row) => ({
      estrato: row.label,
      cuota: safeNumber(row.cuota_fija, 0),
      aulas_base: safeNumber(row.aulas_base_fijas, 0),
      aulas_reemplazo: 0,
      aulas_extra_operativas: safeNumber(row.aulas_extra_operativas, 0),
    }));
  const filasCuota = filasMotor.length ? filasMotor : filasFallback;
  const cuotaValidada = filasMotor.length > 0;

  return (
    <div className="cmv2-aulas-stack">
      <section className="cmv2-panel cmv2-aulas-panel">
        <div className="cmv2-subhead">
          <span className="cmv2-eyebrow">Objetivo</span>
          <strong>Del N por facultad a aulas titulares y reemplazos</strong>
        </div>
        <p className="cmv2-aulas-intro">
          La <TerminoChip termino="cuota de aulas por facultad">cuota de aulas por facultad</TerminoChip>{" "}
          convierte el N calculado en salones a visitar: cada facultad usa su propio tamaño de aula y su
          tasa de rendimiento. Cada titular lleva sus{" "}
          <TerminoChip termino="reemplazo (M1">reemplazos (M1, M2, M3…)</TerminoChip> equivalentes ya
          sorteados, y el extra operativo se presupuesta aparte.
        </p>
        <CifraFila>
          <CifraMotor
            label="Objetivo de entrevistas"
            value={targetForDisplay ? fmtInt(targetForDisplay) : "pendiente"}
            detalle="viene de Cálculo y sus cuotas"
            origen={targetForDisplay ? "motor" : undefined}
            hero
          />
          <CifraMotor
            label="Aulas titulares necesarias"
            value={m1ForDisplay ? fmtInt(m1ForDisplay) : "pendiente"}
            detalle={expectedYield ? `rinde aprox. ${fmtInt(expectedYield)} estudiantes por aula` : "se estima con N y rendimiento"}
            origen={m1ForDisplay ? "motor" : undefined}
          />
          <CifraMotor
            label="Reemplazos por titular"
            value={`R1-R${config.bolsas_reemplazo}`}
            detalle="alternativas equivalentes por aula"
          />
          <CifraMotor
            label="Extra operativo"
            value={fmtInt(extraOperativo)}
            detalle="refuerzo de agenda separado"
          />
        </CifraFila>

        <div className="cmv2-aulas-cuota-flujos" aria-label="Traducción de cuotas a aulas por facultad">
          <div className="cmv2-aulas-cuota-head">
            <strong>Traducción por facultad</strong>
            <small>{cuotaValidada ? "cuotas y aulas validadas por la calculadora" : "con cuotas fijadas del marco; calcula la muestra para validar"}</small>
          </div>
          {!filasCuota.length && (
            <p className="cmv2-aulas-nota-suave">
              Cuando calcules el tamaño por facultad (sección Cálculo), aquí verás cómo cada cuota se convierte en aulas titulares, reemplazos y extra.
            </p>
          )}
          {filasCuota.map((row) => {
            const etapas: FlujoEtapa[] = [
              { id: "cuota", label: "cuota n_h", valor: fmtInt(safeNumber(row.cuota, 0)), estado: safeNumber(row.cuota, 0) > 0 ? "ready" : "pending" },
              { id: "titulares", label: "aulas titulares", valor: fmtInt(safeNumber(row.aulas_base, 0)), estado: safeNumber(row.aulas_base, 0) > 0 ? "ready" : "pending" },
              { id: "reemplazos", label: "+ reemplazos", valor: safeNumber(row.aulas_reemplazo, 0) ? fmtInt(safeNumber(row.aulas_reemplazo, 0)) : `R1-R${config.bolsas_reemplazo}`, estado: "working" },
              { id: "extra", label: "+ extra", valor: fmtInt(safeNumber(row.aulas_extra_operativas, 0) || config.aulas_extra_operativas_default), estado: "working" },
            ];
            return (
              <div key={String(row.estrato)} className="cmv2-aulas-cuota-fila">
                <span className="cmv2-aulas-cuota-facultad">{String(row.estrato)}</span>
                <FlujoVertical etapas={etapas} orientacion="horizontal" ariaLabel={`Cuota y aulas de ${String(row.estrato)}`} />
              </div>
            );
          })}
        </div>
      </section>

      <section className="cmv2-panel cmv2-aulas-panel">
        <div className="cmv2-subhead">
          <span className="cmv2-eyebrow">Criterios de selección</span>
          <strong>Lo que decides para traducir la cuota en aulas</strong>
        </div>
        <div className="cmv2-classroom-control-grid">
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
            <span>Mínimo por aula</span>
            <NumberCell value={config.min_elegibles_aula} min={1} step={1} onChange={(v) => updateConfig({ min_elegibles_aula: Math.round(v) })} />
            <em>Descarta cursos demasiado pequeños para sostener una aplicación presencial.</em>
          </div>
          <div className="cmv2-compact-field">
            <span>Reemplazos por aula</span>
            <NumberCell value={config.bolsas_reemplazo} min={0} step={1} onChange={(v) => updateConfig({ bolsas_reemplazo: Math.round(v) })} />
            <em>Crea Rn.1, Rn.2... como alternativas equivalentes para cada aula titular.</em>
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
            <strong>Usar grupos de tamaño de aula</strong>
            <em>Recomendado cuando la selección puede sesgarse hacia cursos grandes.</em>
          </span>
        </label>
        {config.usar_grupos_tamano && (
          <div className="cmv2-classroom-groups" aria-label="Grupos de tamaño de aula">
            {config.grupos_tamano.map((group) => (
              <span key={group.id}>
                <strong>{group.label}</strong>
                {group.min}{group.max == null ? "+" : `-${group.max}`} elegibles
              </span>
            ))}
          </div>
        )}
        <div className="cmv2-classroom-note">
          <CheckCircle2 size={15} />
          <span>El extra operativo no cambia el N estadístico: refuerza la agenda de campo sin alterar cuotas ni pesos del diseño.</span>
        </div>

        <PanelAvanzado
          titulo="Auditoría y reproducibilidad"
          descripcion="semilla, corridas, candidatas y pesos del objetivo"
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
