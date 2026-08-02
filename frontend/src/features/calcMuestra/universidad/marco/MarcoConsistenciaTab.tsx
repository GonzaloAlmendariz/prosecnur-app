/**
 * Bloque "Consistencia entre fuentes" integrado en Datos > Fuentes. Las
 * direcciones históricas def-consistencia/marco-validacion aterrizan aquí.
 * Reconstruye el antiguo UniversityFrameValidationPanel:
 * gauge descriptivo del match base-catálogo, reconciliación cuantitativa (emparejados / solo base /
 * solo catálogo), hallazgos con severidad y acción sugerida, y ejemplos para
 * revisar. Con una sola base se auto-simplifica: no hay catálogo que validar.
 */
import { CheckCircle2, Database, Link2 } from "lucide-react";
import { EmptyState } from "../../../../components/States";
import type {
  CalcMuestraAulasState,
  CalcMuestraWorkspace,
} from "../../../../api/client";
import { fmtInt, fmtPct, rowsFrom } from "../../sharedCore";
import { classroomRowText } from "../shared/format";
import {
  ensureUniversitySourceBindings,
  sourceBindingCompatibleForBuild,
  sourceBindingSelectedDiagnostic,
  sourceBindingSelectedSheet,
  sourceRoleLabel,
  universityFrameSourceBindings,
} from "../shared/categorias";
import { decidirConsistenciaMarco, frameAuditNumber } from "../shared/frame";
import { CifraMotor } from "../ui";
import { InventarioUnicosPanel } from "./InventarioUnicosPanel";
import { recordNumber, recordStringList } from "./marcoCharts";
import "../../didactica/didactica.css";
import "./marco.css";

/** Acción sugerida por código de hallazgo del motor R. */
const MARCO_ISSUE_ACTIONS: Record<string, string> = {
  base_sin_llave_aula: "Revisa en Datos → Variables las columnas de curso, horario y sección de la base principal.",
  catalogo_sin_llave_aula: "Revisa en Datos → Fuentes que la hoja de catálogo traiga curso, horario y sección legibles.",
  catalogo_llaves_duplicadas: "Depura las filas repetidas del catálogo o acepta el valor modal que la calculadora ya aplica.",
  sin_empate_catalogo: "Confirma que ambas hojas usan la misma llave de curso-horario y vuelve a construir el marco.",
  empate_bajo_catalogo: "Busca diferencias de mayúsculas, tildes o códigos en la llave común antes de recalcular.",
  aulas_base_sin_catalogo: "Revisa si a esos cursos-horario les falta docente, salón u horario, o confírmalos como cursos-horario sin ficha.",
  catalogo_fuera_de_base: "Esos cursos-horario quedan como contexto. Revisa en Datos → Fuentes que no falte población en la base.",
  catalogo_sin_docente: "Asigna la columna Docente/contacto en Datos → Variables para preparar la agenda.",
};

function issueAction(code: string) {
  return MARCO_ISSUE_ACTIONS[code] ?? "Revisa la relación entre bases en Datos → Fuentes y reconstruye el marco.";
}

/** Normaliza terminología heredada solo en presentación; no altera el motor. */
function courseScheduleText(value: string) {
  return value
    .replace(/\b1\s+(?:aulas?|curso-horario\/aulas?)\b/gi, "1 curso-horario")
    .replace(/\b(\d[\d.,]*)\s+(?:aulas?|curso-horario\/aulas?)\b/gi, "$1 cursos-horario")
    .replace(/\bde las aulas\b/gi, "de los cursos-horario")
    .replace(/\b(?:las|unas|estas|esas) aulas\b/gi, "los cursos-horario")
    .replace(/\b(?:la|una|esta|esa) aula\b/gi, "el curso-horario")
    .replace(/\baulas\b/gi, "cursos-horario")
    .replace(/\baula\b/gi, "curso-horario");
}

/** Barra descriptiva sin umbrales; su tono viene del veredicto del motor. */
function MatchGauge({ rate, tone }: { rate: number; tone: "pending" | "ok" | "warn" | "danger" }) {
  const pct = Number.isFinite(rate) ? Math.max(0, Math.min(1, rate)) * 100 : 0;
  return (
    <div className="cmv2-marco-gauge" data-tone={tone} role="img" aria-label={`Coincidencia base-catálogo: ${Number.isFinite(rate) ? fmtPct(rate) : "pendiente"}`}>
      <div className="cmv2-marco-gauge-track">
        <i className="cmv2-marco-gauge-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Reconciliación legible de las tres salidas de la unión curso + horario. */
function RelationSummary({
  matched,
  baseOnly,
  catalogOnly,
  matchRate,
}: {
  matched: number;
  baseOnly: number;
  catalogOnly: number;
  matchRate: number;
}) {
  return (
    <div
      className="cmv2-marco-reconciliation"
      role="group"
      aria-label={`Cursos-horario emparejados: ${fmtInt(matched)}; solo en la base: ${fmtInt(baseOnly)}; solo en el catálogo: ${fmtInt(catalogOnly)}`}
    >
      <article data-kind="base">
        <small>Solo base principal</small>
        <strong>{fmtInt(baseOnly)}</strong>
        <span>sin ficha equivalente en el catálogo</span>
      </article>
      <article data-kind="matched">
        <small>Emparejados</small>
        <strong>{fmtInt(matched)}</strong>
        <span>{Number.isFinite(matchRate) ? `${fmtPct(matchRate)} de la base principal` : "unidos por curso + horario"}</span>
      </article>
      <article data-kind="catalog">
        <small>Solo catálogo</small>
        <strong>{fmtInt(catalogOnly)}</strong>
        <span>sin matrícula equivalente en la base</span>
      </article>
    </div>
  );
}

function FramePreviewChips({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <small>{label}</small>
      <p>
        {values.length ? values.map((value) => <span key={value}>{value}</span>) : <em>Sin casos en la muestra de revisión</em>}
      </p>
    </div>
  );
}

export function MarcoConsistenciaTab({
  workspace,
  aulasState,
}: {
  workspace: CalcMuestraWorkspace;
  aulasState: CalcMuestraAulasState | null;
}) {
  const frame = aulasState?.frame ?? null;
  const decision = decidirConsistenciaMarco(workspace.source_mode, frame);
  const relation = decision.evidence;
  const issues = rowsFrom<Record<string, unknown>>(relation.issues);
  const relationRate = recordNumber(relation, "match_rate_classrooms", Number.NaN);
  const auditRate = frameAuditNumber(frame, "catalog_match_rate_classrooms");
  const matchRate = Number.isFinite(relationRate) ? relationRate : auditRate > 0 ? auditRate : Number.NaN;
  const matched = recordNumber(relation, "matched_classrooms");
  const baseClassrooms = recordNumber(relation, "base_classrooms");
  const baseOnly = recordNumber(relation, "unmatched_base_classrooms");
  const catalogOnly = recordNumber(relation, "catalog_only_classrooms");
  const relationStatus = typeof relation.status === "string" ? relation.status : "";
  const relationTone = decision.status === "ready"
    ? "ok"
    : relationStatus === "critico" || issues.some((issue) => classroomRowText(issue, ["severity"]) === "alta")
      ? "danger"
      : Number.isFinite(matchRate)
        ? "warn"
        : "pending";
  const sourceMode = workspace.source_mode ?? "base_madre";
  const sourceBindings = universityFrameSourceBindings(
    ensureUniversitySourceBindings(sourceMode, workspace.source_bindings),
  );
  const sourceCards = sourceBindings.map((binding) => {
    const compatible = sourceBindingCompatibleForBuild(binding);
    const diagnostic = sourceBindingSelectedDiagnostic(binding);
    return {
      label: sourceRoleLabel(binding.role),
      value: binding.file_name ? sourceBindingSelectedSheet(binding) || "hoja sin elegir" : "archivo pendiente",
      detail: binding.file_name || diagnostic?.role_label || binding.notes || "Declara archivo y pestaña.",
      ready: Boolean(binding.file_id && compatible),
      review: Boolean(binding.file_id && !compatible),
    };
  });

  return (
    <div className="cmv2-marco-stack">
      <InventarioUnicosPanel aulasState={aulasState} />
      <section className="cmv2-panel cmv2-marco-consistencia">
        <div className="cmv2-frame-source-relation">
          {sourceCards.map((card, index) => (
            <div className="cmv2-frame-source-node" key={card.label}>
              <article className={card.ready ? "is-ready" : card.review ? "is-review" : "is-pending"}>
                <span>{card.ready ? <CheckCircle2 size={14} /> : <Database size={14} />}</span>
                <div>
                  <small>{card.label}</small>
                  <strong>{card.value}</strong>
                  <em>{card.detail}</em>
                </div>
              </article>
              {index === 0 && sourceCards.length > 1 && (
                <div className="cmv2-frame-join-key" aria-label="Llave de unión: curso más horario">
                  <Link2 size={15} aria-hidden="true" />
                  <span>Llave de unión</span>
                  <strong>Curso + horario</strong>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="cmv2-marco-vacio">
          <EmptyState
            variant="inline"
            icon={decision.status === "ready" ? <CheckCircle2 size={18} /> : decision.status === "pending" ? <Database size={18} /> : <Link2 size={18} />}
            title={decision.title}
            hint={decision.hint}
          />
        </div>

        {decision.showRelationEvidence && (
          <>
            <div className="cmv2-marco-match-layout">
              <div className="cmv2-marco-match-gauge">
                <CifraMotor
                  label="Coincidencia por curso + horario"
                  value={Number.isFinite(matchRate) ? fmtPct(matchRate) : "sin llave"}
                  detalle={baseClassrooms > 0 ? `${fmtInt(matched)} de ${fmtInt(baseClassrooms)} cursos-horario de la base emparejados` : "cursos-horario de la base encontrados en el catálogo"}
                  origen={Number.isFinite(matchRate) ? "motor" : undefined}
                  hero
                  tono={decision.status === "ready" ? "ok" : decision.status === "working" ? "alerta" : undefined}
                />
                <MatchGauge rate={matchRate} tone={relationTone} />
              </div>
              <RelationSummary matched={matched} baseOnly={baseOnly} catalogOnly={catalogOnly} matchRate={matchRate} />
            </div>

            <div className="cmv2-frame-issue-layout">
              <div className="cmv2-frame-issue-list cmv2-uni-stagger">
                <h4>Hallazgos de relación</h4>
                {issues.length ? issues.map((issue) => {
                  const code = classroomRowText(issue, ["code"]);
                  return (
                    <article key={`${code}-${classroomRowText(issue, ["title"])}`} className={`is-${classroomRowText(issue, ["severity"]) || "media"}`}>
                      <small>{classroomRowText(issue, ["severity"]) || "revisar"}</small>
                      <strong>{courseScheduleText(classroomRowText(issue, ["title"]))}</strong>
                      <span>{courseScheduleText(classroomRowText(issue, ["detail"]))}</span>
                      <em className="cmv2-marco-issue-accion">{issueAction(code)}</em>
                    </article>
                  );
                }) : (
                  <article className={decision.status === "ready" ? "is-ok" : "is-media"}>
                    <small>{decision.status === "ready" ? "ok" : "revisar"}</small>
                    <strong>{decision.status === "ready" ? "Las bases están relacionadas" : "La auditoría requiere atención"}</strong>
                    <span>{decision.status === "ready" ? "No se detectaron problemas de relación en la auditoría del motor." : "El motor no entregó hallazgos detallados para este estado."}</span>
                  </article>
                )}
              </div>
              <div className="cmv2-frame-preview-list">
                <h4>Ejemplos para revisar</h4>
                <FramePreviewChips label="Base sin catálogo" values={recordStringList(relation, "unmatched_base_preview")} />
                <FramePreviewChips label="Solo en catálogo" values={recordStringList(relation, "catalog_only_preview")} />
                <FramePreviewChips label="Códigos duplicados" values={recordStringList(relation, "duplicate_catalog_preview")} />
              </div>
            </div>
          </>
        )}

      </section>
    </div>
  );
}
