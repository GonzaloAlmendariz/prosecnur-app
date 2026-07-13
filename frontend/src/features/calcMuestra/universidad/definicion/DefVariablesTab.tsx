/**
 * Pestaña "Variables" de Definición: grilla de tarjetas por rol, agrupadas por
 * función (identidad, estratificación, unidad de aula, operativo). Cada tarjeta
 * conserva la sugerencia autodetectada, muestra hasta 3 valores observados de
 * la fuente y explica en popover por qué el motor necesita ese dato. Los
 * términos estrato y curso-horario se explican aquí (única vez).
 */
import { useEffect, useRef, useState } from "react";
import { CircleHelp, Database } from "lucide-react";
import { Popover } from "../../../../components/Popover";
import { EmptyState } from "../../../../components/States";
import type {
  CalcMuestraAulasState,
  CalcMuestraWorkspace,
} from "../../../../api/client";
import { fmtInt } from "../../sharedCore";
import { UNIVERSITY_FALLBACK_COLUMN_OPTIONS } from "../shared/constants";
import {
  ensureUniversityVariableMappings,
  inferUniversityColumn,
  isUniversityUserFacingColumnName,
  universityColumnOptions,
  universityInspectedColumnOptions,
  universityObservedCategoryRows,
  type UniversityObservedCategory,
} from "../shared/categorias";
import { TerminoChip } from "../ui";
import { useValorSwap } from "../ui/useValorSwap";
import "./definicion.css";

const GRUPOS: Array<{ id: string; titulo: string; detalle: string; roles: string[] }> = [
  { id: "identidad", titulo: "Identidad", detalle: "controla duplicados y cobertura", roles: ["student_id"] },
  { id: "estratificacion", titulo: "Estratificación", detalle: "estratos, cuotas y balance de la muestra", roles: ["faculty", "sex", "program", "level", "formation", "age"] },
  { id: "aula", titulo: "Unidad de aula", detalle: "identifica cada curso-horario seleccionable", roles: ["course_id", "schedule", "course_schedule_id", "classroom", "modality", "session_type", "course_level", "enrolled_total"] },
  { id: "operativo", titulo: "Operativo", detalle: "elegibilidad, agenda y etiquetas de campo", roles: ["teacher", "teacher_type", "campus", "condition", "course_name"] },
];

/** Ampliación del "por qué" para los roles donde la description corta no basta. */
const MOTIVO_MOTOR: Record<string, string> = {
  faculty: "Con esta columna la calculadora arma los estratos por facultad y reparte las cuotas de la muestra en proporción al peso real de cada una en la población.",
  sex: "Es el control de cuota: la muestra final debe conservar la composición por sexo de la población, y el cierre estadístico se cuadra por celda facultad × sexo.",
  course_id: "Junto con el horario forma la unidad de selección: el aula (curso-horario) que se sortea y se visita en campo.",
  schedule: "Junto con el curso identifica cada aula seleccionable y permite balancear turnos y planificar la visita en campo.",
  course_schedule_id: "Si la base ya trae un código único de aula (por ejemplo NRC), la calculadora lo usa directamente como unidad de selección sin reconstruirla.",
};

export function DefVariablesTab({
  workspace,
  aulasState,
  onWorkspace,
}: {
  workspace: CalcMuestraWorkspace;
  aulasState: CalcMuestraAulasState | null;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
}) {
  const detectedColumns = universityColumnOptions(workspace, aulasState).filter(isUniversityUserFacingColumnName);
  const inspectedColumns = universityInspectedColumnOptions(workspace);
  const suggestionColumns = inspectedColumns.length ? inspectedColumns : detectedColumns;
  const mappedColumns = (workspace.variable_mappings ?? [])
    .map((row) => row.column ?? "")
    .filter((column) => Boolean(column) && isUniversityUserFacingColumnName(column));
  const columns = Array.from(new Set([
    ...(suggestionColumns.length ? suggestionColumns : UNIVERSITY_FALLBACK_COLUMN_OPTIONS),
    ...mappedColumns,
  ]))
    .sort((a, b) => a.localeCompare(b, "es"));
  const mappings = ensureUniversityVariableMappings(workspace.variable_mappings, suggestionColumns);
  const byRole = new Map(mappings.map((row) => [row.role, row]));
  const requiredRows = mappings.filter((row) => row.required);
  const mappedRequired = requiredRows.filter((row) => row.column).length;
  const observedByRole = universityObservedCategoryRows(workspace, aulasState, 3)
    .reduce<Map<string, UniversityObservedCategory[]>>((acc, row) => {
      const list = acc.get(row.role) ?? [];
      list.push(row);
      acc.set(row.role, list);
      return acc;
    }, new Map());

  // Micro-confirmación: un pulso success de 300ms en la tarjeta cuya columna
  // acaba de asignarse (solo visual; el estado real vive en variable_mappings).
  const [flashRole, setFlashRole] = useState<string | null>(null);
  const flashTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  function updateMapping(role: string, column: string) {
    if (column) {
      window.clearTimeout(flashTimer.current);
      setFlashRole(role);
      flashTimer.current = window.setTimeout(() => setFlashRole(null), 340);
    }
    onWorkspace({
      ...workspace,
      variable_mappings: mappings.map((item) => (item.role === role ? { ...item, column } : item)),
    });
  }

  const conteoNecesarias = `${mappedRequired}/${requiredRows.length}`;
  const conteoCambiando = useValorSwap(conteoNecesarias);

  return (
    <section className="cmv2-panel cmv2-university-variable-map">
      <div className="cmv2-panel-head">
        <div>
          <p className="cmv2-defi-intro">
            Indica qué columna del Excel cumple cada función. Con facultad y sexo se forman los{" "}
            <TerminoChip termino="estrato">estratos</TerminoChip> y las cuotas de la muestra; con curso y
            horario se identifica cada <TerminoChip termino="curso-horario">curso-horario</TerminoChip> que
            el sorteo puede elegir.
          </p>
        </div>
        <span className="cmv2-pill-soft cmv2-uni-swap" data-cambiando={conteoCambiando || undefined}>
          {conteoNecesarias} necesarias
        </span>
      </div>
      {GRUPOS.map((grupo) => {
        const rows = grupo.roles.flatMap((role) => {
          const row = byRole.get(role);
          return row ? [row] : [];
        });
        if (!rows.length) return null;
        return (
          <div key={grupo.id} className="cmv2-defi-var-group">
            <div className="cmv2-defi-var-group-head">
              <span className="cmv2-eyebrow">{grupo.titulo}</span>
              <small>{grupo.detalle}</small>
            </div>
            <div className="cmv2-defi-var-grid cmv2-uni-stagger">
              {rows.map((row) => {
                const suggested = inferUniversityColumn(row.role, suggestionColumns);
                const selected = row.column ?? "";
                const otherColumns = columns.filter((column) => column !== suggested);
                const hasSuggestion = Boolean(suggested);
                const observed = observedByRole.get(row.role) ?? [];
                const state = selected ? "lista" : row.required ? "falta" : "opcional";
                return (
                  <article
                    key={row.role}
                    className="cmv2-defi-var-card"
                    data-state={state}
                    data-flash={flashRole === row.role || undefined}
                  >
                    <div className="cmv2-defi-var-card-head">
                      <strong>{row.label}</strong>
                      <span className="cmv2-defi-var-card-meta">
                        <span className="cmv2-defi-chip" data-tone={row.required ? "req" : undefined}>
                          {row.required ? "requerida" : "opcional"}
                        </span>
                        <Popover
                          openOn="hover"
                          ariaLabel={`Por qué la calculadora necesita ${row.label}`}
                          trigger={
                            <button type="button" className="cmv2-defi-why" aria-label={`Por qué la calculadora necesita ${row.label}`}>
                              <CircleHelp size={14} />
                            </button>
                          }
                        >
                          <div className="cmv2-defi-why-pop">
                            <strong>¿Por qué la calculadora lo necesita?</strong>
                            <p>{row.description}</p>
                            {MOTIVO_MOTOR[row.role] && <p>{MOTIVO_MOTOR[row.role]}</p>}
                          </div>
                        </Popover>
                      </span>
                    </div>
                    <select
                      value={selected}
                      aria-label={`Columna del Excel para ${row.label}`}
                      onChange={(e) => updateMapping(row.role, e.currentTarget.value)}
                    >
                      <option value="">Seleccionar columna</option>
                      {hasSuggestion && (
                        <optgroup label="Sugerencia">
                          <option value={suggested}>{suggested}</option>
                        </optgroup>
                      )}
                      <optgroup label="Todas las columnas">
                        {otherColumns.map((column) => (
                          <option key={`${row.role}-${column}`} value={column}>{column}</option>
                        ))}
                      </optgroup>
                    </select>
                    <span className={`cmv2-defi-var-hint ${hasSuggestion ? "is-ready" : ""}`}>
                      {hasSuggestion ? `Coincide con ${suggested}` : "Elige una columna"}
                    </span>
                    {observed.length > 0 && (
                      <div className="cmv2-defi-var-values" aria-label={`Valores observados de ${row.label}`}>
                        {observed.map((item) => (
                          <span key={`${item.role}-${item.raw}`} title={item.raw}>
                            <b>{item.label}</b>
                            <em>{fmtInt(item.count)}</em>
                          </span>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        );
      })}
      {!detectedColumns.length && (
        <EmptyState
          variant="inline"
          icon={<Database size={18} />}
          title="Sin columnas detectadas todavía"
          hint="Cuando cargues o construyas el marco en Bases, estas tarjetas propondrán columnas automáticamente. Mientras tanto puedes dejar preparado qué datos espera el estudio."
        />
      )}
    </section>
  );
}
