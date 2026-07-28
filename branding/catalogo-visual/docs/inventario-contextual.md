# Inventario contextual de la interfaz

Este documento es el índice humano del catálogo exhaustivo. La unidad auditable
continúa siendo cada registro de [`../data/catalogo.json`](../data/catalogo.json):
allí están cada ocurrencia
JSX, cada variante declarada y cada plantilla dinámica de botón, switcher,
checkbox, radio, campo, pestaña, overlay, estado, tabla, mapa, gráfico,
contenedor, texto e icono con su archivo, línea, columna, fuente de render,
componente o registro, condición, handlers, clases y fuentes CSS.

Las configuraciones con apariencia de copy de interfaz cuyo consumidor no se
puede resolver estáticamente también se preservan, pero en la capa separada
`declaración-sin-sink-resuelto`. Esta distinción evita convertir corpus,
presets técnicos u objetos CSS-in-JS en botones o pestañas confirmados, sin
perder la evidencia necesaria para una revisión posterior.

Además, ningún array u objeto candidato queda reducido a una cifra agregada:
`declarationCandidates` publica un ledger individual con archivo, línea,
contenedor, copy, evidencia y una disposición explícita
(`representado-por-descendiente`, `técnico`, `probable-visual` o
`no-resuelto`). Esta capa es auditable desde el filtro “Solo ledger de
candidatos” y no se mezcla con los elementos cuyo render sí está confirmado.

El contenido que no existe en JSX y aparece mediante `content:` en un
pseudo-elemento CSS se conserva en `contenido-generado-css`, incluyendo texto
literal, símbolos y valores derivados con `attr(...)`, junto con su selector,
fuente y estados.

Aquí se agrupan esas ocurrencias con el lenguaje operativo canónico:
`módulo → sección → pestaña`. No se declara todavía una variante correcta ni
se intenta unificar componentes.

El catálogo usa dos scopes documentales cuando el código no demuestra una sola
pestaña: `Transversal / sin pestaña local` y
`Varias pestañas / contexto dinámico`. Esos scopes evitan convertir nombres de
archivo o inferencias débiles en pestañas ficticias. El snapshot abarca todas
las fuentes productivas `.ts/.tsx/.js/.jsx` y hojas `.css` detectadas; sus
totales exactos quedan registrados en `summary.productionSourceFilesScanned` y
`summary.productionStyleFilesScanned`. Arrays, tuplas, records, factories y
props semánticas se expanden por variante,
mientras los datos de runtime se describen mediante proveedor y plantilla sin
inventar instancias.

Los tags polimórficos (`Tag`) y los iconos enlazados en runtime (`Icon`,
`ActiveIcon`, `SelectedIcon`) mantienen en cada ocurrencia su binding,
expresión proveedora y opciones o fallbacks demostrables. De ese modo un host
dinámico no queda reducido a un componente genérico sin procedencia.

## Global

### Arranque

Pestañas/contextos: BootGate, selector, creación y apertura de proyecto, warm
start. Incluye etapas de arranque, progreso, reintento, diagnóstico, proyectos
recientes y estados de error.

Fuentes: `frontend/src/app/BootGate.tsx`,
`frontend/src/app/BootChrome.tsx`,
`frontend/src/components/RecentProjectCard.tsx`.

### Shell global y proyecto

Contextos: navegación de módulos, archivo/proyecto, sesión, guardado, ajustes,
ciclo de vida del proyecto, nombre de archivo, módulos activos y guardado de
entregables. Incluye los diálogos de proyecto y Ajustes globales con Apariencia,
Conexiones, Novedades y Créditos.

Fuentes: `frontend/src/app/Layout.tsx`, `frontend/src/app/App.tsx`,
`frontend/src/features/project/**/*`,
`frontend/src/features/home/GlobalSettingsDialog.tsx`.

### Home

Contextos: configuración inicial, Mission control, carrusel y gestor de
módulos. Los controles cambian según exista o no un proyecto cargado.

Fuentes: `frontend/src/features/home/HomePage.tsx`,
`frontend/src/features/home/MissionControl.tsx`,
`frontend/src/features/home/ModuleCarousel.tsx`.

### Componentes compartidos

Incluye botones, pestañas, navegación, stepper, paneles, estados, alertas,
chips, popovers, barras de progreso, filtros y runtime compartido.

Fuentes: `frontend/src/components/**/*`, `frontend/src/lib/*.tsx`.

## Bitácora

### Bitácora

Se usa para registrar Nota, Decisión, Avance, Riesgo o Bloqueo por módulo.
Contiene selectores de módulo y tipo, título, detalle, Registrar/Guardar,
Cancelar y acciones Editar/Eliminar sobre la línea temporal.

Fuente: `frontend/src/features/bitacora/LogbookSection.tsx`.

### Cronograma

Pestañas/contextos: Gantt y editor. Contiene Nueva actividad, importar/exportar
Excel, Actualizar, Limpiar, selector de hitos, filas y barras seleccionables,
Actividad, Responsable, Producto, Inicio, Fin, Estado, Notas, Guardar y
Eliminar.

Fuente: `frontend/src/features/bitacora/CronogramaSection.tsx`.

### Calendario

Pestañas: Mes y Semana. Contiene Anterior, Hoy, Siguiente, Nueva actividad,
Cargar ejemplo, días, eventos, `+N`, carril de todo el día, ranuras de 15
minutos, arrastre, Asignar fecha y diálogo Crear/Editar con fechas, horas,
estado, categoría, Eliminar, Cancelar y Crear/Guardar.

Fuente: `frontend/src/features/bitacora/Calendar.tsx`.

## Cálculo de muestra

### Selector de mesa

Pestañas/caminos: Opinión universitaria, Cálculo general, Acreditación
institucional, Territorial y Legacy. Incluye Empezar este camino, Ir a Hojas de
ruta y Reiniciar mesa.

Fuente: `frontend/src/features/calcMuestra/CalcMuestraPage.tsx`.

### Opinión universitaria · Datos

- Estudio: flujo Universo → Elegibles → Población → Muestra → Cursos-horario,
  Título, Cliente, Alcance, fuentes esperadas, etapa Propuesta/Campo y tarjetas
  de entrada inicial.
- Fuentes: Manual/Plataforma, archivos, hojas, histórico, estado, columnas,
  Solicitud DTI, compatibilidad y Construir marco.
- Consistencia: match, coincidentes, diferencias, llave, hallazgos y ejemplos.
- Variables: confirmar sugerencias, grupos Estudiante/Curso-horario, roles,
  selectores de columna, limpiar y confirmar.

Fuentes: `frontend/src/features/calcMuestra/universidad/definicion/**/*` y
`frontend/src/features/calcMuestra/universidad/marco/MarcoConsistenciaTab.tsx`.

### Opinión universitaria · Marco

- Criterios del estudiante: preset, reconstrucción, confirmar/descartar,
  switches booleanos/triestado, categorías, jerarquías, operadores, intervalos,
  excepciones por facultad, orden, mínimos y composición.
- Cursos-horario: criterios + radiografía: búsqueda, facultades, sugerencias,
  mínimos/máximos, boxplot, barras y tablas.
- Población: deduplicación, funnel, facultad/sexo/programa, drill-down e
  inventario.
- Cursos-horario: capacidad, histogramas, bandas, grupos de tamaño,
  particularidades, decisiones y notas.
- Cobertura: elegibles/no elegibles, incluidos/excluidos, KPI y leyendas.

Fuentes: `frontend/src/features/calcMuestra/universidad/criterios/**/*`,
`frontend/src/features/calcMuestra/universidad/marco/**/*` y
`frontend/src/features/calcMuestra/motor/pestanas/TabCobertura.tsx`.

### Opinión universitaria · Cálculo

- Diseño: fórmula Cochran, z, p, error, deff, sobremuestra, tau, slider,
  parámetros por facultad, Curva P, Campana Z, Recalcular/Descartar/Aplicar.
- Propuestas: escenarios, N final, piso, redondeo, ajuste, cuotas, afijación y
  distribución.
- Cursos-horario por facultad: propuesta, base elegible/total, tabla, steppers,
  gráfico, Descartar/Confirmar.
- Distribución: población, cuotas y cursos-horario por facultad y sexo.

Fuentes: `frontend/src/features/calcMuestra/universidad/calculo/**/*` y
`frontend/src/features/calcMuestra/motor/pestanas/TabDistribucion.tsx`.

### Opinión universitaria · Selección

Pestañas: Marco de cursos-horario, Objetivo de muestra, Comparar métodos,
Simulación, Cursos-horario titulares, Reemplazos por curso-horario y Sustento
técnico. Incluye flujo de siete pasos, auditoría, semillas/hashes, parámetros
operativos, PPS/Cube/pivotal/pool, recomendación, Monte Carlo, selección,
inspector, cadenas, olas, fórmulas y handoff.

Fuentes: `frontend/src/features/calcMuestra/universidad/aulas/**/*`.

### Opinión universitaria · Entrega

Pestañas: Cierre, Entregables, Tablas y Pase a Monitoreo. Incluye readiness,
historial y comparación de corridas, paquete de defensa, privacidad, Excel,
Sheets, nombres avanzados, descargas, tablas y enlaces a Monitoreo/Fichas.

Fuentes: `frontend/src/features/calcMuestra/universidad/salidas/**/*`.

### Otras mesas

Cálculo general usa las secciones Marco, Método y Resultados con Resumen,
Configuración y Resultado. Acreditación usa Actores, Contexto y Resultados con
los mismos alias. Territorial deriva a Hojas de ruta. Legacy conserva Diseñar
desde marco y Reiniciar selección.

Fuente: `frontend/src/features/calcMuestra/CalcMuestraPage.tsx`.

## Editor de formularios

### Biblioteca

Contextos: Formularios, Crear, Abrir e Importar. Incluye tarjetas, switcher,
diagnósticos, hallazgos, coachmarks, importación SurveyMonkey, matriz Pulso y
transferencia de instrumentos.

Fuentes: `frontend/src/features/xlsformEditor/catalogs/**/*` y
`frontend/src/features/xlsformEditor/shell/**/*`.

### Editor · Constructor

Pestañas/contextos: Foco, Vista general, Contenido, Respuesta/Estructura,
Reglas, Datos y Presentación. Incluye canvas, outline, tarjetas de pregunta,
opciones, inserción entre preguntas, acciones rápidas, inspectores, builders de
lógica, restricciones, cálculos y reglas de texto.

Fuentes: `frontend/src/features/xlsformEditor/canvas/**/*`,
`frontend/src/features/xlsformEditor/outline/**/*`,
`frontend/src/features/xlsformEditor/inspector/**/*`.

### Editor · Hojas

Pestañas: Preguntas, Opciones, Configuración y Papel/PDF. Contiene la vista
tabular editable, toolbar, selectores de hoja y diálogo de configuración PDF.

Fuentes: `frontend/src/features/xlsformEditor/sheets/SheetsView.tsx`,
`frontend/src/features/xlsformEditor/shell/ConfigurarPdfDialog.tsx`.

### Editor · Más vistas

Pestañas: Probar formulario, Resumen formulario, Vista cuestionario, Listas de
opciones, Mapa de lógica, Filtros de opciones y Lógica SurveyMonkey.

Fuentes: `frontend/src/features/xlsformEditor/shell/FormSimulator.tsx`,
`FormSummaryView.tsx`, `canvas-graph/**/*`, `choiceFilters/**/*`.

## Hojas de ruta

Chrome común: Piloto/Campo real, reglas de exclusión de piloto, rail de cinco
secciones, progreso, bloqueos, resumen y alertas descartables.

### Territorio

Mapa vertical de Lima/Callao; Campo/NSE; distrito/zona/manzana; seleccionar,
volver, zoom, restablecer, hover, popup, leyenda, buscador, Añadir visibles,
Limpiar borrador, candidato, Abrir zonas y Confirmar selección.

### Población

Agrupar por distrito/provincia/UBIGEO/zona; H/M o total; edad manual/cortes;
base confirmada/INEI; terciles a deciles; rangos; Confirmar; Calcular;
matrices/tablas y Exportar Excel.

### Muestra

N calculado/total/por distrito; confianza, margen, p, deff, respuesta,
corrección finita, ruta; presets; asignación; metas; pegado masivo; sugerir;
overrides; Calcular tamaño y cuotas; fórmulas, KPI y diagnósticos.

### Manzanas

Mapa, inspector, capas, zonas, rutas, titulares/reemplazos; método PPS,
sistemático o conglomerado; ponderación; entrevistas; semilla; esquina; salto;
reemplazos; Generar selección; resultados e historial.

### Entrega

Pestañas Cuotas, Titulares y Reemplazos. Incluye tablas, paginación, ZIP,
Excel, reemplazos manuales, titular, coincidencias, cantidad, ubicación, chips,
PDF unificado, PDF aleatorio y descargas históricas.

Fuente de todas las secciones:
`frontend/src/features/hojasRuta/HojasRutaPage.tsx`.

## Fichas QR

### Preparación

- Agenda: Preparar enlaces, Revisar muestra, Abrir Monitoreo, métricas,
  facultad, búsqueda, Copiar enlace y tabla seleccionable.
- Enlaces: cuenta/servidor Kobo, formularios, selector, Resolver enlace, URL,
  identificador, Generar/Regenerar, pegar/importar, Limpiar/Aplicar.

### Fichas

- Vista previa: filtros, Copiar enlace, Generar PDF, Guardar en Monitoreo y
  documento con QR, curso, aula, horario, facultad, docente, URL y campos
  impresos.
- Lista: filtros, tabla, abrir ficha, Completar enlaces y Generar PDF.

### Paquete

- PDF final: resumen, estado de QR/Word/PDF/consolidado/Monitoreo, grupos,
  portada y bloques imprimibles.
- Monitoreo: Copiar respaldo, Guardar, manifest y guía de cierre.

Fuente: `frontend/src/features/recopiladores/RecopiladoresPage.tsx`.

## Monitoreo

El perfil efectivo depende del backend; la sección principal usa `?tab=` y las
pestañas locales mantienen estado interno.

### Territorial

- Fuente: Formulario, Filtro y distritos, Encuestadores, Reconciliación,
  Historial.
- UMPs: Cobertura, Manzanas.
- Validación: Geolocalización, Reconciliación, Duración, Cuotas, Anulación.
- Consultas internas: Registro, GPS, Duración, Responsable, Subsanaciones.
- Avance: Resumen, Mapa y UMP, Ritmo, Salidas.
- Ocurrencias: Resumen, Reporte UMP, UMP, Alertas, Ritmo.

Fuentes: `frontend/src/features/monitoreo/profiles/territorial/**/*`.

### Acreditación

- Fuentes: Encuestas en plataforma, Bases en Sheets, Recopiladores, Fuentes
  activas.
- Modelo operativo: Modelo operativo, Cronograma, Resumen.
- Consultas: Registros, Estado de la base, Cruces efectivos, Subsanación.
- Monitoreo telefónico: Resumen, Día, Incidencia, Responsables, Alertas,
  Supervisión.
- Avance: Resumen, Actores, Encuestas, Detalle, Salidas.

Fuente:
`frontend/src/features/monitoreo/profiles/acreditacion/AcreditacionMonitoreoPage.tsx`.

### Telefónico

- Fuentes: Kobo, Base y barrido, Paquete.
- Modelo operativo: Modelo operativo, Cronograma, Resumen.
- Llamadas: Resumen, Consultados, Día, Tiempos, Incidencia, Responsables,
  Alertas, Supervisión.
- Consultas: Registros, Estado de la base, Cruces efectivos, Subsanación.
- Avance: Resumen, Actores, Encuestas, Detalle, Salidas.

Fuente:
`frontend/src/features/monitoreo/profiles/telefonico/TelefonicoMonitoreoPage.tsx`.

### Aulas e informe público

Aulas contiene Fuentes, Agenda cursos-horario, Avance, Validación y Consultas
sin pestañas locales. El informe público sigue el `tab_order` dinámico.

Fuentes: `frontend/src/features/monitoreo/profiles/aulas/**/*`,
`frontend/src/features/monitoreo/public/MonitoreoPublicReportPage.tsx`.

## Procesamiento

### Carga

Pestañas Plan, Fuentes, Revisión, Estructura y Datos. Incluye progreso,
guardado, varias bases, Manual/Plataforma, SurveyMonkey/Kobo, estrategias
multibase, archivos, credenciales, catálogos, parciales, instrumentos,
sincronización, SAV, mapeos, variables extra, códigos, universo, secciones,
preguntas, lógica, drawers y wizards.

Fuentes: `frontend/src/features/carga/**/*`.

### Validación

- Explorar respuestas: variable, distribución, cruces, filtros, repeat, lente
  contextual y Plotly.
- Reglas del formulario: plan, preparación, importar/exportar, controles,
  auditoría, ejecución y drill-down.
- Criterios de revisión: crear/ejecutar, switch activo, editor, tratamiento,
  alcance y condiciones.
- Cierre de base: registrar, corregir, asignar, recodificar, completar,
  agregar/quitar, anular, excluir, alcance, motivo e historial.
- Panorama: superficie declarada actualmente inactiva.

Fuentes: `frontend/src/features/validacion/**/*`.

### Codificación

Pestañas Preparar, Codificar, Matrices, Adaptar y Detalle de pregunta. Incluye
selección y relaciones de preguntas, diálogos, sidebar, respuestas, grupos,
intervalos, importación/exportación de matrices, tablas editables, adaptación
y descargas.

Fuentes: `frontend/src/features/codificacion/**/*`.

### Analítica

Pestañas: Datos, Base final, Libro de códigos, Bases e instrumentos,
Ponderación, Frecuencias, Tablas multibase, Base panel, Ficha técnica, Cruces,
Orden de categorías, Dimensiones y Enumeradores inactiva. Cada pane conserva
sus campos, selectores, switches, checkboxes, steppers, tablas, wizards,
generación y descargas en el JSON.

Fuentes: `frontend/src/features/analitica/**/*`.

### Gráficos

Pestañas/contextos: Timeline, Canvas; Inspector Contenido/Datos/Estilo/Filtros;
Estilo global Base PPT/Base Word/Color e identidad/Íconos/Estilos guardados.
Incluye undo/redo, densidad, salud, plan sugerido, placeholders, compartir,
exportar, limpiar, biblioteca de slides, slots, variables, argumentos,
espaciado, filtros, previews y selección múltiple.

Fuentes: `frontend/src/features/graficos/**/*`.

## Dashboard

### Tablero

- Resumen: filtros, N, donuts, KPI, sección, Plotly, categorías, añadir y
  restablecer.
- Relaciones: variable principal, cruces, iteración, secciones, filtros,
  fullscreen y series.
- Base de datos: Códigos/Etiquetas, todas/ninguna, secciones/variables,
  XLSX/CSV, tabla, diccionario, búsqueda, filtros y paginación.
- Dimensiones: Indicador, grupos, desglose, muestra; General/Indicadores;
  Construcción, Heatmap, Barras, Radar, FODA, Matriz y fullscreen.

Fuentes: `frontend/src/features/dashboard/tabs/**/*`.

### Configuración

Pestañas/contextos: Datos, Paletas, Personalizar, Vista previa y Publicación.
Incluye fuente/curación, switch incluir, checks por sección/variable,
confirmación, presets cromáticos, slots de logo, pestañas habilitadas, vistas
FODA, matriz, iconos, gráficos, semáforo, dimensiones, deploy y resultado.

Fuentes: `frontend/src/features/dashboard/source/**/*`,
`curation/**/*`, `palettes/**/*`, `customize/**/*`, `publish/**/*`.

## Enciclopedia

### Enciclopedia metodológica

Pestañas: Catálogo, Glosario, Comparador, Estudios y Tipos. Incluye búsqueda,
filtros, tarjetas, tipos, comparaciones y navegación hacia fichas.

### Ficha metodológica

Pestañas: Definición, Fórmulas, Parámetros, Decisiones y Aplicaciones. Incluye
fórmulas, metadatos, tablas, listas, enlaces y navegación contextual.

Fuentes: `frontend/src/features/enciclopedia/EnciclopediaHome.tsx`,
`frontend/src/features/enciclopedia/FichaMetodologica.tsx`.

## Estados y excepciones conservados

- Los estados loading, error, vacío, disabled, checked, selected, open,
  required, invalid y busy se guardan por ocurrencia.
- Las condiciones de render conservan permisos, manifest, tipo de base,
  disponibilidad de datos, fase, perfil y estado del proyecto.
- `PanoramaTab`, `EnumeradoresPane` y componentes legacy de Gráficos se
  mantienen como declarados inactivos.
- Plotly, mapas, SVG, canvas, QR y documentos paginados se complementan en
  `declaredVisualSurfaces`.
- Los acentos de módulo se registran por separado de colores semánticos y
  paletas de datos.
