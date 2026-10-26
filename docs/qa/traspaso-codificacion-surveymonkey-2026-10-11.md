# Traspaso — Codificación de respuestas en imports de SurveyMonkey (2026-10-11)

Tipo: Traspaso a otra sesión (prioridad alta)
Estado: Histórico
Consolidado en: [GOAL de la Meta B](goal-modernizacion-ui-2026-10-10.md)
Fecha: 2026-10-11
Autoridad: Gonzalo (motivo de urgencia del 2026-10-11)
Nota (2026-10-26): los commits que la §1 da como «NO en `main`» ya están en main (b10bf18 entró por el PR #10 y lo de 51ebabf se rehízo y amplió después); el procedimiento de entrega de este traspaso ya no aplica.
Origen: sesión de la Meta B (rama `meta-b-revamp`), revisión metodológica N4 y verificador
Motivo de urgencia (Gonzalo, 2026-10-11): hay un estudio **en campo en SurveyMonkey ahora**;
mañana su base tiene que adaptarse sin problemas a su XLSForm y a la lógica que viene de la
plataforma.

## 1. Lo que ya está resuelto (commits en `meta-b-revamp`, NO en `main`)

| Commit | Qué | Archivos |
|---|---|---|
| `b10bf18` | Import en «bases separadas» (`POST /api/carga/platform/{surveymonkey,kobo}/import-separate`) y borrado del RDS de credenciales en todo final de job | `api/R/carga_platform_separate.R` (nuevo), `jobs.R`, `carga_platform_jobs.R`, `router_carga.R`, `router_monitoreo.R`, tests |
| `51ebabf` | **N4**: los `choice_code_maps` del editor se aplican solo si el formulario es de la MISMA encuesta (`source$survey_id`, buscado en toda la colección `xlsform_forms`); Kobo nunca los hereda. Aplica a base única, bases separadas y Kobo independiente. La carga manual no cambia | `carga_platform_separate.R` (`.carga_platform_choice_code_maps`), `router_carga.R` (`.carga_platform_finalize`, `estudio_init_default_base(sid, choice_code_maps)`), `test-carga-platform-jobs.R` |

Por qué N4 importaba: con un formulario activo de OTRA encuesta (dos encuestas SM comparten
nombres `p<N>` y códigos por posición), el import permutaba categorías en silencio — la
revisión metodológica lo reprodujo con Si↔No invertidos en la base persistida.

**Entrega a `main` sin esperar al revamp** (probado en seco el 2026-10-11, `main` = `c97eb3a`):

```bash
git fetch origin main meta-b-revamp
git checkout -b fix/codificacion-sm origin/main
git cherry-pick b10bf18          # conflicto único: docs/qa/checklist-vuelta1-carga-2026-10-11.md (no existe en main)
git rm docs/qa/checklist-vuelta1-carga-2026-10-11.md && git cherry-pick --continue
git cherry-pick 51ebabf          # mismo conflicto del checklist → git rm y --continue
```

## 2. Lo que queda abierto (el motivo de este traspaso)

**Triple aplicación de los mapas en base única (preexistente a la Meta B).** En
`.carga_import_surveymonkey` (`api/R/router_carga.R`), `normalize_data_for_xlsform` corre
tres veces con los mismos mapas:

| Paso | Dónde | Entrada | Efecto |
|---|---|---|---|
| 1 | `.carga_sm_prepare_import` (`carga_platform_separate.R`) | datos crudos | archivo guardado **correcto** |
| 2 | preview de `.carga_platform_finalize` (`read_data_preview`) | archivo YA normalizado | recodifica otra vez |
| 3 | `estudio_init_default_base` al releer el último data file | archivo YA normalizado | recodifica otra vez → `rp_data` de la base `default` |

Medido por el verificador con un mapa Si↔No de la misma encuesta: paso 1 `Si,No,Si → No,Si,No`
(bien); pasos 2 y 3 `No,Si,No → Si,No,Si` (invertido). Solo daña cuando los códigos de origen
chocan con los códigos xls (frecuente con códigos numéricos por posición). «Bases separadas»
NO lo sufre: registra con `prep$data_df` sin releer.

**Primero confirmar el alcance (define la urgencia):**
1. ¿Analítica / Validación / Dashboard usan en sesión el `rp_data` en memoria de la base
   `default` o releen el archivo? Si usan `rp_data`, el error llega a resultados.
2. ¿Al reabrir el `.pulso` el `rp_data` se recalcula desde el archivo (state.rds no guarda
   caches derivables)? Si sí, el daño se limita a la sesión del import.
3. ¿Qué mapas guarda `.carga_store_choice_code_maps` desde la preview (paso 2) para la
   confirmación de códigos en Carga › Revisión? Si salen de la segunda pasada, la
   confirmación muestra el mapeo equivocado.

**Opciones** (recomendación: C + A):

| | Qué | A favor | En contra |
|---|---|---|---|
| A | No re-normalizar con mapas un archivo que ya salió normalizado de prepare; el aviso de mapeo sale de la primera pasada (`attr(prep$data_df, "xlsform_normalized")`) | Cambio chico, localizado en el import de plataforma | Hay que mover el origen de `.carga_store_choice_code_maps` sin perderlo |
| B | Normalización idempotente: marcar el archivo como normalizado (metadata en `s$files[[fid]]`, el attr no sobrevive al XLSX) y saltar el recode si ya se aplicó | Protege también caminos futuros y la carga manual | Toca el normalizador compartido (`data_normalizer.R`); lo más amplio |
| C | Registrar la base `default` con `prep$data_df`/`rp_data` ya calculados, como hace «bases separadas» (parámetro opcional en `estudio_init_default_base`) | Copia el camino que ya funciona y ahorra una relectura cara | Toca una función que también usa la carga manual (mantenerla con parámetro opcional) |

## 3. Más allá del bug: verificación de punta a punta para el estudio en campo

Gonzalo quiere que mañana la base de SM «se adapte sin problemas a XLSForm y a su lógica
desde la plataforma». Con credenciales reales (solo en local; ADR 0005: nunca al repo ni al
`.pulso`), sobre una COPIA del proyecto del estudio:

1. Formularios: traducir la encuesta SM a XLSForm (`api/R/xlsform_surveymonkey_*.R`,
   `frontend/src/features/xlsformEditor/shell/ImportSurveyMonkeyDialog.tsx`) y revisar la
   lógica (`surveyMonkeyLogic`, `logic_status = pending_manual_confirmation`, guard de
   publicación). Confirmar que `source$survey_id` queda guardado en el formulario (N4 lo usa).
2. Carga: importar las respuestas con el formulario de ESA encuesta activo y comprobar
   variable por variable de tipo `select_one`/`select_multiple` que los códigos del archivo,
   la preview, Carga › Revisión y la base `default` coinciden con los conteos de SM.
3. Repetir con un formulario de otra encuesta activo: no debe aplicar mapas (N4).
4. Validación y Analítica sobre esa base: frecuencias de 2–3 preguntas contra el resumen de SM.

## 4. Reglas de la casa que aplican

- Rama 1 + Rama 4 de `CLAUDE.md`: cargar `dominio-prosecnur`, `/nucleo-metodologico` e
  `integraciones-datos`; `revisor-metodologico` revisa grano/códigos; test rojo antes del fix
  (`autor-regresiones` o el lead); cierra `verificador`.
- Tests sin red. Mocks listos en `api/tests/testthat/test-carga-platform-jobs.R`:
  `.cpj_sm_mocks()`, `.cpj_kobo_mocks()`, `.cpj_form_con_mapas(survey_id)`,
  `.cpj_mapa_si_no_invertido()`, `.cpj_q1_importado(sid, out)`. Test nuevo propuesto: base
  única SM con el formulario de la misma encuesta y mapa Si↔No → exigir `No,Si,No` en el
  archivo, en la preview y en el `rp_data` de la base `default` (hoy los dos últimos fallan).
- Gate: `make gate-area AREA=carga GATE_ARGS='--patron "carga-platform|carga-sm|surveymonkey|data-normalizer|choice|carga-manual|estudio"'`.
- Nunca push a `main`; PR con Quality verde. Construir no autoriza publicar: llevar el fix a
  la app que usa el equipo de campo (release) lo decide Gonzalo (`/preparar-release`).
- Sin datos de cliente en el repo; un `.pulso` real solo vía `api/scripts/pulso_anonimizar.R`.
