import type { Cifra } from "./explorarModelo";

/**
 * E5 — cuatro cifras clave en una tira, en lugar de las tarjetas KPI. Declara
 * su contrato geométrico (C1): miembros iguales en ancho y alto.
 */
export default function TiraCifras({ cifras }: { cifras: readonly Cifra[] }) {
  if (!cifras.length) return null;
  return (
    <section
      className="vx-tarjeta vx-tira"
      aria-label="Cifras clave"
      data-qa-geometry-group="validacion/explorar-kpis"
      data-qa-geometry-contract="equal"
    >
      {cifras.map((c, i) => (
        <div key={`${c.rotulo}-${i}`} className="vx-cifra" data-qa-geometry-member>
          <span className="vx-eyebrow">{c.rotulo}</span>
          <strong>{c.valor}</strong>
          <small title={c.nota}>{c.nota}</small>
        </div>
      ))}
    </section>
  );
}
