// La mini barra de la métrica de una candidata, en la escala del reparto, con la marca del corte (dos en extremos).
// Decorativa: la cifra va escrita al lado de la fila.

type Props = { metrica: number | null; escala: number; cortes: readonly number[]; entra: boolean };

const fraccion = (v: number, escala: number) => (escala > 0 ? Math.min(1, Math.max(0, v / escala)) : 0);

export function MiniBarraMetrica({ metrica, escala, cortes, entra }: Props) {
  return (
    <span className={`pulso-f6-regla-minibarra${entra ? " is-entra" : ""}`} aria-hidden="true">
      {metrica !== null && <span className="pulso-f6-regla-minibarra-relleno" style={{ width: `${(fraccion(metrica, escala) * 100).toFixed(2)}%` }} />}
      {cortes.map((c, i) => (
        <span key={i} className="pulso-f6-regla-minibarra-corte" style={{ left: `${(fraccion(c, escala) * 100).toFixed(2)}%` }} />
      ))}
    </span>
  );
}
