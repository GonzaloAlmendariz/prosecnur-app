// Las dos formas con las que el motor reemplaza al radar cuando tiene pocos criterios (o se piden): líneas y puntos
// comparativos y barras comparativas. Una fila por criterio (3 a 8), dos tonos (apoyo y principal). Sin cifras: la maqueta
// informa la naturaleza (M1). Los colores los resuelve glifoGrafico.css por clase. `filaY` es el único dueño de la
// separación entre filas: la mini-tabla del glifo la usa para alinear cada fila con la de su línea o barra.

const BASE = [[58, 118], [70, 104], [52, 96], [84, 128]] as const;
const r2 = (n: number): number => Math.round(n * 100) / 100;

/** Filas del dibujo: los criterios, entre 3 y 8 (sin criterios aún, cuatro como en el catálogo). */
export const filasDe = (criterios?: number): number => (criterios && criterios > 0 ? Math.min(8, Math.max(3, criterios)) : 4);
/** Centro vertical de la fila `i` de `n` en el lienzo de 100. */
export const filaY = (n: number, i: number): number => r2(16 + (68 / n) * (i + 0.5));

/** Extremos de la fila `i`; con tabla al costado el dibujo se acorta, sin escalarlo (los círculos siguen redondos). */
function extremos(i: number, conTabla: boolean): readonly [number, number] {
  const [a, b] = BASE[i % BASE.length];
  const k = conTabla ? 0.5 : 1;
  return [r2(40 + (a - 40) * k), r2(40 + (b - 40) * k)];
}

const caja = (x: number, y: number, w: number, h: number) => ({ x, y: r2(y), width: w, height: h });
type Props = { criterios?: number; conTabla?: boolean };

export function PuntosComparativos({ criterios, conTabla = false }: Props): JSX.Element {
  const n = filasDe(criterios);
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const y = filaY(n, i);
        const [a, b] = extremos(i, conTabla);
        return (
          <g key={i}>
            <rect {...caja(12, y - 1.5, 24, 3)} rx={1.5} className="pulso-glifo__rotulo" />
            <path d={`M${a} ${y}H${b}`} className="pulso-glifo__trazo-n" strokeWidth={2.5} fill="none" strokeLinecap="round" />
            <circle cx={a} cy={y} r={4} className="pulso-glifo__a" />
            <circle cx={b} cy={y} r={4} className="pulso-glifo__p" />
          </g>
        );
      })}
    </>
  );
}

export function BarrasComparativas({ criterios, conTabla = false }: Props): JSX.Element {
  const n = filasDe(criterios);
  const h = Math.min(6, (68 / n) * 0.36);
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const y = filaY(n, i);
        const [a, b] = extremos(i, conTabla);
        return (
          <g key={i} data-fila-grafico={y}>
            <rect {...caja(12, y - 1.5, 24, 3)} rx={1.5} className="pulso-glifo__rotulo" />
            <rect {...caja(40, y - h - 0.5, Math.max(2, a - 14), h)} rx={1.5} className="pulso-glifo__a" />
            <rect {...caja(40, y + 0.5, Math.max(2, b - 14), h)} rx={1.5} className="pulso-glifo__p" />
          </g>
        );
      })}
    </>
  );
}
