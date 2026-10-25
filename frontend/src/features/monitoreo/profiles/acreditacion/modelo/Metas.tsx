import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Alert } from "../../../../../components/Alert";
import { apiMonitoreoConfig, type MonitoreoState } from "../../../../../api/client";
import type { MonitoreoCuotaPublico } from "../../../../../api/monitoreoCuotas";
import { pctConEspacio } from "../../../core/formatoComun";
import { fmt, normalizeSourceMatch } from "../formato";
import { useResumenDelCorte } from "../navegacion/resumenDelCorte";
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
import "../paletaPublicos.css";
import "./modelo.css";
import { CabeceraDeTarjeta } from "../navegacion/rotuloDePestana";
import { MetasEnEspera } from "./MetasEnEspera";
import { MarcaDeLectura } from "../navegacion/MarcaDeLectura";
import { clasePublico, paletaDePublicos } from "../paletaPublicos";

/**
 * Modelo › Metas (ficha M1): cuántas encuestas por público. Arriba, la meta del
 * estudio con su reparto y un solo «Guardar»; debajo, una tarjeta por público
 * (§2a-bis, como el establecedor de metas anterior) con personas, cobertura y
 * meta editables, efectivas y el estado marcado en el borde.
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
  const avance = useResumenDelCorte((memoria) => memoria.avance);
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

  // Mientras el estado de cuotas no llega, no se afirma que el estudio no tiene
  // públicos (C5): se dice que se está leyendo.
  const leyendo = !publicosDePrueba && !estado && !errorDeCuotas;
  const marca = <MarcaDeLectura leyendo={leyendo || Boolean(!publicosDePrueba && !errorDeCuotas && estado?.preparando)} />;
  // Un tono por público, el mismo de Avance y Control (paletaPublicos): con
  // hasta 10 públicos ninguno se repite en la barra ni en la leyenda.
  const paleta = paletaDePublicos(filas.map((fila) => fila.publico));
  if (!filas.length) {
    return <>{marca}<MetasEnEspera motivo={leyendo ? "leyendo" : estado?.preparando ? "preparando" : "sin-publicos"} error={errorDeCuotas || undefined} /></>;
  }

  const efectivasDe = (publico: string) => avance?.tarjetas.find((tarjeta) => normalizeSourceMatch(tarjeta.actor) === normalizeSourceMatch(publico))?.effective ?? null;
  return (
    <div className="acr-mo-metas" data-qa-geometry-group="acreditacion-modelo-metas" data-qa-geometry-contract="intrinsic">
      {marca}
      <section className="acr-av-panel" aria-label="Meta del estudio">
        <CabeceraDeTarjeta primera>
          <h3>Meta del estudio <span className="acr-av-tenue">{`${fmt(metaTotal)} de ${fmt(personasTotal)} personas, ${personasTotal ? pctConEspacio((metaTotal / personasTotal) * 100) : "—"}`}</span></h3>
          <button type="button" className="acr-av-boton is-primario" onClick={() => { void guardar(); }} disabled={guardando || !cambiadas.length}>
            {guardando ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
            {cambiadas.length ? `Guardar ${fmt(cambiadas.length)} ${cambiadas.length === 1 ? "meta" : "metas"}` : "Guardar"}
          </button>
        </CabeceraDeTarjeta>
        {mensaje ? <div className="acr-ct-cuerpo"><Alert kind={mensaje.tono === "error" ? "error" : "info"}>{mensaje.texto}</Alert></div> : null}
        <div className="acr-mo-reparto-barra" role="img" aria-label={filas.map((fila) => `${fila.publico}: ${fmt(metaDelBorrador(borradores[fila.publico] ?? borradorDe(fila)) ?? 0)}`).join("; ")}>
          {filas.map((fila) => {
            const meta = metaDelBorrador(borradores[fila.publico] ?? borradorDe(fila)) ?? 0;
            return meta > 0 ? <i key={fila.publico} className={clasePublico(paleta, fila.publico)} style={{ flexGrow: meta }} title={`${fila.publico}: ${fmt(meta)}`} /> : null;
          })}
        </div>
        <ul className="acr-mo-reparto-leyenda">
          {filas.map((fila) => {
            const meta = metaDelBorrador(borradores[fila.publico] ?? borradorDe(fila)) ?? 0;
            return (
              <li key={fila.publico}>
                <i className={clasePublico(paleta, fila.publico)} aria-hidden="true" />
                <span>{fila.publico}</span>
                <b className="acr-av-num">{metaTotal ? pctConEspacio((meta / metaTotal) * 100) : "—"}</b>
              </li>
            );
          })}
        </ul>
      </section>
      <div className="acr-mo-tarjetas" data-qa-geometry-group="acreditacion-metas-publicos" data-qa-geometry-contract="equal">
        {filas.map((fila) => {
          const borrador = borradores[fila.publico] ?? borradorDe(fila);
          const meta = metaDelBorrador(borrador);
          const efectivas = efectivasDe(fila.publico);
          const estado = !meta ? "sin-meta" : efectivas == null ? "abierta" : efectivas >= meta ? "cumplida" : "en-curso";
          const cambiada = cambiadas.includes(fila);
          return (
            <article key={fila.publico} data-qa-geometry-member className={`acr-mo-tarjeta is-${estado}${cambiada ? " is-cambiada" : ""} ${clasePublico(paleta, fila.publico)}`} aria-label={`Meta de ${fila.publico}`}>
              <header className="acr-mo-tarjeta-cabecera">
                <span>
                  <span className="acr-av-antetitulo">Público</span>
                  <strong><i className="mon-publico-punto" aria-hidden="true" />{fila.publico}</strong>
                </span>
                <span className={`acr-av-chip acr-mo-estado is-${estado}`}>
                  {cambiada ? "Sin guardar" : estado === "cumplida" ? "Meta cumplida" : estado === "en-curso" ? `${pctConEspacio(((efectivas ?? 0) / (meta ?? 1)) * 100)} de la meta` : estado === "sin-meta" ? "Sin meta" : "Meta declarada"}
                </span>
              </header>
              <div className="acr-mo-teselas">
                <div className="acr-mo-tesela">
                  <small>Padrón</small>
                  <b className="acr-av-num">{fila.personas == null ? "—" : fmt(fila.personas)}</b>
                </div>
                <label className="acr-mo-tesela is-editable">
                  <small>Cobertura</small>
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
                </label>
                <label className="acr-mo-tesela is-editable">
                  <small>Meta</small>
                  <input
                    className="acr-mo-meta"
                    inputMode="numeric"
                    value={borrador.meta}
                    onChange={(event) => { const valor = event.currentTarget.value; setBorradores((previo) => ({ ...previo, [fila.publico]: conMeta(fila, valor) })); }}
                    aria-label={`Meta de ${fila.publico}`}
                    disabled={guardando}
                  />
                </label>
                <div className="acr-mo-tesela">
                  <small>Efectivas</small>
                  <b className="acr-av-num">{efectivas == null ? "—" : fmt(efectivas)}</b>
                </div>
              </div>
              <div className="acr-mo-tarjeta-pie">
                <span className="acr-av-pista is-gruesa" aria-hidden="true"><i style={{ width: `${fila.personas && meta != null ? Math.min(100, (meta / fila.personas) * 100) : 0}%` }} /></span>
                <span className="acr-av-tenue">{meta != null && metaTotal ? `${pctConEspacio((meta / metaTotal) * 100)} de la meta del estudio` : "Sin meta"}{fila.personas && meta != null ? ` · la meta es el ${pctConEspacio(Math.min(100, (meta / fila.personas) * 100))} del padrón` : ""}</span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
