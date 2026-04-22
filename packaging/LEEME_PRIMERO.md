# Prosecnur - uso local

Esta carpeta contiene una version local ejecutable de Prosecnur.

## Requisitos

- R 4.1 o superior instalado.
- Node.js 20 o superior con pnpm para usar la ventana propia.
- Internet solo la primera vez, si faltan paquetes R.
- Quarto es opcional y solo hace falta para reportes de enumeradores en PDF.

## Primera vez

En macOS:

1. Abrir `Internals/launcher/install-r-deps.command`.
2. Cuando termine, abrir `Prosecnur.app` para usar ventana propia.

En Windows:

1. Abrir `Internals\launcher\install-r-deps.bat`.
2. Cuando termine, abrir `Internals\launcher\prosecnur-desktop.bat` para usar ventana propia.

## Uso diario

Abrir Prosecnur con ventana propia:

- macOS: `Prosecnur.app`
- Linux: `Internals/launcher/prosecnur-desktop.sh`
- Windows: `Internals\launcher\prosecnur-desktop.bat`

Tambien se puede abrir en navegador:

- macOS: `Internals/launcher/prosecnur.command`
- Linux: `Internals/launcher/prosecnur.sh`
- Windows: `Internals\launcher\prosecnur.bat`

La app corre localmente en `http://127.0.0.1` y la ventana propia se conecta al
backend local de R.

## Que incluye esta carpeta

- `Prosecnur.app`: entrada principal en macOS, sin abrir Terminal.
- `Internals/api/`: backend R, motor analitico y frontend ya compilado.
- `Internals/desktop/`: envoltorio Electron para abrir Prosecnur como ventana propia.
- `Internals/launcher/`: scripts auxiliares para instalar dependencias R y abrir la app.
- `README_DESARROLLO.md`: notas tecnicas del repositorio original.

Esta version no incluye el codigo fuente del frontend ni `node_modules`.
En macOS, `Prosecnur.app` lleva su copia interna del motor de la app, para no
depender de permisos sobre carpetas externas. La primera apertura instala solo
el runtime de escritorio en `~/Library/Application Support/Prosecnur/desktop-runtime`,
no dentro de esta carpeta. Asi `dist.nosync/Prosecnur` se mantiene liviano y ordenado.
