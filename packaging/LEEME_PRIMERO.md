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
  archivos `.pulso` para que abran con Prosecnur por defecto. Si ya tenías
  una versión anterior, el instalador la actualiza in-place sin perder tus
  proyectos ni el runtime de R local.

  > **Nota:** el instalador todavía no está firmado con un certificado
  > Authenticode. La primera vez Windows SmartScreen va a mostrar
  > "Editor desconocido" — clic en **Más información → Ejecutar de todos
  > modos**. Esto se resuelve cuando incorporemos firma de código.
- **Windows portable**: descomprime `Prosecnur-Windows-self-contained.zip`
  y abre `Prosecnur.bat`.
- **macOS recomendado**: doble click en `Prosecnur-<version>-arm64.dmg`
  (Apple Silicon) o `Prosecnur-<version>-x64.dmg` (Intel) y arrastra
  Prosecnur a la carpeta Aplicaciones. La primera vez que abras el
  programa, macOS te va a pedir tu contraseña de administrador para
  instalar R 4.5.1 en `/Library/Frameworks/`. Es un paso único; los
  paquetes R y la asociación de archivos `.pulso` se configuran solos.

  > **Nota:** ni el `.exe` ni el `.dmg` están firmados con certificado
  > Apple Developer / Authenticode. La primera vez Gatekeeper (mac) y
  > SmartScreen (Windows) te van a avisar "editor desconocido". En mac
  > basta con clic-derecho → Abrir → Abrir; en Windows, "Más información"
  > → "Ejecutar de todos modos". Esto se resuelve cuando incorporemos
  > firma de código.

## Actualizaciones

Una vez instalado, Prosecnur revisa al arrancar si hay una versión nueva
en [GitHub Releases](https://github.com/GonzaloAlmendariz/prosecnur-app/releases)
y la descarga en background. Cuando termina, te muestra un diálogo
"Reiniciar y actualizar / Más tarde". Si aceptas, se reabre con la nueva
versión sin perder tus proyectos ni el runtime de R.

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
