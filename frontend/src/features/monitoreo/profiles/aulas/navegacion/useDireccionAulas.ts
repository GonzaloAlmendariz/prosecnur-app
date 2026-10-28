import { useCallback, useState } from "react";

import { MONITOREO_PESTANAS_INTERNAS_AULAS } from "../../../../../lib/navegacion/catalogos/monitoreo";
import type { MonitoreoSeccion } from "../../../core/monitoreoRegistry";
import {
  monitoreoDireccionDesdeParams,
  useMonitoreoDireccionTraducida,
} from "../../../useMonitoreoDireccion";
import {
  direccionDeSeccion,
  direccionDeVista,
  direccionInicial,
  direccionPedida,
  esSeccionAulas,
  PANELES_DE_SUBVISTA_AULAS,
  pideOtraDireccion,
  vistaDeDireccion,
  type DireccionAulas,
  type SeccionInternaAulas,
} from "./direccionAulas";

const INTERNAS = MONITOREO_PESTANAS_INTERNAS_AULAS as Record<string, ReadonlyArray<{ key: string }> | undefined>;

/**
 * La dirección del modo Cursos-horario como estado de la página.
 *
 * La página guarda la dirección PÚBLICA (Insumos, Modelo, Control, Avance) y
 * deriva de ella la vista heredada que monta (`seccionActiva` y
 * `pestanaActiva` de siempre, que siguen decidiendo qué corte se pide y qué se
 * pinta). La URL se lee y se escribe con `useMonitoreoDireccionTraducida`,
 * igual que Territorial: los alias viejos se leen y se reescriben a su forma
 * pública.
 *
 * Vive fuera de `AulasMonitoreoPage.tsx`, que está congelado a crecimiento.
 */
export function useDireccionAulas() {
  const [direccion, setDireccion] = useState<DireccionAulas>(
    () => direccionInicial(monitoreoDireccionDesdeParams(window.location.search)),
  );
  const vista = vistaDeDireccion(direccion);

  const irA = useCallback((destino: DireccionAulas) => {
    setDireccion(destino);
  }, []);

  /** Una sección pública desde su píldora: abre su primera pestaña. */
  const irASeccion = useCallback((seccion: string) => {
    if (esSeccionAulas(seccion)) setDireccion(direccionDeSeccion(seccion));
  }, []);

  /** Una pestaña pública desde el rail: su vista principal. */
  const irAPestana = useCallback((seccion: DireccionAulas["seccion"], pestana: string) => {
    setDireccion({ seccion, pestana, panel: null });
  }, []);

  /**
   * Una vista heredada por su clave vieja: los enlaces internos de las vistas
   * (`irAPestana("reemplazos")`, «volver a Fuentes») todavía las nombran así.
   * Sin pestaña, se entiende la primera de la sección vieja, que es donde
   * aterrizaba.
   */
  const irAVista = useCallback((seccion: MonitoreoSeccion, pestana?: string) => {
    const clave = pestana ?? INTERNAS[seccion]?.[0]?.key ?? "";
    setDireccion(direccionDeVista({ seccion: seccion as SeccionInternaAulas, pestana: clave }));
  }, []);

  useMonitoreoDireccionTraducida({
    publica: direccion,
    modo: "aulas",
    panelesPropios: PANELES_DE_SUBVISTA_AULAS,
    pideOtraVista: (pedida) => pideOtraDireccion(pedida, direccion),
    onPedida: (pedida) => {
      const destino = direccionPedida(pedida);
      if (destino) setDireccion(destino);
    },
  });

  return {
    direccion,
    /** Sección heredada que se monta; decide el corte que se pide. */
    seccionActiva: vista.seccion as MonitoreoSeccion,
    /** Pestaña heredada que se monta; `""` en la hoja Fuentes. */
    pestanaActiva: vista.pestana,
    irA,
    irASeccion,
    irAPestana,
    irAVista,
  };
}
