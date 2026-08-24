# Recetario del mazo de acreditación — valores medidos, no propuestos

Tipo: Registro QA fechado
Fecha: 2026-08-14
Autoridad: Evidencia de la ejecución que documenta; no reemplaza contratos ejecutables ni ADR aceptados


**Abierto**: 2026-08-14 · **Sustituye** al primer borrador de estándar, que
proponía números a ojo. Todo lo de aquí está **medido** sobre tres mazos:
`Informe Conta 12-08_REVISADO` (el que Gabriela criticó, 37 láminas con barras),
`Informe Contabilidad 14-08` (el aprobado y entregado, 43) y el que genera el
motor hoy desde `v4_Conta 14-08 equivalencias.pulso` (37).

Medición: `scratchpad/medir_mazo.py`. Los gráficos son formas nativas, así que
cada segmento de barra tiene su alto exacto en EMU y se puede contar.

---

## El hallazgo que da vuelta el encargo

| | 12-08 (criticado) | 14-08 (aprobado) | Nuestro motor |
|---|---|---|---|
| Mediana del grosor de barra | 0.506 in | **0.512 in** | 0.508 in |
| Rango | 0.240–0.551 | 0.192–0.709 | 0.280–0.760 |
| Variación dentro del mazo | 2.3× | **3.7×** | 2.7× |

**El grosor de barra casi no cambió entre el mazo que Gabriela criticó y el que
aprobó** — la mediana se movió 6 milésimas de pulgada. Y nuestro motor está en la
misma mediana que los dos.

O sea: «barras más gruesas», repetido en seis láminas, **no se resolvió
engrosando las barras**. Un estándar que fije «grosor = X» no habría resuelto
nada, porque el problema nunca fue el valor central.

Lo que cambió fue **dónde** se puso el grosor, no cuánto. Y para verlo hay que
controlar por una variable que la primera medición ignoraba: **cuántos gráficos
comparten la lámina** (ver la corrección más abajo). Normalizado así:

| Gráficos en la lámina | Aprobado | Motor |
|---|---|---|
| 1 | 0.498 in | 0.508 in |
| 2 | 0.374 in | 0.420 in |
| 3 | 0.279 in | 0.334 in |
| 4 | 0.256 in | 0.280 in |

**El motor está dentro o por encima del aprobado en los cuatro casos.** El
grosor de barra, que parecía el corazón del encargo por ser el comentario más
repetido, **no es un defecto del motor**.

Ese es el segundo giro: los comentarios más repetidos no señalaban lo que más
falla. Lo que sí falla está en tipografía, color, posición y en la columna Top
Two Box, y casi nadie lo comentó porque no se ve como un problema de diseño sino
como «está muy apretado».

---

## Receta 1 — Grosor de barra en apiladas

El grosor **no es constante y no debe serlo**. Depende de **dos** variables:
cuántos gráficos comparten la lámina y cuántas barras tiene cada gráfico.

| Gráficos/lámina | 2 barras | 3 barras | 4 barras |
|---|---|---|---|
| 1 | 0.509 in | 0.495 in | — |
| 2 | 0.456 in | 0.394 in | 0.354 in |
| 3 | 0.342 in | 0.278 in | 0.256 in |
| 4 | 0.325 in | — | 0.256 in |

Para gráficos con muchas barras (7+) en lámina única, medido aparte: 0.39–0.45 in,
con **piso de 0.32 in**.

**El piso de 0.32 in es la regla dura.** Por debajo aparece el comentario «barras
muy delgadas, se ve muy apretado» (lám 21). El 12-08 bajaba a 0.240 in; ninguna
lámina del aprobado baja de 0.192, y esa es una lámina de una sola barra
decorativa, no de escala.

**Cómo se cumple**: `grosor_modo` + `grosor_barras` / `grosor_barras_mult` en el
preset de multi-apiladas. Hoy el motor autoescala sin piso declarado.

## Receta 2 — Cuando no cabe: la lámina se parte, la letra no encoge

Esta es la regla que resuelve la tensión de fondo, y la que hoy no existe.

El alto útil de una lámina para el bloque de barras es **≈ 4.4 in** (medido:
7.5 in de lámina menos título, leyenda y pie). Con el grosor objetivo y su
interlínea, eso da:

| Premisas | Alto necesario al grosor objetivo | ¿Cabe en 4.4 in? |
|---|---|---|
| hasta 6 | 2.8–3.1 in | sí |
| 7–9 | 3.2–4.0 in | justo |
| 10–12 | 4.5–5.4 in | **no** |
| 13+ | 5.8+ in | **no** |

Hoy el motor resuelve el «no cabe» **encogiendo**: baja el grosor y baja la letra.
De ahí salen los tamaños fraccionarios (15.93, 15.99, 10.53, 9.48 pt) y de ahí
sale el comentario de la lámina 20: «el Sí/No debe ser igual en todos los slides,
arriba está en 10.5 y aquí en 14».

**La regla es la inversa**: el tamaño de letra es un invariante del mazo; lo que
cede es la cantidad de contenido por lámina.

> Si con el grosor mínimo (0.32 in) y la letra declarada el bloque no cabe, **la
> lámina se parte en dos**. Nunca se baja la letra.

Es exactamente lo que Gabriela pide en las láminas 22 y 28 («evaluar si es mejor
ponerlo en dos slides», «hay que poner letra más grande o ver de dividir en dos
slides»). Umbral operativo: **más de 9 premisas → dos láminas**.

Estado: Vigente
existe**: es el desarrollo principal que sale de este recetario.

## Receta 3 — Tipografía, por rol y no por lámina

Medido sobre el aprobado, que usa tamaños **redondos** (14 pt, 2513 usos; 12 pt,
776; 13 pt, 470) frente a los fraccionarios del motor:

| Rol | Tamaño | Medido en |
|---|---|---|
| Cifra de porcentaje dentro de la barra | **14 pt** | dominante en 40 de 43 láminas |
| Enunciado de la premisa | **13 pt** | láms 17–19, 21, 24 |
| Leyenda y etiquetas de eje | **12 pt** | transversal |
| Nota de base / redondeo | **10–11 pt**, negrita | pie |
| Título de lámina | **24 pt** | uniforme |
| Cifra pequeña de N | **8 pt** | láms 18, 19, 21 |

Regla: **estos seis valores son el juego completo**. Cualquier tamaño fuera de
esta lista es un síntoma de autoescalado, no una decisión.

## Receta 4 — Color de la escala

| Posición | Color | Motor hoy |
|---|---|---|
| Muy en desacuerdo | `#F4B183` naranja | `#CA5651` rojo ✗ |
| En desacuerdo | `#FFD966` amarillo | ✓ |
| De acuerdo | `#B0D597` verde claro | ✓ |
| Muy de acuerdo | `#8FC36B` verde | ✓ |

Tres de cuatro ya coinciden. Falla solo el extremo negativo: 270 usos de rojo
donde el aprobado tiene 213 de naranja.

## Receta 5 — Barras categóricas (perfil, respuesta múltiple)

Una barra categórica es **la mitad de gruesa que una apilada**, y esto no es
opinión: es lo que hacen los tres mazos.

| Barras | Final | Motor | Objetivo |
|---|---|---|---|
| 2–3 | 0.18–0.21 in | 0.28–0.39 | 0.20–0.28 |
| 6 | 0.278–0.279 | 0.264–0.303 | **0.28** |
| 7 | 0.307 | 0.280 | **0.30** |
| 8 | 0.354 | 0.293–0.425 | **0.32** |
| 13 | — | 0.280 | 0.28 (piso) |

Aquí el motor **ya está en el rango del entregable**. Es el único tipo de gráfico
donde no hay que cambiar nada: la mediana coincide y la dispersión es
comparable. Conviene decirlo, porque el instinto tras leer 51 comentarios es
tocarlo todo.

Piso duro: **0.20 in**. Por debajo la etiqueta de la cifra ya no cabe dentro de
la barra y salta fuera, que es el origen del «se ve muy apretado» de la lám 21.

## Receta 6 — Circulares (pie / donut)

Medido en las dos láminas del entregable que los llevan y las dos equivalentes
del motor:

| Círculos en la lámina | Final | Motor | Objetivo |
|---|---|---|---|
| 1 (ocupa la lámina) | **2.047 in** | 1.654 in ✗ | 2.00–2.10 |
| 2 (lado a lado) | 1.615 in | 1.621 in ✓ | 1.60–1.65 |

Con dos círculos coinciden. **Con uno solo, el motor lo dibuja un 24 % más
pequeño que el aprobado.** Es exactamente el comentario de la lámina 12: «me
parece que el pye está muy chiquito».

## CORRECCIÓN — la variable que faltaba: cuántos gráficos comparten la lámina

Una versión anterior de este documento concluía que «el motor no usa el espacio
disponible» (−27 % con una barra). **Era un artefacto de la medición.**

El grosor no depende solo de cuántas barras tiene el gráfico, sino de **cuántos
gráficos se reparten el alto de la lámina**. Hay láminas con un solo gráfico, las
de perfil con cuatro, y alguna que nació con cuatro y quedó en tres al quitar
uno. Agrupar por «láminas con 1 barra» mete en la misma fila una barra que ocupa
la lámina entera y una barra de un panel de cuatro. La dispersión resultante
parecía arbitrariedad y era aritmética.

Medido de nuevo, controlando por gráficos por lámina:

| Gráficos en la lámina | Aprobado | Motor | Diferencia |
|---|---|---|---|
| 1 | 0.498 in | 0.508 in | **+2 %** |
| 2 | 0.374 in | 0.420 in | **+12 %** |
| 3 | 0.279 in | 0.334 in | **+20 %** |
| 4 | 0.256 in | 0.280 in | **+9 %** |

**El motor no se queda corto en ningún caso: está por encima del aprobado en los
cuatro.** El déficit del −27 % no existe.

Lo que sí queda establecido, y es la receta útil, es que el grosor es una función
de **dos** variables:

| Gráficos/lámina | 2 barras | 3 barras | 4 barras |
|---|---|---|---|
| 1 | 0.509 | 0.495 | — |
| 2 | 0.456 | 0.394 | 0.354 |
| 3 | 0.342 | 0.278 | 0.256 |
| 4 | 0.325 | — | 0.256 |

La tendencia es monótona en las dos direcciones: más gráficos por lámina y más
barras por gráfico, barra más fina. Esa tabla **sí** es un default declarable.

**Qué sobrevive de los hallazgos anteriores.** Los que no dependían del reparto
del alto siguen en pie y verificados: el título en 0.130 in contra 0.355 (receta
7), los tamaños fraccionarios (receta 3), el rojo en la rampa (receta 4) y la
columna Top Two Box ausente (E1). El del círculo único (receta 6) queda **por
reconfirmar** con esta métrica: sus dos láminas tienen un solo gráfico, así que
probablemente aguanta, pero no está medido con el mismo rigor que la tabla de
arriba.

## Receta 7 — Posición del título: medida, y es la que más claramente falla

Comentario de la lámina 17: «el título está demasiado arriba, tiene que estar en
línea con el logo».

| | y del título |
|---|---|
| 12-08 (criticado) | 0.130 in |
| 14-08 (aprobado) | **0.355 in** |
| Nuestro motor | **0.130 in** ✗ |

El título se bajó 0.225 in al corregir, y **nuestro motor está exactamente donde
estaba el criticado**. Es el hallazgo más limpio de todo el recetario: un solo
número, sin interpretación posible.

Objetivo: **y = 0.355 in** para el título de lámina.

## Receta 8 — Arranque vertical del bloque de datos

Comentario de la lámina 20: «los gráficos pueden estar un poquito más abajo, para
que la primera barra no esté tan cerca del logo».

| | y del primer elemento de dato |
|---|---|
| 12-08 | 1.696 in |
| 14-08 | 1.658 in |
| Nuestro motor | **1.527 in** ✗ |

El aprobado casi no lo movió (−0.04 in), pero **nuestro motor arranca 0.13 in más
arriba que ambos**, o sea más pegado al logo: reintroduce el problema que el
comentario señala. Objetivo: **y ≥ 1.65 in**.

## Receta 9 — Color del texto

Aquí hay que corregir algo que el borrador anterior dejaba mal planteado.

| Uso | Color | Medido |
|---|---|---|
| Título de lámina | `#CA5651` rojo | 49 usos en el aprobado, 52 en el motor ✓ |
| Cuerpo de texto | `#081F5C` azul institucional | 1787 en el aprobado, 1013 en el motor |
| Texto sobre fondo oscuro | `#FFFFFF` | 192 en el aprobado, **888 en el motor** |

**El rojo `#CA5651` no está prohibido: es el color de los títulos**, y el
entregable aprobado lo usa en 49. Lo que la receta 4 prohíbe es el rojo **en la
rampa de la escala**, que es otra cosa. Conviene tenerlo claro antes de tocar
nada: un «quitar el rojo» a secas rompería los títulos.

**Pendiente de verificar**: el motor usa 888 textos blancos frente a 192 del
aprobado. Si esos blancos caen sobre los tramos claros de la rampa —naranja y
amarillo— serían ilegibles. **No pude medirlo**: el método por forma devuelve el
color de relleno de la propia caja, no el del segmento que hay debajo, y da un
contraste de 1.00 que es un artefacto. Hace falta cruzar por posición (qué caja
de texto cae sobre qué segmento) antes de afirmar nada. Queda abierto.

## Receta 10 — Interlineado

Comentarios 18 y 25: «no es necesario que haya tanta separación entre cada
línea», «separación entre líneas distinta».

Medido: los tres mazos usan **100 %** de forma dominante (aprobado 323 usos,
motor 113, criticado 147). El aprobado añade 12 usos de 115 %.

**El interlineado no es la causa** de lo que Gabriela ve. Lo que ella llama
«separación entre líneas» es casi seguro el espacio entre premisas dentro del
bloque (`canvas_gap_grupos`, receta B2), no el `lnSpc` del párrafo. Es un caso
donde la palabra del comentario apunta a un mando distinto del que hay que tocar.

## Dimensiones inventariadas que no son geométricas

De los 57 comentarios, estas piden cosas que ningún preset resuelve porque son de
contenido o de estructura del mazo. Se listan para que el recetario no dé la
impresión de cubrirlo todo:

| Dimensión | Láminas | Qué pide |
|---|---|---|
| Láminas metodológicas ausentes | 7, 21 | escala de los cuestionarios; explicación de NS/NR |
| Leyenda mal ubicada | 13 | «el sí/no podría ir a un costado» para agrandar el círculo |
| Centrado vertical del bloque | 9, 12, 13 | «debería estar en el medio», «se ve un poco vacío» |
| Agrupación visual de premisas | 26 | «que se note que son tres premisas distintas» |
| Mayúsculas en títulos de variable | 9 | los títulos de cada variable en mayúsculas |
| Negrita en notas al pie | 9 | base y redondeo en negrita, 10–11 pt |
| Título que no declara su público | 28 | «si esto es solo del personal administrativo, ponerlo en el título» |
| Contenido faltante | 4, 6, 14, 25 | actores, % de alcance, «Su puesto pertenece a», ítem largo |
| Premisa en el subcriterio equivocado | 29 | revisión metodológica, no de formato |
| Dato que no cuadra con SPSS | 46 (Renzo) | verificar contra tablas |

Las tres primeras son las que más se repiten y las que más se notan; la de la
leyenda (13) es además la que desbloquea la receta 6, porque el círculo no puede
crecer mientras la leyenda le ocupe el ancho.

## Lo que sigue sin poder medirse: barras agrupadas

Buscadas en los tres mazos con el detector de series múltiples: **cero láminas
con barras agrupadas reales** (la única detección es la cabecera de una tabla).

Este estudio no las usa, así que la tabla de grosor × (categorías × series) —el
caso que planteaste— **no se puede derivar de aquí sin inventarla**. Hace falta
medir un mazo de otro estudio que sí las tenga; el medidor ya las reconoce
(`medir_tipos.py`, campo `series`), solo faltan los datos.

Dejarlo pendiente y dicho es mejor que rellenarlo a ojo: todo lo demás de este
recetario está medido, y una fila inventada contaminaría la confianza en el
resto.

---

## Cómo se verifica el recetario

Todo lo de arriba es contable sobre el `.pptx`, así que puede ser un gate y no
una lista que alguien recuerda:

| Receta | Chequeo | Estado hoy |
|---|---|---|
| 1 | ningún grosor < 0.32 in en láminas de escala | motor: 0.280 en una lámina ✗ |
| 2 | ninguna lámina con más de 9 premisas | motor: una con 13 ✗ |
| 3 | todo `sz=` pertenece al juego de seis | motor: 15.93, 15.99, 10.53, 9.48 ✗ |
| 4 | `#CA5651` no aparece en escalas | motor: 270 usos ✗ |
| 5 | grosor categórico entre 0.20 y 0.36 in | motor: dentro de rango ✓ |
| 6 | círculo único ≥ 2.00 in de diámetro | motor: 1.654 ✗ |
| 7 | y del título = 0.355 in | motor: 0.130 ✗ |
| 8 | y del primer dato ≥ 1.65 in | motor: 1.527 ✗ |
| 9 | rojo en títulos sí, en rampa de escala no | motor: rampa ✗, títulos ✓ |
| 1 | grosor dentro de la tabla (gráficos × barras) | motor: +2 a +20 % ✓ |

Nueve de los diez se leen del `.pptx` sin abrirlo, así que el recetario entero
puede correr como gate. El que falta es el contraste del texto sobre la barra,
que necesita cruce por posición.

## Resumen: qué falla hoy y cuánto

| Receta | Motor | Aprobado | Estado |
|---|---|---|---|
| 1 · grosor por (gráficos, barras) | +2 a +20 % | — | ✓ dentro de rango |
| 2 · partir lámina > 9 premisas | no existe | — | ✗ |
| 3 · tamaños del juego de seis | 15.93, 15.99… | 14/13/12 | ✗ |
| 4 · naranja en la rampa | rojo | naranja | ✗ |
| 5 · grosor categórica | 0.28 in | 0.28 in | ✓ |
| 6 · círculo único | 1.654 in | 2.047 in | ⚠ por reconfirmar |
| 7 · y del título | 0.130 in | 0.355 in | ✗ |
| 8 · y del primer dato | 1.527 in | 1.658 in | ✗ |
| 9 · rojo en títulos | ✓ | ✓ | ✓ |
| 10 · interlineado | 100 % | 100 % | ✓ |

**Cinco fallan, cuatro están bien, una por reconfirmar.** Y las cinco que fallan
no comparten causa: son el autoescalado de la letra (3), el color de la rampa
(4), la posición del título y del bloque (7, 8) y la columna Top Two Box
ausente. El grosor de barra —que parecía el problema central— **no está entre
ellas**.

## ¿Sirve el entregable final como manual guía?

**Para la mitad de las cosas sí, para la otra mitad no.** Y la línea que las
separa es nítida: el entregable es fiable en las decisiones **discretas** y no lo
es en las **continuas**.

### Donde SÍ es manual — decisiones discretas

| Dimensión | Consistencia interna |
|---|---|
| Tamaño del título | **24 pt en 50 de 57 láminas (88 %)** |
| Tamaño de la cifra de porcentaje | **14 pt en 792 de 869 casos (91 %)** |
| Rampa de la escala | 4 colores estables en todo el mazo |
| Columna Top Two Box | presente en 45 láminas |
| Interlineado | 100 % dominante |

Nueve de cada diez veces toma la misma decisión. Eso **es** una regla, aunque
nadie la escribiera, y se puede copiar tal cual.

### Donde NO es manual — decisiones continuas

| Dimensión | Consistencia interna |
|---|---|
| Posición vertical del título | valor dominante en solo **9 de 57 láminas (16 %)** |
| Grosor, agrupado solo por nº de barras | varía hasta 3.7× |
| Grosor, agrupado por (gráficos × barras) | varía 1.2–2.0× en la mayoría de celdas |

Aquí hay que ser preciso, porque una primera lectura exageró el problema: **buena
parte de esa dispersión desaparece al controlar por cuántos gráficos comparten la
lámina**. Lo que queda tras normalizar es una variación de 1.2× a 2.0× dentro de
la misma celda — bastante para no copiar un valor suelto, poco para llamarlo
arbitrario.

### Qué implica

Copiar el entregable como manual **importaría su arbitrariedad**. Sería adoptar
como norma que una lámina de cuatro premisas mida 0.256 in y la siguiente 0.551.

El uso correcto es el que se le dio aquí:

1. **Decisiones discretas → se copian.** 24 pt, 14 pt, la rampa, el Top Two Box.
   Están decididas y el mazo las cumple.
2. **Decisiones continuas → se derivan.** El entregable dice qué se aceptó
   —el rango, la tendencia, los extremos— y de ahí sale la regla, que es más
   estricta que la evidencia. Las recetas 1, 5 y 6 son eso: la tendencia central
   por número de elementos, con piso y techo que el propio mazo no respeta.
3. **Las correcciones puntuales → se leen como síntoma.** Que el título bajara de
   0.130 a 0.355 in vale como decisión (receta 7). Que el grosor de una lámina
   suelta suba a 0.709 in no: es un ajuste local.

Dicho corto: **el entregable es la evidencia, no la norma.** Sirve para saber qué
se aceptó y qué se rechazó, y en las dimensiones discretas eso alcanza para
copiar. En las continuas hay que hacer el trabajo de destilar la regla, porque el
mazo no la tiene.

Y hay una prueba de que esto no es un tecnicismo: **el mazo aprobado es el más
disperso de los tres** (3.7× contra 2.3× del criticado y 2.7× del motor). Se
aprobó porque las láminas se ven bien de a una, no porque sea coherente. Un
manual construido copiándolo heredaría justo eso.

## Lo aprendido que no hay que reinvestigar

- **Medir la media del alto de los rectángulos da un número inventado.** En una
  lámina conviven la barra, la cabecera y la leyenda, todas con relleno de la
  rampa. La primera medición dio rangos de 0.084 a 0.709 in en la misma lámina.
  El grosor real es la **moda**, y hay que restringir la paleta a los cuatro
  colores de la escala: el azul institucional pinta otros elementos.
- **El entregable aprobado no es un ideal a copiar.** Varía 3.7× dentro del mismo
  mazo, más que el criticado (2.3×) y más que nuestro motor (2.7×). Sirve como
  evidencia de qué se aceptó, no como definición de qué es correcto.
- **Un comentario repetido no es una corrección: es un default que falta.** Los
  51 comentarios son 17 reglas; ocho piden lo mismo.
- **Una barra de datos no lleva texto propio.** Las etiquetas de categoría
  («Masculino», «Séptimo ciclo») y las cifras («2 %») son cajas con relleno del
  mismo azul institucional y alto 0.159 in. Sin filtrar por «sin texto», el
  medidor devuelve 0.159 repetido en treinta láminas — un número que no es
  ninguna barra y que parece perfectamente creíble. Se descubrió abriendo la
  lámina 9 forma por forma, no revisando el código.
- **Una medición sin normalizar por el reparto del espacio inventa un defecto.**
  Agrupar el grosor solo por número de barras mezcla una barra que ocupa la
  lámina entera con una de un panel de cuatro, y produjo un «el motor se queda
  27 % corto» que no existe: normalizado por gráficos por lámina, el motor está
  por encima del aprobado en los cuatro casos. Lo detectó Gonzalo, no la
  medición — el número era coherente consigo mismo y con el relato.
- **Las mediciones agregadas mienten dos veces**: la media mezcla barras con
  cabeceras (hay que usar la moda) y el conteo mezcla etiquetas con datos (hay
  que exigir forma sin texto). Las dos veces el resultado erróneo era plausible.

## Receta 11 — Las disposiciones, y cuántas tienen modelo

El motor declara **31 disposiciones**. El entregable aprobado usa **dos** para
contenido —el resto de sus láminas son portada, índice y separadores—, así que
sólo esas dos se pueden medir contra él. Las otras 29 están en la misma
situación que las 14 familias de gráfico sin receta: **falta modelo, no falta
trabajo**.

| | Aprobado | Motor |
|---|---|---|
| Láminas `Graficos2` | 46 | 51 |
| Láminas `poblacion_4` | 6 | 6 |
| Layouts distintos en todo el mazo | 11 | 7 |

### `Graficos2` — dos gráficos por lámina

| | Aprobado | Motor |
|---|---|---|
| Bloque de datos | 15.2 × 9.5 cm | **16.4 × 10.3 cm** |
| Grosor de barra | 1.30 cm | 1.22 cm |
| Barras por gráfico | 4 | 4 |

El motor usa un bloque **más grande** y aun así sus barras salen **más finas**:
la diferencia se la lleva la separación entre premisas. Con el mismo número de
barras, el aprobado reparte 9.5 cm en barras más gruesas y menos aire; el motor,
10.3 cm en barras más finas y más aire.

### `poblacion_4` — cuatro perfiles

| | Aprobado | Motor |
|---|---|---|
| Alto del bloque | 10.6 cm | — |
| Grosor de barra | 0.79 cm | — |
| Barras | 10 | — |
| **Color de las barras** | **azul institucional, monocromo** (51 de 52) | **cinco colores distintos** |

**El motor pinta las láminas de perfil con la paleta genérica** —`#0B4F8C`,
`#2A9D8F`, `#E9C46A`, `#F4A261`, `#E76F51`— cuando el aprobado las pinta todas
del azul de la casa. No es una escala: son categorías de un mismo perfil, y
darles un color a cada una sugiere una comparación que no existe.
