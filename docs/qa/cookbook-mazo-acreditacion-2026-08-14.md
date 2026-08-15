# Recetario del mazo de acreditación — valores medidos, no propuestos

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

Lo que sí cambió, y es donde está la receta:

| Barras en la lámina | 12-08 | 14-08 | Motor | Qué pasó |
|---|---|---|---|---|
| 1 | 0.492 | **0.583** | 0.423 | engrosó donde sobraba espacio |
| 2 | 0.436 | **0.566** | 0.490 | engrosó |
| 3 | 0.479 | **0.505** | 0.642 | engrosó |
| 4 | 0.472 | 0.411 | 0.604 | adelgazó |
| 5 | 0.512 | 0.511 | 0.573 | igual |
| 6 | 0.475 | 0.462 | 0.509 | igual |
| 7 | 0.420 | 0.394 | 0.458 | adelgazó |

**La corrección fue local, no global**: engrosar donde había hueco (1–3 barras) y
dejar que adelgace donde no lo hay (4+). El aprobado usa el espacio disponible;
el criticado dejaba aire muerto arriba y abajo.

Y nuestro motor falla **exactamente en el extremo opuesto** al que se corrigió:
con 1 barra hace 0.423 in donde el aprobado hace 0.583. Es literalmente el
comentario de la lámina 11 («el grosor podría estar más ancho, no se ve
estético») y el de la 13 («para que el círculo sea un poquito más grande»).

---

## Receta 1 — Grosor de barra en apiladas

El grosor **no es constante y no debe serlo**: es una función del número de
barras, acotada por arriba y por abajo.

| Barras | Grosor objetivo | Mínimo | Origen |
|---|---|---|---|
| 1 | 0.60–0.71 in | 0.55 | medido en 14-08 láms 20, 34 |
| 2 | 0.55–0.63 in | 0.50 | láms 32, 39 |
| 3 | 0.50–0.59 in | 0.45 | láms 23, 27, 35, 36 |
| 4–6 | 0.45–0.51 in | 0.39 | láms 25, 28, 40, 42 |
| 7–9 | 0.39–0.45 in | 0.32 | láms 22, 37 |
| 10+ | — | **0.32** | ver receta 2 |

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

Estado: `preservar_tamanos_texto` ya fija la letra. **El partido automático no
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

## La regla transversal: el motor dimensiona por defecto, no por espacio

Las recetas 1, 5 y 6 apuntan al mismo sitio. Puestas juntas:

| Caso | Motor | Aprobado | Diferencia |
|---|---|---|---|
| 1 barra apilada | 0.423 in | 0.583 in | −27 % |
| 2 barras apiladas | 0.490 in | 0.566 in | −13 % |
| 1 círculo solo | 1.654 in | 2.047 in | −24 % |
| 6+ barras apiladas | 0.509 in | 0.462 in | +10 % |

**Cuando sobra espacio, el motor no lo usa; cuando falta, lo compensa
encogiendo.** Es el mismo defecto visto desde los dos extremos, y explica de un
tirón cuatro familias de comentarios: «el pye está muy chiquito», «las barras
podrían estar más anchas», «se ve un poco vacío», «no se puede poner todo más
grande».

No hace falta un número por lámina. Hace falta que el elemento **crezca hasta
llenar su canvas** cuando hay holgura, con un tope, en vez de quedarse en su
tamaño de fábrica.

Esa es la receta madre del mazo, y probablemente el arreglo que más comentarios
cierra por línea de código.

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
| transversal | con 1–2 elementos, el grosor está en el tramo alto de su tabla | motor: −27 % ✗ |

Nueve de los diez se leen del `.pptx` sin abrirlo, así que el recetario entero
puede correr como gate. El que falta es el contraste del texto sobre la barra,
que necesita cruce por posición.

## Resumen: qué falla hoy y cuánto

| Receta | Motor | Aprobado | Estado |
|---|---|---|---|
| 1 · grosor apilada (1 barra) | 0.423 in | 0.583 in | ✗ −27 % |
| 2 · partir lámina > 9 premisas | no existe | — | ✗ |
| 3 · tamaños del juego de seis | 15.93, 15.99… | 14/13/12 | ✗ |
| 4 · naranja en la rampa | rojo | naranja | ✗ |
| 5 · grosor categórica | 0.28 in | 0.28 in | ✓ |
| 6 · círculo único | 1.654 in | 2.047 in | ✗ −24 % |
| 7 · y del título | 0.130 in | 0.355 in | ✗ |
| 8 · y del primer dato | 1.527 in | 1.658 in | ✗ |
| 9 · rojo en títulos | ✓ | ✓ | ✓ |
| 10 · interlineado | 100 % | 100 % | ✓ |

**Siete fallan, tres ya están bien.** Y de los siete, cinco son el mismo defecto:
el motor no usa el espacio disponible (1, 6) o coloca los elementos donde los
dejó el mazo criticado (7, 8), y el tercero (3) es el autoescalado que provoca
todo lo anterior.

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
| Grosor con 1 barra | 0.192–0.709 in — **varía 3.7×** |
| Grosor con 4 barras | 0.256–0.551 in — **varía 2.1×** |
| Grosor con 5 barras | 0.506–0.512 in — 1.01× ✓ |

Con el mismo número de barras, el mazo aprobado usa grosores que se diferencian
en más del triple. Eso no es una regla con excepciones: es **ausencia de regla**.
Son láminas ajustadas a mano, una por una, hasta que se vieron bien.

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
- **Las mediciones agregadas mienten dos veces**: la media mezcla barras con
  cabeceras (hay que usar la moda) y el conteo mezcla etiquetas con datos (hay
  que exigir forma sin texto). Las dos veces el resultado erróneo era plausible.
