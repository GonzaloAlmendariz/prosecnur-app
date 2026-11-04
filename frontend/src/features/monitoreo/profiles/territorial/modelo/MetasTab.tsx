import { memo, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, Map as MapIcon } from "lucide-react";
import { EstadoVacio } from "../../../../../components/EstadoVacio";
import { EstadoChip } from "../../../../../components/EstadoChip";
import { LoadingBlock } from "../../../../../components/States";
import type { MonitoreoState, MonitoreoTerritorialDashboard, MonitoreoTerritorialPhase } from "../../../../../api/client";
import { opcionesDeFase } from "../navegacion/fase";
import { fmt } from "../rotulos";
import { MapaDeLaMuestra } from "./MapaDeLaMuestra";
import { construirMetas } from "./metasModel";
import { RotuloDePestana } from "../navegacion/RotuloDePestana";
import "./modelo.css";
import { BloqueDeMonitoreo } from "../../../core/BloqueDeMonitoreo";

/**
 * Modelo › Metas y muestra (territorial.md §3.5): qué hay que lograr. Meta por
 * distrito con su base, las dos fases y cómo se arma la muestra; a la derecha
 * el mapa de las manzanas de la ruta. Se lee aquí y se edita en Hojas de ruta.
 */
function MetasTabImpl({
  reports,
  avance = null,
  state,
  phase,
}: {
  reports: MonitoreoTerritorialDashboard | null;
  /** Corte de avance: dice qué reemplazos están en uso para el mapa. */
  avance?: MonitoreoTerritorialDashboard | null;
  state: MonitoreoState | null;
  phase: MonitoreoTerritorialPhase;
}) {
  const modelo = useMemo(() => construirMetas(reports), [reports]);
  const fases = useMemo(() => opcionesDeFase(state, phase, modelo.total.meta || null), [modelo.total.meta, phase, state]);
  const navigate = useNavigate();
  const abrirHojasDeRuta = () => navigate("/hojas-ruta?seccion=muestra");
  const conViviendas = modelo.total.viviendas != null;

  // Sin el corte de ruta todavía no se sabe si hay muestra: decir «Sin
  // muestra» sería un vacío falso (C5). La página no se marca lista mientras
  // ese corte no llega (`cortesDePestana`).
  if (!reports) {
    return (
      <section className="mon-mod mon-mod--vacio" aria-label="Metas y muestra" aria-busy="true">
        <div className="mon-mod-panel">
          <RotuloDePestana />
          <LoadingBlock label="Leyendo la muestra de Hojas de ruta…" />
        </div>
      </section>
    );
  }

  if (!modelo.disponible) {
    return (
      <section className="mon-mod mon-mod--vacio" data-audit-ready="vacio:sin-muestra" aria-label="Metas y muestra">
        <div className="mon-mod-panel">
          <RotuloDePestana />
          <EstadoVacio
            tamano="normal"
            icono={<MapIcon size={18} />}
            titulo="Sin muestra de Hojas de ruta"
            descripcion="La meta y las UMP salen de la muestra que se arma en Hojas de ruta."
            accion={
              <button type="button" className="mon-mod-boton" onClick={abrirHojasDeRuta}>Abrir Hojas de ruta</button>
            }
          />
        </div>
      </section>
    );
  }

  return (
    <section
      className="mon-mod mon-mod-metas"
      aria-label="Metas y muestra"
      data-audit-ready="monitoreo-territorial-modelo-metas"
      data-qa-geometry-group="territorial-modelo-metas"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="mon-mod-izquierda" data-qa-geometry-member="metas" data-qa-geometry-group="territorial-modelo-metas-columna" data-qa-geometry-contract="intrinsic">
        <BloqueDeMonitoreo
          marco="kit"
          className="mon-mod-panel"
          aria-labelledby="mon-mod-meta"
          antetitulo={<RotuloDePestana />}
          titulo="Meta por distrito"
          tituloId="mon-mod-meta"
          acciones={<button type="button" className="mon-mod-boton" onClick={abrirHojasDeRuta}>
            <ExternalLink size={14} aria-hidden="true" />
            Editar en Hojas de ruta
          </button>}
        >
          <div className="mon-mod-tabla-marco" tabIndex={0} aria-label="Meta por distrito, con desplazamiento">
            <table className="mon-mod-tabla">
              <thead>
                <tr>
                  <th scope="col">Distrito</th>
                  <th scope="col" className="is-num">Meta</th>
                  <th scope="col" className="is-num">UMP</th>
                  <th scope="col" className="is-num">Reemplazos</th>
                  <th scope="col" className="is-num">Por UMP</th>
                  {conViviendas ? <th scope="col" className="is-num">Viviendas</th> : null}
                  {conViviendas ? <th scope="col" className="is-num">Población</th> : null}
                </tr>
              </thead>
              <tbody>
                {modelo.distritos.map((fila) => (
                  <tr key={fila.distrito}>
                    <th scope="row">{fila.distrito}</th>
                    <td className="is-num">{fmt(fila.meta)}</td>
                    <td className="is-num">{fmt(fila.umps)}</td>
                    <td className="is-num">{fmt(fila.reemplazos)}</td>
                    <td className="is-num">{fila.porUmp}</td>
                    {conViviendas ? <td className="is-num">{fmt(fila.viviendas)}</td> : null}
                    {conViviendas ? <td className="is-num">{fmt(fila.poblacion)}</td> : null}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total</th>
                  <td className="is-num">{fmt(modelo.total.meta)}</td>
                  <td className="is-num">{fmt(modelo.total.umps)}</td>
                  <td className="is-num">{fmt(modelo.total.reemplazos)}</td>
                  <td className="is-num">{modelo.total.porUmp}</td>
                  {conViviendas ? <td className="is-num">{fmt(modelo.total.viviendas)}</td> : null}
                  {conViviendas ? <td className="is-num">{fmt(modelo.total.poblacion)}</td> : null}
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mon-mod-base">
            <span title="La población 18+ del distrito, del Censo 2017, llega con el corte completo de Hojas de ruta">{conViviendas ? "Viviendas y población de las manzanas titulares" : "Sin población 18+ en este corte"}</span>
          </p>
        </BloqueDeMonitoreo>

        <ul className="mon-mod-fases" data-qa-geometry-group="territorial-modelo-fases" data-qa-geometry-contract="equal">
          {fases.map((fase) => (
            <li key={fase.fase} className={`mon-mod-panel mon-mod-fase${fase.activa ? " is-activa" : ""}`}>
              <strong>{fase.nombre}{fase.activa ? <EstadoChip label="Activa" tone="success" /> : null}</strong>
              {fase.cifras.length ? (
                <dl className="mon-mod-parametros mon-mod-fase-cifras" data-qa-geometry-group={`territorial-modelo-fase-${fase.fase}`} data-qa-geometry-contract="equal">
                  {fase.cifras.map((cifra) => (
                    <div key={cifra.clave} data-qa-geometry-member={cifra.clave}>
                      <dt>{cifra.rotulo}</dt>
                      <dd className={cifra.ayuda ? "tiene-ayuda" : undefined} title={cifra.ayuda}>{cifra.valor}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <span>{fase.detalle}</span>
              )}
              {fase.fecha ? <small>Última lectura {fase.fecha}</small> : null}
            </li>
          ))}
        </ul>

        <BloqueDeMonitoreo
          marco="kit"
          className="mon-mod-panel"
          aria-labelledby="mon-mod-arma"
          titulo="Cómo se arma la muestra"
          tituloId="mon-mod-arma"
        >
          <dl className="mon-mod-parametros" data-qa-geometry-group="territorial-modelo-parametros" data-qa-geometry-contract="equal">
            {modelo.comoSeArma.map((item) => (
              <div key={item.clave} data-qa-geometry-member={item.clave}>
                <dt>{item.rotulo}</dt>
                <dd className={item.ayuda ? "tiene-ayuda" : undefined} title={item.ayuda}>{item.valor}</dd>
              </div>
            ))}
          </dl>
        </BloqueDeMonitoreo>
      </div>

      <BloqueDeMonitoreo
        marco="kit"
        className="mon-mod-panel mon-mod-mapa"
        aria-labelledby="mon-mod-mapa"
        data-qa-geometry-member="mapa"
        titulo="Manzanas de la muestra"
        tituloId="mon-mod-mapa"
      >
        <MapaDeLaMuestra bloques={modelo.bloques} avance={avance} />
      </BloqueDeMonitoreo>
    </section>
  );
}

export const MetasTab = memo(MetasTabImpl);
