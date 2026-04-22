# Prosecnur

Aplicación local todo-en-uno: **motor analítico + REST API + frontend React**
para que analistas no-programadores generen reportes de encuestas
(XLSForm + data → codebook, frecuencias, cruces, PPT, Word). Corre en la
máquina del analista, un solo usuario, sesión efímera.

Arquitectura: **Plumber (R)** en `127.0.0.1:8787` sirve API REST + assets
estáticos. **React + Vite + TypeScript** como SPA.

## Estado

A partir de **v0.2** el motor analítico (antes paquete R externo
`prosecnur`) vive dentro del paquete `prosecnurapp`. Un solo paquete, un
solo monorepo. El paquete histórico `prosecnur` en `../prosecnur/` queda
**read-only** como referencia — no se toca más.

Fases del producto:
1. **Carga** (XLSForm + data) — listo.
2. **Validación** de data — listo.
3. **Codificación** de preguntas abiertas — listo.
4. **Analítica** (frecuencias, cruces, bases, codebook, enumeradores) — listo.
5. **Gráficos** (PPT + Word) — listo.

Plan actualizado (fork + multi-base):
`../.claude/plans/lo-que-sigue-faltando-compiled-balloon.md`.

## Requisitos

- R ≥ 4.1
- Node ≥ 20 con pnpm (si no tienes pnpm: `corepack enable`)
- (Opcional) [Quarto CLI](https://quarto.org) para el reporte de
  enumeradores en PDF.

## Cómo abrir Prosecnur

Un solo archivo por plataforma — doble click y listo:

- **macOS**: `Prosecnur.app` (en la raíz del repo)
- **Windows**: `Prosecnur.bat` (en la raíz del repo)

El launcher se encarga automáticamente de:

1. Verificar que R, Node y pnpm estén instalados (aborta con un mensaje
   claro si falta algo).
2. Instalar los paquetes R la primera vez (marca un sentinel para no
   repetirlo en cada apertura).
3. Compilar el frontend si hay cambios en `frontend/src/` más nuevos que
   el build actual — **así cada apertura usa la última versión del
   código sin pasos manuales**.
4. Lanzar la ventana Electron.

Logs en `~/Library/Logs/Prosecnur/` (macOS) o `%LOCALAPPDATA%\Prosecnur\logs\`
(Windows). El menú **Ayuda → Abrir carpeta de logs** los abre directo.

## Proyectos `.pulso` (workspace persistente)

Cada análisis se puede guardar como un archivo binario `.pulso` que
contiene el estado completo de la sesión: instrumento, data, plan de
validación, reglas custom, codificación, y configuración de gráficos.

- Doble click a un `.pulso` (o **Archivo → Abrir** desde la app) restaura
  todo el estado.
- **Cmd/Ctrl + S** guarda. **Cmd/Ctrl + Shift + S** guarda como.
- **Autoguardado cada 5 minutos** si hay cambios pendientes.
- **Entregables** (codebook, reporte HTML, plan, etc.) se guardan al
  lado del `.pulso` con el nombre que tú elijas, validado.
- **Modo efímero** sigue disponible: en el modal inicial, click
  "Trabajar sin proyecto" → flujo clásico con descargas a `~/Downloads`.

Los recientes (hasta 5) viven en
`~/Library/Application Support/Prosecnur/recent-projects.json` (macOS) o
`%APPDATA%/Prosecnur/recent-projects.json` (Windows).

## Dos modos de arranque

El mismo `Prosecnur.app` / `Prosecnur.bat` funciona en dos modos según
dónde vive el archivo:

| Modo | Cuándo | Qué hace |
|------|--------|----------|
| **DEV** | El archivo está en la raíz del repo (default) | Apunta al código en vivo; rebuilda el frontend si hay cambios |
| **PACKAGED** | El archivo está dentro de `dist.nosync/Prosecnur/` tras `make package-local` | Usa un snapshot congelado copiado a `~/Library/Application Support/Prosecnur/` |

Para distribuir el paquete como carpeta entregable:

```bash
make package-local
# Genera dist.nosync/Prosecnur/ con todo adentro (macOS + Windows).
```

El output va a `dist.nosync/` (sufijo `.nosync` para que iCloud Drive
no sincronice builds locales — evita copias fantasma "Prosecnur 2/3/4"
por conflicto de sync si el repo vive dentro de iCloud).

## Dev via CLI (alternativa a doble click)

Útil si ya tienes una terminal abierta:

```bash
make install-r        # instalar paquetes R
make install-frontend # pnpm install en frontend/
make install-desktop  # pnpm install en desktop/

make dev-api          # solo API R en :8787 (sin Electron)
make dev-frontend     # Vite dev server en :5173 (proxy /api → :8787)
make build            # compilar frontend sin levantar Electron
```

## Estructura

```
api/
  DESCRIPTION                     Paquete R: prosecnurapp
  NAMESPACE
  R/
    plumber_app.R, router_*.R     Capa REST (carga, validacion,
                                  codificacion, analitica, graficos,
                                  sistema, jobs)
    session_store.R, io.R,
    jobs.R, errors.R              Infraestructura interna

    graficador_*.R                Motor (ex-prosecnur, desde v0.2)
    reporte_*.R
    validacion_*.R
    codificacion_*.R
    indicador_*.R
    interactivo_*.R
    helpers_bases.R,
    graficos_metadata.R,
    utils_internal.R, …           Utilidades compartidas
  inst/
    samples/                       Datasets de prueba (demos)
    www/                           Build del frontend (make build)
  tests/testthat/
    test-*.R                       Tests de la capa REST
    test-engine-*.R                Tests del motor (renombrados desde
                                   el paquete original)
frontend/                         React + Vite + TypeScript
desktop/                          Shell Electron (main.cjs)
launcher/
  launch.R                        Entry point del backend R
  install-r-deps.R                Instalador de paquetes R (auto al 1er arranque)
Prosecnur.app/                    Launcher macOS (doble click)
Prosecnur.bat                     Launcher Windows (doble click)
packaging/
  LEEME_PRIMERO.md                Doc que acompaña a dist.nosync/Prosecnur/
docs/                             Arquitectura, referencia, flujos
```

## Nota sobre `PULSO_PROSECNUR_DEV` (deprecado)

Hasta v0.1.x el launcher soportaba cargar un paquete `prosecnur` externo
vía `PULSO_PROSECNUR_DEV=/ruta/al/prosecnur`. Desde **v0.2 ya no aplica**:
el motor vive dentro de `prosecnurapp`. Si todavía tenés la variable
exportada, el launcher te avisa con un `NOTE` y la ignora — podés
desexportarla sin riesgo.

## Flujo de uso

1. **Fase 1 (Carga)**: subir XLSForm + data, o elegir un demo de prueba
   (genérico / OPS / acreditación).
2. **Fase 2 (Validación)**: correr reglas de consistencia y auditoría.
3. **Fase 3 (Codificación)**: codificar preguntas abiertas por familias.
4. **Fase 4 (Analítica)**: generar codebook, frecuencias, cruces,
   enumeradores, bases (SAV/CSV/XLSX).
5. **Fase 5 (Gráficos)**: construir un plan de slides con graficadores
   (`p_slide_*` + `p_barras_*`, etc.), previsualizar y exportar a PPT/Word.
