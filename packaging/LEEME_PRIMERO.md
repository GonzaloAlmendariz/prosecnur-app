# Prosecnur — uso local

Esta carpeta contiene una versión ejecutable de Prosecnur para usar
en tu equipo.

## Requisitos

- **R 4.1 o superior**: https://cran.r-project.org
- **Node.js 20 o superior**: https://nodejs.org
- **pnpm** (viene con Node vía `corepack enable`)
- **Internet** solo la primera vez, para bajar los paquetes de R.
- **Quarto** (opcional): solo si vas a exportar reportes de enumeradores
  a PDF. https://quarto.org

## Abrir Prosecnur

Doble click en el archivo según tu sistema:

- **macOS**: `Prosecnur.app`
- **Windows**: `Prosecnur.bat`

La primera vez tarda más porque instala paquetes R y Electron — puede
tomar varios minutos. A partir de la segunda apertura arranca en segundos.

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
- `README_DESARROLLO.md` — notas técnicas para devs.

El runtime de Electron se instala en `~/Library/Application Support/Prosecnur/`
(macOS) o `%LOCALAPPDATA%\Prosecnur\` (Windows) al primer arranque, así la
carpeta distribuible se mantiene liviana.
