---
tipo: pestana
padres: ["[[Gráficos]]"]
orden: 3
documentacion: parcial
ruta_app: "/graficos?pestana=identidad"
nodo: "procesamiento/graficos/identidad"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/procesamiento.ts"
  - "frontend/src/features/graficos/GraficosPage.tsx"
  - "frontend/src/features/graficos/estilo/PestanaEstilo.tsx"
---

# Identidad

> Logos y tamaño de letra del cliente, sobre el recetario.

## Cómo se usa

Fijar los logos (PNG en `files/` del `.pulso`) y el paso de letra del cliente; cada bloque dice si es «Del recetario» o «Propio» y «Volver al recetario» borra la decisión (ADR 0094). Hoy se aplica al Word.
