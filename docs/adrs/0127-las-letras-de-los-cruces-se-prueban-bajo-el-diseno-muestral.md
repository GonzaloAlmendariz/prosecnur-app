# ADR 0127: las letras de los cruces se prueban bajo el diseño muestral

Estado: Reemplazado por el [ADR 0128](0128-una-regla-de-diferencias-por-estudio.md). Gonzalo eligió una sola regla de diferencias por estudio, que gobierna láminas, Word y tablas con BH sobre el informe completo (D1 y D3); este ADR decidía la prueba solo para las tablas y con la corrección dentro de la fila. Sus validaciones se conservan en el 0128 (ver «Unificación con el ADR 0128»).

Implementacion: Parcial (2026-11-03): tabla de cruces, medias de dimensiones, router, nota, UI y base mínima en gráficos y lámina. Pendiente: letras bajo diseño en gráficos y armonizada (ver «Estado de la implementación»)

Fecha: 2026-11-03

Fecha de decision: 2026-11-03 (Gonzalo, «Sí, apruébalo», transmitido por la sesión de revisión metodológica; cubre los tres desvíos: peso de Ponderación, `survey` solo en Suggests y lámina entre públicos fuera)

Reemplaza: —

Extiende: el contraste cluster-robust por persona de las bases repeat (`reporte_cruces_cluster.R`), que pasa a ser un
caso particular del contraste bajo diseño.

## Contexto

Las tablas de cruces marcan con letras las diferencias entre columnas de una misma variable de cruce. Hoy la prueba
es una z de dos proporciones con proporción combinada, Bonferroni dentro de la fila y α de `cfg$cruces$alpha`
(`comparar_columnas_sig`, `reporte_cruces.R`). Supone muestreo aleatorio simple: `n` y `N` son sumas de pesos y cada
fila de la base cuenta como una observación independiente. Los gráficos (`graficos_significancia.R`, la serie por
niveles) delegan en la misma función; la lámina de diferencias entre públicos (`graficos_significancia_publicos.R`,
`lamina_significancia.R`) reimplementa la misma z.

Una revisión metodológica de un estudio por conglomerados (60 aulas sorteadas con el método del cubo, estratificadas
por nivel del curso, n = 400, pesos 1) replicó las tablas bajo el diseño y encontró:

- con bases de 30 casos o más, 268 de 9.029 pares cambian de veredicto: 114 letras sobran y 154 faltan;
- el efecto de diseño por aula llega a 2,6 en los indicadores ligados a la carrera;
- 68 pares llevan letra aunque una de sus columnas tiene menos de 10 casos;
- los grupos concentrados en pocas aulas tienen una varianza de diseño inestable.

La z simple no es «conservadora» ni «liberal» de forma pareja: sobra donde la correlación intra-aula es alta y falta
donde la estratificación reduce la varianza. No se arregla con un deff global.

Ya existe un precedente de varianza agrupada: las bases repeat usan un sandwich CR1 por persona con t de G − 1 gl y
un mínimo de 8 personas (`.repeat_compare_columns_cluster`). Solo se activa para repeats y no conoce estratos.

Decisiones tomadas en la revisión, que este ADR no reabre: el modo simple sigue siendo el valor por defecto; las
pruebas de diferencias no llevan fpc; se conservan las letras por par; hay un umbral de base mínima.

## Decisión

### 1. El diseño se declara en `analitica_config$cruces$significancia`

```r
cruces = list(
  show_sig = TRUE,          # sin cambios
  alpha = 0.05,             # sin cambios
  significancia = list(
    metodo = "simple",            # "simple" | "diseno"
    conglomerado = NULL,          # nombre de columna (PSU); obligatorio en "diseno"
    estrato = NULL,               # nombre de columna; opcional
    correccion = "bonferroni",    # "bonferroni" | "holm" | "BH"
    base_minima = 30L,            # casos sin ponderar por columna
    min_conglomerados = 8L        # solo en "diseno"
  ),
  ...
)
```

- Vive dentro de `analitica_config`, que ya persiste en `state.rds` del `.pulso`. Un `.pulso` sin el bloque se lee
  con los valores por defecto. Un normalizador único (`.cruces_significancia_normalizar`) acepta la configuración
  cruda y devuelve la canónica; valores fuera de dominio caen al valor por defecto, nunca a un error en la carga.
- `show_sig` y `alpha` se quedan donde están. No se mudan, porque otros consumidores ya los leen: armonizada,
  panel y dashboard.
- **El peso no se configura aquí.** El peso de la prueba es siempre el que usa la tabla para sus porcentajes: la
  columna `peso` que deja Ponderación, o 1 si no hay ponderación. Con dos pesos distintos, la letra y el porcentaje de
  una misma celda podrían contradecirse. Elegir el peso es tarea de Ponderación. La nota al pie dice cuál se usó.
- `metodo = "diseno"` sin `conglomerado` es una configuración incompleta. El router la acepta y la guarda, pero la
  tabla no asigna letras y la nota explica por qué. No se cae en silencio a la z simple.
- **El estrato es un atributo del conglomerado.** Debe ser constante dentro de cada conglomerado: es la variable con
  que se estratificó el sorteo, por ejemplo el nivel del *curso* del aula, que viene del catálogo, y no el nivel
  curricular de cada estudiante. Una columna que varía dentro de algún conglomerado se rechaza con el aviso «estratos
  no anidados en los conglomerados» y el número de conglomerados afectados. No se calcula nada: la tabla se queda sin
  letras y la nota da la causa. No se reasigna el estrato por moda ni de ninguna otra forma.
- Las columnas se buscan por nombre en cada base. En el modo multibase, si a una base le falta la columna de
  conglomerado o de estrato, esa base se abstiene y lo dice en su nota. Las demás bases siguen.

### 2. Un solo punto de entrada para todas las letras

Se crea `api/R/cruces_significancia.R` (archivo nuevo; `reporte_cruces.R` no crece con la prueba) con:

- `.cruces_sig_comparar(contexto, spec)`: es la única función que decide las letras de proporciones. Para
  `simple`, delega en `comparar_columnas_sig` y le aplica la base mínima. Para `diseno`, usa el contraste de la
  sección 3. Devuelve siempre `list(letras, sig, method, reason, n_casos, n_conglomerados, df)`.
- `.cruces_sig_nota(spec, resultado)`: la nota al pie se genera desde la configuración (sección 5).

La tabla de cruces, los gráficos agrupados y apilados, la serie por niveles y armonizada pasan por
`.cruces_sig_comparar`. La z de `comparar_columnas_sig` queda como implementación del modo simple y conserva su
firma, así que sus tests no cambian.

### 3. La prueba bajo diseño

Para cada fila (categoría) de la tabla y cada variable de cruce:

- La proporción de cada columna d es una razón ponderada: `p_d = Σ w·y·I_d / Σ w·I_d`.
- Su error estándar de diseño se obtiene por linealización (Taylor): la variable influyente es
  `z_di = w_i·I_di·(y_i − p_d) / Σ w·I_d`. Para el par (a, b), `u_i = z_ai − z_bi`.
- La varianza de la diferencia se calcula con conglomerados últimos y reemplazo dentro de cada estrato:
  `V = Σ_h n_h/(n_h − 1) · Σ_j (t_hj − t̄_h)²`, donde `t_hj` es el total de `u` en el conglomerado j del estrato h.
  **Sin fpc**: la comparación entre columnas es inferencia analítica, no la descripción de una población finita.
- Si un estrato tiene un solo conglomerado, ese conglomerado se centra en la media general (el `lonely.psu = "adjust"`
  de `survey`). La nota lo dice cuando ocurre.
- El estadístico es `t = (p_a − p_b) / √V`, con gl = número de conglomerados del par menos número de estratos en que
  caen, y nunca menos de 1. Se cuentan solo los conglomerados del par, no los de todo el diseño: un grupo concentrado
  en pocas aulas no hereda los gl de las 60. Es más conservador que los gl globales de `survey::degf`.
- Las columnas se comparan **por par, como hoy**: la letra va en la columna mayor y nombra a la menor. La corrección
  se aplica dentro de la fila y de la variable de cruce, sobre los pares que llegan a probarse.
- Las medias (`comparar_medias_sig`) se prueban con el mismo contraste y `y` numérica. En el modo diseño, la Welch
  simple tampoco queda en la tabla.

La implementación es propia, una generalización del sandwich de `reporte_cruces_cluster.R` (que ya agrupa scores por
conglomerado) con centrado por estrato. **No se agrega `survey` a `Imports`.** El cálculo es álgebra de matrices sobre
la base que el job de cruces ya carga, así que no necesita un job nuevo ni el paquete en el worker `callr`. `survey`
entra en `Suggests` y un test compara contra él: con los mismos datos, `svyby(..., svymean, covmat = TRUE)` +
`svycontrast` debe dar la misma diferencia y el mismo error estándar (tolerancia 1e-8).

**Bases repeat.** Si la base repeat trae la columna de conglomerado (heredada de la madre por la llave ODK, como el
peso), se usa ese conglomerado: la persona queda anidada en el aula y el conglomerado último absorbe la correlación
entre personas. Si no la trae, sigue el contraste por persona de hoy, que pasa a ser `.cruces_sig_comparar` con
`conglomerado = persona` y sin estrato. El mínimo de 8 personas se conserva.

### 4. Base mínima en los dos modos

- Una columna con menos de `base_minima` casos válidos **sin ponderar** (30 por defecto) no entra en ningún par y
  se marca `.b`. Se cuentan casos y no suma de pesos, para que un peso de expansión no salte el umbral.
- En el modo diseño también queda fuera la columna con menos de `min_conglomerados` conglomerados con casos válidos
  (8 por defecto). Se marca igual, `.b`.
- `.a` conserva su significado (proporción 0 % o 100 %). Si una columna cumple las dos condiciones, gana `.b`.
- `comparar_columnas_sig(n_mat, N_vec, alpha)` no cambia. La base mínima la aplica `.cruces_sig_comparar` con el
  conteo sin ponderar que ya calcula `estratos_totales$n_sin_peso`. Una llamada directa a la función de bajo nivel se
  comporta como hoy.
- Este es el único cambio visible en los estudios que siguen en modo simple: las columnas con menos de 30 casos
  pierden sus letras. Es una decisión de la revisión, no un efecto colateral. Las Novedades lo anuncian.

### 5. La nota al pie sale de la configuración

`.cruces_sig_nota` arma la nota con lo que se usó en cada caso:

- **Simple:** «… (prueba z de diferencia de proporciones, supuesto de muestreo aleatorio simple, corrección de
  Bonferroni, nivel de significancia de 0,05). ".a" … 0 % o 100 %. ".b" indica una columna con menos de 30 casos,
  que no se compara.»
- **Diseño:** «… (prueba t de diferencia de proporciones bajo el diseño muestral: conglomerado `aula`, estrato
  `nivel_curso`, peso de Ponderación; varianza por linealización sin corrección por población finita; grados de libertad
  según los conglomerados de cada par; corrección de Holm, nivel de significancia de 0,05). ".b" indica una columna
  con menos de 30 casos o de 8 conglomerados, que no se compara.»
- El nombre que se muestra es la etiqueta de la variable del instrumento cuando existe, no el nombre crudo de la
  columna.
- La corrección se nombra siempre como se usó: Bonferroni, Holm o Benjamini-Hochberg. La etiqueta «Bonferroni» ya no
  queda fija en el texto.
- Cuando no se puede probar, la nota dice qué faltó: la columna de conglomerado en una base, un diseño incompleto o
  conglomerados insuficientes. Sigue `.notas_pie_significancia` y la regla «avisos dicen la causa».

La ficha técnica del XLSX («Significancia estadistica») usa la misma función, así que la nota y la ficha no pueden
divergir.

### 6. Gráficos y láminas usan la misma configuración

- `graficos_significancia.R` y `graficos_serie_significancia.R` hoy reciben matrices agregadas, y esos agregados no
  bastan para calcular la varianza de diseño. En el modo diseño reciben además la base (las filas del cruce con
  conglomerado, estrato y peso) por el contexto que ya resuelve la referencia de la pregunta, y llaman a
  `.cruces_sig_comparar`. Si la base no llega a ese punto, **el gráfico no asigna letras** y su nota lo dice: un
  gráfico nunca pone una letra de z simple junto a una tabla en modo diseño.
- El sufijo de las barras descarta `.b` igual que hoy descarta `.a`. La nota del gráfico explica la exclusión.
- **La lámina de diferencias entre públicos queda fuera del modo diseño en esta decisión.** Compara bases distintas,
  que son muestras independientes sin conglomerado común, así que no contradice ninguna tabla de cruces, que siempre
  compara columnas dentro de una base. Su nota pasa a decir «supuesto de muestreo aleatorio simple» y aplica la base
  mínima. Llevarla a diseño (un error estándar de diseño por base y una diferencia entre muestras independientes)
  necesita su propio ADR.

### 7. Router y UI

- `PUT` de la configuración de analítica acepta `cruces.significancia` y lo normaliza. `POST /api/analitica/cruces`
  lo pasa al worker del job como dato plano, igual que `alpha`.
- `GET /api/analitica/variables` ya lista las columnas. La UI ofrece como candidatas a conglomerado y estrato las
  columnas categóricas o identificadoras de la base activa.
- En `CrucesPane.tsx`, dentro de la sección Significancia, un control segmentado *Muestreo simple · Bajo el diseño*.
  Con *Bajo el diseño* aparecen dos selectores (conglomerado, obligatorio; estrato, opcional) y la corrección.
  `base_minima` y `min_conglomerados` no se exponen en la UI en esta decisión; viven en la configuración con sus
  valores por defecto. Es un componente propio en un archivo nuevo; `CrucesPane.tsx` solo lo monta.

## Consecuencias

- Los estudios existentes siguen en modo simple. Lo que ven cambiar es solo esto: la base mínima de 30 casos
  (sección 4), que también marca `.b` en las columnas sin casos, donde antes quedaba vacío; la nota, que suma
  el supuesto de la prueba y la explicación de `.b`; y la línea «Significancia estadistica» de la ficha técnica,
  que pasa de «Activada; alpha = X» a describir la prueba, la corrección y la base mínima.
- Un estudio por conglomerados puede producir letras defendibles sin salir de la app. Tabla, gráfico y nota cuentan
  la misma prueba.
- `reporte_cruces.R` cambia en el punto de llamada (unas líneas) y no gana la prueba. La lógica nueva vive en
  `cruces_significancia.R`.
- El contraste por persona de los repeats deja de ser un camino aparte y se vuelve un caso de la misma prueba. Sus
  tests (`test-analitica-repeats.R:390-491`) son el contrato de que el resultado no cambia.
- La prueba bajo diseño con pocos conglomerados por par tiene gl bajos, y por eso es menos potente que la z simple.
  Es lo esperado: la z simple estaba sobrestimando la información.
- **Limitación que queda:** en el modo simple con pesos de expansión, `n` sigue siendo suma de pesos y la z sale
  exageradamente significativa. Este ADR no lo cambia, para no mover letras de estudios cerrados. La recomendación
  para ese caso es el modo diseño, que no depende de la escala del peso (el test lo fija).

## Verificación

- `test-cruces-significancia-diseno.R` (nuevo, fixture sintético con conglomerados):
  - un par con letra bajo la z simple que la pierde bajo el diseño (alta correlación intraconglomerado);
  - una columna con N < 30 que no recibe letra y queda marcada `.b`, en los dos modos;
  - una columna con menos de 8 conglomerados, que queda `.b` solo en el modo diseño;
  - pesos de expansión frente a normalizados: letras, p y SE idénticos en el modo diseño;
  - igualdad numérica con `survey::svyby` + `svycontrast` (`skip_if_not_installed("survey")`);
  - Holm y BH frente a Bonferroni sobre el mismo vector de p;
  - la nota dice la prueba, el conglomerado, el estrato y la corrección configurados.
- Los tests del modo simple siguen verdes sin tocarlos: `test-graficos-significancia.R`,
  `test-reporte-cruces-nota-significancia.R`, `test-reporte-notas-pie.R` y `test-analitica-repeats.R`. Si alguno
  arma columnas de menos de 30 casos y verifica letras, se ajusta su fixture o su `base_minima` de forma explícita, y
  el commit lo dice.
- Round-trip del `.pulso`: la configuración de `significancia` sobrevive a guardar y abrir.
- `make gate-area` del área de analítica y `make gate-front AREA=analitica`.

## Estado de la implementación (2026-11-03)

Hecho:

- `api/R/cruces_significancia.R`: normalizador, validación del diseño (estrato anidado), contraste por linealización,
  letras con `.a`/`.b`, medias, nota y ficha técnica. El error estándar coincide con `survey::svyby` +
  `svycontrast` (test, tolerancia 1e-8).
- La tabla de cruces (`exportar_cruces_multi`) y las medias del modo dimensiones (`exportar_dimensiones_multi`)
  pasan por el punto único. `comparar_columnas_sig` y `comparar_medias_sig` ganan `correccion` y conservan su
  comportamiento por defecto.
- El router lee `cruces$significancia`, lo pasa al job y a la ficha técnica. `GET /api/analitica/variables` trae
  `columnas_base`: el id de aula suele estar en la data y no en el instrumento.
- UI: `CrucesSignificanciaDiseno.tsx`, montado desde `CrucesPane.tsx`.
- Gráficos: la configuración viaja con el instrumento (`inst$cruces_significancia`, `.graficos_sig_adjuntar_config`)
  en los dos caminos de fuentes: el del PPT por base (`.graficos_processing_sources`) y el del consolidado
  (`.graficos_consolidado_sources`). Las letras leen el diseño con `.graficos_sig_diseno_de_letras`. Las guardas de
  independencia de otros gráficos (ola 4, puntos comparativos, radar) siguen con `.graficos_sig_diseno_de_fuente`,
  que no cambia. En modo simple, los gráficos aplican la corrección configurada y la base mínima. En modo diseño
  **se abstienen** y su nota remite a la tabla. Si la configuración no se puede leer, también se abstienen
  (`sin_config`) y no caen a la z simple. Es el respaldo previsto en §6.
- Lámina entre públicos: base mínima y nota «bajo el supuesto de muestreo aleatorio simple».

Desvíos respecto de las secciones anteriores:

- **Base mínima en agrupadas y apiladas (§4).** La serie por niveles mide el umbral sobre casos sin ponderar
  (`n_casos`). Agrupadas y apiladas solo reciben la base ponderada que dibujan (desde `reporte_plan_ppt.R`, que
  está congelado), así que el umbral se mide sobre ella. Con pesos de expansión, un grupo con menos de 30 casos
  puede saltarse el umbral en esos dos gráficos. Queda pendiente junto con las letras bajo el diseño en gráficos.
- **Repeats (§3).** Una base repeat sin la columna de conglomerado del estudio sigue con
  `.repeat_compare_columns_cluster` tal cual, en vez de reescribirlo como un caso del contraste nuevo. Reescribirlo
  movía el resultado numérico (el CR1 por persona no centra y usa G − 1), y el contrato de §Consecuencias es que el
  resultado de los repeats no cambie. Con conglomerado del estudio, la base repeat usa el contraste nuevo.

Pendiente:

- Letras bajo el diseño en los gráficos (agrupadas, apiladas, serie). Llevar la base y la definición de la fila
  hasta `.graficos_sig_calcular` sin hacer crecer `reporte_plan_ppt.R`, que está congelado.
- Armonizada y comparativo entre periodos (`analitica_armonizada.R`, `reporte_comparativo.R`) siguen en modo simple.

## Unificación con el ADR 0128 (2026-11-03)

Gonzalo pidió unificar este ADR con la regla de diferencias del estudio (ADR 0128, decisiones D1 a D9 de la propuesta
de significancia). Lo que sigue vigente de este ADR y lo que cambia:

| Tema | Este ADR | Tras la unificación |
|---|---|---|
| Dónde vive la regla | `analitica_config$cruces$significancia`, solo para las tablas | `graficos_config$significancia`, una regla por estudio para láminas, Word y tablas (D1). Lo de Analítica se lee como siembra de la regla cuando el estudio aún no tiene una (`.sig_regla_desde_spec_cruces`) |
| Corrección | Bonferroni, Holm o BH dentro de la fila | BH sobre todas las comparaciones del estudio (D3) o Bonferroni por fila. Holm sale del catálogo |
| Valor por defecto | Modo simple | La prueba de diseño cuando la base trae una columna de aula reconocible; si no, la simple |
| Grados de libertad | Conglomerados del par menos estratos del par | Los del diseño (conglomerados menos estratos), como pide el dictamen y como da `survey::degf` |
| Gráficos | Se abstienen en modo diseño («las letras se leen en la tabla») | Marcan con la misma prueba y la misma familia que la tabla (482 de 482 celdas iguales en CCSS). La abstención queda solo para los graficadores que aún no usan la regla (series, armonizada) |
| Umbral de magnitud | No tiene | 10 puntos por defecto, también en las tablas (D5) |
| Varianza | `.cruces_sig_var_total` propia | Una sola linealización, `.sig_contrastes` (graficos_significancia_diseno.R); `.cruces_sig_diseno_fila` es un envoltorio |

Se conservan sin cambios: el estrato anidado en el conglomerado (ahora también para láminas y endpoints, con
`E_SIG_ESTRATO_NO_ANIDADO`), la marca `.b`, el peso de Ponderación, las medias bajo diseño (con corrección dentro de la
fila), el conglomerado heredado en las bases repeat, `survey` solo en Suggests y la nota generada desde la
configuración. El control de Analítica › Cruces pasa a mostrar la regla del estudio y a enviar a su diálogo en Gráficos.

