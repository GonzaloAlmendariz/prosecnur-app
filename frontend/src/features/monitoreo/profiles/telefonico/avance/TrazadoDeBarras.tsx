import { escalaDeEje } from "./escalaDeEje";
import { fechaCorta } from "./ritmoModel";

function n(valor: number) {
  return valor.toLocaleString("es-PE");
}

/** Alto aproximado de la cifra sobre la barra, en % del área (16 px sobre ~180–250 px). */
export const ALTO_CIFRA_PCT = 9;

/**
 * Dónde va la cifra de una barra para no quedar tachada por la línea de la
 * meta: sobre la barra si la línea no la cruza; si la cruza, justo encima de
 * la línea. Las dos alturas vienen en % del área, aunque la barra use la
 * escala izquierda y la meta la derecha (PDM: el «109» del 02/07 quedaba
 * atravesado por «Meta 400»).
 */
export function alturaDeCifra(altoBarra: number, referencia: number | null, altoCifra = ALTO_CIFRA_PCT, holgura = 1.5) {
  if (referencia == null) return altoBarra;
  const cruza = referencia >= altoBarra - holgura && referencia <= altoBarra + altoCifra + holgura;
  return cruza ? referencia + holgura : altoBarra;
}

export type ColumnaDelTrazado = {
  fecha: string;
  total: number;
  segmentos: ReadonlyArray<{ clase: string; valor: number }>;
  titulo: string;
  /** Columna atenuada (la hoja ya no registra ese día). */
  apagada?: boolean;
};

export type EjeDerecho = {
  titulo: string;
  /** Valor acumulado por columna, en el mismo orden; `null` si no aplica. */
  valores: ReadonlyArray<number | null>;
  /** Referencia horizontal en la escala derecha (la meta). */
  referencia?: { valor: number; rotulo: string } | null;
  /** Valor final del acumulado, en pastilla sobre el eje («423 de 400»). */
  rotuloFinal?: string;
};

/**
 * Barras apiladas por día con su eje izquierdo (marcas, título y grid tenue)
 * y, si se pide, un eje derecho con escala propia para una serie acumulada y
 * su referencia (la meta). Toma del gráfico de ritmo anterior al revamp el
 * doble eje con títulos («Efectivas/día» y «Acumulado»), el grid horizontal y
 * los puntos marcados de la línea acumulada, y lo pinta con tokens `--pulso-*`
 * en lugar de Plotly.
 */
export function TrazadoDeBarras({
  columnas,
  tituloIzquierdo,
  derecho,
  bajo = false,
  banda = null,
}: {
  columnas: readonly ColumnaDelTrazado[];
  tituloIzquierdo: string;
  derecho?: EjeDerecho | null;
  bajo?: boolean;
  /** Desde qué columna se sombrea una banda (por ejemplo, la hoja ya no registra). */
  banda?: { desde: number; rotulo: string } | null;
}) {
  const izquierda = escalaDeEje(Math.max(0, ...columnas.map((columna) => columna.total)));
  const maximoDerecho = derecho
    ? Math.max(0, derecho.referencia?.valor ?? 0, ...derecho.valores.map((valor) => valor ?? 0))
    : 0;
  const derecha = derecho ? escalaDeEje(maximoDerecho) : null;
  const columnasCss = `repeat(${Math.max(1, columnas.length)}, minmax(0, 1fr))`;
  const x = (i: number) => ((i + 0.5) / Math.max(1, columnas.length)) * 100;
  const puntos = derecho && derecha
    ? derecho.valores
      .map((valor, i) => (valor == null ? null : { x: x(i), y: (valor / derecha.tope) * 100, valor, i }))
      .filter((punto): punto is { x: number; y: number; valor: number; i: number } => punto != null)
    : [];
  const ultimo = puntos.at(-1) ?? null;
  const referencia = derecho?.referencia && derecha ? (derecho.referencia.valor / derecha.tope) * 100 : null;

  return (
    <div className={`mon-trazado${derecho ? " con-derecho" : ""}${bajo ? " is-bajo" : ""}`}>
      <div className="mon-trazado-eje is-izquierdo" aria-hidden="true">
        <span className="mon-trazado-titulo">{tituloIzquierdo}</span>
        {izquierda.marcas.map((marca) => (
          <span key={marca} className="mon-trazado-marca" style={{ bottom: `${(marca / izquierda.tope) * 100}%` }}>{n(marca)}</span>
        ))}
      </div>

      <div className="mon-trazado-area">
        {izquierda.marcas.map((marca) => (
          <i key={marca} className={`mon-trazado-grid${marca === 0 ? " is-base" : ""}`} style={{ bottom: `${(marca / izquierda.tope) * 100}%` }} />
        ))}
        <div className="mon-trazado-columnas" style={{ gridTemplateColumns: columnasCss }}>
          {banda && banda.desde < columnas.length ? (
            <div className="mon-trazado-banda" style={{ gridColumn: `${banda.desde + 1} / -1` }}>
              <span>{banda.rotulo}</span>
            </div>
          ) : null}
          {columnas.map((columna, i) => {
            const alto = (columna.total / izquierda.tope) * 100;
            return (
              <div key={columna.fecha} className={`mon-trazado-columna${columna.apagada ? " is-apagada" : ""}`} title={columna.titulo} style={{ gridColumn: `${i + 1}` }}>
                <div className="mon-trazado-pila" style={{ height: `${alto}%` }}>
                  {columna.segmentos.map((segmento) => (
                    segmento.valor ? <i key={segmento.clase} className={segmento.clase} style={{ flexGrow: segmento.valor }} /> : null
                  ))}
                </div>
                {columna.apagada ? null : (
                  <span className="mon-trazado-cifra" style={{ bottom: `${alturaDeCifra(alto, referencia)}%` }}>{n(columna.total)}</span>
                )}
              </div>
            );
          })}
        </div>

        {derecho && derecha ? (
          <>
            {derecho.referencia ? (
              <span className="mon-trazado-referencia" style={{ bottom: `${(derecho.referencia.valor / derecha.tope) * 100}%` }} />
            ) : null}
            <svg className="mon-trazado-linea" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polyline points={puntos.map((punto) => `${punto.x},${100 - punto.y}`).join(" ")} vectorEffect="non-scaling-stroke" />
            </svg>
            {puntos.map((punto) => (
              <i key={punto.i} className="mon-trazado-punto" style={{ left: `${punto.x}%`, bottom: `${punto.y}%` }} title={`${n(punto.valor)} acumuladas`} />
            ))}
          </>
        ) : null}
      </div>

      {derecho && derecha ? (
        <div className="mon-trazado-eje is-derecho" aria-hidden="true">
          {/* Una sola lectura del acumulado: su valor final, en una pastilla
            * anclada al eje a su altura. Las marcas que caerían debajo se
            * omiten para que nada se pise. */}
          {derecha.marcas
            .filter((marca) => !ultimo || !derecho.rotuloFinal || Math.abs((marca / derecha.tope) * 100 - ultimo.y) > 8)
            .map((marca) => (
              <span key={marca} className="mon-trazado-marca" style={{ bottom: `${(marca / derecha.tope) * 100}%` }}>{n(marca)}</span>
            ))}
          {ultimo && derecho.rotuloFinal ? (
            <span className="mon-trazado-pastilla" style={{ bottom: `${ultimo.y}%` }}>{derecho.rotuloFinal}</span>
          ) : null}
          <span className="mon-trazado-titulo">{derecho.titulo}</span>
        </div>
      ) : null}

      <div className="mon-trazado-fechas" style={{ gridTemplateColumns: columnasCss }}>
        {columnas.map((columna) => <span key={columna.fecha}>{fechaCorta(columna.fecha)}</span>)}
      </div>
    </div>
  );
}
