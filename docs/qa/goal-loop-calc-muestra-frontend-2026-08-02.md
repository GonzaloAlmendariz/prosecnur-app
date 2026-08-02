# GOAL — Cálculo de muestra: la superficie deja de ser prosa y vuelve a ser instrumento

Loop permanente abierto por Gonzalo el 2026-08-02. **Solo Gonzalo lo cierra.**
El estado vive en este documento, no en la conversación.

## Por qué existe este loop

El loop v2 (`goal-loop-calc-muestra-v2-2026-08-01.md`) movió el backend: hoy hay
contratos R con dueño, tests y fail-closed para criterios, cascada, anclas,
alumnos por CH y distribución. La superficie no acompañó. En palabras de
Gonzalo: *«el front end está francamente muy mal hecho y poco elaborado, lleno
de AI slop, integración pobre y poco dinámica»*.

Los dos loops conviven y no compiten: **el v2 sigue siendo dueño del dato y del
motor; este es dueño de la superficie.** Cuando un hallazgo de superficie exija
un cambio de contrato, se anota aquí y se ejecuta allá.

**Referencia de producto (añadida 2026-08-02, indicación de Gonzalo):** la
dirección visual y conceptual contra la que se afina vive en
`Obsidian_Prosecnur/Boceto_Calculo_de_Aulas_v2.canvas` — en particular el grupo
«Marco/Criterios — la vara del v1, explícita» (todos los criterios por
facultad, boxplot+media como núcleo, ancla histórica por criterio, embudo vivo)
y el grupo «la Selección se entiende sola». Este loop no reinterpreta esa
dirección: la ejecuta en la superficie. Prompt de arranque:
`docs/qa/prompt-goal-loop-calc-muestra-frontend.md`.

## La vara

La superficie de Cálculo de muestra tiene que servir para **decidir con la
evidencia en la mano, en el mismo sitio y en el momento**. Tres pruebas:

1. **Prueba de la decisión.** Quien decide un criterio ve, sin moverse ni
   recordar, el detalle que justifica esa decisión. Si hay que cambiar de zona
   de la pantalla para saber qué recorta un criterio, la superficie falló.
2. **Prueba del orden.** Lo que es **resultado** de decisiones aparece
   **después** de las decisiones. Nada que resuma una cascada abre la pantalla.
3. **Prueba del hueco.** Cada hueco de la pantalla contiene un dato o una
   afordancia, nunca una frase que parafrasea el título o explica el control
   que está al lado. *(`feedback_no_sobreexplicar_en_la_ui`.)*
4. **Prueba del vocabulario (añadida 2026-08-02).** El mismo concepto se llama
   igual en todas las superficies del módulo, y dos conceptos distintos nunca
   comparten rótulo sin distinguirse (S7: las dos «Facultad»). Si un término
   cambia entre pestañas hermanas —o entre la pantalla, el export y el pase a
   Monitoreo—, la superficie falló aunque cada pantalla suelta se entienda.

Y la regla madre heredada, intacta: **primero el dato, después el gráfico,
después el brillo.** Este loop no la afloja — la exige en la dirección
contraria: un dato correcto que no se puede leer tampoco está entregado.

## Mandatos (Gonzalo, 2026-08-02)

**S1 — Decidir y ver son un solo acto.**
Hoy Criterios tiene tres zonas separadas: los editores de criterio, la consola
de radiografía con su propio selector de criterio, y los bloques por facultad.
El selector de criterio y la radiografía **no son dos cosas**: enfocar un
criterio *es* verlo. La radiografía vive dentro del criterio que se está
decidiendo, por facultad, no en una consola aparte a la que hay que bajar.

**S2 — El resultado va al final.**
La matriz de decisión por criterios (matriz marginal / embudo facultad ×
criterio) es el **resultado** de las decisiones previas y hoy abre la pantalla.
Se muda al final del recorrido, como cierre y comprobación, no como portada.
La misma regla se aplica a cualquier resumen que hoy preceda a lo que resume.

**S3 — Cero prosa que no sea dato.**
Ningún bloque repite su título, explica el control que tiene al lado ni narra
la afordancia. Un aviso se escribe **una vez**, en un solo lugar. La prosa
metodológica que sí aporta (por qué el orden de la composición importa, qué
significa un denominador) se conserva, pero cabe en una línea o vive en un
detalle abrible — no ocupa el hueco del dato.

**S4 — Los gráficos comparan o no existen.**
El boxplot percentilar actual se normaliza contra su propio P10–P90, así que
todas las cajas salen del mismo ancho y **ninguna se puede comparar con otra**;
no tiene eje, ni escala, ni referencia, y arrastra una leyenda idéntica debajo
de cada gráfico. Un boxplot que no permite comparar facultades no es un
boxplot: es un adorno. Se rehace sobre escala compartida, con eje legible,
referencia visible (mediana o media del total) y leyenda una sola vez por
bloque.

**S5 — Dinámico de verdad, no animado.**
Dinámico significa que la pantalla **responde a lo que estoy decidiendo**:
enfocar un criterio actualiza aguas abajo a la vista, el hover adelanta el
delta contrafactual, el orden de recorte se ve y se puede interrogar. El
contrato R para eso ya existe (cascada viva, preview no persistente, delta
contrafactual). Está en el payload y no en la pantalla. Animación sin respuesta
es brillo antes del dato y no cuenta.

**S6 — El barrido es de la sección entera, no de una pestaña.**
Criterios es el ejemplo que Gonzalo dio, no el alcance. Marco, Cálculo,
Selección, Datos y Entrega pasan por la misma vara. Cada lote toma una sección
completa.

**S7 — Una categoría es una sola cosa (Gonzalo, 2026-08-02: «noto
contradicciones, categorías que mezclan nombres o mezclan cursos con
facultades»).**
Medido sobre `criterios_catalogo` del proyecto de referencia, la observación es
literal y tiene cuatro formas distintas:

- **Dos «Facultad» bajo la misma palabra.** El catálogo publica `faculty` con
  `dim=alumno` (ESTUDIOS GENERALES LETRAS, DERECHO, ARQUITECTURA Y
  URBANISMO…), mientras las tarjetas de radiografía agrupan por
  `faculty_dimension = curso_horario_efectiva`. Son **la facultad del alumno**
  y **la facultad que dicta el curso** — conceptos distintos, ambos rotulados
  «Facultad» en pantalla. Quien lee no puede saber cuál está mirando.
- **La misma dimensión anonimizada en una superficie y en claro en otra.** En
  el mismo proyecto, `criterios_catalogo.faculty` trae los nombres reales
  mientras Cobertura y la radiografía muestran «Andres», «Elena Diego»,
  «Nestor DE POSGRADO», «Karina Y Elena DE LA Jimenez.» — el anonimizador
  sustituyó palabra a palabra en un camino y no tocó el otro. Es a la vez un
  defecto de consistencia y un riesgo de fixture.
- **Categorías que son varias categorías dentro de una etiqueta.**
  `session_type` publica `TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)` y
  `condition` publica `INGRESO(EV.TAL,1OP,CEPR,ITS,PAEE,BACH,EX.ING)`: tres y
  siete valores concatenados que la UI muestra crudos como si fueran uno.
- **Una variable con dos taxonomías dentro.** `condicion_curso` mezcla la
  condición del curso (OBLIGATORIO, ELECTIVO, ELECTIVO-OBLIGATORIO) con su
  área o tipo (ARTES, SEMINARIO DE INTEGRACIÓN, TEMAS DE PROFUNDIZACIÓN,
  REQUISITO PARA EGRESO DE EEGG). Y `modality` mezcla vocabularios —
  «Presencial», «Semipresencial», «A distancia» en capitalización de frase y
  «VIRTUAL» en mayúsculas, con «VIRTUAL» y «A distancia» probablemente el
  mismo concepto desde dos fuentes.

La regla: **cada dimensión se nombra por lo que es y se muestra una sola vez
con un solo vocabulario.** Si dos conceptos distintos comparten palabra, la
pantalla los distingue; si una etiqueta esconde varias categorías, la pantalla
lo dice; si la fuente trae vocabularios mezclados, se canoniza con dueño y se
rotula la agrupación. Nada de esto se resuelve inventando en React: lo que sea
del dato se pide al loop v2.

## Invariante

**Ninguna iteración cierra sin haberse visto en el proyecto de referencia
abierto tal cual está, y ninguna deja la pantalla con más palabras que datos.**
Cada iteración mueve al menos una fila del ledger estrictamente a mejor;
igualar no cierra la iteración.

Corolario heredado del v2 y aprendido a la mala: **un artefacto reconstruido
mide rendimiento y prueba contratos; no acredita una capacidad.** Si la
capacidad exige un estado que el proyecto de referencia no tiene, llevarlo a
ese estado es parte del trabajo.

## Regla de no detención (explícita, pedida por Gonzalo)

El loop **no se detiene por nada**. En concreto:

1. **No se detiene por una decisión.** Lo que exija criterio de Gonzalo va a la
   bandeja con opciones y recomendación, y el loop sigue con lo desbloqueado.
   Máximo una decisión nueva por iteración.
2. **No se detiene por el motor.** Si el dato no llega porque el backend está
   roto (hoy: reconstruir el marco deja 0 elegibles, ver el v2), el loop
   **no espera**: anota el bloqueo en el v2, se procura un estado sembrado
   —fixture propio, seed script o recuperación— y sigue trabajando la
   superficie contra ese estado. Auditar sobre pantallas vacías no es auditar.
3. **No se detiene por un veto.** Un veto de revisión se repara dentro del
   mismo lote y se vuelve a presentar; no abre una iteración nueva ni congela
   la cola.
4. **No se detiene por alcance.** Si un lote descubre más defectos de los que
   cabe cerrar, cierra los afines y **encola el resto con su medición**; nunca
   deja el lote a medias sin escribir qué quedó fuera.
5. **Sí se detiene por evidencia.** La única razón legítima para no cerrar una
   iteración es que el gate esté rojo. Eso no detiene el loop: detiene el
   cierre.

## Estado de observación (el instrumento)

Ningún `.pulso` del repo contenía la radiografía por facultad: los seis estados
probados el 2026-08-02 traen `eligible_student_rows=106013`,
`classroom_included_n=2373` y **cero** `criterios_radiografia`. Reconstruirlos
daba 0 elegibles. **Sin instrumento no hay loop visual**, así que el paso 0 fue
conseguirlo.

### Por qué no se podía reconstruir (causa medida, 2026-08-02)

No era el motor. Reproducción headless con la config guardada y la base del
propio `.pulso`, criterio a criterio sobre las 136.284 filas:

| criterio de alumno | filas que pasan |
|---|---:|
| `condition` | 124.167 |
| `formation` | 125.003 |
| `age` | 123.360 |
| `level` | 136.284 |
| **`faculty`** | **0** |

El anonimizador reemplazó la facultad del alumno en la base por nombres de
persona («Andres», «Nestor DE Ricardo Diana», «Karina, Karina Y Karina») y dejó
intactos en `criterios_seleccion` los quince slugs de las facultades reales
(`estudios_generales_letras`, `derecho`, …). Ningún valor puede casar nunca. El
manifiesto declara `anonimizacion.aplicada: true` con 13 tablas tocadas; la
config de criterios y `criterios_catalogo` no estaban entre ellas. **Es la
misma contradicción que Gonzalo señaló en S7, vista desde el motor.**

### El instrumento (declarado)

`hsvg2026-seed-radiografia.pulso`, derivado de
`outputs/reference-runs/hsvg2026-20260801-122927/hsvg2026.pulso` con el guion
`seed.R` del scratchpad de la sesión. Única reparación: **liberar el criterio
de facultad**, que la base anonimizada no puede casar. Los otros cuatro
criterios de alumno quedan intactos.

- Marco construido en **148,7 s**; `eligible_student_rows = 106.013` — **la
  cifra exacta del frame guardado**, que es la prueba de que la reparación es
  la correcta y no un atajo.
- `population_n = 21.362`, `classroom_n = 5.263`,
  `classroom_included_n = 2.799`, `excluded_rows = 30.271`.
- Publica `criterios_radiografia` (con `matriz_embudo`), `criterios_totales`,
  `criterios_cascada`, `alumnos_por_ch` y `criterios_anclas_historicas`.

**Ancla histórica cargada (pedido de Gonzalo, 2026-08-02).** El instrumento
incorpora además el Excel de control 2025 —`Historico 2025/Hostigamiento PUCP
2025_BD Aulas Agendadas-6.xlsx`, hoja **«Base de control»** (cabecera agrupada
en la fila 1, cabecera real en la 2)— para verificar que los elementos de
asistencia histórica cargan bien. **Cargan, y reproducen las cifras canónicas:**

| eslabón | numerador / denominador | tasa | IC 95 % | k |
|---|---:|---:|---|---:|
| Asistencia | 4.792 / 6.861 | **0,698** | 0,668–0,729 | 190 |
| Completitud | 3.610 / 4.792 | **0,753** | 0,709–0,794 | 190 |
| Validez | 3.223 / 3.610 | **0,893** | 0,878–0,907 | 190 |
| Producto (τ) | 3.223 / 6.861 | **0,470** | 0,439–0,503 | 190 |

Los tres eslabones coinciden con los del boceto v2; el producto se calcula
directo (3.223/6.861), no multiplicando factores redondeados, de ahí 0,470
frente al 0,469 del canvas. Cobertura 194 agendados → 192 aplicados → 190
observados. La identidad `A = E + no_respondieron` se verifica en 142 filas con
**0 inconsistencias**. Publica cuatro dimensiones —tamaño, rango horario,
facultad (15 celdas) y tipo de sesión— con IC por bootstrap percentil
(n=2.000). Solo viaja el agregado: el Excel crudo tiene nombres, teléfonos y
correos de docentes y **no entra al `.pulso`**.

**Lo que el ancla no puede hacer, y por la misma causa de siempre:** las 243
filas de `criterios_anclas_historicas` salen `match_level = "incompatible"`
porque la facultad de 2026 viene anonimizada («andres», «karina_e_karina») y la
referencia de 2025 trae las quince facultades reales. La degradación se rotula
honestamente —«El criterio no comparte una característica compatible con la
referencia»— así que el contrato se comporta bien; lo que no se puede es
acreditar el emparejamiento sobre este fixture. Es la tercera superficie donde
muerde la misma contradicción del anonimizador.

**Qué NO certifica:** las cifras canónicas del estudio (el criterio de facultad
está liberado, así que `classroom_included_n` difiere de los 2.373 del frame
guardado) ni las etiquetas de facultad, que son seudónimos. **Qué sí
certifica:** que la superficie recibe distribuciones, denominadores, cascada y
anclas reales, y por lo tanto que se puede juzgar como instrumento.

La reparación de fondo —que `pulso_anonimizar.R` reescriba a la vez base,
config de criterios y catálogo, o se niegue a anonimizar una dimensión que otra
tabla referencia por slug— **es del loop v2** y ya está anotada allí.

### Hallazgo caído del paso 0: los criterios viven en dos sitios

Sembrar el instrumento destapó un defecto que no se buscaba. Los criterios de
selección están persistidos **por duplicado**:

- `calc_muestra_aulas_config.criterios_seleccion` (config de sesión, la que
  consume el motor R), y
- `calc_muestra_estudio.workspace.aulas_config.criterios_seleccion` (copia del
  workspace, la que consume la UI para juzgar frescura).

Al corregir solo la primera, la superficie quedó **permanentemente** en «Los
criterios cambiaron — el marco vigente ya no los refleja» contra un marco
construido por el motor con esa misma config. Y en el proyecto original ese
mismo aviso estaba **enmascarado**: el ternario de estado
([CursosHorarioMarcoTab.tsx:322](../../frontend/src/features/calcMuestra/universidad/marco/CursosHorarioMarcoTab.tsx#L322))
evalúa `criteriosRadiografiaF1Pendiente` antes que `marcoDesactualizado`, así
que la falta de radiografía tapaba la discrepancia de criterios.

Dos consecuencias, ninguna cosmética: **una decisión con dos dueños puede
divergir en silencio**, y **un mensaje de estado que enmascara a otro esconde
exactamente el que importa**. Va a la cola como S1c y se coordina con el v2 si
el dueño único tiene que definirse en el backend.

Observación menor del mismo camino: el slug de «ARTE Y DISEÑO» es
`arte_y_dise_no` — la ñ introduce un separador espurio en `.cm_aulas_text_key`.
Hoy es inocuo porque ambos lados slugifican igual, pero cualquier comparación
contra un slug escrito a mano fallará.

Direcciones canónicas de este loop:

```
calc-muestra/opinion-universitaria/marco/marco-criterios-alumno
calc-muestra/opinion-universitaria/marco/marco-ch-radiografia
calc-muestra/opinion-universitaria/marco/marco-alumnos-ch
calc-muestra/opinion-universitaria/calculo/calculo-distribucion
calc-muestra/opinion-universitaria/aulas/*
```

Viewports de juicio: **1440×1000** y **1024×600**.

## Ledger

**Baseline definitivo: medido sobre el instrumento**, no sobre pantallas
vacías. `hsvg2026-seed-radiografia.pulso`, Marco → «Criterios del estudiante» y
«Cursos-horario: criterios + radiografía», 1440×1000, panel `cmv2-tab-panel`.
Las cifras de la primera pasada (26 % de prosa, 4,6 pantallas) medían la
pestaña **sin radiografía**; con dato real el tamaño del problema es otro y
esas quedan como histórico, no como línea base.

| Métrica sobre el instrumento | Apertura | Hoy | Dirección |
|---|---:|---:|---|
| Alto del panel de Criterios del estudiante en 1440×1000 (645 px visibles) | **30.406 px = 47 pantallas** | **7.434 px = 11,5 pantallas** | ≤ 2 pantallas con la decisión a la vista |
| Segmentos sin CH que ocupan el mismo espacio que uno con distribución | **68** | **0** (se declaran en una línea) | 0 |
| Párrafos de prosa ≥ 60 car. · palabras · repetidos | **22 · 234 · 18 copias del mismo aviso** | **5 · ~70 · 0 repetidos** | 0 repetidos |
| Leyendas de gráfico repetidas | **1 por figura (43)** | **0 por figura · 1 por bloque** | 1 por bloque |
| Boxplots comparables entre sí (escala compartida) | **0 de 43**; todas las cajas del mismo ancho | **43 de 43**; 32 anchos distintos medidos en pantalla | todos |
| Controles distintos para enfocar el mismo criterio | **2** (`<select>` + fila de chips, contiguos) | **1** (la tira, con el estado en el chip) | 1 |
| Pasos de la tarjeta que abren con procedencia en vez de dato | **1 de 6** (`Dato`: hash, owner, grano, unidad, capa) | **0 de 5**; la tarjeta abre en Distribución | 0 |

Hallazgos nuevos que solo aparecen con dato:

- **El paso «Dato» muestra la procedencia, no el dato.** Lo primero que se lee
  de cada criterio es `Marco aa0ff9e1…`, `Momento marco_ejecutado`, `Gate
  formation`, `Owner calc_muestra_aulas_construir_v1.filas_alumno`, `Grano
  alumno_x_curso_horario_x_facultad`, `Unidad alumno_unico_por_curso_horario`,
  `Capa marco`. Son los internos del contrato R renderizados como contenido
  principal.
- **Las tarjetas vacías ocupan el mismo espacio que las llenas.** En Modalidad
  de una facultad, 3 de 4 categorías dicen «Sin distribución percentilar
  publicable» con NA en los seis estadísticos y se llevan el 75 % del ancho; la
  única con datos (639 CH) recibe el 25 %.
- **Dos cifras para la misma categoría en la misma pantalla:** la tarjeta dice
  `CH 639 · Contraste total: 849 CH` y el conmutador de abajo dice
  `PRESENCIAL — 849 CH`. Sin rótulo que distinga elegibles de total.
- **Vocabulario normalizado a mayúsculas en la UI**, lo que esconde que la
  fuente mezcla («Presencial»/«VIRTUAL» en el catálogo) y que `VIRTUAL` y
  `A DISTANCIA` son probablemente el mismo concepto — ambos con 0 CH.

Baseline histórico (pestaña sin radiografía, 2026-08-02):

| Métrica | Apertura (2026-08-02) | Hoy | Dirección |
|---|---:|---:|---|
| Avisos consecutivos que dicen lo mismo antes del primer dato | **3** (banner amarillo + tarjeta de recuperación + vacío de la matriz) | 3 | 1 |
| Proporción de palabras que son prosa explicativa en la pestaña | **26 %** (253 de 965 palabras, en 8 párrafos ≥ 80 caracteres) | 26 % | ≤ 10 % |
| Posición del resultado (matriz marginal) en el recorrido | **3.º de 7 bloques**, antes de toda decisión | 3.º | último |
| Zonas distintas donde se enfoca y se decide un criterio | **3** (editores globales · consola con selector propio · bloques por facultad) | 3 | 1 |
| Alto del panel de Criterios en 1440×1000 | **2.969 px sobre 645 px visibles = 4,6 pantallas** | 4,6 | ≤ 2 con la decisión completa a la vista |
| Boxplots comparables entre sí (escala compartida + eje) | **0**; cada caja se normaliza contra su propio P10–P90, sin eje ni escala | 0 | todos |
| Leyendas de gráfico repetidas | **1 por gráfico** (≈ 260 repeticiones con payload completo) | 1 por gráfico | 1 por bloque |
| Capacidades dinámicas publicadas por R y ausentes en pantalla | **3** (delta contrafactual en hover, orden de recorte interrogable, cascada al enfocar) | 3 | 0 |
| Conceptos distintos que comparten rótulo en pantalla | **1** («Facultad» = facultad del alumno y facultad efectiva del curso) | 1 | 0 |
| Dimensiones publicadas con dos representaciones en el mismo proyecto | **1** (facultad: en claro en `criterios_catalogo`, anonimizada en Cobertura y radiografía) | 1 | 0 |
| Etiquetas de categoría que esconden varias categorías | **2** (`session_type` TEORICO(…) con 3; `condition` INGRESO(…) con 7) | 2 | 0 declaradas sin rotular |
| Variables con dos taxonomías o dos vocabularios mezclados | **2** (`condicion_curso` condición + área; `modality` con «VIRTUAL» fuera de vocabulario) | 2 | 0 |
| Superficies del módulo pasadas por la vara | **0 de 23** | **3 de 23** (`marco-criterios-alumno`, `marco-ch-radiografia`, `marco-alumnos-ch`) | 23 de 23 |
| Resultados que abren o esconden el recorrido en vez de cerrarlo | **1** (matriz plegada a 36 px y desaconsejada) | **0** (cierre nombrado con su tamaño) | 0 |
| Encabezados que publican la clave técnica del gate | **9** (`MODALITY …`, tres empezando por `COMPOSITION`) | **0** (la clave vive en el `title`) | 0 |
| Lotes de la cola cerrados | **0 de 13** + 5 transversales | **4 de 13** (S1–S4) + T1 aplicado y **T6 cerrada** | 13 + 6 |
| Elementos con desborde o ancho 0 a 1024×600 en Criterios | **1.006 / 987** | **0 / 0** | 0 |
| Controles que deciden contra el conteo del catálogo en vez del aporte al marco | **31** (todas las categorías planas) | **0**; cada una publica elegibles y CH del marco | 0 |
| Gráficos comparables fuera de la radiografía de criterios | **0** | **16** tiras en Alumnos por CH sobre escala común con Total de referencia | todos |
| Columnas que producen la decisión y no caben en el viewport | **1** («Valor elegido», tabla 1.331 px en 1.268 px) | **0** (tabla 1.268 px = contenedor) | 0 |
| Unidades del loop sin commitear | **5** (F1–F5 en el árbol) | **0** (`73c60e08`, `80cb6391`) | 0 |
| Estado sembrado con radiografía real, declarado y reproducible | **no existe** | no existe | existe y está documentado aquí |
| Hallazgos de superficie abiertos | 9 | 9 | = 0 |

## Cola de lotes — las 23 superficies del módulo

El loop v2 construyó dato y contrato para las cinco secciones del escritorio
universitario. Este loop las pasa **todas** por la vara, sin dejar ninguna
fuera. Una iteración = una fila. El orden es por dependencia, no por gusto: se
empieza por donde se decide y se termina por donde se entrega.

### Bloque A — Marco (donde se decide)

| # | Lote | Superficies | Qué entrega | Estado |
|---|---|---|---|---|
| **S1** | Criterios es una sola superficie de decisión | `marco-criterios-alumno` · `marco-ch-radiografia` | Instrumento sembrado · el dato abre la tarjeta · un solo control de enfoque · pasos recorribles · gráficos comparables · vacíos que no ocupan espacio | **activa** — lotes 1 y 2 cerrados (47 → 11,5 pantallas); falta la fusión decidir↔ver y la poda de prosa |
| **S2** | Alumnos por CH decide con la distribución delante | `marco-alumnos-ch` | El estadístico (media/mediana/P25) se elige **viendo** la distribución de la que sale, por facultad, sobre la escala compartida de S1; el vacío contiene su propio hueco (hoy ~60 % del viewport en blanco) | en cola |
| **S3** | La matriz embudo cierra el recorrido | matriz marginal + `CriteriosEmbudoVivo` | El resultado va al final (S2 del mandato) y se lee como cierre: qué recortó cada criterio, en qué orden, cuánto queda. Hoy el enlace transversal mide 36 px al pie y nadie lo abre | en cola |
| **S4** | Marco responde a lo que decido | los tres hogares de Marco | Cascada al enfocar, hover-delta contrafactual y orden de recorte interrogable — **el contrato R ya publica los tres** y ninguno llega a la pantalla | en cola |
| **S5** | Población, Cursos-horario y Cobertura por la vara | `marco-poblacion` · `marco-aulas` · `marco-cobertura` | Barrido de prosa y de denominadores: Cobertura publica hoy «13.498 / 38.749» bajo «Alumnos por facultad» con la cabecera en 21.365/29.090 — tres denominadores para «alumnos» en una pantalla | en cola |

### Bloque B — Cálculo (donde se dimensiona)

| # | Lote | Superficies | Qué entrega | Estado |
|---|---|---|---|---|
| **S6** | Diseño y Propuestas se entienden solos | `calculo-diseno` · `calculo-propuestas` | La fórmula y sus parámetros como decisión legible, no como ficha; cuotas por facultad comparables entre sí | en cola |
| **S7** | CH requeridos y Distribución densifican sin ruido | `calculo-ch-facultad` · `calculo-distribucion` | I19 dejó el dato R-owned (precisión, sensibilidad OFAT); la superficie debe leerse sin memorizar. Pendiente medido de I19: scroll anidado manual en CH y geometría no declarada en Distribución | en cola |
| **S8** | El comparador P1↔P2 se retoma o se retira | `CalculoComparacionEscenarios` | I20 quedó **vetado y sin commitear** en el árbol. Se rehace sobre el contrato R sin aritmética recreada en React, o se retira con su porqué escrito. No se deja a medias | en cola |

### Bloque C — Selección (donde se sortea)

| # | Lote | Superficies | Qué entrega | Estado |
|---|---|---|---|---|
| **S9** | Objetivo y Método cuentan una historia | `objetivo` · `metodo` | I17 invirtió la jerarquía y narró los métodos; falta pasarlos por S3 (prosa) y S4 (los gráficos comparan) | en cola |
| **S10** | Simulación y Selección se leen a escala | `laboratorio` · `seleccion` | El mapa de la muestra existe (175 titulares virtualizados); falta que la simulación y el mapa compartan escala y lectura | en cola |
| **S11** | Reemplazos y Sustento defienden | `reemplazos` · `auditoria` | Profundidad de reserva de un vistazo; el sustento como defensa legible, no como volcado de campos | en cola |

### Bloque D — Datos y Entrega (donde entra y sale)

| # | Lote | Superficies | Qué entrega | Estado |
|---|---|---|---|---|
| **S12** | Datos por la vara | `def-estudio` · `def-bases` (Fuentes + Consistencia) · `def-variables` | Incluye ejecutar **D10**: Consistencia como pestaña propia inmediatamente después de Fuentes, con aliases y regresiones | en cola |
| **S13** | Entrega por la vara | `salidas-guia` · `salidas-resultados` · `salidas-entregables` · `salidas-monitoreo` | La ficha de cierre como resumen defendible; el pase a Monitoreo sin prosa que narre el botón | en cola |

### Transversales (se intercalan en el lote que abra la superficie)

| # | Lote | Mandato | Estado |
|---|---|---|---|
| **T1** | Una categoría es una sola cosa | S7 | **inmediata** — dos «Facultad» bajo la misma palabra, etiquetas que esconden varias categorías, vocabularios mezclados y la doble representación anonimizada/en claro |
| **T2** | Los gráficos comparan, en todo el módulo | S4 | parcial — hecho en la radiografía de criterios; falta el barrido de `marcoCharts`, Distribución, Simulación y el mapa |
| **T3** | Cero prosa que no sea dato, en todo el módulo | S3 | **abierta** — 31 % en Criterios del estudiante; las reglas metodológicas compartidas se dicen una vez, no una por tarjeta |
| **T4** | Instrumento y fixture honestos | invariante | El anonimizador debe reescribir base, config de criterios y catálogo a la vez, o negarse. Bloquea acreditar «por facultad» y el ancla histórica |
| **T6** | La radiografía embebida es responsiva | S1/C4 | **cerrada en F9** — causa real: el bloque de señal conservó `display: flex` al pasar a `<details>` y colapsaba su rejilla a 0 px. 1.006 → 0 desbordes |
| **T5** | Lo que la evidencia pida | — | abierto |

**La cola es el orden de trabajo, no el final del loop.** Ver «Numeración e
indefinición» en la mecánica: las iteraciones son `F1`, `F2`, `F3`… sin número
previsto, y al vaciar S13 se reaudita desde S1 con la vara más alta. Solo
Gonzalo cierra.

**Estado de la cola al 2026-08-02:** `F1`–`F5` cerraron **S1** (commit
`73c60e08`); `F6` cerró **S2** (commit `80cb6391`). T1 queda aplicado en
Criterios y sigue abierto para el resto del módulo.

Siguiente iteración **`F10` (S5)**: Población, Cursos-horario y Cobertura por la
vara. Medido en la apertura: Cobertura publica «13.498 / 38.749» bajo «Alumnos
por facultad» con la cabecera en 21.365/29.090 — tres denominadores para
«alumnos» en una sola pantalla.

## Mecánica de cada iteración

Una iteración = **un lote entregable**: una superficie completa o un barrido de
defectos afines en todo el módulo. Nunca un defecto suelto.

**Numeración e indefinición (Gonzalo, 2026-08-02).** Las iteraciones se numeran
`F1`, `F2`, `F3`… de forma **indefinida**: no hay un número previsto de
iteraciones ni una fecha de cierre. La cola de 13 lotes + 5 transversales es el
orden de trabajo, **no el final del loop**. Cada iteración:

1. toma la primera fila desbloqueada de la cola (o intercala un transversal si
   abre esa superficie);
2. audita, contrata, implementa, deja guard y pasa su gate;
3. escribe su fila en el registro de abajo y mueve al menos una fila del ledger
   estrictamente a mejor;
4. **decide en su última acción si el loop continúa**, y lo dice.

**Cómo termina este loop: solo cuando Gonzalo lo dice.** Ni el gate verde, ni la
cola vacía, ni una iteración sin hallazgos lo cierran. Al vaciar S13 se vuelve a
auditar desde S1 con la vara más alta — porque la vara sube a medida que la
superficie mejora, y lo que hoy pasa por aceptable dejará de pasarlo. Las tres
únicas cosas que interrumpen una iteración son: un gate rojo (detiene el
**cierre**, no el loop), una decisión que solo Gonzalo puede tomar (va a la
bandeja y el loop sigue con lo desbloqueado), y que Gonzalo diga «para».

1. **Auditar es el paso 1, no una iteración.** `/ver-ui` sobre la dirección
   canónica con el estado sembrado, hallazgos con `archivo:línea` y **una
   medición por hallazgo**. «Se ve mal» no es un hallazgo; «cada boxplot se
   normaliza contra su propio rango, 0 comparables» sí lo es.
2. **Contrato proporcional.** Superficie: 10–15 líneas. Si toca contrato R,
   contrato largo y se coordina con el loop v2.
3. **Peaje estructural de entrada.** Lo tocado de un archivo grande se extrae
   antes; componente nuevo en archivo nuevo.
4. **Dejar guard.** Un test que falle solo cuando vuelva el defecto:
   `data-qa-geometry-group`, contrato de payload, o una aserción de superficie.
   Un barrido de prosa deja su propia medición automatizable.
5. **Gate proporcional.** Typecheck + Vitest del feature + `/ver-ui` en los dos
   viewports. Si tocó dato, los `test-calc_muestra*` afectados. Verificar de
   más también es deuda.
6. **Registrar aquí.** Ledger y registro de iteraciones. El estado vive en este
   doc.

## Bandeja de decisiones (solo Gonzalo)

Vacía al abrir.

## Registro de iteraciones

### Scope lock S1 — «Criterios es una sola superficie de decisión»

- **Categoría:** superficie F1/F3 con dependencia de instrumento. Mandan S1, S2
  y S3.
- **Módulo y direcciones:** Cálculo de muestra > Universidad > Marco, en los dos
  hogares de criterios (`marco-criterios-alumno` y `marco-ch-radiografia`).
- **Divergencias medidas (2026-08-02):**
  - Tres avisos consecutivos con el mismo mensaje abren la pantalla: banner
    amarillo, tarjeta «RADIOGRAFÍA POR FACULTAD PENDIENTE» con tres líneas de
    prosa, y el vacío de la matriz que lo repite por tercera vez.
  - «Matriz marginal por facultad» ocupa el bloque 3 de 7, antes de que se haya
    decidido un solo criterio.
  - El criterio se enfoca en la consola (`CriteriosRadiografiaConsola.tsx`, su
    propio `<select>`), se decide en los editores globales y se ajusta otra vez
    en el bloque por facultad: tres zonas para un acto.
  - 253 de 965 palabras (26 %) son prosa explicativa; el panel mide 2.969 px
    con 645 px visibles.
- **Capacidad de salida:** enfocar un criterio *es* verlo. Cada criterio se
  decide con su radiografía por facultad en la misma superficie y en el mismo
  momento; la matriz cierra el recorrido; los avisos se dicen una vez.
- **Instrumento (paso 0, no negociable):** conseguir y **declarar aquí** un
  `.pulso` sembrado con `criterios_radiografia` real, con su procedencia y sus
  límites. Si el motor lo impide, se anota el bloqueo en el loop v2 y se siembra
  igual: el loop no se detiene.
- **Owners previstos:** `CriteriosRadiografiaConsola.tsx`,
  `CriteriosRadiografiaCardDetalle.tsx`, `CriteriosMarcoTab.tsx`,
  `CursosHorarioMarcoTab.tsx`, `MatrizEmbudoCriterios.tsx` y sus CSS. Todo
  bloque extraíble nace en archivo nuevo.
- **A preservar:** los contratos R de I16/I18b (React valida y presenta, no
  calcula), la navegación canónica, el trabajo sin commitear de la otra sesión,
  el `.pulso` original y los puertos del usuario.
- **Fuera:** rehacer los gráficos (va en S2), tocar el motor, el comparador I20
  y la mudanza D10.
- **Riesgo principal:** confundir «menos texto» con «menos información», o
  fusionar zonas perdiendo la decisión por facultad que sí funciona.
- **Gate:** typecheck, Vitest del feature, `/ver-ui` en 1440×1000 y 1024×600
  sobre el estado sembrado, y las cinco filas del ledger de esta iteración
  medidas antes y después.
- **Stopping rule:** una sola zona de decisión por criterio con su radiografía
  por facultad dentro; matriz al final; un aviso por mensaje; prosa ≤ 10 %;
  panel ≤ 2 pantallas con la decisión completa a la vista; gate verde; ledger y
  registro actualizados; commit atómico.

### F1 — Instrumento y el dato al frente (S1, 2026-08-02)

| Qué se hizo | Evidencia | Ledger movido |
|---|---|---|
| **Instrumento.** Diagnóstico headless criterio a criterio localizó la causa del marco en cero (`faculty` 0/136.284 por la contradicción del anonimizador) y se sembró `hsvg2026-seed-radiografia.pulso` con radiografía, totales, cascada, alumnos/CH y anclas. Se le incorporó el Excel de control 2025 («Base de control») para verificar la asistencia histórica. | `eligible_student_rows = 106.013` reproduce el frame guardado. Cadena τ: 0,698 · 0,753 · 0,893 → producto 0,470 con IC bootstrap y k=190; identidad `A = E + no_respondieron` verificada en 142 filas, 0 inconsistencias. | instrumento: no existe → **existe y declarado** |
| **El paso «Dato» deja de abrir cada criterio.** No traía dato sino procedencia (hash, owner, grano, unidad, capa): baja entera y plegada a «Procedencia y contrato» al pie. Cinco pasos en vez de seis. | Guard: el test exige `Acción < Procedencia y contrato` y 5 `cmv2-crc-step`. | pasos que abren con procedencia 1/6 → **0/5** |
| **Un solo control para enfocar un criterio.** Retirado el `<select>` que duplicaba la tira; el estado de la evidencia pasa al chip. Cabecera sin la narración del layout. | Guard: `not.toContain("<select")` + `aria-label="Enfocar criterio"`. Medido en pantalla: `selects: 0`. | controles 2 → **1** |
| **Los boxplots comparan.** Dominio compartido por bloque (`boxplotDomain`), riel del dominio visible y leyenda emitida una vez por bloque en vez de una por figura. La señal usa su propio dominio por ser otra unidad. | Guard nuevo: con dominio compartido la caja estrecha mide < 1/10 de la ancha; sin dominio ambas salían idénticas. Medido en pantalla: 43 figuras, **0 figcaption**, 1 leyenda, **32 anchos distintos**. | leyendas 43 → **1**; comparables 0/43 → **43/43** |

### F2 — Las 47 pantallas (S1, 2026-08-02)

**Medir antes de tocar evitó el arreglo equivocado.** La hipótesis era que el
bulto estaba en la grilla de distribución. Medido por bloque, era falso:

| paso | alto apilado |
|---|---:|
| Cascada viva | 7.284 px |
| Distribución | 5.672 px |
| Impacto marginal | 4.756 px |
| Acción | 3.379 px |
| Ancla histórica | 2.153 px |

Ningún bloque dominaba: **los cinco publican cada uno las mismas 19 facultades
del criterio**, y apilados suman 23.244 px. El defecto no era la densidad de un
bloque sino que el recorrido metodológico se hubiera resuelto como pila.

- **Los cinco pasos se recorren, no se apilan.** Riel numerado
  (`1 Distribución … 5 Acción`) que conserva el orden metodológico a la vista;
  solo el paso activo ocupa layout. Los cinco siguen en el DOM con `hidden`, de
  modo que el contrato completo se mantiene verificable. La tarjeta abre en
  Distribución — el dato.
- **Los segmentos sin CH se declaran en una línea.** 68 categorías con 0 CH
  ocupaban el mismo ancho que las que tienen distribución; ahora dicen «0 CH en
  esta facultad» y ceden el espacio, sin desaparecer del inventario.
- **Media, P50 y el rango P10–P90 se leen de un vistazo**; los cinco cuantiles
  quedan completos tras «Cuantiles completos».
- **Se revirtió** el plegado del contraste total: no bajaba la altura (van en
  columnas) y escondía la comparación elegibles/total que D2 pide visible.
  Queda escrito para no repetirlo.

**Resultado: 30.406 px → 7.434 px. De 47 pantallas a 11,5.**

Gate de los dos lotes: typecheck 0 errores · Vitest `calcMuestra` **792/792**
(incluye el guard nuevo de escala compartida y el del riel de pasos) · dos
viewports (1440×1000 y 1024×600) sin scroll horizontal ni desbordes.

### F3 — El aviso que se decía dieciocho veces (S1/T3, 2026-08-02)

**Corrección de una cifra propia.** El «31 % de prosa» registrado en F1 estaba
mal medido: el selector contaba como prosa las tablas de la cascada (cada `<li>`
con su tabla supera los 80 caracteres). Medido solo sobre `<p>` sin tablas
dentro, la pestaña tenía **22 párrafos largos y 234 palabras** — mucho menos de
lo registrado. Pero escondía un defecto peor que el volumen.

**El defecto real: 18 de esos 22 párrafos eran el mismo.** «El criterio no
comparte una caracteristica compatible con la referencia», una vez por facultad,
más nueve filas de metadatos por facultad con `NA` en todas las que importan. El
hecho es **uno solo del criterio** —la referencia histórica agrega por facultad
histórica y el criterio evalúa por facultad del alumno— y estaba repetido
dieciocho veces sin que la causa se leyera ni una.

- Cuando todas las facultades comparten el aviso y ninguna publica `k` ni tasa,
  el bloque lo dice **una vez**, nombra la causa (las dos dimensiones de
  facultad enfrentadas), el periodo, y lista las 18 facultades cubiertas.
  Nada se pierde: la cuenta y los nombres siguen ahí.
- Cuando el aviso es común pero alguna facultad sí publica, el aviso se hoista
  al bloque y las filas conservan solo lo que difiere.
- Guard nuevo: con tres facultades sin publicar, el aviso aparece **una** vez,
  las tres siguen nombradas y «Facultad de referencia» sigue publicada.

**Resultado: el paso Ancla pasa de 2.153 px a 228 px** y por primera vez se lee
*por qué* no hay coincidencia. Gate: typecheck 0 errores · Vitest **793/793**.

### F4 — Decidir y ver son un solo acto (S1, 2026-08-02) · **S1 cerrada**

La consola de radiografía vivía **encima** de la rejilla de tarjetas: se
enfocaba un criterio en una zona y se decidía en otra, con dos selectores
distintos para la misma cosa.

- `useCriteriosRadiografiaInline` resuelve el modelo una vez y entrega, por
  `cardId`, el detalle listo para incrustarse. Cada `CriterioCard` recibe **su**
  radiografía; la consola con selector propio desaparece de la pestaña de
  estudiante y queda solo para el caso de recuperación (frame sin contrato F1).
- Las alertas de contrato, que son del bloque y no de una tarjeta, se conservan
  al nivel del bloque.
- **Corrección medida dentro del lote:** con las cinco radiografías abiertas a
  la vez el panel saltó a **39.073 px**. La evidencia se pliega dentro de su
  tarjeta y se abre sola mientras la variable está en edición — que es
  exactamente cuando se decide.

**Resultado: 1.655 px = 2,6 pantallas**, con los cinco criterios, sus categorías
con conteo y su radiografía al alcance sin cambiar de zona. Gate: typecheck 0
errores · Vitest **793/793**.

**Cierre de S1.** Desde la apertura del loop: **30.406 px → 1.655 px**
(47 → 2,6 pantallas), controles de enfoque 2 → 1, zonas de decisión 3 → 1,
boxplots comparables 0/43 → 43/43, leyendas 43 → 1 por bloque, avisos repetidos
18 → 0, pasos que abren con procedencia 1/6 → 0/5.

### F5 — Una categoría es una sola cosa (T1/S7, 2026-08-02)

La fuente concatena varios valores en una etiqueta y la UI los mostraba crudos,
como si fueran una categoría: quien marcaba `INGRESO(EV.TAL,1OP,CEPR,ITS,PAEE,
BACH,EX.ING)` marcaba ocho sin saberlo. El tratamiento anterior era un `<wbr>`
tras cada coma — una ayuda de salto de línea, no una declaración.

- Owner nuevo `etiquetaCategoria.ts`: lee la etiqueta y declara lo que ya dice.
  **No toca el dato** — clave, conteo y valor siguen siendo los del motor.
- Distingue la agrupación real (`BASE(a,b,c)` y listas `a,b,c`) del paréntesis
  que es parte del nombre (`POR INCORPORACION (ESC.GRADUADOS Y DIPLOMAS)`), que
  se deja intacto.
- La tarjeta muestra el nombre del grupo, una insignia «agrupa N», la lista
  completa en línea secundaria y en el `title`, y un nombre accesible que dice
  «agrupa N valores» en vez de fingir una categoría.
- El contrato geométrico que exigía los `<wbr>` se sustituyó por el de T1: mismo
  fondo —no perder información— más la exigencia de que la agrupación sea
  legible. Los siete valores siguen verificados en el DOM.

Medido en pantalla: **2 etiquetas agrupadas detectadas** en la pestaña de
estudiante (`INGRESO` agrupa 8, una facultad agrupa 2). Gate: typecheck 0
errores · Vitest **797/797** en 92 archivos.

### F6 — Alumnos por CH decide viendo la distribución (S2/S4, 2026-08-02) · **S2 cerrada**

**Corrección de una medición propia.** El «~60 % del viewport en blanco»
registrado en la apertura medía la pestaña **sin instrumento**. Con dato real la
superficie está llena: 18 filas, 2,2 pantallas. El defecto era otro y solo se
ve con datos.

Auditoría con el instrumento, una medición por hallazgo:

| hallazgo | medición |
|---|---|
| Se elige el estadístico **sin ver de qué distribución sale** | **0 gráficos** en la superficie; 18 facultades × 3 estadísticos en columnas de números |
| La columna que produce la decisión no cabe en pantalla | tabla 1.331 px en contenedor de 1.268 px a 1440×1000: «Valor elegido» queda fuera |
| Intro que parafrasea lo que la tabla ya rotula | 2 líneas sobre «cifra principal / contraste», rotulados en las propias columnas |

- Owner nuevo `AlumnosPorChTira.tsx`: tira comparable por facultad con P25,
  mediana y media sobre **dominio compartido por toda la tabla**, con el P50 del
  Total como línea de referencia en cada fila. Presenta, no calcula: los tres
  valores vienen publicados por R.
- Las tres columnas numéricas se funden en una: la tabla pasa de **8 a 6
  columnas** y deja de desbordar — «Valor elegido» entra en el viewport. Las
  cifras siguen literales bajo la tira: comparar no puede costar precisión.
- La escala se declara **una vez** para el bloque, nunca por fila.
- La intro se reduce a la frase que sí dice algo: «El estadístico se elige
  viendo la distribución de la que sale».

Medido tras el cambio: **16 tiras · 1 leyenda · 6 columnas · desborde
horizontal 0** (tabla 1.268 px = contenedor), panel 1.554 px = 2,4 pantallas.
Guard nuevo: la escala aparece una sola vez y cada fila publica sus marcas
`p25`/`p50`/`media` más la referencia del Total. Gate: typecheck 0 errores ·
Vitest **798/798** · 1440×1000 y 1024×600 sin scroll horizontal ni desbordes.

### F7 — La matriz cierra el recorrido (S3, 2026-08-02) · **S3 cerrada**

Auditoría con el instrumento, una medición por hallazgo:

| hallazgo | medición |
|---|---|
| El resultado está plegado **y desaconsejado** | `<details>` de 36 px al pie cuyo cuerpo decía «Abre esta comparación **solo cuando** necesites contrastar facultades» |
| El resumen no dice qué cierra | el renglón visible explicaba cuándo abrirla, no qué contiene |
| Los encabezados publican la clave del gate | `MODALITY Modalidad`, `SESSION_TYPE Tipo de sesión`; **tres columnas empiezan igual** (`COMPOSITION …`) y lo que las distingue quedaba cortado |

- El bloque pasa a ser el **cierre nombrado** del recorrido: «Cierre del
  recorrido · impacto de cada criterio por facultad», con su tamaño real
  (**9 criterios × 17 facultades sobre el marco ejecutado**) en el propio
  resumen. Sigue plegado —abrirlo suma 1.664 px— pero ya no hay que abrirlo
  para saber qué es.
- Se retira la frase que desaconsejaba abrirlo: era prosa sobre la afordancia,
  y encima empujaba a no leer el resultado que comprueba todas las decisiones.
- Los encabezados nombran el criterio; la clave del gate baja al `title`, donde
  sigue disponible para trazar. Las tres columnas de composición ahora se
  distinguen por lo que difiere: *prevalencia elegible*, *facultad del curso*,
  *nivel del curso*.
- Guard: el test de la superficie exige el rótulo de cierre, prohíbe la frase
  desaconsejante y sigue exigiendo que la matriz vaya **después** de la decisión
  por facultad.

Gate: typecheck 0 errores · Vitest **798/798** · 1440×1000 y 1024×600 sin
scroll horizontal ni desbordes.

### F8 — El control decide contra el número correcto (S4/S5, 2026-08-02) · **S4 cerrada**

**La auditoría cambió el lote.** S4 pedía «hover-delta contrafactual». Medido, la
cascada al enfocar y el orden de recorte **ya llegaban** a la pantalla
(`CriteriosEmbudoVivo` con su coordinador de preview). Lo que faltaba era peor
que una animación:

| hallazgo | medición |
|---|---|
| El conmutador que decide muestra el conteo del **catálogo**, anterior a todo criterio | PREGRADO marca «25.155 estudiantes»; R publica **20.879 alumnos únicos elegibles** y 2.799 CH para ese mismo segmento |
| Una categoría con aporte nulo se ve igual que una que aporta todo | MAESTRIA marca «2.819 estudiantes» con aporte real **0 elegibles · 0 CH** |

- Cada conmutador publica ahora, junto al conteo del catálogo —rotulado **«en la
  base»**—, lo que esa categoría **aporta al marco ejecutado**: alumnos únicos
  elegibles y CH, en color de acento, y atenuado cuando el aporte es cero.
- El dato sale de la fila **Total que R recalcula por segmento**
  (`criterios_totales`): React no suma facultades, que es justo lo que el
  contrato prohíbe.
- Guard: con aporte publicado la superficie muestra ambas cifras y marca
  `data-aporta="cero"`; **sin** aporte no inventa nada.
- **Regresión reparada dentro del lote:** el rótulo más largo («… en la base»)
  dejó de caber en la columna `auto` del ítem y la etiqueta se solapaba con la
  cifra. Ambas cifras bajan a su propia fila, alineadas entre sí — que además es
  como se comparan. Solapes medidos después: **0**.

Gate: typecheck 0 errores · Vitest **799/799** · 1440×1000 limpio.

**Encolado con su medición (regla 4, no se detiene por alcance):** a **1024×600**
la radiografía embebida en la tarjeta (efecto de F4) deja **1.006 elementos con
desborde** — sus rejillas internas (`cmv2-crc-faculties` con `minmax(310px, 1fr)`,
`snapshot-pair` a dos columnas) asumen el ancho de la consola vieja y colapsan
columnas a 0 px dentro de la tarjeta. El `min-width: 160px` del boxplot ya se
retiró (122 desbordes menos) y las rejillas de cuantiles pasaron a `auto-fit`.
Lo que queda es un lote propio: **T6 · la radiografía embebida es responsiva**.

### F9 — La radiografía embebida es responsiva (T6, 2026-08-02) · **T6 cerrada**

**El diagnóstico correcto era uno solo, no siete rejillas.** La hipótesis de F8
era que las rejillas internas —`faculties` con `minmax(310px, 1fr)`,
`snapshot-pair` a dos columnas fijas— no cabían en la tarjeta. Se pasaron todas
al patrón `minmax(min(N, 100%), 1fr)` y **los 1.006 desbordes no se movieron**.

Rastreando la cadena de un elemento con ancho 0 apareció la causa real: el
bloque de **señal** pasó de `<div>` a `<details>` en F2 y conservó el
`display: flex` de la fila que era antes. Su rejilla de cuantiles quedaba como
ítem flex sin ancho intrínseco y **colapsaba a 0 px**, arrastrando a sus 987
descendientes. Una línea de CSS.

| medición | antes | después |
|---|---:|---:|
| Elementos con desborde a 1024×600 | **1.006** | **0** |
| Elementos visibles con ancho 0 | **987** | **0** |
| Desbordes a 1440×1000 | 0 | 0 |

El paso al patrón `min()` se conserva: no era la causa, pero sí la protección
para que la tarjeta pueda estrecharse sin volver a romperse.

Gate: typecheck 0 errores · Vitest **799/799** · los dos viewports limpios.

Siguiente: **F10 (S5)** — Población, Cursos-horario y Cobertura por la vara.
Medido en la apertura: Cobertura publica «13.498 / 38.749» bajo el rótulo
«Alumnos por facultad» mientras la cabecera marca 21.365 sobre 29.090 — tres
denominadores para «alumnos» en una pantalla.

## Lo hecho sin commitear también se afina (añadido 2026-08-02)

El alcance de este loop es **todo lo entregado hasta hoy, esté o no
commiteado**. Reglas:

1. **Inventario vivo**: antes de cada visita, `git status` + `git log -3`
   dicen qué unidades viven sin commitear y de qué sesión vienen. Hoy: el
   trabajo de superficie F1–F3 (criterios/radiografía y sus CSS), el comparador
   I20 vetado (S8: se rehace sobre el contrato R o se retira con su porqué) y
   los ajustes del catálogo visual.
2. **El árbol no acumula más de una unidad** (gate 2 de la casa): al cerrar
   cada iteración F, su unidad se commitea con `/cerrar-trabajo`. Afinar sobre
   trabajo ajeno sin commitear exige verificar primero que ninguna otra sesión
   lo esté tocando (trampa medida de sesiones concurrentes).
3. **Un veto no deja huérfanos**: código vetado (como I20) no se queda
   indefinidamente en el árbol — o entra a la cola con lote propio y se rehace,
   o se retira con su justificación escrita. Nunca «a medias sin dueño».

## Cómo se corre cada visita

```bash
make dev-status
```

- Abrir por deep link: `?pulso=<ruta absoluta>` + dirección canónica; esperar
  `window.__pulsoNav.listo()`. El `?pulso=` se consume una sola vez.
- Navegar por dirección: `window.__pulsoNav.ir("calc-muestra/opinion-universitaria/marco/marco-ch-radiografia")`.
- Reusar servers antes de levantar; cerrar solo lo propio; el 8787/8799 del
  usuario no se mata.
- Trampa medida: un backend R vivo **no toma cambios de R**; comparar el
  arranque del proceso con el `mtime` de `api/R/*.R` antes de juzgar un motor.
- Trampa medida: Vitest da falsos rojos con el dev server encendido.
