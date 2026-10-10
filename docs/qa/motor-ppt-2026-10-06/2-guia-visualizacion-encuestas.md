# Guía de visualización de resultados de encuesta para informes en PowerPoint

Tipo: Guía de investigación
Estado: Vigente
Fecha: 2026-10-06
Autoridad: Investigación con fuentes; respaldo de las recetas, no reemplaza un ADR

Base para rediseñar las recetas de gráficos de los informes PULSO PUCP (acreditación y opinión). Fecha: 2026-10-06.

Cómo leer esta guía:

- Cada caso trae una forma recomendada (A), alternativas aceptables (B, C) con sus condiciones, lo que conviene evitar y por qué, la evidencia y reglas prácticas.
- Distingo tres niveles de respaldo: **[Exp]** experimento controlado publicado; **[Guía]** guía de estilo institucional o libro de un practicante reconocido; **[Opinión]** criterio de diseño razonado sin prueba experimental directa. Cuando la evidencia es débil o está en disputa lo digo explícitamente.
- La paleta del cliente es fija (naranja F4B183, amarillo FFD965, verde claro ADD493, verde 70AD47, gris BFBFBF; navy 081F5C institucional). No se propone reemplazarla, solo usarla mejor.
- El cliente no quiere notas explicativas en la lámina. Por eso todo lo que el lector necesita (base, N, qué suma 100) se pone en elementos estructurales: título, rótulo de fila, encabezado de columna, título de eje. Nunca en una nota al pie.

---

## 1. Lo que la evidencia sí sostiene (y lo que no)

### 1.1 Jerarquía de percepción

- **Cleveland y McGill (1984), JASA** [Exp]. Proponen una jerarquía de tareas perceptivas: posición sobre escala común > posición sobre escalas no alineadas > longitud, dirección, ángulo > área > volumen, curvatura > sombreado y saturación de color. Precisión importante: sus experimentos midieron sobre todo posición, longitud y ángulo; el resto del orden se apoya en la psicofísica previa y en su razonamiento, no en sus propios datos.
- **Heer y Bostock (2010), CHI** [Exp]. Replicaron con Mechanical Turk: posición alineada fue lo más preciso, luego posición no alineada (segmentos apilados), longitud, ángulo, área de círculo y, al final, área de rectángulo. Para nosotros lo relevante es que **los segmentos intermedios de una barra apilada no comparten línea base y se leen peor** que los extremos.
- Matiz reciente: Reda y coautores (arXiv, agosto 2026, preprint sin revisión por pares) critican que estos rankings por canal predicen mal la percepción real, porque pequeños cambios de diseño o de datos alteran el resultado. Es un llamado a no tratar la jerarquía como ley exacta, no una refutación. La regla útil sigue en pie: lo que se quiera comparar con precisión debe quedar alineado sobre una línea base común.

### 1.2 Tortas y donas

- **Spence y Lewandowsky (1991), Applied Cognitive Psychology** [Exp]. Para juzgar proporciones de un todo, torta y barra rinden casi igual y ambas superan a la tabla; la torta tiene ligera ventaja cuando hay que sumar partes.
- **Kosara y Skau (2016), EuroVis short** y **Skau y Kosara (2016), Computer Graphics Forum** [Exp]. El ángulo central no es la clave principal de lectura; pesan más área y longitud de arco. La dona es tan precisa como la torta. Las variantes (explotada, elíptica, 3D) aumentan el error.
- Conclusión honesta: la torta no es "mala" para una sola parte contra el todo con pocas categorías. Sí es mala para **comparar entre varias tortas** (Robbins y Heiberger 2011; Datawrapper; Wilke cap. 10).

### 1.3 Ejes truncados

- **Correll, Bertini y Franconeri (2020), CHI** [Exp]. Truncar el eje Y exagera el tamaño percibido de las diferencias, en barras y en líneas, y las marcas de corte del eje no eliminan el efecto. Recomiendan elegir la escala según el tamaño de efecto que importa comunicar, no por convención.
- **Wilke, principio de tinta proporcional** [Guía]. Las barras deben empezar en cero porque su largo es el dato. Los puntos pueden usar un eje que no empiece en cero porque codifican solo por posición.
- **UK Government Analysis Function (2022)** [Guía]. Nunca cortar el eje numérico de una barra; si el cero estorba, usar un gráfico de puntos.
- Síntesis: truncar es lícito en puntos, pero **sigue exagerando** (Correll). Con bases de 15 a 178, exagerar diferencias de 2 o 3 puntos es exagerar ruido.

### 1.4 Radar

- **Few (2005), "Keep Radar Graphs Below the Radar"** [Guía]. Más lento de leer que una barra; no se sabe dónde empieza ni en qué sentido se lee; la forma del polígono induce preferencia por la simetría; solo lo justifica para datos cíclicos (horas del día).
- **Robbins y Heiberger (2011), JSM** [Guía con ejemplos]. En escalas de acuerdo, el radar sugiere que la escala es circular, lo cual es falso.
- **Abeynayake, Goonetilleke, Wijeweera y Reischl (2023), Applied Ergonomics 109** [Exp, muestra pequeña: 14 participantes con eye tracking]. Barras y líneas superaron a gráficos circulares y radiales; el radar tuvo el peor desempeño en precisión y tiempo. La muestra es chica, pero el resultado apunta en la misma dirección que todo lo demás.
- Argumento adicional [Opinión fundamentada]: el área del polígono depende del orden en que se ubican los ejes, y el centro del radar casi nunca es cero cuando el rango es 91 a 98, de modo que es un eje truncado disfrazado.

### 1.5 Likert: barra divergente contra barra 100% apilada (debate abierto)

- **A favor de la divergente**: Robbins y Heiberger (2011) y Heiberger y Robbins (2014, Journal of Statistical Software 57(5)) la recomiendan como forma principal: centrada en cero, desacuerdo a la izquierda, acuerdo a la derecha, intensidad de color creciente hacia los extremos, filas ordenadas por porcentaje de acuerdo, conteos como etiqueta del eje derecho y paleta apta para daltonismo. Few (2016) coincide: "Agree + Strongly Agree" se lee mejor así, y prefiere los neutrales en columna aparte.
- **En contra**: Muth y Aisch, Datawrapper (2018). La barra 100% apilada comunica de inmediato que son partes de un todo, usa mejor el ancho y permite leer si algo supera 50% o 25%; partir el neutral en dos mitades sugiere que la mitad de los indecisos "está de acuerdo".
- **Evidencia experimental**: escasa. Indratmo y coautores (2018, Visual Informatics 2(3)) con 30 participantes: en comparaciones de un solo atributo, apilada clásica, invertida y divergente rinden igual; en comparaciones globales la invertida fue más rápida y la divergente se percibió más fácil que la clásica. No es un estudio de Likert propiamente dicho.
- Veredicto: **ninguna de las dos tiene respaldo experimental fuerte**; es un debate de expertos. La decisión debe depender de la escala (4 o 5 puntos), de cuánto desacuerdo hay y de qué comparación quiere hacer el lector (ver sección 3).

### 1.6 Minimalismo y tinta de datos

- **Tufte (1983)**: maximizar la proporción de tinta de datos [Guía, influyente pero no experimental].
- **Bateman y coautores (2010), CHI** [Exp]: gráficos con adornos no se interpretaron peor y se recordaron mejor a las dos o tres semanas. La regla de "quitar todo" está en disputa.
- Postura de esta guía: limpiar lo que compite con el dato (rejillas, bordes, 3D, leyendas lejanas), pero sin dejar la lámina muda: el título debe decir el hallazgo.

### 1.7 Principios de Munzner (2014)

- **Expresividad**: la codificación debe expresar toda la información de los datos y solo esa. Datos ordinales piden un canal ordenado; un radar impone un ciclo que la escala no tiene.
- **Efectividad**: el atributo más importante va al canal más preciso (posición alineada). En nuestras láminas lo más importante suele ser el porcentaje de acuerdo, por eso debe quedar alineado.

---

## 2. Diagnóstico de la paleta del cliente (calculado)

Calculé contraste WCAG, luminosidad L* y diferencias de color ΔE (CIELAB 1976) con simulación de daltonismo (Machado 2009, severidad completa).

| Color | Contraste con texto blanco | Con negro | Con navy 081F5C | L* |
|---|---|---|---|---|
| Naranja F4B183 | 1,83 | 11,46 | 8,42 | 77 |
| Amarillo FFD965 | 1,37 | 15,37 | 11,29 | 88 |
| Verde claro ADD493 | 1,66 | 12,62 | 9,27 | 81 |
| Verde 70AD47 | 2,71 | 7,76 | 5,70 | 65 |
| Gris BFBFBF | 1,84 | 11,42 | 8,39 | 77 |

Diferencias críticas (ΔE; con visión normal / deuteranopía / protanopía):

- Naranja contra verde claro: 44,0 / **8,9 / 7,5**. Para una persona con daltonismo rojo-verde, el extremo negativo y el positivo moderado son casi el mismo color. Es el par más peligroso porque está en lados opuestos de la escala.
- Naranja contra verde: 59,5 / 17,0 / 24,4. Distinguibles, pero mucho menos que con visión normal.
- Amarillo contra gris: bien con visión normal y rojo-verde; se acercan en tritanopía (22,9), poco frecuente.

Consecuencias prácticas (sin cambiar la paleta):

1. **Etiquetas de los segmentos en navy o negro, nunca en blanco.** El texto blanco no llega ni a 3:1 en ningún color de la escala (máximo 2,71 en el verde). En navy todos superan 4,5:1.
2. **El color nunca es la única pista.** El orden de los segmentos es fijo y siempre el mismo (negativo a la izquierda, positivo a la derecha), la leyenda va en ese mismo orden y pegada a la barra, y los segmentos grandes llevan su valor (Wilke cap. 20, codificación redundante).
3. **Separadores blancos finos (0,75 a 1 pt) entre segmentos.** Los colores contiguos tienen contraste entre sí de solo 1,2 a 1,6:1; el separador ayuda a ver los límites.
4. La paleta **no es monótona en luminosidad**: el naranja (L* 77) es más oscuro que el amarillo (88), pero el verde extremo (65) es bastante más oscuro que el naranja extremo. Visualmente el lado positivo "pesa" más que el negativo. No se corrige sin cambiar colores; se compensa con posición y etiquetas.
5. Asignación recomendada: naranja = Totalmente en desacuerdo, amarillo = En desacuerdo, verde claro = De acuerdo, verde = Totalmente de acuerdo, gris = SIN INF / No sabe. El navy queda para texto, títulos, marcadores de la serie principal (2026, total) y énfasis; **no** para un punto de la escala.
6. Si la escala tiene neutral (5 puntos), el gris no puede representar a la vez neutral y SIN INF. Solución: gris para el neutral dentro de la barra y SIN INF fuera de la barra como columna numérica (ver regla 4.2).
7. Los colores de la escala no deben reutilizarse para distinguir actores en otros gráficos (por ejemplo, verde = egresados), porque el lector ya les asignó significado de acuerdo y desacuerdo. Los actores se distinguen por posición (filas o paneles) y, si hace falta color, por tonos de navy más forma del marcador.

---

## 3. Recomendaciones por caso

### Caso 1. Likert de 4 o 5 puntos, un enunciado, un público (una barra por lámina)

- **A. Barra 100% apilada horizontal, gruesa, con los segmentos en orden de la escala (negativo a la izquierda, positivo a la derecha) y una cifra grande de Top Two Box a la derecha.** Con un solo enunciado no hay nada que comparar entre barras, así que el argumento principal de la divergente (comparar acuerdo entre filas) no aplica. La cifra de Top Two Box responde la pregunta que el lector trae.
- **B. Agrupar enunciados de la misma dimensión en una lámina** (ver Caso 2). Condición: que el cliente acepte menos láminas. Es más denso y permite comparar, que es lo que la barra suelta impide. [Opinión apoyada en Tufte sobre densidad de datos]
- **C. Solo el número de Top Two Box con una barra fina de contexto** cuando el informe es ejecutivo. Condición: la distribución completa debe estar en un anexo.
- **Evitar**: torta de 4 o 5 segmentos (UK Analysis Function limita a 5 categorías y desaconseja categorías de tamaño parecido; además se pierde el orden de la escala); barras agrupadas verticales por categoría (Robbins y Heiberger 2011: dificultan comparar el total de acuerdo).
- Reglas: N en el rótulo de la barra ("Estudiantes (n = 142)"); SIN INF fuera de la barra; etiquetas según la regla 4.3.

### Caso 2. Varios enunciados por actor, con columna Top Two Box (y a veces 2026 contra 2021)

- **A. Barra 100% apilada con el acuerdo anclado a la derecha, filas ordenadas por Top Two Box y columnas numéricas a la derecha: Top Two Box y n.** Al terminar todas las barras en 100%, el bloque "De acuerdo + Totalmente de acuerdo" comparte borde derecho y su largo se compara casi tan bien como en una divergente. Con escalas de 4 puntos (sin neutral) desaparece la objeción de Datawrapper sobre partir el neutral, pero también desaparece la principal ventaja de la divergente, y en nuestros datos el acuerdo suele superar 85%, con lo que una divergente dejaría casi vacío el lado izquierdo de la lámina.
- **B. Barra divergente (Heiberger y Robbins)** cuando hay desacuerdo relevante: por ejemplo, varios enunciados con Top Two Box bajo 75% o cuando el mensaje es comparar el rechazo entre actores. Condiciones: escala de 4 puntos, o escala de 5 con el neutral separado en una columna aparte (como prefiere Few) en lugar de partido en dos; eje con porcentajes positivos a ambos lados; rótulos de totales a cada lado.
- **C. Matriz de enunciados por actor solo con Top Two Box** (tabla con sombreado suave o gráfico de puntos) cuando el objetivo es comparar actores y la distribución completa ya se mostró en otra lámina.
- **Evitar**: ordenar las filas alfabéticamente o por código cuando el orden del cuestionario no tiene significado (Heiberger y Robbins: el orden según los datos es más informativo); reordenar los actores en cada lámina (romper la posición fija confunde al lector que recorre el informe) [Opinión]; poner la columna Top Two Box como segmento extra dentro de la barra (duplica tinta que suma más de 100%).
- **Orden de filas**: enunciados por Top Two Box descendente, salvo que el orden del instrumento sea parte del mensaje (una secuencia lógica de proceso). Actores en orden fijo en todo el informe (por ejemplo docentes, estudiantes, egresados, administrativos), aunque eso no siga el orden por valor. Esta segunda regla es criterio de consistencia, no evidencia experimental.
- **Comparación 2026 contra 2021 dentro de este formato**: ver Caso 8. Si se quiere en la misma lámina, agregar una columna "2021" en gris junto a la columna Top Two Box 2026 en navy, no una segunda barra completa por fila.

### Caso 3. Mostrar Top Two Box junto a la distribución completa (veredicto)

- **Sí, mostrarlos juntos, pero como columna aparte y no como segmento.** Heiberger y Robbins ordenan por acuerdo total y Few (2016) recomienda hacer legible el acuerdo combinado; el Top Two Box es exactamente esa lectura. La distribución completa evita el problema que Robbins y Heiberger señalan con los resúmenes: dos distribuciones muy distintas pueden tener el mismo resumen.
- Reglas: definir siempre la misma base (con o sin SIN INF) y que la columna lo diga en su encabezado ("Top Two Box, % sobre quienes respondieron" o "% sobre el total"); el valor de la columna debe coincidir con la suma de los dos segmentos verdes visibles (si por redondeo se ve 61 + 30 y la columna dice 92, calcular la columna desde los datos sin redondear y aceptar esa diferencia de 1 punto, nunca forzar segmentos).
- No usar promedios de la escala 1 a 5 como sustituto: Robbins y Heiberger (2011) lo desaconsejan porque la escala ordinal no garantiza intervalos iguales y el promedio esconde polarización.

### Caso 4. Sí/No por actor

- **A. Barra 100% apilada de dos segmentos, "Sí" anclado a la izquierda, valor de "Sí" rotulado y n en el rótulo de la fila.** Few (2016) señala que la 100% apilada funciona bien justamente con dos segmentos, porque ambos tienen línea base (izquierda y derecha).
- **B. Barra simple o gráfico de puntos solo con el % de "Sí"** (el "No" es el complemento). Condición: que no haya SIN INF relevante; si lo hay, el complemento ya no es 100 menos el Sí.
- **C. Tabla con % de Sí y n** cuando hay más de 6 actores o subgrupos.
- **Evitar**: una torta por actor (comparar ángulos y áreas entre tortas separadas es lo que peor se lee: Robbins y Heiberger 2011; Datawrapper; Wilke).
- Color: para Sí/No no usar los colores de la escala de acuerdo si "No" no significa desacuerdo; navy para "Sí" y gris claro o un tono suave para "No" es más neutral. Si "No" es la respuesta negativa de una evaluación, verde y naranja son aceptables pero con etiqueta, por el problema de daltonismo.

### Caso 5. Torta contra barra para dicotomías (veredicto)

- **Una sola dicotomía de la población total: la torta es aceptable.** La evidencia (Spence y Lewandowsky 1991; Kosara y Skau 2016) no muestra que la torta sea peor que la barra para leer una parte contra el todo, y Wilke la considera buena para fracciones simples (un medio, un cuarto). Condiciones: dos categorías (o tres con SIN INF pequeño), inicio a las 12, sin 3D, sin explotar, valores rotulados. La dona rinde igual que la torta (Skau y Kosara 2016); no aporta precisión, solo estilo.
- **Cuando la misma dicotomía se muestra por actor o por año: barra.** Varias tortas obligan a comparar áreas separadas sin base común.
- Recomendación de sistema: como el informe casi siempre compara, conviene que la receta por defecto sea la barra y la torta quede solo para la cifra global. Así el lector no cambia de código visual entre láminas. [Opinión]

### Caso 6. Variables de perfil nominales y ordinales (sexo, rangos de edad, ciclo, rangos de sueldo) en láminas de 4 paneles

- **A. Barras horizontales que empiezan en cero, sin eje ni rejilla, con el valor rotulado al final de cada barra.** Orden natural para ordinales (edad, ciclo, sueldo de menor a mayor, de arriba hacia abajo); orden por valor descendente para nominales; SIN INF siempre al final, en gris, sin importar su tamaño (Wilke cap. 6; UK Analysis Function).
- **B. Sexo u otra dicotomía como una sola barra 100% apilada** en vez de dos barras; ahorra espacio en el panel.
- **C. Tabla compacta** si el panel tiene más de 8 a 10 categorías o si la base del actor es menor que 30 (ver 4.5).
- **Escala común entre paneles**: si los cuatro paneles son porcentajes de la misma base, usar el mismo máximo (por ejemplo 0 a 100 o el máximo común) para que una barra de 40% mida lo mismo en todos. Si eso aplasta un panel, se acepta escala propia, pero con los valores rotulados. [Opinión apoyada en Wilke cap. 21 sobre figuras de varios paneles]
- **Evitar**: barras verticales con etiquetas giradas (Wilke: el texto debe quedar horizontal); tortas para variables de 4 o más categorías ordinales; mezclar orden natural y orden por valor en una misma variable.

### Caso 7. Histograma de edad

- **A. Con n de 100 o más: histograma con intervalos fijos y redondos (por ejemplo de 5 años), declarados en el eje.**
- **B. Con n entre 30 y 100: barras por rangos de edad predefinidos** (los mismos rangos en todos los actores y años), que es lo que el lector compara.
- **C. Con n menor a 30: tabla con mediana, mínimo y máximo, o gráfico de puntos individual (dot strip).** Con 15 casos, la forma de un histograma depende más del ancho de intervalo que de los datos. [Opinión basada en la inestabilidad conocida del histograma con muestras pequeñas; Wilke cap. 7 muestra cómo cambia la forma con el ancho de intervalo]
- **Evitar**: intervalos elegidos automáticamente por el software (cambian entre actores y no son comparables).

### Caso 8. Selección múltiple (porcentaje de encuestados, suma más de 100%)

- **A. Barras horizontales ordenadas de mayor a menor, "Otros", "Ninguno" y SIN INF al final, título de eje "% de encuestados que marcó cada opción".** Esa frase en el título del eje reemplaza la nota de "suma más de 100%" que el cliente no quiere.
- **B. Por actor: paneles pequeños (un panel por actor, mismo orden de opciones en todos, ordenado por el total)** en vez de barras agrupadas con cuatro colores. Wilke (cap. 6 y 21) señala que las barras agrupadas son difíciles de comparar; los paneles evitan codificar el actor con color.
- **C. Gráfico de puntos con un marcador por actor** (forma distinta más tonos de navy) cuando hay muchas opciones y se quiere comparar actores dentro de cada opción. Condición: no más de 4 actores, y el eje empieza en cero si se dibujan tallos.
- **Evitar**: torta o barra 100% apilada (las opciones no son partes de un todo); colores de la escala de acuerdo para identificar actores.
- **Piruleta (lollipop)**: aceptable aquí cuando hay más de 10 o 12 opciones y las barras formarían una pared de color (FT Visual Vocabulary la ubica en "ranking"). Ver veredicto en el Caso 10.

### Caso 9. Top Two Box por competencia y actor con valores entre 91 y 98% (hoy radar más tabla) (veredicto)

- **Veredicto: retirar el radar.** Razones: implica una escala circular que no existe (Robbins y Heiberger 2011), el área del polígono depende del orden arbitrario de las competencias, el centro no es cero así que es un eje truncado encubierto, y es el formato con peor desempeño en las pruebas disponibles (Few 2005; Abeynayake y otros 2023, con la cautela de su muestra pequeña).
- **El dato de fondo importa más que la forma:** con bases de 15 a 178, el intervalo de confianza de un 95% observado va de unos 72 a 99% con n = 15 y de 91 a 97% con n = 178 (intervalo de Wilson al 95%; ver tabla en 4.6). Las diferencias de 2 a 5 puntos entre competencias o actores casi nunca son distinguibles del azar. El mensaje honesto es "acuerdo alto y parejo en todas las competencias".
- **A. Tabla de competencias por actor, con los valores enteros, n en el encabezado de cada actor y, opcionalmente, un sombreado muy suave en una sola tonalidad (navy claro).** Few (Show Me the Numbers) recomienda tablas cuando hay pocos valores, el lector necesita leer cifras exactas y no hay un patrón de forma que mostrar. El rango 91 a 98 es exactamente ese caso. El sombreado debe usar un rango fijo (por ejemplo de 50 a 100), no mínimo a máximo, para no fabricar contraste.
- **B. Gráfico de puntos (Cleveland): competencias en filas, ordenadas por el promedio, y un marcador por actor (forma distinta y tonos de navy).** El eje puede no empezar en cero porque son puntos (Wilke), pero el rango debe elegirse por el tamaño de diferencia que importa, no ajustarse a los datos: un eje de 50 a 100 o de 70 a 100, nunca de 90 a 100. Correll y otros (2020) muestran que el truncamiento exagera las diferencias aunque se marque el corte.
- **C. Gráfico de puntos con un solo marcador por competencia (total) y la tabla por actor al lado**, si el cliente necesita una figura y no quiere cuatro series.
- **Evitar también**: barras de 0 a 100 (correctas pero ocupan la lámina para mostrar barras iguales; aceptable solo si el mensaje explícito es la paridad) y barras con eje truncado (prohibido: Wilke, UK Analysis Function).
- Si existe un umbral del estándar de acreditación para el porcentaje de acuerdo, una línea vertical de referencia en ese valor (o un gráfico de bala de Few) aporta más que cualquier zoom: muestra que todos lo superan y por cuánto.

### Caso 10. Piruleta contra barra (veredicto)

- **Cuándo la piruleta es razonable**: muchas categorías (más de 10 a 12), todas con valores no despreciables, eje desde cero y el mensaje es el ranking. Schwabish y el FT Visual Vocabulary la aceptan para ranking.
- **Cuándo NO es apropiada**:
  1. Cuando el eje no empieza en cero: el tallo se lee como longitud desde la base, igual que una barra, así que hereda la regla de tinta proporcional. Si se quiere truncar, quitar el tallo y usar puntos.
  2. Con pocas categorías (2 a 5): no ahorra nada y pierde peso visual.
  3. Con valores muy parecidos (como 91 a 98): se vuelve una fila de palitos casi iguales.
  4. Para partes de un todo o escalas Likert: no apila.
  5. Cuando hay que leer valores con precisión: Few (2017) critica que el centro del círculo es difícil de ubicar y que medio círculo sobrepasa el valor.
- Nivel de evidencia: no encontré experimentos que comparen piruleta y barra; la crítica de Few es razonamiento perceptivo, y la defensa de Schwabish y del FT es de práctica editorial. **Evidencia débil en ambos sentidos.** Recomendación conservadora: barra como receta por defecto; punto sin tallo cuando se necesite eje truncado; piruleta solo en listas largas con eje desde cero.

### Caso 11. 100% apilada contra divergente para Likert, en esta audiencia (veredicto)

- **Por defecto, 100% apilada con orden fijo de escala y Top Two Box en columna.** Razones: la audiencia ya la lee (cambiar el código visual tiene costo de aprendizaje); nuestras escalas suelen ser de 4 puntos y con acuerdo alto, donde la divergente desperdicia la mitad izquierda; y la evidencia experimental no favorece claramente a ninguna (Indratmo y otros 2018).
- **Divergente como alternativa condicionada**: cuando el mensaje es el desacuerdo, cuando el desacuerdo es sustantivo en varias filas, o cuando se comparan muchos grupos sobre un mismo enunciado. Si hay neutral, ponerlo en columna aparte (Few 2016), no partido en dos (la objeción de Datawrapper es válida para el neutral partido).
- Lo que **no** se debe hacer es mezclar ambos formatos en un mismo informe para el mismo tipo de pregunta.

### Caso 12. Comparación 2021 contra 2026 (veredicto: pendiente de cuesta o pesas)

- **A. Gráfico de pesas (dumbbell) del Top Two Box: una fila por enunciado o por actor, punto gris hueco para 2021 y punto navy relleno para 2026, unidos por una línea fina, filas ordenadas por el valor 2026.** Muestra nivel y cambio sobre un mismo eje y escala bien a muchas filas (Schwabish 2021 lo recomienda en lugar de barras pareadas).
- **B. Pendiente (slope chart)** cuando hay pocos elementos (hasta 6 a 8 líneas) y el mensaje es quién sube, quién baja o quién cambia de posición. Con más líneas se enreda. FT Visual Vocabulary la propone para 2 o 3 momentos.
- **C. Barras 100% apiladas pareadas (2021 encima de 2026)** cuando lo que cambió es la distribución (por ejemplo, de "Totalmente de acuerdo" a "De acuerdo" sin cambiar el Top Two Box).
- **Evitar**: barras agrupadas verticales con años lado a lado por categoría de escala; dos tortas; radares superpuestos; flechas o colores de "subió/bajó" para cambios dentro del margen de error.
- **Condiciones de validez** (si no se cumplen, no se compara en la misma figura): misma redacción del enunciado, misma escala (4 contra 5 puntos rompe la comparación del Top Two Box), misma definición de base (SIN INF dentro o fuera), población comparable. Mostrar n de ambos años en el rótulo de fila ("Docentes (n = 38 / 45)").
- **Evidencia**: débil en lo experimental. Pesas y pendientes son recomendaciones de practicantes (Schwabish 2021; FT; Tufte 1983 para la "tabla-gráfico" de pendiente), coherentes con la regla de alinear lo que se compara (Cleveland y McGill), pero sin ensayos específicos que conozca.
- **Cambio y ruido**: con n = 40 por año, una diferencia de 5 puntos en un Top Two Box cercano a 90% no es concluyente. El motor debería calcular la prueba de diferencia de proporciones y, sin poner notas, decidir el énfasis: solo los cambios significativos van en navy fuerte o en el título; los demás se dibujan igual pero sin destacar. [Opinión metodológica]

---

## 4. Reglas transversales

### 4.1 Orden

1. Escala Likert: siempre de negativo a positivo, de izquierda a derecha, en todas las láminas.
2. Filas de enunciados: por Top Two Box descendente, salvo orden del instrumento con sentido (Heiberger y Robbins).
3. Actores: orden fijo en todo el informe.
4. Categorías ordinales de perfil: orden natural. Nominales: por valor.
5. Categorías residuales (Otros, Ninguno, No sabe, SIN INF): siempre al final, fuera del orden por valor.

### 4.2 Dónde va SIN INF / No responde

- SIN INF no es un punto de la escala; ponerlo dentro de la barra, entre los colores, sugiere que es una opinión intermedia.
- **Recomendación A**: excluirlo de la barra, calcular los porcentajes sobre quienes respondieron y mostrar SIN INF como columna numérica a la derecha ("Sin inf.: 3%" o el conteo), junto a n. Esto es coherente con la práctica de Pew de no dibujar "No answer" en las barras, pero sin la nota al pie: la columna hace visible el dato. Datawrapper cita a Philip Meyer: "Don't know is data", es decir, no debe desaparecer.
- **Recomendación B** (si el cliente exige que la barra sume 100% del total): SIN INF como último segmento a la derecha, en gris, separado del resto por un espacio en blanco visible de 1 a 2% del ancho. Nunca entre el negativo y el positivo.
- La base del Top Two Box debe ser la misma que la de la barra, y el encabezado de columna debe decir cuál es.

### 4.3 Etiquetas de segmentos pequeños (1 a 3%)

- Regla geométrica: una etiqueta dentro del segmento solo si el segmento es al menos tan ancho como el texto más un margen. En una barra de unos 20 cm a 10 pt, "3%" ocupa unos 6 mm, es decir alrededor de 3%; con margen, el umbral práctico es **5%** del ancho de la barra. Calcularlo en el motor a partir del ancho real, no con un umbral fijo copiado. [Opinión, derivada de la geometría]
- Segmentos bajo el umbral: sin etiqueta interna. Su valor queda disponible por otra vía: (a) la columna Top Two Box y, si se quiere, una columna "Desacuerdo" que suma los negativos; o (b) etiqueta afuera, encima o debajo de la barra, alineada con el segmento, solo si no choca con la fila vecina.
- Nunca apilar etiquetas una sobre otra ni usar flechas largas en barras de una lámina.
- Redondear a entero. No forzar segmentos para que sumen 100; la diferencia de 1 punto por redondeo es aceptable y estándar (Pew lo declara así).

### 4.4 Ejes

- Barras: siempre desde cero. Sin excepción (Wilke; UK Analysis Function; Correll y otros 2020).
- Barras 100%: eje de 0 a 100; puede omitirse si todos los segmentos relevantes están rotulados.
- Puntos: se permite eje que no empiece en cero, con el inicio rotulado, y con un rango fijado por la diferencia que importa, nunca por mínimo y máximo de los datos.
- Mismo eje para todos los paneles que se comparan en una lámina.
- Sin rejillas cuando hay etiquetas directas; a lo sumo una línea de referencia (50% o el umbral del estándar).

### 4.5 Cuándo una tabla le gana al gráfico

- Pocos valores y el lector necesita leerlos con exactitud (Few, Show Me the Numbers; UK Analysis Function).
- Rango estrecho sin patrón (Caso 9).
- Matrices de más de dos dimensiones (competencia por actor por año).
- Bases pequeñas, donde el gráfico sugiere una precisión que no existe: con n menor a 30 conviene la tabla con conteos ("14 de 15") además del porcentaje. [Opinión metodológica: con n = 15 cada persona vale 6,7 puntos]

### 4.6 N e incertidumbre con bases de 15 a 178

Semiancho aproximado del intervalo de Wilson al 95%, en puntos porcentuales:

| n | p = 50% | p = 80% | p = 95% |
|---|---|---|---|
| 15 | 23 | 19 | 14 |
| 30 | 17 | 14 | 9 |
| 50 | 13 | 11 | 7 |
| 100 | 10 | 8 | 5 |
| 178 | 7 | 6 | 3 |

(Con p alto el intervalo es asimétrico: con n = 15 y 95% observado va de 72 a 99%.)

- **Mostrar n siempre**, en el rótulo de la fila o en una columna, nunca en nota al pie. Heiberger y Robbins ponen los conteos como etiquetas del eje derecho; HH incluso trae una variante con panel de porcentajes y panel de conteos.
- **No dibujar barras de error en las láminas por defecto.** Pew solo las muestra cuando la base efectiva de un subgrupo es menor que 100, y no publica estimaciones con menos de 100 entrevistas o menos de 50 de base efectiva. En nuestro caso casi todo estaría bajo ese umbral, así que llenar las láminas de barras de error saturaría y, además, la investigación sobre lectura de barras de error muestra que se malinterpretan con frecuencia. Mejor que el motor use la incertidumbre para decidir qué destacar:
  1. No resaltar en título ni en color diferencias menores al margen.
  2. Para n menor a 30, mostrar conteo junto al porcentaje y no ordenar ni rankear actores por diferencias pequeñas.
  3. Si alguna base es menor a 15 (fuera del rango actual, pero posible en subgrupos), no publicar el porcentaje en gráfico; solo en tabla con conteo.
- **Población finita**: en acreditación, algunos actores (docentes, administrativos) pueden estar cerca del censo. Si se conoce el tamaño de la población, la corrección por población finita reduce el margen; si la tasa de respuesta es baja, el riesgo principal no es el azar sino el sesgo de no respuesta, que ningún intervalo mide. Pew lo advierte: las barras de error subestiman el error total.

### 4.7 Títulos y texto sin notas

- El título dice el hallazgo ("El acuerdo supera el 90% en todas las competencias y actores"), el subtítulo dice qué se midió y sobre qué base ("% De acuerdo + Totalmente de acuerdo, sobre quienes respondieron").
- Toda la información metodológica mínima va en encabezados de columna, rótulos de fila y títulos de eje. Así se cumple el pedido del cliente sin esconder el dato.

### 4.8 Paneles pequeños y consistencia

- Para comparar actores, preferir paneles con la misma escala y orden (Tufte 1990, small multiples; Wilke cap. 21) antes que series de colores en un mismo gráfico.
- Una receta por tipo de pregunta en todo el informe. La consistencia reduce el esfuerzo de lectura más que cualquier optimización local. [Opinión]

---

## 5. Tabla resumen de recomendaciones

| Caso | A (recomendado) | B / C (condiciones) | Evitar | Respaldo |
|---|---|---|---|---|
| Likert, un enunciado, un público | 100% apilada gruesa, orden de escala, Top Two Box grande a la derecha, n en el rótulo | B: agrupar enunciados de la dimensión. C: solo Top Two Box con barra fina, distribución en anexo | Torta de 4 o 5; barras agrupadas por categoría | Guía |
| Likert, varios enunciados por actor | 100% apilada, acuerdo anclado a la derecha, filas por Top Two Box, columnas Top Two Box y n | B: divergente si hay desacuerdo sustantivo (neutral en columna aparte). C: matriz solo Top Two Box | Orden alfabético; Top Two Box como segmento; reordenar actores | Debate abierto; Exp débil |
| Top Two Box con distribución | Sí, como columna aparte con base declarada | Calcular desde datos sin redondear | Promedio de 1 a 5 como sustituto | Guía |
| Sí/No por actor | 100% apilada de dos segmentos, Sí a la izquierda | B: solo % Sí. C: tabla si hay muchos grupos | Una torta por actor | Guía y Exp |
| Dicotomía global | Torta aceptable (2 o 3 porciones, inicio a las 12) o barra | Barra si se compara con otros grupos o años | 3D, explotada, varias tortas | Exp (Spence 1991; Kosara 2016) |
| Perfil nominal u ordinal | Barras horizontales desde cero, valores rotulados, orden natural u orden por valor, SIN INF al final | B: dicotomía como una barra 100%. C: tabla si hay muchas categorías o n bajo | Etiquetas giradas; tortas para ordinales | Guía |
| Edad | Histograma con intervalos fijos si n de 100 o más | B: rangos fijos si n entre 30 y 100. C: tabla o puntos si n menor a 30 | Intervalos automáticos | Opinión |
| Selección múltiple | Barras horizontales descendentes, residuales al final, eje "% de encuestados" | B: paneles por actor. C: puntos por actor | Torta, 100% apilada, colores de escala para actores | Guía |
| Top Two Box 91 a 98% por competencia y actor | Tabla con n y sombreado de rango fijo | B: puntos con eje de 50 o 70 a 100. C: puntos del total más tabla | Radar; barras truncadas; eje de 90 a 100 | Exp (Correll 2020; Abeynayake 2023) y Guía |
| Piruleta | Solo listas largas con eje desde cero | Punto sin tallo si se trunca | Pocas categorías, valores parecidos, Likert | Evidencia débil en ambos sentidos |
| 2021 contra 2026 | Pesas con 2021 hueco gris y 2026 navy | B: pendiente con hasta 6 a 8 líneas. C: apiladas pareadas si cambia la distribución | Barras agrupadas, dos tortas, destacar cambios dentro del margen | Guía; Exp débil |

---

## 6. Dónde la evidencia es débil o está en disputa

1. **Divergente contra 100% apilada**: debate entre expertos (Heiberger y Robbins, Few contra Muth y Aisch); un solo experimento pequeño y no específico de Likert. Cualquiera de las dos bien hecha es defendible.
2. **Piruleta**: sin experimentos comparativos conocidos.
3. **Pesas y pendientes**: recomendación de práctica, sin ensayos específicos.
4. **Radar**: evidencia consistente pero de estudios con muestras pequeñas; la conclusión es robusta porque coinciden experimentos, guías y razonamiento.
5. **Minimalismo de Tufte**: contradicho en parte por Bateman y otros (2010) en memoria.
6. **Jerarquía de Cleveland y McGill**: replicada (Heer y Bostock 2010), pero cuestionada como predictor exacto (Reda y otros 2026, preprint).
7. **Umbrales de n** (30, 100) y **umbral de 5% para etiquetas**: son convenciones prácticas, no hallazgos experimentales.
8. **Waffle**: Robbins y Heiberger (2011) lo desaconsejan para escalas (contar cuadrados es una tarea secuencial); no hay evidencia sólida a favor para nuestro uso. No se recomienda.

---

## 7. Bibliografía comentada

- **Cleveland, W. S. y McGill, R. (1984).** Graphical Perception: Theory, Experimentation, and Application to the Development of Graphical Methods. *Journal of the American Statistical Association*, 79(387), 531-554. https://doi.org/10.1080/01621459.1984.10478080. Origen de la jerarquía de codificaciones; experimentos sobre posición, longitud y ángulo.
- **Heer, J. y Bostock, M. (2010).** Crowdsourcing Graphical Perception: Using Mechanical Turk to Assess Visualization Design. *CHI 2010*. https://homes.cs.washington.edu/~jheer/files/2010-MTurk-CHI.pdf. Replica la jerarquía y muestra que los segmentos apilados no alineados se leen peor.
- **Spence, I. y Lewandowsky, S. (1991).** Displaying Proportions and Percentages. *Applied Cognitive Psychology*, 5(1), 61-77. Torta y barra equivalentes para parte contra todo; ambas mejores que la tabla.
- **Kosara, R. y Skau, D. (2016).** Judgment Error in Pie Chart Variations. *EuroVis Short Papers*, 91-95. https://doi.org/10.2312/eurovisshort.20161167. Las variantes de torta aumentan el error.
- **Skau, D. y Kosara, R. (2016).** Arcs, Angles, or Areas: Individual Data Encodings in Pie and Donut Charts. *Computer Graphics Forum*, 35(3), 121-130. https://doi.org/10.1111/cgf.12888. El ángulo pesa poco; la dona es tan precisa como la torta.
- **Robbins, N. B. y Heiberger, R. M. (2011).** Plotting Likert and Other Rating Scales. *JSM Proceedings, Survey Research Methods*, 1058-1066. https://www.montana.edu/msse/Old_Data_analysis/Likert%20Survey%20Graphs.pdf. Revisa tablas, promedios, barras agrupadas, apiladas, tortas, waffle y radar; recomienda la divergente.
- **Heiberger, R. M. y Robbins, N. B. (2012).** Design of Plots for Likert and Other Rating Scales. *JSM Proceedings, Statistical Graphics*. https://ww2.amstat.org/meetings/proceedings/2012/data/assets/pdf/305235_74490.pdf. Lista de rasgos del diseño: centrado en cero, orden por acuerdo, conteos en eje derecho, paleta accesible.
- **Heiberger, R. M. y Robbins, N. B. (2014).** Design of Diverging Stacked Bar Charts for Likert Scales and Other Applications. *Journal of Statistical Software*, 57(5). https://doi.org/10.18637/jss.v057.i05. Versión formal e implementación en el paquete HH de R.
- **Few, S. (2005).** Keep Radar Graphs Below the Radar, Far Below. *DM Review / Perceptual Edge*. https://www.perceptualedge.com/articles/dmreview/radar_graphs.pdf. Crítica del radar y sus pocas justificaciones.
- **Few, S. (2016).** When Are 100% Stacked Bar Graphs Useful? *Perceptual Edge blog*. https://www.perceptualedge.com/blog/?p=2239. Útiles con dos segmentos; para Likert prefiere divergente con neutral aparte.
- **Few, S. (2017).** Lollipop Charts: "Who Loves You, Baby?" *Perceptual Edge blog*. https://www.perceptualedge.com/blog/?p=2642. Crítica de la piruleta.
- **Few, S. (2012).** *Show Me the Numbers*, 2.a ed. Analytics Press. Criterios para elegir tabla o gráfico; especificación del gráfico de bala.
- **Muth, L. C. y Aisch, G. (2018).** The case against diverging stacked bars. *Datawrapper Blog*. https://www.datawrapper.de/blog/divergingbars. Argumentos a favor de la 100% apilada y contra el neutral partido.
- **Datawrapper Academy.** What to consider when creating a pie chart. https://www.datawrapper.de/academy/what-to-consider-when-creating-a-pie-chart. Máximo cuatro porciones; no comparar tortas.
- **Wilke, C. O. (2019).** *Fundamentals of Data Visualization*. O'Reilly. https://clauswilke.com/dataviz/. Capítulos sobre cantidades (puntos y eje no cero), proporciones (tabla de pros y contras de torta, apilada y lado a lado), tinta proporcional, codificación redundante y figuras de varios paneles. No tiene capítulo específico de Likert.
- **Tufte, E. R. (1983, 2.a ed. 2001).** *The Visual Display of Quantitative Information*; (1990) *Envisioning Information*; (2006) *Beautiful Evidence*. Graphics Press. Tinta de datos, paneles pequeños, gráficos de pendiente y sparklines.
- **Bateman, S. y otros (2010).** Useful Junk? The Effects of Visual Embellishment on Comprehension and Memorability of Charts. *CHI 2010*. https://vis.csail.mit.edu/classes/6.859/readings/pdfs/Bateman-UsefulJunk.pdf. Matiza el minimalismo.
- **Schwabish, J. (2021).** *Better Data Visualizations: A Guide for Scholars, Researchers, and Wonks*. Columbia University Press. Y Five Charts You've Never Used but Should: https://cupblog.org/2021/01/04/five-charts-youve-never-used-but-should-by-jonathan-schwabish/. Puntos, pesas, pendientes, mapas de calor como alternativas.
- **Financial Times, Visual Vocabulary.** https://github.com/Financial-Times/chart-doctor/tree/main/visual-vocabulary. Catálogo por relación (ranking, parte del todo, cambio en el tiempo, desviación).
- **Correll, M., Bertini, E. y Franconeri, S. (2020).** Truncating the Y-Axis: Threat or Menace? *CHI 2020*. https://arxiv.org/abs/1907.02035. El truncamiento exagera diferencias y las marcas de corte no lo corrigen.
- **Munzner, T. (2014).** *Visualization Analysis and Design*. CRC Press. Principios de expresividad y efectividad.
- **Indratmo, Howorko, L., Boedianto, J. M. y Daniel, B. (2018).** The efficacy of stacked bar charts in supporting single-attribute and overall-attribute comparisons. *Visual Informatics*, 2(3), 155-165. https://doi.org/10.1016/j.visinf.2018.09.002. Única comparación experimental hallada entre apilada clásica, invertida y divergente.
- **Abeynayake, H. I. M. M., Goonetilleke, R. S., Wijeweera, A. y Reischl, U. (2023).** Efficacy of information extraction from bar, line, circular, bubble and radar graphs. *Applied Ergonomics*, 109. https://khazna.ku.ac.ae/en/publications/efficacy-of-information-extraction-from-bar-line-circular-bubble-/. El radar rinde peor; muestra de 14 participantes.
- **Pew Research Center (2021).** Why Pew Research Center will display margins of error in some graphics. https://www.pewresearch.org/decoded/2021/10/25/why-pew-research-center-will-display-margins-of-error-in-some-graphics/. Barras de error solo con base efectiva menor que 100; no publica con menos de 100 entrevistas o 50 de base efectiva.
- **Pew Research Center (2025).** Understanding error bars in charts. https://www.pewresearch.org/decoded/2025/09/16/understanding-error-bars-in-charts/. Las barras de error subestiman el error total.
- **UK Government Analysis Function (2022).** Data visualisation: charts. https://analysisfunction.civilservice.gov.uk/policy-store/data-visualisation-charts/. Tortas con 5 categorías como máximo, nunca cortar el eje de una barra, tablas cuando se requieren valores exactos, WCAG 2.2 AA.
- **Reda, K. y otros (2026, preprint).** Marks, Channels, and Dead Ends. https://arxiv.org/abs/2608.07834. Cuestiona los rankings por canal como predictores exactos.
- **Machado, G. M., Oliveira, M. M. y Fernandes, L. A. F. (2009).** A Physiologically-based Model for Simulation of Color Vision Deficiency. *IEEE TVCG*, 15(6). Modelo usado para simular la paleta en la sección 2.

Nota sobre verificación: la jerarquía de Cleveland y McGill, el libro de Munzner, los libros de Tufte, el libro de Schwabish y Spence y Lewandowsky se citan desde su contenido conocido y resúmenes publicados; no se leyó el texto completo en esta investigación. Los demás se consultaron en su fuente o en su resumen oficial.
