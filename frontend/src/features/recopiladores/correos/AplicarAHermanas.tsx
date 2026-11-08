// «Aplicar a las campañas hermanas» (GOAL editor de correos, L16): lleva el
// cuerpo y los envíos de una campaña a las que se elijan, en dos pasos —ver qué
// cambia en cada una y aplicar—. Cada hermana conserva su trato, su campo de
// enlace, el valor de sus datos y sus destinatarios. No es una sincronización:
// después de aplicar, cada campaña sigue siendo suya.
//
// Panel direccionable `?panel=correo-hermanas` (clase «dialogo»), sobre la lista
// (`&foco=correo.<id>`) o dentro de la campaña abierta.

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useId, useState } from "react";

import type { MailCampaignSummary } from "../../../api/materialMail";
import type { MailHermana, ParteHermana } from "../../../api/materialMailHermanas";
import { PulsoButton } from "../../../components/PulsoButton";
import { formatoConteo } from "../../../lib/formatoNumero";
import { PulsoSwitch } from "../../../components/PulsoSwitch";
import type { ControlPanel } from "../../../lib/navegacion/paneles";
import { Loader2 } from "../../../vendor/lucide-react";
import { useFocoDeRetorno } from "../campanas/focoDeRetorno";
import { rotuloDeCampana } from "./modeloCampanas";
import { frasesDeLaHermana } from "./modeloHermanas";
import type { ResultadoDeHermanas } from "./useHermanas";
import "./correosCampanas.css";

type Props = {
  panel: ControlPanel;
  /** La campaña de origen; `null` si ya no existe. */
  origen: MailCampaignSummary | null;
  campanas: MailCampaignSummary[];
  /** El correo de origen está abierto con cambios sin guardar: se aplica lo guardado. */
  sinGuardar: boolean;
  onAplicar: (origen: string, destinos: string[], partes: ParteHermana[], simular: boolean) => Promise<ResultadoDeHermanas>;
  onCerrar: () => void;
};

type Fase =
  | { paso: "elegir"; error: string | null }
  | { paso: "simulando" }
  | { paso: "ver"; hermanas: MailHermana[]; variantes: number }
  | { paso: "aplicando"; hermanas: MailHermana[]; variantes: number };

export function AplicarAHermanas({ panel, origen, campanas, sinGuardar, onAplicar, onCerrar }: Props) {
  const ids = useId();
  const { abierto } = panel;
  const hermanas = campanas.filter((c) => c.campaign_id !== origen?.campaign_id);
  const [elegidas, setElegidas] = useState<string[]>([]);
  const [cuerpo, setCuerpo] = useState(true);
  const [envios, setEnvios] = useState(true);
  const [fase, setFase] = useState<Fase>({ paso: "elegir", error: null });
  const ocupado = fase.paso === "simulando" || fase.paso === "aplicando";
  const alCerrar = useFocoDeRetorno(abierto, origen ? [`[data-retorno="menu-correo.${origen.campaign_id}"]`] : []);

  // Al abrir, todas las hermanas elegidas y las dos partes.
  useEffect(() => {
    if (!abierto) return;
    setElegidas(campanas.filter((c) => c.campaign_id !== origen?.campaign_id).map((c) => c.campaign_id));
    setCuerpo(true);
    setEnvios(true);
    setFase({ paso: "elegir", error: null });
    // Sólo al abrir o al cambiar de origen: la lista puede releerse mientras tanto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, origen?.campaign_id]);

  const partes: ParteHermana[] = [...(cuerpo ? ["cuerpo" as const] : []), ...(envios ? ["envios" as const] : [])];
  const puedeVer = Boolean(origen) && !sinGuardar && elegidas.length > 0 && partes.length > 0 && !ocupado;
  const alternar = (id: string) => setElegidas((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));

  const simular = async () => {
    if (!origen || !puedeVer) return;
    setFase({ paso: "simulando" });
    const out = await onAplicar(origen.campaign_id, elegidas, partes, true);
    setFase(out.ok ? { paso: "ver", hermanas: out.hermanas, variantes: out.variantesOrigen } : { paso: "elegir", error: out.mensaje });
  };

  const aplicar = async () => {
    if (!origen || fase.paso !== "ver") return;
    setFase({ ...fase, paso: "aplicando" });
    const out = await onAplicar(origen.campaign_id, elegidas, partes, false);
    if (!out.ok) setFase({ paso: "elegir", error: out.mensaje });
  };

  const vistas = fase.paso === "ver" || fase.paso === "aplicando" ? fase.hermanas : [];
  const conProblemas = vistas.filter((h) => h.problemas.length > 0);
  const conCambios = vistas.filter((h) => h.cambios.length || h.campos_agregados.length || h.datos_agregados.length);

  return (
    <Dialog.Root open={abierto} onOpenChange={(siguiente) => { if (!siguiente && !ocupado) onCerrar(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="rec-camp-velo" />
        <Dialog.Content
          className="rec-camp-dialogo rec-camp-dialogo--hermanas"
          {...panel.props}
          data-audit-ready="true"
          data-paso={fase.paso}
          aria-busy={ocupado}
          aria-describedby={`${ids}-desc`}
          onCloseAutoFocus={alCerrar}
        >
          <header className="rec-camp-dialogo-cabeza">
            <div>
              <Dialog.Title className="rec-camp-dialogo-titulo">Aplicar a las campañas hermanas</Dialog.Title>
              <Dialog.Description id={`${ids}-desc`} className="rec-camp-dialogo-desc">
                {origen
                  ? <>Lleva lo que <b>{rotuloDeCampana(origen)}</b> tiene guardado a las campañas que elijas. Cada una conserva su trato, su campo de enlace, el valor de sus datos y sus destinatarios.</>
                  : "Esa campaña ya no existe en el proyecto."}
              </Dialog.Description>
            </div>
          </header>
          <div className="rec-camp-dialogo-cuerpo">
            {sinGuardar ? (
              <p className="rec-camp-mensaje is-error" role="alert">El correo tiene cambios sin guardar. Guárdalo antes: se aplica lo guardado.</p>
            ) : null}
            {fase.paso === "elegir" || fase.paso === "simulando" ? (
              <>
                {hermanas.length ? (
                  <fieldset className="rec-hermanas-lista" disabled={ocupado}>
                    <legend className="xfk-over">Campañas</legend>
                    {hermanas.map((c) => (
                      <label key={c.campaign_id} className="rec-hermanas-fila">
                        <input type="checkbox" checked={elegidas.includes(c.campaign_id)} onChange={() => alternar(c.campaign_id)} />
                        <span>{rotuloDeCampana(c)}</span>
                      </label>
                    ))}
                  </fieldset>
                ) : (
                  <p className="rec-camp-mensaje is-info">El proyecto no tiene otras campañas de correo. Duplica esta para cada público.</p>
                )}
                <div className="rec-hermanas-partes">
                  <PulsoSwitch size="sm" checked={cuerpo} disabled={ocupado} onCheckedChange={setCuerpo}
                    label="El correo" description="Asunto, vista previa, estilo, cabecera, imágenes y bloques; el saludo queda de cada campaña" />
                  <PulsoSwitch size="sm" checked={envios} disabled={ocupado} onCheckedChange={setEnvios}
                    label="Los envíos" description="Rótulo, a quién va, asunto, vista previa y apertura; la fecha queda de cada campaña" />
                </div>
                {fase.paso === "elegir" && fase.error ? <p className="rec-camp-mensaje is-error" role="alert">{fase.error}</p> : null}
              </>
            ) : (
              <>
                {fase.variantes === 0 && conCambios.length ? (
                  <p className="rec-camp-mensaje is-info" role="status">
                    Este correo no tiene frases marcadas con <code className="xfk-mono">[[tú|usted]]</code>: su texto pasa tal cual.
                    Si una campaña tutea y esta no (o al revés), marca primero las frases que cambian, en Personas › Trato.
                  </p>
                ) : null}
                {conProblemas.length ? (
                  <p className="rec-camp-mensaje is-error" role="alert">
                    {conProblemas.length === 1 ? "Una campaña quedaría inválida" : `${formatoConteo(conProblemas.length)} campañas quedarían inválidas`}: corrígelo antes de aplicar.
                  </p>
                ) : null}
                <ul className="rec-hermanas-resumen" aria-label="Qué cambia en cada campaña">
                  {vistas.map((h) => (
                    <li key={h.campaign_id} className="rec-hermanas-resumen-fila">
                      <b>{h.name}</b>
                      <ul>
                        {frasesDeLaHermana(h).map((f) => <li key={f.texto} className={f.tono === "problema" ? "is-error" : f.tono === "conserva" ? "is-suave" : undefined}>{f.texto}</li>)}
                      </ul>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <div className="rec-camp-borrar-acciones">
            {fase.paso === "ver" ? (
              <PulsoButton variant="ghost" size="sm" onClick={() => setFase({ paso: "elegir", error: null })}>Atrás</PulsoButton>
            ) : null}
            <PulsoButton variant="secondary" size="sm" disabled={ocupado} onClick={onCerrar}>Cancelar</PulsoButton>
            {fase.paso === "elegir" || fase.paso === "simulando" ? (
              <PulsoButton variant="primary" size="sm" disabled={!puedeVer} onClick={() => void simular()}>
                {fase.paso === "simulando" ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : null} Ver qué cambia
              </PulsoButton>
            ) : (
              <PulsoButton variant="primary" size="sm" disabled={fase.paso === "aplicando" || conProblemas.length > 0 || !conCambios.length}
                onClick={() => void aplicar()}>
                {fase.paso === "aplicando" ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : null}
                {conCambios.length ? ` Aplicar a ${formatoConteo(conCambios.length)} ${conCambios.length === 1 ? "campaña" : "campañas"}` : " Ya están iguales"}
              </PulsoButton>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
