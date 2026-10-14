// F5 de checklist-poblacion-y-filtro-2026-10-14: la maqueta dibuja la llave del recetario (p192–p194) entre los dos gráficos
// de una lámina con dependencia, como la lámina exportada: sale del gráfico del que depende y llega al dependiente.

type Rect = { x: number; y: number; w: number; h: number };

/** El trazo de la llave en fracciones de la lámina: al costado si los gráficos van lado a lado; abajo si uno va sobre otro. */
export function trazoLlave(de: Rect, a: Rect): string {
  if (a.x >= de.x + de.w - 0.001) {
    const xm = (de.x + de.w + a.x) / 2;
    const x0 = xm - 0.012; const y0 = de.y + de.h * 0.3; const y1 = de.y + de.h * 0.7; const ym = (y0 + y1) / 2;
    return `M ${x0} ${y0} H ${xm} V ${y1} H ${x0} M ${xm} ${ym} H ${xm + 0.012} V ${a.y + 0.02} H ${a.x}`;
  }
  const ym = (de.y + de.h + a.y) / 2;
  const x0 = de.x + de.w * 0.1; const x1 = de.x + de.w * 0.6; const xm = (x0 + x1) / 2;
  return `M ${x0} ${ym - 0.015} V ${ym} H ${x1} V ${ym - 0.015} M ${xm} ${ym} V ${a.y + 0.02} H ${a.x}`;
}

export function LlaveDependencia({ de, a }: { de: Rect; a: Rect }) {
  return (
    <svg className="pulso-f6-maqueta-llave" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true" data-qa="maqueta-llave">
      <path d={trazoLlave(de, a)} fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
