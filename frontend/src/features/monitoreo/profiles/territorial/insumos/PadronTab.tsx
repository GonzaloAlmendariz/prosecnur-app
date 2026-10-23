import { memo, useMemo } from "react";
import { Users } from "lucide-react";
import type { MonitoreoState, MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { useFocoMonitoreo } from "../../../useMonitoreoDireccion";
import { fmt } from "../rotulos";
import { construirPadron, ROTULO_DE_ESTADO } from "./padronModel";
import "./insumos.css";

/**
 * Insumos › Padrón (territorial.md §3.3): quién está en el padrón y cuánto
 * trajo cada código, y los códigos de la base que no están (con enlace a
 * Conciliación). El DNI del archivo nunca se muestra. Reemplazar el padrón
 * sigue en su sub-vista (`panel=archivo`).
 */
function PadronTabImpl({
  reports,
  state,
  onReemplazar,
}: {
  reports: MonitoreoTerritorialDashboard | null;
  state: MonitoreoState | null;
  onReemplazar: () => void;
}) {
  const modelo = useMemo(() => construirPadron(state, reports), [reports, state]);
  const [, escribirFoco] = useFocoMonitoreo();

  return (
    <section
      className={`mon-ins mon-ins-padron${modelo.disponible ? "" : " mon-ins--vacio"}`}
      aria-label="Padrón"
      data-audit-ready={modelo.disponible ? "monitoreo-territorial-insumos-padron" : "vacio:sin-padron"}
      data-qa-geometry-group="territorial-insumos-padron"
      data-qa-geometry-contract="intrinsic"
    >
      {modelo.disponible ? (
        <section className="mon-ins-panel" aria-labelledby="mon-ins-padron" data-qa-geometry-member="padron">
          <header className="mon-ins-cabecera">
            <div>
              <h3 id="mon-ins-padron" className="mon-ins-titulo">{modelo.archivo.nombre || "Padrón de aplicadores"}</h3>
              <span className="mon-ins-base">
                {fmt(modelo.archivo.personas)} personas{modelo.archivo.formato ? ` · códigos ${modelo.archivo.formato}` : ""}{modelo.archivo.subido ? ` · subido ${modelo.archivo.subido}` : ""}
              </span>
            </div>
            <button type="button" className="mon-ins-boton" onClick={onReemplazar}>Reemplazar padrón…</button>
          </header>
          <div className="mon-ins-tabla-marco" data-qa-geometry-capacity="owned" tabIndex={0} aria-label="Padrón, con desplazamiento">
            <table className="mon-ins-tabla">
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">Nombre</th>
                  <th scope="col" className="is-num">Casos</th>
                  <th scope="col" className="is-num">UMP con casos</th>
                  <th scope="col">Último</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {modelo.filas.map((fila) => (
                  <tr key={fila.codigo} className={`is-${fila.estado}`}>
                    <th scope="row">{fila.codigo}</th>
                    <td>{fila.nombre}</td>
                    <td className="is-num">{fmt(fila.casos)}</td>
                    <td className="is-num">{fmt(fila.umps)}</td>
                    <td>{fila.ultimo || "—"}</td>
                    <td>{ROTULO_DE_ESTADO[fila.estado]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="mon-ins-panel mon-ins-vacio" aria-label="Sin padrón">
          <Users size={20} aria-hidden="true" />
          <strong>Sin padrón de aplicadores</strong>
          <span>Con el padrón, cada código de la base se lee con su nombre.</span>
          <button type="button" className="mon-ins-boton is-primario" onClick={onReemplazar}>Subir padrón</button>
        </section>
      )}

      <aside className="mon-ins-panel mon-ins-lateral" aria-labelledby="mon-ins-fuera" data-qa-geometry-member="fuera">
        <h3 id="mon-ins-fuera" className="mon-ins-titulo">Códigos fuera del padrón · {fmt(modelo.fueraDelPadron.length)}</h3>
        {modelo.fueraDelPadron.length ? (
          <ul className="mon-ins-lista">
            {modelo.fueraDelPadron.map((item) => <li key={item.codigo}><code>{item.codigo}</code> · {fmt(item.casos)} {item.casos === 1 ? "caso" : "casos"}</li>)}
          </ul>
        ) : (
          <p className="mon-ins-base">Todos los códigos de la base están en el padrón.</p>
        )}
        {modelo.fueraDelPadron.length ? (
          <button type="button" className="mon-ins-boton" onClick={() => escribirFoco(null, { seccion: "control", pestana: "conciliacion", panel: null })}>Conciliar en Control › Conciliación</button>
        ) : null}
      </aside>
    </section>
  );
}

export const PadronTab = memo(PadronTabImpl);
