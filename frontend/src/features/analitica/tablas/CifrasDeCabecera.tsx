// Las cifras de la cabecera de Frecuencias y Cruces: una tira con divisores,
// sin píldoras, a la derecha del título (receta de la cabecera de pestaña del
// rediseño de Procesamiento, plan 8.2). Cada cifra es su número, con su base
// cuando la tiene ("26/41"), y debajo lo que cuenta. La que se decide en otra
// pestaña lleva a ella.

import { Link, type To } from "react-router-dom";

export type TonoDeCifra = "neutral" | "ok" | "alerta";

export type CifraDeCabecera = {
  clave: string;
  valor: string;
  /** El denominador: "41" en "26/41". */
  base?: string;
  rotulo: string;
  /** Un punto de estado junto al valor: `ok` aplicado, `alerta` pendiente. */
  tono?: TonoDeCifra;
  /** A dónde lleva el valor, si se decide en otro lugar. */
  enlace?: To;
  /** Lo que la cifra no dice a la vista y conviene saber (n efectivo, regla). */
  titulo?: string;
};

export function CifrasDeCabecera({ cifras, ariaLabel }: { cifras: readonly CifraDeCabecera[]; ariaLabel: string }) {
  return (
    <dl
      className="tablas-cifras"
      aria-label={ariaLabel}
      // C1: cada cifra mide lo que su texto necesita; no son marcos pares.
      data-qa-geometry-group="analitica/tablas-cifras"
      data-qa-geometry-contract="intrinsic"
    >
      {cifras.map((c) => {
        const numero = (
          <>
            {c.valor}
            {c.base ? <span className="tablas-cifra-base">/{c.base}</span> : null}
          </>
        );
        return (
          <div key={c.clave} className="tablas-cifra-cabecera" data-tono={c.tono ?? "neutral"} title={c.titulo}>
            <dt>{c.rotulo}</dt>
            <dd>
              {c.enlace ? <Link to={c.enlace}>{numero}</Link> : numero}
              {c.tono && c.tono !== "neutral" ? <span className="tablas-cifra-punto" aria-hidden="true" /> : null}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
