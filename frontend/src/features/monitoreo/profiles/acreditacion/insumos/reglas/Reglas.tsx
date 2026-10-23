import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Loader2 } from "lucide-react";
import { Alert } from "../../../../../../components/Alert";
import { apiMonitoreoConfig, type MonitoreoConfig, type MonitoreoState } from "../../../../../../api/client";
import { useResumenDelCorte } from "../../navegacion/resumenDelCorte";
import { Alertas } from "./Alertas";
import { LlaveDeCruce } from "./LlaveDeCruce";
import { QueCuentaComoEfectiva } from "./QueCuentaComoEfectiva";
import {
  borradorDeReglas,
  configuracionConReglas,
  frasesDeEfectiva,
  hayCambios,
  mover,
  problemasDelBorrador,
  type BorradorDeReglas,
} from "./reglasModelo";
import "../../avance/avance.css";
import "../../modelo/modelo.css";
import "../insumos.css";
import "./reglas.css";

type PropsDeVista = {
  config: MonitoreoConfig;
  borrador: BorradorDeReglas;
  cruces: ReadonlyArray<{ rotulo: string; casos: number }> | null;
  onCambiar: (cambio: Partial<BorradorDeReglas>) => void;
  onGuardar: () => void;
  guardando: boolean;
  mensaje?: { tono: "info" | "error"; texto: string } | null;
  /** «Estados del barrido», solo cuando el estudio tiene barrido. */
  estadosDelBarrido?: ReactNode;
  /** «Eventos de contacto» y reglas de estado final, con su propio guardado. */
  eventos?: ReactNode;
};

export function ReglasVista({ config, borrador, cruces, onCambiar, onGuardar, guardando, mensaje, estadosDelBarrido, eventos }: PropsDeVista) {
  const perfil = config.monitoreo_profile;
  const problemas = problemasDelBorrador(borrador);
  const cambiado = hayCambios(config, borrador);
  return (
    <div className="acr-rg">
      <div className="acr-av-panel acr-rg-barra">
        <p>Todo lo que cambia una cifra antes de contarla.</p>
        <button type="button" className="acr-av-boton is-primario" onClick={onGuardar} disabled={guardando || !cambiado || problemas.length > 0}>
          {guardando ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />} Guardar reglas
        </button>
      </div>
      {mensaje ? <Alert kind={mensaje.tono === "error" ? "error" : "info"}>{mensaje.texto}</Alert> : null}
      {cambiado && problemas.length ? <Alert kind="warn">{problemas.join(" ")}</Alert> : null}
      <div className="acr-rg-reticula" data-qa-geometry-group="acreditacion-insumos-reglas" data-qa-geometry-contract="intrinsic">
        <LlaveDeCruce
          padron={perfil?.key_rules?.universe_fields ?? []}
          respuesta={perfil?.key_rules?.response_fields ?? []}
          automatica={borrador.automatica}
          respaldoNombre={borrador.respaldoNombre}
          cruces={cruces}
          onAutomatica={(automatica) => onCambiar({ automatica })}
          onRespaldoNombre={(respaldoNombre) => onCambiar({ respaldoNombre })}
          bloqueada={guardando}
        />
        <QueCuentaComoEfectiva
          frases={frasesDeEfectiva(perfil)}
          duracionMinima={borrador.duracionMinima}
          duracionMaxima={borrador.duracionMaxima}
          prioridad={borrador.prioridad}
          onDuracionMinima={(duracionMinima) => onCambiar({ duracionMinima })}
          onDuracionMaxima={(duracionMaxima) => onCambiar({ duracionMaxima })}
          onMover={(indice, paso) => onCambiar({ prioridad: mover(borrador.prioridad, indice, paso) })}
          bloqueada={guardando}
        />
        <Alertas
          valores={borrador.alertas}
          onCambiar={(clave, valor) => onCambiar({ alertas: { ...borrador.alertas, [clave]: valor } })}
          bloqueada={guardando}
        />
      </div>
      {estadosDelBarrido ? <section className="acr-av-panel acr-rg-ancha" aria-label="Estados del barrido telefónico">{estadosDelBarrido}</section> : null}
      {eventos ? <section className="acr-av-panel acr-rg-ancha" aria-label="Eventos de contacto">{eventos}</section> : null}
    </div>
  );
}

/**
 * Insumos › Reglas (ficha I3): llave de cruce, qué cuenta como efectiva y
 * alertas, con un solo «Guardar reglas» sobre la configuración del proyecto.
 * Los estados del barrido y los eventos de contacto conservan sus editores de
 * siempre, debajo, con su propio guardado.
 */
export function Reglas({
  state,
  onStateChange,
  estadosDelBarrido,
  eventos,
}: {
  state: MonitoreoState | null | undefined;
  onStateChange?: (state: MonitoreoState) => void;
  estadosDelBarrido?: ReactNode;
  eventos?: ReactNode;
}) {
  const config = state?.config ?? null;
  const cruces = useResumenDelCorte((estado) => estado.cruces);
  const [borrador, setBorrador] = useState<BorradorDeReglas | null>(() => (config ? borradorDeReglas(config) : null));
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tono: "info" | "error"; texto: string } | null>(null);
  const firma = config ? JSON.stringify(borradorDeReglas(config)) : "";
  // Lo guardado manda cuando cambia; la firma lo resume sin depender de identidades.
  const configRef = useRef(config);
  configRef.current = config;
  useEffect(() => {
    setBorrador(configRef.current ? borradorDeReglas(configRef.current) : null);
  }, [firma]);

  if (!config || !borrador) {
    return <div className="acr-cr is-vacio" data-vacio><Alert kind="info">Leyendo la configuración del proyecto.</Alert></div>;
  }

  async function guardar() {
    if (!config || !borrador) return;
    setGuardando(true);
    setMensaje(null);
    try {
      const result = await apiMonitoreoConfig(configuracionConReglas(config, borrador));
      onStateChange?.(result.state);
      setMensaje({ tono: "info", texto: "Reglas guardadas." });
    } catch (e) {
      setMensaje({ tono: "error", texto: (e as Error).message });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ReglasVista
      config={config}
      borrador={borrador}
      cruces={cruces}
      onCambiar={(cambio) => { setMensaje(null); setBorrador((previo) => (previo ? { ...previo, ...cambio } : previo)); }}
      onGuardar={() => { void guardar(); }}
      guardando={guardando}
      mensaje={mensaje}
      estadosDelBarrido={estadosDelBarrido}
      eventos={eventos}
    />
  );
}
