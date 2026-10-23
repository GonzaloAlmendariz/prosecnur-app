import { memo, useMemo, useState } from "react";
import { Download, Search, Target } from "lucide-react";
import type { MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { useFocoMonitoreo } from "../../../useMonitoreoDireccion";
import { fmt } from "../rotulos";
import { ExploracionUmp } from "./ExploracionUmp";
import { construirFichaDeUmp } from "./fichaUmpModel";
import { construirHistoriaDeUmp } from "./historiaUmpModel";
import { construirUmps, csvDeUmps, filtrarUmps, type FiltroDeUmps } from "./umpsModel";
import "./umps.css";

const ROTULO_DE_FILTRO: Record<FiltroDeUmps, string> = {
  todas: "Todas",
  pendientes: "Pendientes",
  subsanadas: "Subsanadas",
  completas: "Completas",
  "sin-parte": "Sin parte",
};

function descargarCsv(nombre: string, csv: string) {
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Avance › UMP (territorial.md §3.16 y §3.16b). La tabla de las UMP con las
 * pendientes primero; al elegir una (`panel=ump&foco=<UMP>`) la pestaña pasa a
 * su exploración (`ExploracionUmp.tsx`) y «Todas las UMP» vuelve a la tabla.
 *
 * `avance` trae la cuota y las subsanaciones; `validacion`, los casos uno a
 * uno; el GPS y la hora de cada formulario, anulados incluidos, llegan de
 * `GET /api/monitoreo/territorial/casos-ump`.
 */
function UmpsTabImpl({
  avance,
  validacion,
}: {
  avance: MonitoreoTerritorialDashboard | null;
  validacion: MonitoreoTerritorialDashboard | null;
}) {
  const modelo = useMemo(() => construirUmps(avance, validacion), [avance, validacion]);
  const [foco, escribirFoco] = useFocoMonitoreo();
  const [filtro, setFiltro] = useState<FiltroDeUmps>("todas");
  const [busqueda, setBusqueda] = useState("");
  const filas = useMemo(() => filtrarUmps(modelo.filas, filtro, busqueda), [busqueda, filtro, modelo.filas]);
  const ficha = useMemo(() => construirFichaDeUmp(avance, validacion, foco), [avance, foco, validacion]);
  const historia = useMemo(() => (ficha ? construirHistoriaDeUmp(avance, validacion, ficha.ump) : null), [avance, ficha, validacion]);

  if (!modelo.filas.length) {
    return (
      <section className="mon-umps mon-umps--vacio" data-audit-ready="vacio:sin-cuota" aria-label="UMP">
        <div className="mon-umps-panel mon-umps-vacio">
          <Target size={20} aria-hidden="true" />
          <strong>Sin UMP en la cuota del corte</strong>
          <span>Las UMP salen de la muestra de Hojas de ruta declarada en Modelo › Cuotas.</span>
          <button type="button" className="mon-umps-boton" onClick={() => escribirFoco(null, { seccion: "modelo", pestana: "cuotas", panel: null })}>
            Abrir Modelo › Cuotas
          </button>
        </div>
      </section>
    );
  }

  if (ficha) {
    // §3.16b: con una UMP elegida, la pestaña es su exploración (mapa con un
    // punto por formulario, tarjeta del caso, ficha e historia).
    return (
      <section className="mon-umps con-exploracion" aria-label={`UMP ${ficha.ump}`} data-audit-ready="monitoreo-territorial-avance-umps-detalle">
        <ExploracionUmp
          ficha={ficha}
          historia={historia}
          avance={avance}
          version={avance?.generated_at ?? ""}
          onCerrar={() => escribirFoco(null, { panel: null })}
          onSugerencia={() => escribirFoco(ficha.ump, { seccion: "control", pestana: "subsanaciones", panel: null })}
        />
      </section>
    );
  }

  const filtros: FiltroDeUmps[] = modelo.conOcurrencias
    ? ["todas", "pendientes", "subsanadas", "completas", "sin-parte"]
    : ["todas", "pendientes", "subsanadas", "completas"];
  const columnas = 9 + (modelo.conOcurrencias ? 2 : 0);

  return (
    <section
      className="mon-umps"
      aria-label="UMP"
      data-audit-ready="monitoreo-territorial-avance-umps"
      data-qa-geometry-group="territorial-umps"
      data-qa-geometry-contract="intrinsic"
    >
      <section className="mon-umps-panel mon-umps-tabla-panel" aria-labelledby="mon-umps-titulo" data-qa-geometry-member="tabla">
        <header className="mon-umps-cabecera">
          <h3 id="mon-umps-titulo">UMP del corte</h3>
          <span className="mon-umps-segmentado" role="group" aria-label="Qué UMP mostrar">
            {filtros.map((clave) => (
              <button key={clave} type="button" aria-pressed={filtro === clave} className={filtro === clave ? "is-active" : ""} onClick={() => setFiltro(clave)}>
                {ROTULO_DE_FILTRO[clave]}
                <b>{fmt(modelo.conteos[clave])}</b>
              </button>
            ))}
          </span>
          <label className="mon-umps-buscar">
            <Search size={14} aria-hidden="true" />
            <span className="pulso-sr-only">Buscar UMP, distrito, manzana o aplicador</span>
            <input type="search" value={busqueda} placeholder="Buscar UMP, distrito o aplicador" onChange={(event) => setBusqueda(event.currentTarget.value)} />
          </label>
          <button type="button" className="mon-umps-boton" onClick={() => descargarCsv("ump-del-corte.csv", csvDeUmps(filas, modelo.conOcurrencias))}>
            <Download size={14} aria-hidden="true" />
            CSV
          </button>
        </header>
        <div className="mon-umps-tabla-marco" data-qa-geometry-capacity="owned" tabIndex={0} aria-label="UMP del corte, con desplazamiento">
          <table className="mon-umps-tabla">
            <thead>
              <tr>
                <th scope="col">UMP</th>
                <th scope="col">Distrito</th>
                <th scope="col">Manzana</th>
                <th scope="col">Tipo</th>
                <th scope="col">Aplicador</th>
                <th scope="col">Cuentan</th>
                <th scope="col" className="is-num">En observación</th>
                <th scope="col">Cuota</th>
                {modelo.conOcurrencias ? <th scope="col" className="is-num">Efectivas / intentos</th> : null}
                {modelo.conOcurrencias ? <th scope="col" className="is-num">Tasa efectiva</th> : null}
              </tr>
            </thead>
            <tbody>
              {filas.length ? filas.map((fila) => {
                return (
                  <tr key={fila.ump} className={`is-${fila.estado}`}>
                    <th scope="row">
                      <button
                        type="button"
                        aria-label={`UMP ${fila.ump}: explorar sus formularios`}
                        onClick={() => escribirFoco(fila.ump, { panel: "ump" })}
                      >
                        {fila.ump}
                      </button>
                    </th>
                    <td>{fila.distrito}</td>
                    <td>{fila.manzana}</td>
                    <td>{fila.tipo}</td>
                    <td>{fila.aplicador}</td>
                    <td>
                      <span className="mon-umps-avance">
                        <span className="mon-umps-avance-barra" aria-hidden="true">
                          <i style={{ width: `${fila.meta > 0 ? Math.min(100, (fila.cuentan / fila.meta) * 100) : 0}%` }} />
                        </span>
                        {fmt(fila.cuentan)} / {fmt(fila.meta)}
                      </span>
                    </td>
                    <td className="is-num">{fmt(fila.observacion)}</td>
                    <td className={fila.estado === "pendiente" ? "is-falta" : ""}>{fila.cuota}</td>
                    {modelo.conOcurrencias ? <td className="is-num">{fila.parte ? `${fmt(fila.parte.efectivas)} / ${fmt(fila.parte.intentos)}` : "Sin parte"}</td> : null}
                    {modelo.conOcurrencias ? <td className="is-num">{fila.parte?.tasa ?? "—"}</td> : null}
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={columnas} className="mon-umps-sin-filas">Ninguna UMP con ese filtro o búsqueda.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

    </section>
  );
}

export const UmpsTab = memo(UmpsTabImpl);
