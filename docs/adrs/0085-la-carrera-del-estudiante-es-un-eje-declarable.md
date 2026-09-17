# ADR 0085 — La carrera del estudiante es un eje declarable, y el aula sigue siendo el vehículo

- **Estado**: Aceptado, con su cláusula 2 **reemplazada**
- **Fecha**: 2026-09-15
- **Ámbito**: Cálculo de muestra · Recopiladores · Monitoreo de aulas · libro
  operativo
- **Depende de**: [ADR 0081](0081-la-facultad-de-un-aula-no-es-la-de-sus-alumnos.md)
  (del que es una aplicación un nivel más abajo) y
  [ADR 0082](0082-una-variable-casi-identificadora-no-balancea-degenera.md)
  (cuya guarda se conserva intacta)
- **Reemplazo parcial**: su **cláusula 2** —«el eje lee la carrera del
  ESTUDIANTE»— la reemplaza el
  [ADR 0086](0086-el-eje-de-cuotas-lo-declara-el-estudio.md). Las cláusulas 1, 3
  y 4 siguen vigentes y son el trabajo de fondo de este documento.

> **AVISO DE ÁMBITO, 2026-09-17.** Este ADR se escribió con un dictado del
> 15/09 que puso la CARRERA como eje de CCSS Perfil 2026-II. El 17/09 Gonzalo
> fijó otra cosa: **«Recuerda que la meta no es por sexo y nivel sino sólo
> nivel»**. Las metas del estudio se prometieron por **nivel curricular**, y
> carrera y sexo son **referenciales** —se describen, no se exigen—. Lo que este
> documento sigue aportando, y por lo que se conserva aceptado, es su cláusula 1
> (el eje lo declara el estudio y no lo adivina el marco), su cláusula 3 (las
> fichas no se reparten por carrera: el aula es compartida y sigue entera) y su
> cláusula 4 (que «estrato» deje de ser sinónimo de la columna `faculty`, que es
> el defecto de fondo y el que habría hecho caer las metas a `NA` en silencio).
> Para el eje vigente y su contrato, ir al ADR 0086.

## Contexto

CCSS Perfil 2026-II es un estudio de aulas con QR igual que HSVG, pero vive
**dentro de una sola facultad**: Ciencias Sociales. Su marco son 155 aulas y 799
elegibles repartidos en seis carreras:

| Carrera | Elegibles | En el marco |
|---|---|---|
| Economía | 358 | 335 |
| Relaciones Internacionales | 174 | 158 |
| Ciencia Política y Gobierno | 130 | 122 |
| Finanzas | 97 | 91 |
| Antropología | 23 | 23 |
| Sociología | 17 | 17 |

Con el eje en facultad, ese estudio tiene **un solo estrato**. Todas las
superficies que reparten por facultad caen a la vez en su caso degenerado: la
tarjeta de composición muestra una fila al 100 %, el bloque de decisión del
marco no se pliega, la página de paneles del PDF de Monitoreo se omite, y la
tarjeta del home informa «1 facultades». Ninguna sustituye el eje por otro: lo
colapsan. El estudio pierde la granularidad que necesita sin ganar la que le
sirve.

El dato ya existe y ya viaja. `mapping$program` reconoce las columnas de
carrera/programa/especialidad (`calc_muestra_aulas.R:258`), la tarjeta de
categoría «Programa o carrera» existe desde el ADR 0057
(`calc_muestra_aulas.R:1530`), y el plan de recolección guarda `program` por
unidad (`collection_engine.R:358`). Lo que falta no es el dato: es que alguna
superficie lo trate como **eje**.

## El hecho que lo motiva

El ADR 0081 resolvió esta misma pregunta para la facultad, y su frase es
literal: «la facultad de un aula es la de sus alumnos, no la de su curso. Para
un estudio de estudiantes, la unidad de análisis es la persona. El aula es el
vehículo de contacto, no el objeto de medición».

CCSS obliga a aplicar esa regla un nivel más abajo, y el dictado de Gonzalo del
2026-09-15 la repite sin conocerla: «las fichas no se dividen [por] carreras
como tal sino toman en cuenta de que son compartidos. Lo que importa finalmente
es la carrera del estudiante, no el curso al que va».

Medido sobre el marco de CCSS: la carrera del **curso** parte el 74 % de las
aulas de forma limpia, pero el 26 % restante sirve a dos o más carreras. La
carrera del **estudiante** no tiene ese problema, porque cada persona tiene una.
Son dos preguntas distintas sobre la misma aula, exactamente como en el ADR
0081.

## Decisión

**1 · El eje operativo lo declara el estudio, no lo adivina el marco.** Un
estudio de aulas declara su `eje_operativo` —`facultad` o `carrera`— una vez, y
todas las superficies leen esa decisión: metas y cuotas, tarjeta de composición,
libro operativo, avance y brecha de Monitoreo. La app **sugiere** `carrera`
cuando el marco trae una sola facultad, pero la decisión queda escrita, es
reversible y no cambia sola porque se rehaga el marco.

**2 · ~~El eje lee la carrera del ESTUDIANTE, no la del curso.~~**
**REEMPLAZADA** por el [ADR 0086](0086-el-eje-de-cuotas-lo-declara-el-estudio.md)
el 2026-09-17: el eje de cuotas de CCSS es el **nivel curricular**, y la carrera
es referencial. Lo que de esta cláusula sobrevive, y el 0086 conserva, es su
principio: cuando el eje sea una propiedad de la PERSONA —carrera o nivel—, la
que cuenta es la del estudiante y no la del curso, que es el ADR 0081 un nivel
más abajo. La carrera del curso-horario queda como referencia descriptiva del
aula.

**3 · Las fichas no se reparten por carrera.** El aula es compartida y sigue
entera: una sola ficha, un solo QR, un solo aplicador. El árbol de carpetas del
paquete **no gana un nivel de carrera**, porque partirlo obligaría a elegir una
carrera dominante que no describe a los alumnos del aula, a mandar una de cada
cuatro aulas a un cajón aparte, o a imprimir el mismo QR varias veces. Lo que sí
gana la ficha es **declarar que el aula es compartida** y qué carreras la
componen: es información de reparto, no un criterio de partición.

**4 · «Estrato» deja de ser sinónimo de la columna `faculty`.** Hoy están
fusionados por nombre y no por contrato: `monitoreo_aulas_metas_diseno.R` lee un
`estrato` genérico y lo reetiqueta como `faculty_key`, y luego empareja contra
`row$faculty`; `calc_muestra_aulas_afijacion.R:58` falla fuerte si el estrato no
coincide 1:1 con una facultad. Con el eje en carrera, la clave publicada sería
el nombre de la carrera y el código la buscaría contra una columna de facultad
que en CCSS es constante: **las claves nunca calzarían y las metas caerían a
`NA` en silencio**. La clave de meta tiene que viajar con el nombre del eje que
la produjo.

## Lo que esta decisión NO cambia

- **La guarda del ADR 0082 se queda intacta.** Aquella midió que `program`
  dentro de una facultad puede tener casi tantos niveles como aulas a sortear
  (Gestión: 44 columnas para 49 aulas) y por eso lo sacó de `balance_vars` por
  defecto. CCSS no cae ahí —6 carreras para 155 aulas— pero la guarda protege al
  estudio que sí caiga, y sigue siendo la que decide en tiempo de ejecución.
- **Los estudios multi-facultad no se tocan.** `eje_operativo` nace en
  `facultad`, que es lo que hacen hoy. HSVG y los demás estudios vigentes no
  cambian de comportamiento por esta decisión.
- **No se decide la afijación.** Cuántas encuestas van a cada carrera, y si hay
  mínimos, es dimensionamiento y se resuelve por estudio. Aquí sólo se decide
  que el eje existe y quién lo declara.

## Consecuencias

- Hay que separar, en el contrato de metas, el **nombre del eje** de la
  **columna** que lo alimenta. Es el trabajo de fondo y es previo a todo lo
  demás: sin él, cambiar el eje degrada en silencio.
- El árbol de carpetas del paquete de fichas no cambia. La ficha de campo gana
  una línea cuando el aula es compartida.
- La superficie es grande y parte está congelada: 132 archivos del repo llevan
  «facultad» en el nombre y ninguno lleva «carrera». La lógica nueva va en
  archivos satélite que los grandes llaman, como ya se hizo con
  `_afijacion.R`, `_balance_saneo.R` y `_sexo_por_facultad.R`.
