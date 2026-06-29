# ADR 0006: Modulos por dominio metodologico

Estado: Aceptado

Fecha: 2026-05-31

## Contexto

Prosecnur no es solo una interfaz CRUD. Sus flujos siguen dominios
metodologicos reconocibles: carga, formularios, validacion, limpieza,
codificacion, analitica, reportes, graficos, dashboards, rutas, enciclopedia
metodologica, muestra y monitoreo.

Una particion puramente tecnica, por ejemplo "controllers", "services" y
"views", podria ocultar las fronteras reales del producto. Tambien haria mas
dificil razonar sobre que parte del sistema es duena de una decision
metodologica.

## Decision

Los modulos se organizan por dominio metodologico. Cada modulo debe declarar
responsabilidad, estado propio, endpoints, dependencias permitidas y
dependencias prohibidas. La comunicacion entre modulos debe pasar por contratos
claros, helpers compartidos o estado de sesion delimitado.

## Consecuencias

Se gana alineacion entre arquitectura y trabajo del analista, ownership mas
claro y menor riesgo de acoplamiento accidental.

Se sacrifica cierta uniformidad tecnica: algunos modulos tendran routers,
stores, jobs y funciones de motor mas grandes que otros. Tambien puede aparecer
duplicacion sana cuando dos dominios necesitan reglas parecidas pero no iguales.

## Cumplimiento

- Nuevas carpetas de frontend deben vivir bajo `frontend/src/features/<dominio>`
  salvo justificacion.
- Nuevos endpoints deben usar prefijo de dominio.
- Nuevas funciones R deben ubicarse cerca del dominio o en helpers compartidos
  solo si son realmente transversales.
- Una dependencia directa entre modulos debe tener contrato documentado.
- La enciclopedia metodologica se trata como biblioteca read-only: expone
  `/api/enciclopedia/*`, vive en `frontend/src/features/enciclopedia` y sus
  catalogos no deben mutar estado de proyecto. Desde ADR 0027 ya no es el
  modulo principal; queda subordinada a Diseno del estudio y Calculo de
  muestra.

## Notas

La tabla de modulos en la [guia arquitectonica](../arquitectura-prosecnur.md)
es la fuente canonica para revisar fronteras.
