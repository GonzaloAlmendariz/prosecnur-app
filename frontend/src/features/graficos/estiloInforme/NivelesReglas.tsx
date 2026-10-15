// Quién manda en las reglas del informe (R1 del rediseño, 2026-10-15): la regla general del informe, la de un tipo de
// gráfico y la de un gráfico desde su tarjeta en Láminas. Manda la más específica; cada regla dice debajo qué tipos y
// qué gráficos tienen la suya.

const NIVELES = [
  { titulo: "Informe", texto: "La regla general, para todo el informe" },
  { titulo: "Tipo de gráfico", texto: "Las multiapiladas, las tortas…" },
  { titulo: "Un gráfico", texto: "Desde su tarjeta en Láminas" },
] as const;

export function NivelesReglas() {
  return (
    <div className="pulso-f6-niveles" role="note" aria-label="Quién manda en las reglas" data-qa-geometry-member>
      <ol className="pulso-f6-niveles-lista">
        {NIVELES.map((n, i) => (
          <li key={n.titulo} className="pulso-f6-nivel">
            {i > 0 ? <span className="pulso-f6-nivel-flecha" aria-hidden="true">›</span> : null}
            <span className="pulso-f6-nivel-texto"><b>{n.titulo}</b><small>{n.texto}</small></span>
          </li>
        ))}
      </ol>
      <p className="pulso-f6-niveles-nota">Manda la más específica. Cada regla muestra debajo qué tipos y qué gráficos tienen la suya.</p>
    </div>
  );
}
