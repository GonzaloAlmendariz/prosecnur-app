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
import type { CalcMuestraAulasCriterioRadiografiaV2Distribution } from "../../../../api/calcMuestraCriteriosRadiografia";
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
import { analizarEtiquetaCategoria, type EtiquetaCategoria } from "./etiquetaCategoria";
import { CategoriaEvidencia, dominioCategorias, EjeCategorias } from "./CategoriaEvidencia";
import { Switch, SwitchTri } from "./Switch";

type SelChange = (next: CriterioSeleccion) => void;

/** Memoiza el análisis por etiqueta: se consulta varias veces por fila. */
const AGRUPADAS_CACHE = new Map<string, EtiquetaCategoria>();
function etiquetaAgrupada(label: string): EtiquetaCategoria {
  const hit = AGRUPADAS_CACHE.get(label);
  if (hit) return hit;
  const valor = analizarEtiquetaCategoria(label);
  AGRUPADAS_CACHE.set(label, valor);
  return valor;
}

function etiquetaFlatConCortes(label: string) {
  if (!label.includes(",")) return label;
  const segmentos = label.split(",");
  return segmentos.flatMap((segmento, index) => (
    index < segmentos.length - 1
      ? [segmento, ",", <wbr key={index} />]
      : [segmento]
  ));
}

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
/** Lo que una categoría aporta al marco ejecutado, publicado por R. */
/**
 * ADR 0057 · Lo que una categoría necesita para poder decidirse.
 *
 * La unidad de decisión es la categoría, no el criterio: todo lo que hace falta
 * para incluirla o excluirla viaja con ella y se muestra en su mismo
 * contenedor. Antes esta información vivía repartida entre el conmutador, una
 * consola de radiografía aparte y un embudo con su propio lenguaje, así que se
 * elegía en una zona de la pantalla mirando otra.
 */
export type AporteCategoria = {
  /** Alumnos únicos elegibles del marco con esta categoría. */
  elegibles: number | null;
  /** Cursos-horario elegibles con esta categoría. */
  ch: number | null;
  /** Cursos-horario totales con esta categoría (contraste). */
  chContraste: number | null;
  /**
   * Distribución de alumnos elegibles por curso-horario en esta categoría.
   * La calcula R; React sólo la dibuja. Da el promedio, su forma y los
   * cuantiles con los que se elige P25 o mediana.
   */
  distribucion?: CalcMuestraAulasCriterioRadiografiaV2Distribution | null;
  /** Proporción 0–1 esperada de asistencia: convierte elegibles en presentes. */
  tasaAsistencia?: number | null;
};

export function ControlFlat({
  variable,
  sel,
  onSel,
  aporte,
}: {
  variable: CriterioVariable;
  sel: CriterioSeleccion;
  onSel: SelChange;
  /**
   * S4/S5 · El conmutador mostraba solo el conteo del CATÁLOGO —lo que hay en
   * la base antes de aplicar criterio alguno—, así que se decidía contra un
   * número que no dice qué hace el criterio. Medido en el instrumento: PREGRADO
   * marcaba «25.155 estudiantes» mientras el marco publica 20.879 alumnos
   * únicos elegibles, y MAESTRIA marcaba «2.819» con aporte real 0.
   * R publica el aporte por segmento en su fila Total; React no lo suma.
   */
  aporte?: (segmentKey: string) => AporteCategoria | null;
}) {
  const cats = variable.categories ?? [];
  const unidad = unidadCriterio(variable);
  // Lista larga → fluye en varias columnas dentro de la tarjeta ancha.
  const long = cats.length >= 8;
  // ADR 0057, regla 3: la escala es del criterio, no de cada caja.
  const dominio = dominioCategorias(cats.map((cat) => aporte?.(cat.key) ?? null));
  return (
    <div className="cmv2-crit-cats">
      <AccionesSet variable={variable} onSel={onSel} />
      {dominio ? <EjeCategorias dominio={dominio} /> : null}
      {/* Sin contrato geométrico, y medido en los dos sentidos. Con
          `intrinsic` el comprobador reporta ~8,55 px de interior sin usar en
          CADA ítem: son el `min-height: 44px` de `.cmv2-crit-item` —el objetivo
          táctil— repartido por `align-items: center`, no capacidad
          desperdiciada. Con `equal` falla el alto, porque una etiqueta larga
          como «POR SER ALUMNO DE LA ESC.ED ESTUDIOS ESPECI» envuelve a dos
          líneas y su fila mide el doble. Es el mismo hueco de vocabulario que
          bloquea las tiras de chips de Formularios: ver la decisión 8 del goal
          visual. */}
      <ul
        className="cmv2-crit-list"
        data-long={long ? "true" : undefined}
        data-qa-geometry-group="calc-muestra/criterios-categorias"
        data-qa-geometry-contract="intrinsic"
        aria-label={`Categorías de ${variable.label}`}
      >
        {cats.map((cat) => {
          const checked = categoriaMarcada(sel, cat.key);
          // Solo variantes que agregan información: si la única variante es el
          // mismo texto del label (caso típico), la línea duplicada sobra.
          const variantes = (cat.variants ?? []).filter(
            (variante) => variante.trim().toLocaleLowerCase("es") !== cat.label.trim().toLocaleLowerCase("es"),
          );
          return (
            <li
              key={cat.key}
              className="cmv2-crit-item"
              data-checked={checked}
              data-qa-geometry-member
              data-qa-geometry-capacity="owned"
            >
              <div className="cmv2-crit-item-main">
                <Switch
                  checked={checked}
                  onToggle={() => onSel(toggleCategoria(sel, cat.key))}
                  ariaLabel={etiquetaAgrupada(cat.label).agrupadas.length
                    ? `${etiquetaAgrupada(cat.label).base}, agrupa ${etiquetaAgrupada(cat.label).agrupadas.length} valores`
                    : cat.label}
                />
                <span className="cmv2-crit-item-label">
                  {/* T1: la fuente concatena varios valores en una etiqueta. Se
                      muestra el nombre del grupo y se declara cuántos agrupa; el
                      detalle queda en el título y en la línea secundaria. */}
                  {etiquetaFlatConCortes(etiquetaAgrupada(cat.label).base)}
                  {etiquetaAgrupada(cat.label).agrupadas.length ? (
                    <span
                      className="cmv2-crit-item-agrupa"
                      data-agrupa={etiquetaAgrupada(cat.label).agrupadas.length}
                      title={etiquetaAgrupada(cat.label).agrupadas.join(" · ")}
                    >
                      agrupa {etiquetaAgrupada(cat.label).agrupadas.length}
                    </span>
                  ) : null}
                </span>
              </div>
              {etiquetaAgrupada(cat.label).agrupadas.length ? (
                <span className="cmv2-crit-item-agrupadas">
                  {etiquetaAgrupada(cat.label).agrupadas.join(" · ")}
                </span>
              ) : null}
              <span className="cmv2-crit-item-count">
                {fmtInt(cat.aulas)} <em>{unidad} en la base</em>
              </span>
              {(() => {
                const dato = aporte?.(cat.key) ?? null;
                if (!dato || (dato.elegibles === null && dato.ch === null)) return null;
                // ADR 0057 · Una categoría con CH disponibles trae su evidencia
                // completa aquí mismo: cifras, distribución sobre la escala del
                // criterio, cuantiles y presentes esperados. Sin CH no hay nada
                // que distribuir, así que basta la línea de cifras.
                if (!dato.distribucion || !dominio) {
                  return (
                    <span className="cmv2-crit-item-aporte" data-aporta={dato.ch === 0 ? "cero" : "si"}>
                      {dato.elegibles === null ? "—" : fmtInt(dato.elegibles)} elegibles ·{" "}
                      {dato.ch === null ? "—" : fmtInt(dato.ch)} CH <em>en el marco</em>
                    </span>
                  );
                }
                return <CategoriaEvidencia aporte={dato} dominio={dominio} />;
              })()}
              {variantes.length ? (
                <span className="cmv2-crit-item-variants" title={variantes.join(" · ")}>
                  {variantes.join(" · ")}
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
        La regla del curso-horario es <strong>{match === "any" ? "al menos uno" : "todos"}</strong>: un curso-horario pasa si{" "}
        {match === "any" ? "≥1 de sus docentes" : "todos sus docentes"} caen en el set marcado. El conteo es de{" "}
        <strong>cursos-horario</strong> con ese tipo de docente.
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
                {fmtInt(group.aulas)} <em>cursos-horario</em>
              </span>
            </div>
            <ul
              className="cmv2-crit-list cmv2-crit-list-nested"
              data-qa-geometry-group="calc-muestra/criterios-subcategorias"
              data-qa-geometry-contract="intrinsic"
            >
              {group.children.map((child) => {
                const checked = categoriaMarcada(sel, child.key);
                return (
                  <li
                    key={child.key}
                    className="cmv2-crit-item"
                    data-checked={checked}
                    data-qa-geometry-member
                    data-qa-geometry-capacity="owned"
                  >
                    <div className="cmv2-crit-item-main">
                      <Switch checked={checked} onToggle={() => onSel(toggleCategoria(sel, child.key))} ariaLabel={child.label} />
                      <span className="cmv2-crit-item-label">{child.label}</span>
                    </div>
                    <span className="cmv2-crit-item-count">
                      {fmtInt(child.aulas)} <em>cursos-horario</em>
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

  // Ventana admitida sobre el rango observado (solo presentación): un tramo
  // resaltado que traduce el umbral elegido a una banda del eje real.
  const span = Math.max(1, range.max - range.min);
  const clamp = (value: number) => Math.min(Math.max(value, range.min), range.max);
  const lo = op === "<=" ? range.min : clamp(min);
  const hi = op === ">=" ? range.max : clamp(max);
  const fillLeft = op === "none" ? 0 : ((Math.min(lo, hi) - range.min) / span) * 100;
  const fillRight = op === "none" ? 100 : ((Math.max(lo, hi) - range.min) / span) * 100;

  return (
    <div className="cmv2-crit-numeric" data-mode={op}>
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
      {op !== "none" ? (
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
      ) : (
        <p className="cmv2-crit-num-empty">Sin filtro: se admiten todos los valores del rango observado.</p>
      )}
      <div className="cmv2-crit-num-scale">
        <div className="cmv2-crit-num-scale-head">
          <span>Rango observado en la base</span>
          <strong>{fmtInt(range.min)} – {fmtInt(range.max)}</strong>
        </div>
        <div className="cmv2-crit-num-track" aria-hidden="true">
          <i style={{ left: `${fillLeft}%`, right: `${100 - fillRight}%` }} />
        </div>
      </div>
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
