# GOAL · Gráficos sabe de qué base habla

Tipo: Goal operativo QA
Estado: En curso
Fecha: 2026-08-03
Autoridad: Objetivo de trabajo medible; no certifica por sí solo el estado de la superficie

- **Abierto**: 2026-08-03 · **Cierra**: sólo Gonzalo
- **Alcance**: loop de convergencia, no una lista lineal. No se cierra hasta
  validarlo todo.
- **Banco de prueba**: `ACRD CONTA/Conta 03-08-2.pulso` — 4 bases reales
  (`docentes` 52×113, `estudiantes` 172×99 · activa, `egresados`,
  `administrativos`), plan de 7 slides, app 0.6.3. Es proyecto de cliente:
  se trabaja **sobre copia**, nunca se commitea.

## Qué se pide

> «Subí 4 bases y esto está completamente bugueado. No sólo no puedo hacerlo
> bien, sino que está lento, las bases no se distinguen bien, no está claro qué
> debo decir: si hacer reportes independientes o un reporte conjunto donde
> escojo primero la base y luego la variable; si puedo hacer barras
> multiapiladas multibase de forma intuitiva a través de la UI; que los
> gráficos salgan bien —que el de barras no salga con leyenda cuando le quito
> la opción de leyenda, y que salga con color, no con salmón en las barras
> agrupadas—. Siento que Gráficos le falta muchísima validación. Es un problema
> serio que requiere constante evaluación y no cerrarse hasta validarlo todo.»

## El hallazgo que ordena el goal

**El plan de gráficos no tiene dimensión de base.** El payload persistido de
cada gráfico es `{graficador, args:{var, overrides}}` — no guarda de qué base
salió la variable. La base vive en otro lado: es un estado global del proyecto
(`active_base`), fuera del plan.

De ahí se desprende casi todo lo que se siente como "bugueado":

| Síntoma que se ve | Lo que pasa debajo |
|---|---|
| «las bases no se distinguen» | un solo plan compartido por las 4 bases, sin marca de procedencia por slide |
| «no sé si es reporte independiente o conjunto» | las dos cosas existen (`scope=active` y `scope=consolidado`), pero el plan es el mismo objeto en ambas |
| «no está claro escoger base y luego variable» | el selector sí atribuye fuente (chip `docentes` en el trigger), pero esa fuente es **derivada**, no elegida ni guardada |
| «le falta validación» | al cambiar de base nada se revalida: mismo plan, misma cobertura |

**Evidencia (2026-08-03)**: con base activa `estudiantes` → cambio a
`docentes`: el timeline sigue con los mismos 7 slides, el badge de cobertura
sigue en `7/273` y ningún slide avisa que su variable venía de otra base. El
slide #4 muestra `Departamento académico al que pertenece · p7` con chip
`docentes` **mientras la base activa es `estudiantes`**.

Sobre la cobertura, precisión que sí importa: `7/273` **no cambia por diseño**
—`.graficos_plan_coverage` cuenta sobre todas las fuentes, no sobre la activa—.
El problema no es que no se recalcule, es que con cuatro bases un total único
no dice nada: 7 de 273 puede ser "cubrí bien a docentes" o "toqué cuatro bases
por encima". Eso es G6, no un bug de refresco.

## Reglas del goal

1. **Cada iteración cierra con gate**, escalado al diff: typecheck si hay TS,
   `testthat` del área si hay R, comprobación en la app si hay UI. Nada se
   declara sin evidencia literal.
2. **Se mide sobre el banco de 4 bases**, no sobre un fixture de una sola.
   Un verde en base única no prueba nada de este goal.
3. **Cada defecto de motor nace con su test**: si el gráfico ignora un
   argumento, primero el rojo que lo demuestra.
4. **Nada de renombrar el síntoma**: "está lento" se cierra con números
   (ms medidos), no con una impresión.
5. El proyecto de cliente no entra al repo. Los fixtures que haga falta
   versionar salen anonimizados (`api/scripts/pulso_anonimizar.R`).

## Cola de trabajo

| # | Frente | Estado |
|---|---|---|
| M1 | El plan declara su base (procedencia por gráfico) | G5: el plan roto ya se ve y se repara |
| M2 | Independiente vs conjunto: la decisión se ve y se elige | G9: ya se ve; falta elegirla |
| M3 | Validación al cambiar de base; cobertura legible por base | G5 y G6 hechos |
| M4 | Defectos de motor: leyenda que no se apaga, salmón en agrupadas | G3 y G4 hechos |
| M5 | Multiapiladas multibase por UI | G10: funciona; falta que se encuentre |
| M6 | Rendimiento con 4 bases | G1 hecho, sigue |

## Bitácora

### G1 — El catálogo de graficadores ya no espera la cola

Primer síntoma atendido: el diálogo *Elegir visual* se quedaba en «Cargando
catálogo…».

Medido: el endpoint no es lento (60,6 KB en ~70 ms tibio; 1,9 s sólo la
primera vez del proceso R, por carga perezosa). Lo lento era la cola —Plumber
atiende en **un solo hilo**: diez requests concurrentes al mismo endpoint se
serializan (0,08 → 0,67 s), y al agregar un slide se dispara una ráfaga de seis
donde el catálogo era una más (`registry` 265 ms, `presets-defaults` 281,
`slide-layout-preview` 492, `presets-defaults` 501 **duplicado**,
`slide-layout-preview` 1165 **duplicado**, `plan/coverage` 681).

Encima, `useGraficosRegistry` sólo deduplicaba requests concurrentes: con trece
consumidores del hook, cada montaje volvía a pedir el catálogo entero.

Reparado: el catálogo se cachea por sesión con revalidación en segundo plano
(enfriamiento 60 s) y el warmup del módulo lo llena en vez de descartar la
respuesta. Verificado en la app: al abrir el picker ahora hay **cero** requests
de registry y el diálogo aparece con las cards, sin spinner.

Queda anotado para M6: los dos pares de requests duplicados siguen ahí, y con
4 bases cada uno cuesta el cuádruple.

### G2 — Dónde está la base: en ningún lado del plan

Recorrido del banco de 4 bases con el proyecto abierto. El modelo **sí** tiene
sintaxis para la procedencia: el propio metadata la usa
(`var = "docentes$sexo"` en los planes de fábrica). Pero el plan del estudio
real guardó `var = "p7"` **pelado**, y el chip `docentes` que muestra el
selector es una atribución derivada, no el dato guardado.

Consecuencia: la variable se resuelve contra la base activa. La UI dice una
cosa (`docentes`) y el render puede usar otra (`estudiantes`), sin aviso.

Y el estado por base está desparejo: `analitica_config_por_base` sólo tiene
`docentes`; `graficos_status_por_base`, `docentes` y `estudiantes`. De cuatro.

M1 se define entonces así: **el gráfico guarda su base**; la activa deja de ser
la respuesta implícita, y cambiar de base revalida el plan en vez de callar.

### G3 — El salmón era la ausencia de paleta

Reproducido en el motor: sin `colores_series` ni `colores_categorias`,
`graficar_barras_agrupadas` no aplicaba **ninguna** escala de relleno y ggplot
pintaba con su default — `#F8766D` (salmón) y `#00BFC4`. Con override
funcionaba bien, y por eso el defecto se veía "aleatorio": el gráfico normal
—el que no toca colores— era el que salía mal.

Apiladas, categóricas y pie ya llamaban siempre a `.graficos_mk_palette`, que
con `pal_user = NULL` devuelve la paleta institucional. Agrupadas era la
excepción. Reparado: la escala se aplica siempre. Test de regresión en
`test-graficador-barras-override-colores.R` (rojo antes: `#F8766D` presente).

### G4 — Once switches que mentían

El de la leyenda no estaba roto: estaba **mal informado**. El editor de Estilo
global dibuja cada bool con `!!valor`; si el preset guardado no trae la clave y
el metadata no declara `default`, el switch aparece en **"No"** mientras el
motor usa el default de su firma (`mostrar_leyenda = TRUE`). Verificado en el
proyecto real: `aria-checked="false"` en pantalla, leyenda en el render.

No era un caso: auditando cada bool de presets contra la firma de su graficador
salieron **once** divergencias —apiladas (3), agrupadas (3, con la leyenda),
categóricas, numéricas (2), boxplot, media y rango (2)—. Dos de ellas con
`default` declarado que contradecía al motor.

Los once alineados: el metadata sigue al motor, nunca al revés (el `default`
es presentación, no se envía al render). Guard permanente en
`test-graficos-presets-defaults-contrato.R`, que falla si vuelve a aparecer uno.

Pendiente de M4: el proyecto de Gonzalo tiene su preset guardado sin la clave,
así que ahora verá "Sí" —que es la verdad de lo que se renderiza— y podrá
apagarla de verdad.

### G5 — «Se buggea todo» tenía una causa exacta, y era el prefijo

El plan **no renderiza**. Reproducido contra el estudio de 4 bases:

```
POST /api/graficos/preview-slide → 400 E_PREVIEW_FAILED
"No se pudo generar el preview: La referencia de `var` requiere prefijo
 `fuente$` porque `data` contiene varias fuentes."
```

`.resolve_source_name` (reporte_plan_ppt.R) resuelve `source → ref → default`,
y `default_source` es `NA` en cuanto hay más de una fuente y ninguna se llama
`default`. Una ref pelada, entonces, **no tiene resolución posible**: aborta.

Y la cadena completa era peor que el error:

1. El plan nació con una base → refs sin prefijo. Correcto entonces.
2. Se suman bases → esas refs quedan irresolubles. Nadie lo migra ni lo avisa.
3. El validador decía **«la variable "p7" no está en el instrumento. ¿La
   renombraste o borraste?»** — falso: existe en las cuatro.
4. Con severidad *aviso*, el plan se declaraba exportable.
5. Recién al pedir la lámina aparecía un mensaje de R hablando de prefijos.

Reparado en la superficie, que es donde el analista puede actuar:

- El validador distingue **no existe** de **no dice de qué base es**, y lo
  segundo es **error**: bloquea el export porque el render va a abortar igual,
  sólo que veinte segundos más tarde. Nombra las bases candidatas
  (`existe en "docentes", "estudiantes", "egresados" y "administrativos"`).
- El chip del selector deja de mentir. Mostraba `docentes` —la primera fuente
  que tuviera ese nombre— con aire de dato confirmado; ahora dice **falta la
  base** en tono de alerta cuando la ref no lo declara.

Verificado de punta a punta en el proyecto real: 2 errores señalados → reelegir
la variable en `docentes` → chip `docentes`, 1 error, y el mismo slide que
devolvía 400 responde **200 con el PNG de la lámina**.

Y ahí se ve el otro fix: las barras que salían **salmón** salen en el azul
institucional `#0B4F8C`.

Queda a la vista, para decidir: con **una sola serie** la lámina sigue
dibujando la leyenda («Porcentaje»), que no aporta nada. El default de fábrica
de Pulso es `FALSE` y el del motor `TRUE`; el arg mismo dice «útil poner en
FALSE cuando hay una sola serie». Omitirla automáticamente en ese caso cambia
todos los PPT que ya se generan, así que es decisión de Gonzalo, no del fix.

Gate: typecheck exit 0 · vitest completo 424 archivos / 3494 tests verdes ·
testthat del área verde.

### G6 — La cobertura dice por fin a quién cubre

`7/273` era un total sobre las cuatro bases, y no distingue haber cubierto una
de haber rozado las cuatro. El popover agrupaba por estado —incluidas, sin
usar…— pero nunca por base.

Ahora lo primero que se lee es el desglose, y en el estudio real dice esto:

```
POR BASE            egresados no tiene ningún gráfico
docentes            2/95
estudiantes         1/80
egresados           0/67
administrativos     1/31
```

Cuatro variables de 273 repartidas en tres bases, y una entera sin tocar. Ese
es el dato que faltaba para poder decidir entre informes independientes y uno
conjunto (M2): con el número global era invisible.

Cuenta con el criterio del backend —graficable contable, cubierta la que además
está en el plan—, así que las filas suman el total y no nace una segunda
contabilidad. Guard en `coberturaPorBase.test.ts`.

**Y de paso, dos defectos de la propia superficie**, encontrados al mirarla en
la matriz de viewports: el popover mide 680px y se anclaba con `right: 0` al
badge, que vive a media pantalla — en 1280 se salía ~70px por la izquierda y en
1024x600 quedaba medio metro fuera por abajo. Al anclarlo al viewport apareció
el segundo: `position: fixed` dentro del toolbar **no se ancla al viewport**
porque el toolbar tiene `backdrop-filter`; medía bien y se dibujaba 140px más
abajo. Resuelto con portal a `body`, como el picker de variables. Verificado en
1024x600 y 1280x720: entra completo.

Gate: typecheck exit 0 · vitest completo 425 archivos / 3497 tests verdes.

### G7 — Había dos defaults y ganaba el equivocado

Pregunta de Gonzalo sobre G4: *«¿peor si el default es FALSE porque el motor es
TRUE?»*. Sí, y el problema no era la leyenda sino la precedencia. Hay tres
capas de default y sólo dos estaban conciliadas:

| capa | valor para `barras_agrupadas$mostrar_leyenda` |
|---|---|
| firma del graficador | `TRUE` |
| `.PRESETS_DEFAULT_PULSO` (criterio de la casa) | `FALSE` |
| `default` del metadata (lo que ve el analista) | *no declarado* → se dibuja "No" |

La capa de la casa **sólo se aplicaba al crear la config del proyecto**. A la
hora de renderizar, una clave ausente caía a la firma del motor. Y la casa
opina distinto del motor en **56 de 136 claves comparables**, siete de ellas
interruptores visibles:

```
barras_apiladas     etiquetas_arriba_si_no_caben  casa TRUE   motor FALSE
barras_agrupadas    mostrar_barra_extra           casa FALSE  motor TRUE
barras_agrupadas    mostrar_leyenda               casa FALSE  motor TRUE
barras_agrupadas    invertir_barras               casa TRUE   motor FALSE
barras_categoricas  mostrar_frecuencia            casa TRUE   motor FALSE
barras_numericas    mostrar_eje_y                 casa FALSE  motor TRUE
barras_numericas    mostrar_n_sobre_barras        casa TRUE   motor FALSE
```

Así que quién ganaba dependía de un accidente. Peor: `resetPreset` hace
`delete presets[tipo]`, o sea que el botón **«Valor por defecto» devolvía el
criterio del motor, no el de Pulso** — y encendía la leyenda.

Reparado en `.enriquecer_presets`, que es el punto por el que pasan preview,
PPT, Word y consolidado: cada tipo hereda `.PRESETS_DEFAULT_PULSO` y el
proyecto escribe encima. Una sola precedencia, siempre igual: **motor → Pulso →
proyecto → slide**. El metadata pasó a declarar ese default efectivo y el guard
del contrato lo verifica contra él.

`base` queda fuera a propósito: no es un graficador con firma propia y sus
tamaños se derivan entre sí, así que "no configurado" es un estado con
significado. Lo dijo un test que ya existía —«sin ningún size no se inventa
uno»— al ponerse rojo.

Efecto en la lámina del estudio real, sin tocar nada del proyecto: las barras
pasan de salmón a azul institucional, **desaparece la leyenda** de la serie
única, el orden se invierte (la categoría mayor arriba) y los porcentajes
pierden el decimal — el criterio Pulso que el proyecto nunca recibió.

Queda anotado: el **título sigue saliendo en salmón**, y eso viene del preset
`base` o de la plantilla; no del suelo que acabamos de poner.

> Verificado después: **no era un defecto**. `.PRESETS_DEFAULT_PULSO$base` trae
> `color_titulo = "#CA5651"`, el rojo terracota de la identidad Pulso. Se
> parecía al `#F8766D` de ggplot que sí era el bug de las barras, y por eso
> entró en la misma frase. Son dos rojos distintos: uno es la casa, el otro era
> la ausencia de paleta.

Gate: `test_dir` filtrado a `^graficos|^reporte-plan|^graficador` sin fallos ·
contrato de defaults verde · metadata 230 verdes.

### G8 — La jerarquía, escrita y verificada (y un fix del fix)

Gonzalo la nombró: *«es una jerarquía: base default, modo/estilo y finalmente
por prioridad el override»*. Lo es, y verificarla contra el motor destapó que
**G7 invertía una capa**.

La cadena real, leída del código (`reporte_plan_ppt.R`,
`.merge_args(base_args, preset_args, overrides)`):

| # | capa | dónde vive |
|---|---|---|
| 1 | firma del graficador | `graficar_*()` en R |
| 2 | criterio de la casa por tipo | `.PRESETS_DEFAULT_PULSO` (G7) |
| 3 | estilo común del proyecto | `presets$base` → el motor lo hereda a todos |
| 4 | preset del tipo de gráfico | `presets$<tipo>` |
| 5 | override del gráfico en el slide | `el$overrides` |

Más dos herencias laterales: donut hereda de pie, multiapiladas de apiladas.

**El fallo de G7**: el suelo rellenaba cada tipo con sus ~40 claves de fábrica,
y como el motor hereda `base$args` **hacia** el tipo, esas claves precocinadas
pisaban el estilo común del analista en las que se solapan —`size_leyenda`,
`size_subtitulo`, `size_titulo`, `size_texto_barras`—. O sea: la capa 2
saltaba por encima de la 3.

Corregido descontando del suelo las claves que el proyecto declara en `base`.
Guard nuevo: con `base` definido, la clave **no** viene precocinada en el tipo;
si además se declara en el tipo, el tipo gana.

Gate: contrato 9 verdes · `test_dir` filtrado sin fallos.

### G9 — La duda «independiente o conjunto» ya tenía respuesta; faltaba decirla

No es una funcionalidad ausente: el dominio distingue los dos mundos desde
`processing_mode` (`docs/arquitectura-multi-base.md`):

- **`multibase`** — un solo plan para todo el estudio; los gráficos referencian
  `fuente$variable` y pueden mezclar bases en el mismo informe.
- **`independent_siblings`** — cada base con su plan, su configuración y sus
  entregables; se trabaja sobre la base activa y `ppt-all` produce un PPT por
  base dentro de un ZIP.

El estudio de Gonzalo está en `multibase`: **su informe ya es el conjunto**. Y
en Gráficos eso no aparecía por ningún lado — el chrome mostraba «BASE
estudiantes · 4», que se lee como «estás trabajando sobre estudiantes».
`MultibaseReportMenu`, que sí habla de informes conjuntos, sólo se monta en
`independent_siblings` (`showSharedReports`), o sea justo en el modo que él no
tiene.

Ahora el toolbar del plan declara qué informe es, con el porqué al hover:

```
Un informe conjunto · 4 bases
  «Este plan es uno solo para las 4 bases: cada gráfico declara de cuál sale
   su variable, así que puedes mezclarlas en el mismo informe.»
```

En `independent_siblings` dirá «Un informe por base · docentes» con su propia
explicación. Modelo puro en `modoMultibase.ts` con test.

Lo que queda de M2: **poder cambiar de modo desde aquí**. Existe
`POST /api/estudio/independent-siblings/promote`, pero hoy la decisión sólo se
toma en Carga y es irreversible en la práctica desde Gráficos.

Gate: typecheck exit 0 · vitest del feature 28 archivos / 150 verdes ·
verificado en el estudio real.

### G10 — Las multiapiladas multibase existen y funcionan

«¿Puedo hacer barras multiapiladas multibase de forma intuitiva a través de la
UI?» Sí. El constructor tiene cinco lecturas y la cuarta es exactamente eso:
**Comparar públicos por tema** — «temas comparados entre fuentes o bases del
estudio; docentes, estudiantes y administrativos frente al mismo tema».

Recorrido completo en el estudio de 4 bases, sin tocar código: elegir
Multi-apiladas → «Comparar públicos por tema» → agregar la misma pregunta desde
cada base → render. Resultado:

```
¿CONOCE LA MISIÓN Y LOS PROPÓSITOS DE LA PUCP?
Docentes         98% (51)   2% (1)
Estudiantes      77% (133)  23% (39)
Egresados        78% (138)  22% (40)
Administrativos  93% (14)   7% (1)
```

El constructor hace bien lo difícil: dice cuántos respondientes aporta cada
público, y valida la escala — al mezclar una pregunta de 4 categorías con las
Sí/No avisó **«estas preguntas no comparten una escala compatible»**, y al
quitarla pasó a **«comparten escala: Sí / No»**.

Así que M5 no era una carencia de capacidad sino de **descubribilidad**: la
lectura vive dentro del constructor, y al constructor sólo se llega si ya
elegiste el graficador multi-apiladas. Nada en la superficie sugiere que el
estudio de cuatro públicos tiene una lámina hecha para él.

**De paso, la mejor evidencia de G5 que ha dado el estudio**: la misma pregunta
está en las cuatro bases con código distinto —`docentes$p9`, `estudiantes$p7`,
`egresados$p14`, `administrativos$p6`— y `p7`, que en estudiantes es «¿Conoce
la misión…?», en docentes es «Departamento académico». Una ref pelada `p7` no
es ambigua en abstracto: es **una pregunta distinta según la base**.

Anotado para la próxima vuelta: el **título del tema no se actualiza** al
cambiar sus variables (se quedó «Departamento académico al que pertenece:») y,
peor, se dibuja **desbordado fuera de su caja**, invadiendo cortado el área de
etiquetas de la lámina.

### G11 — Un ajuste de posición decidía qué dice la etiqueta

Gonzalo, sobre el «98% (51)» de esa lámina: *«el porcentaje no debería
reportar la frecuencia por defecto; debe estar desactivada y sólo activarse con
el switch del estilo común o un override»*.

Y así estaba declarado en todas partes: `mostrar_n_en_etiquetas` nace en
`FALSE` en los tres graficadores, la casa no lo redefine, el proyecto tampoco,
y las **cinco** llamadas del motor de plan lo pasan explícitamente en `FALSE`
junto a `cols_n`. Nadie pedía la frecuencia y salía igual.

Entraba por dos puertas:

1. `cols_n` —que trae los **datos** de N para la barra extra y los totales— se
   tomaba como la orden de escribirlos.
2. En el canvas, que es el camino real de los entregables, la condición era
   `mostrar_n_en_etiquetas || etiquetas_arriba_si_no_caben`. Lo segundo es un
   ajuste de **posición** (qué hacer cuando la etiqueta no entra en su
   segmento) y el preset de la casa lo trae en `TRUE`. Un flag de dónde va el
   texto decidía qué dice el texto, y encima se lo aplicaba a **todas** las
   etiquetas, no sólo a las desplazadas.

Conviene decirlo: G7 —aplicar el suelo de la casa en cada render— hizo que ese
`TRUE` pasara a valer siempre, así que el síntoma que Gonzalo vio lo amplificó
este mismo loop.

La decisión vive ahora en `.apiladas_etiquetas_con_frecuencia()`, que depende
sólo del switch y trata igual la etiqueta normal y la desplazada: mover una
etiqueta no puede cambiar lo que informa. Test unitario del helper, incluidos
los bordes (segmento sin porcentaje, porcentaje sin N).

Verificado en la lámina real del estudio: las etiquetas salen **2% · 34% ·
64%**, sin frecuencias, y el TOP2BOX sigue en su sitio.

Gate: 11 verdes del archivo nuevo · `test_dir` filtrado a
`^graficos|^reporte-plan|^graficador` sin fallos.
