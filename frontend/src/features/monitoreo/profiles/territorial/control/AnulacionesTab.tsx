import { memo, useMemo, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import {
  apiMonitoreoTerritorialProductionAnnulmentRevert,
  type MonitoreoState,
  type MonitoreoTerritorialDashboard,
  type MonitoreoTerritorialPhase,
} from "../../../../../api/client";
import { fmt } from "../rotulos";
import { construirAnulaciones, resumenDeTarjeta } from "./anulacionesModel";
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
          <h3 id="mon-anu-fuera" className="mon-anu-titulo">{fmt(modelo.casosFuera)} casos fuera del conteo · {fmt(modelo.umpsAfectadas)} UMP</h3>
          <ul className="mon-anu-barras">
            {modelo.porDistrito.map((item) => (
              <li key={item.distrito}>
                <span>{item.distrito}</span>
                <span className="mon-anu-barra" aria-hidden="true"><i style={{ width: `${(item.casos / maximo) * 100}%` }} /></span>
                <b>{fmt(item.casos)}</b>
              </li>
            ))}
          </ul>
        </section>
        {error ? <p className="mon-anu-error" role="alert">{error}</p> : null}
        <ul className="mon-anu-tarjetas" data-qa-geometry-group="territorial-anulaciones-tarjetas" data-qa-geometry-contract="equal">
          {modelo.activas.map((tarjeta) => (
            <li key={tarjeta.id} className="mon-anu-panel mon-anu-tarjeta">
              <header>
                <strong>{tarjeta.titulo}</strong>
                <small>{tarjeta.cuando}</small>
              </header>
              <span className="mon-anu-base">{resumenDeTarjeta(tarjeta)}</span>
              {tarjeta.motivo ? <span className="mon-anu-motivo">«{tarjeta.motivo}»</span> : null}
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
        <h3 id="mon-anu-umps" className="mon-anu-titulo">UMP afectadas</h3>
        <div className="mon-anu-tabla-marco" data-qa-geometry-capacity="owned" tabIndex={0} aria-label="UMP afectadas, con desplazamiento">
          <table className="mon-anu-tabla">
            <thead>
              <tr>
                <th scope="col">UMP</th>
                <th scope="col">Manzana</th>
                <th scope="col">Distrito</th>
                <th scope="col" className="is-num">Anuladas</th>
                <th scope="col" className="is-num">Con consentimiento</th>
                <th scope="col">Estado actual</th>
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
                  <td className={item.estadoActual === "No está en la ruta" ? "is-fuera" : ""}>{item.estadoActual}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

export const AnulacionesTab = memo(AnulacionesTabImpl);
