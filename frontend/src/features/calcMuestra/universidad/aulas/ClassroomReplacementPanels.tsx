import { ArrowRight, RefreshCw, Route } from "lucide-react";
import { equivalenciaEtiqueta } from "./equivalenciaEtiquetas";
import type {
  CalcMuestraAulasReplacementSimulation,
  CalcMuestraAulasReplacementSuggestion,
} from "../../../../api/client";
import { fmtInt, rowsFrom, safeNumber } from "../../sharedCore";
import { classroomRowNumber, classroomRowText } from "../shared/format";
import {
  classroomNumberText,
  classroomOperationalCode,
  classroomScore,
  classroomWaveNumber,
} from "./classroomLabels";
import { canonicalClassroomOperationalCode } from "./classroomOperationalCode";
import { ClassroomEmptyState, Metric } from "./ClassroomPrimitives";

type ClassroomReplacementSlot = {
  id: string;
  code: string;
  titularCode: string;
  label: string;
  wave: string;
  order: number;
  match: string;
  scoreDelta: number;
  warning: string;
};

type ClassroomReplacementChain = {
  titularId: string;
  code: string;
  titularLabel: string;
  faculty: string;
  stratum: string;
  eligible: number;
  slots: ClassroomReplacementSlot[];
  /**
   * Aulas del pool extra que están en la facultad de este titular.
   *
   * Medido el 2026-08-21 sobre HSVG2026: 91 de los 190 titulares tienen la
   * cadena incompleta, y para los más cortos el pool NO tiene ninguna aula de
   * su estrato exacto pero sí de su facultad (DERECHO 241, ARTE Y DISEÑO 87,
   * EGC 63, ARTES ESCÉNICAS 21, ARQUITECTURA 8). La tarjeta enseñaba diez
   * casillas «sin reemplazo» idénticas, que se leen como «no hay nada», cuando
   * lo cierto es que no hay nada DEL MISMO ESTRATO. Gonzalo: «sus reemplazos,
   * por mucho que no sean equivalentes, ¿no deberían estar en la cadena? Ahora
   * no los veo».
   */
  poolEnFacultad: number;
};
function classroomReplacementRouteLabel(wave: string | undefined, rank?: number) {
  const numericRank = safeNumber(rank, 0);
  if (numericRank > 0) return `Reemplazo ${fmtInt(numericRank)}`;
  const waveNumber = classroomWaveNumber(String(wave ?? ""));
  if (waveNumber > 1 && waveNumber < 99) return `Reemplazo ${fmtInt(waveNumber - 1)}`;
  return String(wave ?? "Ruta");
}

function classroomSlotNumber(slotId: string, fallback: number) {
  const match = String(slotId ?? "").match(/(\d+)/);
  const parsed = match ? Number(match[1]) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function classroomReplacementMatchLabel(value: string) {
  // Vocabulario canonico compartido (equivalenciaEtiquetas.ts): la jerga
  // «celda» se glosa como estrato del diseño en un solo lugar.
  return equivalenciaEtiqueta(value);
}

/**
 * El tono lo decide la EQUIVALENCIA, no la presencia de un aviso.
 *
 * `if (warning) return "is-warning"` ponía en ámbar todo lo que trajera texto
 * de advertencia, y el aviso de peso analítico («usar peso final sólo si se
 * activa en campo») lo llevan LAS 1.665 reservas encadenadas del estudio real.
 * Resultado medido el 2026-08-21: el semáforo estaba clavado en ámbar y las
 * tres ramas de abajo no se ejecutaban nunca, así que un reemplazo de la misma
 * celda se veía igual que uno que pierde 40 elegibles. Gonzalo, mirando dos
 * tarjetas: «¿por qué está en amarillo?».
 *
 * El aviso de peso sigue mostrándose como nota en el slot; lo que ya no hace es
 * secuestrar el color.
 */
function classroomReplacementSlotTone(value: string) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["misma_celda", "mismo_programa", "mismo_dominio"].includes(normalized)) return "is-strong";
  if (["celda_equivalente", "celda_cercana", "misma_facultad"].includes(normalized)) return "is-good";
  return "is-soft";
}

function classroomReplacementWarningText(value: string, status: string, match: string) {
  const warning = String(value ?? "").trim();
  if (!warning) return "";
  const normalizedStatus = String(status ?? "").trim().toLowerCase();
  const normalizedMatch = String(match ?? "").trim().toLowerCase();
  const isExpectedReserve = normalizedStatus === "reserve_conditional";
  const isMethodologicallyClose = ["misma_celda", "mismo_programa", "mismo_dominio", "celda_cercana", "misma_facultad"].includes(normalizedMatch);
  return isExpectedReserve && isMethodologicallyClose ? "" : warning;
}

export function classroomReplacementChains(
  selectionRows: Array<Record<string, unknown>>,
  simulation?: CalcMuestraAulasReplacementSimulation | null,
  depth = 6,
): ClassroomReplacementChain[] {
  const titulars = selectionRows.filter((row) => classroomRowText(row, ["sample_role"]) === "titular" || classroomRowText(row, ["wave"]) === "M1");
  const reserves = selectionRows
    .filter((row) => classroomRowText(row, ["sample_role"]) === "chain_reserve" || (classroomRowText(row, ["wave"]) !== "M1" && classroomRowText(row, ["sample_role"]) !== "extra_reserve_pool"))
    .sort((a, b) => safeNumber(a.replacement_order, classroomWaveNumber(classroomRowText(a, ["wave"]))) - safeNumber(b.replacement_order, classroomWaveNumber(classroomRowText(b, ["wave"]))));
  const suggestions = rowsFrom<CalcMuestraAulasReplacementSuggestion>(simulation?.suggestions);
  // El pool extra no cuelga de ningún titular: es la bolsa de última instancia.
  const poolPorFacultad = new Map<string, number>();
  for (const row of selectionRows) {
    if (classroomRowText(row, ["sample_role"]) !== "extra_reserve_pool") continue;
    const fac = classroomRowText(row, ["faculty", "stratum"]);
    if (!fac) continue;
    poolPorFacultad.set(fac, (poolPorFacultad.get(fac) ?? 0) + 1);
  }
  // Cada titular seleccionado tiene su ruta y todas viajan a campo, así que la
  // lista las trae todas. Estaba cortada en 24 mientras la selección de
  // referencia trae 30: seis titulares se quedaban sin tarjeta y sin aviso.
  return titulars.map((titular, titularIndex) => {
    const titularId = classroomRowText(titular, ["classroom_id"]);
    const slotId = classroomRowText(titular, ["selection_slot_id"]);
    const slotNumber = classroomSlotNumber(slotId, titularIndex + 1);
    const titularCode = classroomOperationalCode(titular, `CH ${slotNumber}`);
    const faculty = classroomRowText(titular, ["faculty", "stratum"]);
    const stratum = classroomRowText(titular, ["stratum", "faculty"]);
    const suggestionByReserveId = new Map(suggestions
      .filter((item) => item.titular_classroom_id === titularId)
      .sort((a, b) => safeNumber(a.rank, 99) - safeNumber(b.rank, 99))
      .map((item) => [item.reserve_classroom_id, item] as const));
    const tiedReserves = reserves.filter((reserve) => {
      const reserveId = classroomRowText(reserve, ["classroom_id"]);
      if (!reserveId) return false;
      return Boolean((slotId && classroomRowText(reserve, ["selection_slot_id"]) === slotId) || classroomRowText(reserve, ["replacement_for"]) === titularId);
    });
    const fallbackSource = tiedReserves.length ? tiedReserves : reserves;
    const slotsFromPlan = fallbackSource
      .filter((reserve) => {
        const reserveId = classroomRowText(reserve, ["classroom_id"]);
        if (!reserveId) return false;
        if (tiedReserves.length) return true;
        const sameStratum = stratum && classroomRowText(reserve, ["stratum", "faculty"]) === stratum;
        const sameFaculty = faculty && classroomRowText(reserve, ["faculty", "stratum"]) === faculty;
        return sameStratum || sameFaculty;
      })
      .slice(0, depth)
      .map((reserve) => {
        const reserveId = classroomRowText(reserve, ["classroom_id"]);
        const suggestion = suggestionByReserveId.get(reserveId);
        const match = classroomRowText(reserve, ["equivalence_level"]) || (classroomRowText(reserve, ["stratum"]) === stratum ? "misma_celda" : "misma_facultad");
        return {
          id: reserveId,
          code: classroomOperationalCode(reserve, `R ${slotNumber}.${classroomRowNumber(reserve, ["replacement_order"]) || Math.max(1, classroomWaveNumber(classroomRowText(reserve, ["wave"])) - 1)}`),
          titularCode: canonicalClassroomOperationalCode(classroomRowText(reserve, ["titular_operational_code"]), titularCode),
          label: classroomRowText(reserve, ["course_name", "label", "classroom_id"]),
          wave: classroomRowText(reserve, ["wave"]),
          order: classroomRowNumber(reserve, ["replacement_order"]) || classroomWaveNumber(classroomRowText(reserve, ["wave"])),
          match: suggestion?.match_level || match,
          scoreDelta: safeNumber(suggestion?.score_delta, classroomRowNumber(reserve, ["replacement_impact_score", "chain_score"])),
          warning: suggestion?.warning || classroomReplacementWarningText(
            classroomRowText(reserve, ["analysis_weight_warning"]),
            classroomRowText(reserve, ["activation_weight_status"]),
            match,
          ),
        };
      });
    return {
      titularId,
      code: titularCode,
      titularLabel: classroomRowText(titular, ["course_name", "label", "classroom_id"]),
      faculty,
      stratum,
      eligible: classroomRowNumber(titular, ["eligible_n"]),
      slots: slotsFromPlan.slice(0, depth),
      poolEnFacultad: poolPorFacultad.get(faculty) ?? 0,
    };
  });
}

/**
 * Profundidad que la pantalla debe pedir a la cadena: la que el estudio
 * configuró. Vive aquí, y no en la pestaña, para que el recorte no pueda
 * reaparecer en el call site sin que un test lo note.
 */
export function profundidadCadenaPedida(bolsasReemplazo: unknown): number {
  const n = typeof bolsasReemplazo === "number" ? bolsasReemplazo : Number(bolsasReemplazo);
  return Number.isFinite(n) && n >= 1 ? Math.round(n) : 6;
}

export function ClassroomReplacementChainPanel({
  selectionRows,
  simulation,
  depth = 6,
}: {
  selectionRows?: Array<Record<string, unknown>> | unknown;
  simulation?: CalcMuestraAulasReplacementSimulation | null;
  depth?: number;
}) {
  const rows = rowsFrom<Record<string, unknown>>(selectionRows);
  const chains = classroomReplacementChains(rows, simulation, depth);
  const extraPool = rows.filter((row) => classroomRowText(row, ["sample_role"]) === "extra_reserve_pool").length;
  // La profundidad la fija la cadena que el motor construyó, no un tope de la
  // pantalla. Estaba clavada en 6 mientras `bolsas_reemplazo` vale 11: sobre la
  // selección de referencia —30 titulares con 11 reservas cada uno— se dibujaban
  // 6 de 11 y la métrica anunciaba «R n.1–R n.6». Estos códigos viajan a agenda,
  // Excel/Sheets y Monitoreo, así que esconder cinco eslabones de cada ruta hace
  // planificar con menos reemplazos de los que existen.
  const maxDepth = Math.max(1, ...chains.map((chain) => chain.slots.length));
  if (!chains.length) {
    return (
      <ClassroomEmptyState
        icon={Route}
        title="Cadena de reemplazos pendiente"
        detail="Genera la selección para ver cada curso-horario titular y sus reemplazos Rn.1, Rn.2 y siguientes."
      />
    );
  }
  return (
    <div className="cmv2-replacement-chain-panel">
      <div className="cmv2-subhead">
        <strong>Rutas operativas</strong>
        <small>Estos códigos viajan a agenda, Excel/Sheets y Monitoreo para activar reemplazos sin cambiar el diseño.</small>
      </div>
      <div className="cmv2-replacement-chain-summary">
        <Metric label="Titulares con ruta" value={fmtInt(chains.length)} />
        <Metric label="Código operativo" value="CH n / R n.k" />
        <Metric label="Reemplazos por ruta" value={`R n.1–R n.${maxDepth}`} />
        <Metric label="Cursos-horario extra" value={extraPool ? fmtInt(extraPool) : "sin extra"} />
      </div>
      <div className="cmv2-backend-field-strip" aria-label="Datos visibles usados en rutas de reemplazo">
        <span>Código visible del curso-horario</span>
        <span>Titular asociada</span>
        <span>Orden de reemplazo</span>
      </div>
      {/* La regla de activación vale para TODAS las cadenas, así que se dice
          una vez. Estaba dentro de cada tarjeta: con 24 cadenas eran 24
          «Activación ordenada» idénticos y 24 frases que solo cambiaban el
          código. Un rótulo repetido veinticuatro veces deja de informar y pasa
          a ser textura. */}
      <p className="cmv2-chain-route-regla">
        <strong>Activación ordenada.</strong> Si un titular cae, Monitoreo toma su primer
        reemplazo viable y registra el motivo.
      </p>
      <div className="cmv2-chain-route-list">
        {chains.map((chain) => (
          <article key={chain.titularId} className="cmv2-chain-route-card">
            <div className="cmv2-chain-route-head">
              <div className="cmv2-chain-titular">
                <span className="cmv2-chain-code">{chain.code}</span>
                <strong>{chain.titularLabel}</strong>
                <small>{chain.faculty} · {fmtInt(chain.eligible)} elegibles</small>
              </div>
            </div>
            <div className="cmv2-chain-route-slots" aria-label={`Reemplazos para ${chain.titularLabel}`}>
              {Array.from({ length: maxDepth }, (_, index) => {
                const slot = chain.slots[index];
                if (!slot) {
                  // Los huecos se colapsan en UNO que dice qué falta y qué
                  // queda: diez casillas iguales ocupaban la tarjeta entera y
                  // ninguna informaba. Sólo se dibuja en el primer hueco.
                  if (index > chain.slots.length) return null;
                  const faltan = maxDepth - chain.slots.length;
                  return (
                    <span
                      key={index}
                      className="cmv2-chain-empty-slot"
                      data-con-pool={chain.poolEnFacultad > 0 || undefined}
                    >
                      <b>
                        {faltan === 1
                          ? "1 lugar sin cubrir"
                          : `${fmtInt(faltan)} lugares sin cubrir`}
                      </b>
                      {chain.poolEnFacultad > 0 ? (
                        <>
                          Sin más aulas de su estrato exacto.{" "}
                          <em>
                            {fmtInt(chain.poolEnFacultad)} en la reserva extra de{" "}
                            {chain.faculty}, de otro estrato: sirven sólo si se acepta
                            perder equivalencia.
                          </em>
                        </>
                      ) : (
                        "Sin más aulas de su estrato ni reserva extra en su facultad."
                      )}
                    </span>
                  );
                }
                return (
                  <div key={slot.id || index} className={`cmv2-chain-slot ${classroomReplacementSlotTone(slot.match)}`}>
                    <span>
                      <strong>{slot.label}</strong>
                      <b>{slot.code || (slot.order ? `R${slot.order}` : slot.wave)}</b>
                    </span>
                    <small>{classroomReplacementMatchLabel(slot.match)} · reemplaza {slot.titularCode}{slot.scoreDelta ? ` · impacto ${classroomNumberText({ value: slot.scoreDelta }, ["value"])}` : ""}</small>
                    {slot.warning && <em>{slot.warning}</em>}
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function ClassroomReplacementTables({ simulation }: { simulation: CalcMuestraAulasReplacementSimulation }) {
  // La tabla trae todas las sugerencias de la simulación. Estaba cortada en 18
  // mientras el motor emite 3 por titular: sobre la selección de referencia son
  // 90, así que se veían las de 6 titulares y ninguna de los otros 24. La tabla
  // ya vive dentro de `cmv2-classroom-table-wrap`, que le da su propio scroll.
  const suggestions = rowsFrom<CalcMuestraAulasReplacementSuggestion>(simulation?.suggestions);
  if (!suggestions.length) {
    return (
      <ClassroomEmptyState
        icon={RefreshCw}
        title="Sin reemplazos sugeridos"
        detail="La simulación existe, pero no trae sugerencias compatibles con este estado. Vuelve a simular reemplazos con la selección actual."
      />
    );
  }
  return (
    <div className="cmv2-classroom-replacement-stack">
      <div className="cmv2-classroom-table-wrap">
        <table className="cmv2-table cmv2-classroom-table">
          <thead>
            <tr>
              <th>Si cae</th>
              <th>Usar reemplazo</th>
              <th>Ruta</th>
              <th>Equivalencia</th>
              <th className="is-num">Representatividad</th>
              <th className="is-num">Cambio</th>
              <th className="is-num">Repetidos</th>
            </tr>
          </thead>
          <tbody>
            {suggestions.map((item) => (
              <tr key={`${item.titular_classroom_id}-${item.reserve_classroom_id}-${item.rank}`}>
                <td>
                  <span className="cmv2-table-code">{canonicalClassroomOperationalCode(item.titular_operational_code, "CH")}</span>
                  {item.titular_label || item.titular_classroom_id}
                  <small>{item.titular_classroom_id}</small>
                </td>
                <td>
                  <span className="cmv2-table-code">{canonicalClassroomOperationalCode(item.reserve_operational_code || item.replacement_chain_code, `R ${item.rank}`)}</span>
                  {item.reserve_label || item.reserve_classroom_id}
                  <small>{item.reserve_classroom_id}</small>
                </td>
                <td>{classroomReplacementRouteLabel(item.wave, item.rank)}<small>{item.wave}</small></td>
                <td>{item.match_level}</td>
                <td className="is-num">{classroomScore(item.after_score ?? item.score)}</td>
                <td className="is-num">{classroomNumberText(item as unknown as Record<string, unknown>, ["score_delta"])}</td>
                <td className="is-num">{fmtInt(item.overlap_delta ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ClassroomImpactTable rows={simulation?.impact ?? []} />
    </div>
  );
}

function ClassroomImpactTable({ rows }: { rows?: Array<Record<string, unknown>> | unknown }) {
  const visible = rowsFrom<Record<string, unknown>>(rows).slice(0, 12);
  if (!visible.length) return null;
  return (
    <div className="cmv2-classroom-table-wrap">
      <table className="cmv2-table cmv2-classroom-table">
        <thead>
          <tr>
            <th>Titular</th>
            <th>Reemplazo</th>
            <th className="is-num">Representatividad</th>
            <th>Efecto en cuotas</th>
            <th className="is-num">Cambio de elegibles</th>
            <th>Advertencia</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row, index) => (
            <tr key={index}>
              <td>
                <span className="cmv2-table-code">{canonicalClassroomOperationalCode(classroomRowText(row, ["titular_operational_code"]), "CH")}</span>
                {classroomRowText(row, ["titular_classroom_id"])}
              </td>
              <td>
                <span className="cmv2-table-code">{canonicalClassroomOperationalCode(classroomRowText(row, ["replacement_operational_code"]), "R")}</span>
                {classroomRowText(row, ["suggested_replacement_id"])}
              </td>
              <td className="is-num">{classroomScore(classroomRowNumber(row, ["after_score"]))}<small>{classroomNumberText(row, ["score_delta"])}</small></td>
              <td>{classroomRowText(row, ["balance_effect"])}</td>
              <td className="is-num">{classroomNumberText(row, ["eligible_delta"])}</td>
              <td>{classroomRowText(row, ["warning"]) || "sin alerta"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ClassroomReplacementBlueprintPanel({
  depth,
  titularCount,
  reserveCount,
  extraReserveCount,
}: {
  depth: number;
  titularCount: number;
  reserveCount: number;
  extraReserveCount: number;
}) {
  // El ejemplo ilustra la cadena que el estudio va a obtener, así que su
  // longitud es la configurada. Estaba clavado en 5 con `bolsas_reemplazo` en
  // 11: quien mira este estado vacío se hacía una idea a menos de la mitad.
  const routeDepth = profundidadCadenaPedida(depth);
  const replacementCodes = Array.from({ length: routeDepth }, (_, index) => `R 5.${index + 1}`);
  return (
    <div className="cmv2-classroom-replacement-blueprint">
      <div className="cmv2-classroom-route-preview" aria-label="Ejemplo de cadena de reemplazos">
        <span className="is-primary">CH 5</span>
        {replacementCodes.map((code) => (
          <span key={code}>
            <ArrowRight size={13} />
            <b>{code}</b>
          </span>
        ))}
        <span>
          <ArrowRight size={13} />
          <b>Reserva extra</b>
        </span>
      </div>
      <div className="cmv2-classroom-readiness-map">
        <article className={titularCount ? "is-ready" : "is-working"}>
          <small>Cursos-horario titulares</small>
          <strong>{titularCount ? fmtInt(titularCount) : "pendiente"}</strong>
          <span>Cada titular tendrá su propia ruta de reemplazos.</span>
        </article>
        <article className={reserveCount ? "is-ready" : "is-working"}>
          <small>Reemplazos asociados</small>
          <strong>{reserveCount ? fmtInt(reserveCount) : "pendiente"}</strong>
          <span>No son una bolsa suelta: pertenecen a una titular específica.</span>
        </article>
        <article className={extraReserveCount ? "is-ready" : "is-working"}>
          <small>Reserva extra</small>
          <strong>{extraReserveCount ? fmtInt(extraReserveCount) : "pendiente"}</strong>
          <span>Solo se usa cuando la cadena no alcanza o la celda queda frágil.</span>
        </article>
      </div>
    </div>
  );
}
