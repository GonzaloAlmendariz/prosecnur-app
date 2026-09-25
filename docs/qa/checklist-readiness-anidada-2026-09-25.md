# Checklist — readiness con marcas anidadas (2026-09-25)

Origen: E15 del loop de Cálculo de muestra, ítem AD6 de
`checklist-calc-muestra-patron-aulas-2026-09-24.md`. `estadoListo()` leía sólo
la PRIMERA `[data-audit-ready]` del documento; en `cursos-horario` esa es la de
`motor/ResumenDiseno.tsx` (siempre verdadera) y el Explorador se capturaba en
«Leyendo la base…» con su propia marca en `false`.

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| R1 | Auditar las marcas que quedan en `false` en un estado TERMINAL y hacer que publiquen un valor listo con su vacío clasificado (C5) | `frontend/src/**` (marcas anidadas) | ☑ 11 superficies de Cálculo de muestra pasan a `vacio:<motivo>` (ver tabla abajo); el resto de `false` son cargas, declaradas en `FALSE_TRANSITORIO` |
| R2 | Contrato nuevo: lista sólo si ninguna `[data-audit-ready="false"]` activa sigue en false — `runtime.ts` y fallback de `ui-quick-check.mjs`, con tests | `lib/navegacion/runtime.ts`, `scripts/ui-quick-check.mjs`, `src/app/readinessAnidada.contract.test.ts`, `scripts/tests/ui-quick-check-readiness-anidada.test.mjs` | ☑ documento entero salvo subárboles inactivos; los tests de fixture fallan con el runner viejo (3/4) y pasan con el nuevo |
| R3 | Verificar con `ui-quick-check` en varios módulos que ninguna vista queda colgada y que el Explorador ya no sale en «Leyendo la base…» | QA visual con proyectos de referencia | ☑ 32 capturas en 4 proyectos (hsvg2026, acnur_acg, acrconta, acnur_pdm), los 8 módulos: ninguna colgada, md5 todas distintas. Explorador capturado con la base leída (136.284 filas) |
| G | Gate: `tsc --noEmit`, `make gate-front AREA=…`, `node --test scripts/tests/*.test.mjs` en serie; commit | — | ☑ tsc 0 · gate-front calcMuestra (2487) y monitoreo (5200) · scripts/tests 114/116: los 2 rojos de `vaults-check` fallan igual en HEAD |

## Notas

- Convención para un estado terminal sin contenido: `data-audit-ready="vacio:<motivo>"`.
  Cuenta como listo (no es `"false"`), y el motivo queda en el informe del runner
  (`ready: [...]`), así que el vacío está clasificado y no sólo tolerado.
- `false` significa sólo «todavía no»: carga, rehidratación, cálculo en curso.
- Una marca `false` dentro de un subárbol inactivo (un ANCESTRO con `hidden`,
  `inert` o `display: none`) no bloquea: es una pestaña montada que no se ve.
  El propio nodo oculto sí cuenta: Monitoreo publica su marca en un
  `<span hidden>` que está en `false` mientras carga.

## R1 — superficies corregidas

| Superficie | Estado terminal | Marca nueva |
|---|---|---|
| `marco/AlumnosPorChMarcoTab` | sin distribución acreditada / borrador sin confirmar | `vacio:alumnos-por-ch-sin-distribucion` · `vacio:alumnos-por-ch-sin-confirmar` |
| `marco/CriteriosRadiografiaRecovery` | radiografía por reconstruir | `vacio:radiografia-por-reconstruir` |
| `marco/CriteriosRadiografiaCardDetalle` | tarjeta legacy/inválida o I18b incompleta | `vacio:radiografia-<estado>` |
| `criterios/CriteriosMarcoTab`, `marco/CursosHorarioMarcoTab` | sin catálogo / marco no publicable | `marcaDeCriterios()` → `vacio:sin-catalogo-de-criterios` · `vacio:marco-<integridad>` |
| `calculo/CalculoCursosHorarioFacultadTab` | sin resultado / titulares fijados / desactualizado | `vacio:sin-resultado` · `vacio:titulares-fijados-sin-recalcular` · `vacio:resultado-desactualizado` |
| `calculo/CalculoDistribucionTab` | empty/legacy/stale/invalid | `vacio:distribucion-<kind>` |
| `calculo/CalculoComparacionEscenarios` | estado no `ready` | `vacio:comparacion-<kind>` |
| `definicion/DefHistoricoTab` | sin referencia histórica | `vacio:sin-referencia-historica` |
| `definicion/FiltrosCorteCard` | filtros sin confirmar | `vacio:filtros-sin-confirmar` |
| `aulas/relato/RelatoTab` | bloqueo de etapa / sin escenas | `vacio:relato-<kind>` · `vacio:relato-sin-escenas` |

Fuera de alcance, anotado: los `false` de **página** ante un error (Telefónico y
Acreditación con `!error`, Bitácora con `!loading && !error` fijado en
`auditReadyRoutes`) ya colgaban el QA antes de este cambio. La política de la
casa hoy es «un error de página no está listo»; cambiarla es una decisión, no
un arreglo.

## R3 — lo que destapó la verificación (fuera de alcance)

- **El Explorador tiene 3 defectos que antes no se veían**, porque se capturaba
  cargando: `overflow-y` en «Filtrar por…» (`.cmv2-expb-anadir`), `overflow-x`
  en rótulos largos de categoría (`.cmv2-expb-cat-label`) y `capacity-drift`
  en `calc-muestra/explorador-bases`. Son del Explorador, no del contrato.
- **Falso verde en `/carga` (acnur_acg)**: se capturó «Preparando mesa
  multibase» con `ready: []`. `CargaPage` pasa `auditReady={false}` a
  `PageFrame`, que BORRA el atributo en vez de publicar `"false"`. Tarea aparte.
- `vaults-check` en rojo en HEAD (nodos de bóveda desalineados con el contrato
  de navegación). Previo y ajeno a este cambio.
