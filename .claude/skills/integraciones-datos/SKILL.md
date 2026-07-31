---
name: integraciones-datos
description: Ingesta y conectores de datos de Prosecnur - SurveyMonkey, Kobo, Google Sheets, normalización de bases contra el XLSForm y modo multibase. Usar al tocar surveymonkey_*.R, kobo_api.R, data_normalizer.R, router_carga.R, router_connections.R, o al depurar por qué una base cargada no calza con el instrumento.
---

# Integraciones y normalización de datos

## Contrato común

`api/R/router_connections.R` unifica estado y comprobación de SurveyMonkey,
Kobo y Google Sheets. Las capacidades no son simétricas:

- SurveyMonkey y Kobo admiten perfiles globales de token.
- Solo SurveyMonkey conserva token efímero scopeado a sesión.
- Kobo asocia el perfil a un servidor/base URL.
- Google Sheets usa OAuth global y no perfiles de token.

El frontend consume el contrato desde módulos de `frontend/src/api/`; agrega
funciones nuevas en el módulo de dominio, no en el barrel de compatibilidad.
Los secretos se guardan mediante `api/R/secrets.R`, fuera del `.pulso`, y solo
se exponen al frontend como estado o máscara.

## Capacidades por conector

### SurveyMonkey

`api/R/surveymonkey_api.R` posee cliente HTTP, paginación, collectors,
recipients, respuestas y conversión a XLSForm. `surveymonkey_logica.R`,
`surveymonkey_traduccion.R`, `surveymonkey_workbook.R`,
`surveymonkey_sav_bundle.R` y `surveymonkey_multibase.R` cubren lógica, labels,
workbooks, SAV y orquestación.

Entradas relevantes: `sm_multibase_audit()`,
`sm_multibase_inspect_survey()`, import canónico, import de hermanas
independientes, plan de refresh y refresh. No intercambies esos modos: difieren
en estado, linaje y propagación.

### Kobo

`api/R/kobo_api.R` lista assets, importa/depliega XLSForm, obtiene todos los
registros y aplana resultados. `carga_kobo_repeats.R` preserva repeat groups y
`carga_platform_jobs.R` orquesta import/refresh pesados. Los perfiles pueden
apuntar a EU, UNHCR o Global; el servidor efectivo forma parte del contrato.

La importación canónica, la de hermanas independientes y la de repeats tienen
tests y persistencia diferentes. No reduzcas un repeat a una tabla plana sin
conservar claves padre/hijo.

### Google Sheets

La conexión es real y está concentrada en Monitoreo:

- OAuth global, refresh y acceso HTTP en `router_connections.R`,
  `monitoreo_engine.R` y `monitoreo_google_http.R`;
- listar spreadsheets, inspeccionar una pestaña y registrar una fuente con
  `spreadsheet_id`, `sheet_name`, `header_row` y rango;
- leer/sincronizar fuentes habilitadas, incluido job asíncrono, en
  `monitoreo_sync_incremental.R`;
- publicar tabs de reportes internos o de cliente y registrar eventos de
  publicación desde los routers de Monitoreo.

Google Sheets no tiene catálogo equivalente al de encuestas ni perfiles de
token. No extrapoles despliegue de formularios, import multibase general o
capacidades de Dashboard/Hojas de ruta que no estén presentes en esos paths.

## La normalización (el corazón): `normalize_data_for_xlsform()`

`api/R/data_normalizer.R` define `normalize_data_for_xlsform()`. El XLSForm es
la fuente de verdad; la data se normaliza hacia él.

Orden contractual:

1. alias de variables;
2. alias de padding;
3. colapso de hijo único;
4. mapas de códigos de opciones;
5. recodificación de “Otro” de SurveyMonkey;
6. reconstrucción de madre `select_multiple` con tokens separados por espacio;
7. descarte de dummies fuente;
8. metadata de auditoría en `attr(out, "xlsform_normalized")`.

Agregar un paso exige ubicarlo deliberadamente y preservar la metadata. La
normalización nunca es silenciosa. El validador es
`validate_data_xlsform_compatibility(data, instrumento)`.

## Labels ES desde el instrumento

`.detect_label_es_col()` prueba las variantes de label español antes del label
genérico. `s_lab_from_original()` prioriza `inst$survey_raw` y
`get_q_label_strict()` evita resolver una etiqueta ambigua. No conviertas el
label recibido en una fuente paralela al instrumento.

## Multibase

Motores single-base + `run_report_multibase(...)`: itera fuentes, prefija el
archivo por base, registra artefactos y produce ZIP si hay más de una. El
nombre legacy solo se conserva para una única base compatible. Ingestar bases
hermanas no autoriza a apilarlas.

## Tests y red

- Los tests corren sin red por defecto. HTTP se inyecta o simula con fixtures;
  una prueba en vivo debe ser explícita y nunca formar parte del gate normal.
- Toda transformación nueva necesita fixture o golden y cobertura del
  normalizador.
- Para SurveyMonkey, usa los fixtures de
  `api/tests/testthat/fixtures/surveymonkey/`.
- Para Kobo, cubre import aceptado/completado, errores tipados, repeats y
  hermanas independientes.
- Para Sheets, cubre OAuth/status con secretos simulados, binding, lectura,
  sync, publicación y errores sin enviar datos reales.

## Checklist de cierre

1. Proveedor y capacidad real identificados.
2. Token/OAuth fuera del `.pulso` y nunca incluido en logs o payload público.
3. Instrumento, grano y linaje preservados.
4. Normalización auditable; madre `select_multiple` y dummies sincronizadas.
5. Estado multibase correcto para import o refresh.
6. Job y cancelación usados cuando el volumen lo exige.
7. Tests sin red del conector y del normalizador afectados en verde.
