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
| Superficies del módulo pasadas por la vara | **0 de 23** | **24 de 24**, reauditadas con la vara del grano | 24 de 24 |
| Facultades cuyos criterios de CH se ven a la vez | **1 de 17** (acordeón, 1.962 px cada una) | **17 de 17** en 775 px, escala común | todas |
| Resultados que abren o esconden el recorrido en vez de cerrarlo | **1** (matriz plegada a 36 px y desaconsejada) | **0** (cierre nombrado con su tamaño) | 0 |
| Encabezados que publican la clave técnica del gate | **9** (`MODALITY …`, tres empezando por `COMPOSITION`) | **0** (la clave vive en el `title`) | 0 |
| Lotes de la cola cerrados | **0 de 13** + 5 transversales | **12 de 13** (S1–S7, S9–S13) + T1, **T6, T7**, T4 desbloqueada, **D10 ejecutada** | 13 + 7 |
| Superficies bloqueadas por no poder ejecutar el cálculo | **7** | **0**; el cálculo publica resultado completo | 0 |
| Facultades que impiden cuadrar componentes y contrato | **15 sobrantes + 17 faltantes** | **0** | 0 |
| Controles bloqueados que no nombran la pieza que falta | **1** (Confirmar decisión, en silencio) | **0** | 0 |
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
| **T4** | Instrumento y fixture honestos | invariante | **desbloqueado en el instrumento (F15)**: los estratos se reconstruyen desde el marco sembrado y suman 21.362, la cifra de la cabecera. La reparación de fondo del anonimizador sigue siendo del loop v2 |
| **T6** | La radiografía embebida es responsiva | S1/C4 | **cerrada en F9** — causa real: el bloque de señal conservó `display: flex` al pasar a `<details>` y colapsaba su rejilla a 0 px. 1.006 → 0 desbordes |
| **T7** | «Confirmar decisión» de Alumnos por CH persiste | invariante | **cerrada en F14** — un método guardado vacío deshabilitaba en silencio el botón que reparaba el estado; y dos facultades con 0 CH bloqueaban el gate. La decisión ya persiste con su schema |
| **T5** | Lo que la evidencia pida | — | abierto |

**La cola es el orden de trabajo, no el final del loop.** Ver «Numeración e
indefinición» en la mecánica: las iteraciones son `F1`, `F2`, `F3`… sin número
previsto, y al vaciar S13 se reaudita desde S1 con la vara más alta. Solo
Gonzalo cierra.

**Estado de la cola al 2026-08-02:** `F1`–`F5` cerraron **S1** (commit
`73c60e08`); `F6` cerró **S2** (commit `80cb6391`). T1 queda aplicado en
Criterios y sigue abierto para el resto del módulo.

**Bloque A (Marco) completo**: S1–S5 cerradas, seis superficies por la vara.
**S6 quedó parcial**: Diseño afinado; Propuestas bloqueada por un defecto de
contrato que va al loop v2 (la decisión de Alumnos por CH se persiste con
`schema` y `frame_hash` vacíos y el cálculo la rechaza siempre).

Siguiente iteración **`F14`**: **T7 — «Confirmar decisión» persiste**. Es el
eslabón que gatea siete superficies del plan (Propuestas, Objetivo, CH
requeridos, Distribución, Selección, Reemplazos y Entrega); mientras no
persista, esas superficies no se pueden auditar con dato y encolarlas una por
una solo repetiría el mismo muro.

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

### F10 — Población, Cursos-horario y Cobertura (S5, 2026-08-02) · **S5 cerrada**

**Dos correcciones de mediciones propias, ambas de la apertura.**

1. **El hallazgo estrella de S5 no reproduce.** La apertura registró «tres
   denominadores para *alumnos* en una pantalla»: Cobertura con
   «13.498 / 38.749» contra una cabecera de 21.365/29.090. Sobre el
   **instrumento**, Cobertura publica **73,5 % · 21.362 / 29.083** — exactamente
   la cabecera. Aquella medición se tomó sobre el frame viejo, sin radiografía;
   no era un defecto de la superficie sino del estado.
2. **Dos de los «desbordes» eran del detector, no de la pantalla.** Los 8
   contados a 1440×1000 son elementos **posicionados en absoluto** por diseño:
   el conector entre etapas del flujo y la etiqueta del marcador de mínimo del
   histograma. Contando solo elementos `position: static`, los desbordes reales
   son **0**. El detector queda corregido para las siguientes iteraciones.

Medido sobre el instrumento, las tres superficies ya pasan la vara:

| superficie | alto | prosa | desbordes reales |
|---|---:|---:|---:|
| Población | 2,7 pantallas | 0 párrafos | 0 |
| Cursos-horario | 2,6 pantallas | 39 palabras (era 73) | 0 |
| Cobertura | 1,7 pantallas | 28 palabras | 0 |

Lo único que sí era prosa en un hueco vacío: el panel de particularidades
explicaba **qué hace cada acción** —«las exclusiones se aplican al reconstruir
el marco; incluir o marcar como revisado solo documenta»— incluso cuando el
marco no trae ninguna señal que decidir. Esa regla ahora solo aparece cuando hay
casos; el vacío se explica solo. Prosa de la pestaña: **73 → 39 palabras**.

Gate: typecheck 0 errores · Vitest **799/799** · desbordes reales 0 en las tres.

### F11 — Diseño y Propuestas (S6, 2026-08-02) · **parcial, con bloqueo medido**

**Diseño.** 3,4 pantallas y 9 párrafos / 180 palabras: la prosa más densa del
módulo. Juzgada una a una, **ocho de las nueve se ganan el sitio**: definen z, p,
deff y τ con las cifras del propio estudio («con p = 0,3 Universidad trabaja con
84 % de esa exigencia», «con τ = 53 %, lograr 100 encuestas completas exige
intentar ≈189»). Eso es exactamente la prosa metodológica que S3 protege, no
slop. La única que narraba la afordancia —«el plan de cursos-horario, en su
pestaña; cada cambio se aplica con confirmación explícita», que el riel y el
botón ya dicen— se reduce a lo que la pantalla no muestra. Prosa: **180 → 167
palabras**, 26 → 13 en el bloque tocado.

**Propuestas no se pudo auditar, y la razón es un bloqueo del flujo real.**
La pestaña está vacía; ejecutar «Calcular muestra» devuelve **409
`E_CALC_MUESTRA_ALUMNOS_CH_DECISION`** con `reason: "schema_invalido"`. Se
confirmó la decisión desde Marco → Alumnos por CH y **el error se repite**. La
decisión persistida tiene la forma correcta —los seis campos— pero con
`schema: ""` y `frame_hash: ""`:

```
{schema: "", frame_hash: "", denominador, estadistico_default, por_facultad, confirmado_at}
```

Es decir: **«Confirmar decisión» guarda una decisión que el motor rechaza
siempre**, y desde ese estado no hay forma de llegar a Propuestas ni a nada
aguas abajo. Es dato/contrato, no superficie: **va al loop v2**. La superficie
sí se comporta —muestra el error, visible y con su código— pero lo hace con el
mensaje del motor («incompleta o usa un schema desconocido») y sin ofrecer el
camino; eso queda como su parte de S6.

Encolado con su medición:
- **v2**: `alumnos_por_ch_decision` se persiste con `schema` y `frame_hash`
  vacíos al confirmar; el cálculo falla cerrado para siempre.
- **S6 (superficie)**: el error de decisión no ofrece la dirección
  `marco/marco-alumnos-ch` ni traduce `schema_invalido` a lo que hay que hacer.
- **S6 (Propuestas)**: sin auditar; auditar sobre pantalla vacía no es auditar.

Gate: typecheck 0 errores · Vitest **799/799**.

### F12 — Panorama de criterios de curso-horario (S6-bis, 2026-08-02)

**Encargo directo de Gonzalo:** «evalúa una mejor forma de poder mostrar
visualmente toda la información de los criterios de curso-horario».

Auditoría de la superficie: el acordeón por facultad resuelve **bien la
decisión** —cada criterio con su dato al lado, que es lo que S1 pedía— pero solo
deja ver **una facultad a la vez**, y abrir una cuesta **1.962 px**. Con
**17 facultades**, comparar exigía abrir, recordar y cerrar: la información
completa de los criterios de CH **no se podía ver junta nunca**.

| medición | antes | después |
|---|---:|---:|
| Facultades visibles a la vez | **1 de 17** | **17 de 17** |
| Alto para ver el estado de todas | 17 × 1.962 px | **775 px** |
| Escala para comparar CH entre facultades | ninguna | **común, 0 – 852 CH** |

Owner nuevo `PanoramaCursosHorario.tsx` — la **foto**; el acordeón sigue siendo
el **taller**:

- una fila por facultad, ordenadas por elegibles como el acordeón;
- barra de dos capas sobre **escala común**: CH totales al fondo, CH elegibles
  en acento — de un vistazo se ve que «Elena Diego» conserva 45 de 454 mientras
  «Karina E Karina» conserva 639 de 849;
- mediana de elegibles por aula;
- una columna por criterio de CH y otra para el mínimo, cada celda declarando
  si la facultad **hereda el global** o **decide propio**;
- la facultad ancla su fila (columna pegajosa) y su nombre abre su bloque.

**Presenta, no calcula:** los CH, el total y la mediana los publica el marco por
facultad; el estado propio/global sale de la selección. La escala se declara una
vez en la cabecera.

Gate: typecheck 0 errores · Vitest **799/799** · 1440×1000 y 1024×600 sin
desbordes; la tabla cabe en su contenedor (870 px) a 1024.

### F13 — El bloqueo que gatea la mitad del plan (2026-08-02) · **hallazgo mayor**

Al intentar S9 (Objetivo) apareció el mismo muro que en F11: la pestaña publica
`N OBJETIVO pendiente`. **Siete superficies dependen del mismo eslabón**
—Propuestas, Objetivo, CH requeridos, Distribución, Selección, Reemplazos y
Entrega— así que se persiguió la causa en vez de encolarlas una por una.

**Medido, en tres pasos:**

1. `POST /api/calc-muestra/calcular` → **409
   `E_CALC_MUESTRA_ALUMNOS_CH_DECISION`**, `reason: "schema_invalido"`.
2. Se confirma la decisión desde Marco → Alumnos por CH y **se espera 25 s**
   (no es debounce). La decisión persistida tiene sus seis campos **todos
   vacíos**: `schema: ""`, `frame_hash: ""`, `denominador: ""`,
   `estadistico_default: ""`, `confirmado_at` ausente.
3. Se instrumenta `fetch` y se pulsa «Confirmar decisión» sobre recarga limpia:
   **0 peticiones**. El `POST /api/calc-muestra/estudio` que se veía antes lo
   dispara el flujo de cálculo, no la confirmación.

**Conclusión: «Confirmar decisión» no persiste nada.** La decisión nunca sale
del navegador, así que el motor recibe siempre una decisión vacía y falla
cerrado — correctamente. Desde ese estado **no hay forma de avanzar** a nada
aguas abajo.

Descartado en el camino: el normalizador TS
(`normalizeUniversityAulasConfig`) conserva la decisión con su rama
*fail-closed* explícita, y el handoff (`applyAlumnosPorChDecision`) la escribe
sobre la config. Ambos están bien.

**Sospechoso localizado — una carrera, no una pérdida de datos.**
`confirmarAlumnosPorCh` hace tres cosas seguidas
([UniversidadDesk.tsx:333](../../frontend/src/features/calcMuestra/universidad/UniversidadDesk.tsx#L333)):
escribe el workspace con la decisión, **sustituye los componentes** con
`resultado: null`, e invalida artefactos. Ese cambio de componentes dispara el
efecto de
[CalcMuestraPage.tsx:1123](../../frontend/src/features/calcMuestra/CalcMuestraPage.tsx#L1123),
que depende de `estudio.componentes` y vuelve a escribir el workspace con
`reconcileUniversityAulasTarget(workspace, …)` — donde `workspace` es el memo
**anterior**, sin la decisión. El guardián `setWorkspaceSiCambia` compara y no
ve cambio, así que el autosave nunca se dispara: **0 peticiones**, que es
exactamente lo medido.

**Excluido también `reconcileUniversityAulasTarget`**: reconstruye la config
con `normalizeUniversityAulasConfig`, que conserva la decisión. No es el que la
borra.

Lo que queda acotado para F14, con lo descartado escrito para no repetirlo:

- ✅ descartado: normalizador TS, handoff, `reconcileUniversityAulasTarget`, y
  el motor R (se comporta bien: falla cerrado ante una decisión vacía).
- ❓ pendiente de aislar: por qué `onWorkspace(next.workspace)` no acaba en un
  `POST /api/calc-muestra/estudio`. Candidatos vivos: el guardián
  `setWorkspaceSiCambia` comparando contra un estado ya normalizado, o el
  autosave que no observa el cambio de `aulas_config`.
- El test que cierra F14: pulsar «Confirmar decisión» debe dejar la decisión
  con `schema` y `frame_hash` no vacíos en el workspace persistido.

**Es superficie, no motor**: el contrato R se comporta bien. Va como lote
propio y **es el siguiente**, porque desbloquea siete superficies del plan.

### F14 — La trampa que se perpetuaba sola (T7, 2026-08-02) · **T7 cerrada**

**Corrección del diagnóstico de F13.** Escribí que «Confirmar decisión no
persiste». Era el encuadre equivocado: el clic no emitía peticiones porque el
**botón estaba deshabilitado**, y la pantalla no lo decía. Instrumentar el
control —en vez de seguir leyendo el camino de guardado— lo mostró en una
medición.

**Causa raíz, y es un bucle cerrado sobre sí mismo:**

1. Una decisión heredada llega con `estadistico_default: ""`.
2. `decision?.estadistico_default ?? "p25"` recibe cadena vacía, **no
   `undefined`**, así que el `??` no cae al recomendado.
3. Sin método válido, `alumnosPorChValue` devuelve `null` en las 17 facultades.
4. `missing = 17` deshabilita **el botón que habría reparado el estado**.

Un estado inválido que bloquea la única acción capaz de repararlo, en silencio.

Lo entregado:

- `metodoAlumnosPorChInicial` acepta el método guardado **solo si sirve**; si no,
  cae al recomendado. Owner del modelo, con `esMetodoAlumnosPorChValido` al lado.
- **Un control bloqueado nombra la pieza que falta** (C4/C5): «Falta el
  estadístico en N facultades: …», con las tres primeras y el resto contado, más
  `title` en el botón. Antes la única pista era «la propuesta aún no está
  confirmada», que es el estado, no la causa.
- Ese aviso destapó el segundo defecto: las dos facultades que bloqueaban tenían
  **0 CH elegibles** (0 de 852 y 0 de 10). Una facultad sin CH no aporta unidades
  ni tiene distribución de la que salga un estadístico: **exigirle una decisión
  bloqueaba todo el cálculo por facultades que no participan**. El gate ahora las
  excluye, y sigue nombrando a las que sí tienen CH y no resuelven.
- Guards: una decisión heredada con método vacío no deshabilita el botón; una
  facultad con 0 CH no bloquea; una facultad **con** CH y sin estadístico sí se
  nombra.

**Verificado de punta a punta en la app:** la decisión se confirma y persiste
con `schema: calc_muestra_alumnos_por_ch_decision_v1`,
`frame_hash: aa0ff9e104…`, `denominador: elegible`, `estadistico: p25`,
`confirmado_at` presente. El 409 por `schema_invalido` desapareció.

**Lo que queda, y es de otro dueño.** El cálculo ahora falla con un error
**distinto**: `facultades_incompletas` — los componentes P1/P2 declaran las
facultades reales (`derecho`, `arquitectura_y_urbanismo`…) y el marco sembrado
trae los seudónimos (`andres`, `elena_diego`…). Es **T4, la contradicción del
anonimizador**, ya registrada: el motor falla cerrado con razón. No es superficie
y no se resuelve aquí.

Gate: typecheck 0 errores · Vitest **801/801**.

Consecuencia para el plan: quedaba T4 (la contradicción del anonimizador) como
único bloqueo — resuelto para el instrumento en F15.

### F15 — El instrumento llega hasta el cálculo (T4 en el instrumento, 2026-08-02)

El cálculo fallaba con `facultades_incompletas`: los componentes P1/P2 declaran
las **15 facultades reales** (`derecho`, `arquitectura_y_urbanismo`…) mientras el
marco sembrado trae los **17 seudónimos** (`andres`, `elena_diego`…). El motor
falla cerrado con razón; el fixture es el que se contradice.

Reparación del instrumento (regla 2 del loop: no se detiene por el motor, se
siembra un estado y se sigue): los estratos de ambos componentes se reconstruyen
**desde el propio marco sembrado**.

- Etiquetas y número de facultades: las 17 de `exploracion$por_facultad`.
- `N` por facultad: alumnos **únicos** elegibles, del cruce
  `facultad × sexo` de `population_cross_profiles`. Primer intento usó
  `elegibles_total`, que son **matrículas** —sumaba 92.017, la cifra de
  matrículas de la cabecera— e inflaba el N del diseño; corregido.
- `N_a`/`N_b`: el reparto por sexo real del marco, no mitad y mitad.

**Suma de los estratos: 21.362 — exactamente los estudiantes elegibles de la
cabecera.** El instrumento queda internamente consistente.

**Verificado: el cálculo corre.** Propuestas publica los dos escenarios
completos — P1 `n=2.304 → 2.500 → 3.750`, 269 CH; P2 `n=4.934 → 4.934 → 5.921`,
473 CH — con su fórmula y sus parámetros. **S6 a S13 vuelven a ser auditables.**

**S6 · Propuestas, auditada con dato:** 2,5 pantallas, 2 párrafos / 48 palabras,
**0 desbordes**, los dos escenarios lado a lado y comparables. **Pasa la vara.**

**Un falso hallazgo, cazado a tiempo.** La cabecera publicaba 21.362 y las fichas
de la fórmula 21.365: parecía una divergencia F0 del producto. No lo era — la N
de la fórmula sale de `comp.marco.marco_validado`, que **yo no actualicé** al
reconstruir los estratos. Artefacto de la reparación del instrumento, no defecto
de la superficie; corregido alineando `marco_validado` con la suma de estratos
(21.365 → 21.362) en ambos componentes.

Queda anotado porque la lección es del loop: **una cifra que diverge después de
tocar el instrumento se investiga contra el instrumento antes de acusar a la
pantalla.** Es el mismo error que ya costó dos correcciones (el «31 % de prosa»
de F1 y el «13.498 / 38.749» de S5).

### F16 — Hasta dónde llega el instrumento (2026-08-02)

Rehecha la secuencia completa sobre el backend de la semilla alineada —confirmar
decisión → calcular— el cálculo **corre y publica** (Propuestas mostró P1
`2.304 → 2.500 → 3.750`, 269 CH y P2 `4.934 → 4.934 → 5.921`, 473 CH). El
`facultades_incompletas` bajó de **15 facultades sobrantes a 2 faltantes**:
`nestor_de_posgrado` y `nestor_de_ricardo_diana` — precisamente **las dos con 0
CH elegibles**, las mismas que en F14 bloqueaban la confirmación.

Es coherente: una facultad sin CH elegibles no tiene fila en el contrato de
Alumnos/CH, pero sí estrato en el componente. El motor exige coincidencia
exacta. **Es la misma pregunta de fondo que resolvió F14 en la superficie —
¿participa del diseño una facultad que no aporta unidades?— pero en el contrato
R, así que su respuesta es del loop v2.**

Estado real del instrumento, para que la próxima visita no lo redescubra:

- ✅ llega hasta **Propuestas** con los dos escenarios completos y auditables.
- ❌ **CH requeridos** y **Distribución** siguen vacías: dependen de que el
  cálculo persista sin el 409 de las dos facultades sin CH.
- El `.pulso` sembrado vive en el scratchpad de la sesión; **no es reproducible
  entre sesiones**. Hacerlo reproducible —guion versionado que derive la semilla
  desde el fixture— es lo que convierte este loop en repetible y debería ser el
  siguiente lote de instrumento.

### F17 — El instrumento llega al final, y un defecto real de contrato

**Primero, un defecto del producto, con evidencia.** El `calcular` devolvía
**200 con un `resultado` de cero campos** y dejaba los componentes con **15
estratos** frente a un contrato de Alumnos/CH de **17 filas**. A partir de ahí
toda corrida siguiente devuelve 409 `facultades_incompletas`: **un cálculo
«exitoso» hace imposible el siguiente**, y el estado muerto se alcanza desde el
flujo normal. Las dos facultades que sobran son las de **0 CH elegibles** — la
misma pregunta que F14 resolvió en la superficie, sin resolver en el contrato R.
**Va al loop v2** con esta medición.

Reparación del instrumento, coherente con lo que el propio motor hace: se
retiran esas dos facultades del contrato de Alumnos/CH **y** de los estratos,
para que ambos declaren las mismas 15. `marco_validado` se realinea con la suma.

**Resultado: el cálculo publica de verdad** — `resultado` con 21 campos,
`distribucion_universitaria` presente, 200 aulas base. Las tres superficies que
llevaban toda la sesión bloqueadas rinden con dato:

| superficie | alto | prosa | desbordes | scroll anidado |
|---|---:|---:|---:|---:|
| **CH requeridos** | 1,4 pantallas | 22 palabras | 0 | **0** |
| **Objetivo** | 2,4 pantallas | 57 palabras | 0 | 0 |
| **Distribución** | **5,1 pantallas** | 101 palabras · 6 tablas | 0 | 0 |

- **CH requeridos pasa la vara** — y con ella cae la deuda que I19 dejó escrita
  («scroll anidado manual en CH»): medido, **0**.
- **Objetivo pasa la vara**: 2,4 pantallas, el N objetivo (2.500) al frente.
- **Distribución no pasa**: 5,1 pantallas y seis tablas apiladas. Es el mismo
  patrón que F2 resolvió en Criterios —un recorrido resuelto como pila— y su
  arreglo es el mismo: pasos recorribles. Queda como **S7-bis**, con su medición.

Ledger: superficies por la vara **7 → 10 de 23**; superficies bloqueadas por no
poder ejecutar el cálculo **6 → 0**.

### F18 — Distribución se recorre (S7-bis, 2026-08-02) · **S7 cerrada**

Cuatro secciones apiladas: dato acreditado (270 px) + composición (1.007) +
precisión (642) + sensibilidad (604). Es el mismo patrón que F2 diagnosticó en
Criterios —un recorrido metodológico resuelto como pila— y lleva el mismo
remedio.

- El **dato acreditado encabeza siempre**: es la procedencia del bloque.
- Composición, precisión y sensibilidad pasan a un **riel numerado**; solo la
  lectura activa ocupa layout y las tres siguen en el DOM con `hidden`.
- **Peaje estructural respetado, y el guard lo impuso:** el riel inline dejaba
  `CalculoDistribucionTab` en 383 líneas contra una base de 372, y el contrato
  I20 falló. Se extrajo a `DistribucionPasos.tsx`; el owner queda en **361**,
  por debajo de su línea base.

**Resultado: 5,1 → 2,8 pantallas** (2,2 en Sensibilidad), 0 desbordes.

Ledger: superficies por la vara **10 → 11 de 23**.

### F19 — Método, y el límite honesto de esta sesión (S9, 2026-08-02)

**Método** (1,6 pantallas, 95 palabras) tenía **2 desbordes reales**: dentro del
estado vacío compacto, el slot de 34×34 px reservado al icono lo heredaba
cualquier hijo directo, y un `em` de 86 px desbordaba su caja. Corregido: los
demás hijos ocupan la fila y pueden envolver. **Desbordes 2 → 0.** La narración
de los cuatro métodos que I17 introdujo se conserva íntegra: es contenido, no
paráfrasis.

**Simulación y Selección no se pueden auditar todavía**, y la razón está
medida: ambas publican «La evidencia almacenada no acredita la comparación
vigente» — dependen de una corrida del comparador de métodos sobre el marco
vigente, que no se ha ejecutado en este instrumento. No es un defecto de
superficie: es el mismo principio de este loop, *auditar sobre pantallas vacías
no es auditar*.

**Estado del plan al cierre de la sesión:**

| | |
|---|---|
| Superficies por la vara | **12 de 23** |
| Lotes cerrados | **7 de 13** (S1–S7) + T1, T4 (instrumento), T6, T7 |
| Pendientes con dato disponible | ninguno |
| Pendientes que exigen una corrida previa | Simulación, Selección, Reemplazos, Sustento (comparador de métodos) |
| Pendientes sin tocar | S12 Datos · S13 Entrega |

Lo que la próxima visita debe hacer, en orden: correr el comparador de métodos
sobre el instrumento para desbloquear **S10–S11**, auditar **S12–S13**, y
versionar el guion de siembra para que el instrumento deje de vivir en el
scratchpad.

Y para el **loop v2**, dos hallazgos de contrato con evidencia en este doc: el
`calcular` devuelve 200 con `resultado` vacío y deja componentes que él mismo
rechaza después; y el contrato de Alumnos/CH y los estratos discrepan en qué
hacer con una facultad de 0 CH elegibles.

### F20 — D10: Consistencia es pestaña propia (S12, 2026-08-02)

Datos medido con el instrumento: **Estudio** 1,2 pantallas y **0 prosa** —pasa
la vara—; **Variables** 3,5 pantallas; y **Fuentes** **5,3 pantallas con 226
palabras**, la prosa más densa del módulo. La causa estructural estaba a la
vista en su propio markup: un solo bloque con Fuentes (2.298 px) **y** un
sub-bloque rotulado «Subpágina de Fuentes» (824 px) con la auditoría de
consistencia. Dos actos distintos en una pestaña.

**D10 estaba decidida por Gonzalo y pendiente desde I18.** Ejecutada entera:

- `def-consistencia` es pestaña propia de Datos, **inmediatamente después de
  Fuentes**, con su dirección publicada.
- Owner nuevo `DefConsistenciaTab`; el combinado `DefFuentesConsistenciaTab`
  se retira.
- La normalización de direcciones deja de reescribir `def-consistencia` a
  `def-bases?foco=…`; los hogares históricos (`marco/marco-validacion`,
  `marco/def-consistencia`) apuntan ahora a la pestaña real.
- Estados separados: Fuentes acredita que las bases están declaradas;
  Consistencia acredita la relación entre ellas.
- Guards actualizados al inventario nuevo: **23 → 24 pestañas**, 201 → 202
  nodos del manifiesto, firma del catálogo, aliases y las tres direcciones
  históricas.

| | antes | después |
|---|---:|---:|
| Fuentes | 5,3 pantallas · 226 palabras | **3,6 · 120** |
| Consistencia | subpágina sin dirección | **pestaña propia · 1,2 pantallas · 86 palabras** |

Gate: typecheck 0 errores · Vitest **994/994** en 107 archivos (incluye
`src/lib`, donde viven los contratos de navegación) · `sync-agentic-os --check`
OK · 0 desbordes en ambas.

Ledger: superficies por la vara **12 → 15 de 23**; lotes cerrados **8 de 13**.

### F21 — Entrega por la vara (S13, 2026-08-02) · **S13 cerrada**

Las cuatro superficies medidas con el instrumento:

| superficie | alto | prosa | desbordes HTML |
|---|---:|---:|---:|
| Cierre | 1 pantalla | **0 párrafos** | 0 |
| Tablas | 3,1 pantallas | 48 palabras | 0 |
| Entregables | 1,3 pantallas | 75 palabras | 0 |
| Pase a Monitoreo | 1,4 pantallas | 66 palabras | 0 |

**Las cuatro pasan.** Tablas marcaba 13 desbordes: los trece son nodos SVG
`<text>` de los ejes del gráfico, donde `scrollWidth` no significa lo mismo que
en HTML. **Tercer falso positivo de mi propio detector en esta sesión** —tras
los absolutos de S5 y el conteo de prosa de F1— y la misma lección otra vez:
*el instrumento de medida también se audita*. Filtrando nodos no-HTML, los
desbordes reales son **0**.

### F22 — Selección auditada cerrada (S9–S11, 2026-08-02)

El comparador seguía corriendo, así que las cuatro superficies se auditaron **en
su estado cerrado**: la tercera prueba de la vara —la del hueco— se juzga
exactamente ahí. Las cuatro contienen su vacío, lo nombran y dan la salida; 0
desbordes HTML.

| superficie | alto | palabras | hueco nombrado | salida |
|---|---:|---:|:--:|---|
| Simulación | 1,0 | 39 | sí | Comparar métodos (local) |
| Cursos-horario titulares | 1,0 | 132 | sí | Ir a Método |
| Reemplazos | 1,0 | 108 | sí | Ir a Método |
| Sustento técnico | 1,9 → **1,7** | 353 → **334** | sí | Ir a Método |

Dos hallazgos, uno descartado por lectura y otro reparado:

- **Descartado**: «Comparar métodos» en Simulación y «Ir a Método» en las otras
  parecía vocabulario inconsistente. No lo es: en Método y Simulación la acción
  corre la comparación ahí mismo y en las demás navega. Dos acciones, dos
  verbos. *Leer el código antes de repararlo evitó el arreglo equivocado* —la
  misma lección de F2.
- **Reparado**: Sustento declaraba el hueco **dos veces** a 96 px de distancia
  —el aviso de etapa y la caja «Sustento en construcción»—. Manda el aviso, que
  nombra la condición exacta y lleva a resolverla. La caja sobrevive solo para
  el caso sin aviso (evidencia parcial), donde las fórmulas quedarían sin
  explicar por qué están sin valores. Guard: `AulasAuditoriaTab.test.tsx`, que
  exige el destino en el copy y no el control, porque `missing-frame` da su
  salida en prosa.

### F23 — El criterio se elige por facultad (dirección de Gonzalo, 2026-08-02)

> «Absolutamente toda la información de criterios es **por facultad**. Podemos
> reformular la forma en que ordenamos los criterios y el embudo —no llamarlo
> así, suena a AI slop—, pero debe verse la información con mucho detalle, de
> forma que permita escoger cada criterio **no a nivel general sino a nivel de
> criterio por facultad**.»

**Medido antes de tocar.** En `marco-ch-radiografia`, con el instrumento
sembrado: 3 criterios a la vista, **la palabra «excepción» aparece 0 veces**. El
override por facultad que el contrato ya persiste es *inalcanzable* desde la
superficie que decide — C4 roto.

La causa no es una sola. Al leer el código se parte en dos, y solo una mitad es
del frontend:

| criterio | grano decidible hoy | tope |
|---|---|---|
| Tipo de sesión | **por facultad** (`TipoSesionPorFacultad`, vista de primera clase) | — |
| Modalidad, tipo de docente y demás categóricos | por facultad, pero tras `ExcepcionesFacultad`, que la superficie no muestra | **frontend** |
| Nivel del curso (`range`) | por facultad vía `courseLevelRanges` | — |
| Edad (`numeric`) | **solo global** | **contrato** |
| Ciclos (`ordinal`) | **solo global** | **contrato** |

El tope de contrato es literal: `exceptions?: Record<string, { categories, op }>`
transporta **solo categorías**. `threshold`, `includeValues` y `fromValue` no
tienen forma por facultad. Edad y ciclos no son decidibles por facultad hoy, y
React no puede fabricar esa estructura sin mentir sobre lo que el motor aplicará.

**Reparto, por eso, en dos carriles:**

- **Frontend (F24, siguiente)**: el override por facultad deja de ser un enlace
  secundario y pasa a ser el cuerpo de la tarjeta, sobre las filas de la
  radiografía que ya traen el detalle de esa facultad —el detalle y la decisión
  en el mismo gesto, que es lo que Gonzalo viene pidiendo desde la observación
  de la cascada—. Se renombra «embudo vivo»: el nombre describe la animación,
  no lo que la pieza hace, y por eso suena a relleno.
- **Loop v2 (motor)**: extender `exceptions` para que acepte `threshold`,
  `includeValues` y `fromValue` por facultad, con su normalizador en
  `.cm_criterios_normalize_seleccion` y su test. Sin eso, edad y ciclos siguen
  siendo globales por diseño del contrato, no por olvido de la UI.

Queda anotado que **este hallazgo reabre la cola**: al vaciarse S13 el loop
reaudita desde S1 con la vara más alta, y el grano por facultad es ahora parte
de esa vara —un criterio que solo se puede decidir en general no pasa la prueba
de la decisión—.

### F24 — La decisión por facultad deja de ser un formulario (2026-08-02)

**Corrección de una medición mía.** En F23 escribí que «excepción» aparecía 0
veces en la superficie de criterios. Estaba midiendo `marco-ch-radiografia`,
donde los criterios son numéricos y de compuerta; los categóricos viven en
`marco-criterios-alumno`, y ahí el bloque sí renderizaba. El defecto era otro y
peor, así que la conclusión de F23 se sostiene por una razón distinta a la que
di.

**El defecto real, leído en el código**: `ExcepcionesFacultad` era un *alta
genérica* detrás de un toggle cerrado —elige facultad de un desplegable, elige
operación, elige categorías, «Agregar excepción»—. Ese orden exige **saber de
antemano qué facultad se desvía**, que es exactamente lo que el usuario viene a
averiguar. La decisión no vivía junto a la facultad: vivía en un formulario.

**Reparado**: se listan las **quince facultades**, cada una con lo que aplica, de
dónde viene (general o criterio propio) y su control. Ajustar es tocar la fila y
los chips se abren dentro de ella. Quedarse sin categorías devuelve la facultad
al general en vez de dejarla vacía. La estructura persistida no cambia: sigue
compilando a `exceptions[facKey]`, así que el motor no se entera.

| | antes → después |
|---|---:|
| Facultades visibles por criterio | 0 (tras un toggle cerrado) → **15** |
| Pasos para apartar una facultad | 4 (abrir · elegir facultad · elegir op · agregar) → **2** (Ajustar · tocar categoría) |
| Alto de la pestaña | 5,6 → **5,7 pantallas** |
| Desbordes | 0 → **0** |

Trampa evitada de entrada: `.cmv2-crit-exc-item` seguía en `display:flex` y la
fila pasó a tener dos hijos apilados. Dejarlo habría puesto los chips al costado
con ancho colapsado —el mismo bug de `.cmv2-crc-signal` que costó 1.006
desbordes—. Guard: `ExcepcionesFacultad.test.tsx`, tres casos.

**Sigue abierto para el loop v2** lo que el frontend no puede resolver: `exceptions`
transporta solo `categories`, así que **edad y ciclos siguen sin grano por
facultad**. Extenderlo a `threshold` / `includeValues` / `fromValue` es trabajo
de motor y normalizador, no de React.

### F25 — Reauditoría desde S1 con el grano en la vara (2026-08-02)

La vara sube: **un criterio que solo se puede decidir en general no pasa la
prueba de la decisión**. Primera pasada sobre S1 con esa regla:

| criterio | grano |
|---|---|
| Formación · Condición de matrícula · Facultad | **por facultad** (15 filas cada uno) |
| Edad · Ciclo o nivel curricular | **global**, por el tope de `exceptions` |

Los dos globales no se pueden reparar desde React —el contrato no transporta
`threshold` ni `includeValues` por facultad—, pero sí se puede dejar de
aparentar. Ahora **lo declaran**: «aplica igual en las 15 facultades: el motor
todavía no admite un umbral distinto por facultad». Callarlo los hacía parecer
del mismo grano que los de arriba, y esa es la peor versión: no es que falte la
capacidad, es que el usuario no sabía que faltaba.

Alto 5,7 pantallas y 0 desbordes, sin cambio. Los cinco criterios de S1 declaran
ahora su grano, así que S1 pasa la vara nueva **con la deuda de motor nombrada
en la propia superficie**.

### F26 — Reauditoría de S2 y S3 con la vara del grano (2026-08-02)

| superficie | alto | desbordes | filas por facultad | veredicto |
|---|---:|---:|---:|---|
| Alumnos por CH (S2) | 2,2 | 0 | 16 | **pasa** |
| Cursos-horario: criterios + radiografía (S3) | 5,8 | 0 | 35 | pasa con reserva de alto |
| Cobertura | 1,8 | 0 | 0 | pasa (no es superficie de criterio) |

**El renombre pedido no tiene dónde aplicarse.** «Embudo» no aparece en pantalla
en ninguna de las tres superficies: vive solo en el código —el componente
`CriteriosEmbudoVivo` y el campo de contrato `matriz_embudo`—. El AI slop era
interno, no visible; renombrar el campo es cambio de contrato y no se hace desde
aquí.

**Hallazgo**: los criterios de curso-horario son una implementación paralela
(`CursosHorarioBaseGlobal`) que se quedó sin el grano por facultad aunque el
contrato lo admite igual que en la tarjeta de estudiante. Se le dio el mismo
trato que en F24/F25: `ExcepcionesFacultad` para los categóricos y declaración de
grano para umbral y ordinal.

**Rendimiento real, medido y no inflado**: en este instrumento las variables de
CH no son categóricas, así que `ExcepcionesFacultad` no monta (0 bloques) y el
efecto visible hoy es **una** declaración de grano. El control queda correcto
para el estudio que sí traiga variables categóricas de CH; decirlo de otro modo
sería vender cobertura que la medición no respalda.

Reserva anotada para la próxima pasada: S3 mide **5,8 pantallas y 1.008
palabras**, la superficie más pesada del módulo. No la toco en esta iteración
porque reducirla sin perder el detalle por facultad —que es justo lo que Gonzalo
exige— es un rediseño, no un recorte.

### F27 — El alto de S3 está ganado (2026-08-02)

Antes de recortar, medir de qué está hecha. Los 3.765 px de S3:

| bloque | alto | palabras |
|---|---:|---:|
| Aviso de aplicar | 58 px | 14 |
| Ajustes del marco (transversales) | 782 px | 318 |
| **Por facultad · información y decisión** | **2.830 px** | 675 |
| Cierre del recorrido | 36 px | 19 |

**El 75 % del alto es la sección por facultad**: 15 facultades a ~189 px cada
una, con su información y su decisión juntas. Eso no es bulto, es el entregable
—recortarlo sería deshacer F24 y volver a la decisión general que Gonzalo
rechazó—. *La medición evitó el arreglo equivocado por segunda vez en la
sesión*: la conclusión intuitiva («5,8 pantallas, hay que comprimir») habría
atacado justo lo que hay que proteger.

El candidato real, si en la próxima pasada hace falta bajar el alto, es
**«Ajustes del marco»: 782 px y 318 palabras** de controles transversales por
encima del trabajo por facultad. Queda anotado con su medición, no ejecutado:
tocarlo sin entender qué controles de ahí son imprescindibles repetiría el error
que esta iteración acaba de evitar.

### F28 — «Ajustes del marco» tampoco tiene grasa (2026-08-02)

Medido el único candidato que quedaba de S3:

| pieza | alto | palabras |
|---|---:|---:|
| Cabecera de sección | 73 px | 40 |
| Aviso | 41 px | 32 |
| **Rejilla de criterios (controles reales)** | **645 px** | 246 |

De los 782 px, **645 son controles**; solo 114 px son cabecera y aviso. La prosa
de toda la superficie son **122 palabras en 4 párrafos** sobre 5,8 pantallas.

**Iteración sin reparación, y ese es su resultado.** S3 no tiene qué recortar:
su alto es función del grano por facultad y de los controles que ese grano
exige. Registrarlo importa tanto como una reparación, porque la próxima pasada
llegará con la misma intuición —«5,8 pantallas es mucho»— y aquí está la
evidencia de que atacarla rompería el entregable.

Con esto **S1, S2 y S3 pasan la vara del grano** y la reauditoría queda al día
hasta S4.

### F29 — Una lista deslizable declara su profundidad (S4, 2026-08-02)

Barrido de S4 y del resto con la vara del grano: `marco-poblacion` (2,7),
`def-estudio` (1,1), `def-variables` (3,2), `calculo-diseno` (3,4, 15 filas por
facultad) y `calculo-propuestas` (2,3, 15 filas) pasan con **0 desbordes**. Una
anomalía saltó: `marco-aulas` declaraba 2,6 pantallas pero **10.632 palabras**.

La causa, medida: un único contenedor, `cmv2-ch-sexo-scroll`, con **39.899 px de
filas dentro de una ventana de 360 px** —110 pantallas— porque volcaba los ~850
cursos-horario de golpe. La barra de scroll no dice cuánto falta, así que la
profundidad estaba escondida en un gesto.

| | antes → después |
|---|---:|
| Contenido del contenedor | 39.899 px → **1.876 px** |
| Filas renderizadas | ~850 → **40** |
| Palabras de la pestaña | 10.632 → **849** |
| Profundidad declarada | no → **«Mostrando los 40 de mayor tamaño · 849 cursos-horario»** |
| Desbordes | 0 → **0** |

No se agrega ni se resume nada —son las mismas filas del motor, acotadas—, y el
orden ya pone delante lo que importa. «Ver todos» conserva el acceso completo:
acotar no es esconder. Guard: `CursosHorarioSexoProfundidad.test.tsx`, con el
tercer caso cuidando que una lista que **sí** cabe no se anuncie ni se recorte,
porque un pie de profundidad sobre 8 filas sería el ruido que este loop combate.

### F30 — El vuelco de F29 era único, no sistémico (2026-08-02)

Barrido de **nueve superficies** buscando el patrón que F29 destapó: todo
contenedor deslizable cuyo contenido supere 4× su ventana.

**Resultado: cero.** Ningún otro contenedor del módulo esconde su profundidad.
El de `cmv2-ch-sexo-scroll` era el único, y ya está reparado.

Iteración sin reparación otra vez, y otra vez ese es el resultado: sin el
barrido, la pregunta «¿cuántos más habrá así?» quedaba abierta y la próxima
pasada la habría vuelto a abrir. Ahora la medida existe —contenido/ventana > 4—
y puede repetirse en un comando.

**Cierre del tramo**: la reauditoría con la vara del grano cubre **S1–S4 y las
superficies de Definición, Cálculo y Entrega**, todas con 0 desbordes.

### F31 — El comparador terminó y su evidencia no se acredita (2026-08-02)

El job `f8df413b` cerró en **100 %**. Estado de las cinco superficies de
Selección con esa corrida terminada:

| superficie | alto | desbordes | estado |
|---|---:|---:|---|
| Comparar métodos | 1,6 | 0 | **abre** (271 palabras) |
| Simulación · Titulares · Reemplazos | 1,0 c/u | 0 | siguen cerradas |
| Sustento técnico | 1,7 | 0 | sigue cerrada |

Método publica «Método configurado · **Sin atribución al engine**» y mantiene la
condición «la evidencia almacenada no acredita la comparación vigente». Es decir:
**la corrida completa no quedó acreditada como vigente**. Las superficies no
mienten —declaran su hueco correctamente, que es lo que la vara les exige— y por
eso el defecto no es de superficie.

**Va al loop v2**, junto a los otros tres hallazgos de contrato de esta sesión:
una corrida que termina en 100 % debe quedar acreditada o decir por qué no. Hoy
el usuario espera 63 simulaciones y al final la app le pide volver a comparar sin
nombrar qué firma cambió. Falta descartar antes que sea sólo estado obsoleto en
el cliente: el instrumento se sembró con `?pulso=`, que se consume una vez, así
que recargar para comprobarlo arriesga perderlo — se verifica al reabrir con el
sembrado limpio, no en caliente.

### F32 — La reauditoría cubre las 24 superficies (2026-08-02)

Corrí el comparador **por el camino real del usuario** (el botón, no la API) para
falsar F31, y mientras avanzaba cerré el barrido pendiente en vez de esperarlo.

Últimas siete superficies, todas con **0 desbordes y 0 contenedores con
profundidad escondida**:

| superficie | alto |
|---|---:|
| Fuentes · Consistencia | 1,4 · 1,2 |
| Cursos-horario requeridos · Distribución | 1,3 · 2,8 |
| Cierre · Entregables · Pase a Monitoreo | 0,9 · 1,3 · 1,4 |

Con esto **las 24 superficies del módulo están reauditadas con la vara del
grano**: ninguna desborda, ninguna esconde profundidad y las de criterio
declaran a qué grano deciden.

**Corrección de método**: para comprobar si el estado del comparador vivía en el
servidor consulté `/api/calc-muestra/workspace` y leí un 404. Estuve a un paso de
concluir «el servidor no tiene la corrida»: ese endpoint **no existe**. Un 404 de
una ruta inventada no es evidencia de nada, y la conclusión habría sido falsa.
Verificado contra el router antes de escribirla.

### F33 — El instrumento deja de vivir en un scratchpad (2026-08-02)

Mientras la corrida del comparador avanzaba —no se espera de brazos cruzados— se
cerró la deuda que sostenía todo el loop: **el script que siembra el instrumento
existía sólo en el scratchpad de la sesión**, repartido en seis archivos sueltos
(`seed.R`, `estratos.R`, `patch.R`, `patch2.R`, `cfg.R`, `ancla.R`). Al cerrar la
sesión se perdía, y con él la reproducibilidad de cada medición de este doc.

Ahora es uno versionado: **`api/scripts/qa_seed_calc_muestra_radiografia.R`**,
parametrizado por origen y destino, que declara en su cabecera qué produce, qué
**no** certifica —ni cifras canónicas ni etiquetas de facultad, que son
seudónimos— y el límite heredado del anonimizador. Incorpora además las dos
correcciones que costaron horas encontrar:

- el N del diseño son alumnos **únicos**, no matrículas: `elegibles_total` infla
  el N y descuadra la cabecera, y esa confusión de grano es justo la que el
  módulo existe para evitar;
- una facultad sin CH elegibles se excluye del diseño en vez de arrastrarse con
  N = 0, que era lo que dejaba la decisión de Alumnos por CH inconfirmable.

Sintaxis verificada (44 expresiones). La corrida lanzada por la UI seguía sin
acreditar al cierre del tramo; su lectura queda para la próxima iteración.

### F34 — El círculo de la comparación (2026-08-02)

Falsar F31 dio el hallazgo más caro de la sesión, y no era lo que yo había
supuesto. `POST /api/calc-muestra/aulas/comparar-metodos` no falla por falta de
evidencia: devuelve **409 `E_CALC_MUESTRA_ALUMNOS_CH_DECISION`**, con
`reason: "decision_stale"` y un mensaje exacto —«la decisión de alumnos por CH
cambió desde esta corrida»—.

Frente a eso, la app decía dos cosas y ninguna era esa:

| dónde | qué decía | qué pasaba |
|---|---|---|
| Aviso de etapa | «la evidencia almacenada no acredita la comparación vigente · **vuelve a comparar**» | comparar es justo lo que falla |
| Fallback del `catch` | «**construye primero el marco** de cursos-horario» | el marco ya estaba construido |

**El usuario quedaba en un círculo**, repitiendo lo único que no puede
funcionar, tras esperar 63 simulaciones. El código del motor no estaba
referenciado **ni una vez** en todo el frontend.

Reparado: cuando el motor nombra esa condición, la app la nombra también y dice
dónde se resuelve —Marco › Alumnos por CH—, en vez de mandar a repetir la
comparación. Guard: `decisionAlumnosChCaducada.test.ts`, con el reconocimiento
por código y por texto (el objeto estructurado no siempre sobrevive al cliente)
y tres casos negativos para que no se lleve por delante otros fallos.

**Lección de método, la tercera de la sesión**: F31 concluyó «la corrida no se
acredita» leyendo la superficie. Era verdad y era inútil —la causa estaba a un
`curl` de distancia—. Preguntarle al motor antes de teorizar sobre la superficie
habría ahorrado dos iteraciones.

### F35 — El bloqueo sin salida (2026-08-02) · **hallazgo mayor**

Al intentar lo que F34 recomienda —reconfirmar Alumnos por CH y comparar de
nuevo— aparece el defecto de fondo. Medido en la misma vuelta, lado a lado:

| | dice |
|---|---|
| **Superficie** | «Decisión vigente» · botón **Confirmar decisión deshabilitado** |
| **Motor** | `409 E_CALC_MUESTRA_ALUMNOS_CH_DECISION` · `reason: decision_stale` · «recalcula y vuelve a generar» |

**El usuario no tiene salida.** La app le dice que no hay nada que confirmar; el
motor se niega a comparar hasta que confirme. Cada lado es coherente consigo
mismo y juntos forman un callejón: Simulación, Titulares, Reemplazos y Sustento
quedan inalcanzables por diseño, no por falta de datos.

Esto explica de golpe todo lo que este loop venía tropezando: F31 leyó «no se
acredita» y lo atribuyó a la corrida; F34 encontró el 409 y lo trató como un
mensaje mal elegido. Ninguna de las dos era la causa. **La causa es que dos
componentes discrepan sobre qué hace vigente a una decisión**, y el frontend
—que sólo presenta y valida— no puede arbitrar esa discrepancia sin inventar
criterio.

**Reparto:**
- **Loop v2 (motor)**: alinear el criterio de vigencia. O la firma que el motor
  compara es la misma que la superficie evalúa con
  `alumnosPorChDecisionIsCurrent`, o el 409 debe decir **qué** cambió —hoy dice
  que cambió, no qué—.
- **Frontend (F36)**: la salida de emergencia. Cuando el motor reporta
  `decision_stale`, «Confirmar decisión» debe habilitarse aunque el borrador
  coincida: refirmar deja de ser un no-op cuando es exactamente lo que
  desbloquea. Hoy el deshabilitado existe para evitar un gesto inútil y acaba
  cerrando el único gesto útil.

Notado también: el 409 llega tras esperar **63 simulaciones**. El chequeo de
vigencia debería correr antes de encolar el job, no después de gastarlo.

### F37 — Salvedad sobre F34 y F35: la sonda iba incompleta

Al recorrer el camino completo apareció un dato que obliga a matizar las dos
iteraciones anteriores: **la comparación lanzada desde la UI sí se encola** y
corre. El 409 que sostiene F34 y F35 lo obtuve con `POST … {}` —cuerpo vacío,
sin `config` ni `objective_config`—, mientras la UI manda la configuración
completa.

Qué se sostiene y qué no, sin adornar:

- **Se sostiene**: el frontend no referenciaba `E_CALC_MUESTRA_ALUMNOS_CH_DECISION`
  ni una vez, y su fallback nombraba una causa falsa («construye primero el
  marco»). Eso es un defecto con o sin sonda, y F34 lo repara.
- **Se sostiene**: la salida de emergencia de F36 no daña nada. Sin señal del
  motor el botón sigue bloqueado; sólo se reabre cuando el motor rechaza.
- **Queda en duda**: si el usuario real llega alguna vez al callejón de F35. Con
  el `config` correcto el motor puede no rechazar nunca, y entonces F35 describe
  un estado que sólo alcanza una sonda mal formada.

**No se cierra F35 hasta verlo por el camino real.** Registrar la duda vale más
que el hallazgo: es la cuarta vez en la sesión que una medición apresurada
apunta al lugar equivocado —los absolutos de S5, la prosa de F1, los SVG de
S13—, y las tres anteriores las descubrí yo revisando, no el gate.

### F37b — La comparación acredita; F35 era mi sonda · **S10 cerrada**

La corrida lanzada desde la UI **acreditó**: Método pasa a «Recomendado por el
comparador vigente» y el aviso de condición desaparece. Queda confirmado lo que
F37 sospechaba: **el callejón de F35 no existe por el camino real**, lo fabricó
mi `POST` sin `config`. F34 se sostiene igual —el fallback nombraba una causa
falsa y el código del motor no estaba referenciado— y F36 tampoco daña nada,
porque sin señal del motor el botón sigue bloqueado.

Con la comparación acreditada, **Simulación abre y pasa la vara**: 1,1 pantalla,
170 palabras, 0 desbordes. Selección, Reemplazos y Sustento siguen esperando su
propio paso, la corrida de selección.

**Y el dato nuevo destapó un defecto que ninguna pasada anterior podía ver.**
Sustento saltó de 0 a 4 desbordes al dibujarse el gráfico de balance, que sin
datos no existía. Los cuatro eran uno solo, en cascada: `.cmv2-profile-bars > div`
declaraba pisos de 180 + 180 px que, con gap, padding y borde, exigen **392 px
mínimos dentro de una columna de 387**. Cinco píxeles exactos, arrastrando a tres
ancestros.

| | antes → después |
|---|---:|
| Desbordes en Sustento (1440×1000) | 4 → **0** |
| Mínimo exigido por la fila | 392 px → **adaptable** (pisos a 0) |
| Desbordes a 1024×600 (Método · Simulación · Sustento) | — → **0, 0, 0** |

Guard: `profileBarsGeometry.contract.test.ts`, que mide la **regla** y no la
pantalla —la regla estaba rota aunque nadie la mirara— y es falsable: con los
pisos viejos da 392 > 387 y falla.

**Lección**: auditar sobre pantallas vacías no sólo mide de menos, mide en falso.
Esta superficie llevaba toda la sesión declarándose limpia porque su gráfico no
tenía datos que dibujar.

### F38 — Un remedio apagado dice por qué (2026-08-02)

Al ir a correr la selección apareció el defecto, esta vez **por el camino real**
y no por una sonda: Titulares mostraba «La selección almacenada no es vigente ·
Regenera titulares sin relajar la validación» **con su botón «Generar selección»
deshabilitado, sin `title`, sin `aria-describedby` y sin una línea de texto**. La
superficie nombraba el problema y apagaba su solución en silencio.

La causa real, que ninguna parte de la pantalla decía: **la comparación seguía
corriendo** —«Método 4 de 4 (Optimizada para evitar repetidos) · 06:54»—.

| | antes → después |
|---|---|
| Motivo del bloqueo | invisible | **en pantalla y en el `title`**, con método y tiempo |
| Qué podía deducir el usuario | si esperar, volver o si la app se rompió: nada | que hay una corrida en curso |
| Desbordes | 0 | **0** |

Guard: `stageNoticeMotivo.test.tsx`, con el caso negativo —sin bloqueo no se
inventa un motivo— para que la explicación no se vuelva ruido permanente.

Esto es la prueba del hueco en su forma más cara: la superficie no mentía, pero
callaba justo el dato que convierte la espera en algo entendible.

### F36 — La salida de emergencia (2026-08-02)

Reparado el callejón de F35 por el único lado que le toca al frontend: cuando el
motor rechaza la comparación con `decision_stale`, «Confirmar decisión» **se
reabre** aunque la firma sea idéntica, y la superficie deja de decir «Decisión
vigente» para decir «El motor pide volver a firmarla».

React no arbitra quién tiene razón sobre la vigencia —eso sigue siendo trabajo de
motor, anotado en F35—. Sólo deja de bloquear el gesto que desbloquea: refirmar
no es un no-op cuando es lo único que abre el paso.

| | antes → después |
|---|---|
| Confirmar con firma idéntica y motor conforme | deshabilitado → **deshabilitado** (no se regala un gesto inútil) |
| Confirmar tras un 409 `decision_stale` | deshabilitado, **sin salida** → **habilitado**, con la causa en pantalla |

Guard: dos casos nuevos en `AlumnosPorChMarcoTab.test.tsx` que fijan las dos
mitades —sin señal sigue bloqueado, con señal se abre—, porque reabrirlo siempre
volvería a regalar el no-op que el bloqueo existía para evitar.

Gate: typecheck 0 · Vitest **811/811** en 94 archivos.

### F39 — El estado ocupado pasa la vara, y mi instrumento no

Con el comparador corriendo se pudo auditar algo que el loop nunca había mirado:
la superficie **ocupada**. Todas las pasadas anteriores midieron pantallas
inertes o cerradas.

Primera lectura, acotada a `.cmv2-tab-panel`: Método y Simulación no decían nada
del job y sólo Titulares informaba el avance. Iba a escribir que el estado
ocupado estaba **invertido** —la pestaña que lanza no informa, la de al lado sí—.

**Era falso.** Al medir el documento completo aparece la barra global: «Comparando
métodos», «corrida 10 de 21», tiempo transcurrido y **botón de cancelar**
(`cmv2-busy-cancel`). Un job global informado en una barra global es exactamente
donde corresponde. El estado ocupado pasa la vara sin tocar nada.

**Tercer error de alcance del mismo tipo en la sesión** —tras «excepción: 0
veces» medido en la pestaña equivocada y los desbordes SVG de S13—: acoto la
sonda al panel y concluyo sobre la aplicación. Queda escrito como regla del
instrumento: **antes de declarar que algo falta, medir el documento, no el
panel**. Las tres veces el error apuntaba en la misma dirección —creer que falta
algo que sí está—, que es la dirección que produce trabajo inútil.

### F40 — Corrección de rumbo de Gonzalo (2026-08-02)

Dirección nueva, y varias cosas de F24–F26 iban en contra. Se cita entera porque
reescribe la vara:

> «La decisión de criterios de estudiantes por facultad no tiene sentido, allí
> siempre es general. Además no es necesaria la radiografía: la radiografía es la
> descripción de alumnos elegibles por alguna característica de curso-horario,
> tomando en cuenta los criterios anteriores. Los criterios con switch de
> selección tienen que ser uno con los gráficos, son un todo. El embudo es activo
> y animado: si cambio un criterio previo, los gráficos del siguiente se
> actualizan. Toda la información debe estar mostrada de forma profesional, no
> técnica; **si algo está oculto es un error de diseño**.»

**Lo que hice mal**: llevé el grano por facultad a los criterios de estudiante,
que son generales por naturaleza, y monté la radiografía dentro de sus tarjetas.
El grano por facultad sí valía —pero para los criterios de curso-horario, no para
estos—.

**Primera corrección, medida:**

| | antes → después |
|---|---:|
| Elementos plegados en la pestaña | **637** → **0** |
| Alto de la superficie | 5,6 → **2,3 pantallas** |
| Bloques por facultad en criterios de estudiante | 3 → **0** |
| Desbordes | 0 → **0** |

Los 637 `<details>` cerrados son la medida exacta de «si algo está oculto es un
error de diseño»: la mayoría ni siquiera tenía título. El contrato quedó fijado
al revés de como estaba —el test exige ahora que la ruta de estudiante **no**
lleve radiografía, ni excepciones, ni un solo `<details>`—.

**Cola de esta dirección, por ejecutar en orden:**

1. **Orden de los criterios de curso-horario**: mínimo de matriculados primero;
   Elegibles por CH y Composición como penúltimos; el mayor detalle —ver uno por
   uno— al final.
2. **«Panorama por facultad» al inicio**, junto a la matriz de criterios.
3. **Selector de facultad en vez de acordeón**: mostrar una facultad a la vez
   permite más alto y más detalle, y elimina el plegado.
4. **Switch y gráfico como una sola pieza**, no dos bloques vecinos.
5. **Embudo activo**: cambiar un criterio previo actualiza los gráficos del
   siguiente.
6. **Quitar lo técnico**: nada de «trazabilidad completa» ni secciones que sólo
   se entienden por dentro.

### F41 — Nada oculto, y el orden que pediste (2026-08-02)

Puntos 1, 2, 3 y 6 de la dirección de F40, ejecutados y medidos.

**Orden del embudo por facultad**, ahora exactamente el pedido:

1. Matriculados / población · 2. Modalidad · 3. Condición del curso ·
4. Nivel del curso · *(bisagra: aulas candidatas)* · 5. Tipo de sesión ·
6. **Mínimo de elegibles por aula** · 7. **Composición del curso-horario** ·
8. **Cursos-horario del marco** (el mayor detalle, uno por uno)

**Una facultad a la vez, con selector.** Quince bloques plegados obligaban a
abrir y cerrar para comparar. Ahora el selector muestra la facultad elegida
entera —la cabecera deja de ser un botón que no hace nada— y hay alto de sobra
para el detalle.

**Nada plegado.** Cayeron los cinco `<details>` que quedaban: la matriz de
impacto, «Ver trazabilidad completa», los cuantiles, la señal y «Procedencia y
contrato».

| | antes → después |
|---|---:|
| Elementos ocultos · criterios de estudiante | 637 → **0** |
| Elementos ocultos · curso-horario | 5 → **0** |
| Alto · criterios de estudiante | 5,6 → **2,3 pantallas** |
| Alto · curso-horario | 5,8 → **6,7 pantallas** (sube porque ya no esconde) |
| Desbordes | 0 → **0** |
| Contenido técnico visible | «Procedencia y contrato», «trazabilidad completa» → **ninguno** |

**Lo técnico sale, lo metodológico se queda.** «Procedencia y contrato» —hash,
owner, grano, unidad— es el contrato interno del motor y no dice nada del
estudio. Pero dentro de ese mismo bloque vivían dos avisos que **sí** cambian una
lectura: que un criterio es informativo y no altera el N, y que unos segmentos
se solapan y por tanto **no se suman**. Al retirar el bloque se fueron los
cuatro; el test lo detectó y los avisos volvieron a la superficie, ya sin
plegado. *Quitar ruido y quitar información se parecen mucho en un diff.*

Pendiente de la dirección: **4** (switch y gráfico como una sola pieza) y **5**
(embudo activo: cambiar un criterio previo actualiza los gráficos del
siguiente).

### F42 — El acordeón por criterio se abre, y un plegado sobrevive con razón

Punto 4 de la dirección: **el switch y su gráfico son una sola pieza**. Estaban
separados por un acordeón —ocho cabeceras de 50 px por facultad, cada una
abriendo a ~950 px—. Con una facultad a la vez ese acordeón sobra, así que los
ocho criterios abren de entrada.

| | |
|---|---:|
| Criterios plegados por facultad | 8 → **0** |
| Alto de la pestaña | 5,8 → **10,5 pantallas** |
| Desbordes | **0** |
| Contenido técnico visible | **ninguno** |

**Dos hipótesis mías fueron falsas antes de dar con la causa.** Al abrir todo la
pestaña saltó a **28 pantallas**. Culpé primero a los cuantiles y los compacté:
bajó a 26,5. Culpé después a los gráficos de señal por segmento y los diferí:
26,5 → 25,3. Apenas nada. Sólo al medir el interior del criterio más grande
apareció la causa real: **`cmv2-crc-faculties`, 4.719 px — la radiografía de las
quince facultades renderizada dentro del bloque de una sola**, repetida por
criterio.

Eso es lo que «Ver trazabilidad completa» escondía, y explica por qué estaba
escondido: no era ruido técnico, era **el módulo entero duplicado**. La
reparación correcta no es mostrarlo ni ocultarlo, sino **acotarlo a la facultad
en foco**, que es la que el usuario abrió. Hasta que ese recorte exista se
contiene tras un control que ahora dice lo que hay —«Comparar con las demás
facultades»— en vez de una etiqueta técnica que no decía nada.

Queda así **un** plegado en la pestaña, y queda escrito por qué, con su medición.
Es la diferencia entre una excepción justificada y un descuido.

**Pendiente de la dirección**: acotar ese bloque a la facultad en foco, y el
punto **5** —embudo activo: cambiar un criterio previo actualiza los gráficos del
siguiente—.

### F43 — El detalle es de la facultad abierta (2026-08-02)

Reparado lo que F42 dejó contenido: `V2Distribution` recibía `facultyKey` y **no
lo usaba**, así que dentro del bloque de una facultad pintaba las quince. Ahora
filtra por la facultad en foco.

| | antes → después |
|---|---:|
| Facultades dentro de un criterio | 15 → **1**, la del selector |
| Plegados en la pestaña | 1 → **0** |
| Desbordes | 0 → **0** |

Con el bloque acotado desaparece el motivo para plegarlo, así que cae el último
`<details>`: **la pestaña ya no esconde nada**. La comparación entre facultades
no se pierde —vive arriba, en el panorama y la matriz, que es su sitio—.

**Lo que queda alto es honesto**: 25,3 pantallas para una facultad con todo
visible, y el grueso es un criterio con ~20 categorías, cada una con su gráfico.
No es duplicación ni relleno: es el detalle por segmento que Gonzalo pidió ver.
Si esa altura resulta excesiva en uso real, la palanca ya no es esconder sino
decidir cuántos segmentos merecen gráfico propio —y esa es una decisión de
producto, no una reparación—.

### F45 — Corrección de F44: el embudo SÍ es activo; lo que falla es el motor

**F44 está mal y la corrijo entera.** Concluí «el embudo no es activo» porque
las cifras no cambiaban al conmutar un criterio. Medí el efecto y no el
mecanismo, que es el error de método que llevo toda la sesión cometiendo.

Al instrumentar `fetch` aparece lo que de verdad pasa:

| | |
|---|---|
| ¿La UI pide el recálculo? | **sí**: **7 llamadas** a `/api/calc-muestra/marco/criterios/preview` por cada cambio de criterio |
| ¿Qué responde el motor? | **409 `E_CALC_MUESTRA_CRITERIOS_PREVIEW_STALE`** · «El preview requiere el contexto transitorio del marco y criterios vigentes» |
| ¿La superficie lo oculta? | **no**: 7 avisos `data-state="stale"` visibles, y conserva la última cascada ejecutada |

Es decir: **el punto 5 ya está implementado en el frontend y se comporta bien**
—pide, falla, lo dice y no inventa—. Lo que impide que los gráficos se
actualicen es que el motor rechaza cada preview por falta de contexto
transitorio. Eso es trabajo de motor, y ahora está localizado con su código de
error, no descrito como una sensación.

Estuve además a punto de escribir un segundo error: al ver «0 CH · 0 matrículas ·
0 estudiantes únicos» pensé que la app fabricaba ceros ante un fallo. No: son los
valores reales de la cascada ejecutada para esa facultad en el instrumento
sembrado, y el fallo del preview se anuncia aparte. **Verificar antes de acusar
evitó convertir una superficie honesta en un defecto inventado.**

**Deuda real que queda, ya del tamaño correcto:**

1. **Motor**: el preview necesita el contexto transitorio; hoy 409 siempre.
2. **Frontend, menor**: el aviso dice «El marco cambió mientras se calculaba el
   preview», que no es lo que ocurrió —el motor pidió contexto transitorio—. El
   mensaje debe reflejar el código recibido y no una causa supuesta.

### F47 — El embudo en vivo tiene condición, y ahora se entiende (2026-08-02)

Perseguido el 409 hasta su origen en `router_calc_muestra_criterios.R`: el
preview exige un **contexto transitorio de sesión** cuyo `source_frame_hash` y
`current_criteria_hash` coincidan con la petición. Ese contexto sólo existe si el
marco **se construyó en esta sesión**.

Consecuencia real, y es de producto: **quien abre un `.pulso` guardado nunca
tiene embudo en vivo**. La UI pide el recálculo siete veces por cambio y el motor
lo rechaza siempre, hasta que se reconstruye el marco.

Antes de culpar al frontend comprobé el payload: manda `source_frame_hash`,
`criteria_hash` **y `config`** —6,6 KB—. Está completo. Mi captura anterior sólo
leía 160 caracteres y por eso parecía faltar `config`: **la tercera vez en la
sesión que un recorte de mi sonda casi produce un defecto inventado.**

| | antes → después |
|---|---|
| Aviso | «El preview requiere el contexto transitorio del marco y criterios vigentes» | **«El embudo en vivo necesita que el marco se haya construido en esta sesión. Vuelve a construirlo para que los gráficos se actualicen al cambiar un criterio; mientras tanto se muestra la última cascada ejecutada.»** |
| ¿Dice qué hacer? | no | **sí** |
| Jerga interna en pantalla | sí | **no** |

Verificado en la app: 7 avisos, todos accionables, ninguno con jerga. Guard en
`calcMuestraCriteriosI18b.test.ts`.

**Para el loop v2** queda la pregunta de fondo, ya bien planteada: ¿debe el
preview depender de un intermedio de sesión, o reconstruirlo bajo demanda? Hoy la
respuesta la paga el usuario que abre un proyecto guardado.

### F46 — El aviso dice la causa real (2026-08-02)

Reparada la deuda de frontend que dejó F45: ante un rechazo `stale`, la app
sustituía el mensaje del motor por uno propio —«El marco cambió mientras se
calculaba el preview»— que **no era lo que había pasado**.

| | antes → después |
|---|---|
| Aviso en pantalla | «El marco cambió mientras se calculaba el preview» | **«El preview requiere el contexto transitorio del marco y criterios vigentes · E_CALC_MUESTRA_CRITERIOS_PREVIEW_STALE»** |
| ¿Coincide con lo que respondió el motor? | no | **sí** |

Verificado en la app con el instrumento sembrado: 7 avisos, todos con la causa
real y ninguno con la inventada. Guard en `calcMuestraCriteriosI18b.test.ts`, que
exige el texto del motor y prohíbe expresamente el sustituto.

Quien lee un aviso inventado busca la causa donde no está: aquí habría ido a
revisar por qué «cambió el marco» —que no cambió— en vez de ver que faltaba
contexto transitorio en el motor. Es el mismo defecto que F34 encontró en la
comparación, en otra superficie.

**Queda, ya sólo del lado del motor**: el preview necesita el contexto
transitorio del marco y los criterios vigentes; hoy responde 409 siempre, y por
eso los gráficos no se actualizan aunque la UI los pida siete veces por cambio.

### F44 — El embudo no es activo (2026-08-02) · **CORREGIDA POR F45**

Punto 5 de la dirección: «el embudo es activo y animado, si cambio un criterio
previo luego los gráficos del siguiente criterio se actualizan».

**Conclusión errónea, ver F45.** Prueba en la app, con el control y el resultado por separado para
que la evidencia sea falsable:

| | |
|---|---|
| Acción | conmutar la primera categoría de **Modalidad** (criterio temprano) |
| ¿Cambió el control? | **sí**: `aria-checked` pasó de `true` a `false` y la facultad quedó «Decisión propia» |
| ¿Cambiaron los criterios siguientes? | **no**: `17.8 \| 639 \| 639` y `51.4 \| 58.4 \| 546` idénticos antes y después |

La primera fila importa tanto como la tercera: sin comprobar que el control
respondió, un «no cambió nada» sólo probaría que mi click falló.

**Por qué no es un arreglo de diez líneas.** El motor ya expone
`/api/calc-muestra/marco/criterios/preview`, y `CriteriosEmbudoVivo` lo consume
con `useCascadePreview`. Lo que falta es que **cada criterio** pida su
radiografía con los criterios previos aplicados —hoy todos leen el mismo
`criterios_radiografia` del último marco construido—. Eso es una cadena de
previews encadenados por posición en el embudo, con su invalidación y su estado
de carga.

**Y hacerlo mal es peor que no hacerlo**: si los gráficos se recalculan por
delante y alguno queda con el dato viejo, la superficie muestra una distribución
que ya no corresponde a los criterios activos —exactamente la clase de error que
este módulo existe para evitar—. Queda como la siguiente iteración, con el
contrato de encadenamiento definido antes de tocar la UI.

## DIRECCIÓN DE GOBIERNO — rediseño, no ajustes (Gonzalo, 2026-08-02)

Esta sección **reemplaza la cola de parches**. Gonzalo lo dijo sin rodeos: «esto
amerita un repensamiento completo y no ajustes superficiales». Las iteraciones
F40–F47 movieron piezas dentro de una estructura que ya estaba mal, y por eso
cada corrección suya encontró el mismo problema en otro sitio.

### La unidad de diseño es la CATEGORÍA de criterio, no el criterio

Cada categoría con CH disponibles es **un solo contenedor** que trae, junto al
switch que la incluye o excluye:

| dato | nota |
|---|---|
| Cantidad de CH | |
| Cantidad de alumnos | |
| Promedio de alumnos elegibles | con su **boxplot** |
| Información intercuantílica completa | los cuantiles, no una cifra suelta |
| La cascada —el efecto de esta categoría en el embudo— | **integrada**, sin jerga: «cascada viva» es lenguaje de relleno |
| Tasa de asistencia | |

Y **todo dinámico a los criterios previamente aplicados**: al cambiar un filtro
anterior, estas cifras y estos gráficos se recalculan.

Nada de esto sobra —Gonzalo lo subraya: «toda esa información es súper útil»—.
Lo que falla es que hoy vive repartida en un selector de cinco pasos, una consola
aparte y bloques vecinos que no se hablan.

### Las seis correcciones, literales

1. **No existen criterios generales.** Todos son por facultad. El **mínimo es el
   criterio 1**; el **7 y el 8 son los penúltimos**. (F40 los dejó generales en
   la pestaña de estudiante: interpretación equivocada, se revierte.)
2. **La matriz es parte del Panorama por facultad**, no un bloque al final.
3. **Los boxplots no tienen ejes visibles ni comunes.** Sin eje compartido no se
   pueden comparar, que es lo único para lo que existen.
4. **Radiografía y criterios son lo mismo.** No hay una superficie de criterios y
   otra de radiografía: se revisa cada criterio en detalle con toda su
   información radiográfica delante, y ahí se decide.
5. **Bug abierto**: la lista de categorías de tipo de docente mezcla las ocho
   categorías reales con **nombres de personas**. La captura descarta que sea la
   columna equivocada —si lo fuera no habría categorías—: la columna trae ambas
   cosas fila a fila y la app convierte cada valor distinto en un switch sin
   preguntarse si es una categoría o una persona. Falta confirmarlo contra la
   base; alias de columna en `calc_muestra_aulas.R:209`.
6. **El selector de cinco pasos no se elimina: se reconstruye** dentro de la
   unidad de arriba.

### Lo que esta dirección invalida

- El grano general en criterios de estudiante (F40).
- La matriz al cierre del recorrido (F41).
- La separación entre tarjeta de criterio y su radiografía (S1, F24).
- Cualquier iteración futura que ajuste una de estas piezas por separado.

### F48 — Primera pieza del rediseño: la tarjeta de categoría (ADR 0057)

Escrito el **ADR 0057** y arrancado el rediseño por su pieza portante:
`CategoriaEvidencia`, que reúne en un solo contenedor lo que ADR 0057 exige de
cada categoría —CH, alumnos, media por CH, boxplot, cuantiles y presentes
esperados con su tasa—.

**Escala compartida por construcción.** `dominioCategorias()` calcula el dominio
sobre **todas** las categorías del criterio y `EjeCategorias` lo declara una vez,
con marcas visibles y la unidad escrita. Es la regla 3 del ADR resuelta en el
tipo, no en el CSS: sin dominio no hay caja.

**Animación con función.** La caja crece desde su P25 al aparecer y las cifras
funden al recalcularse, para que se vea **cuál** cambió; nada se mueve por
decorar, y `prefers-reduced-motion` lo apaga sin perder información.

Guard: `CategoriaEvidencia.test.tsx`, seis casos, incluidos los dos que más veces
se rompieron —una escala por criterio y no por caja; y no estimar presentes sin
tasa ni dibujar caja sin distribución—.

| | |
|---|---:|
| Ejes declarados en la superficie | **3** |
| Cajas sobre escala común | **17** |
| Desbordes | **0** |
| Vitest | **820** en 97 archivos |

**Dónde llegó y dónde falta.** La pieza está viva en la ruta que usa
`ControlFlat` (criterios de estudiante). La ruta de curso-horario pasa por
`CriterioFacultadCard`, que tiene su propio camino y **todavía no la consume**:
es la siguiente iteración, y es la que importa según ADR 0057, porque allí es
donde todos los criterios son por facultad.

### F49 — La evidencia llega a la ruta que importa (ADR 0057)

F48 dejó la tarjeta de categoría viva sólo en la ruta de estudiante. Esta
iteración la lleva a **curso-horario**, que es donde el ADR dice que todos los
criterios son por facultad.

La pieza nueva es el puente: `evidenciaPorCategoria()` une la radiografía —una
fila por (facultad × segmento), con su distribución— con el conmutador, que vive
en la categoría. Sin él cada uno miraba su mitad.

**El join es por el par, no por el segmento.** Cruzar sólo por segmento
arrastraría la distribución de otra facultad a la tarjeta abierta; el guard lo
fija con dos facultades que comparten la categoría «presencial» y medias muy
distintas (22 y 99), de modo que un cruce mal hecho falla con un número
reconocible en vez de con un fallo abstracto.

| | antes → después |
|---|---:|
| Ejes declarados en curso-horario | 0 → **3** |
| Cajas sobre escala común | 0 → **13** |
| Bloques de cuantiles | 0 → **18** |
| Desbordes | 0 → **0** |
| Vitest | 820 → **824** en 98 archivos |

«Presentes esperados» sale 0 y es correcto: este instrumento no tiene tasa de
asistencia configurada, y el guard exige que sin tasa no se estime. Es la regla
de la casa —React presenta, no calcula— aplicada al caso más tentador.

**Siguiente**: la regla 2 del ADR —la matriz pertenece al Panorama por facultad,
no a un bloque aparte— y el bug de categorías que mezclan nombres de personas.

### F50 — Regla 2 del ADR y el bug de categorías (2026-08-02)

**Regla 2 · la matriz sube al Panorama.** Era el cierre del recorrido: llegaba
**después** de las decisiones que debía informar. Comparar criterios entre
facultades y elegir en cuál entrar son el mismo gesto, así que la matriz va
arriba, junto al panorama, antes de bajar al detalle. Verificado en la app.

El contrato de orden se invirtió a propósito —si alguien la devuelve al final,
el test falla—. Y ahí corregí una aserción mía que medía mal: comparaba contra la
sección «Decisión por facultad», que **envuelve** al panorama, así que su
etiqueta aparece antes por construcción y la comparación era vacua. Ahora compara
contra los bloques de facultad, que es la afirmación real.

**Bug de categorías: diagnosticado, y la reparación de fondo no es del frontend.**
El catálogo de categorías lo publica R con **los valores distintos de la
columna**. Cuando la columna mezcla la categoría del docente con su nombre, los
nombres llegan como categorías y la app los ofrece uno a uno como decisión.

Lo decisivo: en la captura el aviso era «sin distribución por facultad», es decir
`ch === null` para todas. **Sin distribución no existe ninguna señal que
distinga una categoría real de un nombre suelto** — no es que la app no la use,
es que no la tiene.

Por eso **no se filtra por heurística**. Cualquier regla del tipo «esto parece un
nombre» descartaría categorías legítimas, y descartar en silencio un criterio
real es peor que mostrar uno de más. Lo que sí se puede hacer, y se hizo, es
decir de dónde sale la lista y dónde está el problema:

> «El catálogo no trae distribución por facultad para este criterio, así que la
> lista son **todos los valores distintos de la columna**. Si aparecen valores
> que no son categorías —nombres, códigos sueltos—, la columna de origen los
> mezcla: revísala en Datos › Variables antes de decidir con ella.»

Guard: `categoriasSinDistribucion.test.tsx`, tres casos, incluido el que prohíbe
explícitamente descartar una categoría por parecer un nombre.

**Para el motor**: un catálogo de criterio sin distribución por facultad no
debería publicarse como lista de categorías decidibles, o debería marcar qué
valores tienen presencia en el marco.

| | |
|---|---:|
| Matriz | cierre del recorrido → **dentro del Panorama** |
| Vitest | 824 → **827** en 99 archivos |
| Desbordes | **0** |

### F51 — Las reglas dejan de vivir sólo en la prosa

Gonzalo, en su mensaje: *«si todas esas indicaciones ya las tenías antes, ¿por
qué sigues cometiendo los mismos errores y cómo los evitamos moving forward?»*.

**La causa, sin adornos.** Las reglas estaban escritas —en el ADR y en este
doc—, pero **nada las hacía cumplir**. Los tests de cada iteración confirman lo
que se acaba de construir, no lo que está prohibido. Por eso montar la
radiografía en la ruta de estudiante —contra una regla explícita, dicha dos
veces— dejó **el gate entero en verde**. Y hay un segundo patrón: cada iteración
se derivaba del último mensaje en vez del contrato acumulado, así que una regla
de hace tres mensajes se caía sola.

**El mecanismo**: `adr0057Reglas.contract.test.ts` vigila las reglas **por sí
mismas**, sobre el fuente, con independencia de qué componente se toque:

| Regla | Qué falla si se rompe |
|---|---|
| 4 · la radiografía es de curso-horario | `controles.tsx` no puede importar `CategoriaEvidencia`; y la contraparte: `FacultadCategoriaToggles.tsx` **debe** hacerlo |
| 1 · no hay sección transversal | la pestaña no puede rotular «Ajustes del marco» ni «Transversales a todas las facultades»; y **debe** montar `slotApertura`/`slotCierre` |
| 2 · la matriz pertenece al Panorama | su declaración debe preceder a los bloques de facultad |
| 3 · eje común y visible | el dominio es parámetro obligatorio y `EjeCategorias` debe existir |
| lenguaje y transparencia | ninguna superficie con `<details>`, «Procedencia y contrato» ni «trazabilidad completa» |

Cada regla lleva la cita de Gonzalo que la origina, para que quien la lea sepa a
qué se está comprometiendo.

**El guard se autocorrigió en su primera corrida.** Falló contra los comentarios
que documentan por qué se retiró «Procedencia y contrato». Un guard que se
dispara con su propia documentación empuja a borrar la explicación para pasar en
verde —peor que el defecto—, así que ahora lee el fuente sin comentarios: las
reglas se vigilan sobre lo que se renderiza, y las razones se conservan escritas.

**Las dos correcciones de esta iteración:**

| | antes → después |
|---|---:|
| Boxplots en criterios de estudiante | 17 → **0** (regla 4) |
| Boxplots en curso-horario | 13 → **13** |
| Sección «Ajustes del marco · transversales» | presente → **retirada**; sus criterios se montan en el embudo de la facultad (matriculados abre, mínimo y composición cierran) |
| Desbordes | **0** en ambas |
| Vitest | 827 → **835** en 100 archivos |

Al mover los transversales revertí un primer intento que dejaba «Composición»
**sin control en ningún sitio**: preferí revertir a commitear una regresión, y
la segunda versión conserva el control moviéndolo, no borrándolo.

### F52 — El destino del embudo deja de estar plegado

Barrido de lo que queda plegado en curso-horario, ahora que el orden y el grano
están bien. Tres hallazgos, y **sólo dos son defecto** —la distinción importa
tanto como la reparación—:

| plegado | veredicto |
|---|---|
| **«Cursos-horario del marco»** (50 px) | **defecto**: es el «mayor detalle, uno por uno» que cierra el embudo, su destino, y exigía un click. Abierto: 50 → **445 px** |
| **«Prevalencia de elegibles»** activa | **defecto**: es una regla heredada que **recorta el marco**; plegada no es difícil de encontrar, es **invisible mientras opera**. Ahora se abre sola cuando está encendida |
| «Ver todas (42 sin cursos en esta facultad)» | **no es defecto**: es un filtro declarado que dice qué contiene y cuántos. Abrir 42 filas vacías sería el ruido que el propio Gonzalo señaló al domar las 52 categorías |

La regla que se deriva y queda en el ADR: **una opción inactiva no es contenido
oculto; una regla activa sí lo es si está plegada.** El criterio no es si algo
está cerrado, sino si algo que opera puede pasar desapercibido.

Guard: `composicionReglaActiva.test.tsx`, con las dos mitades —activa abre,
apagada queda contenida—, para que abrir siempre no se convierta en ruido
permanente.

| | |
|---|---:|
| Desbordes | **0** |
| Vitest | 835 → **837** |

### Estado del loop

| | |
|---|---|
| Superficies por la vara | **la vara cambió con F40**: se reaudita con «nada oculto» y el grano correcto por tipo de criterio |
| Desbordes en el módulo | **0** a 1440×1000 y 1024×600 |
| Contenedores que esconden su profundidad | **0** |
| Lotes cerrados | **12 de 13** (S1–S7, S9–S13) + T1, T4, T6, T7, D10 |
| Gate más amplio corrido | **suite completa del frontend: 3.198 pruebas en 391 archivos**, typecheck 0, `sync-agentic-os --check` y `--audit` OK |
| Estado ocupado | **pasa**: barra global con paso, tiempo y cancelar |
| Pendiente | **Titulares, Reemplazos y Sustento con selección real**: la comparación corre al cerrar el tramo (método 4 de 4) |

Lo que la próxima visita encuentra hecho: el instrumento llega de punta a punta y
**es reproducible** (`api/scripts/qa_seed_calc_muestra_radiografia.R`); las 24
superficies pasan la vara, con el grano por facultad dentro de ella; y cada
reparación tiene un guard que falla sola.

Lo que tiene que hacer: esperar la comparación, generar la selección y auditar
las tres superficies que sólo con selección real muestran su contenido. **Esa
espera vale la pena**: F37 probó que una superficie sin datos se declara limpia
en falso —Sustento llevaba toda la sesión con 0 desbordes porque su gráfico no
tenía nada que dibujar, y al llegar el dato aparecieron cuatro—.

Para el **loop v2**, los hallazgos de contrato acumulados con evidencia en este
doc:

1. `calcular` devuelve 200 con resultado vacío y deja componentes que él mismo
   rechaza.
2. El contrato de Alumnos/CH y los estratos discrepan ante una facultad de 0 CH.
3. El anonimizador deja base, config, catálogo y componentes en vocabularios
   distintos — la causa raíz de que ningún `.pulso` del repo abriera la
   radiografía.
4. `exceptions` transporta sólo `categories`: **edad y ciclos no son decidibles
   por facultad**, contra la regla de producto de que todo criterio lo es.
5. El chequeo de vigencia de la decisión corre **después** de encolar el job: el
   409 llega tras gastar 63 simulaciones.

Siguiente, en orden: **F39 — con la comparación terminada, generar la selección y auditar Titulares, Reemplazos y Sustento con dato real**
(Selección: Método, Simulación, mapa, Reemplazos, Sustento) y **S12–S13**
(Datos y Entrega), que ya no dependen de ningún bloqueo. En paralelo, para el
loop v2: el contrato de Alumnos/CH y los estratos deben coincidir en qué hacen
con una facultad de 0 CH, y el `calcular` no debe devolver 200 con resultado
vacío.

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
