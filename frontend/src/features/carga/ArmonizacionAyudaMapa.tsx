// Armonizar › mapa de una base con origen numérico (una edad, un año, una
// fórmula): se asigna por rangos en línea, igual que en Segmentos de cruce, con
// los casos por rango. Lo que no entra a rangos («88 Otro») va aparte. La tabla
// valor por valor queda plegada (`PlegableValorPorValor`).

import type { ReactNode } from "react";
import { MapaPorRangos } from "./MapaPorRangos";
import { ayudasDisponibles } from "./segmentos/segmentosModel";
import type { CodigoBase } from "./armonizacionCodigosModel";
import type { AccionArmonizacion } from "./armonizacionModel";
import type { CategoriaEscalaComun } from "../../api/equivalencias";

/** Si el mapa de esta base se arma por rangos: origen numérico y escala definida. */
export function esMapaNumerico(codigos: readonly CodigoBase[], escala: readonly CategoriaEscalaComun[]): boolean {
  const opciones = codigos.filter((c) => c.n !== 0).map((c) => ({ codigo: c.codigo, etiqueta: c.etiqueta ?? "" }));
  return escala.length > 0 && ayudasDisponibles(opciones).includes("rangos");
}

/** Las asignaciones de los rangos, agrupadas por destino: una acción por categoría (`null` = sin mapa). */
export function accionesDesdeAsignacion(
  base: string,
  cambios: Readonly<Record<string, string | null>>,
  conocidos: readonly string[],
): AccionArmonizacion[] {
  const porDestino = new Map<string, string[]>();
  for (const [codigo, destino] of Object.entries(cambios)) {
    const k = destino ?? "\u0000";
    porDestino.set(k, [...(porDestino.get(k) ?? []), codigo]);
  }
  return [...porDestino].map(([k, codigos]) => ({
    tipo: "destinos", base, codigos, destino: k === "\u0000" ? null : k, conocidos,
  }));
}

export function ArmonizacionAyudaMapa({
  base,
  origen,
  codigos,
  escala,
  mapa,
  despachar,
}: {
  base: string;
  origen: string;
  codigos: readonly CodigoBase[];
  escala: readonly CategoriaEscalaComun[];
  /** `código -> destino` vigente de la base. */
  mapa: Readonly<Record<string, string>>;
  despachar: (a: AccionArmonizacion) => void;
}) {
  if (!esMapaNumerico(codigos, escala)) return null;
  const conocidos = codigos.map((c) => c.codigo);
  return (
    <MapaPorRangos
      key={`${base}:${origen}`}
      base={base}
      origen={origen}
      valores={codigos.filter((c) => c.n !== 0)}
      escala={escala.filter((c) => c.codigo).map((c) => ({ codigo: c.codigo, etiqueta: c.etiqueta }))}
      mapa={mapa}
      onAsignar={(cambios) => {
        for (const a of accionesDesdeAsignacion(base, cambios, conocidos)) despachar(a);
      }}
    />
  );
}

/** La tabla valor por valor: plegada cuando el mapa se arma por rangos. */
export function PlegableValorPorValor({ plegado, n, base, children }: { plegado: boolean; n: number; base: string; children: ReactNode }) {
  if (!plegado) return <>{children}</>;
  return (
    <details className="pulso-rangos-detalle">
      <summary>Ver valor por valor ({n}) en {base}</summary>
      {children}
    </details>
  );
}
