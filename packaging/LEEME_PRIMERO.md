# Prosecnur — uso local

Esta carpeta contiene una versión ejecutable de Prosecnur para usar
en tu equipo.

## Requisitos

- **Windows con `Prosecnur-Setup.exe`**: no requiere R, Node, pnpm ni
  internet. El instalador trae Electron, R y los paquetes R necesarios.
- **Carpeta portable/launcher legacy**: puede requerir R, Node y pnpm si
  usas los launchers de desarrollo en vez del instalador autosuficiente.
- **Quarto** (opcional): solo si vas a exportar reportes de enumeradores
  a PDF. https://quarto.org

## Instalar o Abrir Prosecnur

- **Windows recomendado**: doble click en `Prosecnur-Setup.exe`. Instala
  Prosecnur, crea accesos directos, registra el desinstalador y asocia los
  archivos `.pulso` para que abran con Prosecnur por defecto.
- **Windows portable**: descomprime `Prosecnur-Windows-self-contained.zip`
  y abre `Prosecnur.bat`.
- **macOS**: doble click en `Prosecnur.app`.

La primera vez tarda más porque prepara el runtime local de R y los
paquetes offline. A partir de la segunda apertura arranca en segundos.

## ¿Algo falló?

Revisa los logs:

- **macOS**: `~/Library/Logs/Prosecnur/` (setup.log + desktop.log)
- **Windows**: `%LOCALAPPDATA%\Prosecnur\logs\`

Desde la ventana de la app, el menú **Ayuda → Abrir carpeta de logs**
los abre directo.

## Qué incluye esta carpeta

- `Prosecnur.app` — launcher macOS (doble click).
- `Prosecnur.bat` — launcher Windows (doble click).
- `Internals/` — código del motor R, frontend compilado y shell Electron.
- `runtime/` — Electron, instalador local de R y paquetes R offline
  (solo en el bundle Windows autosuficiente).
- `README_DESARROLLO.md` — notas técnicas para devs.

El runtime de Electron se instala en `~/Library/Application Support/Prosecnur/`
(macOS) o `%LOCALAPPDATA%\Prosecnur\` (Windows) al primer arranque, así la
carpeta distribuible se mantiene liviana.
