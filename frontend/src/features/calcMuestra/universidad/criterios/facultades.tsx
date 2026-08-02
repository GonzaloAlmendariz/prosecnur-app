/**
 * Controles por facultad de la suite de criterios: rango de nivel del curso
 * (range) y excepciones por facultad de un set de categorías (flat/jerárquico).
 * Presentacionales; la lógica evaluable vive en el dominio.
 */
import { useState } from "react";
import { X } from "lucide-react";
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

  const conRango = facultades.filter((fac) => rangosFacultad(seleccion, fac.key).length > 0).length;

  return (
    <div className="cmv2-crit-range">
      <p className="cmv2-crit-range-note" role="note">
        Sin rango, la facultad admite <strong>todos los niveles</strong> y no filtra.
        Activa una facultad para limitarla a un tramo de niveles.
        {conRango > 0 ? <span className="cmv2-crit-range-note-count"> · {conRango} con rango propio</span> : null}
      </p>
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
          <div key={fac.key} className="cmv2-crit-range-row" role="row" data-active={activo}>
            <span className="cmv2-crit-range-fac" role="rowheader" title={fac.label}>{fac.label}</span>
            <span className="cmv2-crit-range-apply">
              <Switch
                checked={activo}
                ariaLabel={`Aplicar rango de nivel en ${fac.label}`}
                onToggle={() => onRango(fac.key, activo ? [] : [[desde, hasta]])}
              />
            </span>
            <span className="cmv2-crit-range-inputs" data-active={activo}>
              {activo ? (
                <>
                  <select
                    className="cmv2-crit-range-select"
                    value={desde}
                    aria-label={`Nivel mínimo en ${fac.label}`}
                    onChange={(e) => onRango(fac.key, [[Number(e.target.value), hasta]])}
                  >
                    {valores.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                  <span className="cmv2-crit-range-dash">–</span>
                  <select
                    className="cmv2-crit-range-select"
                    value={hasta}
                    aria-label={`Nivel máximo en ${fac.label}`}
                    onChange={(e) => onRango(fac.key, [[desde, Number(e.target.value)]])}
                  >
                    {valores.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </>
              ) : (
                <span className="cmv2-crit-range-all">Todos los niveles</span>
              )}
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
  const cats = categoriasDeVariable(variable);
  const exceptions = sel.exceptions ?? {};
  const entradas = Object.entries(exceptions);

  // F24 · La decisión vive junto a la facultad, no en un formulario de alta.
  //
  // Medido: la superficie de criterios no decía «excepción» ni una vez, porque
  // esto era un toggle cerrado que abría un alta genérica —elige facultad,
  // elige operación, elige categorías—. Ese orden exige saber de antemano cuál
  // facultad se desvía, que es justo lo que el usuario viene a averiguar. Ahora
  // se listan **todas** las facultades con lo que cada una aplica, y ajustar es
  // tocar su fila. La estructura persistida no cambia: sigue compilando a
  // `exceptions[facKey]`.
  const [ajustando, setAjustando] = useState<string | null>(null);

  if (!facultades.length) return null;

  const globalLabels = (sel.categories ?? []).map(
    (k) => cats.find((c) => c.key === k)?.label ?? k,
  );

  function alternarCategoria(facKey: string, catKey: string) {
    const actual = exceptions[facKey];
    const base = actual ? actual.categories : (sel.categories ?? []);
    const next = base.includes(catKey)
      ? base.filter((k) => k !== catKey)
      : [...base, catKey];
    // Sin categorías propias la facultad no queda vacía: vuelve al general.
    if (!next.length) {
      onSel(removeExcepcion(sel, facKey));
      return;
    }
    onSel(upsertExcepcion(sel, facKey, { categories: next, op: "replace" }));
  }

  return (
    <div className="cmv2-crit-exc" data-grano="facultad">
      <div className="cmv2-crit-exc-head">
        <strong>Decisión por facultad</strong>
        <small>
          {entradas.length
            ? `${entradas.length} de ${facultades.length} con criterio propio`
            : `las ${facultades.length} aplican el criterio general`}
        </small>
      </div>
      <ul className="cmv2-crit-exc-list">
        {facultades.map((f) => {
          const propio = exceptions[f.key];
          const labels = propio
            ? propio.categories.map((k) => cats.find((c) => c.key === k)?.label ?? k)
            : globalLabels;
          const abierta = ajustando === f.key;
          return (
            <li
              key={f.key}
              className="cmv2-crit-exc-item"
              data-propio={propio ? "true" : "false"}
            >
              <div className="cmv2-crit-exc-fila">
                <span className="cmv2-crit-exc-fac">{f.label}</span>
                <span className="cmv2-crit-exc-cats">
                  {labels.length ? labels.join(", ") : "sin categorías"}
                </span>
                <span className="cmv2-crit-exc-op">
                  {propio ? "criterio propio" : "general"}
                </span>
                <button
                  type="button"
                  className="cmv2-crit-exc-ajustar"
                  aria-expanded={abierta}
                  onClick={() => setAjustando(abierta ? null : f.key)}
                >
                  {abierta ? "Listo" : "Ajustar"}
                </button>
                {propio && (
                  <button
                    type="button"
                    className="cmv2-crit-exc-remove"
                    aria-label={`Devolver ${f.label} al criterio general`}
                    onClick={() => onSel(removeExcepcion(sel, f.key))}
                  >
                    <X size={13} aria-hidden="true" />
                  </button>
                )}
              </div>
              {abierta && (
                <div className="cmv2-crit-exc-cats-pick">
                  {cats.map((cat) => {
                    const on = (propio ? propio.categories : (sel.categories ?? [])).includes(cat.key);
                    return (
                      <button
                        key={cat.key}
                        type="button"
                        className="cmv2-crit-chip"
                        aria-pressed={on}
                        onClick={() => alternarCategoria(f.key, cat.key)}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
