// La generación de un entregable de Monitoreo: `useGeneracion` del kit con la
// carpeta del módulo, más `enCurso` para deshabilitar el disparador (la única
// señal que se mueve es la línea del contenedor; el botón no gira ni cambia de
// rótulo).

import type { Articulo } from "../../../components/entregables/generacionModelo";
import { useGeneracion, type Generacion } from "../../../components/entregables/useGeneracion";
import { MODULO_MONITOREO } from "./modeloEntrega";

export type EntregaMonitoreo = Generacion & { enCurso: boolean };

export function useEntrega(titulo: string, opciones: { formato?: string | null; articulo?: Articulo | null } = {}): EntregaMonitoreo {
  const gen = useGeneracion({ titulo, modulo: MODULO_MONITOREO, formato: opciones.formato ?? null, articulo: opciones.articulo ?? null });
  return { ...gen, enCurso: gen.estado.fase === "en_curso" };
}
