import { estiloConVariables } from "./estiloConVariables";
import { fmtN } from "./explorarModelo";
import type { BarrasDelCruce } from "./barrasDelCruce";

/**
 * Barras agrupadas del cruce, sobre la tabla de calor (prototipo): la leyenda
 * con los casos de cada columna, una barra por columna en cada fila y, con dos
 * columnas, la diferencia en puntos.
 */
export default function CruceBarras({ barras, lectura }: { barras: BarrasDelCruce; lectura: string }) {
  return (
    <div className="vx-cruce-barras">
      <div className="vx-cruce-leyenda">
        {barras.series.map((s, i) => (
          <span key={`${s.etiqueta}-${i}`}>
            <i data-serie={i} aria-hidden />
            {s.etiqueta}, {fmtN(s.n)} {s.n === 1 ? "caso" : "casos"}
          </span>
        ))}
        <span className="vx-cruce-lectura">{lectura}</span>
      </div>
      <div className="vx-xbarras" data-qa-geometry-group="validacion/explorar-cruce-barras" data-qa-geometry-contract="equal">
        {barras.filas.map((f, r) => (
          <div
            key={`${f.etiqueta}-${r}`}
            className="vx-xbar"
            data-qa-geometry-member
            style={estiloConVariables({ "--vx-series": String(barras.series.length) })}
            role="group"
            aria-label={`${f.etiqueta}: ${f.valores.map((v, i) => `${barras.series[i]?.etiqueta} ${v.texto}`).join(", ")}`}
          >
            <span className="vx-xbar-etq" title={f.etiqueta}>{f.etiqueta}</span>
            <span className="vx-xbar-pistas" aria-hidden>
              {f.valores.map((v, i) => (
                <i key={i} data-serie={i} style={{ width: `${Math.max(v.valor > 0 ? 0.6 : 0, v.ancho)}%` }} />
              ))}
            </span>
            <span className="vx-xbar-valores" aria-hidden>
              {f.valores.map((v, i) => <b key={i}>{v.texto}</b>)}
            </span>
            <em className={f.dif?.destacada ? "is-dif" : undefined} aria-hidden>{f.dif?.texto ?? ""}</em>
          </div>
        ))}
      </div>
    </div>
  );
}
