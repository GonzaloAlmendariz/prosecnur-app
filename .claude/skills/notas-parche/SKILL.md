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
- Consolida series de commits; no los traduzcas uno por uno ni inventes efectos
  para llenar la lista.
- Un fix describe el comportamiento correcto conseguido, no detalles
  vergonzosos del defecto.
- El nombre del corte en el documento sigue el patrón ya existente y resume el
  tema dominante.
- Una idea por viñeta, y como mucho tres oraciones. Una viñeta con cuatro
  cláusulas subordinadas no es exhaustiva: es un párrafo sin decidir qué
  importa. Pártela o recórtala.

### Prohibiciones de redacción

Estas no son preferencias de gusto. Cada una marca prosa escrita en piloto
automático, y quien lee las notas reconoce el tono antes que el contenido.

- **Nada de guion largo (`—`)**. En español el inciso va con comas, con
  paréntesis o con punto y seguido. El guion largo se volvió muletilla y
  aparece donde el autor no decidió la puntuación. Verificable:
  `grep -c '—' frontend/src/features/home/releaseNotes.ts` debe dar 0 en las
  entradas nuevas.
- **Ni «permite» ni «posibilita» ni «brinda la posibilidad de»**. El sujeto es
  la app o la persona: «Codificación asigna una respuesta a varias
  categorías», no «Codificación permite asignar». Si el verbo real no aparece,
  la frase no dice qué pasa.
- **Sin la coletilla «para que puedas…»**. El beneficio se enuncia, no se
  justifica al final de cada línea.
- **Sin adjetivos de folleto**: robusto, potente, optimizado, intuitivo,
  moderno, fluido, mejorado, avanzado. No aportan información y no se pueden
  comprobar.
- **No parafrasear el nombre del módulo**. «Monitoreo: mejora el monitoreo del
  campo» gasta la línea que debía traer el dato.
- **No abrir todas las viñetas igual.** Tres «Ahora puedes…» seguidos delatan
  plantilla.
- **Nada de superlativos ni de cifras vagas** («mucho más rápido»,
  «notablemente»). O va el número medido, o va el hecho sin adorno.

### El criterio de fondo

Una nota sirve cuando alguien que usó la versión anterior reconoce qué le
cambia el trabajo. Antes de dejar una viñeta, comprueba que responde a **qué
puede hacer hoy que ayer no**, o **qué dejó de fallar**. Si la respuesta es
«se mejoró internamente», es un commit, no un highlight: va a la fila del
documento de versiones, no a las notas que lee la persona usuaria.

## Cierre

Reporta versión, rango de commits, commits mapeados/internos/pendientes, tags
históricos saldados, superficies editadas y resultado de las dos validaciones.
