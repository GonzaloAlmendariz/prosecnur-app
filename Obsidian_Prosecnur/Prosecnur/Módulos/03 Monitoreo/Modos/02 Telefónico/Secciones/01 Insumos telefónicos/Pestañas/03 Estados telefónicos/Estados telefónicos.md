---
tipo: pestana
padres:
  - "[[Insumos telefónicos]]"
orden: 3
documentacion: parcial
ruta_app: "/monitoreo?modo=telefonico&seccion=insumos&pestana=estados"
nodo: "monitoreo/telefonico/insumos/estados"
tags:
  - Pestaña
fuentes:
  - "frontend/src/features/monitoreo/profiles/telefonico/insumos/Estados.tsx"
  - "frontend/src/features/monitoreo/profiles/telefonico/insumos/estadosModel.ts"
  - "api/R/monitoreo_telefonico.R"
---
# Estados telefónicos

> El vocabulario de status del cliente, cómo lo cuenta el motor y los intentos que registra la hoja.

## Qué muestra

Cada status de la hoja con su familia (intento, contacto, cierre) y su conteo, el «Status por reglas» cuando el proyecto lo activa (opt-in) y la distribución de intentos que registra la hoja. No hay regla de agotado: la app no decide cuándo dejar de llamar.

## De dónde lee

Los bloques `estatus_telefonico` y `cola_insistencia`.

## Qué decide

Cómo se lee cada status en Barrido, Insistencia y Avance. Un status sin regla aparece en ámbar y se corrige aquí.

## Ubicación en la jerarquía

- Padre: [[Insumos telefónicos]].
