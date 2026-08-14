# Checklist — redondeo y decimales como configuración general de Gráficos

**Abierto**: 2026-08-14 · **Origen**: revisión de `ACRD CONTA/Revisón graficos.xlsx`
(64 observaciones PPT vs SPSS) · **Estado**: cerrado. Cinco tandas: motor,
configuración, interfaz, entregable y —tras regenerar el PPT y verlo sin
cambios— el redondeo que el plan aplicaba antes de tiempo.

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
| 9 | Pestaña «Cálculos» en el popover de Configuración global | `v2/shell/EstiloGlobalDialog.tsx` | **hecho** |
| 10 | Matriz tipo de gráfico × (redondeo, decimales) dentro de esa pestaña | `CalculosEditor.tsx` | **hecho** |
| 11 | La config general gana; los overrides por slide quedan ocultos y desactivados por defecto | `graficos_calculos_gobernados.R` + `reporte_plan_ppt.R` | **hecho** |
| 12 | Conservar el override por slide como escape explícito, no como default | `GraficadorForm.tsx` | **hecho** |
| 13 | Persistencia en el `.pulso` y compat de planes viejos | `router_graficos.R`, store del plan | **hecho** |
| 14 | Nota al pie del entregable declarando el criterio de redondeo | `graficos_calculos_gobernados.R` | **hecho** |
| 15 | Tests: mismo dato, mismo número en toda familia de % | `api/tests/testthat/` | **hecho** |
| 16 | Cifras que redondean a 0 %: se rotula «0 %» salvo en apiladas, donde no se dibuja nada | `helpers_calc_comunes.R` + familias | **hecho** |
| 17 | Lámina metodológica explicando ambos redondeos | `reporte_slide_redondeo.R` | **hecho** |

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

## Tanda C — lo que quedó hecho y su evidencia

**Ítems 9 y 10.** Pestaña «Cálculos» en el diálogo de Estilo global, entre
«Base Word» y «Color e identidad», con `CalculosEditor.tsx` dentro: una matriz
de tipo de gráfico × (método, decimales), partida en dos bloques —«Sus
categorías suman 100 %» y «Cifras independientes»— más cuatro atajos de
«Aplicar a todos». Las once familias de porcentaje caben en una pantalla.

**El popover real NO era `ConfiguracionGlobal.tsx`.** Ese componente no se monta
en ninguna parte: es código muerto. El diálogo vivo es
`v2/shell/EstiloGlobalDialog.tsx`, el de «Base PPT / Base Word / Color e
identidad…». Se descubrió abriendo la app, no leyendo: los dos archivos tienen
nombres igual de plausibles y el muerto es el que suena a canónico. Conviene
retirarlo en una limpieza aparte.

**Ítem 11.** `.calculos_sanear_overrides()` retira los campos gobernados del
override de cada elemento en `.render_element_impl()`, que es el punto único por
donde pasan todos. La precedencia se invierte por ausencia: un override que no
llega no puede ganar. Los valores viejos **no** se borran del plan guardado —se
ignoran al renderizar—, así que revertir la decisión no cuesta nada.

**Ítem 12.** `GraficadorForm` deja de ofrecer esos campos. No es que estorben:
es que el motor ya los ignora al nivel de lámina, y un control que el analista
mueve sin que cambie nada es el peor resultado posible. Se siguen editando donde
la decisión corresponde, que es la configuración global.

**La línea base de un archivo congelado subió a conciencia.**
`reporte_plan_ppt.R` pasa de 9.472 a 9.474 líneas: dos, la llamada al saneo y su
comentario. La funcionalidad vive en archivo propio
(`graficos_calculos_gobernados.R`), que es lo que la política pide; lo que crece
es la llamada. Queda registrado en `agentic/manifest.json`.

**Verificación.** Typecheck limpio; 65 archivos y 554 tests de vitest en verde;
104 suites de R (`graficador`, `graficos`, `reporte`) con 5.171 asserts en verde
y los mismos cuatro fallos preexistentes de siempre; `sync-agentic-os --check` y
`--audit` en verde salvo `calc_muestra_aulas.R`, que ya excedía su línea base en
HEAD sin cambios míos.

Sobre la app real, con el proyecto `V3_Conta 11-08 negrita-acordada`: la pestaña
monta las once familias, los selectores y los atajos escriben en el store, y el
inspector de lámina —16 KB de ajustes— ya no contiene ni «redondeo» ni
«decimales». La consola solo arroja warnings preexistentes de keys duplicadas en
`CategoriasEscalaField`, ajenos a este trabajo.

## Tanda D — lo que quedó hecho y su evidencia

**Ítem 14.** Interruptor «Declarar el redondeo al pie», en el preset `base` que
heredan todos los gráficos, con su casilla en la pestaña Cálculos. Apagado de
fábrica: encenderlo cambia el pie de un mazo ya entregado, y esa no es una
decisión que deba tomar un default. El texto se redacta según el método —con el
estándar advierte que la suma puede dar 99 o 101; con el reparto, que una cifra
puede no ser la de su propio valor— y según los decimales configurados.

La nota **se anexa**, no pisa. La de significancia se aplica con esta misma
regla de «solo si no hay nota», y si las dos compitieran la que explica las
letras desaparecería sin dejar rastro. Y si la nota existente ya habla de
redondeo, no se añade nada: dos frases sobre lo mismo al pie sobran.

**Ítem 17.** `p_slide_redondeo()`, hermana de `p_slide_top_two_box()`: mismo
layout y mismos tres slots, así que no hizo falta contrato nuevo. Muestra la
misma distribución rotulada por los dos métodos con su suma al lado —101 % y
100 %—, y el ejemplo por defecto son los casos reales de ACRD CONTA (N = 178,
dos categorías de una sola persona), porque con un ejemplo cómodo la lámina no
enseñaría nada. Las cifras del ejemplo salen de `.pulso_pct_unidades()`, la
misma función que rotula el mazo: si la lámina las calculara por su cuenta
podría acabar enseñando un comportamiento que el motor ya no tiene.

El renderer vive en `reporte_slide_redondeo.R` (~280 líneas) y recibe como
parámetros los helpers de estilo que en `reporte_plan_ppt.R` son closures
internas —`.add_slide_strict`, `.style_value`, `.style_num`, `.svg_text_escape`,
`.indice_sanitize_fill`—, en vez de duplicarlos. En el archivo congelado solo
queda la rama de despacho.

**Cuatro sitios contaban las láminas a mano.** Añadir una rompió el contrato de
`render_key` únicos (que exigía exactamente 20), dos asserts de
`test-graficos-metadata.R` y cinco de `test-graficos-slide-template-matrix.R`,
más el deck de sentinelas, que numera las láminas correlativamente y hubo que
renumerar del 4 al 21. Ninguna es una cuenta que se derive sola: si mañana se
añade otra lámina, hay que tocar los mismos sitios.

**Trampa que costó una instalación rota.** Correr `roxygen2::roxygenise()` para
generar un `@export` regeneró de paso los 625 `.Rd` de `api/man/` —directorio no
versionado— y uno salió mal formado (`\dontrun` no reconocido), lo que tumbaba
`R CMD INSTALL`. Además el NAMESPACE resultante añadía 221 exports y **quitaba
19**, incluidos graficadores: el NAMESPACE del repo está desincronizado respecto
de los `@export` del código. Se revirtió todo y se añadió el único export a
mano. Esa desincronización es deuda preexistente y merece su propia unidad de
trabajo, con su gate: quitar el export de un graficador rompería los jobs
`callr`, que resuelven contra el paquete instalado.

**Verificación.** 108 suites de R con 5.712 asserts en verde y los cuatro fallos
preexistentes de siempre; typecheck limpio; 554 tests de vitest en verde;
`sync-agentic-os --check` y `--audit` en verde salvo `calc_muestra_aulas.R`, que
ya excedía su base en HEAD. La línea base de `reporte_plan_ppt.R` sube de 9.474
a 9.486 por la rama de despacho.

Comprobado en la app real: la casilla de la nota aparece en la pestaña Cálculos,
se marca y persiste. La lámina se exporta a PPTX y su SVG contiene «Suman 101 %»
y «Suman 100 %».

## HALLAZGO al regenerar el PPT: hay un redondeo ANTES del graficador

**El trabajo de las tandas A–D no cambia el PPT.** Se descubrió al regenerar el
mazo de ACRD CONTA y compararlo con el Excel: las cifras salen **idénticas a la
columna PPT de la revisión**, no a la de SPSS.

La causa es `.pct_enteros_100()` (`reporte_plan_ppt.R:2018`), un **segundo
reparto por resto mayor** que el plan aplica a las frecuencias antes de llamar
al graficador. Le entrega `pct_int / 100` —enteros ya repartidos— así que cuando
el graficador va a rotular, la información decimal ya se perdió y su
`metodo_redondeo` no tiene nada que decidir. Se usa en al menos cinco puntos del
render (líneas 4427, 4884, 5057, 5280, 5452), que cubren apiladas,
multi-apiladas y multiactor.

Medido sobre las cuatro bases reales, contra las 63 filas emparejables del
Excel:

| Método | Reproduce |
|---|---|
| `.pct_enteros_100()` (el del plan) | **62/63 la columna PPT** |
| half-up | 62/63 la columna SPSS |

O sea: el redondeo que gobierna el entregable es el del plan, y es el que la
revisión anotó. El del graficador —el que las tandas A–D unificaron y volvieron
configurable— solo actúa donde el plan no ha redondeado antes.

Lo que sí llegó al PPT regenerado: la regla del ítem 16 se ve actuando (hay
filas con una categoría menos, la que vale 0), porque opera sobre lo que el plan
entrega. Pero un 0 que el plan ya fijó no se puede distinguir de un 0,56 % real.

## Tanda E — el plan entrega el dato, el graficador decide cómo se escribe

`.pct_enteros_100()` se retiró y sus cinco llamadas pasan por
`.calculos_pct_exacto()`, que devuelve el porcentaje con sus decimales. La
variable que lo recibía se llamaba `pct_int` y ahora es `pct_exacto`: el nombre
viejo mentía, y esa mentira es de la clase que causó todo esto.

El reparto por resto mayor no se pierde —sigue disponible como
`metodo_redondeo = "reparto"`—, pero deja de estar cableado: ahora hay **una
sola implementación viva**, en `helpers_calc_comunes.R`.

`reporte_plan_ppt.R` **baja** de 9.486 a 9.467 líneas al retirar la función; la
línea base del manifest se ajusta a la baja.

**Verificación sobre el entregable real.** Se regeneró el mazo de ACRD CONTA con
el mismo plan de 60 láminas y se comparó con el PPT de la tanda D:

- **34 de 60 láminas** cambiaron sus cifras.
- Aparecen **19 cifras nuevas**: las categorías que antes no se dibujaban.
- De las 58 filas del Excel cuyo enunciado se localiza en el mazo, **la cifra de
  SPSS aparece en las 58**. Ninguna falla.

Comprobación posicional exacta en «Gestión y planificación» (slide 15), fila de
Egresados de «El estatuto y las normas internas de la institución»:

| | Tanda D | Tanda E | Excel (SPSS) |
|---|---|---|---|
| De acuerdo | 36 % | **37 %** | 37 |
| «Las normas internas…», En desacuerdo | no se dibujaba | **1 %** | 1 |

**Gate.** `test_dir` sobre las 108 suites del área —como lo corre el CI—:
5.729 asserts en verde y solo los cuatro fallos preexistentes de siempre.

Cuidado al leer un barrido hecho a mano: correr los 108 archivos con
`test_file()` dentro de **un mismo proceso** marcó en rojo cuatro suites de
`reporte-*` que pasan aisladas y pasan con `test_dir`. Es interferencia entre
archivos, no regresión; el veredicto se toma con `test_dir`.

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
