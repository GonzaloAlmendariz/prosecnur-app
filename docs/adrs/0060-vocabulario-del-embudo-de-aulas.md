# ADR 0060 — Cada encuentro con una persona en el aula tiene un resultado, y se llama igual en toda la app

- **Estado**: aceptada
- **Implementación**: parcial — 2026-08-07. Ya en producción: contrato v2 con
  glosario del encuentro, denominadores sancionados en serie semanal, cadena y
  embudo (`asistentes_elegibles` capado, `pct_ya_medidas` sobre
  `asistentes_elegibles`), intervalo `asistencia_elegibles_min/max`, tasa > 1
  = NA + `residual_negativo` en todos los paths (Cumplimiento 4 y 5),
  normalizador frontend fail-closed, migración en carga para `.pulso` con
  tasas viejas (Cumplimiento 11) y tests de contrato
  (`test-calc-muestra-asistencia-adr0060.R`). Pendiente: guard 9 (vocabulario
  retirado sigue como nombres de campo internos del modelo), punto 10
  (`poblacion` a secas en el frontend) y catálogo de filtros de corte
  declarado por el estudio (sección 4).
- **Fecha**: 2026-08-04
- **Fecha de decisión**: 2026-08-04 — ratificada por Gonzalo tras revisar el glosario término por término
- **Contexto previo**: ADR 0043 (proyectos de referencia), ADR 0057 (tarjeta de categoría), ADR 0058 (matriz de cascada), `api/R/calc_muestra_asistencia_referencia.R`
- **Fuente metodológica externa**: `HST UNSA/Documentación Definitiva HST` — en particular `00 · Empezar aquí/Glosario.md`, `02 · Cifras canónicas.md` y `03 · El método paso a paso/03.6`. **Ese cuerpo manda sobre el diseño muestral**; este ADR gobierna solo el vocabulario del embudo de campo y no redefine nada de allí.

## Contexto

La pestaña **Histórico** de Cálculo de muestra (modo `opinion-universitaria`)
transfiere tasas de un estudio ya aplicado para anclar el mínimo de elegibles
por aula. Su motor, `calc_muestra_asistencia_referencia.R`, fue calibrado
contra el tablero de control del estudio de hostigamiento sexual y violencia
basada en género de la PUCP 2025: los alias en `.cm_asist_column_aliases()` son
sus encabezados literales — `TOTAL ENVIADAS`, `TOTAL LARGAS`,
`N° ASISTENTES QUE NO RESPONDIERON`.

Al preparar una base histórica más precisa se auditó el vocabulario de las tres
capas y aparecieron siete problemas.

**1. Se estaban mezclando dos universos.** El vocabulario heredado cuenta a
veces **personas del aula** (asistentes, no respondieron) y a veces **registros
del formulario** (enviadas, largas, cortas). Obligar a pensar en las dos
poblaciones a la vez es la razón de fondo por la que nadie lograba explicar el
embudo sin dibujarlo. Un intento previo de este ADR introdujo `iniciadas` para
nombrar los registros, y fue rechazado en revisión por el mismo motivo: agrega
un nivel intermedio que el usuario no necesita.

**2. Dos nombres del contrato dicen lo contrario de lo que miden.** El tramo
`completitud` es `enviadas / asistentes`: no mide que completaran, mide que
**abrieron**. El tramo `validez` es `validas / enviadas`, y «validez» es un
término cargado en metodología —interna, externa, de constructo—.

**3. Hay dos «población» distintas.** Una es el **N** del cálculo de tamaño
muestral (`poblacion_n`, FPC, Cochran); la otra es «los matriculados que
cumplen el criterio de inclusión». Fusionarlas rompería el vocabulario estándar
de muestreo justo en la pestaña de cálculo.

**4. `elegibles` ya había ganado, pero nadie lo declaró.** En R aparece 68
veces contra 2 de `poblacion`; en el frontend 673 contra 125. La migración
estaba a medias. En cambio `largas` y `cortas` casi no existen en la app: son
vocabulario de la base de 2025, y el trabajo va de la base hacia el código.

**5. No todos los cortes son la misma clase de cosa, y los filtros estaban
hardcodeados.** El motor asume tres validadores en cascada con semántica fija,
cuando cuántos filtros tiene un instrumento y qué preguntan es propiedad del
formulario. Y el tercer validador de 2025 —«¿tienes más de un ciclo?»— no es un
rechazo sino una **inelegibilidad**: quien no pertenecía al estudio nunca fue
una pérdida.

**6. Se estaba clasificando personas cuando lo que ocurre son encuentros.** Un
estudiante matriculado en dos cursos-horario de la muestra es visitado dos
veces. Puede faltar a la primera sesión y asistir a la segunda; puede responder
en la primera y aparecer como repetido en la segunda. «Ausente» no es un estado
de la persona: es el resultado de **un** encuentro. Las 446 personas que el
campo registró como «ya respondieron» —13.5 % de las efectivas— son la prueba
directa de que un individuo genera varios eventos. Sin identificador de
estudiante, el estudio no puede calcular cobertura a nivel persona: solo cuenta
encuentros.

**7. La tasa de asistencia estaba mal formada.** `asistentes / elegibles` pone
en el numerador a **todos** los presentes y en el denominador solo a los
**elegibles**. En 31 de 194 aulas da más de 100 % —`HUM113-0238` llega a
230 % con 10 elegibles y 23 presentes—. Lo que interesa es la asistencia **de
los elegibles**, que por construcción nunca puede pasar de 100 %. Pero el
aplicador de 2025 contaba cabezas, no elegibilidad: de los 4931 presentes solo
3303 están confirmados como elegibles y 60 como no elegibles; los 1568
restantes son inciertos.

## Decisión

### 1. El principio organizador

**La unidad de análisis es el encuentro, no la persona.** Cada vez que el
operativo visita un curso-horario, se produce un encuentro con cada estudiante
matriculado en él. Un estudiante presente en dos cursos-horario de la muestra
genera **dos** encuentros, con resultados que pueden ser distintos.

Esto no es un matiz: es la razón por la que «ausente» no puede leerse como «no
alcanzado». Quien faltó a una sesión puede haber respondido en otra.

**Cada encuentro termina de una sola manera.** El vocabulario se construye
sobre esa taxonomía —exhaustiva y mutuamente excluyente—, no sobre los
registros del formulario.

| Resultado | Qué pasó en ese encuentro | ¿Deja registro? |
|---|---|---|
| **efectiva** | Abrió la encuesta y llegó al final | Sí, completo |
| **no efectiva** | Abrió la encuesta y la cerró: no quiso seguir | Sí, incompleto |
| **no realizada** | Estuvo en el aula y nunca abrió la encuesta | **No** |
| **ya medida** | Ya había respondido en otro encuentro | Sí, en el otro encuentro |
| **no elegible** | No pertenecía al estudio | Sí, cortado en el filtro |
| **ausente** | No estuvo en esa sesión | **No** |

Solo `efectiva` suma a la meta.

`no realizada` y `ausente` existen únicamente porque el aplicador los contó: no
hay rastro de ellos en el formulario. `no realizada` incluye tanto a quien
declinó de viva voz como a quien simplemente no lo hizo.

**`ausente` es un resultado del encuentro, nunca un atributo del estudiante.**
Cualquier superficie que agregue ausencias debe decir «ausencias», no
«estudiantes no alcanzados»: sin identificador de estudiante esa segunda
lectura no es calculable.

### 2. Por qué `ya medida` y `no elegible` salen del denominador

Un **rechazo** (`no efectiva`) es alguien que podía responder y no quiso: es una
pérdida, y su tasa dice algo sobre cómo se presentó la encuesta.

Un **no elegible** es alguien que no pertenecía al estudio. Contarlo como
pérdida haría que un aula con muchos alumnos de primer ciclo parezca mal
trabajada cuando no lo fue: si en un aula de 30 hay 2 de primer ciclo, la meta
era sobre 28, no sobre 30.

Una **ya medida** tampoco es una pérdida: esa persona ya cumplió, en otra aula.
Contarla dos veces sería duplicarla.

Por eso el denominador del trabajo de campo se construye en dos pasos: primero
se separa a quienes pertenecen al estudio, después se descuenta a quienes ya
respondieron en otro encuentro.

```
asistentes
  − presentes_no_elegibles
  ────────────────────────
  = asistentes_elegibles       ← estaban y pertenecían al estudio
  − ya_medidas
  ────────────────────────
  = elegibles_presentes        ← además, aún no habían respondido
```

Y sobre él, tres resultados que suman 100 %:

```
elegibles_presentes = efectivas + no_efectivas + no_realizadas
```

### 3. Glosario canónico

**Marco**

| Término | Significado |
|---|---|
| `curso_horario` | Unidad de muestreo |
| `matriculados` | Todos los inscritos en el curso-horario |
| `elegibles` | Matriculados del aula que cumplen el criterio de inclusión |
| `poblacion_objetivo` | **Personas únicas** elegibles del estudio (N) |
| `poblacion_n` | **Reservado**: el N del cálculo de tamaño muestral |

`poblacion` a secas queda prohibido como sinónimo de `elegibles`.

**`elegibles` y `poblacion_objetivo` no son la misma magnitud y no se suman
entre aulas.** `elegibles` es un atributo del aula: sumarlo sobre el marco
cuenta a cada estudiante tantas veces como aulas del marco tenga. En PUCP 2025
la suma da **34 541** contra una población objetivo de **22 234** personas:
**1.55 aulas por alumno**. Esa razón *es* el traslape del marco, medido desde
el diseño y no desde el campo. Cualquier superficie que presente la suma de
`elegibles` como «la población» está inflándola en un 55 %.

**Aula**

| Término | Significado |
|---|---|
| `asistentes` | Todas las personas presentes, elegibles o no |
| `asistentes_elegibles` | Presentes que **sí** pertenecen al estudio |
| `presentes_no_elegibles` | `asistentes − asistentes_elegibles` |
| `ausentes_elegibles` | `elegibles − asistentes_elegibles` · ausencias, no personas |
| `ya_medidas` | Presentes elegibles que ya respondieron en otro encuentro |
| `elegibles_presentes` | `asistentes_elegibles − ya_medidas` |
| `efectivas` | Abrieron la encuesta y la completaron |
| `no_efectivas` | Abrieron la encuesta y la cerraron sin completarla |
| `no_realizadas` | Estuvieron en el aula y nunca abrieron la encuesta |
| `registros` | Derivado: lo que llegó al formulario |

**Tasas**

| Término | Fórmula | Se lee |
|---|---|---|
| `asistencia_elegibles` | `asistentes_elegibles / elegibles` | De los que nos interesan, cuántos vinieron |
| `efectividad` | `efectivas / elegibles_presentes` | De los que podían responder, cuántos respondieron |
| `tasa_rechazo` | `no_efectivas / elegibles_presentes` | Cuántos abrieron y no quisieron seguir |
| `tasa_no_realizacion` | `no_realizadas / elegibles_presentes` | Cuántos no la abrieron |
| `rendimiento` | `efectivas / elegibles` | Producto final sobre el marco |
| `pct_ya_medidas` | `ya_medidas / asistentes_elegibles` | Intensidad del traslape en ese encuentro |
| `asistencia_bruta` | `asistentes / matriculados` | Diagnóstico operativo del aula, no del estudio |

`efectividad`, `tasa_rechazo` y `tasa_no_realizacion` suman 1 por construcción.

**Queda prohibido `asistentes / elegibles`.** Mezcla universos —numerador con
no elegibles, denominador sin ellos— y produce valores imposibles: en la base
de 2025 da más de 100 % en 31 de 194 aulas, con un máximo de 230 %. La única
asistencia interpretable como tasa del estudio es `asistencia_elegibles`, y
está acotada a 1 por construcción.

**`asistentes_elegibles` debe medirse en campo.** Cuando el operativo solo
cuenta cabezas, la cantidad no es observable y **no se publica un valor
puntual**: se publican `asistencia_elegibles_min` y `asistencia_elegibles_max`.
La cota inferior son las efectivas confirmadas; la superior es
`min(asistentes − no_elegibles_detectados, elegibles)`. Para la base de 2025 el
intervalo es 53.0 % – 74.0 %.

Quedan retirados los tramos `completitud`, `validez` y `producto`, y el término
`iniciadas` que un borrador previo de este ADR había propuesto.

**Cumplimiento** — `cuota`, `cobertura` y `meta` conservan sus nombres, pero
**la meta es del estudio y de la facultad, no del aula**: el diseño fija un n de
encuestas y lo reparte por afijación, nunca exige un porcentaje a cada aula (ver
Anexo). Toda superficie que muestre «cumple / no cumple» a nivel aula debe
declarar contra qué umbral compara y de dónde salió ese umbral.

**Identidades de cierre**

```
elegibles            = asistentes_elegibles + ausentes_elegibles
asistentes           = asistentes_elegibles + presentes_no_elegibles
asistentes_elegibles = ya_medidas + elegibles_presentes
elegibles_presentes  = efectivas + no_efectivas + no_realizadas
```

**Solo en prosa, nunca como campo**

- **traslape del marco**: un elemento pertenece a varias unidades de muestreo.
  Es una propiedad del diseño; existe antes de salir a campo.
- **agotamiento del marco**: cómo crece el traslape conforme avanza el campo.
  Es una propiedad de la ejecución.

Queda **prohibido «desgaste»**: en encuestas designa la pérdida de unidades
entre olas de un panel, y sugiere deterioro del equipo. La evidencia de 2025
muestra lo contrario — la conversión sobre las personas aún no medidas fue
72.2 % en el primer tercio del campo y 72.1 % en el último. Se agotó el marco,
no el rendimiento.

### 4. Los filtros de corte se declaran; su clase no

Un estudio declara cuántos filtros tiene, cómo se llaman, qué columna los
produce, qué condición los dispara y en qué orden. **Lo único que el motor
interpreta —y por tanto lo único cerrado— es la clase**, que determina en qué
resultado cae la persona.

```yaml
filtros_corte:
  - id: consent_participacion
    etiqueta: "No quiso participar"
    columna: consent_1
    condicion: "== 2"
    clase: rechazo
    origen: formulario
    orden: 1
```

| Clase | Resultado de la persona | ¿En el denominador? |
|---|---|---|
| `rechazo` | `no_efectiva` | **Sí** |
| `abandono` | `no_efectiva` | **Sí** |
| `no_elegible` | `no_elegible` | No |
| `ya_medido` | `ya_medida` | No |

`origen` ∈ `campo` · `formulario` indica de dónde viene el dato. Un mismo
fenómeno puede medirse por las dos vías —el aplicador cuenta los repetidos, o
el formulario los pregunta— y **no se suman**: descontarlos dos veces destruye
`elegibles_presentes`.

### 5. El contrato migra a v2

`calc_muestra_referencia_asistencia_v1` no admite ni los renombres ni el
catálogo de filtros. Se emite v2 con ambos cambios en un solo movimiento.

Los alias de **entrada** en `.cm_asist_column_aliases()` conservan los
encabezados históricos: una base de 2025 debe seguir cargando sin edición
manual. El glosario gobierna los nombres internos y de salida, no lo que el
usuario trae en su archivo.

## Formato de la base histórica

Una base histórica describe **un estudio entero**, no sólo su campo. Antes el
diseño tenía que llegar por fuera de la base, y un estudio que nadie declarara
perdía la lectura que explica cómo llegó a su número de aulas: el dato existía
en la cabeza de quien lo hizo y en ningún archivo.

El formato es un libro con dos hojas. Es el mismo para leer y para publicar: lo
que la app exporta de un estudio es lo que la app sabe volver a leer.

### Hoja `referencia` — una fila por curso-horario

Llave `curso_horario`, única. Obligatorias: `estado_aplicacion`,
`matriculados`, `asistentes`, `registros`, `efectivas`, `no_respondieron`,
`rango_horario`, `facultad`, `tipo_sesion`.

Opcionales, cada una habilita una lectura y su ausencia sólo la desactiva:

| Grupo | Columnas | Qué habilita |
|---|---|---|
| Glosario del encuentro | `elegibles`, `ya_medidas`, `no_elegibles`, `no_efectivas`, `rechazos_en_aula` | el embudo sobre elegibles en vez de matrícula |
| Criterios del curso-horario | `condicion_curso`, `nivel_curso`, `tipo_docente`, `modalidad` | composición y embudo por criterio |
| Operativo | `semana`, `cadena`, `posicion`, `rol`, `rol_detalle`, `motivo_no_aplicacion` | serie semanal y matriz de titulares y reemplazos |
| Contexto | `hora_inicio` | el rango horario dice de qué hora a qué hora |

Las filas no aplicadas **sí van** en la hoja: son el dato de la matriz de
cadenas. El motor las excluye de las tasas por `estado_aplicacion`.

### Hoja `diseno` — dos columnas, `campo` y `valor`

Dos columnas y no una fila ancha porque así el formato crece sin romper: un
estudio que declare un campo nuevo agrega una fila, y una base que no lo traiga
se sigue leyendo igual. Un campo que el motor no conoce se ignora en vez de
invalidar la hoja, porque una base puede documentar más cosas de las que un
motor concreto lee.

`poblacion_objetivo`, `nivel_confianza`, `proporcion_esperada`, `margen_error`,
`deff`, `muestra`, `ratio_sobremuestra`, `sobremuestra`, `aulas_marco`,
`aulas_dimensionadas`, `aulas_aplicadas`, `tasa_respuesta_asumida`,
`afijacion`, `metodo_seleccion`, `metodo_ajuste`, `ponderado`.

Precedencia cuando hay más de una fuente: lo que manda el cliente gana (está
corrigiendo a mano), después lo que declara la base, y al final lo que quedó en
el workspace.

### Hoja `cuotas` — una fila por facultad

`facultad | cuota_total | cuota_mujeres | cuota_hombres`. Una hoja propia
porque el grano es la facultad: no cabe en `referencia`, que va por
curso-horario, ni en `diseno`, que son cifras únicas del estudio.

Con ella se calcula **cumplimiento de cuota**, que NO es efectividad y no debe
llamarse así. La efectividad divide completas entre las personas a las que
tocaba encuestar, y su denominador es una población observada. Aquí el
denominador es la cuota, que es una decisión del diseño, así que el resultado
puede pasar del 100 %: en 2025 las mujeres cerraron en 143 % y los hombres en
122 %. Confundirlas sería exactamente el error que este ADR vino a corregir.

Es la lectura que explica una ponderación. En 2025, Estudios Generales Letras
fue la única facultad donde los hombres no llegaron a su cuota (92 %, 166 de
180) mientras sus mujeres cerraban en 115 %.

### Lo que NO se puede calcular

**Efectividad por sexo a nivel de curso-horario.** Haría falta el denominador
por sexo en cada aula —cuántas mujeres y cuántos hombres elegibles había— y eso
nadie lo observa. Lo que sí se puede publicar por curso-horario es la
**composición** de sus completas, y así se nombra.

## Consecuencias

**Las tasas publicadas cambian, y es correcto.** Con el denominador de
`elegibles_presentes`, la efectividad de 2025 es 74.6 % (3303 de 4425). El
tablero original reportaba razones sobre matrícula o sobre asistentes sin
descontar traslape ni inelegibles. Todo material que cite las cifras viejas
debe reeditarse o fecharse.

**Hay una migración de `.pulso`.** Los proyectos que ya guardaron una
referencia v1 necesitan lectura de compatibilidad. Se acepta el costo porque el
catálogo de filtros obliga a v2 de todos modos.

**El motor deja de asumir la forma del instrumento.** Un formulario con dos
filtros, o siete, o ninguno, se declara sin tocar R. El costo es que un
catálogo mal clasificado produce tasas mal calculadas, y el motor solo puede
detectarlo por las identidades de cierre.

**La taxonomía exige un conteo de campo que 2025 no siempre tuvo.** Cierra
exacto en el agregado, pero en 43 de 194 aulas hay más registros que personas
contadas —`1MAT08-0304` reporta 53 asistentes y 61 registros—. El modelo es
correcto; el dato de campo no lo soporta aula por aula. Para estudios nuevos,
`no_realizadas` solo es confiable si el aplicador cuenta bien.

**`no_realizadas` es un residual y hay que tratarlo como tal.** Nadie la cuenta:
sale de restar `efectivas` y `no_efectivas` a `elegibles_presentes`. Por eso su
identidad de cierre se cumple por construcción, no por verificación — el mismo
defecto que este ADR le reprocha a `TOTAL LARGAS = ENVIADAS − CORTAS` en la
base de 2025. La consecuencia es visible: el total de 787 en 2025 es una **neta**
que compensa 892 positivas contra **−105 imposibles** repartidos en 43 aulas.
Regla: **un `no_realizadas` negativo no se publica**, se marca. Y mientras el
campo no cuente ausencias directamente, esta cifra es una estimación, no una
medición.

**`elegibles_presentes` de 2025 está inflado y la efectividad es una cota
inferior.** Solo se detectaron los no elegibles que abrieron el formulario (60);
los que nunca lo abrieron quedaron dentro del denominador. En 26 aulas se puede
demostrar que hay presentes no elegibles sin detectar —al menos 318 personas en
total—. Por eso el 74.6 % de efectividad debe leerse como «no menos de», no
como valor puntual. La imputación no lo resuelve: aplicando la prevalencia
observada de no elegibles (1.62 %), 28 aulas siguen dando asistencias
imposibles, lo que indica presencia de personas fuera de la matrícula del
curso —oyentes, otra sección, o marco desactualizado—.

**El operativo tiene un requisito nuevo.** Para que `asistencia_elegibles` sea
un dato y no un intervalo, el aplicador debe registrar cuántos de los presentes
son elegibles, o el formulario debe capturar un identificador que permita
resolverlo después. Sin eso, ningún estudio futuro podrá publicar esa tasa.

**«Población» pierde un uso y gana precisión.** Los `poblacion` restantes del
frontend se revisan uno por uno: los que signifiquen «elegibles» se renombran,
los que signifiquen el N del cálculo se conservan. Un reemplazo global sería un
error.

## Cumplimiento

1. **Taxonomía cerrada, verificada en el motor.** Una `clase` fuera de las
   cuatro admitidas falla con `stop_api` y código `E_*` registrado en
   `errors_registry.R`. No hay ruta silenciosa.
2. **Las cuatro identidades de cierre tienen test** en testthat, sobre la base
   de referencia real. La de `elegibles = asistentes_elegibles +
   ausentes_elegibles` solo se exige cuando el campo registró elegibilidad.
3. **Las tres tasas de resultado suman 1.** Test con tolerancia de redondeo.
4. **`asistencia_elegibles` nunca excede 1.** Un valor mayor es un defecto de
   fórmula, no un dato; el test falla. Y cuando `asistentes_elegibles` no fue
   observado, el motor publica el intervalo y **no** un valor puntual.
5. **`asistentes / elegibles` no aparece en el código.** Ninguna superficie
   divide presentes totales entre elegibles.
6. **`ausente` nunca se rotula como persona.** Las etiquetas visibles dicen
   «ausencias» o «ausencias de elegibles», nunca «estudiantes no alcanzados».
7. **No hay doble descuento de `ya_medida`.** Test que declara el mismo
   fenómeno por `origen: campo` y `origen: formulario` y verifica que
   `elegibles_presentes` se calcula una sola vez.
8. **Validaciones del catálogo de filtros:** la columna declarada existe; la
   cascada respeta `orden`; ningún registro cae en dos filtros.
9. **Test de contrato del glosario.** Los términos retirados no aparecen como
   identificadores en el código de `calcMuestra`:
   `rg -n '\b(largas|cortas|validas|enviadas|iniciadas|completitud|validez)\b'`
   acotado a `api/R/calc_muestra_*.R` y `frontend/src/features/calcMuestra/` no
   devuelve nombres de campo. Los alias de entrada quedan exceptuados.
10. **`poblacion` solo sobrevive como `poblacion_n`.** Cualquier otro
   identificador con `poblacion` en `calcMuestra` se justifica en revisión o se
   renombra.
11. **La compatibilidad v1 tiene test.** Un `.pulso` con referencia v1 abre sin
   pérdida y sus cifras se reexpresan en el vocabulario v2.

## Anexo · Términos del diseño muestral que este ADR NO define

Los siguientes son propiedad de la documentación metodológica citada arriba. Se
listan para que el vocabulario del embudo no los contradiga:

| Término | Qué es | Qué NO es |
|---|---|---|
| **muestra** | El n de encuestas objetivo (2 500 en 2025) | No es un número de aulas |
| **sobremuestra** | Encuestas extra, ×1.5 sobre la muestra (3 750) | **No es un aula extra.** Llamar «sobremuestra» a un aula adicional es un error |
| **cascada M01–M12** | Reemplazos activables si el aula titular falla | No es la sobremuestra |
| **bolsa operativa** | Aulas de margen para incidencias | No cambia el tamaño muestral |
| **afijación proporcional** | Reparto de la muestra por facultad × sexo según peso poblacional | — |
| **deff** | Penalización por muestrear conglomerados (2.0 en 2025) | — |
| **ponderación (W)** | Post-estratificación para restituir las proporciones poblacionales | No es un peso de diseño: el diseño es proporcional. Se necesita cuando el **resultado** no reprodujo la afijación planeada |

**Tres consecuencias operativas de este anexo:**

1. **El «70 % por aula» no pertenece al diseño.** El método dimensiona con
   `aulas = CEIL(sobremuestra / estudiantes_por_aula)` y nunca exige que un aula
   individual alcance el 70 % de sus elegibles. El 0.704 verificable en 2025 es
   la tasa de respuesta implícita del dimensionamiento **agregado**. El umbral
   `70P` / `VALIDO POBLACIÓN` de la Base de control es una construcción del
   tablero operativo, no un criterio metodológico, y no debe transferirse como
   ancla ni presentarse como «aulas que cumplen».

2. **No hay pesos de diseño que rescatar, pero sí hubo ponderación.** Son dos
   cosas distintas y conviene no confundirlas.

   La columna `probabilidad` del marco 2025 es el aleatorio de ordenamiento del
   muestreo sistemático —uniforme en [0,1], correlación 0.004 con el tamaño del
   aula, suma 545.6 sobre 1 097 aulas—, no una probabilidad de inclusión.
   `1/probabilidad` no es un peso de diseño y no debe publicarse como tal.

   Pero el diseño es autoponderado **solo si el resultado reproduce la
   afijación**, y en 2025 no la reprodujo:

   - **La celda EE.GG. Letras × hombres es la única que no alcanzó su cuota**:
     meta 180, logradas 166. Las otras 29 celdas (15 facultades × 2 sexos) la
     superaron.
   - El sobrecumplimiento fue **desigual**: mujeres al 143 % de su meta,
     hombres al 122 %. La muestra lograda quedó en **52.7 % de mujeres contra
     48.8 % planeado — 3.9 puntos de desvío**.
   - Por facultad, el peso relativo también se movió: EE.GG. Letras cae 3.5 pp
     bajo su peso planeado y Ciencias Sociales sube 1.8 pp.

   El ajuste que se aplicó no fue una post-estratificación clásica sino un
   **recorte a la meta con peso solo donde faltó**
   (`Adaptacion_SPSS.qmd::ajustar_a_meta_fac_sexo`), por celda facultad × sexo y
   clasificando por **facultad autodeclarada (P7)**, no por la del curso:

   ```
   si n_celda ≥ meta → recorte aleatorio sin reemplazo hasta la meta, peso = 1
   si n_celda < meta → se toma todo,        peso = meta / n_celda
   ```

   Resultado en 2025: **28 de 30 celdas con peso 1**; solo EE.GG. Letras lleva
   peso — hombres **1.1538** (180/156) y mujeres **1.0119** (255/252).

3. **El estudio tiene dos bases, y no son intercambiables.** El recorte descarta
   830 casos: la base analítica queda en **2 473 registros que ponderan a
   2 500**, no en las 3 303 efectivas.

   | Uso | Base | Tamaño |
   |---|---|---|
   | Tasas de campo (asistencia, efectividad, traslape) | efectivas sin ajustar | 3 303 |
   | Prevalencias y composición publicadas | ajustada y ponderada | 2 473 → 2 500 |

   Mezclarlas produce cifras que no reconcilian con nada. La pestaña Histórico
   transfiere tasas **operativas**, así que usa la primera; cualquier superficie
   que muestre prevalencias de 2025 debe usar la segunda y decir que es
   ponderada.

## Notas

- El análisis que originó esta decisión comparó la Base de control 2025 contra
  el export completo de Kobo (3709 respuestas). Documentó, entre otros, que
  `TOTAL LARGAS` se calcula por resta y no por conteo; que 446 personas ya
  medidas y 219 rechazos registrados en campo nunca entraron al tablero; y que
  la caída de efectividad a lo largo del campo desaparece al medir sobre las
  personas aún no medidas.
- La distinción `rechazo` / `no_elegible` sigue la convención AAPOR de tasas de
  respuesta: los casos no elegibles salen del denominador.
- Pendiente de decidir en su momento: si el motor debe publicar la tasa de
  agotamiento como ancla transferible además de las cuatro dimensiones actuales
  (`tamano`, `rango_horario`, `facultad`, `tipo_sesion`).
