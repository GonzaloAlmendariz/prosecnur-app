# ADR 0061: La configuración de Analítica pertenece a su base, no al estudio

Estado: Aceptada

Implementacion: En curso

Fecha: 2026-08-06

Fecha de decision: 2026-08-06

Reemplaza: —

Extiende: ADR 0022 (perfiles por modo), ADR 0043/0044 (gramática de navegación y direcciones)

## Contexto

Analítica guarda las decisiones del analista —etiquetas de pregunta y de opción
editadas, secciones, variables excluidas, orden de categorías, cruces,
ponderación— en una `analitica_config`. En un estudio con varias bases esa
configuración se resuelve con `.analitica_scoped_base()`, que hoy devuelve el
nombre de la base activa **solo** cuando `processing_mode == "independent_siblings"`.
En cualquier otro caso devuelve la cadena vacía y `.analitica_config_get()` cae a
la `analitica_config` **global del proyecto**, compartida por todas las bases.

El campo `analitica_config_por_base` existe desde una migración anterior, pero en
modo `multibase` nunca se consulta ni se escribe: la rama que lo lee está detrás
de la misma condición.

### El defecto que esto produce

Los overrides se aplican **por nombre de variable** en
`.analitica_apply_data_review()`, que reescribe `attr(data, "label")`,
`inst$var_labels`, `inst$survey$label`, `inst$survey_raw$label*` y `orders_list`.
Cuando las bases no comparten instrumento, un mismo nombre designa preguntas
distintas en cada base, y el override escrito mirando una base se aplica a las
demás sin ninguna señal.

Medido sobre el estudio real de acreditación de Contabilidad PUCP (cuatro
públicos, `processing_mode = multibase`, `topology_declared = separate`), con 10
etiquetas editadas por el analista:

| Base | Variables mal etiquetadas | Ejemplo |
|---|---|---|
| docentes | 0 | correcto: es donde se escribieron |
| estudiantes | **6** | `p13_1` rotulada «¿Conoce el Servicio de salud?» siendo la batería de satisfacción, escala de 4 puntos |
| egresados | 0 | los nombres del override no existen en esa base |
| administrativos | **9** | `p13_1..3`, `p14_1..3`, `p15_1..3`, todas escalas de acuerdo, rotuladas como preguntas de servicios |

Verificado en vivo contra `/api/analitica/data-review`:

```json
{ "name": "p13_1",
  "label_actual":   "¿Conoce el Servicio de salud?",
  "label_original": "¿Conoce el Servicio de salud?",
  "opciones": [ {"code":"1","label":"Muy insatisfecho"},
                {"code":"2","label":"Insatisfecho"},
                {"code":"3","label":"Satisfecho"},
                {"code":"4","label":"Muy satisfecho"} ] }
```

El desfase de tamaño de batería delata el origen: docentes tiene tres ítems por
batería y estudiantes cuatro, así que el override pisa los tres primeros y deja
el cuarto intacto. `p13_3` de estudiantes, que es *Servicio de empleabilidad*,
quedó rotulada «¿Conoce las Actividades culturales?» — enunciado equivocado y
además ítem equivocado.

### Por qué el analista llegó a editar etiquetas

Porque el importador de SurveyMonkey traduce una matriz real a una fila `note`
con el enunciado más N `select_one` cuyo `label` es solo el texto de la fila
(`api/R/surveymonkey_api.R`, rama `fam == "matrix"`). Desde ahí cada base ofrece
tres variables rotuladas idénticamente —«Servicio de salud», «Bienestar
psicológico», «Actividades culturales»— y solo la lista de opciones las
distingue. El enunciado compuesto («¿Conoce el Servicio de salud?») existe en el
`.sav` como etiqueta de export escrita por el autor de la encuesta, y no es
derivable mecánicamente del `note` más el ítem: en la batería de satisfacción el
texto del `.sav` es una reescritura, no una concatenación.

Editar la etiqueta en Analítica → Datos es, por tanto, la respuesta correcta del
analista a una ambigüedad real. El defecto no está en que la haya editado sino en
dónde se guardó lo que editó.

### Tres alcances divergentes

Hoy conviven tres comportamientos para la misma etiqueta:

1. **Analítica y sus entregables** aplican el override, correcto en una base e
   incorrecto en las demás.
2. **Gráficos y el PPT** no lo aplican en absoluto: `finalize_sources()` en
   `router_graficos.R` re-aplica el orden de categorías y nada más, con un
   comentario que lo declara («el PPT NO pasa por `.analitica_apply_data_review`»).
3. **`label_original`** del payload de data-review llega ya pisado, porque el
   apply reescribe `inst$survey$label` antes de que se calcule. La pantalla no
   puede mostrar de qué se está separando el analista, y «Restaurar etiquetas
   originales» pierde su referencia visible.

## Decision

**La configuración de Analítica pertenece a la base, no al estudio, siempre que
las bases no compartan instrumento.**

1. `.analitica_scoped_base()` devuelve la base activa cuando
   `processing_mode == "independent_siblings"` **o** cuando la topología
   declarada es `separate` o `independent` y el estudio tiene más de una base.
   Con topología `single` o `integrated` hay un solo instrumento, los nombres de
   variable son comparables entre bases y la configuración global sigue siendo la
   correcta.

   El criterio es semántico y no una excepción para un estudio: bases separadas
   significan instrumentos distintos, y en instrumentos distintos un nombre de
   variable no identifica la misma pregunta.

2. **Ninguna base recién scopeada hereda la configuración global.** Una base sin
   entrada propia en `analitica_config_por_base` arranca en la configuración por
   defecto. La `analitica_config` global se conserva intacta en el estado, sin
   aplicarse, y la UI declara que existen etiquetas editadas sin base asignada.

   No se intenta atribuirla automáticamente. En el estudio medido esa
   configuración es un collage sin dueño único —`datos.variable_labels` escritos
   sobre docentes y `secciones` capturadas de estudiantes—, así que toda
   atribución automática acertaría con una mitad y fallaría con la otra. Las
   secciones se recuperan con «Detectar estructura»; las etiquetas se reescriben
   con la base correcta seleccionada.

   La herencia conservadora que ya existía **se conserva sólo para
   `independent_siblings`**, que es donde nació y donde el global sí tiene dueño
   único: es la configuración anterior a que ese modo existiera, escrita cuando
   el estudio era de una sola tabla. Extender el no-heredar a ese modo habría
   convertido un fix en una pérdida de trabajo para proyectos que nunca tuvieron
   el defecto.

3. **Gráficos aplica las etiquetas curadas de cada base**, igual que ya aplica el
   orden de categorías, de modo que el selector de variables y los títulos del
   PPT usen el mismo texto que Analítica.

4. **`label_original` dice lo que dice el instrumento.** El texto del instrumento
   se captura antes del apply y viaja aparte del texto vigente.

## Consecuencias

**A favor**

- Una etiqueta editada afecta a la base sobre la que se editó y a ninguna otra.
  Es la única propiedad que hace segura una superficie de edición de etiquetas en
  un estudio multiactor.
- Desaparece la divergencia entre Analítica y Gráficos: un solo texto por
  variable en tablas, libro de códigos, frecuencias, bases y PPT.
- El analista puede volver a ver el texto del instrumento, que es lo que hace
  reversible su edición.

**En contra, y asumido**

- **Se pierden las secciones guardadas en la configuración global** de los
  proyectos multibase existentes. Es el costo directo de no adivinar el dueño del
  collage. Se acepta porque son re-detectables con un control ya existente, y
  porque la alternativa —volcarlas en una base— produce un resultado incorrecto
  en la mitad de los casos y silencioso en todos.
- **El trabajo de etiquetado deja de compartirse entre bases.** En un estudio
  cuyos públicos comparten redacción, el analista repetirá ediciones parecidas
  en cada base. Se acepta: compartir es exactamente lo que produce el defecto, y
  el remedio correcto para la repetición es que la etiqueta llegue bien desde el
  origen, no que se propague desde una base cualquiera.
- **Cambia el comportamiento de proyectos multibase ya guardados.** La primera
  apertura tras el cambio muestra secciones re-detectadas y ninguna etiqueta
  editada aplicada. El aviso en la UI existe para que eso se lea como una
  migración y no como una pérdida.

**Invalidado por esta decisión**

- Leer o escribir `analitica_config` global en un estudio de bases separadas.
- Cualquier superficie que aplique un override de etiqueta sin resolver antes a
  qué base pertenece.
- Tratar la ausencia de override en Gráficos como una diferencia aceptable
  respecto de Analítica.

## Cumplimiento

- `api/tests/testthat/test-analitica-config-scope.R` monta un estudio
  `multibase`/`separate` con dos bases en las que el mismo nombre de variable
  designa preguntas distintas, escribe un `variable_labels` para la base A y
  exige que la base B **no** lo reciba. El caso se escribe en rojo antes del
  cambio y se comprueba por mutación.
- El mismo archivo fija la contraparte: con topología `integrated` la
  configuración sigue siendo compartida, para que el scoping no se generalice por
  descuido.
- Un caso cubre que una base sin entrada propia arranca en la configuración por
  defecto y **no** hereda la global.
- Para Gráficos, un caso comprueba que `/api/graficos/variables` devuelve, para
  cada base, la etiqueta curada de esa base y no la de otra.
- Para `label_original`, un caso comprueba que difiere del vigente cuando hay
  override activo.
- Verificación sobre estudio real: recorrido de Analítica → Datos en las cuatro
  bases del proyecto de acreditación y del selector de Gráficos, comprobando que
  cada base muestra sus propias etiquetas. La evidencia de partida —15 variables
  mal etiquetadas en dos bases— es la línea base contra la que se mide.

## Notas

- El origen de la ambigüedad que motivó las ediciones vive en el importador de
  SurveyMonkey (`api/R/surveymonkey_api.R`, rama `fam == "matrix"`). Conservar el
  enunciado de la matriz en una columna propia del survey, para que el ítem sea
  identificable sin depender del `.sav`, queda como trabajo aparte: reduce la
  necesidad de editar etiquetas a mano pero no sustituye a esta decisión, porque
  el analista siempre podrá editarlas.
- El panel de reconciliación de variables (Carga → Revisión) muestra los nombres
  crudos de las columnas extra sin la etiqueta que el `.sav` sí trae. Es un hueco
  independiente, registrado aquí solo para que no se confunda con este ADR.
