# Plan de saneamiento del repo — julio 2026

Loop de convergencia sobre la deuda estructural del repo. **No es una lista que
se agota**: cada iteración re-audita, ejecuta la unidad más rentable, verifica
con evidencia y vuelve a medir. Solo Gonzalo cierra el loop.

Referencias: `docs/qa/deuda-baseline.md` (baseline de deuda),
`agentic/manifest.json` (congelados y líneas base), CLAUDE.md (gates).

## Diagnóstico verificado (2026-07-29)

Todas las cifras medidas sobre el repo real, no estimadas:

| Métrica | Valor | Norte |
|---|---|---|
| Los 6 archivos más grandes | 39,979 (`monitoreo_engine.R`) · 38,160 (`monitoreo.css`) · 33,023 (`editor-v2.css` de **Gráficos v2**) · 30,752 (`theme.css`) · 21,587 (`TelefonicoMonitoreoPage.tsx`) · 19,623 (`AcreditacionMonitoreoPage.tsx`) | Ninguno crece (audit); los TSX se disuelven por regla boy-scout |
| `!important` totales / en editor-v2.css | 1,313 / 927 | ↓ sostenido; editor-v2 tiene mini-plan propio |
| theme.css: tokens vs selectores | 203 tokens `--pulso-*` únicos vs ~4,100 llaves | Split tokens/hoja global (Fase 1) |
| Churn de theme.css | 296 commits en 12 meses (1 cada 1.2 días) | ↓ tras el split |
| feat/fix 12 meses | 601 / 366 (ratio 0.61) | Volver hacia el 0.38 histórico |
| Fixes que tocan archivo de un feat/style/refactor ≤3 commits antes | 26% (95/364) | <20% |
| Componentes homónimos entre los dos monolitos de perfil | 141 de 167 (84%) | Fork asumido (decisión registrada: NO fusionar); se disuelve en archivos por componente |
| Locale en shells no interactivos | `LC_CTYPE=C` → falso "unexpected input" en `monitoreo_engine.R:19278` | **CERRADO en Fase 0**: `en_US.UTF-8` fijado en `.claude/settings.json` y Makefile |

Decisiones previas que este plan respeta:

- **Telefónico independiente de acreditación**: no se fusionan en un core
  parametrizado; el kit compartido es solo infra genérica; fix×2 aceptado.
- **Verificar de más es deuda**: el gate se escala al diff (gate 1 de CLAUDE.md,
  actualizado en Fase 0).
- El orden de cascada CSS del bundle es delicado: `monitoreo.css` carga antes
  que `theme.css`; cualquier cambio de imports debe preservarlo.

## Fase 0 — Higiene inmediata ✅ (2026-07-29)

| Unidad | Estado | Evidencia |
|---|---|---|
| Locale `en_US.UTF-8` en `.claude/settings.json` (env) y Makefile (`export LANG/LC_ALL`) | Hecho | Con `LC_ALL=C` el parse de `monitoreo_engine.R` muere en 19278; con `en_US.UTF-8`, `parse OK`. Tiene que ser `en_US.UTF-8`: `C` rompe tildes, `es_ES` da "03:15p. m." (4 falsos rojos en monitoreo-engine) |
| Audit de congelados en verde | Hecho | Línea base de `TelefonicoMonitoreoPage.tsx` subida deliberadamente 21577→21587 (+10 de la ventana deslizante del ritmo diario, lógica inline de layout Plotly; extraer 10 líneas habría sido artificial) |
| Gate escalonado codificado | Hecho | Gate 1 de CLAUDE.md ahora explicita: suites del área por defecto; `test_dir` completo y build solo en `/preparar-release` y `/publicar` |
| Working tree a cero unidades pendientes | Hecho | La unidad del ritmo diario (ventana deslizante) la commiteó una sesión paralela como `41a725e9`; esta sesión verificó typecheck en verde sobre ese diff y cerró el bump de línea base y la configuración como unidades propias |

## Fase 1 — theme.css: tokens vs hoja global

**Objetivo**: partir `frontend/src/app/theme.css` (30,752 líneas) en
`tokens.css` (las ~203 custom properties y sus variantes de tema) y la hoja
global restante, con **cascada byte-idéntica en orden**. Ataca el archivo más
tocado del repo (296 commits/12 meses).

**Ruta**: Rama 2/7 · writer único `frontend-react` (theme.css es archivo de
contrato: un solo dueño) · revisión `guardian-contratos` + QA visual →
`verificador`.

**Gate de verificación (innegociable para esta fase)**:
1. Detector de cascada CSS antes/después: cero empates nuevos.
2. Diff del CSS emitido por el build de producción: orden de reglas idéntico.
3. `pnpm -C frontend typecheck` + tests de contrato de navegación.
4. Chequeo visual de 2–3 módulos con `/ver-ui` (incluido Monitoreo, que carga
   bajo el tema).

**Contrato técnico (descubrimiento 2026-07-29, verificado sobre el bundle real)**:

- theme.css NO está en index.html; sus únicos importadores son
  `AppSuite.tsx:1` y `ChooserSettings.tsx:7`, y por ser compartido Rollup lo
  emite como chunk propio (`theme-*.css`). La primera inserción del preload
  fija su posición; monitoreo-core queda por debajo del tema (coincide con la
  memoria del 2026-07-24).
- **La capa de tokens es la cabecera, líneas 1–540** (cuatro bloques: `:root`,
  `:root[data-platform="windows"]`, tabla de paleta de módulo 430–533,
  `:root[data-theme="dark"]`). Las 107 custom props restantes están scopeadas
  a componentes del kit y se quedan donde están. Los 113 `!important` viven
  todos en el kit: el corte no los mueve.
- **Corte**: `tokens.css` = líneas 1–540 literales; `theme.css` conserva
  541–30752 y arranca con `@import "./tokens.css";` como primera sentencia
  (el descubrimiento dijo 541/543; la frontera real medida fue 540/542).
  El `@import` relativo se inlina en el mismo punto → el chunk emitido queda
  **byte-idéntico** (mismo hash, mismo filename) y los importadores JS no se
  tocan. NO usar import JS: obligaría a duplicar el orden en dos archivos.
- **Dos tests rompen y se ajustan en el mismo commit** (no después):
  `bootThemeTokens.contract.test.ts:47` y `PulsoButton.test.tsx:115-124`
  pasan a leer `tokens.css`. `boot.css` no se toca (su espejo de tokens es
  duplicación deliberada vigilada por el contrato boot↔theme).
- **Manifest**: bajar la línea base de theme.css deliberadamente (~30,213) y
  congelar `tokens.css` (el congelamiento de theme existía precisamente para
  gobernar los tokens).
- **Criterio duro del gate**: `cmp` byte a byte del chunk `theme-*.css` de dos
  builds A/B a scratch (`vite build --outDir` a scratch — el build por defecto
  vacía `api/inst/www`, nunca usarlo para el A/B), más detector de cascada
  antes/después con conteo idéntico (hoy: 51 empates, 38 involucran theme),
  `--self-test`, typecheck y los 6 tests de contrato de componentes.
  El detector es `scripts/css-cascade-audit.mjs` (solo lectura; `--resolve`
  exige build previo en `api/inst/www/assets`).

## Fase 2 — Disolución boy-scout de los monolitos de perfil

**Objetivo**: que `TelefonicoMonitoreoPage.tsx` y
`AcreditacionMonitoreoPage.tsx` decrezcan de forma monótona sin big-bang y sin
fusionar los perfiles.

**La regla (vigente desde ya, para humanos y agentes)**:

> Todo cambio que toque un componente de un monolito de perfil extrae ese
> componente a archivo propio en el mismo commit
> (`<perfil>/componentes/<Nombre>.tsx`) y baja la línea base del congelado en
> `agentic/manifest.json` en esa cantidad. La línea base solo baja, nunca sube
> (salvo decisión deliberada documentada en el commit).

- Dos copias del mismo componente en perfiles distintos son **aceptables**
  (decisión fix×2). Al kit compartido (`profiles/kit/`) solo pasa infra
  genérica sin lógica de dominio del perfil, caso por caso.

**Mapa de extracción (descubrimiento 2026-07-29)**:

- Radiografía: telefónico es un fork literal que nunca renombró — sus 142
  componentes se llaman `Acreditacion*`. De los 133 homónimos-componente,
  **85 siguen byte-idénticos**, 21 casi (≥0.85), 14 divergidos, 13 son falsos
  homónimos (mismo nombre, contenido ya distinto: `LoadingPanel`,
  `AdvanceStorage`, `PhoneQualityAlertCard`…). Cero componentes ≥1000 líneas;
  el mayor es `ModelConfigWorkbench` (630).
- **La extracción es mecánicamente segura**: cero `let` top-level, cero
  contextos; el estado vive en `useState` por componente. El amarre real son
  los ~430 helpers módulo-level por archivo — cada extracción se lleva su
  familia cohesionada (`calendar*`, `daily*`, `phoneQuota*`, `assisted*`,
  `collector*`) o la importa de un `helpers.ts` del perfil.
- 43 componentes por archivo son hoja con ≤3 helpers: extraíbles casi gratis.
  Nadie fuera del propio perfil importa de estas páginas salvo `index.ts`
  (loadPage) y los tests (consumen `ACREDITACION_MODEL_TABS` etc. → dejar
  re-exports en la página hasta migrar los tests).
- **No renombrar `Acreditacion*` → `Telefonico*` al extraer**: destruiría la
  diffabilidad con el gemelo. Se distingue por ruta; renombrar solo los 13
  falsos homónimos, que ya divergieron de verdad.
- **Orden recomendado (pasos 1–10, ~23% de cada monolito)**:
  1. Kit genérico → `profiles/kit/` (~24 componentes puramente
     presentacionales, sim 1.000: `EmptyPanel` —33 referencias—, `StatTile`,
     `DataTable`, pills, metrics, selects; ~430 líneas × 2).
  2. `AssistedReviewBlock` + helpers `assisted*` (272 lín., cero deps: la más
     barata del top).
  3. Cluster modelo/config (`ModelConfigWorkbench` 630 + editores + ~30
     helpers `calendar*`: ~1,100 líneas por archivo, in-degree 1).
  4. `AdvanceDailyMini` + helpers `daily*` → `<perfil>/avance/` (394/404 lín.
     y es EL código que se está tocando ahora: máximo retorno boy-scout).
  5. `PhoneQuotaEditor` + `phoneQuota*` (366/360, @0.98).
  6. `ChannelSelectorMatrix` + `collector*` (372, in-degree 0).
  7. `SheetSourceEditor` → `<perfil>/fuentes/` (200, idéntico).
  8. `KoboSourcePicker` + `SurveySourcePicker` → `<perfil>/fuentes/` (ya
     divergidos 0.48/0.55: dos copias sin remordimiento).
  9. Cluster consultas (~500 lín. por perfil, divergidos 0.70–0.79).
  10. Familia avance restante (`AdvanceSummaryWorkbench`, `AdvanceStorage`,
      `AdvanceFocus`).
  Residente final natural: el hub `renderAcreditacionView` + `ProfilePage`.

**Métrica del loop**: líneas de cada monolito al cierre de cada iteración.
Norte: <10,000 líneas por archivo en 3–4 meses de trabajo normal.

## Fase 3 — CSS forzado (editor-v2.css y monitoreo.css)

Pendiente de agenda: se activa cuando Gráficos v2 o Monitoreo entren en un
revamp. Regla mientras tanto: **ningún `!important` nuevo** en features
(medible por grep en revisión); todo fix de especificidad se resuelve por
cascada o token. Los 927 `!important` de editor-v2.css se sanean con su propio
mini-plan cuando ese módulo entre en agenda — no antes (pertinencia sobre
"por las dudas").

## Fase 4 — Ratio feat/fix y fixes-que-siguen-a-feats

No tiene unidad de trabajo propia: es la métrica de resultado de las fases
1–3 más el gate 1 endurecido. Se mide en `/auditoria-deuda` mensual:
- ratio fix/feat de la ventana móvil de 12 meses,
- % de fixes que tocan archivo de un feat ≤3 commits antes (hoy 26%).

## Protocolo del loop

1. **Auditar**: `/auditoria-deuda` (o los comandos de la tabla de diagnóstico)
   re-mide las métricas de arriba.
2. **Ejecutar**: la unidad más rentable pendiente según el estado de fases,
   orquestada por rama (writers acotados, especialista sobre generalista).
3. **Verificar**: gate escalonado al diff + audit de congelados en verde.
4. **Reportar**: actualizar las tablas de este documento con fecha y evidencia.
5. Volver a 1. **El loop no se cierra solo**: lo cierra Gonzalo cuando las
   métricas convergen a sus nortes.

---

## Bitácora del loop

- **2026-07-29 · iteración 1**: diagnóstico verificado, Fase 0 completa
  (locale + gate escalonado + audit verde + tree limpio), descubrimiento de
  Fases 1 y 2 sintetizado arriba. Hallazgo colateral del detector de cascada:
  51 empates hoy (+5 vs los 46 del 2026-07-24) — vigilar en la próxima
  auditoría. Próxima unidad más rentable: Fase 1 (split de theme.css) con el
  contrato ya congelado.
- **2026-07-29 · iteración 2 — Fase 1 ejecutada**: `tokens.css` (540 líneas)
  + `theme.css` con `@import`. Evidencia del gate: chunk de producción
  **byte-idéntico con el mismo hash** (`theme-IAsXqeBX.css`, `cmp` limpio),
  lista de chunks CSS idéntica, detector de cascada 51/51 con empates
  idénticos y self-test válido, 35/35 tests de los 6 contratos de
  componentes, typecheck en verde, congelados en verde (theme 30,216 /
  tokens 540), y smoke en dev: Vite inlina el `@import` (0 imports sin
  resolver, tokens y kit presentes en el módulo transformado). Próxima
  unidad: Fase 2 paso 1 (kit genérico de perfiles) o paso 4 (extraer
  `AdvanceDailyMini`, el código más caliente del momento).
