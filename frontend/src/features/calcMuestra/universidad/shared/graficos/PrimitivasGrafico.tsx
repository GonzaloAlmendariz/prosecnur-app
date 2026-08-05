/**
 * Las primitivas gráficas del módulo de cursos-horario.
 *
 * Nacieron dentro del panel del histórico y viven aquí porque Selección hace
 * las mismas preguntas sobre otro conjunto de aulas: de qué está hecho, cómo se
 * reparte por facultad, qué proporción representa cada categoría. Duplicarlas
 * habría garantizado que las dos superficies divergieran al primer ajuste.
 *
 * Tres reglas que hacen que dos gráficos de secciones distintas se puedan
 * comparar de un vistazo: escala fija de 0 a 100 %, la cifra siempre en el
 * mismo sitio, y el color codificando significado y nunca decorando.
 *
 * Sin Plotly: barras en CSS. Estas superficies no deben arrastrar el bundle de
 * gráficos por unos perfiles marginales.
 */
import { Fragment } from "react";
import { fmtInt } from "../../../sharedCore";
import { tip } from "./TooltipGrafico";
import "./graficos.css";

export const pct = (value: number | null | undefined, dec = 1) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : `${(value * 100).toFixed(dec)}%`;

/** Una categoría dentro de un criterio, con su peso en el conjunto. */
export type CategoriaGrafico = {
  categoria: string;
  n: number;
  pct: number | null;
};

/** El reparto de un grupo (una facultad, normalmente) entre las categorías. */
export type FilaComposicion = {
  grupo: string;
  n: number;
  reparto: (CategoriaGrafico & { detalle?: string })[];
};

export type ComposicionDatos = {
  criterio_label: string;
  categorias: CategoriaGrafico[];
  filas: FilaComposicion[];
};

/**
 * Barra de tasa: escala fija de 0 a 100 %, misma altura y mismo lugar para la
 * cifra. `detalle` lleva el numerador y el denominador, porque un porcentaje
 * sin su base no se puede verificar ni comparar.
 */
export function BarraTasa({
  label,
  detalle,
  valor,
  tono,
}: {
  label: string;
  detalle?: string;
  valor: number | null;
  tono: "asistencia" | "descuento" | "meta";
}) {
  const ancho = valor !== null && Number.isFinite(valor) ? Math.max(0, Math.min(100, valor * 100)) : 0;
  return (
    <span className="cmv2-graf-tasa" data-tono={tono}>
      <span className="cmv2-graf-tasa-label">
        {label}
        {detalle ? <em>{detalle}</em> : null}
      </span>
      <span className="cmv2-graf-tasa-track">
        <span style={{ width: `${ancho}%` }} />
      </span>
      <span className="cmv2-graf-tasa-cifra">{pct(valor, 0)}</span>
    </span>
  );
}

/**
 * Composición de un conjunto por criterio, cruzada con el grupo que lo ordena.
 *
 * Responde «cuántas hay de cada tipo», que es distinto de «cómo rindió cada
 * tipo» y hace falta para leer lo segundo: un criterio con buen rendimiento
 * sobre tres aulas no mueve el operativo.
 *
 * El cruce con facultad es lo que de verdad se usa al dimensionar, porque una
 * facultad con muchos talleres no se parece a una con clases teóricas grandes y
 * repartir la muestra como si se parecieran descuadra las cuotas.
 */
export function ComposicionCriterio({
  composicion,
  referencia,
}: {
  composicion: ComposicionDatos;
  /**
   * Reparto de otro conjunto (el marco vigente, o el estudio del año pasado)
   * dibujado como marcas finas sobre la barra. Acompaña, no compite: el dato
   * del conjunto propio es la barra.
   */
  referencia?: { categoria: string; pct: number | null }[];
}) {
  // Un criterio cuyos valores son todos números es ordinal: se ordena por su
  // valor, no alfabéticamente («10» antes que «2»), y se nombra con el criterio
  // delante, porque un «6» suelto no dice qué mide.
  const numerico = composicion.categorias.every((c) => /^\d+([.,]\d+)?$/.test(c.categoria.trim()));
  const categorias = numerico
    ? [...composicion.categorias].sort((a, b) => Number(a.categoria) - Number(b.categoria))
    : composicion.categorias;
  const orden = categorias.map((c) => c.categoria);
  const nombrar = (categoria: string) =>
    numerico ? `${composicion.criterio_label} ${categoria}` : categoria;

  // Con pocas categorías, tonos fijos. Con muchas, o cuando el criterio es
  // ordinal, un recorrido por la paleta categórica del sistema.
  const tonos = ["a", "b", "c", "d", "e", "f"];
  const rampa = numerico || orden.length > tonos.length;
  const tonoDe = (categoria: string) => tonos[Math.max(0, orden.indexOf(categoria)) % tonos.length];

  // Siete anclas, en orden de tono. Una rampa de dos anclas sobre diez
  // categorías se lee como degradado: los vecinos quedan a un paso y no se
  // distinguen. Con siete, dos categorías contiguas siempre caen en familias
  // distintas, y el recorrido sigue siendo monótono.
  const ANCLAS = [
    "var(--pulso-accent-violet)",
    "var(--pulso-accent-sky)",
    "var(--pulso-accent-cyan)",
    "var(--pulso-accent-green)",
    "var(--pulso-accent-amber)",
    "var(--pulso-accent-rose)",
    "var(--pulso-accent-steel)",
  ];
  const estiloDe = (categoria: string) => {
    if (!rampa) return undefined;
    const i = Math.max(0, orden.indexOf(categoria));
    const t = i / Math.max(1, orden.length - 1);
    const paso = t * (ANCLAS.length - 1);
    const base = Math.min(ANCLAS.length - 2, Math.floor(paso));
    const mezcla = Math.round((1 - (paso - base)) * 100);
    // Alternar claro y oscuro entre vecinos añade una segunda señal además del
    // tono, que es lo que separa dos segmentos contiguos y estrechos.
    const ajuste = i % 2 === 0 ? "white 0%" : "black 14%";
    return {
      ["--cmv2-graf-tono" as string]:
        `color-mix(in oklab, color-mix(in oklab, ${ANCLAS[base]} ${mezcla}%, ${ANCLAS[base + 1]}) 86%, ${ajuste})`,
    };
  };

  // El orden de los grupos tiene que contar algo. Con un criterio ordinal, su
  // valor promedio: los de categorías bajas quedan juntos y los de altas
  // también, así el recorrido se lee en diagonal. Con uno nominal, cuánto pesa
  // la primera categoría, que es la que encabeza la leyenda.
  const peso = (f: FilaComposicion) => {
    if (!numerico) return f.reparto.find((r) => r.categoria === orden[0])?.pct ?? 0;
    const total = f.reparto.reduce((acc, r) => acc + r.n, 0);
    if (!total) return 0;
    return f.reparto.reduce((acc, r) => acc + Number(r.categoria) * r.n, 0) / total;
  };
  const filas = [...composicion.filas].sort((a, b) =>
    numerico ? peso(a) - peso(b) : peso(b) - peso(a),
  );

  // Las marcas de referencia se acumulan: la de una categoría cae donde termina
  // su tramo si el conjunto de referencia tuviera esa misma composición.
  const marcas: { categoria: string; acumulado: number }[] = [];
  if (referencia?.length) {
    let acumulado = 0;
    for (const categoria of orden) {
      acumulado += referencia.find((r) => r.categoria === categoria)?.pct ?? 0;
      marcas.push({ categoria, acumulado });
    }
  }

  return (
    <div className="cmv2-graf-comp">
      <ul className="cmv2-graf-comp-leyenda">
        {categorias.map((categoria) => (
          <li
            key={categoria.categoria}
            data-tono={rampa ? undefined : tonoDe(categoria.categoria)}
            style={estiloDe(categoria.categoria)}
          >
            <span>{nombrar(categoria.categoria)}</span>
            <b>{fmtInt(categoria.n)}</b>
            <em>{pct(categoria.pct, 0)}</em>
          </li>
        ))}
      </ul>
      <ol className="cmv2-graf-comp-filas">
        {filas.map((fila) => (
          <li key={fila.grupo}>
            <span className="cmv2-graf-comp-nombre">{fila.grupo}</span>
            <span className="cmv2-graf-comp-k">{fmtInt(fila.n)}</span>
            <span className="cmv2-graf-comp-track">
              {orden
                .map((categoria) => fila.reparto.find((r) => r.categoria === categoria))
                .filter((r): r is NonNullable<typeof r> => Boolean(r) && (r?.n ?? 0) > 0)
                .map((r) => (
                  <span
                    key={r.categoria}
                    data-tono={rampa ? "rampa" : tonoDe(r.categoria)}
                    style={{ width: `${(r.pct ?? 0) * 100}%`, ...estiloDe(r.categoria) }}
                    {...tip({
                      titulo: nombrar(r.categoria),
                      filas: [
                        { label: "Cursos-horario", valor: `${fmtInt(r.n)} de ${fmtInt(fila.n)}` },
                        { label: "Del total del grupo", valor: pct(r.pct, 0) },
                        ...(r.detalle ? [{ label: "Elegibles", valor: r.detalle }] : []),
                      ],
                      nota: fila.grupo,
                    })}
                  />
                ))}
              {marcas.slice(0, -1).map((marca) => (
                <Fragment key={marca.categoria}>
                  <span
                    className="cmv2-graf-comp-marca"
                    style={{ left: `${Math.min(100, marca.acumulado * 100)}%` }}
                    aria-hidden="true"
                  />
                </Fragment>
              ))}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Construye la composición de un conjunto de filas cruzando dos columnas.
 *
 * Devuelve null cuando el criterio tiene una sola categoría: un criterio que no
 * varía no describe nada, y dibujar una barra al 100 % sólo gasta pantalla.
 */
export function componerCriterio({
  filas,
  criterio,
  grupo,
  label,
  peso,
}: {
  filas: Record<string, unknown>[];
  criterio: (fila: Record<string, unknown>) => string;
  grupo: (fila: Record<string, unknown>) => string;
  label: string;
  /** Cifra que acompaña a la categoría en el hover; normalmente, elegibles. */
  peso?: (fila: Record<string, unknown>) => number;
}): ComposicionDatos | null {
  if (!filas.length) return null;
  const valores = filas.map(criterio);
  const categorias = [...new Set(valores)].sort();
  if (categorias.length < 2) return null;

  const grupos = filas.map(grupo);
  const total = filas.length;
  const contar = (indices: number[], categoria: string) =>
    indices.filter((i) => valores[i] === categoria).length;

  return {
    criterio_label: label,
    categorias: categorias.map((categoria) => {
      const n = valores.filter((v) => v === categoria).length;
      return { categoria, n, pct: total > 0 ? n / total : null };
    }),
    filas: [...new Set(grupos)].sort().map((nombre) => {
      const indices = grupos.map((g, i) => (g === nombre ? i : -1)).filter((i) => i >= 0);
      return {
        grupo: nombre,
        n: indices.length,
        reparto: categorias.map((categoria) => {
          const propios = indices.filter((i) => valores[i] === categoria);
          return {
            categoria,
            n: propios.length,
            pct: indices.length > 0 ? propios.length / indices.length : null,
            detalle: peso
              ? fmtInt(propios.reduce((acc, i) => acc + (peso(filas[i]!) || 0), 0))
              : undefined,
          };
        }).filter((r) => contar(indices, r.categoria) >= 0),
      };
    }),
  };
}
