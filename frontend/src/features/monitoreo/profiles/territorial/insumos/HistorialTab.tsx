import { memo, useMemo } from "react";
import type { MonitoreoState, MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { fmt, fmtConSigno } from "../rotulos";
import { construirHistorial } from "./historialModel";
import { RotuloDePestana } from "../navegacion/RotuloDePestana";
import "./insumos.css";

/**
 * Insumos › Historial (territorial.md §3.4): cada lectura con lo que trajo y lo
 * nuevo respecto de la anterior de la misma fuente; al costado, la serie de la
 * fuente activa y las otras acciones registradas. Horas en Lima.
 */
function HistorialTabImpl({
  reports,
  state,
  fuenteActiva,
}: {
  reports: MonitoreoTerritorialDashboard | null;
  state: MonitoreoState | null;
  fuenteActiva: string;
}) {
  const modelo = useMemo(() => construirHistorial(state, reports, fuenteActiva), [fuenteActiva, reports, state]);
  const maximo = Math.max(1, ...modelo.serie.map((punto) => punto.respuestas));

  return (
    <section
      className="mon-ins mon-ins-historial"
      aria-label="Historial"
      data-audit-ready={modelo.lecturas.length ? "monitoreo-territorial-insumos-historial" : "vacio:sin-lecturas"}
      data-qa-geometry-group="territorial-insumos-historial"
      data-qa-geometry-contract="intrinsic"
    >
      <section className="mon-ins-panel" aria-labelledby="mon-ins-lecturas" data-qa-geometry-member="lecturas">
        <header className="mon-ins-cabecera is-inicio">
          <RotuloDePestana />
          <h3 id="mon-ins-lecturas" className="mon-ins-titulo">Lecturas de las fuentes · {fmt(modelo.lecturas.length)}</h3>
        </header>
        {modelo.lecturas.length ? (
          <div className="mon-ins-tabla-marco" data-qa-geometry-capacity="owned" tabIndex={0} aria-label="Lecturas, con desplazamiento">
            <table className="mon-ins-tabla">
              <thead>
                <tr>
                  <th scope="col">Cuándo</th>
                  <th scope="col">Acción</th>
                  <th scope="col">Fuente</th>
                  <th scope="col" className="is-num">Respuestas</th>
                  <th scope="col" className="is-num">Nuevas</th>
                  <th scope="col">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {modelo.lecturas.map((lectura) => (
                  <tr key={lectura.id} className={`is-${lectura.tono}`}>
                    <th scope="row">{lectura.cuando || "—"}</th>
                    <td>{lectura.accion}</td>
                    <td>{lectura.fuente}</td>
                    <td className="is-num">{lectura.accion === "Traer" ? fmt(lectura.respuestas) : "—"}</td>
                    <td className="is-num">{lectura.nuevas == null ? "—" : fmtConSigno(lectura.nuevas)}</td>
                    <td>{lectura.resultado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mon-ins-base">Todavía no hay lecturas registradas.</p>
        )}
      </section>

      <div className="mon-ins-derecha" data-qa-geometry-member="lateral" data-qa-geometry-group="territorial-insumos-historial-lateral" data-qa-geometry-contract="intrinsic">
        {modelo.serie.length > 1 ? (
          <section className="mon-ins-panel" aria-labelledby="mon-ins-serie">
            <h3 id="mon-ins-serie" className="mon-ins-titulo">Respuestas en cada lectura</h3>
            <svg className="mon-ins-serie-grande" viewBox={`0 0 ${modelo.serie.length * 10} 60`} preserveAspectRatio="none" role="img" aria-label={`De ${fmt(modelo.serie[0].respuestas)} a ${fmt(modelo.serie.at(-1)?.respuestas)} respuestas en ${fmt(modelo.serie.length)} lecturas`}>
              {modelo.serie.map((punto, indice) => (
                <rect key={`${punto.cuando}-${indice}`} x={indice * 10 + 1} width={8} y={60 - (punto.respuestas / maximo) * 60} height={(punto.respuestas / maximo) * 60} />
              ))}
            </svg>
            <span className="mon-ins-base">{modelo.serie[0].cuando} a {modelo.serie.at(-1)?.cuando}</span>
          </section>
        ) : null}
        <section className="mon-ins-panel" aria-labelledby="mon-ins-otras">
          <h3 id="mon-ins-otras" className="mon-ins-titulo">Otras acciones registradas</h3>
          {modelo.otras.length ? (
            <ul className="mon-ins-lista">
              {modelo.otras.map((accion) => <li key={accion.id}><small>{accion.cuando}</small> {accion.texto}</li>)}
            </ul>
          ) : (
            <p className="mon-ins-base">Sin subsanaciones ni anulaciones.</p>
          )}
        </section>
      </div>
    </section>
  );
}

export const HistorialTab = memo(HistorialTabImpl);
