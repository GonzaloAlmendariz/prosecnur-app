/**
 * Tarjeta de una variable de criterio: cabecera con columna mapeada y conteo,
 * selector de CAPA (solo criterios de alumno), el control por `kind` y las
 * excepciones/rangos por facultad. No contiene lógica evaluable: despacha a los
 * controles y a los helpers del dominio.
 */
import type {
  CalcMuestraAulasExploracion,
  CalcMuestraAulasParticularidadSessionType,
  CalcMuestraSessionTypeImpacto,
  CriterioSeleccion,
  CriterioVariable,
  CriteriosSeleccionMarco,
} from "../../../../api/client";
import type { ReactNode } from "react";
import type { AporteCategoria } from "./controles";
import { IconConfirm, IconSuccess, IconUndo } from "../../../../lib/icons";
import { resumenVariable, seleccionVariable, unidadCriterio } from "../../dominio";
import { fmtInt } from "../../sharedCore";
import { CondicionCursoAviso } from "./CondicionCursoAviso";
import { ControlFlat, ControlHierarchical, ControlNumeric, ControlOrdinal } from "./controles";
import { ControlRange, type FacultadRef } from "./facultades";
import { TeacherTypeOrden } from "./TeacherTypeOrden";
import { SESSION_TYPE_VARIABLE_ID } from "./tipoSesionModel";
import { TipoSesionPorFacultad } from "./TipoSesionPorFacultad";
import type { RecorteCriterioAlumno } from "./recorteCriteriosAlumnoModel";

/**
 * Lo que ESTE criterio recortó en el marco construido.
 *
 * La cabecera ya avisa cuando la selección no restringe —nada o todo marcado—,
 * pero eso mira la declaración, no el efecto. Un criterio puede tener un
 * subconjunto propio seleccionado y aun así no dejar fuera a nadie, porque las
 * categorías elegidas cubren a toda la base. Es lo que pasó en el proyecto real
 * de 2025-2: `level` estaba declarado, se leía como restrictivo y dejaba pasar
 * las 136.284 filas. La única forma de verlo era calcularlo a mano.
 *
 * La cifra es del marco EJECUTADO, no de lo que hay en pantalla: si la selección
 * cambió y todavía no se reconstruyó, describe el marco anterior.
 */
function RecorteMedido({
  recorte,
  desactualizado,
}: {
  recorte: RecorteCriterioAlumno | null;
  desactualizado: boolean;
}) {
  if (!recorte) return null;
  const capaNoRecorta = recorte.layer !== "marco";
  return (
    <p
      className="cmv2-crit-recorte-medido"
      data-estado={capaNoRecorta ? "otra-capa" : recorte.noRecorta ? "inerte" : "recorta"}
      role="note"
    >
      {capaNoRecorta ? (
        <>
          Deja pasar <strong>{fmtInt(recorte.pasan)}</strong> · en capa{" "}
          <em>{recorte.layer}</em> no recorta el marco, se valida después
        </>
      ) : recorte.noRecorta ? (
        <>
          En el marco construido dejó fuera a <strong>0</strong>: está declarado
          y no filtra a nadie
        </>
      ) : recorte.recorta != null ? (
        <>
          En el marco construido dejó fuera a <strong>{fmtInt(recorte.recorta)}</strong>
          {recorte.pctRecorte != null ? <> ({(recorte.pctRecorte * 100).toFixed(1)}%)</> : null}
          {" · "}pasan {fmtInt(recorte.pasan)}
        </>
      ) : (
        <>
          Dejó pasar <strong>{fmtInt(recorte.pasan)}</strong> en el marco construido
        </>
      )}
      {desactualizado ? " · del marco anterior, la selección cambió" : null}
    </p>
  );
}

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
  // Un criterio con NADA o TODO marcado no restringe (el motor deja pasar todo:
  // set vacío == set completo == sin filtro). Solo un subconjunto propio filtra;
  // en ese caso mostramos la estimación de unidades cubiertas.
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

export function CriterioCard({
  variable,
  seleccion,
  facultades,
  onSel,
  onRango,
  pendiente,
  onConfirmar,
  onDescartar,
  teacherTypeOrden,
  onTeacherTypeOrden,
  exploracion,
  sessionTypeImpacto,
  sessionTypeDominante,
  onVerExplorador,
  recorteMedido,
  recorteDesactualizado,
  radiografia,
  aporte,
}: {
  variable: CriterioVariable;
  seleccion: CriteriosSeleccionMarco;
  facultades: FacultadRef[];
  /** Patchea la selección de ESTA variable (byVariable). */
  onSel: (next: CriterioSeleccion) => void;
  /** Fija los rangos de nivel de una facultad (variable range). */
  onRango: (facultad: string, rangos: Array<[number, number]>) => void;
  /** La tarjeta contiene ediciones locales que aún no pertenecen al proyecto. */
  pendiente: boolean;
  /** Confirma exclusivamente esta variable. */
  onConfirmar: () => void;
  /** Recupera exclusivamente el último valor confirmado de esta variable. */
  onDescartar: () => void;
  /** teacher_type (ADR 0035): orden de jerarquía guardado (claves canónicas). */
  teacherTypeOrden?: string[];
  /** teacher_type: persiste el nuevo orden de jerarquía (autosave del workspace). */
  onTeacherTypeOrden?: (keys: string[]) => void;
  /** session_type: radiografía del marco (elegibles por tipo×facultad). */
  exploracion?: CalcMuestraAulasExploracion | null;
  /** session_type: impacto de tipos excluidos por facultad (trampa del taller). */
  sessionTypeImpacto?: CalcMuestraSessionTypeImpacto | null;
  /** session_type: señal de tipo de curso agrupado por DTI (particularidades). */
  sessionTypeDominante?: CalcMuestraAulasParticularidadSessionType | null;
  /** session_type: navega a la pestaña Explorador; sin callback no hay link. */
  onVerExplorador?: () => void;
  /**
   * S1: la radiografía de ESTE criterio, dentro de la tarjeta que lo decide.
   * Antes vivía en una consola aparte con su propio selector: se enfocaba un
   * criterio en una zona de la pantalla y se decidía en otra.
   */
  radiografia?: ReactNode;
  /**
   * S4/S5: lo que cada categoría aporta al marco ejecutado, según R. Sin esto
   * el conmutador decide contra el conteo del catálogo, que es anterior a
   * cualquier criterio.
   */
  aporte?: (segmentKey: string) => AporteCategoria | null;
  /**
   * Cuánto recortó de verdad este criterio en el marco ejecutado. La cabecera
   * mira la declaración; esto mira el efecto, y son cosas distintas.
   */
  recorteMedido?: RecorteCriterioAlumno | null;
  /** La selección cambió después de construir: la cifra es del marco anterior. */
  recorteDesactualizado?: boolean;
}) {
  const sel = seleccionVariable(seleccion, variable.id);
  const mapeada = Boolean(variable.mappedColumn);
  // Listas planas largas (facultad, condición, tipo de sesión) crecen en una
  // sola columna: se marcan `data-long` para que la tarjeta ocupe más ancho y
  // la lista fluya en varias columnas (ver criterios.css).
  const longList = variable.kind === "flat" && (variable.categories?.length ?? 0) >= 8;

  return (
    <article
      className="cmv2-crit-card"
      data-scope={variable.scope}
      data-kind={variable.kind}
      data-long={longList ? "true" : undefined}
      data-pending={pendiente ? "true" : "false"}
    >
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
          <ResumenCabecera variable={variable} seleccion={seleccion} />
          <span className="cmv2-crit-state" data-state={pendiente ? "pending" : "confirmed"}>
            {pendiente ? <span className="cmv2-crit-state-dot" aria-hidden="true" /> : <IconSuccess size={13} aria-hidden="true" />}
            {pendiente ? "Cambios sin confirmar" : "Confirmado"}
          </span>
        </div>
      </header>

      <div className="cmv2-crit-card-body">
        <RecorteMedido recorte={recorteMedido ?? null} desactualizado={Boolean(recorteDesactualizado)} />
        {variable.id === "condicion_curso" ? <CondicionCursoAviso variable={variable} /> : null}
        {variable.kind === "flat" && <ControlFlat variable={variable} sel={sel} onSel={onSel} aporte={aporte} />}
        {variable.kind === "hierarchical" && (
          <ControlHierarchical variable={variable} sel={sel} onSel={onSel} />
        )}
        {variable.id === "teacher_type" && onTeacherTypeOrden ? (
          <TeacherTypeOrden variable={variable} orden={teacherTypeOrden} onOrden={onTeacherTypeOrden} />
        ) : null}
        {variable.kind === "numeric" && <ControlNumeric variable={variable} sel={sel} onSel={onSel} />}
        {variable.kind === "ordinal" && <ControlOrdinal variable={variable} sel={sel} onSel={onSel} />}
        {variable.kind === "range" && (
          <ControlRange variable={variable} seleccion={seleccion} facultades={facultades} onRango={onRango} />
        )}
      </div>

      {variable.id === SESSION_TYPE_VARIABLE_ID && (variable.kind === "flat" || variable.kind === "hierarchical") ? (
        // Tipo de sesión: vista por facultad de primera clase (reunión §4) —
        // reemplaza el link genérico de excepciones; compila a la MISMA
        // estructura `exceptions` que ya persiste.
        <TipoSesionPorFacultad
          variable={variable}
          sel={sel}
          facultades={facultades}
          onSel={onSel}
          exploracion={exploracion}
          impacto={sessionTypeImpacto}
          sessionTypeDominante={sessionTypeDominante}
          onVerExplorador={onVerExplorador}
        />
      ) : null}

      {pendiente ? (
        <div className="cmv2-crit-confirm" role="status" aria-live="polite">
          <div className="cmv2-crit-confirm-copy">
            <strong>Revisa esta variable antes de incorporarla.</strong>
            <span>Las demás variables y el marco reconstruido no cambian todavía.</span>
          </div>
          <div className="cmv2-crit-confirm-actions">
            <button type="button" className="cmv2-crit-discard-btn" onClick={onDescartar}>
              <IconUndo size={14} aria-hidden="true" />
              Descartar
            </button>
            <button type="button" className="cmv2-crit-confirm-btn" onClick={onConfirmar}>
              <IconConfirm size={14} aria-hidden="true" />
              Confirmar {variable.label.toLocaleLowerCase("es")}
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
