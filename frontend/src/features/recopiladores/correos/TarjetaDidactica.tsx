import type { MailBlock, MailCheck, MailTemplate } from "../../../api/materialMail";
import { AlertCircle, AlertTriangle, Lightbulb } from "../../../vendor/lucide-react";
import { CUANDO_USARLO } from "./BibliotecaDeBloques";
import { comoSaleEnLaPlataforma, type Dialecto } from "./comoSaleEnLaPlataforma";
import { rotuloDeChequeo } from "./modeloCorreo";

type Props = {
  block: MailBlock;
  template: MailTemplate;
  dialecto: Dialecto;
};

/**
 * Modo didáctico del inspector (E1g §3): qué hace el bloque y qué etiquetas
 * produce en la plataforma de envío. Es explicación: el HTML real lo escribe
 * el render.
 */
export function TarjetaDidactica({ block, template, dialecto }: Props) {
  const sale = comoSaleEnLaPlataforma(block, template, dialecto);
  const cuando = block.type in CUANDO_USARLO ? CUANDO_USARLO[block.type as keyof typeof CUANDO_USARLO] : null;
  return (
    <section className="rec-capa-didactica" aria-label="Explicación del bloque">
      <div className="rec-capa-didactica-que">
        <span className="rec-capa-didactica-titulo"><Lightbulb size={13} aria-hidden /> Qué hace</span>
        <p>{cuando ?? "Se conserva tal cual al guardar."}</p>
      </div>
      {sale.lineas.length ? (
        <div className="rec-capa-didactica-sale">
          <span className="rec-capa-didactica-titulo">Cómo sale en {sale.plataforma}</span>
          <dl>
            {sale.lineas.map((l, i) => (
              <div key={`${l.rotulo}-${i}`} className="rec-capa-didactica-linea">
                <dt>{l.rotulo}</dt>
                <dd><code>{l.plataforma || "(vacío)"}</code></dd>
              </div>
            ))}
          </dl>
          {sale.notas.length ? (
            <ul className="rec-capa-didactica-notas">
              {sale.notas.map((n) => <li key={n}>{n}</li>)}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

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
