import type { RitmoDiario } from "./AulasRitmoDiario";

/**
 * Qué serie temporal enseña «Ritmo de la recolección»: la del operativo o la de
 * la facultad en foco.
 *
 * Gonzalo, revisando Resumen con Psicología puesta: «Ritmo de la recolección no
 * lo está haciendo». El panel leía la serie global y seguía diciendo «1 131 en
 * 4 días» debajo de un tablero que ya sólo hablaba de Psicología.
 *
 * **El reparto lo hace el motor, no `deLaFacultad`.** La serie se construye
 * sobre las respuestas, y las respuestas no viajan: lo que llega es
 * `course_status` recortado a 500 filas y bloques ya agregados, y ninguno trae
 * el día de cada respuesta. Aquí sólo se elige entre series ya calculadas.
 */

const clave = (v: unknown) =>
  (v == null ? "" : String(v)).trim().toUpperCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "");

export type RitmoDeFacultad = RitmoDiario & { facultad: string; faculty_key?: string };

export function ritmoDeLaFacultad(
  global: RitmoDiario | null | undefined,
  porFacultad: ReadonlyArray<RitmoDeFacultad> | null | undefined,
  facultad: string | undefined,
): RitmoDiario | null {
  const g = global ?? null;
  if (!facultad) return g;
  // Sin el bloque —payload de un backend anterior— manda la serie global, y el
  // panel sigue diciendo el total del operativo. Es lo que ya hacía; no se
  // arregla inventando un reparto que no vino.
  if (!porFacultad?.length) return g;

  const buscada = clave(facultad);
  const suya = porFacultad.find((f) => clave(f.facultad) === buscada || clave(f.faculty_key) === buscada);
  if (suya) return suya;

  // La facultad existe en el foco y NO tiene serie propia: el motor sólo
  // publica las que tienen alguna respuesta válida. Cero respuestas es un
  // hecho, no una avería de la fuente, así que se dibuja el mismo calendario a
  // cero en vez de caer al vacío del componente, que dice otra cosa —«no traen
  // fecha de envío»— y sería falso.
  return {
    dias: (g?.dias ?? []).map((d) => ({ fecha: d.fecha, validas: 0, acumulado: 0 })),
    dias_con_campo: 0,
    mejor_dia: null,
    media_diaria: 0,
    meta: 0,
    brecha: null,
  };
}
