---
name: integraciones-datos
description: Ingesta y conectores de datos de Prosecnur - SurveyMonkey, Kobo, Google Sheets, normalización de bases contra el XLSForm y modo multibase. Usar al tocar surveymonkey_*.R, kobo_api.R, data_normalizer.R, router_carga.R, router_connections.R, o al depurar por qué una base cargada no calza con el instrumento.
---

# Integraciones y normalización de datos

## Estado de cada conector (asimetría real)

- **SurveyMonkey** — la integración estrella (~13k líneas): `surveymonkey_api.R` (cliente HTTP), `_logica.R` (relevance→XLSForm), `_traduccion.R` (labels ES), `_workbook.R`, `_sav_bundle.R`, `_multibase.R` (5k, orquestación). Entradas: `sm_multibase_audit()`, `sm_multibase_inspect_survey()`, `sm_multibase_import()` / `sm_multibase_import_independent()` (¡modos distintos!), `sm_multibase_refresh_plan()`/`sm_multibase_refresh()`.
- **Kobo** — media: `kobo_api.R` (440 líneas): `kobo_api_fetch_assets()`, `kobo_api_fetch_all_asset_data()`, `kobo_api_flatten_results()`, `kobo_api_import_xlsform()`. Servidores EU/UNHCR/Global en `router_connections.R:99-108`. Reutiliza el pipeline genérico XLSForm/data.
- **Google Sheets** — **NO existe conector de API**; solo provider normalizado en `router_connections.R:31-34` consumido por dashboard_publish/hojas_ruta. Sin perfiles, sin tokens efímeros, sin fixtures. No prometas features de Sheets sin construirlas.
- Provider unificado en `router_connections.R:21-46`; solo SM soporta tokens efímeros.

## La normalización (el corazón): `normalize_data_for_xlsform()`

`data_normalizer.R:693-798`. **El XLSForm es la fuente de verdad; la data se dobla hacia él, nunca al revés.** Orden FIJO de 8 pasos (agregar un paso = ubicarlo correctamente en la secuencia):
1. Alias `q0017…→p17` · 2. Alias de padding `p7_0001→p7_1` · 3. Colapso de hijo único (matrices de una fila) · 4. Mapas de códigos de opción (SAV/API vs XLSForm) · 5. Recodificar "Otro" de SM (**llega como `0` en el SAV**; sin recodificar, los `relevant` fallan en silencio) · 6. Reconstruir la madre `select_multiple` desde dummies → **tokens separados por ESPACIO** (`"1 3 5"`) · 7. Drop de dummies fuente · 8. Metadata de auditoría en `attr(out, "xlsform_normalized")` — la normalización **nunca es silenciosa**.
Validador de compatibilidad: `validate_data_xlsform_compatibility(data, instrumento)`.

## Labels ES desde el instrumento

`.detect_label_es_col()` prueba en orden: `label::Spanish (es)`, `label::Spanish(es)`, `label::Spanish`, `label::es`, `label_es`, `label_spanish_es`, `label`. Resolución por variable: `s_lab_from_original()` (prioriza `inst$survey_raw`, casa nombres con `janitor::make_clean_names()`), `get_q_label_strict()`.

## Multibase

Motores de reporte single-base + envoltura `run_report_multibase(sid, base_filename, ext, kind_single, kind_multi, fn)`: itera fuentes por base, prefija `docentes__codebook.xlsx`, registra con `.register_output_file()`, ZIP si >1 base, nombre legacy sin prefijo si la única base es "default"/"giz"/"generic".

## Reglas de la casa

1. Nunca reescribas un motor de reporte para multibase — envuélvelo.
2. Toda ingesta o transformación nueva necesita fixture golden (`api/tests/testthat/fixtures/surveymonkey/golden/` tiene 6 instrumentos de referencia) y no puede romper `test-data-normalizer.R`.
3. `select_multiple` madre = tokens por espacio, dummies 0/1 sincronizadas — cualquier edición mantiene ambas coherentes.
4. Import de hermanas independientes ≠ import canónico: revisa `test-carga-kobo-independent-siblings.R` / `test-independent-siblings-state.R` antes de tocar esa ruta.
5. Tokens/credenciales via `secrets.R`, jamás dentro del `.pulso`.
