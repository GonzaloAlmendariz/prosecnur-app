// Notas de versión de Prosecnur — ubicación canónica.
//
// Se muestran en Configuración → Novedades (GlobalSettingsDialog) y en el
// ReleaseNotesDrawer del Home; el BootGate chooser reusa el mismo diálogo
// vía ChooserSettings. La entrada más reciente va PRIMERO.

export type ReleaseNote = {
  version: string;
  date: string;
  highlights: string[];
};

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "0.4.0",
    date: "2026-06-22",
    highlights: [
      "Cálculo de muestra: amplía el flujo de marcos, aulas, acreditación y escenarios con persistencia más robusta.",
      "Carga: suma entradas directas desde plataformas, mejor soporte para ZIP/SAV y controles de fuentes multibase.",
      "Codificación y reportes: incorpora importación Excel de categorizaciones y ficha técnica metodológica exportable.",
      "Dashboard, Analítica, Gráficos y Hojas de ruta: consolida mejoras visuales y operativas acumuladas para el nuevo corte.",
      "Monitoreo: este corte mantiene fuera los últimos cambios en desarrollo del módulo.",
    ],
  },
  {
    version: "3.3.4",
    date: "2026-06-11",
    highlights: [
      "Carga: mantiene la actualizacion incremental SurveyMonkey por fuente principal y campanas/canales persistidos.",
      "Consentimiento: conserva el conteo de registros validos bajo pregunta y opcion aprobatoria.",
      "Monitoreo: ajusta la nomenclatura territorial a registros validos, no validos y casos por revisar.",
      "Monitoreo: pule visualmente los indicadores GPS, duracion y resumen territorial.",
      "Deploy: estabiliza el empaquetado macOS local sin firma/notarizacion automatica.",
    ],
  },
  {
    version: "3.3.3",
    date: "2026-06-11",
    highlights: [
      "Carga: actualiza respuestas SurveyMonkey de bases ya trabajadas sin reemplazar datos locales y reporta registros validos nuevos.",
      "SurveyMonkey multibase: permite agregar campanas/canales a una base existente, persistirlas y refrescarlas junto con la fuente principal.",
      "Consentimiento: muestra la pregunta y opcion aprobatoria que definen los registros validos en Carga/Bases.",
      "Codificacion: conserva el avance y relanza la reaplicacion cuando entran respuestas nuevas.",
      "Monitoreo: incorpora Google Sheets como superficie operativa controlada para publicar salidas Prosecnur sin modificar la hoja viva de campo.",
      "Monitoreo: refuerza taxonomia de estados, consultas internas, fuentes multiples y documentacion arquitectonica del centro operativo.",
    ],
  },
  {
    version: "3.3.1",
    date: "2026-06-05",
    highlights: [
      "Graficos: muestra el selector de iconos en Contenido para los slides con icono y toma los PNG subidos en Configuracion global.",
      "Graficos: evita que etiquetas o titulos guardados como objetos vacios rompan la pantalla al volver a /graficos.",
      "Graficos: estabiliza titulos automaticos y manuales para que el titulo del grafico se mantenga en preview, PPT y Word.",
      "Editor visual: corrige la X del canvas dinamico para que no compita con separadores ni cambie de icono al hacer click.",
      "Paletas: aplica colores por lista en preview/export y muestra listas de todas las fuentes en proyectos multibase.",
      "Word/PPT: refuerza presets, leyendas y composicion de graficos apilados, agrupados, numericos, pie, radar y reportes Word.",
      "Analitica multibase: mejora la seleccion y recuperacion de bases procesadas para reducir estados incompletos.",
    ],
  },
  {
    version: "0.3.2",
    date: "2026-06-04",
    highlights: [
      "Hojas de ruta: corrige el layout del PDF integrado para que la tabla de recorrido no se corte ni choque con el pie de pagina.",
      "Revision final: evita que las tablas anchas atrapen el scroll vertical cuando se revisan titulares y reemplazos.",
      "Inspector de zonas: estabiliza las tarjetas de zonas para que viviendas, personas, estado y accion no se superpongan.",
    ],
  },
  {
    version: "0.3.1",
    date: "2026-06-04",
    highlights: [
      "Carga multibase: aplica la logica XLSForm de una base plantilla a hermanas compatibles, incluyendo relevant, constraint, required, choice_filter y calculation.",
      "SurveyMonkey multibase: importa hermanas independientes desde una o varias campañas, con estrategia de recoleccion y exclusiones de validacion por fuente.",
      "Validacion: enmascara reglas por fila/fuente para evitar falsos positivos cuando preguntas administrativas no aplican a fuentes autoadministradas.",
      "Hojas de ruta: separa fases piloto y campo real, refuerza el resumen de fuentes/configuracion y conserva snapshots mas trazables.",
      "Drilldown y visualizacion: mejora la inspeccion de reglas, el panel de detalle y el render Plotly para flujos de validacion mas exigentes.",
      "Graficos: recupera fuentes procesadas validas cuando el cache queda incompleto y evita que listas invalidas lleguen al motor de reportes.",
      "Reportes Word/PPT: usa etiquetas XLSForm como titulos por defecto y limpia sufijos de variables recodificadas en el indice Word.",
      "Documentacion y pruebas: agrega ADR 0009, actualiza arquitectura multibase y suma cobertura R/React para los nuevos contratos.",
    ],
  },
  {
    version: "0.3.0",
    date: "2026-06-02",
    highlights: [
      "Arquitectura canonica: guia principal y ADRs para app local, formato .pulso, secretos fuera del proyecto, modulos por dominio, integraciones salientes y auditoria reproducible.",
      "Auditoria canonica: nuevo proyecto .pulso sintetico, comandos Make y smoke de Electron para diagnosticar regresiones con capturas, sid, puerto y checksum aislados.",
      "Conexiones: Configuracion centraliza SurveyMonkey, Kobo y Google Sheets, guarda credenciales fuera del .pulso, soporta perfiles SurveyMonkey y solo expone mascaras al frontend.",
      "Multibase y monitoreo: mejor importacion de familias SurveyMonkey, bases hermanas independientes, sincronizacion de fuentes, seleccion de base activa y motores mas defensivos.",
      "Home y shell: nuevo deck de modulos, Ajustes con notas/creditos/conexiones, catalogo de modulos compartido y estados de proyecto mas claros.",
      "Calidad del release: mas pruebas frontend/R para cliente API, carga multibase, codificacion, analitica, persistencia .pulso, secretos y auditoria.",
    ],
  },
  {
    version: "0.14",
    date: "2026-05-03",
    highlights: [
      "Nuevo módulo Hojas de ruta: valida columnas de campo, arma cuotas por UMP, previsualiza mapas faltantes y genera un ZIP con PDFs listos para impresión.",
      "Editor XLSForm + SurveyMonkey: importación API-only más fiel, matrices y opciones “Otro” mejor interpretadas, lógica avanzada aplicable al formulario actual y nuevo asistente visual de saltos.",
      "Gráficos: inspector V2 reorganizado, controles visuales para colores por serie y criterios, presets Word sin JSON crudo, auto-layout/canvas más estable y leyendas configurables arriba/abajo/lados.",
      "Analítica: frecuencias y cruces ganan opciones para ocultar títulos/secciones, mejor manejo de categorías y select_multiple, filtros nombrados más robustos y UI de configuración más clara.",
      "Carga y normalización: aliases q→p, padding de opciones y reconstrucción de select_multiple se muestran en la vista previa; columnas extra quedan identificadas.",
      "Codificación y validación: textos abiertos independientes se pueden recodificar, la base adaptada alimenta Analítica automáticamente y las reglas/preview toleran mejor labels, fechas, regex y expresiones select_multiple.",
    ],
  },
  {
    version: "0.13",
    date: "2026-05-02",
    highlights: [
      "Independencia entre proyectos: fix de fuga de estado al cambiar de .pulso (Dashboard/Analítica/Gráficos/Wizard de Dimensiones se resetean al cambiar sid).",
      "StartModal rediseñado: solo Nuevo proyecto + Abrir proyecto + lista de Recientes con papelera (no borra el archivo, solo lo quita de la lista).",
      "Modo navegador desbloqueado: abrir/crear .pulso por path manual sin Electron.",
      "Editor de XLSForms: el export se guarda automáticamente en la carpeta del proyecto en vez de ~/Downloads.",
      "Home: grid de módulos 3×2 con sexto slot reservado.",
      "Fix Limpieza y normalización: el endpoint ya no se cae con E_INTERNAL al serializar evaluacion_final.",
      "Fix Codificación: preview de respuestas con un solo elemento ya no rompe la UI.",
      "Fix bootstrap: la app adopta el .pulso preload aunque jsonlite serialice NULL como `{}`.",
    ],
  },
  {
    version: "0.12",
    date: "2026-04-28",
    highlights: [
      "Dashboard exporta como HTML autosuficiente con WebR (R en el navegador, sin servidor).",
      "Bridge WebR para modo standalone: cómputo R nativo dentro del .html exportado.",
    ],
  },
  {
    version: "0.11",
    date: "2026-04-28",
    highlights: [
      "Dashboard: vista previa, paleta UI, recodificación por variable, override de vars.",
      "Revamp UX: toolbar afuera del canvas, marca con múltiples logos, sidebar Dimensiones rediseñado.",
      "Vista FODA Lectura como modo pedagógico.",
      "Avances en analítica/dimensiones, gráficos v2 y router del proyecto en R API.",
    ],
  },
  {
    version: "0.10",
    date: "2026-04-27",
    highlights: [
      "Dashboard fullscreen transversal, con skeleton de filtros y tests del semáforo.",
      "Barras h/v/facet, radar polygonal con modos/animado, FODA polish.",
      "Semáforo configurable, leyendas centradas, IterStepper, % fuera de barra.",
      "Chip rectangular al final de cada barra, FODA legacy preservado.",
      "Plotly como un solo chunk compartido (~4.6 MB) entre features.",
      "SessionChip resiliente a sessionId no-string + setter defensivo.",
    ],
  },
  {
    version: "0.9",
    date: "2026-04-26",
    highlights: [
      "Dashboard /tablero independiente, con paletas y reglas de diseño Emil aplicadas.",
      "Pestañas Relaciones y Base de datos con persistencia en el .pulso.",
      "Pestaña Dimensiones con heatmap semáforo, radar y barras.",
      "FODA scatter flotante + barras ordenadas con chip semáforo.",
      "Pasada de fidelidad al legacy reporte_interactivo.",
      "Curaduría preservada al reabrir un .pulso.",
    ],
  },
  {
    version: "0.8",
    date: "2026-04-21",
    highlights: [
      "Home rediseñado como menú de módulos — Prosecnur como suite multi-propósito.",
      "Notas de versión integradas con historial colapsable.",
      "Confirmación al cerrar la app para no perder progreso.",
    ],
  },
  {
    version: "0.7",
    date: "2026-04-20",
    highlights: [
      "Sistema de diseño unificado: tokens de status, primitivos compartidos, sin hex hardcoded en Fases 3/4/5.",
      "Color picker integrado en presets con paletas del estudio.",
      "Textos en negrita con multi-select de chips.",
      "Hot-reload del engine R sin reiniciar el proceso.",
    ],
  },
  {
    version: "0.6",
    date: "2026-04-18",
    highlights: [
      "Overrides defaults persistentes simétricos a presets defaults.",
      "DefaultsModal accesible desde el engranaje de Configuración global.",
    ],
  },
];
