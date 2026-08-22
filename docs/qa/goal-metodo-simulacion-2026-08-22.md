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
| M5 | La jerga se glosa: CV de pesos, estabilidad, sistemático, balance | ◐ hecho CV y estabilidad; faltan los 7 balances y «sistemático por facultad» |
| M6 | La UI explica qué se hace con las 500 corridas | ☐ |
| M7 | Cada bloque declara qué mide, cómo y para qué | ◐ |
| M8 | Las dos pestañas bajan de 6,3 y 3,7 pantallas a algo legible | ◐ Método 5,5 · **Simulación 1,17** |
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

## Lo que queda de M5, medido en la app

Siete tarjetas seguidas que dicen sólo **BALANCE 35/100 Facultad · 69/100
Programa · 72/100 Nivel/ciclo · 91/100 Horario · 100/100 Modalidad · 39/100
Tamaño de aula · 50/100 Sexo**. Es exactamente lo que Gonzalo nombró: «hay
distintos mecanismos para medir el balance, hay distintos balances, no termino de
entender». Ninguna dice qué compara ni contra qué, y la peor (Facultad, 35) es
justo la dimensión que la vara del otro loop declara innegociable.
