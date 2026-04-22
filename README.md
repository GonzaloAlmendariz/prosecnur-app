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
- Node ≥ 20 con pnpm
- (Opcional) [Quarto CLI](https://quarto.org) para el reporte de
  enumeradores en PDF.

## Primer arranque

```bash
# 1) Instalar dependencias R
make install-r

# 2) Instalar dependencias del frontend
make install-frontend

# 3a) Dev con hot-reload del frontend (dos terminales):
make dev-api        # terminal 1 — Plumber en :8787
make dev-frontend   # terminal 2 — Vite en :5173 (proxy /api → :8787)

# 3b) O build integrado y abrir como app local:
make build
make dev-api        # abre el browser automáticamente en :8787
```

## Empaquetado local

Para generar una carpeta ejecutable de uso interno, sin incluir el código
fuente del frontend ni `node_modules`:

```bash
make package-local
open "dist.nosync/Prosecnur/Prosecnur.app"
```

El output va a `dist.nosync/` (sufijo `.nosync` para que iCloud Drive
no sincronice builds locales — evita copias fantasma "Prosecnur 2/3/4"
por conflicto de sync si el repo vive dentro de iCloud).

Para abrirlo como ventana de escritorio:

```bash
make install-desktop
make desktop
```

La carpeta generada incluye `Prosecnur.app` como entrada principal en macOS,
un `LEEME_PRIMERO.md`, y launchers auxiliares dentro de `Internals/launcher`.

Nota: en esta etapa la ventana propia requiere Node/pnpm para instalar Electron
la primera vez. El instalador formal (`.dmg`/`.exe`) vendría después.

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
launcher/                         Scripts de arranque (.command/.sh/.bat)
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
