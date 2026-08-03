import { useMemo } from "react";

import type { CalcMuestraAulasCriterioRadiografiaV2Distribution } from "../../../../api/calcMuestraCriteriosRadiografia";
import "./distribucionCategoria.css";

/**
 * F111 · Las tres lecturas de una categoría sobre un solo eje.
 *
 * Densidad arriba, boxplot en medio y cuantiles abajo, apilados y **compartiendo
 * la misma escala**, de modo que cada número caiga bajo su posición real en vez
 * de repartirse en una fila regular. Antes los cinco cuantiles vivían en una
 * fila equiespaciada: P10 y P90 ocupaban el mismo ancho que P25 y P50 aunque
 * uno abarque cinco veces más recorrido, y la caja se leía aparte.
 *
 * Nada de lo que se dibuja lo calcula React. El histograma, los bigotes de
 * Tukey y los cuantiles vienen del motor (contrato v2, ver
 * `calc_muestra_aulas_criterio_radiografia.R`). Lo único que se computa aquí es
 * **posición en píxeles**, que es layout y no estadística — y la separación
 * mínima entre etiquetas, que también lo es.
 */

export type DominioEscala = { min: number; max: number };

type Dist = CalcMuestraAulasCriterioRadiografiaV2Distribution;

export type VistaDistribucion = {
  /** Cursos-horario de esta vista. */
  nCh: number | null;
  distribucion: Dist | null;
};

const fmt = (v: number | null | undefined, dec = 1) =>
  typeof v === "number" && Number.isFinite(v)
    ? v.toLocaleString("es-PE", { maximumFractionDigits: dec })
    : "—";

const fmtInt = (v: number | null | undefined) =>
  typeof v === "number" && Number.isFinite(v) ? Math.round(v).toLocaleString("es-PE") : "—";

/** Posición porcentual de un valor en la escala común. */
function pos(valor: number, dom: DominioEscala): number {
  const ancho = dom.max - dom.min;
  if (!(ancho > 0)) return 0;
  return ((valor - dom.min) / ancho) * 100;
}

const tiene = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Dominio común a un conjunto de distribuciones.
 *
 * Se calcula sobre TODAS las categorías del criterio, no por tarjeta: dos cajas
 * normalizadas contra su propio rango salen del mismo ancho y sugieren que las
 * categorías se parecen, que es lo contrario de para lo que existe el gráfico
 * (ADR 0057, regla 3).
 */
export function dominioComun(dists: Array<Dist | null | undefined>): DominioEscala | null {
  const vals: number[] = [];
  for (const d of dists) {
    if (!d) continue;
    for (const v of [d.min, d.max, d.bigote_inf, d.bigote_sup, d.p10, d.p90, d.media]) {
      if (tiene(v)) vals.push(v);
    }
    if (d.hist_breaks?.length) {
      vals.push(d.hist_breaks[0], d.hist_breaks[d.hist_breaks.length - 1]);
    }
  }
  if (!vals.length) return null;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  return max > min ? { min, max } : { min, max: min + 1 };
}

/**
 * Densidad empírica.
 *
 * Es el histograma que publica R, dibujado como área. La altura se normaliza
 * contra el conteo máximo **de esta vista**, no del criterio: la densidad
 * describe forma, y el tamaño ya lo dicen las cifras de arriba. El eje
 * horizontal sí es el común — que es lo que la hace comparable.
 */
function Densidad({ d, dom }: { d: Dist; dom: DominioEscala }) {
  const puntos = useMemo(() => {
    const breaks = d.hist_breaks ?? [];
    const counts = d.hist_counts ?? [];
    if (breaks.length < 2 || counts.length !== breaks.length - 1) return null;
    const maxC = Math.max(...counts);
    if (!(maxC > 0)) return null;
    // Polilínea por el punto medio de cada intervalo, cerrada contra la base.
    const cuerpo = counts.map((c, i) => {
      const centro = (breaks[i] + breaks[i + 1]) / 2;
      return `${pos(centro, dom).toFixed(2)},${(100 - (c / maxC) * 100).toFixed(2)}`;
    });
    const x0 = pos(breaks[0], dom).toFixed(2);
    const x1 = pos(breaks[breaks.length - 1], dom).toFixed(2);
    return [`${x0},100`, ...cuerpo, `${x1},100`].join(" ");
  }, [d, dom]);

  if (!puntos) return null;
  return (
    <svg
      className="cmv2-dist-densidad"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <polygon points={puntos} />
    </svg>
  );
}

/**
 * Boxplot estándar.
 *
 * Bigotes en `bigote_inf`/`bigote_sup` —el dato más extremo dentro de 1,5 × RIC,
 * que es la convención— y no en P10/P90. Cuando el motor no los publica (marco
 * anterior a F111) se cae a P10/P90 **y se dice**: una caja que cambia de
 * convención en silencio es peor que una caja menos.
 */
function Boxplot({ d, dom }: { d: Dist; dom: DominioEscala }) {
  const q1 = d.p25;
  const q3 = d.p75;
  if (!tiene(q1) || !tiene(q3)) return null;

  const inf = tiene(d.bigote_inf) ? d.bigote_inf : d.p10;
  const sup = tiene(d.bigote_sup) ? d.bigote_sup : d.p90;
  const izq = pos(q1, dom);
  const ancho = Math.max(0.6, pos(q3, dom) - izq);

  return (
    <div className="cmv2-dist-box">
      {tiene(inf) && tiene(sup) ? (
        <i
          className="cmv2-dist-bigote"
          style={{ left: `${pos(inf, dom)}%`, width: `${Math.max(0.4, pos(sup, dom) - pos(inf, dom))}%` }}
        />
      ) : null}
      {tiene(inf) ? <i className="cmv2-dist-tope" style={{ left: `${pos(inf, dom)}%` }} /> : null}
      {tiene(sup) ? <i className="cmv2-dist-tope" style={{ left: `${pos(sup, dom)}%` }} /> : null}
      {/* F114 · Los atípicos, en el gráfico y no en prosa. «19 atípicos fuera de
          los bigotes» al pie es metatexto: obliga a traducir una frase a una
          posición. Una marca junto al bigote que los deja fuera se lee sin
          traducir. El motor publica de qué lado están (`n_atipicos_inf/sup`)
          porque sin eso sólo cabía la frase. */}
      {tiene(inf) && tiene(d.n_atipicos_inf) && d.n_atipicos_inf > 0 ? (
        <i className="cmv2-dist-atipico" data-lado="inf" style={{ left: `${pos(inf, dom)}%` }}
           aria-hidden="true" data-n={d.n_atipicos_inf} />
      ) : null}
      {tiene(sup) && tiene(d.n_atipicos_sup) && d.n_atipicos_sup > 0 ? (
        <i className="cmv2-dist-atipico" data-lado="sup" style={{ left: `${pos(sup, dom)}%` }}
           aria-hidden="true" data-n={d.n_atipicos_sup} />
      ) : null}
      <i className="cmv2-dist-caja" style={{ left: `${izq}%`, width: `${ancho}%` }} />
      {tiene(d.p50) ? <i className="cmv2-dist-mediana" style={{ left: `${pos(d.p50, dom)}%` }} /> : null}
      {tiene(d.media) ? <i className="cmv2-dist-media" style={{ left: `${pos(d.media, dom)}%` }} /> : null}
    </div>
  );
}

/**
 * Cuantiles bajo su posición real.
 *
 * Colocarlos en su x los hace legibles contra la caja, pero los acerca hasta
 * solaparse cuando la distribución es apretada. La separación mínima se resuelve
 * empujando cada etiqueta lo justo hacia la derecha: es reparto de píxeles, no
 * un cambio del dato — el valor sigue siendo el que el motor publicó y la marca
 * que lo señala **no** se mueve.
 */
/*
 * Separación mínima entre etiquetas, en % del ancho.
 *
 * Medido en la app: con «Mediana» como rótulo, dos etiquetas contiguas salían
 * pegadas —«MedianaP75»— porque el reparto usa un porcentaje fijo y esa palabra
 * mide el doble que «P25». Empujar más no era la respuesta: la respuesta es que
 * las cinco midan lo mismo. Con `P50` el ancho es homogéneo y 11 % basta para
 * la escala de 260 px (≈29 px, cuatro caracteres a 11 px con holgura).
 */
const MIN_SEPARACION = 11;

function Cuantiles({ d, dom }: { d: Dist; dom: DominioEscala }) {
  const marcas = useMemo(() => {
    const crudas = (
      [
        ["P10", d.p10],
        ["P25", d.p25],
        ["P50", d.p50],
        ["P75", d.p75],
        ["P90", d.p90],
      ] as Array<[string, number | null | undefined]>
    )
      .filter((par): par is [string, number] => tiene(par[1]))
      .map(([label, valor]) => ({ label, valor, x: pos(valor, dom) }));

    // Empuje mínimo hacia la derecha, en cascada. La marca conserva su x.
    let previa = -Infinity;
    return crudas.map((m) => {
      const etiquetaX = Math.max(m.x, previa + MIN_SEPARACION);
      previa = etiquetaX;
      return { ...m, etiquetaX: Math.min(etiquetaX, 100) };
    });
  }, [d, dom]);

  if (!marcas.length) return null;
  return (
    <div className="cmv2-dist-cuantiles">
      <div className="cmv2-dist-ticks" aria-hidden="true">
        {marcas.map((m) => (
          <i key={m.label} style={{ left: `${m.x}%` }} />
        ))}
      </div>
      <dl aria-label="Cuantiles de la distribución">
        {marcas.map((m) => (
          <div key={m.label} style={{ left: `${m.etiquetaX}%` }}>
            <dt>{m.label}</dt>
            <dd>{fmt(m.valor)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Texto equivalente del gráfico: quien no lo ve recibe las mismas cifras. */
function resumenAccesible(d: Dist, vista: string): string {
  const partes = [
    `Distribución de ${vista}`,
    tiene(d.media) ? `media ${fmt(d.media)}` : null,
    tiene(d.p50) ? `mediana ${fmt(d.p50)}` : null,
    tiene(d.p25) && tiene(d.p75) ? `mitad central de ${fmt(d.p25)} a ${fmt(d.p75)}` : null,
    tiene(d.bigote_inf) && tiene(d.bigote_sup)
      ? `bigotes de ${fmt(d.bigote_inf)} a ${fmt(d.bigote_sup)}`
      : null,
    tiene(d.n_atipicos) && d.n_atipicos > 0
      ? `${fmtInt(d.n_atipicos)} ${d.n_atipicos === 1 ? "atípico" : "atípicos"}`
      : null,
  ];
  return partes.filter(Boolean).join(", ");
}

/**
 * Eje del gráfico.
 *
 * F112 · Antes la escala sólo se declaraba en palabras al pie y las únicas
 * marcas eran las de los cuantiles. Gonzalo: «no sólo debe estar claro cuáles
 * son los puntos del eje x que forman parte de los cuartiles, sino el eje en
 * general — cuáles son los límites, cuáles son los puntos más importantes».
 *
 * Los cortes son números redondos, no los extremos del dominio: un eje rotulado
 * 6,4 · 21,7 · 37,0 se lee peor que 10 · 20 · 30 aunque describa lo mismo.
 * Elegirlos es presentación, no estadística — el dominio no se toca.
 */
function pasoLegible(span: number, objetivo: number): number {
  const crudo = span / objetivo;
  const magnitud = Math.pow(10, Math.floor(Math.log10(crudo)));
  const norm = crudo / magnitud;
  return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * magnitud;
}

/**
 * Redondea el dominio a marcas completas.
 *
 * F114 · Gonzalo: «los ejes x no tienen tics desde el inicio; deberían tener
 * tics de diez en diez hasta el límite, para que se entienda bien dónde están
 * estos cuartiles, esta media, esta mediana».
 *
 * Dos consecuencias, y la segunda importa tanto como la primera:
 *
 *  1. El eje empieza en **0** —la unidad es un conteo de estudiantes, y cero
 *     significa algo— y termina en una marca completa, no en el máximo crudo.
 *  2. Todas las categorías de un criterio quedan con **exactamente las mismas
 *     marcas**, así que las tarjetas alinean entre sí por construcción y no por
 *     casualidad de sus datos.
 */
export function dominioRedondeado(dom: DominioEscala | null, objetivo = 6): DominioEscala | null {
  if (!dom) return null;
  const alto = Math.max(dom.max, 0);
  const paso = pasoLegible(alto > 0 ? alto : 1, objetivo);
  const max = Math.ceil((alto + 1e-9) / paso) * paso;
  return { min: 0, max: max > 0 ? max : paso };
}

function cortesLegibles(dom: DominioEscala, objetivo = 6): number[] {
  const span = dom.max - dom.min;
  if (!(span > 0)) return [];
  const paso = pasoLegible(span, objetivo);
  const cortes: number[] = [];
  for (let v = Math.ceil(dom.min / paso) * paso; v <= dom.max + 1e-9; v += paso) {
    cortes.push(Number(v.toFixed(6)));
  }
  // Con el dominio redondeado el primer corte cae en el origen; si no, se añade
  // para que el eje declare dónde empieza y no sólo dónde va.
  if (!cortes.length || cortes[0] > dom.min + 1e-9) cortes.unshift(Number(dom.min.toFixed(6)));
  return cortes;
}

function Eje({ dom }: { dom: DominioEscala }) {
  const cortes = useMemo(() => cortesLegibles(dom), [dom]);
  if (!cortes.length) return null;
  return (
    <div className="cmv2-dist-eje" aria-hidden="true">
      <span className="cmv2-dist-eje-linea" />
      {cortes.map((v) => (
        <span key={v} className="cmv2-dist-eje-corte" style={{ left: `${pos(v, dom)}%` }}>
          <i />
          <b>{fmt(v, 0)}</b>
        </span>
      ))}
    </div>
  );
}

export function DistribucionCategoria({
  elegible,
  dominio,
  unidad = "estudiantes elegibles por curso-horario",
}: {
  elegible: VistaDistribucion;
  /** Escala común a TODAS las categorías del criterio. */
  dominio: DominioEscala | null;
  unidad?: string;
}) {
  // F112 · Sin conmutador elegibles/todos. Gonzalo: «no entiendo mucho lo de
  // dividir un visor entre elegibles y todos, debería ser solo elegibles — a
  // nosotros nos importa la distribución de los elegibles, no tanto la
  // distribución general de todo». El total sigue publicándose como cifra,
  // «CH totales», que es donde sí decide.
  const d = elegible.distribucion;

  // C3 · La superficie contiene su propio vacío. No basta con que llegue el
  // objeto: una distribución con todos sus valores en null dibujaba un marco
  // sin nada dentro y sin decirlo — un gráfico vacío se lee como «aquí no pasa
  // nada», que es distinto de «esto no se pudo calcular».
  const dibujable =
    Boolean(d) &&
    ((tiene(d?.p25) && tiene(d?.p75)) ||
      tiene(d?.p50) ||
      tiene(d?.media) ||
      Boolean(d?.hist_counts?.length));

  if (!d || !dominio || !dibujable) {
    return <p className="cmv2-dist-vacia">sin distribución publicada</p>;
  }

  const convencionCaida = !tiene(d.bigote_inf) && tiene(d.p10);

  return (
    <div className="cmv2-dist">
      <figure className="cmv2-dist-grafico" role="img" aria-label={resumenAccesible(d, "los elegibles")}>
        <Densidad d={d} dom={dominio} />
        <Boxplot d={d} dom={dominio} />
        {/* El eje va ENTRE la caja y los cuantiles: es la referencia que ambos
            usan, y ponerlo al final lo dejaba lejos de la mitad del gráfico. */}
        <Eje dom={dominio} />
        <Cuantiles d={d} dom={dominio} />
      </figure>

      {/* F114 · El pie sólo aparece cuando tiene algo que advertir. La unidad ya
          la declara el criterio una vez, arriba: repetirla bajo cada tarjeta era
          metatexto multiplicado por el número de categorías. */}
      {convencionCaida ? (
        <p className="cmv2-dist-pie">
          <span className="cmv2-dist-convencion">bigotes en P10–P90 · reconstruye el marco para los de Tukey</span>
        </p>
      ) : null}
    </div>
  );
}
