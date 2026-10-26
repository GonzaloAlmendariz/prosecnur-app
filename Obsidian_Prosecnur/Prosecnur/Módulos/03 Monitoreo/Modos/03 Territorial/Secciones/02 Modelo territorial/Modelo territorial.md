---
tipo: seccion
padres:
  - "[[Territorial]]"
orden: 2
documentacion: parcial
ruta_app: "/monitoreo?modo=territorial&seccion=modelo"
tags:
  - Seccion
fuentes:
  - "frontend/src/lib/navegacion/catalogos/monitoreo.ts"
  - "frontend/src/features/monitoreo/profiles/territorial/modelo/MetasTab.tsx"
  - "frontend/src/features/monitoreo/profiles/territorial/modelo/CuotasTab.tsx"
---
# Modelo territorial

> Qué hay que lograr y con qué cuotas: meta por distrito, la muestra de UMP titulares y reemplazos, las fases y la cuota que declara el proyecto.

## Qué reúne

Absorbe la definición de UMPs › Manzanas, la meta de Avance › Distritos, la banda de fase Piloto/Campo y la definición de Validación › Cuotas. El slug `modelo` antes significaba «UMPs»; sus pestañas viejas se leen como alias de su destino nuevo.

| Pestaña | Rótulo en la app | Pregunta que responde |
|---|---|---|
| [[Metas y muestra territorial]] | Metas y muestra | ¿cuánto, dónde y en qué fase? |
| [[Cuotas declaradas territoriales]] | Cuotas | ¿qué cuota declara el proyecto? |

## Regla de lectura

Se lee aquí y se edita en Hojas de ruta: la meta, las UMP y la cuota por UMP salen de la muestra que se arma allí. Cuánto se logró de cada celda no se lee aquí, sino en Avance › Faltante por UMP.

## Ubicación en la jerarquía

- Padre: [[Territorial]].
