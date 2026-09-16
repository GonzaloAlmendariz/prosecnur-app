# «Avance por facultad» — dictado de Gonzalo del 2026-09-15

> «En el excel publicable es mejor que en avance por facultad efectivas no
> ocupe tanto ancho y que la columna de aulas aplicadas esté a su derecha y
> también la de aulas planificadas para que podamos ver si se están aplicando
> el número que se tenía previsto o más incluso, partiendo del hecho que se han
> pedido refuerzos. Hasta estoy pensando en una columna que sea la suma de las
> aplicadas con las agendadas, algo así como aplicación al final o algo así, un
> nombre más profesional.»

Dos decisiones suyas, tomadas antes de tocar código: el bloque de aulas va
**pegado a «Efectivas»** (después de «Avance muestra», antes del desglose por
sexo) y la columna nueva se llama **«Aulas proyectadas al cierre»**.

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| B1 | «Efectivas» no debe ocupar tanto ancho | `.cai_anchos_columna()` en `carga_aulas_libro_indicadores.R` | ☑ 38 → 20 |
| B2 | «Aulas aplicadas» a la derecha de «Efectivas» | `AULAS_AVANCE_CABECERAS$facultad` + `.calaf_avance_por_facultad()` | ☑ col 20 → col 4 |
| B3 | Añadir «Aulas planificadas» a la tabla por facultad | mismas dos piezas | ☑ 174 en total, cuadra con la pantalla |
| B4 | Columna nueva «Aulas proyectadas al cierre» = aplicadas + agendadas | mismas dos piezas | ☑ 169 en total |

## Lo aprendido antes de tocar nada

**B1 — el ancho de «Efectivas» no lo decide «Efectivas».** La hoja «Avance de
campo» apila CINCO tablas en una sola pestaña, y una pestaña tiene un ancho por
columna, no uno por tabla. `.cai_anchos_columna()` toma, para cada posición, el
máximo entre las cinco. Medido sobre el operativo:

```
col  1  ancho 34   <- facultades:Facultad
col  2  ancho 38   <- aplicadores:Aplicador      ← «Efectivas» vive aquí
col  3  ancho 16   <- rendimiento:Aulas planificadas
```

La columna 2 de «Avance por facultad» es «Efectivas», un número de cuatro
dígitos, y hereda los 38 caracteres que pide «Aplicador» en «Producción por
aplicador». Estrecharla de verdad exige bajar el techo de la posición y dejar
que el nombre del aplicador baje de línea: **61 de los 66 nombres pasan de 20
caracteres** (mediana 28, máximo 36 — «Chamorro Rodriguez, Rosa Alejandrina»),
así que sin ajuste de línea se verían cortados.

**B4 — «agendada» tiene una definición y es la del compromiso con fecha.**
`.maau_con_fecha()` (`monitoreo_aulas_agendada.R`): estado de muestra
`agendada`/`reagendada`, estado operativo `agendada`, o fecha puesta.
`contactada` NO entra — contactar no es agendar. Un aula ya aplicada no se
vuelve a sumar: la proyección es `aplicadas + (con fecha y todavía sin
aplicar)`.

**B3 — «Aulas planificadas» ya existe y no se redefine.** «Rendimiento por
facultad» la publica como `sum(sample_role == "titular")`. La tabla por
facultad usa ESA, no una propia: dos tablas del mismo libro con la misma
cabecera y dos cuentas es la avería que este libro ya pagó con «Diferencia».

## Cerrado (2026-09-15)

Los cuatro, con la tabla medida sobre el operativo:

| Facultad | Aplicadas | Planificadas | Proyectadas |
|---|---|---|---|
| Ciencias e Ingeniería | 20 | 37 | 36 |
| Estudios Generales Ciencias | 13 | 22 | 21 |
| **Derecho** | 11 | 19 | **20** |
| Arte y Diseño | 10 | 15 | 14 |
| Estudios Generales Letras | 8 | 20 | 19 |
| … | | | |
| **Total** | **89** | **174** | **169** |

Las 174 planificadas cuadran con «Cursos-horario planificados» de la pantalla de
Avance, que es la comprobación de que no se inventó un tercer denominador.

**Derecho es el caso que la columna existe para enseñar**: proyecta 20 sobre un
plan de 19 porque tiene un refuerzo ya agendado. Y al revés, las facultades con
proyectadas por debajo de planificadas —Psicología 5 de 6, Gestión 6 de 7— son
aulas del plan que todavía no tienen fecha: no es que vayan a perderse, es que
nadie las ha agendado aún, y eso es exactamente lo que había que poder ver.

Verificado con cinco tests nuevos y el contrato de columnas actualizado; gate
del área 2.840 pass · 0 fail.

## Una columna más (2026-09-16, con la hoja ya publicada)

> «Aquí hay que diferenciar cuántas se tenían planificadas originalmente de
> cuántas se tienen proyectadas al cierre; puede ser que hayamos o vayamos a
> aplicar más o menos de lo que finalmente se aplica.»

Las dos columnas ya estaban juntas y aun así había que hacer la resta con el
ojo, quince veces. Ahora la hace la hoja: **«Aulas sobre el plan»**, con signo.

- **Positivo**: cerrará con más aulas de las que el sorteo le puso. Suele ser un
  refuerzo ya agendado — y conviene recordar que eso pasa PORQUE sus aulas
  rindieron menos de lo esperado.
- **Negativo**: quedan aulas del plan que nadie ha agendado todavía.
- **Cero** no es «no pasa nada»: es que lo agendado cubre el plan exactamente,
  que es lo normal en una facultad al día.

**No se llama «Diferencia» y no lleva semáforo**, a propósito: ese rótulo está
reservado a las diferencias que se pintan de verde y rojo, y aquí pasarse del
plan no es bueno ni quedarse corto es malo. El número lleva su signo; el color,
no. Hay un test que lo fija.

De paso, la nota que encabeza el bloque estaba **copiada literal en los dos
renderers** —el del `.xlsx` y el del Sheets—, que es justo lo que el archivo de
vocabulario existe para impedir. Ahora vive en `AULAS_AVANCE_NOTAS$facultad`,
los dos la leen, y explica las tres columnas de aulas.
