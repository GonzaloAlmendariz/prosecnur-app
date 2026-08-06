# ADR 0064: El enunciado vive en la diapositiva, no dentro de cada etiqueta

Estado: Aceptada

Implementacion: En curso

Fecha: 2026-08-06

Fecha de decision: 2026-08-06

Reemplaza: —

Enmienda: ADR 0062 (la forma de la declaración; su decisión —declarar, no
adivinar— se conserva entera), ADR 0063 (el mazo derivado gana título)

Relacionados: ADR 0061 (la config de Analítica pertenece a su base), ADR 0043
(Acreditación Contabilidad como proyecto de referencia donde se mide este caso)

## Contexto

El ADR 0062 dio a la equivalencia entre públicos una forma plana: una fila por
pregunta, con `etiqueta_estandar`, la variable de cada base, `seccion` y
`diapositiva`. La forma funciona y el motor la consume. Lo que falla es el
reparto de trabajo entre sus campos.

**Un solo campo de texto hace tres trabajos.** La `etiqueta_estandar` tiene que
identificar la pregunta, distinguirla de sus hermanas y titular la barra del
gráfico. En Acreditación Contabilidad los tres chocan de frente: las mismas
cuatro prestaciones aparecen en tres preguntas distintas —«¿Conoce?», «¿Ha
utilizado?», «¿Qué tan satisfecho?»— y el XLSForm etiqueta las doce variables
sólo con el nombre de la prestación. Tres columnas se llaman, literalmente,
«Servicio de salud».

La enmienda del 0062 respondió a eso prohibiendo prellenar cualquier etiqueta
repetida. Es correcto dado el modelo, y caro: deja al analista escribiendo a
mano el enunciado dentro de cada etiqueta —«Conoce – Servicio de salud», «Ha
utilizado – Servicio de salud»— doce veces en este bloque, 152 en el estudio.

**El enunciado no es un campo nuevo: es el que el importador pierde.** El
formulario original tiene «¿Conoce los siguientes servicios?» como enunciado de
matriz y «Servicio de salud» como tema; `surveymonkey_api.R`, rama
`fam == "matrix"`, aplana los dos en uno. La ambigüedad que motiva la
prohibición y el texto que falta son la misma pieza.

**Medido sobre la matriz real del equipo** (`Matriz.xlsx`, 152 filas útiles):

| Observación | Dato |
|---|---|
| Filas con ≥2 públicos | 82 (54 %) |
| Filas con diapositiva asignada | 133 → **44 diapositivas**, 42 con más de una pregunta |
| Diapositivas de **cobertura mixta** (un tema de 1 público junto a uno de 4) | **25 de 44 (57 %)** |
| Secciones | 13 dimensiones de acreditación; la única sin diapositiva es «Datos generales» (19 filas) |

La cobertura mixta no es una excepción: es la mayoría. El caso canónico es
«Servicio de empleabilidad», que sólo existe en estudiantes y comparte diapositiva
con tres prestaciones que existen en los cuatro públicos.

**Dos defectos concretos del estado actual:**

1. **`seccion` es un campo fantasma.** Se lee del Excel con relleno hacia abajo,
   se guarda, se serializa en el router — y no lo consume nadie. Ni el editor la
   muestra ni el mazo la usa.
2. **Las 44 diapositivas derivadas salen sin título.**
   `.graficos_plan_desde_equivalencias` emite `titulo = ""`. Cada *tema* lleva su
   etiqueta estándar como título de grupo; la diapositiva, nada.

**Sobre proponer la agrupación.** Uniendo temas por raíz de nombre dentro de
cada público (union-find sobre `p13_1`/`p13_2`/`p13_3` → `p13`) salen 27
baterías del instrumento: **33 de las 44 diapositivas son exactamente una batería**,
11 juntan dos, y las baterías largas —una de 25 temas, otra de 20— el analista
las **parte** en varias diapositivas. La batería del instrumento informa la diapositiva;
no la determina.

## Decision

**La declaración gana un nivel. El enunciado sube a la diapositiva, y la etiqueta
estándar baja a ser el nombre corto del tema dentro de ella.**

```
Sección          dimensión del informe    «2.1 Estructura organizacional…»
└── Diapositiva       enunciado + escala       «¿Conoce los siguientes servicios?»  [Sí/No]
    └── Tema     etiqueta estándar        «Servicio de salud»
        └── por público → variable        docentes p13_1 · estudiantes p11_1 · …
```

1. **Una pregunta suelta es una diapositiva de un tema.** Sin caso especial y sin
   segunda forma: su enunciado es su etiqueta. El modelo tiene un solo camino.

2. **La diapositiva lleva enunciado, y ese enunciado titula la diapositiva del mazo.**
   Cierra el `titulo = ""` del ADR 0063 con el texto que el analista ya tiene que
   escribir una vez, en vez de doce.

3. **La etiqueta estándar sólo debe ser única dentro de su diapositiva.** Esto revoca,
   con causa, la regla de la enmienda del 0062 que prohíbe prellenar etiquetas
   repetidas: la ambigüedad que la motivaba la resuelve el enunciado.
   «Servicio de salud» vuelve a ser un nombre válido en las tres diapositivas, porque
   cada diapositiva dice de qué habla. La prohibición se conserva **dentro** de una
   diapositiva, donde dos temas con el mismo nombre son dos barras indistinguibles.

4. **La escala no se escribe: se deriva y se sella.** La toma de la primera
   variable asignada al tema, con la firma que ya calcula `.equiv_firma_escala`.
   Es una consecuencia del modelo, no un campo del formulario, y por tanto no
   puede quedar desfasada respecto de lo declarado.

5. **Dos invariantes de escala, de dureza distinta.**
   - **E1 — dentro de un tema**: las variables de los distintos públicos comparten
     firma. **Dura**: si se rompe, no es el mismo indicador.
   - **E2 — dentro de una diapositiva**: los temas comparten firma. **Blanda**: si se
     rompe, la diapositiva se apila con `multilista`, que ya existe y ya está probado.

6. **La divergencia de escala se marca, no se bloquea.** El selector ofrece
   primero las variables compatibles; si el analista elige una que diverge, la
   asignación **procede** y el tema queda marcado con las dos firmas a la vista.
   La divergencia real existe y es un hallazgo: «¿Cuántos años tiene?» tiene
   rangos distintos en docentes (18–51+) y egresados (22–36+). Bloquearla
   escondería el dato que el analista necesita ver.

7. **La sección se consume o se retira del formato.** Un campo que se pide, se
   guarda y no lo lee nadie es deuda con apariencia de función. Pasa a ordenar la
   pila del editor y a viajar al mazo como agrupador. Si al implementarlo no
   encuentra consumidor, sale del formato en vez de quedarse.

8. **La agrupación en diapositivas se propone; no se resuelve.** La detección por
   raíz (33 de 44) llega como propuesta marcada, se parte y se renombra. Hereda
   el invariante del 0062: **una propuesta sin confirmar no se guarda.**
   Ofrecerla como algo que se acepta en bloque reintroduciría exactamente lo que
   el 0062 prohíbe.

## Consecuencias

**A favor**

- El texto que el analista escribe cae de doce frases largas a tres enunciados y
  cuatro nombres cortos, en el bloque medido. La reducción viene de dejar de
  repetir el enunciado dentro de cada etiqueta, no de adivinar nada.
- El prellenado de etiquetas se desbloquea sin reintroducir ambigüedad, porque la
  unicidad pasa a ser local.
- **E1 se comprueba al asignar, no al generar el mazo.** Hoy una escala divergente
  se descubre cuando la diapositiva desaparece del PPT con `escala_divergente` en
  `fuera[]`; con la regla al asignar, se ve donde se produce.
- Las 44 diapositivas derivadas dejan de salir sin título.
- La cobertura mixta —57 % de las diapositivas reales— deja de ser un caso que el
  modelo tolera y pasa a ser uno que expresa: la cobertura es del tema, la escala
  es de la diapositiva.

**En contra, y asumido**

- **Es un nivel más de estructura**, y por tanto una decisión más que tomar: a qué
  diapositiva va cada tema. Se acepta porque esa decisión ya se estaba tomando —133
  veces, tecleando un número en una celda— sin que el modelo la representara.
- **Rompe el formato de la plantilla que emitimos.** Se acota con la
  compatibilidad de lectura (ver Notas): las matrices ya escritas entran sin
  editar una celda.
- **La propuesta de agrupación acierta dos tercios.** Las baterías largas exigen
  criterio editorial que ninguna heurística tiene. Se declara en la UI en vez de
  presentarse como resuelto.

**Invalidado por esta decisión**

- Que la `etiqueta_estandar` tenga que ser única en todo el estudio.
- La diapositiva como número tecleado fila por fila.
- Diapositivas derivadas sin título.
- Un campo de la declaración que nadie consume.

## Cumplimiento

- **E1**: un tema con variables de firmas distintas se reporta con las dos firmas
  y la asignación **no** se bloquea — el guard directo contra convertir el
  hallazgo de los rangos de edad en un error de captura.
- **E2**: una diapositiva con temas de firmas distintas produce `multilista`; con una
  sola firma, `var_cruce`. Ya cubierto; se amplía al grano nuevo.
- **E3**: dos temas con la misma etiqueta **en la misma diapositiva** se reportan; los
  mismos dos **en diapositivas distintas** no. Es el caso que hace útil la regla 3.
- **Compatibilidad**: la matriz real de hoy —`Diapo` numérica, sin columna
  `Enunciado`— importa y produce 44 diapositivas sin enunciado, y ninguna fila se
  pierde.
- **Título del mazo**: el enunciado llega a `payload$titulo`; una diapositiva sin
  enunciado sigue generándose, con título vacío como hoy.
- **Propuesta**: una agrupación propuesta y no confirmada no se guarda.
- **Sobre estudio real**: reimportar `Matriz.xlsx` de Acreditación Contabilidad y
  comprobar 152 temas, 44 diapositivas, las 25 de cobertura mixta intactas y las 13
  secciones con su reparto de diapositivas.

## Notas

**Formato de la plantilla.** Una fila por tema; `Sección`, `Diapositiva` y `Enunciado`
en celdas combinadas —el relleno hacia abajo del 0062 ya las resuelve—; `Escala`
como columna **derivada**, que la app emite para que se lea y **ignora** al
importar; y por cada base la columna de variable más la de etiqueta de sólo
lectura, como hasta ahora.

**Compatibilidad de lectura.** `Diapo` / `diapositiva` se sigue leyendo como
`Diapositiva`: un número es un nombre de diapositiva perfectamente válido. La matriz que el
equipo mantiene hoy entra sin editar una celda y queda con 44 diapositivas llamadas
«1», «3», «6»…, a las que se les pone enunciado cuando se quiera. La migración es
un alias, no una conversión.

### Dónde encaja en la red de decisiones

- **ADR 0062** conserva su decisión entera —la equivalencia se declara, no se
  adivina— y sus reglas 1, 2, 4, 5, 6, 7 y 8. Lo que este ADR cambia es el
  reparto de trabajo entre los campos de esa declaración, y revoca una sola regla
  de su enmienda: la que prohíbe prellenar etiquetas repetidas, que deja de tener
  objeto cuando el enunciado desambigua.
- **ADR 0063** gana lo que le faltaba: el mazo derivado tenía dónde poner el
  título y no tenía de dónde sacarlo.
- **ADR 0061** sigue siendo la precondición. La etiqueta estándar —ahora la del
  tema— se escribe en `analitica_config_por_base[[base]]` y nunca en la global.
  Este ADR no toca esa regla y depende de ella igual que el 0062.
- **`surveymonkey_api.R`, rama `fam == "matrix"`**, deja de ser sólo el origen del
  problema y pasa a ser el prellenador natural del enunciado: si conservara el
  texto de la matriz en una columna propia del survey, la diapositiva llegaría con su
  enunciado puesto. Sigue siendo trabajo aparte, y ahora tiene un consumidor
  concreto que lo justifica.

## Enmienda — 2026-08-06: lo que cambió al implementarlo

**Vocabulario.** La unidad dentro de una diapositiva se llama **tema**, que es
como ya la nombra el graficador de multi-apiladas (`tema_1`, `titulos_grupo`), y
el contenedor se llama **diapositiva**, no lámina. El modelo queda:

```
Sección → Diapositiva (enunciado + escala) → Tema (etiqueta estándar) → variable por público
```

**Regla 9 — una propuesta se guarda marcada; lo que no hace es surtir efecto.**
La regla del ADR 0062 —descartarla al guardar— era correcta mientras las
propuestas sólo nacían de un clic. Con la plantilla sembrada destruye trabajo:
confirmar diez de ochenta y dos y pulsar Guardar borraba las otras setenta y dos
sin ninguna señal. Lo que la prohibición protege —que una sugerencia nunca actúe
como decisión— se cumple ahora en los dos sitios donde importa, y no en el
guardado: una propuesta **no escribe etiquetas** en `analitica_config_por_base` y
**no llega al mazo** (`fuera`, motivo `sin_confirmar`).

**Regla 10 — una fila que no decide nada no bloquea una propuesta.** Una fila con
una sola variable, sin etiqueta estándar y sin diapositiva no declara nada: es la
misma información que «esta variable existe», que ya está en el instrumento. Una
propuesta puede absorberla. Una fila que empareja dos o más públicos, o que tiene
etiqueta o diapositiva, sí decide y es intocable.

Sin esta distinción la siembra quedaba muerta justo en el caso para el que se
escribió: el proyecto medido tenía guardada la plantilla vacía anterior —300
filas de una variable cada una—, así que **toda** propuesta chocaba y el archivo
salía otra vez con cero emparejados.

**Medido sobre Acreditación Contabilidad, ida y vuelta completa:**

| Paso | Resultado |
|---|---|
| Plantilla sembrada | **159 filas, 82 ya emparejadas** (antes: 300 sueltas, 0 emparejadas) |
| Cobertura de las filas | 1 público: 77 · 2: 39 · 3: 27 · 4: 16 |
| Reimportar la plantilla | 82 vuelven marcadas como propuesta · **0 etiquetas aplicadas** |
| Agrupación asistida | 159 temas → **53 diapositivas** |
| Confirmar y guardar | 0 propuestas pendientes · 159 temas declarados |
| Mazo derivado | **47 diapositivas**, 6 temas fuera (`no_graficable`) |

Las 82 filas emparejadas coinciden con las 82 de la matriz que el equipo mantenía
a mano, y su reparto por cobertura casi calca el suyo (1:70 · 2:37 · 3:28 · 4:17).

**Escalas: la caja no cuenta.** La firma normaliza la etiqueta de cada opción
—minúsculas, espacios colapsados— y compara el código literal. De 58 temas que
la firma declaraba divergentes entre públicos, **56 diferían sólo en mayúsculas**
(«Totalmente en desacuerdo» contra «Totalmente en Desacuerdo»). Los 2 reales son
el código PUCP —numérico en un público, texto en otro— y los rangos de edad. Con
la corrección el mazo pasó de 34 a 44 diapositivas sin tocar la declaración.
