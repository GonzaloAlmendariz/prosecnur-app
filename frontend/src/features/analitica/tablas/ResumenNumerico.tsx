// El resumen de una variable numérica: los estadísticos que escribe el
// archivo, con su nombre y su valor tal como los entrega el motor, en una
// rejilla compacta. La celda de "Casos válidos" lleva además la base en casos sin ponderar, "de 1,283 casos (100.0 %)",
// que es la única vez que esa cifra aparece en la tabla.

import type { FrecuenciasPreviewTabla } from "../../../api/analitica";
import { esConteoDeCasos, partesDeBase, textoEstadistico } from "./vistaPreviaModelo";

export function ResumenNumerico({ resumen, base }: {
  resumen: FrecuenciasPreviewTabla["resumen"];
  base: FrecuenciasPreviewTabla["base"];
}) {
  const partes = partesDeBase(base);
  // Solo si el primer estadístico es el mismo conteo que la base: si no, no se le cuelga una base ajena.
  const conBase = (estadistico: string, valor: number | null) =>
    esConteoDeCasos(estadistico) && Boolean(partes?.de) && valor !== null && valor === base.n;
  return (
    <dl className="tablas-resumen-rejilla">
      {resumen.map((e) => (
        <div key={e.estadistico} className="tablas-resumen-celda">
          <dt>{e.estadistico}</dt>
          {/* "Casos válidos" es un conteo entero; los demás, un decimal fijo. */}
          <dd>{textoEstadistico(e.valor, esConteoDeCasos(e.estadistico))}</dd>
          {conBase(e.estadistico, e.valor) ? <dd className="tablas-resumen-base">{partes?.de}</dd> : null}
        </div>
      ))}
    </dl>
  );
}
