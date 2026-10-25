import { memo, useMemo } from "react";
import { ClipboardList } from "lucide-react";
import type { MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { fmt } from "../rotulos";
import { RotuloDePestana } from "../navegacion/RotuloDePestana";
import { SiluetaDeDistrito } from "../avance/SiluetaDeDistrito";
import {
  construirDistritosDePartes,
  construirRitmoDePartes,
  type DistritoDePartes,
  type ModeloRitmoDePartes,
} from "./ocurrenciasPanelesModel";
import "./ocurrencias.css";
import "./ocurrenciasPaneles.css";

/**
 * Control › Ocurrencias › Distritos y Ritmo (ronda 4). Sustituyen la vista
 * heredada (`TerritorialFieldOccurrencesWorkbench`, que sigue montando Reportes
 * › UMP y Alertas): el rótulo de la pestaña encabeza la primera tarjeta, cada
 * cifra va en su celda rotulada y los motivos con su rótulo corto.
 */

function SinPartes({ etiqueta }: { etiqueta: string }) {
  return (
    <section className="mon-ocu mon-ocu--vacio" data-audit-ready="vacio:sin-partes" aria-label={etiqueta}>
      <div className="mon-ocu-panel mon-ocu-vacio" data-qa-geometry-empty="legitimo">
        <RotuloDePestana />
        <ClipboardList size={20} aria-hidden="true" />
        <strong>Sin partes de ocurrencias</strong>
        <span title="Los partes llegan del formulario de ocurrencias de campo">«Actualizar» trae los partes nuevos</span>
      </div>
    </section>
  );
}

function OcurrenciasDistritosImpl({ reports }: { reports: MonitoreoTerritorialDashboard | null }) {
  const modelo = useMemo(() => construirDistritosDePartes(reports), [reports]);
  if (!modelo.disponible) return <SinPartes etiqueta="Ocurrencias por distrito" />;
  return (
    <section
      className="mon-ocu-partes"
      aria-label="Ocurrencias por distrito"
      data-audit-ready="monitoreo-territorial-control-ocurrencias-distritos"
      data-qa-geometry-group="territorial-ocurrencias-partes"
      data-qa-geometry-contract="intrinsic"
    >
      <section className="mon-ocu-panel mon-ocu-partes-panel" aria-labelledby="mon-ocu-partes-titulo" data-qa-geometry-member="distritos">
        <header className="mon-ocu-cabecera"><RotuloDePestana /></header>
        <div className="mon-ocu-cabecera">
          <h3 id="mon-ocu-partes-titulo" className="mon-ocu-titulo">Partes por distrito</h3>
          <span className="mon-ter-cuenta" title="UMP de la ruta con al menos un parte de ocurrencias">
            {fmt(modelo.umpConParte)} de {fmt(modelo.umpTotal)} UMP con parte
          </span>
        </div>
        <div
          className="mon-ocu-partes-rejilla"
          data-qa-geometry-capacity="owned"
          data-qa-geometry-group="territorial-ocurrencias-partes-distritos"
          data-qa-geometry-contract="equal"
        >
          {modelo.distritos.map((fila) => <TarjetaDeDistrito key={fila.distrito} fila={fila} />)}
        </div>
      </section>
    </section>
  );
}

function TarjetaDeDistrito({ fila }: { fila: DistritoDePartes }) {
  const cobertura = fila.umpTotal > 0 ? (fila.umpConParte / fila.umpTotal) * 100 : 0;
  return (
    <article className="mon-ocu-distrito" aria-label={fila.distrito} data-qa-geometry-member={fila.distrito}>
      <h4 className="mon-ocu-distrito-nombre mon-ter-con-silueta">
        <SiluetaDeDistrito distrito={fila.distrito} lado={22} />
        {fila.distrito}
      </h4>
      <div className="mon-ocu-cobertura">
        <span className="mon-ocu-cobertura-barra" aria-hidden="true"><i style={{ width: `${cobertura}%` }} /></span>
        <span>{fmt(fila.umpConParte)} de {fmt(fila.umpTotal)} UMP con parte</span>
      </div>
      <dl className="mon-ocu-distrito-cifras">
        <div><dt>Intentos</dt><dd>{fmt(fila.intentos)}</dd></div>
        <div><dt>Efectivas declaradas</dt><dd>{fmt(fila.efectivas)}</dd></div>
        <div><dt>No efectividad</dt><dd>{fila.noEfectividad}</dd></div>
        <div><dt>Completas sin parte</dt><dd>{fmt(fila.completasSinParte)}</dd></div>
        <div><dt>Incompletas sin parte</dt><dd>{fmt(fila.incompletasSinParte)}</dd></div>
        <div>
          <dt>Válidas sin parte</dt>
          <dd title={fila.ultimoSinParte ? `Último ingreso sin parte el ${fila.ultimoSinParte}` : undefined} className={fila.ultimoSinParte ? "tiene-ayuda" : undefined}>
            {fmt(fila.validasSinParte)}
          </dd>
        </div>
      </dl>
      {fila.motivos.length ? (
        <ul className="mon-ocu-distrito-motivos" aria-label="Motivos más frecuentes" data-qa-geometry-group={`territorial-ocurrencias-motivos-${fila.distrito}`} data-qa-geometry-contract="intrinsic">
          {fila.motivos.map((motivo) => (
            <li key={motivo.clave} className="mon-ter-chip" title={`${motivo.completo}: ${fmt(motivo.total)}`} data-qa-geometry-member={motivo.clave}>
              {motivo.rotulo} <b>{fmt(motivo.total)}</b>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mon-ocu-base">Sin motivos de no efectividad</p>
      )}
    </article>
  );
}

function OcurrenciasRitmoImpl({ reports }: { reports: MonitoreoTerritorialDashboard | null }) {
  const modelo = useMemo(() => construirRitmoDePartes(reports), [reports]);
  if (!modelo.disponible) return <SinPartes etiqueta="Ritmo de los partes" />;
  return (
    <section
      className="mon-ocu-ritmo"
      aria-label="Ritmo de los partes"
      data-audit-ready="monitoreo-territorial-control-ocurrencias-ritmo"
      data-qa-geometry-group="territorial-ocurrencias-ritmo"
      data-qa-geometry-contract="intrinsic"
    >
      <PorDia modelo={modelo} />
      <div className="mon-ocu-ritmo-lateral" data-qa-geometry-member="lateral">
        <section className="mon-ocu-panel" aria-label="El ritmo en cifras">
          <dl className="mon-ocu-celdas mon-ocu-ritmo-cifras" data-qa-geometry-group="territorial-ocurrencias-ritmo-cifras" data-qa-geometry-contract="equal">
            <div data-qa-geometry-member="intentos"><dt>Intentos</dt><dd>{fmt(modelo.intentos)}</dd></div>
            <div data-qa-geometry-member="dias"><dt>Días con parte</dt><dd>{fmt(modelo.dias.length)}</dd></div>
            <div data-qa-geometry-member="pico">
              <dt>Pico diario</dt>
              <dd>{modelo.pico ? fmt(modelo.pico.intentos) : "—"}{modelo.pico ? <small>el {modelo.pico.rotulo}</small> : null}</dd>
            </div>
            <div data-qa-geometry-member="ultimo"><dt>Último día</dt><dd>{modelo.ultimoDia || "—"}</dd></div>
          </dl>
        </section>
        <Lecturas modelo={modelo} />
      </div>
    </section>
  );
}

function PorDia({ modelo }: { modelo: ModeloRitmoDePartes }) {
  const maximo = Math.max(1, ...modelo.dias.map((dia) => dia.intentos));
  return (
    <section className="mon-ocu-panel mon-ocu-ritmo-dias" aria-labelledby="mon-ocu-ritmo-titulo" data-qa-geometry-member="dias">
      <header className="mon-ocu-cabecera"><RotuloDePestana /></header>
      <h3 id="mon-ocu-ritmo-titulo" className="mon-ocu-titulo">Por día</h3>
      {modelo.dias.length ? (
        <div className="mon-ocu-tabla-marco" data-qa-geometry-capacity="owned" tabIndex={0} aria-label="Partes por día, con desplazamiento">
          <table className="mon-ocu-tabla mon-ocu-ritmo-tabla">
            <thead>
              <tr>
                <th scope="col">Día</th>
                <th scope="col">Intentos</th>
                <th scope="col" className="is-num"><span className="mon-ocu-serie is-efectivas">Efectivas declaradas</span></th>
                <th scope="col" className="is-num"><span className="mon-ocu-serie is-no-efectivas">No efectivas</span></th>
                <th scope="col" className="is-num">Efectividad</th>
              </tr>
            </thead>
            <tbody>
              {modelo.dias.map((dia) => (
                <tr key={dia.fecha}>
                  <th scope="row">{dia.rotulo}</th>
                  <td>
                    <span className="mon-ocu-ritmo-intentos">
                      <span className="mon-ocu-ritmo-pista" aria-hidden="true">
                        <span className="mon-ocu-ritmo-barra" style={{ width: `${(dia.intentos / maximo) * 100}%` }}>
                          <i style={{ width: `${dia.intentos ? (dia.efectivas / dia.intentos) * 100 : 0}%` }} />
                        </span>
                      </span>
                      {fmt(dia.intentos)}
                    </span>
                  </td>
                  <td className="is-num">{fmt(dia.efectivas)}</td>
                  <td className="is-num">{fmt(dia.noEfectivas)}</td>
                  <td className="is-num">{dia.efectividad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mon-ocu-base" data-qa-geometry-empty="legitimo">Sin días con parte en el corte</p>
      )}
    </section>
  );
}

const TONO_DEL_CHIP = { ok: "is-ok", aviso: "is-aviso", error: "is-error", info: "is-info" } as const;

function Lecturas({ modelo }: { modelo: ModeloRitmoDePartes }) {
  return (
    <section className="mon-ocu-panel mon-ocu-lecturas" aria-labelledby="mon-ocu-lecturas-titulo" data-qa-geometry-member="lecturas">
      <header className="mon-ocu-cabecera">
        <h3 id="mon-ocu-lecturas-titulo" className="mon-ocu-titulo">Lecturas del formulario</h3>
        <span className="mon-ter-cuenta">{fmt(modelo.lecturas.length)}</span>
      </header>
      {modelo.lecturas.length ? (
        <ol className="mon-ocu-lecturas-lista" data-qa-geometry-capacity="owned" data-qa-geometry-group="territorial-ocurrencias-lecturas" data-qa-geometry-contract="equal">
          {modelo.lecturas.map((lectura) => (
            <li key={lectura.id} data-qa-geometry-member={lectura.id}>
              <strong>{lectura.tipo}</strong>
              <span className={`mon-ter-chip ${TONO_DEL_CHIP[lectura.tono]}`}>{lectura.estado}</span>
              <span className="mon-ocu-lectura-cuando">{lectura.cuando}</span>
              <span className="mon-ocu-lectura-registros">{fmt(lectura.registros)} {lectura.registros === 1 ? "parte" : "partes"}</span>
              {lectura.mensaje ? <small>{lectura.mensaje}</small> : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mon-ocu-base" data-qa-geometry-empty="legitimo">Sin lecturas registradas</p>
      )}
    </section>
  );
}

export const OcurrenciasDistritosTab = memo(OcurrenciasDistritosImpl);
export const OcurrenciasRitmoTab = memo(OcurrenciasRitmoImpl);
