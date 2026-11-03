import { memo, useMemo } from "react";
import { Info, Target } from "lucide-react";
import { EstadoVacio } from "../../../../../components/EstadoVacio";
import type { MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { useFocoMonitoreo } from "../../../useMonitoreoDireccion";
import { ejeDeFechas } from "../../../core/ejeDeFechas";
import { useAnchoMedido } from "../../../core/useAnchoMedido";
import { fmt, fmtConSigno } from "../rotulos";
import { construirResumen, type DiaDelRitmo, type ModeloResumen, type TirasDeUmp } from "./resumenModel";
import { avancePorZona, faltaDeZona, type AvancePorZona } from "./porZonaModelo";
import { RotuloDePestana } from "../navegacion/RotuloDePestana";
import { SiluetaDeDistrito } from "./SiluetaDeDistrito";
import "./resumen.css";
import { EstadoChip } from "../../../../../components/EstadoChip";

/**
 * Avance › Resumen (territorial.md §3.14). Izquierda: la cifra que cuenta para
 * la meta con su base, el embudo del corte y por qué hay casos en observación.
 * Derecha: el ritmo del campo y los distritos, sobre la misma base.
 */
function ResumenImpl({ reports }: { reports: MonitoreoTerritorialDashboard | null }) {
  const modelo = useMemo(() => construirResumen(reports), [reports]);
  // ADR 0125 A1: con envío por cuotas, el total puede pasar la meta sin cerrar las celdas.
  const cuotas = useMemo(() => avancePorZona(reports?.cuotas), [reports]);
  const [, escribirFoco] = useFocoMonitoreo();

  if (!modelo.configurado) {
    return (
      <section className="mon-res mon-res--vacio" data-audit-ready="vacio:sin-avance" aria-label="Resumen del avance">
        <div className="mon-res-panel" data-qa-geometry-empty="legitimo">
          <RotuloDePestana />
          <EstadoVacio
            tamano="normal"
            icono={<Target size={18} />}
            titulo="Todavía no hay avance que resumir"
            descripcion="El avance se calcula cuando la fuente de Kobo tiene respuestas de la fase activa."
            accion={
              <button type="button" className="mon-res-boton" onClick={() => escribirFoco(null, { seccion: "insumos", pestana: "conexiones", panel: null })}>
                Abrir Insumos › Conexiones
              </button>
            }
          />
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
        <CifraConBase modelo={modelo} cuotas={cuotas} onFaltante={() => escribirFoco(null, { seccion: "avance", pestana: "faltante", panel: null })} />
        <Embudo modelo={modelo} />
        <Motivos modelo={modelo} onSenales={() => escribirFoco(null, { seccion: "control", pestana: "senales", panel: null })} />
      </div>
      <div className="mon-res-derecha" data-qa-geometry-member="derecha">
        <Ritmo modelo={modelo} />
        <Distritos modelo={modelo} cuotas={cuotas} />
      </div>
    </section>
  );
}

function AvisoDeCuotas({ cuotas, superaLaMeta, onFaltante }: { cuotas: AvancePorZona; superaLaMeta: boolean; onFaltante: () => void }) {
  const falta = cuotas.zonas.reduce((s, z) => s + faltaDeZona(z), 0);
  if (!falta) return null;
  // ADR 0126: lo que se exige (celdas, o metas marginales si una dimensión es referencial).
  const celdas = cuotas.unidades - cuotas.unidadesCompletas;
  const marginal = cuotas.zonas.some((z) => z.marginales.length > 0);
  return (
    <button type="button" className="mon-res-aviso-cuotas" onClick={onFaltante}>
      <span>
        <b>Faltan {fmt(falta)} entrevistas en {fmt(celdas)} {marginal ? (celdas === 1 ? "meta" : "metas") : celdas === 1 ? "celda" : "celdas"}</b>
        {superaLaMeta ? " aunque el total supera la meta" : ""}
      </span>
      <span>Ver Faltante</span>
    </button>
  );
}

function CifraConBase({ modelo, cuotas, onFaltante }: { modelo: ModeloResumen; cuotas: AvancePorZona | null; onFaltante: () => void }) {
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
          <EstadoChip
            label={`Meta alcanzada el ${modelo.metaAlcanzada.fecha}`}
            tone="success"
            detail={modelo.metaAlcanzada.excedente > 0 ? `${fmt(modelo.metaAlcanzada.excedente)} por encima de la meta` : undefined}
          />
        ) : (
          <EstadoChip label={`Faltan ${fmt(Math.max(0, modelo.meta - modelo.cuentan))} para la meta`} tone="warn" />
        )}
      </div>
      </div>
      {cuotas ? <AvisoDeCuotas cuotas={cuotas} superaLaMeta={modelo.cuentan >= modelo.meta} onFaltante={onFaltante} /> : null}
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
      <h3 id="mon-res-motivos-titulo" className="mon-res-titulo" title="Un caso puede tener dos motivos">Motivos de observación ({fmt(enObservacion)} {enObservacion === 1 ? "caso" : "casos"})</h3>
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
          <ul className="mon-res-motivos" data-qa-geometry-group="territorial-resumen-motivos" data-qa-geometry-contract="equal">
            {modelo.motivos.map((motivo) => (
              <li key={motivo.clave} data-qa-geometry-member={motivo.clave}><span>{motivo.rotulo}</span><b>{fmt(motivo.casos)}</b></li>
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
  const margen = { arriba: 12, abajo: 4, izquierda: 8, derecha: 8 };
  const tope = Math.max(modelo.meta, dias.at(-1)?.acumulado ?? 0, 1);
  const topeDiario = Math.max(1, ...dias.map((dia) => dia.cuentan));
  const paso = dias.length ? (ancho - margen.izquierda - margen.derecha) / dias.length : 0;
  const y = (valor: number) => margen.arriba + (1 - valor / tope) * (alto - margen.arriba - margen.abajo);
  const yDiario = (valor: number) => (valor / topeDiario) * (alto - margen.arriba - margen.abajo) * 0.45;
  const x = (indice: number) => margen.izquierda + paso * indice + paso / 2;
  const linea = dias.map((dia, indice) => `${indice ? "L" : "M"}${x(indice).toFixed(1)},${y(dia.acumulado).toFixed(1)}`).join(" ");
  const base = alto - margen.abajo;
  // El eje de fechas de dos líneas (core/ejeDeFechas): cuántos días caben lo
  // decide el paso en px reales del SVG estirado; hasta medirlo, el del viewBox.
  const [pista, anchoDePista] = useAnchoMedido<HTMLSpanElement>();
  const rotulos = ejeDeFechas(dias.map((dia) => dia.fecha), paso * ((anchoDePista || ancho) / ancho));
  return (
    <section className="mon-res-panel mon-res-ritmo" aria-labelledby="mon-res-ritmo-titulo" data-qa-geometry-member="ritmo">
      <header className="mon-res-cabecera">
        <h3 id="mon-res-ritmo-titulo" className="mon-res-titulo">Ritmo del campo</h3>
      </header>
      {dias.length ? (
        <div className="mon-res-grafico-marco">
        <span className="mon-res-eje-titulo" aria-hidden="true">Encuestas acumuladas</span>
        <span className="mon-res-eje-y" aria-hidden="true">
          {[tope, Math.round(tope / 2), 0].map((valor, indice) => (
            <b key={indice} style={{ top: `${(y(valor) / alto) * 100}%` }}>{fmt(valor)}</b>
          ))}
        </span>
        <div className="mon-res-lienzo">
        <svg className="mon-res-grafico" viewBox={`0 0 ${ancho} ${alto}`} preserveAspectRatio="none" role="img" aria-label={descripcionDelRitmo(dias, modelo)}>
          {dias.map((dia, indice) => (
            <g key={dia.fecha}>
              <rect className="mon-res-barra" x={x(indice) - paso * 0.3} width={paso * 0.6} y={base - yDiario(dia.cuentan)} height={yDiario(dia.cuentan)} />
              <rect className="mon-res-barra is-observacion" x={x(indice) - paso * 0.3} width={paso * 0.6} y={base - yDiario(dia.observacion)} height={yDiario(dia.observacion)} />
            </g>
          ))}
          {modelo.meta > 0 ? <line className="mon-res-meta" x1={margen.izquierda} x2={ancho - margen.derecha} y1={y(modelo.meta)} y2={y(modelo.meta)} /> : null}
          <path className="mon-res-linea" d={linea} />
        </svg>
        {/* Las fechas van en HTML, como el eje Y: dentro del SVG estirado con
         * preserveAspectRatio="none" el texto se ensanchaba con el panel. */}
        <span className="mon-res-eje-x" aria-hidden="true" ref={pista}
          data-qa-geometry-group="territorial-resumen-eje-x" data-qa-geometry-contract="intrinsic">
          {rotulos.map((rotulo) => (
            <span key={dias[rotulo.indice].fecha} className="mon-eje-fecha-html" style={{ left: `${(x(rotulo.indice) / ancho) * 100}%` }}>
              {rotulo.dia}
              {rotulo.mes ? <b>{rotulo.mes}</b> : null}
            </span>
          ))}
        </span>
        </div>
        </div>
      ) : (
        <p className="mon-res-base" data-qa-geometry-empty="legitimo">Sin días con campo en el corte.</p>
      )}
      {dias.length ? (
          <span className="mon-res-leyenda">
            <span className="is-acumulado">Acumulado para la meta</span>
            <span className="is-dia">Encuestas del día</span>
            <span className="is-observacion">En observación</span>
            <span className="is-meta">Meta ({fmt(modelo.meta)})</span>
          </span>
      ) : null}
    </section>
  );
}

function descripcionDelRitmo(dias: readonly DiaDelRitmo[], modelo: ModeloResumen): string {
  const ultimo = dias.at(-1);
  return `Ritmo del campo: ${fmt(dias.length)} días, ${fmt(ultimo?.acumulado ?? 0)} encuestas acumuladas para la meta de ${fmt(modelo.meta)}.`;
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

const tonoDelDia = (v: number, max: number) => (v <= 0
  ? "var(--pulso-surface-3)"
  : `color-mix(in srgb, var(--pulso-brand-navy) ${Math.round(18 + (v / Math.max(1, max)) * 82)}%, var(--pulso-surface))`);

/** El calor diario de una zona, alineado a los días del ritmo. */
function CalorDiario({ dias, porFecha, max }: { dias: readonly DiaDelRitmo[]; porFecha: ReadonlyMap<string, number>; max: number }) {
  return (
    <span className="mon-res-calor" style={{ gridTemplateColumns: `repeat(${Math.max(1, dias.length)}, minmax(0, 1fr))` }}>
      {dias.map((d) => {
        const v = porFecha.get(d.fecha) ?? 0;
        return <i key={d.fecha} title={`${d.rotulo}: ${fmt(v)}`} style={{ background: tonoDelDia(v, max) }} />;
      })}
    </span>
  );
}

function Distritos({ modelo, cuotas }: { modelo: ModeloResumen; cuotas: AvancePorZona | null }) {
  const zonas = new Map((cuotas?.zonas ?? []).map((z) => [z.idZona, z]));
  const diarios = new Map([...zonas].map(([u, z]) => [u, new Map(z.diario.map((d) => [d.fecha, d.efectivas]))]));
  const maxDia = Math.max(1, ...[...diarios.values()].flatMap((m) => [...m.values()]));
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
              {cuotas ? (
                <>
                  <th scope="col" className="is-num">{cuotas.zonas.some((z) => z.marginales.length > 0) ? "Metas" : "Celdas"}</th>
                  <th scope="col" title={`Efectivas por día, del ${modelo.ritmo[0]?.rotulo ?? ""} al ${modelo.ritmo.at(-1)?.rotulo ?? ""}`}>Por día</th>
                </>
              ) : <th scope="col">UMP</th>}
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
                {cuotas ? (
                  <>
                    <td className={`is-num${(zonas.get(fila.ubigeo)?.unidadesCompletas ?? 0) < (zonas.get(fila.ubigeo)?.unidades ?? 0) ? " is-falta" : ""}`}>
                      {zonas.get(fila.ubigeo) ? `${fmt(zonas.get(fila.ubigeo)?.unidadesCompletas ?? 0)} de ${fmt(zonas.get(fila.ubigeo)?.unidades ?? 0)}` : "—"}
                    </td>
                    <td><CalorDiario dias={modelo.ritmo} porFecha={diarios.get(fila.ubigeo) ?? new Map()} max={maxDia} /></td>
                  </>
                ) : <td><Tiras umps={fila.umps} /></td>}
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
              {cuotas ? (
                <>
                  <td className={`is-num${cuotas.unidadesCompletas < cuotas.unidades ? " is-falta" : ""}`}>{fmt(cuotas.unidadesCompletas)} de {fmt(cuotas.unidades)}</td>
                  <td />
                </>
              ) : <td>{fmt(modelo.total.umpsCompletas)} de {fmt(modelo.total.umps)} completas</td>}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

export const ResumenTerritorial = memo(ResumenImpl);
