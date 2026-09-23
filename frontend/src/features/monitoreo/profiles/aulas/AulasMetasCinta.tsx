import type { ReactNode } from "react";

import { fmt } from "./kpisDeAulas";
import type { CintaDeMetas } from "./metasDeLaPestana";
import type { MandoMeta } from "./proyeccionDeMetas";
import "./aulasMetas.css";

/**
 * La cinta de seis cifras que abre la pestaña: la meta elegida con su reparto
 * por sexo, y lo conseguido con el suyo.
 *
 * **El primer rótulo cambia con el mando** —«Muestra» o «Sobremuestra»— porque
 * la cifra de debajo también cambia: un rótulo fijo diciendo «Meta» dejaría dos
 * números distintos bajo el mismo nombre según dónde estuviera el toggle, que
 * es como se lee mal un tablero.
 *
 * Devuelve `null` sin datos y NO una cinta de ceros: seis ceros se leen como
 * «no hay nada conseguido» cuando lo que pasa es que el estudio no declara
 * cuotas contra las que medir (C3 — el vacío lo declara el panel que la monta).
 */
export function AulasMetasCinta({ cinta, meta }: {
  cinta: CintaDeMetas | null;
  meta: MandoMeta;
}): ReactNode {
  if (!cinta) return null;
  // Sin sexo en la cuota, la cinta dice sólo la meta y lo que cuenta: cuatro
  // celdas de hombres y mujeres en cero se leerían como que no hay nada.
  const celdas: ReadonlyArray<readonly [string, number]> = cinta.sinSexo ? [
    [meta === "sobremuestra" ? "Sobremuestra" : "Muestra", cinta.meta],
    ["Cuentan para la muestra", cinta.obtenidas],
  ] : [
    [meta === "sobremuestra" ? "Sobremuestra" : "Muestra", cinta.meta],
    ["Hombres", cinta.meta_M],
    ["Mujeres", cinta.meta_F],
    ["Efectivas", cinta.obtenidas],
    ["Ef. hombres", cinta.obtenidas_M],
    ["Ef. mujeres", cinta.obtenidas_F],
  ];
  return (
    <dl className="aulas-metas-cinta">
      {celdas.map(([rotulo, valor]) => (
        <div key={rotulo}>
          <dt>{rotulo}</dt>
          <dd>{fmt(Math.round(valor))}</dd>
        </div>
      ))}
    </dl>
  );
}
