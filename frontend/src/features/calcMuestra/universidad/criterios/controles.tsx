/**
 * Controles de selección por `kind` para la suite de criterios del marco.
 * Presentacionales y puros: reciben la selección de la variable y emiten la
 * siguiente vía los helpers del dominio (`criteriosMarco`). La lógica evaluable
 * vive en el dominio; aquí solo se presenta.
 */
import type {
  CriterioSeleccion,
  CriterioVariable,
} from "../../../../api/client";
import {
  categoriaMarcada,
  clavesDeVariable,
  estadoGrupo,
  ordinalIncluido,
  setFromValue,
  setThreshold,
  toggleCategoria,
  toggleGrupo,
  toggleOrdinal,
  unidadCriterio,
} from "../../dominio";
import { fmtInt } from "../../sharedCore";
import { Switch, SwitchTri } from "./Switch";

type SelChange = (next: CriterioSeleccion) => void;

/** Barra "Todas / Ninguna" para sets flat (fuerza modo include). */
function AccionesSet({ variable, onSel }: { variable: CriterioVariable; onSel: SelChange }) {
  const claves = clavesDeVariable(variable);
  return (
    <div className="cmv2-crit-quick" role="group" aria-label="Selección rápida">
      <button type="button" className="cmv2-crit-quick-btn" onClick={() => onSel({ mode: "include", categories: [...claves] })}>
        Todas
      </button>
      <button type="button" className="cmv2-crit-quick-btn" onClick={() => onSel({ mode: "include", categories: [] })}>
        Ninguna
      </button>
    </div>
  );
}

/** flat: lista de categorías con switch + conteo (estudiantes o aulas según scope). */
export function ControlFlat({
  variable,
  sel,
  onSel,
}: {
  variable: CriterioVariable;
  sel: CriterioSeleccion;
  onSel: SelChange;
}) {
  const cats = variable.categories ?? [];
  const unidad = unidadCriterio(variable);
  return (
    <div className="cmv2-crit-cats">
      <AccionesSet variable={variable} onSel={onSel} />
      <ul className="cmv2-crit-list" aria-label={`Categorías de ${variable.label}`}>
        {cats.map((cat) => {
          const checked = categoriaMarcada(sel, cat.key);
          return (
            <li key={cat.key} className="cmv2-crit-item" data-checked={checked}>
              <div className="cmv2-crit-item-main">
                <Switch checked={checked} onToggle={() => onSel(toggleCategoria(sel, cat.key))} ariaLabel={cat.label} />
                <span className="cmv2-crit-item-label">{cat.label}</span>
              </div>
              <span className="cmv2-crit-item-count">
                {fmtInt(cat.aulas)} <em>{unidad}</em>
              </span>
              {cat.variants?.length ? (
                <span className="cmv2-crit-item-variants" title={cat.variants.join(" · ")}>
                  {cat.variants.join(" · ")}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** hierarchical: grupos por prefijo con switch de grupo (tri-estado) y hojas. */
export function ControlHierarchical({
  variable,
  sel,
  onSel,
}: {
  variable: CriterioVariable;
  sel: CriterioSeleccion;
  onSel: SelChange;
}) {
  const groups = variable.groups ?? [];
  const match = sel.match ?? "any";
  return (
    <div className="cmv2-crit-groups">
      <div className="cmv2-crit-match" role="note">
        La regla del aula es <strong>{match === "any" ? "al menos uno" : "todos"}</strong>: un aula pasa si{" "}
        {match === "any" ? "≥1 de sus docentes" : "todos sus docentes"} caen en el set marcado. El conteo es de{" "}
        <strong>aulas</strong> con ese tipo de docente.
      </div>
      {groups.map((group) => {
        const childKeys = group.children.map((c) => c.key);
        const estado = estadoGrupo(sel, childKeys);
        return (
          <div key={group.key} className="cmv2-crit-group" data-estado={estado}>
            <div className="cmv2-crit-group-head">
              <div className="cmv2-crit-item-main">
                <SwitchTri estado={estado} onToggle={() => onSel(toggleGrupo(sel, childKeys))} ariaLabel={group.label} />
                <span className="cmv2-crit-group-title">{group.label}</span>
              </div>
              <span className="cmv2-crit-item-count">
                {fmtInt(group.aulas)} <em>aulas</em>
              </span>
            </div>
            <ul className="cmv2-crit-list cmv2-crit-list-nested">
              {group.children.map((child) => {
                const checked = categoriaMarcada(sel, child.key);
                return (
                  <li key={child.key} className="cmv2-crit-item" data-checked={checked}>
                    <div className="cmv2-crit-item-main">
                      <Switch checked={checked} onToggle={() => onSel(toggleCategoria(sel, child.key))} ariaLabel={child.label} />
                      <span className="cmv2-crit-item-label">{child.label}</span>
                    </div>
                    <span className="cmv2-crit-item-count">
                      {fmtInt(child.aulas)} <em>aulas</em>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

const NUMERIC_OPS: Array<{ id: "none" | ">=" | "<=" | "between"; label: string }> = [
  { id: "none", label: "Sin filtro" },
  { id: ">=", label: "Mínimo (≥)" },
  { id: "<=", label: "Máximo (≤)" },
  { id: "between", label: "Rango" },
];

/** numeric (edad): segmentado sin filtro / ≥ / ≤ / rango + inputs. */
export function ControlNumeric({
  variable,
  sel,
  onSel,
}: {
  variable: CriterioVariable;
  sel: CriterioSeleccion;
  onSel: SelChange;
}) {
  const range = variable.numericRange ?? { min: 0, max: 100 };
  const op = sel.threshold?.op ?? "none";
  const min = sel.threshold?.min ?? range.min;
  const max = sel.threshold?.max ?? range.max;

  function pickOp(next: (typeof NUMERIC_OPS)[number]["id"]) {
    if (next === "none") return onSel(setThreshold(sel, undefined));
    if (next === ">=") return onSel(setThreshold(sel, { op: ">=", min }));
    if (next === "<=") return onSel(setThreshold(sel, { op: "<=", max }));
    return onSel(setThreshold(sel, { op: "between", min, max }));
  }

  return (
    <div className="cmv2-crit-numeric">
      <div className="cmv2-crit-seg" role="group" aria-label={`Umbral de ${variable.label}`}>
        {NUMERIC_OPS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="cmv2-crit-seg-btn"
            aria-pressed={op === item.id}
            onClick={() => pickOp(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {op !== "none" && (
        <div className="cmv2-crit-num-inputs">
          {(op === ">=" || op === "between") && (
            <label className="cmv2-crit-num-field">
              <span>Desde</span>
              <input
                type="number"
                value={min}
                min={range.min}
                max={range.max}
                onChange={(e) =>
                  onSel(setThreshold(sel, { op, min: Math.round(Number(e.target.value) || 0), ...(op === "between" ? { max } : {}) }))
                }
              />
            </label>
          )}
          {(op === "<=" || op === "between") && (
            <label className="cmv2-crit-num-field">
              <span>Hasta</span>
              <input
                type="number"
                value={max}
                min={range.min}
                max={range.max}
                onChange={(e) =>
                  onSel(setThreshold(sel, { op, max: Math.round(Number(e.target.value) || 0), ...(op === "between" ? { min } : {}) }))
                }
              />
            </label>
          )}
        </div>
      )}
      <span className="cmv2-crit-num-hint">
        Rango observado en la base: {fmtInt(range.min)} – {fmtInt(range.max)}.
      </span>
    </div>
  );
}

/** ordinal (ciclo): chips por valor + atajo "desde N en adelante". */
export function ControlOrdinal({
  variable,
  sel,
  onSel,
}: {
  variable: CriterioVariable;
  sel: CriterioSeleccion;
  onSel: SelChange;
}) {
  const valores = variable.values ?? [];
  const usaFrom = sel.fromValue != null;
  return (
    <div className="cmv2-crit-ordinal">
      <div className="cmv2-crit-chips" role="group" aria-label={`Valores de ${variable.label}`}>
        {valores.map((v) => {
          const on = ordinalIncluido(sel, v);
          return (
            <button
              key={v}
              type="button"
              className="cmv2-crit-chip"
              aria-pressed={on}
              onClick={() => onSel(toggleOrdinal(sel, v, valores))}
            >
              {v}
            </button>
          );
        })}
      </div>
      <div className="cmv2-crit-from">
        <Switch
          checked={usaFrom}
          ariaLabel="Desde un valor en adelante"
          onToggle={() => onSel(setFromValue(sel, usaFrom ? undefined : valores[Math.min(1, valores.length - 1)] ?? valores[0]))}
        />
        <span>Desde un valor en adelante</span>
        {usaFrom && (
          <select
            className="cmv2-crit-from-select"
            value={sel.fromValue ?? valores[0]}
            onChange={(e) => onSel(setFromValue(sel, Number(e.target.value)))}
            aria-label="Valor mínimo incluido"
          >
            {valores.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
