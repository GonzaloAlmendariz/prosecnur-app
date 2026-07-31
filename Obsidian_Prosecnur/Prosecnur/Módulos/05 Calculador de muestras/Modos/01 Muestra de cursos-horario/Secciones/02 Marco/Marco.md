---
tipo: seccion
padres: ["[[Muestra de cursos-horario]]"]
orden: 2
documentacion: parcial
ruta_app: "/calc-muestra?modo=opinion-universitaria&seccion=marco"
nodo: "calc-muestra/opinion-universitaria/marco"
tags:
  - Seccion
fuentes: ["frontend/src/features/calcMuestra/universidad/universidadTabs.ts"]
---
# Marco

> En la UI: **Marco**. Define elegibilidad y construye el universo de estudiantes y cursos-horario.

## Propósito de esta guía

**Marco universitario** organiza decisiones que cambian el diseño muestral y sus salidas. En la UI: **Marco**. Define elegibilidad y construye el universo de estudiantes y cursos-horario. Cada vínculo de esta página conduce exclusivamente a un hijo directo y explica qué pregunta resuelve, qué debe comprobarse allí y qué evidencia queda preparada.

## Antes de recorrer este nivel

Trabaja con las bases de estudiantes y cursos-horario del mismo periodo académico. Conserva las llaves que los relacionan y verifica que facultad, sexo, nivel, sección y tamaño de curso procedan de las columnas asignadas. En **Marco universitario**, confirma siempre que población, marco, parámetros y resultados pertenezcan a la misma versión. Si cambia una fuente, una regla de elegibilidad, una cuota o la semilla, deja de ser válida cualquier selección o salida anterior que dependa de ese dato.

## Mapa de navegación

```mermaid
flowchart TD
    N["Marco universitario"]
    N --> C1["Criterios del estudiante"]
    N --> C2["Cursos-horario criterios y radiografía"]
    N --> C3["Población universitaria"]
    N --> C4["Cursos-horario del marco"]
    N --> C5["Cobertura universitaria"]
```

## Guía de destinos

| Destino | Cuándo entrar | Qué hacer allí | Qué deja listo |
|---|---|---|---|
| [[Criterios del estudiante]] | cuando las variables están mapeadas y debes decidir qué estudiantes integran la población elegible. | Define quién es elegible por formación, condición, edad, facultad y nivel. | reglas de elegibilidad del estudiante. |
| [[Cursos-horario criterios y radiografía]] | cuando debes ajustar reglas de curso viendo su efecto sobre elegibles por facultad y nivel. | En la UI: **Cursos-horario: criterios + radiografía**. Ajusta reglas de aula viendo dónde están los elegibles. | criterios de curso-horario con radiografía de cobertura. |
| [[Población universitaria]] | cuando los criterios ya pueden aplicarse y necesitas inspeccionar la base elegible real. | En la UI: **Población**. Presenta elegibles y estructura de la base real. | población elegible cuantificada y descrita. |
| [[Cursos-horario del marco]] | cuando la población elegible debe agregarse en las unidades que realmente pueden sortearse. | En la UI: **Cursos-horario**. Inspecciona las unidades seleccionables del marco real. | lista de cursos-horario seleccionables. |
| [[Cobertura universitaria]] | cuando necesitas comprobar qué elegibles quedan incluidos o excluidos por facultad. | En la UI: **Cobertura**. Compara elegibles incluidos y excluidos por facultad. | diagnóstico de cobertura y exclusiones. |

## Recorrido recomendado

1. **Criterios del estudiante:** Define quién es elegible por formación, condición, edad, facultad y nivel; al terminar, el resultado es reglas de elegibilidad del estudiante.
2. **Cursos-horario criterios y radiografía:** En la UI: **Cursos-horario: criterios + radiografía**. Ajusta reglas de aula viendo dónde están los elegibles; al terminar, el resultado es criterios de curso-horario con radiografía de cobertura.
3. **Población universitaria:** En la UI: **Población**. Presenta elegibles y estructura de la base real; al terminar, el resultado es población elegible cuantificada y descrita.
4. **Cursos-horario del marco:** En la UI: **Cursos-horario**. Inspecciona las unidades seleccionables del marco real; al terminar, el resultado es lista de cursos-horario seleccionables.
5. **Cobertura universitaria:** En la UI: **Cobertura**. Compara elegibles incluidos y excluidos por facultad; al terminar, el resultado es diagnóstico de cobertura y exclusiones.

La primera configuración debe seguir ese orden: los insumos delimitan lo seleccionable; el método transforma esos insumos en metas o probabilidades; y el cierre conserva la evidencia. En **Marco universitario**, empieza por **Criterios del estudiante** y termina en **Cobertura universitaria**. Para una revisión puntual puedes abrir directamente el destino causal, pero recalcula las tareas posteriores si modificas su entrada.

## Cómo interpretar avance y estados

En **Marco universitario**, **sin configurar** indica que falta una entrada indispensable; **no evaluado** significa que la entrada existe pero el cálculo aún no se ejecutó; **listo** exige resultados ligados a la versión actual; **requiere atención** señala una inconsistencia concreta. Un valor cero es un resultado numérico y no reemplaza a “sin dato”. En tablas, conserva denominadores, filtros y totales al pasar del resumen al detalle.

## Resultado de este nivel

Al completar **Marco universitario** quedan visibles los supuestos utilizados, las decisiones que transforman el marco y la evidencia necesaria para reproducir el resultado. Antes de entregar o transferir el diseño, comprueba que nombres, firmas, semillas, totales y fechas correspondan a la misma versión.

## Ubicación en la jerarquía

- Padre: [[Muestra de cursos-horario]].
