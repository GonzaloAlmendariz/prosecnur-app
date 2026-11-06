import { MONITOREO_PESTANAS } from "../../../../../lib/navegacion/catalogos/monitoreo";

/**
 * Readiness por pestaña de Cursos-horario (Meta B, L10).
 *
 * El perfil publicaba una sola marca, `monitoreo-aulas`, para sus cinco
 * secciones y diecinueve pestañas: el QA sabía que la página había montado,
 * pero no a qué vista había llegado. Una dirección muda que aterrizaba en la
 * sección por defecto salía aprobada con la marca de otra. Ahora la marca es la
 * dirección: `monitoreo-aulas-<sección>-<pestaña>`.
 *
 * Desde el revamp del esqueleto común (2026-10-23) la dirección es la PÚBLICA
 * —`monitoreo-aulas-control-registro`, `monitoreo-aulas-avance-porfacultad`—,
 * no la vista heredada que se monta: dos pestañas públicas que todavía montan
 * la misma vista (Insumos › Fuentes e Insumos › Reglas) publican marcas
 * distintas. Las sub-vistas (`panel`) comparten la marca de su pestaña, como
 * en Telefónico (estándar G5).
 *
 * Es el mismo patrón que telefónico (`readinessDeTelefonico`), acreditación
 * (`readinessDeAcreditacion`) y territorial.
 */
export const PREFIJO_READINESS_AULAS = "monitoreo-aulas";

const PESTANAS = MONITOREO_PESTANAS.aulas as Record<string, ReadonlyArray<{ key: string }>>;

/** Secciones públicas del perfil en el orden del catálogo de navegación. */
export function seccionesDeAulas(): string[] {
  return Object.keys(PESTANAS);
}

/** Claves de pestaña de una sección pública; vacío si no existe. */
export function pestanasDeAulas(seccion: string): string[] {
  return (PESTANAS[seccion] ?? []).map((item) => item.key);
}

/**
 * La marca de la vista. La pestaña se escribe tal cual llega: si no es de esa
 * sección no se sustituye por la primera, porque entonces una pestaña que no
 * existe heredaría la marca de su vecina (regla 1 de L10).
 */
export function readinessDeAulas(seccion: string, pestana: string): string {
  const clave = pestana.trim();
  return clave ? `${PREFIJO_READINESS_AULAS}-${seccion}-${clave}` : `${PREFIJO_READINESS_AULAS}-${seccion}`;
}

/** Todas las vistas principales del perfil, con su marca. */
export function vistasDeAulas(): Array<{ seccion: string; pestana: string; marca: string }> {
  return seccionesDeAulas().flatMap((seccion) => {
    const claves = pestanasDeAulas(seccion);
    const lista = claves.length ? claves : [""];
    return lista.map((pestana) => ({ seccion, pestana, marca: readinessDeAulas(seccion, pestana) }));
  });
}
