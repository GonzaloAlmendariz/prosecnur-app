import { memo, useMemo, useState } from "react";
import { Download, Search, Target } from "lucide-react";
import type { MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { useFocoMonitoreo } from "../../../useMonitoreoDireccion";
import { fmt } from "../rotulos";
import { FichaDeUmp } from "./FichaDeUmp";
import { HistoriaUmp } from "./HistoriaUmp";
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
 * pendientes primero; al elegir una (`panel=ump&foco=<UMP>`) el inspector abre
 * su ficha y su historia al costado, sin tapar la tabla.
 *
 * `avance` trae la cuota y las subsanaciones; `validacion`, los casos uno a
 * uno. La exploración en el mapa con el GPS de cada formulario espera el
 * endpoint de casos por UMP (backend).
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

  const filtros: FiltroDeUmps[] = modelo.conOcurrencias
    ? ["todas", "pendientes", "subsanadas", "completas", "sin-parte"]
    : ["todas", "pendientes", "subsanadas", "completas"];
  const columnas = 9 + (modelo.conOcurrencias ? 2 : 0);

  return (
    <section
      className={`mon-umps${ficha ? " con-ficha" : ""}`}
      aria-label="UMP"
      data-audit-ready={ficha ? "monitoreo-territorial-avance-umps-detalle" : "monitoreo-territorial-avance-umps"}
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
                const abierta = ficha?.ump === fila.ump;
                return (
                  <tr key={fila.ump} className={`is-${fila.estado}${abierta ? " is-abierta" : ""}`}>
                    <th scope="row">
                      <button
                        type="button"
                        aria-pressed={abierta}
                        aria-label={`UMP ${fila.ump}: ${abierta ? "cerrar" : "abrir"} su ficha`}
                        onClick={() => escribirFoco(abierta ? null : fila.ump, { panel: abierta ? null : "ump" })}
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

      {ficha ? (
        <div className="mon-umps-inspector" data-qa-geometry-member="inspector">
          <FichaDeUmp
            ficha={ficha}
            onCerrar={() => escribirFoco(null, { panel: null })}
            onSugerencia={() => escribirFoco(ficha.ump, { seccion: "control", pestana: "subsanaciones", panel: null })}
          />
          {historia ? <HistoriaUmp historia={historia} /> : null}
        </div>
      ) : null}
    </section>
  );
}

export const UmpsTab = memo(UmpsTabImpl);
