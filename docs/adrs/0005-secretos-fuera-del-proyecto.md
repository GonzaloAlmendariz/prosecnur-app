# ADR 0005: Secretos fuera del proyecto

Estado: Aceptado

Fecha: 2026-05-31

## Contexto

Algunos flujos de Prosecnur pueden usar credenciales o tokens de servicios
externos. Esos secretos no deben viajar con bases, instrumentos ni proyectos
compartibles, porque el `.pulso` esta pensado como artefacto portable del
estudio.

Guardar credenciales dentro del proyecto facilitaria reabrirlo en otra maquina,
pero aumentaria mucho el riesgo de filtracion accidental.

## Decision

Los secretos se guardan fuera del proyecto, cifrados en el directorio del
usuario local, mediante los helpers de [`api/R/secrets.R`](../../api/R/secrets.R).
El `.pulso` no debe incluir tokens, claves ni credenciales.

## Consecuencias

Se reduce el riesgo de exponer credenciales al compartir proyectos,
entregables o fixtures. Tambien se separa con claridad el estado del estudio de
las autorizaciones personales del usuario.

Se sacrifica portabilidad completa de integraciones externas: al abrir el
proyecto en otra maquina, el usuario debe configurar nuevamente sus secretos.

## Cumplimiento

- Las integraciones externas deben usar los helpers `prosecnur_secret_*`.
- Los secretos no deben aparecer en `.pulso`, logs, tests, fixtures ni
  entregables.
- Los endpoints que gestionan tokens deben devolver presencia/estado, no el
  valor secreto completo.
- Una nueva clase de secreto requiere revisar esta ADR y actualizar la guia si
  cambia el modelo.

## Notas

Relacionado con [ADR 0002](0002-formato-pulso.md).
