# Censo de descargas (2026-11-07)

Todas las formas en que Prosecnur genera algo y lo entrega como archivo, portapapeles o publicación. Fuente de verdad en JSON junto a este documento: `backend.json` (salidas del motor R), `frontend.json` (disparadores en la UI) y `entrega.md` (Electron, jobs, publicaciones y componentes de espera). Todo sale de leer el código; nada se ejecutó.

## Cobertura

- Backend: 164 salidas (148 archivos, 16 publicaciones fuera). Las 99 líneas de la semilla de grep quedan mapeadas a una fila o a una exclusión con motivo (`semilla_mapeo`).
- Frontend: 141 disparadores (156 apariciones en pantalla). Las 152 líneas de su semilla quedan resueltas; 34 son falsos positivos o definiciones con motivo.
- Cruce endpoint por endpoint (`cruce_backend`): de 40 endpoints del backend sin fila en el front, 6 eran disparadores que faltaban (agregados), 9 ya estaban cubiertos con otro nombre, 6 quedan fuera a propósito y 19 no tienen llamador vivo. Los 5 endpoints del front sin fila en el backend son rutas reales que no producen archivo o nombres corregidos.

## Defectos que el censo destapó

Rotos hoy, independientes de la unificación:

1. **`window.open(downloadUrl(...))` no hace nada en Electron** (22 disparadores): `setWindowOpenHandler` siempre deniega y la URL del backend no cuenta como externa (`desktop/main.cjs:1814`, `desktop/security.cjs:45-56`). Desde `c278f8922` (2026-07-30). Pega en Material de campo, Hojas de ruta, Cálculo de muestra, Codificación, Monitoreo territorial y la acción «Descargar» de los toasts del Editor.
2. **Nombre con el UUID del job a la vista**: los PDF de Monitoreo (`/pdf/download`), el reporte de Cálculo de muestra y el de Hojas de ruta usan `basename(meta$path)`.
3. **`/api/muestra-aulas/reporte/descargar` no existe** en el backend y el front lo sigue apuntando (`frontend/src/api/calcMuestra.ts:254`).
4. **Dashboard › Base de datos › «Descargar» falla en silencio**: sin `.catch` (`BaseDatosTab/index.tsx:65`); en modo público además no está en la whitelist (`api/R/forbid_mutations.R`).
5. **Spinner que no gira**: clase `spin` inexistente en Monitoreo territorial › Ocurrencias («Excel UMP», «XLSForm», «Subir Kobo»).
6. **Validación › «Cerrar y generar base»** produce base limpia y decisiones que la UI nunca ofrece descargar.
7. **«Actualizar» de Monitoreo aulas** vuelve a publicar el libro en Sheets sin decirlo.
8. **Portapapeles sin el respaldo de Electron** en NoBarridos, Discrepancias, PanelSurveyMonkey y PanelMailchimp.
9. **`Content-Disposition` sin codificar** (`api/R/router_sistema.R:800`): nombres con tilde pueden llegar mal.
10. **`/api/fs/save-to-project` rechaza tildes y más de 80 caracteres** (`^[A-Za-z0-9_.-]{1,80}$`), y `.export_filename()` puede pasar ese largo.
11. **Nombres iguales para contenidos distintos**: ZIP de CSV y ZIP de XLSX (`<proyecto>_datos_<fecha>.zip`), todas las vistas previas de lámina, libro de códigos en ZIP/XLSX/PDF.
12. **Paquete de evidencia de Monitoreo escribe fuera de la sesión** (`tmp/qa/monitoreo-deliverables/`, relativo al cwd del proceso R).


## Contenedores y forma de la tarjeta

Cada disparador lleva `contenedor` en `frontend.json`; los 17 ejemplos con su layout literal están en `contenedores.json`. La tarjeta de generación toma una de tres formas según el contenedor (prototipo, vista «Por contenedor»).

| Contenedor | Disparadores | Forma propuesta |
|---|---|---|
| Tarjeta o sección | 49 | Bloque |
| Pie de panel | 29 | Bloque |
| Barra de comandos | 16 | Anclada |
| Menú desplegable | 16 | Anclada |
| Diálogo o cajón | 11 | Bloque |
| Cabecera de panel | 9 | Bloque |
| Fila de tabla | 6 | En la fila |
| Enlace en texto | 4 | Se retira |
| Aviso o toast | 1 | Se retira |

Hoy la espera aparece en al menos seis posiciones respecto del botón (en el botón, justo debajo, al pie del panel, fuera del menú, arriba del workbench, ninguna) y el resultado sigue tres convenciones (enlace con segundo clic, pestaña nueva automática, toast).

## Resumen del estado actual

**Disparadores por módulo**

| Valor | Filas |
|---|---|
| procesamiento/analitica | 27 |
| procesamiento/graficos | 12 |
| monitoreo/territorial | 12 |
| material-campo/correo | 11 |
| material-campo/territorial | 11 |
| material-campo/aulas | 10 |
| monitoreo/aulas | 9 |
| monitoreo/telefonico | 7 |
| editor-xlsform | 6 |
| procesamiento/codificacion | 6 |
| monitoreo/acreditacion | 6 |
| calc-muestra | 6 |
| tablero | 4 |
| procesamiento/carga | 3 |
| hojas-ruta | 3 |
| procesamiento/validacion | 2 |
| monitoreo (acreditacion, telefonico, territorial, aulas) | 2 |
| material-campo/telefonica | 2 |
| material-campo/supervision | 2 |

**Disparadores por transporte**

| Valor | Filas |
|---|---|
| file_store_download | 30 |
| abre_pestaña | 29 |
| save_dialog_electron+save_file_as | 26 |
| blob_front | 19 |
| publica_fuera | 14 |
| portapapeles | 10 |
| otro | 8 |
| save_to_project | 5 |

**Pantalla de carga (23 variantes)**

| Valor | Filas |
|---|---|
| nada | 27 |
| texto_en_boton | 27 |
| boton_spinner_generando | 13 |
| spinner_inline_en_boton | 12 |
| boton_spinner+jobprogress | 12 |
| boton_con_progreso+jobstatusline | 7 |
| jobprogress | 6 |
| spinner_boton+jobprogress | 5 |
| solo_disabled | 5 |
| spinner_boton+texto_estado | 5 |
| alert+spinner_boton+jobprogress | 3 |
| spinner_inline_en_boton (roto) | 3 |
| texto_en_boton_con_fases_job | 2 |
| loadingblock_inline_lejano | 2 |
| texto_en_boton+jobprogress | 2 |
| spinner_boton_generando | 2 |
| checklist_por_pasos+banner | 2 |
| panel_loadingblock_inline | 1 |
| tarjeta_spinner | 1 |
| texto_feedback | 1 |
| spinner_inline_texto | 1 |
| boton_con_progreso | 1 |
| spinner_boton+texto | 1 |

**Salidas del backend por formato**

| Valor | Filas |
|---|---|
| xlsx | 54 |
| zip | 23 |
| pdf | 22 |
| json | 12 |
| Google Sheets | 8 |
| csv | 7 |
| docx | 6 |
| html | 5 |
| png | 4 |
| sav | 3 |
| pptx | 3 |
| Mailchimp | 3 |
| md | 2 |
| pulso | 2 |
| R | 1 |
| xlsx\|csv\|sav (extensión del archivo fuente) | 1 |
| zip (.pulso-graficos.zip) | 1 |
| cualquiera (la del file_id) | 1 |
| cualquiera | 1 |
| Google Sheets (documento nuevo) | 1 |
| Google Sheets (hoja ajena, celda a celda) | 1 |
| KoboToolbox (asset desplegado) | 1 |
| Google Drive (carpeta «Fichas QR - <estudio>») | 1 |
| Hugging Face Space | 1 |

**Salidas del backend por naturaleza**

| Valor | Filas |
|---|---|
| entregable | 118 |
| publicacion | 16 |
| evidencia | 9 |
| vista | 7 |
| intercambio | 6 |
| manifest | 4 |
| proyecto | 4 |

**Nombre**: 96 salidas usan `.export_filename()`; el resto arma su nombre por su cuenta. Conviven seis formatos de fecha (`dd_mm_yy`, `%Y%m%d-%H%M%S`, `%Y%m%d_%H%M%S` UTC, ISO, timestamp ISO hecho slug y ninguno).

## Disparadores en la UI

| ID | Módulo | Rótulo | Salida | Formato | Transporte | Carga | Destino | Nombre |
|---|---|---|---|---|---|---|---|---|
| XF-01 | editor-xlsform | Exportar .xlsx | XLSForm editado del formulario activo (destino Kobo/ODK o Prosecnur según el caret) | xlsx | save_to_project (con proyecto) \| file_store_download vía toast «Descargar» window.open (sin proyecto o si falla el guardado) | panel_loadingblock_inline | carpeta del .pulso (raíz, subdir null), sobrescribe; sin proyecto: descargas del navegador/Electron | backend original_name a partir de cleanFilename(source.original_name) (p.ej. instrumento_editado.xlsx); se guarda con entregableStem(original_name) y overwrite:true, sin preguntar |
| XF-02 | editor-xlsform | Exportar PDF | Cuestionario impreso del formulario (portada, lógica, matrices) | pdf | save_to_project \| file_store_download vía toast «Descargar» (window.open) | texto_en_boton_con_fases_job | carpeta del .pulso (raíz), sobrescribe; sin proyecto: descargas vía window.open | front: pdfFilenameFromSource(source.original_name) (x_editado.xlsx → x_papel.pdf); guardado con entregableStem(original_name), overwrite:true |
| XF-03 | editor-xlsform | Exportar Word | Cuestionario impreso editable | docx | save_to_project \| file_store_download vía toast «Descargar» (window.open) | texto_en_boton_con_fases_job | carpeta del .pulso (raíz), sobrescribe; sin proyecto: descargas | front: wordFilenameFromSource (x_editado.xlsx → x_papel.docx); entregableStem, overwrite:true |
| XF-04 | editor-xlsform | Descargar .xlsx \| Descargar .pdf \| Descargar .docx | El último artefacto exportado (re-guardado con nombre elegido) | xlsx \| pdf \| docx | save_to_project (con proyecto) \| file_store_download (sin proyecto) | spinner_inline_en_boton | carpeta del .pulso (raíz); sin proyecto: descargas | input editable del usuario (FilenameInput) con default original_name sin extensión; detecta colisiones |
| XF-05 | editor-xlsform | Descargar (acción del toast) | El XLSForm/PDF/Word recién exportado | xlsx \| pdf \| docx | abre_pestaña (window.open _blank sobre file store) | nada | descargas del navegador/Electron (pestaña nueva) | backend original_name (Content-Disposition del file store) |
| XF-06 | editor-xlsform | Exportar lógica JSON | Paquete JSON con las reglas de lógica SurveyMonkey del formulario | json | blob_front | texto_en_boton | descargas | front literal: pulso_surveymonkey_logic_<Date.now()>.json |
| AN-01 | procesamiento/analitica | Generar Excel | Libro de códigos | xlsx (zip si multibase) | save_dialog_electron+save_file_as (Electron: el diálogo se abre solo al terminar) \| file_store_download (pastilla .analitica-download-pill <a href=downloadUrl> sin atributo download) | boton_spinner_generando | Electron: diálogo nativo con carpeta del .pulso por defecto; navegador: descargas | backend filename (zip si multibase) ?? literal del front «libro_de_codigos.xlsx»; en Electron editable en el diálogo nativo |
| AN-02 | procesamiento/analitica | Generar PDF | Libro de códigos en PDF | pdf | save_dialog_electron+save_file_as (Electron: el diálogo se abre solo al terminar) \| file_store_download (pastilla .analitica-download-pill <a href=downloadUrl> sin atributo download) | boton_spinner_generando | Electron: diálogo nativo con carpeta del .pulso por defecto; navegador: descargas | backend filename (zip si multibase) ?? literal del front «libro_de_codigos.pdf»; en Electron editable en el diálogo nativo |
| AN-03 | procesamiento/analitica | <nombre del archivo> (p.ej. xlsform_final.xlsx) / chips por base | XLSForm final con las mismas etiquetas/exclusiones de la corrida del libro | xlsx (zip si multibase) | file_store_download | nada | descargas (navegador y Electron; NO abre diálogo aunque el libro hermano sí) | backend filename ?? literal «xlsform_final.xlsx» (atributo download) |
| AN-04 | procesamiento/analitica | Descargar respuestas | Respuestas codificadas tal como quedaron | xlsx | save_dialog_electron+save_file_as (Electron: el diálogo se abre solo al terminar) \| file_store_download (pastilla .analitica-download-pill <a href=downloadUrl> sin atributo download) | boton_spinner_generando | Electron: diálogo nativo con carpeta del .pulso por defecto; navegador: descargas | backend filename (zip si multibase) ?? literal del front «data_codificada.xlsx»; en Electron editable en el diálogo nativo |
| AN-05 | procesamiento/analitica | Descargar formulario | Instrumento codificado | xlsx | save_dialog_electron+save_file_as (Electron: el diálogo se abre solo al terminar) \| file_store_download (pastilla .analitica-download-pill <a href=downloadUrl> sin atributo download) | boton_spinner_generando | Electron: diálogo nativo con carpeta del .pulso por defecto; navegador: descargas | backend filename (zip si multibase) ?? literal del front «instrumento_codificado.xlsx»; en Electron editable en el diálogo nativo |
| AN-06 | procesamiento/analitica | Descargar SAV para SPSS | Base SAV (+ .sps en zip si incluir_sps) | sav \| zip | save_dialog_electron+save_file_as (Electron: el diálogo se abre solo al terminar) \| file_store_download (pastilla .analitica-download-pill <a href=downloadUrl> sin atributo download) | boton_spinner_generando | Electron: diálogo nativo con carpeta del .pulso por defecto; navegador: descargas | backend filename (zip si multibase) ?? literal del front «datos.sav / bases_sav.zip»; en Electron editable en el diálogo nativo |
| AN-07 | procesamiento/analitica | Descargar CSV | Base en CSV con separador y valores elegidos | csv | save_dialog_electron+save_file_as (Electron: el diálogo se abre solo al terminar) \| file_store_download (pastilla .analitica-download-pill <a href=downloadUrl> sin atributo download) | boton_spinner_generando | Electron: diálogo nativo con carpeta del .pulso por defecto; navegador: descargas | backend filename (zip si multibase) ?? literal del front «datos.csv»; en Electron editable en el diálogo nativo |
| AN-08 | procesamiento/analitica | Descargar Excel | Base en Excel (valores/etiquetas, dummies) | xlsx | save_dialog_electron+save_file_as (Electron: el diálogo se abre solo al terminar) \| file_store_download (pastilla .analitica-download-pill <a href=downloadUrl> sin atributo download) | boton_spinner_generando | Electron: diálogo nativo con carpeta del .pulso por defecto; navegador: descargas | backend filename (zip si multibase) ?? literal del front «datos.xlsx»; en Electron editable en el diálogo nativo |
| AN-09 | procesamiento/analitica | Descargar script de replicación | Script R que replica la base | R | save_dialog_electron+save_file_as (Electron: el diálogo se abre solo al terminar) \| file_store_download (pastilla .analitica-download-pill <a href=downloadUrl> sin atributo download) | boton_spinner_generando | Electron: diálogo nativo con carpeta del .pulso por defecto; navegador: descargas | backend filename (zip si multibase) ?? literal del front «replicar_base.R»; en Electron editable en el diálogo nativo |
| AN-10 | procesamiento/analitica | Descargar Excel limpio | Bases unificadas sin identificadores ni metadatos operativos | xlsx | save_dialog_electron+save_file_as (Electron: el diálogo se abre solo al terminar) \| file_store_download (pastilla .analitica-download-pill <a href=downloadUrl> sin atributo download) | boton_spinner_generando | Electron: diálogo nativo con carpeta del .pulso por defecto; navegador: descargas | backend filename (zip si multibase) ?? literal del front «bases_unificadas.xlsx»; en Electron editable en el diálogo nativo |
| AN-11 | procesamiento/analitica | Descargar Excel trazable | Bases unificadas con identificadores y metadatos | xlsx | save_dialog_electron+save_file_as (Electron: el diálogo se abre solo al terminar) \| file_store_download (pastilla .analitica-download-pill <a href=downloadUrl> sin atributo download) | boton_spinner_generando | Electron: diálogo nativo con carpeta del .pulso por defecto; navegador: descargas | backend filename (zip si multibase) ?? literal del front «bases_unificadas_con_metadata.xlsx»; en Electron editable en el diálogo nativo |
| AN-12 | procesamiento/analitica | Generar frecuencias | Tablas de frecuencias | xlsx | save_dialog_electron+save_file_as (Electron: el diálogo se abre solo al terminar) \| file_store_download (pastilla .analitica-download-pill <a href=downloadUrl> sin atributo download) | boton_spinner_generando | Electron: diálogo nativo con carpeta del .pulso por defecto; navegador: descargas | backend filename (zip si multibase) ?? literal del front «frecuencias.xlsx»; en Electron editable en el diálogo nativo |
| AN-13 | procesamiento/analitica | Generar cruces | Tablas de cruces 2D | xlsx (zip si multibase) | save_dialog_electron+save_file_as (Electron: el diálogo se abre solo al terminar) \| file_store_download (pastilla .analitica-download-pill <a href=downloadUrl> sin atributo download) | boton_spinner+jobprogress | Electron: diálogo nativo con carpeta del .pulso por defecto; navegador: descargas | backend filename (zip si multibase) ?? literal del front «cruces.xlsx»; en Electron editable en el diálogo nativo |
| AN-14 | procesamiento/analitica | Generar tablas multibase | Tablas comparativas entre bases | xlsx | save_dialog_electron+save_file_as (Electron: el diálogo se abre solo al terminar) \| file_store_download (pastilla .analitica-download-pill <a href=downloadUrl> sin atributo download) | boton_spinner+jobprogress | Electron: diálogo nativo con carpeta del .pulso por defecto; navegador: descargas | backend filename (zip si multibase) ?? literal del front «tablas_multibase.xlsx»; en Electron editable en el diálogo nativo |
| AN-15 | procesamiento/analitica | Generar ficha | Ficha técnica del estudio | docx | save_dialog_electron+save_file_as (Electron: el diálogo se abre solo al terminar) \| file_store_download (pastilla .analitica-download-pill <a href=downloadUrl> sin atributo download) | boton_spinner_generando | Electron: diálogo nativo con carpeta del .pulso por defecto; navegador: descargas | backend filename (zip si multibase) ?? literal del front «ficha_tecnica.docx»; en Electron editable en el diálogo nativo |
| AN-16 | procesamiento/analitica | Generar libro | Libro de códigos de la base panel | xlsx | save_dialog_electron+save_file_as (Electron: el diálogo se abre solo al terminar) \| file_store_download (pastilla .analitica-download-pill <a href=downloadUrl> sin atributo download) | boton_spinner+jobprogress | Electron: diálogo nativo con carpeta del .pulso por defecto; navegador: descargas | backend filename (zip si multibase) ?? literal del front «base_panel_libro_codigos.xlsx»; en Electron editable en el diálogo nativo |
| AN-17 | procesamiento/analitica | Generar PDF | Libro de códigos de la base panel en PDF | pdf | save_dialog_electron+save_file_as (Electron: el diálogo se abre solo al terminar) \| file_store_download (pastilla .analitica-download-pill <a href=downloadUrl> sin atributo download) | boton_spinner+jobprogress | Electron: diálogo nativo con carpeta del .pulso por defecto; navegador: descargas | backend filename (zip si multibase) ?? literal del front «base_panel_libro_codigos.pdf»; en Electron editable en el diálogo nativo |
| AN-18 | procesamiento/analitica | Generar frecuencias | Frecuencias de la base panel | xlsx | save_dialog_electron+save_file_as (Electron: el diálogo se abre solo al terminar) \| file_store_download (pastilla .analitica-download-pill <a href=downloadUrl> sin atributo download) | boton_spinner+jobprogress | Electron: diálogo nativo con carpeta del .pulso por defecto; navegador: descargas | backend filename (zip si multibase) ?? literal del front «base_panel_frecuencias.xlsx»; en Electron editable en el diálogo nativo |
| AN-19 | procesamiento/analitica | Generar cruces | Cruces de la base panel | xlsx | save_dialog_electron+save_file_as (Electron: el diálogo se abre solo al terminar) \| file_store_download (pastilla .analitica-download-pill <a href=downloadUrl> sin atributo download) | boton_spinner+jobprogress | Electron: diálogo nativo con carpeta del .pulso por defecto; navegador: descargas | backend filename (zip si multibase) ?? literal del front «base_panel_cruces.xlsx»; en Electron editable en el diálogo nativo |
| AN-20 | procesamiento/analitica | Generar revisión | Auditoría de la base panel (repetidos, ausentes) | xlsx | save_dialog_electron+save_file_as (Electron: el diálogo se abre solo al terminar) \| file_store_download (pastilla .analitica-download-pill <a href=downloadUrl> sin atributo download) | boton_spinner+jobprogress | Electron: diálogo nativo con carpeta del .pulso por defecto; navegador: descargas | backend filename (zip si multibase) ?? literal del front «base_panel_auditoria.xlsx»; en Electron editable en el diálogo nativo |
| AN-21 | procesamiento/analitica | Exportar Excel | Base panel ancha | xlsx | save_dialog_electron+save_file_as (Electron: el diálogo se abre solo al terminar) \| file_store_download (pastilla .analitica-download-pill <a href=downloadUrl> sin atributo download) | boton_spinner+jobprogress | Electron: diálogo nativo con carpeta del .pulso por defecto; navegador: descargas | backend filename (zip si multibase) ?? literal del front «base_panel_wide.xlsx»; en Electron editable en el diálogo nativo |
| AN-22 | procesamiento/analitica | Exportar CSV | Base panel ancha | csv | save_dialog_electron+save_file_as (Electron: el diálogo se abre solo al terminar) \| file_store_download (pastilla .analitica-download-pill <a href=downloadUrl> sin atributo download) | boton_spinner+jobprogress | Electron: diálogo nativo con carpeta del .pulso por defecto; navegador: descargas | backend filename (zip si multibase) ?? literal del front «base_panel_wide.csv»; en Electron editable en el diálogo nativo |
| AN-23 | procesamiento/analitica | Exportar SAV | Base panel ancha para SPSS (+ .sps en zip) | sav \| zip | save_dialog_electron+save_file_as (Electron: el diálogo se abre solo al terminar) \| file_store_download (pastilla .analitica-download-pill <a href=downloadUrl> sin atributo download) | boton_spinner+jobprogress | Electron: diálogo nativo con carpeta del .pulso por defecto; navegador: descargas | backend filename (zip si multibase) ?? literal del front «base_panel_wide.sav / base_panel_sav.zip»; en Electron editable en el diálogo nativo |
| AN-24 | procesamiento/analitica | Generar ficha técnica | Ficha técnica del panel | docx | save_dialog_electron+save_file_as (Electron: el diálogo se abre solo al terminar) \| file_store_download (pastilla .analitica-download-pill <a href=downloadUrl> sin atributo download) | boton_spinner_generando | Electron: diálogo nativo con carpeta del .pulso por defecto; navegador: descargas | backend filename (zip si multibase) ?? literal del front «ficha_tecnica_panel.docx»; en Electron editable en el diálogo nativo |
| AN-25 | procesamiento/analitica | Generar comparativo simple | Comparativo de frecuencias entre bases armonizadas (+ manifest JSON) | xlsx (+ json manifest) | file_store_download (pastilla <a href download={filename}> tras terminar) | boton_spinner+jobprogress | descargas (sin diálogo de Electron, a diferencia de GenerateFooter) | backend filename (atributo download) |
| AN-26 | procesamiento/analitica | Generar comparativo de cruces | Comparativo de cruces entre bases (+ manifest) | xlsx (+ json manifest) | file_store_download (pastilla <a href download={filename}> tras terminar) | boton_spinner+jobprogress | descargas (sin diálogo de Electron, a diferencia de GenerateFooter) | backend filename (atributo download) |
| AN-27 | procesamiento/analitica | Guardar plantilla | Plantilla JSON de configuración de Analítica (sin respuestas) | json | blob_front | spinner_inline_en_boton | descargas | front literal: prosecnur_analitica_<Date.now()>.json |
| GR-01 | procesamiento/graficos | PowerPoint (PPTX editable) | Informe de láminas de la base activa | pptx | save_dialog_electron+save_file_as (Electron: se abre solo al terminar) \| file_store_download (enlace en el popover) | alert+spinner_boton+jobprogress | Electron: diálogo con carpeta del .pulso por defecto; navegador: descargas | backend filename ?? literal «reporte.pptx»; Electron: editable en diálogo nativo |
| GR-02 | procesamiento/graficos | Word (DOCX narrativo) | Informe Word narrativo de la base activa | docx | save_dialog_electron+save_file_as \| file_store_download | alert+spinner_boton+jobprogress | Electron: diálogo (carpeta del .pulso); navegador: descargas | backend filename ?? «reporte.docx» |
| GR-03 | procesamiento/graficos | PowerPoint (informe compartido) | PPTX conjunto de todas las bases aprobadas | pptx | save_dialog_electron+save_file_as \| file_store_download | alert+spinner_boton+jobprogress | Electron: diálogo; navegador: descargas | backend filename ?? «reporte.pptx» |
| GR-04 | procesamiento/graficos | <nombre del archivo> (p.ej. reporte.pptx / reporte.docx) | Último PPTX/DOCX generado | pptx \| docx | file_store_download | nada | descargas (también en Electron, sin diálogo) | backend original_name (el <a> no lleva atributo download) |
| GR-05 | procesamiento/graficos | Archivos por base (ZIP con un PPTX independiente por base) | ZIP con un PPTX por base | zip | file_store_download (enlace en el popover) | spinner_boton+jobprogress | descargas (sin diálogo de Electron, a diferencia de Exportar del informe) | backend filename ?? «reportes_por_base.zip» |
| GR-06 | procesamiento/graficos | (ícono) Descargar esta lámina en PowerPoint | PPTX de una sola lámina (subproducto de la previsualización) | pptx | file_store_download | tarjeta_spinner | descargas | front literal: lamina-<posicion>.pptx (atributo download) |
| GR-07 | procesamiento/graficos | Descargar guía | Guía Markdown con los insumos del informe sugerido | md | blob_front | nada | descargas | front literal fijo: guia-informe-acnur.md |
| GR-08 | procesamiento/graficos | Exportar plan | Paquete compartible del plan de gráficos | zip (.pulso-graficos.zip) | file_store_download | spinner_inline_en_boton | descargas | backend filename ?? «plan_graficos.pulso-graficos.zip» |
| GR-09 | procesamiento/graficos | Exportar componentes | JSON con las secciones elegidas de la config de gráficos | json | blob_front | texto_en_boton | descargas | front: pulso_graficos_<alcance>_<epoch>.json |
| GR-10 | procesamiento/graficos | Exportar revisión | Lista de láminas con cruce, estado y qué revisar | csv (UTF-8 con BOM) | blob_front | nada | descargas | front literal fijo: diferencias-del-informe.csv |
| GR-11 | procesamiento/graficos | Copiar redacción | Texto redactado de la diferencia significativa | texto | portapapeles | nada | portapapeles | n/a |
| GR-12 | procesamiento/graficos | Copiar redacción | Texto redactado de la diferencia | texto | portapapeles | nada | portapapeles | n/a |
| CO-01 | procesamiento/codificacion | Generar matriz | Matriz editable de la base activa (id de caso, variable, texto, código, categoría, observaciones) | xlsx | abre_pestaña (window.open _blank de downloadUrl) | texto_en_boton | descargas del navegador/Electron vía pestaña nueva | backend original_name (Content-Disposition) |
| CO-02 | procesamiento/codificacion | Compartir | Matriz limpia para compartir (sin IDs internos ni rutas) | xlsx | abre_pestaña | solo_disabled | descargas vía pestaña nueva | backend original_name |
| CO-03 | procesamiento/codificacion | Auditoría | Auditoría interna con trazabilidad y casos | xlsx | abre_pestaña | solo_disabled | descargas vía pestaña nueva | backend original_name |
| CO-04 | procesamiento/codificacion | Respaldo JSON | Respaldo de categorías, reglas y recodificaciones | json | blob_front | texto_en_boton | descargas | backend suggested_filename ?? front prosecnur_codificacion_<YYYY-MM-DD>.json |
| CO-05 | procesamiento/codificacion | data_adaptada.xlsx | Respuestas adaptadas con los mapeos confirmados | xlsx | file_store_download (<a> sin atributo download) | spinner_boton+jobprogress | descargas | backend original_name (el rótulo literal «data_adaptada.xlsx» puede no coincidir con el nombre real) |
| CO-06 | procesamiento/codificacion | instrumento_adaptado.xlsx | Instrumento adaptado | xlsx | file_store_download | spinner_boton+jobprogress | descargas | backend original_name (rótulo fijo en el front) |
| VA-01 | procesamiento/validacion | Exportar a Excel → Descargar → | Plan de reglas del formulario editable | xlsx | file_store_download (dos clics: generar y luego «Descargar →») | loadingblock_inline_lejano | descargas | backend original_name |
| VA-02 | procesamiento/validacion | Paquete metodológico PDF + R → Descargar paquete ZIP → | ZIP con reporte metodológico PDF + script R | zip | otro (job_result_download: GET /api/jobs/<id>/result, no pasa por el file store) | jobprogress | descargas | backend basename del result_path sin prefijo (Content-Disposition attachment) |
| CA-01 | procesamiento/carga | .xlsx \| .csv \| .sav | Base normalizada contra el XLSForm | xlsx \| csv \| sav | file_store_download (window.location.href = downloadUrl) | loadingblock_inline_lejano | descargas (navega la ventana principal al archivo) | backend original_name |
| CA-02 | procesamiento/carga | Descargar base | Base normalizada de esa base del estudio | xlsx | file_store_download (window.location.href) | texto_feedback | descargas | backend original_name |
| CA-03 | procesamiento/carga | Exportar Word | Word con las diferencias y decisiones de integración | docx | blob_front (el backend devuelve los bytes; el front arma el enlace) | spinner_inline_texto | descargas | front: diferencias_integracion_<timestamp>.docx |
| DB-01 | tablero | Descargar | Base de datos con las variables elegidas, en códigos o etiquetas | xlsx \| csv (selector) | blob_front (bytes del backend envueltos en blob: URL) | texto_en_boton | descargas | front: base_datos_<timestamp>.<formato> |
| DB-02 | tablero | Copiar (Copiar el gráfico como imagen) | Imagen PNG del gráfico (Plotly.toImage o html-to-image) | png | portapapeles (fallback: blob_front descarga PNG si no hay ClipboardItem) | texto_en_boton | portapapeles \| descargas (fallback) | front: <título-en-slug>.png (sólo si cae al fallback de descarga) |
| DB-03 | tablero | Copiar (Copiar el gráfico como imagen) | Imagen PNG del gráfico | png | portapapeles (fallback blob_front) | texto_en_boton | portapapeles \| descargas | front: <título-en-slug>.png (fallback) |
| DB-04 | tablero | Publicar | Space de Hugging Face con el dashboard publicado | sitio web (HF Space) | publica_fuera | spinner_boton+texto_estado | Hugging Face (externo); botones para abrir la URL en pestaña nueva | input del usuario (usuario HF + nombre del Space) |
| MO-01 | monitoreo/acreditacion | Generar PDF ejecutivo → Descargar PDF ejecutivo | Reporte PDF de avance del corte | pdf | otro (endpoint de descarga propio del reporte, <a download> en dos clics) | boton_con_progreso+jobstatusline | descargas | backend basename del PDF (Content-Disposition) |
| MO-02 | monitoreo/telefonico | Generar PDF telefónico → Descargar PDF telefónico | Reporte PDF de avance del corte con portada editable | pdf | otro (endpoint de descarga propio del reporte, <a download> en dos clics) | boton_con_progreso+jobstatusline | descargas | backend basename del PDF (Content-Disposition) |
| MO-03 | monitoreo/territorial | Generar PDF de avance → Descargar PDF territorial | Reporte PDF de avance del corte | pdf | otro (endpoint de descarga propio del reporte, <a download> en dos clics) | boton_con_progreso+jobstatusline | descargas | backend basename del PDF (Content-Disposition) |
| MO-04 | monitoreo/aulas | Generar PDF de avance → Descargar PDF de cursos-horario | Reporte PDF de avance del corte con portada editable | pdf | otro (endpoint de descarga propio del reporte, <a download> en dos clics) | boton_con_progreso+jobstatusline | descargas | backend basename del PDF (Content-Disposition) |
| MO-05 | monitoreo/acreditacion | Generar PDF de producción → Descargar producción | PDF de producción por responsable (título editable) | pdf | otro (endpoint de descarga propio, <a download>) | boton_con_progreso+jobstatusline | descargas | backend basename; el input «Título del PDF» sólo cambia la portada, no el nombre del archivo |
| MO-06 | monitoreo/telefonico | Generar PDF de producción telefónica → Descargar producción telefónica | PDF de producción por responsable (título editable) | pdf | otro (endpoint de descarga propio, <a download>) | boton_con_progreso+jobstatusline | descargas | backend basename; el input «Título del PDF» sólo cambia la portada, no el nombre del archivo |
| MO-07 | monitoreo/territorial | Generar PDF de producción → Descargar producción | PDF de producción por responsable (título editable) | pdf | otro (endpoint de descarga propio, <a download>) | boton_con_progreso+jobstatusline | descargas | backend basename; el input «Título del PDF» sólo cambia la portada, no el nombre del archivo |
| MO-08 | monitoreo/territorial | Descargar data + XLSForm | Paquete manual: data filtrada, XLSForm, auditoría y manifest | xlsx + xlsform + zip/manifest | file_store_download (enlaces <a download> uno por archivo) | spinner_boton+texto_estado | descargas | backend original_name |
| MO-09 | monitoreo (acreditacion, telefonico, territorial, aulas) | Descargar soporte → Descargar evidencia / archivos directos | Paquete de evidencia de publicación (+ request CSV/JSON, status, decisión) | zip + csv/json | file_store_download (<a download>) | spinner_boton+texto_estado | descargas | backend filename |
| MO-10 | monitoreo/territorial | Validar paquete territorial → Plantilla / Revisión / … | Plantilla y revisión del paquete operacional territorial | xlsx/csv | file_store_download (<a href=file.download_url download>) | spinner_boton+texto_estado | descargas | backend original_name |
| MO-11 | monitoreo (acreditacion, telefonico, territorial, aulas) | Revisar y publicar Sheets cliente\|interno (→ Aplicar en EnsayoPublicacionDialog) | Pestañas controladas en un Google Sheets del cliente o interno | Google Sheets | publica_fuera | boton_con_progreso | Google Sheets (enlace «Abrir spreadsheet» en pestaña nueva) | spreadsheet destino escrito por el usuario |
| MO-12 | monitoreo/acreditacion | Exportar | Correos inválidos con motivo | csv (UTF-8 con BOM) | blob_front | nada | descargas | front literal: correos-invalidos.csv |
| MO-13 | monitoreo/acreditacion | Exportar CSV | Personas del padrón filtradas | csv (UTF-8 con BOM) | blob_front | nada | descargas | front literal: personas-del-padron.csv |
| MO-14 | monitoreo/acreditacion | Exportar CSV | Respuestas recibidas filtradas | csv (UTF-8 con BOM) | blob_front | nada | descargas | front literal: respuestas-recibidas.csv |
| MO-15 | monitoreo/acreditacion | Exportar CSV | Base de barrido para supervisión (leída o propuesta 30%) | csv (UTF-8 con BOM) | blob_front | nada | descargas | front: base-barrido-supervision-<leida\|propuesta>-<YYYY-MM-DD>.csv |
| MO-16 | monitoreo/telefonico | Exportar CSV | Base de barrido para supervisión | csv (UTF-8 con BOM) | blob_front | nada | descargas | front: base-barrido-supervision-<leida\|propuesta>-<YYYY-MM-DD>.csv |
| MO-17 | monitoreo/telefonico | Exportar CSV | Discrepancias Kobo vs hoja visibles | csv (UTF-8 con BOM) | blob_front | nada | descargas | front literal: discrepancias-kobo-hoja.csv |
| MO-18 | monitoreo/telefonico | Copiar para el equipo | Lista de discrepancias redactada para el chat | texto | portapapeles | nada | portapapeles | n/a |
| MO-19 | monitoreo/telefonico | Copiar mensaje | Mensaje para un operador con sus casos sin barrer | texto | portapapeles | nada | portapapeles | n/a |
| MO-20 | monitoreo/telefonico | Copiar para el equipo | Mensajes para todos los operadores atrasados | texto | portapapeles | nada | portapapeles | n/a |
| MO-21 | monitoreo/territorial | CSV | UMP del corte con estado | csv (UTF-8 con BOM) | blob_front | nada | descargas | front literal: ump-del-corte.csv |
| MO-22 | monitoreo/territorial | CSV UMP | Registro de ocurrencias por UMP visibles | csv (UTF-8 con BOM) | blob_front | nada | descargas | front: reporte_ump_ocurrencias_visibles.csv |
| MO-23 | monitoreo/territorial | Excel UMP | UMP totales y sus estados | xlsx | abre_pestaña (window.open downloadUrl) | spinner_inline_en_boton (roto) | descargas vía pestaña nueva | backend original_name |
| MO-24 | monitoreo/territorial | Excel | UMP filtradas por responsable/faltantes | xlsx | abre_pestaña (window.open downloadUrl) | nada | descargas vía pestaña nueva | backend original_name |
| MO-25 | monitoreo/territorial | XLSForm | XLSForm del formulario de ocurrencias | xlsx | abre_pestaña (window.open result.download_url) | spinner_inline_en_boton (roto) | descargas vía pestaña nueva | backend original_name |
| MO-26 | monitoreo/territorial | Plantilla Excel | Plantilla de padrón de aplicadores | xlsx | file_store_download (<a download=""> efímero sobre download_url) | solo_disabled | descargas | backend original_name |
| MO-27 | monitoreo/territorial | Descargar códigos | Códigos asignados a aplicadores | xlsx | file_store_download (<a download=""> efímero sobre download_url) | solo_disabled | descargas | backend original_name |
| MO-28 | monitoreo/aulas | Generar libro | Libro operativo de tres hojas para que el equipo lo llene | xlsx | file_store_download (<a download=filename> efímero) | spinner_inline_en_boton | descargas | backend filename (a.download = res.filename) |
| MO-29 | monitoreo/aulas | Descargar plantilla (.xlsx) | Plantilla de disponibilidad de aplicadores (días, franjas, 1/0) | xlsx | file_store_download (<a download=filename> efímero) | nada | descargas | backend filename |
| MO-30 | monitoreo/aulas | Descargar Excel | Carga de campo por franja (HTML con extensión .xls) | xls (HTML disfrazado) | blob_front | nada | descargas | front literal: carga-de-campo.xls \| carga-de-campo-calendario.xls |
| MO-31 | monitoreo/aulas | copiar aviso del día | Lista del día (hora, aula y aplicador) para el chat | texto | portapapeles | nada | portapapeles | n/a |
| MC-01 | material-campo/correo | Copiar HTML para SurveyMonkey | HTML del envío listo para pegar en el recopilador | html (texto) | portapapeles | spinner_inline_en_boton | portapapeles | n/a |
| MC-02 | material-campo/correo | Paquete del envío → Descargar | ZIP con HTML, LEEME, manifiesto (+ contactos_surveymonkey.csv con la lista) | zip | file_store_download (<a download=filename>, segundo clic) | spinner_inline_en_boton | descargas | backend filename (atributo download) |
| MC-03 | material-campo/correo | Plantilla para importar en Mailchimp → Descargar | ZIP de plantilla Mailchimp sin datos personales | zip | file_store_download | spinner_inline_en_boton | descargas | backend filename |
| MC-04 | material-campo/correo | Plantilla + audiencia → Descargar | ZIP de plantilla + audiencia CSV (datos personales) | zip | file_store_download | spinner_inline_en_boton | descargas | backend filename |
| MC-05 | material-campo/correo | Copiar para Outlook | HTML del correo como text/html + text/plain | html (texto) | portapapeles | nada | portapapeles | n/a |
| MC-06 | material-campo/correo | Junto al proyecto | El ZIP exportado copiado junto al .pulso | zip | save_to_project | solo_disabled | carpeta del .pulso (raíz) | backend filename tal cual (sin input; overwrite:false) |
| MC-07 | material-campo/correo | Armar la vista (N) → Descargar | Archivo con los correos lado a lado en computadora y celular | html | file_store_download (<a download>, segundo clic) | texto_en_boton | descargas | backend filename |
| MC-08 | material-campo/correo | Textos en Word → Descargar Word | Textos de los correos elegidos | docx | file_store_download | texto_en_boton | descargas | backend filename ?? «textos.docx» |
| MC-09 | material-campo/telefonica | Excel del barrido (N filas) | Plantilla Excel del barrido para enumeradores | xlsx | abre_pestaña | texto_en_boton | descargas | backend original_name (Content-Disposition) |
| MC-10 | material-campo/telefonica | Construir en el Sheets / Crear las pestañas que falten | Pestañas de barrido en el Sheets del estudio | Google Sheets | publica_fuera | texto_en_boton | Google Sheets | enlace al Sheets escrito por el usuario |
| MC-11 | material-campo/supervision | Excel de la supervisión | Base del lote de supervisión | xlsx | abre_pestaña | texto_en_boton | descargas | backend original_name (Content-Disposition) |
| MC-12 | material-campo/supervision | Construir en el Sheets | Pestañas de supervisión en Google Sheets | Google Sheets | publica_fuera | texto_en_boton | Google Sheets | enlace al Sheets escrito por el usuario |
| MC-13 | material-campo/aulas | Excel (Libro del equipo) | Plantilla «Libro del equipo» | xlsx | abre_pestaña | texto_en_boton | descargas | backend original_name (Content-Disposition) |
| MC-14 | material-campo/aulas | Excel (Disponibilidad de aplicadores) | Plantilla «Disponibilidad de aplicadores» | xlsx | abre_pestaña | texto_en_boton | descargas | backend original_name (Content-Disposition) |
| MC-15 | material-campo/aulas | Excel (Asignación inicial de aplicadores) | Plantilla «Asignación inicial de aplicadores» | xlsx | abre_pestaña | texto_en_boton | descargas | backend original_name (Content-Disposition) |
| MC-16 | material-campo/aulas | Ver imagen → Descargar la ficha | PNG de la primera ficha | png | file_store_download (<a href> sin download, segundo clic) | jobprogress | descargas | backend original_name (Content-Disposition) |
| MC-17 | material-campo/aulas | Generar PDF → Descargar la ficha | PDF del lote de fichas con QR | pdf | file_store_download (<a href> sin download, segundo clic) | jobprogress | descargas | backend original_name (Content-Disposition) |
| MC-18 | material-campo/aulas | Generar el paquete → Descargar la ficha | ZIP por facultad, titulares y reservas aparte | zip | file_store_download (<a href> sin download, segundo clic) | jobprogress | descargas | backend original_name (Content-Disposition) |
| MC-19 | material-campo/aulas | Generar (ficha de prueba) / PDF (histórico) | Ficha de prueba con código inventado | pdf | file_store_download (mismo enlace «Descargar la ficha») | jobprogress | descargas | backend original_name (Content-Disposition) |
| MC-20 | material-campo/aulas | Enviar al Drive del operativo | El archivo renderizado subido a la carpeta de Drive del operativo | pdf/png/zip | publica_fuera | texto_en_boton | Google Drive (enlace «ver en Drive») | backend (mismo archivo) |
| MC-21 | material-campo/aulas | (ícono) Descargar <archivo> | Artefacto entregado registrado en el recibo | pdf/zip | file_store_download | nada | descargas | backend original_name (Content-Disposition) |
| MC-22 | material-campo/aulas | Construir tablas en el Sheets → «Sí, escribir en el Sheets» (agenda y distribución) | Libro de agenda / distribución en Google Sheets | Google Sheets | publica_fuera | spinner_boton+texto | Google Sheets («Abrir el Sheets») | enlace al Sheets escrito por el usuario |
| MC-23 | material-campo/territorial | Abrir (hoja de conteo por zona) / Hojas de conteo de todas | Hoja de conteo por zona o de todas las zonas | pdf | abre_pestaña | texto_en_boton | descargas | backend original_name (Content-Disposition) |
| MC-24 | material-campo/territorial | Abrir el PDF | Ficha de la UMP elegida (A4, dos caras) | pdf | abre_pestaña | texto_en_boton | descargas | backend original_name (Content-Disposition) |
| MC-25 | material-campo/territorial | Abrir un PDF de prueba | Ficha de una manzana sorteada del marco | pdf | abre_pestaña | texto_en_boton | descargas | backend original_name (Content-Disposition) |
| MC-26 | material-campo/territorial | Abrir el PDF | Hoja de ruteo o de consolidados de una UMP | pdf | abre_pestaña | texto_en_boton | descargas | backend original_name (Content-Disposition) |
| MC-27 | material-campo/territorial | Imprimir o descargar | Hoja de ruta (ficha) de la UMP | pdf | abre_pestaña | nada | descargas | backend original_name (Content-Disposition) |
| MC-28 | material-campo/territorial | Excel para campo | Excel de asignación de equipo para llenar en campo | xlsx | abre_pestaña | texto_en_boton | descargas | backend original_name (Content-Disposition) |
| MC-29 | material-campo/territorial | Hoja del día | Hoja de la jornada (rutas, visitas, km) | pdf | abre_pestaña | texto_en_boton | descargas | backend original_name (Content-Disposition) |
| MC-30 | material-campo/territorial | Generar → Descargar (Paquete por distrito, ZIP) | ZIP por distrito: fichas, hojas por zona, Excel operativo y metadatos | zip | file_store_download (<a> sin download, segundo clic) | texto_en_boton+jobprogress | descargas | backend original_name (Content-Disposition) |
| MC-31 | material-campo/territorial | Generar → Descargar (Excel operativo) | Excel operativo, una hoja por distrito | xlsx | abre_pestaña (al terminar) + file_store_download (enlace «Descargar» después) | texto_en_boton | descargas | backend original_name (Content-Disposition) |
| MC-32 | material-campo/territorial | Hojas de ruteo / Hojas de consolidados | Hojas de ruteo o consolidados de todas las titulares (o con reemplazos) | pdf | abre_pestaña | texto_en_boton | descargas | backend original_name (Content-Disposition) |
| MC-33 | material-campo/territorial | PDF de reemplazos para N titulares → Descargar PDF | PDF con reemplazos nuevos para titulares que fallaron | pdf | abre_pestaña (onDone) + file_store_download (enlace) | jobprogress | descargas | backend original_name (Content-Disposition) |
| CM-01 | calc-muestra | Generar reporte → Ver reporte | Reporte metodológico del diseño (HTML o PDF según el segmento) | html \| pdf | abre_pestaña (enlace target=_blank inline) | spinner_boton_generando | pestaña nueva del navegador/Electron | backend (inline: el navegador lo muestra; si se guarda, nombre del backend) |
| CM-02 | calc-muestra | Generar reporte \| Regenerar reporte → Ver reporte | Reporte del diseño muestral | html | abre_pestaña | spinner_boton_generando | pestaña nueva | backend |
| CM-03 | calc-muestra | Exportar selección de cursos-horario | Anexo xlsx con la selección de cursos-horario | xlsx | abre_pestaña (window.open downloadUrl, 'noreferrer' sin 'noopener') | spinner_inline_en_boton | descargas vía pestaña nueva | backend filename (se muestra al lado: aulasExportFilename) |
| CM-04 | calc-muestra | Generar paquete de defensa → Abrir / Descargar (por pieza) | Tres piezas: reporte metodológico, anexo xlsx de cursos-horario y memoria JSON de reproducibilidad | html/pdf + xlsx + json | abre_pestaña (reporte) + file_store_download (anexo) + blob_front (memoria JSON) | checklist_por_pasos+banner | pestaña nueva (reporte) / descargas (anexo y memoria) | reporte: backend; anexo: backend filename; memoria: front memoria-defensa-<YYYY-MM-DD>.json |
| CM-05 | calc-muestra | Descargar listado (XLSX) | Selección, memoria de cálculo, estratos y listado de unidades | xlsx | abre_pestaña (window.open 'noreferrer') | spinner_inline_en_boton | descargas vía pestaña nueva | backend filename |
| CM-06 | calc-muestra | Exportar solicitud para DTI (XLSX) | Excel de estructura de variables esperadas + criterios para pedir la base a DTI | xlsx | blob_front (bytes del backend) | spinner_inline_en_boton | descargas | front: solicitud-base-dti-<YYYY-MM-DD>.xlsx |
| HR-01 | hojas-ruta | Excel, por distrito | Matriz poblacional por distrito | xlsx | abre_pestaña | texto_en_boton | descargas vía pestaña nueva | backend original_name |
| HR-02 | hojas-ruta | CSV de esta vista | La matriz tal como se ve (agrupación, rangos, sexo) | csv (UTF-8 con BOM) | blob_front | nada | descargas | front literal: matriz-poblacional.csv |
| HR-03 | hojas-ruta | Ver el informe | Informe de diseño muestral (territorio, población, tamaño, marco, sorteo) | html | abre_pestaña | texto_en_boton+jobprogress | pestaña nueva | backend (inline) |
| MO-32 | monitoreo/aulas | Publicar al Sheets | Hojas de la app reescritas en el Google Sheets del operativo (lee antes lo del equipo) | Google Sheets | publica_fuera | spinner_inline_en_boton | Google Sheets | enlace al Sheets escrito por el usuario |
| MC-34 | material-campo/correo | Crear borrador en Mailchimp | Borrador de campaña en la cuenta de Mailchimp | campaña Mailchimp | publica_fuera | spinner_boton+texto_estado | Mailchimp (enlace «Abrir en Mailchimp») | n/a |
| MO-33 | monitoreo/territorial | Subir Kobo | Formulario de ocurrencias publicado como asset en la cuenta Kobo | XLSForm en Kobo | publica_fuera | spinner_inline_en_boton (roto) | KoboToolbox | título del formulario en la config |
| MO-34 | monitoreo/aulas | Pintar en el Sheets de agendación | Marcas de refuerzo pintadas en el Sheets de agendación | Google Sheets | publica_fuera | texto_en_boton | Google Sheets | Sheets de agendación ya recordado |
| MO-35 | monitoreo/aulas | Revisar cambios → Aplicar <resumen> | Hoja «Distribución de aplicadores» del Sheets actualizada (ensayo primero, escritura después) | Google Sheets | publica_fuera | nada | Google Sheets | enlace del Sheets recordado/escrito |
| MO-36 | monitoreo/aulas | Actualizar | Corte recalculado y, si hay destino recordado, el libro del Sheets re-publicado (efecto colateral) | Google Sheets | publica_fuera | checklist_por_pasos+banner | Google Sheets | Sheets recordado |
| MC-35 | material-campo/correo | Cargar la audiencia | Contactos de la lista subidos a la audiencia de Mailchimp con su etiqueta | audiencia Mailchimp | publica_fuera | spinner_boton+jobprogress | Mailchimp | n/a |
| MC-36 | material-campo/correo | Actualizar quién respondió | Etiqueta de respondió aplicada a los contactos en Mailchimp | etiquetas Mailchimp | publica_fuera | spinner_boton+jobprogress | Mailchimp | n/a |

## Salidas del backend

| ID | Módulo | Salida | Formato | Endpoint | Registro | Asincronía | Ejemplo de nombre |
|---|---|---|---|---|---|---|---|
| calc-muestra-general-sorteo | calc-muestra | Sorteo de un componente (marco general) con su selección | xlsx | POST /api/calc-muestra/general/exportar | .register_output_file() kind calc_muestra_general_sorteo | sync | HSVG2026_calc_muestra_sorteo_07_11_26.xlsx |
| calc-muestra-aulas-seleccion | calc-muestra | Selección de aulas (titulares y reemplazos) del cálculo por aulas | xlsx | POST /api/calc-muestra/aulas/exportar | .register_output_file() kind calc_muestra_aulas_seleccion | sync | HSVG2026_calc_muestra_aulas_seleccion_07_11_26.xlsx |
| calc-muestra-solicitud-dti | calc-muestra | Solicitud de datos a la DTI (variables pedidas para el marco) | xlsx | POST /api/calc-muestra/solicitud-dti | .register_output_file() kind calc_muestra_solicitud_dti | sync | HSVG2026_solicitud_dti_07_11_26.xlsx |
| calc-muestra-reporte-html | calc-muestra | Reporte del cálculo de muestra (HTML) | html | POST /api/calc-muestra/reporte {formato} -> GET /api/calc-muestra/reporte/descargar (o GET /api/jobs/<id>/result) | attachment directo (no entra a s$files; ruta propia lee s$calc_muestra_reporte$path) | job callr calc_muestra_reporte (con progreso) | 0b6f…-uuid__reporte_calc_muestra.html (por /reporte/descargar); reporte_calc_muestra.html (por /api/jobs/<id>/result) |
| calc-muestra-reporte-pdf | calc-muestra | Reporte del cálculo de muestra (PDF) | pdf | POST /api/calc-muestra/reporte {formato} -> GET /api/calc-muestra/reporte/descargar (o GET /api/jobs/<id>/result) | attachment directo (no entra a s$files; ruta propia lee s$calc_muestra_reporte$path) | job callr calc_muestra_reporte (con progreso) | 0b6f…-uuid__reporte_calc_muestra.pdf (por /reporte/descargar); reporte_calc_muestra.pdf (por /api/jobs/<id>/result) |
| xlsform-editor-xlsform | editor-xlsform | XLSForm editado (instrumento) exportado desde el editor | xlsx | POST /api/xlsform-editor/export | save_upload(kind = "xlsform") (api/R/io.R:53) — queda registrado como upload/insumo, no como output | sync | HSVG2026_formulario_v3.xlsx (el nombre del XLSForm fuente); sin fuente: instrumento_editado.xlsx |
| xlsform-editor-cuestionario-pdf | editor-xlsform | Cuestionario impreso del formulario (PDF) | pdf | POST /api/xlsform-editor/export-pdf | .register_output_file() kind formulario_pdf en on_complete (api/R/xlsform_editor_export.R:129) | job callr xlsform_editor.formulario_pdf (con progreso) | HSVG2026_formulario_v3.pdf (por file_id); formulario.pdf si se baja por /api/jobs/<id>/result |
| xlsform-editor-cuestionario-docx | editor-xlsform | Cuestionario impreso del formulario (Word) | docx | POST /api/xlsform-editor/export-word (también /api/xlsform-editor/word-visor:1637, que registra el mismo .docx) | .register_output_file() kind formulario_word en on_complete (api/R/xlsform_editor_export.R:129) | job callr xlsform_editor.formulario_word (con progreso) | HSVG2026_formulario_v3.docx (por file_id); formulario.docx si se baja por /api/jobs/<id>/result |
| hojas-ruta-matriz-poblacional | hojas-ruta | Matriz poblacional del territorio | xlsx | POST /api/hojas-ruta/population-export | .hojas_ruta_vp_registrar -> .register_output_file() kind hojas_ruta_population_matrix (no ensucia el proyecto) | sync | HSVG2026_matriz_poblacional_07_11_26.xlsx |
| hojas-ruta-pdf-prueba | hojas-ruta | Hoja de ruta de prueba de una manzana al azar | pdf | POST /api/hojas-ruta/random-pdf | .register_output_file() kind hojas_ruta_random_pdf | sync | HojaRuta_Prueba_Bre_a_Zona_003_Mz_045A.pdf |
| hojas-ruta-reemplazos-puntuales | hojas-ruta | Hojas de ruta de reemplazos puntuales para titulares elegidos | pdf | POST /api/hojas-ruta/manual-replacements-pdf | .register_output_file() kind hojas_ruta_reemplazos_puntuales (on_complete, sin original_name) | job callr hojas_ruta.manual_replacements_pdf (con progreso) | HSVG2026_hojas_ruta_reemplazos_puntuales_07_11_26.pdf |
| hojas-ruta-libro-operativo | hojas-ruta | Libro operativo de rutas (Excel de campo) | xlsx | POST /api/hojas-ruta/route-workbook | .register_output_file() kind hojas_ruta_operativo | sync | HSVG2026_hojas_ruta_operativo_07_11_26.xlsx |
| hojas-ruta-zip | hojas-ruta | Paquete de hojas de ruta (PDF por manzana, reemplazos, hojas zonales y unificados) | zip | POST /api/hojas-ruta/generate | .register_output_file() kind hojas_ruta_zip (on_complete, sin original_name) | job callr hojas_ruta.generate (con progreso) | HSVG2026_hojas_de_ruta_07_11_26.zip |
| hojas-ruta-reporte-decisional-html | hojas-ruta | Reporte decisional de la muestra territorial (HTML) | html | POST /api/hojas-ruta/reporte-decisional {formato} -> GET /api/hojas-ruta/reporte-decisional/descargar (o /api/jobs/<id>/result) | attachment directo (no entra a s$files) | job callr hojas_ruta_reporte_decisional (con progreso) | 3c1e…-uuid__reporte_muestra_territorial.html |
| hojas-ruta-reporte-decisional-pdf | hojas-ruta | Reporte decisional de la muestra territorial (PDF) | pdf | POST /api/hojas-ruta/reporte-decisional {formato} -> GET /api/hojas-ruta/reporte-decisional/descargar (o /api/jobs/<id>/result) | attachment directo (no entra a s$files) | job callr hojas_ruta_reporte_decisional (con progreso) | 3c1e…-uuid__reporte_muestra_territorial.pdf |
| hojas-ruta-ficha-ump-png | hojas-ruta | Ficha de una UMP (titular o reemplazo) en PNG | png | POST /api/hojas-ruta/ficha-ump {formato} | .hojas_ruta_vp_registrar (api/R/router_hojas_ruta_vista_previa.R:67) -> .register_output_file() kind hojas_ruta_ficha_ump | sync | FichaUMP_Reemplazo_Bre_a_Zona_003_Mz_045A.png |
| hojas-ruta-ficha-ump-pdf | hojas-ruta | Ficha de una UMP (titular o reemplazo) en PDF | pdf | POST /api/hojas-ruta/ficha-ump {formato} | .hojas_ruta_vp_registrar (api/R/router_hojas_ruta_vista_previa.R:67) -> .register_output_file() kind hojas_ruta_ficha_ump | sync | FichaUMP_Reemplazo_Bre_a_Zona_003_Mz_045A.pdf |
| hojas-ruta-hoja-dia | hojas-ruta | Hoja del día de una jornada (rutas del día) | pdf | POST /api/hojas-ruta/hoja-dia | .hojas_ruta_vp_registrar -> .register_output_file() kind hojas_ruta_hoja_dia | sync | HojaDia_J03_Bre_a.pdf |
| material-asignacion-encuestadores-ump | material-campo | Excel de asignación de encuestadores por UMP (territorial) | xlsx | POST /api/recopiladores/campaigns/territorial/asignacion/excel | .register_output_file() kind asignacion_encuestadores | sync | HSVG2026_asignacion_encuestadores_07_11_26.xlsx |
| material-asignacion-encuestadores-cuotas | material-campo | Excel de asignación de encuestadores por zona con cuotas (territorial por cuotas) | xlsx | POST /api/recopiladores/campaigns/territorial/asignacion/excel (campaña por cuotas) | .register_output_file() kind asignacion_encuestadores | sync | HSVG2026_asignacion_encuestadores_07_11_26.xlsx |
| material-hoja-dia | material-campo | Hoja del día sobre la foto enviada a Material | pdf | POST /api/recopiladores/campaigns/territorial/hoja-dia | .hojas_ruta_vp_registrar -> .register_output_file() kind hojas_ruta_hoja_dia | sync | HojaDia_J03_Bre_a.pdf |
| material-plantilla-barrido | material-campo | Plantilla del barrido telefónico | xlsx | POST /api/recopiladores/campaigns/telefonica/plantilla (con la config de la campaña) y POST /api/recopiladores/barrido/plantilla (libre) | .register_output_file() kind plantilla_barrido | sync | HSVG2026_plantilla_barrido_07_11_26.xlsx |
| material-base-supervision | material-campo | Base de supervisión de un lote (una fila por caso) | xlsx | POST /api/recopiladores/campaigns/supervision/excel | .register_output_file() kind supervision_base | sync | HSVG2026_supervision_ronda_2_07_11_26.xlsx |
| material-aulas-disponibilidad-plantilla | material-campo | Plantilla de disponibilidad de aplicadores | xlsx | POST /api/recopiladores/campaigns/aulas/plantilla {pieza: "disponibilidad"} | .register_output_file() kind aulas_disponibilidad_plantilla | sync | HSVG2026_disponibilidad_aplicadores_PLANTILLA_07_11_26.xlsx |
| material-aulas-asignacion-plantilla | material-campo | Planilla inicial de asignación de aplicadores con las titulares | xlsx | POST /api/recopiladores/campaigns/aulas/plantilla {pieza: "asignacion"} | .register_output_file() kind aulas_asignacion_plantilla | sync | HSVG2026_asignacion_aplicadores_PLANTILLA_07_11_26.xlsx |
| material-aulas-libro-plantilla | material-campo | Libro del equipo de aulas (plantilla sin agenda) | xlsx | POST /api/recopiladores/campaigns/aulas/plantilla {pieza: "libro"} | .register_output_file() kind aulas_libro_plantilla | sync | HSVG2026_libro_aulas_PLANTILLA_07_11_26.xlsx |
| material-papel-ruteo | material-campo | Hoja de ruteo por UMP | pdf | POST /api/recopiladores/campaigns/territorial/papel {pieza: "ruteo"} | .register_output_file() kind material_ruteo | sync | HojaRuteo_Bre_a_Zona_003_Mz_045A.pdf / HojaRuteo_24UMP.pdf |
| material-papel-consolidados | material-campo | Hoja de consolidados por UMP | pdf | POST /api/recopiladores/campaigns/territorial/papel {pieza: "consolidados"} | .register_output_file() kind material_consolidados | sync | HojaConsolidados_Bre_a_Zona_003_Mz_045A.pdf / HojaConsolidados_24UMP.pdf |
| material-papel-conteo | material-campo | Hoja de conteo por zona (territorial por cuotas) | pdf | POST /api/recopiladores/campaigns/territorial/papel {pieza: "conteo"} | .register_output_file() kind material_conteo | sync | HojaConteo_Bre_a_Zona_003_Mz_045A.pdf / HojaConteo_24Zonas.pdf |
| material-correo-revision | material-campo | Página de revisión de los correos de una o varias campañas | html | POST /api/recopiladores/mail-revision | .cmail_register_artifact (api/R/collection_mail_export.R:569) -> .register_output_file() kind mail_revision | sync | correos-para-revisar_revision.html |
| material-correo-textos-word | material-campo | Textos de los correos en Word | docx | POST /api/recopiladores/mail-textos-word | .cmail_register_artifact -> .register_output_file() kind mail_textos | sync | textos-de-los-correos.docx |
| material-correo-export-mailchimp | material-campo | Paquete completo del correo para Mailchimp (HTML, audiencia, manifest) | zip | POST /api/recopiladores/mail-template/export | .cmail_register_artifact -> .register_output_file() kind collection_mail_zip | sync | invitacion-docentes_invitacion_mailchimp_20261107-153000.zip |
| material-correo-export-plantilla-mailchimp | material-campo | Plantilla importable de Mailchimp (solo el ZIP del HTML) | zip | POST /api/recopiladores/mail-template/export | .cmail_register_artifact -> .register_output_file() kind collection_mail_template_zip | sync | invitacion-docentes_invitacion_plantilla-mailchimp_20261107-153000.zip |
| material-correo-export-surveymonkey | material-campo | Paquete del correo para SurveyMonkey | zip | POST /api/recopiladores/mail-template/export | .cmail_register_artifact -> .register_output_file() kind collection_mail_sm_zip | sync | invitacion-docentes_invitacion_surveymonkey_20261107-153000.zip |
| material-correo-export-manifest | material-campo | Manifest JSON del paquete de correo (Mailchimp o SurveyMonkey) | json | POST /api/recopiladores/mail-template/export | .cmail_register_artifact -> .register_output_file() kind collection_mail_manifest | sync | invitacion-docentes_invitacion_mailchimp_manifest.json |
| material-fichas-png | material-campo | Vista previa PNG de una ficha de recopilador | png | POST /api/recopiladores/materials/render {format: "png"} | .register_output_file() kind collection_material_png en collection_material_render_on_complete (api/R/collection_materials_job.R:419), con sha256 y recibo | job callr recopiladores.materials_png (con progreso) | HSVG2026_preview_material_07_11_26.png |
| material-fichas-pdf | material-campo | Fichas QR por unidad (PDF corrido) | pdf | POST /api/recopiladores/materials/render {format: "pdf"} | .register_output_file() kind collection_material_pdf en collection_material_render_on_complete (api/R/collection_materials_job.R:419), con sha256 y recibo | job callr recopiladores.materials_pdf (con progreso) | HSVG2026_fichas_recopiladores_07_11_26.pdf |
| material-fichas-bundle | material-campo | Fichas QR por unidad (paquete ZIP) | zip | POST /api/recopiladores/materials/render {format: "bundle"} | .register_output_file() kind collection_material_bundle en collection_material_render_on_complete (api/R/collection_materials_job.R:419), con sha256 y recibo | job callr recopiladores.materials_bundle (con progreso) | HSVG2026_fichas_recopiladores_07_11_26.zip |
| material-ficha-prueba | material-campo | Ficha de prueba con QR de un colector de ensayo | pdf | POST /api/recopiladores/materials/prueba | ninguno: el job no tiene on_complete; solo se baja por GET /api/jobs/<id>/result | job callr recopiladores.materials_prueba (con progreso) | HSVG2026_ficha_prueba_p01_07_11_26.pdf |
| monitoreo-avance-territorial-monitoreo-pdf | monitoreo | Reporte de avance territorial (PDF) | pdf | POST /api/monitoreo/client-report/pdf -> GET /api/monitoreo/client-report/pdf/download (o /api/jobs/<id>/result) | attachment directo (no entra a s$files; ruta propia lee s$monitoreo_client_report_pdf$path) | job callr monitoreo.territorial_advance_pdf (con progreso) | 7d2a…-uuid__HSVG2026_avance_territorial_monitoreo_07_11_26.pdf (por /download); HSVG2026_avance_territorial_monitoreo_07_11_26.pdf (por /api/jobs/<id>/result) |
| monitoreo-avance-telefonico-monitoreo-pdf | monitoreo | Reporte de avance telefónico (PDF) | pdf | POST /api/monitoreo/client-report/pdf -> GET /api/monitoreo/client-report/pdf/download (o /api/jobs/<id>/result) | attachment directo (no entra a s$files; ruta propia lee s$monitoreo_client_report_pdf$path) | job callr monitoreo.telefonico_advance_pdf (con progreso) | 7d2a…-uuid__HSVG2026_avance_telefonico_monitoreo_07_11_26.pdf (por /download); HSVG2026_avance_telefonico_monitoreo_07_11_26.pdf (por /api/jobs/<id>/result) |
| monitoreo-avance-aulas-monitoreo-pdf | monitoreo | Reporte de avance de aulas (PDF) | pdf | POST /api/monitoreo/client-report/pdf -> GET /api/monitoreo/client-report/pdf/download (o /api/jobs/<id>/result) | attachment directo (no entra a s$files; ruta propia lee s$monitoreo_client_report_pdf$path) | job callr monitoreo.aulas_advance_pdf (con progreso) | 7d2a…-uuid__HSVG2026_avance_aulas_monitoreo_07_11_26.pdf (por /download); HSVG2026_avance_aulas_monitoreo_07_11_26.pdf (por /api/jobs/<id>/result) |
| monitoreo-reporte-cliente-monitoreo-pdf | monitoreo | Reporte a cliente (acreditación u otro perfil) (PDF) | pdf | POST /api/monitoreo/client-report/pdf -> GET /api/monitoreo/client-report/pdf/download (o /api/jobs/<id>/result) | attachment directo (no entra a s$files; ruta propia lee s$monitoreo_client_report_pdf$path) | job callr monitoreo.client_report_pdf (con progreso) | 7d2a…-uuid__HSVG2026_reporte_cliente_monitoreo_07_11_26.pdf (por /download); HSVG2026_reporte_cliente_monitoreo_07_11_26.pdf (por /api/jobs/<id>/result) |
| monitoreo-avance-telefonico-pdf-ruta-telefonica | monitoreo | Reporte de avance telefónico (ruta propia del perfil telefónico) | pdf | POST /api/monitoreo/telefonico/report/pdf -> GET /api/monitoreo/telefonico/report/pdf/download | attachment directo (no entra a s$files) | job callr monitoreo.telefonico_advance_pdf (con progreso) | 7d2a…-uuid__HSVG2026_avance_telefonico_monitoreo_07_11_26.pdf |
| monitoreo-produccion-responsable-pdf | monitoreo | Reporte de producción por responsable | pdf | POST /api/monitoreo/production-report/pdf -> GET /api/monitoreo/production-report/pdf/download | attachment directo (no entra a s$files) | job callr monitoreo.production_report_pdf (con progreso) | 7d2a…-uuid__HSVG2026_produccion_responsable_monitoreo_07_11_26.pdf |
| monitoreo-reporte-xlsx | monitoreo | Libro de monitoreo (tablas de avance) | xlsx | POST /api/monitoreo/export | .register_output_file() kind monitoreo_reporte | sync | HSVG2026_monitoreo_reporte_07_11_26.xlsx |
| monitoreo-umps-xlsx | monitoreo | Listado de UMP con sus ocurrencias (determinadas, faltantes o por responsable) | xlsx | POST /api/monitoreo/territorial/occurrences/ump-export | .register_output_file() kind monitoreo_ump_export | sync | hsvg2026-umps-faltantes.xlsx |
| monitoreo-handoff-data | monitoreo | Data procesable/validada para Procesamiento | xlsx | POST /api/monitoreo/processing-handoff/export | .register_output_file() kind monitoreo_processing_handoff_data | sync | hsvg2026-procesable-data-procesamiento.xlsx |
| monitoreo-handoff-xlsform | monitoreo | XLSForm que acompaña a la data entregada a Procesamiento | xlsx | POST /api/monitoreo/processing-handoff/export | .register_output_file() kind monitoreo_processing_handoff_xlsform | sync | hsvg2026-xlsform.xlsx |
| monitoreo-handoff-zip | monitoreo | Paquete de entrega a Procesamiento (data xlsx/csv, auditoría csv, XLSForm, manifest.json, README.md) | zip | POST /api/monitoreo/processing-handoff/export | .register_output_file() kind monitoreo_processing_handoff_zip | sync | hsvg2026-procesable-processing-handoff-2026-11-07t15-30-00z.zip |
| monitoreo-paquete-operativo-plantilla-csv | monitoreo | Revisión del paquete operativo territorial: operational-package-template.csv | csv | POST /api/monitoreo/territorial/operational-package/review | .register_output_file() kind monitoreo_territorial_operational_package_template | sync | hsvg2026-operational-package-template.csv |
| monitoreo-paquete-operativo-revision-csv | monitoreo | Revisión del paquete operativo territorial: operational-package-review.csv | csv | POST /api/monitoreo/territorial/operational-package/review | .register_output_file() kind monitoreo_territorial_operational_package_review_csv | sync | hsvg2026-operational-package-review.csv |
| monitoreo-paquete-operativo-revision-json | monitoreo | Revisión del paquete operativo territorial: operational-package-review.json | json | POST /api/monitoreo/territorial/operational-package/review | .register_output_file() kind monitoreo_territorial_operational_package_review_json | sync | hsvg2026-operational-package-review.json |
| monitoreo-paquete-operativo-revision-md | monitoreo | Revisión del paquete operativo territorial: operational-package-review.md | md | POST /api/monitoreo/territorial/operational-package/review | .register_output_file() kind monitoreo_territorial_operational_package_review_md | sync | hsvg2026-operational-package-review.md |
| monitoreo-evidence-pack-zip | monitoreo | Paquete de evidencia de publicación (libro de publicación, preflight, validaciones, decisión) | zip | POST /api/monitoreo/publication/evidence-pack | .register_output_file() kind monitoreo_publication_evidence_pack | sync | hsvg2026-client-evidence-pack-2026-11-07.zip |
| monitoreo-evidence-pack-request-csv | monitoreo | Pieza suelta del paquete de evidencia: operational-package-request.csv | csv | POST /api/monitoreo/publication/evidence-pack | .register_output_file() kind monitoreo_publication_operational_package_request_csv | sync | hsvg2026-client-operational-package-request.csv |
| monitoreo-evidence-pack-request-json | monitoreo | Pieza suelta del paquete de evidencia: operational-package-request.json | json | POST /api/monitoreo/publication/evidence-pack | .register_output_file() kind monitoreo_publication_operational_package_request_json | sync | hsvg2026-client-operational-package-request.json |
| monitoreo-evidence-pack-status-json | monitoreo | Pieza suelta del paquete de evidencia: operational-package-status.json | json | POST /api/monitoreo/publication/evidence-pack | .register_output_file() kind monitoreo_publication_operational_package_status | sync | hsvg2026-client-operational-package-status.json |
| monitoreo-evidence-pack-decision-json | monitoreo | Pieza suelta del paquete de evidencia: publication-decision.json | json | POST /api/monitoreo/publication/evidence-pack | .register_output_file() kind monitoreo_publication_decision | sync | hsvg2026-client-publication-decision.json |
| monitoreo-ocurrencias-xlsform | monitoreo | XLSForm del formulario de ocurrencias de campo | xlsx | POST /api/monitoreo/territorial/occurrences/xlsform (también lo genera /occurrences/upload-kobo:4314 antes de subirlo) | .register_output_file() kind monitoreo_ocurrencias_xlsform | sync | HSVG2026_monitoreo_ocurrencias_xlsform_07_11_26.xlsx (se pierde ocurrencias_trabajo_campo_20261107153000.xlsx) |
| monitoreo-plantilla-encuestadores | monitoreo | Plantilla del padrón de encuestadores | xlsx | POST /api/monitoreo/territorial/enumerators/template | save_upload(kind = "data") (api/R/io.R:53) — registrada como upload de datos | sync | plantilla_encuestadores_pulso.xlsx |
| monitoreo-codigos-encuestadores | monitoreo | Libro de códigos de encuestadores asignados | xlsx | POST /api/monitoreo/territorial/enumerators/codes | save_upload(kind = "data") (api/R/io.R:53) | sync | codigos_pulso_encuestadores.xlsx |
| monitoreo-libro-aulas | monitoreo | Libro de aulas del equipo (agenda, asignación, producción) | xlsx | POST /api/monitoreo/aulas/generar-libro | .register_output_file() kind aulas_libro | sync | HSVG2026_libro_aulas_07_11_26.xlsx |
| monitoreo-aulas-disponibilidad-plantilla | monitoreo | Plantilla de disponibilidad de aplicadores (desde Monitoreo) | xlsx | POST /api/monitoreo/aulas/disponibilidad/plantilla | .register_output_file() kind aulas_disponibilidad_plantilla | sync | HSVG2026_disponibilidad_aplicadores_PLANTILLA_07_11_26.xlsx |
| carga-base-normalizada-xlsx | procesamiento/carga | Base normalizada contra el XLSForm (XLSX) | xlsx | GET /api/carga/data/normalized-export?format=xlsx | .register_output_file() kind data_normalizada | sync | HSVG2026_docentes_base_normalizada_07_11_26.xlsx |
| carga-base-normalizada-csv | procesamiento/carga | Base normalizada contra el XLSForm (CSV) | csv | GET /api/carga/data/normalized-export?format=csv | .register_output_file() kind data_normalizada | sync | HSVG2026_docentes_base_normalizada_07_11_26.csv |
| carga-base-normalizada-sav | procesamiento/carga | Base normalizada contra el XLSForm (SAV) | sav | GET /api/carga/data/normalized-export?format=sav | .register_output_file() kind data_normalizada | sync | HSVG2026_docentes_base_normalizada_07_11_26.sav |
| carga-diferencias-integracion-docx | procesamiento/carga | Word de diferencias y decisiones de la integración de instrumentos | docx | POST /api/multi/integrated/decisions-docx | attachment directo (bytes en la respuesta; el archivo queda en downloads/ pero no en s$files) | sync | diferencias_integracion.docx |
| validacion-reporte-html | procesamiento/validacion | Reporte de validación (HTML) | html | POST /api/validacion/v2/report/html | .register_output_file() kind validacion_report_html | sync | HSVG2026_docentes_reporte_validacion_07_11_26.html |
| validacion-metodologia-pdf | procesamiento/validacion | Informe metodológico de validación y limpieza (PDF) | pdf | POST /api/validacion/v2/report/methodology/pdf -> GET /api/jobs/<id>/result | ninguno: resultado del job, se baja por /api/jobs/<id>/result | job callr validacion.v2.methodology_report_pdf | HSVG2026_docentes_metodologia_validacion_07_11_26.pdf |
| validacion-metodologia-bundle | procesamiento/validacion | Paquete metodológico: informe PDF + script R del plan de validación y limpieza | zip | POST /api/validacion/v2/report/methodology/bundle -> GET /api/jobs/<id>/result | ninguno: resultado del job | job callr validacion.v2.methodology_report_bundle (con progreso) | HSVG2026_docentes_metodologia_validacion_07_11_26.zip |
| validacion-plan-limpieza | procesamiento/validacion | Plan de limpieza del instrumento | xlsx | POST /api/validacion/v2/instrumento/plan/export | .register_output_file() kind plan_limpieza_export | sync | HSVG2026_docentes_plan_limpieza_07_11_26.xlsx |
| validacion-limpieza-base-limpia | procesamiento/validacion | Base depurada (limpia) promovida | xlsx | POST /api/validacion/v2/limpieza/finalize | .limpieza_register_download (api/R/limpieza_decision_engine.R:61) kind validacion_limpieza_base_limpia | sync | base_limpia_docentes.xlsx |
| validacion-limpieza-decision-maker | procesamiento/validacion | Tablero HTML de decisiones de limpieza | html | POST /api/validacion/v2/limpieza/finalize | .limpieza_register_download (api/R/limpieza_decision_engine.R:61) kind validacion_limpieza_html | sync | decision_maker_docentes.html |
| validacion-limpieza-decisiones | procesamiento/validacion | Registro de decisiones de limpieza | xlsx | POST /api/validacion/v2/limpieza/finalize | .limpieza_register_download (api/R/limpieza_decision_engine.R:61) kind validacion_limpieza_excel | sync | decisiones_limpieza_docentes.xlsx |
| codificacion-plantilla-familias | procesamiento/codificacion | Plantilla de familias de preguntas para codificar | xlsx | POST /api/codificacion/plantilla-familias | .register_output_file() kind familias_template (sin original_name) | sync | HSVG2026_familias_07_11_26.xlsx |
| codificacion-plantilla-codigos | procesamiento/codificacion | Plantilla de códigos (libro de codificación de abiertas) | xlsx | POST /api/codificacion/plantilla-codigos/generar; también POST /api/codificacion/familias/aplicar y POST /api/codificacion/aplicar | .register_output_file() kind plantilla_codif_template (sin original_name) | sync | HSVG2026_plantilla_codificacion_07_11_26.xlsx |
| codificacion-data-adaptada | procesamiento/codificacion | Data codificado(a) (con columnas *_recod) | xlsx | POST /api/codificacion/aplicar (también reaplicación SurveyMonkey: api/R/surveymonkey_multibase.R:4928) | .register_output_file() kind data_adaptada (sin original_name) | job callr codificacion.aplicar (con progreso) | HSVG2026_data_adaptada_07_11_26.xlsx |
| codificacion-instrumento-adaptada | procesamiento/codificacion | Instrumento codificado(a) (con columnas *_recod) | xlsx | POST /api/codificacion/aplicar (también reaplicación SurveyMonkey: api/R/surveymonkey_multibase.R:4928) | .register_output_file() kind instrumento_adaptado (sin original_name) | job callr codificacion.aplicar (con progreso) | HSVG2026_instrumento_adaptado_07_11_26.xlsx |
| codificacion-matriz-work | procesamiento/codificacion | Matriz de codificación (visibilidad work) | xlsx | POST /api/codificacion/matrices/export {visibility: "work"} | .register_output_file() kind codificacion_matriz_work (sin original_name) | sync | HSVG2026_codificacion_matriz_work_07_11_26.xlsx |
| codificacion-matriz-internal | procesamiento/codificacion | Matriz de codificación (visibilidad internal) | xlsx | POST /api/codificacion/matrices/export {visibility: "internal"} | .register_output_file() kind codificacion_matriz_internal (sin original_name) | sync | HSVG2026_codificacion_matriz_internal_07_11_26.xlsx |
| codificacion-matriz-client | procesamiento/codificacion | Matriz de codificación (visibilidad client) | xlsx | POST /api/codificacion/matrices/export {visibility: "client"} | .register_output_file() kind codificacion_matriz_client (sin original_name) | sync | HSVG2026_codificacion_matriz_client_07_11_26.xlsx |
| codificacion-config-json | procesamiento/codificacion | Configuración de codificación exportable | json | GET /api/codificacion/export-json | cuerpo JSON (el front arma el archivo) | sync | prosecnur_codificacion_HSVG2026_2026-11-07.json |
| analitica-libro-codigos-xlsx | procesamiento/analitica | Libro de códigos por base | xlsx | POST /api/analitica/codebook {formato: "xlsx"} | run_report_per_base -> .register_output_file() kind codebook | sync | HSVG2026_libro_de_codigos_07_11_26.xlsx / HSVG2026_docentes_libro_de_codigos_07_11_26.xlsx |
| analitica-libro-codigos-pdf | procesamiento/analitica | Libro de códigos por base (PDF) | pdf | POST /api/analitica/codebook {formato: "pdf"} | run_report_per_base -> .register_output_file() kind codebook_pdf | sync | HSVG2026_libro_de_codigos_07_11_26.pdf |
| analitica-libro-codigos-zip | procesamiento/analitica | Libros de códigos de todas las bases (ZIP, XLSX o PDF dentro) | zip | POST /api/analitica/codebook (con >1 base) | .register_output_file() kind codebook_zip \| codebook_pdf_zip | sync | HSVG2026_libro_de_codigos_07_11_26.zip |
| analitica-xlsform-final | procesamiento/analitica | XLSForm final (instrumento revisado, sin variables excluidas) | xlsx | POST /api/analitica/codebook (efecto colateral) | run_report_per_base -> .register_output_file() kind xlsform_final | sync | HSVG2026_xlsform_final_07_11_26.xlsx |
| analitica-xlsform-final-zip | procesamiento/analitica | XLSForm final de todas las bases (ZIP) | zip | POST /api/analitica/codebook (con >1 base) | .register_output_file() kind xlsform_final_zip | sync | HSVG2026_xlsform_final_07_11_26.zip |
| analitica-frecuencias-xlsx | procesamiento/analitica | Tablas de frecuencias por base | xlsx | POST /api/analitica/frecuencias | run_report_per_base -> .register_output_file() kind frecuencias | sync | HSVG2026_frecuencias_07_11_26.xlsx |
| analitica-frecuencias-zip | procesamiento/analitica | Frecuencias de todas las bases (ZIP) | zip | POST /api/analitica/frecuencias (con >1 base) | .register_output_file() kind frecuencias_zip | sync | HSVG2026_frecuencias_07_11_26.zip |
| analitica-cruces-xlsx | procesamiento/analitica | Tablas de cruces | xlsx | POST /api/analitica/cruces | .register_output_file() kind cruces (on_complete, sin original_name) | job callr analitica.cruces (con progreso) | HSVG2026_docentes_cruces_07_11_26.xlsx |
| analitica-cruces-zip | procesamiento/analitica | Cruces de todas las bases (ZIP) | zip | POST /api/analitica/cruces (con >1 base) | .register_output_file() kind cruces_zip (on_complete) | job callr analitica.cruces (con progreso) | HSVG2026_cruces_07_11_26.zip (dentro docentes__cruces.xlsx) |
| analitica-bases-csv | procesamiento/analitica | Base de datos en CSV por base | csv | POST /api/analitica/bases/csv | run_report_per_base -> .register_output_file() kind bases_csv | sync | HSVG2026_datos_07_11_26.csv |
| analitica-bases-csv-zip | procesamiento/analitica | CSV de todas las bases (ZIP) | zip | POST /api/analitica/bases/csv (con >1 base) | .register_output_file() kind bases_csv_zip | sync | HSVG2026_datos_07_11_26.zip |
| analitica-bases-xlsx | procesamiento/analitica | Base de datos en Excel por base (hojas codigos/etiquetas) | xlsx | POST /api/analitica/bases/xlsx | run_report_per_base -> .register_output_file() kind bases_xlsx | sync | HSVG2026_datos_07_11_26.xlsx |
| analitica-bases-xlsx-zip | procesamiento/analitica | Excel de todas las bases (ZIP) | zip | POST /api/analitica/bases/xlsx (con >1 base) | .register_output_file() kind bases_xlsx_zip | sync | HSVG2026_datos_07_11_26.zip |
| analitica-base-relacional | procesamiento/analitica | Base relacional (madre + grupos repetibles en un libro) | xlsx | POST /api/analitica/bases/xlsx (estudio con repeats) | .register_output_file() kind bases_xlsx_relacional | sync | HSVG2026_base_relacional_07_11_26.xlsx |
| analitica-bases-unificadas | procesamiento/analitica | Base unificada de bases hermanas independientes | xlsx | POST /api/analitica/bases/xlsx-unificada | .register_output_file() kind bases_unificadas | sync | HSVG2026_bases_unificadas_07_11_26.xlsx |
| analitica-bases-sav | procesamiento/analitica | Base SPSS (una base, sin sintaxis) | sav | POST /api/analitica/bases/sav {incluir_sps: false} | .register_output_file() kind bases_sav | sync | HSVG2026_docentes_datos_spss_07_11_26.sav |
| analitica-bases-sav-bundle | procesamiento/analitica | Paquete SPSS (.sav + niveles_medida.sps, por base) | zip | POST /api/analitica/bases/sav {incluir_sps: true} o con >1 base | .register_output_file() kind bases_sav_bundle | sync | HSVG2026_datos_spss_07_11_26.zip (dentro docentes__datos.sav, docentes__niveles_medida.sps) |
| analitica-spss-legacy | procesamiento/analitica | Paquete SPSS legado (.sav + .sps de la base activa) | zip | POST /api/analitica/spss | .register_output_file() kind spss_bundle | sync | HSVG2026_datos_spss_07_11_26.zip |
| analitica-script-replica | procesamiento/analitica | Script de replicación de la base final (.R por base) | R | POST /api/analitica/bases/script-r | .register_output_file() kind bases_script_r | sync | HSVG2026_replicar_base_07_11_26.R |
| analitica-script-replica-zip | procesamiento/analitica | Scripts de replicación de todas las bases (ZIP) | zip | POST /api/analitica/bases/script-r (con >1 base) | .register_output_file() kind bases_script_r_zip | sync | HSVG2026_replicar_base_07_11_26.zip |
| analitica-fuente-data | procesamiento/analitica | Archivo de datos fuente de la base (copia tal cual o normalizado si es integrada) | xlsx\|csv\|sav (extensión del archivo fuente) | POST /api/analitica/bases/data | .register_output_file() kind bases_data | sync | HSVG2026_data_07_11_26.xlsx |
| analitica-fuente-data-codificada | procesamiento/analitica | Data codificada (salida del adaptador de Codificación) | xlsx | POST /api/analitica/bases/data | .register_output_file() kind bases_data_codificada | sync | HSVG2026_data_codificada_07_11_26.xlsx |
| analitica-fuente-instrumento | procesamiento/analitica | XLSForm fuente de la base | xlsx | POST /api/analitica/bases/instrumento | .register_output_file() kind bases_instrumento | sync | HSVG2026_instrumento_07_11_26.xlsx |
| analitica-fuente-instrumento-codificado | procesamiento/analitica | XLSForm codificado (con o sin color de recods) | xlsx | POST /api/analitica/bases/instrumento | .register_output_file() kind bases_instrumento_codificado | sync | HSVG2026_instrumento_codificado_07_11_26.xlsx |
| analitica-fuente-data-zip | procesamiento/analitica | Datos fuente de todas las bases (ZIP) | zip | POST /api/analitica/bases/data | .register_output_file() kind bases_data_zip \| bases_data_codificada_zip | sync | HSVG2026_data_07_11_26.zip |
| analitica-fuente-instrumento-zip | procesamiento/analitica | Instrumentos fuente de todas las bases (ZIP) | zip | POST /api/analitica/bases/instrumento | .register_output_file() kind bases_instrumento_zip \| bases_instrumento_codificado_zip | sync | HSVG2026_instrumentos_07_11_26.zip |
| analitica-enumeradores-pdf | procesamiento/analitica | Reporte por enumerador (PDF) | pdf | POST /api/analitica/enumeradores | .register_output_file() kind enumeradores (on_complete, sin original_name) | job callr analitica.enumeradores (con progreso) | HSVG2026_enumeradores_07_11_26.pdf |
| analitica-enumeradores-zip | procesamiento/analitica | Reportes por enumerador de todas las bases (ZIP) | zip | POST /api/analitica/enumeradores (con >1 base) | .register_output_file() kind enumeradores_zip (on_complete) | job callr analitica.enumeradores (con progreso) | HSVG2026_enumeradores_07_11_26.zip (dentro docentes__enumeradores.pdf) |
| analitica-panel-paquete | procesamiento/analitica | Paquete panel completo | zip | POST /api/analitica/panel/export {formato: "paquete"} | .register_output_file() kind base_panel (on_complete) | job callr analitica.panel.export (con progreso) | HSVG2026_base_panel_07_11_26.zip |
| analitica-panel-xlsx | procesamiento/analitica | Base panel ancha (Excel) | xlsx | POST /api/analitica/panel/export {formato: "xlsx"} | .register_output_file() kind base_panel_wide (on_complete) | job callr analitica.panel.export (con progreso) | HSVG2026_base_panel_wide_07_11_26.xlsx |
| analitica-panel-csv | procesamiento/analitica | Base panel ancha (CSV) | csv | POST /api/analitica/panel/export {formato: "csv"} | .register_output_file() kind base_panel_wide (on_complete) | job callr analitica.panel.export (con progreso) | HSVG2026_base_panel_wide_07_11_26.csv |
| analitica-panel-sav | procesamiento/analitica | Base panel SPSS | sav | POST /api/analitica/panel/export {formato: "sav"} | .register_output_file() kind base_panel_sav (on_complete) | job callr analitica.panel.export (con progreso) | HSVG2026_base_panel_sav_07_11_26.sav |
| analitica-panel-sav-sps | procesamiento/analitica | Base panel SPSS con sintaxis (ZIP) | zip | POST /api/analitica/panel/export {formato: "sav", incluir_sps: true} | .register_output_file() kind base_panel_sav_bundle (on_complete) | job callr analitica.panel.export (con progreso) | HSVG2026_base_panel_sav_bundle_07_11_26.zip |
| analitica-panel-libro-codigos | procesamiento/analitica | Libro de códigos del panel | xlsx | POST /api/analitica/panel/export {formato: "libro_codigos"} | .register_output_file() kind base_panel_libro_codigos (on_complete) | job callr analitica.panel.export (con progreso) | HSVG2026_base_panel_libro_codigos_07_11_26.xlsx |
| analitica-panel-frecuencias | procesamiento/analitica | Frecuencias del panel | xlsx | POST /api/analitica/panel/export {formato: "frecuencias"} | .register_output_file() kind base_panel_frecuencias (on_complete) | job callr analitica.panel.export (con progreso) | HSVG2026_base_panel_frecuencias_07_11_26.xlsx |
| analitica-panel-cruces | procesamiento/analitica | Cruces del panel | xlsx | POST /api/analitica/panel/export {formato: "cruces"} | .register_output_file() kind base_panel_cruces (on_complete) | job callr analitica.panel.export (con progreso) | HSVG2026_base_panel_cruces_07_11_26.xlsx |
| analitica-panel-auditoria | procesamiento/analitica | Auditoría del panel | xlsx | POST /api/analitica/panel/export {formato: "auditoria"} | .register_output_file() kind base_panel_auditoria (on_complete) | job callr analitica.panel.export (con progreso) | HSVG2026_base_panel_auditoria_07_11_26.xlsx |
| analitica-ficha-tecnica | procesamiento/analitica | Ficha técnica del estudio | docx | POST /api/analitica/ficha-tecnica/export | .register_output_file() kind ficha_tecnica | sync | HSVG2026_ficha_tecnica_07_11_26.docx |
| analitica-ficha-tecnica-panel | procesamiento/analitica | Ficha técnica del panel longitudinal | docx | POST /api/analitica/panel/ficha-tecnica | .register_output_file() kind ficha_tecnica_panel | sync | HSVG2026_ficha_tecnica_panel_07_11_26.docx |
| analitica-tablas-multibase | procesamiento/analitica | Tablas de la base integrada multibase | xlsx | POST /api/analitica/multibase/tablas | .register_output_file() kind tablas_multibase (on_complete) | job callr analitica.multibase.tablas (con progreso) | HSVG2026_tablas_multibase_07_11_26.xlsx |
| analitica-armonizada-frecuencias | procesamiento/analitica | Comparativo armonizado entre periodos (frecuencias) | xlsx | POST /api/analitica/armonizada/frecuencias | .armonizada_registrar (api/R/router_armonizada.R:64) -> .register_output_file() kind comparativo_simple | job callr analitica.armonizada.frecuencias (con progreso) | HSVG2026_comparativo_simple_07_11_26.xlsx |
| analitica-armonizada-frecuencias-manifest | procesamiento/analitica | Manifest del comparativo armonizado (frecuencias) | json | POST /api/analitica/armonizada/frecuencias | .armonizada_registrar -> .register_output_file() kind comparativo_simple_manifest | job callr analitica.armonizada.frecuencias | HSVG2026_comparativo_simple_07_11_26_manifest.json |
| analitica-armonizada-cruces | procesamiento/analitica | Comparativo armonizado entre periodos (cruces) | xlsx | POST /api/analitica/armonizada/cruces | .armonizada_registrar (api/R/router_armonizada.R:64) -> .register_output_file() kind comparativo_cruces | job callr analitica.armonizada.cruces (con progreso) | HSVG2026_comparativo_cruces_07_11_26.xlsx |
| analitica-armonizada-cruces-manifest | procesamiento/analitica | Manifest del comparativo armonizado (cruces) | json | POST /api/analitica/armonizada/cruces | .armonizada_registrar -> .register_output_file() kind comparativo_cruces_manifest | job callr analitica.armonizada.cruces | HSVG2026_comparativo_cruces_07_11_26_manifest.json |
| analitica-config-json | procesamiento/analitica | Configuración de Analítica exportable | json | GET /api/analitica/config/export | cuerpo JSON (el front arma el archivo) | sync | (lo pone el front) |
| graficos-informe-ppt | procesamiento/graficos | Informe de gráficos (PowerPoint) | pptx | POST /api/graficos/ppt | .register_output_file() kind reporte_ppt (on_complete, sin original_name) | job callr graficos.ppt (con progreso) | HSVG2026_reporte_07_11_26.pptx (hermanas: HSVG2026_docentes_reporte_07_11_26.pptx) |
| graficos-informe-ppt-todas-bases | procesamiento/graficos | Informes PPT de todas las bases (ZIP) | zip | POST /api/graficos/ppt-all | .register_output_file() kind graficos_ppt_zip (on_complete) | job callr graficos.ppt_all (con progreso) | HSVG2026_reporte_ppt_todas_bases_07_11_26.zip (dentro HSVG2026_docentes_reporte_07_11_26.pptx) |
| graficos-informe-word | procesamiento/graficos | Informe de gráficos (Word) | docx | POST /api/graficos/word | .register_output_file() kind reporte_word (on_complete) | job callr graficos.word (con progreso) | HSVG2026_reporte_07_11_26.docx |
| graficos-informe-consolidado | procesamiento/graficos | Informe consolidado de varias bases (PowerPoint) | pptx | POST /api/graficos/consolidado/ppt | .graficos_consolidado_register_artifacts (api/R/graficos_consolidado.R:718) -> .register_output_file() kind graficos_ppt_consolidado | job callr graficos.ppt_consolidado (con progreso) | HSVG2026_informe_consolidado_07_11_26.pptx |
| graficos-informe-consolidado-manifest | procesamiento/graficos | Manifest del informe consolidado (huellas y orden de fuentes) | json | POST /api/graficos/consolidado/ppt | .register_output_file() kind graficos_ppt_consolidado_manifest (sin original_name) | job callr graficos.ppt_consolidado | HSVG2026_informe_consolidado_07_11_26_manifest.json |
| graficos-plan-compartible | procesamiento/graficos | Paquete compartible del plan de gráficos (config + íconos/logos) | zip (.pulso-graficos.zip) | POST /api/graficos/share/export | .register_output_file() kind graficos_share | sync | HSyVbG_2026_plan_graficos_20261107_203000.pulso-graficos.zip |
| graficos-vista-lamina-pptx | procesamiento/graficos | PPTX de una sola lámina (vista previa con el motor del export) | pptx | POST /api/graficos/preview-slide (y /api/graficos/preview-slide-job) | .mini_registrar (api/R/graficos_miniaturas.R:577) -> .register_output_file() kind graficos_preview (con caché por huella) | sync (o job en la variante -job) | HSVG2026_graficos_preview_07_11_26.pptx |
| graficos-lamina-png | procesamiento/graficos | Imagen completa de una lámina del lote | png | POST /api/graficos/miniaturas -> GET /api/graficos/miniaturas/<lote_id> | .mini_registrar -> .register_output_file() kind graficos_miniatura | job callr de miniaturas (o resuelto de caché) | lamina_s12.png |
| graficos-miniatura-png | procesamiento/graficos | Miniatura de una lámina del lote | png | POST /api/graficos/miniaturas -> GET /api/graficos/miniaturas/<lote_id> | .mini_registrar -> .register_output_file() kind graficos_miniatura | job callr de miniaturas | miniatura_s12.png |
| graficos-config-json | procesamiento/graficos | Configuración de Gráficos exportable | json | GET /api/graficos/config/export | cuerpo JSON (el front arma el archivo) | sync | (lo pone el front) |
| tablero-relacion-xlsx | tablero | Tabla de relación entre dos variables del dashboard | xlsx | POST /api/dashboard/relacion/descargar | attachment directo (bytes en la respuesta, no entra a s$files) | sync | HSVG2026_relacion_p12_x_sexo_07_11_26.xlsx |
| tablero-base-datos-xlsx | tablero | Base de datos del dashboard (XLSX) | xlsx | POST /api/dashboard/base-datos/descargar {formato: "xlsx"} | attachment directo (no entra a s$files) | sync | HSVG2026_base_datos_07_11_26.xlsx |
| tablero-base-datos-csv | tablero | Base de datos del dashboard (CSV) | csv | POST /api/dashboard/base-datos/descargar {formato: "csv"} | attachment directo (no entra a s$files) | sync | HSVG2026_base_datos_07_11_26.csv |
| proyecto-pulso | proyecto/home | Proyecto .pulso (zip con manifest.json, state.rds y files/) | pulso | POST /api/project/save | escribe a disco (ruta elegida por el usuario o la del proyecto abierto) | sync | /Users/…/HSVG2026.pulso |
| proyecto-pulso-duplicado | proyecto/home | Copia de un proyecto .pulso | pulso | POST /api/project/duplicate | escribe a disco (target_path del body) | sync | /Users/…/HSVG2026_copia.pulso |
| proyecto-guardar-en-carpeta | proyecto/home | Cualquier archivo registrado copiado a la carpeta del .pulso (opcionalmente en un subdirectorio) | cualquiera (la del file_id) | POST /api/fs/save-to-project | escribe a disco (carpeta del proyecto) | sync | <carpeta del proyecto>/entregables/HSVG2026_frecuencias_07_11_26.xlsx |
| proyecto-guardar-como | proyecto/home | Cualquier archivo registrado copiado a una ruta absoluta elegida por el usuario | cualquiera | POST /api/fs/save-file-as | escribe a disco (ruta absoluta del body) | sync | /Users/…/Descargas/HSVG2026_reporte_07_11_26.pptx |
| proyecto-plan-trabajo-xlsx | proyecto/home | Plan de trabajo (legado ADR 0124) | xlsx | POST /api/plan-trabajo/export | .register_output_file() kind plan_trabajo_xlsx | sync | HSVG2026_plan_trabajo_07_11_26.xlsx |
| proyecto-bitacora-md | proyecto/home | Entradas de la bitácora en Markdown (legado ADR 0124) | md | POST /api/bitacora/entradas/exportar | cuerpo JSON con campo markdown (el front arma el archivo) | sync | (lo pone el front) |
| proyecto-bitacora-portabilidad-json | proyecto/home | Documento de portabilidad de la bitácora/plan (legado ADR 0124) | json | GET /api/bitacora/portabilidad/exportar | cuerpo JSON (el front arma el archivo) | sync | (lo pone el front) |
| monitoreo-sheets-tablas-internas | monitoreo | Tablas internas de monitoreo en Google Sheets | Google Sheets | POST /api/monitoreo/sheets/publish | publica fuera | job callr monitoreo.sheets_publish | (nombre en el destino) |
| monitoreo-sheets-tablas-cliente | monitoreo | Tablas cliente de monitoreo en Google Sheets | Google Sheets | POST /api/monitoreo/client-report/sheets/publish | publica fuera | job callr monitoreo.sheets_publish | (nombre en el destino) |
| monitoreo-sheets-publicacion | monitoreo | Publicación por audiencia en Google Sheets (con preflight) | Google Sheets | POST /api/monitoreo/publication/sheets | publica fuera | job callr monitoreo.sheets_publish | (nombre en el destino) |
| monitoreo-aulas-libro-sheets | monitoreo | Libro de aulas publicado en el Sheets del equipo | Google Sheets | POST /api/monitoreo/aulas/publicar-libro (y lo republica POST /api/monitoreo/aulas/sync, «Traer respuestas»: router_monitoreo.R:5616 -> monitoreo_aulas_sync_payload, monitoreo_aulas_conversar.R:179) | publica fuera | sync | (nombre en el destino) |
| monitoreo-aulas-distribucion-crear | monitoreo | Sheets «Distribución de aplicadores» creado | Google Sheets (documento nuevo) | POST /api/monitoreo/aulas/crear-distribucion | publica fuera | sync | (nombre en el destino) |
| monitoreo-aulas-distribucion-publicar | monitoreo | Distribución de aplicadores publicada | Google Sheets | POST /api/monitoreo/aulas/publicar-distribucion | publica fuera | sync | (nombre en el destino) |
| monitoreo-aulas-distribucion-sincronizar | monitoreo | Mantenimiento diario de la distribución (con aplicar=true escribe) | Google Sheets | POST /api/monitoreo/aulas/sincronizar-distribucion | publica fuera | sync | (nombre en el destino) |
| monitoreo-aulas-marcas | monitoreo | Marcas STATUS MUESTRA en la hoja de agendación del equipo | Google Sheets (hoja ajena, celda a celda) | POST /api/monitoreo/aulas/publicar-marcas | publica fuera | sync | (nombre en el destino) |
| monitoreo-ocurrencias-kobo | monitoreo | Formulario de ocurrencias importado y desplegado en Kobo | KoboToolbox (asset desplegado) | POST /api/monitoreo/territorial/occurrences/upload-kobo | publica fuera | sync | (nombre en el destino) |
| material-fichas-drive | material-campo | Fichas QR (bundle o PDF ya renderizado) subidas al Drive del operativo | Google Drive (carpeta «Fichas QR - <estudio>») | POST /api/recopiladores/materials/drive | publica fuera | sync | (nombre en el destino) |
| material-barrido-sheets | material-campo | Base de barrido telefónico sembrada en el Sheets del estudio | Google Sheets | POST /api/recopiladores/campaigns/telefonica/sheets | publica fuera | sync | (nombre en el destino) |
| material-supervision-sheets | material-campo | Base de supervisión en su propio Sheets | Google Sheets | POST /api/recopiladores/campaigns/supervision/sheets | publica fuera | sync | (nombre en el destino) |
| material-mailchimp-sync | material-campo | Plantilla/contenido del correo sincronizado con Mailchimp | Mailchimp | POST /api/recopiladores/mail-sync | publica fuera | job callr recopiladores.mail_sync | (nombre en el destino) |
| material-mailchimp-audiencia | material-campo | Audiencia (contactos) cargada en Mailchimp | Mailchimp | POST /api/recopiladores/mail-sync/audience | publica fuera | job callr recopiladores.mail_audience | (nombre en el destino) |
| material-mailchimp-borrador | material-campo | Borrador de campaña en Mailchimp | Mailchimp | POST /api/recopiladores/mail-sync/campaign | publica fuera | sync | (nombre en el destino) |
| tablero-space-hf | tablero | Dashboard público en un Space de Hugging Face (lleva data/proyecto.pulso podado) | Hugging Face Space | POST /api/dashboard/publish | publica fuera | sync | (nombre en el destino) |

## Fuera del censo, con motivo

- frontend/src/features/analitica/panes/EnumeradoresPane.tsx:294 «Generar reporte» (enumeradores.pdf, job): pane no montado: ninguna pestaña de Analítica lo renderiza (código muerto)
- frontend/src/features/analitica/AnaliticaHeader.tsx:241 ConfigIoButtons «Guardar plantilla»: rama muerta: AnaliticaHeader sólo se monta con variant='panel'
- Guardar / Guardar como del proyecto (.pulso): features/project/useProject.ts:190,254 y app/BootGate.tsx:934 (saveProjectDialog + POST /api/project/save): persistencia del propio .pulso, no un entregable generado; se deja fuera del censo a propósito
- frontend/src/features/graficos/word/PreviaWord.tsx (genera un Word por job para mostrar sus páginas): vista previa dentro de un diálogo; no ofrece descargar el .docx
- Copias al portapapeles de identificadores/enlaces/diagnóstico: FichasPruebaHistorico.tsx:46 (enlace), TerritorialReviewCasesWorkbench.tsx:155 (response_id), TerritorialFieldOccurrencesWorkbench.tsx:824 (enlace de la encuesta), ProjectLifecycleDialog.tsx:106 (ruta), SmDetallesTecnicos.tsx:18 y CampanaComplementariaDialog.tsx:111 (IDs SurveyMonkey), AppErrorBoundary.tsx:58 y LogsPanel.tsx:78 (diagnóstico): copian un dato, no un artefacto generado
- /api/graficos/miniaturas: miniaturas del lote de láminas para la vista (useMiniaturasLote); no se descargan
- /api/graficos/miniaturas/*: estado del lote de miniaturas; vista interna
- /api/project/save: guardado del propio .pulso (useProject.ts:196/229, BootGate.tsx:944, AulasRefuerzosSinGuardar.tsx:49); persistencia, no entregable
- /api/project/duplicate: «duplicar proyecto» (useProject.ts, apiProjectDuplicate): persistencia del .pulso
- /api/xlsform-editor/word-visor: visor del Word dentro de la pestaña Impreso (storePrevia); no entrega el .docx
- /api/validacion/v2/limpieza/finalize: «Cerrar y generar base» (LimpiezaTab.tsx:787) genera base limpia y decisiones en el backend y promueve la base (ADR 0076), pero la UI no ofrece descargarlas: sólo avisa «Base limpia generada.». Hallazgo: artefactos de limpieza sin entrega
- GET /api/files/<file_id>/download (canales_de_descarga (no son salidas, son el transporte)): Canal genérico: Content-Disposition attachment con meta$original_name (sin codificar no-ASCII). Sirve todas las filas con registro en s$files.
- GET /api/jobs/<job_id>/result (canales_de_descarga (no son salidas, son el transporte)): Canal genérico de resultados de job: nombre = basename(result_path) sin el prefijo <job_uuid>__. Es el único canal de las filas sin registro (ficha de prueba, metodología de validación).
- save_upload() para insumos derivados de plataformas e integraciones (uploads_e_insumos (lo que entra al estudio, aunque pase por un registrador)): Insumos del estudio (data/XLSForm) materializados en files/ del .pulso, no entregables.
- Escrituras directas files[[id]] <- meta de importaciones (uploads_e_insumos (lo que entra al estudio, aunque pase por un registrador)): Importaciones/revisiones de insumos.
- Logos e íconos subidos por el usuario (uploads_e_insumos (lo que entra al estudio, aunque pase por un registrador)): Uploads. Nota: el ícono se registra sin original_name y su path es <uuid>.png, así que el guard lo renombra a HSVG2026_graficos_icon_07_11_26.png.
- Paquete .pulso-graficos.zip importado (uploads_e_insumos (lo que entra al estudio, aunque pase por un registrador)): Upload del paquete compartible.
- Imágenes del correo importadas (uploads_e_insumos (lo que entra al estudio, aunque pase por un registrador)): Upload (mail_image).
- Anonimización de logos de proyectos de referencia (uploads_e_insumos (lo que entra al estudio, aunque pase por un registrador)): Script de anonimización (api/scripts/pulso_anonimizar.R), no alcanzable por la API.
- state.rds / manifest.json dentro del .pulso (internos (caches, estado, payloads de job)): Contenido interno del .pulso; el usuario recibe el .pulso entero (fila proyecto-pulso).
- job_save_rds(...) y archivos .progress (internos (caches, estado, payloads de job)): Entradas/progreso de jobs.
- word_visor_<file_id>.rds (internos (caches, estado, payloads de job)): Resultado interno (páginas del Word para el visor); /api/jobs/<id>/result lo serviría como .rds pero no es un entregable.
- Base podada para publicar (internos (caches, estado, payloads de job)): Transformación interna previa a publicar en HF.
- Borrado/poda de files (internos (caches, estado, payloads de job)): Quita entradas de s$files.
- Reescritura de una plantilla subida (internos (caches, estado, payloads de job)): Actualiza tamaño/fecha de un file existente.
- Copia de evidencia en tmp/qa/monitoreo-deliverables/ (internos (caches, estado, payloads de job)): Escritura lateral relativa al cwd (ver notas de monitoreo-evidence-pack-zip).
- Jobs sin archivo de resultado (internos (caches, estado, payloads de job)): Devuelven JSON por result_data.
- Mapas y contornos (internos (caches, estado, payloads de job)): JSON para el lienzo, no archivos del usuario.
- POST /api/monitoreo/mailchimp/sync (revisados_sin_salida (asumido por lectura de código, sin ejecutar)): Lee métricas de Mailchimp (monitoreo_mailchimp_lectura.R); no publica ni produce archivo.
- POST /api/recopiladores/deployment/prepare y PUT /api/recopiladores/deployment (revisados_sin_salida (asumido por lectura de código, sin ejecutar)): Estado del despliegue en la sesión; no sube nada a Kobo ni produce archivo.
- POST /api/bitacora/cronograma/sembrar (revisados_sin_salida (asumido por lectura de código, sin ejecutar)): Siembra fases en el estado (no en Sheets).
- POST /api/hojas-ruta/envio, /plan-campo, /cuotas-por-ficha (revisados_sin_salida (asumido por lectura de código, sin ejecutar)): JSON/estado.
- GET /api/graficos/diferencias/informe, /recetario/ejemplo (revisados_sin_salida (asumido por lectura de código, sin ejecutar)): JSON (la imagen del recetario va embebida en el payload).
- Entregables de auditoría de proyectos de referencia (ZIP de evidencia, CSV/SAV analítica, XLSX procesamiento, HTML validación, manifest) (no_alcanzables_por_la_api): Solo los llama api/scripts/audit_project_deliverables.R vía Makefile (QA).
- selftest.txt (no_alcanzables_por_la_api): Autodiagnóstico del canal de jobs.
- reporte_interactivo() (Shiny) (no_alcanzables_por_la_api): App Shiny del paquete legado; no sale como archivo por la API.
- Rutas que solo devuelven 410/409 (no_alcanzables_por_la_api): No producen nada.
- Comentario y definición de registrador (comentarios_y_definiciones_en_la_semilla): No son salidas propias; se mapean a las filas de sus llamadores.

## Exportaciones sin disparador vivo

- /api/analitica/enumeradores: apiAnaliticaEnumeradores sólo lo llama EnumeradoresPane, que no está montado
- /api/analitica/spss: apiAnaliticaSpss sin llamadores (alias legacy)
- /api/bitacora/entradas/exportar: apiBitacoraEntradasExportar sin llamadores (Bitácora retirada, ADR 0124)
- /api/bitacora/portabilidad/exportar: apiBitacoraExportar sin llamadores
- /api/codificacion/familias/aplicar: apiCodifFamiliasAplicar sin llamadores
- /api/codificacion/plantilla-codigos/generar: apiCodifPlantillaCodigosGenerar sin llamadores
- /api/codificacion/plantilla-familias: apiCodifPlantillaFamilias sin llamadores
- /api/dashboard/relacion/descargar: apiDashboardRelacionDescargar sin llamadores
- /api/hojas-ruta/hoja-dia: apiHojasRutaHojaDia sólo es el default FUENTE_VIVA de PlanCampo, que nunca se usa: el único montaje pasa la fuente de Material (…/territorial/hoja-dia)
- /api/monitoreo/aulas/crear-distribucion: no hay función en src/api
- /api/monitoreo/client-report/sheets/publish: apiMonitoreoClientReportSheetsPublish sin llamadores (la UI usa /api/monitoreo/publication/sheets)
- /api/monitoreo/export: apiMonitoreoExport sin llamadores
- /api/monitoreo/sheets/publish: apiMonitoreoSheetsPublish sin llamadores
- /api/monitoreo/telefonico/report/pdf: no hay función en src/api; el PDF telefónico sale por /api/monitoreo/client-report/pdf
- /api/monitoreo/telefonico/report/pdf/download: ídem, sin función en src/api
- /api/plan-trabajo/export: apiPlanTrabajoExport sin llamadores (Planner retirado)
- /api/recopiladores/barrido/plantilla: no hay función en src/api; la UI usa /api/recopiladores/campaigns/telefonica/plantilla
- /api/validacion/v2/report/html: apiV2ReportHtml sin llamadores
- /api/validacion/v2/report/methodology/pdf: apiV2MethodologyReportPdf sin llamadores (la UI usa el bundle)
