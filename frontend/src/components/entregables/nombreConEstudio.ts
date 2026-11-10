// El nombre de un archivo armado en el front, con el estudio que le pondría el
// motor (ADR 0133 §3). Lee el código de la Ficha del estudio y la ruta del
// `.pulso` en el momento de entregar: si el usuario declaró el código hace un
// minuto, el archivo ya sale con él. Si la lectura falla, el nombre no se
// detiene: cae a lo que haya, y en último caso a `Prosecnur`, como el motor.
//
//   gen.ejecutar(async () => archivoJson(valor, await nombreConEstudio("Plantilla de analítica", "json")));

import { apiPlannerEstado } from "../../api/planner";
import { apiProjectStatus } from "../../api/workspace";
import { estudioDelNombre, nombreDelEntregable } from "./archivoLocal";

/** El estudio con el que el motor nombra los entregables de este proyecto. */
export async function estudioDelProyecto(): Promise<string> {
  const [plan, proyecto] = await Promise.all([
    apiPlannerEstado().catch(() => null),
    apiProjectStatus().catch(() => null),
  ]);
  return estudioDelNombre(plan?.planner?.estudio?.codigo ?? null, proyecto?.path ?? null);
}

/** `<Estudio>_<Entregable>[_<Detalle>]_<dd_mm_yy>.<ext>` con el estudio de este proyecto. */
export async function nombreConEstudio(entregable: string, extension: string, detalle?: string | null): Promise<string> {
  return nombreDelEntregable({ estudio: await estudioDelProyecto(), entregable, extension, detalle });
}
