// Familias de cálculos (E10 editor-conjoint, 2026-11-06). Un conjoint de 8 tareas genera 246 cálculos que son 15
// fórmulas repetidas por tarea y perfil (t1A_curso, t1B_curso, t2A_curso…). En la lista se ven como una fila por
// familia, plegable, en vez de 246 filas casi iguales.

/** Nombre de la familia: la tarea y el perfil (`t3B`) pasan a `t#P` y cualquier otro número a `#`. */
export function claveFamilia(nombre: string): string {
  return nombre.replace(/(^|_)t\d+[AB](?=_|$)/g, "$1t#P").replace(/\d+/g, "#");
}

/**
 * Título legible de una familia: sin el patrón `t#P` ni los `#` («cj_t#P_edad_r» → «edad_r, en cada tarea y perfil»).
 * Pedido de Gonzalo, 2026-11-06: rótulos sin códigos de patrón ni «×».
 */
export function tituloFamilia(clave: string): string {
  const m = /(?:^|_)t#P_(.+)$/.exec(clave);
  if (m) return `${m[1]!.replace(/#/g, "…")}, en cada tarea y perfil`;
  return clave.replace(/_?#/g, "…");
}

export type Agrupado<T> = { tipo: "suelto"; item: T } | { tipo: "familia"; clave: string; items: T[] };

/**
 * Agrupa en familias los elementos cuyo nombre sólo difiere en números o en la letra del perfil, cuando la familia
 * tiene al menos `minimo` miembros. Cada familia queda en el lugar de su primer miembro; el orden se respeta.
 */
export function agruparEnFamilias<T>(items: readonly T[], nombre: (t: T) => string, minimo = 4): Agrupado<T>[] {
  const porClave = new Map<string, T[]>();
  for (const it of items) {
    const n = nombre(it);
    const c = claveFamilia(n);
    if (c === n) continue;
    porClave.set(c, [...(porClave.get(c) ?? []), it]);
  }
  const out: Agrupado<T>[] = [];
  const puestas = new Set<string>();
  for (const it of items) {
    const c = claveFamilia(nombre(it));
    const familia = porClave.get(c);
    if (familia && familia.length >= minimo) {
      if (!puestas.has(c)) {
        out.push({ tipo: "familia", clave: c, items: familia });
        puestas.add(c);
      }
    } else {
      out.push({ tipo: "suelto", item: it });
    }
  }
  return out;
}
