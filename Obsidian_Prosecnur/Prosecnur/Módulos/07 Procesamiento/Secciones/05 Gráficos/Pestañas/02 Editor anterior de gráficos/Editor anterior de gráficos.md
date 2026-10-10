---
tipo: pestana
padres: ["[[Gráficos]]"]
orden: 2
documentacion: parcial
ruta_app: "/graficos?pestana=clasico"
nodo: "procesamiento/graficos/clasico"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/procesamiento.ts"
  - "frontend/src/features/graficos/GraficosPage.tsx"
  - "frontend/src/features/graficos/v2/shell/EditorShell.tsx"
---

# Editor anterior de gráficos

> En la UI: **Editor anterior**. El editor de gráficos de siempre, que se conserva mientras se completa el nuevo.

## Objetivo

Mantener accesible lo que «Láminas» todavía no cubre (compartir, vaciar, estilo del cliente, entre otros) sin perder el trabajo: abre en la misma lámina seleccionada en Láminas.

## Cómo se usa

1. Se llega desde la pestaña o desde los accesos de Láminas que apuntan aquí.
2. Es el editor descrito en la nota de la sección [[Gráficos]]: plan de láminas, lienzo, inspector y barra con exportación.
