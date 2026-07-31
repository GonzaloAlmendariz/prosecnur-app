#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const FRONTEND_ROOT = path.join(REPO_ROOT, "frontend", "src");
const OUTPUT_DIR = path.join(REPO_ROOT, "branding", "catalogo-visual");
const OUTPUT_DATA_DIR = path.join(OUTPUT_DIR, "data");
const OUTPUT_JSON = path.join(OUTPUT_DATA_DIR, "catalogo.json");
const OUTPUT_JS = path.join(OUTPUT_DATA_DIR, "catalogo-data.js");
const MANUAL_PATH = path.join(REPO_ROOT, "branding", "manual-identidad.html");
const MANUAL_START = "<!-- VISUAL_CATALOG:START -->";
const MANUAL_END = "<!-- VISUAL_CATALOG:END -->";
const CHECK_MODE = process.argv.includes("--check");
const TAB_SCOPE_TRANSVERSAL = "Transversal / sin pestaña local";
const TAB_SCOPE_MULTIPLE = "Varias pestañas / contexto dinámico";

const requireFromFrontend = createRequire(
  path.join(REPO_ROOT, "frontend", "package.json"),
);
const ts = requireFromFrontend("typescript");

const MODULES = [
  {
    id: "global",
    label: "Global",
    accent: "#002457",
    aliases: ["app", "components", "home", "project", "shared"],
  },
  {
    id: "bitacora",
    label: "Bitácora",
    accent: "#A16207",
    aliases: ["bitacora"],
  },
  {
    id: "calculo-muestra",
    label: "Cálculo de muestra",
    accent: "#7260AE",
    aliases: ["calcMuestra", "muestra", "aulasFlow"],
  },
  {
    id: "formularios",
    label: "Editor de formularios",
    accent: "#7172C1",
    aliases: ["xlsformEditor"],
  },
  {
    id: "hojas-ruta",
    label: "Hojas de ruta",
    accent: "#AC563B",
    aliases: ["hojasRuta"],
  },
  {
    id: "recopiladores",
    label: "Recopiladores",
    accent: "#106E8C",
    aliases: ["recopiladores"],
  },
  {
    id: "monitoreo",
    label: "Monitoreo",
    accent: "#A0464E",
    aliases: ["monitoreo"],
  },
  {
    id: "procesamiento",
    label: "Procesamiento",
    accent: "#0F766E",
    aliases: [
      "procesamiento",
      "carga",
      "validacion",
      "codificacion",
      "analitica",
      "graficos",
    ],
  },
  {
    id: "dashboard",
    label: "Dashboard",
    accent: "#4A6EB6",
    aliases: ["dashboard"],
  },
];

const HIERARCHY = [
  {
    module: "global",
    sections: [
      {
        id: "arranque",
        label: "Arranque",
        tabs: [
          "BootGate",
          "Selector de proyecto",
          "Crear proyecto",
          "Abrir proyecto",
          "Warm start",
        ],
      },
      {
        id: "shell",
        label: "Shell global",
        tabs: [
          "Navegación de módulos",
          "Archivo y proyecto",
          "Sesión",
          "Guardado",
          "Ajustes",
        ],
      },
      {
        id: "home",
        label: "Home",
        tabs: [
          "Configuración inicial",
          "Mission control",
          "Carrusel",
          "Gestor de módulos",
        ],
      },
      {
        id: "proyecto",
        label: "Proyecto",
        tabs: [
          "Ciclo de vida",
          "Nombre de archivo",
          "Módulos del proyecto",
          "Guardar entregable",
        ],
      },
      {
        id: "compartidos",
        label: "Componentes compartidos",
        tabs: [
          "Botones",
          "Navegación",
          "Estados",
          "Paneles",
          "Overlays",
          "Progreso",
        ],
      },
    ],
  },
  {
    module: "bitacora",
    sections: [
      { id: "bitacora", label: "Bitácora", tabs: [] },
      { id: "cronograma", label: "Cronograma", tabs: ["Gantt", "Editor"] },
      { id: "calendario", label: "Calendario", tabs: ["Mes", "Semana"] },
    ],
  },
  {
    module: "calculo-muestra",
    sections: [
      {
        id: "mesas",
        label: "Selector de mesa",
        tabs: [
          "Opinión universitaria",
          "Cálculo general",
          "Acreditación institucional",
          "Territorial",
          "Legacy",
        ],
      },
      {
        id: "universidad-datos",
        label: "Opinión universitaria · Datos",
        tabs: ["Estudio", "Fuentes", "Consistencia", "Variables"],
      },
      {
        id: "universidad-marco",
        label: "Opinión universitaria · Marco",
        tabs: [
          "Criterios del estudiante",
          "Cursos-horario: criterios + radiografía",
          "Población",
          "Cursos-horario",
          "Cobertura",
        ],
      },
      {
        id: "universidad-calculo",
        label: "Opinión universitaria · Cálculo",
        tabs: [
          "Diseño",
          "Propuestas",
          "Cursos-horario por facultad",
          "Distribución",
        ],
      },
      {
        id: "universidad-seleccion",
        label: "Opinión universitaria · Selección",
        tabs: [
          "Marco de cursos-horario",
          "Objetivo de muestra",
          "Comparar métodos",
          "Simulación",
          "Cursos-horario titulares",
          "Reemplazos por curso-horario",
          "Sustento técnico",
        ],
      },
      {
        id: "universidad-entrega",
        label: "Opinión universitaria · Entrega",
        tabs: ["Cierre", "Entregables", "Tablas", "Pase a Monitoreo"],
      },
      {
        id: "general-marco",
        label: "Cálculo general · Marco",
        tabs: ["Resumen", "Configuración", "Resultado"],
      },
      {
        id: "general-metodo",
        label: "Cálculo general · Método",
        tabs: ["Resumen", "Configuración", "Resultado"],
      },
      {
        id: "general-resultados",
        label: "Cálculo general · Resultados",
        tabs: ["Resumen", "Configuración", "Resultado"],
      },
      {
        id: "acreditacion-actores",
        label: "Acreditación institucional · Actores",
        tabs: ["Resumen", "Configuración", "Resultado"],
      },
      {
        id: "acreditacion-contexto",
        label: "Acreditación institucional · Contexto",
        tabs: ["Resumen", "Configuración", "Resultado"],
      },
      {
        id: "acreditacion-resultados",
        label: "Acreditación institucional · Resultados",
        tabs: ["Resumen", "Configuración", "Resultado"],
      },
      {
        id: "territorial",
        label: "Territorial",
        tabs: ["Pase a Hojas de ruta"],
      },
      {
        id: "legacy",
        label: "Legacy",
        tabs: ["Diseñar desde marco"],
      },
    ],
  },
  {
    module: "formularios",
    sections: [
      {
        id: "biblioteca",
        label: "Biblioteca",
        tabs: ["Formularios", "Crear", "Abrir", "Importar"],
      },
      {
        id: "constructor",
        label: "Editor · Constructor",
        tabs: [
          "Foco",
          "Vista general",
          "Contenido",
          "Respuesta / Estructura",
          "Reglas",
          "Datos",
          "Presentación",
        ],
      },
      {
        id: "hojas",
        label: "Editor · Hojas",
        tabs: ["Preguntas", "Opciones", "Configuración", "Papel / PDF"],
      },
      {
        id: "vistas",
        label: "Editor · Más vistas",
        tabs: [
          "Probar formulario",
          "Resumen formulario",
          "Vista cuestionario",
          "Listas de opciones",
          "Mapa de lógica",
          "Filtros de opciones",
          "Lógica SurveyMonkey",
        ],
      },
      {
        id: "inspector-legacy",
        label: "Inspector legacy",
        tabs: ["Básico", "Apariencia", "Más", "Lógica"],
      },
    ],
  },
  {
    module: "hojas-ruta",
    sections: [
      { id: "territorio", label: "Territorio", tabs: ["Piloto", "Campo real"] },
      { id: "poblacion", label: "Población", tabs: ["Piloto", "Campo real"] },
      { id: "muestra", label: "Muestra", tabs: ["Piloto", "Campo real"] },
      { id: "manzanas", label: "Manzanas", tabs: ["Piloto", "Campo real"] },
      {
        id: "entrega",
        label: "Entrega",
        tabs: ["Cuotas", "Titulares", "Reemplazos"],
      },
    ],
  },
  {
    module: "recopiladores",
    sections: [
      {
        id: "plan-recoleccion",
        label: "Plan",
        tabs: ["Unidades"],
      },
      {
        id: "accesos",
        label: "Accesos",
        tabs: ["Canales", "Vinculación"],
      },
      {
        id: "materiales",
        label: "Materiales",
        tabs: ["Vista previa", "Paquetes"],
      },
      {
        id: "entrega-campo",
        label: "Entrega",
        tabs: ["Monitoreo"],
      },
    ],
  },
  {
    module: "monitoreo",
    sections: [
      {
        id: "territorial-fuente",
        label: "Territorial · Fuente",
        tabs: [
          "Formulario",
          "Filtro y distritos",
          "Encuestadores",
          "Reconciliación",
          "Historial",
        ],
      },
      {
        id: "territorial-umps",
        label: "Territorial · UMPs",
        tabs: ["Cobertura", "Manzanas"],
      },
      {
        id: "territorial-validacion",
        label: "Territorial · Validación",
        tabs: [
          "Geolocalización",
          "Reconciliación UMP",
          "Duración de tiempo",
          "Cuotas",
          "Anulación",
        ],
      },
      {
        id: "territorial-consultas",
        label: "Territorial · Consultas internas",
        tabs: ["Registro", "GPS", "Duración", "Responsable", "Subsanaciones"],
      },
      {
        id: "territorial-avance",
        label: "Territorial · Avance",
        tabs: ["Resumen", "Mapa y UMP", "Ritmo", "Salidas"],
      },
      {
        id: "territorial-ocurrencias",
        label: "Territorial · Ocurrencias de campo",
        tabs: ["Resumen", "Reporte UMP", "UMP", "Alertas", "Ritmo"],
      },
      {
        id: "acreditacion-fuentes",
        label: "Acreditación · Fuentes",
        tabs: [
          "Encuestas en plataforma",
          "Bases en Sheets",
          "Recopiladores",
          "Fuentes activas",
        ],
      },
      {
        id: "acreditacion-modelo",
        label: "Acreditación · Modelo operativo",
        tabs: ["Modelo operativo", "Cronograma", "Resumen"],
      },
      {
        id: "acreditacion-consultas",
        label: "Acreditación · Consultas",
        tabs: [
          "Registros en plataforma",
          "Estado de la base",
          "Cruces efectivos",
          "Subsanación",
        ],
      },
      {
        id: "acreditacion-telefonico",
        label: "Acreditación · Monitoreo telefónico",
        tabs: [
          "Resumen",
          "Día",
          "Incidencia",
          "Responsables",
          "Alertas",
          "Supervisión",
        ],
      },
      {
        id: "acreditacion-avance",
        label: "Acreditación · Avance",
        tabs: ["Resumen", "Actores", "Encuestas", "Detalle", "Salidas"],
      },
      {
        id: "telefonico-fuentes",
        label: "Telefónico · Fuentes",
        tabs: ["Kobo", "Base y barrido", "Paquete"],
      },
      {
        id: "telefonico-modelo",
        label: "Telefónico · Modelo operativo",
        tabs: ["Modelo operativo", "Cronograma", "Resumen"],
      },
      {
        id: "telefonico-llamadas",
        label: "Telefónico · Llamadas",
        tabs: [
          "Resumen",
          "Consultados",
          "Día",
          "Tiempos",
          "Incidencia",
          "Responsables",
          "Alertas",
          "Supervisión",
        ],
      },
      {
        id: "telefonico-consultas",
        label: "Telefónico · Consultas",
        tabs: [
          "Registros en plataforma",
          "Estado de la base",
          "Cruces efectivos",
          "Subsanación",
        ],
      },
      {
        id: "telefonico-avance",
        label: "Telefónico · Avance",
        tabs: ["Resumen", "Actores", "Encuestas", "Detalle", "Salidas"],
      },
      {
        id: "aulas-fuentes",
        label: "Aulas · Fuentes",
        tabs: [],
      },
      {
        id: "aulas-agenda",
        label: "Aulas · Agenda cursos-horario",
        tabs: [],
      },
      {
        id: "aulas-avance",
        label: "Aulas · Avance",
        tabs: [],
      },
      {
        id: "aulas-validacion",
        label: "Aulas · Validación",
        tabs: [],
      },
      {
        id: "aulas-consultas",
        label: "Aulas · Consultas",
        tabs: [],
      },
      {
        id: "informe-publico",
        label: "Informe público",
        tabs: ["Orden dinámico definido por el reporte"],
      },
      {
        id: "compartido",
        label: "Chrome y salidas compartidas",
        tabs: ["Shell", "Navegación", "Entregables"],
      },
    ],
  },
  {
    module: "procesamiento",
    sections: [
      {
        id: "entrada",
        label: "Entrada",
        tabs: ["Prerrequisitos", "Visor de base"],
      },
      {
        id: "carga",
        label: "Carga",
        tabs: ["Plan", "Fuentes", "Revisión", "Estructura", "Datos"],
      },
      {
        id: "validacion",
        label: "Validación",
        tabs: [
          "Explorar respuestas",
          "Reglas del formulario",
          "Criterios de revisión",
          "Cierre de base",
          "Panorama (declarada inactiva)",
        ],
      },
      {
        id: "codificacion",
        label: "Codificación",
        tabs: [
          "Preparar",
          "Codificar",
          "Matrices",
          "Adaptar",
          "Detalle de pregunta",
        ],
      },
      {
        id: "analitica",
        label: "Analítica",
        tabs: [
          "Datos",
          "Base final",
          "Libro de códigos",
          "Bases e instrumentos",
          "Ponderación",
          "Frecuencias",
          "Tablas multibase",
          "Base panel",
          "Ficha técnica",
          "Cruces",
          "Orden de categorías",
          "Dimensiones",
          "Enumeradores (declarada inactiva)",
        ],
      },
      {
        id: "graficos",
        label: "Gráficos",
        tabs: [
          "Timeline",
          "Canvas",
          "Inspector · Contenido",
          "Inspector · Datos",
          "Inspector · Estilo",
          "Inspector · Filtros",
          "Estilo global · Base PPT",
          "Estilo global · Base Word",
          "Estilo global · Color e identidad",
          "Estilo global · Íconos",
          "Estilo global · Estilos guardados",
        ],
      },
    ],
  },
  {
    module: "dashboard",
    sections: [
      {
        id: "tablero",
        label: "Tablero",
        tabs: ["Resumen", "Relaciones", "Base de datos", "Dimensiones"],
      },
      {
        id: "configuracion",
        label: "Configuración",
        tabs: [
          "Datos",
          "Paletas",
          "Personalizar",
          "Vista previa",
          "Publicación",
        ],
      },
    ],
  },
];

const DECLARED_VISUAL_SURFACES = [
  surface(
    "bitacora",
    "cronograma",
    "Gantt",
    "Gantt interactivo",
    "Barras de duración, hitos, ventanas, progreso y riesgo; las filas se seleccionan para editar la actividad.",
    "frontend/src/features/bitacora/CronogramaSection.tsx",
  ),
  surface(
    "bitacora",
    "calendario",
    "Mes / Semana",
    "Calendario temporal",
    "Grilla mensual o semanal con carriles, eventos solapados, arrastre y franjas de 15 minutos.",
    "frontend/src/features/bitacora/Calendar.tsx",
  ),
  surface(
    "calculo-muestra",
    "universidad-calculo",
    "Diseño",
    "Curva P y campana Z",
    "SVG metodológicos que explican la sensibilidad de p y el nivel de confianza del cálculo.",
    "frontend/src/features/calcMuestra/universidad/calculo/parametrosVisuales.tsx",
  ),
  surface(
    "calculo-muestra",
    "universidad-marco",
    "Cursos-horario: criterios + radiografía",
    "Radiografía del marco",
    "Boxplots, barras y tablas dinámicas de cursos-horario por facultad, sesión y nivel.",
    "frontend/src/features/calcMuestra/universidad/marco/marcoCharts.tsx",
  ),
  surface(
    "calculo-muestra",
    "universidad-seleccion",
    "Comparar métodos / Simulación",
    "Simulación de selección",
    "SVG del salto sistemático, balance, estabilidad de pesos e histogramas Monte Carlo.",
    "frontend/src/features/calcMuestra/universidad/aulas/aulasParts.tsx",
  ),
  surface(
    "formularios",
    "vistas",
    "Mapa de lógica",
    "Canvas de lógica",
    "Grafo con nodos, conectores, condiciones y auto-layout para inspeccionar el flujo del formulario.",
    "frontend/src/features/xlsformEditor/canvas-graph/LogicCanvas.tsx",
  ),
  surface(
    "formularios",
    "vistas",
    "Probar formulario / Vista cuestionario",
    "Inputs de formulario simulados",
    "Render dinámico del tipo de pregunta, opciones, reglas, apariencias, grupos y estados de respuesta.",
    "frontend/src/features/xlsformEditor/canvas/previewInputs.tsx",
  ),
  markdownRuntimeSurface(
    "span",
    "Markdown: encabezado o color",
    "Genera un span para encabezados de nivel visual y fragmentos con color saneado.",
    64,
  ),
  markdownRuntimeSurface(
    "a",
    "Markdown: enlace",
    "Genera un enlace interactivo con protocolo permitido, pestaña nueva y protección noopener/noreferrer.",
    78,
    "Navegación",
  ),
  markdownRuntimeSurface(
    "strong",
    "Markdown: negrita",
    "Genera énfasis fuerte desde marcadores **texto** o __texto__.",
    89,
  ),
  markdownRuntimeSurface(
    "em",
    "Markdown: cursiva",
    "Genera énfasis en cursiva desde marcadores *texto* o _texto_.",
    95,
  ),
  markdownRuntimeSurface(
    "s",
    "Markdown: tachado",
    "Genera texto tachado desde marcadores ~~texto~~.",
    99,
  ),
  markdownRuntimeSurface(
    "br",
    "Markdown: salto de línea",
    "Genera un salto de línea visual para cada salto simple del contenido.",
    114,
  ),
  markdownRuntimeSurface(
    "p",
    "Markdown: párrafo",
    "Genera párrafos de vista previa, incluido el estado vacío y la separación por dobles saltos.",
    107,
  ),
  surface(
    "hojas-ruta",
    "territorio",
    "Piloto / Campo real",
    "Mapa de Lima y Callao",
    "Cartografía prioritariamente vertical con jerarquía distrito → zona → manzana, capas Campo/NSE, hover, popup, zoom y selección.",
    "frontend/src/features/hojasRuta/HojasRutaPage.tsx",
  ),
  surface(
    "hojas-ruta",
    "manzanas",
    "Piloto / Campo real",
    "Mapa de rutas y selección",
    "Canvas/SVG cartográfico con zonas, manzanas, titulares, reemplazos, rutas y mini diagramas metodológicos.",
    "frontend/src/features/hojasRuta/HojasRutaPage.tsx",
  ),
  surface(
    "recopiladores",
    "materiales",
    "Vista previa",
    "Código QR generado",
    "Bitmap asíncrono embebido como data URL, con estados cargando, generado, fallido y sin enlace.",
    "frontend/src/features/recopiladores/MaterialsSection.tsx",
  ),
  surface(
    "recopiladores",
    "materiales",
    "Paquetes",
    "Documento paginado imprimible",
    "Portada y fichas por facultad con bloques ocultos en pantalla y visibles al imprimir.",
    "frontend/src/features/recopiladores/MaterialsSection.tsx",
  ),
  surface(
    "monitoreo",
    "territorial-avance",
    "Mapa y UMP",
    "Atlas territorial",
    "Mapa de cobertura, UMP, rutas, avance, inspección y salidas territoriales.",
    "frontend/src/features/monitoreo/profiles/territorial/TerritorialRouteCoverageAtlas.tsx",
  ),
  surface(
    "monitoreo",
    "informe-publico",
    "Orden dinámico definido por el reporte",
    "Informe público dinámico",
    "Las pestañas, bloques, estados y visualizaciones siguen tab_order y los datos del reporte publicado.",
    "frontend/src/features/monitoreo/public/MonitoreoPublicReportPage.tsx",
  ),
  surface(
    "procesamiento",
    "validacion",
    "Explorar respuestas",
    "Visualizaciones Plotly de validación",
    "Barras, donuts, heatmaps, radar, KPI, histograma, boxplot, scatterpolar y tabla con estados de carga.",
    "frontend/src/features/validacion/components/PlotlyView.tsx",
  ),
  surface(
    "procesamiento",
    "validacion",
    "Cierre de base",
    "Barra de almacenamiento de decisiones",
    "Distribución apilada de Documentar, Excluir, Corregir y Pendiente.",
    "frontend/src/features/validacion/components/DecisionStorageBar.tsx",
  ),
  surface(
    "procesamiento",
    "graficos",
    "Timeline / Canvas",
    "Previews de slides",
    "SVG y previews dinámicos según plantilla de slide, tipo de gráfico, contenido, estilo y placeholders.",
    "frontend/src/features/graficos/SlidePreview.tsx",
  ),
  surface(
    "procesamiento",
    "graficos",
    "Canvas",
    "Canvas del plan",
    "Nodos de slide, selección múltiple, navegación espacial, toolbar, duplicación y eliminación masiva.",
    "frontend/src/features/graficos/v2/canvas/PlanCanvas.tsx",
  ),
  surface(
    "procesamiento",
    "analitica",
    "Dimensiones",
    "Árbol de dimensiones",
    "SVG generado a partir de listas, bloques, subíndices e índices definidos en el wizard.",
    "frontend/src/features/analitica/dimensiones/shared/DiagramaArbol.tsx",
  ),
  surface(
    "dashboard",
    "tablero",
    "Resumen / Relaciones",
    "Gráficos Plotly del dashboard",
    "Gráficos por pregunta, cruces, filtros, iteración, pantalla completa y exportación como imagen.",
    "frontend/src/features/dashboard/shared/PlotlyChart.tsx",
  ),
  surface(
    "dashboard",
    "tablero",
    "Dimensiones",
    "Visuales de dimensiones",
    "Heatmap, barras, radar, FODA, matriz, dispersión e indicador ensamblado con SVG/Plotly.",
    "frontend/src/features/dashboard/tabs/DimensionesTab/index.tsx",
  ),
  {
    ...surface(
      "dashboard",
      "tablero",
      "Varias pestañas / contexto dinámico",
      "Pestañas del manifiesto del dashboard",
      "Cada pestaña habilitada por el manifiesto se materializa como navegación y contenido; el conjunto depende de la configuración publicada.",
      "frontend/src/features/dashboard/DashboardPage.tsx",
    ),
    provider: "manifest.tabs y config.tabs_enabled",
    renderedWhen: "Cuando el manifiesto contiene una pestaña habilitada.",
    states: ["habilitada", "deshabilitada", "activa", "inactiva"],
  },
  {
    ...surface(
      "formularios",
      "constructor",
      "Varias pestañas / contexto dinámico",
      "Preguntas, grupos y opciones del formulario activo",
      "El editor materializa filas, tarjetas, inputs, opciones, lógica y validaciones a partir del workbook XLSForm abierto.",
      "frontend/src/features/xlsformEditor/XlsformEditorPage.tsx",
    ),
    provider: "Workbook XLSForm, hojas survey/choices/settings y estado del editor",
    renderedWhen: "Cuando existe un formulario activo y sus filas pasan los filtros de la vista.",
    states: ["sin-formulario", "cargando", "editable", "solo-lectura", "con-error"],
  },
  {
    ...surface(
      "monitoreo",
      "compartido",
      "Varias pestañas / contexto dinámico",
      "Rail de trabajo por perfil de Monitoreo",
      "El rail compartido materializa secciones, pestañas locales, badges y bloqueos definidos por el perfil activo.",
      "frontend/src/features/monitoreo/components/MonitoreoWorkbenchRail.tsx",
    ),
    provider: "profile.views, sectionStates, tabStates y localTabs",
    renderedWhen: "Cuando Monitoreo resuelve un perfil operativo y sus vistas disponibles.",
    states: ["activa", "completada", "bloqueada", "con-badge", "colapsada"],
  },
  {
    ...surface(
      "procesamiento",
      "entrada",
      "Varias pestañas / contexto dinámico",
      "Filas, columnas y opciones de bases cargadas",
      "Visores y tablas materializan columnas, registros, filtros y opciones a partir de las bases activas del proyecto.",
      "frontend/src/features/procesamiento/ProcessingSheetViewer.tsx",
    ),
    provider: "Metadatos y filas de la base activa",
    renderedWhen: "Cuando existe una base cargada y la vista solicita una hoja o subconjunto.",
    states: ["sin-base", "cargando", "con-datos", "filtrada", "con-error"],
  },
];

const SOURCE_CONTEXT_RULES = [
  rule(/features\/home\//, "global", "home", "Mission control"),
  rule(/features\/project\//, "global", "proyecto", "Proyecto"),
  rule(/components\//, "global", "compartidos", "Compartido"),
  rule(/(?:^|\/)lib\//, "global", "compartidos", "Runtime compartido"),
  rule(/frontend\/src\/main\.tsx$/, "global", "shell", "Arranque React"),
  rule(/app\/Boot/, "global", "arranque", "Boot"),
  rule(/app\//, "global", "shell", "Shell"),
  rule(/features\/bitacora\/.*Calendar/i, "bitacora", "calendario", "Mes"),
  rule(/features\/bitacora\/.*Cronograma/i, "bitacora", "cronograma", null),
  rule(/features\/bitacora\//, "bitacora", "bitacora", null),
  rule(
    /features\/calcMuestra\/universidad\/definicion\//,
    "calculo-muestra",
    "universidad-datos",
    null,
  ),
  rule(
    /features\/calcMuestra\/universidad\/(?:marco|criterios)\//,
    "calculo-muestra",
    "universidad-marco",
    null,
  ),
  rule(
    /features\/calcMuestra\/universidad\/calculo\//,
    "calculo-muestra",
    "universidad-calculo",
    null,
  ),
  rule(
    /features\/calcMuestra\/universidad\/aulas\//,
    "calculo-muestra",
    "universidad-seleccion",
    null,
  ),
  rule(
    /features\/calcMuestra\/universidad\/salidas\//,
    "calculo-muestra",
    "universidad-entrega",
    null,
  ),
  rule(
    /features\/(?:calcMuestra|muestra|aulasFlow)\//,
    "calculo-muestra",
    "mesas",
    null,
  ),
  rule(/features\/xlsformEditor\/catalogs\//, "formularios", "biblioteca", null),
  rule(
    /features\/xlsformEditor\/shell\/(?:FormsLibrary|FormCard|AddFormCard|NewFormActions|HubFlowDiagram|HubOutputs)/,
    "formularios",
    "biblioteca",
    null,
  ),
  rule(
    /features\/xlsformEditor\/(?:canvas-graph|choiceFilters|logic)\//,
    "formularios",
    "vistas",
    null,
  ),
  rule(
    /features\/xlsformEditor\/shell\/(?:FormSimulator|FormSummaryView|MoreViewsMenu|SurveyMonkeyLogicIcons)/,
    "formularios",
    "vistas",
    null,
  ),
  rule(
    /features\/xlsformEditor\/canvas\//,
    "formularios",
    "constructor",
    "Constructor",
  ),
  rule(
    /features\/xlsformEditor\/sheets\//,
    "formularios",
    "hojas",
    "Hojas",
  ),
  rule(
    /features\/xlsformEditor\/inspector\//,
    "formularios",
    "inspector-legacy",
    null,
  ),
  rule(/features\/xlsformEditor\//, "formularios", "constructor", null),
  rule(/features\/hojasRuta\//, "hojas-ruta", "territorio", null),
  rule(/features\/recopiladores\//, "recopiladores", "plan-recoleccion", null),
  rule(
    /features\/monitoreo\/profiles\/territorial\/TerritorialSourceConsole/,
    "monitoreo",
    "territorial-fuente",
    null,
  ),
  rule(
    /features\/monitoreo\/profiles\/territorial\/(?:TerritorialModelWorkbench|TerritorialRouteCoverageAtlas)/,
    "monitoreo",
    "territorial-umps",
    null,
  ),
  rule(
    /features\/monitoreo\/profiles\/territorial\/(?:TerritorialValidationGeoWorkbench|TerritorialDurationControl|TerritorialQuotaConsistencyPanel|TerritorialProductionAnnulmentWorkspace)/,
    "monitoreo",
    "territorial-validacion",
    null,
  ),
  rule(
    /features\/monitoreo\/profiles\/territorial\/(?:TerritorialReviewCasesWorkbench|TerritorialOperationalAdjustmentsWorkspace)/,
    "monitoreo",
    "territorial-consultas",
    null,
  ),
  rule(
    /features\/monitoreo\/profiles\/territorial\/(?:TerritorialAdvanceWorkbench|TerritorialOutputsPanel)/,
    "monitoreo",
    "territorial-avance",
    null,
  ),
  rule(
    /features\/monitoreo\/profiles\/territorial\/TerritorialFieldOccurrencesWorkbench/,
    "monitoreo",
    "territorial-ocurrencias",
    null,
  ),
  rule(
    /features\/monitoreo\/profiles\/territorial\//,
    "monitoreo",
    "territorial-fuente",
    null,
  ),
  rule(
    /features\/monitoreo\/profiles\/acreditacion\//,
    "monitoreo",
    "acreditacion-fuentes",
    null,
  ),
  rule(
    /features\/monitoreo\/profiles\/aulas\//,
    "monitoreo",
    "aulas-fuentes",
    null,
  ),
  rule(
    /features\/monitoreo\/profiles\/telefonico\//,
    "monitoreo",
    "telefonico-fuentes",
    null,
  ),
  rule(
    /features\/monitoreo\/public\//,
    "monitoreo",
    "informe-publico",
    null,
  ),
  rule(/features\/monitoreo\//, "monitoreo", "compartido", null),
  rule(/features\/carga\//, "procesamiento", "carga", null),
  rule(/features\/validacion\//, "procesamiento", "validacion", null),
  rule(/features\/codificacion\//, "procesamiento", "codificacion", null),
  rule(/features\/analitica\//, "procesamiento", "analitica", null),
  rule(/features\/graficos\//, "procesamiento", "graficos", null),
  rule(/features\/procesamiento\//, "procesamiento", "entrada", null),
  rule(
    /features\/dashboard\/(?:customize|palettes|publish|source|curation)\//,
    "dashboard",
    "configuracion",
    null,
  ),
  rule(/features\/dashboard\//, "dashboard", "tablero", null),
];

const CATEGORY_DESCRIPTIONS = {
  Acción: "Ejecuta una acción o comando sobre el contexto actual.",
  Campo: "Captura, selecciona o ajusta un valor.",
  Navegación: "Cambia módulo, sección, pestaña, vista o foco.",
  Selección: "Expresa una opción, estado elegido o filtro activo.",
  Feedback: "Comunica estado, validación, progreso o resultado.",
  "Datos y visualización": "Presenta datos, métricas, tablas, mapas o gráficos.",
  "Capa flotante": "Muestra contenido superpuesto o una tarea enfocada.",
  Estructura: "Organiza regiones, paneles, listas y jerarquía visual.",
  Texto: "Presenta copy, metadatos, títulos o etiquetas.",
  Iconografía: "Aporta una señal visual o semántica mediante un icono.",
  Multimedia: "Presenta una imagen, video u otro medio.",
  Otro: "Elemento visual no clasificado por una receta más específica.",
};

const UI_DECLARATION_CONTAINER_PATTERN =
  /(?:^|[_\-\s])(tabs?|pesta(?:n|ñ)as?|sections?|secciones?|options?|opciones?|choices?|menu|actions?|acciones?|commands?|comandos?|steps?|pasos?|stages?|fases?|views?|vistas?|modes?|modos?|presets?|methods?|m[eé]todos?|types?|tipos?|statuses?|estados?|filters?|filtros?|categories?|categor[ií]as?|palettes?|paletas?|slides?|templates?|plantillas?|recipes?|recetas?|rails?|navigation|navegaci[oó]n|routes?|rutas?|providers?|proveedores?|formats?|formatos?|techniques?|t[eé]cnicas?|modules?|m[oó]dulos?|tones?|tonos?|profiles?|perfiles?|registr(?:y|ies)|registros?|catalogs?|cat[aá]logos?|reports?|reportes?|items?|elementos?|controls?|controles?|fields?|campos?|panels?|paneles?|cards?|tarjetas?|metrics?|m[eé]tricas?|nodes?|nodos?|groups?|grupos?|legends?|leyendas?|series?|columns?|columnas?|rows?|filas?|switchers?|toggles?|chips?|badges?|tiles?|bloques?|presentations?|presentaciones?|labels?|etiquetas?|copy|copies|notes?|notas?|sidebars?|toolbars?|headers?|cabeceras?|buttons?|botones?)(?:$|[_\-\s])/i;

const UI_DECLARATION_TECHNICAL_KEYS = new Set([
  "chunk",
  "family",
  "loadPage",
  "reportScopes",
  "warmupScopes",
]);

const UI_DECLARATION_PRIMARY_KEYS = [
  "label",
  "title",
  "text",
  "name",
  "caption",
  "tabLabel",
  "shortLabel",
];

const UI_DECLARATION_DETAIL_KEYS = [
  "description",
  "desc",
  "hint",
  "subtitle",
  "eyebrow",
  "placeholder",
  "help",
  "ariaLabel",
  "aria-label",
];

const UI_DECLARATION_PROPERTY_KEYS = new Set([
  ...UI_DECLARATION_PRIMARY_KEYS,
  ...UI_DECLARATION_DETAIL_KEYS,
  "id",
  "key",
  "value",
  "to",
  "href",
  "route",
  "icon",
  "kind",
  "type",
  "role",
  "variant",
  "size",
  "status",
  "state",
  "disabled",
  "enabled",
  "active",
  "selected",
  "checked",
  "visible",
  "hidden",
  "available",
  "required",
  "readOnly",
  "loading",
  "busy",
  "done",
  "badge",
  "count",
  "disabledReason",
  "lockedReason",
]);

function rule(pattern, module, section, tab) {
  return { pattern, module, section, tab };
}

function surface(module, section, tab, label, usage, sourceFile) {
  return {
    module,
    section,
    tab,
    category: "Datos y visualización",
    label,
    usage,
    source: { file: sourceFile },
  };
}

function markdownRuntimeSurface(tag, label, usage, line, category = "Texto") {
  return {
    module: "formularios",
    section: "constructor",
    tab: TAB_SCOPE_MULTIPLE,
    category,
    kind: tag === "a" ? "Enlace Markdown generado" : "Nodo Markdown generado",
    tag: `<${tag}>`,
    label,
    usage,
    provider:
      "renderMarkdown / renderMarkdownInline → HTML saneado → dangerouslySetInnerHTML",
    renderedWhen:
      "Cuando una etiqueta, ayuda o vista previa del formulario contiene el marcador Markdown correspondiente.",
    states: [
      "contenido-ausente",
      "contenido-renderizado",
      ...(tag === "a" ? ["url-segura", "url-reemplazada-por-#"] : []),
    ],
    interactive: tag === "a",
    source: {
      file: "frontend/src/features/xlsformEditor/helpers/markdown.ts",
      line,
      column: 1,
    },
  };
}

function normalizePath(value) {
  return value.split(path.sep).join("/");
}

function relativePath(value) {
  return normalizePath(path.relative(REPO_ROOT, value));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function walkFiles(root, predicate) {
  const files = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (
          entry.name === "node_modules" ||
          entry.name === "dist" ||
          entry.name === "__snapshots__"
        ) {
          continue;
        }
        stack.push(full);
      } else if (predicate(full)) {
        files.push(full);
      }
    }
  }
  return files.sort((a, b) => relativePath(a).localeCompare(relativePath(b)));
}

function isProductionJsxFile(file) {
  if (!/\.[jt]sx$/i.test(file)) return false;
  if (/\.(?:test|spec)\.[jt]sx$/i.test(file)) return false;
  if (/[\\/]__tests__[\\/]/.test(file)) return false;
  return true;
}

function isProductionSourceFile(file) {
  if (!/\.[jt]sx?$/i.test(file)) return false;
  if (/\.(?:test|spec)\.[jt]sx?$/i.test(file)) return false;
  if (/[\\/]__tests__[\\/]/.test(file)) return false;
  if (/[\\/]__mocks__[\\/]/.test(file)) return false;
  return true;
}

function isProductionDeclarationSourceFile(file) {
  return isProductionSourceFile(file);
}

function scriptKindFor(file) {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (file.endsWith(".js")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function cssContentDeclarations(source) {
  const declarations = [];
  const stack = [];
  let segmentStart = 0;
  let quote = null;
  let escaped = false;
  let inComment = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (inComment) {
      if (char === "*" && next === "/") {
        inComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "/" && next === "*") {
      inComment = true;
      index += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "{") {
      if (stack.length) stack[stack.length - 1].hasNested = true;
      stack.push({
        selector: source
          .slice(segmentStart, index)
          .replace(/\/\*[\s\S]*?\*\//g, " ")
          .trim(),
        bodyStart: index + 1,
        hasNested: false,
      });
      segmentStart = index + 1;
      continue;
    }
    if (char !== "}") continue;
    const block = stack.pop();
    if (
      block &&
      !block.hasNested &&
      block.selector &&
      !block.selector.startsWith("@")
    ) {
      const body = source.slice(block.bodyStart, index);
      const sanitizedBody = body.replace(
        /\/\*[\s\S]*?\*\//g,
        (comment) => comment.replace(/[^\n]/g, " "),
      );
      const contentPattern =
        /(?:^|;)\s*content\s*:\s*((?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|[^;])*)/gm;
      for (const match of sanitizedBody.matchAll(contentPattern)) {
        const contentOffset = match[0].indexOf("content");
        declarations.push({
          selector: block.selector,
          value: match[1].trim(),
          position:
            block.bodyStart + (match.index ?? 0) + Math.max(0, contentOffset),
        });
      }
    }
    segmentStart = index + 1;
  }
  return declarations;
}

function buildCssIndex() {
  const index = new Map();
  const generatedContent = [];
  const cssFiles = walkFiles(
    FRONTEND_ROOT,
    (file) => file.endsWith(".css") && !file.endsWith(".min.css"),
  );
  const fileAudit = [];
  const classPattern = /\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g;
  for (const file of cssFiles) {
    const source = fs.readFileSync(file, "utf8");
    const lineStarts = computeLineStarts(source);
    let classSelectors = 0;
    let stateSelectors = 0;
    for (const match of source.matchAll(classPattern)) {
      classSelectors += 1;
      const className = match[1];
      const sourceLine = lineAndColumn(lineStarts, match.index ?? 0).line;
      const selectorStart = source.lastIndexOf("}", match.index ?? 0) + 1;
      const selectorEnd = source.indexOf("{", match.index ?? 0);
      const selector =
        selectorEnd >= (match.index ?? 0)
          ? source.slice(selectorStart, selectorEnd)
          : "";
      const pseudoStates = [
        ...(selector.match(
          /:(?:hover|focus-visible|focus|active|disabled|checked|selected|open|visited)/g,
        ) ?? []),
        ...(selector.match(/\.(?:is|has)-[a-z0-9_-]+/gi) ?? []),
        ...(selector.match(
          /\[(?:aria|data)-(?:selected|expanded|pressed|checked|state|disabled)[^\]]*\]/gi,
        ) ?? []),
      ];
      const states = pseudoStates.filter(
        (state) => !isVisualVariantToken(state),
      );
      const variants = pseudoStates.filter(isVisualVariantToken);
      if (states.length > 0) stateSelectors += 1;
      const record = {
        file: relativePath(file),
        line: sourceLine,
        states: [...new Set(states)],
        variants: [...new Set(variants)],
      };
      const current = index.get(className) ?? [];
      if (
        !current.some(
          (candidate) =>
            candidate.file === record.file && candidate.line === record.line,
        )
      ) {
        current.push(record);
      }
      index.set(className, current);
    }
    for (const declaration of cssContentDeclarations(source)) {
      const value = declaration.value;
      const literalMatch = value.match(/^(["'])([\s\S]*)\1$/);
      const literal = literalMatch ? literalMatch[2] : value;
      if (
        !literal.trim() ||
        /^(?:none(?:\s*!important)?|normal|initial|inherit|unset|revert|revert-layer)$/i.test(
          value,
        )
      ) {
        continue;
      }
      const selector = declaration.selector;
      const pseudoStates = [
        ...(selector.match(
          /:(?:hover|focus-visible|focus|active|disabled|checked|selected|open|visited)/g,
        ) ?? []),
        ...(selector.match(/\.(?:is|has)-[a-z0-9_-]+/gi) ?? []),
        ...(selector.match(
          /\[(?:aria|data)-(?:selected|expanded|pressed|checked|state|disabled)[^\]]*\]/gi,
        ) ?? []),
      ];
      const states = pseudoStates.filter(
        (state) => !isVisualVariantToken(state),
      );
      const variants = pseudoStates.filter(isVisualVariantToken);
      const sourceRelativePath = relativePath(file);
      const sourcePosition = lineAndColumn(
        lineStarts,
        declaration.position,
      );
      const condition = `Coincide con el selector CSS: ${selector}`;
      const context = inferContext(
        sourceRelativePath,
        "CSSGeneratedContent",
        condition,
      );
      const symbolOnly = !/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]/.test(literal);
      generatedContent.push({
        id: sha256(
          `${sourceRelativePath}:${sourcePosition.line}:${sourcePosition.column}:css-content:${selector}:${value}`,
        ).slice(0, 16),
        sourceType: "contenido-generado-css",
        module: context.module,
        section: context.section,
        tab: context.tab,
        contextConfidence: context.confidence,
        componentContext: selector,
        category: symbolOnly ? "Iconografía" : "Texto",
        kind: "Contenido generado por CSS",
        tag: `css:${selector.match(/::?(?:before|after|marker)/i)?.[0] ?? "content"}`,
        label: literal,
        detail: value !== literal ? value : null,
        usage:
          "Presenta texto, símbolo o contenido derivado mediante la propiedad CSS content.",
        renderedWhen: condition,
        interactive: false,
        nativeElement: false,
        attributes: {
          content: value,
          selector,
        },
        spreads: [],
        classNames: [
          ...new Set(
            [...selector.matchAll(classPattern)].map((match) => match[1]),
          ),
        ],
        states: states.map((state) => `css:${state}`),
        visualVariants: variants.map((variant) => `css:${variant}`),
        stateModel: states.length
          ? "Estados de interacción o disponibilidad codificados en el selector del pseudo-elemento."
          : "Se muestra cuando coincide el selector; no declara un estado de interacción adicional.",
        handlers: [],
        importSource: null,
        definitionFile: sourceRelativePath,
        styleSources: [`${sourceRelativePath}:${sourcePosition.line}`],
        styleStates: states,
        styleVariants: variants,
        declarationEvidence: "propiedad-css-content",
        ancestry: [],
        renderSource: {
          file: sourceRelativePath,
          line: sourcePosition.line,
          column: sourcePosition.column,
          resolution: "pseudo-elemento-css",
        },
        source: {
          file: sourceRelativePath,
          line: sourcePosition.line,
          column: sourcePosition.column,
        },
      });
    }
    fileAudit.push({
      file: relativePath(file),
      sha256: sha256(source),
      classSelectors,
      stateSelectors,
      generatedContent: generatedContent.filter(
        (entry) => entry.source.file === relativePath(file),
      ).length,
    });
  }
  return { index, files: fileAudit, generatedContent };
}

function computeLineStarts(source) {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source.charCodeAt(index) === 10) starts.push(index + 1);
  }
  return starts;
}

function lineAndColumn(lineStarts, position) {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (lineStarts[middle] <= position) low = middle + 1;
    else high = middle - 1;
  }
  const lineIndex = Math.max(0, high);
  return {
    line: lineIndex + 1,
    column: position - lineStarts[lineIndex] + 1,
  };
}

function buildImportIndex(sourceFile, sourcePath) {
  const imports = new Map();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const moduleSpecifier = statement.moduleSpecifier.text;
    const clause = statement.importClause;
    if (!clause) continue;
    if (clause.name) {
      imports.set(clause.name.text, {
        importSource: moduleSpecifier,
        importedName: "default",
        definitionFile: resolveImportFile(sourcePath, moduleSpecifier),
      });
    }
    const bindings = clause.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        imports.set(element.name.text, {
          importSource: moduleSpecifier,
          importedName: element.propertyName?.text ?? element.name.text,
          definitionFile: resolveImportFile(sourcePath, moduleSpecifier),
        });
      }
    } else if (bindings && ts.isNamespaceImport(bindings)) {
      imports.set(bindings.name.text, {
        importSource: moduleSpecifier,
        importedName: "*",
        definitionFile: resolveImportFile(sourcePath, moduleSpecifier),
      });
    }
  }
  return imports;
}

function resolveImportFile(sourcePath, moduleSpecifier) {
  if (!moduleSpecifier.startsWith(".")) return null;
  const base = path.resolve(path.dirname(sourcePath), moduleSpecifier);
  const candidates = [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    `${base}.jsx`,
    `${base}.js`,
    path.join(base, "index.tsx"),
    path.join(base, "index.ts"),
  ];
  const match = candidates.find(
    (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
  );
  return match ? relativePath(match) : null;
}

function extractAttributes(node, sourceFile) {
  const attributes = {};
  const spreads = [];
  for (const property of node.attributes.properties) {
    if (ts.isJsxSpreadAttribute(property)) {
      spreads.push(cleanText(property.expression.getText(sourceFile), 120));
      continue;
    }
    const name = property.name.getText(sourceFile);
    if (!property.initializer) {
      attributes[name] = "true";
      continue;
    }
    if (ts.isStringLiteral(property.initializer)) {
      attributes[name] = property.initializer.text;
      continue;
    }
    if (ts.isJsxExpression(property.initializer)) {
      attributes[name] = property.initializer.expression
        ? cleanText(property.initializer.expression.getText(sourceFile), 180)
        : "";
      continue;
    }
    attributes[name] = cleanText(property.initializer.getText(sourceFile), 180);
  }
  return { attributes, spreads };
}

function extractDirectText(openingNode, sourceFile) {
  const parent = openingNode.parent;
  if (!ts.isJsxElement(parent)) return "";
  const parts = [];
  const visit = (node, depth) => {
    if (parts.join(" ").length > 240 || depth > 3) return;
    if (ts.isJsxText(node)) {
      const text = cleanText(node.getText(sourceFile), 160);
      if (text) parts.push(text);
      return;
    }
    if (ts.isJsxExpression(node)) {
      const expression = node.expression;
      if (!expression) return;
      if (
        ts.isStringLiteral(expression) ||
        ts.isNoSubstitutionTemplateLiteral(expression)
      ) {
        parts.push(cleanText(expression.text, 160));
      } else if (
        ts.isTemplateExpression(expression) ||
        ts.isConditionalExpression(expression)
      ) {
        parts.push(`{${cleanText(expression.getText(sourceFile), 120)}}`);
      }
      return;
    }
    if (ts.isJsxElement(node)) {
      for (const child of node.children) visit(child, depth + 1);
      return;
    }
    if (ts.isJsxFragment(node)) {
      for (const child of node.children) visit(child, depth + 1);
    }
  };
  for (const child of parent.children) visit(child, 0);
  return cleanText(parts.join(" "), 220);
}

function cleanText(value, maxLength = 160) {
  if (value === undefined || value === null) return "";
  let normalized = String(value)
    .replace(/\s+/g, " ")
    .trim();
  const quote = normalized.charAt(0);
  if (
    normalized.length >= 2 &&
    ["\"", "'", "`"].includes(quote) &&
    normalized.charAt(normalized.length - 1) === quote
  ) {
    normalized = normalized.slice(1, -1);
  }
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1))}…`;
}

function extractClassNames(attributes) {
  const value = attributes.className ?? attributes.class ?? "";
  if (!value) return [];
  const literalTokens = String(value).match(/-?[_a-zA-Z]+[_a-zA-Z0-9-]*/g) ?? [];
  return [...new Set(literalTokens)].filter(
    (token) =>
      token !== "className" &&
      token !== "true" &&
      token !== "false" &&
      !/^(?:is|has|data|aria)$/.test(token),
  );
}

function findNearestComponentName(node, sourceFile) {
  let current = node;
  while (current) {
    if (ts.isFunctionDeclaration(current) && current.name) {
      return current.name.text;
    }
    if (
      ts.isArrowFunction(current) ||
      ts.isFunctionExpression(current)
    ) {
      const parent = current.parent;
      if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
        return parent.name.text;
      }
      if (
        ts.isPropertyAssignment(parent) &&
        (ts.isIdentifier(parent.name) || ts.isStringLiteral(parent.name))
      ) {
        return parent.name.text;
      }
    }
    if (ts.isMethodDeclaration(current) && current.name) {
      return cleanText(current.name.getText(sourceFile));
    }
    current = current.parent;
  }
  return "(raíz del archivo)";
}

function findRenderCondition(node, sourceFile) {
  let current = node.parent;
  let depth = 0;
  while (current && depth < 12) {
    if (
      ts.isBinaryExpression(current) &&
      current.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
    ) {
      return cleanText(current.left.getText(sourceFile), 180);
    }
    if (ts.isConditionalExpression(current)) {
      return cleanText(current.condition.getText(sourceFile), 180);
    }
    if (ts.isIfStatement(current)) {
      return cleanText(current.expression.getText(sourceFile), 180);
    }
    if (ts.isCaseClause(current)) {
      return `case ${cleanText(current.expression.getText(sourceFile), 160)}`;
    }
    current = current.parent;
    depth += 1;
  }
  return "Siempre que se renderiza su componente contenedor";
}

function inferContext(sourceRelativePath, nearestComponent, renderCondition) {
  for (const contextRule of SOURCE_CONTEXT_RULES) {
    if (contextRule.pattern.test(sourceRelativePath)) {
      return refineContext(
        {
          module: contextRule.module,
          section: contextRule.section,
          tab: contextRule.tab,
          confidence: contextRule.tab ? "exacta-por-ruta" : "sección-por-ruta",
        },
        sourceRelativePath,
        nearestComponent,
        renderCondition,
      );
    }
  }
  return {
    module: "global",
    section: "sin-asignar",
    tab: null,
    confidence: "fallback-global",
  };
}

function refineContext(
  context,
  sourceRelativePath,
  nearestComponent,
  renderCondition,
) {
  const haystack =
    `${sourceRelativePath} ${nearestComponent} ${renderCondition ?? ""}`.toLowerCase();
  const sourceBaseName = path
    .basename(sourceRelativePath)
    .replace(/\.[^.]+$/, "")
    .toLowerCase();
  const componentName = String(nearestComponent ?? "").toLowerCase();
  const matchesNamedContext = (needle) => {
    const normalized = String(needle).toLowerCase();
    return componentName === normalized || sourceBaseName === normalized;
  };
  const next = { ...context };

  if (context.module === "hojas-ruta") {
    const componentSections = {
      LimaCoverageMap: "territorio",
      DistrictSelectorGrid: "territorio",
      IncludedDistrictTable: "territorio",
      TerritoryMapExplorer: "territorio",
      PopulationMatrixPreview: "poblacion",
      SampleSizeWorkbench: "muestra",
      QuotaMatrixPreview: "muestra",
      SamplingMapExplorer: "manzanas",
      BlockCanvasMap: "manzanas",
      ZoneGeometryMap: "manzanas",
      BlockGeometryMap: "manzanas",
      DeliveryTablePager: "entrega",
    };
    const componentSection = componentSections[nearestComponent];
    if (componentSection) {
      next.section = componentSection;
      next.confidence = "exacta-por-componente";
    }
    for (const id of ["territorio", "poblacion", "muestra", "manzanas", "entrega"]) {
      if (haystack.includes(id)) {
        next.section = id;
        next.confidence = "heurística-componente";
      }
    }
    for (const label of ["cuotas", "titulares", "reemplazos"]) {
      if (haystack.includes(label)) next.tab = capitalize(label);
    }
  }

  if (context.module === "recopiladores") {
    const sectionMap = {
      plan: "plan-recoleccion",
      unidad: "plan-recoleccion",
      access: "accesos",
      acceso: "accesos",
      canal: "accesos",
      vinculacion: "accesos",
      material: "materiales",
      preview: "materiales",
      vista: "materiales",
      paquete: "materiales",
      pdf: "materiales",
      delivery: "entrega-campo",
      entrega: "entrega-campo",
      traspaso: "entrega-campo",
    };
    for (const [needle, section] of Object.entries(sectionMap)) {
      if (haystack.includes(needle)) next.section = section;
    }
    const tabMap = {
      unidad: "Unidades",
      canal: "Canales",
      vinculacion: "Vinculación",
      preview: "Vista previa",
      vista: "Vista previa",
      paquete: "Paquetes",
      traspaso: "Monitoreo",
      monitoreo: "Monitoreo",
    };
    for (const [needle, tab] of Object.entries(tabMap)) {
      if (haystack.includes(needle)) next.tab = tab;
    }
  }

  if (context.module === "calculo-muestra") {
    const fileTabMap = {
      DefEstudioTab: "Estudio",
      DefBasesTab: "Fuentes",
      MarcoConsistenciaTab: "Consistencia",
      DefVariablesTab: "Variables",
      CriteriosMarcoTab: "Criterios del estudiante",
      CursosHorarioMarcoTab: "Cursos-horario: criterios + radiografía",
      MarcoPoblacionTab: "Población",
      MarcoAulasTab: "Cursos-horario",
      TabCobertura: "Cobertura",
      CalculoDisenoTab: "Diseño",
      CalculoPropuestasTab: "Propuestas",
      CalculoCursosHorarioFacultadTab: "Cursos-horario por facultad",
      TabDistribucion: "Distribución",
      AulasMarcoTab: "Marco de cursos-horario",
      AulasObjetivoTab: "Objetivo de muestra",
      AulasMetodoTab: "Comparar métodos",
      AulasSimulacionTab: "Simulación",
      AulasSeleccionTab: "Cursos-horario titulares",
      AulasReemplazosTab: "Reemplazos por curso-horario",
      AulasAuditoriaTab: "Sustento técnico",
      SalidasCierreTab: "Cierre",
      SalidasEntregablesTab: "Entregables",
      SalidasResultadosTab: "Tablas",
      SalidasMonitoreoTab: "Pase a Monitoreo",
    };
    for (const [needle, tab] of Object.entries(fileTabMap)) {
      if (matchesNamedContext(needle)) {
        next.tab = tab;
        next.confidence = "exacta-por-componente";
      }
    }
  }

  if (context.module === "monitoreo" || context.module === "procesamiento") {
    const filename = path.basename(sourceRelativePath).replace(/\.[^.]+$/, "");
    const normalized = filename
      .replace(/(?:Tab|View|Page|Panel|Section|Pane|Shell)$/i, "")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .trim();
    if (!next.tab && normalized && !/^(index|types|utils?|store)$/i.test(normalized)) {
      next.tab = normalized;
      next.confidence = "heurística-archivo";
    }
  }

  if (context.module === "monitoreo") {
    const sectionNeedles = [
      ["source", /fuente|source|formulario|filtro|distrito|encuestador|reconciliaci[oó]n|historial/],
      ["umps", /ump|cobertura|manzana/],
      ["validacion", /validaci[oó]n|geo|duraci[oó]n|cuota|anulaci[oó]n/],
      ["consultas", /consulta|registro|gps|responsable|subsanaci[oó]n|cruce|estado de la base/],
      ["avance", /avance|salida|ritmo|actor|encuesta|detalle/],
      ["ocurrencias", /ocurrencia|reporte ump|alerta/],
      ["modelo", /modelo operativo|cronograma/],
      ["telefonico", /monitoreo telef[oó]nico/],
      ["llamadas", /llamada|consultado|tiempo|incidencia|supervisi[oó]n/],
      ["agenda", /agenda|curso.?horario/],
    ];
    const profile =
      sourceRelativePath.match(
        /features\/monitoreo\/profiles\/(territorial|acreditacion|aulas|telefonico)\//,
      )?.[1] ?? context.section.split("-")[0];
    let matchedSection = false;
    for (const [suffix, pattern] of sectionNeedles) {
      if (pattern.test(haystack)) {
        const candidate = `${profile}-${suffix}`;
        const valid = HIERARCHY.find((item) => item.module === "monitoreo")
          ?.sections.some((section) => section.id === candidate);
        if (valid) {
          next.section = candidate;
          matchedSection = true;
        }
      }
    }
    if (
      !matchedSection &&
      /(?:Territorial|Acreditacion|Telefonico|Aulas)MonitoreoPage$/i.test(
        path.basename(sourceRelativePath).replace(/\.[^.]+$/, ""),
      )
    ) {
      next.section = "compartido";
      next.confidence = "scope-transversal-perfil";
    }
  }

  if (context.module === "formularios") {
    const formTabMap = {
      BasicTab: "Básico",
      AppearanceTab: "Apariencia",
      MoreTab: "Más",
      LogicTab: "Lógica",
      FormSimulator: "Probar formulario",
      FormSummaryView: "Resumen formulario",
      LogicCanvas: "Mapa de lógica",
      ChoiceFiltersView: "Filtros de opciones",
      SheetsView: "Preguntas / Opciones / Configuración / Papel-PDF",
      CatalogLibrary: "Formularios",
      CatalogWorkspace: "Formularios",
    };
    for (const [needle, tab] of Object.entries(formTabMap)) {
      if (matchesNamedContext(needle)) next.tab = tab;
    }
  }

  if (context.module === "procesamiento") {
    const processingTabs = {
      CargaPage: "Preparar / Ver base",
      ProcessingSheetViewer: "Ver base",
      ExplorarTab: "Explorar respuestas",
      InstrumentoTab: "Reglas del formulario",
      ReglasCustomTab: "Criterios de revisión",
      LimpiezaTab: "Cierre de base",
      PanoramaTab: "Panorama (declarada inactiva)",
      PreguntasLanding: "Preparar",
      CodificarWizard: "Codificar",
      RespuestasCodificador: "Codificar",
      CodingConfigActions: "Matrices",
      AdaptarPane: "Adaptar",
      PreguntaDetalle: "Detalle de pregunta",
      DataReviewPane: "Datos",
      BasesPane: "Bases e instrumentos",
      CodebookPane: "Libro de códigos",
      CrucesPane: "Cruces",
      PonderacionPane: "Ponderación",
      FrecuenciasPane: "Frecuencias",
      MultibaseTablasPane: "Tablas multibase",
      PanelBasePane: "Base panel",
      FichaTecnicaPane: "Ficha técnica",
      OrdenCategoriasPane: "Orden de categorías",
      OrdenCategoriasEditor: "Orden de categorías",
      DimensionesPane: "Dimensiones",
      DimensionesWizard: "Dimensiones",
      EnumeradoresPane: "Enumeradores (declarada inactiva)",
      TimelinePanel: "Timeline",
      TimelinePanelV2: "Timeline",
      PlanCanvas: "Canvas",
      InspectorV2: "Inspector",
      EstiloGlobalDialog: "Estilo global",
    };
    for (const [needle, tab] of Object.entries(processingTabs)) {
      if (matchesNamedContext(needle)) next.tab = tab;
    }
  }

  if (context.module === "dashboard") {
    const dashboardTabDirectory =
      sourceRelativePath.match(
        /features\/dashboard\/tabs\/(ResumenTab|RelacionTab|BaseDatosTab|DimensionesTab)(?:\/|\.tsx?$)/,
      )?.[1] ?? null;
    const dashboardTabs = {
      ResumenTab: "Resumen",
      RelacionTab: "Relaciones",
      BaseDatosTab: "Base de datos",
      DimensionesTab: "Dimensiones",
      DashboardSourceGate: "Datos",
      DashboardCurationGate: "Datos",
      DashboardPalettesDialog: "Paletas",
      DashboardCustomizeDialog: "Personalizar",
      DashboardPublishDialog: "Publicación",
    };
    if (dashboardTabDirectory) {
      next.tab = dashboardTabs[dashboardTabDirectory];
      next.confidence = "exacta-por-directorio-de-pestaña";
    }
    for (const [needle, tab] of Object.entries(dashboardTabs)) {
      if (matchesNamedContext(needle)) next.tab = tab;
    }
  }

  return next;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function isIconComponent(tagName, importInfo) {
  if (
    /^(?:Icon|ActiveIcon|SelectedIcon|Icon[A-Z]|Lucide|svg$|path$|g$|rect$|circle$|line$|polyline$|polygon$)/.test(
      tagName,
    )
  ) {
    return true;
  }
  const source = importInfo?.importSource ?? "";
  return /lucide|\/icons(?:\.|$)/i.test(source);
}

function attributeLiteralOptions(value, allowedValues) {
  const source = String(value ?? "").trim();
  const options = new Set();
  if (/^[A-Za-z][A-Za-z0-9_-]*$/.test(source)) {
    options.add(source.toLowerCase());
  }
  for (const match of source.matchAll(/(["'])(.*?)\1/g)) {
    options.add(match[2].toLowerCase());
  }
  return new Set(
    [...options].filter((option) => allowedValues.has(option)),
  );
}

const INPUT_TYPE_OPTIONS = new Set([
  "button",
  "checkbox",
  "color",
  "date",
  "datetime-local",
  "email",
  "file",
  "hidden",
  "image",
  "month",
  "number",
  "password",
  "radio",
  "range",
  "reset",
  "search",
  "submit",
  "tel",
  "text",
  "time",
  "url",
  "week",
]);

const ROLE_OPTIONS = new Set([
  "alert",
  "button",
  "checkbox",
  "dialog",
  "menuitem",
  "progressbar",
  "radio",
  "status",
  "switch",
  "tab",
  "textbox",
]);

function classifyElement(tagName, attributes, importInfo) {
  const lowerTag = tagName.toLowerCase();
  const roleOptions = attributeLiteralOptions(attributes.role, ROLE_OPTIONS);
  const inputTypeOptions = attributeLiteralOptions(
    attributes.type ?? "text",
    INPUT_TYPE_OPTIONS,
  );
  const joined =
    `${tagName} ${attributes.className ?? ""} ${attributes.role ?? ""}`.toLowerCase();
  const componentName = tagName.split(".").at(-1) ?? tagName;
  const customComponent = /^[A-Z]/.test(componentName);

  if (
    roleOptions.has("switch") ||
    (customComponent && /switch|toggle/i.test(componentName))
  ) {
    return { category: "Selección", kind: "Switcher" };
  }
  if (
    roleOptions.has("checkbox") ||
    (customComponent && /checkbox/i.test(componentName))
  ) {
    return { category: "Selección", kind: "Checkbox" };
  }
  if (
    roleOptions.has("radio") ||
    (customComponent && /radiogroup|radio/i.test(componentName))
  ) {
    return { category: "Selección", kind: "Radio" };
  }
  if (
    roleOptions.has("tab") ||
    (customComponent && /tab(?:strip|list|chip|button)?$/i.test(componentName)) ||
    (["button", "a"].includes(lowerTag) &&
      /(?:^|[\s_-])tabs?(?:$|[\s_-])/.test(joined))
  ) {
    return { category: "Navegación", kind: "Pestaña" };
  }
  if (
    lowerTag === "button" ||
    roleOptions.has("button") ||
    (customComponent && /(?:button|action|trigger|control)$/i.test(componentName))
  ) {
    return { category: "Acción", kind: "Botón" };
  }
  if (isIconComponent(tagName, importInfo)) {
    return { category: "Iconografía", kind: "Icono" };
  }
  if (roleOptions.has("textbox")) {
    return { category: "Campo", kind: "Editor de texto enriquecido" };
  }
  if (lowerTag === "input") {
    if (inputTypeOptions.has("checkbox") && inputTypeOptions.has("radio")) {
      return {
        category: "Selección",
        kind: "Radio / Checkbox dinámico",
      };
    }
    if (inputTypeOptions.has("checkbox")) {
      return { category: "Selección", kind: "Checkbox" };
    }
    if (inputTypeOptions.has("radio")) {
      return { category: "Selección", kind: "Radio" };
    }
    if (inputTypeOptions.has("range")) {
      return { category: "Campo", kind: "Slider" };
    }
    if (inputTypeOptions.has("file")) {
      return { category: "Campo", kind: "Selector de archivo" };
    }
    if (inputTypeOptions.has("search")) {
      return { category: "Campo", kind: "Campo de búsqueda" };
    }
    if (
      inputTypeOptions.size > 1 &&
      [...inputTypeOptions].some((type) =>
        ["date", "datetime-local", "month", "number", "time", "week"].includes(
          type,
        ),
      )
    ) {
      return { category: "Campo", kind: "Campo de tipo dinámico" };
    }
    if (inputTypeOptions.has("number")) {
      return { category: "Campo", kind: "Campo numérico" };
    }
    if (
      inputTypeOptions.has("date") ||
      inputTypeOptions.has("datetime-local") ||
      inputTypeOptions.has("month") ||
      inputTypeOptions.has("time") ||
      inputTypeOptions.has("week")
    ) {
      return { category: "Campo", kind: "Campo de fecha/tiempo" };
    }
    if (
      attributes.type !== undefined &&
      inputTypeOptions.size === 0
    ) {
      return { category: "Campo", kind: "Campo de tipo dinámico" };
    }
    return { category: "Campo", kind: "Campo de texto" };
  }
  if (lowerTag === "select" || /select|picker|combobox/.test(joined)) {
    return { category: "Campo", kind: "Selector" };
  }
  if (lowerTag === "textarea") return { category: "Campo", kind: "Área de texto" };
  if (lowerTag === "option") return { category: "Campo", kind: "Opción de selector" };
  if (
    lowerTag === "nav" ||
    lowerTag === "a" ||
    /tab|rail|stepper|breadcrumb|nav|menu|pagination/.test(joined)
  ) {
    return {
      category: "Navegación",
      kind:
        lowerTag === "a"
          ? "Enlace"
          : /stepper/.test(joined)
            ? "Stepper"
            : /tab/.test(joined)
              ? "Pestaña"
              : /menu/.test(joined)
                ? "Menú"
                : "Navegación",
    };
  }
  if (
    lowerTag === "dialog" ||
    roleOptions.has("dialog") ||
    /dialog|modal|drawer|sheet|popover|tooltip|flyout/.test(joined)
  ) {
    return {
      category: "Capa flotante",
      kind: /tooltip/.test(joined)
        ? "Tooltip"
        : /popover|flyout/.test(joined)
          ? "Popover"
          : /drawer/.test(joined)
            ? "Drawer"
            : "Diálogo",
    };
  }
  if (
    /alert|notice|toast|banner|status|badge|chip|progress|loading|empty|error|warning|success/.test(
      joined,
    ) ||
    ["alert", "status", "progressbar"].some((role) => roleOptions.has(role))
  ) {
    return {
      category: "Feedback",
      kind: /progress|loading|spinner/.test(joined)
        ? "Progreso/carga"
        : /badge|chip|status/.test(joined)
          ? "Badge/estado"
          : /empty/.test(joined)
            ? "Estado vacío"
            : "Alerta/aviso",
    };
  }
  if (
    ["table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption"].includes(
      lowerTag,
    ) ||
    /table|datatable|metric|kpi|stat|chart|plot|graph|map|canvas|gauge|heatmap/.test(
      joined,
    )
  ) {
    return {
      category: "Datos y visualización",
      kind: /map/.test(joined)
        ? "Mapa"
        : /chart|plot|graph|gauge|heatmap|canvas/.test(joined)
          ? "Gráfico/canvas"
          : /metric|kpi|stat/.test(joined)
            ? "Métrica/KPI"
            : "Tabla/dato",
    };
  }
  if (["img", "picture", "video", "audio"].includes(lowerTag)) {
    return { category: "Multimedia", kind: capitalize(lowerTag) };
  }
  if (
    [
      "main",
      "section",
      "article",
      "aside",
      "header",
      "footer",
      "form",
      "fieldset",
      "details",
      "summary",
      "ul",
      "ol",
      "li",
      "dl",
      "dt",
      "dd",
      "div",
    ].includes(lowerTag) ||
    /panel|pane|card|tile|workbench|inspector|sidebar|toolbar|header|footer|layout|grid|list|row|column|container|surface|frame/.test(
      joined,
    )
  ) {
    return {
      category: "Estructura",
      kind:
        lowerTag === "details" || lowerTag === "summary"
          ? "Disclosure"
          : /inspector/.test(joined)
            ? "Inspector"
            : /sidebar/.test(joined)
              ? "Sidebar"
              : /toolbar/.test(joined)
                ? "Toolbar"
                : /card|tile/.test(joined)
                  ? "Tarjeta"
                  : /panel|pane/.test(joined)
                    ? "Panel"
                    : "Contenedor",
    };
  }
  if (
    ["span", "strong", "small", "p", "em", "b", "i", "code", "pre", "label"].includes(
      lowerTag,
    ) ||
    /^h[1-6]$/.test(lowerTag)
  ) {
    return {
      category: "Texto",
      kind: /^h[1-6]$/.test(lowerTag)
        ? "Título"
        : lowerTag === "label"
          ? "Etiqueta"
          : "Texto",
    };
  }
  return { category: "Otro", kind: "Componente visual" };
}

function semanticVisualVariants(tagName, attributes) {
  const variants = [];
  if (tagName.toLowerCase() === "input") {
    const inputTypes = attributeLiteralOptions(
      attributes.type ?? "text",
      INPUT_TYPE_OPTIONS,
    );
    for (const type of inputTypes) variants.push(`type=${type}`);
    if (attributes.type !== undefined && inputTypes.size === 0) {
      variants.push(`type-dinámico=${cleanText(attributes.type, 80)}`);
    }
  }
  for (const role of attributeLiteralOptions(
    attributes.role,
    ROLE_OPTIONS,
  )) {
    variants.push(`role=${role}`);
  }
  return variants;
}

function isVisualVariantToken(value) {
  return /(?:^|[.:\-_])(?:is-)?(?:compact|dense|small|medium|large|sm|md|lg|xl|text-sm|wide|narrow)(?:$|[.:\-_])/i.test(
    String(value),
  );
}

function extractStates(attributes, classNames, cssStates = []) {
  const states = [];
  const stateProps = [
    "disabled",
    "checked",
    "selected",
    "active",
    "open",
    "loading",
    "busy",
    "invalid",
    "required",
    "readOnly",
    "aria-selected",
    "aria-expanded",
    "aria-pressed",
    "aria-checked",
    "data-state",
  ];
  for (const key of stateProps) {
    if (attributes[key] !== undefined) {
      states.push(`${key}=${cleanText(attributes[key], 80)}`);
    }
  }
  for (const className of classNames) {
    if (
      /^(?:is|has)-/.test(className) &&
      !isVisualVariantToken(className)
    ) {
      states.push(`clase:${className}`);
    }
  }
  for (const cssState of cssStates) states.push(`css:${cssState}`);
  return [...new Set(states)];
}

function extractHandlers(attributes) {
  return Object.entries(attributes)
    .filter(([key]) => /^on[A-Z]/.test(key))
    .map(([key, value]) => `${key}: ${cleanText(value, 120)}`);
}

function inferLabel(tagName, attributes, directText) {
  const priority = [
    "aria-label",
    "label",
    "title",
    "placeholder",
    "alt",
    "name",
    "data-tip",
    "data-tooltip",
    "value",
  ];
  for (const key of priority) {
    const value = cleanText(attributes[key], 220);
    if (value && value !== "true" && value !== "false") return value;
  }
  if (directText) return directText;
  return tagName;
}

function usageFor(category, kind, handlers, condition) {
  const base = CATEGORY_DESCRIPTIONS[category] ?? CATEGORY_DESCRIPTIONS.Otro;
  const action = handlers.length > 0 ? ` Eventos: ${handlers.join(" · ")}.` : "";
  const render =
    condition && condition !== "Siempre que se renderiza su componente contenedor"
      ? ` Aparece cuando: ${condition}.`
      : "";
  return `${base}${action}${render}`;
}

function unwrapExpression(node) {
  let current = node;
  while (
    current &&
    (ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current) ||
      ts.isNonNullExpression(current) ||
      (typeof ts.isSatisfiesExpression === "function" &&
        ts.isSatisfiesExpression(current)))
  ) {
    current = current.expression;
  }
  return current;
}

function propertyNameText(name, sourceFile) {
  if (!name) return "";
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
  ) {
    return name.text;
  }
  return cleanText(name.getText(sourceFile), 80);
}

function literalVariants(node, sourceFile) {
  const current = unwrapExpression(node);
  if (!current) return [];
  if (
    ts.isStringLiteral(current) ||
    ts.isNoSubstitutionTemplateLiteral(current) ||
    ts.isNumericLiteral(current)
  ) {
    return [cleanText(current.text, 240)].filter(Boolean);
  }
  if (current.kind === ts.SyntaxKind.TrueKeyword) return ["true"];
  if (current.kind === ts.SyntaxKind.FalseKeyword) return ["false"];
  if (ts.isConditionalExpression(current)) {
    return [
      ...literalVariants(current.whenTrue, sourceFile),
      ...literalVariants(current.whenFalse, sourceFile),
    ];
  }
  if (
    ts.isBinaryExpression(current) &&
    current.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = literalVariants(current.left, sourceFile);
    const right = literalVariants(current.right, sourceFile);
    if (left.length && right.length) {
      return left.flatMap((a) => right.map((b) => `${a}${b}`));
    }
  }
  if (ts.isTemplateExpression(current)) {
    return [cleanText(current.getText(sourceFile), 240)];
  }
  if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
    if (!ts.isBlock(current.body)) {
      return literalVariants(current.body, sourceFile);
    }
    const variants = [];
    const collectReturns = (candidate) => {
      if (
        candidate !== current.body &&
        (ts.isArrowFunction(candidate) ||
          ts.isFunctionExpression(candidate) ||
          ts.isFunctionDeclaration(candidate))
      ) {
        return;
      }
      if (ts.isReturnStatement(candidate) && candidate.expression) {
        variants.push(...literalVariants(candidate.expression, sourceFile));
        return;
      }
      ts.forEachChild(candidate, collectReturns);
    };
    collectReturns(current.body);
    return [...new Set(variants)];
  }
  return [];
}

function simpleDeclaredValue(node, sourceFile) {
  const variants = literalVariants(node, sourceFile);
  if (variants.length) return [...new Set(variants)].join(" / ");
  return cleanText(unwrapExpression(node)?.getText(sourceFile) ?? "", 180);
}

function normalizeDeclarationContainer(value) {
  return String(value)
    .replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g, "$1-$2")
    .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+/g, "-")
    .toLowerCase();
}

function isUiDeclarationContainer(value) {
  const normalized = `-${normalizeDeclarationContainer(value)}-`;
  return UI_DECLARATION_CONTAINER_PATTERN.test(normalized);
}

function collectIdentifiers(node, target) {
  if (ts.isIdentifier(node)) target.add(node.text);
  ts.forEachChild(node, (child) => collectIdentifiers(child, target));
}

function collectJsxReferencedIdentifiers(sourceFile) {
  const identifiers = new Set();
  const visit = (node) => {
    if (ts.isJsxExpression(node) && node.expression) {
      const expression = unwrapExpression(node.expression);
      const attribute = ts.isJsxAttribute(node.parent) ? node.parent : null;
      const attributeName = attribute
        ? propertyNameText(attribute.name, sourceFile)
        : "";
      if (
        attribute &&
        (isUiDeclarationContainer(attributeName) ||
          /^(?:items|values|data|options|tabs|sections|steps|choices|methods|modes|presets)$/i.test(
            attributeName,
          ))
      ) {
        collectIdentifiers(expression, identifiers);
      }
      const inspectCalls = (candidate) => {
        if (
          ts.isCallExpression(candidate) &&
          ts.isPropertyAccessExpression(candidate.expression) &&
          /^(?:map|flatMap)$/.test(candidate.expression.name.text)
        ) {
          collectIdentifiers(candidate.expression.expression, identifiers);
        }
        ts.forEachChild(candidate, inspectCalls);
      };
      inspectCalls(expression);
      if (
        !attribute &&
        ts.isIdentifier(expression) &&
        isUiDeclarationContainer(expression.text)
      ) {
        identifiers.add(expression.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return identifiers;
}

function isInlineRenderedArray(arrayNode) {
  let current = arrayNode;
  while (
    current.parent &&
    (ts.isParenthesizedExpression(current.parent) ||
      ts.isAsExpression(current.parent) ||
      (typeof ts.isSatisfiesExpression === "function" &&
        ts.isSatisfiesExpression(current.parent)))
  ) {
    current = current.parent;
  }
  const parent = current.parent;
  if (ts.isJsxExpression(parent)) return true;
  if (
    ts.isPropertyAccessExpression(parent) &&
    parent.expression === current &&
    /^(?:map|flatMap)$/.test(parent.name.text) &&
    ts.isCallExpression(parent.parent)
  ) {
    return true;
  }
  return false;
}

function isLiteralDeclarationContainer(containerName) {
  return /tab|pesta|option|opcion|choice|menu|action|accion|command|comando|step|paso|stage|fase|view|vista|mode|modo|preset|method|metodo|status|estado|filter|filtro|category|categoria|palette|paleta|slide|template|plantilla|report|reporte|format|formato|technique|tecnica|provider|proveedor|label|etiqueta|panel|section|seccion|button|boton|switch|toggle/i.test(
    normalizeDeclarationContainer(containerName),
  );
}

function declarationClassification(containerName) {
  const normalized = normalizeDeclarationContainer(containerName);
  if (/tab|pesta/.test(normalized)) {
    return { category: "Navegación", kind: "Pestaña declarada" };
  }
  if (
    /section|seccion|view|vista|nav|rail|route|ruta|module|modulo|panel/.test(
      normalized,
    )
  ) {
    return { category: "Navegación", kind: "Navegación declarada" };
  }
  if (/menu|action|accion|command|comando|cta|tool|control/.test(normalized)) {
    return { category: "Acción", kind: "Acción declarada" };
  }
  if (/switch|toggle/.test(normalized)) {
    return { category: "Selección", kind: "Switcher declarado" };
  }
  if (/check/.test(normalized)) {
    return { category: "Selección", kind: "Checkbox declarado" };
  }
  if (/step|paso|stage|fase/.test(normalized)) {
    return { category: "Navegación", kind: "Paso declarado" };
  }
  if (/slide|chart|graph|visual|template|plantilla|report|reporte/.test(normalized)) {
    return {
      category: "Datos y visualización",
      kind: "Visualización declarada",
    };
  }
  if (/card|tarjeta|metric|metrica|legend|leyenda|series|column|columna|row|fila|tile|node|nodo/.test(normalized)) {
    return {
      category: "Datos y visualización",
      kind: "Contenido visual declarado",
    };
  }
  if (
    /option|opcion|choice|mode|modo|preset|method|metodo|type|tipo|status|estado|filter|filtro|category|categoria|palette|paleta|format|formato|technique|tecnica|provider|proveedor/.test(
      normalized,
    )
  ) {
    return { category: "Selección", kind: "Opción declarada" };
  }
  return { category: "Texto", kind: "Contenido declarado" };
}

function monitoringDeclaredSection(profile, tabId) {
  const prefixMap = {
    acreditacion: "acreditacion",
    telefónico: "telefonico",
    telefonico: "telefonico",
    territorial: "territorial",
    "cursos-horario": "aulas",
    aulas: "aulas",
  };
  const prefix = prefixMap[profile] ?? "acreditacion";
  const suffixMap = {
    fuentes: prefix === "territorial" ? "fuente" : "fuentes",
    modelo: prefix === "territorial" ? "umps" : prefix === "aulas" ? "agenda" : "modelo",
    calidad: "validacion",
    consultas: "consultas",
    avance: "avance",
    ocurrencias: "ocurrencias",
    telefonico: prefix === "telefonico" ? "llamadas" : "telefonico",
  };
  return `${prefix}-${suffixMap[tabId] ?? tabId}`;
}

function normalizedVocabulary(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function refineDeclaredContext(
  context,
  attributes,
  label,
  containerName,
  ancestryLabels,
) {
  const next = { ...context };
  const route = attributes.to ?? attributes.href ?? attributes.route ?? "";
  let url = null;
  if (route.startsWith("/")) {
    try {
      url = new URL(route, "https://catalogo.prosecnur.local");
    } catch {
      url = null;
    }
  }
  if (url) {
    const pathname = url.pathname;
    const routeMap = [
      [/^\/bitacora/, "bitacora", "bitacora"],
      [/^\/calc-muestra|^\/muestra/, "calculo-muestra", "mesas"],
      [/^\/editor-xlsform/, "formularios", "biblioteca"],
      [/^\/hojas-ruta/, "hojas-ruta", url.searchParams.get("stage") || "territorio"],
      [/^\/recopiladores/, "recopiladores", "plan-recoleccion"],
      [/^\/monitoreo/, "monitoreo", "acreditacion-fuentes"],
      [/^\/carga/, "procesamiento", "carga"],
      [/^\/validacion/, "procesamiento", "validacion"],
      [/^\/codificacion/, "procesamiento", "codificacion"],
      [/^\/analitica/, "procesamiento", "analitica"],
      [/^\/graficos/, "procesamiento", "graficos"],
      [/^\/tablero/, "dashboard", "tablero"],
    ];
    for (const [pattern, module, section] of routeMap) {
      if (pattern.test(pathname)) {
        next.module = module;
        next.section = section;
        next.confidence = "exacta-por-ruta-declarada";
        break;
      }
    }
    if (next.module === "hojas-ruta") {
      next.tab = url.searchParams.get("pestana")
        ? capitalize(url.searchParams.get("pestana"))
        : null;
    }
    if (next.module === "calculo-muestra") {
      const universidadSectionMap = {
        definicion: "universidad-datos",
        marco: "universidad-marco",
        calculo: "universidad-calculo",
        aulas: "universidad-seleccion",
        salidas: "universidad-entrega",
      };
      const seccion = url.searchParams.get("seccion");
      if (
        url.searchParams.get("modo") === "opinion-universitaria" &&
        universidadSectionMap[seccion]
      ) {
        next.section = universidadSectionMap[seccion];
      }
    }
    if (next.module === "recopiladores") {
      const section = url.searchParams.get("seccion") || "plan-recoleccion";
      const validSections = new Set([
        "plan-recoleccion",
        "accesos",
        "materiales",
        "entrega-campo",
      ]);
      if (validSections.has(section)) next.section = section;
      const tabMap = {
        unidades: "Unidades",
        canales: "Canales",
        vinculacion: "Vinculación",
        vista: "Vista previa",
        paquetes: "Paquetes",
        traspaso: "Monitoreo",
      };
      next.tab = tabMap[url.searchParams.get("pestana")] ?? next.tab;
    }
    if (next.module === "monitoreo") {
      const profileLabel = ancestryLabels
        .map((value) => value.toLowerCase())
        .find((value) =>
          ["acreditación", "acreditacion", "telefónico", "telefonico", "territorial", "cursos-horario", "aulas"].includes(
            value,
          ),
        );
      const sectionId = url.searchParams.get("seccion");
      const modeId = url.searchParams.get("modo");
      if (sectionId) {
        next.section = monitoringDeclaredSection(
          modeId ?? profileLabel ?? "acreditacion",
          sectionId,
        );
      }
    }
  }
  const normalizedContainer = normalizeDeclarationContainer(containerName);
  const normalizedLabel = normalizedVocabulary(label);
  const normalizedAncestry = ancestryLabels.map(normalizedVocabulary);

  if (
    /calc-muestra-universidad-pestanas-(definicion|marco|calculo|aulas|salidas)/.test(
      normalizedContainer,
    )
  ) {
    const sectionByCatalogKey = {
      definicion: "universidad-datos",
      marco: "universidad-marco",
      calculo: "universidad-calculo",
      aulas: "universidad-seleccion",
      salidas: "universidad-entrega",
    };
    const catalogKey = normalizedContainer.match(
      /calc-muestra-universidad-pestanas-(definicion|marco|calculo|aulas|salidas)/,
    )?.[1];
    next.module = "calculo-muestra";
    next.section = sectionByCatalogKey[catalogKey];
    next.tab = label;
    next.confidence = "exacta-por-catálogo-canónico";
  } else if (
    next.module === "calculo-muestra" &&
    /classroom-lab-tabs/.test(normalizedContainer)
  ) {
    next.section = "universidad-seleccion";
    next.tab = label;
    next.confidence = "exacta-por-registro";
  }

  const procesamientoCatalogKey = normalizedContainer.match(
    /procesamiento-pestanas-(carga|validacion|codificacion|analitica)/,
  )?.[1];
  if (procesamientoCatalogKey) {
    next.module = "procesamiento";
    next.section = procesamientoCatalogKey;
    next.tab = label;
    next.confidence = "exacta-por-catálogo-canónico";
  }

  if (/(?:^|-)dashboard-pestanas(?:-|$)/.test(normalizedContainer)) {
    next.module = "dashboard";
    next.section = "tablero";
    next.tab = label;
    next.confidence = "exacta-por-catálogo-canónico";
  }

  if (next.module === "hojas-ruta") {
    const stageMap = {
      territorio: "territorio",
      poblacion: "poblacion",
      muestra: "muestra",
      manzanas: "manzanas",
      entrega: "entrega",
    };
    const stageKey = Object.keys(stageMap).find(
      (key) =>
        normalizedLabel === key ||
        normalizedContainer.endsWith(`-${key}`) ||
        normalizedAncestry.includes(key),
    );
    if (
      stageKey &&
      /stage-presentation|stage-order|sections?/.test(normalizedContainer)
    ) {
      next.section = stageMap[stageKey];
      next.tab = TAB_SCOPE_TRANSVERSAL;
      next.confidence = "exacta-por-registro";
    }
    if (/delivery-tab|delivery-tab-label/.test(normalizedContainer)) {
      next.section = "entrega";
      next.tab = label;
      next.confidence = "exacta-por-registro";
    }
  }

  if (next.module === "recopiladores") {
    const tabByToken = {
      unidades: ["plan-recoleccion", "Unidades"],
      canales: ["accesos", "Canales"],
      vinculacion: ["accesos", "Vinculación"],
      vista: ["materiales", "Vista previa"],
      paquetes: ["materiales", "Paquetes"],
      traspaso: ["entrega-campo", "Monitoreo"],
    };
    const tabToken = Object.keys(tabByToken).find(
      (key) => normalizedLabel === key,
    );
    if (tabToken && /pestanas-por-seccion/.test(normalizedContainer)) {
      [next.section, next.tab] = tabByToken[tabToken];
      next.confidence = "exacta-por-registro";
    } else if (
      ["plan-recoleccion", "accesos", "materiales", "entrega-campo"].includes(
        normalizedLabel,
      ) &&
      /secciones/.test(normalizedContainer)
    ) {
      next.section = normalizedLabel;
      next.tab = TAB_SCOPE_TRANSVERSAL;
      next.confidence = "exacta-por-registro";
    }
  }

  if (next.module === "monitoreo") {
    const profile =
      /territorial/.test(normalizedContainer)
        ? "territorial"
        : /telefonico/.test(normalizedContainer)
          ? "telefonico"
          : /aulas|cursos-horario/.test(normalizedContainer)
            ? "aulas"
            : /acreditacion/.test(normalizedContainer)
              ? "acreditacion"
              : null;
    const view = [
      "fuentes",
      "modelo",
      "calidad",
      "consultas",
      "avance",
      "ocurrencias",
      "telefonico",
    ].find((value) => normalizedContainer.includes(`-${value}`));
    if (profile && view) {
      const candidate = monitoringDeclaredSection(profile, view);
      const valid = HIERARCHY.find((item) => item.module === "monitoreo")
        ?.sections.some((section) => section.id === candidate);
      if (valid) {
        next.section = candidate;
        next.tab = label;
        next.confidence = "exacta-por-registro";
      }
    }
  }

  if (
    next.module === "dashboard" &&
    /(?:^|-)panels?(?:-|$)/.test(normalizedContainer)
  ) {
    next.section = "configuracion";
    next.tab = "Personalizar";
    next.confidence = "exacta-por-registro";
  }

  const classification = declarationClassification(containerName);
  if (
    classification.kind === "Pestaña declarada" &&
    next.module !== "global" &&
    !next.tab
  ) {
    next.tab = label;
  }
  return next;
}

function declaredStateModel(attributes) {
  const stateKeys = [
    "disabled",
    "enabled",
    "active",
    "selected",
    "checked",
    "visible",
    "hidden",
    "available",
    "required",
    "readOnly",
    "loading",
    "busy",
    "status",
    "state",
    "done",
    "badge",
    "count",
    "disabledReason",
    "lockedReason",
  ];
  const states = stateKeys
    .filter((key) => attributes[key] !== undefined)
    .map((key) => `${key}=${cleanText(attributes[key], 80)}`);
  return {
    states,
    stateModel: states.length
      ? "Estados declarados en la configuración."
      : "Sin estado propio declarado; hereda disponibilidad y selección del componente consumidor.",
  };
}

function buildExternalUiUsageIndex(sourceFiles) {
  const usageIndex = new Map();
  const addUsage = (key, usage) => {
    const usages = usageIndex.get(key) ?? [];
    usages.push(usage);
    usageIndex.set(key, usages);
  };
  for (const file of sourceFiles) {
    const source = fs.readFileSync(file, "utf8");
    const sourceRelativePath = relativePath(file);
    const sourceFile = ts.createSourceFile(
      sourceRelativePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      scriptKindFor(file),
    );
    const lineStarts = computeLineStarts(source);
    const bindings = new Map();
    for (const statement of sourceFile.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        continue;
      }
      const definitionFile = resolveImportFile(
        file,
        statement.moduleSpecifier.text,
      );
      if (!definitionFile || !statement.importClause) continue;
      const clause = statement.importClause;
      if (clause.name) {
        bindings.set(clause.name.text, {
          definitionFile,
          importedName: "default",
        });
      }
      if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const specifier of clause.namedBindings.elements) {
          bindings.set(specifier.name.text, {
            definitionFile,
            importedName:
              specifier.propertyName?.text ?? specifier.name.text,
          });
        }
      }
    }
    const visit = (node) => {
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length === 1 &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        const definitionFile = resolveImportFile(
          file,
          node.arguments[0].text,
        );
        if (definitionFile) {
          const position = lineAndColumn(
            lineStarts,
            node.getStart(sourceFile),
          );
          addUsage(`${definitionFile}::default`, {
            file: sourceRelativePath,
            line: position.line,
            column: position.column,
            score: 1,
            resolution: "import-dinámico-interarchivo",
          });
        }
      }
      if (ts.isIdentifier(node) && bindings.has(node.text)) {
        const parent = node.parent;
        const isBinding =
          (ts.isImportClause(parent) && parent.name === node) ||
          (ts.isImportSpecifier(parent) &&
            (parent.name === node || parent.propertyName === node));
        if (!isBinding) {
          const binding = bindings.get(node.text);
          let current = parent;
          let score = isUiDeclarationContainer(binding.importedName) ? 1 : 2;
          while (current && !ts.isSourceFile(current)) {
            if (ts.isJsxExpression(current) || ts.isJsxAttribute(current)) {
              score = 0;
              break;
            }
            if (
              ts.isCallExpression(current) &&
              ts.isPropertyAccessExpression(current.expression) &&
              /^(?:map|flatMap|filter|find)$/.test(
                current.expression.name.text,
              )
            ) {
              score = Math.min(score, 1);
            }
            current = current.parent;
          }
          if (score <= 1) {
            const position = lineAndColumn(
              lineStarts,
              node.getStart(sourceFile),
            );
            const key = `${binding.definitionFile}::${binding.importedName}`;
            addUsage(key, {
              file: sourceRelativePath,
              line: position.line,
              column: position.column,
              score,
              resolution:
                score === 0
                  ? "sink-jsx-interarchivo"
                  : "consumidor-interarchivo",
            });
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  for (const usages of usageIndex.values()) {
    usages.sort(
      (a, b) =>
        a.score - b.score ||
        a.file.localeCompare(b.file) ||
        a.line - b.line ||
        a.column - b.column,
    );
  }
  return usageIndex;
}

function scanDeclarationFile(file, externalUsageIndex = new Map()) {
  const source = fs.readFileSync(file, "utf8");
  const sourceRelativePath = relativePath(file);
  const sourceFile = ts.createSourceFile(
    sourceRelativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(file),
  );
  const lineStarts = computeLineStarts(source);
  const jsxReferences = collectJsxReferencedIdentifiers(sourceFile);
  const declarations = [];
  const visitedArrays = new Set();
  const visitedRecords = new Set();
  const expandedCandidatePositions = new Set();
  const localInitializers = new Map();
  const localFactories = new Map();
  const defaultExportedLocalNames = new Set(
    sourceFile.statements
      .filter(
        (statement) =>
          ts.isExportAssignment(statement) &&
          !statement.isExportEquals &&
          ts.isIdentifier(statement.expression),
      )
      .map((statement) => statement.expression.text),
  );

  const isStyleObjectContext = (node) => {
    let current = node;
    while (current && !ts.isSourceFile(current)) {
      if (
        ts.isVariableDeclaration(current) &&
        ts.isIdentifier(current.name)
      ) {
        const name = current.name.text;
        const typeText = current.type?.getText(sourceFile) ?? "";
        return (
          /\bCSSProperties\b/.test(typeText) ||
          /^[a-z][A-Za-z0-9]*(?:Style|Styles)$/.test(name)
        );
      }
      current = current.parent;
    }
    return false;
  };

  const indexInitializers = (node) => {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name &&
      node.body
    ) {
      localFactories.set(node.name.text, node);
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      const initializer = unwrapExpression(node.initializer);
      localInitializers.set(node.name.text, initializer);
      if (
        initializer &&
        (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
      ) {
        localFactories.set(node.name.text, initializer);
      }
    }
    ts.forEachChild(node, indexInitializers);
  };
  indexInitializers(sourceFile);

  const resolveLocalExpression = (node, seen = new Set()) => {
    const current = unwrapExpression(node);
    if (!current) return null;
    if (ts.isIdentifier(current)) {
      if (seen.has(current.text)) return current;
      const resolved = localInitializers.get(current.text);
      if (!resolved) return current;
      return resolveLocalExpression(resolved, new Set([...seen, current.text]));
    }
    if (ts.isPropertyAccessExpression(current)) {
      const owner = resolveLocalExpression(current.expression, seen);
      if (owner && ts.isObjectLiteralExpression(owner)) {
        const property = owner.properties.find(
          (candidate) =>
            ts.isPropertyAssignment(candidate) &&
            propertyNameText(candidate.name, sourceFile) === current.name.text,
        );
        if (property && ts.isPropertyAssignment(property)) {
          return resolveLocalExpression(property.initializer, seen);
        }
      }
    }
    return current;
  };

  const resolvedObjectProperties = (objectNode, seen = new Set()) => {
    const properties = [];
    for (const property of objectNode.properties) {
      if (ts.isPropertyAssignment(property)) {
        properties.push(property);
        continue;
      }
      if (ts.isSpreadAssignment(property)) {
        const spread = resolveLocalExpression(property.expression, seen);
        if (
          spread &&
          ts.isObjectLiteralExpression(spread) &&
          !seen.has(spread.getStart(sourceFile))
        ) {
          properties.push(
            ...resolvedObjectProperties(
              spread,
              new Set([...seen, spread.getStart(sourceFile)]),
            ),
          );
        }
      }
    }
    return properties;
  };

  const resolveBoundExpression = (node, bindings, seen = new Set()) => {
    const current = unwrapExpression(node);
    if (!current) return null;
    if (ts.isIdentifier(current)) {
      if (seen.has(current.text)) return current;
      const resolved = bindings.get(current.text) ?? localInitializers.get(current.text);
      if (!resolved) return current;
      return resolveBoundExpression(
        resolved,
        bindings,
        new Set([...seen, current.text]),
      );
    }
    if (ts.isPropertyAccessExpression(current)) {
      const owner = resolveBoundExpression(current.expression, bindings, seen);
      if (owner && ts.isObjectLiteralExpression(owner)) {
        const property = owner.properties.find(
          (candidate) =>
            (ts.isPropertyAssignment(candidate) ||
              ts.isShorthandPropertyAssignment(candidate)) &&
            propertyNameText(candidate.name, sourceFile) === current.name.text,
        );
        if (property && ts.isPropertyAssignment(property)) {
          return resolveBoundExpression(property.initializer, bindings, seen);
        }
        if (property && ts.isShorthandPropertyAssignment(property)) {
          return resolveBoundExpression(property.name, bindings, seen);
        }
      }
    }
    return current;
  };

  const boundLiteralVariants = (node, bindings, seen = new Set()) => {
    const current = resolveBoundExpression(node, bindings, seen);
    if (!current) return [];
    if (
      ts.isStringLiteral(current) ||
      ts.isNoSubstitutionTemplateLiteral(current) ||
      ts.isNumericLiteral(current)
    ) {
      return [cleanText(current.text, 240)].filter(Boolean);
    }
    if (current.kind === ts.SyntaxKind.TrueKeyword) return ["true"];
    if (current.kind === ts.SyntaxKind.FalseKeyword) return ["false"];
    if (ts.isConditionalExpression(current)) {
      return [
        ...boundLiteralVariants(current.whenTrue, bindings, seen),
        ...boundLiteralVariants(current.whenFalse, bindings, seen),
      ];
    }
    if (
      ts.isBinaryExpression(current) &&
      current.operatorToken.kind === ts.SyntaxKind.PlusToken
    ) {
      const left = boundLiteralVariants(current.left, bindings, seen);
      const right = boundLiteralVariants(current.right, bindings, seen);
      if (left.length && right.length) {
        return left.flatMap((a) => right.map((b) => `${a}${b}`));
      }
    }
    if (ts.isTemplateExpression(current)) {
      let variants = [current.head.text];
      for (const span of current.templateSpans) {
        const values = boundLiteralVariants(span.expression, bindings, seen);
        if (!values.length) return [];
        variants = variants.flatMap((prefix) =>
          values.map((value) => `${prefix}${value}${span.literal.text}`),
        );
      }
      return variants.map((value) => cleanText(value, 240)).filter(Boolean);
    }
    return [];
  };

  const boundSimpleDeclaredValue = (node, bindings) => {
    const variants = [...new Set(boundLiteralVariants(node, bindings))];
    if (variants.length) return variants.join(" / ");
    const current = resolveBoundExpression(node, bindings);
    return cleanText(current?.getText(sourceFile) ?? "", 180);
  };

  const factoryReturnExpressions = (factory) => {
    if (
      (ts.isArrowFunction(factory) || ts.isFunctionExpression(factory)) &&
      !ts.isBlock(factory.body)
    ) {
      return [factory.body];
    }
    const body = factory.body;
    if (!body || !ts.isBlock(body)) return [];
    const returns = [];
    const collect = (node) => {
      if (
        node !== body &&
        (ts.isArrowFunction(node) ||
          ts.isFunctionExpression(node) ||
          ts.isFunctionDeclaration(node))
      ) {
        return;
      }
      if (ts.isReturnStatement(node) && node.expression) {
        returns.push(node.expression);
        return;
      }
      ts.forEachChild(node, collect);
    };
    collect(body);
    return returns;
  };

  const describeFactoryCall = (
    call,
    inheritedBindings = new Map(),
    seenFactories = new Set(),
  ) => {
    const expression = unwrapExpression(call.expression);
    if (!expression || !ts.isIdentifier(expression)) return null;
    const factoryName = expression.text;
    const factory = localFactories.get(factoryName);
    if (!factory || seenFactories.has(factoryName)) return null;

    const bindings = new Map(inheritedBindings);
    factory.parameters.forEach((parameter, index) => {
      if (!ts.isIdentifier(parameter.name) || !call.arguments[index]) return;
      bindings.set(
        parameter.name.text,
        resolveBoundExpression(call.arguments[index], inheritedBindings) ??
          call.arguments[index],
      );
    });

    const attributes = {};
    const labelVariants = [];
    const detailVariants = [];
    const addProperty = (key, valueNode) => {
      if (!UI_DECLARATION_PROPERTY_KEYS.has(key)) return;
      attributes[key] = boundSimpleDeclaredValue(valueNode, bindings);
      if (UI_DECLARATION_PRIMARY_KEYS.includes(key)) {
        labelVariants.push(...boundLiteralVariants(valueNode, bindings));
      }
      if (UI_DECLARATION_DETAIL_KEYS.includes(key)) {
        detailVariants.push(...boundLiteralVariants(valueNode, bindings));
      }
    };
    const addObject = (objectNode) => {
      for (const property of objectNode.properties) {
        if (ts.isPropertyAssignment(property)) {
          addProperty(
            propertyNameText(property.name, sourceFile),
            property.initializer,
          );
          continue;
        }
        if (ts.isShorthandPropertyAssignment(property)) {
          addProperty(property.name.text, property.name);
          continue;
        }
        if (!ts.isSpreadAssignment(property)) continue;
        const spread = resolveBoundExpression(property.expression, bindings);
        if (spread && ts.isObjectLiteralExpression(spread)) {
          addObject(spread);
          continue;
        }
        if (spread && ts.isCallExpression(spread)) {
          const nested = describeFactoryCall(
            spread,
            bindings,
            new Set([...seenFactories, factoryName]),
          );
          if (!nested) continue;
          Object.assign(attributes, nested.attributes);
          labelVariants.push(...nested.labelVariants);
          detailVariants.push(...nested.detailVariants);
        }
      }
    };

    for (const returnExpression of factoryReturnExpressions(factory)) {
      const returned = resolveBoundExpression(returnExpression, bindings);
      if (returned && ts.isObjectLiteralExpression(returned)) addObject(returned);
    }
    if (!labelVariants.length) return null;
    return { attributes, labelVariants, detailVariants };
  };
  const renderReferenceCache = new Map();
  const localRenderReference = (containerName, fallbackPosition) => {
    const rootName = String(containerName).split(".")[0];
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(rootName)) {
      return {
        file: sourceRelativePath,
        ...lineAndColumn(lineStarts, fallbackPosition),
        resolution: "declaración-inline",
      };
    }
    if (renderReferenceCache.has(rootName)) {
      return renderReferenceCache.get(rootName);
    }
    const externalReferences = [
      ...(externalUsageIndex.get(`${sourceRelativePath}::${rootName}`) ?? []),
      ...(defaultExportedLocalNames.has(rootName)
        ? externalUsageIndex.get(`${sourceRelativePath}::default`) ?? []
        : []),
    ].sort(
      (a, b) =>
        a.score - b.score ||
        a.file.localeCompare(b.file) ||
        a.line - b.line ||
        a.column - b.column,
    );
    if (externalReferences.length > 0) {
      const [externalReference] = externalReferences;
      renderReferenceCache.set(rootName, externalReference);
      return externalReference;
    }
    const candidates = [];
    const findReferences = (node) => {
      if (ts.isIdentifier(node) && node.text === rootName) {
        const parent = node.parent;
        const isDeclarationName =
          (ts.isVariableDeclaration(parent) && parent.name === node) ||
          (ts.isPropertyAssignment(parent) && parent.name === node) ||
          (ts.isImportSpecifier(parent) && parent.name === node);
        if (!isDeclarationName) {
          let current = parent;
          let score = 2;
          while (current && !ts.isSourceFile(current)) {
            if (ts.isJsxExpression(current) || ts.isJsxAttribute(current)) {
              score = 0;
              break;
            }
            if (
              ts.isCallExpression(current) ||
              ts.isReturnStatement(current)
            ) {
              score = Math.min(score, 1);
            }
            current = current.parent;
          }
          candidates.push({ score, position: node.getStart(sourceFile) });
        }
      }
      ts.forEachChild(node, findReferences);
    };
    findReferences(sourceFile);
    candidates.sort(
      (a, b) => a.score - b.score || a.position - b.position,
    );
    const chosen = candidates[0];
    const reference = {
      file: sourceRelativePath,
      ...lineAndColumn(
        lineStarts,
        chosen?.position ?? fallbackPosition,
      ),
      resolution: chosen
        ? chosen.score === 0
          ? "sink-jsx-local"
          : "consumidor-local"
        : "declaración; consumidor interarchivo no resuelto",
    };
    renderReferenceCache.set(rootName, reference);
    return reference;
  };

  const emitObject = (
    sourceNode,
    containerName,
    ancestryLabels,
    evidence,
    factoryDescription = null,
  ) => {
    const attributes = factoryDescription?.attributes ?? {};
    const labelVariants = [...(factoryDescription?.labelVariants ?? [])];
    const detailVariants = [...(factoryDescription?.detailVariants ?? [])];
    if (!factoryDescription && ts.isObjectLiteralExpression(sourceNode)) {
      for (const property of resolvedObjectProperties(sourceNode)) {
        const key = propertyNameText(property.name, sourceFile);
        if (!UI_DECLARATION_PROPERTY_KEYS.has(key)) continue;
        const initializer =
          resolveLocalExpression(property.initializer) ?? property.initializer;
        attributes[key] = simpleDeclaredValue(initializer, sourceFile);
        if (UI_DECLARATION_PRIMARY_KEYS.includes(key)) {
          labelVariants.push(
            ...literalVariants(initializer, sourceFile),
          );
        }
        if (UI_DECLARATION_DETAIL_KEYS.includes(key)) {
          detailVariants.push(
            ...literalVariants(initializer, sourceFile),
          );
        }
      }
    }
    const labels = [...new Set(labelVariants.filter(Boolean))];
    if (!labels.length) return [];
    expandedCandidatePositions.add(sourceNode.getStart(sourceFile));
    const emittedLabels = [];
    labels.forEach((label, variantIndex) => {
      const recordKey = `${sourceNode.getStart(sourceFile)}:${label}`;
      if (visitedRecords.has(recordKey)) return;
      visitedRecords.add(recordKey);
      const position = lineAndColumn(
        lineStarts,
        sourceNode.getStart(sourceFile),
      );
      const nearestComponent = findNearestComponentName(
        sourceNode,
        sourceFile,
      );
      const rawCondition = findRenderCondition(sourceNode, sourceFile);
      const condition =
        rawCondition === "Siempre que se renderiza su componente contenedor"
          ? `Cuando ${containerName} se consume desde ${nearestComponent}`
          : rawCondition;
      const baseContext = inferContext(
        sourceRelativePath,
        nearestComponent,
        condition,
      );
      const context = refineDeclaredContext(
        baseContext,
        attributes,
        label,
        containerName,
        ancestryLabels,
      );
      const classification = declarationClassification(containerName);
      const { states, stateModel } = declaredStateModel(attributes);
      const detail = [...new Set(detailVariants.filter(Boolean))].join(" · ");
      const id = sha256(
        `${sourceRelativePath}:${position.line}:${position.column}:declaration:${containerName}:${variantIndex}:${label}`,
      ).slice(0, 16);
      declarations.push({
        id,
        sourceType: "declaración",
        module: context.module,
        section: context.section,
        tab: context.tab,
        contextConfidence: context.confidence,
        componentContext: containerName,
        category: classification.category,
        kind: classification.kind,
        tag: `config:${containerName}`,
        label,
        detail: detail || null,
        usage: `${CATEGORY_DESCRIPTIONS[classification.category]} Declarado en ${containerName}${detail ? `: ${detail}` : ""}.`,
        renderedWhen: condition,
        interactive: ["Acción", "Campo", "Navegación", "Selección"].includes(
          classification.category,
        ),
        nativeElement: false,
        attributes,
        spreads: [],
        classNames: [],
        states,
        visualVariants: ["variant", "size"]
          .filter((key) => attributes[key] !== undefined)
          .map((key) => `${key}=${cleanText(attributes[key], 80)}`),
        stateModel,
        handlers: [],
        importSource: null,
        definitionFile: sourceRelativePath,
        styleSources: [],
        declarationEvidence: evidence,
        ancestry: ancestryLabels,
        renderSource: localRenderReference(
          containerName,
          sourceNode.getStart(sourceFile),
        ),
        source: {
          file: sourceRelativePath,
          line: position.line,
          column: position.column,
        },
      });
      emittedLabels.push(label);
    });
    return emittedLabels;
  };

  const emitLiteral = (
    literalNode,
    containerName,
    ancestryLabels,
    evidence,
    extraAttributes = {},
    explicitDetail = null,
  ) => {
    const labels = literalVariants(literalNode, sourceFile);
    if (labels.length) {
      expandedCandidatePositions.add(literalNode.getStart(sourceFile));
    }
    for (const [variantIndex, label] of labels.entries()) {
      if (!label) continue;
      const position = lineAndColumn(
        lineStarts,
        literalNode.getStart(sourceFile),
      );
      const recordKey = `${literalNode.getStart(sourceFile)}:${label}`;
      if (visitedRecords.has(recordKey)) continue;
      visitedRecords.add(recordKey);
      const nearestComponent = findNearestComponentName(
        literalNode,
        sourceFile,
      );
      const rawCondition = findRenderCondition(literalNode, sourceFile);
      const condition =
        rawCondition === "Siempre que se renderiza su componente contenedor"
          ? `Cuando ${containerName} se consume desde ${nearestComponent}`
          : rawCondition;
      const baseContext = inferContext(
        sourceRelativePath,
        nearestComponent,
        condition,
      );
      const context = refineDeclaredContext(
        baseContext,
        extraAttributes,
        label,
        containerName,
        ancestryLabels,
      );
      const classification = declarationClassification(containerName);
      const { states, stateModel } = declaredStateModel(extraAttributes);
      declarations.push({
        id: sha256(
          `${sourceRelativePath}:${position.line}:${position.column}:literal:${containerName}:${variantIndex}:${label}`,
        ).slice(0, 16),
        sourceType: "declaración",
        module: context.module,
        section: context.section,
        tab: context.tab,
        contextConfidence: context.confidence,
        componentContext: containerName,
        category: classification.category,
        kind: classification.kind,
        tag: `config:${containerName}`,
        label,
        detail: explicitDetail,
        usage: `${CATEGORY_DESCRIPTIONS[classification.category]} Opción literal declarada en ${containerName}${explicitDetail ? `: ${explicitDetail}` : ""}.`,
        renderedWhen: condition,
        interactive: ["Acción", "Campo", "Navegación", "Selección"].includes(
          classification.category,
        ),
        nativeElement: false,
        attributes: extraAttributes,
        spreads: [],
        classNames: [],
        states,
        visualVariants: ["variant", "size"]
          .filter((key) => extraAttributes[key] !== undefined)
          .map((key) => `${key}=${cleanText(extraAttributes[key], 80)}`),
        stateModel,
        handlers: [],
        importSource: null,
        definitionFile: sourceRelativePath,
        styleSources: [],
        declarationEvidence: evidence,
        ancestry: ancestryLabels,
        renderSource: localRenderReference(
          containerName,
          literalNode.getStart(sourceFile),
        ),
        source: {
          file: sourceRelativePath,
          line: position.line,
          column: position.column,
        },
      });
    }
  };

  const processArray = (
    arrayNode,
    containerName,
    ancestryLabels = [],
    evidence = "registro-ui",
  ) => {
    const current = unwrapExpression(arrayNode);
    if (!current || !ts.isArrayLiteralExpression(current)) return;
    expandedCandidatePositions.add(current.getStart(sourceFile));
    const arrayKey = `${current.getStart(sourceFile)}:${containerName}`;
    if (visitedArrays.has(arrayKey)) return;
    visitedArrays.add(arrayKey);
    for (const element of current.elements) {
      const item = unwrapExpression(element);
      if (!item || ts.isSpreadElement(item)) continue;
      if (ts.isArrayLiteralExpression(item)) {
        const tuple = item.elements
          .map((tupleItem) => unwrapExpression(tupleItem))
          .filter(Boolean);
        const labelNode = tuple[1] ?? tuple[0];
        const labelValues = labelNode
          ? literalVariants(labelNode, sourceFile)
          : [];
        if (labelValues.length) {
          const value = tuple[0]
            ? simpleDeclaredValue(tuple[0], sourceFile)
            : "";
          const detail = tuple[2]
            ? simpleDeclaredValue(tuple[2], sourceFile)
            : null;
          emitLiteral(
            labelNode,
            containerName,
            ancestryLabels,
            `${evidence}-tupla`,
            value ? { value } : {},
            detail,
          );
        } else {
          processArray(
            item,
            `${containerName}.tuple`,
            ancestryLabels,
            evidence,
          );
        }
        continue;
      }
      if (
        ts.isStringLiteral(item) ||
        ts.isNoSubstitutionTemplateLiteral(item) ||
        ts.isNumericLiteral(item) ||
        ts.isConditionalExpression(item)
      ) {
        if (
          evidence !== "nombre-de-registro-ui" ||
          isLiteralDeclarationContainer(containerName)
        ) {
          emitLiteral(item, containerName, ancestryLabels, evidence);
        }
        continue;
      }
      if (ts.isCallExpression(item)) {
        const factoryDescription = describeFactoryCall(item);
        if (factoryDescription) {
          emitObject(
            item,
            containerName,
            ancestryLabels,
            `${evidence}-factory-local`,
            factoryDescription,
          );
        }
        continue;
      }
      if (!ts.isObjectLiteralExpression(item)) continue;
      const emittedLabels = emitObject(
        item,
        containerName,
        ancestryLabels,
        evidence,
      );
      const nextAncestry = [...ancestryLabels, ...emittedLabels].slice(-8);
      for (const property of item.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const propertyName = propertyNameText(property.name, sourceFile);
        if (UI_DECLARATION_TECHNICAL_KEYS.has(propertyName)) continue;
        const initializer = unwrapExpression(property.initializer);
        if (
          initializer &&
          ts.isArrayLiteralExpression(initializer)
        ) {
          processArray(
            initializer,
            `${containerName}.${propertyName}`,
            nextAncestry,
            evidence,
          );
        } else if (initializer && ts.isObjectLiteralExpression(initializer)) {
          processRecord(
            initializer,
            `${containerName}.${propertyName}`,
            nextAncestry,
            evidence,
          );
        }
      }
    }
  };

  const processRecord = (
    objectNode,
    containerName,
    ancestryLabels = [],
    evidence = "registro-ui",
  ) => {
    const emittedLabels = emitObject(
      objectNode,
      containerName,
      ancestryLabels,
      evidence,
    );
    const nextAncestry = [...ancestryLabels, ...emittedLabels].slice(-8);
    const objectHasOwnLabel = emittedLabels.length > 0;
    for (const property of objectNode.properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      const propertyName = propertyNameText(property.name, sourceFile);
      if (UI_DECLARATION_TECHNICAL_KEYS.has(propertyName)) continue;
      const initializer = unwrapExpression(property.initializer);
      if (!initializer) continue;
      const nestedContainer = `${containerName}.${propertyName}`;
      if (ts.isArrayLiteralExpression(initializer)) {
        processArray(initializer, nestedContainer, nextAncestry, evidence);
        continue;
      }
      if (ts.isObjectLiteralExpression(initializer)) {
        processRecord(initializer, nestedContainer, nextAncestry, evidence);
        continue;
      }
      if (
        !objectHasOwnLabel &&
        (ts.isStringLiteral(initializer) ||
          ts.isNoSubstitutionTemplateLiteral(initializer)) &&
        !UI_DECLARATION_DETAIL_KEYS.includes(propertyName) &&
        !/^(?:id|key|value|type|kind|color|className|icon|route|to|href)$/i.test(
          propertyName,
        )
      ) {
        emitLiteral(
          initializer,
          containerName,
          [...nextAncestry, propertyName],
          `${evidence}-record`,
          { key: propertyName },
        );
      }
    }
  };

  const arraysFromInitializer = (initializer) => {
    const current = unwrapExpression(initializer);
    if (!current) return [];
    if (ts.isArrayLiteralExpression(current)) return [current];
    if (ts.isConditionalExpression(current)) {
      return [
        ...arraysFromInitializer(current.whenTrue),
        ...arraysFromInitializer(current.whenFalse),
      ];
    }
    if (ts.isBlock(current)) {
      const arrays = [];
      const collectReturns = (node) => {
        if (ts.isReturnStatement(node) && node.expression) {
          arrays.push(...arraysFromInitializer(node.expression));
          return;
        }
        ts.forEachChild(node, collectReturns);
      };
      collectReturns(current);
      return arrays;
    }
    if (
      ts.isCallExpression(current) &&
      current.arguments.length
    ) {
      return current.arguments.flatMap((argument) =>
        arraysFromInitializer(argument),
      );
    }
    if (
      ts.isArrowFunction(current) ||
      ts.isFunctionExpression(current)
    ) {
      return arraysFromInitializer(current.body);
    }
    return [];
  };

  const objectFromInitializer = (initializer) => {
    const current = unwrapExpression(initializer);
    return current && ts.isObjectLiteralExpression(current) ? current : null;
  };

  const callContainerName = (call) => {
    if (ts.isIdentifier(call.expression)) return call.expression.text;
    if (ts.isPropertyAccessExpression(call.expression)) {
      return call.expression.name.text;
    }
    return cleanText(call.expression.getText(sourceFile), 80);
  };

  const enclosingPropertyName = (node) => {
    let current = node.parent;
    while (current && !ts.isSourceFile(current)) {
      if (ts.isPropertyAssignment(current)) {
        return propertyNameText(current.name, sourceFile);
      }
      if (
        ts.isVariableDeclaration(current) ||
        ts.isFunctionDeclaration(current)
      ) {
        break;
      }
      current = current.parent;
    }
    return "";
  };

  const hasUiDeclarationAncestor = (node) => {
    let current = node.parent;
    while (current && !ts.isSourceFile(current)) {
      if (
        ts.isVariableDeclaration(current) &&
        ts.isIdentifier(current.name) &&
        isUiDeclarationContainer(current.name.text)
      ) {
        return true;
      }
      if (
        ts.isPropertyAssignment(current) &&
        isUiDeclarationContainer(propertyNameText(current.name, sourceFile))
      ) {
        return true;
      }
      current = current.parent;
    }
    return false;
  };

  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const name = node.name.text;
      const arrays = node.initializer
        ? arraysFromInitializer(node.initializer)
        : [];
      const object = node.initializer
        ? objectFromInitializer(node.initializer)
        : null;
      const hasUiEvidence =
        jsxReferences.has(name) || isUiDeclarationContainer(name);
      if (
        arrays.length &&
        hasUiEvidence &&
        !isStyleObjectContext(node)
      ) {
        for (const array of arrays) {
          processArray(
            array,
            name,
            [],
            jsxReferences.has(name)
              ? "referenciada-desde-jsx"
              : "nombre-de-registro-ui",
          );
        }
      }
      if (object && hasUiEvidence && !isStyleObjectContext(node)) {
        processRecord(
          object,
          name,
          [],
          jsxReferences.has(name)
            ? "referenciada-desde-jsx"
            : "nombre-de-registro-ui",
        );
      }
    }
    if (ts.isPropertyAssignment(node)) {
      const name = propertyNameText(node.name, sourceFile);
      const arrays = arraysFromInitializer(node.initializer);
      const standaloneUiProperty =
        isUiDeclarationContainer(name) &&
        !hasUiDeclarationAncestor(node) &&
        !isStyleObjectContext(node);
      if (arrays.length && standaloneUiProperty) {
        for (const array of arrays) {
          processArray(array, name, [], "propiedad-de-registro-ui");
        }
      }
      const object = objectFromInitializer(node.initializer);
      if (object && standaloneUiProperty) {
        processRecord(object, name, [], "propiedad-de-registro-ui");
      }
    }
    if (ts.isCallExpression(node)) {
      const callName = callContainerName(node);
      if (isUiDeclarationContainer(callName)) {
        const propertyName = enclosingPropertyName(node);
        const containerName = propertyName
          ? `${callName}.${propertyName}`
          : callName;
        for (const argument of node.arguments) {
          const current = unwrapExpression(argument);
          if (current && ts.isArrayLiteralExpression(current)) {
            processArray(
              current,
              containerName,
              [],
              "array-en-factory-ui",
            );
          } else if (current && ts.isObjectLiteralExpression(current)) {
            processRecord(
              current,
              containerName,
              [],
              "objeto-en-factory-ui",
            );
          }
        }
      }
    }
    if (ts.isReturnStatement(node) && node.expression) {
      const current = unwrapExpression(node.expression);
      const functionName = findNearestComponentName(node, sourceFile);
      if (
        current &&
        ts.isArrayLiteralExpression(current) &&
        isUiDeclarationContainer(functionName)
      ) {
        processArray(
          current,
          functionName,
          [],
          "array-retornado-por-factory-ui",
        );
      }
    }
    if (ts.isArrayLiteralExpression(node)) {
      let current = node.parent;
      let insideJsx = false;
      while (current && !ts.isSourceFile(current)) {
        if (ts.isJsxExpression(current)) {
          insideJsx = true;
          break;
        }
        current = current.parent;
      }
      if (insideJsx && isInlineRenderedArray(node)) {
        processArray(node, "inline-jsx-options", [], "array-inline-en-jsx");
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  const candidatePositions = new Map();
  const collectCandidates = (node) => {
    if (isStyleObjectContext(node)) return;
    if (ts.isArrayLiteralExpression(node)) {
      const hasVisibleShape = node.elements.some((element) => {
        const current = unwrapExpression(element);
        if (!current) return false;
        if (
          ts.isStringLiteral(current) ||
          ts.isNoSubstitutionTemplateLiteral(current)
        ) {
          return true;
        }
        if (ts.isArrayLiteralExpression(current)) {
          return current.elements.some(
            (item) => literalVariants(item, sourceFile).length > 0,
          );
        }
        if (ts.isObjectLiteralExpression(current)) {
          return current.properties.some(
            (property) =>
              ts.isPropertyAssignment(property) &&
              (UI_DECLARATION_PRIMARY_KEYS.includes(
                propertyNameText(property.name, sourceFile),
              ) ||
                UI_DECLARATION_DETAIL_KEYS.includes(
                  propertyNameText(property.name, sourceFile),
                )),
          );
        }
        return false;
      });
      if (hasVisibleShape) {
        candidatePositions.set(node.getStart(sourceFile), {
          node,
          kind: "array-o-tupla",
        });
      }
    }
    if (ts.isObjectLiteralExpression(node)) {
      const hasVisibleProperty = node.properties.some(
        (property) =>
          ts.isPropertyAssignment(property) &&
          (UI_DECLARATION_PRIMARY_KEYS.includes(
            propertyNameText(property.name, sourceFile),
          ) ||
            UI_DECLARATION_DETAIL_KEYS.includes(
              propertyNameText(property.name, sourceFile),
            )),
      );
      if (hasVisibleProperty) {
        candidatePositions.set(node.getStart(sourceFile), {
          node,
          kind: "objeto-con-copy-ui",
        });
      }
    }
    ts.forEachChild(node, collectCandidates);
  };
  collectCandidates(sourceFile);
  const expandedCandidates = [...candidatePositions.keys()].filter((position) =>
    expandedCandidatePositions.has(position),
  ).length;
  const ignoredCandidates = candidatePositions.size - expandedCandidates;
  const candidateContainerName = (node) => {
    let current = node;
    while (current && !ts.isSourceFile(current)) {
      if (
        ts.isVariableDeclaration(current) &&
        ts.isIdentifier(current.name)
      ) {
        return current.name.text;
      }
      if (ts.isPropertyAssignment(current)) {
        return propertyNameText(current.name, sourceFile);
      }
      current = current.parent;
    }
    return findNearestComponentName(node, sourceFile);
  };
  const candidateLabel = (node, kind, position) => {
    const values = [];
    const addFromObject = (objectNode) => {
      for (const property of resolvedObjectProperties(objectNode)) {
        if (!ts.isPropertyAssignment(property)) continue;
        const key = propertyNameText(property.name, sourceFile);
        if (
          !UI_DECLARATION_PRIMARY_KEYS.includes(key) &&
          !UI_DECLARATION_DETAIL_KEYS.includes(key)
        ) {
          continue;
        }
        values.push(
          ...literalVariants(
            resolveLocalExpression(property.initializer) ??
              property.initializer,
            sourceFile,
          ),
        );
      }
    };
    if (ts.isObjectLiteralExpression(node)) {
      addFromObject(node);
    } else if (ts.isArrayLiteralExpression(node)) {
      for (const element of node.elements.slice(0, 4)) {
        const current = unwrapExpression(element);
        if (!current) continue;
        values.push(...literalVariants(current, sourceFile));
        if (ts.isObjectLiteralExpression(current)) addFromObject(current);
        if (ts.isArrayLiteralExpression(current)) {
          for (const item of current.elements.slice(0, 3)) {
            values.push(...literalVariants(item, sourceFile));
          }
        }
      }
    }
    const uniqueValues = [...new Set(values.filter(Boolean))].slice(0, 3);
    return uniqueValues.length
      ? uniqueValues.join(" / ")
      : `${kind} en línea ${position.line}`;
  };
  const candidateSignals = (node, containerName) => {
    let current = node.parent;
    let jsxAncestor = false;
    let returnedFromComponent = false;
    let technicalControlFlow = false;
    while (current && !ts.isSourceFile(current)) {
      if (ts.isJsxExpression(current) || ts.isJsxAttribute(current)) {
        jsxAncestor = true;
      }
      if (ts.isReturnStatement(current)) returnedFromComponent = true;
      if (
        ts.isCallExpression(current) &&
        ts.isPropertyAccessExpression(current.expression) &&
        /^(?:filter|includes|some|every|sort)$/.test(
          current.expression.name.text,
        )
      ) {
        technicalControlFlow = true;
      }
      current = current.parent;
    }
    const rootName = String(containerName).split(".")[0];
    const uiReference =
      jsxReferences.has(rootName) || isUiDeclarationContainer(containerName);
    const normalizedContainer = normalizeDeclarationContainer(containerName);
    const technicalContainer =
      /(?:^|-)(?:allowlists?|payloads?|patches?|headers?|scopes?|keys?|aliases?|requests?|responses?|query|variables?|params?)(?:-|$)/.test(
        normalizedContainer,
      );
    return {
      jsxAncestor,
      returnedFromComponent,
      technicalControlFlow,
      uiReference,
      technicalContainer,
    };
  };
  const candidateLedger = [];
  const dispositionCounts = {
    "representado-por-descendiente": 0,
    técnico: 0,
    "probable-visual": 0,
    "no-resuelto": 0,
  };
  for (const [candidateStart, candidate] of candidatePositions) {
    if (expandedCandidatePositions.has(candidateStart)) continue;
    const { node, kind } = candidate;
    const candidateEnd = node.getEnd();
    const representedByDescendant = [...expandedCandidatePositions].some(
      (position) => position > candidateStart && position < candidateEnd,
    );
    const containerName = candidateContainerName(node);
    const signals = candidateSignals(node, containerName);
    let disposition = "no-resuelto";
    let sinkEvidence =
      "Sin sink visual estático ni descendiente confirmado.";
    if (representedByDescendant) {
      disposition = "representado-por-descendiente";
      sinkEvidence =
        "Uno o más descendientes del candidato ya están catalogados como declaraciones visuales confirmadas.";
    } else if (
      sourceRelativePath.startsWith("frontend/src/api/") ||
      signals.technicalContainer ||
      (signals.technicalControlFlow &&
        !signals.jsxAncestor &&
        !signals.uiReference)
    ) {
      disposition = "técnico";
      sinkEvidence =
        "Heurística técnica: estructura de API/estado/control de flujo sin sink JSX demostrado.";
    } else if (
      signals.jsxAncestor ||
      signals.uiReference ||
      (/\.[jt]sx$/i.test(sourceRelativePath) &&
        signals.returnedFromComponent)
    ) {
      disposition = "probable-visual";
      sinkEvidence =
        "Existe señal de consumo UI, pero no un sink visual estático suficiente para afirmar render confirmado.";
    }
    dispositionCounts[disposition] += 1;
    const position = lineAndColumn(lineStarts, candidateStart);
    const endPosition = lineAndColumn(lineStarts, candidateEnd);
    const nearestComponent = findNearestComponentName(node, sourceFile);
    const condition = findRenderCondition(node, sourceFile);
    const context = inferContext(
      sourceRelativePath,
      nearestComponent,
      condition,
    );
    const label = candidateLabel(node, kind, position);
    const dispositionUsage = {
      "representado-por-descendiente":
        "Estructura candidata conservada como evidencia; sus elementos visibles descendientes ya se enumeran por separado.",
      técnico:
        "Estructura candidata conservada para auditoría; la evidencia disponible la sitúa en configuración técnica, API, estado o control de flujo.",
      "probable-visual":
        "Candidato probablemente visual que requiere confirmar su consumidor o instancia de runtime antes de promoverlo a elemento visible.",
      "no-resuelto":
        "Candidato con copy visual cuya función no puede decidirse estáticamente; queda individualizado para revisión futura.",
    }[disposition];
    candidateLedger.push({
      id: sha256(
        `${sourceRelativePath}:${position.line}:${position.column}:candidate:${kind}`,
      ).slice(0, 16),
      sourceType: "auditoría-candidato",
      module: context.module,
      section: context.section,
      tab: context.tab,
      contextConfidence: context.confidence,
      componentContext: containerName,
      category: kind === "array-o-tupla" ? "Estructura" : "Texto",
      kind: "Candidato de declaración visual",
      tag: `candidate:${kind}`,
      label,
      detail: cleanText(node.getText(sourceFile), 240),
      usage: dispositionUsage,
      renderedWhen:
        disposition === "representado-por-descendiente"
          ? "El contenedor participa en una declaración visual cuyos descendientes confirmados se catalogan individualmente."
          : "Render no confirmado; registro de auditoría, no afirmación de visibilidad.",
      interactive: false,
      potentiallyInteractive: disposition === "probable-visual",
      nativeElement: false,
      visibilityStatus: disposition,
      attributes: {
        candidateKind: kind,
        disposition,
        sinkEvidence,
        startLine: position.line,
        endLine: endPosition.line,
      },
      spreads: [],
      classNames: [],
      states: [],
      visualVariants: [],
      stateModel:
        "Sin estado visual confirmado; el candidato permanece separado de los elementos visibles.",
      handlers: [],
      importSource: null,
      definitionFile: sourceRelativePath,
      styleSources: [],
      declarationEvidence: "ledger-individual-de-candidatos",
      ancestry: [],
      renderSource: {
        file: sourceRelativePath,
        line: position.line,
        column: position.column,
        resolution: `auditoría-${disposition}`,
      },
      source: {
        file: sourceRelativePath,
        line: position.line,
        column: position.column,
      },
    });
  }

  return {
    file: sourceRelativePath,
    sha256: sha256(source),
    declarations,
    candidateLedger,
    candidateAudit: {
      candidates: candidatePositions.size,
      expanded: expandedCandidates,
      ignored: ignoredCandidates,
      ledgered: candidateLedger.length,
      dispositions: dispositionCounts,
      ignoredReason:
        ignoredCandidates > 0
          ? "Cada candidato no expandido se conserva en el ledger individual con evidencia y disposición explícitas."
          : null,
    },
  };
}

const DYNAMIC_VISUAL_BINDING_NAMES = new Set([
  "Icon",
  "ActiveIcon",
  "SelectedIcon",
  "Tag",
]);

function buildDynamicVisualBindingIndex(sourceFile, lineStarts) {
  const typeOptions = new Map();
  const addTypeOptions = (name, typeNode) => {
    if (!name || !typeNode) return;
    const values = typeOptions.get(name) ?? new Set();
    const visitType = (node) => {
      if (
        ts.isLiteralTypeNode(node) &&
        ts.isStringLiteral(node.literal)
      ) {
        values.add(node.literal.text);
      }
      ts.forEachChild(node, visitType);
    };
    visitType(typeNode);
    if (values.size) typeOptions.set(name, values);
  };
  const collectTypes = (node) => {
    if (
      (ts.isPropertySignature(node) || ts.isParameter(node)) &&
      node.type
    ) {
      addTypeOptions(propertyNameText(node.name, sourceFile), node.type);
    }
    ts.forEachChild(node, collectTypes);
  };
  collectTypes(sourceFile);

  const scopeFor = (node) => {
    let current = node.parent;
    while (current && !ts.isSourceFile(current)) {
      if (
        ts.isFunctionLike(current) ||
        ts.isBlock(current) ||
        ts.isModuleBlock(current)
      ) {
        return {
          start: current.getStart(sourceFile),
          end: current.getEnd(),
        };
      }
      current = current.parent;
    }
    return {
      start: sourceFile.getStart(sourceFile),
      end: sourceFile.getEnd(),
    };
  };
  const expressionOptions = (expression, bindingName) => {
    const values = new Set();
    if (!expression) return values;
    for (const value of literalVariants(expression, sourceFile)) {
      values.add(value);
    }
    const visitExpression = (node) => {
      if (
        ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node)
      ) {
        values.add(node.text);
      }
      if (
        bindingName !== "Tag" &&
        ts.isIdentifier(node) &&
        /^[A-Z][A-Za-z0-9]*$/.test(node.text) &&
        !["React", "ElementType"].includes(node.text)
      ) {
        values.add(node.text);
      }
      if (ts.isIdentifier(node)) {
        for (const option of typeOptions.get(node.text) ?? []) {
          values.add(option);
        }
      }
      ts.forEachChild(node, visitExpression);
    };
    visitExpression(expression);
    return values;
  };
  const bindings = [];
  const addBinding = (name, node, expression, provider) => {
    if (!DYNAMIC_VISUAL_BINDING_NAMES.has(name)) return;
    const scope = scopeFor(node);
    const position = lineAndColumn(
      lineStarts,
      node.getStart(sourceFile),
    );
    bindings.push({
      name,
      role: name === "Tag" ? "tag-polimórfico" : "icono-dinámico",
      provider: cleanText(provider, 180),
      options: [
        ...expressionOptions(expression, name),
        ...(name === "Tag"
          ? [...(typeOptions.get(provider) ?? [])]
          : []),
      ].filter(Boolean),
      declarationStart: node.getStart(sourceFile),
      scopeStart: scope.start,
      scopeEnd: scope.end,
      source: {
        line: position.line,
        column: position.column,
      },
    });
  };
  const collectBindings = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      addBinding(
        node.name.text,
        node,
        node.initializer,
        node.initializer.getText(sourceFile),
      );
    }
    if (
      ts.isBindingElement(node) &&
      ts.isIdentifier(node.name)
    ) {
      const property = propertyNameText(
        node.propertyName ?? node.name,
        sourceFile,
      );
      addBinding(
        node.name.text,
        node,
        node.initializer,
        node.initializer
          ? `${property} ?? ${node.initializer.getText(sourceFile)}`
          : `prop:${property}`,
      );
    }
    ts.forEachChild(node, collectBindings);
  };
  collectBindings(sourceFile);
  return bindings;
}

function resolveDynamicVisualBinding(bindings, tagName, position) {
  return (
    bindings
      .filter(
        (binding) =>
          binding.name === tagName &&
          binding.declarationStart <= position &&
          binding.scopeStart <= position &&
          binding.scopeEnd >= position,
      )
      .sort(
        (a, b) =>
          a.scopeEnd - a.scopeStart - (b.scopeEnd - b.scopeStart) ||
          b.declarationStart - a.declarationStart,
      )[0] ?? null
  );
}

function scanJsxFile(file, cssIndex) {
  const source = fs.readFileSync(file, "utf8");
  const sourceRelativePath = relativePath(file);
  const sourceFile = ts.createSourceFile(
    sourceRelativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(file),
  );
  const imports = buildImportIndex(sourceFile, file);
  const lineStarts = computeLineStarts(source);
  const dynamicVisualBindings = buildDynamicVisualBindingIndex(
    sourceFile,
    lineStarts,
  );
  const localDeclarations = new Set();
  const collectLocalDeclarations = (node) => {
    if (
      (ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isVariableDeclaration(node)) &&
      node.name &&
      ts.isIdentifier(node.name)
    ) {
      localDeclarations.add(node.name.text);
    }
    ts.forEachChild(node, collectLocalDeclarations);
  };
  collectLocalDeclarations(sourceFile);
  const entries = [];

  const visit = (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = cleanText(node.tagName.getText(sourceFile), 120);
      const { attributes, spreads } = extractAttributes(node, sourceFile);
      const classNames = extractClassNames(attributes);
      const position = lineAndColumn(lineStarts, node.getStart(sourceFile));
      const nearestComponent = findNearestComponentName(node, sourceFile);
      const condition = findRenderCondition(node, sourceFile);
      const context = inferContext(
        sourceRelativePath,
        nearestComponent,
        condition,
      );
      const rootTagName = tagName.split(".")[0];
      const dynamicBinding = resolveDynamicVisualBinding(
        dynamicVisualBindings,
        rootTagName,
        node.getStart(sourceFile),
      );
      const catalogAttributes = dynamicBinding
        ? {
            ...attributes,
            dynamicProvider: dynamicBinding.provider,
            dynamicOptions: dynamicBinding.options.length
              ? [...new Set(dynamicBinding.options)].join(" / ")
              : "runtime-no-enumerable-estáticamente",
          }
        : attributes;
      const importInfo =
        imports.get(rootTagName) ??
        (localDeclarations.has(rootTagName)
          ? {
              importSource: "(declaración local)",
              importedName: rootTagName,
              definitionFile: sourceRelativePath,
            }
          : null);
      const classification = dynamicBinding
        ? dynamicBinding.role === "icono-dinámico"
          ? { category: "Iconografía", kind: "Icono dinámico" }
          : attributeLiteralOptions(
                catalogAttributes.role,
                ROLE_OPTIONS,
              ).has("textbox")
            ? {
                category: "Campo",
                kind: "Editor de texto enriquecido polimórfico",
              }
            : {
                category: "Estructura",
                kind: "Contenedor polimórfico",
              }
        : classifyElement(tagName, catalogAttributes, importInfo);
      const directText = extractDirectText(node, sourceFile);
      const label = inferLabel(tagName, catalogAttributes, directText);
      const handlers = extractHandlers(catalogAttributes);
      const styleSources = [
        ...new Set(
          classNames.flatMap((className) =>
            (cssIndex.get(className) ?? []).map(
              (record) => `${record.file}:${record.line}`,
            ),
          ),
        ),
      ].slice(0, 12);
      const cssStates = [
        ...new Set(
          classNames.flatMap((className) =>
            (cssIndex.get(className) ?? []).flatMap(
              (record) => record.states ?? [],
            ),
          ),
        ),
      ];
      const cssVariants = [
        ...new Set(
          classNames.flatMap((className) =>
            (cssIndex.get(className) ?? []).flatMap(
              (record) => record.variants ?? [],
            ),
          ),
        ),
      ];
      const classVariants = classNames
        .filter(isVisualVariantToken)
        .map((className) => `clase:${className}`);
      const id = sha256(
        `${sourceRelativePath}:${position.line}:${position.column}:${tagName}`,
      ).slice(0, 16);
      const states = extractStates(attributes, classNames, cssStates);

      entries.push({
        id,
        sourceType: "jsx",
        module: context.module,
        section: context.section,
        tab: context.tab,
        contextConfidence: context.confidence,
        componentContext: nearestComponent,
        category: classification.category,
        kind: classification.kind,
        tag: tagName,
        label,
        usage: usageFor(
          classification.category,
          classification.kind,
          handlers,
          condition,
        ),
        renderedWhen: condition,
        interactive:
          classification.category === "Acción" ||
          classification.category === "Campo" ||
          classification.category === "Navegación" ||
          classification.category === "Selección" ||
          handlers.length > 0,
        nativeElement:
          /^[a-z]/.test(tagName) ||
          dynamicBinding?.role === "tag-polimórfico",
        attributes: catalogAttributes,
        spreads,
        classNames,
        states,
        visualVariants: ["variant", "size"]
          .filter((key) => catalogAttributes[key] !== undefined)
          .map(
            (key) => `${key}=${cleanText(catalogAttributes[key], 80)}`,
          )
          .concat(
            dynamicBinding
              ? [
                  `provider=${cleanText(dynamicBinding.provider, 100)}`,
                  ...[...new Set(dynamicBinding.options)].map(
                    (option) =>
                      `${dynamicBinding.role === "tag-polimórfico" ? "tag-option" : "icon-option"}=${cleanText(option, 80)}`,
                  ),
                ]
              : [],
            semanticVisualVariants(tagName, catalogAttributes),
            classVariants,
            cssVariants.map((variant) => `css:${variant}`),
          ),
        stateModel: states.length
          ? "Estados explícitos en props o clases de esta ocurrencia."
          : "Sin estado explícito en esta ocurrencia; puede heredar estado del componente o de sus datos.",
        handlers,
        importSource:
          dynamicBinding
            ? "(binding dinámico local)"
            : importInfo?.importSource ?? null,
        definitionFile: importInfo?.definitionFile ?? null,
        styleSources,
        styleStates: cssStates,
        styleVariants: cssVariants,
        dynamicProviderSource: dynamicBinding
          ? {
              file: sourceRelativePath,
              line: dynamicBinding.source.line,
              column: dynamicBinding.source.column,
              provider: dynamicBinding.provider,
            }
          : null,
        renderSource: {
          file: sourceRelativePath,
          line: position.line,
          column: position.column,
          resolution: "jsx-directo",
        },
        source: {
          file: sourceRelativePath,
          line: position.line,
          column: position.column,
        },
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return {
    file: sourceRelativePath,
    sha256: sha256(source),
    entries,
  };
}

function hierarchyWithContextScopes(rawDeclarations = []) {
  return HIERARCHY.map((module) => ({
    ...module,
    sections: module.sections.map((section) => ({
      ...section,
      tabs: [
        ...new Set([
          ...section.tabs,
          ...rawDeclarations
            .filter(
              (entry) =>
                entry.module === module.module &&
                entry.section === section.id &&
                entry.kind === "Pestaña declarada" &&
                entry.tab === entry.label &&
                Boolean(
                  entry.attributes?.label ||
                    entry.attributes?.title ||
                    entry.attributes?.tabLabel,
                ),
            )
            .map((entry) => entry.label),
          TAB_SCOPE_TRANSVERSAL,
          TAB_SCOPE_MULTIPLE,
        ]),
      ],
    })),
  }));
}

function canonicalizeCatalogContext(item, hierarchy) {
  const next = { ...item };
  const module =
    hierarchy.find((candidate) => candidate.module === next.module) ??
    hierarchy.find((candidate) => candidate.module === "global");
  if (!module) return next;
  if (module.module !== next.module) {
    next.rawModule = next.module;
    next.module = module.module;
  }
  let section = module.sections.find(
    (candidate) => candidate.id === next.section,
  );
  if (!section) {
    next.rawSection = next.section;
    section =
      module.sections.find((candidate) =>
        ["compartido", "compartidos"].includes(candidate.id),
      ) ?? module.sections[0];
    next.section = section.id;
  }

  const rawTab = next.tab;
  const exactTab = section.tabs.find((candidate) => candidate === rawTab);
  const normalizedTab = section.tabs.find(
    (candidate) =>
      normalizedVocabulary(candidate) === normalizedVocabulary(rawTab),
  );
  const composite =
    typeof rawTab === "string" &&
    (rawTab.includes("/") || rawTab.includes(" / ") || rawTab.includes("·"));
  const canonicalTab =
    exactTab ??
    normalizedTab ??
    (composite ? TAB_SCOPE_MULTIPLE : TAB_SCOPE_TRANSVERSAL);
  if (canonicalTab !== rawTab) next.rawTab = rawTab ?? null;
  next.tab = canonicalTab;
  next.contextScope =
    canonicalTab === TAB_SCOPE_TRANSVERSAL
      ? "transversal"
      : canonicalTab === TAB_SCOPE_MULTIPLE
        ? "múltiple-o-dinámico"
        : "pestaña-exacta";
  next.rawContextConfidence = next.contextConfidence;
  next.contextConfidence =
    next.contextScope === "pestaña-exacta"
      ? "vocabulario-canónico"
      : `scope-${next.contextScope}`;
  next.contextBasis =
    next.contextScope === "pestaña-exacta"
      ? "Pestaña declarada en la jerarquía y fuente conservada en el registro."
      : next.contextScope === "múltiple-o-dinámico"
        ? "El elemento se comparte entre varias pestañas o su pestaña depende de datos de runtime."
        : "El elemento pertenece a la sección, pero no a una única pestaña local demostrable estáticamente.";
  return next;
}

function dynamicTemplateEntries(hierarchy) {
  return DECLARED_VISUAL_SURFACES.map((surface, index) =>
    canonicalizeCatalogContext(
      {
        id: sha256(
          `${surface.source.file}:${surface.label}:plantilla-dinamica:${index}`,
        ).slice(0, 16),
        sourceType: "plantilla-dinámica",
        module: surface.module,
        section: surface.section,
        tab: surface.tab,
        contextConfidence: "declarada-manualmente",
        componentContext: surface.label,
        category: surface.category,
        kind: surface.kind ?? "Plantilla visual dinámica",
        tag: surface.tag ?? "runtime-template",
        label: surface.label,
        detail: surface.provider ?? null,
        usage: surface.usage,
        renderedWhen:
          surface.renderedWhen ??
          "Cuando el proyecto o proveedor de datos entrega instancias compatibles.",
        interactive: surface.interactive ?? true,
        nativeElement: false,
        attributes: {
          provider:
            surface.provider ??
            "Datos del proyecto, API o librería visual en tiempo de ejecución",
          ...(surface.tag ? { runtimeTag: surface.tag } : {}),
        },
        spreads: [],
        classNames: [],
        states: surface.states ?? [
          "sin-datos",
          "cargando",
          "con-datos",
          "error",
        ],
        visualVariants: [],
        stateModel:
          "Colección no enumerable estáticamente: el catálogo documenta su plantilla, proveedor, sink y estados, sin inventar instancias.",
        handlers: [],
        importSource: null,
        definitionFile: surface.source.file,
        styleSources: [],
        declarationEvidence: "plantilla-runtime-declarada",
        ancestry: [],
        renderSource: surface.renderSource ?? surface.source,
        source: {
          file: surface.source.file,
          line: surface.source.line ?? 1,
          column: surface.source.column ?? 1,
        },
      },
      hierarchy,
    ),
  );
}

function summarize(
  entries,
  files,
  declarations,
  unresolvedDeclarations,
  declarationCandidates,
  cssGeneratedContent,
  dynamicTemplates,
  sourceFilesScanned,
  styleFilesScanned,
) {
  const visibleCatalogItems = [
    ...entries,
    ...declarations,
    ...cssGeneratedContent,
    ...dynamicTemplates,
  ];
  const catalogItems = [
    ...visibleCatalogItems,
    ...unresolvedDeclarations,
    ...declarationCandidates,
  ];
  const countBy = (key) =>
    Object.fromEntries(
      [...new Set(catalogItems.map((entry) => entry[key] ?? "(sin valor)"))]
        .sort()
        .map((value) => [
          value,
          catalogItems.filter(
            (entry) => (entry[key] ?? "(sin valor)") === value,
          ).length,
        ]),
    );

  return {
    productionJsxFiles: files.length,
    productionSourceFilesScanned: sourceFilesScanned,
    productionStyleFilesScanned: styleFilesScanned,
    filesWithVisualElements: files.filter((file) => file.entries.length > 0).length,
    sourceOccurrences: entries.length,
    declaredElements: declarations.length,
    unresolvedDeclarations: unresolvedDeclarations.length,
    declarationCandidates: declarationCandidates.length,
    cssGeneratedContent: cssGeneratedContent.length,
    dynamicTemplates: dynamicTemplates.length,
    catalogItems: catalogItems.length,
    interactiveOccurrences: entries.filter((entry) => entry.interactive).length,
    interactiveCatalogItems: visibleCatalogItems.filter(
      (entry) => entry.interactive,
    ).length,
    nativeOccurrences: entries.filter((entry) => entry.nativeElement).length,
    customComponentOccurrences: entries.filter((entry) => !entry.nativeElement).length,
    byModule: countBy("module"),
    byCategory: countBy("category"),
    byKind: countBy("kind"),
  };
}

function buildCatalog() {
  const cssAudit = buildCssIndex();
  const cssIndex = cssAudit.index;
  const jsxFiles = walkFiles(FRONTEND_ROOT, isProductionJsxFile);
  const files = jsxFiles.map((file) => scanJsxFile(file, cssIndex));
  const declarationSourceFiles = walkFiles(
    FRONTEND_ROOT,
    isProductionDeclarationSourceFile,
  );
  const externalUiUsageIndex = buildExternalUiUsageIndex(
    declarationSourceFiles,
  );
  const declarationScans = declarationSourceFiles.map((file) =>
    scanDeclarationFile(file, externalUiUsageIndex),
  );
  const rawEntries = files
    .flatMap((file) => file.entries)
    .sort(
      (a, b) =>
        a.source.file.localeCompare(b.source.file) ||
        a.source.line - b.source.line ||
        a.source.column - b.source.column,
    );
  const rawDeclarations = declarationScans
    .flatMap((file) => file.declarations)
    .sort(
      (a, b) =>
        a.source.file.localeCompare(b.source.file) ||
        a.source.line - b.source.line ||
        a.source.column - b.source.column ||
        a.label.localeCompare(b.label, "es"),
    );
  const rawResolvedDeclarations = rawDeclarations.filter(
    (entry) =>
      !entry.renderSource?.resolution?.includes("no resuelto"),
  );
  const rawUnresolvedDeclarations = rawDeclarations.filter((entry) =>
    entry.renderSource?.resolution?.includes("no resuelto"),
  );
  const rawDeclarationCandidates = declarationScans
    .flatMap((file) => file.candidateLedger)
    .sort(
      (a, b) =>
        a.source.file.localeCompare(b.source.file) ||
        a.source.line - b.source.line ||
        a.source.column - b.source.column,
    );
  const hierarchy = hierarchyWithContextScopes(rawResolvedDeclarations);
  const entries = rawEntries.map((entry) =>
    canonicalizeCatalogContext(entry, hierarchy),
  );
  const declarations = rawResolvedDeclarations.map((entry) =>
    canonicalizeCatalogContext(entry, hierarchy),
  );
  const unresolvedDeclarations = rawUnresolvedDeclarations.map((entry) =>
    canonicalizeCatalogContext(
      {
        ...entry,
        sourceType: "declaración-sin-sink-resuelto",
        potentiallyInteractive: entry.interactive,
        interactive: false,
        visibilityStatus: "candidato-no-confirmado",
        usage:
          `Candidato visual conservado para auditoría; no se encontró un consumidor estático que confirme su render. ${entry.usage}`,
        renderedWhen:
          "Consumidor visual no resuelto estáticamente; puede cargarse de forma indirecta, pertenecer a una ruta futura o ser configuración no visual.",
      },
      hierarchy,
    ),
  );
  const declarationCandidates = rawDeclarationCandidates.map((entry) =>
    canonicalizeCatalogContext(entry, hierarchy),
  );
  const cssGeneratedContent = cssAudit.generatedContent.map((entry) =>
    canonicalizeCatalogContext(entry, hierarchy),
  );
  const dynamicTemplates = dynamicTemplateEntries(hierarchy);
  const declarationAudit = declarationScans.reduce(
    (audit, file) => {
      audit.candidates += file.candidateAudit.candidates;
      audit.expanded += file.candidateAudit.expanded;
      audit.ignored += file.candidateAudit.ignored;
      audit.ledgered += file.candidateAudit.ledgered;
      for (const [disposition, count] of Object.entries(
        file.candidateAudit.dispositions,
      )) {
        audit.dispositions[disposition] =
          (audit.dispositions[disposition] ?? 0) + count;
      }
      return audit;
    },
    {
      candidates: 0,
      expanded: 0,
      ignored: 0,
      ledgered: 0,
      dispositions: {},
      dynamicTemplates: dynamicTemplates.length,
      unresolved: unresolvedDeclarations.length,
      ignoredReason:
        "Todo candidato no expandido se publica en el ledger individual; su disposición no se confunde con visibilidad confirmada.",
    },
  );
  const sourceSnapshotHash = sha256(
    [
      ...declarationScans.map((file) => `${file.file}:${file.sha256}`),
      ...cssAudit.files.map((file) => `${file.file}:${file.sha256}`),
    ].join("\n"),
  );

  return {
    schemaVersion: 2,
    catalogLanguage: "es-PE",
    title: "Catálogo visual real de Prosecnur",
    purpose:
      "Censo descriptivo de la implementación actual. Registra variantes sin unificarlas.",
    hierarchyVocabulary: ["módulo", "sección", "pestaña"],
    sourceSnapshotHash,
    coverage: {
      root: "frontend/src",
      extensions: [".ts", ".tsx", ".js", ".jsx", ".css"],
      exclusions: [
        "*.test.*",
        "*.spec.*",
        "__tests__/**",
        "__mocks__/**",
        "__snapshots__/**",
      ],
      unit:
        "ocurrencia JSX, elemento visible declarado en registros/arrays, contenido generado por CSS, plantilla visual dinámica o candidato declarativo individualizado de código productivo",
      limitations: [
        "Una ocurrencia dentro de un map representa el patrón visual, no cada fila de datos en runtime.",
        "Las opciones literales declaradas fuera del JSX se registran individualmente cuando el array se consume desde JSX o tiene semántica explícita de UI.",
        "Canvas, Plotly y SVG generados por librerías se registran por su componente anfitrión y sus nodos JSX declarados.",
        "La asignación de pestaña puede ser heurística cuando el mismo componente compartido se usa en varios contextos.",
        "Los registros con sourceType auditoría-candidato conservan copy potencialmente visual sin afirmar que llegue a renderizarse.",
      ],
    },
    modules: MODULES,
    hierarchy,
    declaredVisualSurfaces: DECLARED_VISUAL_SURFACES,
    declarationAudit,
    categoryDescriptions: CATEGORY_DESCRIPTIONS,
    summary: summarize(
      entries,
      files,
      declarations,
      unresolvedDeclarations,
      declarationCandidates,
      cssGeneratedContent,
      dynamicTemplates,
      declarationSourceFiles.length,
      cssAudit.files.length,
    ),
    files: files.map(({ file, sha256: fileHash, entries: fileEntries }) => ({
      file,
      sha256: fileHash,
      occurrences: fileEntries.length,
    })),
    sourceFiles: declarationScans.map(
      ({ file, sha256: fileHash, candidateAudit }) => ({
        file,
        sha256: fileHash,
        candidateAudit,
      }),
    ),
    styleFiles: cssAudit.files,
    declarationFiles: declarationScans
      .filter((file) => file.declarations.length > 0)
      .map(({ file, sha256: fileHash, declarations: fileDeclarations }) => ({
        file,
        sha256: fileHash,
        declarations: fileDeclarations.length,
        resolved: fileDeclarations.filter(
          (entry) =>
            !entry.renderSource?.resolution?.includes("no resuelto"),
        ).length,
        unresolved: fileDeclarations.filter((entry) =>
          entry.renderSource?.resolution?.includes("no resuelto"),
        ).length,
      })),
    entries,
    declarations,
    unresolvedDeclarations,
    declarationCandidates,
    cssGeneratedContent,
    dynamicTemplates,
  };
}

function stableJson(value) {
  return `${JSON.stringify(value)}\n`;
}

function catalogDataScript(jsonText) {
  const compressed = gzipSync(Buffer.from(jsonText), { level: 9 }).toString(
    "base64",
  );
  const chunks = compressed.match(/.{1,120000}/g) ?? [];
  return `/* GENERATED by scripts/build-visual-catalog.mjs. DO NOT EDIT. */
window.__PROSECNUR_VISUAL_CATALOG_PROMISE__=(async function(){
  var payload=${JSON.stringify(chunks)}.join("");
  var binary=atob(payload);
  var bytes=new Uint8Array(binary.length);
  for(var index=0;index<binary.length;index+=1)bytes[index]=binary.charCodeAt(index);
  var stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  var json=await new Response(stream).text();
  return JSON.parse(json);
})();
`;
}

function buildManualCatalogSection() {
  return `${MANUAL_START}
<section class="bb-ch" id="catalogo-real">
<style>
#catalogo-real{--cv-accent:var(--bk-navy);color:var(--bk-ink)}
.cv-head{display:grid;gap:8px;margin-bottom:24px}
.cv-head h2{margin:0;color:var(--bk-navy);font-size:28px;letter-spacing:-.02em}
.cv-head p{max-width:900px;margin:0;color:var(--bk-ink-soft);font-size:14px;line-height:1.6}
.cv-meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin:20px 0}
.cv-stat{padding:12px;border:1px solid var(--bk-border);border-radius:var(--bk-radius-card);background:var(--bk-paper)}
.cv-stat strong{display:block;color:var(--bk-navy);font-size:22px;font-variant-numeric:tabular-nums}
.cv-stat span{display:block;margin-top:3px;color:var(--bk-ink-soft);font-size:11px}
.cv-controls{position:sticky;top:46px;z-index:40;display:grid;grid-template-columns:minmax(220px,2fr) repeat(5,minmax(120px,1fr));gap:8px;padding:12px;border:1px solid var(--bk-border);border-radius:var(--bk-radius-panel);background:rgba(255,255,255,.94);box-shadow:var(--bk-shadow-soft);backdrop-filter:blur(14px)}
.cv-controls input,.cv-controls select{width:100%;height:32px;border:1px solid var(--bk-border-strong);border-radius:10px;background:var(--bk-paper);color:var(--bk-ink);font:inherit;font-size:12px;padding:0 10px}
.cv-controls :focus-visible{outline:none;box-shadow:0 0 0 3px var(--bk-focus)}
.cv-hierarchy{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;margin:16px 0 24px}
.cv-module{border:1px solid var(--bk-border);border-top:3px solid var(--cv-module-accent,var(--bk-navy));border-radius:var(--bk-radius-card);background:var(--bk-paper);padding:12px}
.cv-module h3{margin:0 0 8px;font-size:14px}
.cv-module details{border-top:1px solid var(--bk-border);padding:7px 0}
.cv-module summary{cursor:pointer;font-size:12px;font-weight:600}
.cv-module ul{margin:6px 0 0;padding-left:18px;color:var(--bk-ink-soft);font-size:11px}
.cv-dynamic{margin:0 0 24px}
.cv-dynamic h3{margin:0 0 4px;color:var(--bk-navy);font-size:17px}
.cv-dynamic>p{margin:0 0 10px;color:var(--bk-ink-soft);font-size:12px}
.cv-dynamic-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:8px}
.cv-dynamic-card{border:1px solid var(--bk-border);border-radius:var(--bk-radius-card);background:var(--bk-paper);padding:11px}
.cv-dynamic-card strong,.cv-dynamic-card small{display:block}
.cv-dynamic-card p{margin:6px 0;color:var(--bk-ink-soft);font-size:11px;line-height:1.45}
.cv-results{margin:12px 0 8px;color:var(--bk-ink-soft);font-size:12px}
.cv-table-wrap{overflow:auto;max-height:72vh;border:1px solid var(--bk-border);border-radius:var(--bk-radius-panel);background:var(--bk-paper)}
.cv-table{width:100%;min-width:1220px;border-collapse:separate;border-spacing:0;font-size:11px}
.cv-table th{position:sticky;top:0;z-index:2;padding:9px 8px;border-bottom:1px solid var(--bk-border-strong);background:var(--bk-ice);color:var(--bk-ink-soft);text-align:left;text-transform:uppercase;letter-spacing:.04em}
.cv-table td{padding:8px;border-bottom:1px solid var(--bk-border);vertical-align:top}
.cv-table tr:hover td{background:var(--bk-mist)}
.cv-source{font-family:var(--bk-mono);font-size:10px;color:var(--bk-navy)}
.cv-label{font-weight:600;color:var(--bk-ink)}
.cv-path{display:block;max-width:280px;white-space:normal;overflow-wrap:anywhere}
.cv-chip{display:inline-flex;align-items:center;min-height:20px;padding:0 7px;border:1px solid var(--bk-border);border-radius:999px;background:var(--bk-ice);font-size:10px;white-space:nowrap}
.cv-pagination{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:10px}
.cv-pagination button{height:28px;padding:0 12px;border:1px solid var(--bk-border-strong);border-radius:10px;background:var(--bk-paper);color:var(--bk-ink);font:inherit;font-size:12px;cursor:pointer}
.cv-pagination button:disabled{opacity:.45;cursor:not-allowed}
.cv-empty{padding:28px;text-align:center;color:var(--bk-ink-soft)}
@media(max-width:900px){.cv-meta{grid-template-columns:repeat(2,minmax(0,1fr))}.cv-controls{position:static;grid-template-columns:1fr 1fr}.cv-controls input{grid-column:1/-1}}
@media(max-width:560px){.cv-meta,.cv-controls{grid-template-columns:1fr}}
</style>
  <div class="bb-wrap">
    <div class="cv-head">
      <span class="bb-ch-num">11 · Catálogo visual real</span>
      <h2>Todo lo que la aplicación dibuja hoy</h2>
      <p>Inventario descriptivo —no normativo— de cada ocurrencia JSX productiva, cada variante visible declarada en arrays, tuplas, records o factories de interfaz y cada colección visual que solo puede materializarse con datos de runtime. Conserva las diferencias actuales para que una sesión posterior pueda compararlas y unificarlas con evidencia. La procedencia siempre sigue <strong>módulo → sección → pestaña</strong> e incluye archivo, línea, componente o registro, condición de uso, estados y fuente visual.</p>
      <p class="bb-spec">Fuente generada: <code>branding/catalogo-visual/data/catalogo.json</code>. Un elemento repetido por datos se registra como patrón de render y como <em>plantilla dinámica</em>; sus labels literales se enumeran individualmente cuando existen en el código. Las declaraciones con copy visual pero sin consumidor demostrable se preservan en una capa de <em>candidatos sin sink resuelto</em>: siguen siendo consultables, pero no se presentan como interfaz confirmada. El texto y los símbolos creados exclusivamente mediante <code>content:</code> se registran como <em>contenido generado por CSS</em>. Los elementos transversales usan <code>Transversal / sin pestaña local</code> o <code>Varias pestañas / contexto dinámico</code>, nunca una pestaña inventada. Índice humano: <a href="catalogo-visual/docs/inventario-contextual.md">inventario-contextual.md</a>.</p>
    </div>
    <div class="cv-meta" id="cv-meta" aria-live="polite"></div>
    <div class="cv-hierarchy" id="cv-hierarchy"></div>
    <div class="cv-dynamic">
      <h3>Superficies dinámicas y condicionales</h3>
      <p>Registro complementario de mapas, Plotly, SVG, canvas, QR y documentos cuyo contenido final no aparece completo como nodos JSX estáticos.</p>
      <div class="cv-dynamic-grid" id="cv-dynamic-grid"></div>
    </div>
    <div class="cv-controls" aria-label="Filtros del catálogo visual">
      <input id="cv-search" type="search" placeholder="Buscar label, componente, clase o archivo" aria-label="Buscar en el catálogo visual">
      <select id="cv-module" aria-label="Filtrar por módulo"><option value="">Todos los módulos</option></select>
      <select id="cv-section" aria-label="Filtrar por sección"><option value="">Todas las secciones</option></select>
      <select id="cv-tab" aria-label="Filtrar por pestaña"><option value="">Todas las pestañas</option></select>
      <select id="cv-category" aria-label="Filtrar por categoría"><option value="">Todas las categorías</option></select>
      <select id="cv-origin" aria-label="Filtrar por origen"><option value="">Todos los orígenes</option><option value="jsx">Solo JSX</option><option value="declaración">Solo declaraciones confirmadas</option><option value="declaración-sin-sink-resuelto">Solo declaraciones sin sink</option><option value="auditoría-candidato">Solo ledger de candidatos</option><option value="contenido-generado-css">Solo contenido generado por CSS</option><option value="plantilla-dinámica">Solo plantillas dinámicas</option></select>
    </div>
    <p class="cv-results" id="cv-results" aria-live="polite"></p>
    <div class="cv-table-wrap" tabindex="0" aria-label="Inventario exhaustivo de elementos visuales">
      <table class="cv-table">
        <thead><tr><th>Módulo · sección · pestaña</th><th>Categoría</th><th>Elemento</th><th>Label / contenido</th><th>Uso y estado</th><th>Declaración / render</th><th>Fuente visual</th></tr></thead>
        <tbody id="cv-body"></tbody>
      </table>
    </div>
    <div class="cv-pagination">
      <button type="button" id="cv-prev">Anterior</button>
      <span id="cv-page" class="bb-spec"></span>
      <button type="button" id="cv-next">Siguiente</button>
    </div>
  </div>
</section>
<script src="catalogo-visual/data/catalogo-data.js"></script>
<script>
(function(){
  "use strict";
  var body=document.getElementById("cv-body");
  if(!body)return;
  var catalogPromise=window.__PROSECNUR_VISUAL_CATALOG_PROMISE__;
  if(!catalogPromise){body.innerHTML='<tr><td colspan="7" class="cv-empty">No se pudo cargar catalogo-visual/data/catalogo-data.js.</td></tr>';return;}
  catalogPromise.then(function(catalog){
  var catalogItems=(catalog.entries||[]).concat(catalog.declarations||[],catalog.unresolvedDeclarations||[],catalog.declarationCandidates||[],catalog.cssGeneratedContent||[],catalog.dynamicTemplates||[]);
  var state={page:0,size:120,rows:catalogItems.slice()};
  var els={
    search:document.getElementById("cv-search"),module:document.getElementById("cv-module"),
    section:document.getElementById("cv-section"),tab:document.getElementById("cv-tab"),
    category:document.getElementById("cv-category"),origin:document.getElementById("cv-origin"),results:document.getElementById("cv-results"),
    prev:document.getElementById("cv-prev"),next:document.getElementById("cv-next"),page:document.getElementById("cv-page")
  };
  function esc(value){return String(value==null?"":value).replace(/[&<>"']/g,function(ch){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]})}
  function options(select,values,label){select.innerHTML='<option value="">'+label+'</option>'+values.map(function(value){return '<option value="'+esc(value)+'">'+esc(value)+'</option>'}).join("")}
  function uniq(values){return Array.from(new Set(values.filter(Boolean))).sort(function(a,b){return String(a).localeCompare(String(b),"es")})}
  options(els.module,catalog.modules.map(function(item){return item.id}),"Todos los módulos");
  options(els.category,Object.keys(catalog.summary.byCategory),"Todas las categorías");
  function syncDependentOptions(){
    var scoped=catalogItems.filter(function(row){return !els.module.value||row.module===els.module.value});
    var oldSection=els.section.value,oldTab=els.tab.value;
    options(els.section,uniq(scoped.map(function(row){return row.section})),"Todas las secciones");
    if(Array.from(els.section.options).some(function(o){return o.value===oldSection}))els.section.value=oldSection;
    scoped=scoped.filter(function(row){return !els.section.value||row.section===els.section.value});
    options(els.tab,uniq(scoped.map(function(row){return row.tab})),"Todas las pestañas");
    if(Array.from(els.tab.options).some(function(o){return o.value===oldTab}))els.tab.value=oldTab;
  }
  function filterRows(){
    syncDependentOptions();
    var query=els.search.value.trim().toLowerCase();
    state.rows=catalogItems.filter(function(row){
      if(els.module.value&&row.module!==els.module.value)return false;
      if(els.section.value&&row.section!==els.section.value)return false;
      if(els.tab.value&&row.tab!==els.tab.value)return false;
      if(els.category.value&&row.category!==els.category.value)return false;
      if(els.origin.value&&row.sourceType!==els.origin.value)return false;
      if(!query)return true;
      return [row.label,row.detail,row.tag,row.kind,row.category,row.source.file,row.componentContext,row.renderedWhen,(row.classNames||[]).join(" ")].join(" ").toLowerCase().includes(query);
    });
    state.page=0;render();
  }
  function render(){
    var pages=Math.max(1,Math.ceil(state.rows.length/state.size));
    state.page=Math.max(0,Math.min(state.page,pages-1));
    var start=state.page*state.size,visible=state.rows.slice(start,start+state.size);
    body.innerHTML=visible.length?visible.map(function(row){
      var context=[row.module,row.section,row.tab].filter(Boolean).map(esc).join(" → ");
      var states=(row.states||[]).slice(0,4).map(function(s){return '<span class="cv-chip">'+esc(s)+'</span>'}).join(" ");
      var variants=(row.visualVariants||[]).slice(0,3).map(function(s){return '<span class="cv-chip">'+esc(s)+'</span>'}).join(" ");
      var styles=(row.styleSources||[]).slice(0,3).map(function(s){return '<span class="cv-source cv-path">'+esc(s)+"</span>"}).join("");
      var renderSource=row.renderSource||row.source;
      var renderMeta=renderSource?'<small class="cv-path">render: '+esc(renderSource.file)+":"+esc(renderSource.line||"—")+(renderSource.resolution?" · "+esc(renderSource.resolution):"")+"</small>":"";
      var provider=row.dynamicProviderSource?'<small class="cv-path">proveedor: '+esc(row.dynamicProviderSource.file)+":"+esc(row.dynamicProviderSource.line)+" · "+esc(row.dynamicProviderSource.provider)+"</small>":"";
      return '<tr data-cv-id="'+esc(row.id)+'"><td>'+context+'<small class="cv-path">'+esc(row.componentContext)+'</small><small class="cv-path">'+esc(row.contextBasis||"")+'</small></td><td><span class="cv-chip">'+esc(row.category)+'</span><br>'+esc(row.kind)+'</td><td><span class="cv-chip">'+esc(row.sourceType||"jsx")+'</span><br><code>'+esc(row.tag)+'</code><small class="cv-path">'+esc((row.classNames||[]).join(" · "))+'</small></td><td><span class="cv-label">'+esc(row.label)+'</span>'+(row.detail?'<small class="cv-path">'+esc(row.detail)+'</small>':"")+'</td><td>'+esc(row.usage)+'<small class="cv-path">'+esc(row.renderedWhen)+'</small><div>'+states+variants+'</div>'+(states? "":'<small class="cv-path">'+esc(row.stateModel||"Sin estado explícito")+'</small>')+'</td><td><span class="cv-source cv-path">'+esc(row.source.file)+":"+row.source.line+":"+row.source.column+"</span>"+renderMeta+provider+(row.definitionFile&&row.definitionFile!==row.source.file?'<small class="cv-path">define: '+esc(row.definitionFile)+'</small>':"")+"</td><td>"+(styles||'<small>'+(String(row.sourceType||"").indexOf("declaración")===0?"estilo del componente consumidor":"inline / herencia / sin clase resuelta")+'</small>')+"</td></tr>";
    }).join(""):'<tr><td colspan="7" class="cv-empty">No hay elementos para estos filtros.</td></tr>';
    els.results.textContent=state.rows.length.toLocaleString("es-PE")+" elementos · mostrando "+(visible.length?start+1:0)+"–"+(start+visible.length);
    els.page.textContent="Página "+(state.page+1)+" de "+pages;
    els.prev.disabled=state.page===0;els.next.disabled=state.page>=pages-1;
  }
  [els.search,els.module,els.section,els.tab,els.category,els.origin].forEach(function(el){el.addEventListener(el===els.search?"input":"change",filterRows)});
  els.prev.addEventListener("click",function(){state.page-=1;render()});
  els.next.addEventListener("click",function(){state.page+=1;render()});
  var summary=catalog.summary,meta=document.getElementById("cv-meta");
  meta.innerHTML=[
    [summary.sourceOccurrences,"ocurrencias JSX"],
    [summary.declaredElements,"declaraciones visibles"],
    [summary.declarationCandidates,"ledger de candidatos"],
    [summary.dynamicTemplates,"plantillas dinámicas"],
    [summary.interactiveCatalogItems,"interactivas"],
    [summary.productionSourceFilesScanned,"fuentes productivas"],
    [summary.productionStyleFilesScanned,"hojas CSS"],
    [Object.keys(summary.byModule).length,"ámbitos/módulos"]
  ].map(function(item){return '<div class="cv-stat"><strong>'+Number(item[0]).toLocaleString("es-PE")+'</strong><span>'+item[1]+'</span></div>'}).join("");
  var hierarchy=document.getElementById("cv-hierarchy");
  hierarchy.innerHTML=catalog.hierarchy.map(function(module){
    var moduleMeta=catalog.modules.find(function(item){return item.id===module.module})||{};
    return '<article class="cv-module" style="--cv-module-accent:'+esc(moduleMeta.accent||"#002457")+'"><h3>'+esc(moduleMeta.label||module.module)+'</h3>'+module.sections.map(function(section){return '<details><summary>'+esc(section.label)+'</summary><ul>'+((section.tabs||[]).length?section.tabs.map(function(tab){return '<li>'+esc(tab)+'</li>'}).join(""):'<li>Sin pestañas locales declaradas</li>')+'</ul></details>'}).join("")+'</article>';
  }).join("");
  var dynamicGrid=document.getElementById("cv-dynamic-grid");
  dynamicGrid.innerHTML=(catalog.declaredVisualSurfaces||[]).map(function(item){
    return '<article class="cv-dynamic-card"><small>'+[item.module,item.section,item.tab].filter(Boolean).map(esc).join(" → ")+'</small><strong>'+esc(item.label)+'</strong><p>'+esc(item.usage)+'</p><span class="cv-source cv-path">'+esc(item.source.file)+'</span></article>';
  }).join("");
  syncDependentOptions();render();
  window.dispatchEvent(new Event("scroll"));
  }).catch(function(error){
    body.innerHTML='<tr><td colspan="7" class="cv-empty">No se pudo descomprimir el catálogo: '+String(error&&error.message||error)+'</td></tr>';
  });
})();
</script>
${MANUAL_END}`;
}

function updateManual(currentManual) {
  const section = buildManualCatalogSection();
  let next = currentManual;
  if (next.includes(MANUAL_START) && next.includes(MANUAL_END)) {
    const start = next.indexOf(MANUAL_START);
    const end = next.indexOf(MANUAL_END) + MANUAL_END.length;
    next = `${next.slice(0, start)}${section}${next.slice(end)}`;
  } else {
    const footerIndex = next.indexOf("<footer class=\"bb-foot\">");
    if (footerIndex < 0) {
      throw new Error("No se encontró el footer del manual para insertar el catálogo.");
    }
    next = `${next.slice(0, footerIndex)}${section}\n\n${next.slice(footerIndex)}`;
  }
  if (!next.includes('<a href="#catalogo-real">11 Catálogo real</a>')) {
    next = next.replace(
      '    <a href="#adopcion">10 Adopción</a>',
      '    <a href="#adopcion">10 Adopción</a>\n    <a href="#catalogo-real">11 Catálogo real</a>',
    );
  }
  return next;
}

function compareOrWrite(file, expected) {
  if (CHECK_MODE) {
    if (!fs.existsSync(file)) {
      throw new Error(`Falta artefacto generado: ${relativePath(file)}`);
    }
    const actual = fs.readFileSync(file, "utf8");
    if (actual !== expected) {
      throw new Error(`Artefacto desactualizado: ${relativePath(file)}`);
    }
    return;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, expected);
}

function main() {
  const catalog = buildCatalog();
  const json = stableJson(catalog);
  const dataScript = catalogDataScript(json);
  const currentManual = fs.readFileSync(MANUAL_PATH, "utf8");
  const nextManual = updateManual(currentManual);

  compareOrWrite(OUTPUT_JSON, json);
  compareOrWrite(OUTPUT_JS, dataScript);
  compareOrWrite(MANUAL_PATH, nextManual);

  const mode = CHECK_MODE ? "CHECK" : "WRITE";
  process.stdout.write(
    [
      `${mode} catálogo visual: OK`,
      `archivos TSX/JSX: ${catalog.summary.productionJsxFiles}`,
      `fuentes productivas: ${catalog.summary.productionSourceFilesScanned}`,
      `hojas CSS: ${catalog.summary.productionStyleFilesScanned}`,
      `ocurrencias JSX: ${catalog.summary.sourceOccurrences}`,
      `declaraciones visibles: ${catalog.summary.declaredElements}`,
      `candidatos sin sink resuelto: ${catalog.summary.unresolvedDeclarations}`,
      `candidatos individualizados en ledger: ${catalog.summary.declarationCandidates}`,
      `contenidos generados por CSS: ${catalog.summary.cssGeneratedContent}`,
      `plantillas dinámicas: ${catalog.summary.dynamicTemplates}`,
      `interactivas catalogadas: ${catalog.summary.interactiveCatalogItems}`,
      `snapshot: ${catalog.sourceSnapshotHash}`,
    ].join("\n") + "\n",
  );
}

main();
