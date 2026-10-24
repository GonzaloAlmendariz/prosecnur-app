---
tipo: pestana
padres:
  - "[[Insumos telefónicos]]"
orden: 2
documentacion: parcial
ruta_app: "/monitoreo?modo=telefonico&seccion=insumos&pestana=llave"
nodo: "monitoreo/telefonico/insumos/llave"
tags:
  - Pestaña
fuentes:
  - "frontend/src/features/monitoreo/profiles/telefonico/insumos/Llave.tsx"
  - "frontend/src/features/monitoreo/profiles/telefonico/insumos/llaveModel.ts"
  - "frontend/src/features/monitoreo/profiles/telefonico/insumos/EquivalenciasDeNombres.tsx"
  - "frontend/src/features/monitoreo/profiles/telefonico/insumos/equivalenciasModel.ts"
---
# Llave y filtros telefónicos

> Qué cuenta como efectiva y cómo cruza Kobo con la hoja: la llave en lectura, su normalización y el filtro de siempre.

## Qué muestra

La llave del cruce (CodPulso, o el código proGres cuando el estudio lo trae, como el RMS de ACNUR) con cuántos códigos cruzan exactos, cuántos tras normalizar y cuántos no cruzan. Debajo, el filtro de efectivas y las equivalencias de nombres que unen a quien figura con otro nombre en Kobo y en la hoja.

## De dónde lee

Los bloques `comparacion_codpulso` (o `campo_vs_plataforma_codpulso`), `control_tiempo_kobo` y `equivalencias_nombres`.

## Qué decide

La llave decide todas las cifras de Control. Cuando casi nada cruza, o un filtro no encuentra su columna, el modo avisa fuerte en [[Avisos telefónicos]].

## Ubicación en la jerarquía

- Padre: [[Insumos telefónicos]].
