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
  PANEL_ATAJOS_APP,
  PANEL_CONFIGURACION,
  PANEL_MODULOS,
  PANEL_PALETA,
} from "../../features/home/panelesHome";
import { PANEL_ESTUDIO } from "../../features/estudio/panelEstudio";
import { PANELES_GRAFICOS } from "../../features/graficos/panelesGraficos";
import { PANELES_CARGA } from "../../features/carga/panelesCarga";
import { PANELES_VALIDACION } from "../../features/validacion/panelesValidacion";
import { PANELES_ANALITICA } from "../../features/analitica/panelesAnalitica";
import { PANELES_CODIFICACION } from "../../features/codificacion/panelesCodificacion";
import { PANELES_DASHBOARD } from "../../features/dashboard/panelesDashboard";
import { PANELES_CORREOS } from "../../features/recopiladores/correos/panelesCorreos";
import { PANEL_REHACER_PLAN } from "../../features/recopiladores/resembrado";
import { PANELES_CAMPANAS } from "../../features/recopiladores/campanas/panelesCampanas";
import { PANEL_EDITOR_BLOQUE } from "../../features/recopiladores/editor/panelesEditor";
import { PANELES_TERRITORIAL } from "../../features/recopiladores/territorial/panelesTerritorial";
import { PANEL_SALIDAS_SELECCION } from "../../features/hojasRuta/seleccion/panelesSeleccion";
import { PANEL_AJUSTES_DISENO } from "../../features/hojasRuta/mapa/ajustes/panelAjustes";
import { PANEL_CONTACTOS_VARIABLES } from "../../features/recopiladores/correos/contactos/panelesContactos";
import { PANEL_NUEVO_FILTRO } from "../../features/xlsformEditor/choiceFilters/panelesFiltros";
import { PANEL_CAMPANA_COMPLEMENTARIA } from "../../features/xlsformEditor/shell/campanaComplementariaModel";
import { PANEL_LISTAS_OPCIONES } from "../../features/xlsformEditor/listas/panelListas";
import { PANEL_LOGICA_EXTERNA } from "../../features/xlsformEditor/shell/logicaExternaModel";
import { PANEL_EXPERIMENTO_CONJOINT } from "../../features/xlsformEditor/conjoint/estadoPanelConjoint";
import {
  PANEL_CATALOGOS,
  PANEL_IMPORTAR_SURVEYMONKEY,
  PANEL_LOGICA_SURVEYMONKEY,
} from "../../features/xlsformEditor/shell/panelesEditor";

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

/**
 * Ensayo «Revisar → Aplicar» de Avance › Salidas a Google Sheets (Meta B, L38):
 * dice qué filas se añaden, cambian y borran antes de escribir el libro.
 * Abrirlo por `?panel=revisar-publicacion` lanza el ensayo; no escribe nada.
 */
export const PANEL_REVISAR_PUBLICACION: PanelDeclarado = {
  id: "revisar-publicacion",
  label: "Revisar publicación",
  clase: "dialogo",
};

/**
 * «Revisar cambios» del libro del operativo, en Monitoreo › Cursos-horario ›
 * Avance › Salidas (ficha A5, P2): qué hojas escribe Publicar y cuáles nunca.
 * Abrirlo no escribe nada.
 */
export const PANEL_REVISAR_LIBRO: PanelDeclarado = {
  id: "revisar-libro",
  label: "Revisar cambios del libro",
  clase: "dialogo",
};

/** Paneles declarados por módulo. `null` = disponibles en toda la app. */
export const PANELES_POR_MODULO: Readonly<
  Partial<Record<ProsecnurModuleSlug | "global", readonly PanelDeclarado[]>>
> = {
  global: [PANEL_MODULOS, PANEL_CONFIGURACION, PANEL_PALETA, PANEL_ATAJOS_APP, PANEL_ESTUDIO],
  monitoreo: [PANEL_CONECTAR_FUENTE, PANEL_REEMPLAZO_AULAS, PANEL_REVISAR_PUBLICACION, PANEL_REVISAR_LIBRO],
  // Se abre sobre un formulario: `?panel=campana-complementaria&foco=<id>`.
  // `?panel=logica-externa&foco=<id>`: lógica y limpieza hechas fuera.
  // `?panel=catalogos`: el editor de listas; `?panel=logica-surveymonkey`: el borrador de saltos de SurveyMonkey.
  "editor-xlsform": [
    PANEL_CAMPANA_COMPLEMENTARIA,
    PANEL_LISTAS_OPCIONES,
    PANEL_LOGICA_EXTERNA,
    PANEL_EXPERIMENTO_CONJOINT,
    PANEL_CATALOGOS,
    PANEL_LOGICA_SURVEYMONKEY,
    PANEL_NUEVO_FILTRO,
    PANEL_IMPORTAR_SURVEYMONKEY,
  ],
  procesamiento: [...PANELES_GRAFICOS, ...PANELES_CARGA, ...PANELES_VALIDACION, ...PANELES_ANALITICA, ...PANELES_CODIFICACION],
  // Lista de campañas (ADR 0111): `?panel=nueva-campana` y
  // `?panel=campana-renombrar&foco=<campaña>`; borrar un correo es
  // `?panel=correo-campana-borrar`. La campaña de correo abierta: el inspector
  // del correo y sus paneles (ADR 0110 §2).
  // Aulas › Unidades: `?panel=rehacer-plan` confirma rehacer el plan (H26).
  // Aulas › Catálogo › Editor: el inspector del bloque, siempre abierto; lo elige `foco` (E1b).
  // Selección › salidas: `?seccion=seleccion&panel=salidas`. Sideover bajo 1280 px en la página clásica;
  // en el lienzo (ADR 0114) siempre sideover, disparado desde el pie del inspector.
  // `?panel=personalizar`: el editor de marca, color, vistas y pestañas del dashboard; `?panel=paletas`: las
  // paletas por lista; `?panel=publicar`: el despliegue (abrirlo no publica); `?panel=fuente`: «Datos», la fuente
  // del tablero, que lo reemplaza en la página.
  dashboard: [...PANELES_DASHBOARD],
  // `?panel=ajustes&foco=<grupo>`: «Ajustes del diseño», los ocho grupos de la configuración (maqueta 2026-11-05).
  "hojas-ruta": [PANEL_SALIDAS_SELECCION, PANEL_AJUSTES_DISENO],
  "material-campo": [
    ...PANELES_CAMPANAS,
    ...PANELES_CORREOS,
    PANEL_CONTACTOS_VARIABLES,
    PANEL_REHACER_PLAN,
    PANEL_EDITOR_BLOQUE,
    // Territorial › Unidades (ADR 0118 §4): `?panel=hoja&foco=<id_manzana>`, la hoja de la UMP en grande.
    ...PANELES_TERRITORIAL,
  ],
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
 * Como `nodoPorClave`, pero una clave sin modo de un módulo que los tiene cae en su primer modo: así
 * `hojas-ruta/seleccion` sigue llegando a la selección por UMP desde que Hojas de ruta declaró sus modos
 * (ADR 0125 §2). Lo usa el puente; los contratos siguen leyendo la clave exacta.
 */
export function nodoPorClaveOModoPorDefecto(clave: string): NodoNavegacion | null {
  const exacto = nodoPorClave(clave);
  if (exacto) return exacto;
  const [modulo, ...resto] = clave.split("/");
  const primerModo = PROSECNUR_MODULES.find((m) => m.slug === modulo)?.modos?.[0]?.id;
  if (!primerModo || !resto.length || resto[0] === primerModo) return null;
  return nodoPorClave([modulo, primerModo, ...resto].join("/"));
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
