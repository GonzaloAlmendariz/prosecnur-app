import type { ExploradorCruceTabla, ExploradorTipo } from "../../../../api/validacionExplorar";
import { escalaDesdeCero, proyectar } from "./escalas";
import { esResidual, fmtDecimal, fmtN, fmtPct, UMBRAL_PUNTOS } from "./explorarModelo";
import { useAncho } from "./useAncho";

/** Bajo este número de casos un grupo no se dibuja: su % salta con un caso (se nombra en la nota). */
export const GRUPO_CHICO = 30;
/** Con más grupos firmes que estos, los puntos se encimarían: el par se lee en la tabla de calor. */
export const MAX_GRUPOS = 3;

export type OpcionEnfrentada = { etiqueta: string; valores: number[]; total: number; brecha: number };
export type Enfrentados = {
  grupos: { etiqueta: string; n: number }[];
  chicos: { etiqueta: string; n: number }[];
  opciones: OpcionEnfrentada[];
};

/**
 * Única × múltiple en los dos sentidos (E8b, E8c): por opción de la múltiple, el % de los casos de cada grupo de la
 * única que la marca (denominador = casos del grupo, revisión metodológica) y el % de la base como total. Null si
 * no aplica: sin `n` por grupo, o con más de tres grupos firmes.
 */
export function enfrentados(tabla: ExploradorCruceTabla, tipoX: ExploradorTipo, tipoY: ExploradorTipo, baseN: number): Enfrentados | null {
  if (!(baseN > 0)) return null;
  const xUnica = tipoX === "so" && tipoY === "sm";
  const yUnica = tipoX === "sm" && tipoY === "so";
  if (!xUnica && !yUnica) return null;
  const gruposTodos = xUnica
    ? tabla.filas.map((f, i) => ({ etiqueta: f.etiqueta, n: f.n, i }))
    : tabla.columnas.map((c, i) => ({ etiqueta: c.etiqueta, n: c.n as number | null, i }));
  // Sin los casos por grupo, o por opción en sm × so, no hay denominador honesto: cae a la tabla.
  if (gruposTodos.some((g) => g.n === null)) return null;
  if (yUnica && tabla.filas.some((f) => f.n === null)) return null;
  const firmes = gruposTodos.filter((g) => (g.n ?? 0) >= GRUPO_CHICO);
  if (firmes.length < 2 || firmes.length > MAX_GRUPOS) return null;
  const opcionesBase = xUnica
    ? tabla.columnas.map((c, j) => ({ etiqueta: c.etiqueta, casos: c.n, celda: (g: number) => tabla.n[g][j] }))
    : tabla.filas.map((f, j) => ({ etiqueta: f.etiqueta, casos: f.n ?? 0, celda: (g: number) => tabla.n[j][g] }));
  const opciones = opcionesBase.map((o) => {
    const valores = firmes.map((g) => (100 * o.celda(g.i)) / (g.n as number));
    return { etiqueta: o.etiqueta, valores, total: (100 * o.casos) / baseN, brecha: Math.max(...valores) - Math.min(...valores) };
  });
  const ordenadas = [...opciones].sort((a, b) => b.total - a.total);
  return {
    grupos: firmes.map((g) => ({ etiqueta: g.etiqueta, n: g.n as number })),
    chicos: gruposTodos.filter((g) => (g.n ?? 0) < GRUPO_CHICO).map((g) => ({ etiqueta: g.etiqueta, n: g.n as number })),
    opciones: [...ordenadas.filter((o) => !esResidual(o.etiqueta)), ...ordenadas.filter((o) => esResidual(o.etiqueta))],
  };
}

const TONOS = ["var(--vx-g1)", "var(--vx-g2)", "var(--vx-g3)"];

/**
 * Puntos enfrentados: una fila por opción, un punto por grupo sobre la misma escala de %, el total como trazo
 * vertical y la brecha escrita al final. Las filas donde los grupos se separan 5 puntos o más se destacan y llevan
 * sus dos cifras: responde de un vistazo si los grupos marcan distinto.
 */
export default function CruceEnfrentados({ datos }: { datos: Enfrentados }) {
  const [ref, ancho] = useAncho<HTMLDivElement>();
  const W = Math.max(320, ancho);
  const arriba = W < 600;
  const largo = Math.max(...datos.opciones.map((o) => o.etiqueta.length));
  const izq = arriba ? 0 : Math.min(Math.round(W * 0.36), Math.max(140, largo * 7.6 + 22));
  const fila = arriba ? 62 : 34;
  const util = W - izq - (arriba ? 70 : 84);
  const e = escalaDesdeCero(Math.max(...datos.opciones.flatMap((o) => o.valores)), 5);
  const X = (v: number) => izq + proyectar(v, e, util);
  const alto = datos.opciones.length * fila + 4;
  const H = alto + 26;
  return (
    <>
      <div ref={ref} className="vx-svg-caja">
        <svg className="vx-svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Porcentaje que marca cada opción, por ${datos.grupos.map((g) => g.etiqueta).join(" y ")}`}>
          {e.marcas.map((v) => (
            <g key={v}>
              <line className="vx-svg-rejilla is-vertical" x1={X(v)} x2={X(v)} y1={0} y2={alto} />
              <text className="vx-svg-marca" x={X(v)} y={alto + 18} textAnchor="middle">{`${fmtN(v)}%`}</text>
            </g>
          ))}
          <line className="vx-svg-eje" x1={izq} x2={izq + util} y1={alto} y2={alto} />
          {datos.opciones.map((o, i) => {
            const y = 4 + i * fila + (arriba ? 34 : fila / 2);
            const lo = Math.min(...o.valores);
            const hi = Math.max(...o.valores);
            const destaca = o.brecha >= UMBRAL_PUNTOS;
            const medio = (X(lo) + X(hi)) / 2;
            const cy = arriba ? y + 23 : y - 11;
            return (
              <g key={o.etiqueta}>
                <title>
                  {[o.etiqueta, ...datos.grupos.map((g, k) => `${g.etiqueta}: ${fmtPct(o.valores[k])} de sus ${fmtN(g.n)} casos`), `Total: ${fmtPct(o.total)}`].join("\n")}
                </title>
                {destaca && (
                  <rect className="vx-svg-fila-destacada" x={arriba ? -6 : izq - 8} y={y - (arriba ? 30 : 15)} width={arriba ? W + 12 : W - izq + 14} height={arriba ? 60 : 30} rx={6} />
                )}
                <text className={`vx-svg-categoria${destaca ? " is-fuerte" : ""}`} x={arriba ? 0 : izq - 14} y={arriba ? y - 15 : y + 4} textAnchor={arriba ? "start" : "end"}>
                  {o.etiqueta}
                </text>
                <line className="vx-svg-tramo" x1={X(lo)} x2={X(hi)} y1={y} y2={y} />
                <line className="vx-svg-total" x1={X(o.total)} x2={X(o.total)} y1={y - 9} y2={y + 9} />
                {o.valores.map((v, k) => (
                  <circle key={k} className="vx-svg-punto-grupo" cx={X(v)} cy={y} r={6.5} style={{ fill: TONOS[k] }} />
                ))}
                {destaca &&
                  o.valores.map((v, k) =>
                    v === lo ? (
                      <text key={`v${k}`} className="vx-svg-valor" x={Math.min(X(v) + 4, medio - 3)} y={cy} textAnchor="end">{`${Math.round(v)}%`}</text>
                    ) : v === hi ? (
                      <text key={`v${k}`} className="vx-svg-valor" x={Math.max(X(v) - 4, medio + 3)} y={cy} textAnchor="start">{`${Math.round(v)}%`}</text>
                    ) : null,
                  )}
                <text className={destaca ? "vx-svg-anota" : "vx-svg-marca"} x={X(hi) + 14} y={y + 4}>{`${fmtDecimal(o.brecha, 1)} pts`}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="vx-leyenda">
        {datos.grupos.map((g, k) => (
          <span key={g.etiqueta}>
            <i className="vx-muestra is-punto" style={{ background: TONOS[k] }} aria-hidden />
            {g.etiqueta}, {fmtN(g.n)} {g.n === 1 ? "caso" : "casos"}
          </span>
        ))}
        <span><i className="vx-muestra is-total" aria-hidden />Total</span>
      </div>
      {datos.chicos.length > 0 && (
        <p className="vx-pie">
          {datos.chicos.map((g) => `"${g.etiqueta}" (${fmtN(g.n)} ${g.n === 1 ? "caso" : "casos"})`).join(", ")} no se dibuja: con menos de {GRUPO_CHICO} casos, su porcentaje salta con un caso.
        </p>
      )}
    </>
  );
}
