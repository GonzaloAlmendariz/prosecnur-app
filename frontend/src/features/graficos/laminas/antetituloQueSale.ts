// El antetítulo que sale en la lámina, como lo decide el motor (api/R/lamina_compositor.R `.lam_antetitulos`): el que
// escribió el analista o, si no hay, el nombre de la sección, y éste sólo con la opción «Nombre de la sección» encendida
// (estilo_cliente.antetitulo_seccion, apagada por defecto). La maqueta mostraba el de la sección siempre y prometía un
// «PRINCIPALES RESULTADOS» que el PPT ya no lleva.

import { leerAntetituloSeccion } from "../estilo/SeccionAntetitulo";
import { usePlanStore } from "../store";

export function useAntetituloSeccionActivo(): boolean {
  return usePlanStore((s) => leerAntetituloSeccion(s.estiloCliente));
}

export function antetituloQueSale(propio: string | null | undefined, heredado: string | null, seccionActiva: boolean): string | null {
  const p = typeof propio === "string" ? propio.trim() : "";
  if (p) return p;
  return seccionActiva ? heredado : null;
}
