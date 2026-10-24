import { memo, useMemo } from "react";
import { Users, X } from "lucide-react";
import type { MonitoreoState, MonitoreoTerritorialDashboard, MonitoreoTerritorialPhase } from "../../../../../api/client";
import { usePanelDireccionable } from "../../../../../lib/navegacion/paneles";
import { useFocoMonitoreo } from "../../../useMonitoreoDireccion";
import { fmt } from "../rotulos";
import { DialogoDeAnulacion, PANEL_ANULAR } from "./DialogoDeAnulacion";
import { construirEquipo, type FilaDeEquipo } from "./equipoModel";
import { RotuloDePestana } from "../navegacion/RotuloDePestana";
import "./equipo.css";

/**
 * Control › Equipo (territorial.md §3.8): una fila por código de aplicador con
 * lo que recibió y lo que cuenta, sus señales y lo que tiene en bandeja. Al
 * elegir un código (`panel=codigo&foco=<código>`) se abre su inspector al
 * costado, con «Anular producción» al pie (`panel=anular`, mismo `foco`).
 */
function EquipoTabImpl({
  consultas,
  validacion,
  phase,
  onStateChange,
}: {
  consultas: MonitoreoTerritorialDashboard | null;
  validacion: MonitoreoTerritorialDashboard | null;
  phase: MonitoreoTerritorialPhase;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const modelo = useMemo(() => construirEquipo(consultas, validacion), [consultas, validacion]);
  const [foco, escribirFoco] = useFocoMonitoreo();
  const anular = usePanelDireccionable(PANEL_ANULAR);
  const elegida = modelo.filas.find((fila) => fila.codigo === String(foco ?? "").toUpperCase()) ?? null;
  const pedido = useMemo(
    () => (elegida && !elegida.anulado ? { alcance: "produccion" as const, clave: elegida.clave, rotulo: elegida.aplicador } : null),
    [elegida],
  );

  if (!modelo.filas.length) {
    return (
      <section className="mon-eq mon-eq--vacio" data-audit-ready="vacio:sin-equipo" aria-label="Equipo">
        <div className="mon-eq-panel mon-eq-vacio">
          <RotuloDePestana />
          <Users size={20} aria-hidden="true" />
          <strong>Sin códigos de aplicador en el corte</strong>
          <span>Los códigos salen del padrón de Insumos y de las respuestas de Kobo.</span>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`mon-eq${elegida ? " con-inspector" : ""}`}
      aria-label="Equipo"
      data-audit-ready="monitoreo-territorial-control-equipo"
      data-qa-geometry-group="territorial-equipo"
      data-qa-geometry-contract="intrinsic"
    >
      <section className="mon-eq-panel mon-eq-tabla-panel" aria-labelledby="mon-eq-titulo" data-qa-geometry-member="tabla">
        <header className="mon-eq-cabecera">
          <RotuloDePestana />
          <h3 id="mon-eq-titulo" className="pulso-sr-only">Equipo por código</h3>
          <span className="mon-eq-base">{fmt(modelo.filas.length)} códigos; señales sobre los casos del corte</span>
        </header>
        <div className="mon-eq-tabla-marco" data-qa-geometry-capacity="owned" tabIndex={0} aria-label="Equipo por código, con desplazamiento">
          <table className="mon-eq-tabla">
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Estado</th>
                <th scope="col" className="is-num">Recibidas</th>
                <th scope="col" className="is-num">Cuentan</th>
                <th scope="col" className="is-num">UMP</th>
                <th scope="col">Distritos</th>
                <th scope="col">GPS observado</th>
                <th scope="col" className="is-num">Menos de 5 min</th>
                <th scope="col">Cuentan por día</th>
                <th scope="col" className="is-num">En bandeja</th>
                <th scope="col">Último</th>
              </tr>
            </thead>
            <tbody>
              {modelo.filas.map((fila) => (
                <tr key={fila.clave} className={`${fila.anulado ? "is-anulado" : ""}${elegida?.clave === fila.clave ? " is-elegida" : ""}`}>
                  <th scope="row">
                    <button
                      type="button"
                      aria-pressed={elegida?.clave === fila.clave}
                      aria-label={`${fila.aplicador}: ver sus señales`}
                      title={fila.aplicador}
                      onClick={() => escribirFoco(elegida?.clave === fila.clave ? null : fila.codigo, { panel: elegida?.clave === fila.clave ? null : "codigo" })}
                    >
                      {fila.codigo}
                    </button>
                  </th>
                  <td>{fila.anulado ? "Producción anulada" : "Activo"}</td>
                  <td className="is-num">{fmt(fila.recibidas)}</td>
                  <td className="is-num">{fmt(fila.cuentan)}</td>
                  <td className="is-num">{fmt(fila.umps)}</td>
                  <td>{fila.distritos.join(", ") || "—"}</td>
                  <td>{fila.gpsObservado ? <BarraDeProporcion casos={fila.gpsObservado.casos} base={fila.gpsObservado.base} texto={fila.gpsObservado.texto} /> : "—"}</td>
                  <td className="is-num">{fila.cortas == null ? "—" : fmt(fila.cortas)}</td>
                  <td>{fila.porDia ? <Sparkline valores={fila.porDia} codigo={fila.codigo} /> : "—"}</td>
                  <td className="is-num">{fila.enBandeja == null ? "—" : fmt(fila.enBandeja)}</td>
                  <td>{fila.ultimo || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {elegida ? (
        <InspectorDeCodigo
          fila={elegida}
          onCerrar={() => escribirFoco(null, { panel: null })}
          onUmp={(ump) => escribirFoco(ump, { seccion: "avance", pestana: "umps", panel: "ump" })}
          onAnular={anular.abrir}
        />
      ) : null}

      {anular.abierto && pedido ? (
        <DialogoDeAnulacion pedido={pedido} phase={phase} panel={anular.props} onCerrar={anular.cerrar} onAplicada={(state) => onStateChange?.(state)} />
      ) : null}
    </section>
  );
}

function BarraDeProporcion({ casos, base, texto }: { casos: number; base: number; texto: string }) {
  return (
    <span className="mon-eq-proporcion" title={`${fmt(casos)} de ${fmt(base)} casos con GPS`}>
      <span className="mon-eq-proporcion-barra" aria-hidden="true"><i style={{ width: `${base ? Math.min(100, (casos / base) * 100) : 0}%` }} /></span>
      {texto}
    </span>
  );
}

function Sparkline({ valores, codigo }: { valores: readonly number[]; codigo: string }) {
  const maximo = Math.max(1, ...valores);
  const total = valores.reduce((suma, valor) => suma + valor, 0);
  return (
    <svg className="mon-eq-spark" viewBox={`0 0 ${valores.length * 4} 16`} preserveAspectRatio="none" role="img" aria-label={`${codigo}: ${fmt(total)} que cuentan en ${fmt(valores.filter(Boolean).length)} días`}>
      {valores.map((valor, indice) => (
        <rect key={indice} x={indice * 4} width={3} y={16 - (valor / maximo) * 16} height={(valor / maximo) * 16} />
      ))}
    </svg>
  );
}

function InspectorDeCodigo({
  fila,
  onCerrar,
  onUmp,
  onAnular,
}: {
  fila: FilaDeEquipo;
  onCerrar: () => void;
  onUmp: (ump: string) => void;
  onAnular: () => void;
}) {
  return (
    <aside className="mon-eq-panel mon-eq-inspector" aria-labelledby="mon-eq-inspector-titulo" data-qa-geometry-member="inspector">
      <header className="mon-eq-inspector-cabecera">
        <div>
          <h3 id="mon-eq-inspector-titulo">{fila.codigo}</h3>
          <span className="mon-eq-base">{fila.aplicador}</span>
        </div>
        <button type="button" className="mon-eq-cerrar" aria-label={`Cerrar las señales de ${fila.codigo}`} onClick={onCerrar}>
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <dl className="mon-eq-cifras">
        <div><dt>Cuentan</dt><dd>{fmt(fila.cuentan)}</dd></div>
        <div><dt>UMP</dt><dd>{fmt(fila.umps)}</dd></div>
        <div><dt>En bandeja</dt><dd>{fila.enBandeja == null ? "—" : fmt(fila.enBandeja)}</dd></div>
      </dl>
      <section aria-labelledby="mon-eq-senales">
        <h4 id="mon-eq-senales" className="mon-eq-subtitulo">Señales en bandeja</h4>
        {fila.senales.length ? (
          <ul className="mon-eq-lista">
            {fila.senales.map((senal) => <li key={senal.tipo}><span>{senal.rotulo}</span><b>{fmt(senal.casos)}</b></li>)}
          </ul>
        ) : (
          <p className="mon-eq-base">Sin casos en bandeja.</p>
        )}
      </section>
      {fila.umpsConSenal.length ? (
        <section aria-labelledby="mon-eq-umps">
          <h4 id="mon-eq-umps" className="mon-eq-subtitulo">UMP con señales</h4>
          <ul className="mon-eq-umps">
            {fila.umpsConSenal.map((item) => (
              <li key={item.ump}>
                <button type="button" onClick={() => onUmp(item.ump)}>UMP {item.ump} <b>{fmt(item.casos)}</b></button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <footer className="mon-eq-pie">
        {fila.anulado ? (
          <p className="mon-eq-base">Su producción ya está anulada; se revierte en Control › Anulaciones.</p>
        ) : (
          <button type="button" className="mon-eq-boton is-peligro" onClick={onAnular}>Anular producción</button>
        )}
      </footer>
    </aside>
  );
}

export const EquipoTab = memo(EquipoTabImpl);
