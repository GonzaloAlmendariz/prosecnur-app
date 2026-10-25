import { useState } from "react";
import { FileCheck2, Loader2 } from "lucide-react";
import { Alert } from "../../../../../components/Alert";
import { Switch } from "../../../../../components/Switch";
import { SuperficieFlotante } from "../../../core/superficieFlotante/SuperficieFlotante";
import { fmt } from "../formato";
import { puedeCerrar, type EstadoDelCierre } from "./salidasModelo";

/**
 * Diálogo «Cerrar campo» (P3): lo que queda fijo, lo pendiente, el plan de
 * refuerzo y la aprobación metodológica, con la misma regla del motor. El
 * cierre no tiene vuelta atrás en la app, por eso se confirma aquí y no con un
 * botón suelto.
 */
export function DialogoCerrarCampo({
  cierre,
  planInicial,
  aprobacionInicial,
  guardando,
  error,
  onCerrarCampo,
  onCerrar,
  panelId,
}: {
  cierre: EstadoDelCierre;
  planInicial: string;
  aprobacionInicial: boolean;
  guardando: boolean;
  error?: string | null;
  onCerrarCampo: (planDeRefuerzo: string, aprobacion: boolean) => void;
  onCerrar: () => void;
  panelId?: string;
}) {
  const [plan, setPlan] = useState(planInicial);
  const [aprobacion, setAprobacion] = useState(aprobacionInicial);
  const habilitado = !guardando && puedeCerrar(cierre.bloqueado, plan, aprobacion);
  const pendientes = cierre.puntos.filter((punto) => punto.estado === "pendiente");
  return (
    <SuperficieFlotante
      tipo="dialogo"
      antetitulo="Salidas"
      titulo="Cerrar campo"
      onCerrar={onCerrar}
      panelId={panelId}
      pie={(
        <>
          <button type="button" className="acr-av-boton" onClick={onCerrar}>Cancelar</button>
          <button type="button" className="acr-av-boton is-primario" disabled={!habilitado} onClick={() => onCerrarCampo(plan, aprobacion)}>
            {guardando ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" /> : <FileCheck2 size={14} aria-hidden="true" />}
            {cierre.metasDeclaradas ? `Cerrar con ${fmt(cierre.metasCumplidas)} de ${fmt(cierre.metasDeclaradas)} metas` : "Cerrar campo"}
          </button>
        </>
      )}
    >
      <div className="acr-sa-dialogo">
        <p>Al cerrar, el estudio pasa a cierre de campo y queda registrada la fecha. La app no ofrece reabrirlo.</p>
        {pendientes.length ? (
          <section aria-label="Lo pendiente">
            <span className="acr-av-antetitulo">Lo pendiente</span>
            <ul className="acr-sa-puntos">
              {pendientes.map((punto) => <li key={punto.rotulo} className="is-pendiente"><span>{punto.rotulo}</span><b>{punto.valor}</b></li>)}
            </ul>
          </section>
        ) : <Alert kind="info">No queda nada pendiente para cerrar.</Alert>}
        {cierre.bloqueado ? <Alert kind="warn">Hay brechas que bloquean el cierre: hace falta un plan de refuerzo o la aprobación metodológica.</Alert> : null}
        <label className="acr-sa-campo">
          <span>Plan de refuerzo o justificación del cierre</span>
          <textarea value={plan} rows={3} onChange={(evento) => setPlan(evento.currentTarget.value)} disabled={guardando} />
        </label>
        <div className="acr-rg-switch">
          <Switch checked={aprobacion} onToggle={() => setAprobacion(!aprobacion)} ariaLabel="Aprobación metodológica de las brechas" disabled={guardando} />
          <span>Aprobación metodológica de las brechas que quedan</span>
        </div>
        {error ? <Alert kind="error">{error}</Alert> : null}
      </div>
    </SuperficieFlotante>
  );
}
