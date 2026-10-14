// Una variable en «Comparar fuentes»: sus categorías con dos barras emparejadas
// (A arriba, B abajo), el porcentaje siempre con su frecuencia y, aparte y
// atenuados, los códigos especiales (SIN INF, No aplica, No sabe). Es una
// tabla real: cada fila es una categoría y cada columna una fuente.

import type { CategoriaComparada, VariableComparada } from "../../../api/cargaArmonizacion";
import { formatoConteo } from "../../../lib/formatoNumero";
import {
  ROTULO_ESTADO,
  anchoBarra,
  partirCategorias,
  pctConFrecuencia,
  rotuloCategoria,
  rotuloDiferenciaPp,
  rotuloExclusiva,
} from "./compararFuentesModel";

type Lados = { a: string; b: string };

function Celda({ pct, n, lado }: { pct: number | null; n: number | null; lado: "a" | "b" }) {
  const ausente = pct == null && n == null;
  return (
    <td className={`pulso-cf-celda is-${lado}`}>
      <span className="pulso-cf-barra" aria-hidden="true">
        <span className="pulso-cf-barra-relleno" style={{ inlineSize: `${anchoBarra(pct)}%` }} />
      </span>
      <span className={ausente ? "pulso-cf-cifra is-ausente" : "pulso-cf-cifra"}>{ausente ? "No está" : pctConFrecuencia(pct, n)}</span>
    </td>
  );
}

function Fila({ c }: { c: CategoriaComparada }) {
  return (
    <tr className={c.especial ? "is-especial" : undefined}>
      <th scope="row" className="pulso-cf-categoria">
        {c.codigo ? <span className="pulso-cf-codigo">{c.codigo}</span> : null}
        <span className="pulso-cf-categoria-texto">{rotuloCategoria(c)}</span>
        {c.fuera_de_lista ? <span className="pulso-cf-marca is-fuera">Fuera del formulario</span> : null}
      </th>
      <Celda pct={c.pct_a} n={c.n_a} lado="a" />
      <Celda pct={c.pct_b} n={c.n_b} lado="b" />
    </tr>
  );
}

function Exclusivas({ lado, nombre, items }: { lado: "a" | "b"; nombre: string; items: VariableComparada["categorias_solo_a"] }) {
  if (!items.length) return null;
  return (
    <p className="pulso-cf-exclusivas">
      <span className={`pulso-cf-exclusivas-rotulo is-${lado}`}>Solo en {nombre}</span>
      {items.map((c, i) => (
        <span key={`${c.codigo}:${c.etiqueta}:${i}`} className="pulso-cf-chip">{rotuloExclusiva(c)}</span>
      ))}
    </p>
  );
}

export function VariableComparadaTarjeta({ variable, lados }: { variable: VariableComparada; lados: Lados }) {
  const { sustantivas, especiales } = partirCategorias(variable.categorias);
  const diferencia = rotuloDiferenciaPp(variable.diferencia_max_pp);
  const soloEn = variable.estado === "solo_a" ? lados.a : variable.estado === "solo_b" ? lados.b : null;
  const titulo = `${variable.variable}${variable.etiqueta ? ` · ${variable.etiqueta}` : ""}`;
  return (
    <article className="pulso-cf-var" data-qa-geometry-member aria-label={titulo}>
      <header className="pulso-cf-var-cabecera">
        <h4 className="pulso-cf-var-titulo">
          <span className="pulso-cf-var-codigo">{variable.variable}</span>
          {variable.etiqueta ? <span className="pulso-cf-var-etiqueta">{variable.etiqueta}</span> : null}
        </h4>
        <div className="pulso-cf-var-meta">
          <span className={`pulso-cf-estado is-${variable.estado}`}>{soloEn ? `Solo en ${soloEn}` : ROTULO_ESTADO[variable.estado]}</span>
          {diferencia ? <span className="pulso-cf-diferencia">{diferencia}</span> : null}
          <span className="pulso-cf-validos">
            Válidos {formatoConteo(variable.n_validos_a)} · {formatoConteo(variable.n_validos_b)}
          </span>
        </div>
      </header>
      {variable.categorias.length ? (
        <table className="pulso-cf-cats">
          <caption className="pulso-sr-only">Distribución de {titulo} en {lados.a} y {lados.b}</caption>
          <thead>
            <tr>
              <th scope="col">Categoría</th>
              <th scope="col" className="is-a">{lados.a}</th>
              <th scope="col" className="is-b">{lados.b}</th>
            </tr>
          </thead>
          <tbody>
            {sustantivas.map((c, i) => <Fila key={`${c.codigo}:${c.etiqueta}:${i}`} c={c} />)}
          </tbody>
          {especiales.length ? (
            <tbody className="pulso-cf-especiales">
              <tr className="pulso-cf-separador">
                <th scope="rowgroup" colSpan={3}>Códigos especiales</th>
              </tr>
              {especiales.map((c, i) => <Fila key={`${c.codigo}:${c.etiqueta}:${i}`} c={c} />)}
            </tbody>
          ) : null}
        </table>
      ) : soloEn ? (
        <p className="pulso-cf-nota">Esta pregunta sólo tiene respuestas en {soloEn}.</p>
      ) : null}
      <Exclusivas lado="a" nombre={lados.a} items={variable.categorias_solo_a} />
      <Exclusivas lado="b" nombre={lados.b} items={variable.categorias_solo_b} />
    </article>
  );
}
