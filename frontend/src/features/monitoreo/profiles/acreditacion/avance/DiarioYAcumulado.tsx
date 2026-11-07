import { fmt } from "../formato";
import { marcasDeEje } from "./avanceModelo";
import { ALTO_DEL_EJE_DE_FECHAS, anchoPorDia, CifraDeBarra, EjeDeFechas, fechaCorta, MarcaDeCierre, PASO_MAXIMO_POR_DIA, useTamano } from "./graficosDeAvance";
import { ejeHastaCierre } from "./cierrePrevisto";
import { altoDeCifras, letraQueCabe } from "./letraQueCabe";

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
  cierre = null,
}: {
  fechas: readonly string[];
  /** Cierre previsto (ISO): el eje llega hasta él y lo marca. */
  cierre?: string | null;
  totales: readonly number[];
  meta: number | null;
  etiqueta: string;
}) {
  const [ref, { ancho, alto }] = useTamano<HTMLDivElement>();
  const izquierda = 48;
  const derecha = 56;
  const arribaBase = 26;
  const abajo = ALTO_DEL_EJE_DE_FECHAS;
  const w = Math.max(0, ancho - izquierda - derecha);
  // Con cierre previsto el eje se estira; las series siguen siendo sólo los días con dato.
  const eje = ejeHastaCierre(fechas, cierre);
  const n = eje.fechas.length;
  const acum = acumulado(totales);
  const final = acum.at(-1) ?? 0;
  const marcasDia = marcasDeEje(Math.max(1, ...totales) * 1.05);
  const maxDia = marcasDia.at(-1) ?? 1;
  const marcasAcum = marcasDeEje(Math.max(1, final, meta ?? 0) * 1.05);
  const maxAcum = marcasAcum.at(-1) ?? 1;
  const paso = anchoPorDia(w, n, { tope: PASO_MAXIMO_POR_DIA });
  // Toda barra con su cifra (Gonzalo, 2026-11-06): lo que cede es la letra.
  const cifrasDia = totales.map((valor) => fmt(valor));
  const letraDia = letraQueCabe(paso, cifrasDia);
  // Girada, la cifra del día más alto necesita su largo encima: se reserva.
  const arriba = arribaBase + (letraDia.girar ? Math.max(0, altoDeCifras(letraDia, cifrasDia) - 12) : 0);
  const h = Math.max(0, alto - arriba - abajo);
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
          {totales.map((valor, indice) => (
            valor > 0 ? <CifraDeBarra key={`c${fechas[indice]}`} x={x(indice)} y={yDia(valor) - 4} texto={fmt(valor)} letra={letraDia} /> : null
          ))}
          {meta && meta > 0 ? (
            <g>
              <line className="acr-av-meta" x1={izquierda} x2={izquierda + w} y1={yAcum(meta)} y2={yAcum(meta)} />
              <text className="acr-av-meta-texto" x={izquierda + w - 4} y={yAcum(meta) - 6} textAnchor="end">{`Meta ${fmt(meta)}`}</text>
            </g>
          ) : null}
          <path className="acr-av-linea is-acumulado" d={linea} />
          {acum.map((valor, indice) => (
            <circle key={`p${fechas[indice]}`} className="acr-av-final is-acumulado" cx={x(indice)} cy={yAcum(valor)} r={indice === acum.length - 1 ? 4 : 2.5} />
          ))}
          <text className="acr-av-final-texto is-acumulado" x={x(acum.length - 1) + 8} y={yAcum(final) - 8}>{fmt(final)}</text>
          {eje.indiceDelCierre !== null && cierre ? (
            <MarcaDeCierre x={x(eje.indiceDelCierre)} arriba={arriba} abajo={arriba + h} fecha={cierre} alLado={eje.indiceDelCierre > n / 2 ? "izquierda" : "derecha"} />
          ) : null}
          <EjeDeFechas fechas={eje.fechas} paso={paso} x={x} alto={alto} />
        </svg>
      ) : null}
    </div>
  );
}
