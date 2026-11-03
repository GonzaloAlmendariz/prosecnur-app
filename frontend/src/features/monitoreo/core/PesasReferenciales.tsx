import { formatoConteo, formatoDecimal } from "../../../lib/formatoNumero";
import { pctConEspacio } from "./formatoComun";
import { marcasDeValores } from "./marcasDeValores";
import "./pesasReferenciales.css";

/**
 * La composición de una cuota referencial (ADR 0126), la misma gramática en
 * todos los perfiles que la dibujan como pesas (telefónico, territorial y
 * acreditación; aulas la dice en su Sistema Pabellón):
 *
 * - un eje con sus marcas, de 0 al tope de la variable;
 * - el ANILLO es la referencia —su parte del universo, del listado o del
 *   reparto—, que es contra lo que se compara y por eso va escrita en su propia
 *   columna (Gonzalo, 3/11: «debe estar el porcentaje del universo para poder
 *   referenciarlo»);
 * - el PUNTO es lo obtenido, su parte de las efectivas;
 * - la diferencia va en puntos porcentuales y sin color de alarma: una
 *   diferencia se enseña, no se juzga (ADR 0086 §7).
 */
export type PesaReferencial = {
  clave: string;
  nombre: string;
  /** Efectivas de la categoría: el n de lo obtenido. */
  n: number;
  /** De 0 a 100; `null` sin efectivas en la variable. */
  obtenida: number | null;
  /** De 0 a 100; `null` sin comparador. */
  esperada: number | null;
  /** Un número declarado como referencia (no un piso), si lo hay. */
  referencia?: number | null;
  /** Con base y ninguna efectiva: impide posestratificar. Un hecho, no una alarma. */
  celdaVacia?: boolean;
};

/** Un decimal fijo («70.0 %» al lado de «67.6 %»): las dos columnas se comparan en vertical. */
const pct = (v: number | null) => pctConEspacio(v);
/** «+3.1 pp» / «−1.0 pp»; sin signo cuando no hay diferencia. */
function pp(a: number | null, b: number | null) {
  if (a == null || b == null) return "—";
  const d = a - b;
  const signo = d > 0.05 ? "+" : d < -0.05 ? "−" : "";
  return `${signo}${pctConEspacio(Math.abs(d)).replace(" %", "")} pp`;
}

export function PesasReferenciales({
  filas,
  referencia,
  titulo,
  compacta = false,
  grupo = "pesas-referenciales",
}: {
  filas: readonly PesaReferencial[];
  /** Contra qué se compara, en minúscula: «universo», «listado», «reparto». */
  referencia: string;
  /** Nombre accesible del gráfico. */
  titulo: string;
  /** En una tarjeta angosta: sin la columna de lo obtenido escrito (queda en el punto y en el nombre accesible). */
  compacta?: boolean;
  /** Prefijo del contrato geométrico (C1), único por instancia en la vista. */
  grupo?: string;
}) {
  const maximo = Math.max(1, ...filas.flatMap((f) => [f.obtenida ?? 0, f.esperada ?? 0]));
  const marcas = marcasDeValores(maximo);
  const tope = marcas.at(-1) ?? 100;
  const x = (v: number) => `${Math.min(100, (v / tope) * 100)}%`;
  return (
    <figure className={`mon-pesas${compacta ? " is-compacta" : ""}`} aria-label={titulo}
      data-qa-geometry-group={grupo} data-qa-geometry-contract="intrinsic">
      <div className="mon-pesas-tabla" role="table" aria-label={titulo}>
        <div className="mon-pesas-fila is-eje" role="row">
          <span role="columnheader">Categoría</span>
          <span role="columnheader" className="mon-pesas-escala"
            data-qa-geometry-group={`${grupo}-eje`} data-qa-geometry-contract="intrinsic">
            {marcas.map((valor, i) => (
              <span key={valor} className="mon-pesas-marca"
                style={{ left: x(valor), transform: i === 0 ? "none" : i === marcas.length - 1 ? "translateX(-100%)" : undefined }}>
                {formatoDecimal(valor, valor % 1 ? 1 : 0)}
              </span>
            ))}
          </span>
          <span role="columnheader" className="is-num is-referencia">Del {referencia}</span>
          {compacta ? null : <span role="columnheader" className="is-num">De las efectivas</span>}
          <span role="columnheader" className="is-num">Diferencia</span>
        </div>
        <div className="mon-pesas-cuerpo" role="rowgroup"
          data-qa-geometry-group={`${grupo}-filas`} data-qa-geometry-contract="equal">
        {filas.map((f) => (
          <div key={f.clave} className="mon-pesas-fila" role="row">
            <span role="rowheader" className="mon-pesas-nombre">
              <b>{f.nombre}</b>
              <small>
                {f.celdaVacia ? "sin efectivas" : `${formatoConteo(f.n)} ${f.n === 1 ? "efectiva" : "efectivas"}`}
                {f.referencia != null ? `, ref. ${formatoConteo(f.referencia)}` : ""}
              </small>
            </span>
            <span role="cell" className="mon-pesas-pista"
              aria-label={`${pct(f.esperada)} del ${referencia}, ${pct(f.obtenida)} de las efectivas`}>
              {f.esperada != null && f.obtenida != null ? (
                <i className="mon-pesas-tramo"
                  style={{ left: x(Math.min(f.esperada, f.obtenida)), width: x(Math.abs(f.obtenida - f.esperada)) }} />
              ) : null}
              {f.esperada != null ? <i className="mon-pesas-anillo" style={{ left: x(f.esperada) }} /> : null}
              {f.obtenida != null ? <i className="mon-pesas-punto" style={{ left: x(f.obtenida) }} /> : null}
            </span>
            <span role="cell" className="is-num is-referencia">{f.esperada == null ? `sin ${referencia}` : pct(f.esperada)}</span>
            {compacta ? null : <span role="cell" className="is-num">{pct(f.obtenida)}</span>}
            <b role="cell" className="is-num mon-pesas-diferencia">{pp(f.obtenida, f.esperada)}</b>
          </div>
        ))}
        </div>
      </div>
      <ul className="mon-pesas-leyenda" aria-label="Lectura">
        <li><i className="mon-pesas-anillo" aria-hidden="true" /> % del {referencia}</li>
        <li><i className="mon-pesas-punto" aria-hidden="true" /> % de las efectivas</li>
      </ul>
    </figure>
  );
}
