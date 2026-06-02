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
| 0.3.0 | Corte 0.3: auditoria, conexiones y multibase | Version actual a publicar | Documenta la arquitectura canonica con ADRs, agrega auditoria reproducible, centraliza conexiones SurveyMonkey/Kobo fuera del `.pulso`, refuerza multibase/monitoreo, rediseña Home y amplia pruebas. |

## Version actual

Estamos en `0.3.0` (corte `0.3`). Esta es la version que debe publicarse como
`v0.3.0` para que GitHub Releases genere el instalador y el auto-updater la
detecte.
