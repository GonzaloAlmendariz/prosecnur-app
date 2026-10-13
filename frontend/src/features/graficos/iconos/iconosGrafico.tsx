// Íconos de los tipos de gráfico (F6.1b). Sin marco: el esqueleto de lo que el RECETARIO dibuja, no el nombre del
// graficador (barras categóricas = columnas, p68; barras agrupadas = ranking en barras horizontales, p73; indicador
// numérico = columnas de promedios con su valor, p82). La categoría mayor va en el acento.
// Fuente: docs/qa/inventario-iconos-recetario-2026-10-10.md §B y §C.

import { TONO } from "./geometriaLamina";
import { Acento, Bloque, Circulo, Trazo } from "./rasgosLamina";

type DibujoGrafico = () => JSX.Element;

/** Preset del recetario sin graficador propio: multi-apiladas con una pregunta de dos categorías (p76). */
export const PRESET_DICOTOMICA = "dicotomica";

const EJE_IZQ = "M3.75 3.75V20.25";
const BASE = "M3 20.25H21";

const pentagono = (cx: number, cy: number, r: number, k: readonly number[] = [1, 1, 1, 1, 1]): string =>
  [0, 1, 2, 3, 4].map((i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const f = k[i] ?? 1;
    return `${Math.round((cx + r * f * Math.cos(a)) * 1000) / 1000},${Math.round((cy + r * f * Math.sin(a)) * 1000) / 1000}`;
  }).join(" ");

const ICONOS: Readonly<Record<string, DibujoGrafico>> = {
  // Barras categóricas (p68): columnas, de mayor a menor.
  p_barras_categoricas: () => (
    <>
      <Trazo d={BASE} />
      <Acento><Bloque x={4.5} y={4.5} w={3.75} h={15} tono="pleno" /></Acento>
      <Bloque x={10.125} y={9} w={3.75} h={10.5} />
      <Bloque x={15.75} y={13.5} w={3.75} h={6} />
    </>
  ),
  // Dicotómica (p76): una barra partida en dos, la mayor en acento.
  p_dicotomica: () => (
    <>
      <Acento><Bloque x={3} y={9} w={12} h={6} tono="pleno" /></Acento>
      <Bloque x={15.5} y={9} w={5.5} h={6} />
    </>
  ),
  // Ranking en barras (p73): barras horizontales ordenadas.
  p_barras_agrupadas: () => (
    <>
      <Trazo d={EJE_IZQ} />
      <Acento><Bloque x={6} y={4.5} w={15} h={3.75} tono="pleno" /></Acento>
      <Bloque x={6} y={10.125} w={10.5} h={3.75} />
      <Bloque x={6} y={15.75} w={6} h={3.75} />
    </>
  ),
  // Ranking con puntos (p72).
  p_lollipop: () => (
    <>
      <Trazo d={`${EJE_IZQ}M3.75 6H17.25M3.75 12H13.5M3.75 18H9.75`} />
      <Acento><Circulo cx={17.25} cy={6} r={2.25} /></Acento>
      <Circulo cx={13.5} cy={12} r={2.25} tono="apoyo" />
      <Circulo cx={9.75} cy={18} r={2.25} tono="apoyo" />
    </>
  ),
  // Brecha entre dos públicos (p88).
  p_dumbbell: () => (
    <>
      <Trazo d="M4.5 5.25H17.25M9 12H19.5M6.75 18.75H13.5" />
      <Circulo cx={4.5} cy={5.25} r={1.875} tono="apoyo" />
      <Circulo cx={9} cy={12} r={1.875} tono="apoyo" />
      <Circulo cx={6.75} cy={18.75} r={1.875} tono="apoyo" />
      <Acento>
        <Circulo cx={17.25} cy={5.25} r={2.25} />
        <Circulo cx={19.5} cy={12} r={2.25} />
        <Circulo cx={13.5} cy={18.75} r={2.25} />
      </Acento>
    </>
  ),
  // Escala con Top Two Box (p78): filas de segmentos; el primero de cada fila en acento.
  p_barras_multiapiladas: () => {
    const filas: ReadonlyArray<readonly [number, number, number]> = [[4.5, 8.25, 4.5], [10.125, 5.25, 6.75], [15.75, 9, 3.75]];
    return (
      <>
        <Acento>{filas.map(([y, a]) => <Bloque key={y} x={3} y={y} w={a} h={3.75} tono="pleno" />)}</Acento>
        {filas.map(([y, a, b]) => (
          <g key={y}>
            <Bloque x={4.5 + a} y={y} w={b} h={3.75} />
            <Bloque x={6 + a + b} y={y} w={15 - a - b} h={3.75} tono="apoyo" />
          </g>
        ))}
      </>
    );
  },
  // Dicotómica (p76): una barra partida en dos.
  [PRESET_DICOTOMICA]: () => (
    <>
      <Acento><Bloque x={3} y={7.5} w={11.25} h={9} tono="pleno" /></Acento>
      <Bloque x={15.75} y={7.5} w={5.25} h={9} />
    </>
  ),
  // Barras divergentes (p71).
  p_barras_divergentes: () => (
    <>
      <Bloque x={4.5} y={4.5} w={6.75} h={3.75} />
      <Bloque x={8.25} y={10.125} w={3} h={3.75} />
      <Bloque x={6.75} y={15.75} w={4.5} h={3.75} />
      <Acento>
        <Bloque x={12.75} y={4.5} w={3.75} h={3.75} tono="pleno" />
        <Bloque x={12.75} y={10.125} w={7.5} h={3.75} tono="pleno" />
        <Bloque x={12.75} y={15.75} w={5.25} h={3.75} tono="pleno" />
      </Acento>
      <Trazo d="M12 3V21" tono="pleno" />
    </>
  ),
  // Torta (p69).
  p_pie: () => (
    <>
      <Circulo cx={12} cy={12} r={8.25} tono="lleno" />
      <Acento><path d="M12 12V3.75A8.25 8.25 0 0 1 19.85 14.55Z" fill="currentColor" /></Acento>
      <Trazo d="M12 12L6.17 17.83" />
    </>
  ),
  // Dona (p70).
  p_donut: () => (
    <>
      <circle cx={12} cy={12} r={6.375} fill="none" stroke="currentColor" strokeOpacity={TONO.lleno} strokeWidth={3.75} />
      <Acento>
        <path d="M12 5.625A6.375 6.375 0 0 1 18.06 13.97" fill="none" stroke="currentColor" strokeWidth={3.75} />
      </Acento>
    </>
  ),
  // Histograma (p81): columnas contiguas.
  p_histograma: () => (
    <>
      <Trazo d={BASE} />
      <Bloque x={3} y={15.75} w={3} h={3.75} rx={0} />
      <Bloque x={6} y={11.25} w={3} h={8.25} rx={0} />
      <Bloque x={9} y={6.75} w={3} h={12.75} rx={0} />
      <Acento><Bloque x={12} y={4.5} w={3} h={15} rx={0} tono="pleno" /></Acento>
      <Bloque x={15} y={9.75} w={3} h={9.75} rx={0} />
      <Bloque x={18} y={15} w={3} h={4.5} rx={0} />
    </>
  ),
  // Indicador numérico (p82): columnas de promedios, parejas, con su valor encima.
  p_numerico: () => (
    <>
      <Trazo d={BASE} />
      <Trazo d="M5.25 6H7.5M10.875 4.5H13.125M16.5 7.5H18.75" />
      <Bloque x={4.5} y={9} w={3.75} h={10.5} />
      <Acento><Bloque x={10.125} y={7.5} w={3.75} h={12} tono="pleno" /></Acento>
      <Bloque x={15.75} y={10.5} w={3.75} h={9} />
    </>
  ),
  // Diagrama de caja (p83).
  p_boxplot: () => (
    <>
      <Trazo d="M7.875 3.75V8.25M7.875 15.75V20.25M16.125 6.75V10.5M16.125 15.75V18.75" />
      <rect x={5.25} y={8.25} width={5.25} height={7.5} rx={0.75} fill="currentColor" fillOpacity={TONO.lleno}
        stroke="currentColor" strokeWidth={1.5} />
      <Trazo d="M5.25 12.75H10.5" tono="pleno" />
      <Acento>
        <rect x={13.5} y={10.5} width={5.25} height={5.25} rx={0.75} fill="currentColor" fillOpacity={TONO.lleno}
          stroke="currentColor" strokeWidth={1.5} />
        <Trazo d="M13.5 13.5H18.75" tono="pleno" />
      </Acento>
    </>
  ),
  // Media y rango (p84): rangos con topes y la media.
  p_media_rango: () => (
    <>
      <Trazo d="M6 8.25V18M4.5 8.25H7.5M4.5 18H7.5M12 4.5V15M10.5 4.5H13.5M10.5 15H13.5M18 10.5V19.5M16.5 10.5H19.5M16.5 19.5H19.5" />
      <Circulo cx={6} cy={13.5} r={2.25} tono="apoyo" />
      <Acento><Circulo cx={12} cy={9.75} r={2.25} /></Acento>
      <Circulo cx={18} cy={15} r={2.25} tono="apoyo" />
    </>
  ),
  // Puntos comparativos (p87): dos públicos por fila, uno lleno y otro hueco, sobre su guía.
  p_puntos_comparativos: () => (
    <>
      <Trazo d="M3 6H21M3 12H21M3 18H21" tono="lleno" />
      <Circulo cx={9} cy={6} r={1.875} hueco />
      <Circulo cx={6.75} cy={12} r={1.875} hueco />
      <Circulo cx={10.5} cy={18} r={1.875} hueco />
      <Acento>
        <Circulo cx={17.25} cy={6} r={2.25} />
        <Circulo cx={13.5} cy={12} r={2.25} />
        <Circulo cx={15.75} cy={18} r={2.25} />
      </Acento>
    </>
  ),
  // Serie temporal (p89–90).
  p_serie_temporal: () => (
    <>
      <Trazo d="M3.75 3.75V20.25H20.25" />
      <Trazo d="M6 16.5L10.5 14.25L15 15L19.5 12.75" />
      <Acento>
        <Trazo d="M6 12.75L10.5 8.25L15 9.75L19.5 5.25" tono="pleno" />
        <Circulo cx={6} cy={12.75} r={1.5} />
        <Circulo cx={19.5} cy={5.25} r={1.5} />
      </Acento>
    </>
  ),
  // Radar con tabla (p92).
  p_radar: () => (
    <>
      <polygon points={pentagono(7.875, 12.6, 5.625)} fill="none" stroke="currentColor" strokeOpacity={TONO.apoyo}
        strokeWidth={1.5} strokeLinejoin="round" />
      <Acento>
        <polygon points={pentagono(7.875, 12.6, 5.625, [0.9, 0.55, 0.8, 0.45, 0.65])} fill="currentColor"
          fillOpacity={TONO.lleno} stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
      </Acento>
      <rect x={15.75} y={6} width={5.25} height={12.75} rx={0.75} fill="none" stroke="currentColor"
        strokeOpacity={TONO.apoyo} strokeWidth={1.5} />
      <Trazo d="M15.75 10.25H21M15.75 14.5H21" />
    </>
  ),
  // Radar por dimensiones (p98): dos polígonos, sin tabla.
  p_dim_radar: () => (
    <>
      <polygon points={pentagono(12, 12.6, 8.6)} fill="none" stroke="currentColor" strokeOpacity={TONO.apoyo}
        strokeWidth={1.5} strokeLinejoin="round" />
      <polygon points={pentagono(12, 12.6, 8.6, [0.8, 0.85, 0.65, 0.75, 0.9])} fill="currentColor" fillOpacity={TONO.lleno} />
      <Acento>
        <polygon points={pentagono(12, 12.6, 8.6, [0.92, 0.55, 0.78, 0.42, 0.62])} fill="none" stroke="currentColor"
          strokeWidth={1.5} strokeLinejoin="round" />
      </Acento>
    </>
  ),
  // Mapa de calor por dimensión (p94).
  p_dim_heatmap: () => (
    <>
      <Acento><Bloque x={3.75} y={3.75} w={4.5} h={4.5} tono="pleno" /></Acento>
      <Bloque x={9.75} y={3.75} w={4.5} h={4.5} tono="apoyo" />
      <Bloque x={15.75} y={3.75} w={4.5} h={4.5} />
      <Bloque x={3.75} y={9.75} w={4.5} h={4.5} tono="apoyo" />
      <Bloque x={9.75} y={9.75} w={4.5} h={4.5} />
      <Bloque x={15.75} y={9.75} w={4.5} h={4.5} tono="apoyo" />
      <Bloque x={3.75} y={15.75} w={4.5} h={4.5} />
      <Bloque x={9.75} y={15.75} w={4.5} h={4.5} tono="apoyo" />
      <Bloque x={15.75} y={15.75} w={4.5} h={4.5} />
    </>
  ),
  // Mapa de calor por criterio (p95): filas agrupadas por dimensión, con su marca a la izquierda.
  p_dim_heatmap_criterios: () => (
    <>
      <Acento>
        <Bloque x={3} y={3} w={1.5} h={7.5} tono="pleno" />
        <Bloque x={3} y={13.5} w={1.5} h={7.5} tono="pleno" />
      </Acento>
      {[3, 7.5, 13.5, 18].map((y, fila) => [6.75, 12, 17.25].map((x, col) => (
        <Bloque key={`${y}-${x}`} x={x} y={y} w={3.75} h={3} tono={(fila + col) % 2 === 0 ? "apoyo" : "lleno"} />
      )))}
    </>
  ),
  // Comparativo de dimensiones (p96): pares de barras por dimensión.
  p_dim_comparativo_radarbar: () => (
    <>
      <Trazo d={EJE_IZQ} />
      <Acento>
        <Bloque x={6} y={4.5} w={15} h={2.25} tono="pleno" />
        <Bloque x={6} y={10.5} w={10.5} h={2.25} tono="pleno" />
        <Bloque x={6} y={16.5} w={12.75} h={2.25} tono="pleno" />
      </Acento>
      <Bloque x={6} y={6.75} w={12} h={2.25} />
      <Bloque x={6} y={12.75} w={13.5} h={2.25} />
      <Bloque x={6} y={18.75} w={8.25} h={2.25} />
    </>
  ),
  // Nube de palabras (p100).
  p_nube_palabras: () => (
    <>
      <Trazo d="M5.25 7.5H10.5" ancho={2.25} />
      <Trazo d="M13.5 7.5H18.75" tono="lleno" />
      <Acento><Trazo d="M7.5 12H16.5" tono="pleno" ancho={3} /></Acento>
      <Trazo d="M3.75 16.5H8.25" tono="lleno" />
      <Trazo d="M11.25 16.5H19.5" ancho={2.25} />
    </>
  ),
  // Mapa territorial (p105–108): el distrito con el marcador de cobertura.
  p_mapa_cobertura_territorial: () => (
    <>
      <path d="M4.5 6.75L9.75 3.75L17.25 5.25L20.25 11.25L17.25 18.75L9 20.25L3.75 14.25Z" fill="currentColor"
        fillOpacity={TONO.lleno} stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
      <Acento>
        <path fill="currentColor" fillRule="evenodd"
          d="M12 18.75C9 15.55 7.5 13.05 7.5 10.875A4.5 4.5 0 0 1 16.5 10.875C16.5 13.05 15 15.55 12 18.75ZM10.5 10.875A1.5 1.5 0 1 0 13.5 10.875A1.5 1.5 0 1 0 10.5 10.875Z" />
      </Acento>
    </>
  ),
  // Mapa de resultado por distrito (p106).
  p_mapa_resultado_distrital: () => (
    <>
      <path d="M5.25 4.5L12 3.75L11.25 11.25L3.75 9Z" fill="currentColor" fillOpacity={TONO.lleno} />
      <Acento><path d="M12 3.75L19.5 6L20.25 12.75L11.25 11.25Z" fill="currentColor" /></Acento>
      <path d="M3.75 9L11.25 11.25L9.75 20.25L4.5 15.75Z" fill="currentColor" fillOpacity={TONO.apoyo} />
      <path d="M11.25 11.25L20.25 12.75L16.5 19.5L9.75 20.25Z" fill="currentColor" fillOpacity={TONO.lleno} />
      <path d="M5.25 4.5L12 3.75L19.5 6L20.25 12.75L16.5 19.5L9.75 20.25L4.5 15.75L3.75 9Z" fill="none"
        stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
    </>
  ),
  // Cifra destacada (p17–18, 172–175).
  p_cifra: () => (
    <>
      <Circulo cx={7.125} cy={7.125} r={2.625} hueco />
      <Circulo cx={16.875} cy={16.875} r={2.625} hueco />
      <Acento><Trazo d="M18.75 5.25L5.25 18.75" tono="pleno" ancho={2.25} /></Acento>
    </>
  ),
  // Tabla (p197).
  p_tabla: () => (
    <>
      <rect x={3} y={4.5} width={18} height={15} rx={1.5} fill="none" stroke="currentColor" strokeWidth={1.5} />
      <Acento><Bloque x={4.5} y={6} w={15} h={2.25} tono="pleno" /></Acento>
      <Trazo d="M3 11.25H21M3 15.375H21M9.75 11.25V19.5" />
    </>
  ),
};

/** Graficadores que comparten el ícono de otro tipo porque el recetario los dibuja igual. */
export const ALIAS_GRAFICO: Readonly<Record<string, string>> = {
  p_barras_apiladas: "p_barras_multiapiladas",
};

/**
 * Graficadores del registro sin ícono: no aparecen en el recetario y salieron del selector (`en_selector = FALSE`).
 * Se siguen dibujando en planes viejos; su ícono es el marco con ranura punteada.
 */
export const GRAFICOS_RETIRADOS: ReadonlySet<string> = new Set(["p_dim_foda"]);

export const ICONOS_GRAFICO = ICONOS;

export function dibujoGrafico(tipo: string): DibujoGrafico | null {
  return ICONOS[tipo] ?? ICONOS[ALIAS_GRAFICO[tipo] ?? ""] ?? null;
}
