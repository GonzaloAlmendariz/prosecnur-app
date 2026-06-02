# ADR 0002: Formato de proyecto `.pulso`

Estado: Aceptado

Fecha: 2026-05-31

## Contexto

Prosecnur necesita guardar un estudio de manera portable: instrumento, data,
estado de validacion, decisiones de limpieza, codificacion y configuracion de
reportes/graficos. El archivo debe poder moverse entre maquinas sin depender de
una base de datos local permanente.

Las alternativas principales eran una base de datos persistente por usuario, un
directorio de proyecto con muchos archivos o un archivo empaquetado. La base de
datos favorece consultas y concurrencia, pero complica portabilidad. El
directorio visible favorece inspeccion manual, pero aumenta el riesgo de
romper el proyecto al mover piezas sueltas.

## Decision

El proyecto persistente usa formato `.pulso`: un zip con `manifest.json`,
`state.rds` filtrado y un directorio `files/` con copias de los inputs del
proyecto. Los entregables finales no se guardan dentro del `.pulso` por
defecto; se exportan como archivos independientes.

## Consecuencias

Se gana portabilidad, reproducibilidad y un unico archivo facil de respaldar.
El zip permite inspeccionar el contenido y recuperar inputs incluso si el estado
serializado falla.

Se sacrifica concurrencia y consultas incrementales de una base persistente.
Tambien aparece riesgo de crecimiento si se serializan caches o entregables
regenerables.

## Cumplimiento

- [`api/R/project_pulso.R`](../../api/R/project_pulso.R) debe seguir excluyendo
  caches derivables antes de `saveRDS`.
- Los outputs y entregables deben guardarse fuera del `.pulso` salvo decision
  documentada.
- Los paths absolutos deben reescribirse al cargar un proyecto.
- Cambios incompatibles al formato requieren migracion o ADR.

## Notas

Relacionado con [ADR 0005](0005-secretos-fuera-del-proyecto.md).
