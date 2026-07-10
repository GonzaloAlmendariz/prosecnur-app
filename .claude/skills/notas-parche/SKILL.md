---
name: notas-parche
description: Redactor de notas de parche de Prosecnur - convierte los commits de cada versión en novedades, mejoras y fixes redactados de forma elegante y profesional para el espacio de Novedades de la app, el mapa de versiones y las release notes de GitHub; detecta y salda versiones no mapeadas. Usar en cada release/publish, cuando el usuario pida "notas del parche", "novedades de la versión", o cuando haya versiones sin mapear.
---

# Notas de parche

Cada corte de Prosecnur merece notas que el usuario final pueda leer: qué hay de nuevo, qué mejoró y qué se corrigió — **sin explicar el cómo**. Este skill redacta y mantiene las TRES superficies sincronizadas.

## Las tres superficies

1. **In-app (la principal)**: `RELEASE_NOTES: ReleaseNote[]` — formato `{version, date, highlights: string[]}` — se muestra en Configuración → Novedades (`GlobalSettingsDialog`) y en `ReleaseNotesDrawer`. Ubicación canónica: `frontend/src/features/home/releaseNotes.ts`; si aún vive inline en `HomePage.tsx`, extráela a ese archivo propio en la primera corrida (HomePage solo la importa).
2. **Mapa de versiones**: `docs/versiones-app.md` — tabla `Version | Nombre | Estado | Contenido principal` + sección "Versión actual". Es la vista de operación (qué corte está publicado/instalable).
3. **GitHub Release**: cuando la corrida es parte de un release (`/preparar-release`), el mismo material alimenta las notas del Release en vez de `generate_release_notes` genérico.

## Flujo

1. **Detecta lo no mapeado**: compara `git tag -l 'v*'` contra las versiones presentes en `RELEASE_NOTES` y en la tabla de `versiones-app.md`. Toda versión taggeada sin entrada se redacta también (deuda histórica primero, en orden cronológico). Ojo: el esquema de versiones tuvo un reinicio (3.3.x/3.4.x son ANTERIORES a 0.4.0) — ordena por fecha de tag (`git log -1 --format=%ai <tag>`), no por semver.
2. **Junta la materia prima por versión**: `git log <tagAnterior>..<tag> --oneline` (rango entre tags consecutivos POR FECHA). Agrupa por scope de conventional commit y mapea el scope al nombre canónico del módulo (jerarquía oficial: Bitácora, Cálculo de muestra, Editor de formularios, Hojas de ruta, Fichas QR, Monitoreo, Procesamiento —Carga/Validación/Codificación/Analítica/Gráficos—, Dashboard).
3. **Redacta** siguiendo la guía de estilo de abajo: 4–7 highlights por versión, orden novedades → mejoras → correcciones.
4. **Escribe** en las superficies: entrada nueva al INICIO de `RELEASE_NOTES` (la más reciente primero), fila nueva en la tabla del doc + actualizar "Versión actual", y las notas de Release si aplica.
5. **Verifica**: `pnpm --dir frontend typecheck` (la data es TS). Si quieres evidencia visual, `/ver-ui` → Configuración → Novedades.

## Guía de estilo (la parte que importa)

- **Español profesional y cálido**; cada highlight arranca con el módulo en negrita implícita del patrón existente: `"Módulo: verbo en presente + beneficio."` (ej. "Gráficos: aplica colores por lista en preview y export.").
- **Qué, no cómo**: nada de nombres de archivos, funciones, SHAs, "refactor", "engine", "AST", "namespace". El lector es el investigador que usa la app, no el desarrollador.
- **Verbos de valor**: agrega, permite, muestra, corrige, acelera, estabiliza, evita. Prohibido "se implementó", "se refactorizó".
- **Filtra lo interno**: chores de CI, deps, tooling del repo y QA no aparecen — salvo que el usuario lo perciba (updater, instalador, rendimiento, arranque).
- **Fixes con dignidad**: describir el comportamiento correcto logrado, no el bug en detalle vergonzoso ("corrige el orden de las categorías en cruces multibase", no "arregla crash $ operator is invalid").
- **Consolidar, no inventariar**: 30 commits de un módulo pueden ser 1–2 highlights; se destila la historia de la versión, no se traduce commit por commit.
- Nada de menciones a herramientas de AI.
- El `Nombre` de la fila del doc sigue el patrón existente: "Corte X.Y.Z: tema dominante" (2–5 palabras).

## Integración

Este skill es el paso de redacción de `/preparar-release` (sus notas de release salen de aquí) y puede correr solo para saldar deuda de versiones. Cierra siempre reportando: versiones redactadas, superficies tocadas y typecheck.
