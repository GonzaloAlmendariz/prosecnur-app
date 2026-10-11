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

/**
 * Fuente de ocurrencias de Monitoreo territorial.
 *
 * Su componente (`TerritorialOccurrencesSourceBar.tsx`) declara y conecta su
 * propia constante con el mismo id y clase; se repite aquí porque importar ese
 * `.tsx` arrastraría el perfil territorial al bundle principal. El contrato
 * `panelesDeclarados.contract.test.ts` falla si las dos copias divergen.
 */
const PANEL_FUENTE_OCURRENCIAS: PanelDeclarado = {
  id: "fuente",
  label: "Fuente de ocurrencias",
  clase: "sideover",
};

/** Paletas de las listas de opciones del Dashboard (L2). */
export const PANEL_DASHBOARD_PALETAS: PanelDeclarado = {
  id: "paletas",
  label: "Paletas de colores",
  clase: "dialogo",
};

/** Marca, pestañas y vistas del Dashboard (L2). */
export const PANEL_DASHBOARD_PERSONALIZAR: PanelDeclarado = {
  id: "personalizar",
  label: "Personalizar dashboard",
  clase: "dialogo",
};

/** Publicación del Dashboard (L2). */
export const PANEL_DASHBOARD_PUBLICAR: PanelDeclarado = {
  id: "publicar",
  label: "Publicar dashboard",
  clase: "dialogo",
};

/** Variables extra de la data que el formulario ya no declara (Carga, L2). */
export const PANEL_CARGA_RECONCILIACION: PanelDeclarado = {
  id: "reconciliacion",
  label: "Reconciliación de variables",
  clase: "dialogo",
};

/**
 * Ámbito de un panel: un módulo, `global`, o una sección de Procesamiento.
 *
 * Procesamiento es un solo módulo con cinco secciones que comparten ruta, así
 * que sus paneles comparten el espacio de ids de `?panel=`. La clave
 * `procesamiento` a secas se reserva a los paneles de Gráficos (contrato de la
 * Meta A: `PANELES_POR_MODULO.procesamiento === PANELES_GRAFICOS`); el resto de
 * secciones declara bajo `procesamiento/<seccion>`.
 */
export type AmbitoPanel =
  | ProsecnurModuleSlug
  | "global"
  | `procesamiento/${"carga" | "validacion" | "codificacion" | "analitica" | "graficos"}`;

/** Un overlay declarado que todavía se abre con un `useState` suelto. */
export type PanelSinConectar = {
  ambito: AmbitoPanel;
  panel: PanelDeclarado;
  /** Archivo (relativo a `frontend/src/`) donde vive hoy el overlay bespoke. */
  archivo: string;
};

type FilaPendiente = readonly [
  id: string,
  label: string,
  clase: PanelDeclarado["clase"],
  archivo: string,
];

/**
 * Overlays **declarados, sin conectar** (L2, inventario del censo §4.1).
 *
 * Existen en la app pero se abren con estado local, así que `?panel=<id>`
 * todavía no los abre. Se declaran igual para que el inventario sea
 * enumerable: el QA sabe que existen y el contrato
 * `panelesDeclarados.contract.test.ts` falla si uno se conecta sin salir de
 * esta lista o si el archivo citado deja de montar un overlay.
 */
const FILAS_SIN_CONECTAR: Readonly<Partial<Record<AmbitoPanel, readonly FilaPendiente[]>>> = {
  global: [
    ["notas-version", "Notas de versión", "sideover", "features/home/ReleaseNotesDrawer.tsx"],
    ["creditos", "Créditos", "sideover", "features/home/CreditsDrawer.tsx"],
    ["logs", "Panel de logs", "sideover", "components/LogsPanel.tsx"],
    ["gestor-modulos", "Módulos del proyecto", "dialogo", "app/ModuleManagerDialog.tsx"],
    ["estado-modulo", "Estado del módulo", "dialogo", "features/home/ModuleStatusCard.tsx"],
    ["ciclo-proyecto", "Abrir, guardar o cerrar proyecto", "dialogo", "features/project/ProjectLifecycleDialog.tsx"],
    ["guardar-entregable", "Guardar entregable en el proyecto", "popover", "features/project/SaveEntregableButton.tsx"],
  ],
  "diseno-estudio": [
    ["evento-calendario", "Evento del calendario", "dialogo", "features/bitacora/Calendar.tsx"],
    ["enlazar", "Enlazar con", "popover", "features/bitacora/vinculos/SelectorDeVinculo.tsx"],
    ["referenciar", "Referenciar en el lienzo", "popover", "features/bitacora/canvas/ExploradorDeReferencias.tsx"],
  ],
  "calc-muestra": [
    ["preset-canonico", "Precargar criterios del estudio anterior", "popover", "features/calcMuestra/universidad/criterios/PresetCanonicoButton.tsx"],
  ],
  "editor-xlsform": [
    ["logica-surveymonkey", "Lógica SurveyMonkey", "dialogo", "features/xlsformEditor/XlsformEditorPage.tsx"],
    ["vista-cuestionario", "Vista del cuestionario", "dialogo", "features/xlsformEditor/XlsformEditorPage.tsx"],
    ["agregar-pieza", "Selector de piezas", "popover", "features/xlsformEditor/XlsformEditorPage.tsx"],
    ["mapa-logica", "Mapa de lógica del formulario", "dialogo", "features/xlsformEditor/canvas-graph/LogicCanvas.tsx"],
    ["condicion-conexion", "Condición de la conexión", "popover", "features/xlsformEditor/canvas-graph/ConnectionConditionPicker.tsx"],
    ["matriz-pulso", "Matriz Pulso", "dialogo", "features/xlsformEditor/shell/MatrizPulsoDialog.tsx"],
    ["tour", "Recorrido guiado", "dialogo", "features/xlsformEditor/shell/Coachmarks.tsx"],
    ["diagnosticos", "Sugerencias y advertencias", "popover", "features/xlsformEditor/shell/DiagnosticsPopover.tsx"],
    ["importar-surveymonkey", "Traducir encuesta de SurveyMonkey", "dialogo", "features/xlsformEditor/shell/ImportSurveyMonkeyDialog.tsx"],
    ["resumen", "Resumen del formulario", "dialogo", "features/xlsformEditor/shell/FormSummaryView.tsx"],
    ["configurar-pdf", "Configurar PDF", "dialogo", "features/xlsformEditor/shell/ConfigurarPdfDialog.tsx"],
    ["simulador", "Probar formulario", "dialogo", "features/xlsformEditor/shell/FormSimulator.tsx"],
    ["filtros-opciones", "Filtros de opciones", "dialogo", "features/xlsformEditor/choiceFilters/ChoiceFiltersView.tsx"],
  ],
  monitoreo: [
    ["aulas-refuerzo", "Refuerzo de curso-horario", "popover", "features/monitoreo/profiles/aulas/AulasPopoverRefuerzo.tsx"],
    ["reconciliacion-espacial", "Confirmar reconciliaciones espaciales", "dialogo", "features/monitoreo/profiles/territorial/TerritorialValidationGeoWorkbench.tsx"],
    ["detalle-ump", "Detalle de UMP seleccionada", "inspector", "features/monitoreo/profiles/territorial/TerritorialFieldOccurrencesWorkbench.tsx"],
  ],
  "procesamiento/carga": [
    ["mapeo-opciones", "Revisar mapeo de opciones", "dialogo", "features/carga/CargaPage.tsx"],
    ["normalizacion-sav", "Revisar normalización SAV", "dialogo", "features/carga/SavNormalizationReviewDialog.tsx"],
  ],
  "procesamiento/validacion": [
    ["cruce", "Variable de cruce", "popover", "features/validacion/components/CrossBar.tsx"],
    ["variable", "Detalle de variable", "popover", "features/validacion/components/VariableChip.tsx"],
    ["lente", "Lente de contexto", "dialogo", "features/validacion/components/ContextLens.tsx"],
  ],
  "procesamiento/codificacion": [
    ["relacion", "Relación entre preguntas", "dialogo", "features/codificacion/RelationDialog.tsx"],
    ["relacionar-con", "Relacionar con", "dialogo", "features/codificacion/RelationTargetDialog.tsx"],
    ["emparejar", "Emparejar preguntas", "dialogo", "features/codificacion/PairingDialog.tsx"],
    ["importar-matriz", "Importar matriz de codificación", "dialogo", "features/codificacion/CodingConfigActions.tsx"],
  ],
  "procesamiento/analitica": [
    ["aplicar-plantilla", "Aplicar plantilla al instrumento", "dialogo", "features/analitica/dimensiones/confirmar-import/JsonImportPanel.tsx"],
  ],
  // Pedido a la Meta A: estos overlays viven en `features/graficos/**`, fuera
  // del alcance de L2. Al conectarlos se mueven a `panelesGraficos.ts`.
  "procesamiento/graficos": [
    ["estilo-global", "Estilo global", "dialogo", "features/graficos/v2/shell/EstiloGlobalDialog.tsx"],
    ["valores-por-defecto", "Valores por defecto", "dialogo", "features/graficos/DefaultsModal.tsx"],
    ["atajos", "Atajos de teclado", "dialogo", "features/graficos/ShortcutsModal.tsx"],
    ["editor-amplio", "Editor amplio", "dialogo", "features/graficos/laminas/EditorAmplio.tsx"],
    ["compartir", "Compartir plan de gráficos", "popover", "features/graficos/GraficosHeader.tsx"],
    ["estado-plan", "Estado del plan", "popover", "features/graficos/GraficosHeader.tsx"],
    ["guias-layout", "Guías de layout", "popover", "features/graficos/GraficosHeader.tsx"],
    ["plan-sugerido", "Plan de gráficos sugerido", "popover", "features/graficos/SuggestedPlanButton.tsx"],
    ["salud-plan", "Salud del plan de gráficos", "popover", "features/graficos/PlanHealthBadge.tsx"],
    ["cobertura-plan", "Cobertura del plan de gráficos", "popover", "features/graficos/PlanCoverageBadge.tsx"],
    ["exportar-informe", "Exportar reporte", "popover", "features/graficos/ExportarInformeMenu.tsx"],
    ["reportes-multibase", "Reportes del conjunto de bases", "popover", "features/graficos/MultibaseReportMenu.tsx"],
    ["selector-variable", "Seleccionar variable", "popover", "features/graficos/VariablePicker.tsx"],
    ["lista-variables", "Agregar variables", "popover", "features/graficos/VarsListPicker.tsx"],
    ["tipo-preset", "Tipo de preset", "popover", "features/graficos/PresetTypePicker.tsx"],
    ["multi-apiladas", "Bloques de barras apiladas", "popover", "features/graficos/MultiApiladasBuilder.tsx"],
    ["argumento", "Valor del argumento", "popover", "features/graficos/ArgField.tsx"],
    ["cambiar-graficador", "Cambiar tipo de gráfico", "popover", "features/graficos/GraficadorSlot.tsx"],
    ["vista-slide", "Vista previa del slide", "popover", "features/graficos/SlidePreview.tsx"],
  ],
  dashboard: [
    ["pantalla-completa", "Vista expandida", "dialogo", "features/dashboard/shared/FullscreenWrapper.tsx"],
    ["detalle-foda", "Detalle FODA", "dialogo", "features/dashboard/tabs/DimensionesTab/index.tsx"],
  ],
};

export const PANELES_SIN_CONECTAR: readonly PanelSinConectar[] = (
  Object.entries(FILAS_SIN_CONECTAR) as Array<[AmbitoPanel, readonly FilaPendiente[]]>
).flatMap(([ambito, filas]) =>
  filas.map(([id, label, clase, archivo]) => ({
    ambito,
    panel: { id, label, clase },
    archivo,
  })),
);

function sinConectarDe(ambito: AmbitoPanel): PanelDeclarado[] {
  return PANELES_SIN_CONECTAR.filter((item) => item.ambito === ambito).map(
    (item) => item.panel,
  );
}

/**
 * Paneles declarados por ámbito (`global` = disponibles en toda la app).
 *
 * Incluye los conectados a `?panel=` y los «declarados, sin conectar» de
 * `PANELES_SIN_CONECTAR`. El orden importa en Monitoreo: `PanelConectarFuente`
 * lee el primero.
 */
export const PANELES_POR_MODULO: Readonly<
  Partial<Record<AmbitoPanel, readonly PanelDeclarado[]>>
> = {
  global: [PANEL_MODULOS, PANEL_CONFIGURACION, ...sinConectarDe("global")],
  monitoreo: [
    PANEL_CONECTAR_FUENTE,
    PANEL_REEMPLAZO_AULAS,
    PANEL_FUENTE_OCURRENCIAS,
    ...sinConectarDe("monitoreo"),
  ],
  "diseno-estudio": [PANEL_AVISOS, PANEL_IMPORTAR, ...sinConectarDe("diseno-estudio")],
  "calc-muestra": sinConectarDe("calc-muestra"),
  "editor-xlsform": sinConectarDe("editor-xlsform"),
  procesamiento: PANELES_GRAFICOS,
  "procesamiento/carga": [PANEL_CARGA_RECONCILIACION, ...sinConectarDe("procesamiento/carga")],
  "procesamiento/validacion": sinConectarDe("procesamiento/validacion"),
  "procesamiento/codificacion": sinConectarDe("procesamiento/codificacion"),
  "procesamiento/analitica": sinConectarDe("procesamiento/analitica"),
  "procesamiento/graficos": sinConectarDe("procesamiento/graficos"),
  dashboard: [
    PANEL_DASHBOARD_PALETAS,
    PANEL_DASHBOARD_PERSONALIZAR,
    PANEL_DASHBOARD_PUBLICAR,
    ...sinConectarDe("dashboard"),
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
