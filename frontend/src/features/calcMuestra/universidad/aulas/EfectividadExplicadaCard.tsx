/**
 * «De dónde sale el esperado de cada aula» — la aritmética del valor de
 * validez, visible donde se usa.
 *
 * Gonzalo (2026-08-20): «son tantos cálculos que me mareé… ese es el valor de
 * validez, y tiene que estar claro tanto aquí como de forma resumida en
 * Monitoreo». La tarjeta enseña UNA cuenta viva (la primera titular) y las dos
 * tablas de tasas derivadas de lo que el motor escribió en estas filas.
 */
import { fmtInt } from "../../sharedCore";
import { efectividadExplicada } from "./efectividadExplicadaModel";
import "./efectividadExplicada.css";

type Fila = Record<string, unknown>;

const pct = (v: number) => `${Math.round(v * 100)} %`;

/** «DOCENTE CONTRATADO - CONTRATADO» → «contratado - contratado»; un aula con
 *  dos docentes viene compuesta con « | » y se lee «X y Y (manda el más
 *  restrictivo)» — así aplicó el motor la tasa. */
const suave = (s: string) => {
  const partes = s
    .toLowerCase()
    .split("|")
    .map((p) => p.trim().replace(/^docente\s+/, ""))
    .filter(Boolean);
  if (partes.length <= 1) return partes[0] ?? s.toLowerCase();
  return `${partes.join(" y ")} (manda el más restrictivo)`;
};

export function EfectividadExplicadaCard({ filas }: { filas: Fila[] | null }) {
  const m = efectividadExplicada(filas);
  if (!m) return null;
  return (
    <section className="cmv2-generales-card cmv2-efexp" aria-label="De dónde sale el esperado de cada aula">
      <header>
        <strong>De dónde sale el esperado de cada aula</strong>
        <span>
          la misma cuenta para las {fmtInt((filas ?? []).length)} titulares, con las tasas que el
          2025 ejecutado dejó medidas
        </span>
      </header>

      {m.ejemplo && (
        <p className="cmv2-efexp-cuenta">
          <b>{m.ejemplo.curso}</b>: {fmtInt(m.ejemplo.elegibles)} elegibles sentados ×{" "}
          {pct(m.ejemplo.pAplicada)}{" "}
          <small>
            (docente {suave(m.ejemplo.docente)}: en 2025 ese tipo dejó aplicar el{" "}
            {pct(m.ejemplo.pAplicada)} de sus aulas)
          </small>{" "}
          × {pct(m.ejemplo.rendimiento)}{" "}
          <small>
            (en 2025, las aulas de {m.ejemplo.rangoTamano} elegibles rindieron el{" "}
            {pct(m.ejemplo.rendimiento)})
          </small>{" "}
          → <b>{fmtInt(Math.round(m.ejemplo.esperadas))} efectivas esperadas</b>.{" "}
          <b>Ese {fmtInt(Math.round(m.ejemplo.esperadas))} — no una tasa global — es el valor de
          validez con el que Monitoreo juzga esta aula</b>; cada aula lleva el suyo.
        </p>
      )}

      <div className="cmv2-efexp-tablas">
        <div className="cmv2-efexp-tabla">
          <h4>Cuánto deja aplicar cada tipo de docente</h4>
          <ul>
            {m.porDocente.map((g) => (
              <li key={g.tasa}>
                <span className="cmv2-efexp-etq">{suave(g.etiqueta)}</span>
                <i className="cmv2-efexp-track">
                  <b style={{ width: `${g.tasa * 100}%` }} />
                </i>
                <span className="cmv2-efexp-num">
                  {pct(g.tasa)} <small>{fmtInt(g.nAulas)} aulas</small>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="cmv2-efexp-tabla">
          <h4>Cuánto rinde cada tamaño de aula</h4>
          <ul>
            {m.porTamano.map((g) => (
              <li key={g.tasa}>
                <span className="cmv2-efexp-etq">
                  {g.minElegibles === g.maxElegibles
                    ? `aulas de ${fmtInt(g.minElegibles)} elegibles`
                    : `aulas de ${fmtInt(g.minElegibles)}–${fmtInt(g.maxElegibles)} elegibles`}
                </span>
                <i className="cmv2-efexp-track">
                  <b style={{ width: `${g.tasa * 100}%` }} />
                </i>
                <span className="cmv2-efexp-num">
                  {pct(g.tasa)} <small>{fmtInt(g.nAulas)} aulas</small>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* El control de coherencia — NO es lo que usa Monitoreo (eso es el
          esperado de cada aula, arriba). Gonzalo (2026-08-20): la primera
          versión mezcló las dos cosas y lo mareó. */}
      <p className="cmv2-efexp-pie">
        Control de coherencia: las {fmtInt((filas ?? []).length)} cuentas suman{" "}
        <b>{fmtInt(Math.round(m.totalEsperadas))} esperadas</b> sobre{" "}
        {fmtInt(m.totalElegibles)} elegibles sentados — {pct(m.tasaGlobal)}, que se descompone en{" "}
        {pct(m.pAplicadaMedia)} <small>(la parte de aulas que se dejan aplicar)</small> ×{" "}
        {pct(m.tauImplicito)} <small>(el rendimiento al aplicar: el mismo τ que dimensionó
        cuántas aulas pedir)</small>. La brecha entre ambas tasas es el riesgo de que un aula se
        caiga, y eso lo recupera la cadena de reemplazos — por eso existe.
      </p>
    </section>
  );
}
