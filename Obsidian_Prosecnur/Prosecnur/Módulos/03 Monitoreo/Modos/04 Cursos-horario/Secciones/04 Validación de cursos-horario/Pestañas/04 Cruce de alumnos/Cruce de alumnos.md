---
tipo: pestana
padres:
  - "[[Validación de cursos-horario]]"
orden: 4
documentacion: parcial
ruta_app: "/monitoreo?modo=aulas&seccion=calidad&pestana=alumnos"
nodo: "monitoreo/aulas/calidad/alumnos"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/monitoreo.ts"
  - "frontend/src/features/monitoreo/profiles/aulas/railDeAulas.ts"
  - "frontend/src/features/monitoreo/profiles/aulas/AulasSeccionCalidad.tsx"
  - "frontend/src/features/monitoreo/profiles/aulas/AulasCrucePorCarrera.tsx"
  - "api/R/monitoreo_aulas_cruce_por_carrera.R"
---

# Cruce de alumnos

> Muestra quién respondió, por su código, cruzado contra el padrón y agrupado por la carrera a la que pertenece.

## Objetivo

Ver a quién está alcanzando el operativo y qué respuestas no se pudieron atar a una persona, y por qué. Del cruce depende el avance de un estudio cuyo eje se resuelve por persona. Sólo existe en estudios **confidenciales**, los que piden código identificador; en uno anónimo la pestaña no aparece.

## Cómo se usa

1. Lee el cruce por carrera: la carrera sale del padrón, no del curso-horario donde se recogió la respuesta. Se cuentan personas, no respuestas; una segunda respuesta de alguien se cuenta aparte.
2. Revisa las respuestas que no cruzan con su motivo —sin código declarado, código ilegible o código que no está en el padrón—: cada uno se arregla en un sitio distinto.
3. Cada fila dice además si cuenta: efectiva, sin curso-horario del plan, rechazó participar, no pasa el criterio o fuera del operativo. Con un filtro puesto, la cifra que manda es la del filtro.
4. Si se llega por dirección a un estudio que no pide código, la pestaña dice por qué no hay cruce.
