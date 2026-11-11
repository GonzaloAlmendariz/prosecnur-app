# Checklist: pestaña Plantillas en Procesamiento > Gráficos (2026-11-11)

Pedido de Gonzalo: el plan del informe deja de ser un popover ("Armar desde") y pasa a ser una pestaña propia de
Gráficos, presentada como un menú de plantillas. El analista elige la plantilla y controla qué entra: secciones
completas y preguntas al mismo nivel, como en los informes de Kobo, con el gráfico de cada pregunta. Prototipo aprobado
el 2026-11-11 (`tmp/prototipo-plantillas/index.html`, con los datos del RMS 2026). Sólo Gonzalo da por terminado cada
ítem.

Estados: **pendiente**, **en curso**, **resuelto** (test y vista revisada), **bloqueado** (necesita decisión).

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| 1 | La pestaña "Plantillas" es la primera de Gráficos y es enlazable (`/graficos?pestana=plantillas`) | `lib/navegacion/catalogos/procesamiento.ts`, `GraficosPage.tsx`, `features/graficos/plantillas/` | resuelto: contratos de navegación; vista en vivo con `acnur_pdm` a 1440x1000 y 1024x600 |
| 2 | Menú de plantillas: cada una trae estructura, identidad y reglas | `plantillas/catalogoPlantillas.ts` | resuelto: ACNUR general, ACNUR territorial (deshabilitada con su motivo si no hay territorio), Informe Pulso y En blanco |
| 3 | Secciones con interruptor, en el orden del cuestionario, con cuántas preguntas entran y cuántas láminas suman | `graficos_estructura_informe.R` + `POST /api/graficos/plan/estructura` + panel | resuelto: tests R y vitest; en vivo, apagar la sección "Acceso" (4 preguntas) bajó 76 a 70 láminas y 15 a 14 secciones |
| 4 | Preguntas con interruptor, tipo y selector de gráfico | `scope_rules.grafico_por_pregunta` + `graficos_grafico_por_pregunta.R` | resuelto: Barras, Barras de mayor a menor, Columnas (hasta seis opciones) y Torta (sólo Sí / No; Gonzalo pidió torta en vez de dona), comprobados en render ACNUR con el RMS. La barra al 100 % queda pendiente (abajo) |
| 5 | Lo que se deja fuera se guarda y se respeta al volver a crear las láminas | `scope_rules.coverage_exclusions` | resuelto: en vivo, "Reemplazar" creó 70 láminas, sin la sección "Acceso" ni "Salas de atención individual" |
| 6 | "Crear láminas" arma el plan con la plantilla y la selección | panel + `aplicarPlanSugerido` | resuelto: reemplaza (o agrega al final si ya hay láminas) en un paso deshacible y pasa a Láminas |
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

## Pendientes

| # | Pendiente | Cómo se comprobó |
|---|---|---|
| P1 | Barra al 100 % en el selector de gráfico | Torta y columnas resueltas el 2026-11-11: las columnas van por `p_barras_categoricas` (el render fuerza las agrupadas al lienzo horizontal y salían "Sin datos") y la torta y las columnas toman los azules ACNUR de los presets del perfil. La barra al 100 % (`p_barras_apiladas`) toma su color de la paleta de la lista por nombre o firma; el perfil ACNUR sólo trae `yesno` y `likert`, así que una lista `yesnoDnPs` cae al azul Pulso. Falta decidir una paleta por defecto del perfil para cualquier lista |
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
