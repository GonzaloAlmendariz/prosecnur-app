# Checklist: pestaña Plantillas en Procesamiento > Gráficos (2026-11-11)

Tipo: Checklist QA fechado
Estado: En curso
Fecha: 2026-11-11
Autoridad: Evidencia de la ejecución que documenta; no reemplaza contratos ejecutables ni ADR aceptados

Pedido de Gonzalo: el plan del informe deja de ser un popover ("Armar desde") y pasa a ser una pestaña propia de
Gráficos, presentada como un menú de plantillas. El analista elige la plantilla y controla qué entra: secciones
completas y preguntas al mismo nivel, como en los informes de Kobo, con el gráfico de cada pregunta. Prototipo aprobado
el 2026-11-11 (prototipo local no versionado, con los datos del RMS 2026). Sólo Gonzalo da por terminado cada
ítem.

Estados: **pendiente**, **en curso**, **resuelto** (test y vista revisada), **bloqueado** (necesita decisión).

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| 1 | La pestaña "Plantillas" es la primera de Gráficos y es enlazable (`/graficos?pestana=plantillas`) | `lib/navegacion/catalogos/procesamiento.ts`, `GraficosPage.tsx`, `features/graficos/plantillas/` | resuelto: contratos de navegación; vista en vivo con `acnur_pdm` a 1440x1000 y 1024x600 |
| 2 | Menú de plantillas: cada una trae estructura, identidad y reglas | `plantillas/catalogoPlantillas.ts` | resuelto: ACNUR general, ACNUR territorial (deshabilitada con su motivo si no hay territorio), Informe Pulso y En blanco |
| 3 | Secciones con interruptor, en el orden del cuestionario, con cuántas preguntas entran y cuántas láminas suman | `graficos_estructura_informe.R` + `POST /api/graficos/plan/estructura` + panel | resuelto: tests R y vitest; en vivo, apagar la sección "Acceso" (4 preguntas) bajó 76 a 70 láminas y 15 a 14 secciones |
| 4 | Preguntas con interruptor, tipo y selector de gráfico | `scope_rules.grafico_por_pregunta` + `graficos_grafico_por_pregunta.R` | resuelto: Barras, Barras de mayor a menor, Columnas (hasta seis opciones), Torta (sólo Sí / No; Gonzalo pidió torta en vez de dona) y Barra al 100 % (Sí / No y escalas), comprobados en render ACNUR con el RMS |
| 5 | Lo que se deja fuera se guarda y se respeta al volver a crear las láminas | `scope_rules.coverage_exclusions` | resuelto: en vivo, "Reemplazar" creó 70 láminas, sin la sección "Acceso" ni "Salas de atención individual" |
| 6 | "Crear láminas" arma el plan con la plantilla y la selección | panel + `aplicarPlanSugerido` | resuelto: reemplaza el informe en un paso deshacible y pasa a Láminas. Una plantilla siempre reemplaza (Gonzalo, 2026-11-11): "Agregar al final" se quitó |
| 7 | "Guardar como plantilla": la selección se guarda en el proyecto y se reusa | `scope_rules.plantillas_guardadas` | resuelto: tests del modelo (guardar, reusar, reemplazar por nombre, borrar); sin prueba en vivo |
| 8 | "Armar desde" deja de ser un popover y lleva a la pestaña | `SuggestedPlanButton.tsx`, `BotonArmarDesdeVacio.tsx`, `plantillas/useIrAPlantillas.ts` | resuelto en la base activa (botón, vacío y enlaces viejos con `panel=armar-desde`). El popover sigue en el informe compartido entre bases, porque la estructura por pregunta trabaja sobre una base |
| 9 | Cobertura deja de ser el lugar donde se excluye: resumen, todo alcanzable, sin el aviso largo | `PlanCoverageBadge.tsx`, `coberturaResumen.css` | resuelto: avisos plegados, "Ver las N" muestra todas, conteos sin las columnas heredadas y acceso "Ir a Plantillas" |

## Decisiones tomadas por defecto (Gonzalo no respondió; se pueden cambiar)

- Las secciones operativas (consentimiento, intentos, cierre del encuestador) vienen **encendidas**: el analista las
  apaga. El motor no adivina qué sección es operativa.
- El menú sólo muestra plantillas que producen un informe completo. Las de arranque con espacios vacíos ("Reporte
  ejecutivo", "Análisis poblacional", "Acreditación multi-base" de `.TEMPLATES_META`) quedan fuera hasta comprobarlas.
- El selector de gráfico sólo ofrece los gráficos que el motor dibuja en la ruta de cada plantilla y que se comprobaron
  en render.
- Paleta por defecto de la plantilla ACNUR (Gonzalo pidió definirla, 2026-11-11): una lista sin paleta propia toma el
  azul ACNUR en la primera opción, azules más claros en las siguientes y grises para la no respuesta (no sabe, no
  responde, otro), uno distinto por opción. Vive en `lamina_plantilla_cliente.R` y sólo rige con plantilla de cliente.

## Pendientes

| # | Pendiente | Cómo se comprobó |
|---|---|---|
| P2 | Con "Barras de mayor a menor", una lista paginada ordena dentro de cada página y no en el total | HACC04 del RMS: la página 1 y la 2 se ordenan por separado |
| P3 | La estructura tarda lo que el plan sugerido (unos 40 s en el RMS) cada vez que se cambia de plantilla | medido con `.graficos_estructura_informe` sobre el RMS |
| P4 | Sin matriz automática de QA: `ui-quick-check` arranca la API con `launcher/launch.R`, que reinstala el paquete R; no se corrió para no tocar la librería con trabajo sin commitear de otras sesiones | revisión en vivo con una pila propia sin reinstalar |
| P5 | Plantillas de arranque del backend ("Reporte ejecutivo", "Análisis poblacional", "Acreditación multi-base") fuera del menú | `.TEMPLATES_META` arma láminas con espacios vacíos |

## Lo aprendido al armar

- El plan sugerido ya respeta `scope_rules.coverage_exclusions`: con siete variables operativas fuera, el RMS pasó de
  162 a 151 láminas y las tres secciones operativas salieron del mazo y del índice (2026-11-11).
- Un handler de plumber que lee el cuerpo debe aceptar `...`: plumber pasa los campos del JSON como argumentos con
  nombre y, sin `...`, el endpoint respondía `E_INTERNAL` "unused argument (config = ...)". Lo fija un test.
- `scope_rules` viaja entero entre front y R (normalizador del front y `.graficos_normalize_config`), así que una clave
  nueva dentro de él no cruza las cuatro listas de campos de la config.
- La barra al 100 % con plantilla ACNUR salía con la leyenda sobre el logo de Pulso y la base bajo el pie: el lienzo
  ocupa el alto del marcador de la plantilla, que entra al pie. El preset ACNUR reserva la franja del pie y el
  graficador dibuja la base encima de esa reserva (render del RMS, REF03 y SAF01, 2026-11-11).
- "Prefiere no responder" no lo reconocía el detector de no respuesta del motor; la pestaña y la paleta usan ahora una
  sola regla (`.graficos_rotulo_residual`).

## Revisión en vivo con el RMS ACNUR (2026-11-11, pedido de Gonzalo)

Pila propia (backend con el código fuente, sin reinstalar el paquete) y un `.pulso` del RMS 2026 con su base principal y
dos grupos repetibles. Recorrido a 1440x1000 y 1024x600.

| # | Qué se probó | Resultado |
|---|---|---|
| V1 | Plantilla de partida en un proyecto ACNUR cuyo archivo no dice ACNUR | corregido: partía de "Informe Pulso". Ahora lee también la Ficha del estudio (nombre, código y cliente); con cliente "ACNUR Perú" parte de "ACNUR general". El backend usa la misma ficha para elegir el perfil ACNUR (`.graficos_ficha_del_estudio`, con test) |
| V2 | Secciones y preguntas del RMS con ACNUR | 161 láminas, 9 secciones, 146 preguntas; los grupos repetibles en su sección. "Información de la encuesta" lleva los intentos de visita y "Visitas del encuestador" la oficina, el país y el grupo de población: así los rotula el propio formulario |
| V3 | Selector de gráfico en una Sí / No (HH05) | ofrece Barras, Torta, Barra al 100 % y Columnas; la elección queda en `grafico_por_pregunta` |
| V4 | Apagar secciones y crear láminas | apagar "Consentimiento" y "Visitas del encuestador" bajó 161 a 155; "Crear láminas" armó 155 con perfil y plantilla ACNUR, HH05 como barra al 100 % y pasó a Láminas |
| V5 | Avisos del plan recién creado | corregido: salía con 141 avisos "se leen de la base principal sin que el plan lo diga". "Crear láminas" fija ya la base de cada pregunta en un estudio con varias bases: 0 avisos |
| V6 | Maqueta de la lámina en Láminas | corregido: el título de la pregunta salía de unas 9 pulgadas sobre la lámina. La clase del texto de la ficha (`pulso-ficha-pregunta`) era también la del bloque de pregunta del kit, cuyo `font-size` pisaba el del SVG. Clase propia y contrato que impide que una clase de la ficha se defina fuera de la maqueta (visto rojo con la clase vieja) |
| V7 | Guardar como plantilla | "RMS versión cliente" quedó con base ACNUR, 4 preguntas fuera y la barra al 100 % de HH05 |
| V8 | Estado de carga | corregido: el aviso de carga ("Leyendo las secciones y preguntas del cuestionario") iba en rojo de error; ahora en el gris del texto |
| V9 | 1024x600 | sin desborde horizontal; el contenido del informe se desplaza dentro de su marco |

Sin probar en vivo: la exportación del PPT desde la app (el job corre con el paquete instalado, que no tiene estos cambios
hasta reinstalarlo). El render del motor se comprobó aparte con el RMS.
