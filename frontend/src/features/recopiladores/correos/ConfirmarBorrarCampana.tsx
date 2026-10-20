// Borrar una campaña de correo, en dos pasos (E1h, §6 del contrato).
//
// Paso 1 dice qué se pierde: la plantilla de esa campaña y la lista de
// destinatarios importada en esta sesión. Paso 2 pide escribir el nombre
// exacto; lo escrito viaja como `confirm_name` y el backend lo vuelve a
// comparar. Es la confirmación doble del patrón de `ConfirmarResembrado`.
//
// Panel direccionable `?panel=correo-campana-borrar` (clase «dialogo»). Diálogo
// de alerta (Radix): el foco entra en «Cancelar», la opción segura; Escape y el
// velo cancelan mientras no se esté borrando.

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useId, useReducer, useRef } from "react";

import type { MailCampaignSummary } from "../../../api/materialMail";
import { PulsoButton } from "../../../components/PulsoButton";
import type { ControlPanel } from "../../../lib/navegacion/paneles";
import { Loader2, Trash2 } from "../../../vendor/lucide-react";
import { useFocoDeRetorno } from "../campanas/focoDeRetorno";
import { BORRADO_INICIAL, nombreConfirmado, reducirBorrado, rotuloDeCampana } from "./modeloCampanas";
import type { ResultadoDelBorrado } from "./useCampanas";

type Props = {
  panel: ControlPanel;
  /** La campaña a borrar; `null` si ya no existe. */
  campana: MailCampaignSummary | null;
  /** Borra y, si sale bien, el editor elige qué campaña mirar y cierra el panel. */
  onBorrar: (campaignId: string, confirmName: string) => Promise<ResultadoDelBorrado>;
  onCancelar: () => void;
};

export function ConfirmarBorrarCampana({ panel, campana, onBorrar, onCancelar }: Props) {
  const ids = useId();
  const [fase, dispatch] = useReducer(reducirBorrado, BORRADO_INICIAL);
  const cancelarRef = useRef<HTMLButtonElement>(null);
  const campoRef = useRef<HTMLInputElement>(null);
  const borrando = fase.paso === "borrando";
  const { abierto } = panel;
  // Tras cancelar, el foco vuelve al «⋯» de la campaña (el ítem del menú ya no existe).
  const alCerrar = useFocoDeRetorno(abierto, campana ? [`[data-retorno="menu-correo.${campana.campaign_id}"]`] : []);

  useEffect(() => {
    if (!abierto) dispatch({ type: "reiniciar" });
  }, [abierto]);

  useEffect(() => {
    if (fase.paso === "nombre") campoRef.current?.focus({ preventScroll: true });
  }, [fase.paso]);

  const confirmar = async () => {
    if (!campana || !nombreConfirmado(fase, campana.name)) return;
    const escrito = fase.paso === "nombre" ? fase.escrito : "";
    dispatch({ type: "enviar" });
    const out = await onBorrar(campana.campaign_id, escrito);
    if (!out.ok) dispatch({ type: "fallo", mensaje: out.mensaje });
  };

  return (
    <Dialog.Root open={abierto} onOpenChange={(siguiente) => { if (!siguiente && !borrando) onCancelar(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="rec-camp-velo" />
        <Dialog.Content
          role="alertdialog"
          className="rec-camp-dialogo rec-camp-dialogo--borrar"
          {...panel.props}
          // Se monta sólo con la lista de campañas leída (o fallida): ya está listo.
          data-audit-ready="true"
          data-paso={fase.paso}
          aria-busy={borrando}
          aria-describedby={`${ids}-desc`}
          onOpenAutoFocus={(e) => { e.preventDefault(); cancelarRef.current?.focus({ preventScroll: true }); }}
          onCloseAutoFocus={alCerrar}
        >
          <header className="rec-camp-dialogo-cabeza">
            <Dialog.Title className="rec-camp-dialogo-titulo">
              {campana ? `Borrar «${campana.name}»` : "Borrar campaña"}
            </Dialog.Title>
          </header>
          <div className="rec-camp-dialogo-cuerpo rec-camp-borrar-cuerpo">
            {!campana ? (
              <Dialog.Description id={`${ids}-desc`} className="rec-camp-mensaje is-info">
                Esa campaña ya no existe en el proyecto.
              </Dialog.Description>
            ) : fase.paso === "aviso" ? (
              <>
                <Dialog.Description id={`${ids}-desc`} className="rec-camp-borrar-texto">
                  Se borra la campaña <b>{rotuloDeCampana(campana)}</b> con su plantilla. No se puede deshacer.
                </Dialog.Description>
                <section className="rec-camp-borrar-bloque" aria-label="Qué se pierde">
                  <ul>
                    <li>La plantilla del correo y todo lo que se editó en ella.</li>
                    <li>
                      {campana.recipients_loaded
                        ? "La lista de destinatarios importada en esta sesión para esta campaña."
                        : "Esta campaña no tiene destinatarios importados en esta sesión."}
                    </li>
                    <li>Los paquetes ya descargados o guardados junto al proyecto no se tocan.</li>
                  </ul>
                </section>
              </>
            ) : (
              <>
                <Dialog.Description id={`${ids}-desc`} className="rec-camp-borrar-texto">
                  Para confirmar, escribe el nombre de la campaña tal como aparece: <b>{campana.name}</b>
                </Dialog.Description>
                <label className="rec-camp-campo">
                  <span>Nombre de la campaña</span>
                  <input
                    ref={campoRef}
                    value={fase.escrito}
                    disabled={borrando}
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={fase.paso === "nombre" && fase.error ? true : undefined}
                    onChange={(e) => dispatch({ type: "escribir", texto: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void confirmar(); } }}
                  />
                </label>
                {fase.paso === "nombre" && fase.error ? (
                  <p className="rec-camp-mensaje is-error" role="alert">{fase.error}</p>
                ) : null}
              </>
            )}
          </div>
          <div className="rec-camp-borrar-acciones">
            {fase.paso === "nombre" ? (
              <PulsoButton variant="ghost" size="sm" onClick={() => dispatch({ type: "volver" })} disabled={borrando}>
                Atrás
              </PulsoButton>
            ) : null}
            <PulsoButton ref={cancelarRef} variant="secondary" size="sm" disabled={borrando} onClick={onCancelar}>
              Cancelar
            </PulsoButton>
            {campana && fase.paso === "aviso" ? (
              <PulsoButton variant="danger" size="sm" onClick={() => dispatch({ type: "continuar" })}>
                <Trash2 size={14} aria-hidden /> Borrar…
              </PulsoButton>
            ) : null}
            {campana && fase.paso !== "aviso" ? (
              <PulsoButton
                variant="danger"
                size="sm"
                disabled={borrando || !nombreConfirmado(fase, campana.name)}
                onClick={() => { void confirmar(); }}
              >
                {borrando ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : <Trash2 size={14} aria-hidden />}
                {borrando ? "Borrando…" : "Borrar campaña"}
              </PulsoButton>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
