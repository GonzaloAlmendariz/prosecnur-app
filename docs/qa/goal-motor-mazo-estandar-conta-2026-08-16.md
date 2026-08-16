# GOAL — El motor produce el informe de Contabilidad, y después mejor

Tipo: Goal operativo (loop de convergencia)
Estado: Abierto
Fecha: 2026-08-16
Autoridad: Objetivo de trabajo medible; **sólo Gonzalo lo cierra**

## Por qué existe

El informe final de **ACRD CONTA** es la vara que ya existe: un entregable real,
revisado, con las decisiones de diseño tomadas y defendidas ante cliente. El
motor de gráficos produce hoy una parte de eso, y la distancia entre lo que
produce y ese informe es exactamente el trabajo pendiente.

No es un loop de pulido visual. Es de **capacidad**: que el motor tenga todos
los elementos para armar ese informe sin retoques a mano, y a partir de ahí
crecer — más tipos de lámina, más tipos de gráfico, cada uno definido al
milímetro en vez de calibrado a ojo.

Los comentarios de Gabriela son la otra mitad de la vara: son la revisión de
alguien que usa el entregable, y cerrarlos por completo —no los fáciles— es lo
que separa «el motor dibuja» de «el motor entrega».

## La vara

| | Afirmación | Cómo se mide |
|---|---|---|
| **V1** | El motor arma el informe de CONTA de punta a punta | Cada lámina del informe real tiene su receta; 0 retoques a mano |
| **V2** | Los comentarios de Gabriela están cerrados, todos | Cada comentario: cerrado con su cambio, o descartado con su porqué escrito |
| **V3** | Cada gráfico está definido al milímetro | Su receta declara datos, orden, escala, rótulos, redondeo y vacíos — nada se decide en el graficador |
| **V4** | El recetario cubre lo que un informe necesita | Para cada pregunta de un instrumento típico hay una lámina que la responde |
| **V5** | Los tipos de lámina crecen con criterio | Cada tipo nuevo nace de una necesidad medida en un informe real, no de una idea |
| **V6** | Un gráfico nuevo no rompe a sus hermanos | Añadir un tipo no cambia el render de los existentes |

## La cola

| # | Qué | Vara | Estado |
|---|---|---|---|
| L1 | Inventariar el informe de CONTA lámina por lámina y marcar cuáles sabe hacer el motor hoy | V1 | ◐ **mitad hecha** · inventariado lo que el motor sabe hoy (abajo); falta el lado del informe, que espera decisión |
| L2 | Reunir los comentarios de Gabriela y clasificarlos: motor, receta, dato o criterio | V2 | ☐ |
| L3 | Cerrar los que son del motor | V2 | ☐ |
| L4 | Cerrar los que son de receta | V2 | ☐ |
| L5 | Resolver los que exigen decisión de criterio | V2 | ☐ · previsiblemente van a la bandeja |
| L6 | Cubrir las láminas de CONTA que el motor aún no sabe hacer | V1 | ☐ |
| L7 | Auditar el recetario contra un instrumento típico y anotar los huecos | V4 | ☐ |
| L8 | Definir al milímetro los gráficos que hoy calibran a ojo | V3 | ☐ |
| L9 | Ampliar tipos de lámina, uno por necesidad medida | V5 | ☐ |
| L10 | Guard de no-regresión entre tipos de gráfico | V6 | ☐ |

## Lo que el motor sabe hacer hoy (2026-08-16)

Mitad no bloqueada de L1: el lado del motor no depende de qué informe sea el
canónico, así que se midió primero.

| | |
|---|---|
| Graficadores con nombre propio | **23** |
| Tipos de lámina | **3** — `title_slide`, `text_slide`, `ppt_slide` |
| Archivos del motor de plan/slides | 12 |

Los 23: barras (categóricas, numéricas, agrupadas, apiladas, divergentes),
boxplot, histograma, pie, lollipop, dumbbell, radar (simple, dimensiones, tabla,
comparativo radarbar), heatmap (dimensiones, criterios), FODA, media-rango,
puntos comparativos, serie temporal, nube de palabras, mapa de cobertura
territorial y el propio `graficar_ppt`.

**La cifra que llama la atención es la de láminas: tres.** Veintitrés formas de
dibujar y tres formas de montar la página. Si el informe de CONTA usa
disposiciones que el motor no tiene —dos gráficos comparados, gráfico con tabla
al lado, lámina de cierre con conclusión— eso no sale de un graficador nuevo
sino de un tipo de lámina nuevo, y es justo lo que V5 pide medir contra un
informe real antes de inventar.

Queda pendiente el otro lado del mapa: qué necesita el informe. Sin él esto es
un inventario, no una distancia.

## Reglas de este loop

**El informe manda sobre la idea.** Un tipo de lámina nuevo entra cuando un
informe real lo necesitó, no cuando parece que quedaría bien. V5 existe para
frenar el catálogo que crece por entusiasmo.

**Un comentario cerrado tiene su cambio o su porqué.** «Ya está» no cierra nada:
o hay commit, o hay una línea explicando por qué se descarta. Los comentarios
que exigen decisión metodológica van a la bandeja de Gonzalo, no se resuelven
por cuenta propia.

**Definir al milímetro significa que la receta decide.** Si el graficador elige
un redondeo, un orden o un salto de escala, eso no está definido: está
improvisado en el sitio equivocado. Ya hay antecedente —el redondeo de CONTA
vivía en el plan y no en el graficador, y por eso PPT y SPSS discrepaban.

**Verificar es abrir el archivo.** Un PPT que se genera sin error no es un PPT
correcto. Y el QA visual tiene su propia ceguera medida: LibreOffice iguala
`vert` y `vert270`, así que dos defectos reales no salían en los PNG.

## Trampas heredadas

De los GOALs de gráficos y del trabajo con CONTA:

1. **El QA visual no ve lo que ve PowerPoint** (`vert` / `vert270`, `<p:ph/>`
   vacío resuelto a horizontal).
2. **El redondeo real vive en el plan, no en el graficador.** Fue la causa de
   que PPT y SPSS dieran cifras distintas en CONTA.
3. **Un arg declarado puede no llegar a su graficador.** Hubo ocho mandos
   muertos; el CI ya lo vigila, pero los tipos nuevos vuelven a abrir la puerta.
4. **Porcentaje sin frecuencia por defecto**, forzado en tres capas.
5. **Un ícono que falta no puede costar el mazo entero** — degrada con aviso.

## Lo que espera a Gonzalo

| # | Decisión | Por qué no puedo yo |
|---|---|---|
| L2 | Dónde viven los comentarios de Gabriela y cuáles siguen abiertos | Sin la lista no hay vara para V2, y una lista incompleta da un «cerrado» falso |
| L1 | Qué informe de CONTA es el canónico, si hay más de una versión revisada | La vara tiene que ser un documento concreto, no «el informe de conta» en general |

## Relación con los otros GOALs

Convive con `goal-mazo-sin-retoques-2026-08-14.md`, que persigue que el mazo
salga conforme al recetario. **Ése es de conformidad; éste es de capacidad**: no
que lo que hay salga bien, sino que exista todo lo que el informe necesita.
Cuando se solapen, el de conformidad manda sobre lo ya construido y éste sobre
lo que falta.
