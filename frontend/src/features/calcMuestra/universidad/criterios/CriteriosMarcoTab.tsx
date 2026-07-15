/**
 * Suite de criterios de inclusión/exclusión POR CATEGORÍA (sección Marco del
 * desk universitario). Dos bloques dirigidos por el mapeo de variables:
 * "Criterios de alumno (población)" y "Criterios de aula (marco)". El académico
 * marca qué categorías/umbrales entran y en qué capa; el marco duro lo
 * reconstruye el motor R. La selección vive en workspace.aulas_config
 * (criterios_seleccion) y se autosalva con el resto del workspace.
 *
 * Principio (ADR 0035): cero categoría hardcodeada y cero preset canónico. Todo
 * sale de `criterios_catalogo` que emite el motor a partir de la base y el mapeo;
 * la selección es 100% MANUAL: sin nada guardado arranca VACÍA (ningún criterio
 * asumido) y es el académico quien marca cada uno. No se inyecta ni reconcilia a
 * un canónico por heurística.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { GraduationCap, Loader2, RefreshCw, School, SlidersHorizontal } from "lucide-react";
import {
  normalizeCriteriosCatalogo,
  type CalcMuestraAulasState,
  type CalcMuestraWorkspace,
  type CriterioSeleccion,
  type CriteriosSeleccionMarco,
} from "../../../../api/client";
import { IconConfirm, IconSuccess, IconUndo } from "../../../../lib/icons";
import {
  minEligibleThreshold,
  setMinEligible,
  setRangosFacultad,
  setSeleccionVariable,
} from "../../dominio";
import { ELEGIBLES_POR_AULA_ID } from "../../dominio";
import { fmtInt } from "../../sharedCore";
import { marcoCriteriosDesactualizado } from "../shared/frame";
import { normalizeUniversityAulasConfig } from "../shared/study";
import {
  copiarVariableCriterio,
  reconciliarBorradorCriterios,
  type TipoBorradorCriterio,
} from "./borradorCriterios";
import { CriterioCard } from "./CriterioCard";
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
  onWorkspace,
  onReconstruir,
  puedeReconstruir,
  reconstruyendo,
}: {
  workspace: CalcMuestraWorkspace;
  aulasState: CalcMuestraAulasState | null;
  /** Nombres de facultad del marco (para excepciones y rangos). */
  facultades: string[];
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
  // Selección 100% MANUAL (ADR 0035): se muestra EXACTAMENTE lo confirmado en el
  // workspace, sin default canónico ni reconciliación silenciosa a un canónico.
  // Sin nada guardado arranca vacía (ningún criterio asumido). Persistir tal cual
  // evita que el marco recién construido quede "desactualizado" por un re-parcheo.
  const seleccion = useMemo<CriteriosSeleccionMarco>(
    () => config.criterios_seleccion ?? { byVariable: {} },
    [config.criterios_seleccion],
  );
  const [borrador, setBorrador] = useState<CriteriosSeleccionMarco>(() => seleccion);
  const [pendientes, setPendientes] = useState<Set<string>>(() => new Set());
  const pendientesRef = useRef(pendientes);
  const tiposBorrador = useMemo(() => {
    const tipos = new Map<string, TipoBorradorCriterio>();
    for (const variable of catalogo.variables) tipos.set(variable.id, variable.kind);
    tipos.set(ELEGIBLES_POR_AULA_ID, "minEligible");
    return tipos;
  }, [catalogo.variables]);

  useEffect(() => {
    pendientesRef.current = pendientes;
  }, [pendientes]);

  useEffect(() => {
    setBorrador((prev) =>
      reconciliarBorradorCriterios(seleccion, prev, pendientesRef.current, tiposBorrador),
    );
  }, [seleccion, tiposBorrador]);

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

  function patchSeleccion(next: CriteriosSeleccionMarco) {
    onWorkspace({ ...workspace, aulas_config: { ...config, criterios_seleccion: next } });
  }

  function marcarPendiente(id: string) {
    setPendientes((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  function editarVariable(id: string, sel: CriterioSeleccion) {
    setBorrador((prev) => setSeleccionVariable(prev, id, sel));
    marcarPendiente(id);
  }

  function editarRango(variableId: string, facultad: string, rangos: Array<[number, number]>) {
    setBorrador((prev) => setRangosFacultad(prev, facultad, rangos));
    marcarPendiente(variableId);
  }

  function editarUmbralElegibles(value: number) {
    setBorrador((prev) => setMinEligible(prev, value));
    marcarPendiente(ELEGIBLES_POR_AULA_ID);
  }

  function confirmarVariable(id: string, tipo: TipoBorradorCriterio) {
    patchSeleccion(copiarVariableCriterio(seleccion, borrador, id, tipo));
    setPendientes((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function descartarVariable(id: string, tipo: TipoBorradorCriterio) {
    setBorrador((prev) => copiarVariableCriterio(prev, seleccion, id, tipo));
    setPendientes((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  const umbralElegibles = minEligibleThreshold(borrador, config.min_elegibles_aula);
  const totalPendientes = pendientes.size;

  // Máquina de estados del recálculo del marco (§4.1.4): el botón exige
  // reconstruir cuando (a) es la primera vez (aún no hay marco), o (b) los
  // criterios confirmados difieren de los que construyeron el marco vigente.
  const marcoConstruido = Boolean(aulasState?.frame);
  const marcoDesactualizado = marcoCriteriosDesactualizado(aulasState?.frame, config.criterios_seleccion);
  const necesitaRecalculo = !marcoConstruido || marcoDesactualizado;
  const listoParaRecalcular = Boolean(puedeReconstruir) && !reconstruyendo && totalPendientes === 0;
  // El haz de luz (Anexo A.2) solo cuando hace falta reconstruir y no hay nada
  // pendiente de confirmar (si hay pendientes, la acción primero es confirmar).
  const beam = necesitaRecalculo && listoParaRecalcular;
  const estadoResumen =
    totalPendientes > 0
      ? `${totalPendientes} ${totalPendientes === 1 ? "variable pendiente de confirmar" : "variables pendientes de confirmar"}`
      : !marcoConstruido
        ? "Aún no has construido el marco: calcula la población y los cursos-horario elegibles."
        : marcoDesactualizado
          ? "Los criterios cambiaron — el marco vigente ya no los refleja. Recalcula para actualizarlo."
          : "El marco está al día con los criterios confirmados.";

  return (
    <div className="cmv2-crit" data-audit-ready={ready ? "true" : "false"}>
      {onReconstruir && (
        <div
          className="cmv2-crit-apply"
          role="group"
          aria-label="Calcular población y cursos-horario elegibles"
          data-attention={necesitaRecalculo ? "true" : "false"}
        >
          <span className="cmv2-crit-draft-summary" data-active={totalPendientes > 0 ? "true" : "false"} data-stale={marcoDesactualizado ? "true" : "false"}>
            {estadoResumen}
          </span>
          <div className="cmv2-crit-apply-actions">
            <button
              type="button"
              className="cmv2-crit-apply-btn"
              data-beam={beam ? "true" : "false"}
              disabled={!listoParaRecalcular}
              onClick={onReconstruir}
              title={totalPendientes > 0 ? "Confirma o descarta cada variable antes de recalcular el marco" : undefined}
            >
              <span className="cmv2-crit-apply-btn-inner">
                {reconstruyendo ? (
                  <Loader2 size={15} className="pulso-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw size={15} aria-hidden="true" />
                )}
                Calcular población y cursos-horario elegibles
              </span>
            </button>
          </div>
        </div>
      )}

      {!ready ? (
        <div className="cmv2-crit-empty">
          <SlidersHorizontal size={22} aria-hidden="true" />
          <strong>Aún no hay catálogo de categorías.</strong>
          <p>
            La suite enumera las categorías reales de tu base (dirigida por el mapeo de variables) y su conteo por
            curso-horario. Construye el marco desde tus fuentes para poblarla; luego marca qué categorías entran, con
            excepciones por facultad y su capa.
          </p>
        </div>
      ) : (
        <>
          {alumno.length > 0 && (
            <section className="cmv2-crit-section" data-scope="alumno">
              <header className="cmv2-crit-scope-head" data-scope="alumno">
                <span className="cmv2-crit-scope-bar" aria-hidden="true" />
                <span className="cmv2-crit-scope-icon" aria-hidden="true">
                  <GraduationCap size={18} />
                </span>
                <div className="cmv2-crit-scope-copy">
                  <h3>Criterios de estudiante</h3>
                </div>
              </header>
              <div className="cmv2-crit-grid">
                {alumno.map((variable) => (
                  <CriterioCard
                    key={variable.id}
                    variable={variable}
                    seleccion={borrador}
                    facultades={facRefs}
                    onSel={(sel) => editarVariable(variable.id, sel)}
                    onRango={(facultad, rangos) => editarRango(variable.id, facultad, rangos)}
                    pendiente={pendientes.has(variable.id)}
                    onConfirmar={() => confirmarVariable(variable.id, variable.kind)}
                    onDescartar={() => descartarVariable(variable.id, variable.kind)}
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
                  <h3>Criterios de curso-horario</h3>
                </div>
              </header>
              <div className="cmv2-crit-grid">
                {aula.map((variable) => (
                  <CriterioCard
                    key={variable.id}
                    variable={variable}
                    seleccion={borrador}
                    facultades={facRefs}
                    onSel={(sel) => editarVariable(variable.id, sel)}
                    onRango={(facultad, rangos) => editarRango(variable.id, facultad, rangos)}
                    pendiente={pendientes.has(variable.id)}
                    onConfirmar={() => confirmarVariable(variable.id, variable.kind)}
                    onDescartar={() => descartarVariable(variable.id, variable.kind)}
                  />
                ))}

                <article
                  className="cmv2-crit-card"
                  data-scope="aula"
                  data-kind="numeric"
                  data-pending={pendientes.has(ELEGIBLES_POR_AULA_ID) ? "true" : "false"}
                >
                  <header className="cmv2-crit-card-head">
                    <div className="cmv2-crit-card-title">
                      <strong>Elegibles por curso-horario</strong>
                      <span className="cmv2-crit-card-meta">
                        <span className="cmv2-crit-col">regla final del marco</span>
                      </span>
                    </div>
                    <div className="cmv2-crit-card-state">
                      <span className="cmv2-crit-head-count">≥ {fmtInt(umbralElegibles)}</span>
                      <span
                        className="cmv2-crit-state"
                        data-state={pendientes.has(ELEGIBLES_POR_AULA_ID) ? "pending" : "confirmed"}
                      >
                        {pendientes.has(ELEGIBLES_POR_AULA_ID) ? (
                          <span className="cmv2-crit-state-dot" aria-hidden="true" />
                        ) : (
                          <IconSuccess size={13} aria-hidden="true" />
                        )}
                        {pendientes.has(ELEGIBLES_POR_AULA_ID) ? "Cambios sin confirmar" : "Confirmado"}
                      </span>
                    </div>
                  </header>
                  <div className="cmv2-crit-card-body">
                    <label className="cmv2-crit-num-field">
                      <span>Mínimo de alumnos elegibles</span>
                      <input
                        type="number"
                        min={1}
                        value={umbralElegibles}
                        onChange={(e) => editarUmbralElegibles(Math.max(1, Math.round(Number(e.target.value) || 1)))}
                      />
                    </label>
                    <span className="cmv2-crit-num-hint">
                      Excluye del marco los cursos-horario con menos elegibles que el umbral.
                    </span>
                  </div>
                  {pendientes.has(ELEGIBLES_POR_AULA_ID) ? (
                    <div className="cmv2-crit-confirm" role="status" aria-live="polite">
                      <div className="cmv2-crit-confirm-copy">
                        <strong>Revisa este umbral antes de incorporarlo.</strong>
                        <span>Los demás criterios y el marco reconstruido no cambian todavía.</span>
                      </div>
                      <div className="cmv2-crit-confirm-actions">
                        <button
                          type="button"
                          className="cmv2-crit-discard-btn"
                          onClick={() => descartarVariable(ELEGIBLES_POR_AULA_ID, "minEligible")}
                        >
                          <IconUndo size={14} aria-hidden="true" />
                          Descartar
                        </button>
                        <button
                          type="button"
                          className="cmv2-crit-confirm-btn"
                          onClick={() => confirmarVariable(ELEGIBLES_POR_AULA_ID, "minEligible")}
                        >
                          <IconConfirm size={14} aria-hidden="true" />
                          Confirmar umbral
                        </button>
                      </div>
                    </div>
                  ) : null}
                </article>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
