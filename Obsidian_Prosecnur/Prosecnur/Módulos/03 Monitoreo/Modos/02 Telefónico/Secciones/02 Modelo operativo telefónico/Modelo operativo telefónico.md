---
tipo: seccion
padres:
  - "[[Telefónico]]"
orden: 2
documentacion: parcial
ruta_app: "/monitoreo?modo=telefonico&seccion=modelo"
tags:
  - Seccion
fuentes:
  - "frontend/src/features/monitoreo/profiles/telefonico/modelo/Cuotas.tsx"
  - "frontend/src/features/monitoreo/profiles/telefonico/telefonicoGoalModel.ts"
  - "frontend/src/features/monitoreo/profiles/telefonico/MetaCuotaInput.tsx"
---
# Modelo operativo telefónico

> Declara la cuota que el operativo debe alcanzar y los días de campo en que debe alcanzarla.

## Qué reúne

Una sola pestaña, [[Cuotas y calendario telefónicos]]: la variable de cuota (una, como máximo dos), la meta por categoría frente al reparto proporcional y el calendario. Sin metas por enumerador: el rendimiento del equipo se lee en [[Equipo telefónico]], no se declara aquí.

La reserva (qué casos reemplazan a la muestra) es una pestaña condicional del diseño que todavía no se publica; el origen titular o reserva de cada caso se declara hoy en [[Fuentes del telefónico]].

## Ubicación en la jerarquía

- Padre: [[Telefónico]].
