/**
 * Tooltip del mapa, dibujado DENTRO del SVG: el contrato de Avance › Mapa
 * prohíbe capas HTML superpuestas al lienzo (`mapaSinSuperpuestos`), y un
 * grupo SVG viaja con el acercamiento sin cálculos de posición en pantalla.
 *
 * `unidadesPorPixel` convierte píxeles de pantalla a unidades del viewBox: el
 * globo mide lo mismo en pantalla a cualquier zoom y a cualquier ancho del
 * panel. `vista` es el rectángulo visible, para voltear el globo cuando el
 * punto está cerca de un borde.
 */

export type ContenidoDeTooltip = { x: number; y: number; titulo: string; lineas: string[] };

const ALTO_TITULO = 17;
const ALTO_LINEA = 15;
const RELLENO = 9;
const ANCHO_DE_LETRA = 6.6;
const SEPARACION = 12;

export function anchoEstimadoDeTooltip(contenido: Pick<ContenidoDeTooltip, "titulo" | "lineas">): number {
  const largo = Math.max(contenido.titulo.length * 1.08, ...contenido.lineas.map((linea) => linea.length));
  return Math.ceil(largo * ANCHO_DE_LETRA) + RELLENO * 2;
}

export function TooltipDelMapa({
  contenido,
  unidadesPorPixel,
  vista,
}: {
  contenido: ContenidoDeTooltip;
  unidadesPorPixel: number;
  vista: { x: number; y: number; ancho: number; alto: number };
}) {
  const factor = unidadesPorPixel;
  const ancho = anchoEstimadoDeTooltip(contenido) * factor;
  const alto = (RELLENO * 2 + ALTO_TITULO + contenido.lineas.length * ALTO_LINEA) * factor;
  const separacion = SEPARACION * factor;
  const aLaIzquierda = contenido.x + separacion + ancho > vista.x + vista.ancho;
  const x = aLaIzquierda ? contenido.x - separacion - ancho : contenido.x + separacion;
  const y = Math.min(Math.max(contenido.y - alto / 2, vista.y + 4 * factor), vista.y + vista.alto - alto - 4 * factor);
  return (
    <g className="mon-mapa-tooltip" transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${factor})`} aria-hidden="true">
      <rect width={ancho / factor} height={alto / factor} rx={8} />
      <text x={RELLENO} y={RELLENO + 12} className="is-titulo">{contenido.titulo}</text>
      {contenido.lineas.map((linea, indice) => (
        <text key={indice} x={RELLENO} y={RELLENO + ALTO_TITULO + 11 + indice * ALTO_LINEA}>{linea}</text>
      ))}
    </g>
  );
}
