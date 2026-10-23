// La tarjeta «Qué hace» / «Cómo sale en la plataforma» salió del inspector
// (ítem 2 de docs/qa/checklist-inspector-correo-2026-10-23.md): la persona no
// necesita leer el código de Mailchimp para escribir el correo. Queda aquí la
// revisión del bloque, que el inspector sigue mostrando.
import type { MailCheck } from "../../../api/materialMail";
import { AlertCircle, AlertTriangle } from "../../../vendor/lucide-react";
import { rotuloDeChequeo } from "./modeloCorreo";

/** Los chequeos de la revisión que nombran este bloque (`targets`). */
export function ChequeosDelBloque({ chequeos, detalleDe }: {
  chequeos: readonly MailCheck[];
  /** Un detalle propio de la vista que reemplaza al del backend; `null` deja el suyo. */
  detalleDe?: (check: MailCheck) => string | null;
}) {
  if (!chequeos.length) return null;
  return (
    <ul className="rec-capa-chequeos" aria-label="Revisión de este bloque">
      {chequeos.map((c) => (
        <li key={c.code} className={`rec-capa-chequeo is-${c.status}`}>
          {c.status === "error" ? <AlertCircle size={14} aria-hidden /> : <AlertTriangle size={14} aria-hidden />}
          <span>
            <b>{rotuloDeChequeo(c)}</b>
            {(detalleDe?.(c) ?? c.detail) ? <span>{detalleDe?.(c) ?? c.detail}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
