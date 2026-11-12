import { useState } from "react";
import type { ExploradorDist, ExploradorDistFila } from "../../../../api/validacionExplorar";
import { estiloConVariables } from "./estiloConVariables";
import { divergente, esFueraDeLista, esResidual, fmtN, fmtPct, ordenarFilas, type Divergente } from "./explorarModelo";
import { formatoConteo } from "../../../../lib/formatoNumero";
import type { LecturaDeDistribucion } from "./lecturaDeDistribucion";

const VISIBLES = 15;

/** Puntos que la primera tiene que sacarle a la segunda para ir en navy: menos sería inventar una mayoría. */
export const VENTAJA_MAYOR = 2;

/**
 * E6 — única y múltiple: barras horizontales propias (no Plotly), ordenadas
 * por frecuencia con «Otro»/«No sabe» al final y «Sin respuesta» aparte,
 * fuera de la base del porcentaje. La pista es la escala de 0 a 100 %; la
 * primera va en navy sólo si le saca 2 puntos a la segunda, las demás en el
 * apoyo y las residuales en gris (estándar del motor de Gráficos). Una lista
 * ordinal respeta su orden y suma arriba la barra divergente; una múltiple
 * suma abajo cuántas opciones marca cada caso. Con `valor = "casos"` la cifra
 * fuerte de cada barra es el conteo y el porcentaje pasa al costado.
 */
export default function DistribucionBarras({
  dist,
  sinRespuesta,
  declarados = null,
  valor = "porcentaje",
}: {
  dist: ExploradorDist;
  sinRespuesta: number | null;
  valor?: LecturaDeDistribucion["valor"];
  /** Códigos de la lista según la ficha; sin ella, se infieren de la cola. */
  declarados?: ReadonlySet<string> | null;
}) {
  const [todas, setTodas] = useState(false);
  const fuera = esFueraDeLista(dist.filas ?? [], declarados);
  const filas = ordenarFilas(dist.filas ?? [], dist.ordinal, declarados);
  const visibles = todas ? filas : filas.slice(0, VISIBLES);
  const div = dist.ordinal && dist.tipo === "so" ? divergente(filas.filter((f) => !fuera(f))) : null;
  const sustantivas = filas.filter((f) => !esResidual(f.etiqueta) && !fuera(f));
  const top = sustantivas[0];
  const gana = !dist.ordinal && !!top && top.pct - (sustantivas[1]?.pct ?? 0) >= VENTAJA_MAYOR;

  // Una escala se lee en su barra divergente, con la cifra en cada tramo y la leyenda debajo: repetirla en cinco
  // barras sueltas decía lo mismo dos veces.
  // «No sabe», «Sin información» y los códigos fuera de la lista no son parte de la escala, pero tampoco se
  // esconden: cierran la barra en gris, después de un corte, y la leyenda los nombra.
  if (div) return <BarraDivergente div={div} aparte={filas.filter((f) => esResidual(f.etiqueta) || fuera(f))} valor={valor} />;
  const casos = valor === "casos";

  return (
    <div className="vx-barras" data-qa-geometry-group="validacion/explorar-barras" data-qa-geometry-contract="intrinsic">
      {visibles.map((f) => (
        <div
          key={`${f.codigo}-${f.etiqueta}`}
          className={`vx-barra-fila${f === top && gana ? " is-primera" : ""}${esResidual(f.etiqueta) || fuera(f) ? " is-residual" : ""}`}
        >
          <span className="vx-barra-etq">
            {fuera(f) ? <><span className="vx-mono">{f.etiqueta}</span> (fuera de la lista)</> : f.etiqueta}
          </span>
          <span className="vx-pista" aria-hidden>
            <span className="vx-relleno" style={{ width: `${Math.max(f.n > 0 ? 0.6 : 0, Math.min(100, f.pct))}%` }} />
          </span>
          <span className="vx-barra-pct">{casos ? fmtN(f.n) : fmtPct(f.pct)}</span>
          <span className="vx-barra-n">{casos ? fmtPct(f.pct) : fmtN(f.n)}</span>
        </div>
      ))}
      {filas.length > VISIBLES && (
        <button type="button" className="vx-ver-mas" aria-expanded={todas} onClick={() => setTodas((t) => !t)}>
          {todas ? "Ver menos" : `Ver las ${formatoConteo(filas.length)} opciones`}
        </button>
      )}
      {sinRespuesta !== null && (
        <div className="vx-barra-fila is-sin">
          <span className="vx-barra-etq">Sin respuesta</span>
          <span className="vx-pista">fuera de la base del porcentaje</span>
          {/* Sin respuesta no tiene porcentaje: queda fuera de la base. */}
          <span className="vx-barra-pct">{casos ? fmtN(sinRespuesta) : ""}</span>
          <span className="vx-barra-n">{casos ? "" : fmtN(sinRespuesta)}</span>
        </div>
      )}
      {dist.tipo === "sm" && dist.cuantas_marca && dist.cuantas_marca.length > 0 && (
        <div className="vx-cuantas" aria-label="Cuántas opciones marca cada caso">
          {dist.cuantas_marca.map((c) => (
            <span key={c.k}>
              {c.k === "1" ? "1 opción" : c.k === "2" ? "2 opciones" : "3 o más"}: {fmtPct(c.pct)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function BarraDivergente({
  div,
  aparte,
  valor,
}: {
  div: Divergente;
  aparte: readonly ExploradorDistFila[];
  valor: LecturaDeDistribucion["valor"];
}) {
  // En casos, cada tramo lleva su conteo; el resumen de las mitades sigue en porcentaje, que es lo que compara.
  const rotulo = (f: ExploradorDistFila) => (f.pct < 6 ? "" : valor === "casos" ? fmtN(f.n) : `${Math.round(f.pct)}%`);
  return (
    <div className="vx-div">
      <div className="vx-div-resumen">
        <span className="is-baja"><b>{fmtPct(div.baja.pct)}</b>{div.baja.etiqueta}</span>
        {div.centro && <span className="is-centro"><b>{fmtPct(div.centro.pct)}</b>{div.centro.etiqueta}</span>}
        <span className="is-alta"><b>{fmtPct(div.alta.pct)}</b>{div.alta.etiqueta}</span>
      </div>
      <div className="vx-div-barra" role="img" aria-label={div.segmentos.map((s) => `${s.fila.etiqueta} ${fmtPct(s.fila.pct)}`).join(", ")}>
        {div.segmentos.map((s) => (
          <span
            key={`${s.fila.codigo}-${s.fila.etiqueta}`}
            className={`vx-div-seg is-${s.lado}`}
            title={`${s.fila.etiqueta}: ${fmtPct(s.fila.pct)}, ${fmtN(s.fila.n)} ${s.fila.n === 1 ? "caso" : "casos"}`}
            style={estiloConVariables({ "--vx-int": `${Math.round(35 + 60 * s.intensidad)}%` }, { flexBasis: `${s.fila.pct}%`, flexGrow: 0 })}
          >
            {rotulo(s.fila)}
          </span>
        ))}
        {aparte.map((f, i) => (
          <span
            key={`aparte-${f.codigo}-${f.etiqueta}`}
            className={`vx-div-seg is-aparte${i === 0 ? " is-corte" : ""}`}
            title={`${f.etiqueta}: ${fmtPct(f.pct)}, ${fmtN(f.n)} ${f.n === 1 ? "caso" : "casos"}`}
            style={{ flexBasis: `${f.pct}%`, flexGrow: 0 }}
          >
            {rotulo(f)}
          </span>
        ))}
      </div>
      <div className="vx-leyenda">
        {div.segmentos.map((s) => (
          <span key={`${s.fila.codigo}-${s.fila.etiqueta}`}>
            <i
              className={`vx-div-seg is-${s.lado}`}
              aria-hidden
              style={estiloConVariables({ "--vx-int": `${Math.round(35 + 60 * s.intensidad)}%` })}
            />
            {s.fila.etiqueta}
          </span>
        ))}
        {aparte.map((f) => (
          <span key={`aparte-${f.codigo}-${f.etiqueta}`}>
            <i className="vx-div-seg is-aparte" aria-hidden />
            {f.etiqueta}
          </span>
        ))}
      </div>
    </div>
  );
}
