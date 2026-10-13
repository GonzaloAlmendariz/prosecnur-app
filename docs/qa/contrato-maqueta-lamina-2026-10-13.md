# Contrato de la maqueta de lámina

Fecha: 2026-10-13 · Pedido de Gonzalo: «las maquetas tienen que ser mucho más robustas a distintas situaciones… no hay
probado y testeado maquetas para todos los tipos de gráficos que se vean elegantes, sean robustas a diferentes
situaciones y configuraciones».
Estado: **propuesta, pendiente de aprobación**. Galería que lo pone en práctica:
`docs/qa/maqueta-galeria-maquetas-2026-10-13.html`.

## Qué es la maqueta

La maqueta es **la lámina en miniatura**: el analista la mira para saber cómo saldrá el PowerPoint sin exportar. No es
un ícono del tipo de gráfico ni una ficha con datos de la lámina. Si la maqueta y el PPT no coinciden, el defecto está
en la maqueta.

Hoy no cumple eso. El dibujo es una plantilla fija de 160 × 100 (4 barras siempre), la leyenda va como texto en una
columna aparte, el Top Two Box se dibuja como cajas verdes (en el PPT son cifras), no hay columna de la pregunta ni
nombres de los públicos, y la ranura no centra su contenido. Sólo las multiapiladas tienen un dibujo propio; los demás
tipos muestran el glifo genérico del selector.

## Cláusulas

Cada cláusula se cita por su código (`M3 en lámina 12`), como las del Contrato de Superficie.

### M1 · La anatomía es la del PPT

La maqueta dibuja las mismas piezas, en el mismo lugar, que el motor (`api/R/lamina_escala.R`,
`lamina_multilista.R`, `lamina_paneles.R`):

| Pieza | Dónde va | Qué lleva |
|---|---|---|
| Título | arriba a la izquierda, en coral, con el filete azul a su izquierda | el título real, recortado con «…» si no cabe en dos líneas |
| Logo | arriba a la derecha | la marca del informe |
| Columna de la pregunta | a la izquierda de las barras, centrada en vertical sobre las filas de su tema | la pregunta del tema |
| Nombre del público | antes de cada barra, alineado a la derecha | «Docentes» y, debajo, «116 respuestas» |
| Barras | el centro, con una marca donde irá la cifra cuando el segmento la admite | los colores de la paleta asignada, fieles, hasta 10 distintos; sin paleta asignada, grises de oscuro a claro |
| Top Two Box | columna a la derecha, encabezado «Top Two Box» | una **marca de cifra en verde** por fila, no cajas |
| Separador | entre temas | línea punteada a todo el ancho del gráfico |
| Leyenda | **centrada bajo las barras** (no bajo toda la ranura) | una compartida si todos los bloques usan la misma escala; si no, una bajo cada bloque |
| Base | abajo a la izquierda | el mismo texto que escribirá el motor |
| Número | abajo a la derecha | el folio |

### M1b · Los colores son los asignados

Gonzalo (2026-10-13): «las maquetas pueden tomar las paletas de colores que se les asigne, con hasta máximo 10 colores
diferentes fieles a los seleccionados, y si no están asignados se ponen en escala de gris». La barra, la leyenda y el
Top Two Box usan el color que la paleta (Estilo del informe › Paletas, o la de la pregunta) asigna a cada respuesta,
sin reinterpretarlo; hasta 10 respuestas con color propio. Una respuesta sin color asignado sale en gris, en una rampa
de oscuro a claro según su posición, y no en un color genérico: el gris dice «aún no tiene color» y no promete uno que
el PPT no usará.

### M2 · Las proporciones son las reales

- **Filas:** tantas barras como saldrán (temas × públicos o preguntas), no un número fijo.
- **Ancho de la columna de la pregunta** («Ancho de los temas»): el que tenga la lámina; si cambia, la maqueta cambia.
- **Ranura:** el gráfico ocupa la ranura de su composición, en pulgadas de la lámina de 13,333 × 7,5
  (`RANURAS_ESTANDAR`); un gráfico de apoyo de 3,7 in se dibuja a ese tamaño, no estirado.
- **Alto de barra:** el de una lámina real (como mucho 0,3 in); con pocas filas, sobra aire alrededor y no se engordan.

### M3 · El contenido se centra en su ranura

El bloque de barras + leyenda se centra en vertical dentro de la ranura, y la leyenda se centra respecto a las barras.
Nada queda pegado a un borde por defecto.

### M4 · Se degrada, no se rompe

A menor espacio, la maqueta sacrifica en este orden: las marcas de cifra de los segmentos chicos → «N respuestas» → la
leyenda en dos líneas → los textos se recortan con «…» → los textos pasan a trazos grises. **Nunca** se encima un
texto sobre otro, se sale de la ranura ni se recorta a medias (la lección de C2 en lámina 12).

### M5 · Cada configuración se ve

Lo que el analista cambia y altera el PPT, altera la maqueta:

- Top Two Box y Bottom Two Box encendidos, por bloque.
- Los cinco modos de multiapiladas (preguntas, una pregunta por grupos, preguntas por grupos, públicos por tema,
  bloques) y, dentro de bloques, escalas iguales o distintas.
- Ancho de los temas, orden de las respuestas, «resaltar la mayor».
- Si la lámina se partirá en varias, la maqueta lo dice («Sale en 2 láminas») y dibuja la primera parte.

### M6 · Todos los tipos tienen su maqueta

Cada graficador del catálogo tiene un dibujo propio, construido con sus datos reales y con la misma anatomía: barras
por categoría, dicotómica, apiladas y multiapiladas, ranking, brecha entre dos grupos, matriz de cuadrantes, radar,
nube, tabla, cifras, serie temporal, mapa. Un tipo sin dibujo propio es un defecto declarado en la galería, no un
glifo genérico en silencio.

Lo mismo vale para las **láminas de estructura** (Gonzalo, 2026-10-13: «deben haber maquetas para mostrar tipos de
láminas también, de forma elegante»): portada, índice, separador de capítulo, objetivo (con sus variantes y actores),
cómo leer, ficha técnica, recomendaciones y cierre se dibujan con la anatomía del recetario, no con un esquema genérico.

### M7 · Los vacíos se declaran

- Ranura sin gráfico: «Elegir gráfico» dentro de la ranura punteada.
- Gráfico sin pregunta: su forma en gris y «Falta elegir la pregunta».
- Sin datos todavía (cargando): la forma en gris, sin cifras inventadas.

### M8 · Los cambios se ven cambiar

Cuando el analista cambia algo, la maqueta pasa al estado nuevo con una transición corta (150–250 ms, curva de salida
suave): una barra que aparece crece, la columna Top Two Box entra desde la derecha, el ancho de la pregunta se desliza.
Nada se anima solo ni en bucle, y con «reducir movimiento» del sistema operativo no hay transiciones.

### M9 · La galería es la prueba

La galería de casos (una página con todos los escenarios) es parte del producto:

- Cada escenario tiene un test del modelo de la maqueta que fija su geometría (filas, columnas, leyendas, recortes).
- Cada escenario tiene una captura revisada; un cambio que altera una captura se revisa a mano.
- Un escenario nuevo que aparece en un estudio real (una configuración que la maqueta no mostró bien) entra primero a la
  galería y después se arregla.

### M10 · El panel lateral ofrece lo que la lámina admite

Gonzalo (2026-10-13): «que el contenedor del costado tenga más cosas que poder hacer, como en apilada y multiapilada
poder mostrar o quitar el número de respuestas por actor». Lo que el motor dibuja en la lámina y un analista podría
querer quitar o cambiar es un ajuste de la pestaña Gráfico, con su efecto visible en la maqueta (M5) y en el PPT. Se
agrega por inventario, no a ciegas: cada pieza de la tabla de M1 que hoy no tiene ajuste se revisa y se decide.

| Ajuste | Gráficos | Estado hoy | Propuesta |
|---|---|---|---|
| Respuestas por público («116 respuestas») | apiladas, multiapiladas | el motor siempre lo escribe (`lamina_escala.R` ~247 y ~302) | interruptor, encendido por defecto |
| Nombre del público junto a la barra | multiapiladas | siempre | se revisa en el inventario |
| Separador entre temas | multiapiladas | siempre | se revisa en el inventario |
| Marcas de cifra en segmentos chicos | apiladas, multiapiladas | por umbral fijo del motor | se revisa en el inventario |

## Escenarios mínimos de la galería

| # | Escenario | Qué prueba |
|---|---|---|
| 1 | Públicos por tema, 1 tema × 3 públicos, con Top Two Box | M1 completo |
| 2 | Públicos por tema, 2 temas × 3 públicos | separador, M3 |
| 3 | Temas con públicos distintos (docentes+administrativos / docentes+estudiantes) | filas reales, base unión |
| 4 | Preguntas, 4 preguntas de la misma escala | sin columna de público |
| 5 | Mismo gráfico con el eje angosto y con el eje ancho | M2 |
| 6 | Bloques con la misma escala | una leyenda compartida |
| 7 | Bloques con escalas distintas, Top Two Box sólo en uno | leyenda por bloque, M5 |
| 8 | Una pregunta por grupos (cruce por sexo) | grupos como filas |
| 9 | Escala de 7 respuestas | leyenda en dos líneas, M4 |
| 10 | Sí / No | dicotómica, sin Top Two Box |
| 11 | Lámina que se parte | M5 «Sale en 2 láminas» |
| 12 | Dos gráficos lado a lado | M2 ranuras |
| 13 | Gráfico principal y de apoyo (8,4 + 3,7 in) | M4 en la ranura chica |
| 14 | Dos gráficos apilados (2,2 in de alto) | M4 en altura |
| 15 | Cifras en banda y dos gráficos | composición mixta |
| 16 | Gráfico con texto a la derecha | composición con texto |
| 17 | Barras por categoría | M6 |
| 18 | Brecha entre dos grupos | M6 |
| 19 | Matriz de cuadrantes | M6 |
| 20 | Radar | M6 |
| 21 | Ranura vacía y gráfico sin pregunta | M7 |
| 22–28 | Portada, índice, separador, objetivo con actores, cómo leer, ficha técnica, recomendaciones | M6 estructura |

## Fuera de este contrato

- El texto exacto del PPT (eso es el motor); la maqueta lo aproxima con el texto real recortado.
- Las cifras: la maqueta no calcula porcentajes ni los inventa. Dibuja proporciones verosímiles y fijas por escala, y
  una marca donde irá cada cifra. Las cifras reales están en «Ver cómo queda».
