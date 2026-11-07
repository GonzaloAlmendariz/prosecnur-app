// Dependencia en la lámina de tres gráficos en fila: una pregunta filtro y uno o dos dependientes, cada uno habilitado
// por sus propias respuestas. Es la lámina «filtro con dos mapas» que aprobó Gonzalo el 2026-11-03 (¿Dónde estudiaste la
// secundaria? → distrito de Lima y del Callao, y otra región del Perú). Contrato con el motor:
// docs/qa/contrato-ui-mapas-dependientes-2026-11-03.md, §2:
//   meta.dependencia = { de: "izquierda", habilita: { centro: ["En Lima Metropolitana", "En Callao"], derecha: [...] } }
// Una ranura que no está en `habilita` no depende del filtro. En la lámina de dos gráficos `habilita` sigue siendo una
// lista (DependenciaLamina.tsx).

import type { Slide } from "../../../api/graficos";
import { leerSlideMeta } from "../slideMeta";

/** Las láminas de tres gráficos que admiten dependencia, con sus ranuras en el orden en que se leen. */
export const LAMINAS_CON_DEPENDENCIA_TRES: Readonly<Record<string, readonly [string, string, string]>> = {
  p_slide_3_graficos_fila: ["izquierda", "centro", "derecha"],
};

export const NOMBRE_RANURA: Readonly<Record<string, string>> = { izquierda: "de la izquierda", centro: "del centro", derecha: "de la derecha" };

export type DependenciaTres = { de: string; habilita: Record<string, string[]> };

const lista = (x: unknown): string[] => (Array.isArray(x) ? x : typeof x === "string" ? [x] : []).map(String).filter(Boolean);

/** La dependencia guardada en una lámina de tres gráficos (o `null`). */
export function dependenciaTresDe(slide: Pick<Slide, "tipo" | "payload">): DependenciaTres | null {
  const ranuras = LAMINAS_CON_DEPENDENCIA_TRES[slide.tipo];
  const d = leerSlideMeta(slide).dependencia as Record<string, unknown> | undefined;
  if (!ranuras || !d || typeof d.de !== "string" || !ranuras.includes(d.de)) return null;
  const h = d.habilita;
  const habilita: Record<string, string[]> = {};
  if (h && typeof h === "object" && !Array.isArray(h)) {
    for (const [r, v] of Object.entries(h as Record<string, unknown>)) {
      // Una respuesta sola llega como texto suelto (el JSON de R desempaca el vector de largo uno).
      if (r !== d.de && ranuras.includes(r)) habilita[r] = lista(v);
    }
  }
  return { de: d.de, habilita };
}

/** Las ranuras que pueden depender del filtro: las otras dos, en orden de lectura. */
export function dependientesPosibles(tipo: string, de: string): string[] {
  return (LAMINAS_CON_DEPENDENCIA_TRES[tipo] ?? []).filter((r) => r !== de);
}

/** Enciende o apaga que una ranura dependa del filtro; al encenderla arranca sin respuestas elegidas. */
export function conDependiente(dep: DependenciaTres, ranura: string, depende: boolean): DependenciaTres {
  const habilita = { ...dep.habilita };
  if (depende) habilita[ranura] = habilita[ranura] ?? [];
  else delete habilita[ranura];
  return { ...dep, habilita };
}

/** Marca o desmarca una respuesta del filtro para una ranura, conservando el orden del cuestionario. */
export function alternarRespuesta(dep: DependenciaTres, ranura: string, respuesta: string, orden: readonly string[]): DependenciaTres {
  const actuales = new Set(dep.habilita[ranura] ?? []);
  if (actuales.has(respuesta)) actuales.delete(respuesta); else actuales.add(respuesta);
  return { ...dep, habilita: { ...dep.habilita, [ranura]: orden.filter((r) => actuales.has(r)) } };
}
