# ADR 0003: Motor R integrado en `prosecnurapp`

Estado: Aceptado

Fecha: 2026-05-31

## Contexto

Hasta v0.1 el motor metodologico vivia como paquete R externo. Desde v0.2 el
README declara que ese motor vive dentro del paquete `prosecnurapp`, en el
mismo monorepo que la API, el frontend y el shell de escritorio.

Mantener un paquete externo activo permitiria reutilizacion independiente, pero
crearia dos ciclos de versionado y mas friccion para empaquetar una aplicacion
local consistente.

## Decision

El motor R de Prosecnur vive integrado en `api/` como parte del paquete
`prosecnurapp`. El paquete historico externo queda como referencia de solo
lectura y no forma parte del flujo activo de desarrollo.

## Consecuencias

Se gana reproducibilidad de release, menos pasos de instalacion y un punto
unico para probar API, motor y empaquetado local.

Se sacrifica independencia del motor como paquete reutilizable y aumenta el
riesgo de mezclar responsabilidades entre API, UI y logica metodologica.

## Cumplimiento

- El README debe mantener clara la regla de un solo paquete activo.
- Las funciones del motor deben mantenerse en archivos de dominio como
  `reporte_*`, `graficador_*`, `validacion_*`, `codificacion_*` o equivalentes.
- Los routers deben actuar como capa API, no como lugar principal de reglas
  metodologicas pesadas.
- Reintroducir un paquete externo activo requiere un ADR nuevo.

## Notas

Relacionado con [ADR 0004](0004-monolito-modular-microkernel.md).
