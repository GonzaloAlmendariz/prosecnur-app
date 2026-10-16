// Armonizar › mapa de una base: las mismas ayudas que Segmentos de cruce
// («Años transcurridos», «Rangos»). Una variable cuyos valores son años se
// agrupa en tramos relativos al año de cada medición sin asignar año por año a
// mano; una numérica, en rangos. Sólo asignan lo que cae en un tramo: lo demás
// (un «Otro» 88, por ejemplo) queda como estaba y se ve en la tabla.

import { useState } from "react";
import { AyudaMapa, BotonesAyudaMapa } from "./segmentos/AyudaMapa";
import { ayudasDisponibles, type AyudaMapa as TipoAyuda } from "./segmentos/segmentosModel";
import { anioDeBase } from "./nombreDeSerie";
import type { CodigoBase } from "./armonizacionCodigosModel";
import type { AccionArmonizacion } from "./armonizacionModel";
import type { CategoriaEscalaComun } from "../../api/equivalencias";

/** Las asignaciones de una ayuda, agrupadas por destino: una acción por categoría. */
export function accionesDesdeMapa(
  base: string,
  mapa: Readonly<Record<string, string>>,
  conocidos: readonly string[],
): AccionArmonizacion[] {
  const porDestino = new Map<string, string[]>();
  for (const [codigo, destino] of Object.entries(mapa)) {
    porDestino.set(destino, [...(porDestino.get(destino) ?? []), codigo]);
  }
  return [...porDestino].map(([destino, codigos]) => ({ tipo: "destinos", base, codigos, destino, conocidos }));
}

export function ArmonizacionAyudaMapa({
  base,
  origen,
  codigos,
  escala,
  despachar,
}: {
  base: string;
  /** La variable de la base, para la fórmula de la ayuda. */
  origen: string;
  codigos: readonly CodigoBase[];
  escala: readonly CategoriaEscalaComun[];
  despachar: (a: AccionArmonizacion) => void;
}) {
  const [abierta, setAbierta] = useState<TipoAyuda | null>(null);
  // Un código sin casos (un resto del mapa, una opción que nadie marcó) no
  // decide si la variable es de años ni recibe tramo.
  const opciones = codigos.filter((c) => c.n !== 0).map((c) => ({ codigo: c.codigo, etiqueta: c.etiqueta ?? "" }));
  const ayudas = escala.length > 0 ? ayudasDisponibles(opciones) : [];
  if (ayudas.length === 0) return null;
  const conocidos = codigos.map((c) => c.codigo);
  return (
    <>
      <div className="pulso-armon-base-acciones">
        <BotonesAyudaMapa ayudas={ayudas} abierta={abierta} onAlternar={(a) => setAbierta(abierta === a ? null : a)} />
      </div>
      {abierta && (
        <AyudaMapa
          key={abierta}
          tipo={abierta}
          origen={origen}
          anio={anioDeBase(base)}
          escala={escala.filter((c) => c.codigo).map((c) => ({ codigo: c.codigo, etiqueta: c.etiqueta }))}
          codigos={opciones}
          onAplicar={(mapa) => {
            for (const accion of accionesDesdeMapa(base, mapa, conocidos)) despachar(accion);
            setAbierta(null);
          }}
          onCerrar={() => setAbierta(null)}
        />
      )}
    </>
  );
}
