---
tipo: seccion
padres:
  - "[[Acreditación]]"
orden: 2
documentacion: parcial
ruta_app: "/monitoreo?modo=acreditacion&seccion=modelo"
tags:
  - Seccion
fuentes:
  - "frontend/src/lib/navegacion/catalogos/monitoreo.ts"
  - "frontend/src/features/monitoreo/profiles/acreditacion/modelo/Metas.tsx"
  - "frontend/src/features/monitoreo/profiles/acreditacion/modelo/Cuotas.tsx"
  - "frontend/src/features/monitoreo/profiles/acreditacion/modelo/VentanaDeCampo.tsx"
  - "frontend/src/features/monitoreo/profiles/acreditacion/AcreditacionObjetivoActor.ts"
---
# Modelo operativo de acreditación

> Qué se espera lograr: cuántas encuestas por público, cuántas por categoría y cuándo entra cada público.

## Qué reúne

Absorbe Metas y modalidades, Cronograma y Distribución de la sección anterior, y la definición de cuotas que antes se editaba desde Avance › Cuotas.

| Pestaña | Rótulo en la app | Pregunta que responde |
|---|---|---|
| [[Metas de acreditación]] | Metas | ¿cuántas encuestas por público? |
| [[Cuotas de acreditación]] | Cuotas | ¿cuántas por categoría? |
| [[Ventana de campo de acreditación]] | Ventana de campo | ¿cuándo entra cada público? |

## Regla de lectura

La meta es un mínimo interno, no necesariamente el objetivo del cliente: un público con el mínimo cubierto puede seguir teniendo trabajo pendiente si lo acordado es barrer todo el padrón. Avance solo lee el cumplimiento de lo que se declara aquí; definir una cuota es modelo, no lectura.

## Ubicación en la jerarquía

- Padre: [[Acreditación]].
