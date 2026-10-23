---
tipo: pestana
padres:
  - "[[Insumos telefónicos]]"
orden: 1
documentacion: parcial
ruta_app: "/monitoreo?modo=telefonico&seccion=insumos&pestana=fuentes"
nodo: "monitoreo/telefonico/insumos/fuentes"
tags:
  - Pestaña
fuentes:
  - "frontend/src/features/monitoreo/profiles/telefonico/insumos/Fuentes.tsx"
  - "frontend/src/features/monitoreo/profiles/telefonico/insumos/fuentesModel.ts"
  - "frontend/src/features/monitoreo/profiles/telefonico/fuentes/CadenaDeFuentes.tsx"
  - "frontend/src/features/monitoreo/profiles/telefonico/insumos/origenModel.ts"
  - "api/R/monitoreo_telefonico_origen.R"
---
# Fuentes del telefónico

> Qué fuentes lee el corte, qué papel cumple cada una, qué columnas se leen y qué capacidades declara el proyecto.

## Qué muestra

La cadena del corte (listado, hoja de barrido y Kobo), cada fuente con su papel y las columnas que se leen, y las capacidades del proyecto con su vista previa. Aquí se declara el origen de cada caso (muestra titular o reserva) y la marca de reemplazo, que luego cuenta el motor.

## De dónde lee

La configuración de fuentes del perfil y el bloque `origen_de_la_muestra` del motor.

## Qué decide

Qué entra al corte. Si una cifra de Control no cuadra, la primera revisión es aquí: una fuente sin sincronizar produce descuadres que no existen.

## Ubicación en la jerarquía

- Padre: [[Insumos telefónicos]].
