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
import { PANELES_GRAFICOS } from "../../features/graficos/panelesGraficos";
import { PANELES_CARGA } from "../../features/carga/panelesCarga";
import { PANELES_ANALITICA } from "../../features/analitica/panelesAnalitica";
import { PANEL_CAMPANA_COMPLEMENTARIA } from "../../features/xlsformEditor/shell/campanaComplementariaModel";
import { PANEL_LISTAS_OPCIONES } from "../../features/xlsformEditor/listas/panelListas";
import { PANEL_LOGICA_EXTERNA } from "../../features/xlsformEditor/shell/logicaExternaModel";
import { PANEL_CATALOGOS, PANEL_LOGICA_SURVEYMONKEY } from "../../features/xlsformEditor/shell/panelesEditor";

export type NivelNodo = "modulo" | "modo" | "seccion" | "pestana" | "panel";

export type NodoNavegacion = {
  /** Identidad estable del nodo: `monitoreo/territorial/avance`. */
  clave: string;
  nivel: NivelNodo;
  label: string;
  direccion: DireccionProsecnur;
  /** URL relativa lista para navegar. */
  href: string;
  /** Si la URL representa de verdad esta dirección completa. */
  direccionPublicada: boolean;
  /** Clave del nodo padre, o `null` en la raíz de un módulo. */
  padre: string | null;
};

function nodo(
  nivel: NivelNodo,
  label: string,
  direccion: DireccionProsecnur,
  padre: string | null,
  opciones: { href?: string; direccionPublicada?: boolean } = {},
): NodoNavegacion {
  return {
    clave: describirDireccion(direccion),
    nivel,
    label,
    direccion,
    href: opciones.href ?? serializarDireccion(direccion),
    direccionPublicada: opciones.direccionPublicada ?? true,
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
            {
              href: pestana.to,
              direccionPublicada: pestana.direccionPublicada ?? true,
            },
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
            {
              href: pestana.to,
              direccionPublicada: pestana.direccionPublicada ?? true,
            },
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

/**
 * Elegir el reemplazo de un curso-horario caído, en Monitoreo de cursos-horario.
 *
 * **Se declara aquí porque el QA visual recorre este manifiesto**, y esta
 * superficie era la única del perfil que ningún gate había visto nunca: el
 * popover llevaba su `data-pulso-panel` a mano y se abría con un `useState`
 * suelto, así que `popovers=0` en las 28 corridas del runner. Alcanzarlo por
 * click tampoco servía —el botón sólo existe tras seleccionar en la lista un
 * curso-horario caído, y el intento daba `locator.click: Timeout`—.
 *
 * Con el panel en la dirección, `?panel=aulas-reemplazo&foco=<código>` lo abre
 * sobre el curso-horario que se quiera, que es lo que pide la regla de la casa:
 * un overlay se conecta con `usePanelDireccionable`, no con un `useState`.
 */
export const PANEL_REEMPLAZO_AULAS: PanelDeclarado = {
  id: "aulas-reemplazo",
  label: "Elegir reemplazo",
  clase: "popover",
};

/** Centro de avisos del cronograma (ADR 0047). */
export const PANEL_AVISOS: PanelDeclarado = {
  id: "avisos",
  label: "Centro de avisos",
  clase: "sideover",
};

/** Importación del grafo con vista previa (ADR 0047). */
export const PANEL_IMPORTAR: PanelDeclarado = {
  id: "importar",
  label: "Importar mapa del estudio",
  clase: "dialogo",
};

/** Paneles declarados por módulo. `null` = disponibles en toda la app. */
export const PANELES_POR_MODULO: Readonly<
  Partial<Record<ProsecnurModuleSlug | "global", readonly PanelDeclarado[]>>
> = {
  global: [PANEL_MODULOS, PANEL_CONFIGURACION],
  monitoreo: [PANEL_CONECTAR_FUENTE, PANEL_REEMPLAZO_AULAS],
  "diseno-estudio": [PANEL_AVISOS, PANEL_IMPORTAR],
  // Se abre sobre un formulario: `?panel=campana-complementaria&foco=<id>`.
  // `?panel=logica-externa&foco=<id>`: lógica y limpieza hechas fuera.
  // `?panel=catalogos`: el editor de listas; `?panel=logica-surveymonkey`: el borrador de saltos de SurveyMonkey.
  "editor-xlsform": [
    PANEL_CAMPANA_COMPLEMENTARIA,
    PANEL_LISTAS_OPCIONES,
    PANEL_LOGICA_EXTERNA,
    PANEL_CATALOGOS,
    PANEL_LOGICA_SURVEYMONKEY,
  ],
  procesamiento: [...PANELES_GRAFICOS, ...PANELES_CARGA, ...PANELES_ANALITICA],
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
      item.direccionPublicada &&
      (!modulos || modulos.includes(item.direccion.modulo)),
  );
}
