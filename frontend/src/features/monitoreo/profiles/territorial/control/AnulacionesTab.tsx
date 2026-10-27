import { memo, useMemo, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import {
  apiMonitoreoTerritorialProductionAnnulmentRevert,
  type MonitoreoState,
  type MonitoreoTerritorialDashboard,
  type MonitoreoTerritorialPhase,
} from "../../../../../api/client";
import { fmt } from "../rotulos";
import { construirAnulaciones, type TarjetaDeAnulacion } from "./anulacionesModel";
import { RotuloDePestana } from "../navegacion/RotuloDePestana";
import "./anulaciones.css";

/**
 * Control › Anulaciones (territorial.md §3.12): lo que quedó fuera del conteo
 * por distrito, una tarjeta por anulación activa con «Revertir» (en dos pasos)
 * y la tabla de UMP afectadas con su estado actual.
 */
function AnulacionesTabImpl({
  reports,
  phase,
  onStateChange,
}: {
  reports: MonitoreoTerritorialDashboard | null;
  phase: MonitoreoTerritorialPhase;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const modelo = useMemo(() => construirAnulaciones(reports), [reports]);
  const [porRevertir, setPorRevertir] = useState<string | null>(null);
  const [enCurso, setEnCurso] = useState<string | null>(null);
  const [error, setError] = useState("");
  const maximo = Math.max(1, ...modelo.porDistrito.map((item) => item.casos));

  if (!modelo.activas.length && !modelo.casosFuera) {
    return (
      <section className="mon-anu mon-anu--vacio" data-audit-ready="vacio:sin-anulaciones" aria-label="Anulaciones">
        <div className="mon-anu-panel mon-anu-vacio">
          <RotuloDePestana />
          <ShieldCheck size={20} aria-hidden="true" />
          <strong>Ningún caso anulado en esta fase</strong>
          <span>Un caso o la producción de un aplicador se anulan desde Control › Bandeja o Control › Equipo.</span>
          {modelo.revertidas ? <span>{fmt(modelo.revertidas)} anulaciones revertidas.</span> : null}
        </div>
      </section>
    );
  }

  const revertir = async (id: string) => {
    setEnCurso(id);
    setError("");
    try {
      const resultado = await apiMonitoreoTerritorialProductionAnnulmentRevert({ id, phase, reason: "Revertida desde Control › Anulaciones" });
      onStateChange?.(resultado.state);
      setPorRevertir(null);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : String(fallo));
    } finally {
      setEnCurso(null);
    }
  };

  return (
    <section
      className="mon-anu"
      aria-label="Anulaciones"
      data-audit-ready="monitoreo-territorial-control-anulaciones"
      data-qa-geometry-group="territorial-anulaciones"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="mon-anu-izquierda" data-qa-geometry-member="resumen">
        <section className="mon-anu-panel" aria-labelledby="mon-anu-fuera">
          <RotuloDePestana />
          <h3 id="mon-anu-fuera" className="mon-anu-cifra">
            <b>{fmt(modelo.casosFuera)}</b>
            <span>{modelo.casosFuera === 1 ? "caso fuera del conteo" : "casos fuera del conteo"}</span>
          </h3>
          <p className="mon-anu-base">
            En {fmt(modelo.umpsAfectadas)} UMP, por {fmt(modelo.activas.length)} {modelo.activas.length === 1 ? "anulación activa" : "anulaciones activas"}. No cuentan para la meta mientras sigan anulados.
          </p>
          {modelo.porDistrito.length ? (
            <div className="mon-anu-distritos">
              <span className="mon-anu-subtitulo">Por distrito</span>
              <ul className="mon-anu-barras">
                {modelo.porDistrito.map((item) => (
                  <li key={item.distrito}>
                    <span>{item.distrito}</span>
                    <span className="mon-anu-barra" aria-hidden="true"><i style={{ width: `${(item.casos / maximo) * 100}%` }} /></span>
                    <b>{fmt(item.casos)}</b>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
        {error ? <p className="mon-anu-error" role="alert">{error}</p> : null}
        <ul className="mon-anu-tarjetas" aria-label="Anulaciones activas" data-qa-geometry-group="territorial-anulaciones-tarjetas" data-qa-geometry-contract="equal">
          {modelo.activas.map((tarjeta) => (
            <li key={tarjeta.id} className="mon-anu-panel mon-anu-tarjeta">
              <header>
                <span className="mon-anu-quien">
                  <span className="mon-anu-alcance">{tarjeta.alcance === "caso" ? "Un caso" : "Producción completa"}</span>
                  <strong>{tarjeta.quien}</strong>
                </span>
                <small>{tarjeta.cuando}</small>
              </header>
              <ImpactoDeTarjeta tarjeta={tarjeta} />
              {tarjeta.motivo ? (
                <p className="mon-anu-motivo"><span>Motivo</span>{tarjeta.motivo}</p>
              ) : null}
              {porRevertir === tarjeta.id ? (
                <span className="mon-anu-confirmar">
                  <span className="mon-anu-base">Los casos vuelven a contar.</span>
                  <button type="button" className="mon-anu-boton is-primario" disabled={enCurso != null} onClick={() => { void revertir(tarjeta.id); }}>
                    {enCurso === tarjeta.id ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" /> : null}
                    Confirmar reversión
                  </button>
                  <button type="button" className="mon-anu-boton" onClick={() => setPorRevertir(null)}>Cancelar</button>
                </span>
              ) : (
                <button type="button" className="mon-anu-boton" disabled={enCurso != null} onClick={() => setPorRevertir(tarjeta.id)}>Revertir</button>
              )}
            </li>
          ))}
        </ul>
        {modelo.revertidas ? <p className="mon-anu-base">{fmt(modelo.revertidas)} anulaciones revertidas antes.</p> : null}
      </div>

      <section className="mon-anu-panel mon-anu-tabla-panel" aria-labelledby="mon-anu-umps" data-qa-geometry-member="umps">
        <header className="mon-anu-tabla-cabecera">
          <h3 id="mon-anu-umps" className="mon-anu-titulo">UMP afectadas</h3>
          <span className="mon-anu-base">Cuántos casos perdió cada UMP y cómo queda su cuota sin ellos</span>
        </header>
        <div className="mon-anu-tabla-marco" data-qa-geometry-capacity="owned" tabIndex={0} aria-label="UMP afectadas, con desplazamiento">
          <table className="mon-anu-tabla">
            <thead>
              <tr>
                <th scope="col">UMP</th>
                <th scope="col">Manzana</th>
                <th scope="col">Distrito</th>
                <th scope="col" className="is-num">Casos anulados</th>
                <th scope="col" className="is-num">Con consentimiento</th>
                <th scope="col">Cuota hoy</th>
              </tr>
            </thead>
            <tbody>
              {modelo.umps.map((item) => (
                <tr key={item.clave}>
                  <th scope="row">{item.ump || "—"}</th>
                  <td>{item.manzana || "—"}</td>
                  <td>{item.distrito}</td>
                  <td className="is-num">{fmt(item.anuladas)}</td>
                  <td className="is-num">{fmt(item.validasAnuladas)}</td>
                  <td><span className={`mon-anu-estado is-${item.tono}`}>{item.estadoActual}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function ImpactoDeTarjeta({ tarjeta }: { tarjeta: TarjetaDeAnulacion }) {
  const cifras = [
    { rotulo: "Casos", valor: tarjeta.casos },
    { rotulo: "Con consentimiento", valor: tarjeta.validos },
    { rotulo: "UMP", valor: tarjeta.umps },
  ];
  if (cifras.every((cifra) => cifra.valor == null)) return <span className="mon-anu-base">Sin el detalle del impacto</span>;
  return (
    <dl className="mon-anu-impacto">
      {cifras.map((cifra) => (
        <div key={cifra.rotulo}>
          <dt>{cifra.rotulo}</dt>
          <dd>{cifra.valor == null ? "—" : fmt(cifra.valor)}</dd>
        </div>
      ))}
    </dl>
  );
}

export const AnulacionesTab = memo(AnulacionesTabImpl);
