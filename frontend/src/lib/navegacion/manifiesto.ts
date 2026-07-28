// Manifiesto de navegación: la lista completa de vistas direccionables.
//
// Existe para que explorar la app sea ENUMERAR, no adivinar. El inspector
// visual navegaba haciendo click sobre etiquetas visibles
// (`--click-tab "Avance"`), y por eso se caía: cualquier label renombrado,
// truncado en viewport compacto o todavía no pintado por el warm start rompía
// el recorrido, y los overlays directamente no eran alcanzables.
//
// Con este manifiesto el recorrido es: pedir la lista de nodos, ir a cada
// dirección por URL, esperar readiness, capturar. Sin clicks a ciegas.

import {
  PROSECNUR_MODULES,
  type ProsecnurModuleMeta,
  type ProsecnurModuleSlug,
} from "../modules";
import {
  serializarDireccion,
  describirDireccion,
  type DireccionProsecnur,
} from "./direccion";
import type { PanelDeclarado } from "./paneles";
import {
  PANEL_CONFIGURACION,
  PANEL_MODULOS,
} from "../../features/home/panelesHome";

export type NivelNodo = "modulo" | "modo" | "seccion" | "pestana" | "panel";

export type NodoNavegacion = {
  /** Identidad estable del nodo: `monitoreo/territorial/avance`. */
  clave: string;
  nivel: NivelNodo;
  label: string;
  direccion: DireccionProsecnur;
  /** URL relativa lista para navegar. */
  href: string;
  /** Clave del nodo padre, o `null` en la raíz de un módulo. */
  padre: string | null;
};

function nodo(
  nivel: NivelNodo,
  label: string,
  direccion: DireccionProsecnur,
  padre: string | null,
): NodoNavegacion {
  return {
    clave: describirDireccion(direccion),
    nivel,
    label,
    direccion,
    href: serializarDireccion(direccion),
    padre,
  };
}

function nodosDeModulo(modulo: ProsecnurModuleMeta): NodoNavegacion[] {
  const salida: NodoNavegacion[] = [];
  const raiz = nodo("modulo", modulo.title, { modulo: modulo.slug }, null);
  salida.push(raiz);

  // Módulos sin modos: las secciones cuelgan directo del módulo.
  if (!modulo.modos || modulo.modos.length === 0) {
    for (const seccion of modulo.sections) {
      const direccion: DireccionProsecnur = {
        modulo: modulo.slug,
        seccion: seccion.id,
      };
      const nodoSeccion = nodo("seccion", seccion.label, direccion, raiz.clave);
      salida.push(nodoSeccion);
      for (const pestana of seccion.tabs ?? []) {
        salida.push(
          nodo(
            "pestana",
            pestana.label,
            { ...direccion, pestana: pestana.id },
            nodoSeccion.clave,
          ),
        );
      }
    }
    return salida;
  }

  // Con modos, cada modo reescribe el juego de secciones. La misma sección
  // puede existir en varios modos con etiqueta distinta ("Validación" en
  // territorial, "Calidad" en aulas): son nodos distintos y se enumeran así.
  for (const modo of modulo.modos) {
    const direccionModo: DireccionProsecnur = {
      modulo: modulo.slug,
      modo: modo.id,
    };
    const nodoModo = nodo("modo", modo.label, direccionModo, raiz.clave);
    salida.push(nodoModo);

    for (const seccion of modo.sections) {
      const direccion: DireccionProsecnur = {
        ...direccionModo,
        seccion: seccion.id,
      };
      const nodoSeccion = nodo("seccion", seccion.label, direccion, nodoModo.clave);
      salida.push(nodoSeccion);
      for (const pestana of seccion.tabs ?? []) {
        salida.push(
          nodo(
            "pestana",
            pestana.label,
            { ...direccion, pestana: pestana.id },
            nodoSeccion.clave,
          ),
        );
      }
    }
  }

  return salida;
}

/** Todos los nodos módulo/modo/sección/pestaña de la app. */
export const MANIFIESTO_NAVEGACION: readonly NodoNavegacion[] =
  PROSECNUR_MODULES.flatMap(nodosDeModulo);

/**
 * Panel de conexión de fuentes de Monitoreo.
 *
 * Vive en el manifiesto y no solo en su componente porque el QA visual recorre
 * ESTA lista: un panel que solo existe en runtime nunca entra en una corrida
 * automatizada, y el flujo de conectar una fuente es de los que más caro sale
 * si se rompe en silencio.
 */
const PANEL_CONECTAR_FUENTE: PanelDeclarado = {
  id: "conectar-fuente",
  label: "Conectar fuente",
  clase: "sideover",
};

/** Paneles declarados por módulo. `null` = disponibles en toda la app. */
export const PANELES_POR_MODULO: Readonly<
  Partial<Record<ProsecnurModuleSlug | "global", readonly PanelDeclarado[]>>
> = {
  global: [PANEL_MODULOS, PANEL_CONFIGURACION],
  monitoreo: [PANEL_CONECTAR_FUENTE],
};

export function nodosDe(modulo: ProsecnurModuleSlug): NodoNavegacion[] {
  return MANIFIESTO_NAVEGACION.filter(
    (item) => item.direccion.modulo === modulo,
  );
}

export function hijosDe(clave: string): NodoNavegacion[] {
  return MANIFIESTO_NAVEGACION.filter((item) => item.padre === clave);
}

export function nodoPorClave(clave: string): NodoNavegacion | null {
  return MANIFIESTO_NAVEGACION.find((item) => item.clave === clave) ?? null;
}

/**
 * Recorrido plano para runners de QA: una fila por vista visitable.
 *
 * El orden es determinista (el del manifiesto de módulos), así que dos
 * corridas producen la misma secuencia y sus evidencias son diffables.
 */
export function recorridoCompleto(opciones?: {
  modulos?: readonly ProsecnurModuleSlug[];
  niveles?: readonly NivelNodo[];
}): NodoNavegacion[] {
  const modulos = opciones?.modulos;
  const niveles = opciones?.niveles ?? ["seccion", "pestana"];
  return MANIFIESTO_NAVEGACION.filter(
    (item) =>
      niveles.includes(item.nivel) &&
      (!modulos || modulos.includes(item.direccion.modulo)),
  );
}
