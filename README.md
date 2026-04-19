# prosecnur-app (Pulso Report)

Aplicación web local que expone el motor analítico [`prosecnur`](../prosecnur) a analistas no-programadores. Corre en la máquina del analista, un solo usuario, sesión efímera.

Arquitectura: **Plumber (R)** en `127.0.0.1:8787` sirve API REST + assets estáticos del frontend. **React + Vite + TypeScript** como SPA.

## Estado

**Fase 1 (walking skeleton)**: carga de XLSForm + data, parseo y resumen. Sin procesamiento analítico todavía.

Roadmap completo: `../.claude/plans/pulso-report-podr-a-desarrollarse-recursive-kurzweil.md` (o el plan equivalente en este repo cuando se migre).

## Requisitos

- R ≥ 4.1
- Node ≥ 20 con pnpm
- El paquete `prosecnur` disponible localmente (por defecto en `../prosecnur`)

## Primer arranque

```bash
# 1) Instalar dependencias R (incluye prosecnur desde ../prosecnur)
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

## Estructura

```
api/              Paquete R con la API Plumber
  R/              plumber_app.R, routers, session_store, errors, io
  inst/www/       Build del frontend (generado por `make build`)
frontend/         React + Vite + TypeScript
launcher/         Scripts de arranque (.command/.sh/.bat) y launch.R
docs/             Arquitectura, referencia de API, flujos
tests/e2e/        Playwright (futuras fases)
```

## Flujo actual (fase 1)

1. Browser pide `/api/system/health` → confirma versiones.
2. `POST /api/session` → crea session_id (UUID) y lo guarda en localStorage.
3. Usuario selecciona XLSForm → `POST /api/files/upload` (kind=xlsform) → `POST /api/carga/instrumento` → ve n_preguntas, n_secciones, secciones.
4. Usuario selecciona data (.xlsx/.sav/.csv) → upload (kind=data o sav) → `POST /api/carga/data` → ve n_filas, n_columnas, columnas.

## Fases siguientes

Ver plan. En orden: validación → codificación → preparación + reportes analíticos → reportes gráficos → dashboard.
