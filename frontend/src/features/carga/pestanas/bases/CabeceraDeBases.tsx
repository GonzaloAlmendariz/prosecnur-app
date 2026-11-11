// Cabecera de Carga › Bases (prototipo "carga-bases"): un panel con la pestaña
// a la izquierda (TabHeading del kit, con el rótulo y el ícono del riel) y, a la
// derecha, las cifras como número sobre su rótulo, separadas por filetes, y al
// final "Agregar base". Misma geometría que la cabecera de Frecuencias y Cruces
// (`analitica/tablas/CifrasDeCabecera`); se unificarán en el kit común.
//
// Sin palabra de estado junto al título: decía si todas las bases tienen
// formulario y respuestas, lo que ya dicen el riel y el estado de cada fila.
// Lo que el prototipo dibuja y el motor no publica queda fuera: "bases con
// decisiones pendientes" no existe como dato por base.

import type { ReactNode } from "react";
import { Panel } from "../../../../components/Panel";
import { TabHeading } from "../../../../components/TabHeading";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { cargaWorkspaceItems } from "../../CargaWorkspaceModel";
import type { CifrasDeLaColeccion } from "./basesModel";
import { useCabeceraDeCarga } from "./contextoDeCabecera";

export type CifraDeBases = { clave: string; valor: string; rotulo: string };

const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);

/** Las cifras de la cabecera, en el orden del prototipo. */
export function cifrasDeCabecera(cifras: CifrasDeLaColeccion, varias: boolean): CifraDeBases[] {
  const lista: CifraDeBases[] = [
    { clave: "bases", valor: formatoConteo(cifras.nBases), rotulo: plural(cifras.nBases, "base", "bases") },
  ];
  if (cifras.respuestas !== null) {
    lista.push({ clave: "respuestas", valor: formatoConteo(cifras.respuestas), rotulo: plural(cifras.respuestas, "respuesta", "respuestas") });
  }
  // Con una base, la tercera cifra son sus fuentes (prototipo "carga-bases-una").
  if (!varias && cifras.nFuentes > 0) {
    lista.push({ clave: "fuentes", valor: formatoConteo(cifras.nFuentes), rotulo: plural(cifras.nFuentes, "fuente", "fuentes") });
  }
  // Las hijas de grupo repetido no cuentan como base; se cuentan aparte, como en Estado del estudio.
  if (cifras.nGruposRepetidos > 0) {
    lista.push({
      clave: "grupos-repetidos",
      valor: formatoConteo(cifras.nGruposRepetidos),
      rotulo: plural(cifras.nGruposRepetidos, "grupo repetido", "grupos repetidos"),
    });
  }
  return lista;
}

/** La tira de cifras: número arriba, lo que cuenta debajo. */
export function CifrasDeBases({ cifras }: { cifras: readonly CifraDeBases[] }) {
  return (
    <dl
      className="pulso-bases-cifras"
      aria-label="Cifras de las bases"
      data-qa-geometry-group="carga/bases-cifras"
      data-qa-geometry-contract="intrinsic"
    >
      {cifras.map((c) => (
        <div key={c.clave} className="pulso-bases-cifra-cabecera">
          <dt>{c.rotulo}</dt>
          <dd>{c.valor}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CabeceraDeBases({
  cifras,
  varias,
  accion,
}: {
  cifras: CifrasDeLaColeccion;
  varias: boolean;
  /** "Agregar base"; sin bases no hay acción en la cabecera: los orígenes son la pantalla. */
  accion: ReactNode;
}) {
  const cabecera = useCabeceraDeCarga();
  if (!cabecera) return null;
  const item = cargaWorkspaceItems(cabecera.contexto).find((i) => i.key === "bases");
  if (!item) return null;
  return (
    <Panel noPadding className="pulso-bases-cabecera">
      <TabHeading
        eyebrow="Carga"
        titulo={item.label}
        icono={item.icon}
        control={(
          <div className="pulso-bases-cabecera-control">
            <CifrasDeBases cifras={cifrasDeCabecera(cifras, varias)} />
            {accion ? <div className="pulso-bases-cabecera-accion">{accion}</div> : null}
          </div>
        )}
      />
    </Panel>
  );
}
