# Tipos de estudio 2024-2026 y ruta del evaluador de muestra

Este documento separa cuatro decisiones que antes quedaban mezcladas:

- **Familia de estudio:** clasifica el proyecto por su lógica de diseño.
- **Metodología principal:** define la técnica dominante usada para dimensionar o justificar el levantamiento.
- **Origen de la muestra o meta:** explica si el tamaño se calcula, viene de una muestra previa, de una meta contractual, de un barrido o de cobertura por actor.
- **Acción del evaluador de muestra:** define qué debe hacer la app.

Regla operativa: el evaluador de muestra no debe asumir que todo estudio requiere cálculo estadístico. En el calculador solo debe elegir entre calcular muestra, calcular marco de cobertura, calcular cuotas desde un marco operativo o evaluar componentes calculables. Si el estudio ya trae base, listado, muestra o meta cerrada, queda fuera del calculador.

## Acciones del evaluador

| Acción | Cuándo aplica | Salida principal |
|---|---|---|
| Calcular muestra | El estudio requiere estimar `n` desde marco, precisión, diseño y parámetros. | `n_teorico`, `n_objetivo`, `n_operativo`, precisión |
| Calcular marco de cobertura | El objetivo es cubrir actores, sedes, aulas, cursos, servicios o universos operativos. | Marco a cubrir por actor/componente |
| Calcular cuotas | El marco disponible son volúmenes por territorio, servicio, actor o perfil. | Matriz de cuotas calculada |
| Evaluar por componente | El estudio mezcla actores o frentes con reglas distintas. | Plan multicomponente |
| Fuera del calculador | La muestra, listado, base o meta ya viene cerrada por contrato, cliente o programa. | No aplica en este módulo |

## Familias consolidadas

| Familia | Criterio | Ruta habitual del evaluador |
|---|---|---|
| Estudios de acreditación de programa | Estudios multiactor de programas académicos. Incluye estudiantes, docentes, administrativos, egresados, empleadores o comités. | Calcular marco de cobertura o evaluar por componente |
| Estudios de opinión universitaria | Encuestas universitarias como HSVG y estudios afines, usualmente con cursos, aulas, horarios o estratos académicos. | Calcular muestra o evaluar por componente |
| Estudios territoriales y de hogares | Encuestas a hogares, personas o segmentos poblacionales definidos territorialmente. | Handoff a Hojas de Ruta |
| Estudios de servicios y establecimientos | Evaluaciones en instituciones, sedes, servicios, establecimientos o unidades de atención. | Calcular muestra, cuotas o evaluar por componente |
| Estudios con listado telefónico o base de programa | Estudios que parten de una base entregada, padrón operativo, listado de beneficiarios o meta contractual. | Fuera del calculador |
| Estudios institucionales no probabilísticos | Estudios internos, cualitativos o de alcance operativo definido por perfiles o disponibilidad. | Calcular cuotas o fuera del calculador |

## Ejemplos clave

En **acreditación**, no todos los actores ameritan cálculo de muestra. Algunos requieren construir el marco de cobertura a cubrir por actor y canal; otros pueden tener mínimos, cuotas o barridos. Por eso toda acreditación queda como una familia única, pero la acción puede ser `calcular_marco_cobertura`, `calcular_cuotas` o `evaluar_por_componente`.

En **HSVG y opinión universitaria**, el cálculo de muestra sí suele ser la ruta central cuando hay inferencia cuantitativa. En mediciones recurrentes, el módulo debe reconocer que la estructura histórica se replica y se actualiza con nuevos marcos, no que todo parte desde cero.

En estudios con **bases ACNUR, ECHO, PADF, ALEGRA o listados telefónicos**, si la muestra o meta ya viene definida, no corresponde recalcularla como si fuera un diseño nuevo. Esos casos salen del calculador. **GIZ** queda clasificado aparte: fue un estudio ocasional de servicios con marco de atenciones por municipalidad y servicio; por eso sí corresponde calcular tamaño y cuotas cuando el nuevo estudio presenta un marco semejante.

La tabla canónica vive en `api/inst/catalogos/tabla_maestra_estudios.json`; el catálogo de familias y rutas del evaluador vive en `api/inst/catalogos/catalogo_tipos_estudio.json`.
