import type { ReactNode } from "react";

import { formatoConteo } from "../../../../lib/formatoNumero";
import { NotaDelModo } from "../../core/NotaDelModo";
import "./salidasDeMonitoreo.css";

/** Una tabla tal como la lleva el entregable al cliente. */
export type TablaDelCliente = {
  cabecera: string[];
  /** Qué columnas son cifras (van a la derecha). */
  numericas: boolean[];
  filas: Array<{ clave: string; celdas: ReactNode[] }>;
  total?: ReactNode[];
};

/**
 * «Así se verá»: la hoja que recibe el cliente, con su encabezado y su corte, sobre una mesa (estándar de
 * Salidas). Nace de la vista del PDF del cliente del telefónico; los cuatro modos la usan con su tabla.
 */
export function HojaDelCliente({ encabezado, corte, titulo, tabla, vacio, children }: {
  /** «Monitoreo telefónico», «Acreditación», el nombre del estudio… */
  encabezado: string;
  /** «24/07/26, 11:59», o vacío sin corte. */
  corte: string;
  titulo: string;
  tabla: TablaDelCliente | null;
  /** Lo que dice la hoja cuando el corte no trae la tabla. */
  vacio: string;
  children?: ReactNode;
}) {
  return (
    <div className="mon-sal-mesa" data-qa-geometry-capacity="owned">
      <article className="mon-sal-hoja" aria-label={`Vista de la hoja del cliente: ${titulo}`}>
        <header>
          <strong>{encabezado}</strong>
          <span>{corte ? `Corte del ${corte}` : "Sin corte"}</span>
        </header>
        <h3>{titulo}</h3>
        {tabla && tabla.filas.length ? (
          <table className="mon-sal-hoja-tabla">
            <thead>
              <tr>
                {tabla.cabecera.map((c, i) => <th key={c} scope="col" className={tabla.numericas[i] ? "is-num" : undefined}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {tabla.filas.map((fila) => (
                <tr key={fila.clave}>
                  {fila.celdas.map((v, i) => (i === 0
                    ? <th key={i} scope="row">{v}</th>
                    : <td key={i} className={tabla.numericas[i] ? "is-num" : undefined}>{v}</td>))}
                </tr>
              ))}
            </tbody>
            {tabla.total ? (
              <tfoot>
                <tr>
                  {tabla.total.map((v, i) => (i === 0
                    ? <th key={i} scope="row">{v}</th>
                    : <td key={i} className={tabla.numericas[i] ? "is-num" : undefined}>{v}</td>))}
                </tr>
              </tfoot>
            ) : null}
          </table>
        ) : (
          <NotaDelModo tono="neutro">{vacio}</NotaDelModo>
        )}
        {children}
      </article>
    </div>
  );
}

/** El ritmo diario de la hoja: una barra por día. */
export function RitmoDeLaHoja({ dias, nota }: { dias: ReadonlyArray<{ fecha: string; casos: number }>; nota?: string }) {
  if (!dias.length) return null;
  const maximo = Math.max(1, ...dias.map((d) => d.casos));
  return (
    <section className="mon-sal-hoja-ritmo" aria-label="Ritmo diario">
      <h4>Ritmo diario</h4>
      <ul>
        {dias.map((dia) => (
          <li key={dia.fecha}>
            <span>{`${dia.fecha.slice(8, 10)}/${dia.fecha.slice(5, 7)}`}</span>
            <i aria-hidden="true"><i style={{ width: `${(dia.casos / maximo) * 100}%` }} /></i>
            <strong className="is-num">{formatoConteo(dia.casos)}</strong>
          </li>
        ))}
      </ul>
      {nota ? <NotaDelModo tono="aviso">{nota}.</NotaDelModo> : null}
    </section>
  );
}
