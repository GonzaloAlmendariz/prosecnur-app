import { memo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Info } from "lucide-react";

import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import { fmt } from "../kpisDeAulas";
import { construirMetas, readinessDeMetas } from "./metasModelo";
import "../insumos/insumos.css";
import "./modelo.css";

const RUTA_DISENO = "/calc-muestra?modo=opinion-universitaria&seccion=calculo";

/**
 * Modelo › Metas (ficha M1). Arriba la franja (muestra, sobremuestra, meta
 * operativa, tasa prevista); a la izquierda la cuota por las variables que el
 * estudio declara; a la derecha cuánto se espera de los titulares y la tasa
 * prevista por grupo. Solo lectura: la meta se edita en Cálculo de muestra.
 */
function MetasAulasImpl({ dashboard, cargando, vacioSinTablero }: {
  dashboard: MonitoreoAulasDashboard | null;
  cargando: boolean;
  vacioSinTablero: ReactNode;
}) {
  const modelo = cargando ? null : construirMetas(dashboard);
  const readiness = readinessDeMetas(cargando, modelo);
  if (!modelo) return <section className="aulas-ins aulas-ins--silueta" aria-label="Metas" aria-busy="true" data-audit-ready={readiness} />;
  if (modelo.estado === "sin-tablero") return <section className="aulas-ins" aria-label="Metas" data-audit-ready={readiness}>{vacioSinTablero}</section>;
  if (modelo.estado === "sin-diseno") {
    return (
      <section className="aulas-ins aulas-ins--una" aria-label="Metas" data-audit-ready={readiness}>
        <section className="aulas-ins-panel">
          <p className="aulas-ins-nota" data-qa-geometry-empty="legitimo">{modelo.causa} <Link to={RUTA_DISENO}>Abrir el diseño</Link></p>
        </section>
      </section>
    );
  }

  const conColumnas = modelo.columnas.length > 0;
  const delAula = modelo.total.titulares != null;
  return (
    <section
      className="aulas-mm"
      aria-label="Metas"
      data-audit-ready={readiness}
      data-qa-geometry-group="aulas-modelo-metas"
      data-qa-geometry-contract="intrinsic"
    >
      <dl className="aulas-mm-franja" data-qa-geometry-member="franja" data-qa-geometry-group="aulas-modelo-metas-franja" data-qa-geometry-contract="equal">
        {modelo.franja.map((c) => (
          <div key={c.clave} data-qa-geometry-member={c.clave}>
            <dt>{c.rotulo}</dt>
            <dd>{c.valor}</dd>
            <span>{c.sub}</span>
          </div>
        ))}
      </dl>
      {modelo.desfasado ? (
        <p className="aulas-ins-chip aulas-mm-aviso" data-tono="aviso" role="status">
          <Info size={13} aria-hidden="true" /> {modelo.desfasado} <Link to={RUTA_DISENO}>Abrir el diseño</Link>
        </p>
      ) : null}
      <div className="aulas-mm-cuerpo" data-qa-geometry-member="cuerpo" data-qa-geometry-group="aulas-modelo-metas-cuerpo" data-qa-geometry-contract="intrinsic">
        <section className="aulas-ins-panel" aria-labelledby="aulas-mm-cuota" data-qa-geometry-member="cuota">
          <header className="aulas-ins-cabecera">
            <h3 id="aulas-mm-cuota">Cuota por {modelo.variables.join(" y ").toLowerCase()}</h3>
            <span className="aulas-ins-sub">{modelo.origen}{modelo.universo ? ` · ${modelo.universo}` : ""}</span>
          </header>
          <div className="aulas-ins-tabla-marco" data-qa-geometry-capacity="owned">
            <table className="aulas-ins-tabla" aria-labelledby="aulas-mm-cuota">
              <thead>
                <tr>
                  <th scope="col">{modelo.variables[0]}</th>
                  <th scope="col" className="is-num">Cuota</th>
                  {modelo.columnas.map((c) => <th key={c.valor} scope="col" className="is-num">{c.etiqueta}</th>)}
                  <th scope="col" className="is-num">Tasa prevista</th>
                  {delAula ? (
                    <>
                      <th scope="col" className="is-num">Titulares</th>
                      <th scope="col" className="is-num">Elegibles</th>
                      <th scope="col" className="is-num" title="Elegibles por la tasa prevista de cada titular">Esperadas</th>
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {modelo.filas.map((f) => (
                  <tr key={f.clave}>
                    <th scope="row">{f.etiqueta}</th>
                    <td className="is-num"><b>{fmt(f.cuota)}</b></td>
                    {conColumnas ? f.porColumna.map((v, i) => <td key={i} className="is-num">{v == null ? "—" : fmt(v)}</td>) : null}
                    <td className="is-num">{f.tasa}</td>
                    {delAula ? (
                      <>
                        <td className="is-num">{fmt(f.titulares ?? 0)}</td>
                        <td className="is-num">{fmt(f.elegibles ?? 0)}</td>
                        <td className="is-num">{fmt(f.esperadas ?? 0)}</td>
                      </>
                    ) : null}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total</th>
                  <td className="is-num">{fmt(modelo.total.cuota)}</td>
                  {conColumnas ? modelo.columnas.map((c, i) => (
                    <td key={c.valor} className="is-num">{fmt(modelo.filas.reduce((s, f) => s + (f.porColumna[i] ?? 0), 0))}</td>
                  )) : null}
                  <td />
                  {delAula ? (
                    <>
                      <td className="is-num">{fmt(modelo.total.titulares ?? 0)}</td>
                      <td className="is-num">{fmt(modelo.total.elegibles ?? 0)}</td>
                      <td className="is-num">{fmt(modelo.total.esperadas ?? 0)}</td>
                    </>
                  ) : null}
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="aulas-ins-pie">Solo lectura: las metas se fijan en Cálculo de muestra. <Link to={RUTA_DISENO}>Abrir el diseño</Link></p>
        </section>
        {modelo.cobertura ? (
          <section className="aulas-ins-panel aulas-mm-lateral" aria-labelledby="aulas-mm-cobertura" data-qa-geometry-member="cobertura">
            <header className="aulas-ins-cabecera">
              <h3 id="aulas-mm-cobertura">Meta de cada curso-horario</h3>
            </header>
            <p className="aulas-ins-texto">
              Cada titular espera sus elegibles por la tasa prevista. {modelo.cobertura}
            </p>
          </section>
        ) : null}
      </div>
    </section>
  );
}

export const MetasAulas = memo(MetasAulasImpl);
