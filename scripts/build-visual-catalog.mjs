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
const OUTPUT_JSON = path.join(OUTPUT_DIR, "catalogo.json");
const OUTPUT_JS = path.join(OUTPUT_DIR, "catalogo-data.js");
const MANUAL_PATH = path.join(REPO_ROOT, "branding", "manual-identidad.html");
const MANUAL_START = "<!-- VISUAL_CATALOG:START -->";
const MANUAL_END = "<!-- VISUAL_CATALOG:END -->";
const CHECK_MODE = process.argv.includes("--check");

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
    accent: "#7C3AED",
    aliases: ["calcMuestra", "muestra", "aulasFlow"],
  },
  {
    id: "formularios",
    label: "Editor de formularios",
    accent: "#6D5DFC",
    aliases: ["xlsformEditor"],
  },
  {
    id: "hojas-ruta",
    label: "Hojas de ruta",
    accent: "#C2410C",
    aliases: ["hojasRuta"],
  },
  {
    id: "fichas-qr",
    label: "Fichas QR",
    accent: "#0891B2",
    aliases: ["recopiladores"],
  },
  {
    id: "monitoreo",
    label: "Monitoreo",
    accent: "#BE123C",
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
    accent: "#2563EB",
    aliases: ["dashboard"],
  },
  {
    id: "enciclopedia",
    label: "Enciclopedia",
    accent: "#A16207",
    aliases: ["enciclopedia"],
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
    module: "fichas-qr",
    sections: [
      { id: "preparacion", label: "Preparación", tabs: ["Agenda", "Enlaces"] },
      {
        id: "fichas",
        label: "Fichas",
        tabs: ["Vista previa", "Lista"],
      },
      {
        id: "paquete",
        label: "Paquete",
        tabs: ["PDF final", "Monitoreo"],
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
          "Reconciliación",
          "Duración",
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
      { id: "carga", label: "Carga", tabs: ["Preparar", "Ver base"] },
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
  {
    module: "enciclopedia",
    sections: [
      {
        id: "enciclopedia",
        label: "Enciclopedia metodológica",
        tabs: ["Catálogo", "Glosario", "Comparador", "Estudios", "Tipos"],
      },
      {
        id: "ficha",
        label: "Ficha metodológica",
        tabs: [
          "Definición",
          "Fórmulas",
          "Parámetros",
          "Decisiones",
          "Aplicaciones",
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
    "fichas-qr",
    "fichas",
    "Vista previa",
    "Código QR generado",
    "Bitmap asíncrono embebido como data URL, con estados cargando, generado, fallido y sin enlace.",
    "frontend/src/features/recopiladores/RecopiladoresPage.tsx",
  ),
  surface(
    "fichas-qr",
    "paquete",
    "PDF final",
    "Documento paginado imprimible",
    "Portada y fichas por facultad con bloques ocultos en pantalla y visibles al imprimir.",
    "frontend/src/features/recopiladores/RecopiladoresPage.tsx",
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
  rule(/features\/recopiladores\//, "fichas-qr", "preparacion", null),
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
  rule(/features\/enciclopedia\//, "enciclopedia", "enciclopedia", null),
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

function buildCssIndex() {
  const index = new Map();
  const cssFiles = walkFiles(
    FRONTEND_ROOT,
    (file) => file.endsWith(".css") && !file.endsWith(".min.css"),
  );
  const classPattern = /\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g;
  for (const file of cssFiles) {
    const source = fs.readFileSync(file, "utf8");
    const lineStarts = computeLineStarts(source);
    for (const match of source.matchAll(classPattern)) {
      const className = match[1];
      const sourceLine = lineAndColumn(lineStarts, match.index ?? 0).line;
      const record = { file: relativePath(file), line: sourceLine };
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
  }
  return index;
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
  const normalized = String(value)
    .replace(/\s+/g, " ")
    .replace(/^["'`]|["'`]$/g, "")
    .trim();
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
  const next = { ...context };

  if (context.module === "hojas-ruta") {
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

  if (context.module === "fichas-qr") {
    const sectionMap = {
      prep: "preparacion",
      preparacion: "preparacion",
      agenda: "preparacion",
      enlace: "preparacion",
      ficha: "fichas",
      preview: "fichas",
      paquete: "paquete",
      pdf: "paquete",
      monitoreo: "paquete",
    };
    for (const [needle, section] of Object.entries(sectionMap)) {
      if (haystack.includes(needle)) next.section = section;
    }
    const tabMap = {
      agenda: "Agenda",
      enlace: "Enlaces",
      preview: "Vista previa",
      vista: "Vista previa",
      listado: "Lista",
      lista: "Lista",
      pdf: "PDF final",
      retorno: "Monitoreo",
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
      if (haystack.includes(needle.toLowerCase())) {
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
    const profile = context.section.split("-")[0];
    for (const [suffix, pattern] of sectionNeedles) {
      if (pattern.test(haystack)) {
        const candidate = `${profile}-${suffix}`;
        const valid = HIERARCHY.find((item) => item.module === "monitoreo")
          ?.sections.some((section) => section.id === candidate);
        if (valid) next.section = candidate;
      }
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
      if (haystack.includes(needle.toLowerCase())) next.tab = tab;
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
      if (haystack.includes(needle.toLowerCase())) next.tab = tab;
    }
  }

  if (context.module === "dashboard") {
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
    for (const [needle, tab] of Object.entries(dashboardTabs)) {
      if (haystack.includes(needle.toLowerCase())) next.tab = tab;
    }
  }

  return next;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function isIconComponent(tagName, importInfo) {
  if (/^(?:Icon[A-Z]|Lucide|svg$|path$|g$|rect$|circle$|line$|polyline$|polygon$)/.test(tagName)) {
    return true;
  }
  const source = importInfo?.importSource ?? "";
  return /lucide|\/icons(?:\.|$)/i.test(source);
}

function classifyElement(tagName, attributes, importInfo) {
  const lowerTag = tagName.toLowerCase();
  const role = String(attributes.role ?? "").toLowerCase();
  const inputType = String(attributes.type ?? "text").toLowerCase();
  const joined = `${tagName} ${attributes.className ?? ""} ${role}`.toLowerCase();

  if (isIconComponent(tagName, importInfo)) {
    return { category: "Iconografía", kind: "Icono" };
  }
  if (role === "switch" || /switch|toggle/.test(joined)) {
    return { category: "Selección", kind: "Switcher" };
  }
  if (role === "checkbox" || /checkbox/.test(joined)) {
    return { category: "Selección", kind: "Checkbox" };
  }
  if (role === "radio" || /radiogroup|radio-group/.test(joined)) {
    return { category: "Selección", kind: "Radio" };
  }
  if (
    role === "tab" ||
    /(?:^|[\s_-])tabs?(?:$|[\s_-])/.test(joined)
  ) {
    return { category: "Navegación", kind: "Pestaña" };
  }
  if (lowerTag === "button" || /button|btn|action/.test(joined)) {
    return { category: "Acción", kind: "Botón" };
  }
  if (lowerTag === "input") {
    if (inputType === "checkbox") return { category: "Selección", kind: "Checkbox" };
    if (inputType === "radio") return { category: "Selección", kind: "Radio" };
    if (inputType === "range") return { category: "Campo", kind: "Slider" };
    if (inputType === "file") return { category: "Campo", kind: "Selector de archivo" };
    if (inputType === "search") return { category: "Campo", kind: "Campo de búsqueda" };
    if (inputType === "number") return { category: "Campo", kind: "Campo numérico" };
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
    role === "dialog" ||
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
    ["alert", "status", "progressbar"].includes(role)
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

function extractStates(attributes, classNames) {
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
    "variant",
    "size",
  ];
  for (const key of stateProps) {
    if (attributes[key] !== undefined) {
      states.push(`${key}=${cleanText(attributes[key], 80)}`);
    }
  }
  for (const className of classNames) {
    if (/^(?:is|has)-/.test(className)) states.push(`clase:${className}`);
  }
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

function scanJsxFile(file, cssIndex) {
  const source = fs.readFileSync(file, "utf8");
  const sourceRelativePath = relativePath(file);
  const sourceFile = ts.createSourceFile(
    sourceRelativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".jsx") ? ts.ScriptKind.JSX : ts.ScriptKind.TSX,
  );
  const imports = buildImportIndex(sourceFile, file);
  const lineStarts = computeLineStarts(source);
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
      const importInfo = imports.get(tagName.split(".")[0]) ?? null;
      const classification = classifyElement(tagName, attributes, importInfo);
      const directText = extractDirectText(node, sourceFile);
      const label = inferLabel(tagName, attributes, directText);
      const handlers = extractHandlers(attributes);
      const styleSources = [
        ...new Set(
          classNames.flatMap((className) =>
            (cssIndex.get(className) ?? []).map(
              (record) => `${record.file}:${record.line}`,
            ),
          ),
        ),
      ].slice(0, 12);
      const id = sha256(
        `${sourceRelativePath}:${position.line}:${position.column}:${tagName}`,
      ).slice(0, 16);

      entries.push({
        id,
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
        nativeElement: /^[a-z]/.test(tagName),
        attributes,
        spreads,
        classNames,
        states: extractStates(attributes, classNames),
        handlers,
        importSource: importInfo?.importSource ?? null,
        definitionFile: importInfo?.definitionFile ?? null,
        styleSources,
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

function summarize(entries, files) {
  const countBy = (key) =>
    Object.fromEntries(
      [...new Set(entries.map((entry) => entry[key] ?? "(sin valor)"))]
        .sort()
        .map((value) => [
          value,
          entries.filter((entry) => (entry[key] ?? "(sin valor)") === value)
            .length,
        ]),
    );

  return {
    productionJsxFiles: files.length,
    filesWithVisualElements: files.filter((file) => file.entries.length > 0).length,
    sourceOccurrences: entries.length,
    interactiveOccurrences: entries.filter((entry) => entry.interactive).length,
    nativeOccurrences: entries.filter((entry) => entry.nativeElement).length,
    customComponentOccurrences: entries.filter((entry) => !entry.nativeElement).length,
    byModule: countBy("module"),
    byCategory: countBy("category"),
    byKind: countBy("kind"),
  };
}

function buildCatalog() {
  const cssIndex = buildCssIndex();
  const jsxFiles = walkFiles(FRONTEND_ROOT, isProductionJsxFile);
  const files = jsxFiles.map((file) => scanJsxFile(file, cssIndex));
  const entries = files
    .flatMap((file) => file.entries)
    .sort(
      (a, b) =>
        a.source.file.localeCompare(b.source.file) ||
        a.source.line - b.source.line ||
        a.source.column - b.source.column,
    );
  const sourceSnapshotHash = sha256(
    files.map((file) => `${file.file}:${file.sha256}`).join("\n"),
  );

  return {
    schemaVersion: 1,
    catalogLanguage: "es-PE",
    title: "Catálogo visual real de Prosecnur",
    purpose:
      "Censo descriptivo de la implementación actual. Registra variantes sin unificarlas.",
    hierarchyVocabulary: ["módulo", "sección", "pestaña"],
    sourceSnapshotHash,
    coverage: {
      root: "frontend/src",
      extensions: [".tsx", ".jsx"],
      exclusions: ["*.test.*", "*.spec.*", "__tests__/**", "__snapshots__/**"],
      unit: "ocurrencia JSX en código fuente productivo",
      limitations: [
        "Una ocurrencia dentro de un map representa el patrón visual, no cada fila de datos en runtime.",
        "Canvas, Plotly y SVG generados por librerías se registran por su componente anfitrión y sus nodos JSX declarados.",
        "La asignación de pestaña puede ser heurística cuando el mismo componente compartido se usa en varios contextos.",
      ],
    },
    modules: MODULES,
    hierarchy: HIERARCHY,
    declaredVisualSurfaces: DECLARED_VISUAL_SURFACES,
    categoryDescriptions: CATEGORY_DESCRIPTIONS,
    summary: summarize(entries, files),
    files: files.map(({ file, sha256: fileHash, entries: fileEntries }) => ({
      file,
      sha256: fileHash,
      occurrences: fileEntries.length,
    })),
    entries,
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
.cv-meta{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:20px 0}
.cv-stat{padding:12px;border:1px solid var(--bk-border);border-radius:var(--bk-radius-card);background:var(--bk-paper)}
.cv-stat strong{display:block;color:var(--bk-navy);font-size:22px;font-variant-numeric:tabular-nums}
.cv-stat span{display:block;margin-top:3px;color:var(--bk-ink-soft);font-size:11px}
.cv-controls{position:sticky;top:46px;z-index:40;display:grid;grid-template-columns:minmax(220px,2fr) repeat(4,minmax(140px,1fr));gap:8px;padding:12px;border:1px solid var(--bk-border);border-radius:var(--bk-radius-panel);background:rgba(255,255,255,.94);box-shadow:var(--bk-shadow-soft);backdrop-filter:blur(14px)}
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
      <p>Inventario descriptivo —no normativo— de cada ocurrencia JSX productiva. Conserva las diferencias actuales para que una sesión posterior pueda compararlas y unificarlas con evidencia. La procedencia siempre sigue <strong>módulo → sección → pestaña</strong> e incluye archivo, línea, componente, clases, estados y fuente de estilo.</p>
      <p class="bb-spec">Fuente generada: <code>branding/catalogo-visual/catalogo.json</code>. Unidad: ocurrencia declarada en código; los elementos repetidos por datos se registran como patrón de render. Índice humano: <a href="catalogo-visual/inventario-contextual.md">inventario-contextual.md</a>.</p>
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
    </div>
    <p class="cv-results" id="cv-results" aria-live="polite"></p>
    <div class="cv-table-wrap" tabindex="0" aria-label="Inventario exhaustivo de elementos visuales">
      <table class="cv-table">
        <thead><tr><th>Módulo · sección · pestaña</th><th>Categoría</th><th>Elemento</th><th>Label / contenido</th><th>Uso y estado</th><th>Fuente React</th><th>Fuente visual</th></tr></thead>
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
<script src="catalogo-visual/catalogo-data.js"></script>
<script>
(function(){
  "use strict";
  var body=document.getElementById("cv-body");
  if(!body)return;
  var catalogPromise=window.__PROSECNUR_VISUAL_CATALOG_PROMISE__;
  if(!catalogPromise){body.innerHTML='<tr><td colspan="7" class="cv-empty">No se pudo cargar catalogo-visual/catalogo-data.js.</td></tr>';return;}
  catalogPromise.then(function(catalog){
  var state={page:0,size:120,rows:catalog.entries.slice()};
  var els={
    search:document.getElementById("cv-search"),module:document.getElementById("cv-module"),
    section:document.getElementById("cv-section"),tab:document.getElementById("cv-tab"),
    category:document.getElementById("cv-category"),results:document.getElementById("cv-results"),
    prev:document.getElementById("cv-prev"),next:document.getElementById("cv-next"),page:document.getElementById("cv-page")
  };
  function esc(value){return String(value==null?"":value).replace(/[&<>"']/g,function(ch){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]})}
  function options(select,values,label){select.innerHTML='<option value="">'+label+'</option>'+values.map(function(value){return '<option value="'+esc(value)+'">'+esc(value)+'</option>'}).join("")}
  function uniq(values){return Array.from(new Set(values.filter(Boolean))).sort(function(a,b){return String(a).localeCompare(String(b),"es")})}
  options(els.module,catalog.modules.map(function(item){return item.id}),"Todos los módulos");
  options(els.category,Object.keys(catalog.summary.byCategory),"Todas las categorías");
  function syncDependentOptions(){
    var scoped=catalog.entries.filter(function(row){return !els.module.value||row.module===els.module.value});
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
    state.rows=catalog.entries.filter(function(row){
      if(els.module.value&&row.module!==els.module.value)return false;
      if(els.section.value&&row.section!==els.section.value)return false;
      if(els.tab.value&&row.tab!==els.tab.value)return false;
      if(els.category.value&&row.category!==els.category.value)return false;
      if(!query)return true;
      return [row.label,row.tag,row.kind,row.category,row.source.file,row.componentContext,(row.classNames||[]).join(" ")].join(" ").toLowerCase().includes(query);
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
      var styles=(row.styleSources||[]).slice(0,3).map(function(s){return '<span class="cv-source cv-path">'+esc(s)+"</span>"}).join("");
      return '<tr data-cv-id="'+esc(row.id)+'"><td>'+context+'<small class="cv-path">'+esc(row.componentContext)+'</small></td><td><span class="cv-chip">'+esc(row.category)+'</span><br>'+esc(row.kind)+'</td><td><code>'+esc(row.tag)+'</code><small class="cv-path">'+esc((row.classNames||[]).join(" · "))+'</small></td><td><span class="cv-label">'+esc(row.label)+'</span></td><td>'+esc(row.usage)+'<div>'+states+'</div></td><td><span class="cv-source cv-path">'+esc(row.source.file)+":"+row.source.line+":"+row.source.column+"</span>"+(row.definitionFile?'<small class="cv-path">define: '+esc(row.definitionFile)+'</small>':"")+"</td><td>"+(styles||'<small>inline / herencia / sin clase resuelta</small>')+"</td></tr>";
    }).join(""):'<tr><td colspan="7" class="cv-empty">No hay elementos para estos filtros.</td></tr>';
    els.results.textContent=state.rows.length.toLocaleString("es-PE")+" elementos · mostrando "+(visible.length?start+1:0)+"–"+(start+visible.length);
    els.page.textContent="Página "+(state.page+1)+" de "+pages;
    els.prev.disabled=state.page===0;els.next.disabled=state.page>=pages-1;
  }
  [els.search,els.module,els.section,els.tab,els.category].forEach(function(el){el.addEventListener(el===els.search?"input":"change",filterRows)});
  els.prev.addEventListener("click",function(){state.page-=1;render()});
  els.next.addEventListener("click",function(){state.page+=1;render()});
  var summary=catalog.summary,meta=document.getElementById("cv-meta");
  meta.innerHTML=[
    [summary.sourceOccurrences,"ocurrencias JSX"],
    [summary.interactiveOccurrences,"interactivas"],
    [summary.productionJsxFiles,"archivos productivos"],
    [Object.keys(summary.byModule).length,"ámbitos/módulos"],
    [Object.keys(summary.byKind).length,"tipos visuales"]
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
      `ocurrencias JSX: ${catalog.summary.sourceOccurrences}`,
      `interactivas: ${catalog.summary.interactiveOccurrences}`,
      `snapshot: ${catalog.sourceSnapshotHash}`,
    ].join("\n") + "\n",
  );
}

main();
