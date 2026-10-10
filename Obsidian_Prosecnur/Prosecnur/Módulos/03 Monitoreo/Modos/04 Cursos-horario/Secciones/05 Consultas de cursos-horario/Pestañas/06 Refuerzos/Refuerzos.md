---
tipo: pestana
padres:
  - "[[Consultas de cursos-horario]]"
orden: 6
documentacion: parcial
ruta_app: "/monitoreo?modo=aulas&seccion=consultas&pestana=refuerzos"
nodo: "monitoreo/aulas/consultas/refuerzos"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/monitoreo.ts"
  - "frontend/src/features/monitoreo/profiles/aulas/AulasSeccionConsultas.tsx"
  - "frontend/src/features/monitoreo/profiles/aulas/AulasRepartoDelTecho.tsx"
  - "frontend/src/features/monitoreo/profiles/aulas/AulasEleccionPorFacultad.tsx"
  - "frontend/src/features/monitoreo/profiles/aulas/AulasRefuerzoPorCodigo.tsx"
  - "frontend/src/features/monitoreo/profiles/aulas/AulasRefuerzosPedidos.tsx"
  - "api/R/monitoreo_aulas_refuerzos.R"
---

# Refuerzos

> Decide qué cursos-horario reforzar dentro del techo de aulas y sigue en qué va lo pedido.

## Objetivo

Gastar bien el techo de aulas agendables: a qué facultad va cada refuerzo y cuánto cierra, qué facultad se queda sin recibir y qué elegidas se solapan entre sí. Es la continuación de Extras: allí está el inventario, aquí qué conviene pedir de él.

## Cómo se usa

1. **Refuerzos dentro del techo**: elige el techo y lee el reparto propuesto por utilidad; se pueden marcar las mejores de una vez.
2. **Tomar refuerzos de una en una**: entra por la facultad que peor está; tras cada elección la cola se rehace teniendo en cuenta el solape. Al final, se puede escribir un código concreto (por ejemplo «R 23.4») para que la app compruebe que está disponible y lo marque como refuerzo.
3. **Refuerzos pedidos**: lo marcado sale de las listas y aparece aquí en su paso del embudo —por contactar, en gestión, con fecha, aplicado—, que la app reconoce aunque el estado de muestra cambie. Desde aquí se retiran marcas y se publican a la hoja del equipo.
