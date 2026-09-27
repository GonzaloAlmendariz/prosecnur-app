import { Copy, Download, ExternalLink } from "../../vendor/lucide-react";
import type { CollectionFichaPrueba } from "../../api/recopiladores";
import { copiarTexto } from "../../lib/portapapeles";

type Props = {
  fichas: CollectionFichaPrueba[];
  /** Regenera el PDF de esa ficha. Determinista: mismo código, mismo enlace. */
  onPdf: (codigo: string) => void;
  ocupado: boolean;
};

/**
 * Las fichas de prueba que ya se hicieron.
 *
 * Sin esto había que acordarse del código y regenerarla a ciegas para saber qué
 * enlace llevaba la hoja del taller. El histórico guarda **el enlace tal como se
 * generó**, no lo recalcula: una hoja impresa lleva el QR que llevaba, y si los
 * accesos cambian después, la ficha de la semana pasada sigue apuntando a donde
 * apuntaba — y se marca para que se vea.
 *
 * El PDF no se guarda: sería un binario dentro del `.pulso` (que el contrato
 * prohíbe) y regenerarlo es determinista, así que el botón lo rehace.
 */
export function FichasPruebaHistorico({ fichas, onPdf, ocupado }: Props) {
  if (!fichas.length) return null;
  return (
    <section className="rec-prueba-historico" aria-label="Fichas de prueba generadas">
      <h4>Fichas de prueba hechas</h4>
      <ul>
        {fichas.map((ficha) => (
          <li key={ficha.codigo} className={ficha.vigente ? undefined : "is-desfasada"}>
            <span className="rec-prueba-codigo">
              <code>{ficha.codigo}</code>
              {ficha.etiqueta !== ficha.codigo ? <em>{ficha.etiqueta}</em> : null}
              {/* Un enlace de un despliegue anterior sigue sirviendo para la hoja
                  que ya se repartió, pero NO es el que se genera hoy. Callarlo
                  sería enseñar un enlace muerto como si estuviera vigente. */}
              {ficha.vigente ? null : <small>de un despliegue anterior</small>}
            </span>
            <span className="rec-prueba-acciones">
              <a href={ficha.enlace} target="_blank" rel="noreferrer" title={ficha.enlace}>
                <ExternalLink size={14} aria-hidden /> Abrir
              </a>
              <button
                type="button"
                onClick={() => { void copiarTexto(ficha.enlace).catch(() => undefined); }}
                title="Copiar el enlace"
              >
                <Copy size={14} aria-hidden /> Copiar
              </button>
              <button
                type="button"
                onClick={() => onPdf(ficha.codigo)}
                disabled={ocupado}
                title="Volver a generar el PDF de esta ficha"
              >
                <Download size={14} aria-hidden /> PDF
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
