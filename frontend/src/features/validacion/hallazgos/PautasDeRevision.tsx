/**
 * Las pautas de revisión del hallazgo abierto (ítem 27): qué mirar en los
 * casos antes de decidir, bajo la frase de la regla y antes de la evidencia.
 * Los textos salen de `pautasDelHallazgo.ts`; la situación de cada decisión va
 * en su opción, en la columna Decisión.
 */
import { ClipboardCheck } from "../../../vendor/lucide-react";

export function PautasDeRevision({ pautas }: { pautas: readonly string[] }) {
  if (!pautas.length) return null;
  return (
    <section
      className="pulso-hz-pautas"
      aria-labelledby="pulso-hz-pautas-titulo"
      data-qa-geometry-group="validacion/hallazgos-pautas"
      data-qa-geometry-contract="intrinsic"
    >
      <h4 id="pulso-hz-pautas-titulo">
        <ClipboardCheck size={14} aria-hidden="true" />
        Pautas de revisión
      </h4>
      <ol className="pulso-hz-pautas-lista">
        {pautas.map((p) => <li key={p}>{p}</li>)}
      </ol>
    </section>
  );
}
