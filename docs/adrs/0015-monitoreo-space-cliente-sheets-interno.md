# ADR 0015: Monitoreo publica Space cliente y Sheets separados

## Estado

Reemplazado por [ADR 0016](0016-monitoreo-solo-google-sheets.md)

## Fecha

2026-06-19

## Contexto

Nota de vigencia: esta decision queda como registro historico. El contrato
vigente de Monitoreo es Sheets-only y esta definido en
[ADR 0016](0016-monitoreo-solo-google-sheets.md).

ADR 0014 separo las salidas de Monitoreo por audiencia y canal, incluyendo una
opcion de Space interno privado. La revision de seguridad y producto redefine
esa frontera: Hugging Face debe quedar como experiencia interactiva de avance
para cliente, mientras que la operacion interna debe permanecer en workbooks de
Google Sheets con confirmacion manual.

Prosecnur sigue siendo local-first. Las publicaciones son snapshots manuales;
no convierten a Sheets ni a Hugging Face en backend operativo canonico.
El Space cliente de Monitoreo no necesita backend: el reporte se renderiza como
HTML/JSON estático desde el snapshot publicado.

## Decision

Monitoreo tiene tres destinos vigentes:

- `client/web`: Hugging Face Space estático e interactivo de avance agregado
  para cliente.
- `client/sheets`: workbook cliente con pestanas ejecutivas sin PII ni
  trazabilidad operativa.
- `internal/sheets`: workbook operativo interno con pestanas controladas para el
  equipo.

Hugging Face no recibe salidas internas. Si una llamada antigua intenta publicar
`audience = internal` hacia Space, el backend normaliza la publicacion a
`audience = client` y genera solo el reporte cliente. Los artefactos QA internos
no renderizan `index.html` de Space; solo validan workbooks internos.

Los nombres y pestañas quedan separados por destino:

- territorial cliente: `Resumen territorial`, avance por distrito, brechas,
  avance diario, fase activa y hojas agregadas necesarias para el reporte.
- acreditacion cliente: resumen, avance por actor, brechas/meta, avance diario,
  avance por segmento y `Avance por canal/fuente`.
- acreditacion interna: las hojas operativas internas conservan casos,
  auditoria, alertas y agregan `Avance por canal/recopilador`.

Toda salida interna mantiene confirmacion manual explicita antes de escribir en
Google Sheets. El Space cliente puede ser publico o privado segun el destino,
pero su payload sigue siendo agregado y apto para circulacion externa.
El backend publica `client/web` con `sdk: static`, sin `Dockerfile`, sin
runtime Plumber y sin `.pulso` de bootstrap. Los JSON del modelo quedan como
artefactos read-only junto al `index.html`.

## Consecuencias

- `client_last_deploy` es el unico estado vigente de deployment Hugging Face
  para Monitoreo.
- `internal_last_deploy` queda obsoleto para Monitoreo y no debe actualizarse en
  nuevas publicaciones web.
- `client_last_sheets` e `internal_last_sheets` siguen separados.
- La UI de Salidas muestra una matriz de tres destinos, no cuatro.
- Los docs operativos deben describir Hugging Face como canal cliente-only y
  Google Sheets como canal de trabajo interno.
- El Space cliente no consume cuota de hardware de Hugging Face por correr un
  contenedor, porque se sirve como sitio estático.

## Cumplimiento

- Tests verifican que el Space renderizado siempre usa `audience = client`.
- Tests verifican que el Space cliente excluye PII, GPS puntual,
  identificadores, alertas, casos accionables y auditoria.
- Tests verifican que los artefactos QA internos no renderizan Space.
- Tests verifican que las pestanas Sheets cliente e internas contienen hojas
  esperadas por audiencia, incluyendo canal/fuente y canal/recopilador.
- Tests verifican que el staging Hugging Face de Monitoreo usa `sdk: static` y
  no sube `Dockerfile`, runtime publico ni `.pulso`.
- `npm run build` valida que la UI no referencia el destino web interno.

## Notas

Esta decision reemplaza la parte web interna de
[ADR 0014](0014-publicacion-dual-monitoreo.md). Mantiene la separacion por
audiencia para Google Sheets y el runtime read-only de
[ADR 0012](0012-reportes-monitoreo-publicables.md).
