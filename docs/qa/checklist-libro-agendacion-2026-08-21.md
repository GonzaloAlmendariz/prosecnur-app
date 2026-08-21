# Checklist — el libro de agendación deja de calcar el Excel viejo

**Quién usa este libro** (aclaración suya, y es el criterio que ordena todo lo demás): «el agendador solo ve el excel, no la app; la app se nutre del excel para alimentar la app». Dos personas, dos herramientas. Este libro es de quien agenda y de quien aplica — cada hoja que no se llena le quita sitio a las que sí, y **L7 sube de prioridad**: si el Excel es su única herramienta, no ver el teléfono mientras escribe es más grave.

**Origen**: revisión de Gonzalo del 21/08/2026 sobre
`Libro_de_agendacion_de_aulas.xlsx` generado desde el proyecto de trabajo.

**La crítica de fondo, textual**: «estás tratando de calcar exactamente cómo era
el Excel y no estás haciendo preguntas más profundas sobre si así se debería
mostrar ahora que tenemos un monitoreo más sofisticado».

Es acertada y explica los ítems L3 y L5: el libro se construyó reproduciendo la
hoja del cliente, columna por columna, y esa fidelidad se trató como requisito
cuando era sólo el punto de partida.

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| L1 | Quitar la hoja «Datos»: no debe haber forcejeo de tabla dinámica | `carga_aulas_libro_generar.R` | ☑ `354aec5c` |
| L2 | «Se va resumen» | `carga_aulas_libro_generar.R` | ☑ commit siguiente a `354aec5c` |
| L3 | La Base de control deja de calcar: fuera `70T`/`70P` | `api/R/carga_base_control.R`, `carga_aulas_libro_generar.R` | ☐ |
| L3a | En su lugar: **% de efectivas esperado vs obtenido**, y si es superior o inferior | idem | ☐ |
| L3b | **Alumnos elegibles esperados vs efectivos**, y si superior o inferior | idem | ☐ |
| L3c | **Hombres y mujeres esperados vs obtenidos** | idem | ☐ |
| L4 | Los datos inventados deben salir del **marco real 2026** (`hsvg2026`) | `api/inst/reference_projects/hsvg2026/` | ⛔ **medido: el marco SÍ está (5 263 aulas × 34), pero `run_history: 0 corridas` — la selección con cadenas NO está guardada ahí** |
| L5 | Vocabulario: ya no es «muestra 1 / muestra 2» sino **titular, reemplazo 1.1, 1.2, 1.3** | `carga_aulas_libro_*.R`, `AULAS_AGENDADAS_BLOQUE` | ☐ |
| L6 | La coma de miles en Matriculados / Elegibles / Esperadas no tiene sentido en cifras de dos dígitos | `carga_aulas_libro_datos.R`, `carga_aulas_libro_formato.R` | ☐ |
| L7 | El agendador no ve el teléfono del docente mientras escribe (medido: contexto 242 caracteres, pantalla ~206, congelado sólo `ID MATCH`) | `carga_aulas_libro_formato.R` | ⛔ decisión suya: congelar hasta teléfono, o reordenar el bloque |

## Lo que L3 exige y no existe todavía

Las tres comparaciones son **esperado vs obtenido**, y el libro sólo tiene el
lado «obtenido». El esperado hay que traerlo:

- **% de efectivas esperado**: del criterio del estudio y `expected_valid`.
- **Elegibles esperados**: `eligible_n` ya está en el plan.
- **Hombres/mujeres esperados**: de las cuotas por sexo × facultad, que el
  motor ya calcula (`quotas_sex_faculty`).

Eso convierte la Base de control de una hoja que el equipo llena en una hoja
que **compara lo planificado con lo que pasó**, que es lo que pide la crítica de
fondo.

## Trampa conocida

`AULAS_AGENDADAS_BLOQUE` y `BASE_CONTROL_CAMPOS` son el contrato con el Excel
que el equipo ya usa: el lector empareja **por título**. Cambiar un título rompe
la relectura de los libros que el equipo tenga a medio llenar, salvo que el
título viejo se conserve como alias — la spec ya admite varios por campo
(`titulos = c("OBSERVACIONES", "OBSERVACIONES SOBRE AULAS AGENDADAS")`).

## L4 — lo que hay de verdad en `hsvg2026`

Medido el 21/08: el `.pulso` de referencia trae `calc_muestra_aulas_frame` con
**5 263 aulas × 34 columnas** —cursos-horario, docentes, facultades y aulas
reales del marco 2026— y `aulas_config` con la configuración completa de
selección (profundidad de reemplazos, bolsas, pesos, semilla). Lo que **no**
trae es una selección corrida: `workspace$run_history` tiene **0 corridas**.

Así que «los cursos-horario que ya seleccionamos» no están en el proyecto de
referencia. Dos caminos, y la elección es de Gonzalo:

1. **Correr la selección** con esa configuración sobre ese marco. Produce
   titulares y cadenas reales, y es reproducible por la semilla.
2. **Que pase su `.pulso`** con la selección ya hecha (no se commitea; se usa
   como copia de trabajo).

Mientras tanto, incluso sin selección, el marco ya permite lo importante para la
estética: los **nombres de curso, docentes, facultades y aulas son reales**, en
vez de «Docente CH 1».
