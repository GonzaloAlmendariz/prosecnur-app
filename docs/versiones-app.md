# Versiones de Prosecnur

Este mapa resume las versiones instalables y los nombres operativos de cada corte.
La fuente de verdad para empaquetado es `api/DESCRIPTION`.

| Version | Nombre | Estado | Contenido principal |
| --- | --- | --- | --- |
| 0.2.1 | Instalador autosuficiente inicial | Publicada en GitHub | Primer flujo instalable con runtime local y updater. |
| 0.2.2 | Escritorio robusto | Publicada en GitHub | Manejo global de errores, carga segura del updater y correcciones de bundle. |
| 0.2.3 | Instalador Windows estable | Publicada en GitHub; ultima publica antes de este corte | Correccion de reinstalacion/desinstalacion cuando `electron.exe` queda abierto. |
| 0.2.4 | Checkpoint operativo local | Tag local, no publicado en GitHub | Base previa de mejoras grandes de UI, hojas de ruta y editor; no se usa como instalable publico. |
| 0.2.5 | Monitoreo y cartografia oficial | Version actual a publicar | Compatibilidad data/XLSForm, marco INEI 2017 oficial con cartografia/NSE, flujo operativo de hojas de ruta, monitoreo Kobo/SurveyMonkey, exportacion de iconos y bundle web actualizado. |

## Version actual

Estamos en `0.2.5`. Esta es la version que debe publicarse como `v0.2.5`
para que GitHub Releases genere el instalador y el auto-updater la detecte.
