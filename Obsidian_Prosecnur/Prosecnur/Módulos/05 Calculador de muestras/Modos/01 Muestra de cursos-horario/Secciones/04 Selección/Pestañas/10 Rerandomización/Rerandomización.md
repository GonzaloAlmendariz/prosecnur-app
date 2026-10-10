---
tipo: pestana
padres:
  - "[[Selección]]"
orden: 10
documentacion: parcial
ruta_app: "/calc-muestra?modo=opinion-universitaria&seccion=aulas&pestana=aulas-rerandomizacion"
nodo: "calc-muestra/opinion-universitaria/aulas/aulas-rerandomizacion"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/calcMuestra.ts"
  - "frontend/src/features/calcMuestra/universidad/aulas/AulasRerandomizacionTab.tsx"
  - "api/R/calc_muestra_aulas_rerandomizacion.R"
---

# Rerandomización

> En la UI: **¿Este sorteo o otro?**. Acepta o rechaza sorteos contra un criterio fijado antes de mirarlos (ADR 0082).

## Objetivo

Separar rerandomizar de optimizar. Quedarse con el mejor de muchos sorteos hace incalculables las probabilidades de inclusión; aceptar o rechazar contra un criterio declarado antes conserva un diseño sobre el que se puede razonar.

## Cómo se usa

1. Lee el veredicto de la última corrida: sorteos hechos, cuántos pasaron el criterio, tasa de aceptación y cobertura mínima. Si se agotó el tope sin pasar, el aviso lo dice: sube el tope o el criterio pide más de lo que el marco da.
2. Revisa el criterio: toda celda facultad × sexo alcanza al menos un umbral de su cuota. Se arma solo con la cuota, la efectividad por facultad y el reparto por sexo del marco; sin cálculo por facultad, todavía no hay criterio.
3. Activa **Rerandomizar al sortear** y fija el **Tope de sorteos**. Apagado, el sorteo sale como siempre: el primero, sin rechazar ninguno.
