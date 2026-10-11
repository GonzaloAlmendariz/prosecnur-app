# Contrato A6 — Word y Estilo del cliente (F6.4)

Congelado por el lead el 2026-10-11 sobre la revisión de `guardian-contratos`. Decisión de fondo: ADR 0094. Espec de
producto: `docs/qa/plan-integracion-f6-2026-10-10.md` §4 F6.4 y §5 filas 5.4/5.5. Decisiones de Gonzalo: 1a, 5a, E2
(`docs/qa/decisiones-pendientes-f6-2026-10-10.md`).

## 0. Hechos del código que fijan la forma

1. «1a» es sobre `config.w_presets` (`DEFAULT_WORD_PRESETS` en `frontend/src/api/graficosConfigNormalizer.ts:8`,
   `.WORD_PRESETS_DEFAULT_PULSO` en `api/R/reporte_plan_word.R:91-94`). `documento_word` ya es casi diff
   (`.graficos_opciones_documento`, `api/R/graficos_documento_word.R:21-51`); se le aplica la misma regla.
2. Precedente: ADR 0074 en `api/R/router_graficos.R` (quitar al leer `:1263-1268`, al guardar `:1318-1320`, reponer en
   `.build_presets` `:1100`; test `test-graficos-presets-decisiones.R:83-101`).
3. Fósiles G1/G2 en los 4 proyectos de referencia (ADR 0094): requiere tabla por generación, no diff ingenuo.
4. El frontend pierde lo que el store no modela: `documento_word` cae en `_unknown`
   (`graficosConfigNormalizer.ts:77-109`) y `hydrate` lo descarta (`store.ts:493-516`); sólo lo salva
   `.graficos_conservar_campos_backend` (`graficos_documento_word.R:59-64`). Tres productores de config divergentes:
   `configSnapshot.ts:26-56`, literal del autosave (`useGraficosAutosave.ts:259-281`), `seedConsolidatedPlan`
   (`:317-334`), más `mergeWithDefaults` (`:55-94`).
5. `.build_w_presets` hace `do.call(w_presets, args)` (`router_graficos.R:1130-1134`) y `w_presets()` no acepta `...`
   (`reporte_plan_word.R:158-172`): una clave desconocida aborta; `title_style` y similares se reemplazan enteros.
6. El body de `/word` reemplaza lo guardado (`router_graficos.R:3322-3324`) y el normalizador estricto se aplica también
   a lo persistido.
7. Logos fijos en el motor (`reporte_word_portada.R:96-137`); en el PPT vienen de la plantilla.

## 1. Forma persistida

Dentro de cada portador de config (`s$graficos_config`, `s$graficos_config_por_base[[base]]`,
`graficos_consolidado_draft$config`, `graficos_consolidado$config`):

```json
{
  "w_presets": { "chart_presets": { "barras_apiladas": { "size_leyenda": 9 } } },
  "documento_word": { "portada": "C", "meta_portada": { "para": "Facultad de Ciencias Contables" } },
  "estilo_cliente": {
    "version": 1,
    "logos": { "portada_izquierda": { "file_id": "3f…", "nombre": "UNSA" } },
    "letra": { "paso": "grande", "roles": { "cifras": "muy_grande" } }
  }
}
```

- Procedencia derivada (ADR 0094 §4). Los args del «Estilo global» (F-f) siguen en `presets.base` y `paletas`; la
  pestaña Estilo los edita ahí. Índice y cierre: provisional en el inspector (E2), fuera de A6.
- **Precedencia al leer** (menor → mayor): `w_presets`: default completo → migración de fósiles → diff guardado → body
  del export. `documento_word`: `.DOCUMENTO_WORD_DEFAULTS` (constante sacada de `reporte_word_documento.R:60`) →
  `cfg$documento_word` → body `opciones_documento`, mezclado por clave. `estilo_cliente`: recetario → perfil del
  catálogo (`profile_id`) → proyecto.
- **Diff al guardar** en el backend (`.graficos_config_set` y `graficos_consolidado_draft_set`): fuera hojas iguales
  al default (`all.equal`), fuera contenedores vacíos (nunca `list()`/`[]`), se conserva lo sin default; `como_leer:
  "auto"` ≡ ausente. El front sigue mandando la config completa; su diff sirve sólo para «Modificado» (5a).
- **Claves desconocidas**: `w_presets` se conservan en disco y `.build_w_presets` las filtra con aviso; sublistas de
  estilo se mezclan sobre los formals. `documento_word` persistido inválido → se descarta con aviso (el 400 sólo para el
  body). `estilo_cliente` desconocido se conserva sin interpretar.
- **Proyectos viejos**: se limpian al leer en `limpio()` de `.graficos_config_get` (migración + diff) sin escribir de
  vuelta (`project_dirty` sigue FALSE); el primer guardado deja el diff.

## 2. Rebanadas y dueños

**R1 backend-r (sin `estilo_cliente`, arranca ya)**: nuevo `api/R/graficos_word_presets_decisiones.R`
(`.graficos_w_presets_solo_decisiones`, `.graficos_w_presets_con_defaults`, `.WORD_MIGRACIONES_DEFAULTS`);
`api/R/graficos_documento_word.R` (`.DOCUMENTO_WORD_DEFAULTS`, diff, lector tolerante); `api/R/router_graficos.R`
(`limpio()`, `.graficos_config_set`, `.build_w_presets` repone y filtra, `GET /config` con `defaults`, `/word` mezcla
el body); `api/R/reporte_word_documento.R` (constante); `api/R/graficos_consolidado.R` (diff en `draft_set`). Tests
testthat 1–9, 11, 12 de §3.

**R2 frontend-react (sin `estilo_cliente`)**: `frontend/src/api/graficosConfigNormalizer.ts` (`KNOWN_KEYS`,
normalizador de `documento_word`, `deepMerge` trata `[]` como `{}`, `wordPresetsDecisiones()`), `store.ts`
(`documentoWord` en estado, snapshot, hydrate, reset), `configSnapshot.ts` como único productor (lo usan
`useGraficosAutosave.ts`, `mergeWithDefaults`, `seedConsolidatedPlan`), `WordPresetsEditor.tsx` (5a contra `defaults`
del GET). Tests vitest 1–8 y 10.

**R3 (tras decisiones abiertas)**: `estilo_cliente` y logos — nuevo `api/R/graficos_estilo_cliente.R`,
`api/R/router_graficos_estilo.R` (`POST /api/graficos/estilo/logos`, sólo PNG, `.register_output_file`, mount en
`plumber_app.R`), `graficos_jobs.R:249` (arg condicionado), `reporte_word_portada.R`, `estandar_tokens.R:73` (K13),
`project_pulso.R` (colecta de `file_id`, poda, nombres), `graficos_share.R`, `graficos_miniaturas_hash.R` (grupo d),
`errors_registry.R` (`E_BAD_ESTILO_CLIENTE`, `E_BAD_LOGO`); front `frontend/src/api/graficosEstilo.ts`,
`features/graficos/{word,estilo}/**`, pestañas `word` y `estilo`. Tests testthat 10, 13–16 y vitest 9.

Congelados en el camino: `reporte_plan_ppt.R` (no tocar), `editor-v2.css`, `theme.css`, `tokens.css`.

## 3. Tests y el mutante que matan

testthat: (1) lo igual al default no se guarda — `config_set`/`limpio` sin diff; (2) bloque vacío desaparece — conservar
vacío; (3) default nuevo alcanza a proyecto viejo y las decisiones aguantan — `.build_w_presets` sin reponer; (4) fósil
G1/G2 de acrconta sale con Top Two Box y 8 pt, un FALSE aislado se respeta — sin tabla / migración clave por clave;
(5) idempotencia y GET de `.pulso` viejo deja `project_dirty=FALSE` — `limpio` escribe; (6)
`.build_w_presets(list(title_style=list(size=14), foo=1))` conserva fuente y color sin abortar — `do.call` sin mezclar
ni filtrar; (7) `portada:"D"` persistido se descarta con aviso y en el body da 400 — lectura estricta; (8) guardado
`{portada:C}` + body `{apertura:A}` llegan juntos al worker — body reemplaza; (9) `documento_word:{}` borra, sin clave
conserva — `conservar` sobre vacío; (10) ida y vuelta `.pulso` con logo y poda de huérfano — logos fuera de
`collect_input_fids`; (11) `draft_set` limpia — sólo `config_set` limpia; (12) espejo completo y `defaults` del GET ==
`.WORD_PRESETS_DEFAULT_PULSO` — cambiar `chart_options` sólo en TS; (13) worker con `estilo_cliente=list()` y el router
lo pasa sólo si no vacío — pasarlo siempre; (14) huella de miniaturas cambia con letra/logo; (15) share embebe logos;
(16) POST de logos en modo público da 403.

vitest: (1) `documento_word`/`estilo_cliente` no caen en `_unknown`; (2) hydrate → build conserva (bug K3); (3) el
autosave los lleva; (4) tras reset viaja `documento_word:{}` con clave presente; (5) `mergeWithDefaults` los incluye;
(6) deshacer/rehacer los restaura; (7) 5a: completo igual al default no marca «Modificado», una clave distinta sí,
prefiere `defaults` del GET; (8) bloque `[]` → default; (9) «volver al recetario» borra la clave; (10) «Regenerar»
manda `opciones_documento` y en consolidado la pestaña Word está deshabilitada.

## 4. Riesgos

Multibase/consolidado: 4 portadores, todos con diff; `.graficos_config_inherit_candidate` (`:1234-1250`) copia
`estilo_cliente` a bases nuevas. Modo público: `forbid_mutations.R` es whitelist, no añadir los POST nuevos. Jobs:
worker sin sesión → rutas resueltas, args condicionados; tests con jobs reales requieren `R CMD INSTALL` (uno a la vez).
Deriva vecina fuera de alcance: `equivalencias_revision`, `profile_id`, `template_id` también caen en `_unknown`.

## 5. Abiertas (para Gonzalo; bloquean sólo R3)

1. `estilo_cliente` en multibase independiente: ¿por base o por proyecto? Recomendado: por base (como `paletas` y
   `presets`).
2. Perfil de letra K13 «lo heredan todos los informes del cliente»: guardarlo entre proyectos sale del `.pulso` y pide
   otro ADR. Recomendado para A6: por proyecto + default del perfil del catálogo.
3. ¿El logo propio entra también en el PPT? Recomendado: sí, en una rebanada posterior por la plantilla
   (`.graficos_resolve_template_pptx`), sin crecer `reporte_plan_ppt.R`.
4. Token del sello «Del recetario» (`--pulso-recetario-*`) no existe y `tokens.css`/`theme.css` están congelados →
   pedido a la Meta B.

## 6. Decisiones de R1 (backend, 2026-10-11, validadas por el lead)

- `redondeo` no entra en el diff ni en `defaults`: `reporte_word_plan` lo deduce del informe (`reporte_plan_word.R:371`),
  así que un valor elegido es siempre decisión. En `documento_word` sólo `portada` y `apertura` tienen default fijo;
  `como_leer:"auto"` ≡ ausente.
- `image` no se mezcla sobre su formal (`w_presets()` ya repone campo por campo; `test-graficos-argumentos-ui.R:735`); sí
  se mezclan los `*_style`, `figure_numbering`, `toc` y `chart_options`.
- El diff de `w_presets` es contra `.WORD_PRESETS_DEFAULT_PULSO` (`chart_options` + `chart_presets`); lo sin default
  declarado se conserva tal cual.
- En `/word`, una clave presente en el body manda (también para volver al default); `contacto` y `meta_portada` se
  reemplazan como unidad.
- `graficos_consolidado$config` (receta congelada de `graficos_consolidado_start`) NO lleva diff: es una foto de
  procedencia y debe reproducir el informe tal como se armó. `graficos_consolidado_draft_get` aún no limpia al leer y
  `draft_set` no aplica el diff de `presets` (ADR 0074): pendientes de R3.
- Fósiles medidos: G1 (25 claves, espejo del front previo a f1b7034) en `acnur_acg`, `acnur_pdm`, `acrconta`; G2 (G1 +
  `size_texto_barras_peq`, `size_barra_extra`, `size_titulo_extra`, 28 claves) en `acrconta_mazo`. Con los cuatro el diff
  da `list()` y el Word sale con leyenda de 8 pt y Top Two Box.

