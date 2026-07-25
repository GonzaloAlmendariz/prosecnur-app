// Publica el catálogo de pestañas de la sección activa en el puente de
// navegación, para que el inspector pueda enumerarlas.
//
// Las pestañas de Monitoreo viven dentro de cada página de perfil y no se
// pueden conocer desde `lib/modules.ts`. En vez de duplicar el catálogo —lo
// que ya produjo una copia desincronizada— la vista montada lo contribuye.

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
  // El catálogo se compara por contenido: las páginas de perfil lo definen con
  // literales de módulo, pero algunas lo derivan por sección y producen un
  // array nuevo en cada render.
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
