import type { MailField, MailRecipientView } from "../../../api/materialMail";
import { Link2 } from "../../../vendor/lucide-react";
import { enlaceParaLaPersona } from "./modeloCorreo";
import "./correosIdentidad.css";

type Props = {
  url: string;
  persona: MailRecipientView | null;
  campos: readonly MailField[];
};

/** Bajo el botón: el enlace que recibe la persona que se está mirando, sin su correo. */
export function EnlaceDeLaPersona({ url, persona, campos }: Props) {
  if (!url.trim()) return null;
  const enlace = enlaceParaLaPersona(url, persona, campos);
  return (
    <p className="rec-mail-enlace-persona" title={enlace.completo}>
      <Link2 size={13} aria-hidden />
      <span>
        {enlace.personal ? "Enlace personal" : "Enlace común"}
        {enlace.personal && persona?.nombre ? <> de <b>{persona.nombre}</b></> : null}
        {": "}
        <span className="rec-mail-enlace-persona-url xfk-mono">
          {enlace.tramos.map((t, i) => (
            <span key={i} className={t.campo ? "is-campo" : undefined}>{t.texto}</span>
          ))}
        </span>
      </span>
    </p>
  );
}
