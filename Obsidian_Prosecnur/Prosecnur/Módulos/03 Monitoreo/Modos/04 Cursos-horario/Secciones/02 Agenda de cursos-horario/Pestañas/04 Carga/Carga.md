---
tipo: pestana
padres:
  - "[[Agenda de cursos-horario]]"
orden: 4
documentacion: parcial
ruta_app: "/monitoreo?modo=aulas&seccion=modelo&pestana=carga"
nodo: "monitoreo/aulas/modelo/carga"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/monitoreo.ts"
  - "frontend/src/features/monitoreo/profiles/aulas/AulasCargaDeCampo.tsx"
  - "frontend/src/features/monitoreo/profiles/aulas/cargaDeCampo.ts"
---

# Carga

> Cuántos aplicadores hacen falta a la vez, y en qué franja.

## Objetivo

Dimensionar el equipo de campo. Es la única superficie que lee el **rango**
horario del curso y no su hora de inicio, y esa distinción cambia la respuesta:
sobre el plan de HSVG 2026, contar por hora de inicio daba un pico de 8 aulas
simultáneas y contar el rango real da 19. El segundo es el número con el que se
contrata.

## Qué muestra

Dos curvas que no se pueden sumar, porque no cuentan lo mismo:

- **Aulas en curso.** Cuántas clases están dictándose en esa franja.
- **Aplicadores ocupados.** Cuántas personas están aplicando, que es menos: la
  aplicación ocupa una ventana dentro de la clase, no la clase entera.

Y la segunda curva viene partida en dos capas que tampoco se mezclan:

| | Qué se sabe | Cómo se cuenta |
|---|---|---|
| **Firme** | El aula ya se agendó y tiene hora acordada | Ocupa una ventana concreta. Es un hecho |
| **Plausible** | El aula todavía no se agendó | La aplicación puede caer en cualquier punto de la clase, así que la banda es la clase completa |

Suponer que todas las plausibles entran al inicio, o todas al final, inventa una
coincidencia que no existe. Por eso se muestran separadas.

## Cómo se usa

1. Busca el pico de aplicadores firmes: ése es el piso de personal que ya está
   comprometido.
2. Mira la banda de plausibles encima. Es el margen que todavía puede moverse
   agendando, y se estrecha conforme el operativo confirma horas con los
   docentes.
3. Si el pico no alcanza, la palanca está en Agenda, no aquí: mover una clase de
   franja es lo que baja la simultaneidad.
