# Checklist: comentarios de Gonzalo al recetario PPT moderno (2026-10-07)

Fuente: comentarios de PowerPoint en `4-recetario/recetario-moderna  -  Repaired.pptx` (41 comentarios en 38 láminas;
respaldo en el scratchpad de la sesión). Números de lámina del mazo de 161. Texto citado tal como lo escribió Gonzalo.
Herramientas: `docs/qa/motor-ppt-2026-10-06/herramientas/`. Estados: ☐ pendiente · ◐ en curso · ☑ hecho · ⊘ bloqueado.

| # | Lám. | Comentario (textual) | Dónde vive | Estado |
|---|---|---|---|---|
| C0 | todo | PowerPoint pidió reparar el archivo al abrirlo | `sanear_ph.py` / officer (H33, H71) | ☐ |
| C1 | 6 | «Estos elementos están desalineados con respecto al cuadro» | `recetario_m0.R` R2 | ☑ franjas sin rótulos dentro, alineadas al cuadro |
| C2 | 6 | «Debería haber quizás líneas como segmentos que muestren cada cosa que menciones con una leyenda y números» | `recetario_m0.R` R2 | ☑ marcas numeradas en el dibujo y guías en carriles que no se cruzan; margen como cota punteada |
| C3 | 8 | «"Nunca más de 74" suena a AI slop. "Se recomiendan entre tal y tal" suena mucho mejor» | `recetario_m0.R` R4 | ☑ «Se recomiendan entre 40 y 70 palabras» |
| C4 | 8 | «Todos los puntos del 1 al 4 tienen enunciados poco naturales que no responden a la diversidad de cosas que pueden suceder, como que el texto esté a la derecha o a la izquierda del gráfico» | `recetario_m0.R` R4 | ☑ cuatro miniaturas: texto a la derecha, a la izquierda, arriba y debajo, cada una con cuándo se usa |
| C5 | 9 | «Se ve mal por la redacción "lo que cambia"… Diferencia entre PPT y Word. Pero de todas formas este slide no es necesario aquí» | `recetario_m0.R` R5 | ☑ lámina retirada |
| C6 | 10 | «Esta tabla no es dinámica ni intuitiva. No se entiende» | `recetario_m0.R` R6 | ☑ lámina de ejemplo con cinco elementos marcados y una tarjeta breve por elemento |
| C7 | 11 | «Estos comentarios haciendo referencia a otros informes no son necesarios» | `recetario_m0b.R` | ☑ sin «(Ingeniería)» ni carreras en el pie |
| C8 | 12 | «La leyenda no está centrada… debería estar centrada a todo: no sólo al bloque del gráfico sino también a la leyenda y la barra extra» | `recetario_m0b.R` (`laminas_likert`) | ☑ leyenda centrada en todo el bloque, con la columna Top Two Box (bloque_likert) |
| C9 | 13 | «AI slop, mejor: "A continuación, un ejemplo de un informe de acreditación"» | `recetario.R` portadilla II | ☑ «A continuación, un ejemplo de un informe de acreditación» |
| C10 | 15 | «Me gusta porque es simple y cumple lo prometido, pero de la misma forma que con el índice, veamos forma de remasterizarlo» | `recetario.R` objetivo | ☑ rehecha tras «no me están gustando ese slide de objetivo»: de tres alternativas (`propuestas_objetivo.R`, `SOLO=objetivo`) Gonzalo eligió la sobria, con el objetivo en una frase de 22 pt, los temas en negrita y los seis actores en fila |
| C11 | 17 | «Este índice ya no va» | `recetario.R` índice del informe tipo | ☑ índice retirado del informe tipo |
| C12 | 18 | «Este tipo de slide ya no va» (número de respuestas por actor) | `recetario_m1b.R` | ☑ lámina retirada |
| C13 | 20 | «Cada tipo de redondeo tiene su propio slide: el estándar uno y el del resto mayor otro, ambos igual de profesionales y didácticos» | `recetario.R` redondeo | ☑ dos láminas, «Redondeo estándar» (suma 101%) y «Redondeo del resto mayor» (parte entera, resto, resultado), con el mismo ejemplo de 1, 7, 60, 110 y 0 casos |
| C14 | 22 | «Dicotómico de una sola fila: está súper bien pero los porcentajes pueden ser ligeramente menores» (aplica a todos) | `recetario_piezas.R` `dicotomia()` | ☑ cifras de toda dicotomía al 85 % |
| C15 | 22 | «Donde haya más de un gráfico en un slide se agrega la línea suave gris para diferenciarlos» | láminas de varios paneles | ☑ línea gris entre paneles en perfiles (22, 23, 24) y en dos gráficos (recetario_m2.R) |
| C16 | 23 | «Esto se tapa con lo de arriba, es un bug» | `recetario.R` perfil del egresado | ☑ barra más abajo y la base del panel baja cuando la pregunta ocupa dos líneas |
| C17 | 24 | «No sé si el mejor lugar para la leyenda sea aquí, en el caso de tres gráficos que comparten la misma leyenda. Este slide no termina de verse bien» | `recetario.R` perfil 2026 frente a 2021 | ☑ una sola leyenda abajo, centrada en los tres gráficos |
| C18 | 29 | «Leyenda no centrada» | `recetario.R` gestión y planificación | ☑ misma corrección que C8 |
| C19 | 36 | «Números algo menos grandes» | `recetario.R` situación laboral | ☑ de 32 a 27 pt (C14) |
| C20 | 37 | «Hay algo más de espacio que se pueda aprovechar mejor» | `recetario.R` tutoría socioemocional | ☑ pregunta como título del panel, barras gruesas centradas en la altura, leyenda debajo y lectura de 15 pt |
| C21 | 38 | «Esto no pinta en el motor cuanti» (recomendaciones) | `recetario.R` cierre | ☑ lámina retirada |
| C22 | 42 | «Leyenda no centrada» | `recetario_m2.R` | ☑ centrada en todo el panel |
| C23 | 44 | «Pareciera que los gráficos no compartieran el mismo ancho. Se ve poco regular» | `recetario_m2.R` | ☑ la dicotomía ocupa el mismo ancho que las barras vecinas |
| C24 | 56 | «Los KPIs me parecen súper bien, pero hay que definirlos, explicarlos: dónde pueden ir, si ocupan un gráfico, medio gráfico o un solo recuadro, qué proporción 50/50 o 30/70. No está claro, ni como elemento ni como feature» | `recetario_m2c.R` | ☑ dos láminas nuevas antes del perfil en cifras: «La cifra destacada» (valor 34 pt, rótulo 12 pt y detalle 10 pt, y cuándo se usa) y «Dónde va la cifra destacada» (columna lateral 30/70, banda superior a todo el ancho, un recuadro en lugar de un gráfico y mitad 50/50) |
| C25 | 63 | «La leyenda está muy pequeña y mal posicionada… aquí la leyenda es más pequeña que en otros gráficos, lo que me hace pensar que no se revisa bien» | `recetario_m3a.R` dona + revisión de tamaños de leyenda en todo el mazo | ☑ leyenda de la dona bajo el gráfico; todas las leyendas a 12 pt (16 llamadas tenían 10 a 11) |
| C26 | 65 | «Complementarlo con su alternativa en barras agrupadas elegantes» | `recetario_m3a.R` ranking | ☑ lámina nueva «Ranking en barras» con los mismos datos, la opción mayor en azul oscuro y los residuales al final |
| C27 | 69 | «Estas etiquetas pueden ser mejores y estar mejor posicionadas» | `recetario_m3c.R` puntos comparativos | ☑ cifras en la misma línea que sus puntos: la mayor a la derecha y la menor a la izquierda (`cifras_par`) |
| C28 | 70 | «Mismo comentario: mejores y mejor posicionadas» | `recetario_m3c.R` brecha | ☑ misma corrección y la diferencia entre públicos en azul neutro (antes en rojo) |
| C29 | 71 | «No has puesto el caso de varios años para que se vea algo mejor» | `recetario_m3c.R` serie temporal | ☑ lámina nueva con cuatro procesos (2012, 2016, 2021 y 2026) con la pieza `grafico_serie` |
| C30 | 75 | «El mapa de calor puede estar mejor, más claro y más didáctico; además no queda claro su caso de uso» | `recetario_m3d.R` | ☑ una sola escala de azul ajustada al rango de los datos, la diferencia con el total bajo cada cifra, asterisco en bases de menos de 15 y el uso en el subtítulo. Sin notas de lectura atadas al ejemplo (Gonzalo: «deben ser robustos a distintos tipos de actores y datos») |
| C31 | 76 | «No queda claro su caso de uso» | `recetario_m3d.R` | ☑ subtítulo con el uso (ver qué ítem sube o baja el índice de su dimensión) y la misma escala neutra ajustada al rango |
| C32 | 77 | «Se puede ver mejor y más profesional» | `recetario_m3d.R` comparativo de dimensiones | ☑ barras finas sobre un riel al 100 %, cifra al final, leyenda arriba y columna «Diferencia» con los puntos y el grupo a favor (rótulo tomado de los datos) |
| C33 | 79 | «Este slide no le compete al equipo cuanti» (FODA) | `recetario_m3d.R` | ☑ lámina retirada |
| C34 | 80 | «Podría servir para otro escenario: palabras, pares o tríos más comunes (quitando filler words) y al lado la categorización de esas respuestas de texto abierto en una pregunta de selección única o múltiple, de forma profesional» | `recetario_m3e.R` nube | ☑ lámina nueva tras la nube, «Pregunta abierta: frases y temas»: palabras sueltas y frases de dos y tres palabras más frecuentes (sin vacías ni relleno, cada persona una vez) y al lado la abierta categorizada en siete temas más Otros y Sin sugerencia, como opción múltiple. Datos en `preparar-datos/prep_m3e_texto.R`. Segunda lámina «Nube de frases» (Gonzalo: «no has agregado casos de mapa de palabras por pares o tríos»): nubes de frases de dos y de tres palabras repetidas por dos personas o más. Las frases ya no cruzan puntos ni comas |
| C35 | 81 | «No pintas nada ni muestras cómo se aplica para un solo grupo, dos grupos comparativos, etc.; la posición de la leyenda con el texto hace que el mapa se vea muy pequeño. Faltan más casos con más distritos y más ocasiones diferentes» | `recetario_m3e.R` mapa | ☑ cuatro mapas de resultados, no de avance (Gonzalo: «el propósito de estos mapas no es mostrar avances, es mostrar resultados»): distritos del estudio por grupo, zonas (UMP) aplicadas en un distrito, manzanas aplicadas dentro de un racimo de zonas, y zonas aplicadas en intervención y comparación. Cartografía real del motor (IMP PlanMet 2040 y zonas y manzanas INEI 2017) con una selección ficticia de semilla fija. Mapa a todo el alto y leyenda debajo |
| C36 | 90 | «Este foco semitransparente no está funcionando, repensémoslo; creo que una llave se ve más elegante» | `recetario_m4.R` filtro y subpregunta | ☑ llave bajo el segmento «Sí» con tallo hasta la subpregunta |
| C37 | 91 | «De la misma forma, una llave u otros elementos podría verse más elegante» | `recetario_m4.R` filtro al costado | ☑ llave a la derecha del «Sí» con tallo hasta el panel del ingreso |
| C38 | 97 | «No entiendo por qué siguen los índices aquí cuando ya hay otra propuesta al final. Revisa bien nuevamente el orden y la estructura de todo el PPT para que tampoco sea completamente repetitiva» | `recetario_m5.R` variantes de índice + orden global | ☑ variantes de índice retiradas de IV.2. La propuesta de reordenamiento (E1 a E9, abajo) se revisó y Gonzalo decidió dejar el orden como está (2026-10-07) |
| C39 | 110 | «No se entiende el caso de uso de este» (conteos por año) | `recetario_m5.R` | ☑ panel a la derecha con cuándo se usa y por qué una matriz, en términos generales y sin lectura atada al ejemplo |
| C40 | 122 | «Aún no termina de verse profesional; las etiquetas se ven algo sueltas» | `recetario_m6.R` estudio por olas | ☑ rehecha con `grafico_serie`: guías con escala, puntos con borde, cifras arriba o debajo según la serie y su nombre al final |
| C41 | 138 | «Integrar esto como un tipo de gráfico, está muy interesante» (línea de tiempo) | `recetario_m7.R` → catálogo III.3 | ☑ descartado por Gonzalo: «Mejor no agregamos la línea de tiempo, no la vamos a usar». Retirada también del banco de recursos |


Transversal (Gonzalo, 2026-10-07: «La leyenda no están centradas»): `leyenda()` mide la tinta real con systemfonts en vez de estimar por caracteres y junta los ítems cuando no cabe centrada. Medición sobre el PDF de la moderna (`medir_leyendas.py` del scratchpad, con `LEY_LOG`): 59 leyendas, 0 descentradas más de 0.06 in. Antes: 6, entre 0.14 y 0.8 in.
Transversal (Gonzalo, 2026-10-07: «a veces las letras negras no se ven bien con el color»): `texto_sobre()` elige el color de letra, blanco o azul oscuro, con mayor contraste. Los mapas de calor pasan a cinco tramos de azul que superan 4.5:1, el chevrón del banco de recursos pasa a azul claro con letra oscura y la versión fiel de los conteos por año colorea cada cifra según su segmento. `herramientas/auditar_contraste.py` revisa cada texto contra el relleno de debajo: sin casos bajo 4.5:1, salvo el coral de títulos y portadillas (4.2:1, texto grande) y las marcas magenta de las guías.

## Propuesta para C38: orden y estructura del mazo (moderna, 161 láminas). No aplicada: Gonzalo pidió «dejarlo como está»

Diagnóstico sobre la lista completa de láminas:

| # | Hallazgo | Láminas hoy | Propuesta |
|---|---|---|---|
| E1 | Texto abierto y mapas cuelgan de «III.4 Dimensiones e índices», con lo que no tienen relación | 80 a 86 | ☑ el rótulo «Top Two Box» y las cifras comparten el mismo centro (`likert_panel`) |
| E2 | «Qué podría mejorar la carrera» aparece tres veces con los mismos datos | 64, 65, 110 | ☑ la columna pasa de 0.75 a 1 in, con 0.1 in de aire tras la barra y el rótulo centrado sobre ella |
| E3 | Tres radares sobre la misma batería de competencias | 73, 74, 79 | ☑ respuesta: el motor no la tiene. `graficar_pie` sólo dibuja la leyenda estándar de ggplot, a la derecha o abajo. La lámina queda marcada como propuesta (rótulo «Gráfico de torta con leyenda de cifras» y nota en la base) |
| E4 | La partición con seis actores ocupa cuatro láminas casi iguales | 89 a 92 | ☑ sin riel blanco: guías finas cada 25 % detrás de las barras y la escala debajo |
| E5 | La cifra destacada está dos veces: en III.2 y en el banco de recursos | 53, 54 frente a 133, 134 | ☑ el motor ya lo permite: `p_dim_radar(inicio_eje_pct = 80)`. La lámina lo dice en el subtítulo |
| E6 | El embudo de la muestra es un gráfico, pero está en el banco de recursos | 139 | ☑ fuera el rótulo «Trabaja: 139» que pisaba el tallo; el tallo llega al centro del título de la subpregunta |
| E7 | Los perfiles de estudiante, egresado y docente se repiten en III.1, además de en II y III.2 | 41, 46, 48 | ☑ `barras_h(realzar = FALSE)`: las cinco barras en el mismo azul, sin destacar la mayor |
| E8 | «Cómo se lee un gráfico» y «Qué es cada elemento en PowerPoint» usan la misma lámina de ejemplo | 4, 9 | ☑ tercera versión, tras «sólo me gusta el dos y el último, pero el reemplazo de los logos me parece razonable; debe haber 4 propuestas sobrias en esa línea, sin comentarios de agradecimiento o cosas cliché»: cuatro cierres sobre la contraportada, con el logo centrado y el contacto con íconos de Lucide: banda azul al pie, banda clara al pie, contacto en una fila bajo el logo y contacto en tres columnas. La contraportada original sigue como última lámina |
| E9 | Las alternativas de índice ocupan 20 láminas: 4 composiciones por 5 situaciones | 141 a 160 | Dejar 8: cada composición con 5 capítulos y con 13 capítulos. Los subcapítulos se muestran una sola vez, en la composición que se elija |

Resultado: de 161 a unas 145 láminas, con la misma cobertura de constructores y sin repetir datos.

## Tanda posterior (2026-10-07)

| # | Pedido (textual) | Dónde vive | Estado |
|---|---|---|---|
| D1 | «faltan más ejemplos de llaves de dependencia» | `recetario_m4.R` (IV.1) | ☑ lámina nueva en la moderna: «Llave sobre varias categorías» (tres modalidades de trabajo habilitan la subpregunta). La de «Filtros en cadena» se retiró: «las subdependencias no se ven bien, mejor dejarlo sólo en dos» |
| D2 | «y en el banco de recursos usarlo» | `recetario_m7.R` (VI) | ☑ en «Figuras y conectores» la cuña pasa a «Llave de dependencia» y la llave verde a «Llave de suma». Lámina nueva «Llaves de dependencia» con tres usos (bajo una categoría, al costado y sobre varias categorías) y sus reglas |
| D3 | «además sigue perfeccionando» | todo el mazo | ☑ revisión visual de las 163 láminas de la moderna en hojas de contacto: sin defectos de maquetación. Retoques: fuera las dos menciones a Ingeniería Mecánica (pie del ranking y pregunta de la opción múltiple) y el título de la encuesta en aulas cabe en una línea |

## Segunda tanda de comentarios (Repaired del 2026-10-08, mazo de 163 láminas)

Respaldo del archivo comentado en el scratchpad de la sesión (`comentarios/repaired_2026-10-08.pptx`). Texto citado tal como lo escribió Gonzalo.

| # | Lám. | Comentario (textual) | Dónde vive | Estado |
|---|---|---|---|---|
| E1 | 35 | «El top 2 box no está centrado en la columna adicional» | `recetario.R` `bloque_likert` | ☑ el rótulo «Top Two Box» y las cifras comparten el mismo centro (`likert_panel`) |
| E2 | 43 | «La columna adicional necesita un poco más de espacio y que el título pueda ir centrado» | `recetario.R` `bloque_likert` | ☑ la columna pasa de 0.75 a 1 in, con 0.1 in de aire tras la barra y el rótulo centrado sobre ella |
| E3 | 61 | «¿Qué tipo de gráfico es este? Sé que es gráfico de pie pero la leyenda es particular, creo que el motor no tiene esta configuración, ¿o sí?» | `recetario_m3a.R` torta + motor `p_pie` | ☑ respuesta: el motor no la tiene. `graficar_pie` sólo dibuja la leyenda estándar de ggplot, a la derecha o abajo. La lámina queda marcada como propuesta (rótulo «Gráfico de torta con leyenda de cifras» y nota en la base) |
| E4 | 78 | «Las barras en una barra blanca atrás siguen sin convencerme del todo, que se vea bien definido» | `recetario_m3d.R` comparativo | ☑ sin riel blanco: guías finas cada 25 % detrás de las barras y la escala debajo |
| E5 | 79 | «Este está súper bien, me encanta que pueda ponerse un límite mínimo al eje que no sea cero sino 80 % por ejemplo y las diferencias se vean bien» | `recetario_m3d.R` radar + motor `p_dim_radar` | ☑ el motor ya lo permite: `p_dim_radar(inicio_eje_pct = 80)`. La lámina lo dice en el subtítulo |
| E6 | 97 | «Estos elementos se superponen con la flecha, hay que tener cuidado sobre cómo y dónde ponerlos» | `recetario_m4.R` llave sobre varias categorías | ☑ fuera el rótulo «Trabaja: 139» que pisaba el tallo; el tallo llega al centro del título de la subpregunta |
| E7 | 97 | «Ojo, la columna más grande no tiene que ir subrayada o más oscura que las demás» | `recetario_m4.R` + `barras_h` | ☑ `barras_h(realzar = FALSE)`: las cinco barras en el mismo azul, sin destacar la mayor |
| E8 | 163 | «También podemos tener alternativas editoriales para esta portada de cierre» | `recetario.R` cierre + `recetario_m8.R` | ☑ tercera versión, tras «sólo me gusta el dos y el último, pero el reemplazo de los logos me parece razonable; debe haber 4 propuestas sobrias en esa línea, sin comentarios de agradecimiento o cosas cliché»: cuatro cierres sobre la contraportada, con el logo centrado y el contacto con íconos de Lucide: banda azul al pie, banda clara al pie, contacto en una fila bajo el logo y contacto en tres columnas. La contraportada original sigue como última lámina |

## Propuestas rescatables de un informe de referencia (2026-10-08)

Pedidos: «haz la propuesta de todo lo rescatable en un ppt aparte para hacer comentarios y evaluar su integración»; sobre la primera versión, «parece un calco; lo que busco es inspiración en base a la línea gráfica de PULSO» y «nuestro motor genera gráficos y elementos cuantitativos, no barras de texto; me preocupa que el motor también tenga que hacerlo desde la app». El informe de referencia es confidencial y no entra al repo. `4-recetario/propuestas-rescatables.pptx` (12 láminas, `SOLO=rescatables`, `herramientas/propuestas_rescatables.R`), segunda versión: cada idea con recursos de PULSO y contenido calculado por el motor. Texto escrito en la app: sólo rótulos cortos, con los campos que Gráficos ya tiene (`texto` de las láminas narrativas). Pendiente: comentarios de Gonzalo.

| # | Propuesta | Lo calcula el motor | Dónde viviría | Estado |
|---|---|---|---|---|
| R1 | Número del capítulo como protagonista, sobre la portadilla actual | número y título del plan | `p_slide_seccion` + layout «Section Header» | ☐ en evaluación |
| R2 | Hallazgos clave en cifras (cifra destacada con ícono) | las cifras; el rótulo corto se escribe en la app | constructor nuevo `p_slide_cifras_clave` | ☐ en evaluación |
| R3 | Bottom Two Box junto al Top Two Box | toda la columna | `bloque_likert`, `likert_panel` | ☐ en evaluación |
| R4 | Peso de cada aspecto en la satisfacción, con puntos | todo, con regresión nueva | Analítica + graficador | ☐ en evaluación |
| R5 | Letras de significancia en la tabla resumen | las letras (ya existen en barras) | tabla de cruces del motor | ☐ en evaluación |
| R6 | Fila Total separada con filete gris | toda la fila | `bloque_likert`, barras apiladas | ☐ en evaluación |
| R7 | Pregunta exacta en el pie | sale del instrumento | pie de lámina del motor | ☐ en evaluación |

Fuera, por ser firma del informe de referencia o texto que no sale de los datos: fondo oscuro con cuña diagonal, láminas de bloques de texto, diagrama de flecha de factores y colores por factor.

### Comentarios de Gonzalo al mazo de propuestas (2026-10-08)

| # | Lám. | Comentario (textual) | Qué se hace | Estado |
|---|---|---|---|---|
| S1 | 3 | «Me gusta, no soy muy fan del cero delante, pero creo que podemos plantear esta y otras alternativas más elegantes también» | R1: número sin cero y cuatro variantes de separador de capítulo | ☑ número sin cero y cuatro variantes de capítulo: A número con filete, B número en anillo coral, C rótulo «Capítulo 2» sobre filete, D número grande de fondo en azul muy claro |
| S2 | 4 | «Quizás el subtítulo puede tener una identidad diferente para poder diferenciarlo» | R1: el subcapítulo con otra composición, distinta a la del capítulo | ☑ subcapítulo con otra composición: sin personas ni público, con la ruta del capítulo arriba, «2.1» en azul oscuro, filete coral y título |
| S3 | 7 | «Pensé que esto ya estaba. Hay que pensar muy bien esto porque como ya estaba en el recetario puede ser de 1 hasta 5, pero puede tener largo diferente y posiciones diferentes» | R2: no es un constructor nuevo, es la cifra destacada (C24) generalizada a 1–5 cifras, rótulos de largo distinto y posiciones distintas | ☑ rehecho como la cifra destacada de III.2 generalizada: una cifra frente a su gráfico, tres con rótulos de largo distinto y cinco (el máximo). Los detalles se alinean con el rótulo más largo |
| S4 | 8 | «Me gusta» | R3 y R6 aceptadas para integrar | ☑ |
| S5 | 9 | «Me gusta aunque entenderlo es algo complejo» | R4: hacer la lectura más simple | ☑ filas ordenadas por peso, columna «Cuánto pesa» y una explicación llana debajo («si sube la satisfacción con un aspecto, cuánto sube la general») |
| S6 | 10 | «Va, pero ver cómo perfeccionar» | R5: letras de significancia más legibles | ☑ la letra va a tamaño legible, en azul y separada de la cifra, con las letras de cada público bajo su encabezado y una línea que explica cómo se lee |
| S7 | 11 | «No va» | R7 retirada | ☑ |

### Segunda ronda de comentarios al mazo de propuestas (2026-10-08)

| # | Lám. | Comentario (textual) | Qué se hace | Estado |
|---|---|---|---|---|
| T1 | 3 | «Está bien pero creo que puede respirar un poquito con respecto a la línea punteada naranja de arriba» | Variante A más abajo | ☑ la variante A baja 0.35 in y respira bajo la línea punteada |
| T2 | 4 | «No va, el dos choca y no me gusta el diseño» | Variante B (anillo) retirada | ☑ retirada |
| T3 | 5 | «Bueno» | Variante C se mantiene | ☑ |
| T4 | 6 | «Bueno, pero el dos puede ser algo menos grande y respirar mejor» | Variante D con el número más chico y con margen | ☑ el número de fondo baja a 180 pt, a la derecha y con margen |
| T5 | 7 | «No está mal pero deben haber por lo menos 4 alternativas; además se tiene que sentir como un subtítulo y no como una portada que separa tan drásticamente» | Cuatro alternativas de subcapítulo, más ligeras que una portadilla | ☑ cuatro alternativas de subcapítulo sobre la lámina general: sobria (número y título en una línea), barra lateral coral, banda clara a lo ancho y sin lámina propia (el antetítulo de la primera lámina lleva «2.1») |
| T6 | 12 | «El dos está chocando con la línea, pero creo que esto es un error del motor del recetario en sí» | El filete de la fila Total deja aire para las cifras chicas de la fila siguiente | ☑ el filete va justo bajo la barra del Total y la fila siguiente baja 0.22 in: las cifras chicas ya no lo tocan |
| T7 | 12 | «Las notas de pie deben estar entendibles» | Pies en lenguaje llano, sin nombres de funciones | ☑ pies en lenguaje llano: qué es cada indicador y la base, sin nombres de funciones |
| T8 | 13 | «Expresión muy coloquial» | Explicación del peso en registro formal | ☑ «El peso indica qué parte de la satisfacción general explica cada aspecto, según una regresión lineal…» |
| T9 | 14 | «Está bien pero indicar el procedimiento estadístico o la prueba utilizada; además, ¿no hay una forma elegante y gráfica de mostrar la significancia también? Quizás otros slides con gráficos y tabla» | Nota con la prueba del motor (z de diferencia de proporciones, Bonferroni, α = 0.05) y dos láminas gráficas: barras agrupadas con letras y puntos por público | ☑ nota con la prueba del motor (z de diferencia de proporciones, Bonferroni, α = 0.05) y dos láminas: barras agrupadas con la cifra dentro y la letra encima, y puntos por público con una línea azul sólo entre públicos con diferencia significativa |

### Significancia: tabla y gráfico, con la prueba calculada (2026-10-08)

Pedido: «una tabla de significancia se lee mejor cuando es una tabla y un gráfico al lado que muestre esa significancia… hay que encontrar una forma no sólo creativa, sino también estadísticamente válida… antes, revisa artículos estadísticos de fuentes confiables».

Corrección honesta: las letras de la versión anterior eran ilustrativas y no salían de ninguna prueba; con los conteos reales, Auditoría 96 % (n = 51) frente a 91 % (n = 109) no es significativa (p = 0.24). Ahora todo se calcula.

| # | Lámina | Qué muestra | Fuente | Estado |
|---|---|---|---|---|
| U1 | Cómo mostrar una diferencia significativa | Tres reglas: no juzgar por solapamiento; graficar la diferencia con su intervalo; con tres o más grupos, comparar por pares con corrección | Schenker y Gentleman 2001; Cumming y Finch 2005; Gardner y Altman 1986; Wright, Klein y Wieczorek 2019; Newcombe 1998; Piepho 2004 | ☐ en evaluación |
| U2 | Docentes y estudiantes en seis preguntas | Tabla a la izquierda y, al lado, la diferencia en puntos con su intervalo de 95 % (Newcombe). Significativa si no cruza el cero; coincide con la prueba z del motor en las seis filas | Wright et al. 2019, método II | ☐ en evaluación |
| U3 | Conocimiento de la misión en los cuatro públicos | Tabla con letras calculadas (prueba del motor: z combinada, Bonferroni en la fila, α = 0.05) y matriz de pares sombreada | Wright et al. 2019, método I; Piepho 2004 | ☐ en evaluación |

Resultados reales: docentes frente a estudiantes es significativa en conoce la misión (+21, p < 0.001), sabe dónde consultarla (+12, p = 0.043) y tutoría académica (+30, p < 0.001); no en tutoría socioemocional, Auditoría ni Tributación. Entre los cuatro públicos sólo docentes supera a estudiantes y a egresados; administrativos (+16, n = 15) no alcanza. Nota en la lámina: con muestras censales o por conveniencia las pruebas son indicativas.

Refinamiento (2026-10-08, «están muy bien pero falta perfeccionarlos, hacerlos más sofisticados»): U1 pasa a «Por qué se grafica la diferencia», con un caso real (sabe dónde consultar la misión: intervalos de Wilson que se solapan y diferencia de +12 puntos [0.2 a 21.4], p = 0.043). U2 pasa a un forest plot integrado a la tabla, dibujado con formas nativas, agrupado por tema y con el intervalo en números y la p. U3 pasa a una tabla con barras y letras, junto a una matriz de pares con los porcentajes en la diagonal, la p ajustada en cada celda y la intensidad según la diferencia.

Dos niveles de lectura (2026-10-08, «debe haber una versión avanzada como la que muestras, pero también una versión entendible para un público general»): U2 y U3 quedan como «versión técnica» y se agregan G2 («Dónde docentes y estudiantes se diferencian de verdad»: dos puntos por pregunta, la distancia marcada sólo si es una diferencia clara y la etiqueta en palabras) y G3 («Los docentes son quienes más conocen la misión»: barras ordenadas, el público que se distingue en azul oscuro, una llave que agrupa a los que no se distinguen y la base chica en barra punteada). Mismos datos y misma prueba; sin p ni intervalos.

Corrección de término (2026-10-08, «diferencia clara no es lo mismo que diferencia significativa»): las versiones para público general dicen «significativa» o «no significativa», y la nota aclara que la prueba indica que es poco probable que la distancia se deba al azar, pero no si la diferencia es grande o importante (los administrativos, +16 puntos con 15 casos, no son significativos).

Tres niveles con los mismos gráficos (2026-10-08, «el público general también puede entender esas gráficas; no necesita el p de cada caso; no debemos asumir que la persona es tonta»): el forest plot y la matriz se dibujan con una función que tiene versión técnica (intervalo en números y p de cada caso) y versión estándar (diferencia en puntos y «significativa» o «no significativa», con α = 0.05 una sola vez). Nueva lámina «tabla de letras y gráfico»: la tabla sobria con A, B y C (letras calculadas con la prueba del motor) y al lado, alineado fila por fila, los públicos como puntos con una línea azul sólo entre los que difieren de forma significativa. Resultados reales: docentes supera a estudiantes y egresados en conoce la misión; egresados supera a estudiantes en Auditoría (98 % frente a 91 %, p = 0.018); el resto no es significativo. Las dos láminas para público general se mantienen.

Paneles por par (2026-10-08, «este gráfico para mostrar dos significancias simultáneas no me convence»): el gráfico de puntos con una línea entre públicos se reemplaza por tres paneles de diferencias (A menos B, A menos C, B menos C), alineados con las filas de la tabla de letras. Cada par muestra su diferencia con el intervalo de Newcombe ajustado por Bonferroni (3 pares) y el punto lleno cuando no cruza el cero; en los 24 pares el intervalo y la prueba del motor coinciden. Dos significancias simultáneas (conoce la misión: A > B y A > C) se ven como dos marcas en dos paneles; Auditoría (C > B) aparece sólo en B menos C.

Armonía (2026-10-08, «perfeccionar todos los gráficos, afinarlos y que sean más armónicos y orgánicos»): un lenguaje común para las ocho láminas de significancia, con piezas compartidas (`panel_fondo`, `guia_v`, `eje_txt`, `intervalo`, `punto`). Panel gris claro con guías blancas y el cero marcado; intervalos con extremos redondeados; un solo tamaño de punto (lleno azul: significativa; hueco gris: no); tablas sólo con filetes, sin filas alternadas; celdas de la matriz con esquinas redondeadas; ejes en 9.5 pt.

### Integración al recetario (2026-10-08, «ya está listo para que todo sea integrado al recetario»)

Las secciones de `propuestas_rescatables.R` pasan a ser funciones (`rr_cifras`, `rr_peso`, `rr_significancia`, `rr_b2b`, `rr_separadores`) que llaman el mazo de propuestas y el recetario moderno; el antetítulo cambia «Propuesta N» por el tema. Sólo en la moderna: la fiel conserva su convención. La moderna pasa de 167 a 189 láminas.

| Pieza | Dónde quedó en el recetario moderno | Estado |
|---|---|---|
| Cifras destacadas de 1 a 5 (una, tres y cinco) | III.2, tras «Dónde va la cifra destacada» (láminas 55 a 57) | ☑ |
| Peso en la satisfacción | III.4, tras el comparativo de dimensiones (82) | ☑ |
| Diferencias significativas (método, tabla de letras con paneles, forest técnico y estándar, matriz técnica y estándar, dos para público general) | Sección nueva III.5 con portadilla (91 a 99) | ☑ |
| Bottom Two Box y fila Total | IV.2, al final de escalas (131) | ☑ |
| Separadores de capítulo (A, B, C) y subcapítulo (1 a 4) | VII, entre las alternativas de índice y los cierres | ☑ |
| «Qué se propone» y «Lo que no se trae» | Sólo en el mazo de propuestas | ☑ |

Auditoría: moderna 189 láminas, fiel 168, propuestas 24; sin formas fuera de la lámina, marcadores vacíos, caracteres vetados ni contraste bajo; ningún «Propuesta N» en el recetario.

## Reestructuración como propuesta de diseño (2026-10-08)

Pedido: «ajustar el orden y la estructura del recetario para que se vea profesional… empezar por una presentación de una propuesta de diseño del PPT en PULSO PUCP… 1. reglas de identidad y todas las portadas y cierres con sus alternativas… 2. tipos de gráficos… 3. tipos de láminas… 4. estudios en PULSO… 5. banco de recursos… unas 250 diapositivas por lo menos». Plan: `~/.claude/plans/lucky-meandering-hellman.md`. Decisiones: sólo la moderna; cifras ficticias sin nombrar instituciones; parte 3 con ficha y ejemplos.

| # | Fase | Qué | Estado |
|---|---|---|---|
| V1 | Infraestructura | Cada lámina se registra con su sección («m3a:2»); `reordenar.py` la ubica según `recetario_estructura.json`, falla si sobra o falta una y renumera los folios. Portadillas antiguas (I a VII) omitidas en la moderna | ☑ |
| V2 | Orden con lo existente | Apertura (portada de la propuesta, cómo está organizada, principios) y cinco capítulos con portadilla de capítulo (separador con rótulo) y de subcapítulo (sobria): 209 láminas | ☑ |
| V3 | Láminas nuevas | Lámina estándar medida y escala tipográfica; 3 portadas y 2 objetivos alternativos; histograma, dicotómica y nube solos; catálogo de 32 tipos (3 láminas) y una ficha medida por tipo seguida de sus ejemplos; 2 láminas de combinaciones; 13 láminas de estudios con cifras ficticias sin instituciones (varios programas, línea base, PDM, aulas, organizacional, antes y después) | ☑ |
| V4 | Banco en positivo | «Cómo combinar los íconos» y «Cómo combinar las cajas» (ejemplo y por qué funciona); «nunca» reescritos; «uso excepcional» y «propuesta en lugar del radar» como alternativas. La fiel conserva su versión | ☑ |
| V5 | ≥ 250 láminas y revisión visual completa | 275 láminas; hojas de contacto revisadas; auditoría: 0 vetados, 0 marcadores vacíos, 0 «evitar» o «nunca», 0 formas fuera, 0 contraste bajo. Nota: `xml_audit.py` numera por el archivo slideN.xml, no por el orden tras reordenar | ☑ |

### Revisión crítica de la propuesta (2026-10-08)

| # | Comentario | Qué se hizo | Estado |
|---|---|---|---|
| W1 | «Primero tienes que presentarla: qué es la lámina estándar, dónde va el título, el antetítulo, la pregunta» | Lámina nueva «La lámina estándar» antes de las medidas: miniatura fiel a la plantilla con ocho elementos marcados y su guía. La lámina de medidas pasa a la siguiente y luego «Cómo se lee un gráfico» | ☑ |
| W2 | «Qué es cada elemento en PowerPoint… círculos ovalados que podrías reemplazar con el logo de PULSO» | Rehecha sobre la misma miniatura, con el logo real de la plantilla y marcas con líneas guía | ☑ |
| W3 | «En las portadas el informe consolidado no se ve bien, la línea gris choca con la naranja; hay una portada que no es en la que quedamos» | Portada alineada a la izquierda respeta la línea coral de la plantilla (título arriba, encargo debajo); portada con el público retirada | ☑ |
| W4 | «Ojo crítico» | Revisión de las 274 láminas: ficha técnica («administrativos» cortado), cifra del caso multiprograma encimada, referencias a la numeración antigua (IV.1), «la moderna» y «uso excepcional» en pies; antetítulos de 1.1 unificados | ☑ |
| W5 | «Cuida que los números dentro del círculo morado estén centrados» | El número de cada marca va anclado al centro del círculo y sin márgenes internos (`sanear_ph.py`, cuadros «Centro…») | ☑ |

### Comentarios al mazo de 274 láminas (2026-10-08, tercera tanda)

| # | Lám. | Comentario (textual) | Qué se hace | Estado |
|---|---|---|---|---|
| X1 | 6 | «El logo se ve estirado horizontalmente» | Logo de la miniatura con su proporción real | ☑ el logo reproduce el recorte de la plantilla (arriba 29.471 %, abajo 26.643 %) |
| X2 | 6 | «La leyenda no debería estar abreviada» | Leyenda completa en la miniatura | ☑ leyenda completa, centrada en el gráfico |
| X3 | 7 | «No explica cómo el grosor de la barra cambia en función del número de categorías» | Tabla del grosor según categorías en la lámina de medidas | ☑ tabla de grosor según filas: escalas 0.50 a 0.32 in y barras de categorías 0.26 a 0.32 in |
| X4 | 7 | «Indicas leyenda pero el gráfico que muestras no usa una porque es barras agrupadas» | Medidas sobre un gráfico que sí lleva leyenda (escala con Top Two Box) | ☑ la lámina de medidas usa una escala con leyenda y Top Two Box |
| X5 | 115 | «Los elementos salen de sus cuadrículas… estamos proponiendo nuevos estilos con borde gris suave para gráficos y nuevas estructuras: más fiel al nuevo modelo» | Esquemas del catálogo y de las fichas rehechos: retícula medida y paneles con borde gris suave | ☑ esquemas fieles al nuevo modelo: fondo de la plantilla, logo real, cada gráfico en un panel blanco con borde gris suave y barras de muestra, textos con su filete, todo dentro de su caja |
| X6 | 131 | «Las líneas grises están chocando con los gráficos» | Separadores con aire en Dos gráficos con texto a la izquierda | ☑ la línea gris baja bajo la dicotómica |
| X7 | 146 | «No muestras ejemplos» (tres gráficos en fila) | Ejemplo para cada ficha que no lo tiene | ☑ ejemplos nuevos para texto y tres en fila; cada ficha va seguida de su ejemplo |
| X8 | 151 | «Los de población ya no son tan necesarios porque ahora hay motores para hasta 6 gráficos; el ícono es una customización, no un estilo exclusivo» | Población se integra como variante (con ícono) de las láminas de 2 a 6 gráficos | ☑ población deja de ser familia: dos gráficos con ícono, cinco y seis gráficos son tipos generales (el ícono es una opción de cualquier lámina) |
| X9 | 156 | «Son estilos geniales, pero ya no son exclusivos para población» | Tira y corona pasan a tipos generales de tres gráficos | ☑ tira y corona son tipos generales de tres gráficos |
| X10 | 158 | «Según tu guía las cifras pueden ir en varias formas y aquí sólo muestras una» | Cifras en sus cuatro ubicaciones con ejemplos | ☑ sección 3.5 con las cuatro ubicaciones: columna lateral, banda superior, en lugar de un gráfico (ejemplo nuevo) y mitad y mitad, más tres y cinco cifras |
| X11 | 175 | «Estas láminas ya no son necesarias, lo haces al inicio en el capítulo anterior» | Fichas de portada, objetivo, ficha técnica, Top Two Box, redondeo, índice y separador fuera del capítulo 3 | ☑ fichas de portada, objetivo, ficha técnica, Top Two Box, redondeo, índice y separador retiradas del capítulo 3; quedan 22 tipos |
| X12 | 178 | «Mencionas que funcionan pero no brindas ejemplos que lo demuestren» | Cada combinación con su ejemplo real | ☑ resumen de seis combinaciones y cinco láminas con datos (dicotómica y subpregunta, escala y ranking, cifras y perfil, serie y cifra del cambio, mapa y tabla); la sexta remite a 2.8 |
| X13 | 184 | «Por qué aquí en las dos primeras opciones no sale la cuenta x de y» | «x de y» en toda fila con base chica | ☑ si una fila del bloque tiene menos de 30 casos, todas sus filas dicen «x de y» |
| X14 | 202 | «Este tipo de gráfico no lo mencionas en la librería de gráficos» | Conteos por año (matriz) al capítulo 2 | ☑ conteos por año pasa a 2.3, Números y distribuciones |

| X15 | — | «No estoy de acuerdo con que el gráfico dependiente (el que sigue a la llave) sea más pequeño que el original, debería ser del mismo tamaño» | Pregunta filtro, combinación, filtro al costado y llave sobre varias categorías: la subpregunta tiene el mismo largo y grosor de barra que la pregunta que la habilita | ☑ || X16 | — | «Creo que pueden verse simplemente como dos gráficos normales pero la llave conecta con el título» | Las cuatro láminas con llave como dos gráficos estándar (apilados o lado a lado), cada uno con su título, y la llave termina en el título del dependiente. Helpers `llave_a_titulo` y `llave_baja_a_titulo` en `recetario_piezas.R` | ☑ |
| X17 | 172 | «El primer ejemplo de la imagen no conecta con el título» | El tallo caía más allá de la última letra del título. Si el tallo queda fuera del texto, dobla a la altura del título y llega hasta su última letra; si cae sobre el texto, baja hasta tocarlo | ☑ |
| X18 | 186–187 | «Los dos ejemplos de abajo, los últimos, no son los más ideales porque los gráficos se ven muy desbalanceados» | Filtro al costado: la dicotómica pasa a una columna 100 % del mismo alto que las seis barras del ingreso. Llave sobre varias categorías: el dependiente es un gráfico de barras de cinco niveles («¿Qué tan relacionado está su trabajo con la carrera?») con la misma escala, fila y grosor que el primero | ☑ |
| X19 | 187 | «En el último se puede resaltar aquellos que cumplen con el otro gráfico para diferenciarlos» | Las tres categorías que habilitan la subpregunta van en azul oscuro con rótulo en negrita y las demás en tono claro. Parámetro nuevo `destacar` en `barras_h` | ☑ |

## Ronda Y, comentarios en `recetario-moderna.pptx` (2026-10-08, 11:58)

| # | Lámina | Comentario | Dónde vive | Estado |
|---|---|---|---|---|
| Y1 | 6 | «La separación entre categorías sigue sin ser muy robusta, se superponen» | `mini_lamina()` en `recetario_m0.R` | ☑ tres públicos y leyenda medida con su tinta, cuadro y aire fijo |
| Y2 | 7 | «Es mejor reportar en cm y entender mejor a qué se refiere con escalas y a qué con barras de categorías» | `recetario_reglas2.R`, lámina 1 | ☑ medidas en cm; la tabla muestra «Escala apilada» con su barra de colores y «Categorías» con una barra simple |
| Y3 | 11 | «Los nombres de las paletas pueden ser más técnicos, como escala Likert o dicotómico, y le falta una diapositiva que ejemplifique cada paleta» | `recetario_m0.R`, colores | ☑ Escala Likert, Dicotómica, Actores, y Texto, títulos y realce; lámina nueva «Las paletas en uso» (reg2:7) |
| Y4 | 13 | «¿Por qué este slide de ejemplo se ve tan vacío?» | `recetario_m0.R`, R6 | ☑ la miniatura lleva tres públicos que llenan la zona de datos |
| Y5 | 46 | «Los índices no llevan ceros» | `propuestas_indice.R` | ☑ números de capítulo sin cero en los 20 índices |
| Y6 | 76 | «Se superpone con la barra de arriba, sigo pensando que esto no está lo suficientemente robusto» | Bottom Two Box y fila Total | ☑ una premisa con el grosor estándar; la fila gana aire para las cifras chicas |
| Y7 | 78 | «La mediana puede estar como un triángulo como en otros ejemplos, la línea no se ve bien y tampoco es común que tengan etiquetada el eje x» | Histograma, `recetario_graficos2.R` | ☑ histograma con formas nativas, triángulo coral bajo la mediana y sin título del eje |
| Y8 | 80 | «Es mejor que la mediana sea el título de la barra extra y abajo sólo diga el número y la unidad» | Diagrama de caja | ☑ «Mediana» como título de la columna y «20 años» en cada fila |
| Y9 | 93 | «No me gusta el subtítulo, creo que no hace falta» | Comparativo de dimensiones | ☑ sin «a favor de», sólo los puntos |
| Y10 | 102 | «Faltan más ejemplos de mapas: uno de Lima, otro distrital con leyenda, otro con un solo distrito, otro con distrito con zonas y manzanas» | Mapas, capítulo 2 | ☑ el mapa distrital encuadra los distritos y lista sus encuestas; nuevos: Lima completa por distrito, un distrito (Comas) con su ubicación, y zonas y manzanas (Villa El Salvador) |
| Y11 | 107 | «Pone una leyenda con colores pero no hay colores» | Significancia, versión estándar | ☑ encabezados sin cuadros de color |
| Y12 | 132 | «Este narrativo tiene la línea naranja, pero el de un gráfico con narrativa no lo tiene» | `narrativa()` | ☑ el ejemplo de «Un gráfico con narrativa» no tenía narrativa; ahora lleva su frase con filete coral |
| Y13 | 150 | «Este ejemplo no es el ideal porque se ve muy vacío en la mitad inferior» | Tres gráficos en fila, `recetario_fichas.R` | ☑ tres preguntas de cinco categorías que ocupan todo el alto |
| Y14 | 175 | «Este porcentaje se cubre con la línea, debemos ser más robustos ante estas situaciones» | `grafico_serie()` | ☑ cada cifra se ubica lejos de los tramos de su línea (en `grafico_serie`, sirve para todas las series) |
| Y15 | 201 | «Se ven algo estirados y les falta grosor, asegúrate que se respete con los demás y las cifras estandarizadas» | Lámina mixta, otra pregunta | ☑ `bloque_mixto` usa el grosor de la tabla según las filas de la lámina y la cifra estándar de 14 pt |
| Y16 | 202 | Mismo comentario que Y15 | Lámina mixta, otra escala | ☑ igual que Y15 |
| Y17 | 243 | «Estos gráficos se ven delgados, la separación no es muy buena, en general el slide no se ve bien» | Encuesta organizacional, `recetario_estudios.R` | ☑ bloque Likert estándar del motor con dos premisas |
| Y18 | 269 | «No le veo utilidad a esta, se va» | Embudo de la muestra, banco | ☑ retirada de la propuesta (sigue en la fiel) |

Regla transversal de la ronda Y: las cifras chicas encima de su segmento ya no adelgazan la barra. La fila gana el aire (`AIRE_CHICA` en `recetario_piezas.R`, usado por `likert_panel`, `filas_pulso` y `bloque_mixto`) y las leyendas siguen a sus barras en vez de ir a una altura fija.
