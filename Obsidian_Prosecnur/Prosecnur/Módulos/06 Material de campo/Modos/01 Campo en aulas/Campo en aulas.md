---
tipo: modo
padres:
  - "[[Material de campo]]"
orden: 1
documentacion: parcial
ruta_app: "/material-campo?modo=aulas"
nodo: "material-campo/aulas"
tags:
  - Modo
fuentes:
  - "frontend/src/lib/modules.ts"
  - "frontend/src/features/recopiladores/RecopiladoresShell.tsx"
  - "frontend/src/features/recopiladores/campanas/redirecciones.ts"
  - "docs/adrs/0111-material-de-campo-se-organiza-por-campanas-tipadas.md"
---

# Campo en aulas

> La campaña presencial de fichas QR por curso-horario: unidades, accesos, catálogo, paquetes y entrega a Monitoreo.

## Qué es

Es el tipo `aulas` de una campaña (ADR 0111). Un proyecto tiene **una sola** campaña de aulas mientras el plan, el despliegue y el traspaso sean únicos (`aulas.principal`). No se borra: se **archiva** desde su menú y se reabre desde «Archivadas» sin perder plan, fichas ni traspaso.

## Dirección

`/material-campo?modo=aulas&campana=aulas.principal&seccion=<sección>&pestana=<pestaña>`. `campana` es alcance, como `pulso`. Un enlace viejo sin campaña (`?seccion=accesos`) aterriza en esta campaña si existe; si no, en la lista. Los enlaces que entran desde Cálculo de muestra y Monitoreo emiten `?modo=aulas`.

## Secciones

[[Unidades]] · [[Accesos]] · [[Catálogo]] · [[Paquetes]] · [[Entrega]]. Catálogo ya no tiene la pestaña Correos: cada correo es su propia campaña ([[Correo]]).

## Ubicación en la jerarquía

- Padre: [[Material de campo]].
