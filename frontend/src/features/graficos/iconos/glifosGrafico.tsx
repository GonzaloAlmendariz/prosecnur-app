// Glifos de los tipos de gráfico (F6.2; dirección F6 §4.4 y §6 `GlifoGrafico`). Distintos de los íconos de 16–24 px
// (iconosGrafico.tsx): aquí el esqueleto de lo que el recetario dibuja tiene sitio para rótulos, cifras y leyenda, en un
// lienzo 16:10 de 160 × 100. Mismas reglas que el estándar (principio 4): la categoría mayor en el tono principal y las
// demás en el de apoyo; escalas de más intensa a menos; SIN INF en neutro al final; columna Top Two Box en verde; cifras
// «31%» sin espacio y en negrita. Los colores no viven aquí: cada pieza lleva una clase de tono que glifoGrafico.css
// resuelve con tokens `--pulso-*`.

type Tono = "p" | "a" | "e1" | "e2" | "e3" | "e4" | "n" | "v";
type DibujoGlifo = () => JSX.Element;

export const GLIFO = { w: 160, h: 100 } as const;

const r2 = (n: number): number => Math.round(n * 100) / 100;

function Barra({ x, y, w, h, t = "a", rx = 1.5 }: { x: number; y: number; w: number; h: number; t?: Tono; rx?: number }) {
  return <rect x={r2(x)} y={r2(y)} width={r2(w)} height={r2(h)} rx={rx} className={`pulso-glifo__${t}`} />;
}

/** Rótulo de categoría o de eje: un renglón tenue. */
function Rotulo({ x, y, w }: { x: number; y: number; w: number }) {
  return <rect x={r2(x)} y={r2(y)} width={r2(w)} height={3} rx={1.5} className="pulso-glifo__rotulo" />;
}

/** Cifra rotulada sobre o junto a la barra: un renglón más firme que el rótulo. */
function Valor({ x, y, w = 10, verde = false }: { x: number; y: number; w?: number; verde?: boolean }) {
  return <rect x={r2(x)} y={r2(y)} width={r2(w)} height={3.5} rx={1.75} className={`pulso-glifo__valor${verde ? " is-verde" : ""}`} />;
}

function Eje({ d }: { d: string }) {
  return <path d={d} className="pulso-glifo__eje" />;
}

function Trazo({ d, t = "a", ancho = 2 }: { d: string; t?: Tono; ancho?: number }) {
  return <path d={d} className={`pulso-glifo__trazo-${t}`} strokeWidth={ancho} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
}

function Punto({ cx, cy, r = 3.5, t = "a" }: { cx: number; cy: number; r?: number; t?: Tono }) {
  return <circle cx={r2(cx)} cy={r2(cy)} r={r} className={`pulso-glifo__${t}`} />;
}

function Cifra({ x, y, tam, texto, anclaje = "middle" }: { x: number; y: number; tam: number; texto: string; anclaje?: "start" | "middle" }) {
  return <text x={x} y={y} fontSize={tam} textAnchor={anclaje} className="pulso-glifo__cifra">{texto}</text>;
}

/** Leyenda: cuadros de color con su rótulo, en fila. */
function Leyenda({ x, y, tonos }: { x: number; y: number; tonos: readonly Tono[] }) {
  return (
    <>
      {tonos.map((t, i) => (
        <g key={t}>
          <Barra x={x + i * 26} y={y} w={5} h={5} t={t} rx={1} />
          <Rotulo x={x + i * 26 + 7} y={y + 1} w={14} />
        </g>
      ))}
    </>
  );
}

const polar = (cx: number, cy: number, r: number, frac: number): [number, number] => {
  const a = -Math.PI / 2 + frac * 2 * Math.PI;
  return [r2(cx + r * Math.cos(a)), r2(cy + r * Math.sin(a))];
};

/** Sector circular de `desde` a `hasta` (fracciones de vuelta, 0 arriba y en sentido horario). */
function sector(cx: number, cy: number, r: number, desde: number, hasta: number): string {
  const [x0, y0] = polar(cx, cy, r, desde);
  const [x1, y1] = polar(cx, cy, r, hasta);
  return `M${cx} ${cy}L${x0} ${y0}A${r} ${r} 0 ${hasta - desde > 0.5 ? 1 : 0} 1 ${x1} ${y1}Z`;
}

function arco(cx: number, cy: number, r: number, desde: number, hasta: number): string {
  const [x0, y0] = polar(cx, cy, r, desde);
  const [x1, y1] = polar(cx, cy, r, hasta);
  return `M${x0} ${y0}A${r} ${r} 0 ${hasta - desde > 0.5 ? 1 : 0} 1 ${x1} ${y1}`;
}

function poligono(cx: number, cy: number, r: number, k: readonly number[]): string {
  return k.map((f, i) => polar(cx, cy, r * f, i / k.length).join(",")).join(" ");
}

function Radar({ cx, cy, r, lados, series }: {
  cx: number; cy: number; r: number; lados: number; series: ReadonlyArray<{ k: readonly number[]; t: Tono }>;
}) {
  const uno = Array.from({ length: lados }, () => 1);
  return (
    <>
      <polygon points={poligono(cx, cy, r, uno)} className="pulso-glifo__rejilla" />
      <polygon points={poligono(cx, cy, r * 0.55, uno)} className="pulso-glifo__rejilla" />
      {series.map(({ k, t }) => (
        <polygon key={t} points={poligono(cx, cy, r, k)} className={`pulso-glifo__area-${t}`} />
      ))}
    </>
  );
}

const ESCALA: readonly Tono[] = ["e1", "e2", "e3", "e4", "n"];

const GLIFOS: Readonly<Record<string, DibujoGlifo>> = {
  // Columnas de mayor a menor con su cifra encima (recetario p68).
  p_barras_categoricas: () => {
    const altos = [62, 46, 34, 22, 12];
    return (
      <>
        {altos.map((h, i) => {
          const x = 20 + i * 27;
          return (
            <g key={x}>
              <Barra x={x} y={84 - h} w={18} h={h} t={i === 0 ? "p" : "a"} />
              <Valor x={x + 3} y={84 - h - 7} w={12} />
              <Rotulo x={x + 2} y={88} w={14} />
            </g>
          );
        })}
        <Eje d="M14 84H146" />
      </>
    );
  },
  // Ranking en barras horizontales, rótulo a la izquierda y cifra al final (p73).
  p_barras_agrupadas: () => {
    const largos = [96, 74, 58, 40, 24];
    return (
      <>
        {largos.map((w, i) => {
          const y = 14 + i * 15;
          return (
            <g key={y}>
              <Rotulo x={12} y={y + 3} w={22} />
              <Barra x={42} y={y} w={w} h={9} t={i === 0 ? "p" : "a"} />
              <Valor x={46 + w} y={y + 2.75} />
            </g>
          );
        })}
        <Eje d="M40 10V88" />
      </>
    );
  },
  // Ranking con puntos (p72).
  p_lollipop: () => {
    const fines = [136, 114, 98, 80, 64];
    return (
      <>
        {fines.map((x, i) => {
          const y = 18 + i * 15;
          return (
            <g key={y}>
              <Rotulo x={12} y={y - 1.5} w={22} />
              <Trazo d={`M42 ${y}H${x}`} ancho={1.5} />
              <Punto cx={x} cy={y} r={4} t={i === 0 ? "p" : "a"} />
            </g>
          );
        })}
        <Eje d="M40 10V88" />
      </>
    );
  },
  // Brecha entre dos públicos (p88).
  p_dumbbell: () => {
    const pares: ReadonlyArray<readonly [number, number]> = [[60, 128], [72, 118], [54, 100], [86, 136]];
    return (
      <>
        {pares.map(([a, b], i) => {
          const y = 20 + i * 18;
          return (
            <g key={y}>
              <Rotulo x={12} y={y - 1.5} w={24} />
              <Trazo d={`M${a} ${y}H${b}`} ancho={2.5} t="n" />
              <Punto cx={a} cy={y} r={4} t="a" />
              <Punto cx={b} cy={y} r={4} t="p" />
            </g>
          );
        })}
      </>
    );
  },
  // Escala por premisa, de la más intensa a SIN INF, con su columna Top Two Box (p78).
  p_barras_multiapiladas: () => {
    const filas = [[30, 24, 14, 10, 6], [22, 26, 20, 10, 6], [36, 20, 14, 8, 6], [18, 22, 24, 14, 6]];
    return (
      <>
        <rect x={129} y={10} width={20} height={80} rx={2} className="pulso-glifo__ttb" />
        {filas.map((seg, i) => {
          const y = 14 + i * 18;
          let x = 40;
          return (
            <g key={y}>
              <Rotulo x={12} y={y + 4} w={22} />
              {seg.map((w, j) => {
                const b = <Barra key={j} x={x} y={y} w={w - 0.8} h={11} t={ESCALA[j]} rx={0.5} />;
                x += w;
                return b;
              })}
              <Valor x={132} y={y + 3.75} w={14} verde />
            </g>
          );
        })}
      </>
    );
  },
  // Una escala en barras al 100 % con su leyenda debajo (p76–77).
  p_barras_apiladas: () => {
    const filas = [[44, 36, 26, 18, 8], [30, 40, 32, 22, 8]];
    return (
      <>
        {filas.map((seg, i) => {
          const y = 22 + i * 26;
          let x = 14;
          return (
            <g key={y}>
              {seg.map((w, j) => {
                const b = <Barra key={j} x={x} y={y} w={w - 0.8} h={16} t={ESCALA[j]} rx={0.5} />;
                x += w;
                return b;
              })}
            </g>
          );
        })}
        <Leyenda x={18} y={82} tonos={ESCALA} />
      </>
    );
  },
  // Divergentes: desacuerdo a la izquierda, acuerdo a la derecha del cero (p71).
  p_barras_divergentes: () => {
    const izq = [[10, 8], [16, 10], [8, 6], [20, 12], [12, 8]];
    const der = [[40, 14], [30, 16], [46, 12], [22, 14], [34, 16]];
    return (
      <>
        {izq.map(([a, b], i) => {
          const y = 14 + i * 15;
          const [c, d] = der[i];
          return (
            <g key={y}>
              <Barra x={80 - a - b} y={y} w={b - 0.8} h={10} t="e4" rx={0.5} />
              <Barra x={80 - a} y={y} w={a} h={10} t="e3" rx={0.5} />
              <Barra x={80} y={y} w={c - 0.8} h={10} t="e1" rx={0.5} />
              <Barra x={80 + c} y={y} w={d} h={10} t="e2" rx={0.5} />
            </g>
          );
        })}
        <Eje d="M80 9V91" />
      </>
    );
  },
  // Torta de dos o tres porciones con su leyenda (p69).
  p_pie: () => (
    <>
      <path d={sector(56, 50, 36, 0, 0.56)} className="pulso-glifo__p" />
      <path d={sector(56, 50, 36, 0.56, 0.86)} className="pulso-glifo__a" />
      <path d={sector(56, 50, 36, 0.86, 1)} className="pulso-glifo__n" />
      <Leyenda x={104} y={30} tonos={["p"]} />
      <Leyenda x={104} y={46} tonos={["a"]} />
      <Leyenda x={104} y={62} tonos={["n"]} />
    </>
  ),
  // Dona de dos porciones con la cifra al centro (p70).
  p_donut: () => (
    <>
      <circle cx={56} cy={50} r={30} className="pulso-glifo__trazo-a" strokeWidth={14} fill="none" />
      <path d={arco(56, 50, 30, 0, 0.64)} className="pulso-glifo__trazo-p" strokeWidth={14} fill="none" />
      <Cifra x={56} y={55} tam={14} texto="64%" />
      <Leyenda x={104} y={38} tonos={["p"]} />
      <Leyenda x={104} y={56} tonos={["a"]} />
    </>
  ),
  // Histograma: columnas contiguas, la moda en el principal (p81).
  p_histograma: () => {
    const altos = [12, 24, 40, 58, 66, 48, 30, 14];
    return (
      <>
        {altos.map((h, i) => (
          <Barra key={i} x={20 + i * 15} y={84 - h} w={14.2} h={h} t={i === 4 ? "p" : "a"} rx={0} />
        ))}
        <Eje d="M14 84H146" />
        {[20, 65, 110].map((x) => <Rotulo key={x} x={x} y={88} w={12} />)}
      </>
    );
  },
  // Indicador numérico: columnas de promedios con su valor encima (p82).
  p_numerico: () => {
    const altos = [52, 64, 40, 58];
    return (
      <>
        {altos.map((h, i) => {
          const x = 22 + i * 34;
          return (
            <g key={x}>
              <Barra x={x} y={84 - h} w={20} h={h} t={i === 1 ? "p" : "a"} />
              <Valor x={x + 3} y={84 - h - 7} w={14} />
              <Rotulo x={x + 3} y={88} w={14} />
            </g>
          );
        })}
        <Eje d="M14 84H146" />
      </>
    );
  },
  // Cajas: bigotes, cuartiles y mediana (p84).
  p_boxplot: () => {
    const cajas: ReadonlyArray<readonly [number, number, number, number, number]> = [
      [16, 30, 42, 56, 78], [12, 22, 34, 48, 70], [24, 38, 50, 62, 84],
    ];
    return (
      <>
        {cajas.map(([s, q1, m, q3, i], k) => {
          const x = 30 + k * 44;
          const t: Tono = k === 1 ? "p" : "a";
          return (
            <g key={x}>
              <Trazo d={`M${x + 10} ${s}V${q1}M${x + 10} ${q3}V${i}M${x + 4} ${s}H${x + 16}M${x + 4} ${i}H${x + 16}`} ancho={1.5} t="n" />
              <Barra x={x} y={q1} w={20} h={q3 - q1} t={t} />
              <path d={`M${x} ${m}H${x + 20}`} className="pulso-glifo__corte" />
              <Rotulo x={x + 3} y={90} w={14} />
            </g>
          );
        })}
      </>
    );
  },
  // Media y rango por grupo (p83).
  p_media_rango: () => {
    const filas: ReadonlyArray<readonly [number, number, number]> = [[52, 96, 132], [48, 82, 116], [64, 104, 140], [44, 70, 108]];
    return (
      <>
        {filas.map(([a, m, b], i) => {
          const y = 20 + i * 18;
          return (
            <g key={y}>
              <Rotulo x={12} y={y - 1.5} w={24} />
              <Trazo d={`M${a} ${y}H${b}`} ancho={3} t="a" />
              <Punto cx={m} cy={y} r={4.5} t="p" />
            </g>
          );
        })}
      </>
    );
  },
  // Puntos comparativos: tres públicos sobre la misma guía.
  p_puntos_comparativos: () => {
    const filas: ReadonlyArray<readonly [number, number, number]> = [[118, 92, 70], [104, 80, 128], [86, 112, 60], [130, 98, 76]];
    return (
      <>
        {filas.map(([p, a, n], i) => {
          const y = 18 + i * 18;
          return (
            <g key={y}>
              <Rotulo x={12} y={y - 1.5} w={24} />
              <Trazo d={`M44 ${y}H146`} ancho={1} t="n" />
              <Punto cx={n} cy={y} r={3.5} t="n" />
              <Punto cx={a} cy={y} r={3.5} t="a" />
              <Punto cx={p} cy={y} r={3.5} t="p" />
            </g>
          );
        })}
        <Leyenda x={44} y={88} tonos={["p", "a", "n"]} />
      </>
    );
  },
  // Serie: mediciones en el tiempo, la vigente en el principal (p91).
  p_serie_temporal: () => {
    const xs = [24, 52, 80, 108, 136];
    const p = [62, 54, 48, 36, 28];
    const a = [70, 68, 60, 58, 50];
    const linea = (ys: readonly number[]) => xs.map((x, i) => `${i ? "L" : "M"}${x} ${ys[i]}`).join("");
    return (
      <>
        {[30, 50, 70].map((y) => <path key={y} d={`M16 ${y}H146`} className="pulso-glifo__rejilla" />)}
        <Eje d="M16 84H146" />
        <Trazo d={linea(a)} t="a" ancho={2} />
        <Trazo d={linea(p)} t="p" ancho={2.5} />
        {xs.map((x, i) => (
          <g key={x}>
            <Punto cx={x} cy={a[i]} r={2.5} t="a" />
            <Punto cx={x} cy={p[i]} r={3} t="p" />
            <Rotulo x={x - 6} y={88} w={12} />
          </g>
        ))}
      </>
    );
  },
  // Radar con su tabla al lado (p94).
  p_radar: () => (
    <>
      <Radar cx={50} cy={52} r={34} lados={5} series={[{ k: [0.9, 0.62, 0.78, 0.5, 0.7], t: "p" }]} />
      <Barra x={98} y={18} w={48} h={9} t="p" rx={1} />
      {[32, 44, 56, 68, 80].map((y) => (
        <g key={y}>
          <Rotulo x={100} y={y} w={22} />
          <Valor x={132} y={y - 0.25} w={12} />
        </g>
      ))}
    </>
  ),
  // Radar por dimensiones: dos públicos (p95).
  p_dim_radar: () => (
    <Radar cx={80} cy={50} r={40} lados={6} series={[
      { k: [0.7, 0.55, 0.8, 0.6, 0.5, 0.65], t: "a" },
      { k: [0.92, 0.7, 0.62, 0.84, 0.72, 0.8], t: "p" },
    ]} />
  ),
  // Mapa de calor por dimensiones: más intenso cuanto mayor el valor (p96).
  p_dim_heatmap: () => {
    const valores = [[1, 2, 1, 3, 2], [2, 1, 3, 2, 4], [3, 2, 2, 1, 3], [4, 3, 4, 2, 1]];
    return (
      <>
        {valores.map((fila, i) => (
          <g key={i}>
            <Rotulo x={12} y={22 + i * 18} w={22} />
            {fila.map((v, j) => (
              <Barra key={j} x={40 + j * 21.6} y={16 + i * 18} w={20} h={16} t={(["e1", "e2", "e3", "e4"] as const)[v - 1]} rx={1} />
            ))}
          </g>
        ))}
        {[0, 1, 2, 3, 4].map((j) => <Rotulo key={j} x={44 + j * 21.6} y={9} w={12} />)}
      </>
    );
  },
  // Mapa de calor por criterios: criterios en filas y la columna del total aparte (p97).
  p_dim_heatmap_criterios: () => {
    const valores = [[1, 2, 3], [2, 2, 1], [3, 1, 2], [2, 3, 4], [4, 3, 3]];
    return (
      <>
        {valores.map((fila, i) => (
          <g key={i}>
            <Rotulo x={12} y={16 + i * 15} w={34} />
            {fila.map((v, j) => (
              <Barra key={j} x={54 + j * 24} y={11 + i * 15} w={22} h={13} t={(["e1", "e2", "e3", "e4"] as const)[v - 1]} rx={1} />
            ))}
            <Valor x={132} y={15.75 + i * 15} w={12} />
          </g>
        ))}
        <rect x={128} y={8} width={20} height={80} rx={2} className="pulso-glifo__marco-p" />
      </>
    );
  },
  // Comparativo: radar de dimensiones con sus barras al lado (p98).
  p_dim_comparativo_radarbar: () => (
    <>
      <Radar cx={40} cy={50} r={28} lados={5} series={[{ k: [0.6, 0.8, 0.5, 0.7, 0.66], t: "a" }, { k: [0.86, 0.66, 0.74, 0.9, 0.6], t: "p" }]} />
      {[0, 1, 2, 3].map((i) => {
        const y = 18 + i * 18;
        return (
          <g key={y}>
            <Barra x={84} y={y} w={[56, 44, 50, 38][i]} h={6} t="p" />
            <Barra x={84} y={y + 7} w={[46, 50, 36, 30][i]} h={6} t="a" />
          </g>
        );
      })}
    </>
  ),
  // FODA (retirado del selector; los planes que lo usan lo conservan): cuatro cuadrantes.
  p_dim_foda: () => (
    <>
      {([["p", 16, 12], ["a", 82, 12], ["e3", 16, 52], ["n", 82, 52]] as const).map(([t, x, y]) => (
        <g key={`${x}-${y}`}>
          <Barra x={x} y={y} w={62} h={36} t={t} rx={2} />
        </g>
      ))}
    </>
  ),
  // Nube de palabras: el tamaño es la frecuencia (p100).
  p_nube_palabras: () => (
    <>
      <Barra x={44} y={42} w={72} h={14} t="p" rx={3} />
      <Barra x={22} y={22} w={44} h={10} t="a" rx={3} />
      <Barra x={76} y={20} w={52} h={9} t="e2" rx={3} />
      <Barra x={18} y={64} w={36} h={8} t="e3" rx={3} />
      <Barra x={62} y={66} w={58} h={11} t="a" rx={3} />
      <Barra x={126} y={46} w={20} h={7} t="e3" rx={3} />
      <Barra x={24} y={46} w={14} h={6} t="n" rx={3} />
      <Barra x={98} y={84} w={30} h={6} t="n" rx={3} />
    </>
  ),
  // Cobertura territorial: el distrito con el marcador (p105).
  p_mapa_cobertura_territorial: () => (
    <>
      <path d="M38 22L66 10L104 16L124 40L116 74L80 90L46 82L30 54Z" className="pulso-glifo__territorio" />
      <path d="M80 72C70 60 64 51 64 44A16 16 0 0 1 96 44C96 51 90 60 80 72ZM74 44A6 6 0 1 0 86 44A6 6 0 1 0 74 44Z"
        className="pulso-glifo__p" fillRule="evenodd" />
    </>
  ),
  // Resultado por distrito: cada zona con la intensidad de su valor (p106).
  p_mapa_resultado_distrital: () => (
    <>
      <path d="M38 22L66 10L72 44L30 46Z" className="pulso-glifo__e3" />
      <path d="M66 10L104 16L112 40L72 44Z" className="pulso-glifo__p" />
      <path d="M30 46L72 44L68 86L46 82Z" className="pulso-glifo__e2" />
      <path d="M72 44L112 40L124 44L116 74L80 90L68 86Z" className="pulso-glifo__e4" />
      <path d="M38 22L66 10L104 16L124 44L116 74L80 90L46 82L30 46Z" className="pulso-glifo__contorno" />
      <Leyenda x={128} y={20} tonos={["p"]} />
      <Leyenda x={128} y={32} tonos={["e2"]} />
      <Leyenda x={128} y={44} tonos={["e4"]} />
    </>
  ),
  // Cifra destacada: el número manda y su rótulo lo explica (p17–18, 172–175).
  p_cifra: () => (
    <>
      <Cifra x={80} y={58} tam={36} texto="31%" />
      <Rotulo x={50} y={68} w={60} />
      <Rotulo x={60} y={74} w={40} />
    </>
  ),
  // Tabla editable: cabecera en el principal y filas con sus cifras (p197).
  p_tabla: () => (
    <>
      <rect x={16} y={12} width={128} height={76} rx={3} className="pulso-glifo__contorno" />
      <Barra x={16} y={12} w={128} h={13} t="p" rx={3} />
      {[25, 41, 57, 73].map((y) => <path key={y} d={`M16 ${y}H144`} className="pulso-glifo__rejilla" />)}
      <path d="M62 25V88" className="pulso-glifo__rejilla" />
      {[31, 47, 63, 79].map((y) => (
        <g key={y}>
          <Rotulo x={22} y={y} w={32} />
          <Valor x={72} y={y - 0.25} w={14} />
          <Valor x={100} y={y - 0.25} w={14} />
          <Valor x={124} y={y - 0.25} w={12} />
        </g>
      ))}
    </>
  ),
};

export const GLIFOS_GRAFICO = GLIFOS;

export function dibujoGlifo(tipo: string): DibujoGlifo | null {
  return GLIFOS[tipo] ?? null;
}
