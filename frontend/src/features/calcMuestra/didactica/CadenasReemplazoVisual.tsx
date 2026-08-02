/**
 * Árbol didáctico de cadenas de reemplazo: cada aula titular con sus
 * reservas equivalentes (R1, R2) ya sorteadas por el motor. Versión
 * simplificada de `classroomReplacementChains` de CalcMuestraPage, solo
 * para explicar el plan — la operación real vive en el panel principal.
 * HTML/CSS puro, sin Plotly.
 */
import { useMemo, useState } from "react";
import { ArrowRight, ChevronDown, ChevronUp, Route } from "../../../vendor/lucide-react";
import type {
  CalcMuestraAulasReplacementSimulation,
  CalcMuestraAulasReplacementSuggestion,
  CalcMuestraAulasSelection,
} from "../../../api/client";
import { BadgeMotor, TerminoGlosario } from "./PasoDidactico";
import { rowsFrom, rowText, safeNum } from "./didacticaData";
import { canonicalClassroomOperationalCode } from "../universidad/aulas/classroomOperationalCode";

const MAX_CADENAS_VISIBLES = 8;
const MAX_RESERVAS_POR_CADENA = 2;
/** Al expandir, las cadenas se agregan por bloques para no colgar el DOM
    cuando el proyecto real trae cientos de cadenas. */
const BLOQUE_CADENAS = 50;

type ReservaNodo = {
  id: string;
  codigo: string;
  etiqueta: string;
  nivel: string;
  scoreDelta: number;
  warning: string;
};

type Cadena = {
  id: string;
  codigo: string;
  etiqueta: string;
  facultad: string;
  reservas: ReservaNodo[];
};

function waveNumber(wave: string): number {
  const match = String(wave ?? "").match(/(\d+)/);
  return match ? Number(match[1]) : 99;
}

function slotNumber(slotId: string, fallback: number): number {
  const match = String(slotId ?? "").match(/(\d+)/);
  const parsed = match ? Number(match[1]) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function codigoOperativo(row: Record<string, unknown>, fallback: string): string {
  const raw = rowText(row, ["operational_code", "codigo_operativo", "codigo_aula_operativa"]) || fallback;
  return canonicalClassroomOperationalCode(raw);
}

function nivelLabel(nivel: string): string {
  const normalizado = String(nivel ?? "").trim().toLowerCase();
  const labels: Record<string, string> = {
    misma_celda: "misma celda",
    celda_equivalente: "celda equivalente",
    celda_cercana: "celda cercana",
    misma_facultad: "misma facultad",
    mismo_programa: "mismo programa",
    mismo_dominio: "mismo dominio",
  };
  return labels[normalizado] ?? (normalizado.replace(/_/g, " ") || "equivalencia pendiente");
}

function nivelTono(nivel: string, warning: string): string {
  if (warning) return "alerta";
  const normalizado = String(nivel ?? "").trim().toLowerCase();
  if (["misma_celda", "mismo_programa", "mismo_dominio"].includes(normalizado)) return "fuerte";
  if (["celda_equivalente", "celda_cercana", "misma_facultad"].includes(normalizado)) return "bueno";
  return "suave";
}

function construirCadenas(
  rows: Array<Record<string, unknown>>,
  simulacion: CalcMuestraAulasReplacementSimulation | null | undefined,
): Cadena[] {
  const titulares = rows.filter(
    (row) => rowText(row, ["sample_role"]) === "titular" || rowText(row, ["wave"]) === "M1",
  );
  const reservas = rows
    .filter((row) => {
      const role = rowText(row, ["sample_role"]);
      if (role === "chain_reserve") return true;
      return role !== "titular" && role !== "extra_reserve_pool" && rowText(row, ["wave"]) !== "M1";
    })
    .sort(
      (a, b) =>
        safeNum(a.replacement_order, waveNumber(rowText(a, ["wave"]))) -
        safeNum(b.replacement_order, waveNumber(rowText(b, ["wave"]))),
    );
  const sugerencias = rowsFrom<CalcMuestraAulasReplacementSuggestion>(simulacion?.suggestions);

  return titulares.map((titular, index) => {
    const titularId = rowText(titular, ["classroom_id"]);
    const slotId = rowText(titular, ["selection_slot_id"]);
    const numero = slotNumber(slotId, index + 1);
    const codigoTitular = codigoOperativo(titular, `CH ${numero}`);
    const facultad = rowText(titular, ["faculty", "facultad", "stratum"]);
    const estrato = rowText(titular, ["stratum", "faculty"]);

    const sugerenciaPorReserva = new Map(
      sugerencias
        .filter((item) => item.titular_classroom_id === titularId)
        .sort((a, b) => safeNum(a.rank, 99) - safeNum(b.rank, 99))
        .map((item) => [item.reserve_classroom_id, item] as const),
    );

    const atadas = reservas.filter((reserva) => {
      const reservaId = rowText(reserva, ["classroom_id"]);
      if (!reservaId) return false;
      return Boolean(
        (slotId && rowText(reserva, ["selection_slot_id"]) === slotId) ||
          rowText(reserva, ["replacement_for"]) === titularId,
      );
    });
    const fuente = atadas.length ? atadas : reservas;

    const nodos = fuente
      .filter((reserva) => {
        const reservaId = rowText(reserva, ["classroom_id"]);
        if (!reservaId) return false;
        if (atadas.length) return true;
        const mismoEstrato = Boolean(estrato) && rowText(reserva, ["stratum", "faculty"]) === estrato;
        const mismaFacultad = Boolean(facultad) && rowText(reserva, ["faculty", "stratum"]) === facultad;
        return mismoEstrato || mismaFacultad;
      })
      .slice(0, MAX_RESERVAS_POR_CADENA)
      .map((reserva, ordenIndex) => {
        const reservaId = rowText(reserva, ["classroom_id"]);
        const sugerencia = sugerenciaPorReserva.get(reservaId);
        const nivel =
          sugerencia?.match_level ||
          rowText(reserva, ["equivalence_level"]) ||
          (estrato && rowText(reserva, ["stratum"]) === estrato ? "misma_celda" : "misma_facultad");
        const orden =
          safeNum(reserva.replacement_order, Number.NaN) ||
          Math.max(1, waveNumber(rowText(reserva, ["wave"])) - 1) ||
          ordenIndex + 1;
        return {
          id: reservaId,
          codigo: codigoOperativo(reserva, `R ${numero}.${orden}`),
          etiqueta: rowText(reserva, ["course_name", "label", "classroom_id"]),
          nivel,
          scoreDelta: sugerencia?.score_delta ?? safeNum(reserva.replacement_impact_score, Number.NaN),
          warning: String(sugerencia?.warning ?? "").trim(),
        } satisfies ReservaNodo;
      });

    return {
      id: titularId || `titular-${index}`,
      codigo: codigoTitular,
      etiqueta: rowText(titular, ["course_name", "label", "classroom_id"]),
      facultad,
      reservas: nodos,
    } satisfies Cadena;
  });
}

export function CadenasReemplazoVisual({
  seleccion,
  simulacion,
}: {
  seleccion: CalcMuestraAulasSelection | null | undefined;
  simulacion: CalcMuestraAulasReplacementSimulation | null | undefined;
}) {
  const cadenas = useMemo(() => {
    if (!seleccion) return null;
    const rows = rowsFrom<Record<string, unknown>>(seleccion.selection);
    if (!rows.length) return null;
    return construirCadenas(rows, simulacion);
  }, [seleccion, simulacion]);

  /** Cuántas cadenas se muestran: 8 colapsado, +50 por clic al expandir. */
  const [limite, setLimite] = useState(MAX_CADENAS_VISIBLES);

  if (!seleccion || !cadenas) return null;
  const visibles = cadenas.slice(0, limite);
  const restantes = cadenas.length - visibles.length;
  const expandida = limite > MAX_CADENAS_VISIBLES && cadenas.length > MAX_CADENAS_VISIBLES;

  return (
    <div className="cmv2-did-result">
      <div className="cmv2-did-result-head">
        <span className="cmv2-eyebrow">Plan B ya sorteado: qué entra si un curso-horario cae</span>
        <BadgeMotor estado="validado" />
      </div>

      {visibles.length > 0 && (
        <ol className={`cmv2-did-chain-list${expandida ? " is-expandida" : ""}`}>
          {visibles.map((cadena) => (
            <li key={cadena.id} className="cmv2-did-chain">
              <div className="cmv2-did-chain-titular">
                <span className="cmv2-did-chain-code">{cadena.codigo}</span>
                <span className="cmv2-did-chain-label">{cadena.etiqueta || "curso-horario titular"}</span>
                {cadena.facultad && <span className="cmv2-did-chain-fac">{cadena.facultad}</span>}
              </div>
              <div className="cmv2-did-chain-reservas">
                {cadena.reservas.length === 0 && (
                  <span className="cmv2-did-chain-empty">sin reserva asignada aún</span>
                )}
                {cadena.reservas.map((reserva) => (
                  <div key={reserva.id} className="cmv2-did-chain-reserva" data-tono={nivelTono(reserva.nivel, reserva.warning)}>
                    <ArrowRight size={12} className="cmv2-did-chain-arrow" aria-hidden="true" />
                    <span className="cmv2-did-chain-code">{reserva.codigo}</span>
                    <span className="cmv2-did-chain-nivel">{nivelLabel(reserva.nivel)}</span>
                    {Number.isFinite(reserva.scoreDelta) && reserva.scoreDelta !== 0 && (
                      <span className="cmv2-did-chain-delta" data-signo={reserva.scoreDelta > 0 ? "sube" : "baja"}>
                        {reserva.scoreDelta > 0 ? "+" : ""}
                        {reserva.scoreDelta.toFixed(2)}
                      </span>
                    )}
                    {reserva.warning && (
                      <span className="cmv2-did-chain-warning" title={reserva.warning}>
                        aviso
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}
      {(restantes > 0 || expandida) && (
        <div className="cmv2-did-chain-acciones">
          {!expandida && restantes > 0 && (
            <button
              type="button"
              className="cmv2-did-chain-toggle"
              onClick={() => setLimite(MAX_CADENAS_VISIBLES + BLOQUE_CADENAS)}
            >
              <Route size={12} aria-hidden="true" />
              Ver todas las cadenas ({cadenas.length.toLocaleString("es-PE")})
              <ChevronDown size={12} aria-hidden="true" />
            </button>
          )}
          {expandida && restantes > 0 && (
            <button
              type="button"
              className="cmv2-did-chain-toggle"
              onClick={() => setLimite((prev) => prev + BLOQUE_CADENAS)}
            >
              <ChevronDown size={12} aria-hidden="true" />
              Mostrar {Math.min(BLOQUE_CADENAS, restantes).toLocaleString("es-PE")} más
              <em>quedan {restantes.toLocaleString("es-PE")} de {cadenas.length.toLocaleString("es-PE")}</em>
            </button>
          )}
          {expandida && (
            <button
              type="button"
              className="cmv2-did-chain-toggle is-cerrar"
              onClick={() => setLimite(MAX_CADENAS_VISIBLES)}
            >
              <ChevronUp size={12} aria-hidden="true" />
              Ver menos
            </button>
          )}
        </div>
      )}

      <p className="cmv2-did-note">
        Ojo con no confundir dos ideas: el <TerminoGlosario termino="reemplazo" /> sustituye un curso-horario caído
        (cerrada, sin permiso del docente) por una equivalente ya sorteada — misma celda o misma facultad — de
        modo que el diseño de la muestra se mantiene intacto. La{" "}
        <TerminoGlosario termino="sobremuestra" />, en cambio, son casos extra planificados desde el inicio para
        absorber la no respuesta esperada. El reemplazo cambia "quién", la sobremuestra ajusta "cuántos".
      </p>
    </div>
  );
}
