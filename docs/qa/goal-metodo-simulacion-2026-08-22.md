# GOAL — Método y Simulación se entienden solas

Tipo: Registro de goal loop
Estado: En curso
Fecha: 2026-08-22
Autoridad: Evidencia de la ejecución que documenta; no reemplaza contratos ejecutables ni ADR aceptados


Doc vivo. Abierto el 2026-08-22. Sólo Gonzalo lo da por terminado.

---

## Dónde está esto ahora

| | al abrir | ahora |
|---|---|---|
| **Método** | 6,3 pantallas | **1,87** (1440x1000) · 4,67 (1024x600) |
| **Simulación** | 3,7 pantallas | **1,43** · 2,52 |
| Términos sin glosa en pantalla | 8 | **0** |
| Juegos de nombres para los 4 métodos | **6** | **1** |
| Tests del área | 1.387 | **1.748** |

Tablero M1–M9: **completo**. El loop sigue abierto; lo que aparece ahora son
hallazgos nuevos al mirar, no etapas pendientes.

## Índice por familia de defecto

Este doc creció como registro cronológico de un loop de muchos ticks. Para
consultarlo, las secciones agrupadas por lo que tienen en común:

**Un rótulo que promete otro número** — la familia dominante, ocho casos
- «El sorteo ajustó tamaños» sobre un aviso que sólo balanceó → *M7 — un título fijo sobre un contenido variable*
- «DOS formas de sortear» sobre cuatro tarjetas → *El hallazgo grande de M9*
- «500 corridas» que el estudio no pidió → *El botón de estabilidad anunciaba un número que el estudio no dijo*
- «Riesgos detectados»: 5 en una pestaña, 8 en otra → *Dos listas de riesgos con el mismo nombre*
- Una tabla que mostraba el 11 % → *Una tabla que mostraba el 11 %…*
- «La app elige» justo después de quitarle esa potestad → *Lo que el cambio anterior dejó mintiendo*
- «puntaje medio de 0 sorteos» → *El estado principal de Simulación*
- Un comentario que afirmaba lo contrario del código → *El botón de estabilidad…*

**Varios nombres para la misma cosa** — seis juegos, unificados
- *Un método, dos nombres* · *El hallazgo grande de M9* · *El quinto juego de nombres, el del motor* · *El copy accesible tenía el sexto juego de nombres*

**Vacíos mal declarados**
- *M6 cerrado* (cuatro tarjetas con el mismo vacío) · *El vacío que pasó a ser la primera frase* · *El estado principal de Simulación* (el vacío parcial) · *Las ramas que el proyecto real nunca alcanza*

**Jerga y copy**
- *Lo cerrado de M5* · *Los siete balances* · *La vara 1, medida y fijada* · *El copy accesible…* · *La jerga también entra por el motor* · *La traducción no puede depender de que el motor la mande*

**Geometría y asimetría**
- *Revamp visual de Método* · *Simulación: el mismo patrón* · *Dos asimetrías más* · *QA en 1024x600* · *Barrido: ¿había más reglas que apilaban por falta de altura?* · *QA de la matriz*

**Rendimiento**
- *RESUELTO — «el sorteo tarda 6 minutos…»* (eran dos métodos distintos, no dos entornos)

**Decisiones de producto**
- *Qué se hace con las 500 corridas* · *«¿Por qué te fuerza a compararlos siempre?»* · *El reorden conceptual* · *«¿A qué se deben tantas alertas?»*

**Cómo no engañarse** — lecciones de método, las más caras
- *Un test en rojo commiteado* · *Corrección: sí se puede verificar un componente sin jsdom* · *Deuda saldada* · *Barrido del `??` que deja pasar el cero* · *Las ramas que el proyecto real nunca alcanza* (el mutante que no murió)

---

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

## RESUELTO — «el sorteo tarda 6 minutos desde la app y 22,8 s desde R»

**El diagnóstico anotado era falso.** Decía: «las configs son idénticas y
`simulation_runs` es 0 en ambas, así que no es lo que se pide sino el entorno del
job». Las configs sí eran idénticas; **el `method_id` que viajaba, no.**

El botón llamaba `onSelectMethod(config, model.recommendedMethodId)`, y ese
`recommendedMethodId` daba prioridad a la recomendación del comparador sobre la
configuración. Medido el 2026-08-22 sobre el proyecto real:

| | |
|---|---|
| `selector_engine` guardado en el `.pulso` | `cube_balanceado` |
| `simulation_runs` | 0 |
| Método que mandaba el botón | **`pool_controlado`** |
| `candidate_pool_size` | **500** |

`.cm_aulas_select_once_pool` (`calc_muestra_aulas.R:2211`) corre **un bucle de
500 iteraciones**, cada una un sorteo completo con el cubo como motor base. Con
el cubo medido en ~1,9 s por corrida completa, eso son **unos 16 minutos**. La
corrida se canceló a los 6.

En R se llamó al motor con `cube_balanceado`, que es lo que dice la config: 22,8
s. **Nunca fueron dos entornos con el mismo trabajo: eran dos métodos
distintos**, uno de ellos 500 veces más caro por diseño.

Queda **reparado como efecto colateral de `f2623619`**: ahora el botón manda la
configuración, así que sortea con `cube_balanceado`.

### Cerrado: el coste ahora se anuncia

`avisoDuracionSorteo` es la función hermana de `avisoDuracionComparacion` y sigue
su misma regla: **no promete minutos**, dice cuántos sorteos son, que es el
hecho. En Selección, con «Optimizar repetidos» vigente:

> **Este método sortea muchas veces.** Optimizar repetidos no hace un sorteo:
> hace **500** y se queda con el que mejor puntúa. Los otros tres hacen uno.

Verificado en la app cambiando el método a `pool_controlado` y devolviéndolo a
`cube_balanceado` después: con el pool aparece, con el cubo no. **Sin condicionar
a `!selectionReady`**: re-sortear cuesta exactamente lo mismo que sortear la
primera vez, y ocultar el aviso ahí habría sido el mismo defecto en su versión
tardía. 4 tests de contrato.

### Lección

Un diagnóstico que descarta la causa correcta la deja viva durante días. Éste
decía «configs idénticas» habiendo comparado el `.pulso` contra el `.pulso`, sin
mirar **el argumento que el botón realmente enviaba**, que era el único sitio
donde diferían.

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


## El reorden conceptual, aplicado

Método enseñaba primero y mostraba el resultado después: 1.344 px de explicación
abstracta —que la propia tarjeta declara «esquema ilustrativo · no son aulas
reales»— antes de ver lo propio. Correcto en la primera visita, peaje a partir de
la segunda.

Invertido con la aprobación de Gonzalo. La primera pantalla de Método es ahora:
recomendación vigente → barra de acciones → riesgos en una línea → **qué dio cada
método con este marco**, con las cuatro tarjetas y sus cifras en 2×2. La
didáctica queda debajo como material de consulta.

**Se retira la numeración.** «Paso 1» y «Paso 2» describían una secuencia
—aprende y luego compara— que dejó de existir al invertir el orden. Ahora son
«Qué dio cada método con este marco» y «Cómo funciona cada uno de los cuatro
métodos»: la respuesta y su material de consulta, no dos pasos.

Método sigue en 1,84 pantallas: el reorden no cambia el alto, cambia qué se ve
sin bajar.

### Lo que queda, medido

El método recomendado se nombra **dos veces en los primeros 100 px**: en el panel
«Recomendado por el comparador vigente» y en la barra de acciones («Recomendado:
Optimizar repetidos»). La barra es compartida con Simulación, donde el panel no
está en el mismo sitio, así que no basta con borrarlo de un lado.


## El nombre del método recomendado, contado

Medido el 2026-08-22 buscando el nodo de texto exacto «Optimizar repetidos»:

| | antes | después |
|---|---|---|
| Método | **5 veces** (y=404, 525, 735, 1341, 1760) | 4 |
| Simulación | 2 veces (y=388, 471) | 1 |
| Selección | 1 | 1 |

Las tres últimas de Método son legítimas: son las tarjetas de cada método, y ahí
el nombre ES la tarjeta. Las que sobraban eran las dos de arriba —la línea de la
barra y la tarjeta de recomendación—, a 83–120 px de distancia, con la tarjeta
diciendo lo mismo Y su descripción.

No se borra la línea: se apaga donde sobra. En Selección y Reemplazos **es el
único sitio que nombra el método vigente**, así que `ClassroomLabCommandBar`
recibe `mostrarRecomendado` y las dos pestañas del encargo la pasan en `false`.
Verificado en las tres pestañas: Selección conserva la suya.

## Fuera del encargo, pero medido

**Selección son 4,64 pantallas**, más del doble que Método y Simulación juntas
ahora. Es la pestaña más larga de la sección.


## QA en 1024x600 — una regla que empeoraba lo que intentaba aliviar

El paso 3 de `/revamp-visual` obliga a probar en `1440x1000` **y** `1024x600`.
Sólo había verificado el primero, y el segundo destapó lo peor de la jornada:

**Método pasaba de 1,84 a 8,33 pantallas en compacto**, con las cuatro tarjetas
de método a **874 px de ancho cada una, en una sola columna, habiendo 900 px de
sitio para tres.**

La causa no era el `auto-fit` nuevo sino un media query viejo:

```css
@media (max-width: 900px), (max-height: 700px) { .cmv2-method-stories { grid-template-columns: 1fr; } }
```

Se dispara por **`max-height`**: en 1024x600 la altura es 600, así que apila las
tarjetas *porque falta altura* — y apilar multiplica por cuatro justo lo que
falta. Una regla pensada para aliviar el espacio vertical era la que lo
consumía.

Reparado separando las dos condiciones: `.cmv2-method-decision` conserva ambas
(pasar a columna cuando hay poca altura sí tiene sentido para una fila de
controles), y el reparto de las tarjetas lo gobierna el `auto-fit` de la regla
base. El `min-height: 250px` baja a `max-width: 640px`, donde de verdad hay una
sola columna. **8,33 → 4,63 pantallas**, tarjetas de 285x390 en tres columnas.

### Desglose en compacto, para el siguiente tick

| Bloque | px |
|---|---|
| Panel de recomendación | 175 |
| Barra | 50 |
| Franja de riesgos | 56 |
| **Comparador** | **1.460** |
| Didáctica | 968 |

El comparador domina, y dentro de él la tabla de balance por categoría, que
muestra **10 filas con `slice(0, 10)` sin decir cuántas hay**. Un recorte
silencioso: la superficie no declara que está mostrando una parte.


## Una tabla que mostraba el 11 % y lo presentaba como el balance

Contado desde el payload real, no desde el DOM: el comparador trae **360 filas de
balance, 90 por método**. La tabla mostraba **10**, con `slice(0, 10)` sobre
filas que llegan **agrupadas por dimensión**, así que las diez visibles eran
siempre las diez primeras categorías de la primera dimensión —facultad— y las
otras cuatro —programa, nivel, tamaño, sexo— **no aparecían nunca**. Nada lo
decía.

Dos cambios:

1. **El recorte tiene criterio**: las diez categorías donde la selección más se
   aparta del marco, vengan de la dimensión que vengan. Y aparece lo que estaba
   tapado: en HSVG2026 las mayores desviaciones son de **sexo esperado (8,2 % en
   F y en M)**, por encima de cualquier facultad. Con el recorte viejo eso no se
   veía jamás.
2. **El pie declara qué se ve**: «Se muestran las 10 categorías con mayor
   diferencia de las 90 que se comparan, repartidas en 5 variables».

### Y el recorte tapaba jerga

Al cambiar el criterio salieron a pantalla **«Program» y «Level» crudos**.
`selectorFieldLabel` tenía tres entradas —faculty, sex_top_1, size_group— y su
comentario decía «nada de `faculty` crudo», mientras el motor balancea **siete**
dimensiones (`api/R/calc_muestra_aulas.R:294`). Las siete traducidas, con
`selectorFieldLabel.contract.test.ts` copiando la lista del motor: 4 tests, y el
mutante que quita `program` mata 2.

**Lección**: un recorte sin criterio no sólo esconde datos, esconde defectos. Los
nombres crudos llevaban ahí desde siempre y eran invisibles porque las filas que
los mostraban nunca entraban en las diez primeras.


## «¿Por qué te fuerza a compararlos siempre?»

Pregunta de Gonzalo el 2026-08-22: «¿por qué no sólo seleccionar uno e ir con
ese? ¿Siempre se debe tener el comparativo entre todos?». Verificado, y había dos
cosas, no una:

**1. El candado era de UI, no del motor.** El botón de sortear llevaba
`disabled={... || !model.comparisonReady}`. El endpoint acepta el `method_id` que
se le mande y sólo valida que el motor exista
(`router_calc_muestra.R:1063`); no exige comparación previa. Comparar sirve para
elegir con evidencia, no es requisito para sortear. Candado retirado.

**2. Y peor: la configuración no mandaba.**

```ts
const recommendedMethodId = comparison?.recommendation?.method_id ?? String(config.selector_engine ?? config.selector);
```

Da prioridad a la recomendación y sólo cae a la configuración **cuando no hay
comparación**, que era justo el caso en que el botón estaba deshabilitado. En
HSVG2026: config `cube_balanceado`, recomendado `pool_controlado`, botón
«Sortear con Optimizar repetidos». La configuración se ignoraba siempre.

Ahora manda la configuración y, cuando difieren, la barra avisa: **«El comparador
prefiere Optimizar repetidos»** junto a **«Sortear con Balance por cuotas y
tamaño»**. La elección es del analista; callar la evidencia que él mismo mandó
calcular sería lo otro.

### Este contrato nació en falso verde

El primer `metodoParaSortear.contract.test.ts` tenía 3 tests en verde y **el
mutante que devolvía el recomendado los pasaba todos**: ningún fixture tenía una
comparación acreditada, así que `comparison` quedaba en null y ambos caminos
coincidían. Acreditar la firma completa dentro del fixture resultó frágil, así
que la decisión se extrajo a `resolverMetodoParaSortear(configurado, recomendado)`
y el contrato prueba la función pura. Mutante: **mata 2 de 3**.

La regla que confirma: *una decisión que se puede aislar, se aísla*; y un
contrato no vale hasta que un mutante lo desmiente.


## Lo que el cambio anterior dejó mintiendo

Quitar el requisito de comparar dejó falsas tres afirmaciones en el recorrido de
preparación de Selección, que asumía el flujo viejo:

| Antes | Por qué era falso |
|---|---|
| «3. Método **comparado**» | El paso es elegir el método, no compararlos |
| «por comparar» sin comparación | El paso está resuelto en cuanto hay un método vigente |
| «**La app elige** la opción con mejor balance y menos repetidos» | Elige el analista; la app recomienda |

La tercera era la peor: describía exactamente el comportamiento que se acababa de
retirar.

### No se pudo ver en pantalla, así que se aisló

Ese panel sólo se renderiza con `!selectionReady` y el proyecto de trabajo ya
tiene selección, así que no hay forma de observarlo; y el frontend **no tiene
entorno DOM en los tests** (son de lógica pura, sin jsdom ni testing-library).
Declararlo «hecho» sin verlo habría sido exactamente lo que este loop lleva todo
el día corrigiendo en otros.

La decisión se extrajo a `pasoMetodoElegido(metodoVigenteLabel, comparisonReady)`
y el contrato prueba la función: 4 tests, y el mutante que vuelve a exigir
comparación mata 2. **Una decisión que no se puede observar, se aísla para poder
verificarla.**


## El quinto juego de nombres, el del motor, cerrado

`.cm_aulas_method_label` en `api/R/calc_muestra_aulas.R:3413` emitía su propio
juego —«Selección proporcional al tamaño», «Balanceada y distribuida»…—. La UI ya
no lo consumía desde `07d90ab1`, pero **el stage de los jobs sí lo compone**:
durante un sorteo el usuario leía «Selección proporcional al tamaño: corrida 8 de
17», un nombre que no existe en ninguna pantalla.

Los seis labels alineados con `UNIVERSITY_AULAS_SELECTOR_OPTIONS`. Ningún test R
dependía de esos textos (`grep method_label api/tests` sale vacío); el único
consumidor con fixture era `jobPolling.test.ts`, actualizado.

Verificado llamando al helper con el paquete cargado:

```
sistematico: Sistemático por facultad
pool: Optimizar repetidos
cube: Balance por cuotas y tamaño
```

**Para verlo en la app hace falta relanzar la API**, y para que lo vea el worker
de jobs, `R CMD INSTALL`.

## Copy que quedó exigiendo comparar

Barrido tras `f2623619`: de seis textos que nombran comparar, cuatro ya ofrecían
alternativa. Los dos que no:

- Salud, representatividad baja: «Compara métodos **y** vuelve a generar la
  selección» → «Prueba otro método o vuelve a sortear».
- Vacío de riesgos: «Compara métodos … para evaluar riesgos» → «Compara métodos
  **o sortea con el que tengas configurado**: los riesgos se evalúan sobre una
  corrida hecha con el objetivo y el marco vigentes».


## Barrido: ¿había más reglas que apilaban por falta de altura?

El defecto de las tarjetas de método —apilar cuando falta ALTURA, que multiplica
justo lo que falta— parecía una familia. Barrido de todo el CSS del frontend
buscando `@media` con `max-height` que declaren una sola columna: **14 reglas**.
Pero el patrón por sí solo no es el defecto, así que se revisaron con un criterio
explícito: *¿el apilado viene compensado con menos altura, o no?*

De las cuatro de Cálculo de muestra:

| Regla | Veredicto |
|---|---|
| `classroomMethodStories.css:128` | **Defecto, reparado.** Apilaba y encima ponía `min-height: 250px` por tarjeta |
| `classroomSelectionMap.css:245` | **Legítima.** Apila mapa e inspector, pero acota el viewport a `min(48vh, 460px)` |
| `motor.css:1961` | **Ejemplar.** Con poca altura **ensancha** `.rec-resumen` a seis columnas: menos alto, no más |
| `motor.css:1852`, `calculoDistribucion.css:438` | Ambiguas; no se tocan sin medir |

Las otras diez están en monitoreo y gráficos, fuera de este encargo.

**El defecto era único en su gravedad**, y la regla que lo distingue es simple:
apilar siempre aumenta la altura, así que reaccionar a `max-height` apilando sólo
vale si el mismo bloque acota la altura de lo apilado. `motor.css:1961` hace lo
contrario y es el modelo a seguir.


## El botón de estabilidad anunciaba un número que el estudio no dijo

```ts
// El número de corridas de estabilidad es del estudio, no del botón.
const corridasEstabilidad = Number(config.simulation_runs ?? config.monte_carlo_n ?? 500) || 500;
```

El comentario decía **lo contrario de lo que hacía el código**: `??` no cubre el
cero y `|| 500` lo reemplaza. Con el `simulation_runs: 0` que trae HSVG2026, el
botón anunciaba «500 corridas» como si el estudio las hubiera pedido.

Ahora el origen viaja con la cifra: **«Medir estabilidad (500 corridas por
defecto)»** cuando el estudio no declara ninguna, y sin el «por defecto» cuando
sí. 5 tests; el mutante que devuelve el `?? … || 500` mata 3.

Es la misma familia que lleva todo el día apareciendo —un rótulo que promete otro
número— en su variante más difícil de ver: **el comentario que la describe dice
que no ocurre**.

## QA de la matriz, cerrado

| | 1440x1000 | 1024x600 |
|---|---|---|
| Método | 1,87 pantallas | 4,67 |
| Simulación | 1,43 | 2,52 |

Sin desborde horizontal en ninguno de los cuatro. Grupos verificados simétricos
en los dos viewports: las 4 tarjetas de método, las 16 celdas de puntaje, las 2
tarjetas de preguntas, las 3 cifras de estabilidad y la franja de estado.


## Barrido del `??` que deja pasar el cero

El defecto de «500 corridas» era un `?? … || N`: `??` no cubre el cero y `||` lo
reemplaza. En un módulo de estadística eso es peligroso, porque **el cero es un
valor legítimo constantemente** —cero aulas, cero corridas, cero por ciento—.
Barrido de las once ocurrencias del patrón en Cálculo de muestra:

| Caso | Veredicto |
|---|---|
| `duracionComparacion` (corridas) | **Defecto, reparado** |
| 8 casos sobre strings o booleanos | Correctos: `\|\|` sobre `""` o `false` es lo pretendido |
| `FacultadDecisionBloque:461` | **Redundante, no defecto**: el `Math.max(20, …)` da 20 con o sin el `\|\| 10` |
| `study.ts:590-591` | **Correcto por diseño**: `scenarioTarget` devuelve 0 como sentinela de «sin objetivo explícito» |
| `ResumenDiseno:96` | Ver abajo |

**Ninguno de los diez restantes es un defecto activo.**

### Lo que sí apareció: un helper que colapsa ausencia y cero

`frameAuditNumber` (`universidad/shared/frame.ts:416`) devuelve
`safeNumber(valor, 0)`: **0 cuando el dato falta**. Así que «cero cursos-horario»
y «sin dato» son indistinguibles en su valor de retorno, y el `|| null` de la
cabecera no pisa un dato legítimo — no puede distinguirlo.

Es la familia «una palabra para dos cosas» en un helper. El efecto visible sería
un marco construido con cero cursos-horario que la cabecera muestra como
pendiente en vez de como cero: **verde por ausencia**.

**No se toca en este loop**: tiene **43 consumidores** y la reforma segura es un
hermano `frameAuditNumberOrNull` para los sitios donde la distinción importa, no
cambiar el default. Fuera del encargo de Método y Simulación, y sin medir cuántos
de los 43 dependen del cero como fallback.


## La vara 1, medida y fijada

> «Se entiende sin saber muestreo. Ninguna sigla ni término técnico sin glosa.»

Barrido del texto que las dos pestañas ponen en pantalla, buscando trece términos
que exigen saber muestreo de antemano. **Simulación salió limpia. Método tenía
tres, todos en una sola frase** —la del control de descuento de repetidos:

> «…el modo que realmente aplicó el **engine**. Con **cube**, **pivotal** o
> selección manual el descuento es una auditoría **post hoc**: conserva
> probabilidades, calibración y orden.»

Cinco términos sin glosa, y encima con los nombres de método que dejaron de
existir en pantalla al unificarse. Lo que decía sigue siendo verdad; ahora lo dice
sin exigir el vocabulario: *«el descuento no cambia el sorteo: se calcula después,
para contar cuántos alumnos quedaron repetidos entre aulas»*.

### El contrato encontró lo que el barrido visual no podía ver

`copySinJerga.contract.test.ts` (7 tests) barre los seis archivos de copy de las
dos pestañas, **quitando comentarios** —documentar un defecto exige nombrar el
término que lo causaba—. Encontró dos que la inspección del DOM no veía porque no
se renderizan en el estado actual del proyecto:

- `aria-label="Histograma de π Monte Carlo…"`: **copy accesible**, el que lee un
  lector de pantalla. La jerga también llega por ahí.
- **«Sin atribución al engine»**, visible sólo cuando no hay recomendación.

Con eso, **las dos pestañas quedan en cero términos sin glosa**, en pantalla y en
el texto accesible.


## El copy accesible tenía el sexto juego de nombres

Los cuatro esquemas de Método llevaban `aria-label` con **los nombres viejos y
jerga pura**, describiendo la ANIMACIÓN en vez de lo que representan:

> «Esquema ilustrativo del **cube balanceado**: las candidatas **vibran**, se
> resuelven de una vez y la red completa de **tirantes** ata el **cluster**
> mientras las mini-barras de balance se llenan»

Para quien usa lector de pantalla eso no dice ni qué método es ni qué hace. Y no
aparece en ningún screenshot, así que catorce ticks de revisión visual no podían
verlo. Reescritos los cuatro con el nombre canónico y lo que el dibujo muestra, y
`copySinJerga.contract.test.ts` amplía cobertura a `MetodoGooEsquema.tsx`.

**Rompió 4 tests y con razón**: el aria también carga la declaración C1 («esquema
ilustrativo», «no son aulas reales»), porque el lector de pantalla puede no
alcanzar el `figcaption`. Restituida en los cuatro.

## Corrección: sí se puede verificar un componente sin jsdom

Al reparar el recorrido de preparación afirmé que «el frontend no tiene entorno
DOM en los tests» y aislé la decisión a `pasoMetodoElegido` para poder
verificarla. Lo primero es cierto —no hay jsdom— pero la conclusión era
incompleta: `metodoGooEsquema.test.tsx` renderiza componentes con
`renderToStaticMarkup` de `react-dom/server` y comprueba el markup resultante.
**La vía existía y no la busqué.**

Aislar la decisión sigue siendo mejor diseño, así que no se deshace; pero la
razón que di era falsa, y la próxima vez que un componente no se pueda observar
en pantalla, `renderToStaticMarkup` es la primera opción, no la última.


## Deuda saldada: el panel de preparación, verificado renderizado

Con `renderToStaticMarkup` a la vista, lo que quedaba por hacer era comprobar que
el texto reparado **llega al HTML**, no sólo que la función lo devuelve.
`preparacionPanelRender.contract.test.tsx` monta el panel con sus props y verifica
sobre el markup:

- Con método vigente y sin comparar: sale «Método elegido» con su nombre, y NO
  aparecen «Método comparado», «por comparar» ni «La app elige».
- Sin método vigente: «sin elegir».
- El paso se marca `is-ready` por el método, no por la comparación; y con
  comparación pero sin método vigente sale `is-working`.
- Los cuatro pasos del recorrido siguen presentes.

Mutante: devolver el paso a exigir comparación mata 2 de 4.

**Lo que cambia hacia adelante**: una superficie que no se puede abrir en la app
—porque depende de un estado que el proyecto de trabajo ya superó— **sí se puede
verificar**. Renderizarla es la primera opción; declarar «no observable» era una
limitación no intentada.


## Las ramas que el proyecto real nunca alcanza

HSVG2026 sólo produce avisos de gravedad **media**, así que en todo el loop nunca
se vio ni la rama de gravedad alta ni la de «sin riesgos» — y la alta es
precisamente la que tiene que destacar.
`riesgoResumenRamas.contract.test.tsx` las renderiza las cinco:

- Con un aviso alto: dice «1 de gravedad alta» primero y marca
  `data-severidad="alta"`.
- Sin avisos reales: «no reporta riesgos activos», severidad `ok`.
- **Sólo con notas del sorteo: severidad `ok`.** Si esto marcara «media»
  volveríamos al «5 avisos» que no distinguía nada.
- Un asunto real sí eleva la severidad a `media`.
- Sin auditar, el resumen no promete que no haya riesgos.

Mutante que quita la mirada a la gravedad alta: mata 2.

### Un mutante que no murió, y por qué está bien

Cambiar «las cifras de salud son asuntos» por «son notas» **pasa los cinco tests
de este contrato**. No es un hueco: esa decisión la protege
`avisosDelMotor.test.ts`, donde el mismo mutante mata 1. Comprobado, no supuesto —
un mutante que sobrevive obliga a buscar quién lo cubre antes de declarar que
nadie lo hace.

### Trampa del fixture

`classroomRiskRows` deduplica por `severidad|título|detalle`, así que **dos copias
del mismo aviso cuentan como una**. El primer intento del test usaba dos notas
idénticas y salía en singular: el fallo era del fixture, no del código.


## El vacío que pasó a ser la primera frase de la pestaña

Invertir el orden dejó al comparador arriba, así que **su vacío es ahora lo
primero que lee quien abre Método sin haber comparado**. Y decía:

> **Sin comparación vigente** · El método configurado no se presenta como
> recomendación hasta comparar el marco y el objetivo actuales.

Un matiz técnico, sin nombrar el botón que lo llena —justo lo que ya se había
corregido en los otros vacíos de estas pestañas—. Ahora dice qué falta, cómo se
llena y, desde que comparar dejó de ser requisito, **que no es obligatorio**:

> **Todavía no has comparado los métodos** · Pulsa **Comparar los cuatro
> métodos** arriba para ver qué da cada uno con este marco. No es obligatorio:
> también puedes sortear directamente con el método que tengas configurado.

`comparadorVacio.contract.test.tsx`, 5 tests renderizados; el mutante que
devuelve el título técnico mata 1.

**Los cuatro vacíos de las dos pestañas quedan revisados**: el de resultados de
simulación (que se repetía cuatro veces), el de balance sin filas, el del
comparador y el del resumen de riesgos sin auditar.


## El estado principal de Simulación, nunca observado hasta hoy

HSVG2026 tiene `simulation_runs: 0`, así que **en todo el loop la pestaña se vio
siempre vacía**: las tarjetas de resultados, el rango de puntajes y la nota del
motor no se miraron ni una vez en pantalla. Todo lo que se reparó ahí —el nombre
canónico, el rango con rótulo, «puntaje medio de N sorteos», la explicación del
método— se hizo a ciegas.

Renderizado con datos, **los seis primeros contratos pasan a la primera**: los
cambios eran correctos.

### Pero el caso mixto seguía roto

El vacío único cubre «ningún método corrió». Faltaba **unos sí y otros no**, que
la app tampoco alcanza:

> Optimizar repetidos — **puntaje medio de 0 sorteos** · **8 de cada 10 cayeron
> entre — y —**

Una media de cero sorteos no existe, y ese rango afirma una distribución que no
hay. La tarjeta sin simular ahora dice **«no se simuló»** y no pinta ni media ni
rango ni barra; la que sí corrió conserva los suyos. Mutante que devuelve el
pintado: mata 1.

**La lección**: reparar el vacío total no repara el vacío parcial. El «todos» y el
«alguno» son estados distintos, y el segundo casi nunca se mira.


## La traducción no puede depender de que el motor la mande

Aplicando el criterio del vacío parcial a la grilla de puntajes apareció otra
cosa: renderizada con `label: "faculty"` pinta **`faculty` crudo**. En la app se
ve «Facultad» sólo porque el motor manda ese label ya traducido… **y el mismo
motor manda `faculty` y `program` crudos en la tabla de balance del mismo
payload**, donde hubo que traducirlos.

O sea: dos superficies del mismo bloque recibían el mismo concepto en dos formas,
y cada una dependía de que le tocara la buena. `selectorFieldLabelTitulo` es
idempotente —lo que ya viene en español no está en su diccionario y sale igual—,
así que cubre las dos. Verificado en la app: las ocho dimensiones siguen en
español, cero crudas.

### Y lo que la grilla hace bien

- Una métrica **sin puntaje no se pinta como cero**: un 0/100 es un resultado
  malo y «no se midió» es la ausencia de resultado; confundirlos sería la familia
  «verde por ausencia».
- Un puntaje fuera de rango no rompe la barra (se acota a 0–100 %).
- Si ninguna métrica tiene puntaje el bloque desaparece entero, con su encabezado
  y su glosa dentro, así que **no queda un título huérfano sobre nada**.


## La jerga también entra por el motor

`operational_reason` viene del motor y **gana** al `detail` del front
(`method.operational_reason ?? classroomMethodReason(...)`). Es el mismo patrón
de precedencia que hubo que invertir para el nombre del método… pero aquí la
precedencia **se conserva**, porque el motor puede mandar la razón concreta de SU
corrida —por ejemplo la de la réplica histórica— y el front no la conoce.

Lo que no puede es traer jerga. De las seis explicaciones, cuatro estaban en
español llano y dos no:

- `pool_controlado`: «reduce mejor el **solape**» → «se queda con la selección
  donde menos estudiantes se repiten entre cursos-horario».
- `estratificado_aleatorio`: «Selecciona dentro de cada **estrato**» → «Sortea al
  azar dentro de cada grupo».

Verificado con el paquete cargado, barriendo ocho términos contra los seis
motores: **0 de 6 con jerga**.

**La regla que sale**: cuando el texto del motor gana al del front, carga la misma
exigencia que el copy de la UI. Si no, la glosa se cuida en un lado y entra por el
otro.


## Tres caminos para comparar, dos comportamientos

Buscando el patrón que causó «DOS formas de sortear» y «500 corridas» —un número
escrito a mano donde debería derivarse— apareció uno peor, porque no está en un
texto sino en **la acción**:

| Camino | Mandaba |
|---|---|
| Barra de acciones | `0` |
| `runComparison` de Método | `simulation_runs ?? monte_carlo_n ?? 500` |
| Aviso de etapa de Simulación | `simulation_runs ?? monte_carlo_n ?? 500` |

Comparar y medir estabilidad son acciones distintas desde `d87e5ac9`: comparar
hace **una pasada por método** para poder elegir. Pero dos de los tres caminos
resolvían las corridas por su cuenta.

**Hoy no se nota, y por casualidad**: HSVG2026 trae `simulation_runs: 0` y `??`
deja pasar el cero, así que los tres acaban en 0. Con un estudio que declare 300,
un botón compararía con 300 corridas y otro con ninguna, sobre el mismo marco y
sin que nada lo dijera.

`CM_CORRIDAS_COMPARACION` es ahora el único sitio donde se decide, y el contrato
comprueba que **ningún camino vuelve a resolverlo a mano** —incluido el patrón
`simulation_runs ?? … monte_carlo_n`— y que comparar y estabilidad siguen dando
números distintos, porque si coincidieran M1 se habría deshecho. Mutante: 1 rojo.


## Y sortear tenía el mismo problema

Extendida la familia a la acción cara, tres caminos otra vez:

| Camino | Mandaba | Veredicto |
|---|---|---|
| «Usar método» en una tarjeta | el id de **esa** tarjeta | **legítimo**: es una elección explícita |
| Barra de acciones | la configuración | correcto desde `f2623619` |
| Aviso de etapa de Selección | **`recommendedMethodId`** | **el defecto que `f2623619` reparó, vivo aquí** |

Es la **tercera vez en la jornada** que una reparación deja el mismo defecto vivo
en otra ruta: pasó con el vacío de la simulación (total sí, parcial no), con el
copy que exigía comparar (cuatro textos sí, dos no) y ahora con el método del
sorteo. El patrón es siempre el mismo: se repara donde se vio, no donde vive.

Ese camino llevaba además el candado por `comparisonReady`, que cae por el mismo
motivo que el de la barra: el motor no exige comparar.

El contrato distingue el caso legítimo del defecto: «Usar método» **sí** manda un
id concreto, porque el usuario acaba de señalarlo; los otros dos tienen prohibido
sortear con el recomendado a espaldas de la configuración. Mutante: 1 rojo.


## La familia cerrada, y un desborde que queda anotado

**Simular reemplazos**, la tercera acción, tiene dos caminos y **ambos mandan lo
mismo**: limpio. La familia «varios caminos para la misma acción» queda cerrada
con dos acciones reparadas (comparar, sortear) y una que ya era consistente.

### Desborde horizontal en Selección — 5 px, medido y sin resolver

Verificando que los cambios no rompieron nada apareció que **Selección desborda
horizontalmente**, cosa que Método y Simulación no hacen:

| | ancho visible | contenido | desborde |
|---|---|---|---|
| Panel de Selección | 1.306 | 1.311 | **5 px** |
| `.cmv2-docente-unico` | 1.304 (offset) | 1.308 | 4 px |

Estable en cuatro medidas seguidas, así que no es un estado transitorio. El
primer intento de localizarlo señaló un `<strong>` con «techo 200» que al
comprobarlo **no desbordaba**: la medición comparaba contra el borde del panel
sin descontar su padding. Con la vía correcta —`scrollWidth` contra
`clientWidth`— el origen es `.cmv2-docente-unico`, pero **ninguno de sus hijos
excede el límite**, así que los 4 px vienen de márgenes o sombras y no de un
elemento ancho.

**No se resuelve aquí**: es la pestaña Selección, fuera del encargo de Método y
Simulación, y no lo introdujo ninguno de los cambios de esta jornada. Queda con
la medición hecha para que el siguiente no repita el rastreo.


## Teclado y foco: cuatro botones iguales no son cuatro opciones

La skill de revamp pide preservar foco, teclado y nombres accesibles, y era la
dimensión que faltaba por medir. Recorriendo el orden de tabulación:

| | focusables | `tabindex` positivo | orden |
|---|---|---|---|
| Método | 15 | 0 | correcto, sigue el documento |
| Simulación | 3 | 0 | correcto |

Ningún `tabindex` positivo —que rompería el orden natural— y ninguna trampa de
foco. Pero sí un defecto: **cuatro botones «Usar método» seguidos**, uno por
tarjeta. Tabulando se oye el mismo nombre cuatro veces y nada dice cuál método
es cuál. Es «lo repetido es lo prominente» en su versión accesible, y no aparece
en ningún screenshot. Ahora cada uno se llama **«Usar Sistemático por
facultad»**, «Usar Balance por cuotas y tamaño», etc.; el texto visible se queda
corto porque la tarjeta ya lleva el nombre encima.

### Un falso positivo, comprobado antes de reportarlo

El mismo barrido señaló un `<input type="checkbox">` **sin nombre accesible**.
Comprobado: está dentro de un `<label>` cuyo texto es «Descontar estudiantes
repetidos al seleccionar», así que el nombre se computa del label. **La heurística
no miraba el ancestro**, no el marcado. Reportarlo habría mandado a alguien a
arreglar algo que ya estaba bien.


## Contraste y modo oscuro: dos respuestas, una de ellas «no aplica»

**La app no tiene modo oscuro.** Comprobado con el navegador en `dark`:
`prefers-color-scheme` da `true`, el body sigue claro (`rgb(243,245,249)` con
texto `rgb(23,33,47)`), no hay `data-theme` ni clase en el root, y **el CSS de la
app no declara ni una regla `@media (prefers-color-scheme)`** — cero en todas las
hojas cargadas. Es un tema único deliberado, no un olvido. El check de la skill
no aplica aquí, y queda dicho para que nadie lo vuelva a buscar.

**El contraste está bien**: de los ocho textos añadidos en este loop, ninguno baja
de 4,5:1 y el **mínimo es 8,0**.

### La primera medición inventó dos defectos

El primer barrido reportó dos textos a **2,52:1**, uno de ellos el pie de tabla
que añadí. Era falso: el fondo venía como `color(srgb 0.998 0.997 0.998)` —casi
blanco— y mi función leía esos decimales como valores 0–255, o sea casi negro.
Arreglado el parser para entender `color(srgb …)` además de `rgb()`, los mismos
elementos dan **8,24**.

Es la segunda vez en la jornada que una medición mal hecha inventa un defecto: la
otra fue leer «57/10 0» en un screenshot cuando lo que se partía era la etiqueta.
**Antes de reparar lo que una medición señala, conviene comprobar que la medición
sabe leer lo que mide.**


## El gate visual canónico, en verde sobre las dos pestañas

`ui-quick-check` con proyecto real, las dos direcciones, los dos viewports y
`--require-geometry --fail-on-issues`:

| | capturas | grupos de geometría | issues | scroll jails | overflow | errores |
|---|---|---|---|---|---|---|
| **Simulación** | 2 | **8** | 0 | 0 | 0 | 0 |
| **Método** | 2 | **10** | 0 | 0 | 0 | 0 |

`geometryCoverageMisses=0` en ambas: no hay colecciones hermanas visibles sin
contrato declarado. Eso es lo que distingue el verde por conformidad del verde
por ausencia.

**Una `--ir` por corrida.** El primer intento pasó las dos direcciones juntas y
sólo midió la última: el runner captura la ruta, y la dirección que queda activa
es la del último `--ir`. Se descubrió mirando el screenshot, no el resumen — el
log dice «capturando /calc-muestra» y la URL del report no lleva la query. Con
dos corridas separadas, cada pestaña tiene su medición.

### Lo que el screenshot del gate destapó

El panel de Método sigue diciendo «reduce mejor el **solape**», la jerga reparada
en `893779ac`. **No es que el fix falle**: ese texto viene de la comparación ya
guardada en el `.pulso`, generada con el motor anterior. Las explicaciones nuevas
aparecen **al recomparar**; las corridas guardadas conservan el texto con el que
se generaron, que es lo correcto para un artefacto auditable.


## Higiene de servidores, al cerrar el gate

El gate visual levanta API y Vite propios y **los cierra solo** cuando no se pasa
`--keep-servers`: comprobado, ni el 8789 ni el 5175 quedaron vivos.

`make dev-status` destapó tres huérfanos STALE —27, 53 y 61 horas sin
conexiones—, y uno de ellos era un Vite que **esta misma sesión** había dejado
abandonado horas antes. `make dev-prune` los terminó y respetó los tres que
tienen conexiones activas, incluido el 5174 que sirve el navegador de trabajo.
El script nunca toca el 8787, que es del usuario.

Entorno verificado después: Método sigue respondiendo en 5174, 1,88 pantallas.


## Una corrida guardada traía la jerga de vuelta

El `.pulso` conserva el texto con el que se generó la corrida, que es lo correcto
para un artefacto auditable. Pero el efecto visible era éste, en la misma
pantalla y a 300 px de distancia:

| Superficie | Decía |
|---|---|
| Panel «Recomendado por el comparador vigente» | «reduce mejor el **solape**» (guardado, motor viejo) |
| Tarjeta del mismo método | «Sortea 500 muestras candidatas válidas, las audita…» |

Dos explicaciones del mismo método, una con jerga. `classroomMethodReasonVisible`
respeta la razón del motor **si está limpia** —puede llevar la razón concreta de
SU corrida, que el front no conoce— y la sustituye por la canónica si trae
términos que la UI no admite en ningún otro sitio. 5 tests.

### Y otra vez reparé donde miré, no donde vive

Conecté el selector en las **dos** superficies que encontré con `grep
operational_reason`… y la pantalla siguió diciendo «solape», porque el panel de
Método no lee ese campo directamente: lo lee `classroomMethodStoriesModel` para
componer `decision.reason`. Fue la **cuarta vez** en la jornada.

Lo que lo destapó no fue el grep sino **volver a mirar la pantalla después de
reparar**. Verificado ahora: cero jerga en el panel y cero en toda la pestaña.


## Verificar la fuente no es verificar el resultado — demostrado

Cuatro veces en la jornada reparé donde miraba y no donde vivía el defecto. La
causa común: **los contratos barrían archivos**, y el texto también llega por
datos —el `.pulso` guarda la explicación con la que se generó la corrida—.

`jergaPorDatos.contract.test.tsx` renderiza el panel de Método con razones
**sucias a propósito** y comprueba la salida. Reintroduciendo el defecto:

| Contrato | Qué mira | Con el defecto vivo |
|---|---|---|
| `copySinJerga` | los archivos de copy | **pasa los 8** — no lo ve |
| `jergaPorDatos` | el HTML renderizado | **mata 2** |

Los dos hacen falta: el primero impide que la jerga entre al código, el segundo
impide que llegue a la pantalla viniendo de donde venga. Y sólo el segundo habría
cazado las cuatro reparaciones incompletas de hoy.

**La regla, ya con evidencia**: un contrato que mira la fuente prueba que la
fuente está limpia. Si lo que importa es lo que el usuario ve, hay que mirar lo
que el usuario ve.


## Aplicando la lección: qué más llega por datos

Barrido de los textos que las dos pestañas reciben del motor:

- **`mc$note`** (`calc_muestra_aulas.R:4335`) es jerga pura —«MC de transparencia
  omitido: pi prescritas por diseño (pi_final = pi_design). Activa
  `selector$mc_prescribed_transparency`…»— pero **se escribe y no se lee en
  ningún sitio**. Es código muerto, no un defecto de pantalla. No se toca: R,
  fuera del encargo, y el archivo es congelado.
- **La nota que sí se pinta** decía «Simulación ejecutada con N corridas sobre el
  plan completo de **olas** y **pool presupuestado** de 500 candidatas». «Olas»
  es vocabulario establecido —la pestaña Reemplazos las nombra así y las dibuja
  como línea de tiempo— pero **en Simulación aparece sin contexto**, donde nada
  más habla de olas. Ahora: «sobre el plan completo de titulares y reemplazos y
  hasta 500 selecciones candidatas por corrida».

Sin crecer el congelado: 5.279 líneas antes y después.

### Un test R clavado a la redacción, otra vez

`expect_match(mc$note, "plan completo de olas")` se puso rojo. Protege un hecho
—que corrió sobre el plan completo, sin recorte por presupuesto— pero estaba
atado a la redacción. Afinado a `"plan completo"`.

**Es el mismo caso que «paso k»**, y esta vez el fallo previo fue mío: busqué
`method_label` en los tests antes de cambiarlo, pero no busqué el texto de la
nota. La comprobación vale cuando se hace para **cada** cadena que se toca.


## El worker de jobs va con el paquete instalado, no con el fuente

Comprobado sobre `<ruta de trabajo local>`:

| Cambio de esta jornada | ¿está en el instalado? |
|---|---|
| Nombres de método (`.cm_aulas_method_label`) | **sí** |
| Explicaciones sin jerga (`.cm_aulas_method_explanation`) | **sí** |
| Nota de la simulación («titulares y reemplazos») | **NO**, sigue con «olas» |

La asimetría dice que el paquete se reinstaló en algún punto de la jornada, entre
unos cambios y otros. Efecto práctico: **una corrida lanzada como job seguiría
emitiendo «plan completo de olas»** hasta que se reinstale, porque el worker
`callr` resuelve las funciones contra el paquete instalado.

**No se ejecuta aquí**: `R CMD INSTALL` toca la librería de R del usuario con la
app corriendo en el 8787. El comando, para cuando convenga:

```
R CMD INSTALL --no-docs --library="$R_LIBS_USER" api
```

Sin él, los tres cambios de R de hoy están bien en el fuente, en los tests y en
la vía síncrona; sólo la nota de la simulación se ve vieja si la corrida va por
job.


## Los estados que sólo ve quien empieza un estudio

`resolveAulasStageNotice` tiene siete ramas —falta el marco, falta el objetivo,
falta comparar, falta seleccionar…— y **ninguna se ve con un proyecto completo**,
que es el único con el que se ha trabajado todo el loop. Son justo los estados
que encuentra alguien empezando.

Ahí seguía **«las probabilidades Monte Carlo sí están acreditadas»**, en **dos
ramas casi idénticas** que sólo se diferencian en «Compara métodos» / «Vuelve a
comparar». Ahora: «la frecuencia con que sale cada aula al repetir el sorteo».

Reparar la primera y no la segunda habría sido la **quinta** vez en la jornada
que un defecto sobrevive en la ruta que no se miró. Se vio porque el `grep` contó
**2** ocurrencias, no porque yo revisara la segunda.

`copySinJerga` cubre ahora `aulasSurfaceState.tsx`; el mutante que devuelve
«Monte Carlo» a una sola rama mata 1.

**Por qué importa el archivo**: el barrido de pantalla no alcanza estos textos
—no se renderizan— y el contrato de copy no lo miraba. Entre los dos huecos,
siete ramas sin revisar en el módulo que un usuario nuevo ve primero.


## «Esto no está centrado y no tiene separación»

Gonzalo, señalando el botón «Usar método» de las tarjetas del comparador. Medido:

| | antes | ahora |
|---|---|---|
| Margen izquierdo / derecho | **12 / 199 px** | 12 / 12 |
| Separación con las cifras | **0 px** | 8 |
| Ancho del botón | 103 px en tarjeta de 314 | 290 |
| Botones alineados entre tarjetas | no | **sí** |

La causa: `.cmv2-classroom-method-card` era `display: block`, así que el botón
—`inline-flex`— quedaba en el flujo, pegado al bloque de arriba y alineado a la
izquierda. El texto **sí** estaba centrado dentro del botón; lo que no lo estaba
era el botón dentro de la tarjeta, que es la clase de distinción que sólo se ve
midiendo.

En columna con `gap`, el botón se estira al ancho y gana su aire; con
`margin-top: auto` los cuatro quedan al fondo y alineados entre sí, que es lo que
hace que la fila se lea como una fila.

Gate visual tras el cambio: **10 grupos de geometría, 0 issues, 0 coverage
misses**.


## «¿Esto significa que las aulas están mal?» — no, y medido

Gonzalo, sobre la lista de riesgos de Auditoría. El único aviso «para revisar»
era **«Baja profundidad de reservas · 5 celda(s) tienen menos reservas que
titulares»**. Medido sobre la selección definitiva:

- **84 celdas** (facultad × sexo esperado × tramo de tamaño). Cinco con menos
  reservas que titulares, y las cinco son el mismo caso: **1 titular, 0 reservas
  de su propio perfil**.
- **Cero titulares sin reemplazo, de 190.** Los cinco afectados tienen 2, 3 y 4
  reemplazos, todos **de otra celda de la misma facultad**: cambia el sexo
  esperado o el tramo de tamaño, nunca la facultad.
- Ratio global: **2,61 reservas por titular**.

| Celda | Reemplazos | De dónde |
|---|---|---|
| ARQUITECTURA / M / G4 | 3 | ARQUITECTURA / F / G4 |
| ARTE Y DISEÑO / M / G3 | 4 | ARTE Y DISEÑO / F / G2 y G1 |
| ARTES ESCÉNICAS / M / G4 | 4 | ARTES ESCÉNICAS / M / G1 |
| DERECHO / M / G1 | 2 | DERECHO / F / G1 |
| LETRAS Y CIENCIAS HUMANAS / M / G4 | 2 | LETRAS Y CIENCIAS HUMANAS / F / G1 |

El defecto no estaba en la muestra: **estaba en el aviso**, que decía el hecho y
callaba la consecuencia. Ahora: «Algunas celdas no tienen reserva de su mismo
perfil · En esas celdas el reemplazo sale de otra celda de la misma facultad…
Los titulares siguen teniendo reemplazo; lo que cambia es que no será del perfil
exacto». Sigue clasificado como **asunto**, porque el coordinador debe saberlo
antes de campo.

### Una medición mía que se equivocó, y cómo se cazó

La primera consulta dio **«5 titulares sin ningún reemplazo»**, que habría sido
una alarma grave y falsa: `replacement_for` guarda el **código de aula**
(`urb209_0601`), no el `selection_slot_id` (`slot_001`), así que comparaba campos
distintos. Se cazó porque contradecía una medición previa —«0 titulares sin
reemplazo»— y esa contradicción obligó a repetirla con el identificador correcto.

**Tercera vez en la jornada** que una medición mal hecha inventa un defecto, y la
única de las tres que habría llegado al usuario como alarma sobre su muestra.
