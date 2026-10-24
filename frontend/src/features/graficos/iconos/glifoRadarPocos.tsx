// Las dos formas con las que el motor reemplaza al radar cuando tiene pocos criterios (o se piden): líneas y puntos
// comparativos y barras comparativas. Cuatro filas, dos tonos (apoyo y principal). Sin cifras ni tabla: la maqueta
// informa la naturaleza (M1). Los colores los resuelve glifoGrafico.css por clase.

const FILAS = [[58, 118], [70, 104], [52, 96], [84, 128]] as const;
const Y0 = 22;
const PASO = 18;

const caja = (x: number, y: number, w: number, h: number) => ({ x, y, width: w, height: h });

export function PuntosComparativos(): JSX.Element {
  return (
    <>
      {FILAS.map(([a, b], i) => {
        const y = Y0 + i * PASO;
        return (
          <g key={y}>
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

export function BarrasComparativas(): JSX.Element {
  return (
    <>
      {FILAS.map(([a, b], i) => {
        const y = Y0 - 6 + i * PASO;
        return (
          <g key={y}>
            <rect {...caja(12, y + 4.5, 24, 3)} rx={1.5} className="pulso-glifo__rotulo" />
            <rect {...caja(40, y, a - 14, 6)} rx={1.5} className="pulso-glifo__a" />
            <rect {...caja(40, y + 7, b - 14, 6)} rx={1.5} className="pulso-glifo__p" />
          </g>
        );
      })}
    </>
  );
}
