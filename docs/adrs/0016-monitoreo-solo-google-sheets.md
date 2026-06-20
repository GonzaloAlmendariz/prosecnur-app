# ADR 0016: Monitoreo publica solo Google Sheets

## Estado

Aceptado

## Fecha

2026-06-19

## Contexto

Las salidas de Monitoreo venian separandose por audiencia y canal, con una
experiencia web cliente en Hugging Face y workbooks en Google Sheets. La
revision de producto redefine el contrato: Monitoreo no debe depender de
Spaces, cuotas de hardware, tokens ni repositorios externos de Hugging Face.

Prosecnur sigue siendo local-first. Monitoreo conserva sincronizacion local,
snapshots auditables y publicacion manual, pero el unico destino externo de
publicacion vigente son tablas controladas en Google Sheets.

## Decision

Monitoreo publica solo Google Sheets. El contrato vigente tiene dos destinos:

- `client/sheets`: workbook cliente, agregado, sin PII, GPS puntual,
  identificadores crudos, alertas, casos accionables ni auditoria.
- `internal/sheets`: workbook operativo interno, con confirmacion manual, que
  puede incluir PII, GPS, identificadores, alertas, auditoria y casos
  accionables cuando el perfil lo requiere.

Los tipos de monitoreo vigentes son acreditacion, territorial y
aulas_universitarias. El contrato de familias debe permitir agregar monitoreo
telefonico como otra familia de tablas, sin reintroducir Hugging Face ni un
canal web.

Las rutas y helpers heredados de publicacion web de Monitoreo quedan
deshabilitados:

- `/api/monitoreo/publish` responde `410 E_MONITOREO_HF_DISABLED`;
- `monitoreo_publish_space()` responde `410 E_MONITOREO_HF_DISABLED`;
- los artefactos publicos de tipo `monitoreo` normalizan su destino a
  `google_sheets`;
- el estado de publicacion de Monitoreo expone solo `client_last_sheets` e
  `internal_last_sheets`.

Hugging Face sigue permitido para Dashboards. Esta decision solo retira
Hugging Face del modulo Monitoreo.

## Consecuencias

- La UI de Monitoreo ya no pide token, namespace, nombre de Space ni privacidad
  HF. La superficie de Salidas muestra solo Sheets cliente e interno.
- Los docs operativos de deploy web no describen Monitoreo como Space.
- Los tests de Monitoreo verifican workbooks y modelos Sheets por familia y
  audiencia, y verifican que no se renderice Space.
- No se sube `.pulso`, runtime publico, `Dockerfile`, HTML ni JSON de Space
  para Monitoreo.
- La separacion cliente/interno se mantiene, pero por workbooks y pestanas, no
  por Spaces.

## Cumplimiento

- Tests R verifican que el endpoint y helper HF de Monitoreo devuelven
  `E_MONITOREO_HF_DISABLED`.
- Tests R verifican que la QA genera XLSX separados para territorial,
  acreditacion y aulas universitarias, cliente e interno.
- Tests R verifican que los artefactos QA no renderizan `index.html` de Space.
- Tests de frontend verifican que el cliente API ya no expone publicacion HF de
  Monitoreo.
- `npm run build` valida que la UI de Monitoreo no referencia el flujo HF.

## Notas

Esta decision reemplaza las partes de Monitoreo web de
[ADR 0012](0012-reportes-monitoreo-publicables.md),
[ADR 0014](0014-publicacion-dual-monitoreo.md) y
[ADR 0015](0015-monitoreo-space-cliente-sheets-interno.md). Mantiene la
separacion por audiencia de ADR 0014, pero la ejecuta exclusivamente mediante
Google Sheets.
