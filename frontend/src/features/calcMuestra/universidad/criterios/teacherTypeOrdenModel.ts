/**
 * Lógica pura del "Orden de jerarquía" de tipos de docente (ADR 0035). El motor
 * cataloga cada curso-horario por su docente de mayor jerarquía; el académico
 * define ese ranking ordenando las categorías canónicas de teacher_type de mayor
 * a menor. Estas claves son las MISMAS que la selección del criterio ya consume
 * (hojas de los grupos jerárquicos o categorías planas). Sin estado ni JSX: la
 * suite de criterios presenta y persiste el resultado en
 * `aulas_config.teacher_type_orden`.
 */
import type { CriterioVariable } from "../../../../api/client";

export type TeacherTypeCategoria = {
  /** Clave canónica (autoritativa; la MISMA que consume la selección del criterio). */
  key: string;
  /** Etiqueta legible. */
  label: string;
  /** Grupo/prefijo jerárquico de origen (solo cuando la variable es jerárquica). */
  group?: string;
};

/**
 * Aplana las categorías canónicas de teacher_type del catálogo: hojas de cada
 * grupo (variable jerárquica) o categorías planas, dedup por clave preservando el
 * orden del catálogo. Es la lista completa de tipos rankeables.
 */
export function teacherTypeCategoriasCatalogo(
  variable: CriterioVariable | null | undefined,
): TeacherTypeCategoria[] {
  if (!variable) return [];
  const out: TeacherTypeCategoria[] = [];
  const seen = new Set<string>();
  const push = (key: string, label: string, group?: string) => {
    const clave = String(key ?? "").trim();
    if (!clave || seen.has(clave)) return;
    seen.add(clave);
    out.push({ key: clave, label: label || clave, ...(group ? { group } : {}) });
  };
  for (const group of variable.groups ?? []) {
    for (const child of group.children ?? []) push(child.key, child.label, group.label);
  }
  for (const cat of variable.categories ?? []) push(cat.key, cat.label);
  return out;
}

/**
 * Orden de despliegue: primero las claves guardadas que aún existen en el
 * catálogo (en el orden guardado), luego las del catálogo todavía sin rankear (en
 * orden de catálogo). Las claves guardadas que ya no existen se descartan.
 */
export function teacherTypeOrdenDisplay(
  catalogo: TeacherTypeCategoria[],
  guardado: string[] | undefined,
): TeacherTypeCategoria[] {
  const byKey = new Map(catalogo.map((c) => [c.key, c] as const));
  const out: TeacherTypeCategoria[] = [];
  const used = new Set<string>();
  for (const key of guardado ?? []) {
    const cat = byKey.get(key);
    if (cat && !used.has(cat.key)) {
      out.push(cat);
      used.add(cat.key);
    }
  }
  for (const cat of catalogo) {
    if (!used.has(cat.key)) {
      out.push(cat);
      used.add(cat.key);
    }
  }
  return out;
}

/**
 * Mueve la categoría en `index` una posición hacia arriba (-1) o abajo (+1) y
 * devuelve el nuevo arreglo de claves. Fuera de rango ⇒ arreglo original sin
 * cambios (identidad referencial, útil para memos).
 */
export function moverTeacherTypeOrden(keys: string[], index: number, dir: -1 | 1): string[] {
  const target = index + dir;
  if (index < 0 || index >= keys.length || target < 0 || target >= keys.length) return keys;
  const next = keys.slice();
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}
