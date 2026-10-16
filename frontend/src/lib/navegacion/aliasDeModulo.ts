// Slugs y rutas de módulo que se leen pero ya no se escriben.
//
// Un proyecto guardado antes del ADR 0108 trae `recopiladores` en
// `project_modules`, en el `module_id` de su bitácora y en las rutas que el
// backend publica en el resumen. Esos valores se LEEN como alias del slug
// vigente y nunca se escriben: la app solo emite `material-campo`.
//
// Los alias de PARÁMETRO (`tab`, `stage`…) viven en `direccion.ts`; aquí van
// los de VALOR que pertenecen al módulo y no a una página.

import type { ProsecnurModuleSlug } from "../modules";

/** Slug viejo → slug vigente. */
export const ALIAS_DE_MODULO: Readonly<Record<string, ProsecnurModuleSlug>> = {
  recopiladores: "material-campo",
};

/** Ruta vieja de módulo → ruta vigente. */
export const ALIAS_DE_RUTA: Readonly<Record<string, string>> = {
  "/recopiladores": "/material-campo",
};

/**
 * Secciones renombradas por módulo, para rutas que llegan ya escritas (del
 * backend o de un enlace guardado). Las páginas también las aceptan al leer;
 * esta tabla existe para que ningún consumidor reenvíe la forma vieja.
 */
const ALIAS_DE_SECCION: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "/hojas-ruta": { entrega: "seleccion" },
};

const PARAMS_DE_SECCION = ["seccion", "stage", "etapa"] as const;

/** El slug vigente de un módulo; un slug desconocido se devuelve tal cual. */
export function slugCanonicoDeModulo(slug: string): string {
  return ALIAS_DE_MODULO[slug] ?? slug;
}

/** Lista de slugs con los alias resueltos y sin repetidos, en su orden. */
export function slugsCanonicosDeModulo(slugs: readonly string[]): string[] {
  return Array.from(new Set(slugs.map(slugCanonicoDeModulo)));
}

/**
 * Reescribe una ruta interna a su forma vigente: pathname del módulo y valor de
 * sección renombrada. Conserva el resto de la query y el hash. Una ruta que no
 * es interna (no empieza por `/`) se devuelve intacta.
 */
export function rutaCanonicaDeModulo(ruta: string): string {
  if (typeof ruta !== "string" || !ruta.startsWith("/")) return ruta;
  const indiceHash = ruta.indexOf("#");
  const hash = indiceHash >= 0 ? ruta.slice(indiceHash) : "";
  const sinHash = indiceHash >= 0 ? ruta.slice(0, indiceHash) : ruta;
  const indiceQuery = sinHash.indexOf("?");
  const pathnameCrudo = indiceQuery >= 0 ? sinHash.slice(0, indiceQuery) : sinHash;
  const query = indiceQuery >= 0 ? sinHash.slice(indiceQuery + 1) : "";
  const pathname = ALIAS_DE_RUTA[pathnameCrudo] ?? pathnameCrudo;
  const secciones = ALIAS_DE_SECCION[pathname];

  let salidaQuery = query;
  if (secciones && query) {
    const params = new URLSearchParams(query);
    let cambio = false;
    for (const clave of PARAMS_DE_SECCION) {
      const valor = params.get(clave);
      const vigente = valor ? secciones[valor] : undefined;
      if (!vigente) continue;
      params.set(clave, vigente);
      cambio = true;
    }
    if (cambio) salidaQuery = params.toString();
  }

  if (pathname === pathnameCrudo && salidaQuery === query) return ruta;
  return `${pathname}${salidaQuery ? `?${salidaQuery}` : ""}${hash}`;
}
