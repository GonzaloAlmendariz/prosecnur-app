import { fmt } from "../formato";
import { marcasDeEje } from "./avanceModelo";
import { ALTO_DEL_EJE_DE_FECHAS, anchoPorDia, EjeDeFechas, fechaCorta, PASO_MAXIMO_POR_DIA, useTamano } from "./graficosDeAvance";

/** El acumulado día a día de una serie de totales diarios. */
export function acumulado(totales: readonly number[]): number[] {
  let suma = 0;
  return totales.map((valor) => (suma += valor));
}

/**
 * Avance › Ritmo, vista «Diario y acumulado» (Gonzalo, 30/10: «el ritmo diario
 * y el acumulado en los dos lados del eje, como hacen otros monitoreos»). Las
 * efectivas de cada día en barras contra el eje izquierdo; el acumulado en
 * línea contra el derecho, con la meta del estudio en esa misma escala.
 */
export function DiarioYAcumulado({
  fechas,
  totales,
  meta,
  etiqueta,
}: {
  fechas: readonly string[];
  totales: readonly number[];
  meta: number | null;
  etiqueta: string;
}) {
  const [ref, { ancho, alto }] = useTamano<HTMLDivElement>();
  const izquierda = 48;
  const derecha = 56;
  const arriba = 26;
  const abajo = ALTO_DEL_EJE_DE_FECHAS;
  const w = Math.max(0, ancho - izquierda - derecha);
  const h = Math.max(0, alto - arriba - abajo);
  const n = fechas.length;
  const acum = acumulado(totales);
  const final = acum.at(-1) ?? 0;
  const marcasDia = marcasDeEje(Math.max(1, ...totales) * 1.05);
  const maxDia = marcasDia.at(-1) ?? 1;
  const marcasAcum = marcasDeEje(Math.max(1, final, meta ?? 0) * 1.05);
  const maxAcum = marcasAcum.at(-1) ?? 1;
  const paso = anchoPorDia(w, n, { tope: PASO_MAXIMO_POR_DIA });
  const x = (indice: number) => izquierda + indice * paso + paso / 2;
  const yDia = (valor: number) => arriba + h - (valor / maxDia) * h;
  const yAcum = (valor: number) => arriba + h - (valor / maxAcum) * h;
  const linea = acum.map((valor, indice) => `${indice ? "L" : "M"}${x(indice).toFixed(1)},${yAcum(valor).toFixed(1)}`).join(" ");
  const listo = ancho > 0 && alto > 0 && n > 0;
  return (
    <div ref={ref} className="acr-av-grafico" role="img" aria-label={etiqueta}>
      {listo ? (
        <svg width={ancho} height={alto} aria-hidden="true">
          <text className="acr-av-eje-titulo" x={0} y={10}>Por día</text>
          <text className="acr-av-eje-titulo is-acumulado" x={ancho} y={10} textAnchor="end">Acumulado</text>
          {marcasDia.map((valor) => (
            <g key={`d${valor}`}>
              <line className="acr-av-reticula" x1={izquierda} x2={izquierda + w} y1={yDia(valor)} y2={yDia(valor)} />
              <text className="acr-av-eje" x={izquierda - 6} y={yDia(valor) + 4} textAnchor="end">{fmt(valor)}</text>
            </g>
          ))}
          {marcasAcum.map((valor) => (
            <text key={`a${valor}`} className="acr-av-eje is-acumulado" x={izquierda + w + 6} y={yAcum(valor) + 4}>{fmt(valor)}</text>
          ))}
          {totales.map((valor, indice) => (
            valor > 0 ? (
              <rect key={fechas[indice]} className="acr-av-barra" x={izquierda + indice * paso + paso * 0.16} y={yDia(valor)} width={Math.max(1, paso * 0.68)} height={yDia(0) - yDia(valor)} rx={2}>
                <title>{`${fechaCorta(fechas[indice])}: ${fmt(valor)} efectivas, ${fmt(acum[indice])} acumuladas`}</title>
              </rect>
            ) : null
          ))}
          {meta && meta > 0 ? (
            <g>
              <line className="acr-av-meta" x1={izquierda} x2={izquierda + w} y1={yAcum(meta)} y2={yAcum(meta)} />
              <text className="acr-av-meta-texto" x={izquierda + w - 4} y={yAcum(meta) - 6} textAnchor="end">{`Meta ${fmt(meta)}`}</text>
            </g>
          ) : null}
          <path className="acr-av-linea is-acumulado" d={linea} />
          {acum.map((valor, indice) => (
            <circle key={`p${fechas[indice]}`} className="acr-av-final is-acumulado" cx={x(indice)} cy={yAcum(valor)} r={indice === n - 1 ? 4 : 2.5} />
          ))}
          <text className="acr-av-final-texto is-acumulado" x={x(n - 1) + 8} y={yAcum(final) - 8}>{fmt(final)}</text>
          <EjeDeFechas fechas={fechas} paso={paso} x={x} alto={alto} />
        </svg>
      ) : null}
    </div>
  );
}
