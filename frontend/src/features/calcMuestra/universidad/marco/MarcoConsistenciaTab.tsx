/**
 * Pestaña "Consistencia" de Marco (id local marco-validacion). Reconstruye el
 * antiguo UniversityFrameValidationPanel: gauge del match base-catálogo con
 * umbrales semánticos, diagrama de dos conjuntos (emparejadas / solo base /
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
} from "../shared/categorias";
import { frameAuditNumber } from "../shared/frame";
import { CifraMotor } from "../ui";
import {
  frameRelationAudit,
  frameStatusLabel,
  recordNumber,
  recordStringList,
} from "./marcoCharts";
import "../../didactica/didactica.css";
import "./marco.css";

/** Acción sugerida por código de hallazgo del motor R. */
const MARCO_ISSUE_ACTIONS: Record<string, string> = {
  base_sin_llave_aula: "Revisa en Definición → Variables las columnas de curso, horario y sección de la base principal.",
  catalogo_sin_llave_aula: "Revisa en Definición → Bases que la hoja de catálogo traiga curso, horario y sección legibles.",
  catalogo_llaves_duplicadas: "Depura las filas repetidas del catálogo o acepta el valor modal que la calculadora ya aplica.",
  sin_empate_catalogo: "Confirma que ambas hojas usan la misma llave de curso-horario y vuelve a construir el marco.",
  empate_bajo_catalogo: "Busca diferencias de mayúsculas, tildes o códigos en la llave común antes de recalcular.",
  aulas_base_sin_catalogo: "Revisa si a esas aulas les falta docente, aula u horario, o confírmalas como aulas sin ficha.",
  catalogo_fuera_de_base: "No bloquea: esas aulas quedan como contexto. Verifica que no falte población en la base.",
  catalogo_sin_docente: "Asigna la columna Docente/contacto en Definición → Variables para preparar la agenda.",
};

function issueAction(code: string) {
  return MARCO_ISSUE_ACTIONS[code] ?? "Revisa la relación entre bases en Definición → Bases y reconstruye el marco.";
}

function matchTone(rate: number) {
  if (!Number.isFinite(rate)) return "pending";
  if (rate >= 0.9) return "ok";
  if (rate >= 0.7) return "warn";
  return "danger";
}

/** Barra-gauge del match base-catálogo con umbrales 70% y 90%. */
function MatchGauge({ rate }: { rate: number }) {
  const tone = matchTone(rate);
  const pct = Number.isFinite(rate) ? Math.max(0, Math.min(1, rate)) * 100 : 0;
  return (
    <div className="cmv2-marco-gauge" data-tone={tone} role="img" aria-label={`Coincidencia base-catálogo: ${Number.isFinite(rate) ? fmtPct(rate) : "pendiente"}`}>
      <div className="cmv2-marco-gauge-track">
        <i className="cmv2-marco-gauge-fill" style={{ width: `${pct}%` }} />
        <span className="cmv2-marco-gauge-tick" style={{ left: "70%" }} data-nivel="warn"><em>70%</em></span>
        <span className="cmv2-marco-gauge-tick" style={{ left: "90%" }} data-nivel="ok"><em>90%</em></span>
      </div>
      <div className="cmv2-marco-gauge-scale" aria-hidden="true">
        <span>revisar</span>
        <span>aceptable</span>
        <span>sólido</span>
      </div>
    </div>
  );
}

/** Dos conjuntos: aulas de la base y del catálogo con su intersección. */
function RelationSets({
  matched,
  baseOnly,
  catalogOnly,
}: {
  matched: number;
  baseOnly: number;
  catalogOnly: number;
}) {
  const baseTotal = matched + baseOnly;
  const catalogTotal = matched + catalogOnly;
  const max = Math.max(baseTotal, catalogTotal, 1);
  const rBase = 34 + 26 * Math.sqrt(baseTotal / max);
  const rCat = 34 + 26 * Math.sqrt(catalogTotal / max);
  const overlapShare = Math.max(0.08, Math.min(0.92, matched / Math.max(1, Math.min(baseTotal, catalogTotal))));
  const distance = (rBase + rCat) * (1 - 0.55 * overlapShare);
  const cxBase = 170 - distance / 2;
  const cxCat = 170 + distance / 2;
  return (
    <figure className="cmv2-marco-venn" aria-label={`Aulas emparejadas: ${fmtInt(matched)}; solo en la base: ${fmtInt(baseOnly)}; solo en el catálogo: ${fmtInt(catalogOnly)}`}>
      <svg viewBox="0 0 340 170" role="presentation" focusable="false">
        <circle className="cmv2-marco-venn-base" cx={cxBase} cy={85} r={rBase} />
        <circle className="cmv2-marco-venn-cat" cx={cxCat} cy={85} r={rCat} />
        <text className="cmv2-marco-venn-n" x={cxBase - rBase * 0.45} y={85} textAnchor="middle">{fmtInt(baseOnly)}</text>
        <text className="cmv2-marco-venn-n is-matched" x={170} y={85} textAnchor="middle">{fmtInt(matched)}</text>
        <text className="cmv2-marco-venn-n" x={cxCat + rCat * 0.45} y={85} textAnchor="middle">{fmtInt(catalogOnly)}</text>
      </svg>
      <figcaption>
        <span data-set="base"><i />Solo base principal · {fmtInt(baseOnly)}</span>
        <span data-set="match"><i />Emparejadas · {fmtInt(matched)}</span>
        <span data-set="cat"><i />Solo catálogo · {fmtInt(catalogOnly)}</span>
      </figcaption>
    </figure>
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
  const relation = frameRelationAudit(frame);
  const relationUsed = Boolean(relation.used);
  const status = String(relation.status ?? (frame ? "ok" : "pendiente"));
  const issues = rowsFrom<Record<string, unknown>>(relation.issues);
  const warnings = rowsFrom<string>(frame?.warnings);
  const relationRate = recordNumber(relation, "match_rate_classrooms", Number.NaN);
  const auditRate = frameAuditNumber(frame, "catalog_match_rate_classrooms");
  const matchRate = Number.isFinite(relationRate) ? relationRate : auditRate > 0 ? auditRate : Number.NaN;
  const matched = recordNumber(relation, "matched_classrooms");
  const baseClassrooms = recordNumber(relation, "base_classrooms");
  const baseOnly = recordNumber(relation, "unmatched_base_classrooms");
  const catalogOnly = recordNumber(relation, "catalog_only_classrooms");
  const sourceMode = workspace.source_mode ?? "base_madre";
  const sourceBindings = ensureUniversitySourceBindings(sourceMode, workspace.source_bindings);
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
  const singleSource = sourceMode === "base_madre" || (Boolean(frame) && !relationUsed);

  return (
    <div className="cmv2-marco-stack">
      <section className="cmv2-panel cmv2-marco-consistencia">
        <div className="cmv2-panel-head">
          <div>
            <span className="cmv2-eyebrow">Consistencia entre bases</span>
            <strong>Comprueba que las bases se puedan relacionar antes de calcular</strong>
          </div>
          <span className={`cmv2-frame-status-badge is-${singleSource && frame ? "ok" : status}`}>
            {frame ? (singleSource ? "una sola base" : frameStatusLabel(status)) : "pendiente"}
          </span>
        </div>

        <div className="cmv2-frame-source-grid">
          {sourceCards.map((card) => (
            <article key={card.label} className={card.ready ? "is-ready" : card.review ? "is-review" : "is-pending"}>
              <span>{card.ready ? <CheckCircle2 size={14} /> : <Database size={14} />}</span>
              <div>
                <small>{card.label}</small>
                <strong>{card.value}</strong>
                <em>{card.detail}</em>
              </div>
            </article>
          ))}
        </div>

        {!frame ? (
          <EmptyState
            icon={<Database size={20} />}
            title="Construye el marco para validar relaciones"
            hint="En Definición carga la base principal y, si existe, el catálogo de cursos y horarios. Luego esta vista mostrará coincidencias, hallazgos y ejemplos."
          />
        ) : singleSource ? (
          <div className="cmv2-marco-vacio">
            <EmptyState
              variant="inline"
              icon={<Link2 size={18} />}
              title="Una sola base: no hay catálogo que validar"
              hint="Toda la información sale de la base principal, así que no existe una segunda fuente que emparejar. Si más adelante llega un catálogo de cursos y horarios, decláralo en Definición → Bases y aquí verás su coincidencia."
            />
          </div>
        ) : (
          <>
            <div className="cmv2-marco-match-layout">
              <div className="cmv2-marco-match-gauge">
                <CifraMotor
                  label="Coincidencia base-catálogo"
                  value={Number.isFinite(matchRate) ? fmtPct(matchRate) : "sin llave"}
                  detalle={baseClassrooms > 0 ? `${fmtInt(matched)} de ${fmtInt(baseClassrooms)} aulas de la base emparejadas` : "aulas de la base encontradas en el catálogo"}
                  origen={Number.isFinite(matchRate) ? "motor" : undefined}
                  hero
                  tono={matchTone(matchRate) === "ok" ? "ok" : Number.isFinite(matchRate) ? "alerta" : undefined}
                />
                <MatchGauge rate={matchRate} />
              </div>
              <RelationSets matched={matched} baseOnly={baseOnly} catalogOnly={catalogOnly} />
            </div>

            <div className="cmv2-frame-issue-layout">
              <div className="cmv2-frame-issue-list cmv2-uni-stagger">
                <h4>Hallazgos de relación</h4>
                {issues.length ? issues.map((issue) => {
                  const code = classroomRowText(issue, ["code"]);
                  return (
                    <article key={`${code}-${classroomRowText(issue, ["title"])}`} className={`is-${classroomRowText(issue, ["severity"]) || "media"}`}>
                      <small>{classroomRowText(issue, ["severity"]) || "revisar"}</small>
                      <strong>{classroomRowText(issue, ["title"])}</strong>
                      <span>{classroomRowText(issue, ["detail"])}</span>
                      <em className="cmv2-marco-issue-accion">{issueAction(code)}</em>
                    </article>
                  );
                }) : (
                  <article className="is-ok">
                    <small>ok</small>
                    <strong>Las bases están relacionadas</strong>
                    <span>No se detectaron problemas de relación o coincidencia en la revisión compacta.</span>
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

        {frame && warnings.length > 0 && (
          <div className="cmv2-frame-warning-list">
            {warnings.map((warning) => <span key={warning}>{warning}</span>)}
          </div>
        )}
      </section>
    </div>
  );
}
