---
tipo: pestana
padres: ["[[Gráficos]]"]
orden: 1
documentacion: parcial
ruta_app: "/graficos?pestana=laminas"
nodo: "procesamiento/graficos/laminas"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/procesamiento.ts"
  - "frontend/src/features/graficos/GraficosPage.tsx"
  - "frontend/src/features/graficos/laminas/LaminasWorkbench.tsx"
  - "frontend/src/features/graficos/laminas/BarraLaminas.tsx"
  - "frontend/src/features/graficos/laminas/EstructuraInforme.tsx"
  - "frontend/src/features/graficos/laminas/VisorLamina.tsx"
  - "frontend/src/features/graficos/laminas/InspectorLamina.tsx"
  - "frontend/src/features/graficos/laminas/PanelAvisos.tsx"
---

# Láminas

> Muestra la lámina tal como sale, con la estructura del informe y sus ajustes. Es el editor nuevo (F6) y la pestaña por defecto de Gráficos.

## Objetivo

Editar el informe mirando la salida real: la imagen de cada lámina la rasteriza el mismo motor del export.

## Cómo se usa

1. A la izquierda, la **Estructura** presenta el informe como documento; seleccionar una lámina la pone en `foco` (`/graficos?pestana=laminas&foco=l-07`). Sobre la lámina activa: insertar después, duplicar, subir, bajar y eliminar, con deshacer.
2. Al centro, el **Visor** con la lámina real y una tira de miniaturas agrupada por capítulo.
3. A la derecha, el **Inspector** (`panel=inspector`) con Contenido, Composición, Gráficos y Estado; lo que no cabe en una tarjeta (bloques de multiapiladas, filtros) se edita en un panel ancho.
4. La barra lleva informe y alcance, guardado, deshacer, **Avisos** (`panel=avisos`: lo que bloquea la exportación, lo que conviene revisar y lo que dijo el motor), cobertura, plan sugerido y **Exportar**. Lo que aún no tiene superficie nueva abre el Editor anterior, en la misma lámina.
