export type VariableTitulo = { name: string; label?: string | null };

export const rotuloDe = (v: VariableTitulo) => v.label || v.name;

/** Texto plano del título, para el nombre accesible: «A × B». */
export function textoTituloCruce(x: VariableTitulo, y: VariableTitulo): string {
  return `${rotuloDe(x)} × ${rotuloDe(y)}`;
}

/**
 * D1 — el título de un cruce es el cruce: «rótulo de A × rótulo de B». Si los
 * dos rótulos coinciden (una pregunta y su recodificación), cada uno lleva su
 * nombre de variable para distinguirlos.
 */
export default function TituloCruce({ x, y }: { x: VariableTitulo; y: VariableTitulo }) {
  const iguales = rotuloDe(x) === rotuloDe(y);
  return (
    <>
      {rotuloDe(x)}
      {iguales && <span className="vx-titulo-nombre vx-mono">{x.name}</span>}
      {" × "}
      {rotuloDe(y)}
      {iguales && <span className="vx-titulo-nombre vx-mono">{y.name}</span>}
    </>
  );
}
