import { useMemo, useState } from "react";

import { apiRecopiladoresReseed,
  apiRecopiladoresSeed, type CollectionStatePayload, type CollectionUnit } from "../../api/recopiladores";
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

/**
 * El código con el que el equipo llama a esta aula: `CH 1`, `R 1.2`.
 *
 * La tabla enseñaba el nombre académico del aula —«1ges08_0601»— y debajo el
 * `unit_id`, que es un hash de infraestructura —«unit-aulas-aula-1-5524e6773d»—.
 * Ninguno de los dos es el código con el que se habla del aula en campo, en el
 * libro de agendación o en las fichas QR, y el operativo entero se coordina con
 * ese código.
 *
 * Está desde el principio en `dimensions.legacy_ref`: es el `operational_code`
 * que `.collection_legacy_unit()` usa como `source_key` para derivar el
 * `unit_id`. Llegaba y no se pintaba.
 */
function unitOperationalCode(unit: Pick<CollectionUnit, "dimensions">): string {
  const ref = unit.dimensions?.legacy_ref;
  return typeof ref === "string" ? ref.trim() : "";
}

/**
 * La cadena a la que pertenece la unidad.
 *
 * La columna decía «M1» —la ola de muestra, `wave`— para todas las titulares y
 * «Extra» para el banco. Eso no ubica a nadie: lo que hace falta es saber qué
 * titular y qué reservas forman un mismo grupo, que es la unidad con la que se
 * decide en campo cuando un aula cae.
 */
function unitChainLabel(unit: Pick<CollectionUnit, "role" | "group" | "dimensions">): string {
  const key = (unit.role ?? "").toLowerCase().replace(/[ -]+/g, "_");
  if (key === "extra_reserve_pool") return "Banco";
  const target = typeof unit.dimensions?.replacement_for === "string"
    ? unit.dimensions.replacement_for.trim() : "";
  if (target) return target;
  const propio = unitOperationalCode(unit);
  // Un titular es cabeza de su propia cadena.
  if (key === "titular") return propio || value(unit.group);
  // Una reserva sin `replacement_for` —los planes anteriores a que ese campo
  // viajara— todavía lleva la cadena en su propio código: «R1.6» es de la 1.
  // Repetir aquí «R1.6», que es lo que ya dice la columna Unidad, no informa de
  // nada; el número de la cadena sí ubica la fila.
  const delCodigo = /^[A-Za-zÁÉÍÓÚÑ]+\s*(\d+)\./.exec(propio);
  if (delCodigo) return `Cadena ${delCodigo[1]}`;
  return propio || value(unit.group);
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

/**
 * Las unidades en el orden en que se recorre el operativo.
 *
 * Gonzalo: «no estaría en orden del primer curso-horario al último y los
 * reemplazos así como los extras deberían estar en ese orden de importancia […]
 * no lo siento coherente con la intuitividad que ya ofrece cálculo de
 * cursos-horario y la cadena operativa».
 *
 * El orden se arregló también en el productor —`.collection_orden_operativo()`—,
 * pero eso sólo alcanza a los planes que se creen desde ahora: un plan ya
 * congelado conserva el orden con el que se guardó. Y el plan es justamente un
 * objeto que se congela. Por eso la vista ordena siempre.
 *
 * Cadenas primero, por su número; dentro de cada una, el titular antes que sus
 * reservas; el banco al final. Una unidad sin secuencia conserva su posición en
 * vez de irse a un sitio arbitrario.
 */
export function ordenOperativoDeUnidades<T extends Pick<CollectionUnit, "role" | "dimensions">>(
  units: ReadonlyArray<T>,
): T[] {
  const num = (v: unknown): number => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
  };
  const txt = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
  const role = (u: { role?: string | null }) => (u.role ?? "").toLowerCase().replace(/[ -]+/g, "_");

  // Dónde aparece cada titular. Es el respaldo para los planes anteriores a que
  // `operational_sequence` viajara —el del estudio real, sin ir más lejos—: sin
  // él, esas reservas se quedaban donde estaban y la tabla las enseñaba
  // barajadas (R1.6, R3.6, R2.6…) aunque cada una supiera de quién es.
  const rangoDelTitular = new Map<string, number>();
  units.forEach((unit, i) => {
    if (role(unit) !== "titular") return;
    const code = txt(unit.dimensions?.legacy_ref);
    if (code && !rangoDelTitular.has(code)) rangoDelTitular.set(code, i);
  });

  return units
    .map((unit, entrada) => {
      const rol = role(unit);
      const declarada = num(unit.dimensions?.operational_sequence);
      const propio = txt(unit.dimensions?.legacy_ref);
      const deQuien = txt(unit.dimensions?.replacement_for);
      const cabeza = rol === "titular" ? propio : deQuien;
      const porTitular = rangoDelTitular.has(cabeza)
        ? (rangoDelTitular.get(cabeza) as number)
        : Number.POSITIVE_INFINITY;
      // Último respaldo: el propio código lleva la cadena dentro. «AULA 12» es la
      // cadena 12 y «R1.6» es la sexta reserva de la 1. Sin esto, un plan que no
      // trae ni secuencia ni `replacement_for` —el del 1 de agosto, que es el
      // que hay en el estudio— sale en su orden de entrada: AULA 1, 2, 3, 4, 6,
      // 9, 12, 5… que no es «del primer curso-horario al último».
      const delCodigo = /^[A-Za-zÁÉÍÓÚÑ]+\s*(\d+)(?:\.(\d+))?/.exec(propio);
      const cadenaDelCodigo = delCodigo ? Number(delCodigo[1]) : Number.POSITIVE_INFINITY;
      const ordenDelCodigo = delCodigo && delCodigo[2] !== undefined ? Number(delCodigo[2]) : 0;
      return {
        unit,
        entrada,
        banco: rol === "extra_reserve_pool" ? 1 : 0,
        // La secuencia declarada manda; el rango del titular la sustituye cuando
        // no viene. Ambas ordenan igual: por cadena.
        // Prioridad: la secuencia declarada, luego el número del propio código y
        // sólo al final el rango del titular. El orden importa porque las tres
        // son ESCALAS DISTINTAS y mezclarlas descoloca: el rango empieza en 0 y
        // el número del código en 1, así que «AULA 2» (rango 1) se colaba entre
        // «AULA 1» y sus «R1.x» (código 1). Que todos usen la misma es la
        // condición para que el orden signifique algo.
        cadena: declarada !== Number.POSITIVE_INFINITY
          ? declarada
          : cadenaDelCodigo !== Number.POSITIVE_INFINITY ? cadenaDelCodigo : porTitular,
        // El titular no trae `replacement_order`: va delante de sus reservas.
        dentro: num(unit.dimensions?.replacement_order) !== Number.POSITIVE_INFINITY
          ? num(unit.dimensions?.replacement_order)
          : ordenDelCodigo,
      };
    })
    .sort((a, b) =>
      a.banco - b.banco || a.cadena - b.cadena || a.dentro - b.dentro || a.entrada - b.entrada)
    .map((x) => x.unit);
}

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

/**
 * La fecha de la corrida que produjo el plan, sacada de su `run_id`.
 *
 * Los identificadores son `sel_aulas_AAAAMMDDHHMMSS_hash`: dentro está la fecha,
 * pero el hash la vuelve ilegible. Sin ella, «Origen: calc-muestra» no distingue
 * un plan de hoy de uno de hace tres semanas.
 */
export function fechaDeCorrida(runId: string | null | undefined) {
  const m = /(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(String(runId ?? ""));
  if (!m) return "";
  const [, a, mes, d, h, min] = m;
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const mi = Number(mes) - 1;
  if (mi < 0 || mi > 11) return "";
  return `${Number(d)} ${meses[mi]} ${a}, ${h}:${min}`;
}

export function PlanSection({ payload, onState }: Props) {
  const [seeding, setSeeding] = useState(false);
  const [requestedPage, setRequestedPage] = useState(0);
  const [error, setError] = useState("");
  const plan = payload?.state.plan ?? null;
  // El backend compara el run_id del plan con el de la selección vigente; aquí
  // sólo se pinta su veredicto. Ausente = no hay con qué comparar.
  const desfase = payload?.source_vigente?.desfasado ? payload.source_vigente : null;
  const [rehaciendo, setRehaciendo] = useState(false);
  const rehacer = async () => {
    if (!payload) return;
    setRehaciendo(true);
    setError("");
    try {
      onState(await apiRecopiladoresReseed(payload.state_revision));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo rehacer el plan.");
    } finally {
      setRehaciendo(false);
    }
  };

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

  // Se ordena ANTES de paginar: paginar el orden crudo repartiría una misma
  // cadena entre dos páginas.
  const unidadesEnOrden = useMemo<CollectionUnit[]>(
    () => ordenOperativoDeUnidades(plan.units), [plan.units]);
  const pagination = paginatePlanUnits(unidadesEnOrden, requestedPage);

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
          {/* Decía sólo «calc-muestra», que es el módulo y nunca cambia. El
              plan guarda ADEMÁS de qué corrida salió (`source_ref.run_id`) y ese
              dato no se pintaba en ninguna parte. Medido en HSVG2026 el
              2026-08-22: el plan venía de la corrida del 1 de agosto y la
              selección vigente era del 21 — veinte días y otra nomenclatura de
              código («AULA 1» contra «CH 1»)—, y la pantalla decía «Origen:
              calc-muestra» tan tranquila. */}
          <div>
            <dt>Origen</dt>
            <dd>
              {plan.source_ref.module}
              {fechaDeCorrida(plan.source_ref.run_id) ? (
                <> · sorteo del <b>{fechaDeCorrida(plan.source_ref.run_id)}</b></>
              ) : null}
            </dd>
          </div>
        </dl>
        {desfase ? (
          <div className="rec-plan-desfase">
            <p>
              Este plan se armó con el <b>sorteo del {fechaDeCorrida(desfase.plan_run_id) || "una corrida anterior"}</b>,
              y la selección vigente es <b>otra</b>{fechaDeCorrida(desfase.selection_run_id)
                ? <> (del {fechaDeCorrida(desfase.selection_run_id)})</> : null}.
              Los materiales que se generen ahora llevarán las aulas del plan, no las del sorteo actual.
            </p>
            {/* Rehacer descarta el despliegue y su entrega a campo, así que se
                dice ANTES de pulsar y no en un aviso posterior. El plan está
                congelado a propósito: rehacerlo es una decisión, no una
                corrección automática. */}
            <p className="rec-plan-desfase-coste">
              Rehacerlo lo reemplaza por las {plan.units.length === 0 ? "aulas" : "aulas"} del sorteo vigente
              y <b>descarta el despliegue preparado</b>{payload?.state.deployment?.status === "handed_off"
                ? <>, incluida su <b>entrega a campo</b></> : null}. Las fichas ya impresas dejan de
              corresponder al plan.
            </p>
            <button type="button" className="cmv2-ghost" disabled={rehaciendo} onClick={rehacer}>
              {rehaciendo ? "Rehaciendo…" : "Rehacer el plan con el sorteo vigente"}
            </button>
          </div>
        ) : null}
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
                <thead><tr><th>Unidad</th><th>Rol</th><th>Cadena</th><th>Programación</th></tr></thead>
                <tbody>
                  {pagination.items.map((unit) => (
                    <tr key={unit.unit_id}>
                      {/* El código operativo manda y el nombre del aula queda
                          de apoyo. El `unit_id` sale de la vista: es un hash
                          para juntar registros, no algo que nadie diga en voz
                          alta. Sigue siendo la `key` de la fila. */}
                      <td>
                        <strong>{unitOperationalCode(unit) || unit.label}</strong>
                        <small>{unitOperationalCode(unit) ? unit.label : unit.unit_id}</small>
                      </td>
                      <td>{unitRoleLabel(unit)}</td>
                      <td>{unitChainLabel(unit)}</td>
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
