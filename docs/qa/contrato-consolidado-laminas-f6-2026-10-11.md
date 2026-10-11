# Contrato A7 — Informe compartido (consolidado) y multibase en Láminas

Tipo: Contrato de implementación
Estado: Vigente
Fecha: 2026-10-11
Autoridad: ADR 0040; lead de la Meta A; D1–D4 deciden con Gonzalo

Congelado por el lead el 2026-10-11 sobre la revisión de `guardian-contratos`. Marco: ADR 0040 (§6: el consolidado no
reutiliza `/ppt-all`; §6.1: ninguna configuración por base se migra o copia implícitamente). Sin cambio de shape
persistido ni ADR nuevo.

## Cómo funciona hoy (vale para los dos editores; casi todo vive en `GraficosPage.tsx`)

Entrada por el menú «Conjunto» (`MultibaseReportMenu.tsx`, sólo `independent_siblings`) → `?scope=consolidado` →
hidratación del borrador (`GET /consolidado/draft`) → preflight → siembra (`shouldSeedSharedPlan`) → autosave con
`expected_revision` (`POST /consolidado/draft`, 409 `E_GRAFICOS_CONSOLIDADO_DRAFT_STALE`) → gate (`canExport`,
`sharedReady`; Word fuera) → `POST /consolidado/ppt` (receta en `s$graficos_consolidado`, PPTX + manifest). `/ppt-all`
es otra cosa: ZIP por base con la config guardada de cada base. Láminas ya hereda casi todo: vista previa, miniaturas,
ranuras, categorías, Two Box, variables y cobertura respetan `scope`.

## Huecos

| # | Hueco | Severidad |
|---|---|---|
| H1 | `flushGraficosConfigIfHydrated` (`configSnapshot.ts`) hace siempre `PUT /api/graficos/config` con `scope:"active"`; lo llaman guardar / guardar como / duplicar proyecto (`project/useProject.ts`). Con el borrador compartido hidratado, guardar el proyecto **copia el plan compartido sobre `graficos_config_por_base[[activa]]`** (viola ADR 0040 §6.1). Un test lo fija hoy (`useGraficosAutosave.test.ts:~164-178`). | Alta |
| H2 | El chip de `BarraLaminas.tsx` dice «Un informe por base · {activa} … pertenece a la base activa» en el informe compartido. | Media (C1/C5) |
| H3 | Un 409 STALE no actualiza la revisión y el autosave lo traga: «dirty» para siempre y error crudo al exportar. | Media |
| H4 | «Armar desde…» en consolidado llama `/plan/sugerido` sin scope (mezcla con la base activa). Sin prueba de rotura aún. | Media, sin confirmar |
| H5 | `MultibaseReportMenu` descarta los `avisos` de `/ppt-all` y no hace flush antes de lanzarlo. | Media |
| H6 | Ningún proyecto de referencia es `independent_siblings` (acrconta_mazo es `multibase`): consolidado y `/ppt-all` sólo tienen tests sintéticos. | Media (evidencia) |
| H7 | Share en consolidado operaría sobre la config por base (cuando A1 lo lleve al menú ⋯). | Baja hoy |
| H8 | Bloqueos del preflight con `slide_id` sólo como texto (no en Avisos). | Baja |
| H9 | `varCalificada` en consolidado y C44 (`base_labels`/`base_config`) → A2. | Baja |

## Rebanada A7-1 (frontend, sin decisiones abiertas): H1, H2, H5

- Nuevo `frontend/src/features/graficos/alcanceHidratado.ts` (`{scope, sid}` del último hydrate; registrar / leer /
  olvidar). `useGraficosAutosave.ts` lo registra en ambas hidrataciones y en la siembra. `configSnapshot.ts`: con alcance
  `consolidated` el flush NO escribe `/graficos/config` (devuelve `false` sin tocar `dirty`, o delega en el persistidor
  consolidado con su revisión).
- `modoMultibase.ts` acepta `scope` opcional → `clave:"compartido"`, «Informe compartido · N bases», sin «base activa»;
  `BarraLaminas.tsx` se lo pasa.
- `MultibaseReportMenu.tsx`: flush (que ya respeta el alcance) antes de `/ppt-all` y muestra sus `avisos`.
- Tests y mutantes: hidratar consolidado + flush ⇒ 0 PUT a `/graficos/config` (mutante: `scope:"active"` fijo); hidratar
  consolidado y luego activa ⇒ 1 PUT (mutante: no olvidar el alcance); chip compartido sin «base activa» (mutante: ignorar
  el 4.º argumento); orden flush → ppt-all y avisos visibles (mutantes: sin flush; tipo sin avisos). Se corrige el test que
  hoy fija el bug.

## Pendientes de decisión (Gonzalo)

- D1 (H4) «Armar desde…» en consolidado: (a) endpoint `POST /consolidado/plan-sugerido` o (b) deshabilitarlo con motivo
  (la siembra ya entrega el plan). Recomendado: (b) ya; (a) si el test de caracterización sale rojo.
- D2 (H3) conflicto de revisión: recargar el borrador con aviso (recomendado, semántica optimista del ADR 0040) o
  guardar lo local como copia.
- D3 (H6) evidencia de consolidado y `/ppt-all`: corrida en vivo sobre un proyecto temporal `independent_siblings`
  rehecho desde los `.sav` de acrconta_mazo, sin commitear (recomendado ahora) o séptimo proyecto de referencia
  anonimizado (deuda).
- D4 (H7) Share en consolidado: deshabilitarlo con motivo (recomendado).

## Decisiones de Gonzalo (2026-10-11, preguntas 17–20)

- D1 (17): «hay que tener cuidado porque también depende de la matriz de equivalencias en procesamiento» → sin cerrar;
  deshabilitado con motivo hasta estudiar la matriz.
- D2 (18): recargar el borrador con aviso explícito.
- D3 (19): corrida en vivo sobre proyecto temporal `independent_siblings`, sin commitear.
- D4 (20): Compartir deshabilitado con motivo en consolidado.

## Estudio de la decisión 17 — matriz de equivalencias (guardian-contratos, 2026-10-11)

Veredicto: requiere ADR. Deshabilitar «Armar desde…» en consolidado es compatible ya; pero **la siembra actual del informe
compartido no usa la matriz**: empareja por parecido de etiqueta + firma de escala
(`.graficos_multisource_comparison_candidates`, `graficos_plan_coverage.R:1649-1757`, máx. 4 láminas «Comparativo por
actor», toma la primera variable de cada fuente), lo que el ADR 0062 invalida («inferir equivalencia entre públicos por
similitud de etiquetas»; «comparar variables de bases distintas sin declaración previa»).

- Matriz: clave de proyecto `s$equivalencias_publicos` (`equivalencias_publicos/v1`), editada en
  `procesamiento/carga/equivalencias`; revisión `.equiv_declaracion_revision` (`equivalencias_publicos.R:775-795`) y sello
  por base sólo de nombres (`:153-162`).
- Consumidores: `/plan/sugerido` con `fuente:"equivalencias"` (`graficos_plan_equivalencias.R:76-165`, todas las bases);
  `SuggestedPlanButton` sin `scope` (Fusionar no graba la revisión); aviso de desfase `declaracionAplicada.ts`;
  `seedConsolidatedPlan` no graba `equivalencias_revision` (queda «» → sin aviso si la matriz cambia).
- Incoherencias si se reutiliza el generador: bases sin release aprobada → `unknown_multisource_reference`; la matriz usa
  `.escala_firma` (normaliza caja, `escala_firma.R:28-32`) y el bloqueo del consolidado compara `codigo=etiqueta` literal
  (`graficos_consolidado.R:407-455`) → bloquea lo que la matriz aprueba (56/58 temas de ACRD Conta difieren sólo en caja);
  recodificadas resueltas vs declaradas; las fuentes del consolidado no aplican las etiquetas curadas
  (`graficos_consolidado.R:138-155`).
- Puntos ciegos de la revisión: no incluye `sugerida` ni `estilo`; el sello no ve cambios de listas de opciones; no se ata a
  la release. Hipótesis sin test: `equivalencias_revision` cae en `_unknown` en la config por base
  (`router_graficos.R:1404-1416`) y el aviso de desfase moriría al recargar.

Opciones para Gonzalo: **A (recomendada)** deshabilitar ya con motivo y, con enmienda de ADR 0063/0040, que el consolidado
siembre y proponga desde la matriz (`/plan/sugerido` con `scope:"consolidado"` reusando el generador, filtrado a las
releases; firma de escala unificada en `.escala_firma`; revisión con `sugerida`, `estilo` y huella de listas; la siembra y
Reemplazar/Fusionar/Sincronizar graban la revisión; aviso de desfase en Láminas); la heurística por etiqueta queda sólo
como respaldo avisado o se retira. **B** deshabilitado indefinido (mantiene la violación del ADR 0062 en un entregable).
**C** reusar `/plan/sugerido` sin scope (desaconsejada: H4, ADR 0040 §6.1).


## Decisión de Gonzalo — pregunta 27 (2026-10-11, ~10:50 Perú)

«Pregunta 27: De acuerdo» → se adopta la **opción A**: «Armar desde…» sigue deshabilitado con motivo en el informe
compartido hasta que, con enmienda de los ADR 0063/0040, el consolidado siembre y proponga **desde la matriz de
equivalencias** (`/plan/sugerido` con `scope:"consolidado"` reusando el generador, filtrado a las releases; firma de escala
unificada en `.escala_firma`; revisión con `sugerida`, `estilo` y huella de listas; la siembra y
Reemplazar/Fusionar/Sincronizar graban `equivalencias_revision`; aviso de desfase en Láminas). Lectura del lead sobre la
heurística por etiqueta (`.graficos_multisource_comparison_candidates`): **se retira de la siembra** porque el ADR 0062
prohíbe inferir equivalencias por etiqueta; sin matriz declarada, el compartido se siembra sin láminas comparativas y lo
avisa. Si Gonzalo prefiere conservarla como respaldo avisado, se reabre aquí.

**Resuelta por ADR 0096** (D1 / decisión 27). Contrato de implementación (endpoints, globs por capa, tests rojos R1–R13 y F1–F8 con mutantes, códigos `E_GRAFICOS_PLAN_SCOPE` y `E_GRAFICOS_CONSOLIDADO_NO_APLICA`): ver el ADR y la revisión de guardian-contratos del 2026-10-11.
