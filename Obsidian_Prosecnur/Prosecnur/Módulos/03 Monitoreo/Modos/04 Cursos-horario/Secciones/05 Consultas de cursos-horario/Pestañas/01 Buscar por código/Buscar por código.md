---
tipo: pestana
padres:
  - "[[Consultas de cursos-horario]]"
orden: 1
documentacion: parcial
ruta_app: "/monitoreo?modo=aulas&seccion=consultas&pestana=ficha"
nodo: "monitoreo/aulas/consultas/ficha"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/monitoreo.ts"
  - "frontend/src/features/monitoreo/profiles/aulas/AulasSeccionConsultas.tsx"
  - "frontend/src/features/monitoreo/profiles/aulas/AulasFichaDeCursoHorario.tsx"
  - "frontend/src/features/monitoreo/profiles/aulas/fichaDeCursoHorario.ts"
---

# Buscar por código

> Busca un curso-horario por su código (CH o R) y muestra su ficha: estado, encuestas y efectividad.

## Objetivo

Contestar por una fila concreta —lo que se pregunta cuando alguien llama con un código en la mano—, mientras las demás pestañas de Consultas contestan preguntas de conjunto.

## Cómo se usa

1. Escribe el código (por ejemplo «CH 43», «R 1.1» o «43»). La búsqueda recorre el plan entero y no aplica el filtro de facultad en foco, para que un código no «desaparezca» por un filtro puesto en otra pestaña.
2. Lee la banda de cifras: elegibles del plan, esperadas por el diseño, efectivas de plataforma y efectividad obtenida contra la prevista.
3. Debajo, el detalle cruza las cuatro fuentes del curso-horario: agenda, partes de campo, bandas de efectividad y control de calidad. Lo que falta se dice, no se deja en blanco.
4. El código elegido viaja en la dirección (`foco`), así que la ficha se puede enlazar.
