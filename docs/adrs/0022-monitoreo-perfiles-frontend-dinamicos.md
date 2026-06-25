# ADR 0022: Monitoreo con perfiles frontend dinamicos y arranque dev rapido

Estado: Aceptado

Fecha: 2026-06-24

## Contexto

Monitoreo concentra tres familias activas (`acreditacion`, `territorial` y
`aulas_universitarias`) dentro de una misma entrada de navegacion. El archivo
frontend principal de Monitoreo crecio hasta mezclar shell, mapas, validacion,
avance, consultas, aulas y acreditacion, lo que genera chunks grandes y hace
que el arranque de desarrollo pague costos que no siempre corresponden al
proyecto abierto.

El flujo de desarrollo tambien estaba bloqueado por `tsc -b` antes de abrir
Electron. En una maquina local eso puede convertir un cambio visual pequeno en
una espera larga, aunque el build estricto siga siendo necesario para release,
instalables y CI.

## Decision

Monitoreo sigue siendo un solo modulo funcional y una sola entrada de
navegacion. Internamente, el frontend debe organizarse por perfiles dinamicos:

- `acreditacion`
- `territorial`
- `aulas_universitarias`

Cada perfil declara sus vistas y scopes de datos en un contrato propio. El
warmup y los preloads deben resolver la familia desde `monitoreo_profile.family`
para preparar solo el perfil activo del proyecto. Territorial mantiene vistas
separables para fuentes, manzanas/mapa, avance, validacion, consultas y
ocurrencias.

Vite debe declarar chunks manuales para dependencias pesadas y fronteras de
Monitoreo: Plotly, tablas/interacciones, cartografia, core de Monitoreo,
Monitoreo territorial, Monitoreo acreditacion y Monitoreo aulas.

El target `desktop-fast` pasa a usar un build rapido de frontend cuando el
bundle esta stale:

```text
pnpm build:fast
```

El build rapido ejecuta `vite build` sin `tsc -b`. El build estricto queda como
contrato de release:

```text
pnpm build
```

que conserva `tsc -b && vite build`. El typecheck tambien queda disponible como
script explicito:

```text
pnpm typecheck
```

Antes de `desktop-fast`, el preflight revisa puertos Prosecnur dev conocidos
(`8787-8789`) y muestra un aviso si ya hay procesos escuchando. No cierra
procesos automaticamente.

## Consecuencias

El desarrollo local puede abrir Electron sin esperar el typecheck completo, lo
que reduce el ciclo de ajuste visual y pruebas manuales. La responsabilidad de
validar tipos no desaparece: se mueve a `make build`, instalables, CI o
ejecucion manual de `pnpm --dir frontend typecheck`.

Monitoreo queda preparado para una extraccion incremental de UI por familia.
Durante la transicion puede coexistir un shell comun con componentes heredados,
pero los nuevos contratos de warmup y chunking no deben volver a importar todo
Monitoreo para tareas livianas como cartografia local o seleccion de perfil.

El preflight de puertos no resuelve automaticamente conflictos porque un puerto
ocupado puede pertenecer a una sesion de trabajo valida. Su objetivo es hacer
visible el estado antes de que Electron elija otro puerto o el usuario crea que
esta probando una API distinta.

## Cumplimiento

- `frontend/package.json` debe mantener `build`, `build:fast` y `typecheck`.
- `make desktop-fast` debe depender de un preflight de puertos y de un build
  stale rapido que use `pnpm build:fast`.
- `make build`, `package-local` e instalables deben seguir usando build
  estricto.
- `frontend/src/features/monitoreo/profiles/registry.ts` debe exponer loaders
  dinamicos por familia activa.
- El warmup de cartografia territorial no debe importar
  `MonitoreoPage.tsx`.
- `frontend/vite.config.ts` debe declarar chunks manuales para Plotly,
  cartografia y perfiles de Monitoreo.

## Notas

Relacionado con ADR 0010 (Monitoreo como centro de control operativo), ADR
0011 (cache persistida de mapas territoriales), ADR 0019 (Monitoreo de aulas
universitarias) y ADR 0021 (arranque con proyecto y warm start local).
