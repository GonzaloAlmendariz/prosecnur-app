# Diferencias significativas en el motor de gráficos: propuesta de rediseño

Tipo: Propuesta de diseño
Estado: En curso
Fecha: 2026-11-03
Autoridad: diseño visual aprobado por Gonzalo el 2026-11-03; decisiones D1 a D9 a su cargo

Prosecnur · Procesamiento › Gráficos · 3 de noviembre de 2026 · Documento de diseño, sin cambios en el código de la app.

**Situación: diseño visual aprobado por Gonzalo el 3 de noviembre de 2026** (sistema ▲A con letras en la leyenda, columna «Base (n)», n en la esquina de las apiladas y rótulo corto del *top two box*). Quedan pendientes las decisiones metodológicas y de alcance D1 a D9 (§7) antes de implementar.

Caso de anclaje: Perfil del Estudiante CCSS 2026-II (mazo y Word v4 del 2 de noviembre, `.pulso` `CCSS2026_analitica_muestra400_02-11_maqueta_v3`).

> **Aviso de versionado.** El repositorio es público. Las capturas de `img/r1/` y varias maquetas usan cifras del estudio CCSS, que es material de cliente. Propongo **no commitear `img/`**: solo este documento y `mock/` (los generadores). Las imágenes se conservan aquí, sin versionar. Es la decisión D9.

---

## 0. Cobertura del encargo

| Indicación | Dónde vive en este documento | Estado |
|---|---|---|
| Diagnóstico con capturas reales (PPT, Word y UI) | §1 · `img/r1/` | Hecho |
| Referentes profesionales | §1.4 | Hecho (de memoria: no consulté fuentes en esta sesión) |
| Tres o más direcciones de gráficos y dos o más de UI, renderizadas | §2 · `img/r2/`, `img/r2b/` | Hecho: 5 + 5 de gráficos y 3 de UI |
| Elección de dirección | §2.4 | **Elegida por Gonzalo: la 0, letras con ▲A** |
| Aprobación del diseño visual | Encabezado | **Aprobado por Gonzalo (2026-11-03)** |
| Todos los tipos de gráfico, PPT 16:9, Word A4 y modo claro | §3.1 · `img/final/` | Hecho |
| Casos borde | §3.3 | Hecho (la abstención por grupo repetido, solo en la UI y en el texto de la nota) |
| Lámina «Cómo leer las diferencias» | §3.4 | Hecho |
| Redacción exacta de notas y leyendas | §4.4 | Hecho |
| Flujo de UI: activar, prueba, contra qué, umbral, vista previa, por qué, lote, estados | §3.5 | Hecho |
| Crítica independiente y ronda final | §5 | Hecho: 17 hallazgos, todos atendidos o con decisión |
| Especificación (geometría, tokens, tipografía y reglas) | §4 | Hecho |
| Plan de implementación por fases, contrato de datos y tests | §6 | Hecho |
| Decisiones para Gonzalo | §7 | **Pendientes** |

---

## 1. Ronda 1: diagnóstico

### 1.1 Lo que se ve hoy

| Captura | Qué muestra |
|---|---|
| `img/r1/ppt-lamina-40.png` (no versionada) | **Lámina 40.** La letra va pegada a la cifra y con el mismo peso (`NN% A`). La leyenda no lleva letras: para saber quién es «A», hay que leer una nota de 9 pt al pie. |
| `img/r1/ppt-lamina-74.png` (no versionada) | **Lámina 74.** El mismo contraste se marca dos veces: `NN% ABC` en «Sí» y `NN% D` en «No». El lector ve cuatro letras donde hay una diferencia. |
| `img/r1/ppt-lamina-22.png` (no versionada) | **Lámina 22.** Pasa lo mismo con dos categorías (`NN% B` y `NN% A`), con espaciado irregular (`NN%  B`). Aparece «Otros» en la leyenda sin segmento. |
| `img/r1/ppt-lamina-27.png` (no versionada) | **Lámina 27.** Se marca con letra una diferencia de menos de 5 puntos. El plan de análisis dice que no se destaca nada bajo 10 puntos. |
| `img/r1/ppt-lamina-5.png` (no versionada) | **Lámina 5, «Cómo leer».** Es un bloque de texto sin ejemplo. Dice «confianza de 95%», mientras las notas dicen «α = 0.05». No menciona magnitud, frágiles ni bases pequeñas. |
| `img/r1/word-pag32-46.png` (no versionada) | **Word, gráficos 45, 46 y 78.** La tipografía es distinta de la del PPT. La nota va alineada a la derecha y sin el mapa de letras. El gráfico 78 tiene letras sin nota. |
| `img/r1/word-pag38-39.png` (no versionada) | **Word, gráficos 59 a 63.** Son cruces sin significancia: el Word no marca lo que el PPT sí marca. |
| `img/r1/ui-inspector-grafico.jpg` (no versionada) | **Inspector › Gráfico › Cifras.** Hay un interruptor y un paso a paso para el nivel (0.10/0.05/0.01). |
| `img/r1/ui-ayuda-recortada.png` (no versionada) | **Ayuda del interruptor.** Se corta por el borde derecho (C4). |
| `img/r1/ui-maqueta-lamina37.png` (no versionada) | **Maqueta de la lámina.** El glifo pinta puntos rojos que no corresponden a nada del render final (C1 y C5). |
| `img/r1/ui-previsualizar.jpg` (no versionada) | **Vista previa.** Aparecen letras, pero no hay manera de preguntar por qué. |

### 1.2 Inventario de problemas

| # | Eje | Problema | Dónde |
|---|---|---|---|
| D1 | Ambigüedad | No se sabe qué contra qué: la letra remite a la nota y no a la leyenda | Todos los cruces |
| D2 | Carga | En dicotómicas, dos categorías y escalas, el complemento se marca dos veces | 22, 60, 74 |
| D3 | Legibilidad | La letra se funde con la cifra (mismo cuerpo y peso, blanca sobre azul) y el espaciado es irregular | Todos |
| D4 | Coherencia con la prueba | No hay umbral de magnitud: se marcan diferencias de menos de 5 puntos | 27 |
| D5 | Coherencia con la prueba | **Doble vara.** La lámina y las tablas usan z con Bonferroni dentro de la fila, sin conglomerado. El plan de análisis (§4) exige Rao-Scott por aula, umbral de 10 puntos y frágiles (p de 0.01 a 0.05) redactadas con prudencia | Motor (`comparar_columnas_sig`) |
| D6 | Notas | Notas de dos líneas, genéricas y lejos del gráfico, con un mapa «A = … \| B = …» que duplica la leyenda | Todos |
| D7 | PPT y Word | El Word tiene otra tipografía, notas sin mapa, letras sin nota y cruces sin marcas | Word v4 |
| D8 | Explicación | «Cómo leer» no tiene ejemplo y su vocabulario no coincide con las notas | Lámina 5 |
| D9 | Base pequeña | No hay advertencia por grupo; la base dice «400» aunque el grupo sea de 11 | 61 (retirada) |
| D10 | Accesibilidad | El mapeo letra-grupo pasa por el color de la leyenda, sin un rótulo escrito junto al grupo | Todos |
| D11 | UI | El nivel se elige con un paso a paso, lo que invita a moverlo hasta que salga algo. No hay elección de prueba, corrección, umbral ni base mínima, ni revisión en lote | Inspector |
| D12 | UI | La ayuda se recorta (C4), el glifo de la maqueta no corresponde al render (C1) y no hay explicación por marca (C5) | Inspector y maqueta |
| D13 | UI | La configuración es por gráfico. Las 33 láminas con cruce pueden quedar con reglas distintas sin que nadie lo vea | `mostrar_significancia` por lámina |

### 1.3 Causa en el motor

- `graficos_significancia.R` delega en `comparar_columnas_sig()` (`reporte_cruces.R:854`): z con proporción combinada y Bonferroni dentro de la fila. No hay prueba de diseño (el paquete `survey` no está en `DESCRIPTION`), ni umbral de magnitud, base mínima o categoría de frágil.
- La marca viaja como **texto** (`sufijos_etiqueta` → `" AB"`), concatenado al rótulo de la cifra. Por eso hereda su color, su cuerpo y su posición (D3), y el graficador no puede dibujarla de otra forma.
- La nota sale de `.graficos_sig_nota()`. La lámina la escribe sobre «Base:» (`lamina_nota_significancia.R`), pero el Word la recibe como caption de ggplot (D7).
- `.graficos_sig_sufijos()` marca cada celda significativa de la matriz. No sabe que en una dicotómica «No» es el complemento de «Sí» (D2).

### 1.4 Referentes

Esto lo resumo de memoria y no lo verifiqué contra las fuentes en esta sesión.

- **Pew Research:** escribe la diferencia en el texto y, en el gráfico, resalta solo lo significativo con una nota corta («Las diferencias destacadas son estadísticamente significativas»).
- **Ipsos y Gallup:** usan flechas ▲▼ frente al total o frente a la ola anterior.
- **Datawrapper y Flourish:** anotan directamente junto a la barra, con pocas palabras.
- **Tablas de banner (SPSS Tables, Q):** letras de columna, que es lo que el estadístico espera.

De ahí salen las direcciones de la ronda 2. Ninguna se copia tal cual.

---

## 2. Ronda 2: exploración

### 2.1 Primer juego, con letras y sin letras

`img/r2/board1.png` (no versionada)
`img/r2/board2.png` (no versionada)

- **G1, letras guiadas** (letra volada y en la leyenda): se lee como una llamada de nota al pie. Descartada.
- **G2, frente al total** (▲▼): cambia la prueba a «grupo frente al resto». Con dos grupos es redundante, porque uno sube si el otro baja.
- **G3, columna de brecha** («+27 pts»): con dos grupos es excelente, pero no escala a cuatro niveles («¿Nivel 9 frente a 7 y 8?»).
- **G4, franja de hallazgos:** es la que mejor explica, pero achica el gráfico y en el Word tendría que pasar al texto.
- **G5, brecha con intervalo:** sirve para un anexo técnico (`img/r2/g5-agrupadas.png`).

### 2.2 Segundo juego, a pedido de Gonzalo: sin letras, sobre las láminas 40 y 74

| # | Propuesta | Imagen |
|---|---|---|
| 1 | Énfasis: lo que difiere en color pleno y lo demás atenuado | `img/r2b/par-p1-enfasis.png` (no versionada) |
| 2 | Brecha anotada: corchete con «+27 pts» | `img/r2b/par-p2-brecha.png` (no versionada) |
| 3 | Punto de hallazgo: ● junto al grupo mayor | `img/r2b/par-p3-punto.png` (no versionada) |
| 4 | Frente al total: ▲▼ y una línea con el total | `img/r2b/par-p4-promedio.png` (no versionada) |
| 5 | Anotación directa: una frase junto a la barra | `img/r2b/par-p5-anotacion.png` (no versionada) |
| 0 | Letras ▲A, como referencia | `img/r2b/par-p0-letras.png` (no versionada) |

### 2.3 Evaluación

Escala de 1 a 5, donde más es mejor.

| Criterio | G1 | G2/4 | G3/2 | G4/5 | 1 | 3 | **0 (▲A)** |
|---|---|---|---|---|---|---|---|
| Claridad para un cliente no técnico | 2 | 5 | 5 | 5 | 4 | 4 | 4 |
| Qué contra qué (fiel a la prueba entre pares) | 4 | 2 | 4 | 3 | 2 | 3 | **5** |
| Carga visual | 4 | 3 | 4 | 2 | 4 | 5 | 4 |
| Escala a 4 o más grupos y 10 filas | 4 | 5 | 1 | 2 | 3 | 3 | **5** |
| Mismo lenguaje en todos los tipos de gráfico | 4 | 3 | 2 | 3 | 3 | 4 | **5** |
| Paridad entre PPT y Word | 5 | 4 | 4 | 2 | 4 | 5 | 5 |
| Sin depender del color | 4 | 3 | 5 | 5 | 2 | 3 | **5** |
| Coherencia con las tablas de cruces | 4 | 1 | 2 | 2 | 1 | 2 | **5** |
| Costo en el motor nativo y en ggplot | 5 | 3 | 3 | 1 | 3 | 5 | 4 |

### 2.4 Decisión

**Gonzalo eligió la 0, las letras con cápsula ▲A.** Es la única que dice qué contra qué en cualquier número de grupos, que coincide con las tablas de cruces y que no depende del color. Para compensar su debilidad, que el cliente tenga que traducir la letra, se tomaron ideas de las demás:

- de G3/2, el umbral de magnitud y la brecha en puntos, que pasan a la explicación de la UI;
- de G4/5, la redacción sugerida («Copiar redacción»);
- de 1, el silencio: lo que no difiere no se marca.

Direcciones de UI (`img/r2/ui-*.png`):

- **UI-A, todo en el inspector:** se descarta porque reproduce D13, con reglas por gráfico.
- **UI-B, política del informe:** se adopta.
- **UI-C, lente de explicación:** se adopta como «Por qué».

---

## 3. Rondas 3 y 4: diseño final

### 3.1 Tipos de gráfico (PPT 16:9)

| | |
|---|---|
| `img/final/f1-agrupadas.png` (no versionada) **Agrupadas.** La letra va dentro del cuadro de color de la leyenda y la base va en la columna «Base (n)», cerca de las barras y sin separador. | `img/final/f2-dicotomica.png` (no versionada) **Dicotómica apilada.** Solo se marca «Sí». La letra va junto a cada fila y la n, en la esquina superior derecha de la barra. |
| `img/final/f3-escala-ttb.png` (no versionada) **Escala.** Solo se marca el *top two box*. El frágil lleva contorno punteado. «No sé» se ve, pero no se compara ni se rotula. | `img/final/f4-apilada-nominal.png` (no versionada) **Apilada nominal.** Se marca por segmento, solo en el grupo mayor. |
| `img/final/f5-serie-niveles.png` (no versionada) **Serie por niveles.** La leyenda va a la derecha: cuadrados de color, centrada a media altura. El rótulo del punto mayor va arriba y el del menor abajo. | `img/final/f6-multiple.png` (no versionada) **Respuesta múltiple.** Cada opción se compara por separado y la nota declara las opciones omitidas. |

### 3.2 Word A4

`img/final/w-pagina-a4.png` (no versionada)

Es el mismo sistema, con la cifra a 9.5 pt y la cápsula a 8 pt. La nota se centra bajo «Base», se envuelve al ancho del texto (6.27 in) y usa **el mismo texto** que la lámina.

### 3.3 Casos borde

| Caso | Maqueta | Regla |
|---|---|---|
| Muchas categorías | `img/final/e1-muchas-categorias.png` (no versionada) | De mayor a menor, cifra de 12 pt o más y cápsula a 0.8 × la cifra. Solo se marcan las filas que difieren |
| Base pequeña | `img/final/e2-base-pequena.png` (no versionada) | Grupo con n < 30: trama, rótulo «n = NN · no se compara» en coral, sin cápsula y sin servir de referencia para las demás. Cada grupo es una fila con su letra: no depende del color |
| Ninguna diferencia | `img/final/e3-ninguna.png` (no versionada) | Sin marcas. La nota lo dice con las cifras extremas, porque el silencio se leería como «no se probó» |
| Todas significativas | `img/final/e4-todas.png` (no versionada) | `▲A`, `▲AB`, `▲ABC`: la cápsula crece con las letras y entra en la barra |
| Respuesta múltiple | f6 | Una prueba por opción, con la base de cada grupo. La línea de contexto declara las opciones omitidas |
| Escala, *top two box* y «No sé» | f3 | La marca va solo en la columna del *top two box*. «No sé» cuenta en la base, no se compara y su valor va en la leyenda («No sé (N %)») |
| Grupo repetido, sin independencia | UI, estado «Abstención» | Sin marcas. Nota: «No se marcan diferencias: cada estudiante aporta varias respuestas (grupo repetido) y las observaciones no son independientes.» |
| Preguntas distintas a las mismas personas (multiapiladas por pregunta) | — | Sin marcas y con nota de abstención («dependiente»), como hoy |

### 3.4 «Cómo leer las diferencias entre grupos»

`img/final/l-como-leer.png` (no versionada)

Lleva un ejemplo real con llamadas numeradas y cinco reglas: letra, ▲A, sin marca, frágil y trama. El recuadro «Cómo se decide» se genera desde la política del informe, así que si se cambia la prueba, cambia el texto.

### 3.5 UI en Procesamiento › Gráficos

| Pantalla | |
|---|---|
| `img/final/u1-politica.png` (no versionada) | **Ajustes del informe › Diferencias entre grupos** (diálogo, `?panel=diferencias-regla`). Es una sola regla para láminas, Word y tablas. Propone por defecto la prueba de diseño cuando el estudio tiene conglomerados, y **avisa de la doble vara** antes de aplicar, con cuántas celdas de las tablas cambiarían. Umbral, base y nivel se eligen entre opciones cerradas; no hay paso a paso libre. Incluye la vista previa del texto que leerá el cliente |
| `img/final/u2-estados-inspector.png` (no versionada) | **Inspector › Gráfico › Diferencias entre grupos.** Interruptor por gráfico y resumen en vivo (marcadas, frágiles, bajo el umbral). Estados: con marcas, **vacío** (sin cruce, con «Agregar cruce»), **calculando** (esqueleto), **ninguna diferencia** (propone quitar el cruce, según el plan), **abstención** (motivo) y **error** (código `E_*` e `error_id`, con salida acotada) |
| `img/final/u3-por-que.png` (no versionada) | **Por qué** (capa sobre la vista previa, `?panel=diferencias-lamina&foco=<celda>`). Una sola capa a la vez, anclada bajo la cápsula. Muestra la frase con la brecha, el p ajustado, la prueba, las bases, el efecto de diseño, el intervalo y las tres condiciones con ✓/✗. «Copiar redacción» entrega la frase prudente si la diferencia es frágil. A la derecha está la tabla de pares de la lámina |
| `img/final/u4-revision-lote.png` (no versionada) | **Diferencias del informe** (sideover, `?panel=diferencias`). Revisión en lote de las 33 láminas con cruce, con el filtro «Para revisar»: frágiles con títulos que afirman, cruces sin diferencias, diferencias bajo el umbral, bases chicas y pruebas no ejecutadas. Exporta la revisión. Es la tabla del §5 del plan de análisis, hecha por la app |

Microinteracciones (`emil-design-eng`):

- Al pasar el cursor sobre una cápsula, aparece un anillo de 2 px en `--pulso-module-processing` en 120 ms. La capa abre con 140 ms ease-out, se desplaza 4 px y solo anima la opacidad y la posición.
- Al cambiar la regla, las cápsulas de la vista previa hacen un fundido cruzado de 180 ms. No hay rebote.
- Con `prefers-reduced-motion`, todo es instantáneo.
- Teclado: Tab recorre las cápsulas en orden de lectura y Enter abre «Por qué».

---

## 4. Especificación

### 4.1 Cuándo se marca una diferencia

Para cada fila (categoría, opción o *top two box*) y cada par de grupos (a, b) con p_a > p_b:

1. **Elegibilidad.** Los dos grupos deben tener n ≥ `base_minima` (30), y la variable no puede vivir en un grupo repetido ni comparar preguntas distintas. Si no se cumple, el par no se prueba y el grupo chico se dibuja con trama.
2. **Prueba.** Si `prueba = rao_scott`, se usa la z de diferencia de proporciones con la varianza linealizada por conglomerado (aula = curso-horario). Es la corrección de primer orden de Rao-Scott para la tabla de 2×2 del par. Si `prueba = z`, se usa la actual.
3. **Corrección.** Con `bh_informe`, Benjamini-Hochberg sobre **todas** las comparaciones del informe (láminas y tablas comparten la familia). Con `bonferroni_fila`, la de hoy.
4. **Se marca** si p_ajustado < `alfa` (0.05) **y** |p_a − p_b| ≥ `umbral_puntos` (10). La marca la lleva a y nombra a b.
5. **Frágil** si además 0.01 ≤ p_ajustado < 0.05. Lleva cápsula con contorno.
6. **Sin complementos.** En las dicotómicas solo se marca la opción principal (`Sí`, o la primera de la lista). En las escalas, solo el *top two box* (o el *bottom two box*, si el preset lo pide). En las nominales se marca por segmento.
7. **Fuera de la prueba.** «No sé», «No tengo información», «Otro» y «Prefiero no responder» cuentan en la base, no se marcan y no sirven de referencia. Se pueden incluir explícitamente (`incluir_ns = TRUE`).

### 4.2 Geometría (PPT, en pulgadas; 1 in = 100 px en las maquetas)

| Pieza | Medida |
|---|---|
| Cápsula: alto | 1.45 × su cuerpo (11 pt → 0.22 in), radio = alto / 2 |
| Cápsula: separación desde la cifra | 0.05 in |
| Cápsula: margen interior | 0.06 in a la izquierda, 0.04 in entre ▲ y letras, 0.07 in a la derecha |
| Triángulo | Lado de 0.62 × el cuerpo; forma nativa (`prstGeom triangle`), no un carácter: Arial no garantiza ▲ |
| Cápsula dentro de una barra | Solo si cabe con 0.10 in de aire a cada lado. Si no, va afuera, tras la cifra |
| Leyenda (agrupadas) | Cuadro de 0.19 in, radio 0.04, con la letra centrada (blanca sobre los oscuros y #081F5C sobre los claros), más el nombre del grupo a 12 pt, **sin la n**. Separación entre entradas: 0.34 in |
| Base por grupo (n), agrupadas | **Columna «Base (n)» a la derecha**, como la columna del *top two box* o la «Diferencia» de la lámina 94 (`.lam_laminas_comparativo_dim`). Va **sin separador** y a **0.34 in del borde derecho real** de la barra más larga (cifra y cápsula incluidas), no contra el margen. Encabezado «Base (n)» de 10 pt en negrita #5A6480. Una cifra por barra, en 11 pt #081F5C, centrada en una columna de 0.56 in y alineada con su barra. Base chica en coral |
| Base por grupo (n), apiladas | En la **esquina superior derecha de cada barra** (estándar de la casa): «n = NNN» de 10 pt, #5A6480, alineado a la derecha con el final de la barra y a 0.06 in sobre ella. Un rótulo de segmento chico que caería en esa esquina pasa debajo de la barra |
| Base por grupo (n), serie | Bajo el rótulo de cada nivel del eje, en 10 pt |
| Columna del *top two box* | Columna de 1 in del estándar (`columna_top_two_box`), a 0.20 in de la barra. **Rótulo corto y formal, centrado sobre sus cifras**: el nombre del indicador («Comodidad», «Calidad alta») en 10 pt negrita, en el verde del top two box. Nunca la suma de opciones («Cómodo + Muy cómodo»), que pasa a la línea de contexto. Cifra de 15 pt centrada en el eje de la columna; la cápsula va a su derecha sin desplazar la cifra |
| Ocupación vertical | El grosor de barra se conserva (estándar de `grosor_fraccion`) y el bloque de filas más leyenda **se centra a media altura de la zona de datos** (de `zona_datos_y0` = 1.65 in a `leyenda_y` = 6.42 in). No se estira la separación entre filas para llenar la altura |
| Letra de fila (apiladas y serie) | Círculo de 0.21 in, #081F5C (o #8E9DBD si la base es chica) y letra blanca de 9.4 pt, a 0.16 in del rótulo |
| Leyenda de la serie | Bloque a la derecha, 0.56 in después del eje y **centrado a media altura de la zona de datos**. Cada entrada lleva un cuadrado de 0.14 in (radio 0.02) del color de la serie, centrado en la entrada, y el nombre en 12 pt regular a 0.24 in (dos líneas como máximo). Separación entre entradas: 0.20 in. Sin rótulo de encabezado |
| Nota | Línea de marcas y método en `base_y − 0.24 in`; línea de contexto opcional, 0.16 in arriba. Reserva con `.lam_con_nota_sig` |

### 4.3 Tokens y tipografía

| Uso | Valor | Contraste |
|---|---|---|
| Cápsula: fondo y texto | `banda_clara` #E3E7EF / `azul` #081F5C | 12.45:1 |
| Cápsula frágil: borde, triángulo y texto | **nuevo `fragil` #3A6591**, guion de 3/2.2 px y 1.3 px | ≈5.3:1 sobre #F2F2F2 (el #4F7FAF de hoy da 3.76) |
| *Top two box* | **nuevo `verde_top_two_box_texto` #3B7A2A** (el #4E9438 de hoy da 3.34) | ≥4.5 |
| Cifra sobre coral, «Excelente» y segmentos medianos | Blanca (la regla de `oscuros` se amplía) | ≥4.5 |
| Grupo chico | Trama a 45° de #8E9DBD sobre #E3E7EF; rótulo #5A6480 sin cursiva | 5.26:1 |
| Texto de la nota | `texto_suave` #5A6480, 9 pt (8 pt en el Word) | 5.26:1 |
| Cuerpo de la cápsula | 11 pt con cifra de 14, 10 pt con cifra de 12, 8 pt en el Word; siempre ≈0.8 × la cifra | — |

En la UI: `--pulso-module-processing` para el foco y la acción; `--pulso-warn-*` para abstención y frágiles con título afirmativo; `--pulso-danger-*` para errores. La cápsula de la UI usa los mismos colores de la lámina para que se reconozca.

### 4.4 Redacción exacta

Es una sola fuente para el PPT, el Word, «Cómo leer» y la UI (`graficos_significancia_textos.R`).

| Situación | Texto |
|---|---|
| Línea de marcas | `[▲A]  Mayor que el grupo de esa letra: diferencia significativa y de al menos 10 puntos. Rao-Scott por aula, p < 0.05 con corrección de Benjamini-Hochberg.` |
| Con alguna frágil (se agrega antes del método) | `[△A]  Frágil: igual, con p ajustado entre 0.01 y 0.05.` |
| Ninguna diferencia | `Ninguna diferencia entre {niveles\|grupos} es significativa: el {p_max}% de {grupo_max} y el {p_min}% de {grupo_min} no se distinguen con esta muestra. {método}` |
| Base pequeña (contexto) | `Con trama: {grupos} con menos de 30 casos. Se muestran como referencia y no se comparan.` |
| *Top two box* (contexto) | `{Rótulo}: {opciones sumadas}; la marca la compara. «No sé» se muestra y cuenta en la base, pero no se compara.` (p. ej., «Comodidad: Cómodo + Muy cómodo; …») |
| Múltiple (contexto) | `Respuesta múltiple: cada opción se compara por separado y los porcentajes no suman 100%. Se omiten {k} opciones sin diferencias (ver tablas de cruces).` |
| Abstención | `No se marcan diferencias: cada estudiante aporta varias respuestas (grupo repetido) y las observaciones no son independientes.` |
| Prueba z (si se elige) | En el método: `prueba z, p < 0.05 con corrección de Bonferroni.` |
| Redacción sugerida, firme | `{Grupo a} {verbo} con más frecuencia {fila} ({p_a}% frente a {p_b}%).` |
| Redacción sugerida, frágil | `{Grupo a} {verbo} algo más {fila} ({p_a}% frente a {p_b}%).` (no se lleva a conclusiones) |

Números en es-PE, con punto decimal. «Puntos», no «pp». «p ajustado», sin α en el texto para el cliente.

---

## 5. Crítica independiente (ronda 4)

Un revisor sin acceso a mi razonamiento evaluó las maquetas de la ronda 3 contra el Contrato de Superficie, la armonía visual y la accesibilidad. Además, Gonzalo señaló superposiciones de texto y la leyenda de la serie. Para no depender del ojo, armé dos detectores (`mock/solapes.cjs` y `mock/solapes-ui.cjs`) que miden en Chromium las cajas de texto, las marcas, las cápsulas, las tarjetas y las capas flotantes. Los verifiqué contra los casos conocidos: ambos reproducían los choques antes de las correcciones y ahora dan **cero hallazgos en las 12 láminas, la página A4 y las 4 pantallas**.

| # | Hallazgo | Corrección |
|---|---|---|
| 1 | e2 dependía del color (seis tonos, A y D a 1.78:1) | Cada carrera es una fila con su letra |
| 2 | f5 tenía dos porcentajes y «▲A» superpuestos | El mayor va arriba y el menor abajo. Leyenda a la derecha (pedido de Gonzalo) |
| 3 | En «Cómo leer», texto sobre texto y llamadas sobre cifras | Recolocadas y medidas |
| 4 | El frágil daba 3.76:1 | #3A6591 (≈5.3:1) |
| 5 | La nota explicaba solo ▲A | Redacción genérica («del grupo de esa letra») |
| 6 | La nota no cabía en una línea y en el Word se salía del margen | Una línea para las marcas y otra opcional para el contexto. En el Word se envuelve a 6.27 in |
| 7 | En e3 había una pastilla huérfana | Eliminada; lo dice la nota |
| 8 | e1 tenía la cifra de 11 pt y la cápsula del mismo tamaño | Cifra de 12, cápsula de 10 y orden de mayor a menor |
| 9 | El verde del *top two box* y las cifras sobre coral y «Excelente» no llegaban a 4.5 | Tokens nuevos y cifra blanca |
| 10 | Los rótulos con trama daban 2.75:1 y estaban en cursiva | #5A6480, sin cursiva |
| 11 | El texto del Word no era el de la lámina | Fuente única de textos |
| 12 | El frágil era ambiguo en la magnitud | «Frágil: igual, con p ajustado entre 0.01 y 0.05» |
| 13 | «Se muestran las opciones con diferencias» ocultaba la selección | «Se omiten k opciones sin diferencias (ver tablas)» |
| 14 | Falta una prueba de tendencia con niveles ordenados | → decisión D6 |
| 15 | La nota de 9 pt es lo único que explica | Se mantiene en 9 pt (estándar). La explicación la cargan la leyenda con letras y la lámina 5 → decisión D8 |
| 16 | Quedaban rótulos «Datos ilustrativos» en las láminas | Retirados; los datos ilustrativos se declaran aquí (§8) |
| 17 | La A4 tenía media página vacía | Se aceptó: el gráfico siguiente va en la otra página porque no cabía sin chocar con el folio |
| UI | La capa «Por qué» quedaba recortada por la lámina y tapaba la leyenda | Una capa a la vez, fuera del recorte y con flecha. El ejemplo «sin marca» pasa a la tabla |

Una falla de proceso que conviene registrar: Chrome headless no generaba las PNG cuando recibía una ruta relativa, y lo hacía sin avisar. Durante un tramo estuve mirando capturas viejas. Lo resolví cambiando a Playwright con rutas absolutas y error explícito, y comprobando la fecha de cada PNG.

---

## 6. Plan de implementación

Rama 1 (Construir) con la superficie de la Rama 2. Este archivo está en `policy.frozen_growth_files`: `reporte_plan_ppt.R` **no crece**, solo cambia las llamadas. Para la política hace falta un ADR nuevo, con el número libre siguiente a 0113.

### Fase 0. ADR y contrato de datos

**ADR «Una regla de diferencias por estudio».** Define:

- la política, persistida en `graficos_config$significancia` del `.pulso`;
- que las tablas de cruces la adoptan;
- la migración: `mostrar_significancia` por lámina se mantiene como interruptor; `significancia_alpha` por lámina se lee y nunca se escribe;
- el conglomerado, que se toma de la variable de aula del diseño (de Cálculo de muestra o de un rol de carga).

**Contrato hacia la UI** (`GET /api/graficos/diferencias?slide=<id>` y `GET /api/graficos/diferencias/informe`):

```json
{ "regla": { "prueba": "rao_scott", "correccion": "bh_informe", "alfa": 0.05, "umbral_puntos": 10,
             "base_minima": 30, "fragiles": "contorno", "conglomerado": "curso_horario" },
  "laminas": [{ "slide_id": "ccss-040", "estado": "con_marcas|ninguna|abstencion|sin_cruce|error",
    "motivo": null, "error": null,
    "grupos": [{ "letra": "A", "etiqueta": "Grupo A", "n": 200, "comparable": true }],
    "pares": [{ "fila": "Académica", "a": "B", "b": "A", "p_a": 44, "p_b": 17, "dif": 27,
                "p": 0.00002, "p_ajustado": 0.0004, "deff": 1.14, "ic": [18, 36],
                "veredicto": "marcada|fragil|bajo_umbral|no_significativa|no_comparable",
                "redaccion": "…" }],
    "revisar": ["titulo_afirma_fragil"] }],
  "resumen": { "cruces": 33, "marcadas": 41, "fragiles": 5, "ninguna": 7, "bases_chicas": 2, "sin_prueba": 1 } }
```

El normalizador defensivo va en `frontend/src/api/graficos.ts`, siguiendo el patrón de `normalizeGraficosShareInspect`.

### Fase 1. Motor (R): `backend-r`, revisado por `revisor-metodologico`

| Archivo | Cambio |
|---|---|
| **nuevo** `api/R/graficos_significancia_regla.R` | Normaliza, valora por defecto según el diseño (con conglomerado, Rao-Scott) y migra los argumentos viejos |
| **nuevo** `api/R/graficos_significancia_diseno.R` | Varianza linealizada por conglomerado para la diferencia de proporciones. Base R: no exige `survey`. Si se prefiere `survey::svychisq`, va a `DESCRIPTION` (decisión D2) |
| `api/R/graficos_significancia.R` | Devuelve una **estructura** por celda (`letras`, `fragil`, `veredicto`, `dif`, `p_ajustado`) en lugar de un sufijo de texto. Aplica el umbral, la base mínima, los complementos y las categorías fuera de la prueba |
| `api/R/reporte_cruces.R` | `comparar_columnas_sig()` acepta la regla. La de hoy queda como `prueba = "z", correccion = "bonferroni_fila"` |
| **nuevo** `api/R/graficos_significancia_bh.R` | Recolecta los p de todo el informe y ajusta con BH. Necesita dos pasadas: calcular todo y luego marcar |
| **nuevo** `api/R/graficos_significancia_textos.R` | Fuente única de las notas, del contexto y de la redacción sugerida |
| `api/R/lamina_significancia_capsula.R` (**nuevo**) | Dibuja la cápsula nativa (roundRect, triángulo y texto agrupados como `prosecnur:sig:capsula`) y decide si va dentro o fuera de la barra |
| `api/R/lamina_nota_significancia.R` | Línea de marcas más contexto opcional. Reserva de alto para dos líneas |
| `api/R/graficador_barras_agrupadas.R`, `graficador_barras_apiladas.R`, `graficos_serie_significancia.R` | Word/ggplot: `geom_label` con relleno #E3E7EF y triángulo `shape = 17`. Leyenda con letra en la llave. Serie: leyenda a la derecha |
| `api/R/graficos_metadata.R` | `significancia_alpha` sale del inspector por lámina; se agrega `incluir_ns` |
| `api/R/router_graficos.R` | Endpoints de la fase 0 (router delgado: valida, llama al engine y serializa) |
| `api/R/errors_registry.R` | `E_SIG_SIN_CONGLOMERADO` y `E_SIG_PRUEBA_FALLO` |
| `api/R/reporte_plan_ppt.R` (congelado) | Solo cambia la firma de las dos llamadas a `.graficos_sig_aplicar*`, sin crecer |
| Lámina «Cómo leer» | El preset del bloque de texto pasa a una lámina compuesta, cuyo «Cómo se decide» lee la regla |

**Tests (testthat):**

- Rao-Scott contra un caso resuelto a mano o con `survey` (fixture).
- BH contra `p.adjust`.
- Umbral, base mínima, complementos (una dicotómica marca solo «Sí»), «No sé» fuera de la prueba y frágil.
- Paridad: la lámina y la tabla de cruces dan las mismas letras para la misma regla.
- Contrato de artefactos: la cápsula existe como grupo nombrado en el PPTX.
- Golden del Word con la nota nueva.
- `test-errors-registry` y `test-namespace-contract`.

**Gate:** `make gate-area AREA=graficos GATE_ARGS='--patron "signif|cruces"'`.

### Fase 2. UI (React): `frontend-react`

| Archivo | Cambio |
|---|---|
| **nuevo** `features/graficos/laminas/diferencias/ReglaDiferenciasDialog.tsx` | U1 (`usePanelDireccionable`, `?panel=diferencias-regla`) |
| **nuevo** `…/diferencias/DiferenciasInspector.tsx` | U2, con sus seis estados y `data-audit-ready` |
| **nuevo** `…/diferencias/PorQuePopover.tsx` | U3 (`?panel=diferencias-lamina&foco=`) |
| **nuevo** `…/diferencias/RevisionDiferenciasPanel.tsx` | U4 (`?panel=diferencias`) |
| **nuevo** `…/diferencias/store.ts` | Estado efímero (fila elegida, filtro), con el patrón de `validacion/store.ts` |
| `frontend/src/api/graficos.ts` | `getDiferencias`, `getDiferenciasInforme` y el normalizador |
| `features/graficos/panelesGraficos.ts` | Tres paneles declarados |
| `laminas/argsDatosGrafico.ts`, `numerosEnBotones.ts`, `gruposTarjeta.ts` | Se retira el paso a paso de `significancia_alpha`; la sección «Diferencias entre grupos» reemplaza a la fila de Cifras |
| `laminas/maqueta/fichaModelo.ts` + `iconos/glifosGrafico.tsx` | El glifo de la maqueta dibuja la cápsula ▲ y no puntos rojos (C1) |

**Tests (vitest):** normalizador, estados del inspector, la capa no se recorta (geometría), contratos de paneles (`auditReadyRoutes`, `modulesNavigation`), `tokensDefinidos` y `estadoQueNadieLee`.

**Gate:** `make gate-front AREA=graficos` y QA visual de `/graficos?pestana=laminas&foco=ccss-040&panel=diferencias-lamina` con `--post-click-wait-selector`.

### Fase 3. Verificación sobre el estudio

1. Regenerar el mazo y el Word de CCSS con la regla del plan.
2. Comparar con la tabla del §5 del plan de análisis: las láminas 40, 41 y 54 deben salir frágiles, la 57 sin diferencias y la 61 con bases chicas.
3. Correr el render, el detector de solapes sobre el PPTX exportado (el `ui-quick-check` no lo cubre) y `verificador`.

---

## 7. Decisiones para Gonzalo

| # | Decisión | Recomendación |
|---|---|---|
| D1 | ¿Una regla por estudio que también gobierne las tablas de cruces? Resuelve la doble vara, pero cambia letras de tablas ya entregadas | Sí, con el aviso de cuántas celdas cambian |
| D2 | ¿Rao-Scott implementada en base R o agregar `survey` a `DESCRIPTION`? | Base R para la diferencia de dos proporciones, con `survey` solo en los tests como referencia |
| D3 | ¿BH sobre todo el informe, o Bonferroni dentro de la fila como hoy? | BH en el informe, que es lo que pide el plan de análisis |
| D4 | ¿Las frágiles se muestran al cliente (contorno) o solo en la revisión interna? | Contorno en el PPT. En el resumen ejecutivo no se usan |
| D5 | ¿Umbral de 10 puntos para todo estudio o solo como valor por defecto? | Por defecto 10, editable en la regla del estudio |
| D6 | Con niveles ordenados (Nivel 6 a 9), ¿se agrega una prueba de tendencia a la nota? | Como opción, no por defecto |
| D7 | Con 5 o más grupos (carreras), ¿se mantienen las letras o se cambia a «frente al resto» (▲▼)? | Letras hasta 6 grupos; con más, «frente al resto» |
| D8 | ¿La nota se queda en 9 pt o sube la línea de marcas a 10 pt? | 9 pt (estándar), con letras en la leyenda y la lámina 5 |
| D9 | ¿Se versionan las imágenes con datos de CCSS en este repo público? | No: solo `propuesta.md` y `mock/`. Las imágenes van a la carpeta del estudio o quedan locales |

---

## 8. Datos de las maquetas

- **Reales del mazo v4:** las láminas 40, 74, 60 y 91, las bases por grupo y los porcentajes de tres láminas de escala. Esas cifras estaban en las imágenes, que no se versionan, y se retiraron de este texto porque el repositorio es público.
- **Ilustrativos:** los p, intervalos y efectos de diseño de la UI; los niveles 7 y 8 de las escalas; la serie «experiencia vinculada»; el transporte con 10 opciones; las carreras que no venían del mazo; los conteos del panel de revisión.
- Las letras de las maquetas siguen las de la lámina original (z con Bonferroni), salvo los ajustes de magnitud. **No son el resultado de la regla nueva.**

Generadores en `mock/`: `python3 mock/r3.py <salida>` y `python3 mock/r3ui.py <salida>`. Los detectores van con `node mock/solapes.cjs <html…>` y `node mock/solapes-ui.cjs <html…>` (usan el Playwright de `frontend/node_modules`).
