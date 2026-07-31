// Publica el catálogo de pestañas de la sección activa en el puente de
// navegación, para que el inspector pueda enumerarlas.
//
// El catálogo posible vive en `lib/navegacion/catalogos/monitoreo.ts`. La
// página montada contribuye únicamente el subconjunto visible para que el
// inspector no intente abrir pestañas condicionales ausentes en este proyecto.

import { useEffect } from "react";
import {
  olvidarPestanasDeSeccion,
  registrarPestanasDeSeccion,
} from "../../lib/navegacion/runtime";
import { describirDireccion } from "../../lib/navegacion/direccion";
import type { MonitoreoSeccion } from "./core/monitoreoRegistry";

export function useRegistrarPestanasMonitoreo(
  modo: string,
  seccion: MonitoreoSeccion,
  pestanas: ReadonlyArray<{ key: string; label: string }>,
): void {
  // Se compara por contenido porque varias páginas enriquecen los objetos del
  // catálogo con readiness y producen un array nuevo en cada render.
  const firma = pestanas.map((p) => `${p.key}:${p.label}`).join("|");

  useEffect(() => {
    const direccion = { modulo: "monitoreo" as const, modo, seccion };
    const clave = describirDireccion(direccion);
    registrarPestanasDeSeccion(
      clave,
      direccion,
      firma ? firma.split("|").map((par) => {
        const [key, ...resto] = par.split(":");
        return { key, label: resto.join(":") };
      }) : [],
    );
    return () => olvidarPestanasDeSeccion(clave);
  }, [modo, seccion, firma]);
}
