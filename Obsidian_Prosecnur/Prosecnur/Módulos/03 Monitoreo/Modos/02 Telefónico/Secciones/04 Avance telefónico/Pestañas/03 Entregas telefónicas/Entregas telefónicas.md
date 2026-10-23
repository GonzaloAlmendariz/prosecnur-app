---
tipo: pestana
padres:
  - "[[Avance telefónico]]"
orden: 3
documentacion: parcial
ruta_app: "/monitoreo?modo=telefonico&seccion=avance&pestana=entregas"
nodo: "monitoreo/telefonico/avance/entregas"
tags:
  - Pestaña
fuentes:
  - "frontend/src/features/monitoreo/profiles/telefonico/avance/Entregas.tsx"
  - "frontend/src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.tsx"
  - "api/R/monitoreo_telefonico_report_pdf.R"
---
# Entregas telefónicas

> Qué sale del corte: para el cliente, el avance por cuota; para el equipo, el PDF de producción.

## Qué muestra

«Para el cliente», la vista del PDF de avance por cuota y la publicación en la hoja del cliente; «Para el equipo», el PDF de producción y la publicación en la hoja interna, junto a las salidas de siempre.

## De dónde lee

El reporte del corte y el PDF telefónico del motor.

## Qué decide

Qué se entrega y a quién. Al cliente sólo va el avance por cuota.

## Ubicación en la jerarquía

- Padre: [[Avance telefónico]].
