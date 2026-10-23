import { useLayoutEffect, useRef, useState } from "react";
import { fmt } from "../formato";
import { marcasDeEje, type DiaDeAvance } from "./avanceModelo";

/**
 * Gráficos de Avance dibujados en SVG con los datos del corte. Todos llevan
 * eje Y con marcas y título discretos; el que combina barras diarias y
 * acumulado usa doble eje y dibuja la meta en la escala del acumulado.
 * El tamaño se mide del contenedor: el SVG no se estira, así el texto no se
 * deforma.
 */

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];

/** «11 jun». */
export function fechaCorta(iso: string): string {
  const [, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  if (!mes || !dia) return iso;
  return `${dia} ${MESES[mes - 1]}`;
}

function useTamano<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [tamano, setTamano] = useState({ ancho: 0, alto: 0 });
  useLayoutEffect(() => {
    const nodo = ref.current;
    if (!nodo) return undefined;
    const medir = () => {
      const caja = nodo.getBoundingClientRect();
      setTamano((previo) => (
        Math.abs(previo.ancho - caja.width) < 1 && Math.abs(previo.alto - caja.height) < 1
          ? previo
          : { ancho: caja.width, alto: caja.height }
      ));
    };
    medir();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observador = new ResizeObserver(medir);
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);
  return [ref, tamano] as const;
}

/** Hasta `cuantas` etiquetas de fecha repartidas, siempre con la primera y la última. */
function indicesDeFecha(total: number, cuantas: number): number[] {
  if (total <= cuantas) return Array.from({ length: total }, (_, indice) => indice);
  const paso = (total - 1) / (cuantas - 1);
  return [...new Set(Array.from({ length: cuantas }, (_, indice) => Math.round(indice * paso)))];
}

/**
 * Efectivas acumuladas (eje izquierdo) con las efectivas de cada día en barras
 * (eje derecho), la meta en la escala del acumulado y el día en que se cumplió.
 */
export function CurvaAcumulada({
  serie,
  meta,
  diaDeMeta,
}: {
  serie: readonly DiaDeAvance[];
  meta: number;
  diaDeMeta: string | null;
}) {
  const [ref, { ancho, alto }] = useTamano<HTMLDivElement>();
  const izquierda = 52;
  const derecha = 92;
  const arriba = 30;
  const abajo = 26;
  const w = Math.max(0, ancho - izquierda - derecha);
  const h = Math.max(0, alto - arriba - abajo);
  const final = serie.at(-1)?.acumulado ?? 0;
  const marcasAcum = marcasDeEje(Math.max(final, meta) * 1.08);
  const maxAcum = marcasAcum.at(-1) ?? 1;
  const maxDia = Math.max(1, ...serie.map((dia) => dia.efectivas));
  const marcasDia = marcasDeEje(maxDia * 2.4);
  const maxDiaEje = marcasDia.at(-1) ?? 1;
  const n = serie.length;
  const x = (indice: number) => izquierda + (n <= 1 ? w / 2 : (indice / (n - 1)) * w);
  const yAcum = (valor: number) => arriba + h - (valor / maxAcum) * h;
  const yDia = (valor: number) => arriba + h - (valor / maxDiaEje) * h;
  const anchoBarra = Math.max(2, Math.min(18, (w / Math.max(1, n)) * 0.62));
  const linea = serie.map((dia, indice) => `${indice ? "L" : "M"}${x(indice).toFixed(1)},${yAcum(dia.acumulado).toFixed(1)}`).join(" ");
  const area = n ? `${linea} L${x(n - 1).toFixed(1)},${yAcum(0)} L${x(0).toFixed(1)},${yAcum(0)} Z` : "";
  const indiceDeMeta = diaDeMeta ? serie.findIndex((dia) => dia.fecha === diaDeMeta) : -1;
  const listo = ancho > 0 && alto > 0 && n > 0;
  // Si el rótulo de la meta quedaría sobre el del último acumulado, va bajo la línea.
  const metaAbajo = Math.abs(yAcum(final) - yAcum(meta)) < 22 && yAcum(meta) + 18 < arriba + h;
  return (
    <div ref={ref} className="acr-av-grafico" role="img" aria-label={`Efectivas acumuladas: ${fmt(final)}${meta > 0 ? ` de una meta de ${fmt(meta)}` : ""}`}>
      {listo ? (
        <svg width={ancho} height={alto} aria-hidden="true">
          <text className="acr-av-eje-titulo" x={4} y={11}>Acumulado</text>
          <text className="acr-av-eje-titulo" x={izquierda + w + 8} y={11}>Por día</text>
          {marcasAcum.map((valor) => (
            <g key={`a${valor}`}>
              <line className="acr-av-reticula" x1={izquierda} x2={izquierda + w} y1={yAcum(valor)} y2={yAcum(valor)} />
              <text className="acr-av-eje" x={izquierda - 8} y={yAcum(valor) + 4} textAnchor="end">{fmt(valor)}</text>
            </g>
          ))}
          {marcasDia.map((valor) => (
            <text key={`d${valor}`} className="acr-av-eje is-secundario" x={izquierda + w + 8} y={yDia(valor) + 4}>{fmt(valor)}</text>
          ))}
          {serie.map((dia, indice) => (
            dia.efectivas > 0 ? (
              <rect
                key={dia.fecha}
                className="acr-av-barra-dia"
                x={x(indice) - anchoBarra / 2}
                y={yDia(dia.efectivas)}
                width={anchoBarra}
                height={yDia(0) - yDia(dia.efectivas)}
                rx={1.5}
              />
            ) : null
          ))}
          <path className="acr-av-area" d={area} />
          <path className="acr-av-linea" d={linea} />
          {meta > 0 ? (
            <g>
              <line className="acr-av-meta" x1={izquierda} x2={izquierda + w} y1={yAcum(meta)} y2={yAcum(meta)} />
              <text className="acr-av-meta-texto" x={izquierda + w - 6} y={metaAbajo ? yAcum(meta) + 15 : yAcum(meta) - 6} textAnchor="end">{`Meta ${fmt(meta)}`}</text>
            </g>
          ) : null}
          {indiceDeMeta >= 0 ? (
            <g>
              <circle className="acr-av-hito" cx={x(indiceDeMeta)} cy={yAcum(serie[indiceDeMeta].acumulado)} r={4.5} />
              <text className="acr-av-hito-texto" x={x(indiceDeMeta) - 9} y={yAcum(serie[indiceDeMeta].acumulado) - 7} textAnchor="end">
                {fechaCorta(serie[indiceDeMeta].fecha)}
              </text>
            </g>
          ) : null}
          <circle className="acr-av-final" cx={x(n - 1)} cy={yAcum(final)} r={4} />
          <text className="acr-av-final-texto" x={x(n - 1) - 8} y={yAcum(final) - 9} textAnchor="end">{fmt(final)}</text>
          {indicesDeFecha(n, Math.max(2, Math.min(9, Math.floor(w / 90)))).map((indice) => (
            <text key={serie[indice].fecha} className="acr-av-eje" x={x(indice)} y={alto - 6} textAnchor={indice === 0 ? "start" : indice === n - 1 ? "end" : "middle"}>
              {fechaCorta(serie[indice].fecha)}
            </text>
          ))}
        </svg>
      ) : null}
    </div>
  );
}

/** Efectivas por día con eje Y, para «Últimos 14 días». */
export function BarrasPorDia({ dias, etiqueta }: { dias: readonly DiaDeAvance[]; etiqueta: string }) {
  const [ref, { ancho, alto }] = useTamano<HTMLDivElement>();
  const izquierda = 40;
  const arriba = 24;
  const abajo = 20;
  const w = Math.max(0, ancho - izquierda - 4);
  const h = Math.max(0, alto - arriba - abajo);
  const marcas = marcasDeEje(Math.max(1, ...dias.map((dia) => dia.efectivas)));
  const maximo = marcas.at(-1) ?? 1;
  const paso = w / Math.max(1, dias.length);
  const y = (valor: number) => arriba + h - (valor / maximo) * h;
  return (
    <div ref={ref} className="acr-av-grafico is-compacto" role="img" aria-label={etiqueta}>
      {ancho > 0 && alto > 0 && dias.length ? (
        <svg width={ancho} height={alto} aria-hidden="true">
          <text className="acr-av-eje-titulo" x={0} y={10}>Efectivas</text>
          {[marcas[0], marcas.at(-1) ?? 0].map((valor) => (
            <g key={valor}>
              <line className="acr-av-reticula" x1={izquierda} x2={izquierda + w} y1={y(valor)} y2={y(valor)} />
              <text className="acr-av-eje" x={izquierda - 6} y={y(valor) + 4} textAnchor="end">{fmt(valor)}</text>
            </g>
          ))}
          {dias.map((dia, indice) => (
            <rect
              key={dia.fecha}
              className={`acr-av-barra${dia.efectivas ? "" : " is-cero"}`}
              x={izquierda + indice * paso + paso * 0.12}
              y={dia.efectivas ? y(dia.efectivas) : y(0) - 2}
              width={paso * 0.76}
              height={dia.efectivas ? y(0) - y(dia.efectivas) : 2}
              rx={1.5}
            />
          ))}
          <text className="acr-av-eje" x={izquierda} y={alto - 4}>{fechaCorta(dias[0].fecha)}</text>
          <text className="acr-av-eje" x={izquierda + w} y={alto - 4} textAnchor="end">{fechaCorta(dias.at(-1)?.fecha ?? "")}</text>
        </svg>
      ) : null}
    </div>
  );
}

/** Área del acumulado de un público, con eje Y. */
export function AreaAcumulada({ serie, meta, etiqueta }: { serie: readonly DiaDeAvance[]; meta: number | null; etiqueta: string }) {
  const [ref, { ancho, alto }] = useTamano<HTMLDivElement>();
  const izquierda = 40;
  const arriba = 24;
  const abajo = 20;
  const w = Math.max(0, ancho - izquierda - 6);
  const h = Math.max(0, alto - arriba - abajo);
  const final = serie.at(-1)?.acumulado ?? 0;
  const marcas = marcasDeEje(Math.max(final, meta ?? 0) * 1.05);
  const maximo = marcas.at(-1) ?? 1;
  const n = serie.length;
  const x = (indice: number) => izquierda + (n <= 1 ? w / 2 : (indice / (n - 1)) * w);
  const y = (valor: number) => arriba + h - (valor / maximo) * h;
  const linea = serie.map((dia, indice) => `${indice ? "L" : "M"}${x(indice).toFixed(1)},${y(dia.acumulado).toFixed(1)}`).join(" ");
  return (
    <div ref={ref} className="acr-av-grafico" role="img" aria-label={etiqueta}>
      {ancho > 0 && alto > 0 && n ? (
        <svg width={ancho} height={alto} aria-hidden="true">
          <text className="acr-av-eje-titulo" x={0} y={10}>Efectivas</text>
          {marcas.map((valor) => (
            <g key={valor}>
              <line className="acr-av-reticula" x1={izquierda} x2={izquierda + w} y1={y(valor)} y2={y(valor)} />
              <text className="acr-av-eje" x={izquierda - 6} y={y(valor) + 4} textAnchor="end">{fmt(valor)}</text>
            </g>
          ))}
          <path className="acr-av-area" d={`${linea} L${x(n - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`} />
          <path className="acr-av-linea" d={linea} />
          {meta && meta > 0 ? (
            <g>
              <line className="acr-av-meta" x1={izquierda} x2={izquierda + w} y1={y(meta)} y2={y(meta)} />
              <text className="acr-av-meta-texto" x={izquierda + 4} y={y(meta) - 5}>{`Meta ${fmt(meta)}`}</text>
            </g>
          ) : null}
          <text className="acr-av-eje" x={izquierda} y={alto - 4}>{fechaCorta(serie[0].fecha)}</text>
          <text className="acr-av-eje" x={izquierda + w} y={alto - 4} textAnchor="end">{fechaCorta(serie[n - 1].fecha)}</text>
        </svg>
      ) : null}
    </div>
  );
}

/**
 * Dos series en barras superpuestas por categoría (la clara detrás, la oscura
 * delante), con eje Y y su título; cada barra lleva su cifra arriba si cabe.
 */
export function BarrasSuperpuestas({
  categorias,
  tituloEje,
  etiqueta,
}: {
  categorias: ReadonlyArray<{ clave: string; rotulo: string; fondo: number; frente: number }>;
  tituloEje: string;
  etiqueta: string;
}) {
  const [ref, { ancho, alto }] = useTamano<HTMLDivElement>();
  const izquierda = 40;
  const arriba = 26;
  const abajo = 22;
  const w = Math.max(0, ancho - izquierda - 6);
  const h = Math.max(0, alto - arriba - abajo);
  const marcas = marcasDeEje(Math.max(1, ...categorias.map((item) => item.fondo)) * 1.08);
  const maximo = marcas.at(-1) ?? 1;
  const paso = w / Math.max(1, categorias.length);
  const y = (valor: number) => arriba + h - (valor / maximo) * h;
  const conRotulo = paso >= 22;
  return (
    <div ref={ref} className="acr-av-grafico" role="img" aria-label={etiqueta}>
      {ancho > 0 && alto > 0 && categorias.length ? (
        <svg width={ancho} height={alto} aria-hidden="true">
          <text className="acr-av-eje-titulo" x={0} y={10}>{tituloEje}</text>
          {marcas.map((valor) => (
            <g key={valor}>
              <line className="acr-av-reticula" x1={izquierda} x2={izquierda + w} y1={y(valor)} y2={y(valor)} />
              <text className="acr-av-eje" x={izquierda - 6} y={y(valor) + 4} textAnchor="end">{fmt(valor)}</text>
            </g>
          ))}
          {categorias.map((item, indice) => {
            const x = izquierda + indice * paso + paso * 0.14;
            const anchoBarra = paso * 0.72;
            return (
              <g key={item.clave}>
                {item.fondo > 0 ? <rect className="acr-av-barra-dia" x={x} y={y(item.fondo)} width={anchoBarra} height={y(0) - y(item.fondo)} rx={1.5} /> : null}
                {item.frente > 0 ? <rect className="acr-av-barra" x={x + anchoBarra * 0.18} y={y(item.frente)} width={anchoBarra * 0.64} height={y(0) - y(item.frente)} rx={1.5} /> : null}
                {conRotulo && item.fondo > 0 ? <text className="acr-av-eje is-cifra" x={x + anchoBarra / 2} y={y(item.fondo) - 4} textAnchor="middle">{fmt(item.fondo)}</text> : null}
                {conRotulo || indice % 2 === 0 ? <text className="acr-av-eje" x={x + anchoBarra / 2} y={alto - 6} textAnchor="middle">{item.rotulo}</text> : null}
              </g>
            );
          })}
        </svg>
      ) : null}
    </div>
  );
}

/** Miniatura de barras dentro de una celda o una fila: sin ejes, con su lectura en `aria-label`. */
export function Minibarras({ valores, etiqueta }: { valores: readonly number[]; etiqueta: string }) {
  const maximo = Math.max(1, ...valores);
  const ancho = 84;
  const alto = 18;
  const paso = ancho / Math.max(1, valores.length);
  return (
    <svg className="acr-av-minibarras" width={ancho} height={alto} role="img" aria-label={etiqueta}>
      <line className="acr-av-minibarras-base" x1={0} x2={ancho} y1={alto - 0.5} y2={alto - 0.5} />
      {valores.map((valor, indice) => (valor > 0 ? (
        <rect key={indice} x={indice * paso + paso * 0.15} y={alto - Math.max(2, (valor / maximo) * alto)} width={paso * 0.7} height={Math.max(2, (valor / maximo) * alto)} rx={1} />
      ) : null))}
    </svg>
  );
}
