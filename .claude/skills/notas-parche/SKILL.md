---
name: notas-parche
description: Redacta y sincroniza las notas de una versión de Prosecnur en la app, el mapa de versiones y GitHub Release; detecta commits y cortes sin mapear. Usar en cada preparación de release o cuando el usuario pida novedades de una versión.
---

# Notas de parche

Convierte el historial técnico en cambios que una persona usuaria pueda
reconocer. La misma versión se explica en tres superficies:

1. `frontend/src/features/home/releaseNotes.ts` — Novedades dentro de la app;
2. `docs/versiones-app.md` — mapa operativo e historial;
3. `.github/RELEASE_NOTES.md` — cuerpo obligatorio de GitHub Release.

Estas notas forman parte de las cinco superficies de identidad que valida
`scripts/release-contract.mjs`: `api/DESCRIPTION`, `desktop/package.json` y las
tres anteriores. No se da por cerrado un corte si una de las cinco diverge.

## Flujo

1. Lee la versión objetivo y ejecuta
   `node scripts/release-contract.mjs preview`. En un corte ya alineado usa
   `prepare`; este skill no crea tags ni publica.
2. Ordena los tags por fecha de commit, no sólo por SemVer: el historial tuvo
   una transición entre las series `3.x` y `0.x`.
3. Compara tags y versiones de las tres superficies de notas. Para cada
   intervalo usa `git log <anterior>..<actual> --oneline`; incluye también los
   commits desde el último tag hasta el candidato.
4. Construye una tabla de trazabilidad commit → versión → módulo → highlight.
   Todo commit debe quedar mapeado o marcado explícitamente como interno
   (CI, dependencias, tooling o QA sin efecto visible). Reporta por separado
   tags sin notas y commits visibles sin highlight.
5. Consolida por los ocho módulos canónicos: **Bitácora**, **Cálculo de
   muestra**, **Formularios**, **Hojas de ruta**, **Recopiladores**,
   **Monitoreo**, **Procesamiento** y **Dashboard**. **Enciclopedia** se redacta
   aparte como utilidad global, no como noveno módulo. Dentro de Procesamiento
   se puede precisar Carga, Validación, Codificación, Analítica o Gráficos.
6. Escribe la entrada más reciente al inicio de `RELEASE_NOTES`, actualiza la
   fila y `Version actual` del documento, y deja el mismo contenido destilado
   en las notas de GitHub.
7. Verifica la data TypeScript y la identidad:

   ```bash
   pnpm --dir frontend typecheck
   node scripts/release-contract.mjs preview
   ```

## Estilo

- 4–7 highlights, salvo hotfix deliberadamente pequeño; orden: novedades,
  mejoras, correcciones.
- Patrón: `Módulo: verbo en presente + beneficio`.
- Explica qué cambió y para qué sirve; omite archivos, funciones, SHAs,
  refactors, stack traces y herramientas internas.
- Usa verbos de valor: agrega, permite, muestra, corrige, acelera, estabiliza,
  evita.
- Consolida series de commits; no los traduzcas uno por uno ni inventes efectos
  para llenar la lista.
- Un fix describe el comportamiento correcto conseguido, no detalles
  vergonzosos del defecto.
- El nombre del corte en el documento sigue el patrón ya existente y resume el
  tema dominante.

## Cierre

Reporta versión, rango de commits, commits mapeados/internos/pendientes, tags
históricos saldados, superficies editadas y resultado de las dos validaciones.
