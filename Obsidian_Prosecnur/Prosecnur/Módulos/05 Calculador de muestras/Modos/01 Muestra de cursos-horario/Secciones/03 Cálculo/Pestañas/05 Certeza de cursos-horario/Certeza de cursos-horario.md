---
tipo: pestana
padres: ["[[Cálculo]]"]
orden: 5
documentacion: parcial
ruta_app: "/calc-muestra?modo=opinion-universitaria&seccion=calculo&pestana=calculo-certeza"
nodo: "calc-muestra/opinion-universitaria/calculo/calculo-certeza"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/calcMuestra.ts"
  - "frontend/src/features/calcMuestra/universidad/calculo/CalculoCertezaTab.tsx"
  - "frontend/src/features/calcMuestra/universidad/calculo/CertezaCoberturaPanel.tsx"
  - "api/R/calc_muestra_aulas_certeza.R"
---

# Certeza de cursos-horario

> En la UI: **¿Alcanza?**. Simula el sorteo y dice cuántos cursos-horario hacen falta de verdad.

## Objetivo

Comprobar si el número de aulas que pide la fórmula alcanza la cuota de cada facultad. La división de «Cursos-horario requeridos» ignora que un alumno puede estar en varias aulas sorteadas y da un número esperado que el sorteo real puede no alcanzar; esta pestaña simula sorteos completos y cuenta.

## Cómo se usa

1. Necesita un cálculo por facultad; sin él, la pestaña lleva a Propuestas.
2. Elige el nivel de certeza exigido y pulsa **Medir certeza**: para cada número candidato de aulas el motor ejecuta sorteos completos, cuenta estudiantes únicos (descontando repetidos) por la efectividad de la facultad, y certifica el mínimo que alcanza la cuota en el nivel exigido. La columna **Curva** muestra cómo crece el rendimiento con más aulas, y cada fila dice con cuántos sorteos se decidió.
3. **Llevar a N** fija una facultad en su mínimo certificado; un botón aparte lleva a la vez a todas las que se quedan cortas. Invalida la selección vigente: hay que volver a sortear.
