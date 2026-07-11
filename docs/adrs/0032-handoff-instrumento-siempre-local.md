# ADR 0032 — El instrumento del handoff Monitoreo→Procesamiento es siempre local (XLSForm subido), nunca de la API de Kobo

- Estado: Aceptado
- Fecha: 2026-07-11
- Contexto relacionado: [[0029-reorientacion-por-proyecto-bitacora-y-overview]], [[0030-grupos-repeat-end-to-end]]

## Contexto

El handoff Monitoreo→Procesamiento arma la base del estudio a partir de dos insumos: la **data** (snapshot local de Monitoreo, casos validados/revisión) y el **instrumento** (XLSForm). Hasta ahora el instrumento se **prefería desde la API de Kobo** (`.monitoreo_processing_handoff_xlsform` candidateaba `kobo_api` con prioridad sobre el XLSForm local), descargando el detail del asset y materializándolo.

Problema detectado en un estudio real (ACNURCG): el export de datos de Kobo **concentra la unión de campos de todas las versiones del formulario** (trae `__version__` y columnas de versiones anteriores). El instrumento descargado de la API puede, análogamente, no coincidir con la versión canónica que el investigador considera fidedigna, e introduce ruido (columnas-plantilla de scoring de versiones viejas: `A1_rec`, `perception_index`, `coexistence_index`, … que llegan vacías). El investigador **ya tiene** la última versión del XLSForm (se descarga trivialmente de Kobo) y quiere control explícito sobre qué instrumento define el procesamiento.

## Decisión

Para el handoff de procesamiento, el instrumento sale **siempre del XLSForm LOCAL** que sube el usuario (candidatos `estudio` / `file_store`). Se **elimina** la descarga y el candidato `kobo_api` del extractor. La **data** sigue viniendo de Monitoreo y la **detección de la fuente Kobo para datos** no se toca. El **cruce de compatibilidad instrumento↔data** (`validate_data_xlsform_compatibility`, vía `.monitoreo_processing_handoff_xlsform_score`) se **mantiene** — es lo que garantiza que el XLSForm subido corresponde a la base.

Contrato de status resultante (`status.source`):
- `instrument_source`: `"local"` | `"needs_upload"` | `"none"`.
- `instrument_available`: `TRUE` sólo si `"local"`.
- `instrument_needs_upload`: `TRUE` cuando falta el XLSForm local y la UI ofrece subirlo.

Si no hay XLSForm local al promover, el promote falla con `E_MONITOREO_PROCESSING_HANDOFF_XLSFORM_EXACT` pidiendo subir el XLSForm (ya no menciona "Conecta Kobo").

## Consecuencias

- **Positivo**: control explícito y reproducible del instrumento; se evita el ruido multi-versión del pull de API; el flujo Kobo queda "todo local" (data de Monitoreo + XLSForm subido) manteniendo la validación de compatibilidad.
- **Costo**: el usuario debe subir el XLSForm (descargar la última versión de Kobo y cargarla). Es un paso manual barato y deliberado.
- **Archivo congelado**: el cambio en `router_monitoreo.R` (congelado) es una **remoción mínima** (se deja de candidatear `kobo_api`; no se borra `.monitoreo_processing_handoff_kobo_detail`, que puede tener otros usos). Sin crecimiento del archivo.
- **UI**: la tarjeta de handoff en Carga ofrece un CTA para subir el XLSForm cuando falta y gatea el botón de traer la data hasta tener instrumento local.

## Alternativas descartadas

- **Mantener API con deprioridad**: el candidato local ya tenía mayor prioridad base, pero el scoring de compatibilidad podía voltearlo hacia el instrumento multi-versión de la API. No garantiza "siempre local".
- **Filtrar columnas fantasma del instrumento de API**: parche frágil; no resuelve la falta de control sobre la versión. El drop de columnas 100% vacías en el export de la BBDD (cambio aparte) mitiga el síntoma en el entregable, pero la fuente correcta del instrumento es la decisión de fondo.
