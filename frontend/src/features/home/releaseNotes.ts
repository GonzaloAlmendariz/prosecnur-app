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
    version: "0.5.11",
    date: "2026-07-15",
    highlights: [
      "Carga: permite marcar a mano qué registros pertenecen al universo real del estudio (fuera pruebas y piloto); el filtro se materializa por base y las tablas repeat lo heredan solas.",
      "Validación: genera un reporte metodológico completo del plan aplicado — qué evalúa cada regla, sobre qué universo y con qué resultado — listo para anexar al informe del estudio.",
      "Validación: suma controles operacionales sobre las reglas del instrumento, con manejo explícito de duplicados y rangos de fecha con zona horaria.",
      "Monitoreo: agrega el PDF de avance telefónico para el cliente, con resumen del campo, ritmo diario y estado de cuotas.",
      "Editor de formularios: exporta el cuestionario también a Word con la misma composición del PDF, y el hub de formularios muestra conteos reales de preguntas y secciones por formulario.",
      "Cálculo de muestra: nuevo método estadístico para estudiantes por aula con límite inferior conservador (bootstrap al 95%), seleccionable desde la pestaña de cursos-horario.",
      "Formulario en PDF: las matrices ganan legibilidad — etiquetas más anchas, escalas sin rotar cuando caben y filas más compactas.",
    ],
  },
  {
    version: "0.5.10",
    date: "2026-07-15",
    highlights: [
      "Cálculo de muestra: las categorías se muestran tal cual vienen en tu base, sin reetiquetados automáticos.",
      "Cálculo de muestra: la pestaña Variables separa con claridad las columnas del estudiante de las del curso-horario, cada una bajo su propia hoja.",
      "Cálculo de muestra: el mapeo de columnas ahora ofrece todos los encabezados disponibles de cada hoja, incluido el tipo de docente.",
      "Inicio: cada tarjeta de módulo muestra en qué punto vas y qué sigue, con las métricas y el acceso directo más relevantes.",
    ],
  },
  {
    version: "0.5.9",
    date: "2026-07-14",
    highlights: [
      "Cálculo de muestra: rediseña la sección de Cálculo con Diseño, parámetros por facultad y cursos-horario por facultad, más una vista de Cobertura con dos gráficos por facultad.",
      "Cálculo de muestra: en Datos puedes mapear las columnas a mano, ver tarjetas por tipo y trabajar hasta dos escenarios de muestra.",
      "Editor de formularios: el editor de texto de las preguntas suma color y encabezados, y el Mapa de lógica se renueva por completo — eliminar relaciones desde el visor, conexiones dibujadas en arco, minimapa para orientarte, contador de relaciones por sección y una leyenda mucho más clara.",
      "Cálculo de muestra: los criterios de elegibilidad traen una selección canónica por defecto, se reconcilian solos al remapear y muestran un inventario de valores únicos en Datos → Consistencia.",
      "Cálculo de muestra: los cálculos largos ahora se pueden cancelar y muestran su estado, con el tiempo del sorteo final acotado.",
      "Cálculo de muestra: corrige la distribución por sexo con estudiantes únicos, el tipo de docente jerárquico y el mapeo de columnas de curso-horario; el aviso de reconstruir aparece solo cuando hay un cambio real.",
      "Procesamiento: la reconstrucción de preguntas de opción múltiple conserva todas las alternativas y reconoce correctamente las columnas marcadas con Sí/No.",
    ],
  },
  {
    version: "0.5.8",
    date: "2026-07-13",
    highlights: [
      "Procesamiento: carga archivos XLSX con varias hojas y las organiza automáticamente en bases relacionadas por grupo repetible.",
      "Analítica: hereda el peso de diseño de la base principal a cada grupo repetible, sin necesidad de ponderar hoja por hoja.",
      "Validación: muestra los conteos por servicio o grupo repetible en un indicador segmentado, para ubicar de un vistazo dónde están los casos.",
      "Cálculo de muestra: mantiene el resumen del diseño siempre visible mientras ajustas los criterios de selección, con confirmación explícita para cada cambio, y hace del mínimo elegible el criterio autoritativo sin filtros redundantes.",
      "Cálculo de muestra: unifica el vocabulario a \"curso-horario\" en todo el recorrido, en monitoreo y en recopiladores, para no confundirlo con el aula física.",
      "Apariencia: las pestañas de toda la aplicación cambian con un indicador animado más fluido.",
      "Instalación Windows: evita reinstalar el motor estadístico en cada arranque y elimina los diálogos de error duplicados.",
    ],
  },
  {
    version: "0.5.7",
    date: "2026-07-13",
    highlights: [
      "Instalación Windows: permite elegir la carpeta donde instalar Prosecnur y conserva esa elección al actualizar.",
      "Instalación Windows: verifica que la ruta seleccionada tenga permisos de escritura antes de copiar archivos.",
      "Instalación Windows: reintenta de forma segura la recuperación del motor estadístico cuando una instalación previa quedó incompleta.",
    ],
  },
  {
    version: "0.5.6",
    date: "2026-07-13",
    highlights: [
      "Inicio: renueva el panel de control y el carrusel de módulos para que cada proyecto muestre sus accesos y avances con mayor claridad.",
      "Procesamiento: hace visible la estructura de grupos repetibles desde Carga, Validación y Analítica, con rosters relacionales que permiten explorar cada base sin perder contexto.",
      "Analítica: conserva etiquetas y el orden del instrumento con más fidelidad, mejora los entregables de grupos repetibles y evita columnas duplicadas o vacías en las bases exportadas.",
      "Validación: incorpora controles de coherencia entre la base principal y sus grupos repetibles, y distingue claramente la base activa al revisar reglas.",
      "Editor de formularios: transforma el mapa de lógica y el lienzo en una experiencia más legible, con búsquedas para listas extensas, relaciones diferenciadas y edición de secciones más directa.",
      "Cálculo de muestra: organiza los criterios por categoría y convierte el marco de aulas en un recorrido más trazable, con embudos y decisiones de diseño fáciles de explicar.",
    ],
  },
  {
    version: "0.5.5",
    date: "2026-07-10",
    highlights: [
      "Inicio: cada proyecto abre en su propio panel de control que resume el avance y la madurez de cada módulo, y el selector de proyectos estrena una presentación unificada más clara y adaptable a la pantalla.",
      "Bitácora: estrena un módulo único que reúne el diseño del estudio y el cronograma, con altas y bajas de actividades y hora en el calendario.",
      "Analítica: suma ponderación con pesos de diseño y raking, con una vista previa que diagnostica el efecto sobre la muestra antes de aplicarla.",
      "Analítica: genera el libro de códigos en PDF de la base final —incluida la base panel— en el orden del formulario y con la orientación código o etiqueta que elijas.",
      "Analítica: permite fijar el orden de las categorías ordinales y lo propaga a frecuencias, cruces, tablas y PPT, con un catálogo de listas y controles por fila.",
      "Analítica: exporta un script de replicación (.R) que reconstruye la base final de forma reproducible.",
      "Procesamiento: soporta formularios con grupos repetibles de punta a punta —ingesta, validación, analítica y entregables.",
      "Carga: trae el trabajo de campo validado desde Monitoreo a Procesamiento en un paso claro, reemplazando la base cruda en su sitio.",
      "Monitoreo: el inicio refleja el avance territorial vivo, el revamp de aulas ordena los indicadores en una banda de KPIs y los enlaces directos abren la sección correcta.",
      "Validación: recupera la pregunta madre de los select_multiple para no marcar falsos positivos, y reconoce validación y plan por base en estudios multibase.",
      "Apariencia: recalibra los controles al UI Kit de macOS y alinea Fichas QR, Cálculo de muestra y otras vistas al lenguaje visual de la suite.",
    ],
  },
  {
    version: "0.5.4",
    date: "2026-07-09",
    highlights: [
      "Cálculo de muestra: reconstruye Muestra de aulas como un recorrido didáctico que explica cada fórmula y decisión del diseño paso a paso.",
      "Cálculo de muestra: corre los cálculos grandes en segundo plano con progreso visible, historial de corridas y un paquete de defensa listo para sustentar el diseño.",
      "Cálculo de muestra: evalúa la salud del diseño — censo, cobertura, balance y precisión — y señala los riesgos por severidad.",
      "Reportes PDF: estrena la estética institucional Pulso en los avances de campo, el libro de códigos a dos columnas con índice y el formulario en papel.",
      "Monitoreo: exporta las UMP con ocurrencias a Excel con filtros listos y asigna el responsable correcto incluso cuando hubo reemplazos.",
      "Validación: avisa cuando una regla apunta a datos que no calzan con la base, antes de generar falsos positivos.",
      "Carga: reconoce las bases que llegan desde Monitoreo y muestra las etiquetas en español de los formularios Kobo.",
    ],
  },
  {
    version: "0.5.3",
    date: "2026-07-07",
    highlights: [
      "Editor de formularios: suma asistentes guiados para saltos, filtros de opciones, validaciones, cálculos y mensajes de campo, sin escribir sintaxis técnica.",
      "Editor de formularios: refuerza el lienzo de lógica, el catálogo de opciones y la restauración del autoguardado.",
      "Monitoreo: agrega la mesa de reconciliación territorial con cola de UMP, ajustes operativos con historial y lentes de revisión.",
      "Procesamiento: compacta la navegación en rieles de íconos y pule las mesas de trabajo de Carga, Validación, Codificación y Analítica.",
      "Gráficos: amplía el selector de modelos, unifica la barra superior y estabiliza la vista previa al cambiar de lámina.",
      "Apariencia: moderniza Home, Carga, Cálculo de muestra, Validación, Codificación y Analítica con el nuevo lenguaje visual de la suite.",
    ],
  },
  {
    version: "0.5.2",
    date: "2026-07-03",
    highlights: [
      "Gráficos: estrena la biblioteca de modelos de láminas, calibrada con la plantilla PPT real del estudio.",
      "Gráficos: genera la vista previa de láminas localmente, lista para funcionar en la app instalada.",
      "Gráficos: aclara la suite de estilo global — presets, modos por espacio y placeholders dinámicos — con vocabulario más simple.",
      "Gráficos: compacta la barra superior, el inspector y el timeline para aprovechar mejor la pantalla.",
      "Gráficos: guía la recuperación de modelos pendientes y muestra la salud del plan antes de exportar.",
    ],
  },
  {
    version: "0.5.1",
    date: "2026-07-02",
    highlights: [
      "Procesamiento: procesa estudios de acreditación con varios actores, cada uno con su propia base Kobo.",
      "Carga: importa bases hermanas independientes desde Kobo dentro del mismo proyecto.",
      "Procesamiento: sugiere los siguientes pasos del pipeline según el diseño del estudio.",
      "Monitoreo: adapta el seguimiento a estudios de acreditación y encuestas telefónicas con perfiles dedicados.",
      "Gráficos: mide la cobertura del plan de láminas para detectar variables aún sin graficar.",
      "Procesamiento: agrega un visor de hojas para revisar la base procesada sin salir de la app.",
    ],
  },
  {
    version: "0.5.0",
    date: "2026-06-30",
    highlights: [
      "Arranque: acelera la apertura de proyectos con precarga en caliente y una pantalla de inicio que muestra el progreso real.",
      "Plan de trabajo: mantiene el cronograma del estudio sincronizado con el avance del proyecto.",
      "Monitoreo: prepara las salidas publicables con indicadores de disponibilidad más confiables y paneles por canal mejor distribuidos.",
      "Calidad: suma proyectos de auditoría reproducibles que respaldan cada versión con evidencia visual.",
    ],
  },
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
