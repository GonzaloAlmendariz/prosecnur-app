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
| L3 | La Base de control deja de calcar: fuera `70T`/`70P` | `carga_base_control.R`, `carga_aulas_libro_generar.R` | ☑ `789b41e0` |
| L3a | **% de efectivas esperado vs obtenido**, y la diferencia con signo | idem | ☑ |
| L3b | **Elegibles esperados**; el «efectivo» es la efectiva de plataforma, ya en L3a | idem | ☑ |
| L3c | **Hombres y mujeres esperados** (del plan, por aula) vs obtenidos (`women_n`/`men_n`) | idem | ☑ |
| L4 | Los datos inventados deben salir del **marco real 2026** (`hsvg2026`) | `api/inst/reference_projects/hsvg2026/` | ⛔ **medido: el marco SÍ está (5 263 aulas × 34), pero `run_history: 0 corridas` — la selección con cadenas NO está guardada ahí** |
| L5 | Vocabulario: **titular, reemplazo 1.1, 1.2, 1.3** | `carga_aulas_libro_generar.R` | ☑ en la hoja de campo. **En «Aulas Agendadas» no hay banda de texto** —sólo color— porque su lector espera los títulos en la fila 1; entra en L7 |
| L6 | La coma de miles en cifras de dos dígitos | — | ☑ `6bc088d1` — se resolvió al retirar «Datos» y «Resumen»: las comas eran de los totales de la portada (5,410). En las tres hojas, lo que lleva `#,##0` no pasa de 52 |
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

## L3 — el diseño, con lo que hay medido

Medido el 21/08 sobre el proyecto de trabajo: **los dos lados ya existen**, y el
esperado está **por aula**, no sólo por facultad.

**Lado esperado — en el plan, 170/170 titulares, sin huecos:**

| campo | rango | para qué |
|---|---|---|
| `eligible_n` | 20–44 | alumnos elegibles esperados |
| `expected_valid` | 0–31 | encuestas efectivas esperadas |
| `sex_top_1_n` / `sex_top_2_n` | 11–18 / 9–14 | **el reparto por sexo esperado, por aula** |

**Lado obtenido — en el control, 102 de 152 filas llenas:**

| campo | rango |
|---|---|
| `sent_total` | 7–45 |
| `observed_students` | 11–52 |
| `women_n` / `men_n` | 4–27 / 3–18 |

**Y de ahí sale el hallazgo que da sentido al cambio:** `expected_valid` sobre
`eligible_n` da justamente el **70 %** del estudio. O sea que `70T`/`70P` no son
dos columnas cualesquiera: son **ese porcentaje convertido en dos banderas de
sí/no**. Sustituirlas por el porcentaje esperado, el obtenido y su diferencia no
pierde nada y dice mucho más — que es exactamente la crítica de fondo.

### Columnas propuestas (sustituyen a `70T`, `70P`, `VALIDO TOTAL`, `VALIDO POBLACION`)

| grupo | columna | de dónde sale |
|---|---|---|
| Efectivas | `% EFECTIVAS ESPERADO` | `expected_valid / eligible_n` |
| | `% EFECTIVAS OBTENIDO` | efectivas del parte `/ eligible_n` |
| | `DIFERENCIA` | obtenido − esperado, con signo |
| Sexo | `MUJERES ESPERADAS` / `OBTENIDAS` | `sex_top_1_n` · `women_n` |
| | `HOMBRES ESPERADOS` / `OBTENIDOS` | `sex_top_2_n` · `men_n` |
| Elegibles | `ELEGIBLES ESPERADOS` | `eligible_n` |
| | `ELEGIBLES EFECTIVOS` | **⛔ falta decidir qué es** |

### Las dos cosas que faltan antes de implementar

1. ~~Qué es «alumno elegible efectivo».~~ **RESPONDIDO por Gonzalo (21/08)**:
   «un elegible efectivo o sólo efectivo es una respuesta efectiva de la
   plataforma, es decir es una encuesta que se completa y pasa los filtros».

   Es la definición canónica y tiene dos consecuencias que van más allá de esta
   hoja:

   - **La efectiva se define en la plataforma, no en el parte.** Lo que el
     aplicador anota (`effective_surveys`) es su cuenta de campo; la efectiva
     del estudio es la respuesta que llegó y pasó los filtros. Son dos cifras
     distintas con un nombre parecido, y ésta es la buena.
   - **Cierra la pregunta que quedó abierta en `7c5b6712`**: el cruce
     parte↔plataforma compara lo declarado contra `respuestas_validas`, y ése
     **es** el criterio correcto. Lo había dejado como duda pensando que
     comparar contra el total recibido sería más fiel; no lo es.
   - **Cambia la naturaleza de la hoja.** Si la efectiva la define la
     plataforma, esa columna **la escribe Prosecnur**, no el equipo: la Base de
     control deja de ser una hoja que se llena a mano y pasa a ser donde la app
     deja lo que sabe para que el equipo lo lea.
2. ~~Compatibilidad con los libros a medio llenar.~~ **RESUELTO sin coste**: los
   cuatro títulos viejos siguen en la spec como alias de LECTURA. Ya no se
   escriben, pero un libro que el equipo tenga con la columna `70T` se sigue
   leyendo entero. Queda un test que lo fija.

   El texto original: El lector empareja por
   título: si `70T` desaparece de `BASE_CONTROL_CAMPOS`, un libro que el equipo
   ya tenga con esa columna deja de leerla. Se puede conservar como alias de
   lectura sin escribirla —la spec ya admite varios títulos por campo— y esa es
   la opción sin coste, pero conviene decidirlo a propósito y no por inercia.
