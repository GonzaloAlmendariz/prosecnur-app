import { memo, useMemo } from "react";
import { ClipboardList } from "lucide-react";
import type { MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { fmt, pct } from "../rotulos";
import { construirOcurrencias, motivosDeLaBarra, rotuloCortoDeMotivo, type ModeloOcurrencias } from "./ocurrenciasModel";
import { RotuloDePestana } from "../navegacion/RotuloDePestana";
import "./ocurrencias.css";

/**
 * Control › Ocurrencias (territorial.md §3.9). Arriba la banda con intentos,
 * efectivas declaradas, tasa y no efectivas, y la barra de motivos. Abajo, por
 * distrito (motivos por cada 100 intentos) y por día, y la tasa de efectividad
 * por UMP. Las efectivas de los partes son declaradas: no son las que cuentan.
 */
function OcurrenciasTabImpl({ reports }: { reports: MonitoreoTerritorialDashboard | null }) {
  const modelo = useMemo(() => construirOcurrencias(reports), [reports]);

  if (!modelo.conPartes) {
    return (
      <section className="mon-ocu mon-ocu--vacio" data-audit-ready="vacio:sin-partes" aria-label="Ocurrencias">
        <div className="mon-ocu-panel mon-ocu-vacio">
          <RotuloDePestana />
          <ClipboardList size={20} aria-hidden="true" />
          <strong>Sin partes de ocurrencias</strong>
          <span title="Los partes llegan del formulario de ocurrencias de campo">«Actualizar» trae los partes nuevos</span>
        </div>
      </section>
    );
  }

  return (
    <section
      className="mon-ocu"
      aria-label="Ocurrencias"
      data-audit-ready="monitoreo-territorial-control-ocurrencias"
      data-qa-geometry-group="territorial-ocurrencias"
      data-qa-geometry-contract="intrinsic"
    >
      <Banda modelo={modelo} />
      <div className="mon-ocu-cuerpo">
        <PorDistrito modelo={modelo} />
        <div className="mon-ocu-derecha" data-qa-geometry-group="territorial-ocurrencias-derecha" data-qa-geometry-contract="intrinsic">
          <PorDia modelo={modelo} />
          <TasaPorUmp modelo={modelo} />
        </div>
      </div>
    </section>
  );
}

function Banda({ modelo }: { modelo: ModeloOcurrencias }) {
  const barra = motivosDeLaBarra(modelo.motivos);
  return (
    <section className="mon-ocu-panel mon-ocu-banda" aria-label="Lo que declaran los partes" data-qa-geometry-member="banda">
      <header className="mon-ocu-cabecera"><RotuloDePestana /></header>
      <dl className="mon-ocu-cifras" data-qa-geometry-group="territorial-ocurrencias-cifras" data-qa-geometry-contract="equal">
        <div><dt>Intentos</dt><dd>{fmt(modelo.intentos)}</dd></div>
        <div><dt>Efectivas declaradas</dt><dd>{fmt(modelo.efectivas)}</dd></div>
        <div><dt>Tasa</dt><dd>{modelo.tasa}</dd></div>
        <div><dt>No efectivas</dt><dd>{fmt(modelo.noEfectivas)}</dd></div>
      </dl>
      <div className="mon-ocu-motivos">
        {/* Un solo gráfico, no una colección: cada tramo lleva su propio color. */}
        <span className="mon-ocu-barra" role="img" aria-label={barra.map((motivo) => `${motivo.rotulo}: ${fmt(motivo.total)}`).join(", ")}>
          {barra.map((motivo, indice) => (
            <i key={motivo.clave} className={`is-${indice}`} style={{ flexGrow: motivo.total }} title={`${motivo.rotulo}: ${fmt(motivo.total)}`} />
          ))}
        </span>
        <span className="mon-ocu-leyenda">
          {barra.map((motivo, indice) => (
            <span key={motivo.clave} className={`is-${indice}`} title={`${motivo.rotulo}: ${fmt(motivo.total)}`}>{rotuloCortoDeMotivo(motivo.rotulo)} {fmt(motivo.total)}</span>
          ))}
        </span>
      </div>
      <p className="mon-ocu-base" title="Las efectivas son las que declara el parte, no las que cuentan para la meta">{fmt(modelo.partes)} {modelo.partes === 1 ? "parte" : "partes"} en {fmt(modelo.umpsConParte)} UMP</p>
    </section>
  );
}

function PorDistrito({ modelo }: { modelo: ModeloOcurrencias }) {
  const maximo = Math.max(1, ...modelo.distritos.flatMap((fila) => fila.porCien));
  return (
    <section className="mon-ocu-panel mon-ocu-distritos" aria-labelledby="mon-ocu-distritos" data-qa-geometry-member="distritos">
      <header className="mon-ocu-cabecera">
        <h3 id="mon-ocu-distritos" className="mon-ocu-titulo">Por distrito</h3>
        <span className="mon-ocu-base">Motivos por cada 100 intentos</span>
      </header>
      <div className="mon-ocu-tabla-marco" data-qa-geometry-capacity="owned" tabIndex={0} aria-label="Ocurrencias por distrito, con desplazamiento">
        <table className="mon-ocu-tabla">
          <thead>
            <tr>
              <th scope="col">Distrito</th>
              <th scope="col" className="is-num">Intentos</th>
              <th scope="col" className="is-num">UMP con parte</th>
              <th scope="col" className="is-num">Efectivas declaradas</th>
              {modelo.columnas.map((columna) => {
                const tono = Math.max(0, modelo.motivos.findIndex((motivo) => motivo.clave === columna.clave)) % 6;
                return (
                  <th key={columna.clave} scope="col" className="is-num is-motivo" title={`${columna.rotulo}, por cada 100 intentos`}>
                    <span className={`mon-ocu-motivo is-${tono}`}>{rotuloCortoDeMotivo(columna.rotulo)}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {modelo.distritos.map((fila) => (
              <tr key={fila.distrito}>
                <th scope="row">{fila.distrito}</th>
                <td className="is-num">{fmt(fila.intentos)}</td>
                <td className="is-num">{fmt(fila.partes)}</td>
                <td className="is-num">{fmt(fila.efectivas)}</td>
                {fila.porCien.map((valor, indice) => (
                  <td key={modelo.columnas[indice]?.clave ?? indice} className="is-num is-calor" style={{ background: `color-mix(in srgb, var(--pulso-warn-accent) ${Math.round((valor / maximo) * 45)}%, var(--pulso-surface))` }}>
                    {valor.toLocaleString("es-PE", { maximumFractionDigits: 1 })}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PorDia({ modelo }: { modelo: ModeloOcurrencias }) {
  const maximo = Math.max(1, ...modelo.dias.map((dia) => dia.intentos));
  return (
    <section className="mon-ocu-panel mon-ocu-dias-panel" aria-labelledby="mon-ocu-dias" data-qa-geometry-member="dias">
      <h3 id="mon-ocu-dias" className="mon-ocu-titulo">Por día</h3>
      <div className="mon-ocu-grafico">
      <span className="mon-ocu-eje-titulo" aria-hidden="true">Partes por día</span>
      <span className="mon-ocu-eje" aria-hidden="true">
        <b>{fmt(maximo)}</b>
        <b>{fmt(Math.round(maximo / 2))}</b>
        <b>0</b>
      </span>
      <ol className="mon-ocu-dias" aria-label="Intentos y efectivas declaradas por día">
        {modelo.dias.map((dia) => (
          <li key={dia.rotulo} title={`${dia.rotulo}: ${fmt(dia.intentos)} intentos, ${fmt(dia.efectivas)} efectivas declaradas`}>
            <span className="mon-ocu-columna" aria-hidden="true">
              <i className="is-intentos" style={{ height: `${(dia.intentos / maximo) * 100}%` }} />
              <i className="is-efectivas" style={{ height: `${(dia.efectivas / maximo) * 100}%` }} />
            </span>
            <small>{dia.rotulo}</small>
          </li>
        ))}
      </ol>
      </div>
      <span className="mon-ocu-leyenda">
        <span className="is-intentos">Intentos</span>
        <span className="is-efectivas">Efectivas declaradas</span>
      </span>
    </section>
  );
}

function TasaPorUmp({ modelo }: { modelo: ModeloOcurrencias }) {
  const maximo = Math.max(1, ...modelo.tasas.map((tramo) => tramo.umps));
  return (
    <section className="mon-ocu-panel" aria-labelledby="mon-ocu-tasa" data-qa-geometry-member="tasa">
      <header className="mon-ocu-cabecera">
        <h3 id="mon-ocu-tasa" className="mon-ocu-titulo">UMP por tasa de efectividad</h3>
        <span className="mon-ocu-base">{modelo.medianaDeTasa == null ? "Sin mediana" : `Mediana ${pct(modelo.medianaDeTasa)}`}</span>
      </header>
      <ol className="mon-ocu-tramos">
        {modelo.tasas.map((tramo) => (
          <li key={tramo.rotulo}>
            <span>{tramo.rotulo}</span>
            <span className="mon-ocu-tramo-barra" aria-hidden="true"><i style={{ width: `${(tramo.umps / maximo) * 100}%` }} /></span>
            <b>{fmt(tramo.umps)}</b>
          </li>
        ))}
      </ol>
    </section>
  );
}

export const OcurrenciasTab = memo(OcurrenciasTabImpl);
