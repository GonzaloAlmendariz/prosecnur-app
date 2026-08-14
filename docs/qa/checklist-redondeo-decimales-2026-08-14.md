# Checklist — redondeo y decimales como configuración general de Gráficos

**Abierto**: 2026-08-14 · **Origen**: revisión de `ACRD CONTA/Revisón graficos.xlsx`
(64 observaciones PPT vs SPSS) · **Estado**: tandas A y B cerradas (motor y
configuración); tandas C (interfaz) y D (entregable) pendientes.

## De dónde sale esto

La revisión del mazo de ACRD CONTA devolvió 64 diferencias entre el PPT y el
SPSS. Ninguna era un error de dato: las bases, las N y las frecuencias coinciden
exactamente. Las 64 son de redondeo, y se reparten en dos grupos:

- **50 casos de ±1 punto** — barras apiladas usa reparto por resto mayor para
  que las cifras impresas sumen 100 %; SPSS redondea cada cifra por separado.
- **14 casos rotulados 0 %** — categorías de exactamente 1 persona sobre bases
  de 139–178 (0,56 %–0,72 %). SPSS las sube a 1 %; el reparto las deja en 0.

Al auditar el motor apareció el problema de fondo, que es mayor que la revisión:
**no hay un método de redondeo, hay tres**, ninguno es configurable, y la
elección está escrita a mano dentro de cada familia de gráficos.

## Estado del motor ANTES de la tanda A (medido, 2026-08-14)

| Familia | Método actual | ¿0,5 sube? | ¿Control de decimales? |
|---|---|---|---|
| Barras apiladas | Resto mayor | reparte | sí |
| Multi-apiladas | Resto mayor | reparte | sí |
| Barras agrupadas | Half-up (regla de la casa) | sí | sí |
| Barras categóricas | Half-up (regla de la casa) | sí | sí |
| Barras numéricas | Half-up (regla de la casa) | sí | sí |
| Histograma | Half-up (regla de la casa) | sí | sí |
| Barras divergentes | `round()` de R | **no, al par** | **no** |
| Lollipop | `round()` de R | **no, al par** | **no** |
| Dumbbell | `round()` de R | **no, al par** | **no** |
| Puntos comparativos | `round()` de R | **no, al par** | **no** |
| Pie / Donut | por verificar | por verificar | **no** |
| Serie temporal / Radar | por verificar | por verificar | **no** |

Solo **6 de 23 presets** exponen `decimales`. El método de redondeo no está
expuesto en ninguno.

El `round()` de R redondea al par: 12,5 % baja a 12 % mientras 87,5 % sube a
88 % en el mismo gráfico. Es un bug ya diagnosticado en la casa —el comentario
de `graficador_barras_agrupadas.R:877` lo describe y por eso nació
`.pulso_round_half_up`— pero el arreglo nunca se propagó a las otras cuatro
familias.

## Checklist

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| 1 | Definir los dos mecanismos con nombre y explicación en español | ADR nuevo + copy de UI | **decidido** — «Redondeo estándar» y «Reparto a 100 %» |
| 2 | Elegir cuál es el default general de fábrica | ADR nuevo | **decidido** — redondeo estándar |
| 3 | Función única de rotulado de % que reciba el método como parámetro | `api/R/helpers_calc_comunes.R` | **hecho** |
| 4 | Que las 8+ familias de % usen esa función (hoy hay 3 métodos sueltos) | `api/R/graficador_*.R` | **hecho** |
| 5 | Reparar el `round()` al par en divergentes, lollipop, dumbbell y puntos comparativos | `api/R/graficador_*.R` | **hecho** — y serie temporal, que también lo tenía |
| 6 | Decidir qué gráficos «manejan porcentajes» y cuáles quedan fuera | `graficos_metadata.R` (`.PRESETS_META`) | **decidido** — ver «dos clases» abajo |
| 7 | Extender `decimales` a los presets de % que hoy no lo tienen (17 de 23) | `graficos_metadata.R` | **hecho** |
| 8 | Argumento nuevo de método de redondeo en el preset de cada tipo | `graficos_metadata.R` + cadena de whitelists | **hecho** |
| 9 | Pestaña «Cálculos» en el popover de Configuración global | `frontend/src/features/graficos/ConfiguracionGlobal.tsx` | pendiente |
| 10 | Matriz tipo de gráfico × (redondeo, decimales) dentro de esa pestaña | componente nuevo, hoja propia | pendiente |
| 11 | La config general gana; los overrides por slide quedan ocultos y desactivados por defecto | `reporte_plan_ppt.R` (`.merge_args`) + `ArgField.tsx` | pendiente |
| 12 | Conservar el override por slide como escape explícito, no como default | `ArgGroup.tsx` / `ArgField.tsx` | pendiente |
| 13 | Persistencia en el `.pulso` y compat de planes viejos | `router_graficos.R`, store del plan | **hecho** |
| 14 | Nota al pie del entregable declarando el criterio de redondeo | motor PPT / Word | pendiente |
| 15 | Tests: mismo dato, mismo número en toda familia de % | `api/tests/testthat/` | **hecho** |
| 16 | Cifras que redondean a 0 %: se rotula «0 %» salvo en apiladas, donde no se dibuja nada | `helpers_calc_comunes.R` + familias | **hecho** |
| 17 | Lámina metodológica explicando ambos redondeos | `graficos_metadata.R` + `reporte_plan_ppt.R` | pendiente |

## Tanda A — lo que quedó hecho y su evidencia

**Ítem 3.** `.pulso_pct_metodo()`, `.pulso_pct_unidades()` y
`.pulso_pct_etiquetas()` en `helpers_calc_comunes.R`. Ambos métodos devuelven la
misma escala de unidades, así que son intercambiables en el punto de uso.
`.pulso_pct_metodo()` tolera alias (`resto_mayor`, `hare`, `half_up`,
`clasico`, `comercial`) porque el campo se persistirá en el `.pulso`, y degrada a
`estandar` ante cualquier valor desconocido: un método inválido no puede volverse
un error de render a mitad de un mazo.

**Ítem 4 (apiladas).** Apiladas elige método vía `metodo_redondeo`, con
`estandar` por defecto. Las familias que **no cierran a 100 %** quedaron todas
sobre el half-up compartido, que es exactamente el método estándar: para ellas no
hay nada más que enrutar. Categóricas, pie y donut se completaron en la tanda B.

**Ítem 5.** Reparado en cinco familias, una más de las cuatro previstas: serie
temporal también llamaba a `round()`. Cubre etiquetas de valor, etiquetas de eje
y las cifras de saldo/brecha en `pp`.

**Ítem 16.** En apiladas, un segmento cuyas unidades son 0 no se dibuja. La masa
liberada se reparte **en proporción** entre los segmentos vivos, y no en el
cierre exacto de la barra: aquél absorbe todo el faltante en un solo segmento
—el último del stack— porque nació para tapar residuo de coma flotante del orden
de 1e-16. Sin ese reparto proporcional, el segmento vecino de la lámina de
Egresados pasaba de 0,56 % a 1,12 % de ancho mientras su etiqueta seguía diciendo
1 %, que es el mismo divorcio entre cifra y geometría que la regla viene a
cerrar.

**Ítem 15.** `test-graficos-redondeo-pct.R` (43 asserts) y tres casos nuevos en
`test-graficador-ceros-visibles.R`. Incluye un gate de no-regresión que lee el
código fuente de las cinco familias y falla si alguien vuelve a escribir
`formatC(round(...))` para una etiqueta de porcentaje.

**Verificación.** Las 74 suites de `test-graficador-*` y `test-graficos-*`:
4.493 asserts en verde. Cuatro archivos con fallos —`alto-y-leyenda` (1),
`l8-defaults-editoriales` (3), `defaults-motor-registry` (1) y
`top2box-comparativo` (2)— se confirmaron **preexistentes**: fallan con los
mismos números en un worktree sobre HEAD limpio (`54624064`). Los tres de `l8`
son de entorno (`local_mocked_bindings` sin `pkgload`).

Sobre datos reales, la lámina de Egresados q0034_0003 (N = 178) rotula ahora
`1% · 6% · 40% · 53% · 1%`, idéntico al SPSS de la revisión; con
`metodo_redondeo = "reparto"` reproduce el comportamiento anterior
(`1% · 6% · 40% · 53%`, la quinta sin dibujar).

**Un test cambió de bando.** `test-graficador-ceros-visibles.R` exigía que la
categoría con casos que redondea a 0 % recibiera piso obligatorio y saliera
rotulada `0% (1)`. Esa regla protegía el dato a costa de contradecir la cifra y
quedó revertida por la decisión del ítem 16; el test ahora exige lo contrario y
lleva escrito por qué.

**Lo que este cambio implica para los mazos ya entregados**: cualquier PPT que se
regenere cambiará cifras respecto de su versión anterior. Es el efecto buscado
—pasan a cuadrar con las tablas— pero conviene saberlo antes de reexportar algo
que un cliente ya tiene en las manos.

## Tanda B — lo que quedó hecho y su evidencia

**Ítem 4 (completo).** Categóricas, pie y donut ya aceptan `metodo_redondeo`.

**Ítem 7.** `decimales` llega a las diez familias de porcentaje: se declaró
`valores_decimales` en divergentes, dumbbell, lollipop y serie temporal, y
`decimales_pct` en pie y donut. Antes solo seis de veintitrés presets exponían
cualquier control de decimales.

**Ítem 8.** `metodo_redondeo` se declara **solo** en los cinco presets que
cierran a 100 % —apiladas, multi-apiladas, categóricas, pie y donut—, como
`choice` con los dos nombres acordados y `estandar` de fábrica. Las que no
cierran no lo llevan: un mando que no puede hacer nada es peor que su ausencia.

**Ítem 13.** No hizo falta cañería nueva. `.build_presets()` filtra por bloque
—no por argumento— y `.keep_formals()` entrega al graficador todo lo que su
firma declare, así que un arg nuevo en `.PRESETS_META` viaja solo: se edita en
la pestaña Presets, se persiste con el plan y llega al motor. La cadena de
cuatro whitelists que documenta [[graficos-config-cadena-whitelists]] es la de
`graficosConfig`, que es **otra** estructura y no interviene aquí.

**El reparto no se aplica a lo que no cierra.** Al migrar categóricas apareció
el caso que casi se cuela: una barra categórica puede traer porcentajes
independientes —respuesta múltiple, o un subconjunto de opciones—. Normalizarlos
convertía un 12,5 % en 44 %, porque esa fila suma 0,285. Ahora el reparto exige
que la suma esté a menos de un punto de 100 %; si no cierra, cada cifra se
redondea sola. Lo detectó `test-graficador-redondeo-medio-arriba.R`, que ya
existía, y quedó cubierto con un caso propio.

**Trampa de entorno que cuesta una hora si no se sabe.**
`test-graficos-args-llegan-al-motor.R` resuelve los graficadores con
`asNamespace("prosecnurapp")`, o sea contra el **paquete instalado**, mientras
`setup-load-all.R` hace `sys.source` en el entorno del test. Con la metadata
nueva y el paquete viejo, el test acusa args huérfanos que en realidad existen.
Se arregla con `R CMD INSTALL --no-docs api`, no tocando el código.

**Verificación.** 74 suites de gráficos, 4.531 asserts en verde (38 más que al
cerrar la tanda A). Los cuatro archivos que fallan son los mismos preexistentes
de siempre. Frontend: 51 archivos, 338 tests en verde.

Sobre datos reales, con los cinco valores de Egresados (N = 178), categóricas y
pie responden a ambos métodos: `1% · 6% · 40% · 53% · 1%` con estándar y
`1% · 6% · 40% · 53% · 0%` con reparto.

## Lo aprendido que no hay que reinvestigar

- **La geometría no depende del redondeo.** El ancho de los segmentos se
  normaliza en continuo (`graficador_barras_apiladas.R:1535`) y se dibuja con
  ese valor; el reparto por resto mayor entra recién en la línea 1885 y alimenta
  **solo el texto de la etiqueta**. La barra cierra en 100 % se rotule como se
  rotule: cambiar el método no descuadra ningún gráfico.
- **La infraestructura de «config por tipo de gráfico» ya existe.** Es la
  pestaña **Presets** del popover global, que edita `.PRESETS_META` por tipo. La
  pestaña «Cálculos» no necesita una cañería nueva: necesita una vista de matriz
  sobre lo que ya se persiste, más el argumento de método que aún no existe.
- **La cadena de precedencia ya está montada**: `presets$base$args` →
  `preset_args` (por tipo) → `overrides` (por elemento), resuelta con
  `.merge_args` en `reporte_plan_ppt.R:2812`. Hoy **el override del slide gana**.
  El ítem 11 invierte esa relación solo para estos dos campos.
- **Costo medido de adoptar half-up en todo**: sobre las 215 preguntas de escala
  de las cuatro bases de ACRD CONTA, el 35 % de las láminas dejaría de sumar
  100 % (23 suman 99, 51 suman 101, 1 suma 102).
- La descripción de `mostrar_categorias_en_cero` afirma que las categorías con
  casos que redondean a 0 % «ya salen siempre». Salen, pero rotuladas 0 %: el
  segmento existe y la cifra miente. Revisar ese copy cuando se toque el ítem 1.

## Dos clases de gráfico de porcentaje (ítem 6)

El reparto **solo tiene sentido donde las categorías suman 100 %**. Una batería
de respuesta múltiple, una brecha entre dos bases o una serie temporal no tienen
un total que cerrar: no hay resto que repartir, y ofrecer el método ahí sería un
mando que no hace nada. De ahí la partición:

- **Cierran a 100 %** — apiladas, multi-apiladas, categóricas de distribución,
  pie, donut. Ofrecen **los dos métodos** y decimales.
- **No cierran** — agrupadas de respuesta múltiple, divergentes, lollipop,
  dumbbell, puntos comparativos, serie temporal. Siempre redondeo estándar;
  solo se les configura **decimales**.
- **Fuera del alcance** — box plot, media y rango, histograma de conteos,
  indicador numérico, nube de palabras, mapa de cobertura, tabla técnica. No
  rotulan porcentajes de una distribución.

Esto también simplifica la pestaña «Cálculos» (ítems 9–10): la columna de método
solo se ofrece en la primera clase, y en la segunda se muestra fija como
«Estándar» en gris, para que se vea que la decisión existe y por qué no aplica.

`graficador_dimensiones.R` queda fuera de esta tanda: está en la lista de
archivos congelados a crecimiento y su rotulado es de scores de dimensión, no de
distribuciones de escala.

## El cero falso sobrevive al cambio de método (ítem 16)

Elegir redondeo estándar **no elimina el problema del 0 %, solo lo reduce**. Con
half-up se salva todo lo que esté entre 0,5 % y 1 %, que es donde caían los 14
casos de ACRD CONTA (1 caso sobre 139–178 = 0,56 %–0,72 %). Pero cualquier valor
por debajo de 0,5 % sigue rotulándose 0 %:

| Base | 1 caso equivale a | Half-up rotula |
|---|---|---|
| 178 | 0,56 % | 1 % ✓ |
| 250 | 0,40 % | **0 %** ✗ |
| 700 | 0,14 % | **0 %** ✗ |
| 1.200 | 0,08 % | **0 %** ✗ |

O sea: el mazo de ACRD CONTA queda limpio por el tamaño de sus bases, pero un
estudio con 700 casos vuelve a afirmar que nadie eligió una opción que alguien
eligió. La regla que hace falta es independiente del método:

> **Ninguna categoría con al menos un caso puede rotularse 0 %.**

**Decidido (2026-08-14)**: la cifra se rotula **`0 %`** en las familias que
tienen sitio para la etiqueta —categóricas, agrupadas, numéricas, divergentes,
lollipop, dumbbell, puntos comparativos—, y en **apiladas no se dibuja nada**:
ni etiqueta ni segmento.

El criterio de apiladas lo fijó Gonzalo y es de coherencia interna: el segmento
se dibuja en función de lo que la cifra declara, así que si la cifra redondea a
0 % el segmento no tiene por qué existir. Dibujar una astilla y rotularla 0 %
—o dibujarla sin rótulo— es afirmar dos cosas contradictorias en la misma barra.
La masa que pierde ese segmento se recomprime en el resto, de modo que la barra
sigue ocupando el 100 % de su ancho.

El escape sigue siendo el interruptor `mostrar_categorias_en_cero`, que es
explícito: encendido, esas categorías reaparecen con piso de ancho y su
frecuencia al lado. Apagado —que es el default— no se dibujan.

Descartadas y por qué, para no rediscutirlas: `<1 %` (notación que la casa ya
rechazó por escrito en `graficador_ceros_visibles.R`), forzar `1 %` (miente por
exceso: convierte 0,08 % en doce veces su valor) y decimales variables por
etiqueta (rompe la uniformidad de la lámina).

## Lámina metodológica (ítem 17)

Va calcada de `p_slide_top_two_box`, que es el precedente exacto: slide
estructural reutilizable, `render_key` propio, SVG generado por el motor
(`.top_two_box_svg` en `reporte_plan_ppt.R:1803`) y args para textos, colores y
valores de ejemplo. La nueva sería `p_slide_redondeo`, con un ejemplo que
muestre la misma distribución rotulada por los dos métodos y la consecuencia de
cada uno. Se inserta en el mazo como cualquier otra lámina explicativa.

## Decisiones pendientes

**Nombres.** Propuesta, nombrando por lo que garantizan y no por el algoritmo,
porque el analista elige por consecuencia:

- **Redondeo estándar** — cada cifra se redondea sola, 0,5 sube. Igual que SPSS
  y Excel. Las cifras pueden sumar 99 % o 101 %. *(half-up)*
- **Reparto a 100 %** — las cifras impresas suman exactamente 100 %. Alguna
  cifra puede alejarse de su valor real, y una categoría con muy pocos casos
  puede quedar rotulada 0 %. *(resto mayor / método Hare)*

Alternativas para el primero si «estándar» no convence: *clásico*, *escolar*,
*comercial* (este último es el término contable real para half-up).

**Default de fábrica.** Recomendación: **redondeo estándar**, porque es
reproducible contra las tablas, cada cifra es independiente de las demás, y no
convierte a una persona en un cero. El costo —que la suma dé 99 o 101— se cubre
con la nota al pie del ítem 14, que es práctica editorial estándar.
