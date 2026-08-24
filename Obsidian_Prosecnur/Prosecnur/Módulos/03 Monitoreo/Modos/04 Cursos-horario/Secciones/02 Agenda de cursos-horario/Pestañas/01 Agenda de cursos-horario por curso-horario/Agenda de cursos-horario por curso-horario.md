---
tipo: pestana
padres:
  - "[[Agenda de cursos-horario]]"
orden: 1
documentacion: parcial
ruta_app: "/monitoreo?modo=aulas&seccion=modelo&pestana=agenda"
nodo: "monitoreo/aulas/modelo/agenda"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/monitoreo.ts"
  - "frontend/src/features/monitoreo/profiles/aulas/AulasAgendaPorDia.tsx"
  - "frontend/src/features/monitoreo/profiles/aulas/agendamiento.ts"
---

# Agenda de cursos-horario por curso-horario

> Reúne el plan de cursos-horario con su fecha agendada y el enlace de acceso de cada uno.

## Objetivo

Saber qué sesiones tienen cita cerrada y cuáles siguen sin fecha, con el enlace que usará el aplicador.

## Cómo se usa

1. Revisa la fecha agendada de cada curso-horario titular.
2. Comprueba que un aula con parte de campo tenga también su fecha: si no la tiene, es un descuadre entre la hoja de agenda y el parte, no un estado del operativo.
3. Copia el enlace de acceso de la sesión que toca.
