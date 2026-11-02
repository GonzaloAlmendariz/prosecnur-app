import { useState } from "react";
import type { ExploradorDist } from "../../../../api/validacionExplorar";
import { estiloConVariables } from "./estiloConVariables";
import { divergente, esFueraDeLista, esResidual, fmtN, fmtPct, ordenarFilas, type Divergente } from "./explorarModelo";

const VISIBLES = 15;

/**
 * E6 — única y múltiple: barras horizontales propias (no Plotly), ordenadas
 * por frecuencia con «Otro»/«No sabe» al final y «Sin respuesta» aparte,
 * fuera de la base del porcentaje. Una lista ordinal respeta su orden y suma
 * arriba la barra divergente; una múltiple suma abajo cuántas opciones marca
 * cada caso.
 */
export default function DistribucionBarras({
  dist,
  sinRespuesta,
  declarados = null,
}: {
  dist: ExploradorDist;
  sinRespuesta: number | null;
  /** Códigos de la lista según la ficha; sin ella, se infieren de la cola. */
  declarados?: ReadonlySet<string> | null;
}) {
  const [todas, setTodas] = useState(false);
  const fuera = esFueraDeLista(dist.filas ?? [], declarados);
  const filas = ordenarFilas(dist.filas ?? [], dist.ordinal, declarados);
  const visibles = todas ? filas : filas.slice(0, VISIBLES);
  const max = Math.max(0, ...filas.map((f) => f.pct));
  const div = dist.ordinal && dist.tipo === "so" ? divergente(filas.filter((f) => !fuera(f))) : null;
  const top = filas.find((f) => !esResidual(f.etiqueta) && !fuera(f));

  return (
    <div className="vx-barras">
      {div && <BarraDivergente div={div} />}
      {visibles.map((f) => (
        <div
          key={`${f.codigo}-${f.etiqueta}`}
          className={`vx-barra-fila${f === top && !dist.ordinal ? " is-primera" : ""}${esResidual(f.etiqueta) || fuera(f) ? " is-residual" : ""}`}
        >
          <span className="vx-barra-etq">
            {fuera(f) ? <><span className="vx-mono">{f.etiqueta}</span> · fuera de la lista</> : f.etiqueta}
          </span>
          <span className="vx-pista" aria-hidden>
            <span className="vx-relleno" style={{ width: `${max > 0 ? (100 * f.pct) / max : 0}%` }} />
          </span>
          <span className="vx-barra-pct">{fmtPct(f.pct)}</span>
          <span className="vx-barra-n">{fmtN(f.n)}</span>
        </div>
      ))}
      {filas.length > VISIBLES && (
        <button type="button" className="vx-ver-mas" aria-expanded={todas} onClick={() => setTodas((t) => !t)}>
          {todas ? "Ver menos" : `Ver las ${filas.length} opciones`}
        </button>
      )}
      {sinRespuesta !== null && (
        <div className="vx-barra-fila is-sin">
          <span className="vx-barra-etq">Sin respuesta</span>
          <span className="vx-pista">fuera de la base del porcentaje</span>
          <span className="vx-barra-pct">—</span>
          <span className="vx-barra-n">{fmtN(sinRespuesta)}</span>
        </div>
      )}
      {dist.tipo === "sm" && dist.cuantas_marca && dist.cuantas_marca.length > 0 && (
        <div className="vx-cuantas" aria-label="Cuántas opciones marca cada caso">
          {dist.cuantas_marca.map((c) => (
            <span key={c.k}>
              {c.k === "1" ? "1 opción" : c.k === "2" ? "2 opciones" : "3 o más"} · {fmtPct(c.pct)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function BarraDivergente({ div }: { div: Divergente }) {
  return (
    <div className="vx-div">
      <div className="vx-div-resumen">
        <span className="is-baja">Hacia «{div.baja.etiqueta}» {fmtPct(div.baja.pct)}</span>
        {div.centro && <span className="is-centro">{div.centro.etiqueta} {fmtPct(div.centro.pct)}</span>}
        <span className="is-alta">Hacia «{div.alta.etiqueta}» {fmtPct(div.alta.pct)}</span>
      </div>
      <div className="vx-div-barra" role="img" aria-label={div.segmentos.map((s) => `${s.fila.etiqueta} ${fmtPct(s.fila.pct)}`).join(", ")}>
        {div.segmentos.map((s) => (
          <span
            key={`${s.fila.codigo}-${s.fila.etiqueta}`}
            className={`vx-div-seg is-${s.lado}`}
            title={`${s.fila.etiqueta} · ${fmtPct(s.fila.pct)}`}
            style={estiloConVariables({ "--vx-int": `${Math.round(35 + 60 * s.intensidad)}%` }, { flexBasis: `${s.fila.pct}%`, flexGrow: 0 })}
          />
        ))}
      </div>
    </div>
  );
}
