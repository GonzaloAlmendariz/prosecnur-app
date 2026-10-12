---
tipo: pestana
padres: ["[[Gráficos]]"]
orden: 5
documentacion: parcial
ruta_app: "/graficos?pestana=word"
nodo: "procesamiento/graficos/word"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/procesamiento.ts"
  - "frontend/src/features/graficos/GraficosPage.tsx"
  - "frontend/src/features/graficos/word/PestanaWord.tsx"
---

# Word

> En la UI: **Word**. Cómo sale el informe en Word: el documento completo con portada, índices, «Cómo leer», capítulos y contraportada.

## Objetivo

Reunir en un solo lugar lo que sólo afecta al Word, separado de Identidad (logos, letra, íconos y colores, que valen para el PowerPoint y el Word).

## Cómo se usa

1. Se llega desde el rail de Gráficos, después de «Estilo del informe».
2. Los ajustes del documento se ven con su vista previa; la exportación se hace desde «Exportar ▾» en Láminas.

## Historia

Reemplaza en el rail al «Editor anterior», que se retiró el 2026-10-11 cuando Láminas cubrió lo que faltaba.
