import { useState } from "react";

import { apiRecopiladoresSeed, type CollectionStatePayload, type CollectionUnit } from "../../api/recopiladores";
import { Panel } from "../../components/Panel";
import { PulsoButton } from "../../components/PulsoButton";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  DatabaseZap,
  Loader2,
} from "../../vendor/lucide-react";
import { COLLECTION_ADAPTER_LABELS } from "./providerRules";
import { TableScroll } from "./TableScroll";
import "./styles/plan.css";

type Props = {
  payload: CollectionStatePayload | null;
  onState: (payload: CollectionStatePayload) => void;
};

function value(value: unknown) {
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "—";
}

// Mismo vocabulario que `.crf_role_label()` (api/R/collection_render_ficha.R):
// `titular`/`chain_reserve`/`extra_reserve_pool` son claves del motor de
// selección de aulas, no español. La ficha impresa ya las traduce; esta
// tabla (lo primero que el analista ve del plan) no debería quedarse atrás.
// Un rol que no reconocemos se muestra tal cual -inventarle una etiqueta
// sería peor que mostrar la clave-, igual que en el renderer.
function unitRoleLabel(unit: Pick<CollectionUnit, "role" | "dimensions">): string {
  const key = (unit.role ?? "").toLowerCase().replace(/[ -]+/g, "_");
  const target = typeof unit.dimensions?.replacement_for === "string" ? unit.dimensions.replacement_for : "";
  if (key === "titular") return "Titular";
  if (key === "chain_reserve" || key === "reserva") return target ? `Reemplazo de ${target}` : "Reemplazo";
  if (key === "extra_reserve_pool") return "Reserva adicional";
  return value(unit.role);
}

// `.collection_instrument_ref()` (api/R/collection_engine.R) devuelve el
// centinela "legacy-instrument-unpinned" cuando el plan no tiene una
// revisión de instrumento fijada -no es un id real, es la señal de que no
// hay ninguno-. Mostrarlo tal cual en la cabecera del plan lee como un dato
// cualquiera; un revision_id real (hash o id del XLSForm) sí es informativo
// y se muestra igual que antes.
function instrumentRevisionLabel(revisionId: string): string {
  if (revisionId === "legacy-instrument-unpinned") return "sin instrumento fijado";
  return revisionId;
}

const PLAN_PAGE_SIZE = 50;

export function paginatePlanUnits<T>(units: T[], requestedPage: number, pageSize = PLAN_PAGE_SIZE) {
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const totalPages = Math.max(1, Math.ceil(units.length / safePageSize));
  const page = Math.min(Math.max(0, Math.floor(requestedPage)), totalPages - 1);
  const start = page * safePageSize;
  const end = Math.min(start + safePageSize, units.length);
  return {
    items: units.slice(start, end),
    page,
    start,
    end,
    totalPages,
  };
}

export function PlanSection({ payload, onState }: Props) {
  const [seeding, setSeeding] = useState(false);
  const [requestedPage, setRequestedPage] = useState(0);
  const [error, setError] = useState("");
  const plan = payload?.state.plan ?? null;

  const seed = async () => {
    setSeeding(true);
    setError("");
    try {
      onState(await apiRecopiladoresSeed());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo sembrar el plan.");
    } finally {
      setSeeding(false);
    }
  };

  if (!plan) {
    const seedAvailable = payload?.seed_available === true;
    return (
      <div className="rec-empty-state" data-qa-geometry-capacity="owned">
        <DatabaseZap size={28} aria-hidden />
        <h2>No hay un plan propio de Recopiladores</h2>
        <p>{seedAvailable
          ? "Este proyecto conserva una selección o un plan de aulas compatible. Puedes adaptarlo una sola vez."
          : "Primero entrega una selección desde su módulo de origen para preparar la recolección."}</p>
        {seedAvailable ? (
          <PulsoButton variant="primary" onClick={() => { void seed(); }} disabled={seeding}>
            {seeding ? <Loader2 size={15} className="pulso-spin" /> : <DatabaseZap size={15} />}
            Adaptar fuente disponible
          </PulsoButton>
        ) : null}
        {error ? <p className="rec-inline-error" role="alert">{error}</p> : null}
      </div>
    );
  }

  const pagination = paginatePlanUnits(plan.units, requestedPage);

  return (
    <div className="rec-plan-layout">
      <Panel
        className="rec-summary-card"
        eyebrow="Resumen del plan"
        title={<><ClipboardList size={18} aria-hidden /> {plan.units.length} unidades</>}
      >
        <dl>
          <div><dt>Tipo</dt><dd>{plan.unit_type}</dd></div>
          <div><dt>Método</dt><dd>{COLLECTION_ADAPTER_LABELS[plan.adapter.id] ?? plan.adapter.id}</dd></div>
          <div><dt>Revisión</dt><dd>{plan.revision}</dd></div>
          <div><dt>Origen</dt><dd>{plan.source_ref.module}</dd></div>
        </dl>
      </Panel>
      <Panel
        className="rec-data-card"
        eyebrow="Plan congelado"
        title="Unidades que entran a recolección"
        actions={(
          <div className="rec-plan-data-meta">
            <code title={plan.instrument_ref.sha256}>instrumento {instrumentRevisionLabel(plan.instrument_ref.revision_id)}</code>
            {plan.units.length ? (
              <span>{pagination.start + 1}–{pagination.end} de {plan.units.length}</span>
            ) : null}
          </div>
        )}
      >
        {plan.units.length ? (
          <>
            <TableScroll data-qa-geometry-capacity="owned">
              <table>
                <thead><tr><th>Unidad</th><th>Rol</th><th>Grupo</th><th>Programación</th></tr></thead>
                <tbody>
                  {pagination.items.map((unit) => (
                    <tr key={unit.unit_id}>
                      <td><strong>{unit.label}</strong><small>{unit.unit_id}</small></td>
                      <td>{unitRoleLabel(unit)}</td>
                      <td>{value(unit.group)}</td>
                      <td>{value(unit.dimensions?.schedule ?? unit.scheduling?.wave)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
            <nav className="rec-plan-pagination" aria-label="Páginas del plan">
              <span aria-live="polite">Página {pagination.page + 1} de {pagination.totalPages}</span>
              <div>
                <PulsoButton
                  variant="secondary"
                  size="sm"
                  disabled={pagination.page === 0}
                  onClick={() => setRequestedPage(pagination.page - 1)}
                >
                  <ChevronLeft size={14} aria-hidden />
                  Anterior
                </PulsoButton>
                <PulsoButton
                  variant="secondary"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages - 1}
                  onClick={() => setRequestedPage(pagination.page + 1)}
                >
                  Siguiente
                  <ChevronRight size={14} aria-hidden />
                </PulsoButton>
              </div>
            </nav>
          </>
        ) : (
          <div className="rec-contained-empty" data-qa-geometry-capacity="owned">
            El plan es válido, pero su selección no contiene unidades. Regresa al módulo de origen para decidirlas.
          </div>
        )}
      </Panel>
    </div>
  );
}
