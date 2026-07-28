import type { CSSProperties } from "react";
import type {
  TelefonicoPlatformGap,
  TelefonicoStatusCell,
  TelefonicoStatusMatrix,
} from "./telefonicoTeamModel";

// Las dos piezas que el engine R ya calculaba y solo viajaban al PDF.
// Ver docs/plan-monitoreo-telefonico-2026-07.md §3.

function metric(value: number | null | undefined) {
  return new Intl.NumberFormat("es-PE").format(Math.round(Number(value ?? 0)));
}

function pctLabel(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1).replace(/\.0$/, "")}%`;
}

function deviationLabel(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "";
  const rounded = Math.round(value);
  if (rounded === 0) return "en la mediana";
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded)} pp vs mediana`;
}

function cellTitle(cell: TelefonicoStatusCell, responsable: string) {
  const base = `${responsable} · ${cell.estado}: ${metric(cell.casos)} casos (${pctLabel(cell.pct)} de su carga)`;
  const dev = deviationLabel(cell.desviacion);
  return dev ? `${base} · ${dev}` : base;
}

/**
 * Matriz estado × encuestador. Hacia abajo diagnostica la base (dónde está
 * mala), hacia el lado diagnostica al equipo (quién necesita apoyo).
 */
export function TelefonicoStatusMatrixPanel({ matrix }: { matrix: TelefonicoStatusMatrix }) {
  if (!matrix.responsables.length || !matrix.estados.length) {
    return (
      <div className="mon-team-empty" aria-label="Sin estados por encuestador">
        <strong>Sin estados por encuestador</strong>
        <span>El corte todavía no trae la distribución de estados desagregada por responsable.</span>
      </div>
    );
  }
  const desviados = matrix.responsables.reduce(
    (sum, row) => sum + row.celdas.filter((cell) => cell.senal !== "normal").length,
    0,
  );
  return (
    <section className="mon-team-matrix" aria-label="Estados telefónicos por encuestador">
      <header className="mon-team-matrix-head">
        <div>
          <span>Estados por encuestador</span>
          <strong>Calidad de la base y desempeño del equipo</strong>
          <p>Se marca lo que se aparta de la mediana del equipo.</p>
        </div>
        <em>{desviados > 0 ? `${metric(desviados)} desvíos marcados` : "Sin desvíos relevantes"}</em>
      </header>
      <div className="mon-team-matrix-scroll">
        <table className="mon-team-matrix-table">
          <thead>
            <tr>
              <th scope="col">Responsable</th>
              <th scope="col" className="is-num">Casos</th>
              {matrix.estados.map((estado) => (
                <th key={estado} scope="col" className="is-num">{estado}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="is-reference">
              <th scope="row">Equipo completo</th>
              <td className="is-num">{metric(matrix.total)}</td>
              {matrix.general.map((cell) => (
                <td key={cell.estado} className="is-num" title={`${cell.estado}: ${metric(cell.casos)} casos`}>
                  <strong>{pctLabel(cell.pct)}</strong>
                  <small>{metric(cell.casos)}</small>
                </td>
              ))}
            </tr>
            {matrix.responsables.map((row) => (
              <tr key={row.key}>
                <th scope="row">
                  {row.responsable}
                  {row.total < matrix.minimoParaComparar ? (
                    <span className="mon-team-matrix-note" title={`Menos de ${matrix.minimoParaComparar} casos: no entra en la mediana`}>
                      poco volumen
                    </span>
                  ) : null}
                </th>
                <td className="is-num">{metric(row.total)}</td>
                {row.celdas.map((cell) => (
                  <td
                    key={`${row.key}-${cell.estado}`}
                    className={`is-num is-${cell.senal}`}
                    title={cellTitle(cell, row.responsable)}
                    style={{ "--team-cell-weight": `${Math.max(0, Math.min(100, cell.pct ?? 0))}%` } as CSSProperties}
                  >
                    <strong>{pctLabel(cell.pct)}</strong>
                    <small>{metric(cell.casos)}</small>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="mon-team-matrix-foot">
        <span className="is-alta">Por encima de la mediana del equipo</span>
        <span className="is-baja">Por debajo</span>
        <span>Mediana calculada sobre responsables con {matrix.minimoParaComparar} casos o más.</span>
      </footer>
    </section>
  );
}

/**
 * Descuadre plataforma↔barrido por responsable. Es detección temprana: la
 * brecha significa que alguien entrevistó y no registró el estado en la hoja.
 */
export function TelefonicoPlatformGapPanel({
  gap,
  plataformaLabel = "plataforma",
}: {
  gap: TelefonicoPlatformGap;
  plataformaLabel?: string;
}) {
  if (!gap.filas.length) {
    return (
      <div className="mon-team-empty" aria-label="Sin comparación plataforma y barrido">
        <strong>Sin comparación por responsable</strong>
        <span>El corte todavía no trae el cruce de efectivas entre {plataformaLabel} y la hoja de barrido.</span>
      </div>
    );
  }
  const maxBrecha = Math.max(1, ...gap.filas.map((fila) => fila.brecha));
  return (
    <section className="mon-team-gap" aria-label="Plataforma contra barrido por responsable">
      <header className="mon-team-gap-head">
        <div>
          <span>Plataforma contra barrido</span>
          <strong>Quién tiene entrevistas sin registrar</strong>
          <p>Solo casos con responsable asignado, por eso el total puede ser menor al del corte.</p>
        </div>
        <em className={gap.totales.brecha > 0 ? "is-warn" : ""}>
          {gap.totales.brecha > 0
            ? `${metric(gap.totales.brecha)} sin registrar`
            : "Registro al día"}
        </em>
      </header>
      <div className="mon-team-gap-totals" aria-label="Totales del cruce">
        <span>
          <em>Efectivas en {plataformaLabel}</em>
          <strong>{metric(gap.totales.efectivasPlataforma)}</strong>
        </span>
        <span>
          <em>Efectivas en el barrido</em>
          <strong>{metric(gap.totales.efectivasTel)}</strong>
        </span>
        <span>
          <em>Cruzadas por CodPulso</em>
          <strong>{metric(gap.totales.conciliadas)}</strong>
        </span>
        <span className={gap.totales.plataformaSinTel > 0 ? "is-warn" : ""}>
          <em>Entrevistadas sin registrar</em>
          <strong>{metric(gap.totales.plataformaSinTel)}</strong>
        </span>
        <span className={gap.totales.telSinPlataforma > 0 ? "is-risk" : ""}>
          <em>Registradas sin encuesta</em>
          <strong>{metric(gap.totales.telSinPlataforma)}</strong>
        </span>
      </div>
      <ul className="mon-team-gap-list">
        {gap.filas.map((fila) => (
          <li key={fila.key} className={fila.brecha > 0 ? "is-pending" : "is-clean"}>
            <div className="mon-team-gap-name">
              <strong>{fila.responsable}</strong>
              {fila.actor ? <span>{fila.actor}</span> : null}
            </div>
            <div
              className="mon-team-gap-bar"
              style={{ "--team-gap-size": `${(fila.brecha / maxBrecha) * 100}%` } as CSSProperties}
              aria-hidden="true"
            />
            <div className="mon-team-gap-figures">
              <span title={`${metric(fila.efectivasPlataforma)} efectivas en ${plataformaLabel}`}>
                <em>{plataformaLabel}</em>
                <strong>{metric(fila.efectivasPlataforma)}</strong>
              </span>
              <span title={`${metric(fila.efectivasTel)} efectivas declaradas en el barrido`}>
                <em>barrido</em>
                <strong>{metric(fila.efectivasTel)}</strong>
              </span>
              <span className={fila.brecha > 0 ? "is-warn" : ""} title="Entrevistas completas sin estado registrado en la hoja">
                <em>sin registrar</em>
                <strong>{metric(fila.brecha)}</strong>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Cuadro fijo de conciliación para la portada. */
export function TelefonicoReconciliationSummary({
  plataforma,
  barrido,
  cruzadas,
  pendientes,
  plataformaLabel = "plataforma",
}: {
  plataforma: number;
  barrido: number;
  cruzadas: number;
  pendientes: number;
  plataformaLabel?: string;
}) {
  return (
    <div className="mon-team-reconciliation" aria-label="Conciliación entre plataforma y barrido">
      <span className="is-lead">
        <em>Efectivas ({plataformaLabel})</em>
        <strong>{metric(plataforma)}</strong>
        <small>producción real</small>
      </span>
      <span>
        <em>Declaradas en barrido</em>
        <strong>{metric(barrido)}</strong>
        <small>completitud del registro</small>
      </span>
      <span>
        <em>Cruzadas</em>
        <strong>{metric(cruzadas)}</strong>
        <small>coinciden por CodPulso</small>
      </span>
      <span className={pendientes > 0 ? "is-warn" : ""}>
        <em>Sin registrar</em>
        <strong>{metric(pendientes)}</strong>
        <small>entrevistadas, falta marcar</small>
      </span>
    </div>
  );
}
