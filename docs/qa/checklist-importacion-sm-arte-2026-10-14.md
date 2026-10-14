# Checklist — importación SurveyMonkey → Formularios (Arte y Diseño 2026)

Fecha: 2026-10-14 · Objetivo: comprobar que el editor de Formularios importe bien, y con una UI intuitiva, los formularios SurveyMonkey de Arte y Diseño 2026.

## Corpus

| Survey | Formulario | Respuestas | Preguntas SM | Páginas | Filas XLSForm |
|---|---|---|---|---|---|
| 528294775 | Estudiantes (principal) | 307 | 28 | 17 | 126 |
| 423593924 | Estudiantes, campaña por correo | 0 | 27 | 17 | 125 |
| 528294399 | Docentes | 124 | 34 | 21 | 155 |
| 528294886 | Administrativos | 93 | 15 | 10 | 60 |

No hay formulario de Egresados de Arte 2026 en la cuenta «Principal».

## Fase 1 — API (`sm_api_fetch_survey_details` → `sm_api_xlsform`)

Lo que sale bien: 0 preguntas, filas de matriz u opciones perdidas en los cuatro; matrices → una fila por ítem + nota con el enunciado; «Otro (especifique)» → `_other` con `relevant`; obligatorias y validaciones (`integer`, `text_length`) pasan como `required`/`constraint`; nombres únicos y válidos; 1–2 s por formulario.

| # | Hallazgo | Dónde vive | Estado |
|---|---|---|---|
| H1 | El perfil SM activo por defecto («Tercero») y «Secundario» dan HTTP 401; solo «Principal» autentica. La importación desde la UI falla con el perfil por defecto | Perfiles de conexión (secretos locales del equipo) | confirmado en UI; desbloqueado al activar «Principal» (ver B1). Los tokens vencidos siguen guardados |
| H2 | **Campañas complementarias de un mismo instrumento.** La campaña por correo (423593924) es el instrumento de Estudiantes sin «¿Cuál es su código PUCP?». Importada como formulario aparte, el traductor nombra por posición y desde ahí todo se corre una posición (`p5`→`p4`, `p13_1`→`p12_1`…). **Criterio del usuario:** la campaña no es un instrumento nuevo; el analista debe poder **declararla como campaña complementaria dentro del instrumento existente** (o tener la oportunidad de hacerlo al importarla). A nivel de XLSForm casi no cambia nada (rige el principal); lo que importa es dejar **mapeado** que, de cara a Procesamiento, la data puede venir de ambas encuestas o solo de la principal, y que hay que armonizarla. **Ya existe** la armonización del lado de Carga (ADR 0099): una base junta varias encuestas SM y las empareja por pregunta, no por posición; la pregunta que no está en una fuente queda vacía para sus filas. Falta el eslabón: declararlo en Formularios y que esa declaración llegue a la base | Formularios (declaración de la campaña) → Carga: `surveymonkey_multibase_alineacion.R` (ADR 0099), `add-source` en `router_carga.R` | pendiente — **hallazgo principal**; requiere diseño (dónde se declara y cómo llega a Carga), posible ADR |
| H3 | «SIN INF» tiene peso 99 en SM y sale con código 5 (posición) en el XLSForm; afecta 13–17 preguntas por formulario. El estándar de valores especiales de la casa usa 99 | `.sm_api_*` choices (`surveymonkey_api.R` ~1440) | **bloqueado** — decisión del usuario: ¿peso SM o posición? |
| H4 | La API no expone la lógica de saltos: el XLSForm queda sin saltos (p. ej. «¿Desea continuar con la encuesta?» no corta con «No»). Depende del paso manual de reglas del editor | `import-surveymonkey-with-logic` (`reglas`) | pendiente — verificar en UI |
| H5 | Los títulos de página de SM («Datos generales», «Propósitos de la PUCP») se reemplazan por «Pag2 (p2-p6)» | `.sm_build_page_remap` (`surveymonkey_traduccion.R`) | pendiente |
| H6 | Espacios antes de puntuación en 7–20 etiquetas por formulario («de la PUCP ?», «Unidad .»): `.sm_api_clean_text` cambia cada etiqueta HTML por un espacio | `surveymonkey_api.R:1495` | pendiente |
| H7 | Escalas idénticas no se deduplican (Docentes: 31 listas, 7 distintas) | `sm_api_xlsform` | pendiente — menor |
| H8 | La hoja `diagnostico` nombra las matrices `q0010` mientras `survey` usa `p10_*` | `diagnostico` en `sm_api_xlsform` | pendiente — menor |
| H9 | No se importan la imagen de portada ni la variable personalizada `id` (Docentes, Administrativos) | `sm_api_xlsform` | pendiente — menor |

## Fase 2 — UI (editor de Formularios)

Recorrido: copia temporal de `acrconta` (`outputs/reference-runs/acrconta-20261014-071801/`), backend 8822, 1440×1000. Importados: Estudiantes 528294775 y la campaña por correo 423593924.

| # | Hallazgo | Dónde vive | Estado |
|---|---|---|---|
| B1 | **Bug: el perfil heredado «Principal» (`id=default`) no se podía activar.** `.connections_save_profile_manifest` descartaba los perfiles heredados y luego reemplazaba en silencio el perfil por defecto por el primero guardado («Secundario»). La UI decía «Perfil activo: Principal» mientras el backend activaba otro. Segundo síntoma, del mismo origen: con «Principal» activo, guardar cualquier otro perfil le quitaba el activo | `api/R/router_connections.R` (`.connections_save_profile_manifest`) | **arreglado** — 2 casos de regresión en `test-architecture-secrets.R` (rojos con HEAD); gate del área 169/0; `verificador`: aprobado; verificado en UI (Secundario→Principal) |
| U1 | El «+» abre «¿Cómo quieres empezar?» debajo del pliegue sin desplazar la vista: parece que no pasó nada | Espacio de formularios (biblioteca) | pendiente |
| U2 | El diálogo de importación no tiene selector de perfil: con un token vencido solo dice «No pude conectar. Revisa o genera un token nuevo.» y no menciona que hay otros perfiles en Configuración | Diálogo «Traducir encuesta de SurveyMonkey» | pendiente |
| U3 | Configuración muestra el perfil vencido en verde, con «Lista para importar encuestas y respuestas», y los tres perfiles como «Disponible»: no prueba el token (verde por ausencia) | `GlobalSettingsDialog` › Conexiones | pendiente |
| U4 | Con conexión lista, la cabecera del diálogo sigue en «Conexión: Pendiente» hasta elegir una encuesta | Diálogo de importación | pendiente — menor |
| U5 | El buscador de encuestas no muestra respuestas ni preguntas: «Estudiantes» (307 resp., 28 preg.) y la campaña por correo (0 resp., 27 preg.) se ven iguales | Buscador del diálogo | pendiente |
| U6 | Jerga técnica en inglés para el usuario: «la API también trae 26 required y 2 validations»; en el resumen, «Huella 42f8…» y «Perfil surveymonkey_api_xlsform/v1» | Diálogo de importación (confirmación y resumen) | pendiente |
| U7 | El resumen dice que se traducen «estructura, matrices, saltos…» con «Reglas: 0» y «Saltos: Opcional»: promete saltos que la API no entrega y no avisa que el consentimiento (p1) queda sin corte (ligado a H4) | Resumen antes de crear el borrador | pendiente |
| U8 | La misma importación da tres conteos distintos: diálogo «26 preguntas / 74 variables», outline «92 preguntas · 17 secciones», cabecera «109 piezas» | Diálogo, outline y cabecera del editor | pendiente |
| U9 | Los títulos de sección exponen nombres internos: «Pag2 (p2-p6_other)» (ligado a H5: la vista previa mostraba «Datos generales» y avisaba «Se creará como Pag2») | `.sm_build_page_remap` | pendiente |
| U10 | La cabecera del editor dice «Sin avisos» en verde mientras la tarjeta de la biblioteca marca «Lógica: Revisión necesaria» | Cabecera del editor vs. tarjeta | pendiente |
| U11 | El público queda en «Elige un público» aunque el título SM dice «Estudiantes» | Tarjeta del formulario importado | pendiente — menor |
| U12 | El límite de 6 formularios por proyecto se alcanza rápido: Arte 2026 son 4 formularios más su campaña por correo (con Egresados, 6). Para importar la variante hubo que liberar espacio | Límite de formularios del espacio | pendiente — decidir si el límite cubre un estudio multiactor con campañas |
| U13 | En la UI no hay forma de importar una campaña dentro de un formulario existente: el diálogo solo crea formularios nuevos, no ofrece «agregar como campaña de…», y al crear el borrador de 423593924 no aparece ningún aviso de que ya existe uno casi idéntico (26 de 27 preguntas iguales). Es la cara de UI de H2: la campaña ocupa un espacio del límite (U12) y queda como un instrumento duplicado que Carga no sabe asociar | Diálogo de importación + biblioteca de formularios | pendiente — hallazgo principal junto con H2 |
