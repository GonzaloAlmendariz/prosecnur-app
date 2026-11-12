/**
 * Los dos sentidos de un salto (prototipo `pp-v-dir`, `vistas.js:182`): "Le
 * correspondía y está vacía" y "No le correspondía y tiene respuesta", cada
 * uno con sus casos de la última auditoría. El del hallazgo abierto va
 * marcado; el otro, si tiene casos en la cola, abre su hallazgo.
 */
import { formatoConteo } from "../../../../lib/formatoNumero";
import type { SentidoDelSalto } from "../modeloHallazgos";

export function SentidosDelSalto({ sentidos, onAbrir, enCola }: {
  sentidos: readonly SentidoDelSalto[];
  onAbrir: (id: string) => void;
  /** Los hallazgos de la cola: el otro sentido solo se abre si está en ella. */
  enCola: ReadonlySet<string>;
}) {
  return (
    <ul className="pulso-hz-sentidos" aria-label="Sentidos del salto" data-qa-geometry-group="validacion/hallazgos-sentidos" data-qa-geometry-contract="equal">
      {sentidos.map((s) => {
        const cifra = s.n === null ? "Sin dato" : formatoConteo(s.n);
        const abrible = !s.actual && !!s.id && enCola.has(s.id);
        return (
          <li key={s.direccion} data-qa-geometry-member="">
            {abrible ? (
              <button type="button" className="pulso-hz-sentido" onClick={() => s.id && onAbrir(s.id)}>
                <b>{cifra}</b>
                <span>{s.rotulo}</span>
              </button>
            ) : (
              <div className="pulso-hz-sentido" aria-current={s.actual ? "true" : undefined}>
                <b>{cifra}</b>
                <span>{s.rotulo}</span>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
