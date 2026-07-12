/**
 * Suite de criterios de inclusión/exclusión POR CATEGORÍA (sección Marco del
 * desk universitario). Dos bloques dirigidos por el mapeo de variables:
 * "Criterios de alumno (población)" y "Criterios de aula (marco)". El académico
 * marca qué categorías/umbrales entran y en qué capa; el marco duro lo
 * reconstruye el motor R. La selección vive en workspace.aulas_config
 * (criterios_seleccion) y se autosalva con el resto del workspace.
 *
 * Principio: cero categoría hardcodeada. Todo sale de `criterios_catalogo` que
 * emite el motor a partir de la base y el mapeo; la selección canónica es solo
 * un preset seleccionable del backend, no lógica del frontend.
 */
import { useMemo } from "react";
import { GraduationCap, Loader2, RefreshCw, School, SlidersHorizontal } from "lucide-react";
import {
  normalizeCriteriosCatalogo,
  type CalcMuestraAulasState,
  type CalcMuestraWorkspace,
  type CriterioSeleccion,
} from "../../../../api/client";
import {
  computeImpactoMarco,
  minEligibleThreshold,
  seleccionInicial,
  setMinEligible,
  setRangosFacultad,
  setSeleccionVariable,
} from "../../dominio";
import { fmtInt } from "../../sharedCore";
import { normalizeUniversityAulasConfig } from "../shared/study";
import { CriterioCard } from "./CriterioCard";
import { ImpactoStrip } from "./ImpactoStrip";
import type { FacultadRef } from "./facultades";
import "./criterios.css";

/** Slug estable para claves de facultad (sin tildes, minúsculas, guiones). */
function slugFacultad(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function CriteriosMarcoTab({
  workspace,
  aulasState,
  facultades,
  marcoAulas,
  poblacionN,
  onWorkspace,
  onReconstruir,
  puedeReconstruir,
  reconstruyendo,
}: {
  workspace: CalcMuestraWorkspace;
  aulasState: CalcMuestraAulasState | null;
  /** Nombres de facultad del marco (para excepciones y rangos). */
  facultades: string[];
  /** Marco de aulas del ÚLTIMO build (cifra dura del motor), o null. */
  marcoAulas: number | null;
  /** Población objetivo N del último build, o null. */
  poblacionN: number | null;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
  onReconstruir?: () => void;
  puedeReconstruir?: boolean;
  reconstruyendo?: boolean;
}) {
  const catalogo = useMemo(
    () => normalizeCriteriosCatalogo(aulasState?.frame?.criterios_catalogo ?? null),
    [aulasState?.frame?.criterios_catalogo],
  );
  const config = useMemo(() => normalizeUniversityAulasConfig(workspace.aulas_config), [workspace.aulas_config]);
  const seleccion = useMemo(
    () => config.criterios_seleccion ?? seleccionInicial(catalogo),
    [config.criterios_seleccion, catalogo],
  );

  const facRefs: FacultadRef[] = useMemo(() => {
    const seen = new Set<string>();
    const out: FacultadRef[] = [];
    for (const nombre of facultades) {
      const key = slugFacultad(nombre);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({ key, label: nombre });
    }
    return out;
  }, [facultades]);

  const alumno = catalogo.variables.filter((v) => v.scope === "alumno");
  const aula = catalogo.variables.filter((v) => v.scope === "aula");
  const ready = catalogo.variables.length > 0;

  const impacto = useMemo(
    () =>
      computeImpactoMarco(
        catalogo,
        seleccion,
        {
          population: aulasState?.frame?.population,
          population_pool: aulasState?.frame?.population_pool,
          aula_frame: aulasState?.frame?.aula_frame,
        },
        { poblacionN, marcoAulas },
      ),
    [
      catalogo,
      seleccion,
      aulasState?.frame?.population,
      aulasState?.frame?.population_pool,
      aulasState?.frame?.aula_frame,
      poblacionN,
      marcoAulas,
    ],
  );

  function patchSeleccion(next: typeof seleccion) {
    onWorkspace({ ...workspace, aulas_config: { ...config, criterios_seleccion: next } });
  }
  function patchVariable(id: string, sel: CriterioSeleccion) {
    patchSeleccion(setSeleccionVariable(seleccion, id, sel));
  }
  function patchRango(facultad: string, rangos: Array<[number, number]>) {
    patchSeleccion(setRangosFacultad(seleccion, facultad, rangos));
  }

  const umbralElegibles = minEligibleThreshold(seleccion, config.min_elegibles_aula);

  return (
    <div className="cmv2-crit" data-audit-ready={ready ? "true" : "false"}>
      {onReconstruir && (
        <div className="cmv2-crit-apply" role="group" aria-label="Aplicar criterios al marco">
          <div className="cmv2-crit-apply-copy">
            <span>
              La selección modifica la configuración del proyecto; el <strong>marco duro</strong> se recalcula al
              reconstruirlo con el motor R. Los conteos por categoría son una estimación previa.
            </span>
            {(marcoAulas != null || poblacionN != null) && (
              <span className="cmv2-crit-apply-figures">
                Último marco: <strong>{marcoAulas != null ? fmtInt(marcoAulas) : "—"}</strong> aulas
                {poblacionN != null ? <> · población <strong>{fmtInt(poblacionN)}</strong></> : null}
              </span>
            )}
          </div>
          <button
            type="button"
            className="cmv2-crit-apply-btn"
            disabled={!puedeReconstruir || reconstruyendo}
            onClick={onReconstruir}
          >
            {reconstruyendo ? (
              <Loader2 size={14} className="pulso-spin" aria-hidden="true" />
            ) : (
              <RefreshCw size={14} aria-hidden="true" />
            )}
            Reconstruir marco
          </button>
        </div>
      )}

      {!ready ? (
        <div className="cmv2-crit-empty">
          <SlidersHorizontal size={22} aria-hidden="true" />
          <strong>Aún no hay catálogo de categorías.</strong>
          <p>
            La suite enumera las categorías reales de tu base (dirigida por el mapeo de variables) y su conteo por
            aula. Construye el marco desde tus fuentes para poblarla; luego marca qué categorías entran, con
            excepciones por facultad y su capa.
          </p>
        </div>
      ) : (
        <>
          <ImpactoStrip impacto={impacto} />

          {alumno.length > 0 && (
            <section className="cmv2-crit-section" data-scope="alumno">
              <header className="cmv2-crit-scope-head" data-scope="alumno">
                <span className="cmv2-crit-scope-bar" aria-hidden="true" />
                <span className="cmv2-crit-scope-icon" aria-hidden="true">
                  <GraduationCap size={18} />
                </span>
                <div className="cmv2-crit-scope-copy">
                  <h3>Criterios de estudiante <span className="cmv2-crit-scope-tag">población</span></h3>
                  <p>
                    Recortan la <strong>población N</strong> que se calcula: las categorías marcadas entran, las
                    demás salen y bajan N y sus cuotas.
                  </p>
                </div>
              </header>
              <div className="cmv2-crit-grid">
                {alumno.map((variable) => (
                  <CriterioCard
                    key={variable.id}
                    variable={variable}
                    seleccion={seleccion}
                    facultades={facRefs}
                    onSel={(sel) => patchVariable(variable.id, sel)}
                    onRango={patchRango}
                  />
                ))}
              </div>
            </section>
          )}

          {aula.length > 0 && (
            <section className="cmv2-crit-section" data-scope="aula">
              <header className="cmv2-crit-scope-head" data-scope="aula">
                <span className="cmv2-crit-scope-bar" aria-hidden="true" />
                <span className="cmv2-crit-scope-icon" aria-hidden="true">
                  <School size={18} />
                </span>
                <div className="cmv2-crit-scope-copy">
                  <h3>Criterios de aula <span className="cmv2-crit-scope-tag">marco</span></h3>
                  <p>
                    Definen el <strong>marco de curso-horario</strong> que se muestrea. Modalidad, tipo de sesión y
                    tipo de docente son constantes por aula (del catálogo), no por fila del estudiante.
                  </p>
                </div>
              </header>
              <div className="cmv2-crit-grid">
                {aula.map((variable) => (
                  <CriterioCard
                    key={variable.id}
                    variable={variable}
                    seleccion={seleccion}
                    facultades={facRefs}
                    onSel={(sel) => patchVariable(variable.id, sel)}
                    onRango={patchRango}
                  />
                ))}

                <article className="cmv2-crit-card" data-scope="aula" data-kind="numeric">
                  <header className="cmv2-crit-card-head">
                    <div className="cmv2-crit-card-title">
                      <strong>Elegibles por aula</strong>
                    </div>
                    <span className="cmv2-crit-head-count">≥ {fmtInt(umbralElegibles)}</span>
                  </header>
                  <div className="cmv2-crit-card-body">
                    <label className="cmv2-crit-num-field">
                      <span>Mínimo de alumnos elegibles</span>
                      <input
                        type="number"
                        min={1}
                        value={umbralElegibles}
                        onChange={(e) => patchSeleccion(setMinEligible(seleccion, Math.max(1, Math.round(Number(e.target.value) || 1))))}
                      />
                    </label>
                    <span className="cmv2-crit-num-hint">
                      Excluye del marco las aulas con menos elegibles que el umbral.
                    </span>
                  </div>
                </article>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
