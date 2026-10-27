import { useLayoutEffect, useRef, useState } from "react";
import type { CuotasFaltante } from "./cuotasFaltanteModel";
import { fechaCorta } from "./cuotasFaltanteModel";
import { fmt } from "../formato";

const MAX_SERIES = 4;

/** Alto que ocupa una cifra sobre su punto (10 px de despegue + 12 px de letra + aire). */
const CIFRA_PX = 26;

/**
 * Qué series llevan su cifra en el último día: de mayor a menor, se salta la
 * que se montaría sobre el punto inmediatamente superior. La distancia se mide en
 * píxeles del lienzo, no en unidades del eje: 23 y 11 sobre un eje de 100
 * caben a 1920 y chocaban a 1440, con el lienzo más bajo.
 */
export function seriesConCifraFinal(finales: readonly number[], tope: number, altoPx = 300): Set<number> {
  const separacion = tope * Math.max(0.07, CIFRA_PX / Math.max(1, altoPx));
  const orden = finales.map((valor, indice) => ({ valor, indice })).sort((a, b) => b.valor - a.valor);
  const con = new Set<number>();
  // Se compara con el punto inmediatamente superior, lleve cifra o no: la
  // cifra va encima de su punto y se montaría sobre ese punto vecino.
  orden.forEach(({ valor, indice }, i) => {
    if (i === 0 || orden[i - 1].valor - valor >= separacion) con.add(indice);
  });
  return con;
}

/** Paso «redondo» del eje: 1, 2 o 5 por potencia de diez, para ~4 marcas. */
function pasoDelEje(maximo: number): number {
  if (maximo <= 4) return 1;
  const bruto = maximo / 4;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const base = bruto / potencia;
  return (base <= 1 ? 1 : base <= 2 ? 2 : base <= 5 ? 5 : 10) * potencia;
}

/**
 * Faltante al cierre de cada día, una línea por categoría y la cifra en cada
 * punto. Acompaña a la tabla de cuotas cuando hay pocas categorías (hasta
 * cuatro) y la tabla deja alto libre: es la misma lectura —cuánto falta— vista
 * en el tiempo.
 */
export function FaltanteDiario({ modelo }: { modelo: CuotasFaltante }) {
  const { fechas, series } = modelo.faltanteDiario;
  const visibles = series.slice(0, MAX_SERIES);
  const maximo = Math.max(1, ...visibles.flatMap((serie) => serie.valores));
  const paso = pasoDelEje(maximo);
  const tope = Math.ceil(maximo / paso) * paso;
  const lienzo = useRef<HTMLDivElement>(null);
  const [altoPx, setAltoPx] = useState(300);
  useLayoutEffect(() => {
    const nodo = lienzo.current;
    if (!nodo) return undefined;
    const medir = () => setAltoPx(nodo.getBoundingClientRect().height || 300);
    medir();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observador = new ResizeObserver(medir);
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);
  const conCifraFinal = seriesConCifraFinal(visibles.map((serie) => serie.valores.at(-1) ?? 0), tope, altoPx);
  const marcas = Array.from({ length: Math.round(tope / paso) + 1 }, (_, i) => i * paso);
  const x = (i: number) => (fechas.length === 1 ? 50 : 4 + (i / (fechas.length - 1)) * 92);
  const y = (valor: number) => 100 - (valor / tope) * 100;

  return (
    <section className="mon-tel-cuotas-diario" aria-label={`Faltante al cierre de cada día por ${modelo.segmento.toLocaleLowerCase("es")}`}>
      <header className="mon-tel-cuotas-diario-cabecera">
        <span className="mon-tel-cuotas-antetitulo">Faltante al cierre de cada día</span>
      </header>
      <div ref={lienzo} className="mon-tel-cuotas-diario-lienzo" role="img" aria-label={visibles.map((serie) => (
        `${serie.nombre}: ${serie.valores.map((valor, i) => `${fechaCorta(fechas[i])} ${fmt(valor)}`).join(", ")}`
      )).join(". ")}>
        {marcas.map((marca) => (
          <span key={marca} className="mon-tel-cuotas-diario-guia" style={{ top: `${y(marca)}%` }}>
            <span>{fmt(marca)}</span>
          </span>
        ))}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {visibles.map((serie, indice) => (
            <path
              key={serie.clave}
              className={`is-serie-${indice}`}
              d={serie.valores.map((valor, i) => `${i ? "L" : "M"}${x(i).toFixed(2)} ${y(valor).toFixed(2)}`).join(" ")}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        {visibles.map((serie, indice) => serie.valores.map((valor, i) => (
          <span
            key={`${serie.clave}-${fechas[i]}`}
            className={`mon-tel-cuotas-diario-punto is-serie-${indice}`}
            style={{ left: `${x(i)}%`, top: `${y(valor)}%` }}
          >
            {/* Con más de dos series las cifras de cada día se montan: sólo
              * la del último día lleva su número; el resto queda en el
              * rótulo accesible del lienzo. */}
            {i === fechas.length - 1 ? (conCifraFinal.has(indice) ? <b>{fmt(valor)}</b> : null) : visibles.length <= 2 ? <b>{fmt(valor)}</b> : null}
          </span>
        )))}
        {fechas.map((fecha, i) => (
          <span key={fecha} className="mon-tel-cuotas-diario-fecha" style={{ left: `${x(i)}%` }}>{fechaCorta(fecha)}</span>
        ))}
      </div>
      {/* Leyenda centrada en la tarjeta; con una sola serie, el título ya la nombra. */}
      {visibles.length > 1 ? (
        <span className="mon-tel-cuotas-diario-leyendas">
          {visibles.map((serie, indice) => (
            <span key={serie.clave} className={`mon-tel-cuotas-diario-leyenda is-serie-${indice}`}>
              <i aria-hidden="true" />
              {serie.nombre}
            </span>
          ))}
        </span>
      ) : null}
    </section>
  );
}
