# Contrato de la maqueta de lámina

Fecha: 2026-10-13 · Pedido de Gonzalo: «las maquetas tienen que ser mucho más robustas a distintas situaciones… no hay
probado y testeado maquetas para todos los tipos de gráficos que se vean elegantes, sean robustas a diferentes
situaciones y configuraciones».
Estado: **propuesta, pendiente de aprobación** (rehecha el mismo día: de réplica del PPT a ficha visual). Galería que lo pone en práctica:
`docs/qa/maqueta-galeria-maquetas-2026-10-13.html`.

## Qué es la maqueta

La maqueta es **la ficha visual de la lámina**: informa su naturaleza de un vistazo —qué composición tiene, qué tipo de
gráfico va en cada ranura, qué preguntas, qué públicos o actores intervienen, con qué escala y con qué ajustes— en una
forma creativa y elegante. **No imita el PPT**: lo que sólo el render puede decir (cifras, texto exacto, posiciones
finas) está en «Ver cómo queda».

Gonzalo (2026-10-13), sobre la maqueta de hoy: «no busca imitar por completo a la versión renderizada, sino que es útil
para el propósito de informar la naturaleza de la lámina: te dice qué tipo de gráfico es, te pone la leyenda en un
contenedor elegante, te indica qué actores intervienen… es una forma creativa y elegante de informarte acerca de esa
diapositiva sin atiborrarte de información poco relevante que ya puedes tener cuando renderices la lámina».

Lo que hoy falla no es ese enfoque, es su ejecución: el contenido no se centra ni se alinea, el dibujo es una plantilla
fija (4 barras siempre) que no refleja la configuración, sólo las multiapiladas tienen dibujo propio, y en situaciones
distintas (dos bloques con escalas distintas, ranuras chicas, eje ancho) no se adapta.

## Cláusulas

Cada cláusula se cita por su código (`M3 en lámina 12`), como las del Contrato de Superficie.

### M1 · Informa la naturaleza, no imita

Cada ranura con gráfico es una **ficha** con, en este orden de importancia:

| Pieza | Qué dice | Forma |
|---|---|---|
| Tipo | qué gráfico es | su ícono y su nombre («Multiapiladas», «Brecha entre dos grupos») |
| Dibujo | la forma del gráfico **con su configuración** | glifo sin textos: tantas barras como saldrán, agrupadas por tema, separadas por bloque, con la columna Top Two Box si está encendida |
| Preguntas | qué se grafica | la pregunta o «Tema · pregunta», recortada; con muchas, la primera y «y N más» |
| Públicos o actores | quién respondió | chips con su nombre |
| Leyenda | la escala | un contenedor elegante con las respuestas y sus colores; con escalas distintas, una por bloque |
| Ajustes | lo que cambia la lámina | chips: «Top Two Box», «Sale en 2 láminas», «2 bloques», «Por grupos: Sexo» |

No lleva cifras, ni el texto exacto del PPT, ni posiciones finas.

### M2 · Las proporciones de la composición son las reales

Cada ficha ocupa la ranura que tendrá su gráfico en la lámina de 13,333 × 7,5 in (`RANURAS_ESTANDAR`): dos gráficos
lado a lado se ven lado a lado, el de apoyo se ve chico. Dentro de la ficha, el dibujo refleja la forma (filas, bloques,
columnas) sin pretender la escala exacta.

### M1b · Los colores son los asignados

Gonzalo (2026-10-13): «las maquetas pueden tomar las paletas de colores que se les asigne, con hasta máximo 10 colores
diferentes fieles a los seleccionados, y si no están asignados se ponen en escala de gris». La barra, la leyenda y el
Top Two Box usan el color que la paleta (Estilo del informe › Paletas, o la de la pregunta) asigna a cada respuesta,
sin reinterpretarlo; hasta 10 respuestas con color propio. Una respuesta sin color asignado sale en gris, en una rampa
de oscuro a claro según su posición, y no en un color genérico: el gris dice «aún no tiene color» y no promete uno que
el PPT no usará.

### M3 · El contenido se centra en su ranura

El bloque de barras + leyenda se centra en vertical dentro de la ranura, y la leyenda se centra respecto a las barras.
Nada queda pegado a un borde por defecto.

### M4 · Se degrada, no se rompe

A menor ranura, la ficha sacrifica en este orden: la lista de preguntas pasa a la primera y «y N más» → los chips de
públicos pasan a un conteo («3 públicos») → la leyenda pasa a una tira de colores sin nombres → los chips de ajustes se
van → quedan el ícono, el nombre del tipo y el dibujo. **Nunca** se encima un texto sobre otro, se sale de la ranura ni
se recorta a medias.

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
