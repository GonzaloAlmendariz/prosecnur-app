import type { CSSProperties } from "react";
import type { MonitoreoCorte } from "../../corte/corteContract";
import type { TelefonicoCumplimiento } from "./telefonicoGoalModel";

// Espina dorsal de la portada telefónica: una sola forma para los tres estados
// de objetivo, el embudo con las mermas nombradas y la reserva como dato
// secundario. Ver docs/plan-monitoreo-telefonico-2026-07.md §5.

function metric(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("es-PE").format(Math.round(value));
}

function pctLabel(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1).replace(/\.0$/, "")}%`;
}

function decimalLabel(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(1).replace(/\.0$/, "");
}

const GRANO_LABEL: Record<string, string> = {
  ingesta: "registros del snapshot",
  procesable: "casos procesables",
  oficial: "efectivas válidas",
};

/** Embudo con las mermas nombradas. Sale del contrato de corte, no de cifras sueltas. */
export function TelefonicoEmbudo({ corte }: { corte: MonitoreoCorte }) {
  const pasos = [
    { clave: "ingesta", valor: corte.ingesta as number | null },
    { clave: "procesable", valor: corte.procesable },
    { clave: "oficial", valor: corte.oficial },
  ].filter((paso) => paso.valor != null) as Array<{ clave: string; valor: number }>;
  if (pasos.length < 2) return null;
  const maximo = Math.max(...pasos.map((paso) => paso.valor), 1);
  return (
    <section className="mon-tel-funnel" aria-label="De registros del snapshot a efectivas válidas">
      <header>
        <span>De dónde sale la cifra</span>
        <strong>{metric(pasos[0].valor)} → {metric(pasos[pasos.length - 1].valor)}</strong>
      </header>
      <ol>
        {pasos.map((paso, index) => {
          const salto = index > 0
            ? corte.saltos.find((item) => item.a === paso.clave && item.de === pasos[index - 1].clave)
            : null;
          return (
            <li key={paso.clave}>
              {salto ? (
                <span className="mon-tel-funnel-drop" title={salto.regla}>
                  −{metric(salto.descartados)} · {salto.regla}
                </span>
              ) : null}
              <div className="mon-tel-funnel-step">
                <i
                  aria-hidden="true"
                  style={{ "--funnel-size": `${(paso.valor / maximo) * 100}%` } as CSSProperties}
                />
                <strong>{metric(paso.valor)}</strong>
                <em>{GRANO_LABEL[paso.clave] ?? paso.clave}</em>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * Bloque de cumplimiento. Misma forma en los tres modos: cambia el contenido,
 * nunca el layout, para que la ausencia de cuotas no deje cajas vacías.
 */
export function TelefonicoCumplimientoPanel({
  cumplimiento,
  unidad = "efectivas",
}: {
  cumplimiento: TelefonicoCumplimiento;
  unidad?: string;
}) {
  const { modo, cubierto, brechaTotal, minimoTotal, logradoTotal, reserva, ritmo } = cumplimiento;
  // Si alguna categoría pidió barrer el universo entero, el objetivo del
  // estudio ya no es «el mínimo» y el título tiene que decirlo.
  const hayBarridoTotal = cumplimiento.categorias.some((cat) => cat.objetivo === "barrido");
  const nombreObjetivo = hayBarridoTotal ? "objetivo" : "mínimo";
  const estado = modo === "sin-meta"
    ? { clave: "sin-meta", titulo: "Sin objetivo declarado", detalle: `${metric(logradoTotal)} ${unidad} logradas` }
    : cubierto
      ? { clave: "cubierto", titulo: `${hayBarridoTotal ? "Objetivo" : "Mínimo"} cubierto`, detalle: `${metric(logradoTotal)} de ${metric(minimoTotal)} ${unidad}` }
      : { clave: "brecha", titulo: `Faltan ${metric(brechaTotal)}`, detalle: `${metric(logradoTotal)} de ${metric(minimoTotal)} ${unidad}` };
  const barraPct = modo === "sin-meta" ? 100 : Math.max(0, Math.min(100, cumplimiento.pctTotal ?? 0));

  return (
    <section className={`mon-tel-goal is-${estado.clave}`} aria-label="Cumplimiento del estudio telefónico">
      <header className="mon-tel-goal-head">
        <div>
          <span>
            {modo === "cuotas" ? (hayBarridoTotal ? "Objetivo por cuota" : "Mínimos por cuota") : modo === "total" ? "Mínimo total" : "Producción"}
          </span>
          <strong>{estado.titulo}</strong>
          <em>{estado.detalle}</em>
        </div>
        {modo !== "sin-meta" ? (
          <div className="mon-tel-goal-pct" title={`${pctLabel(cumplimiento.pctTotal)} del ${nombreObjetivo}`}>
            <strong>{pctLabel(cumplimiento.pctTotal)}</strong>
            <small>del {nombreObjetivo}</small>
          </div>
        ) : null}
      </header>

      <div className="mon-tel-goal-bar" aria-hidden="true">
        <i style={{ "--goal-size": `${barraPct}%` } as CSSProperties} />
      </div>

      {modo === "cuotas" ? (
        // Tabla con una sola cabecera: la lista repetía «logradas / mínimo /
        // estado» en cada fila, cinco veces las mismas tres palabras.
        <table className="mon-tel-goal-table">
          <thead>
            <tr>
              <th scope="col">Categoría</th>
              <th scope="col" aria-label="Avance" />
              <th scope="col" className="is-num">Logradas</th>
              <th scope="col" className="is-num">{hayBarridoTotal ? "Objetivo" : "Mínimo"}</th>
              <th scope="col" className="is-num">Falta</th>
            </tr>
          </thead>
          <tbody>
            {cumplimiento.categorias.map((cat) => (
              <tr key={cat.clave} className={cat.cubierto ? "is-cubierto" : "is-brecha"}>
                <th scope="row">
                  {cat.etiqueta}
                  {cat.contexto ? <span>{cat.contexto}</span> : null}
                </th>
                <td className="is-bar">
                  <i
                    style={{ "--goal-size": `${Math.max(0, Math.min(100, cat.pct ?? 0))}%` } as CSSProperties}
                    aria-hidden="true"
                  />
                </td>
                <td className="is-num">{metric(cat.logrado)}</td>
                <td
                  className="is-num"
                  title={cat.objetivo === "barrido" ? "Se acordó barrer el universo completo" : "Mínimo interno a alcanzar"}
                >
                  {metric(cat.referencia)}
                </td>
                <td className={`is-num ${cat.cubierto ? "is-ok" : "is-warn"}`}>
                  {cat.cubierto ? "cubierto" : metric(cat.brecha)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="mon-tel-goal-plain" aria-label="Lectura de producción">
          <span>
            <em>Logradas</em>
            <strong>{metric(logradoTotal)}</strong>
          </span>
          {modo === "total" ? (
            <span className={cubierto ? "is-ok" : "is-warn"}>
              <em>{cubierto ? "Estado" : "Faltan"}</em>
              <strong>{cubierto ? "cubierto" : metric(brechaTotal)}</strong>
            </span>
          ) : null}
          {ritmo ? (
            <span>
              <em>Ritmo</em>
              <strong>{decimalLabel(ritmo.porDia)}<small>/día</small></strong>
            </span>
          ) : null}
        </div>
      )}

      <footer className="mon-tel-goal-foot">
        {/* La reserva es dato secundario cuando el mínimo está cubierto y sube a
            primer plano en cuanto hay brecha. */}
        {reserva ? (
          <span className={cubierto ? "is-quiet" : "is-lead"} title="Casos de la base todavía sin trabajar">
            <em>Reserva de base</em>
            <strong>{metric(reserva.disponible)}</strong>
            {!cubierto && reserva.necesariaEstimada != null ? (
              <small className={reserva.suficiente ? "is-ok" : "is-warn"}>
                {reserva.suficiente
                  ? `alcanza: se estiman ${metric(reserva.necesariaEstimada)} para cerrar`
                  : `no alcanza: se estiman ${metric(reserva.necesariaEstimada)} para cerrar`}
              </small>
            ) : (
              <small>{cubierto ? "sin trabajar, ya no es deuda" : "sin trabajar"}</small>
            )}
          </span>
        ) : null}
        {ritmo && modo === "cuotas" ? (
          <span title={`${decimalLabel(ritmo.porDia)} por día en ${metric(ritmo.diasConDatos)} días con respuesta`}>
            <em>Ritmo</em>
            <strong>{decimalLabel(ritmo.porDia)}<small>/día</small></strong>
          </span>
        ) : null}
        {ritmo?.requeridoPorDia != null ? (
          <span className={ritmo.requeridoPorDia > ritmo.porDia ? "is-warn" : "is-ok"}>
            <em>Requerido</em>
            <strong>{decimalLabel(ritmo.requeridoPorDia)}<small>/día</small></strong>
            <small>{ritmo.diasRestantes} días restantes</small>
          </span>
        ) : ritmo?.diasProyectados != null ? (
          <span title="Días que tomaría cerrar la brecha al ritmo observado">
            <em>Proyección</em>
            <strong>{metric(ritmo.diasProyectados)}<small> días</small></strong>
            <small>al ritmo actual</small>
          </span>
        ) : null}
        {reserva?.costoPorEfectiva != null ? (
          <span title="Registros de base consumidos por cada efectiva lograda">
            <em>Rendimiento</em>
            <strong>{decimalLabel(reserva.costoPorEfectiva)}<small> por efectiva</small></strong>
          </span>
        ) : null}
      </footer>
    </section>
  );
}
