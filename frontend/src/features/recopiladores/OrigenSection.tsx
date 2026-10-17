import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import type { CollectionOrigen, CollectionStatePayload } from "../../api/recopiladores";
import { EstadoVacio } from "../../components/EstadoVacio";
import { PulsoButton } from "../../components/PulsoButton";
import { usePanelDireccionable } from "../../lib/navegacion/paneles";
import { AlertTriangle, CheckCircle2, RefreshCw } from "../../vendor/lucide-react";
import { ConfirmarResembrado } from "./ConfirmarResembrado";
import { OrigenConexion } from "./OrigenConexion";
import { OrigenDiferencias } from "./OrigenDiferencias";
import {
  detalleDeLaFuente,
  enlacesDeLaFuente,
  tituloDeLaFuente,
  vigenciaDelOrigen,
  type FiltroDeDiferencias,
} from "./origen";
import { PANEL_REHACER_PLAN } from "./resembrado";
import { useOrigen } from "./useOrigen";
import "./styles/origen.css";

type Props = {
  payload: CollectionStatePayload | null;
  onState: (payload: CollectionStatePayload) => void;
  /** Avisa al shell mientras el origen no ha llegado: la vista no es juzgable. */
  onCargando?: (cargando: boolean) => void;
};

/**
 * Unidades › Origen (E1e): de dónde sale la lista, si sigue al día con su
 * fuente y qué cambió. Material de campo no decide las unidades; aquí se ve si
 * lo que cita sigue siendo cierto, y se actualiza desde la fuente.
 */
export function OrigenSection({ payload, onState, onCargando }: Props) {
  const { carga, recargar } = useOrigen(payload?.state_revision ?? null);
  const [filtro, setFiltro] = useState<FiltroDeDiferencias>("todas");
  const panel = usePanelDireccionable(PANEL_REHACER_PLAN);

  const cargando = carga.estado === "cargando";
  useEffect(() => { onCargando?.(cargando); }, [cargando, onCargando]);
  useEffect(() => () => onCargando?.(false), [onCargando]);

  const origen = carga.origen;

  if (!origen) {
    if (carga.estado === "error") {
      return (
        <div className="rec-vacio-sin-plan" data-qa-geometry-capacity="owned">
          <EstadoVacio
            tamano="normal"
            icono={<AlertTriangle size={18} />}
            titulo="No se pudo leer el origen"
            descripcion={carga.mensaje}
            accion={(
              <PulsoButton variant="secondary" size="sm" onClick={() => { void recargar(); }}>
                <RefreshCw size={14} aria-hidden /> Reintentar
              </PulsoButton>
            )}
          />
        </div>
      );
    }
    return <div className="rec-loading" data-qa-geometry-capacity="owned">Comparando la lista con su fuente…</div>;
  }

  return (
    <div className="rec-origen-contenedor">
      {payload && origen.plan.existe ? (
        <ConfirmarResembrado
          panel={panel}
          variante="actualizar"
          expectedRevision={payload.state_revision}
          expectedSourceFingerprint={origen.fingerprint_actual}
          onState={onState}
          onFuenteCambio={recargar}
        />
      ) : null}
      <OrigenVista
        origen={origen}
        filtro={filtro}
        onFiltro={setFiltro}
        onActualizar={panel.abrir}
        dialogoAbierto={panel.abierto}
        errorAlReleer={carga.estado === "error" ? carga.mensaje : ""}
      />
    </div>
  );
}

type VistaProps = {
  origen: CollectionOrigen;
  filtro: FiltroDeDiferencias;
  onFiltro: (filtro: FiltroDeDiferencias) => void;
  onActualizar: () => void;
  dialogoAbierto: boolean;
  /** Releer falló: se conserva lo último leído y se dice. */
  errorAlReleer: string;
};

/** La pestaña con el origen ya leído. Sin efectos: se prueba con un render estático. */
export function OrigenVista({ origen, filtro, onFiltro, onActualizar, dialogoAbierto, errorAlReleer }: VistaProps) {
  const vigencia = vigenciaDelOrigen(origen);
  const { modulo } = enlacesDeLaFuente(origen);

  return (
    <div
      className="rec-origen"
      data-qa-geometry-group="material-campo/unidades/origen"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="rec-origen-principal">
        <section className="rec-origen-fuente" aria-labelledby="rec-origen-fuente-titulo" data-qa-geometry-member>
          <div className="rec-origen-fuente-texto">
            <span className="xfk-over">De dónde salen</span>
            <h2 id="rec-origen-fuente-titulo">{tituloDeLaFuente(origen)}</h2>
            <span className="rec-origen-suave">{detalleDeLaFuente(origen)}</span>
          </div>
          <div className="rec-origen-fuente-estado">
            <span className="rec-origen-sello" data-tono={vigencia.tono}>
              {vigencia.tono === "al-dia" ? <CheckCircle2 size={14} aria-hidden /> : null}
              {vigencia.tono === "cambio" ? <AlertTriangle size={14} aria-hidden /> : null}
              {vigencia.etiqueta}
            </span>
            {modulo ? (
              <Link className="pulso-button pulso-button--secondary pulso-button--sm" to={modulo.to}>
                {modulo.label}
              </Link>
            ) : null}
          </div>
        </section>
        {errorAlReleer ? <p className="rec-inline-error" role="alert">{errorAlReleer}</p> : null}
        <OrigenDiferencias origen={origen} filtro={filtro} onFiltro={onFiltro} />
      </div>
      <OrigenConexion origen={origen} onActualizar={onActualizar} dialogoAbierto={dialogoAbierto} />
    </div>
  );
}
