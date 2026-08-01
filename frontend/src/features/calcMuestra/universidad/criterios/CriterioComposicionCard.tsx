/**
 * Tarjeta del criterio 8 — composición homogénea del curso-horario, en DOS
 * pasos ordenados (reunión con el asesor muestral, 2026-07-15):
 *   1. ≥ pct de los matriculados pertenecen a la MISMA FACULTAD del curso
 *      (require_faculty_prevalence + min_faculty_prevalence_pct),
 *   2. ≥ pct cursan el MISMO NIVEL del curso
 *      (require_cycle_homogeneity + min_cycle_homogeneity_pct).
 * El orden importa: el paso de nivel solo tiene sentido sobre cursos ya
 * anclados a su facultad; aplicado solo, "vuela" el marco (los cursos con
 * mezcla natural de facultades desaparecen).
 *
 * El toggle legacy require_min_prevalence (elegibles/matrícula) queda como
 * métrica REFERENCIAL, visualmente secundaria: no es el criterio 8.
 *
 * Persistencia: edita aulas_config directo con autosave inmediato (mismo
 * patrón que teacher_type_orden); no pasa por el borrador confirmable porque
 * no vive en criterios_seleccion.
 */
import { useState } from "react";
import type { CalcMuestraWorkspaceAulasConfig } from "../../../../api/client";
import { Switch } from "./Switch";

/** Proporción 0–1 → porcentaje entero para el input. */
function pctDe(prop: number | undefined, fallback: number): number {
  const v = typeof prop === "number" && Number.isFinite(prop) ? prop : fallback;
  return Math.round(Math.min(1, Math.max(0, v)) * 100);
}

/** Input de porcentaje (50–100) que persiste proporción 0–1. */
function InputPct({
  value,
  fallback,
  disabled,
  ariaLabel,
  onChange,
}: {
  value: number | undefined;
  fallback: number;
  disabled: boolean;
  ariaLabel: string;
  onChange: (prop: number) => void;
}) {
  return (
    <label className="cmv2-crit-paso-pct">
      <input
        type="number"
        min={50}
        max={100}
        step={5}
        disabled={disabled}
        value={pctDe(value, fallback)}
        aria-label={ariaLabel}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isFinite(n)) return;
          onChange(Math.min(100, Math.max(1, Math.round(n))) / 100);
        }}
      />
      <span aria-hidden="true">%</span>
    </label>
  );
}

export function CriterioComposicionCard({
  config,
  onPatch,
}: {
  /** Config de aulas ya normalizado (la tab lo deriva del workspace). */
  config: CalcMuestraWorkspaceAulasConfig;
  /** Persiste el patch en aulas_config (autosave inmediato del workspace). */
  onPatch: (patch: Partial<CalcMuestraWorkspaceAulasConfig>) => void;
}) {
  const [legacyAbierto, setLegacyAbierto] = useState(false);
  const paso1 = config.require_faculty_prevalence ?? false;
  const paso2 = config.require_cycle_homogeneity ?? false;
  const activos = (paso1 ? 1 : 0) + (paso2 ? 1 : 0);
  const legacyOn = config.require_min_prevalence ?? false;

  return (
    <article className="cmv2-crit-card" data-scope="aula" data-kind="pasos" data-pending="false">
      <header className="cmv2-crit-card-head">
        <div className="cmv2-crit-card-title">
          <strong>Composición del curso-horario</strong>
          <span className="cmv2-crit-card-meta">
            <span className="cmv2-crit-col">criterio 8 · dos pasos en orden</span>
          </span>
        </div>
        <div className="cmv2-crit-card-state">
          <span className="cmv2-crit-head-count">
            {activos === 0 ? "apagado · no filtra" : `${activos} de 2 pasos activos`}
          </span>
        </div>
      </header>

      <div className="cmv2-crit-card-body">
        <p className="cmv2-crit-paso-intro">
          Exige que cada curso-horario esté compuesto por estudiantes de la facultad y el nivel del curso. Se aplica
          en este orden: <strong>primero facultad, luego nivel</strong>. Activar solo el paso de nivel recorta el
          marco de forma drástica: los cursos con mezcla natural de facultades (transversales, electivos) quedarían
          fuera sin haber fijado antes a quién pertenece el curso.
        </p>

        <ol
          className="cmv2-crit-pasos"
          data-qa-geometry-group="calc-muestra/composicion-ch-pasos"
          data-qa-geometry-contract="intrinsic"
        >
          <li
            className="cmv2-crit-paso"
            data-active={paso1 ? "true" : "false"}
            data-qa-geometry-member
            data-qa-geometry-capacity="owned"
          >
            <span className="cmv2-crit-paso-rank" aria-hidden="true">1</span>
            <div className="cmv2-crit-paso-copy">
              <strong>Misma facultad del curso</strong>
              <span>
                Al menos el {pctDe(config.min_faculty_prevalence_pct, 0.8)}% de los matriculados pertenece a la
                facultad que dicta el curso.
              </span>
            </div>
            <InputPct
              value={config.min_faculty_prevalence_pct}
              fallback={0.8}
              disabled={!paso1}
              ariaLabel="Porcentaje mínimo de la misma facultad"
              onChange={(prop) => onPatch({ min_faculty_prevalence_pct: prop })}
            />
            <Switch
              checked={paso1}
              ariaLabel="Exigir misma facultad del curso (paso 1 del criterio 8)"
              onToggle={() => onPatch({ require_faculty_prevalence: !paso1 })}
            />
          </li>
          <li
            className="cmv2-crit-paso"
            data-active={paso2 ? "true" : "false"}
            data-qa-geometry-member
            data-qa-geometry-capacity="owned"
          >
            <span className="cmv2-crit-paso-rank" aria-hidden="true">2</span>
            <div className="cmv2-crit-paso-copy">
              <strong>Mismo nivel del curso</strong>
              <span>
                Al menos el {pctDe(config.min_cycle_homogeneity_pct, 0.8)}% de los matriculados cursa el nivel del
                curso (no el ciclo individual del estudiante).
              </span>
            </div>
            <InputPct
              value={config.min_cycle_homogeneity_pct}
              fallback={0.8}
              disabled={!paso2}
              ariaLabel="Porcentaje mínimo del mismo nivel del curso"
              onChange={(prop) => onPatch({ min_cycle_homogeneity_pct: prop })}
            />
            <Switch
              checked={paso2}
              ariaLabel="Exigir mismo nivel del curso (paso 2 del criterio 8)"
              onToggle={() => onPatch({ require_cycle_homogeneity: !paso2 })}
            />
          </li>
        </ol>
        <span className="cmv2-crit-num-hint">
          Se guarda al instante; recalcula el marco (botón de arriba) para ver su efecto en los cursos-horario.
        </span>

        <div className="cmv2-crit-legacy">
          <button
            type="button"
            className="cmv2-crit-exc-toggle"
            aria-expanded={legacyAbierto}
            onClick={() => setLegacyAbierto((v) => !v)}
          >
            Prevalencia de elegibles (referencial){legacyOn ? " · activa" : ""}
          </button>
          {legacyAbierto ? (
            <div className="cmv2-crit-legacy-body">
              <div className="cmv2-crit-legacy-row">
                <div className="cmv2-crit-paso-copy">
                  <strong>Prevalencia de elegibles (referencial)</strong>
                  <span>
                    Proporción de elegibles sobre la matrícula total del curso-horario. Es una métrica referencial
                    heredada: <strong>no forma parte del criterio 8</strong> y normalmente queda apagada.
                  </span>
                </div>
                <InputPct
                  value={config.min_prevalence_pct}
                  fallback={0.8}
                  disabled={!legacyOn}
                  ariaLabel="Porcentaje mínimo de prevalencia de elegibles (referencial)"
                  onChange={(prop) => onPatch({ min_prevalence_pct: prop })}
                />
                <Switch
                  checked={legacyOn}
                  ariaLabel="Exigir prevalencia de elegibles (métrica referencial legacy)"
                  onToggle={() => onPatch({ require_min_prevalence: !legacyOn })}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
