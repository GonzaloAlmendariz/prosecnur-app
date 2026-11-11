// Lo que cambia la base sobre la que se pondera SIN cambiar la config de
// ponderación: la base activa, la fuente (original o codificada) y el universo
// de análisis ("Qué casos cuentan").
//
// El efecto se volvía a pedir solo cuando cambiaba la config. Al declarar una
// condición en el universo, la banda pasaba a "Cuentan 426 de 1,283 casos" y el
// panel seguía diciendo "de 1,283 casos", sin atenuar, hasta tocar una meta: un
// resultado viejo presentado como vigente.
//
// El universo no vive en un store: su panel lo guarda en el backend al
// cambiarlo y la línea "Cuentan N casos" lo vuelve a leer cuando el panel se
// cierra (UniversoAnalisis.tsx). Aquí se usa la misma señal: cada cierre del
// panel cuenta como una versión nueva del universo.

import { useState } from "react";
import { useLocation } from "react-router-dom";

import { useSession } from "../../../lib/SessionContext";
import { panelAbiertoEn } from "../../../lib/navegacion/paneles";
import { PANEL_UNIVERSO } from "../panelesAnalitica";

/** La clave cambia cuando cambia cualquiera de las tres entradas. */
export function claveDeLaBase(
  baseActiva: string | null | undefined,
  fuente: string | null | undefined,
  versionDelUniverso: number,
): string {
  return JSON.stringify([baseActiva ?? "", fuente ?? "", versionDelUniverso]);
}

/** Cuenta los cierres de un panel: de abierto a cerrado suma uno. */
export function siguienteVersion(version: number, estabaAbierto: boolean, estaAbierto: boolean): number {
  return estabaAbierto && !estaAbierto ? version + 1 : version;
}

export function useBaseDelCalculo(): string {
  const { state } = useSession();
  const { search } = useLocation();
  const abierto = panelAbiertoEn(search, PANEL_UNIVERSO);
  const [visto, setVisto] = useState({ abierto, version: 0 });
  // Se ajusta durante el render para que el cálculo se marque viejo en el
  // mismo pintado en que el panel se cierra, no un efecto después.
  if (visto.abierto !== abierto) {
    setVisto({ abierto, version: siguienteVersion(visto.version, visto.abierto, abierto) });
  }
  return claveDeLaBase(state?.active_base, state?.analitica_fuente, visto.version);
}
