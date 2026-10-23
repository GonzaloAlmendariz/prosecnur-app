import { useMemo } from "react";
import { ClipboardCheck } from "../../../../../vendor/lucide-react";
import type { MonitoreoAcreditacionReports } from "../../../../../api/client";
import { EstadoVacio } from "../../../../../components/EstadoVacio";
import { NotaDelModo } from "../../../core/NotaDelModo";
import { construirSupervision, porcentajeLegible } from "./supervisionModel";
import "./controlTelefonico.css";
import "./supervision.css";

function n(valor: number) {
  return valor.toLocaleString("es-PE");
}

/**
 * Control › Supervisión (T9): qué efectivas se vuelven a llamar. A la
 * izquierda, el sorteo (base, cantidad declarada y su porcentaje, semilla y
 * regla), el reparto por enumerador (efectivas y casos, misma escala) y los
 * resultados; a la derecha, los casos sorteados con el resultado de la
 * rellamada si hay hoja de supervisión.
 */
export function Supervision({ reports }: { reports: MonitoreoAcreditacionReports }) {
  const modelo = useMemo(() => construirSupervision(reports), [reports]);

  if (!modelo || !modelo.base) {
    return (
      <section className="mon-ctl-panel mon-sup-vacio" aria-label="Supervisión" data-qa-geometry-capacity="owned">
        <EstadoVacio
          tamano="normal"
          icono={<ClipboardCheck size={22} />}
          titulo="Sin efectivas para sortear"
          descripcion={modelo ? "El corte no trae efectivas de Kobo: la muestra de supervisión sale de ellas." : "El corte es anterior a la supervisión por enumerador; actualiza para sortear."}
        />
      </section>
    );
  }

  const maximo = Math.max(1, ...modelo.reparto.map((fila) => fila.efectivas));
  const minimos = modelo.reparto.filter((fila) => fila.minimo).length;

  return (
    <div className="mon-sup" data-qa-geometry-group="telefonico-control-supervision" data-qa-geometry-contract="intrinsic">
      {/* Dos columnas que terminan juntas: a la izquierda el sorteo, el reparto
        * (que toma el alto que queda y desplaza) y los resultados; al centro la
        * lista de casos. Sin tarjetas estiradas. */}
      <div className="mon-sup-izquierda">
          <section className="mon-ctl-panel mon-insumos-tarjeta" aria-label="Sorteo">
            <span className="mon-ctl-antetitulo">Sorteo</span>
            <dl className="mon-sup-sorteo">
              <div><dt>Base</dt><dd className="is-num">{n(modelo.base)} efectivas</dd></div>
              <div><dt>Casos</dt><dd className="is-num">{n(modelo.casos)}</dd></div>
              <div><dt>Equivale a</dt><dd className="is-num">{porcentajeLegible(modelo.porcentaje)} de la base</dd></div>
              <div><dt>Declarados en el proyecto</dt><dd className="is-num">{n(modelo.declarados)}</dd></div>
              <div><dt>Semilla</dt><dd className="is-num">{modelo.semilla || "—"}</dd></div>
            </dl>
            <p>Proporcional a las efectivas de cada enumerador, con al menos un caso por enumerador. La misma semilla da la misma lista.</p>
            {modelo.porElMinimo > 0 ? (
              <NotaDelModo tono="info">
                {minimos === 1 ? "Un enumerador sube" : `${n(minimos)} enumeradores suben`} a un caso por el mínimo: el sorteo pasa de {n(Math.min(modelo.declarados, modelo.base))} a {n(modelo.casos)}.
              </NotaDelModo>
            ) : null}
          </section>
        <section className="mon-ctl-panel mon-sup-reparto" aria-label="Por enumerador" data-qa-geometry-capacity="owned">
          <header className="mon-ctl-panel-cabecera">
            <b>Por enumerador</b>
            <span>{n(modelo.reparto.length)} con efectivas</span>
          </header>
          <ul className="mon-sup-lista">
            {modelo.reparto.map((fila) => (
              <li key={fila.enumerador}>
                <span className="mon-sup-nombre">
                  {fila.enumerador}
                  {fila.minimo ? <em className="mon-sup-minimo" title="El caso existe por el mínimo de uno por enumerador">mínimo</em> : null}
                </span>
                <i className="mon-sup-barras" aria-hidden="true">
                  <i className="is-efectivas" style={{ width: `${(fila.efectivas / maximo) * 100}%` }} />
                  <i className="is-casos" style={{ width: `${(fila.casos / maximo) * 100}%` }} />
                </i>
                <span className="mon-sup-cifras is-num">{n(fila.efectivas)} · <b>{n(fila.casos)}</b></span>
              </li>
            ))}
          </ul>
          <footer className="mon-sup-leyenda">
            <span><i className="is-efectivas" aria-hidden="true" />Efectivas</span>
            <span><i className="is-casos" aria-hidden="true" />Casos sorteados</span>
          </footer>
        </section>
          <section className="mon-ctl-panel mon-insumos-tarjeta" aria-label="Resultados de la rellamada">
            <span className="mon-ctl-antetitulo">Resultados de la rellamada</span>
            {modelo.hojaConectada ? (
              <dl className="mon-sup-sorteo">
                {modelo.enHoja != null ? <div><dt>En la hoja</dt><dd className="is-num">{n(modelo.enHoja)} de {n(modelo.casos)}</dd></div> : null}
              <div><dt>Coinciden con Kobo</dt><dd className="is-num">{n(modelo.resultados.coinciden)}</dd></div>
                <div><dt>No coinciden</dt><dd className="is-num">{n(modelo.resultados.noCoinciden)}</dd></div>
                <div><dt>Sin rellamar todavía</dt><dd className="is-num">{n(modelo.resultados.sinResultado)}</dd></div>
              </dl>
            ) : (
              <NotaDelModo tono="neutro">Sin hoja de supervisión: el resultado de cada rellamada aparece cuando el proyecto la conecta.</NotaDelModo>
            )}
          </section>
      </div>

      <section className="mon-ctl-panel mon-sup-casos" aria-label="Casos sorteados" data-qa-geometry-capacity="owned">
        <header className="mon-ctl-panel-cabecera">
          <b>Casos sorteados</b>
          <span>{n(modelo.casos)} para volver a llamar</span>
        </header>
        <div className="mon-ctl-tabla-marco mon-sup-marco">
          <table className="mon-ctl-tabla mon-sup-tabla">
            <thead>
              <tr>
                <th scope="col" className="is-num">N</th>
                <th scope="col">CodPulso</th>
                <th scope="col">proGres</th>
                <th scope="col">Enumerador</th>
                <th scope="col">Categoría</th>
                <th scope="col">Envío</th>
                <th scope="col">Resultado de la rellamada</th>
                <th scope="col">Controles</th>
              </tr>
            </thead>
            <tbody>
              {modelo.sorteados.map((caso) => (
                <tr key={caso.codigo}>
                  <td className="is-num">{n(caso.n)}</td>
                  <th scope="row">{caso.codigo}</th>
                  <td>{caso.progres || "—"}</td>
                  <td>{caso.enumerador}</td>
                  <td>{caso.categoria || "—"}</td>
                  <td>{caso.fechaKobo || "—"}</td>
                  <td>
                    {modelo.hojaConectada ? (
                      caso.resultado || caso.statusFinal ? (
                        <span className={`mon-sup-resultado${caso.coincide === "No" ? " is-no" : caso.coincide === "Sí" ? " is-si" : ""}`} title={caso.observacion || undefined}>
                          {[caso.resultado, caso.statusFinal].filter(Boolean).join(" · ")}
                          {caso.coincide ? ` (${caso.coincide === "Sí" ? "coincide" : "no coincide"})` : ""}
                        </span>
                      ) : <span className="mon-sup-pendiente">Sin rellamar</span>
                    ) : <span className="mon-sup-pendiente">Sin hoja de supervisión</span>}
                  </td>
                  <td
                    className={caso.controlesQueNoCoinciden.length ? "mon-sup-controles is-no" : "mon-sup-controles"}
                    title={caso.controlesQueNoCoinciden.length ? `No coinciden: ${caso.controlesQueNoCoinciden.join("; ")}` : undefined}
                  >
                    {modelo.hojaConectada ? caso.controles || "—" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
}
