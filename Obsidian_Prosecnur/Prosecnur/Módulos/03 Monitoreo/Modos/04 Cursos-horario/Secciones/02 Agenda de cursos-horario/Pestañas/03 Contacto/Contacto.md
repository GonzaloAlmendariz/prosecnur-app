---
tipo: pestana
padres:
  - "[[Agenda de cursos-horario]]"
orden: 3
documentacion: parcial
ruta_app: "/monitoreo?modo=aulas&seccion=modelo&pestana=contacto"
nodo: "monitoreo/aulas/modelo/contacto"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/monitoreo.ts"
  - "frontend/src/features/monitoreo/profiles/aulas/AulasMedioDeContacto.tsx"
  - "frontend/src/features/monitoreo/profiles/aulas/colaDeContacto.ts"
---

# Contacto

> Compara qué medio de contacto consigue cerrar más citas con los docentes.

## Objetivo

Decidir por dónde insistir cuando una sesión no se logra agendar.

## Cómo se usa

1. Mira la efectividad de cada medio sobre los cursos-horario ya agendados.
2. Usa la cola de contacto para ver qué gestiones quedan pendientes y por cuál medio.
