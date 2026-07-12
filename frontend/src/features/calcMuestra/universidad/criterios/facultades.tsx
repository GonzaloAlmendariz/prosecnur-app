/**
 * Controles por facultad de la suite de criterios: rango de nivel del curso
 * (range) y excepciones por facultad de un set de categorías (flat/jerárquico).
 * Presentacionales; la lógica evaluable vive en el dominio.
 */
import { useState } from "react";
import { Plus, X } from "lucide-react";
import type {
  CriterioSeleccion,
  CriterioVariable,
  CriteriosSeleccionMarco,
} from "../../../../api/client";
import {
  categoriasDeVariable,
  rangosFacultad,
  removeExcepcion,
  upsertExcepcion,
} from "../../dominio";
import { Switch } from "./Switch";

export type FacultadRef = { key: string; label: string };

/** range (nivel de curso): rango [min,max] admitido por facultad. */
export function ControlRange({
  variable,
  seleccion,
  facultades,
  onRango,
}: {
  variable: CriterioVariable;
  seleccion: CriteriosSeleccionMarco;
  facultades: FacultadRef[];
  /** Fija (o limpia con []) los rangos de una facultad. */
  onRango: (facultad: string, rangos: Array<[number, number]>) => void;
}) {
  const valores = (variable.values ?? []).slice().sort((a, b) => a - b);
  const min = valores.length ? valores[0] : 0;
  const max = valores.length ? valores[valores.length - 1] : 0;

  if (!facultades.length) {
    return (
      <p className="cmv2-crit-empty-note">
        El rango se define por facultad; aún no hay facultades en el marco. Construye el marco para listarlas.
      </p>
    );
  }

  return (
    <div className="cmv2-crit-range">
      <div className="cmv2-crit-range-head" role="row">
        <span role="columnheader">Facultad</span>
        <span role="columnheader">Aplica</span>
        <span role="columnheader">Niveles admitidos</span>
      </div>
      {facultades.map((fac) => {
        const rangos = rangosFacultad(seleccion, fac.key);
        const activo = rangos.length > 0;
        const desde = activo ? rangos[0][0] : min;
        const hasta = activo ? rangos[0][1] : max;
        return (
          <div key={fac.key} className="cmv2-crit-range-row" role="row">
            <span className="cmv2-crit-range-fac" role="rowheader">{fac.label}</span>
            <span className="cmv2-crit-range-apply">
              <Switch
                checked={activo}
                ariaLabel={`Aplicar rango de nivel en ${fac.label}`}
                onToggle={() => onRango(fac.key, activo ? [] : [[desde, hasta]])}
              />
            </span>
            <span className="cmv2-crit-range-inputs" data-active={activo}>
              <select
                className="cmv2-crit-from-select"
                value={desde}
                disabled={!activo}
                aria-label={`Nivel mínimo en ${fac.label}`}
                onChange={(e) => onRango(fac.key, [[Number(e.target.value), hasta]])}
              >
                {valores.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              <span className="cmv2-crit-range-dash">–</span>
              <select
                className="cmv2-crit-from-select"
                value={hasta}
                disabled={!activo}
                aria-label={`Nivel máximo en ${fac.label}`}
                onChange={(e) => onRango(fac.key, [[desde, Number(e.target.value)]])}
              >
                {valores.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Excepciones por facultad de un set de categorías (op add/replace). */
export function ExcepcionesFacultad({
  variable,
  sel,
  facultades,
  onSel,
}: {
  variable: CriterioVariable;
  sel: CriterioSeleccion;
  facultades: FacultadRef[];
  onSel: (next: CriterioSeleccion) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const cats = categoriasDeVariable(variable);
  const exceptions = sel.exceptions ?? {};
  const entradas = Object.entries(exceptions);
  const facByKey = new Map(facultades.map((f) => [f.key, f.label]));

  // Estado del formulario de alta.
  const [facSel, setFacSel] = useState("");
  const [op, setOp] = useState<"add" | "replace">("add");
  const [catsSel, setCatsSel] = useState<string[]>([]);

  const disponibles = facultades.filter((f) => !(f.key in exceptions));

  function agregar() {
    if (!facSel || catsSel.length === 0) return;
    onSel(upsertExcepcion(sel, facSel, { categories: catsSel, op }));
    setFacSel("");
    setCatsSel([]);
    setOp("add");
  }

  if (!facultades.length) return null;

  return (
    <div className="cmv2-crit-exc">
      <button
        type="button"
        className="cmv2-crit-exc-toggle"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        Excepciones por facultad {entradas.length ? `(${entradas.length})` : ""}
      </button>
      {abierto && (
        <div className="cmv2-crit-exc-body">
          {entradas.length > 0 && (
            <ul className="cmv2-crit-exc-list">
              {entradas.map(([facKey, override]) => (
                <li key={facKey} className="cmv2-crit-exc-item">
                  <span className="cmv2-crit-exc-fac">{facByKey.get(facKey) ?? facKey}</span>
                  <span className="cmv2-crit-exc-op">{override.op === "replace" ? "reemplaza por" : "añade"}</span>
                  <span className="cmv2-crit-exc-cats">
                    {override.categories
                      .map((k) => cats.find((c) => c.key === k)?.label ?? k)
                      .join(", ")}
                  </span>
                  <button
                    type="button"
                    className="cmv2-crit-exc-remove"
                    aria-label={`Quitar excepción de ${facByKey.get(facKey) ?? facKey}`}
                    onClick={() => onSel(removeExcepcion(sel, facKey))}
                  >
                    <X size={13} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {disponibles.length > 0 ? (
            <div className="cmv2-crit-exc-form">
              <select
                className="cmv2-crit-from-select"
                value={facSel}
                onChange={(e) => setFacSel(e.target.value)}
                aria-label="Facultad de la excepción"
              >
                <option value="">Facultad…</option>
                {disponibles.map((f) => (
                  <option key={f.key} value={f.key}>{f.label}</option>
                ))}
              </select>
              <div className="cmv2-crit-seg" role="group" aria-label="Operación de la excepción">
                <button type="button" className="cmv2-crit-seg-btn" aria-pressed={op === "add"} onClick={() => setOp("add")}>
                  Añadir
                </button>
                <button type="button" className="cmv2-crit-seg-btn" aria-pressed={op === "replace"} onClick={() => setOp("replace")}>
                  Reemplazar
                </button>
              </div>
              <div className="cmv2-crit-exc-cats-pick">
                {cats.map((cat) => {
                  const on = catsSel.includes(cat.key);
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      className="cmv2-crit-chip"
                      aria-pressed={on}
                      onClick={() =>
                        setCatsSel((prev) => (on ? prev.filter((k) => k !== cat.key) : [...prev, cat.key]))
                      }
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="cmv2-crit-exc-add"
                disabled={!facSel || catsSel.length === 0}
                onClick={agregar}
              >
                <Plus size={13} aria-hidden="true" /> Agregar excepción
              </button>
            </div>
          ) : (
            <p className="cmv2-crit-empty-note">Todas las facultades ya tienen una excepción.</p>
          )}
        </div>
      )}
    </div>
  );
}
