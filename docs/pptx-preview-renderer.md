# Preview inline de PPTX

La preview exacta de un slide se genera en dos pasos:

1. `reporte_ppt_plan()` crea un mini-PPTX de un solo slide.
2. El backend intenta convertir ese PPTX a PNG con un renderizador headless.

No se automatiza PowerPoint, Keynote, QuickLook ni capturas del escritorio. Esto evita permisos del sistema y mantiene el mismo criterio para macOS y Windows.

## Renderizadores soportados

### LibreOffice / soffice

Es el renderizador recomendado para equipos de usuario.

La app lo detecta en este orden:

- `PROSECNUR_BUNDLED_SOFFICE`
- `PROSECNUR_SOFFICE`
- `SOFFICE_PATH`
- `LIBREOFFICE_PATH`
- un renderer empaquetado en `Internals/preview-renderer`
- `soffice` o `libreoffice` en `PATH`
- rutas típicas de LibreOffice en macOS y Windows

Ejemplos:

```bash
PROSECNUR_SOFFICE="/Applications/LibreOffice.app/Contents/MacOS/soffice" make dev-api
```

```bat
set PROSECNUR_SOFFICE=C:\Program Files\LibreOffice\program\soffice.exe
Prosecnur.bat
```

### Renderer empaquetado

Para que el preview exacto funcione sin depender de instalaciones externas, el
paquete de escritorio puede incluir LibreOffice/soffice dentro de:

```text
Internals/preview-renderer/
```

Rutas esperadas:

- macOS: `Internals/preview-renderer/LibreOffice.app/Contents/MacOS/soffice`
- Windows: `Internals/preview-renderer/LibreOffice/program/soffice.exe`
- Windows portable: también se acepta `runtime/preview-renderer/LibreOffice/program/soffice.exe`, como hermano de `Internals/`

Si ese binario existe, el backend lo prefiere sobre `PATH`. El fallback visual
local sigue disponible aunque el paquete no traiga el renderer exacto.

### artifact-tool

Es un renderizador interno para desarrollo y QA visual. No es requisito para usuarios finales.

La app lo autodetecta si el módulo existe en `node_modules` del repo, `desktop/`, `frontend/`, `NODE_PATH` o en el runtime local de Codex. En Electron, si lo encuentra, el backend R recibe el binario de Electron como Node mediante `ELECTRON_RUN_AS_NODE=1`; no se requiere instalar Node aparte en el equipo destino.

Variables:

```bash
PROSECNUR_ENABLE_ARTIFACT_RENDERER=1
PROSECNUR_NODE=/ruta/a/node
PROSECNUR_ARTIFACT_TOOL_MODULE=/ruta/a/@oai/artifact-tool/dist/artifact_tool.mjs
```

## Diagnóstico

El estado efectivo se puede consultar en:

```text
GET /api/graficos/preview-renderer
```

La respuesta indica si hay renderer disponible, cuál se usará y confirma que `desktop_automation` es `false`.

## QA visual

El test compara internamente:

- un PPT completo con una slide previa;
- el mini-PPTX de solo el slide seleccionado;
- ambos renderizados a PNG por el mismo renderer headless.

Comando base:

```bash
Rscript -e 'pkgload::load_all("api", quiet=TRUE); testthat::test_file("api/tests/testthat/test-graficos-preview-compare.R")'
```

Sin renderer, las pruebas visuales se saltan de forma explícita. Con renderer, deben pasar los casos de un gráfico, dos gráficos, slide estructural y layouts 4:3/16:9.
