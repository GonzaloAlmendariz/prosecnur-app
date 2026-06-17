# Versiones de Prosecnur

Este mapa resume las versiones instalables y los nombres operativos de cada corte.
La fuente de verdad para empaquetado es `api/DESCRIPTION`.

| Version | Nombre | Estado | Contenido principal |
| --- | --- | --- | --- |
| 0.2.1 | Instalador autosuficiente inicial | Publicada en GitHub | Primer flujo instalable con runtime local y updater. |
| 0.2.2 | Escritorio robusto | Publicada en GitHub | Manejo global de errores, carga segura del updater y correcciones de bundle. |
| 0.2.3 | Instalador Windows estable | Publicada en GitHub; ultima publica antes de este corte | Correccion de reinstalacion/desinstalacion cuando `electron.exe` queda abierto. |
| 0.2.4 | Checkpoint operativo local | Tag local, no publicado en GitHub | Base previa de mejoras grandes de UI, hojas de ruta y editor; no se usa como instalable publico. |
| 0.2.5 | Monitoreo y cartografia oficial | Publicada en GitHub | Compatibilidad data/XLSForm, marco INEI 2017 oficial con cartografia/NSE, flujo operativo de hojas de ruta, monitoreo Kobo/SurveyMonkey, exportacion de iconos y bundle web actualizado. |
| 0.2.6 | Actualizacion visible garantizada | Publicada en GitHub | Parche de escritorio para Windows/macOS: fuerza recarga del frontend servido localmente y evita que Electron reutilice bundles viejos despues de actualizar. |
| 0.2.7 | Corte instalable de trabajo | Publicada en GitHub | Integra las mejoras acumuladas de analitica, monitoreo, hojas de ruta, calculo de muestra, enciclopedia y bundle web actualizado. |
| 0.2.8 | Graficador avanzado | Publicada en GitHub | Normaliza configuracion `graficos/4`, mejora import/export por secciones, agrega editor visual de layout, paletas sugeridas y validacion numerica defensiva. |
| 0.2.9 | Validacion y editor reforzados | Publicada en GitHub | Agrega motor de transformaciones de limpieza, fortalece reglas custom/AST, mejora persistencia y foco del editor XLSForm, y pule graficador/carga. |
| 0.3.0 | Corte 0.3: auditoria, conexiones y multibase | Publicada en GitHub | Documenta la arquitectura canonica con ADRs, agrega auditoria reproducible, centraliza conexiones SurveyMonkey/Kobo fuera del `.pulso`, refuerza multibase/monitoreo, rediseña Home y amplia pruebas. |
| 0.3.1 | Corte 3.1: multibase, hojas de ruta y validacion por fuente | Publicada en GitHub | Aplica logica XLSForm de una base plantilla a hermanas compatibles, soporta importacion SurveyMonkey multifuente con perfiles de exclusion de validacion, separa hojas de ruta piloto/campo real, mejora drilldowns de validacion/Plotly, recupera fuentes procesadas de Graficos cuando el cache queda incompleto y corrige titulos Word/PPT desde etiquetas XLSForm. |
| 0.3.2 | Corte 3.2: hotfix de hojas de ruta | Publicada en GitHub | Corrige layout del PDF integrado de hojas de ruta, evita que las tablas de revision final atrapen el scroll vertical y estabiliza las tarjetas del inspector de zonas. |
| 3.3.1 | Corte 3.3.1: graficos, iconos y estabilidad | Publicada en GitHub | Expone el selector de PNG en Contenido para slides con icono, evita crashes por etiquetas/titulos malformados al volver a Graficos y conserva las mejoras de titulos, canvas dinamico, paletas por lista y export PPT/Word del corte 3.3. |
| 3.3.2 | Corte 3.3.2: procesamiento y graficos | Publicada en GitHub | Mejora recodificacion y persistencia de codificacion, limpia opciones Otros en frecuencias/reportes, ordena paletas y categorias segun instrumento, permite controlar ceros en barras agrupadas, conserva labels de SurveyMonkey y refuerza pruebas de PPT/Word. No incluye las mejoras de Monitoreo que siguen en desarrollo. |
| 3.3.3 | Corte 3.3.3: SurveyMonkey y monitoreo operativo | Publicada en GitHub | Agrega actualizacion incremental SurveyMonkey multibase con campanas/canales persistidos, registros validos bajo consentimiento y recodificacion; suma centro operativo de Monitoreo con Google Sheets controlado y consultas internas. |
| 3.3.4 | Corte 3.3.4: deploy final SurveyMonkey y monitoreo | Publicada en GitHub | Mantiene el flujo SurveyMonkey multibase/campanas, suma pulido final de Monitoreo territorial con nomenclatura de registros validos/no validos y estabiliza el empaquetado macOS sin firma automatica local. |
| 3.4.0 | Corte 3.4: monitoreo publicable y fuentes offline | Version actual para deploy | Publica reportes agregados de Monitoreo como artefactos web read-only, agrega importacion offline SurveyMonkey por workbook y ZIP SAV, export/import JSON de codificacion, variables excluidas en Validacion y mejoras territoriales de campo. |

## Version actual

Estamos en `3.4.0` (corte `3.4`). Esta es la version publicada como
`v3.4.0` para que GitHub Releases genere el instalador y el auto-updater la
detecte.
