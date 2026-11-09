# ADR 0128: Una regla de diferencias por estudio

Estado: Aceptado (Gonzalo, 2026-11-03: decisiones D1 a D9 del diseño de significancia, y unificación con el 0127: «Sí, unifica con D1–D3»)

Implementación: rama `claude/significancia-diseno` (sesión S1 del trabajo paralelo del 2026-11-03).

Fecha: 2026-11-03

Reemplaza: la prueba z con Bonferroni por fila como única vara de las láminas (`graficos_significancia.R`) y de las
tablas de cruces (`comparar_columnas_sig`, `reporte_cruces.R`).

Unifica: el [ADR 0127](0127-las-letras-de-los-cruces-se-prueban-bajo-el-diseno-muestral.md) (letras de los cruces bajo el diseño). Ver su sección «Unificación con el ADR 0128».

Extiende: la propuesta `docs/qa/maqueta-significancia-2026-11-03/propuesta.md` (§3, §4 y §6) y el dictamen
metodológico del estudio CCSS 2026-II (§4, §8 y §10; vive en la carpeta del estudio, no en el repositorio).

## Contexto

Las láminas y las tablas de cruces marcaban diferencias con una prueba z de muestreo aleatorio simple y Bonferroni
dentro de la fila. El plan de análisis de CCSS 2026-II pide otra cosa: Rao-Scott por aula, Benjamini-Hochberg sobre el
informe, al menos 10 puntos de diferencia y las diferencias frágiles redactadas con prudencia. El dictamen
metodológico reprodujo la diferencia: con bases de 30 o más, 268 de 9.029 pares cambian de veredicto al pasar a la
prueba de diseño, y el motor marcaba letras en grupos de 6 y de 11 casos.

Además, cada lámina guardaba su propio nivel (`significancia_alpha`). Las 33 láminas con cruce del estudio podían
quedar con reglas distintas sin que nadie lo viera (D13 de la propuesta).

## Decisión

### 1. Una regla por estudio (D1)

La regla vive en `graficos_config$significancia` del `.pulso` y gobierna las láminas, el Word y las tablas de cruces.
Cambiarla avisa cuántas celdas de las tablas cambian de letra antes de guardarse.

```json
{
  "version": 1,
  "prueba": "rao_scott",           // "rao_scott" | "z"
  "correccion": "bh_informe",      // "bh_informe" | "bonferroni_fila"
  "alfa": 0.05,                    // 0.10 | 0.05 | 0.01 (opciones cerradas, sin paso a paso libre)
  "umbral_puntos": 10,             // 0 | 5 | 10 | 15 (D5: 10 por defecto, editable)
  "base_minima": 30,               // 20 | 30 | 50 casos por columna
  "conglomerados_minimos": 8,      // conglomerados por columna (dictamen §10.4)
  "fragiles": "contorno",          // "contorno" | "ocultar" (D4)
  "conglomerado": "aula",          // columna de la base; null = sin diseño declarado
  "estrato": null,                 // columna del estrato del sorteo, si existe
  "tendencia": false,              // D6: prueba de tendencia para niveles ordenados, apagada
  "incluir_ns": false,             // «No sé» y afines fuera de la prueba
  "max_letras": 6                  // D7: con más grupos, ▲▼ frente al resto
}
```

- **Valor por defecto.** Si la base tiene una columna de conglomerado reconocible (`aula`, `curso_horario`,
  `aula_id`), la regla propone Rao-Scott por esa columna. Si no la tiene, propone la prueba z con Bonferroni por fila,
  que es la de siempre.
- **Migración.** `mostrar_significancia` por lámina sigue siendo el interruptor de cada gráfico.
  `significancia_alpha` por lámina se lee (si el estudio no tiene regla, el primer nivel encontrado siembra `alfa`) y
  nunca se escribe. El inspector deja de mostrarlo.

### 2. La prueba (D2)

`prueba = "rao_scott"` es la diferencia de dos proporciones de dominio con la varianza linealizada por conglomerado
(último conglomerado, con reemplazo), dentro de cada estrato si se declara, y una t con los grados de libertad del
diseño (conglomerados menos estratos). Para la tabla de 2×2 de un par es la corrección de primer orden de Rao-Scott:
el chi-cuadrado de Pearson dividido por el efecto de diseño de la diferencia. Se implementa en R base
(`graficos_significancia_diseno.R`). El paquete `survey` es `Suggests` y solo se usa en los tests como referencia
(`svyby` + `svycontrast`).

- **Sin fpc** en las pruebas (dictamen §5.2): la comparación entre grupos es una inferencia analítica.
- **Elegibilidad por columna**: al menos `base_minima` casos **y** `conglomerados_minimos` conglomerados. Un grupo que
  no la cumple se muestra con trama, no se compara ni sirve de referencia, y la razón queda visible («n = 11 · no se
  compara», «4 aulas · no se compara»).
- **Pseudoconglomerados**: un caso sin conglomerado se toma como su propio conglomerado (como hace `seg_` en los
  scripts del plan). La nota no lo oculta: el endpoint informa cuántos casos quedaron así.

### 3. La familia (D3)

Con `correccion = "bh_informe"`, Benjamini-Hochberg se aplica sobre **todas las comparaciones del estudio**:

- cada pregunta de las secciones de Analítica y cada pregunta graficada con cruce,
- por cada variable de cruce declarada en Analítica (`cruces_vars`) y cada cruce de lámina,
- por cada fila comparable y cada par de grupos elegibles.

Las preguntas de dos categorías sustantivas aportan una sola prueba (la otra es el complemento: dictamen §3.3). Los
*top two box* de las láminas aportan la suya. La familia no depende de qué entregable se genera: así la lámina y la
tabla dan las mismas letras. Es un cálculo en dos pasadas: primero todos los p, después las marcas.

Con `correccion = "bonferroni_fila"`, cada fila se corrige sola, como hoy.

#### Familia por base (2026-11-09)

- **Unidad.** En un proyecto multibase, la unidad de la familia de `bh_informe` es la base. Cada ranura pertenece a la
  familia de la base que lee: la fuente explícita, si no el prefijo de sus referencias y, si no, la base activa
  (`.sig_base_de_lamina`). No hay control de multiplicidad entre bases: cada base se corrige dentro de sí.
- **Una regla por informe.** Con regla guardada, esa regla, tal cual, para todas las bases. Sin regla guardada se
  propone una sola sobre todas las bases, como la regla entre públicos (ADR 0138 P2): Rao-Scott con BH si alguna base
  trae el conglomerado, sin depender del orden de las bases. La columna se aplica por nombre en cada base que la tiene;
  la base que no la tiene se prueba como muestreo aleatorio simple y su nota lo dice («En <base> no hay conglomerado: se
  prueba como muestreo aleatorio simple.»), como en el ADR 0138 «Conglomerado». Guardar la regla exige el conglomerado
  en al menos una base (si ninguna lo trae, 422 `E_SIG_SIN_CONGLOMERADO`).
  Vale igual para todos los consumidores de la regla: láminas, serie por niveles, línea por nivel, tarjetas de
  diferencias (ADR 0129), tarjetas entre públicos (ADR 0138) y tablas de cruces, cuya nota del método dice «Rao-Scott
  por aula» en la base que lo trae y la misma línea de muestreo aleatorio simple en la que no.
- **Analítica.** Las comparaciones de Analítica entran sólo en la familia de la base de su config (hoy la activa), no en
  la de otra base que tenga columnas con el mismo nombre.
- **Base ambigua o desconocida.** Una lámina que mezcla bases (la pregunta de una y el cruce de otra, o dos
  graficadores de bases distintas) o que nombra una base ausente no entra en ninguna familia y avisa:
  `E_SIG_BASE_AMBIGUA` / `E_SIG_BASE_DESCONOCIDA` (409) en `/api/graficos/diferencias`, la lámina en error dentro del
  informe y un aviso en el export.

Antes: el export armaba una sola familia, la de la base activa, sobre las ranuras de todas las bases y con la regla
propuesta por la base activa. La lámina de otra base salía `fuera_de_familia`, sin marcas y con aviso, aunque
`/api/graficos/diferencias` sí la probaba sobre su base (con la regla que proponía esa base).

Después: el export (`.sig_informe_preparar`), la vista previa y el inspector (`.sig_contexto_sesion`) arman la regla y la
familia de cada base con las mismas funciones (`api/R/graficos_significancia_familia_bases.R`), y el render marca cada
lámina contra la familia de la base que tabuló. Con una sola base no cambia nada: regla y familia son bit a bit las de
antes. Las familias entre públicos (ADR 0138) siguen separadas. Prueba: `test-graficos-significancia-familia-por-base.R`.

### 4. Cuándo se marca

Para cada fila y par (a, b) con p_a > p_b:

1. ambos grupos elegibles (§2);
2. p ajustado < `alfa` **y** |p_a − p_b| ≥ `umbral_puntos`;
3. **frágil** si además el p ajustado está entre 0.01 y `alfa` (D4: contorno en el PPT, nunca en el resumen ejecutivo);
4. sin complementos: en una dicotómica solo se marca la opción principal; en una escala, solo el *top two box*;
5. «No sé», «No tengo información», «Otro» y «Prefiero no responder» cuentan en la base, no se marcan y no sirven de
   referencia, salvo `incluir_ns = TRUE`;
6. con más de `max_letras` grupos, la marca es ▲▼ frente al resto (D7).

La marca deja de viajar como texto pegado a la cifra. El motor devuelve una estructura por celda (`letras`, `fragil`,
`veredicto`, `dif`, `p_ajustado`) y el graficador dibuja la cápsula ▲A. La nota sale de una sola fuente de textos
(`graficos_significancia_textos.R`) para el PPT, el Word, la lámina «Cómo leer» y la UI, a 9 pt (D8).

### 4 bis. Lo que se toma del ADR 0127

- **Estrato anidado.** El estrato es un atributo del conglomerado. Si varía dentro de alguno, no se reasigna: la tabla y
  la lámina no marcan y dicen por qué, la familia no recibe esas pruebas y guardar la regla responde
  `E_SIG_ESTRATO_NO_ANIDADO`.
- **`.b` en las tablas.** La columna que en una fila no se compara por base o conglomerados insuficientes lleva `.b`.
- **Siembra desde Analítica.** Un estudio sin regla guardada que declaró el diseño en Analítica › Cruces arranca con
  esa declaración.
- **Medias y bases repeat.** Las medias de dimensiones se prueban con la misma linealización (corrección dentro de la
  fila), y una base repeat sin la columna de conglomerado sigue con el contraste por persona.

### 5. Contrato hacia la UI

Router delgado en `router_graficos_diferencias.R`:

| Método y ruta | Qué devuelve |
|---|---|
| `GET /api/graficos/diferencias/regla` | `{ regla, propuesta, origen, columnas }`: la regla guardada (o la propuesta), la que propondría el diseño y las columnas candidatas a conglomerado y estrato |
| `POST /api/graficos/diferencias/regla/vista-previa` | `{ regla, cambios_tablas, nota }` sin guardar: cuántas celdas de las tablas cambian con esa regla y el texto que leerá el cliente |
| `POST /api/graficos/diferencias/regla` | Igual, y guarda la regla en `graficos_config$significancia` (marca `project_dirty`) |
| `GET /api/graficos/diferencias?slide=<id>` | Una lámina: `{ regla, lamina }` |
| `GET /api/graficos/diferencias/informe` | `{ regla, laminas, resumen }` |

Forma de una lámina:

```json
{ "slide_id": "ccss-037", "titulo": "…", "estado": "con_marcas|ninguna|abstencion|sin_cruce|error",
  "motivo": null, "error": null,
  "variable": "B3_recod", "cruce": "area", "modo_letras": "letras|frente_al_resto",
  "grupos": [{ "letra": "A", "etiqueta": "Economía y Finanzas", "n": 224, "conglomerados": 31,
               "comparable": true, "motivo": null }],
  "pares": [{ "fila": "Académica", "a": "B", "b": "A", "p_a": 44, "p_b": 17, "dif": 27,
              "p": 0.00002, "p_ajustado": 0.0004, "deff": 1.14, "ic": [18, 36],
              "veredicto": "marcada|fragil|bajo_umbral|no_significativa|no_comparable",
              "redaccion": "…" }],
  "nota": "…", "revisar": ["titulo_afirma_fragil"] }
```

`revisar` toma valores de `titulo_afirma_fragil`, `sin_diferencias`, `bajo_umbral`, `base_chica` y `sin_prueba`.
`resumen` trae `cruces`, `marcadas`, `fragiles`, `ninguna`, `bases_chicas`, `sin_prueba` y `familia` (número de
comparaciones de la familia de BH). `error` es `{ code, message, error_id }` cuando el estado es `error`.

Códigos nuevos: `E_SIG_SIN_CONGLOMERADO` (422: se pidió Rao-Scott y la columna no existe en la base),
`E_SIG_ESTRATO_NO_ANIDADO` (422: el estrato varía dentro de algún conglomerado; viene del ADR 0127), `E_SIG_SIN_LAMINA`
(404: la lámina no existe en el plan) y
`E_SIG_PRUEBA_FALLO` (la prueba no pudo correr; viaja dentro de la lámina con su `error_id`, sin tumbar el informe).

## Consecuencias

- Las tablas de cruces entregadas antes de esta regla pueden cambiar de letras al regenerarse. Por eso la UI avisa del
  número de celdas que cambian antes de guardar la regla.
- El cálculo de la familia recorre todas las preguntas por cada cruce. Se hace una vez por exportación y se guarda en
  memoria por huella de datos y regla.
- `reporte_plan_ppt.R` está congelado: sus llamadas a `.graficos_sig_aplicar*` cambian de argumentos sin crecer, y la
  regla y la familia llegan por una opción del proceso (`prosecnur.sig_informe`) que los workers fijan y reponen.

## Fuera de alcance de esta implementación

- La prueba de tendencia (D6) es opcional y está apagada por defecto. Encendida, con tres o más niveles de código
  numérico, prueba el contraste lineal entre las proporciones por nivel con la misma varianza de la prueba por pares
  (Bonferroni entre las filas de la pregunta) y la nota dice en qué filas aumenta o disminuye con el nivel.
- Los filtros de lámina no entran en la familia: una lámina filtrada interpola su p ajustado sobre la familia del
  estudio.

## Cumplimiento

- Motor: `api/R/graficos_significancia_*.R` (regla, diseño, indicadores, veredicto, BH, familia, textos, render,
  informe y jobs) y `api/R/cruces_significancia.R` + `api/R/reporte_cruces_significancia.R` para las tablas.
- Router: `api/R/router_graficos_diferencias.R`, montado en `plumber_app.R`.
- UI: `frontend/src/features/graficos/laminas/diferencias/` y `frontend/src/features/analitica/panes/CrucesReglaEstudio.tsx`.
- Tests: `test-graficos-significancia-diseno.R` (contra `survey`), `test-graficos-significancia-regla.R`,
  `test-reporte-cruces-significancia-regla.R` (paridad lámina–tabla) y `test-cruces-significancia-diseno.R` (del 0127).
- Verificado en CCSS 2026-II: familia de 8.596 comparaciones y 482 de 482 celdas iguales entre lámina y tabla.

## Notas

- Excepción vigente (2026-11-08): con grupos excluidos en barras apiladas, agrupadas y multiapiladas, la prueba
  compara sólo los grupos mostrados y la corrección por comparaciones baja; la lámina puede marcar una diferencia que la
  tabla de cruces no marca. La nota de la lámina lo dice («Diferencias entre los grupos mostrados.»). Ver ADR 0135,
  sección «Excluir grupos del cruce». La paridad estricta exige que el motor de significancia reciba el número de
  comparaciones del cruce completo.

- Las medias de dimensiones se corrigen dentro de la fila: no entran a la familia de BH del informe.
- Las barras agrupadas dibujan la cápsula ▲A (pastilla y contorno punteado en la frágil); las apiladas y la columna del
  *top two box* llevan la marca como texto tras la cifra.
- La serie por niveles usa la regla. La armonizada aún no: con el estudio en diseño se abstiene y lo dice.
- La lámina «Cómo leer las diferencias» se escribe desde la regla en cada exportación; se reconoce por su título.

- Multiapiladas por cruce (dictamen del revisor, 2026-11-05). El indicador lo decide un solo resolutor, compartido por
  la lámina y la familia (`api/R/graficos_significancia_indicador.R`). Supuestos: el Top Two Box se prueba sólo si el
  gráfico declara `top2box_labels`, nunca por el preset ni por posición. Sin declaración, una escala no se prueba y el
  editor recibe un aviso para declarar sus categorías. Una lista sin orden sigue probando sus segmentos. La visibilidad
  de la columna no cambia qué se prueba sino dónde se informa: sin columna, la lámina no lleva marcas ni clave y el
  hallazgo va como aviso al editor. Si una categoría del Top Two Box no cuadra con el gráfico, la lámina se abstiene.
  Un p que no pertenece a la familia no se ajusta con el q de un vecino y no se marca. Probado en
  `test-graficos-significancia-multiapiladas-t2b.R`. El mazo CCSS v7.27 sale idéntico (familia de 4.668 comparaciones
  con los mismos p).
