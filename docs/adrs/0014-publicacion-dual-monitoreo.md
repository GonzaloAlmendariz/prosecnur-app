# ADR 0014: Publicacion dual de Monitoreo por audiencia

## Estado

Aceptado; reemplazado para Monitoreo web por [ADR 0016](0016-monitoreo-solo-google-sheets.md)

## Fecha

2026-06-18

## Contexto

Nota de vigencia: esta decision conserva el criterio de separacion por
audiencia, pero los canales web de Monitoreo fueron reemplazados por
[ADR 0016](0016-monitoreo-solo-google-sheets.md). El contrato vigente no
publica Monitoreo en Hugging Face; publica solo Google Sheets cliente e interno.

Los monitoreos de acreditacion y territorial necesitan compartir cortes de
avance con dos audiencias distintas. El cliente debe ver solo avance agregado,
sin trazabilidad operativa. El equipo interno necesita revisar el corte completo
con casos accionables, alertas, auditoria, identificadores, contactos y GPS
para poder resolver problemas de campo.

Prosecnur sigue siendo una aplicacion local de escritorio. Hugging Face Spaces
se usa como canal de publicacion manual de snapshots, no como backend operativo
ni como autosync remoto.

## Decision

Monitoreo publica salidas manuales con dos ejes independientes:

- audiencia: `client` o `internal`;
- canal: `web` y/o `sheets`.

El contrato `audience` se aplica igual para Spaces y para pestanas Sheets:

- `client`: Space de avance agregado, sin PII, contactos, GPS puntual,
  identificadores crudos, alertas, casos accionables ni auditoria.
- `internal`: Space privado de lectura web con el snapshot operativo completo,
  incluyendo PII, GPS, IDs, alertas, auditoria y casos accionables.

La publicacion web interna exige `private = true`. Cualquier salida interna,
incluyendo Sheets, exige una confirmacion manual explicita antes de subir el
corte completo fuera de la maquina local. La frontera de seguridad del Space
interno es el acceso privado del Space mas esa confirmacion manual de
publicacion. En Sheets, la frontera es el spreadsheet de escritura controlada
mas la misma confirmacion manual. No se aplica pseudonimizacion al payload
interno: la finalidad es operativa, no publica.

El Space interno es solo web. No expone botones ni endpoints de descarga XLSX o
CSV desde Hugging Face; los ejecutivos tabulares por audiencia se publican como
pestanas controladas en Google Sheets usando la conexion global existente. El
runtime publico de Monitoreo sigue siendo minimo y read-only: no sync, no
edicion, no Kobo, no Sheets, no jobs PDF y no endpoints mutables.

La credencial de Hugging Face y el destino de publicacion son entidades
distintas. El token se guarda localmente como secreto/alias de credencial; el
namespace y Space destino se guardan como metadata no secreta y pueden apuntar a
una organizacion distinta a la cuenta personal del token.

## Consecuencias

- Un proyecto puede tener deployments separados: `client_last_deploy` e
  `internal_last_deploy`.
- Un proyecto puede recordar publicaciones Sheets separadas:
  `client_last_sheets` e `internal_last_sheets`.
- La publicacion cliente es apta para circulacion externa porque contiene solo
  indicadores agregados de avance.
- La publicacion interna acelera la operacion del equipo, pero requiere tratar
  el acceso privado del Space y el acceso al spreadsheet interno como controles
  de seguridad reales.
- Los ejecutivos por audiencia quedan en Google Sheets como pestanas
  controladas, con el mismo criterio de separacion que los Spaces.
- La UI de publicacion debe nombrar el campo como namespace destino, no como
  usuario del token, y debe recordar destinos recientes sin guardarlos dentro
  del `.pulso`.

## Cumplimiento

- Tests verifican que el payload cliente excluye sentinels de PII, GPS, IDs,
  alertas, casos y auditoria.
- Tests verifican que el payload interno conserva sentinels operativos.
- Tests verifican que `audience = internal` falla si `private` no es `TRUE`.
- Tests verifican que Sheets interno exige confirmacion manual.
- Tests de `PULSO_PUBLIC_MODE=1` verifican que el runtime publico permite solo
  descriptor y reporte read-only.
- Tests verifican que las pestanas Sheets cliente e internas contienen hojas
  esperadas por audiencia.

## Notas

Relacionado con [ADR 0012](0012-reportes-monitoreo-publicables.md), que define
el runtime minimo read-only para reportes publicables de Monitoreo.
