/**
 * Tarjeta de una variable de criterio: cabecera con columna mapeada y conteo,
 * selector de CAPA (solo criterios de alumno), el control por `kind` y las
 * excepciones/rangos por facultad. No contiene lógica evaluable: despacha a los
 * controles y a los helpers del dominio.
 */
import type {
  CriterioSeleccion,
  CriterioVariable,
  CriteriosSeleccionMarco,
} from "../../../../api/client";
import { resumenVariable, seleccionVariable, unidadCriterio } from "../../dominio";
import { fmtInt } from "../../sharedCore";
import { ControlFlat, ControlHierarchical, ControlNumeric, ControlOrdinal } from "./controles";
import { ControlRange, ExcepcionesFacultad, type FacultadRef } from "./facultades";

/** Conteo/resumen textual de la selección de la variable. */
function ResumenCabecera({
  variable,
  seleccion,
}: {
  variable: CriterioVariable;
  seleccion: CriteriosSeleccionMarco;
}) {
  if (variable.kind === "range") {
    const n = Object.keys(seleccion.courseLevelRanges ?? {}).length;
    return <span className="cmv2-crit-head-count">{n ? `${n} con rango propio` : "sin rango (no filtra)"}</span>;
  }
  if (variable.kind === "numeric") {
    const sel = seleccionVariable(seleccion, variable.id);
    const t = sel.threshold;
    const texto = !t
      ? "sin filtro"
      : t.op === ">="
        ? `≥ ${fmtInt(t.min ?? 0)}`
        : t.op === "<="
          ? `≤ ${fmtInt(t.max ?? 0)}`
          : `${fmtInt(t.min ?? 0)} – ${fmtInt(t.max ?? 0)}`;
    return <span className="cmv2-crit-head-count">{texto}</span>;
  }
  const r = resumenVariable(variable, seleccion);
  if (variable.kind === "ordinal") {
    return <span className="cmv2-crit-head-count">{r.seleccionadas} de {r.total} valores</span>;
  }
  return (
    <span className="cmv2-crit-head-count">
      {r.seleccionadas} de {r.total}
      {r.aulasTotales > 0 ? (
        <>
          {" · "}
          <strong>~{fmtInt(r.aulasCubiertas)}</strong> {unidadCriterio(variable)}
        </>
      ) : null}
    </span>
  );
}

export function CriterioCard({
  variable,
  seleccion,
  facultades,
  onSel,
  onRango,
}: {
  variable: CriterioVariable;
  seleccion: CriteriosSeleccionMarco;
  facultades: FacultadRef[];
  /** Patchea la selección de ESTA variable (byVariable). */
  onSel: (next: CriterioSeleccion) => void;
  /** Fija los rangos de nivel de una facultad (variable range). */
  onRango: (facultad: string, rangos: Array<[number, number]>) => void;
}) {
  const sel = seleccionVariable(seleccion, variable.id);
  const mapeada = Boolean(variable.mappedColumn);

  return (
    <article className="cmv2-crit-card" data-scope={variable.scope} data-kind={variable.kind}>
      <header className="cmv2-crit-card-head">
        <div className="cmv2-crit-card-title">
          <strong>{variable.label}</strong>
          {variable.estratifica ? <span className="cmv2-crit-badge">estratifica</span> : null}
        </div>
        <ResumenCabecera variable={variable} seleccion={seleccion} />
      </header>
      <div className="cmv2-crit-card-meta">
        {mapeada ? (
          <span className="cmv2-crit-col">columna: <code>{variable.mappedColumn}</code></span>
        ) : (
          <span className="cmv2-crit-col cmv2-crit-col-warn">variable sin columna mapeada</span>
        )}
      </div>

      <div className="cmv2-crit-card-body">
        {variable.kind === "flat" && <ControlFlat variable={variable} sel={sel} onSel={onSel} />}
        {variable.kind === "hierarchical" && (
          <ControlHierarchical variable={variable} sel={sel} onSel={onSel} />
        )}
        {variable.kind === "numeric" && <ControlNumeric variable={variable} sel={sel} onSel={onSel} />}
        {variable.kind === "ordinal" && <ControlOrdinal variable={variable} sel={sel} onSel={onSel} />}
        {variable.kind === "range" && (
          <ControlRange variable={variable} seleccion={seleccion} facultades={facultades} onRango={onRango} />
        )}
      </div>

      {(variable.kind === "flat" || variable.kind === "hierarchical") && (
        <ExcepcionesFacultad variable={variable} sel={sel} facultades={facultades} onSel={onSel} />
      )}
    </article>
  );
}
