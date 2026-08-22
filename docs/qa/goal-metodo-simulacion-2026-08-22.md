# GOAL — Método y Simulación se entienden solas

Doc vivo. Abierto el 2026-08-22. Sólo Gonzalo lo da por terminado.

## La vara, textual

Gonzalo, 2026-08-22, probando la app con HSVG2026_definitivo:

> «tanto comparar métodos como simulación son los elementos del front end que
> peor se ven […] si tú sigues bajando y sigues bajando, cada vez es menos claro
> qué cosa, cómo y el por qué […] no se entiende qué se está haciendo en cada una
> de las etapas y estéticamente tampoco se ve bien ni permite verlo».

Y sobre la jerga:

> «¿A qué se refiere con CV de pesos, qué es un puntaje de estabilidad, qué es
> sistemático por facultad, balance de cuotas y tamaños? Hay distintos mecanismos
> para medir el balance, hay distintos balances, no termino de entender».

**Una pestaña pasa cuando cumple LAS DOS:**

1. **Se entiende sin saber muestreo.** Cada cifra y cada bloque dicen qué mide,
   cómo se calcula y para qué sirve, en lenguaje que un coordinador de campo
   entienda. Ninguna sigla ni término técnico sin glosa. Si hay que preguntar qué
   significa algo, no pasa.
2. **Cada etapa tiene un solo propósito.** No hay dos bloques que respondan la
   misma pregunta, ni la misma cadena de riesgos repetida en dos pestañas, ni una
   comparación de métodos seguida de otra comparación de métodos.

## Estado medido el 2026-08-22

| Pestaña | Alto | Bloques |
|---|---|---|
| **Método** | **6,3 pantallas** | Cuatro maneras de construir la selección · Riesgos · Comparación de métodos de selección |
| **Simulación** | **3,7 pantallas** | Estabilidad de pesos · Resultados de la simulación · Riesgos |

Jerga presente sin glosa: **CV de pesos**, **estabilidad**, **sistemático**,
**balance de cuotas y tamaños**, **pivotal**, **cubo**.

Ambas pestañas repiten el bloque **Riesgos**.
Método compara métodos **dos veces**, con Riesgos en medio.

## Lo ya cerrado, NO lo rehagas

Commit `d87e5ac9`, 2026-08-22:

- Método y Simulación montaban la MISMA acción con el MISMO parámetro
  (`onCompare(config, simulation_runs ?? 500)`). Ahora Método compara con **cero**
  corridas de auditoría (una pasada por método, para elegir) y Simulación mide
  estabilidad con N corridas del método vigente.
- El botón de sortear dice con qué sortea: «Sortear con Optimizar repetidos».
- La semilla y el historial de corridas se agruparon en Selección, junto al botón
  que dispara el sorteo. **Van abiertos**: el contrato `cssHuerfano` prohíbe
  plegar en Aulas y nació de que un panel cerrado escondiera la semilla ahí mismo.

## Qué se hace con las 500 corridas (decidido: sólo explicarlo)

Hay dos bucles y **ninguno guarda las selecciones**:

- **Monte Carlo** (`calc_muestra_aulas.R` ~2725): cuenta cuántas veces sale cada
  aula y calcula la probabilidad de inclusión empírica π = veces/corridas con su
  error estándar. Eso alimenta los pesos 1/π.
- **Comparador** (~3803): corre N veces cada método y guarda `score_mean` y
  `score_sd`.

La selección que va a campo es **una corrida aparte** con la semilla declarada.

**Por qué NO se elige la mejor de las 500**, que es la pregunta de Gonzalo: si la
muestra se elige por su resultado, la probabilidad de inclusión deja de ser la
que declara el diseño, y como los pesos son 1/π, **los pesos empezarían a mentir**.
La versión legítima es el muestreo por rechazo, con criterios fijados de antemano
y π recalculadas. Decisión de Gonzalo el 2026-08-22: **no se implementa; se
explica en la UI qué se hace con las 500 y por qué no se elige la mejor**.

### Cuánto se ganaría eligiendo la mejor, medido

Gonzalo insistió, con razón: «si todas las selecciones aleatorias por cubo son
igual de válidas, por qué no puedo simular quinientas y escoger la que más me
beneficia». La premisa es correcta y el problema aparece al elegir: **la validez
es del procedimiento, no de la muestra**, y elegir cambia el procedimiento. Un
aula que ayuda a subir el score aparece más en las muestras ganadoras, así que su
probabilidad real deja de ser la π que declara el diseño, y los pesos 1/π pasan a
mentir.

Ocho sorteos del cubo con el mismo diseño y semillas distintas, sobre el marco
real (142 s):

| | score |
|---|---|
| peor | 49,1 |
| mediana | 52,2 |
| mejor | 54,8 |
| desviación estándar | 2,13 |

**La ganancia de elegir la mejor sobre la mediana es de +2,6 puntos sobre 100.**
Con 500 corridas subiría algo más, pero ése es el orden de magnitud.

Y hay un argumento que pesa más que el teórico: **ese score todavía no está bien
calibrado**. Es el mismo que subió de 43,4 a 51,1 el 2026-08-21 al corregir
contra qué referencia se medía, y su componente de facultad sigue en 25 con una
tolerancia de 2,5 puntos porcentuales que nadie ha revisado si es realista para
190 aulas con redondeo entero. Optimizar la muestra para maximizar un indicador
imperfecto elige la muestra que mejor engaña a la métrica.

## Tablero

| # | Etapa | Estado |
|---|---|---|
| M1 | Método y Simulación dejan de ser la misma acción | ☑ `d87e5ac9` |
| M2 | Semilla e historial junto al botón que sortea | ☑ `d87e5ac9` |
| M3 | Método deja de comparar dos veces | ☑ |
| M4 | Riesgos deja de repetirse en las dos pestañas | ☑ `eb562932` |
| M5 | La jerga se glosa: CV de pesos, estabilidad, sistemático, balance | ☑ los cuatro términos que nombró |
| M6 | La UI explica qué se hace con las 500 corridas | ☑ |
| M7 | Cada bloque declara qué mide, cómo y para qué | ◐ |
| M8 | Las dos pestañas bajan de 6,3 y 3,7 pantallas a algo legible | ◐ **Método 2,93** · **Simulación 1,49** |
| **M9** | **Pensar las dos pestañas de nuevo, no pulirlas** | ☐ **va al final** |

## Trampas del entorno, medidas

- **El worker de jobs usa el paquete instalado, no el fuente.** Sin
  `R CMD INSTALL` la app corre código viejo y no avisa. Medido hoy: el instalado
  tenía tres cambios y le faltaba el cuarto.
- **`innerText` devuelve el texto transformado por CSS.** Buscar «Semilla
  vigente» falla si la etiqueta se pinta en mayúsculas; buscar en `toUpperCase()`.
- **El puente JS del navegador corta a los 30 s**, aunque el bucle termine y deje
  su resultado en `window`.
- **El tab en segundo plano estrangula los timers**: ponerlo al frente antes de
  recorrer direcciones.

## Pendiente serio, sin diagnosticar

**El sorteo tarda más de 6 minutos desde la app y 22,8 s llamando al mismo motor
desde R.** Las configs son idénticas y `simulation_runs` es 0 en ambas, así que
no es lo que se pide sino el entorno del job. Hace la app inusable para iterar y
bloquea cualquier prueba de extremo a extremo.

## Cómo verificar

- Levantar con `node scripts/ui-quick-check.mjs --project <pulso> --route
  /calc-muestra --ir <dirección> --keep-servers` y navegar con
  `window.__pulsoNav.ir(...)`.
- Proyecto real: `HSVG2026_definitivo.pulso` del scratchpad de la sesión.
- Gate del área: `pnpm -C frontend exec vitest run
  src/features/calcMuestra/universidad` (1387 tests) y typecheck sin errores
  propios.

## M9 — la etapa que no es pulir

Gonzalo, 2026-08-22, en mitad del loop:

> «uno de los pasos finales no tiene que ser simplemente pulirlo, perfeccionarlo,
> sino pensar radicalmente si estas dos tabs se ven bien, qué agregar, qué
> mejorar, qué cosa o elemento de la interfaz usuaria agregar, mejorar,
> reestructurar, para que se vea lo mejor posible y sea lo más entendible
> posible».

M1–M8 corrigen defectos **dentro** de la estructura que ya existe: separar dos
acciones que eran una, dejar de repetir un bloque, glosar una sigla, declarar un
vacío. Ninguna preguntó si los bloques que hay son los bloques que debería haber.
M9 sí, y por eso va **al final**: pensar la estructura de nuevo con la jerga
todavía sin glosar sólo produce una estructura nueva igual de opaca.

Entra con tres preguntas, no con un rediseño: qué falta que hoy no está en
ninguna de las dos pestañas, qué está pero no se gana su espacio, y qué orden
haría que se leyeran solas de arriba abajo.

## Lo cerrado de M5, NO lo rehagas

- **«CV de pesos»** era una sigla sin glosa y su detalle decía «sobre el umbral
  de alerta (0,50)», que da por sabido qué implica cruzarlo. Ahora el rótulo
  nombra lo que mide —**Desigualdad entre pesos**— y el detalle dice qué pasa:
  «desiguales: pasa de 0,50, el punto donde conviene revisar».
- **«Puntaje de estabilidad · 100 = pesos parejos»** → **«Qué tan parejos son ·
  100 si todas las aulas pesaran igual»**.
- **La explicación del peso** hablaba en π y w_i antes de decir qué es un peso.
  Ahora empieza por el objeto real: cada aula representa a un número de aulas del
  marco, y ése es su peso.
- **«Resultados de la simulación» pintaba cuatro tarjetas con «0/0 corridas ·
  Simulación no solicitada»**: el mismo vacío repetido cuatro veces, sin decir
  qué lo llena. El motor devuelve una fila por método aunque no se hayan pedido
  corridas. Ahora, si ninguna corrió, el vacío se declara **una vez** y nombra el
  botón (C3). Simulación pasó de **2,2 a 1,17 pantallas**.
- **La barra de rango era muda.** Dibujaba p10–p90 sin decirlo. Lleva rótulo:
  «8 de cada 10 cayeron entre X e Y».

## Los siete balances, cerrado

Era el defecto que Gonzalo nombró textualmente —«hay distintos mecanismos para
medir el balance, hay distintos balances, no termino de entender»— y tenía dos
capas:

1. **La tarjeta ponía de eyebrow «BALANCE», idéntico en las siete**, y dejaba la
   dimensión —Facultad, Programa, Horario…—, que es lo ÚNICO que las distingue,
   en letra pequeña abajo. Lo repetido era lo prominente. El arreglo ya existía
   diez líneas más abajo en el mismo archivo: `agruparPorDimension` corrige
   exactamente eso para las filas de perfil, y por el mismo motivo.
2. **Ninguna decía contra qué se comparaba el puntaje.** Ahora la familia
   encabeza el grupo una vez con su glosa: «Qué tan parecido es el reparto de las
   aulas sorteadas al del marco completo. 100 sería idéntico».

Efecto lateral que vale: al dejar de repetirse el eyebrow apareció una **segunda
familia, Cobertura**, que estaba camuflada porque su rótulo era igual de mudo.

Coste medido y asumido: Simulación pasó de 1,17 a **1,29 pantallas**. Doce
centésimas de pantalla por dos frases que hacen legible el bloque entero.

**Queda de M5**: «sistemático por facultad», que es un nombre de método, no una
métrica, y vive en el comparador.


## Un método, dos nombres — el defecto de fondo de M5

Buscando por qué «sistemático por facultad» no se entendía apareció la causa, y
no era la glosa: **el mismo método se llamaba distinto según la pestaña.**

| `id` | En Método (`CLASSROOM_METHOD_STORIES`) | En Simulación (`UNIVERSITY_AULAS_SELECTOR_OPTIONS`) |
|---|---|---|
| `sistematico_pps` | Sistemático PPS | Sistemático por facultad |
| `cube_balanceado` | Balanceado (cube) | Balance por cuotas y tamaño |
| `pool_controlado` | Pool controlado | Optimizar repetidos |
| `local_pivotal_balanceado` | Balance + dispersión | Balance + dispersión |

Tres de cuatro. Así que preguntar «¿qué es sistemático por facultad?» **no tenía
respuesta posible en la pestaña que explica los métodos**: ahí ese método se
llamaba de otra forma, y nada ataba los dos nombres salvo un `id` que el usuario
no ve.

Reparado en la fuente: las historias ya no declaran `title` y resuelven el nombre
con `classroomMethodLabel(id)`. Contrato en
`aulas/__tests__/classroomMethodStoriesTituloContrato.test.ts` (3 tests), con dos
mutantes verificados: reintroducir un `title` propio → 1 rojo; devolver la jerga
«marco depurado» a un `detail` → 1 rojo.

Además se reescribieron cinco explicaciones que tenían **peor jerga que el
nombre que explicaban**: «cuando hay auxiliares buenas», «ordena el marco
depurado», «exige simulación para probabilidades finales», y la frase del
esquema «salta la recta con paso k».


## M6 cerrado — la respuesta vive ahora en la pantalla

La pregunta de Gonzalo («¿esas quinientas se usan sólo para medir o también para
escoger la mejor?», «¿por qué no simulo quinientas y me quedo con la que más me
beneficia?») **no estaba contestada en ninguna pantalla de la app**: la respuesta
existía sólo en este doc y en la conversación. Dos párrafos bajo «Resultados de
la simulación» dicen las tres cosas que faltaban:

1. Las corridas **miden, no eligen**, y sirven para dos cosas distintas: ver
   cuánto cambia el resultado y contar con qué frecuencia sale cada aula, que es
   de donde salen los pesos.
2. **La selección que va a campo es un sorteo aparte**, con su semilla registrada.
3. Por qué quedarse con la mejor no es gratis: la validez es del procedimiento,
   no del resultado; si se elige por puntaje, la probabilidad real deja de ser la
   declarada y los pesos, que son su inverso, pasan a mentir. Se nombra el
   muestreo por rechazo como la versión legítima y se dice que hoy no está
   implementado.

Coste: Simulación 1,29 → **1,49 pantallas**.

## Un test en rojo commiteado en `fbc307ca`

El gate de ese commit se corrió **antes** de la última edición del mismo bloque
—la glosa de «paso k»— y `classroomMethodStoriesModel.test.ts` exigía
literalmente `/paso k/i`. Segunda vez en la sesión con la misma forma: gate,
después edición, después commit.

El aserto protegía algo legítimo —que cada historia nombre SU mecanismo y no una
generalidad— pero clavado a la redacción. Ahora acepta `/paso k|uno de cada
tantos/i`, que es el mismo mecanismo dicho sin sigla. Reparado en el commit
siguiente, no con `--amend`, para que el rojo quede en la historia.

**Regla que sale de esto: el gate se corre después de la ÚLTIMA edición, nunca en
el mismo bloque que la incluye.**


## M7 — un título fijo sobre un contenido variable

El caso anotado («dos riesgos con el mismo título exacto») resultó ser dos
defectos apilados, y el segundo es peor:

1. El primer aviso se titulaba **«El sorteo ajustó tamaños y balanceó con lo
   disponible»** y su contenido decía sólo «en 4 estratos balanceó con menos
   variables». **No hubo ningún ajuste de tamaños.** Familia «un rótulo que
   promete otro número», en su versión de rótulo que promete un hecho que no
   ocurrió.
2. El segundo aviso traía 8 estratos de ajuste más los mismos 4 de balance, con
   el título idéntico.

La causa: el título era **fijo** en el diccionario mientras el contenido se
componía de lo que el aviso trae. Y el propio archivo documenta ese defecto en
su cabecera —«el motor mandaba dos avisos distintos bajo el mismo nombre, y dos
cosas distintas con el mismo nombre se leen como una repetida»—: la reparación
anterior lo arregló para «Fallback metodológico» y **lo reintrodujo** al meter
ajuste y balance bajo un mismo patrón.

Ahora el título lo compone `componerAvisoDeSorteo` a partir de lo que hay:
«corrigió cuotas que no salieron exactas», «balanceó con menos variables de las
pedidas» o las dos. 4 tests nuevos en `avisosDelMotor.test.ts`; el mutante que
devuelve el título fijo mata 4.

### Hallazgo abierto que sale de aquí

**El segundo aviso CONTIENE al primero.** Los mismos 4 estratos de balance se
cuentan en los dos avisos, así que el analista lee dos veces el mismo hecho. Eso
ya no es de la traducción sino de quién emite o agrega los avisos, del lado del
motor. Sin diagnosticar.


## Dos listas de riesgos con el mismo nombre

Barrido de bloques del 2026-08-22: **«Riesgos detectados» decía 5 avisos en
Método y 8 en Simulación.** No es un bug de conteo —Simulación suma a los flags
del comparador los que derivan de las cifras de estabilidad (CV sobre umbral,
balance fuera de banda, puntaje bajo)—, sino un rótulo idéntico sobre dos
alcances distintos: al pasar de una pestaña a otra los riesgos parecían haber
crecido solos y nada decía por qué.

Ahora cada lista declara qué mira: **«Riesgos que detectó la comparación»** (5) y
**«Riesgos de la comparación y de la estabilidad»** (8).


## M9 — diagnóstico medido antes de mover nada

Inventario del 2026-08-22 sobre HSVG2026_definitivo, viewport 1710x1107:

| Método | px | % |
|---|---|---|
| Panel «Recomendado por el comparador vigente» | 125 | 4 % |
| Barra de acciones | 50 | 2 % |
| **Paso 1. Qué hace cada uno de los cuatro métodos** | **1.344** | **47 %** |
| **Paso 2. Qué dio cada método con este marco** | **1.321** | **46 %** |
| total | 2.888 | |

Simulación: 1.474 px, de los cuales 1.400 son el cuerpo y 50 la barra.

### Qué falta que hoy no está en ninguna de las dos

**El veredicto.** Ninguna de las dos pestañas dice si lo que hay se puede mandar
a campo. Comprobado por texto: no aparece ni una frase del tipo «lista para» /
«ya puedes» en ninguna de las dos. El analista ve un método recomendado, siete
puntajes de balance, un n efectivo y ocho avisos de gravedad media, y **tiene que
sintetizar solo** la única pregunta que trajo: ¿esto está bien o no?

### Qué está pero no se gana su espacio

**La didáctica: 47 % de Método.** Los cuatro esquemas de «Paso 1» suman 1.953 px
repartidos en dos columnas y explican cómo funciona cada método **en abstracto** —
la propia tarjeta lo admite: «ESQUEMA ILUSTRATIVO · NO SON AULAS REALES»—. Es
material de primera visita cobrado en cada visita. No se borra: se reordena o se
consulta cuando hace falta.

**El método recomendado se nombra tres veces en Método**: en el panel superior,
en la barra de acciones («Recomendado: Optimizada para evitar repetidos») y en el
resultado del paso 2.

### Qué orden las haría leerse solas

Hoy Método enseña primero y muestra el resultado con TU marco después. Para la
primera visita el orden es correcto; a partir de la segunda está invertido, y el
peaje son 1.344 px antes de ver lo propio.

**Decisión pendiente de Gonzalo**: invertir el orden cambia la pedagogía de la
pestaña, así que se propone y no se ejecuta. Lo que sí entra sin discusión es lo
que falta —el veredicto—, porque agregar no destruye nada.


## El hallazgo grande de M9: cuatro juegos de nombres en una pestaña

Recorriendo Método con scroll —arriba, medio y fondo, como pidió Gonzalo el
2026-08-22: «las capturas son de toda la hoja, tiene que scrollear arriba al
medio y abajo si no, no diagnosticas bien»— apareció lo que hacía imposible
seguir la pestaña: **los mismos cuatro métodos se anunciaban con cuatro nombres
distintos según dónde se mirara, y tres de esas superficies están en la MISMA
pantalla.**

| `id` | Paso 1 (stories) | Paso 2 y panel (motor R) | Fondo (didáctica) | Constantes |
|---|---|---|---|---|
| `sistematico_pps` | Sistemático PPS | Selección proporcional al tamaño | Salto sistemático proporcional al tamaño | Sistemático por facultad |
| `cube_balanceado` | Balanceado (cube) | Selección balanceada | Sorteo balanceado multidimensional | Balance por cuotas y tamaño |
| `local_pivotal_balanceado` | Balance + dispersión | Balanceada y distribuida | Balance con dispersión local | Balance + dispersión |
| `pool_controlado` | Pool controlado | Optimizada para evitar repetidos | Sorteo optimizado contra repetidos | Optimizar repetidos |

Cerrado en tres pasos: las historias ya no declaran nombre (`fbc307ca`); el
comparador didáctico tampoco, y conserva sólo lo suyo —fortaleza y riesgo—; y el
front deja de preferir el `method_label` que manda el motor R
(`calc_muestra_aulas.R:3416`) sobre el canónico. Seis superficies invertidas.

**Y un rótulo que prometía otro número, en su forma más literal**: el bloque del
fondo se titulaba **«Dos formas de sortear, medidas con la misma regla»** sobre
**cuatro** tarjetas. Ahora el número sale del conteo real: «Cuatro formas de
sortear».

Contrato: `classroomMethodStoriesTituloContrato.test.ts`, 6 tests. Mutantes
verificados: `title` propio en las historias → rojo; jerga «marco depurado» →
rojo; `nombre:` propio en el comparador didáctico → rojo.

### Pendiente de este hallazgo

`api/R/calc_muestra_aulas.R:3416-3419` sigue emitiendo su propio juego. La UI ya
no lo usa, pero **el stage de los jobs sí** («Selección proporcional al tamaño:
corrida 8 de 17»), así que durante un sorteo el usuario lee un nombre que no
existe en ninguna pantalla. Alinearlo exige tocar R, relanzar la API y
`R CMD INSTALL` para que el worker lo vea.


## «¿A qué se deben tantas alertas?» — no había nada roto

Gonzalo, 2026-08-22, viendo cinco avisos seguidos en ámbar: «¿a qué se deben
tantas alertas, es porque algo está mal? En todo caso, ¿qué podemos hacer para
mejorarlo?».

No lo estaba. Los cinco de HSVG2026, todos marcados «media»:

| Aviso | Qué es de verdad |
|---|---|
| Baja profundidad de reservas — 5 celdas con menos reservas que titulares | **asunto**, pide una decisión |
| «Las probabilidades de esta tarjeta son del diseño, no del sorteo» | nota: explica qué muestra la tarjeta |
| «Balanceó con menos variables» en 4 estratos | nota: en esos estratos no había nada que balancear |
| «Corrigió cuotas» en 8 estratos | nota: el redondeo entero no da cuotas exactas |
| «Simulación corta para leer estabilidad» | pendiente: falta correr la simulación |

**Tres naturalezas distintas en una sola lista con la misma gravedad.** Una
escala donde todo vale lo mismo obliga a leerlos todos para descubrir que sólo
uno pide algo.

Reparado: `naturalezaDelAviso` clasifica en asunto / nota / pendiente, la píldora
de cada fila dice qué clase de cosa es en vez de repetir «media», las notas
pierden el ámbar —que queda para lo que pide una decisión— y el resumen cuenta
por naturaleza. Medido después:

- Método: **«1 asunto para revisar · 1 tarea pendiente · 3 notas de cómo salió el sorteo»**
- Simulación: **«4 asuntos · 1 tarea pendiente · 3 notas»** — los tres asuntos extra
  son las cifras de salud que cruzan su umbral (CV de pesos 0,65 sobre 0,50).

Un aviso sin señal conocida se clasifica como **asunto**: callar algo que pedía
atención es peor que pedir atención de más. 4 tests nuevos; el mutante que quita
la clasificación de notas mata 1.


## Revamp visual de Método — lo que pidió Gonzalo, punto por punto

Instrucción del 2026-08-22: «toma en cuenta /revamp-visual para temas de
simetría entre elementos, textos secos sin contenedor, elementos no diagramados
de explicación ilustrativa, separación, y didáctica de explicación y orden
conceptual».

**Simetría.** La columna izquierda medía 1.131 px y el aside lateral 126: un
11 %, con ~1.000 px de hueco muerto en una franja de 387 px de ancho. El resumen
de riesgos subió a una franja a ancho completo —es el ESTADO del cálculo, no
material para aprender, así que se lee antes de bajar— y las tarjetas ocupan el
ancho entero. Las cuatro miden ahora **312 × 449 px, idénticas**.

**Texto sin contenedor / duplicado.** El párrafo de la derecha explicaba los
cuatro métodos otra vez, con un juego de nombres propio —el **quinto** de la
pestaña— que además dejó de existir en pantalla al unificarse los nombres. Lo
que decía ya está en las cuatro tarjetas; lo que cerraba lo dice la nota al pie
del comparador. Retirado.

**Explicación ilustrativa no diagramada.** Los esquemas traían descripción, pero
sólo en `aria-label`: quien los MIRA no la lee, y lo que ve son bolas negras de
tamaños distintos unidas por hilos. Ahora llevan leyenda visible: «Cada bola es
un aula y su tamaño son los alumnos que tiene. Los hilos unen las aulas que el
método mira juntas al decidir». Un dibujo sin leyenda es decoración.

**Separación y orden conceptual.** La grilla pasó de dos columnas fijas a
`auto-fit minmax(270px, 1fr)`: cuatro tarjetas en fila en pantalla grande, tres
en 1280, dos en compacto, y el esquema llena su tarjeta en cada caso sin topes
artificiales.

**Método: 2,93 → 1,85 pantallas.** Desde el inicio del loop, 6,3 → 1,85.

### Cerrado en el tick siguiente

- **La leyenda se repetía cuatro veces**, una por tarjeta, cuando los cuatro
  esquemas comparten vocabulario visual. `MetodoGooEsquema` acepta
  `leyenda={false}` y la grilla la dice una sola vez en la glosa del paso 1;
  suelto —un esquema en otra superficie— la leyenda sigue viajando con él.
- **«representatividad» se partía como «represent/atividad»**, justo debajo de su
  cifra. Corrección de lo que dije al leer el screenshot: la cifra NO se parte;
  se parte la etiqueta, y eso es lo que se lee como «57/10 0». La causa es una
  grilla de cuatro columnas fijas que en una tarjeta de 290 px deja celdas de
  68. Con `auto-fit minmax(118px, 1fr)` caen a 2×2 de 142 px y la palabra entra
  entera. `hyphens: auto` queda como red de seguridad para etiquetas futuras.


## Simulación: el mismo patrón, el mismo arreglo

Medido antes: columna izquierda **1.261 px**, lateral **277**, con **984 px de
hueco muerto** en la franja de 387 de ancho. Idéntico a Método.

La recomendación del laboratorio y el resumen de riesgos suben a una franja de
ancho completo, en dos piezas lado a lado. Con `align-items: start` quedaban en
**123 y 97 px** —dos alturas distintas leen como un desajuste, no como dos
cosas—, así que la franja estira: **127 y 127**.

Simulación: 1,33 → **1,47 pantallas**. Sube, y es un intercambio deliberado: se
gana el ancho completo para el contenido y se pierde la fila compartida. El hueco
de 984 px no era espacio útil.

### Trampa que costó un typecheck

Sacar el `<aside>` de dentro del `{cond && (…)}` deja dos elementos hermanos
donde la expresión admite uno. Seis errores de sintaxis, ninguno con esa palabra:
«JSX expressions must have one parent element» y cinco de paréntesis. Se
resuelve envolviendo en fragmento, no tocando los paréntesis que el compilador
señala.


## «Esto sigue bien feo» — el texto que yo mismo metí

Gonzalo señaló, con la vista puesta en el elemento, los dos párrafos que el tick
de M6 había añadido bajo «Resultados de la simulación». Tenía razón y el defecto
es exactamente el que él había pedido evitar dos mensajes antes: **texto seco sin
contenedor**. Ocho líneas corridas el segundo, con tres ideas dentro —por qué no
se elige la mejor, que el muestreo por rechazo existe, y cuánto se ganaría—
apiladas sin separación.

La respuesta se conserva entera; lo que cambia es la forma: **dos preguntas, dos
tarjetas de 98 px idénticas** —«¿Para qué se repite el sorteo?» y «¿Por qué no
nos quedamos con la mejor?»— y el matiz del muestreo por rechazo baja a un pie
en cuerpo menor. Simulación: 1,47 → **1,42 pantallas**.

**El contrato `cssHuerfano` cazó lo que quedó detrás**: al sustituir los párrafos
por tarjetas, `.cmv2-aulas-simulacion-nota` quedó sin marcado y el test subió a
18 clases muertas sobre un tope de 17. Es la clase de deuda que nadie ve y que
sólo aparece si algo la cuenta.

### Lección

Un tick que contesta bien una pregunta puede introducir el defecto que otro tick
acaba de cerrar. La respuesta de M6 era correcta en contenido y mala en forma, y
se escribió **después** de que Gonzalo pidiera cuidar los textos sin contenedor.
Contestar no exime de dar forma a la respuesta.


## Dos asimetrías más, una visible y otra que sólo aparece midiendo

**La explicación de la fórmula flotaba.** El párrafo que dice qué es un peso y
qué es el n efectivo iba DESPUÉS de la figura, así que quedaba entre la fórmula
que explica y el bloque siguiente, sin pertenecer a ninguno. `FormulaLatex` gana
una prop `nota` y la explicación pasa a ser el pie de la figura, que es lo que
es.

**Los sellos de procedencia no estaban al ras.** Las tres tarjetas de estabilidad
median exactamente lo mismo —167 × 128 px las tres—, así que a simple vista el
problema parecía de cajas y no lo era: lo que se desalineaba era el contenido.
Un detalle de dos líneas empuja su «cifra validada» más abajo que el de al lado,
y los tres sellos estaban a **588, 576 y 580 px**. Con `grid-template-rows: auto
auto 1fr` la última fila absorbe el sobrante: **705, 705, 705**.

Vale la pena registrar el método: la asimetría de las cajas se descarta midiendo
las cajas, y sólo entonces se busca dentro. Mirar el screenshot y concluir «las
tarjetas tienen distinto alto» habría llevado a tocar lo que ya estaba bien.
