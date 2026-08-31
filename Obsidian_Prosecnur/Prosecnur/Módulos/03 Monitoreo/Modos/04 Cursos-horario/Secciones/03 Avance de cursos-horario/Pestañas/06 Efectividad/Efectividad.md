---
tipo: pestana
padres:
  - "[[Avance de cursos-horario]]"
orden: 6
documentacion: parcial
ruta_app: "/monitoreo?modo=aulas&seccion=avance&pestana=efectividad"
nodo: "monitoreo/aulas/avance/efectividad"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/monitoreo.ts"
  - "frontend/src/features/monitoreo/profiles/aulas/AulasPestanaEfectividad.tsx"
  - "frontend/src/features/monitoreo/profiles/aulas/AulasEfectividadSeguimiento.tsx"
  - "docs/adrs/0082-la-tau-del-diseno-es-un-supuesto-fechado-y-el-campo-lo-contrasta.md"
---

# Efectividad

> La τ que supuso el diseño, contra la que está dando el campo.

## Qué es τ

El dimensionamiento compra aforo con `⌈cuota / (p25 × τ)⌉`. Esa τ no es una
constante de la app: cada facultad tiene la suya, compuesta como
`mix_de_tamaños × factor_residual`, y los quince valores de HSVG2026, de 0,409
en EE.GG. Ciencias a 0,800 en Letras, salen del campo 2025 y de ningún otro
sitio.

## Por qué existe esta pantalla

El módulo de certeza declara, literal, que **no** cubre la incertidumbre de τ, y
esa exención no tenía destinatario: el tablero contaba aulas aplicadas y
encuestas conseguidas, nunca la tasa que las liga.

Medido: con τ un 5 % por debajo, EE.GG. Ciencias cierra 4,1 alumnos corta. Y el
riesgo no es el que el operativo teme, porque en 2025 sólo 2 de 196 aulas no se
aplicaron: es que baje la asistencia general, que hasta hoy no disparaba nada.

## Qué NO es

- **No es cumplimiento.** La brecha contra la cuota vive en Cuotas y tiene otro
  denominador. Lo de aquí son los alumnos atribuibles a τ, es decir lo que se
  pierde porque las aulas rinden distinto de lo supuesto, sobre las aulas que ya
  se aplicaron.
- **No recalcula nada.** Tasas, bandas, déficits y reservas los publica el motor;
  la pantalla los muestra.

## Cómo se usa

1. Compara la τ observada de cada facultad contra la de diseño. La banda dice si
   la diferencia todavía cabe en el supuesto.
2. Donde la observada quede por debajo, lee el déficit en alumnos: es lo que hay
   que reponer.
3. Repón con reservas de **esa misma facultad**. Un reemplazo no cruza de
   facultad, y el cierre por facultad y sexo es lo que decide el estudio.
