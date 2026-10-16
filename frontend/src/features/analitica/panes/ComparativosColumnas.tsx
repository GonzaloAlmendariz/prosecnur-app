// Analítica › Comparativos: las columnas del comparativo.
//
// Una fila por base, en el orden de la serie: de qué base sale la columna, con
// qué título se lee en el Excel y cómo pondera. Antes eran dos bloques sueltos
// —una línea de ponderación y unos «rótulos de los años»— y no se entendía que
// hablaban de lo mismo (Gonzalo, 2026-10-16).

import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight } from "../../../vendor/lucide-react";
import { mayuscula, rotuloPorDefecto } from "../../carga/nombreDeSerie";
import {
  DIRECCION_PONDERACION_SERIE,
  clasePonderacion,
  explicacionPonderacion,
  textoPonderacion,
} from "../ponderacionSerieModel";
import type { LecturaPonderacionSerie } from "../usePonderacionDeLaSerie";
import { rotulosPorDefecto, rotulosRepetidos } from "./comparativosModel";

export function ColumnasDelComparativo({
  periodos,
  rotulos,
  ponderacion,
  onCambio,
}: {
  periodos: string[];
  rotulos: Record<string, string>;
  ponderacion: LecturaPonderacionSerie;
  onCambio: (base: string, valor: string) => void;
}) {
  const porDefecto = rotulosPorDefecto(periodos);
  const repetidos = rotulosRepetidos(rotulos, periodos);
  const pesoDe = new Map(ponderacion.tipo === "listo" ? ponderacion.serie.map((s) => [s.base, s.ponderacion]) : []);
  return (
    <section className="pulso-comparativos-bloque" aria-labelledby="comparativos-columnas-titulo" data-qa-geometry-member>
      <header className="pulso-comparativos-bloque-head">
        <h3 id="comparativos-columnas-titulo">Columnas del comparativo</h3>
        <p>Una columna por base, en el orden de la serie. El título es el que se lee en el Excel.</p>
        <Link className="pulso-comparativos-columnas-enlace" to={DIRECCION_PONDERACION_SERIE}>
          Ir a Ponderación <ArrowRight size={13} aria-hidden="true" />
        </Link>
      </header>
      <table className="pulso-comparativos-columnas">
        <colgroup>
          <col className="is-pos" />
          <col className="is-base" />
          <col className="is-titulo" />
          <col className="is-peso" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col"><span className="pulso-sr-only">Orden</span></th>
            <th scope="col">Base</th>
            <th scope="col">Título de la columna</th>
            <th scope="col">Ponderación</th>
          </tr>
        </thead>
        <tbody>
          {periodos.map((base, i) => {
            const propuesto = porDefecto[base] ?? rotuloPorDefecto(base);
            const peso = pesoDe.get(base);
            return (
              <tr key={base}>
                <td className="pulso-comparativos-columnas-pos">{i + 1}</td>
                <th scope="row" className="pulso-comparativos-columnas-base" title={base}>{base}</th>
                <td>
                  <input
                    type="text"
                    value={rotulos[base] ?? ""}
                    placeholder={propuesto}
                    onChange={(e) => onCambio(base, e.target.value)}
                    aria-label={`Título de la columna ${i + 1}, base ${base}`}
                  />
                </td>
                <td>
                  {peso ? (
                    <span className={`pulso-comparativos-columnas-peso ${clasePonderacion(peso)}`} title={explicacionPonderacion(peso)}>
                      {mayuscula(textoPonderacion(peso))}
                    </span>
                  ) : (
                    <span className="pulso-comparativos-columnas-peso is-sin-leer">Leyendo…</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {repetidos.length ? (
        <p className="pulso-comparativos-rotulos-aviso" role="status">
          <AlertTriangle size={13} aria-hidden="true" />
          {repetidos.length === 1
            ? `«${repetidos[0]}» titula a más de una columna. Cambia uno de los títulos para que las columnas se distingan.`
            : `${repetidos.map((r) => `«${r}»`).join(", ")} titulan a más de una columna. Cambia los títulos para que las columnas se distingan.`}
        </p>
      ) : null}
    </section>
  );
}
