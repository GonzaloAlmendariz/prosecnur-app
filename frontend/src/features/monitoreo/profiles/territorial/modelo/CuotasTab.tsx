import { memo, useMemo } from "react";
import { Target } from "lucide-react";
import type { MonitoreoState, MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { useFocoMonitoreo } from "../../../useMonitoreoDireccion";
import { fmt } from "../rotulos";
import { construirCuotas } from "./cuotasModel";
import { RotuloDePestana } from "../navegacion/RotuloDePestana";
import { SiluetaDeDistrito } from "../avance/SiluetaDeDistrito";
import "./modelo.css";

function textoDeRegla(valor: boolean | null): string {
  if (valor == null) return "Sin dato en este corte";
  return valor ? "Sí" : "No";
}

function claseDeRegla(valor: boolean | null): string {
  if (valor == null) return "";
  return valor ? "is-ok" : "is-aviso";
}

/**
 * Modelo › Cuotas (territorial.md §3.5b): las variables de cuota, la plantilla
 * por UMP, la cuota por distrito y las reglas con que el motor cubre una
 * celda. La contradicción entre celdas cruzadas y marginales (pregunta 6) no
 * se resuelve aquí.
 */
function CuotasTabImpl({
  reports,
  state,
  avance,
}: {
  reports: MonitoreoTerritorialDashboard | null;
  state: MonitoreoState | null;
  avance: MonitoreoTerritorialDashboard | null;
}) {
  const modelo = useMemo(() => construirCuotas(reports, state, avance), [avance, reports, state]);
  const [, escribirFoco] = useFocoMonitoreo();

  if (!modelo.disponible) {
    return (
      <section className="mon-mod mon-mod--vacio" data-audit-ready="vacio:sin-cuota" aria-label="Cuotas">
        <div className="mon-mod-panel mon-mod-vacio">
          <RotuloDePestana />
          <Target size={20} aria-hidden="true" />
          <strong>Sin cuota territorial configurada</strong>
          <span>La cuota por UMP sale de la muestra de Hojas de ruta.</span>
          <button type="button" className="mon-mod-boton" onClick={() => escribirFoco(null, { seccion: "insumos", pestana: "mapeo", panel: null })}>Revisar el mapeo de variables</button>
        </div>
      </section>
    );
  }

  return (
    <section
      className="mon-mod mon-mod-cuotas"
      aria-label="Cuotas"
      data-audit-ready="monitoreo-territorial-modelo-cuotas"
      data-qa-geometry-group="territorial-modelo-cuotas"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="mon-mod-izquierda" data-qa-geometry-member="definicion" data-qa-geometry-group="territorial-modelo-definicion" data-qa-geometry-contract="intrinsic">
        <section className="mon-mod-panel" aria-labelledby="mon-mod-variables">
          <header className="mon-mod-cabecera is-inicio"><RotuloDePestana /><h3 id="mon-mod-variables" className="mon-mod-titulo">Variables de cuota</h3></header>
          <dl className="mon-mod-variables">
            {modelo.variables.map((variable) => (
              <div key={variable.rotulo}>
                <dt>{variable.rotulo} <code>{variable.columna || "sin columna"}</code></dt>
                <dd>{variable.categorias.map((categoria) => <span key={categoria} className="mon-ter-chip">{categoria}</span>)}</dd>
              </div>
            ))}
          </dl>
          <h4 className="mon-mod-subtitulo">Plantilla por UMP de {fmt(modelo.entrevistasPorUmp)} entrevistas</h4>
          <ul className="mon-mod-plantilla" data-qa-geometry-group="territorial-modelo-plantilla" data-qa-geometry-contract="equal">
            {modelo.plantilla.map((celda) => (
              <li key={`${celda.eje}-${celda.clave}`} className={`is-${celda.eje}`}>
                <span>{celda.rotulo}</span>
                <b>{fmt(celda.meta)}</b>
              </li>
            ))}
          </ul>
          <p className="mon-mod-base">
            {fmt(modelo.conPlantilla)} manzanas con esta plantilla{modelo.conOtra ? <span className="mon-ter-cuenta">{fmt(modelo.conOtra)} con otra</span> : null}
          </p>
        </section>

        <section className="mon-mod-panel" aria-labelledby="mon-mod-reglas">
          <h3 id="mon-mod-reglas" className="mon-mod-titulo">Reglas para cubrir una celda</h3>
          <dl className="mon-mod-reglas">
            <div><dt>El sexo puede cambiar al subsanar</dt><dd><span className={`mon-ter-chip ${claseDeRegla(modelo.reglas.sexoFlexible)}`}>{textoDeRegla(modelo.reglas.sexoFlexible)}</span></dd></div>
            <div><dt>La edad puede cambiar al subsanar</dt><dd><span className={`mon-ter-chip ${claseDeRegla(modelo.reglas.edadFlexible)}`}>{textoDeRegla(modelo.reglas.edadFlexible)}</span></dd></div>
          </dl>
        </section>
      </div>

      <section className="mon-mod-panel" aria-labelledby="mon-mod-distrito" data-qa-geometry-member="distritos">
        <h3 id="mon-mod-distrito" className="mon-mod-titulo">Cuota por distrito</h3>
        <div className="mon-mod-tabla-marco" data-qa-geometry-capacity="owned" tabIndex={0} aria-label="Cuota por distrito, con desplazamiento">
          <table className="mon-mod-tabla">
            <thead>
              <tr>
                <th scope="col">Distrito</th>
                {modelo.plantilla.map((celda) => <th key={`${celda.eje}-${celda.clave}`} scope="col" className="is-num">{celda.rotulo}</th>)}
                <th scope="col" className="is-num">Total</th>
              </tr>
            </thead>
            <tbody>
              {modelo.distritos.map((fila) => (
                <tr key={fila.distrito}>
                  <th scope="row"><span className="mon-ter-con-silueta"><SiluetaDeDistrito distrito={fila.distrito} lado={30} />{fila.distrito}</span></th>
                  {fila.metas.map((meta, indice) => <td key={modelo.plantilla[indice]?.clave ?? indice} className="is-num">{fmt(meta)}</td>)}
                  <td className="is-num">{fmt(fila.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                {modelo.total.metas.map((meta, indice) => <td key={modelo.plantilla[indice]?.clave ?? indice} className="is-num">{fmt(meta)}</td>)}
                <td className="is-num">{fmt(modelo.total.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mon-mod-base" title="Cada uno suma la meta del distrito por separado">Sexo y edad, marginales</p>
      </section>
    </section>
  );
}

export const CuotasTab = memo(CuotasTabImpl);
