// Línea de avance de un job de Mailchimp: el mensaje que publica el backend
// («Mailchimp: 1,500 de 45,078») y una barra si hay porcentaje.

import { Loader2 } from "../../../vendor/lucide-react";
import type { AvanceDeTrabajo } from "./mailchimpTrabajo";
import { textoDeAvance } from "./mailchimpPorApiModel";

type Props = { avance: AvanceDeTrabajo | null; rotulo: string };

export function MailchimpAvance({ avance, rotulo }: Props) {
  const pct = avance?.percent ?? null;
  return (
    <div className="rec-mc-avance" role="status" aria-live="polite">
      <span className="rec-sync-estado"><Loader2 size={14} className="pulso-spin" aria-hidden /> {textoDeAvance(avance, rotulo)}</span>
      {pct != null ? (
        <span className="rec-mc-barra" role="progressbar" aria-label={rotulo} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
          <span className="rec-mc-barra-relleno" style={{ width: `${pct}%` }} />
        </span>
      ) : null}
    </div>
  );
}
