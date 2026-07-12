/**
 * Tablero de criterios de AULA. Las reglas base llevan controles reales cuando
 * se pasa `controles` (patch sobre workspace.aulas_config, aplicado en el
 * siguiente build del marco). Los opcionales (c7/c8) exponen su umbral
 * editable y muestran su impacto medido cuando el perfil lo trae; su
 * activación real en el build la gobierna decisiones.opcionalesActivos.
 */
import { useState } from "react";
import { Lock, Plus, TriangleAlert, X } from "lucide-react";
import type { CalcMuestraWorkspaceAulasConfig } from "../../../../api/client";
import { fmtInt, fmtPct } from "../../sharedCore";
import type { CriterioAula } from "../../dominio";
import { NotaPorQue } from "./NotaPorQue";

export type ControlesCriterios = {
  config: CalcMuestraWorkspaceAulasConfig;
  onConfig: (patch: Partial<CalcMuestraWorkspaceAulasConfig>) => void;
};

function Interruptor({
  checked,
  label,
  onChange,
  disabled,
}: {
  checked: boolean;
  label: string;
  onChange?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="rec-switch"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
    >
      <span className="rec-switch-knob" aria-hidden="true" />
    </button>
  );
}

/** Editor de lista de patrones de exclusión (chips + alta por texto). */
export function PatronesExclusion({
  valores,
  onChange,
  placeholder,
  ariaLabel,
}: {
  valores: string[];
  onChange: (valores: string[]) => void;
  placeholder: string;
  ariaLabel: string;
}) {
  const [texto, setTexto] = useState("");
  const agregar = () => {
    const nuevo = texto.trim().toLowerCase();
    if (!nuevo || valores.includes(nuevo)) {
      setTexto("");
      return;
    }
    onChange([...valores, nuevo]);
    setTexto("");
  };
  return (
    <div className="rec-patrones" aria-label={ariaLabel}>
      <div className="rec-patrones-chips">
        {valores.length === 0 && <span className="rec-patrones-vacio">sin exclusiones</span>}
        {valores.map((patron) => (
          <span key={patron} className="rec-patron">
            {patron}
            <button
              type="button"
              aria-label={`Quitar ${patron}`}
              onClick={() => onChange(valores.filter((v) => v !== patron))}
            >
              <X size={11} aria-hidden="true" />
            </button>
          </span>
        ))}
      </div>
      <div className="rec-patrones-alta">
        <input
          type="text"
          value={texto}
          placeholder={placeholder}
          aria-label={`Agregar patrón a ${ariaLabel}`}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              agregar();
            }
          }}
        />
        <button type="button" onClick={agregar} disabled={!texto.trim()} aria-label="Agregar patrón">
          <Plus size={12} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/** Controles del criterio según su id (solo los que el motor R aplica). */
function ControlCriterio({ id, controles }: { id: string; controles: ControlesCriterios }) {
  const { config, onConfig } = controles;
  if (id === "presencial") {
    return (
      <div className="rec-criterio-control">
        <label className="rec-criterio-switchrow">
          <Interruptor
            checked={config.require_in_person ?? true}
            label="Exigir modalidad presencial"
            onChange={() => onConfig({ require_in_person: !(config.require_in_person ?? true) })}
          />
          <span>Exigir presencial</span>
        </label>
        {(config.require_in_person ?? true) && (
          <PatronesExclusion
            valores={config.exclude_modality_patterns ?? []}
            onChange={(valores) => onConfig({ exclude_modality_patterns: valores })}
            placeholder="patrón a excluir (p. ej. virtual)"
            ariaLabel="Modalidades excluidas"
          />
        )}
      </div>
    );
  }
  if (id === "tipo-curso") {
    return (
      <div className="rec-criterio-control">
        <PatronesExclusion
          valores={config.exclude_session_patterns ?? []}
          onChange={(valores) => onConfig({ exclude_session_patterns: valores })}
          placeholder="tipo a excluir (p. ej. seminario)"
          ariaLabel="Tipos de curso excluidos"
        />
        <span className="rec-criterio-hint">Lista vacía: todos los tipos de sesión entran al marco.</span>
      </div>
    );
  }
  if (id === "min-elegibles") {
    return (
      <div className="rec-criterio-control">
        <label className="rec-criterio-numrow">
          <span>Mínimo de elegibles por aula</span>
          <input
            type="number"
            min={1}
            value={config.min_elegibles_aula}
            aria-label="Mínimo de elegibles por aula"
            onChange={(e) => {
              const valor = Math.max(1, Math.round(Number(e.target.value) || 1));
              onConfig({ min_elegibles_aula: valor });
            }}
          />
        </label>
      </div>
    );
  }
  if (id === "docente") {
    return (
      <div className="rec-criterio-control">
        <label className="rec-criterio-switchrow">
          <Interruptor
            checked={config.require_stable_teacher ?? false}
            label="Exigir docente estable"
            onChange={() => onConfig({ require_stable_teacher: !(config.require_stable_teacher ?? false) })}
          />
          <span>Exigir docente estable</span>
        </label>
        {(config.require_stable_teacher ?? false) && (
          <>
            <PatronesExclusion
              valores={config.accepted_teacher_type_patterns ?? []}
              onChange={(valores) => onConfig({ accepted_teacher_type_patterns: valores })}
              placeholder="tipo aceptado (p. ej. contratado)"
              ariaLabel="Tipos de docente aceptados"
            />
            <span className="rec-criterio-hint">
              La regla es «al menos un docente del aula» con un tipo aceptado; las aulas con varios
              docentes cumplen si uno lo es.
            </span>
          </>
        )}
      </div>
    );
  }
  if (id === "sede") {
    return (
      <div className="rec-criterio-control">
        <PatronesExclusion
          valores={config.accepted_campuses ?? []}
          onChange={(valores) => onConfig({ accepted_campuses: valores })}
          placeholder="sede a incluir"
          ariaLabel="Sedes incluidas en el operativo"
        />
        <span className="rec-criterio-hint">Lista vacía: todas las sedes entran al marco.</span>
      </div>
    );
  }
  if (id === "nivel-unidad") {
    return (
      <div className="rec-criterio-control">
        <span className="rec-criterio-hint">
          El rango se edita en la tabla «Rango de nivel del curso por unidad» de esta misma
          pestaña; sin entradas, el criterio no filtra.
        </span>
      </div>
    );
  }
  return null;
}

/** Umbral (%) editable de un criterio opcional (c7 prevalencia / c8 homogeneidad). */
function UmbralOpcional({ id, controles }: { id: string; controles: ControlesCriterios }) {
  const { config, onConfig } = controles;
  const campo = id === "c7" ? "min_prevalence_pct" : "min_cycle_homogeneity_pct";
  const valor = (id === "c7" ? config.min_prevalence_pct : config.min_cycle_homogeneity_pct) ?? 0.8;
  return (
    <div className="rec-criterio-control">
      <label className="rec-criterio-numrow">
        <span>Umbral (%)</span>
        <input
          type="number"
          min={0}
          max={100}
          step={1}
          value={Math.round(valor * 100)}
          aria-label={`Umbral del criterio ${id}`}
          onChange={(e) => {
            const pct = Math.min(100, Math.max(0, Number(e.target.value) || 0));
            onConfig({ [campo]: pct / 100 });
          }}
        />
      </label>
    </div>
  );
}

export function TableroCriterios({
  criterios,
  activos,
  onToggle,
  marcoBase,
  controles,
}: {
  criterios: CriterioAula[];
  /** Ids de criterios opcionales activados. */
  activos: string[];
  onToggle: (id: string) => void;
  /** Aulas del marco con solo las reglas base (referencia del impacto). */
  marcoBase: number | null;
  /** Controles reales sobre workspace.aulas_config (proyecto activo). */
  controles?: ControlesCriterios;
}) {
  const base = criterios.filter((c) => c.tipo === "base");
  const opcionales = criterios.filter((c) => c.tipo === "opcional");

  return (
    <div className="rec-criterios">
      <div className="rec-criterios-grupo">
        <h4>Reglas base — definen el marco</h4>
        <div className="rec-criterios-grid">
          {base.map((criterio, i) => (
            <article key={criterio.id} className="rec-criterio" data-tipo="base">
              <header>
                <span className="rec-criterio-num" aria-hidden="true">{i + 1}</span>
                <strong>{criterio.etiqueta}</strong>
                <Lock size={12} className="rec-criterio-lock" aria-label="Regla base del método" />
              </header>
              <p className="rec-criterio-regla">{criterio.regla}</p>
              {criterio.excepciones && <p className="rec-criterio-excepcion">{criterio.excepciones}</p>}
              {controles && <ControlCriterio id={criterio.id} controles={controles} />}
              <NotaPorQue>{criterio.porQue}</NotaPorQue>
            </article>
          ))}
        </div>
      </div>

      {opcionales.length > 0 && (
        <div className="rec-criterios-grupo">
          <h4>Criterios opcionales</h4>
          <div className="rec-criterios-grid">
            {opcionales.map((criterio) => {
              const activo = activos.includes(criterio.id);
              const impacto = criterio.impactoActivar;
              const rompe = (impacto?.facultadesRotas.length ?? 0) > 0;
              return (
                <article key={criterio.id} className="rec-criterio" data-tipo="opcional" data-activo={activo || undefined}>
                  <header>
                    <strong>{criterio.etiqueta}</strong>
                    <Interruptor
                      checked={activo}
                      label={`Activar ${criterio.etiqueta}`}
                      disabled={controles != null && !impacto}
                      onChange={() => onToggle(criterio.id)}
                    />
                  </header>
                  <p className="rec-criterio-regla">{criterio.regla}</p>
                  {controles && <UmbralOpcional id={criterio.id} controles={controles} />}
                  {!impacto && (
                    <p className="rec-criterio-excepcion">
                      {controles
                        ? "Efecto sobre el marco: se mide sobre la base del proyecto al reconstruir el marco."
                        : "Efecto sobre el marco: se mide sobre la base del proyecto al construir el marco."}
                    </p>
                  )}
                  {impacto && (
                    <dl className="rec-criterio-impacto" data-activo={activo || undefined}>
                      <div>
                        <dt>Marco</dt>
                        <dd>
                          {fmtInt(marcoBase)} → <strong>{fmtInt(impacto.aulas)}</strong> aulas
                        </dd>
                      </div>
                      <div>
                        <dt>Cobertura</dt>
                        <dd>{fmtPct(impacto.coberturaPct)}</dd>
                      </div>
                      <div>
                        <dt>Cuotas</dt>
                        <dd>
                          {rompe ? (
                            <span className="rec-criterio-rotas">
                              <TriangleAlert size={12} aria-hidden="true" />
                              se rompe: {impacto.facultadesRotas.join(" · ")}
                            </span>
                          ) : (
                            "todas las unidades siguen llenando su cuota"
                          )}
                        </dd>
                      </div>
                    </dl>
                  )}
                  <NotaPorQue>{criterio.porQue}</NotaPorQue>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
