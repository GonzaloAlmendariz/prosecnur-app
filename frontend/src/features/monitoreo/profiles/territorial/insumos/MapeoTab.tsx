import { memo, useEffect, useMemo, useState } from "react";
import { LoadingBlock } from "../../../../../components/States";
import { EstadoChip } from "../../../../../components/EstadoChip";
import {
  apiMonitoreoTerritorialMapeo,
  type MonitoreoState,
  type MonitoreoTerritorialDashboard,
  type MonitoreoTerritorialMapeo,
} from "../../../../../api/client";
import { fmt } from "../rotulos";
import { construirMapeo } from "./mapeoModel";
import { RotuloDePestana } from "../navegacion/RotuloDePestana";
import { BloqueDeMonitoreo } from "../../../core/BloqueDeMonitoreo";
import { SiluetaDeDistrito } from "../avance/SiluetaDeDistrito";
import "./insumos.css";

type Lectura = { tipo: "cargando" } | { tipo: "listo"; mapeo: MonitoreoTerritorialMapeo } | { tipo: "error"; mensaje: string };

/**
 * Insumos › Mapeo y filtro (territorial.md §3.2): cada rol con su columna y si
 * está en la base; el filtro de efectivas con cuántas pasan; los umbrales que
 * alimentan la Bandeja y el cruce de distritos. Editar sigue en sus
 * sub-vistas (`panel=editar`, `panel=filtro`).
 */
function MapeoTabImpl({
  reports,
  state,
  version,
  onEditarMapeo,
  onEditarFiltro,
}: {
  reports: MonitoreoTerritorialDashboard | null;
  state: MonitoreoState | null;
  version: string;
  onEditarMapeo: () => void;
  onEditarFiltro: () => void;
}) {
  const [lectura, setLectura] = useState<Lectura>({ tipo: "cargando" });
  useEffect(() => {
    let cancelado = false;
    setLectura({ tipo: "cargando" });
    apiMonitoreoTerritorialMapeo()
      .then((mapeo) => { if (!cancelado) setLectura({ tipo: "listo", mapeo }); })
      .catch((error: unknown) => { if (!cancelado) setLectura({ tipo: "error", mensaje: error instanceof Error ? error.message : String(error) }); });
    return () => { cancelado = true; };
  }, [version]);
  const modelo = useMemo(() => construirMapeo(lectura.tipo === "listo" ? lectura.mapeo : null, state, reports), [lectura, reports, state]);
  const readiness = lectura.tipo === "cargando" ? "false" : lectura.tipo === "error" ? "vacio:mapeo-no-disponible" : "monitoreo-territorial-insumos-mapeo";

  return (
    <section
      className="mon-ins mon-ins-mapeo"
      aria-label="Mapeo y filtro"
      data-audit-ready={readiness}
      data-qa-geometry-group="territorial-insumos-mapeo"
      data-qa-geometry-contract="intrinsic"
    >
      <BloqueDeMonitoreo
        marco="kit"
        className="mon-ins-panel"
        aria-labelledby="mon-ins-roles"
        data-qa-geometry-member="roles"
        antetitulo={<RotuloDePestana />}
        titulo="Roles del formulario"
        tituloId="mon-ins-roles"
        bajada={modelo.roles ? (modelo.pendientes ? `${fmt(modelo.pendientes)} sin columna en la base` : "Todos con su columna") : undefined}
        acciones={<button type="button" className="mon-ins-boton" onClick={onEditarMapeo}>Editar el mapeo</button>}
      >
        {lectura.tipo === "error" ? (
          <p className="mon-ins-base">No se pudo leer el mapeo: {lectura.mensaje}</p>
        ) : modelo.roles ? (
          <div className="mon-ins-tabla-marco" data-qa-geometry-capacity="owned" tabIndex={0} aria-label="Roles del formulario, con desplazamiento">
            <table className="mon-ins-tabla">
              <thead>
                <tr><th scope="col">Rol</th><th scope="col">Columna</th><th scope="col">En la base</th></tr>
              </thead>
              <tbody>
                {modelo.roles.map((rol) => (
                  <tr key={rol.campo} className={rol.estado === "encontrada" ? "" : "is-falta"}>
                    <th scope="row">{rol.rol}</th>
                    <td>{rol.columna ? <span className="mon-ins-clave">{rol.columna}</span> : "—"}</td>
                    <td><EstadoChip label={rol.rotuloDeEstado} tone={rol.estado === "encontrada" ? "success" : "warn"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <LoadingBlock label="Leyendo las columnas de la base…" variant="inline" />
        )}
      </BloqueDeMonitoreo>

      <div className="mon-ins-derecha" data-qa-geometry-member="reglas" data-qa-geometry-group="territorial-insumos-mapeo-reglas" data-qa-geometry-contract="intrinsic">
        <BloqueDeMonitoreo
          marco="kit"
          className="mon-ins-panel"
          aria-labelledby="mon-ins-filtro"
          data-qa-geometry-group="territorial-insumos-mapeo-filtro"
          data-qa-geometry-contract="intrinsic"
          titulo="Filtro de efectivas"
          tituloId="mon-ins-filtro"
          acciones={<button type="button" className="mon-ins-boton" onClick={onEditarFiltro}>Editar filtro y distritos</button>}
        >
          {modelo.filtro ? (
            <>
              <p className="mon-ins-pregunta">«{modelo.filtro.pregunta || "Pregunta sin rótulo"}»</p>
              <p className="mon-ins-base">Cuenta si la respuesta es {modelo.filtro.valores.join(" o ") || "—"}.</p>
              <span className="mon-ins-barra" aria-hidden="true">
                <i style={{ width: `${modelo.filtro.base ? ((modelo.filtro.pasan ?? 0) / modelo.filtro.base) * 100 : 0}%` }} />
              </span>
              <p className="mon-ins-base">
                {fmt(modelo.filtro.pasan)} de {fmt(modelo.filtro.base)} pasan, el {modelo.filtro.proporcion}
              </p>
            </>
          ) : (
            <p className="mon-ins-base">El corte no trae el filtro de efectivas.</p>
          )}
        </BloqueDeMonitoreo>
        <BloqueDeMonitoreo marco="kit" className="mon-ins-panel" aria-labelledby="mon-ins-umbrales" titulo="Umbrales de la Bandeja" tituloId="mon-ins-umbrales">
          <dl className="mon-ins-cifras">
            {modelo.umbrales.map((umbral) => <div key={umbral.rotulo} title={umbral.ayuda}><dt>{umbral.rotulo}</dt><dd>{umbral.valor}</dd></div>)}
          </dl>
        </BloqueDeMonitoreo>
        <BloqueDeMonitoreo marco="kit" className="mon-ins-panel" aria-labelledby="mon-ins-distritos" titulo="Distritos de Kobo y su ubigeo" tituloId="mon-ins-distritos">
          {modelo.distritos.length ? (
            <ul className="mon-ins-lista" data-qa-geometry-group="territorial-insumos-mapeo-distritos" data-qa-geometry-contract="equal">
              {modelo.distritos.map((fila) => (
                <li key={fila.codigo} className={`mon-ins-distrito${fila.ok ? "" : " is-falta"}`}>
                  <span className="mon-ins-distrito-sello" aria-hidden="true"><SiluetaDeDistrito distrito={fila.ok ? fila.distrito : ""} lado={26} /></span>
                  <span><span className="mon-ins-clave">{fila.codigo}</span> {fila.etiqueta}</span>
                  {fila.ok
                    ? <span className="mon-ins-distrito-destino">{fila.distrito} <span className="mon-ins-ubigeo">{fila.ubigeo}</span></span>
                    : <EstadoChip label="Sin ubigeo" tone="warn" />}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mon-ins-base">Sin cruce de distritos declarado.</p>
          )}
        </BloqueDeMonitoreo>
      </div>
    </section>
  );
}

export const MapeoTab = memo(MapeoTabImpl);
