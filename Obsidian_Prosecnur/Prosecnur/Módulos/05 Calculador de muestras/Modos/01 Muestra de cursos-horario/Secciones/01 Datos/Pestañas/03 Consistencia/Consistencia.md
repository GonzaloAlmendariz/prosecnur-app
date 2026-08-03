---
tipo: pestana
padres: ["[[Datos]]"]
orden: 3
documentacion: parcial
ruta_app: "/calc-muestra?modo=opinion-universitaria&seccion=definicion&pestana=def-consistencia"
nodo: "calc-muestra/opinion-universitaria/definicion/def-consistencia"
tags:
  - Pestaña
fuentes:
  - "frontend/src/features/calcMuestra/universidad/definicion/DefConsistenciaTab.tsx"
  - "frontend/src/features/calcMuestra/universidad/marco/MarcoConsistenciaTab.tsx"
---
# Consistencia
> En la UI: **Consistencia**. Acredita el enlace entre la base de estudiantes y la de cursos-horario antes de construir el marco.
## Objetivo
Comprobar que la llave que une estudiante y curso-horario cruza de verdad: cuántas filas enlazan, cuántas quedan huérfanas y de qué lado, para que el marco no se construya sobre un cruce que no existe.

## Por qué es su propia pestaña
Vivía dentro de Fuentes, junto a la declaración de archivos y hojas. Declarar de dónde sale una tabla y acreditar que dos tablas cruzan son dos decisiones distintas: la primera se hace una vez al abrir el estudio, la segunda se repite cada vez que cambia una base.
