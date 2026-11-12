import { estiloConVariables } from "./estiloConVariables";
import type { Cifra } from "./explorarModelo";

/**
 * E5: las cifras de la pregunta en una tira, como el prototipo: el número y,
 * debajo, lo que cuenta. Declara su contrato geométrico (C1): miembros iguales
 * en ancho y alto, tantas columnas como cifras.
 */
export default function TiraCifras({ cifras }: { cifras: readonly Cifra[] }) {
  if (!cifras.length) return null;
  return (
    <section
      className="vx-tarjeta vx-tira"
      aria-label="Cifras de la pregunta"
      data-cifras={cifras.length}
      style={estiloConVariables({ "--vx-cifras": String(cifras.length) })}
      data-qa-geometry-group="validacion/explorar-kpis"
      data-qa-geometry-contract="equal"
    >
      {cifras.map((c, i) => (
        <div key={`${c.rotulo}-${i}`} className="vx-cifra" data-qa-geometry-member>
          <strong>{c.valor}</strong>
          <small>{c.rotulo}</small>
          {c.nota ? <small className="is-nota" title={c.nota}>{c.nota}</small> : null}
        </div>
      ))}
    </section>
  );
}
