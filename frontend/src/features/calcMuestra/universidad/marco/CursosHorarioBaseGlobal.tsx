/**
 * Bloque «Base global · todas las facultades» de la vista integrada de
 * «Cursos-horario»: el set POR DEFECTO de los criterios de curso-horario que
 * cada facultad hereda si no decide propio. Reusa los controles globales
 * existentes del scope aula (ControlFlat/Hierarchical/Numeric/Ordinal/Range,
 * TeacherTypeOrden, CriterioComposicionCard), compactados y SIN el detalle por
 * facultad (esa decisión vive ahora en cada bloque de facultad) ni el flujo de
 * confirmar por-tarjeta (lo asume la barra global de la pestaña).
 */
import type {
  CalcMuestraWorkspaceAulasConfig,
  CriterioSeleccion,
  CriterioVariable,
  CriteriosSeleccionMarco,
} from "../../../../api/client";
import { Lightbulb } from "lucide-react";
import {
  minEligibleThreshold,
  resumenVariable,
  seleccionVariable,
  unidadCriterio,
} from "../../dominio";
import { fmtInt } from "../../sharedCore";
import {
  ControlFlat,
  ControlHierarchical,
  ControlNumeric,
  ControlOrdinal,
} from "../criterios/controles";
import { ControlRange, type FacultadRef } from "../criterios/facultades";
import { TeacherTypeOrden } from "../criterios/TeacherTypeOrden";
import { CriterioComposicionCard } from "../criterios/CriterioComposicionCard";
import { CondicionCursoAviso } from "../criterios/CondicionCursoAviso";
import {
  minimoSugerido,
  presentesEsperados,
  tasaAsistencia,
} from "../criterios/minElegiblesModel";

/** Conteo compacto de la selección global de una variable (cabecera). */
function GlobalCount({
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
    const t = seleccionVariable(seleccion, variable.id).threshold;
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
  const noRestringe = r.seleccionadas === 0 || r.seleccionadas === r.total;
  if (variable.kind === "ordinal") {
    return (
      <span className="cmv2-crit-head-count">
        {r.seleccionadas} de {r.total} valores{noRestringe ? " · no filtra" : ""}
      </span>
    );
  }
  return (
    <span className="cmv2-crit-head-count">
      {r.seleccionadas} de {r.total}
      {noRestringe ? (
        " · no filtra"
      ) : r.aulasTotales > 0 ? (
        <>
          {" · "}
          <strong>~{fmtInt(r.aulasCubiertas)}</strong> {unidadCriterio(variable)}
        </>
      ) : null}
    </span>
  );
}

/** Tarjeta compacta del set GLOBAL de una variable de criterio de aula. */
function GlobalCriterioCard({
  variable,
  seleccion,
  facultades,
  teacherTypeOrden,
  onSelVariable,
  onRango,
  onTeacherTypeOrden,
}: {
  variable: CriterioVariable;
  seleccion: CriteriosSeleccionMarco;
  facultades: FacultadRef[];
  teacherTypeOrden: string[] | undefined;
  onSelVariable: (variableId: string, next: CriterioSeleccion) => void;
  onRango: (facultad: string, rangos: Array<[number, number]>) => void;
  onTeacherTypeOrden: (keys: string[]) => void;
}) {
  const sel = seleccionVariable(seleccion, variable.id);
  const mapeada = Boolean(variable.mappedColumn);
  const longList = variable.kind === "flat" && (variable.categories?.length ?? 0) >= 8;
  const onSel = (next: CriterioSeleccion) => onSelVariable(variable.id, next);
  return (
    <article className="cmv2-crit-card" data-scope="aula" data-kind={variable.kind} data-long={longList ? "true" : undefined} data-pending="false">
      <header className="cmv2-crit-card-head">
        <div className="cmv2-crit-card-title">
          <strong>{variable.label}</strong>
          {variable.estratifica ? <span className="cmv2-crit-badge">estratifica</span> : null}
          <span className="cmv2-crit-card-meta">
            {mapeada ? (
              <span className="cmv2-crit-col">columna: <code>{variable.mappedColumn}</code></span>
            ) : (
              <span className="cmv2-crit-col cmv2-crit-col-warn">variable sin columna mapeada</span>
            )}
          </span>
        </div>
        <div className="cmv2-crit-card-state">
          <GlobalCount variable={variable} seleccion={seleccion} />
        </div>
      </header>
      <div className="cmv2-crit-card-body">
        {variable.id === "condicion_curso" ? <CondicionCursoAviso variable={variable} /> : null}
        {variable.kind === "flat" && <ControlFlat variable={variable} sel={sel} onSel={onSel} />}
        {variable.kind === "hierarchical" && <ControlHierarchical variable={variable} sel={sel} onSel={onSel} />}
        {variable.id === "teacher_type" ? (
          <TeacherTypeOrden variable={variable} orden={teacherTypeOrden} onOrden={onTeacherTypeOrden} />
        ) : null}
        {variable.kind === "numeric" && <ControlNumeric variable={variable} sel={sel} onSel={onSel} />}
        {variable.kind === "ordinal" && <ControlOrdinal variable={variable} sel={sel} onSel={onSel} />}
        {variable.kind === "range" && (
          <ControlRange variable={variable} seleccion={seleccion} facultades={facultades} onRango={onRango} />
        )}
      </div>
    </article>
  );
}

/** Tarjeta compacta del mínimo GLOBAL de elegibles por aula + tasa de asistencia. */
function GlobalMinCard({
  seleccion,
  fallbackUmbral,
  onUmbral,
  onTasa,
}: {
  seleccion: CriteriosSeleccionMarco;
  fallbackUmbral: number;
  onUmbral: (value: number) => void;
  onTasa: (tasa: number | null) => void;
}) {
  const umbral = minEligibleThreshold(seleccion, fallbackUmbral);
  const tasa = tasaAsistencia(seleccion);
  const tasaPct = tasa == null ? null : Math.round(tasa * 100);
  const sugerido = minimoSugerido(umbral, tasa);
  const presentes = presentesEsperados(umbral, tasa);
  return (
    <article className="cmv2-crit-card" data-scope="aula" data-kind="numeric" data-pending="false">
      <header className="cmv2-crit-card-head">
        <div className="cmv2-crit-card-title">
          <strong>Elegibles por curso-horario</strong>
          <span className="cmv2-crit-card-meta">
            <span className="cmv2-crit-col">criterio 7 · mínimo general del marco</span>
          </span>
        </div>
        <div className="cmv2-crit-card-state">
          <span className="cmv2-crit-head-count">≥ {fmtInt(umbral)}</span>
        </div>
      </header>
      <div className="cmv2-crit-card-body">
        <div className="cmv2-crit-num-inputs">
          <label className="cmv2-crit-num-field">
            <span>Mínimo general de elegibles</span>
            <input
              type="number"
              min={1}
              value={umbral}
              onChange={(e) => onUmbral(Math.max(1, Math.round(Number(e.target.value) || 1)))}
            />
          </label>
          <label className="cmv2-crit-num-field">
            <span>Tasa de asistencia esperada (%)</span>
            <input
              type="number"
              min={1}
              max={100}
              placeholder="opcional"
              value={tasaPct ?? ""}
              onChange={(e) => {
                const raw = e.target.value.trim();
                if (!raw) return onTasa(null);
                const pct = Number(raw);
                onTasa(Number.isFinite(pct) ? Math.min(100, Math.max(1, Math.round(pct))) / 100 : null);
              }}
            />
          </label>
        </div>
        <span className="cmv2-crit-num-hint">
          Excluye del marco los cursos-horario con menos elegibles que el mínimo de su facultad (o este general si no
          tiene uno propio). El mínimo propio de cada facultad se ajusta en su bloque, más abajo.
        </span>
        {tasa != null && sugerido != null ? (
          <div className="cmv2-crit-sug" role="note">
            <Lightbulb size={14} aria-hidden="true" />
            <p className="cmv2-crit-sug-copy">
              Con asistencia del {tasaPct}%, un mínimo de {fmtInt(umbral)} encuentra ~{fmtInt(presentes ?? 0)}{" "}
              presentes el día de la aplicación; para encontrar {fmtInt(umbral)} sugerimos exigir{" "}
              <strong>{fmtInt(sugerido)}</strong> matriculados. La sugerencia no se aplica sola.
            </p>
            {sugerido !== umbral ? (
              <button type="button" className="cmv2-crit-sug-btn" onClick={() => onUmbral(sugerido)}>
                Usar sugerido general ({fmtInt(sugerido)})
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function CursosHorarioBaseGlobal({
  aulaVariables,
  seleccion,
  facultades,
  teacherTypeOrden,
  config,
  soloAjustes = false,
  onSelVariable,
  onRango,
  onTeacherTypeOrden,
  onUmbral,
  onTasa,
  onPatchConfig,
}: {
  /** Variables de scope aula del catálogo (session/condition/teacher/level…). */
  aulaVariables: CriterioVariable[];
  seleccion: CriteriosSeleccionMarco;
  facultades: FacultadRef[];
  teacherTypeOrden: string[] | undefined;
  config: CalcMuestraWorkspaceAulasConfig;
  /** Solo los ajustes transversales del marco (mínimo general, tasa, composición
   *  c8); oculta los criterios de set/rango que ya se deciden por facultad. */
  soloAjustes?: boolean;
  onSelVariable: (variableId: string, next: CriterioSeleccion) => void;
  onRango: (facultad: string, rangos: Array<[number, number]>) => void;
  onTeacherTypeOrden: (keys: string[]) => void;
  onUmbral: (value: number) => void;
  onTasa: (tasa: number | null) => void;
  onPatchConfig: (patch: Partial<CalcMuestraWorkspaceAulasConfig>) => void;
}) {
  return (
    <div
      className="cmv2-crit-grid cmv2-chfp-global-grid"
      data-qa-geometry-group="calc-muestra/criterios-ch-globales"
      data-qa-geometry-contract="intrinsic"
    >
      {!soloAjustes &&
        aulaVariables.map((variable) => (
          <GlobalCriterioCard
            key={variable.id}
            variable={variable}
            seleccion={seleccion}
            facultades={facultades}
            teacherTypeOrden={teacherTypeOrden}
            onSelVariable={onSelVariable}
            onRango={onRango}
            onTeacherTypeOrden={onTeacherTypeOrden}
          />
        ))}
      <GlobalMinCard
        seleccion={seleccion}
        fallbackUmbral={config.min_elegibles_aula}
        onUmbral={onUmbral}
        onTasa={onTasa}
      />
      <CriterioComposicionCard config={config} onPatch={onPatchConfig} />
    </div>
  );
}
