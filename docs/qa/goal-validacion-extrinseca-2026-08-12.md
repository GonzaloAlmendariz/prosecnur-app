# GOAL — La validación deja de ser un espejo del instrumento

**Abierto:** 2026-08-12 · **Cierra:** solo Gonzalo · **Cadencia:** lote por lote

## Cómo avanza este GOAL

Indefinido y **por lotes**: se trabaja un lote a la vez y **no se abre el
siguiente hasta que el anterior está validado**. Un lote a medias bloquea la
cola; no se adelanta trabajo del lote siguiente "ya que estamos".

Un lote está **validado** cuando cumple las cuatro:

1. **Test con control** — el aserto distingue el caso bueno del malo. Si el
   arreglo no cambiara nada y el test seguiría pasando, no verifica.
2. **Medido sobre un proyecto real** — número antes y número después, con el
   proyecto nombrado. No vale "debería funcionar".
3. **Gate escalado al diff** — suites del área tocada en verde; typecheck si
   hubo TS.
4. **Commiteado** como unidad coherente, con su evidencia en el mensaje.

Lo aprendido de un lote —incluido lo que se descubre de lotes que **no** se
tocaron— se anota antes de cerrarlo. Un hallazgo de propina se vuelve ítem
nuevo aunque se cierre en el momento.

| Lote | Ítems | Por qué van juntos | Estado |
|---|---|---|---|
| **1** | L2 | El más chico y cierra el caso que abrió el GOAL | ☑ validado 2026-08-12 |
| **2** | L3 + L12 + front de semillas | Sembrar 104 reglas sin distinguir sembrada de manual entierra la pestaña; y lo sembrado en el lote 1 todavía no se ve | ☐ |
| **3** | L1 + L5 | El rol de agente es la misma declaración que el de identidad | ☐ |
| **4** | L4 | Tipo nuevo: mirar la secuencia completa | ☐ |
| **5** | L6 | Tipo nuevo: comparar filas por intervalo, no por igualdad | ☐ |
| **6** | L7 + L8 + L9 | Presentación; **necesita los nombres de los cinco tipos** | ☐ |
| **7** | L10 + L11 | Gobierno: el ADR y adelantar el aviso a Carga | ☐ |

## La calidad que se persigue

Hoy las reglas de Validación nacen todas del XLSForm: `relevant` → salto,
`required` → obligatoria, `constraint`, `calculate`. El instrumento es a la vez
legislador y juez, así que la validación **solo puede encontrar lo que el
formulario ya sabía prever**. Un error sistemático que el formulario no
contempló —o que el formulario mismo causó— cae fuera de su jurisdicción.

El caso que abrió el GOAL: en `ACNUR MDV AGOSTO SIN LIMPIAR.pulso`, 6 de 104
encuestas se recolectaron con una versión anterior del formulario, que mostraba
preguntas que la versión corregida oculta. Las 425 reglas del instrumento
reportaron 3 inconsistencias —todas del mismo caso— y no vieron la causa.

La calidad perseguida: **que la base se pueda auditar como base, no solo como
instancia de su formulario**, y que cada anomalía se enuncie de forma que un
analista sepa a quién le pasó y qué hacer sin leer una expresión en R.

## Vara

| # | Afirmación | Cómo se mide |
|---|---|---|
| **V1** | Ninguna verificación menciona el nombre de una variable de un proyecto | `grep` de nombres de MDV/ACNUR/HSVG en el engine nuevo devuelve 0. Toda variable llega por rol declarado en `operational_config`, como ya hacen `field_period` y `duplicates` |
| **V2** | La misma regla corre sobre los 4 proyectos de referencia sin editarla | `make reference-project-verify` + el engine sobre `acnur_acg`, `acnur_pdm`, `acrconta`, `hsvg2026`: 0 errores de ejecución, hallazgos coherentes con cada base |
| **V3** | Cada anomalía tiene un tipo, y los tipos no se mezclan | El resumen distingue contradicción / valor inválido / faltante indebido / anomalía de procedencia / observación. Una observación **nunca** suma a `n_inconsistencias` ni bloquea |
| **V4** | El enunciado nombra al sujeto, el hecho y la acción | Toda fila trae uuid + código de campo, valor observado con su etiqueta, con qué choca, y acción sugerida. Cero lógica negada anidada en el texto que ve el analista |
| **V5** | Una señal sola no es un hallazgo | El solapamiento y la duración larga se registran sin veredicto; el hallazgo aparece cuando ≥2 señales caen sobre el mismo caso. Control: en MDV, 21 avisos crudos → 1 hallazgo |
| **V6** | Lo que la capa nueva encuentra, la vieja no lo encontraba | Cada verificación trae su caso de MDV (o de otro proyecto real) que las 425 reglas del instrumento dejan pasar |
| **V7** | El analista puede apagar y calibrar cada verificación | Umbrales y activación viven en `operational_config`, versionados en el `.pulso`, sin tocar código |

## Dónde vive esto: "Criterios de revisión", no un motor nuevo

La pestaña posterior a Validación —`reglas_custom`, rotulada **"Criterios de
revisión · Señales adicionales"**— ya es la capa extrínseca. Tiene 10 tipos de
regla (`rango_num`, `rango_fecha`, `outliers_iqr`, `outliers_z`,
`fuera_catalogo`, `duplicados`, `coherencia_2v` y cuatro de `select_multiple`),
un editor por pasos, activación por regla y **acciones de limpieza asociadas**
(`nullify_fields`, `recode_map`, `replace_value`…).

Su vocabulario ya es el de este GOAL: *señales adicionales*. Lo que falta no es
un motor paralelo — es **sembrado, dos tipos nuevos y presentación**.

Verificado con el compilador real sobre MDV (104 casos):

| Se expresa hoy con | Resultado |
|---|---|
| `fuera_catalogo` · `__version__` = [versión vigente] | 6 casos — los de la versión antigua |
| `fuera_catalogo` · `emp_impact` = 1..6 | 1 caso — `H1010` con valor 7 |
| `fuera_catalogo` · `Enumerator_name` = [equipo] | 3 casos — nombres mal escritos |
| `duplicados` · (`telephone`, `name_ppl`) | 2 filas — `VL2004` ∩ `H1029` |

**Cuatro de los cinco hallazgos son configurables sin código.** `duplicados` ya
recibe una tupla de n variables, que es exactamente el rol de identidad de L1 ya
implementado. Lo que ninguna regla puede hacer hoy: mirar la **secuencia
completa** (todas evalúan fila a fila) y **cruzar una fila contra otras** por algo
que no sea igualdad exacta de tupla.

## Cola

Cuatro capas. La fundación habilita; el sembrado convierte capacidad manual en
cobertura automática; los dos tipos nuevos cubren lo que no tiene molde; la
presentación decide qué cuenta y cómo se dice.

### Capa 1 · Fundación

**L1 · Rol de identidad declarado** ☐
- **Rol**: contrato que permite escribir reglas generales. Traduce "quién es el
  sujeto de este caso" a nombres de variables una vez por proyecto, para que
  ningún detector ni regla sembrada tenga que saberlo.
- **Objetivo**: que el analista declare n variables con rol de identidad y que
  tanto `duplicados` como el cruce de L6 las consuman de la misma declaración,
  en vez de re-elegirlas en cada regla. Incluye sugeridor de candidatos —alta
  cardinalidad, precargados— para confirmar en vez de escribir.
- **Dónde vive**: `validacion_operational_controls.R` (patrón `field_period` /
  `duplicates`) · UI de Validación
- **Ya existe la mitad**: `duplicados.variables` hace justo esto, pero por regla
  y no como declaración reutilizable del estudio
- **Bloquea a**: L5, L6

### Capa 2 · Sembrado — la capacidad existe, falta que no sea manual

**L2 · Sembrar procedencia del formulario** ☑ *(lote 1, 2026-08-12)*
- **Rol**: detector de contexto. Debe correr primero: si parte de la base salió
  de otro formulario, las "inconsistencias" de esos casos pueden ser artefactos.
- **Objetivo**: que al cargar una base se proponga sola la regla
  `fuera_catalogo` sobre la columna de versión, con la vigente como único valor
  admitido. Hoy funciona, pero solo si alguien sabe que debe escribirla.
- **Dónde vive**: `api/R/reglas_custom_semilla.R` (archivo nuevo) ·
  `GET /api/validacion/v2/reglas_custom/semillas`
- **Evidencia**: `test-reglas-custom-semilla.R`, 23 asserts · gate del área
  1021 asserts / 0 fallos · sobre `ACNUR MDV AGOSTO`: **0 criterios antes → 1
  propuesto**, válido contra el schema real, y al compilarlo y evaluarlo marca
  exactamente `H1006 H1002 H1010 H1030 H1050 H1066`
- **Control**: la misma base filtrada a una sola versión (98 casos) propone **0**
- **Falta**: la propuesta existe en la API pero **no se ve en la pestaña** — el
  front va en el lote 2, junto con L12 que es donde se decide cómo se muestran
  las sembradas sin enterrar las escritas a mano

**L3 · Sembrar dominio de cada `select_one`** ☐
- **Rol**: cierra el hueco más elemental —el valor pertenece a su lista— que hoy
  ninguna de las 5 familias derivadas del instrumento cubre.
- **Objetivo**: derivar una regla `fuera_catalogo` por cada `select_one`, con
  sus valores leídos del XLSForm y los especiales 90/94–99 admitidos. A mano es
  inviable: en MDV serían 104 reglas escritas una por una.
- **Dónde vive**: sembrador sobre `reglas_custom`, leyendo `choices`
- **Cubre**: `emp_impact = 7` con catálogo 1..6

**L5 · Sembrar identidad del agente** ☐
- **Rol**: protege todo lo que se reporta *por encuestador*: con el nombre sucio
  las tablas por agente salen con filas fantasma y el control de campo se
  degrada sin avisar.
- **Objetivo**: proponer la lista de agentes observados, que el analista depure
  una vez, y sembrar `fuera_catalogo` con ella. Las variantes por similitud
  (`Mary` ~ `Mary Berrocal`) se sugieren para unificar, nunca se fusionan solas.
- **Dónde vive**: sembrador + rol "agente"
- **Cubre**: `Mary`, `JORGE DE SOLAR`, y un teléfono escrito en el campo nombre

### Capa 3 · Tipos nuevos — lo único que exige motor

**L4 · Tipo `continuidad_secuencia`** ☐
- **Rol**: verifica que lo que salió del servidor sea lo que llegó a la base:
  ocurre antes de que el instrumento exista, así que ninguna regla derivada de
  él puede saberlo.
- **Objetivo**: un tipo que mire la **secuencia completa** —hoy todas las reglas
  evalúan fila a fila— y reporte los huecos. La anomalía no es de ninguna fila:
  es de las filas que faltan, lo que obliga a un enunciado sin sujeto individual.
- **Dónde vive**: `reglas_custom_schema.R` + `reglas_custom_compile.R`
- **Cubre**: `_index` 13, 65 y 103 ausentes en MDV

**L6 · Tipo `cruce_identidad` (señal↔identidad)** ☐
- **Rol**: árbitro de la capa, no un detector más. Decide cuándo un conjunto de
  señales merece la atención de una persona y cuándo se queda en registro.
- **Objetivo**: combinar solapamiento temporal con llaves de identidad
  compartidas y emitir hallazgo solo con ≥2 señales sobre el mismo caso.
  `duplicados` es hoy el único tipo que compara una fila contra otras, y solo
  por igualdad exacta de tupla; esto necesita comparación por intervalo.
- **Dónde vive**: `reglas_custom_schema.R` + `reglas_custom_compile.R`
- **Control**: 21 avisos crudos → 1 hallazgo (`H1029` ∩ `VL2004`)

### Capa 3 · Presentación — qué cuenta como inconsistencia y cómo se dice

**L7 · Taxonomía de anomalías** ☐
- **Rol**: define el vocabulario del veredicto. Hoy todo cae en un solo saco y
  por eso un dato imposible pesa igual que un formulario que alguien dejó
  abierto.
- **Objetivo**: separar contradicción / valor inválido / faltante indebido /
  anomalía de procedencia / observación, con la garantía dura de que una
  observación **nunca** suma a `n_inconsistencias` ni bloquea nada.
- **Dónde vive**: columnas del resumen en `validacion_evaluacion_data.R` y
  `validacion_ast_runtime.R` · UI de Validación
- **Pendiente de Gonzalo**: los nombres de los cinco tipos

**L8 · Enunciado del hallazgo** ☐
- **Rol**: es la cara visible de toda la capa. Sin esto, los detectores
  producen hallazgos correctos que nadie puede accionar.
- **Objetivo**: pasar de describir la regla —enunciado universal, negado, sin
  sujeto— a describir el hecho: sujeto → qué respondió → con qué choca → qué
  hacer. La materia prima ya está calculada en `variable_roles` (target,
  drivers, gate, etiquetas humanas); falta redactar. La "acción sugerida"
  enlaza con las acciones de limpieza que ya existen (`nullify_fields` es
  exactamente lo que pide `H1010`), en vez de ser texto suelto.
- **Dónde vive**: contrato del resumen · UI de Validación · `customRuleNarrative.ts`
- **Medida**: cero lógica negada anidada en el texto que ve el analista

**L12 · Sembrada vs escrita a mano** ☐
- **Rol**: sin esto, el sembrado de L2/L3/L5 inunda la pestaña y entierra las
  reglas que el analista escribió con criterio propio.
- **Objetivo**: que una regla sepa si nació de un sembrador o de una persona,
  que las sembradas se puedan revisar en bloque, y que re-sembrar no pise una
  que el analista ya ajustó.
- **Dónde vive**: `reglas_custom_schema.R` (campo de origen) · `ReglasCustomTab.tsx`
- **Riesgo que cubre**: en MDV, L3 sembraría 104 reglas de una sola vez

**L9 · `estado_dinamico` deja de engañar** ☐
- **Rol**: arreglo de vocabulario heredado, chico pero de alto costo si se
  ignora: en pantalla se lee "correcta" al lado de "1 inconsistencia".
- **Objetivo**: que el campo diga qué califica —la regla, no el dato— o que se
  renombre. Decisión de nombre, no de lógica.
- **Dónde vive**: `validacion_evaluacion_data.R`

### Capa 4 · Gobierno y alcance

**L10 · ADR de "base validada"** ☐
- **Rol**: fija la decisión de fondo para que no se vuelva a discutir en cada
  sesión. Cambia el significado del gate de Validación.
- **Objetivo**: dejar escrito qué significa que una base esté validada cuando la
  validación ya no se deriva solo del instrumento, y qué tipos de anomalía
  bloquean el avance a Codificación.
- **Dónde vive**: `docs/adrs/`

**L11 · El aviso se adelanta a Carga** ☐
- **Rol**: mueve la detección al momento en que todavía se puede corregir el
  proceso, no solo el dato. En Validación la base ya está armada; en Carga aún
  se puede parar el campo.
- **Objetivo**: que al entrar una base con más de una versión de formulario, se
  avise ahí mismo.
- **Dónde vive**: `router_carga.R` · UI de Carga
- **Depende de**: L2

### Espera decisión de Gonzalo

| Qué | Por qué no puedo yo |
|---|---|
| Los nombres de los cinco tipos de anomalía | Van a la UI, a los reportes y a la conversación con el cliente; deben salir de cómo habla el equipo, no de mi vocabulario |
| Si el solapamiento merece ser tipo propio en algún perfil de estudio | Depende de si en algún estudio lo usan como señal de campo por sí sola |
| Umbrales por defecto (duración, distancia de nombres) | Criterio metodológico de la casa |

## Medición de partida — `ACNUR MDV AGOSTO SIN LIMPIAR.pulso`, 104 casos

Reglas del instrumento hoy: **425** (265 skip · 139 required · 7 constraint ·
7 calculate_check · 7 odk_raw) → **3 inconsistencias**, todas del caso `H1010`
(uuid `481e42b5-9f0f-42f2-9439-c0496e955571`).

Prototipo de la capa extrínseca sobre la misma base:

| Señal | Crudo | Tras el cruce |
|---|---|---|
| Versiones de formulario mezcladas | 6 casos | **hallazgo** (causa de las 3 inconsistencias) |
| Valor fuera de catálogo (`emp_impact = 7`) | 1 | **hallazgo** |
| Huecos en la secuencia de envíos | 3 | **hallazgo** (revisar con Kobo) |
| Variantes del nombre del encuestador | 3 | **hallazgo** |
| Duración imposible | 15 | observación, 0 hallazgos |
| Solapamiento temporal | 5 | **1 hallazgo** (`H1029` ∩ `VL2004`) |
| Llave de identidad repetida | 1 | (el mismo par) |

**21 avisos crudos → 1 caso de campo que merece una llamada.** Esa proporción es
la vara de V5.

## Trampas

- **La duración no es una variable confiable.** `end` se mueve si el formulario
  queda abierto: en MDV hay entrevistas de 44 h. Cualquier verificación que use
  duración —y cualquier análisis que la reporte— está midiendo otra cosa.
- **El solapamiento es la sombra de la trampa anterior.** 4 de los 5
  solapamientos de MDV son formularios abiertos, no simultaneidad real. Sin una
  segunda señal, no afirma nada.
- **Nombrar variables mata la regla.** `name_ppl`, `telephone`, `Pulso_code` son
  de este proyecto. El patrón correcto ya existe en la casa: `field_period` y
  `duplicates` declaran el rol en `operational_config` y el motor nunca sabe el
  nombre. (Corrección de Gonzalo, 2026-08-12.)
- **`duplicates` ya existe y está apagado** (`enabled = FALSE`, `variables`
  vacío) en MDV. Ojo: hay **dos** duplicados distintos y es fácil confundirlos —
  el control operacional `OP_duplicates` (`response_similarity`, busca encuestas
  copiadas) y el **tipo de regla** `duplicados` de Criterios de revisión (tupla
  de llaves, igualdad exacta). El segundo es el que sirve para identidad.
- **`which.max` sobre texto no ordena: coacciona a número y devuelve NA.** El
  desempate del sembrador por "envío más reciente" salía vacío. Las marcas de
  ODK/Kobo son ISO 8601, así que se comparan como texto y el orden lexicográfico
  ya es el cronológico — parsear fechas ahí obligaría a adivinar zona y formato
  por plataforma. (Lote 1.)
- **El proyecto de referencia no basta como control positivo.** MDV tiene 2
  versiones y por eso se ve el hallazgo; el aserto que de verdad verifica es el
  negativo: la misma base filtrada a una sola versión debe proponer 0. Sin él,
  un sembrador que propusiera siempre pasaría igual. (Lote 1.)
- **Antes de escribir un detector, revisar si ya hay un tipo que lo exprese.**
  Se diseñó una capa entera como motor nuevo y resultó que 4 de 5 hallazgos ya
  se configuran con `fuera_catalogo` y `duplicados`. El trabajo real era
  sembrado y presentación, no motor. (2026-08-12.)
- **La materia prima del buen enunciado ya está calculada.** `variable_roles`
  trae target, drivers, gate y las etiquetas humanas de cada variable; `detalle`
  e `issue_code` llegan NA en las inconsistencias reales. No falta computar:
  falta redactar el hallazgo en vez de la regla.
- **`estado_dinamico` califica la regla, no el dato.** Dice `"correcta"` en las
  tres reglas que encontraron inconsistencias. Leerlo como veredicto del dato es
  un error fácil.
- **En Kobo no se puede responder lo que el formulario no muestra.** Si un dato
  está fuera de su salto, el formulario se lo mostró. Sirve para no atribuir a
  la encuestadora un defecto de versión.
