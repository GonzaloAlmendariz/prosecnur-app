import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Alert } from "../../../../../components/Alert";
import { apiMonitoreoConfig, type MonitoreoState } from "../../../../../api/client";
import type { MonitoreoCuotaPublico } from "../../../../../api/monitoreoCuotas";
import { pctConEspacio } from "../../../core/formatoComun";
import { fmt } from "../formato";
import { preferredGoalVariable } from "../AcreditacionActorGoals";
import { useEstadoDeCuotas } from "../insumos/useEstadoDeCuotas";
import {
  borradorDe,
  cambios,
  conCobertura,
  conMeta,
  coberturaDelBorrador,
  filasDeMetas,
  metaDelBorrador,
  metasAGuardar,
  type BorradorDeMeta,
} from "./metasModelo";
import "../avance/avance.css";
import "../control/casos/personas.css";
import "./modelo.css";

/**
 * Modelo › Metas (ficha M1): cuántas encuestas por público. Una tabla con la
 * cobertura editable y la meta que resulta, un solo «Guardar»; al lado, la
 * cobertura exigida a cada público y cómo se reparte la meta.
 */
export function Metas({
  state,
  onStateChange,
  publicosDePrueba,
}: {
  state: MonitoreoState | null | undefined;
  onStateChange?: (state: MonitoreoState) => void;
  /** Solo para pruebas de render. */
  publicosDePrueba?: MonitoreoCuotaPublico[];
}) {
  const { estado, error: errorDeCuotas } = useEstadoDeCuotas();
  const publicos = publicosDePrueba ?? estado?.publicos ?? [];
  const goals = state?.config?.goals;
  const filas = useMemo(() => filasDeMetas(publicos, goals ?? []), [publicos, goals]);
  const firma = filas.map((fila) => `${fila.publico}:${fila.meta}:${fila.cobertura}`).join("|");
  const [borradores, setBorradores] = useState<Record<string, BorradorDeMeta>>({});
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tono: "info" | "error"; texto: string } | null>(null);
  // Lo guardado manda cuando cambia; la firma lo resume sin depender de identidades.
  const filasRef = useRef(filas);
  filasRef.current = filas;
  useEffect(() => {
    setBorradores(Object.fromEntries(filasRef.current.map((fila) => [fila.publico, borradorDe(fila)])));
  }, [firma]);
  const cambiadas = cambios(filas, borradores);
  const metaTotal = filas.reduce((suma, fila) => suma + (metaDelBorrador(borradores[fila.publico] ?? borradorDe(fila)) ?? 0), 0);
  const personasTotal = filas.reduce((suma, fila) => suma + (fila.personas ?? 0), 0);
  const exigida = [...filas]
    .map((fila) => ({ fila, cobertura: coberturaDelBorrador(borradores[fila.publico] ?? borradorDe(fila)), meta: metaDelBorrador(borradores[fila.publico] ?? borradorDe(fila)) }))
    .filter((item) => item.cobertura != null)
    .sort((a, b) => (b.cobertura ?? 0) - (a.cobertura ?? 0));

  async function guardar() {
    if (!state?.config || !cambiadas.length) return;
    setGuardando(true);
    setMensaje(null);
    try {
      const goalKey = preferredGoalVariable((state.variables ?? []).map((variable) => variable.name)) || "dim_actor";
      const result = await apiMonitoreoConfig({ ...state.config, goals: metasAGuardar(state.config.goals ?? [], cambiadas, borradores, goalKey) });
      onStateChange?.(result.state);
      setMensaje({ tono: "info", texto: cambiadas.length === 1 ? `Meta de ${cambiadas[0].publico} guardada.` : `${fmt(cambiadas.length)} metas guardadas.` });
    } catch (e) {
      setMensaje({ tono: "error", texto: (e as Error).message });
    } finally {
      setGuardando(false);
    }
  }

  if (!filas.length) {
    return (
      <div className="acr-cr is-vacio" data-vacio>
        <Alert kind="info">{estado?.preparando ? "El motor está preparando el cruce del padrón; las metas aparecen al terminar." : errorDeCuotas || "El estudio todavía no tiene públicos con padrón. Se declaran en Insumos › Públicos."}</Alert>
      </div>
    );
  }

  return (
    <div className="acr-ps is-metas" data-qa-geometry-group="acreditacion-modelo-metas" data-qa-geometry-contract="intrinsic">
      <section className="acr-av-panel acr-ps-tabla" aria-label="Meta por público">
        <header className="acr-av-panel-cabecera">
          <h3>Meta por público <span className="acr-av-tenue">{`${fmt(metaTotal)} de ${fmt(personasTotal)} personas, ${personasTotal ? pctConEspacio((metaTotal / personasTotal) * 100) : "—"}`}</span></h3>
          <button type="button" className="acr-av-boton is-primario" onClick={() => { void guardar(); }} disabled={guardando || !cambiadas.length}>
            {guardando ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />} Guardar
          </button>
        </header>
        {mensaje ? <div className="acr-ct-cuerpo"><Alert kind={mensaje.tono === "error" ? "error" : "info"}>{mensaje.texto}</Alert></div> : null}
        <div className="acr-pr-cola-marco" data-qa-geometry-capacity="owned">
          <table className="acr-pub-tabla">
            <thead>
              <tr>
                <th scope="col">Público</th>
                <th scope="col" className="is-num">Personas</th>
                <th scope="col" className="is-num">Cobertura</th>
                <th scope="col" className="is-num">Meta</th>
                <th scope="col">La meta dentro del padrón</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => {
                const borrador = borradores[fila.publico] ?? borradorDe(fila);
                const meta = metaDelBorrador(borrador);
                const cambiada = cambiadas.includes(fila);
                return (
                  <tr key={fila.publico} className={cambiada ? "is-activa" : undefined}>
                    <th scope="row">{fila.publico}</th>
                    <td className="is-num">{fila.personas == null ? "—" : fmt(fila.personas)}</td>
                    <td className="is-num">
                      <span className="acr-mo-entrada">
                        <input
                          inputMode="decimal"
                          value={borrador.cobertura}
                          onChange={(event) => { const valor = event.currentTarget.value; setBorradores((previo) => ({ ...previo, [fila.publico]: conCobertura(fila, valor) })); }}
                          aria-label={`Cobertura de ${fila.publico}, en porcentaje`}
                          disabled={guardando || !fila.personas}
                        />
                        <span aria-hidden="true">%</span>
                      </span>
                    </td>
                    <td className="is-num">
                      <input
                        className="acr-mo-meta"
                        inputMode="numeric"
                        value={borrador.meta}
                        onChange={(event) => { const valor = event.currentTarget.value; setBorradores((previo) => ({ ...previo, [fila.publico]: conMeta(fila, valor) })); }}
                        aria-label={`Meta de ${fila.publico}`}
                        disabled={guardando}
                      />
                    </td>
                    <td>
                      <span className="acr-av-pista is-gruesa"><i style={{ width: `${fila.personas && meta != null ? Math.min(100, (meta / fila.personas) * 100) : 0}%` }} /></span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                <td className="is-num">{fmt(personasTotal)}</td>
                <td className="is-num">{personasTotal ? pctConEspacio((metaTotal / personasTotal) * 100) : "—"}</td>
                <td className="is-num">{fmt(metaTotal)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
      <div className="acr-mo-columna">
        <section className="acr-av-panel" aria-label="Cobertura exigida">
          <header className="acr-av-panel-cabecera"><h3>Cobertura exigida <span className="acr-av-tenue">De mayor a menor</span></h3></header>
          <ul className="acr-mo-exigida" data-qa-geometry-capacity="owned">
            {exigida.map(({ fila, cobertura, meta }) => (
              <li key={fila.publico}>
                <span>{fila.publico}</span>
                <span className="acr-mo-riel" aria-hidden="true"><i style={{ left: `${Math.min(100, cobertura ?? 0)}%` }} /></span>
                <b className="acr-av-num">{pctConEspacio(cobertura ?? 0)}</b>
                <span className="acr-av-tenue acr-av-num">{meta == null ? "—" : `${fmt(meta)} encuestas`}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="acr-av-panel" aria-label="Reparto de la meta">
          <header className="acr-av-panel-cabecera"><h3>Reparto de la meta</h3></header>
          <ul className="acr-mo-reparto">
            {filas.map((fila) => {
              const meta = metaDelBorrador(borradores[fila.publico] ?? borradorDe(fila)) ?? 0;
              return (
                <li key={fila.publico}>
                  <span>{fila.publico}</span>
                  <span className="acr-av-pista"><i style={{ width: `${metaTotal ? (meta / metaTotal) * 100 : 0}%` }} /></span>
                  <b className="acr-av-num">{metaTotal ? pctConEspacio((meta / metaTotal) * 100) : "—"}</b>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
