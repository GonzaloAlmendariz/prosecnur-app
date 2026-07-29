// Árbol navegable de la app (ADR 0047, sobre la jerarquía del ADR 0044).
//
// El lienzo referencia PARTES DE LA APP, y las partes de la app no son una
// lista: son un árbol de cuatro niveles —módulo → [modo] → sección → pestaña—
// que ya está declarado en `lib/modules.ts`. Este archivo lo expone como árbol
// recorrible en vez de aplanarlo.
//
// Aplanarlo fue el primer intento y perdía dos niveles enteros: de ~70 destinos
// reales ofrecía 25, dejando fuera las 34 secciones de los 9 modos (todo
// Monitoreo territorial, telefónico, acreditación y cursos-horario) y las 14
// pestañas. Un mapa del estudio que no puede apuntar a «Monitoreo territorial ·
// Avance» no es un mapa del estudio.
//
// CLAVE DE DESTINO. Se guarda en el nodo y tiene que sobrevivir a un renombre
// de etiqueta, así que se arma con ids, no con rutas ni con labels:
//
//     modulo
//     modulo/seccion
//     modulo/seccion/pestana
//     modulo::modo/seccion
//     modulo::modo/seccion/pestana
//
// El `::` separa el modo sin ambigüedad: sin él, `a/b/c` podría ser
// módulo/sección/pestaña o módulo/modo/sección. Las claves de dos segmentos que
// ya estaban guardadas siguen resolviendo igual.

import {
  moduleChromeVars,
  PROSECNUR_MODULES,
  type ProsecnurModuleMeta,
} from "../../lib/modules";
import type { LucideIcon } from "../../vendor/lucide-react";

export type NivelApp = "modulo" | "modo" | "seccion" | "pestana";

export type NodoApp = {
  clave: string;
  nivel: NivelApp;
  label: string;
  /** "Módulo · Modo · Sección", para desambiguar fuera del árbol. */
  ruta: string;
  icono: LucideIcon | null;
  /** Dirección canónica. Un modo no es navegable por sí solo: aterrizas en él. */
  href: string;
  moduloSlug: string;
  vars: ReturnType<typeof moduleChromeVars> | undefined;
  hijos: NodoApp[];
};

const SEP_MODO = "::";

/**
 * Árbol completo. Se construye en cada llamada porque es barato (~70 nodos) y
 * memorizarlo obligaría a invalidar la caché al cambiar el registro.
 *
 * Incluye TODO, también lo que no se ofrece como destino: se usa para resolver
 * claves ya guardadas, y un nodo dejaría de resolver —y se leería como
 * huérfano— si el árbol de resolución encogiera junto con el de oferta.
 */
export function arbolDeLaApp(): NodoApp[] {
  return PROSECNUR_MODULES.map(nodoDeModulo);
}

/**
 * Módulos que NO se ofrecen como destino de una referencia.
 *
 * El lienzo vive dentro de Bitácora, así que un nodo que apunta a Bitácora —o a
 * Cronograma, Calendario o al propio Lienzo— es la superficie mirándose a sí
 * misma: no declara nada, igual que la fase «Diseño» que se retiró del
 * cronograma por la misma razón. Los hitos y las entradas SÍ se ofrecen: son
 * contenido del estudio, no la superficie que los muestra.
 */
export const MODULOS_NO_REFERENCIABLES: readonly string[] = ["diseno-estudio"];

/** El árbol que el explorador ofrece: todo menos la superficie que lo contiene. */
export function arbolReferenciable(): NodoApp[] {
  return arbolDeLaApp().filter((n) => !MODULOS_NO_REFERENCIABLES.includes(n.moduloSlug));
}

function nodoDeModulo(modulo: ProsecnurModuleMeta): NodoApp {
  const vars = moduleChromeVars(modulo);
  const base = {
    moduloSlug: modulo.slug,
    vars,
  };

  const modos = (modulo.modos ?? []).map((modo) => ({
    ...base,
    clave: `${modulo.slug}${SEP_MODO}${modo.id}`,
    nivel: "modo" as const,
    label: modo.label,
    ruta: `${modulo.shortLabel} · ${modo.label}`,
    icono: modulo.icon,
    // Un modo lo determina el estudio, no un click: su href lleva a la primera
    // sección, que es lo más cerca que se puede aterrizar.
    href: modo.sections[0]?.to ?? modulo.to ?? "",
    hijos: modo.sections.map((sec) =>
      nodoDeSeccion(modulo, sec, `${modulo.slug}${SEP_MODO}${modo.id}`, `${modulo.shortLabel} · ${modo.label}`),
    ),
  }));

  // Una sección que se llama igual que su módulo no es una pieza distinta: es
  // el módulo con otro nombre. Sus pestañas sí suben, para no perderlas.
  const propias: NodoApp[] = [];
  for (const sec of modulo.sections) {
    const nodo = nodoDeSeccion(modulo, sec, modulo.slug, modulo.shortLabel);
    if (sec.label === modulo.shortLabel) propias.push(...nodo.hijos);
    else propias.push(nodo);
  }

  return {
    ...base,
    clave: modulo.slug,
    nivel: "modulo",
    label: modulo.shortLabel,
    ruta: modulo.shortLabel,
    icono: modulo.icon,
    href: modulo.to ?? "",
    hijos: [...modos, ...propias],
  };
}

function nodoDeSeccion(
  modulo: ProsecnurModuleMeta,
  seccion: ProsecnurModuleMeta["sections"][number],
  prefijo: string,
  rutaPadre: string,
): NodoApp {
  const clave = `${prefijo}/${seccion.id}`;
  const ruta = `${rutaPadre} · ${seccion.label}`;
  return {
    clave,
    nivel: "seccion",
    label: seccion.label,
    ruta,
    icono: seccion.icon,
    href: seccion.to,
    moduloSlug: modulo.slug,
    vars: moduleChromeVars(modulo),
    hijos: (seccion.tabs ?? []).map((tab) => ({
      clave: `${clave}/${tab.id}`,
      nivel: "pestana" as const,
      label: tab.label,
      ruta: `${ruta} · ${tab.label}`,
      icono: tab.icon,
      href: tab.to,
      moduloSlug: modulo.slug,
      vars: moduleChromeVars(modulo),
      hijos: [],
    })),
  };
}

/** Índice plano `clave → nodo`, para resolver un destino guardado. */
export function indiceDeLaApp(): Map<string, NodoApp> {
  const mapa = new Map<string, NodoApp>();
  const visitar = (n: NodoApp) => {
    mapa.set(n.clave, n);
    n.hijos.forEach(visitar);
  };
  arbolDeLaApp().forEach(visitar);
  return mapa;
}

export function resolverDestino(clave: string): NodoApp | null {
  return indiceDeLaApp().get(clave ?? "") ?? null;
}

/** Los ancestros de un destino, del módulo hacia abajo, sin incluirlo. */
export function ancestrosDe(clave: string): NodoApp[] {
  const indice = indiceDeLaApp();
  const salida: NodoApp[] = [];
  let actual = clave ?? "";
  while (true) {
    const corte = Math.max(actual.lastIndexOf("/"), actual.lastIndexOf(SEP_MODO));
    if (corte <= 0) break;
    actual = actual.slice(0, corte);
    const nodo = indice.get(actual);
    if (nodo) salida.unshift(nodo);
  }
  return salida;
}

/** Clave del padre, o `null` si el destino es un módulo. */
export function padreDe(clave: string): string | null {
  const porBarra = (clave ?? "").lastIndexOf("/");
  const porModo = (clave ?? "").lastIndexOf(SEP_MODO);
  const corte = Math.max(porBarra, porModo);
  return corte > 0 ? clave.slice(0, corte) : null;
}

/**
 * Todas las hojas y ramas ofrecibles, en una sola lista, para buscar por texto.
 * Busca sobre lo mismo que se puede recorrer: si la búsqueda ofreciera algo que
 * el árbol no muestra, sería una puerta trasera a lo que se decidió no ofrecer.
 */
export function aplanarArbol(): NodoApp[] {
  const salida: NodoApp[] = [];
  const visitar = (n: NodoApp) => {
    salida.push(n);
    n.hijos.forEach(visitar);
  };
  arbolReferenciable().forEach(visitar);
  return salida;
}
