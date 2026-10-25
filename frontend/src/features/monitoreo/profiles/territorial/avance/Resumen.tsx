import { memo, useMemo } from "react";
import { Check, Info, Target } from "lucide-react";
import type { MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { useFocoMonitoreo } from "../../../useMonitoreoDireccion";
import { fmt, fmtConSigno } from "../rotulos";
import { construirResumen, type DiaDelRitmo, type ModeloResumen, type TirasDeUmp } from "./resumenModel";
import { RotuloDePestana } from "../navegacion/RotuloDePestana";
import { SiluetaDeDistrito } from "./SiluetaDeDistrito";
import "./resumen.css";

/**
 * Avance › Resumen (territorial.md §3.14). Izquierda: la cifra que cuenta para
 * la meta con su base, el embudo del corte y por qué hay casos en observación.
 * Derecha: el ritmo del campo y los distritos, sobre la misma base.
 */
function ResumenImpl({ reports }: { reports: MonitoreoTerritorialDashboard | null }) {
  const modelo = useMemo(() => construirResumen(reports), [reports]);
  const [, escribirFoco] = useFocoMonitoreo();

  if (!modelo.configurado) {
    return (
      <section className="mon-res mon-res--vacio" data-audit-ready="vacio:sin-avance" aria-label="Resumen del avance">
        <div className="mon-res-panel mon-res-vacio" data-qa-geometry-empty="legitimo">
          <RotuloDePestana />
          <Target size={20} aria-hidden="true" />
          <strong>Todavía no hay avance que resumir</strong>
          <span>El avance se calcula cuando la fuente de Kobo tiene respuestas de la fase activa.</span>
          <button type="button" className="mon-res-boton" onClick={() => escribirFoco(null, { seccion: "insumos", pestana: "conexiones", panel: null })}>
            Abrir Insumos › Conexiones
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      className="mon-res"
      aria-label="Resumen del avance"
      data-audit-ready="monitoreo-territorial-avance-resumen"
      data-qa-geometry-group="territorial-resumen"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="mon-res-izquierda" data-qa-geometry-member="izquierda" data-qa-geometry-group="territorial-resumen-izquierda" data-qa-geometry-contract="intrinsic">
        <CifraConBase modelo={modelo} />
        <Embudo modelo={modelo} />
        <Motivos modelo={modelo} onSenales={() => escribirFoco(null, { seccion: "control", pestana: "senales", panel: null })} />
      </div>
      <div className="mon-res-derecha" data-qa-geometry-member="derecha">
        <Ritmo modelo={modelo} />
        <Distritos modelo={modelo} />
      </div>
    </section>
  );
}

function CifraConBase({ modelo }: { modelo: ModeloResumen }) {
  const radio = 34;
  const circunferencia = 2 * Math.PI * radio;
  return (
    <section className="mon-res-panel mon-res-cifra-panel" aria-labelledby="mon-res-cifra-titulo">
      <header className="mon-res-cabecera"><RotuloDePestana /></header>
      <h3 id="mon-res-cifra-titulo" className="pulso-sr-only">Avance frente a la meta</h3>
      <div className="mon-res-cifra">
      <svg className="mon-res-anillo" viewBox="0 0 84 84" role="img" aria-label={`Avance ${modelo.avance}`}>
        <circle cx="42" cy="42" r={radio} className="mon-res-anillo-fondo" />
        <circle
          cx="42"
          cy="42"
          r={radio}
          className="mon-res-anillo-valor"
          strokeDasharray={`${circunferencia * modelo.proporcion} ${circunferencia}`}
          transform="rotate(-90 42 42)"
        />
        <text x="42" y="47" textAnchor="middle">{modelo.avance}</text>
      </svg>
      <div className="mon-res-cifra-texto">
        <p className="mon-res-cifra-numero"><b>{fmt(modelo.cuentan)}</b> / {fmt(modelo.meta)}</p>
        <p className="mon-res-base" title="Casos que cuentan para la meta, sobre la meta de la fase">Cuentan para la meta</p>
        {modelo.metaAlcanzada ? (
          <span
            className="mon-res-chip is-ok"
            title={modelo.metaAlcanzada.excedente > 0 ? `${fmt(modelo.metaAlcanzada.excedente)} por encima de la meta` : undefined}
          >
            <Check size={13} aria-hidden="true" />
            Meta alcanzada el {modelo.metaAlcanzada.fecha}
          </span>
        ) : (
          <span className="mon-res-chip">Faltan {fmt(Math.max(0, modelo.meta - modelo.cuentan))} para la meta</span>
        )}
      </div>
      </div>
    </section>
  );
}

function Embudo({ modelo }: { modelo: ModeloResumen }) {
  const maximo = Math.max(1, ...modelo.embudo.map((paso) => paso.valor));
  return (
    <section className="mon-res-panel" aria-labelledby="mon-res-embudo-titulo">
      <h3 id="mon-res-embudo-titulo" className="mon-res-titulo">Del Kobo a la meta</h3>
      <ol className="mon-res-embudo" data-qa-geometry-group="territorial-resumen-embudo" data-qa-geometry-contract="equal">
        {modelo.embudo.map((paso) => (
          <li key={paso.clave} className={`${paso.resta ? "is-resta" : ""}${paso.nivel ? " is-desglose" : ""}`}>
            <span className="mon-res-embudo-rotulo">{paso.resta ? "− " : ""}{paso.rotulo}</span>
            <span className="mon-res-embudo-barra" aria-hidden="true">
              <i style={{ width: `${(paso.valor / maximo) * 100}%` }} />
            </span>
            <b>{fmt(paso.valor)}</b>
          </li>
        ))}
      </ol>
      {modelo.descuadre !== 0 ? (
        <p className="mon-res-nota">
          <Info size={14} aria-hidden="true" />
          <span title="Recibidas menos anuladas no da lo que queda en el corte">{fmtConSigno(modelo.descuadre)} fuera de fase</span>
        </p>
      ) : null}
    </section>
  );
}

function Motivos({ modelo, onSenales }: { modelo: ModeloResumen; onSenales: () => void }) {
  const enObservacion = modelo.embudo.find((paso) => paso.clave === "observacion")?.valor ?? 0;
  return (
    <section className="mon-res-panel" aria-labelledby="mon-res-motivos-titulo">
      <h3 id="mon-res-motivos-titulo" className="mon-res-titulo" title="Un caso puede tener dos motivos">Por qué {fmt(enObservacion)} están en observación</h3>
      {modelo.motivos === null ? (
        <p className="mon-res-nota" data-qa-geometry-empty="desconexion">
          <Info size={14} aria-hidden="true" />
          <span>
            Sin desglose en este corte.{" "}
            <button type="button" className="mon-res-enlace" onClick={onSenales}>Ver en Control › Señales</button>
          </span>
        </p>
      ) : modelo.motivos.length ? (
        <>
          <ul className="mon-res-motivos">
            {modelo.motivos.map((motivo) => (
              <li key={motivo.clave}><span>{motivo.rotulo}</span><b>{fmt(motivo.casos)}</b></li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mon-res-base" data-qa-geometry-empty="legitimo">Ningún caso en observación.</p>
      )}
      <dl className="mon-res-pie">
        <div><dt>Primer registro</dt><dd>{modelo.primerRegistro || "—"}</dd></div>
        <div><dt>Último</dt><dd>{modelo.ultimoRegistro || "—"}</dd></div>
        <div><dt>Días con campo</dt><dd>{fmt(modelo.diasConCampo)}</dd></div>
      </dl>
    </section>
  );
}

function Ritmo({ modelo }: { modelo: ModeloResumen }) {
  const dias = modelo.ritmo;
  const ancho = 640;
  const alto = 180;
  const margen = { arriba: 12, abajo: 22, izquierda: 8, derecha: 8 };
  const tope = Math.max(modelo.meta, dias.at(-1)?.acumulado ?? 0, 1);
  const topeDiario = Math.max(1, ...dias.map((dia) => dia.cuentan));
  const paso = dias.length ? (ancho - margen.izquierda - margen.derecha) / dias.length : 0;
  const y = (valor: number) => margen.arriba + (1 - valor / tope) * (alto - margen.arriba - margen.abajo);
  const yDiario = (valor: number) => (valor / topeDiario) * (alto - margen.arriba - margen.abajo) * 0.45;
  const x = (indice: number) => margen.izquierda + paso * indice + paso / 2;
  const linea = dias.map((dia, indice) => `${indice ? "L" : "M"}${x(indice).toFixed(1)},${y(dia.acumulado).toFixed(1)}`).join(" ");
  const base = alto - margen.abajo;
  const cada = Math.max(1, Math.ceil(dias.length / 8));
  return (
    <section className="mon-res-panel mon-res-ritmo" aria-labelledby="mon-res-ritmo-titulo" data-qa-geometry-member="ritmo">
      <header className="mon-res-cabecera">
        <h3 id="mon-res-ritmo-titulo" className="mon-res-titulo">Ritmo del campo</h3>
      </header>
      {dias.length ? (
        <div className="mon-res-grafico-marco">
        <span className="mon-res-eje-titulo" aria-hidden="true">Acumulado que cuenta</span>
        <span className="mon-res-eje-y" aria-hidden="true">
          {[tope, Math.round(tope / 2), 0].map((valor, indice) => (
            <b key={indice} style={{ top: `${(y(valor) / alto) * 100}%` }}>{fmt(valor)}</b>
          ))}
        </span>
        <svg className="mon-res-grafico" viewBox={`0 0 ${ancho} ${alto}`} preserveAspectRatio="none" role="img" aria-label={descripcionDelRitmo(dias, modelo)}>
          {dias.map((dia, indice) => (
            <g key={dia.fecha}>
              <rect className="mon-res-barra" x={x(indice) - paso * 0.3} width={paso * 0.6} y={base - yDiario(dia.cuentan)} height={yDiario(dia.cuentan)} />
              <rect className="mon-res-barra is-observacion" x={x(indice) - paso * 0.3} width={paso * 0.6} y={base - yDiario(dia.observacion)} height={yDiario(dia.observacion)} />
              {indice % cada === 0 ? <text className="mon-res-eje" x={x(indice)} y={alto - 6} textAnchor="middle">{dia.rotulo}</text> : null}
            </g>
          ))}
          {modelo.meta > 0 ? <line className="mon-res-meta" x1={margen.izquierda} x2={ancho - margen.derecha} y1={y(modelo.meta)} y2={y(modelo.meta)} /> : null}
          <path className="mon-res-linea" d={linea} />
        </svg>
        </div>
      ) : (
        <p className="mon-res-base" data-qa-geometry-empty="legitimo">Sin días con campo en el corte.</p>
      )}
      {dias.length ? (
          <span className="mon-res-leyenda">
            <span className="is-acumulado">Acumulado que cuenta</span>
            <span className="is-dia">Cuentan por día</span>
            <span className="is-observacion">De ellas en observación</span>
            <span className="is-meta">Meta {fmt(modelo.meta)}</span>
          </span>
      ) : null}
    </section>
  );
}

function descripcionDelRitmo(dias: readonly DiaDelRitmo[], modelo: ModeloResumen): string {
  const ultimo = dias.at(-1);
  return `Ritmo del campo: ${fmt(dias.length)} días, ${fmt(ultimo?.acumulado ?? 0)} que cuentan acumuladas frente a la meta de ${fmt(modelo.meta)}.`;
}

function Tiras({ umps }: { umps: TirasDeUmp }) {
  const total = umps.completas + umps.subsanadas + umps.pendientes;
  if (!total) return <span className="mon-res-base">—</span>;
  const titulo = `${fmt(umps.completas)} completas, ${fmt(umps.subsanadas)} subsanadas, ${fmt(umps.pendientes)} con celda pendiente`;
  return (
    <span className="mon-res-tiras" role="img" aria-label={titulo} title={titulo}>
      {umps.completas ? <i className="is-completa" style={{ flexGrow: umps.completas }} /> : null}
      {umps.subsanadas ? <i className="is-subsanada" style={{ flexGrow: umps.subsanadas }} /> : null}
      {umps.pendientes ? <i className="is-pendiente" style={{ flexGrow: umps.pendientes }} /> : null}
    </span>
  );
}

function Distritos({ modelo }: { modelo: ModeloResumen }) {
  return (
    <section className="mon-res-panel mon-res-distritos" aria-labelledby="mon-res-distritos-titulo" data-qa-geometry-member="distritos">
      <h3 id="mon-res-distritos-titulo" className="mon-res-titulo">Distritos</h3>
      <div className="mon-res-tabla-marco" data-qa-geometry-capacity="owned" tabIndex={0} aria-label="Distritos, con desplazamiento">
        <table className="mon-res-tabla">
          <thead>
            <tr>
              <th scope="col">Distrito</th>
              <th scope="col">Cuentan / meta</th>
              <th scope="col" className="is-num">Avance</th>
              <th scope="col" className="is-num">En observación</th>
              <th scope="col" className="is-num">No cuentan</th>
              <th scope="col">UMP</th>
            </tr>
          </thead>
          <tbody>
            {modelo.distritos.map((fila) => (
              <tr key={fila.distrito}>
                <th scope="row"><span className="mon-ter-con-silueta"><SiluetaDeDistrito distrito={fila.distrito} lado={34} />{fila.distrito}</span></th>
                <td>
                  <span className="mon-res-avance">
                    <span className="mon-res-avance-barra" aria-hidden="true">
                      <i style={{ width: `${fila.meta > 0 ? Math.min(100, (fila.cuentan / fila.meta) * 100) : 0}%` }} />
                    </span>
                    {fmt(fila.cuentan)} / {fmt(fila.meta)}
                  </span>
                </td>
                <td className="is-num">{fila.avance}</td>
                <td className="is-num">{fmt(fila.observacion)}</td>
                <td className="is-num">{fmt(fila.noCuentan)}</td>
                <td><Tiras umps={fila.umps} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td>{fmt(modelo.total.cuentan)} / {fmt(modelo.total.meta)}</td>
              <td className="is-num">{modelo.total.avance}</td>
              <td className="is-num">{fmt(modelo.total.observacion)}</td>
              <td className="is-num">
                {fmt(modelo.total.noCuentan)}
                {modelo.total.sinDistrito ? <small> ({fmt(modelo.total.sinDistrito)} sin distrito)</small> : null}
              </td>
              <td>{fmt(modelo.total.umpsCompletas)} de {fmt(modelo.total.umps)} completas</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

export const ResumenTerritorial = memo(ResumenImpl);
