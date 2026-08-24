# ADR 0035: Editor XLSForm — colección multi-formulario con espejo del activo

Estado: Aceptado

Fecha: 2026-07-14

## Contexto

El editor XLSForm de Prosecnur manejaba históricamente UN solo formulario por
proyecto. El estado vivía en `s$xlsform_state`, un objeto opaco con shape
`{ workbook, source, hallazgos, saved_at }`, persistido dentro del `.pulso` vía
la blacklist `.pulso_strip_caches`. No había forma de alojar varios
formularios ni de saltar entre ellos.

Queremos soportar múltiples formularios por proyecto (homepage tipo biblioteca,
crear/abrir/renombrar/eliminar, conmutador rápido), pero cinco consumidores
externos leen `s$xlsform_state$workbook` y no pueden cambiar sin riesgo:

- `api/R/router_carga.R` (choice_code_maps del handoff)
- `api/R/router_monitoreo.R` (handoff a Procesamiento)
- `api/R/project_overview.R` (facts del Home)
- `api/R/router_diseno_estudio.R` (estado de módulos)
- `api/R/project_warmup.R` (warm-start del módulo editor)

Alternativas consideradas:

1. **Reemplazar `xlsform_state` por una lista de formularios y migrar a los 5
   consumidores.** Rechazada: superficie de cambio amplia, alto riesgo de
   regresión en handoffs ya frágiles.
2. **Guardar la colección dentro de `xlsform_state`.** Rechazada: rompe el
   shape que los consumidores esperan.
3. **Colección alrededor del contrato legacy, con el activo materializado como
   espejo.** Elegida.

## Decision

Se construye la maquinaria multi-formulario ALREDEDOR del contrato legacy,
nunca DENTRO de él. Modelo en el session env:

- `s$xlsform_forms`: lista NOMBRADA por `id`; cada entrada
  `list(id, name, source, saved_at, hallazgos, workbook)`.
- `s$xlsform_active_form_id`: string (id activo) o `NULL`.
- `s$xlsform_state`: **espejo materializado** del activo, con shape idéntico al
  legacy. Es un DERIVADO; la fuente de verdad es `xlsform_forms` + `active_form_id`.

El **único** mutador que re-deriva el espejo es `.xlsform_forms_set_active`
(`api/R/xlsform_forms.R`). Invariante global: tras cualquier operación,
`identical(s$xlsform_state$workbook, s$xlsform_forms[[active]]$workbook)`.

Endpoints nuevos en `router_xlsform_editor.R` (routers delgados, errores solo
con `stop_api`): `GET /forms`, `GET /forms/<id>`, `POST /forms`,
`POST /forms/activate`, `DELETE /forms/<id>`. Los endpoints `/state` se
conservan como **alias retrocompatible deprecado**: `POST /state` hace upsert
del activo en la colección además de setear el espejo; `DELETE /state` cierra el
activo y reasigna el siguiente.

Migración retrocompatible: al `load_pulso`, `.xlsform_forms_seed_from_legacy`
siembra la colección desde el `xlsform_state` legacy (idempotente, sin pérdida
de datos anidados como `workbook$surveyMonkeyLogic`). La persistencia es gratis
por blacklist: `.pulso_strip_caches` no toca los campos nuevos.

## Consecuencias

- **Beneficio**: los 5 consumidores siguen funcionando sin tocar una línea; el
  espejo garantiza que siempre leen el formulario activo correcto.
- **Beneficio**: los helpers de la colección son puros sobre `s` y testeables
  aislados del router.
- **Costo**: `state.rds` crece por la duplicación colección + espejo. Aceptable
  para N pequeño (pocos formularios por proyecto); documentado.
- **Riesgo**: desincronización del espejo si algún código muta el activo sin
  pasar por `.xlsform_forms_set_active`. Mitigado por el mutador único + test de
  invariante.
- **Riesgo**: doble migración (localStorage del frontend + `.pulso`) con ids
  distintos → duplicados. Mitigado haciendo al frontend autoritativo del `id`.

## Cumplimiento

- `api/tests/testthat/test-xlsform-forms.R`: invariante del espejo tras
  upsert/set_active/delete, migración legacy sin pérdida de `surveyMonkeyLogic`,
  cascada de `deriveFormName`, reasignación del activo al borrar.
- Revisión de que `.pulso_strip_caches` no incluya `xlsform_forms` ni
  `xlsform_active_form_id` (`rg "xlsform_forms" api/R/project_pulso.R`).
- Los endpoints `/forms*` NO están en la whitelist de `forbid_mutations.R`
  (bloqueados en `PULSO_PUBLIC_MODE`, por diseño: editan proyecto).

## Notas

- Plan integral: multi-formulario + homepage + motor PDF (oleadas 1–4). Esta ADR
  cubre la Oleada 1 (fundaciones backend).
- ADRs relacionados: 0032 (handoff instrumento local), 0029 (reorientación por
  proyecto y overview).
