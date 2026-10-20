// Selector de campaña en la barra del correo (E1h, §6 del contrato):
// «Campaña: Recuperación estudiantes · Estudiantes ▾».
//
// Elegir una campaña escribe el `foco`; el editor la carga desde ahí. Si la
// campaña abierta tiene cambios sin guardar, el menú lo dice antes de cambiar:
// la plantilla y su historial son de cada campaña y no viajan a la otra.

import * as Popover from "@radix-ui/react-popover";
import { useState } from "react";

import type { MailCampaignSummary } from "../../../api/materialMail";
import { PulsoButton } from "../../../components/PulsoButton";
import { Check, ChevronDown, Layers, Users } from "../../../vendor/lucide-react";
import { rotuloDeCampana } from "./modeloCampanas";

type Props = {
  campanas: readonly MailCampaignSummary[];
  activa: MailCampaignSummary | null;
  /** La campaña abierta tiene algo sin guardar que se perdería al cambiar. */
  conCambios: boolean;
  onElegir: (campaignId: string) => void;
  onGestionar: () => void;
};

export function SelectorDeCampana({ campanas, activa, conCambios, onElegir, onGestionar }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [pendiente, setPendiente] = useState<MailCampaignSummary | null>(null);

  const cambiarA = (c: MailCampaignSummary) => {
    if (c.campaign_id === activa?.campaign_id) {
      setAbierto(false);
      return;
    }
    if (conCambios) {
      setPendiente(c);
      return;
    }
    setAbierto(false);
    onElegir(c.campaign_id);
  };

  return (
    <Popover.Root
      open={abierto}
      onOpenChange={(siguiente) => {
        setAbierto(siguiente);
        if (!siguiente) setPendiente(null);
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          className="rec-camp-selector"
          aria-label={activa ? `Campaña: ${rotuloDeCampana(activa)}. Cambiar de campaña` : "Elegir campaña"}
        >
          <span className="rec-camp-selector-rotulo">Campaña:</span>
          <b className="rec-camp-selector-nombre">{activa?.name ?? "Sin campaña"}</b>
          {activa?.actor ? <span className="rec-camp-selector-actor">· {activa.actor}</span> : null}
          <ChevronDown size={14} aria-hidden className="rec-camp-selector-flecha" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="rec-camp-menu"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          aria-label="Campañas de correo"
        >
          {pendiente ? (
            <div className="rec-camp-menu-confirmar" role="alert">
              <p>
                <b>{activa?.name ?? "La campaña abierta"}</b> tiene cambios sin guardar. Si abres
                {" "}<b>{pendiente.name}</b>, esos cambios se descartan.
              </p>
              <span className="rec-camp-menu-confirmar-acciones">
                <PulsoButton variant="secondary" size="sm" onClick={() => setPendiente(null)} autoFocus>
                  Seguir aquí
                </PulsoButton>
                <PulsoButton
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    const destino = pendiente;
                    setPendiente(null);
                    setAbierto(false);
                    onElegir(destino.campaign_id);
                  }}
                >
                  Descartar y abrir
                </PulsoButton>
              </span>
            </div>
          ) : (
            <>
              <ul className="rec-camp-menu-lista">
                {campanas.map((c) => {
                  const actual = c.campaign_id === activa?.campaign_id;
                  return (
                    <li key={c.campaign_id}>
                      <button
                        type="button"
                        className={`rec-camp-menu-item${actual ? " is-active" : ""}`}
                        aria-current={actual ? "true" : undefined}
                        onClick={() => cambiarA(c)}
                      >
                        <span className="rec-camp-menu-marca" aria-hidden>{actual ? <Check size={14} /> : null}</span>
                        <span className="rec-camp-menu-textos">
                          <b>{c.name}</b>
                          <span>
                            {c.actor ? <span className="rec-camp-menu-actor"><Users size={11} aria-hidden /> {c.actor}</span> : null}
                            {c.subject ? <span className="rec-camp-menu-asunto" title={c.subject}>{c.subject}</span> : null}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="rec-camp-menu-pie">
                <button
                  type="button"
                  className="rec-camp-menu-gestionar"
                  onClick={() => {
                    setAbierto(false);
                    onGestionar();
                  }}
                >
                  <Layers size={14} aria-hidden /> Gestionar campañas…
                </button>
              </div>
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
