# Plan de 25 ticks — Monitoreo de aulas: Validación como instrumento

Encargo de Gonzalo, 2026-08-20: «necesitas diseñar desde ya un plan de
aproximadamente veinticinco ticks, porque lo que tienes que hacer es amplio y
creo que no lo estás planificando con ese nivel de largo plazo».

## La tesis que ordena el plan

**Validación es el instrumento de dos personas y hoy sólo sirve a una.**

- **El jefe de campo** entra por lo que sus aplicadores reportan del aula: qué
  encontraron, cuánto rindió cada uno, qué observaciones dejaron.
- **El analista** entra por lo que hay en plataforma: si coincide con lo que se
  vio en el aula, si el aula cumplió lo esperado, cuántas respuestas pasan la
  cadena de filtros, cuánto duran, y qué respuestas abiertas huelen mal.

Hoy la sección tiene dos pestañas —controles derivados y la hoja del equipo— y
las dos son del analista. El registro de campo acaba de entrar (`e310512c`).

## Estado de partida, medido

| | |
|---|---|
| Registro de campo | ya es la primera pestaña de Validación |
| Producción por aplicador | existe, pero enterrada como 4.º de 9 paneles en Avance › Rendimiento |
| Observaciones de los aplicadores | se escriben y **no se leen en ninguna pantalla** |
| Control de tiempos | **no existe**; el Excel anterior sí lo tenía |
| Calidad de texto abierto | **no existe en ningún perfil de Monitoreo** |
| Base de control | sin formato: 26 columnas crudas del Excel |
| Criterio de aula válida | declarable desde ayer; falta que juzgue y se vea |
| Agenda | tabla literal de 12 columnas, sin filtro por facultad |
| Reemplazo | sólo se activa dentro del formulario de un aula |

## Los 25 ticks

### A. Validación para el jefe de campo (T1–T6)

- **T1** — Las observaciones de campo a pantalla: hoy se escriben y nadie las
  lee. ~17 de 152 partes las traen en el corte.
- **T2** — Producción por aplicador **dentro de Validación**, no enterrada en
  Avance: efectivas por aula, y con su banda —con 6 equipos y 152 aulas las
  diferencias pequeñas son ruido—.
- **T3** — Calidad del trabajo por aplicador: rechazos, duplicados y descuadres
  del parte agregados por responsable. Hoy existen por aula y nadie los cruza.
- **T4** — Avance por facultad dentro de Validación, con el foco ya existente.
- **T5** — El parte de campo y la plataforma, cara a cara por aula: lo que el
  aplicador declaró contra lo que llegó. El motor ya cruza las dos hojas; falta
  el cruce con las respuestas.
- **T6** — Cierre de la sección: qué decide el jefe de campo aquí y qué no.

### B. Control de tiempos (T7–T11)

> **T7 ☑ MEDIDO (2026-08-20).** La base del estudio de aulas trae **43 columnas
> y UNA sola de tiempo**: `_submission_time`. **No hay `start` ni `end`**, así
> que no hay duración por respuesta. Y la ventana por aula que sí se puede
> calcular sale **constante: mediana 293 min y máximo 293**, porque el fixture
> siembra los tiempos con un patrón fijo — no distingue señal.
>
> **Dónde SÍ se puede construir y verificar**: el proyecto de referencia
> `acnur_acg` trae `start`, `end` y `_submission_time` sobre 1 732 respuestas.
> La lógica se escribe y se prueba contra él; en aulas la superficie **dirá que
> este estudio no trae tiempos** en vez de no existir, para que funcione sola el
> día que llegue un XLSForm que los declare.

- **T7** — ~~Medir qué trae la base.~~ Hecho: ver arriba.
- **T8 ☑ (2026-08-20, `api/R/monitoreo_tiempos_respuesta.R`, 29 tests)** —
  Duración por respuesta. Sobre `acnur_acg`, 1 283 respuestas: **mediana 14.12
  min**, p25 8.46, p75 27.51, **p95 857** y **máximo 10 260 —siete días—**; 92
  pasan de dos horas. La cola se cuenta aparte y no se recorta: sin las seis
  colas la mediana es la misma, así que winsorizar sólo escondería el caso a
  revisar.
  - **Trampa medida**: `strptime` no acepta el offset con dos puntos (`-05:00`)
    que escriben Kobo y SurveyMonkey y devuelve NA sin avisar. Sin normalizar,
    la mediana daba **0 min** y las colas caían en **1 440 y 10 080** —múltiplos
    exactos de un día, la firma de comparar fechas sin hora—.
  - **Las columnas de duración del instrumento no sirven como fuente**:
    `duracion_total` trae 37 valores y **los 37 son negativos**;
    `duracion_total_start_end` trae **979 ceros de 1 283** y en las 304
    comparables su mediana es 1 414 contra 31 de la propia (ratio 50). El motor
    calcula la suya desde `start`/`end` y no las lee.
  - **La detección es una lista cerrada**: la base trae `A/time_A_start`,
    `B/time_b_start`… que son marcas de **bloque**, no de la entrevista; una
    detección por parecido las tomaría como inicio.
  - **Pendiente declarado**: es motor sin superficie. Nadie lo consume todavía
    —la vista llega en T11—, y hasta entonces la capacidad no existe para el
    usuario.
- **T9 ☑ (2026-08-20, mismo motor, 47 tests)** — Duración por grupo, con su
  banda. **El grupo lo declara quien llama**, y no es un detalle de estilo:
  `acnur_acg` **no trae ni una columna de aplicador** —`_submitted_by` viene
  vacío en sus 1 283 filas y lo único operativo es distrito (6) y jornada (20
  días)—, así que un «por aplicador» cableado habría agrupado por otra cosa.
  - **La banda sale de los órdenes estadísticos** (`qbinom`), exacta y sin
    dependencias nuevas. Con menos de 5 casos **no hay banda y el grupo no
    juzga**.
  - **El caso que justifica el tick**: la jornada `2026-07-02` trae **una sola
    respuesta de 1 467 min** (24 h). Sin banda sería «el día más lento con
    diferencia»; con banda no dice nada, que es lo correcto.
  - **La referencia es el resto de la muestra, no la muestra entera**: un grupo
    mayoritario arrastra la mediana global hacia sí mismo y nunca destacaría.
  - **Lectura real por distrito**: 4 de 6 destacan — SMP 11.57 min (banda
    8.98–14.04) contra 14.51 del resto; SJL 16.91 (14.74–19.80) contra 13.23.
  - **Pendiente declarado**: en aulas el aplicador vive en la **hoja del libro**,
    no en la base de respuestas, y esa base **no trae tiempos**. La duración por
    aplicador en aulas exige el cruce respuesta↔aula↔aplicador y hoy **no es
    calculable con este estudio**; el aviso «Falta declarar quién recolecta» que
    ya sale en pantalla es la misma carencia vista desde el avance.
- **T10 ☑ (2026-08-20, 69 tests)** — Umbral de sospecha declarable, en la
  whitelist de `monitoreo_aulas_normalize_config` junto a `aula_valida`. Sin
  declarar no juzga: no hay defecto que marque nada.
  - **Es absoluto en minutos, y la elección se midió.** La alternativa era
    relativa a la mediana del estudio; se descartó porque **se mueve con la
    propia muestra**. Con las duraciones de `acnur_acg` a la mitad, el absoluto
    de 5 min pasa de 55 a **436** marcadas y el relativo del 40 % marca
    **exactamente las mismas 82 — el mismo conjunto de respuestas**. Un equipo
    que acelerara en bloque sería invisible para el relativo.
  - **No hay valle donde cortar**, y por eso el número lo pone quien conoce el
    cuestionario: <3 min marca 10 (0.8 %), <4 marca 23 (1.8 %), <5 marca 55
    (4.3 %), **<7 marca 174 (13.6 %)** — entre 5 y 7 minutos se triplica.
  - **Pendiente para Gonzalo**: elegir el número para el estudio de aulas. Hasta
    entonces la superficie describirá sin acusar.
- **T11 ☑ (2026-08-20, 77 tests R + 5 TS)** — «Cuánto se tarda en responder»,
  panel propio en Validación. El bloque `tiempos` viaja **siempre** en el
  payload del dashboard: cuando la base no trae marcas —el caso de este
  estudio— llega con `disponible: false` y su motivo, y el panel **dice que
  faltan** en vez de desaparecer. Un panel que se esconde cuando no hay dato
  deja al usuario sin saber que el dato existe (C5 categoría 1).
  - **El defecto que destapó la captura, y que el gate NO ve**: a 1440×1000 los
    paneles de Validación **se dibujaban unos encima de otros** —las barras de
    «Cómo trabaja cada equipo» sobre el título de «El parte contra la
    plataforma»—. Es el mismo defecto de reparto de alto que a 1024 recortaba, y
    la regla estaba encerrada en `@media (max-height: 760px)`, así que sólo
    curaba la mitad. Ahora vive fuera de toda media query.
  - **`ui-quick-check` no mide solapamiento**: dio `issues=0` sobre esa pantalla.
    La captura es evidencia, el número no basta.

### C. Calidad de las respuestas abiertas (T12–T17)

Capacidad nueva que **no existe en ningún perfil** y que Gonzalo quiere
extensible a todos los monitoreos.

> **T12 ☑ MEDIDO (2026-08-20).** La base del estudio de aulas **no tiene ni una
> pregunta de texto abierto**: de sus 43 columnas, sólo tres son de texto
> —`_submission_time`, `collectorID` y `sexo`— y el `.pulso` **no trae
> instrumento**. Aquí no hay nada que inventariar.
>
> **CORRECCIÓN (T13, 2026-08-20): las cifras de «~22 / ~14 / ~11 columnas
> abiertas» estaban mal.** Salían de contar columnas de tipo carácter, que
> incluyen códigos, GPS, fechas y selects. Contadas contra el **instrumento**,
> que es la fuente autoritativa: `acnur_acg` tiene **4** preguntas `text` —y dos
> son identificadores—, `acrconta` **3**, y **`acnur_pdm` 18 + 3 en el repeat**.
> **La capacidad se construye contra `acnur_pdm`**, no contra acg: es el único
> con preguntas abiertas de contenido (`RECP04_why`, `srv_claridad_why`…).

- **T12** — ~~Inventario.~~ Hecho: ver arriba.
- **T13 ☑ (2026-08-20, `api/R/monitoreo_texto_abierto.R`, 22 tests)** — Señales
  por respuesta, medidas sobre las **1 610 respuestas abiertas de `acnur_pdm`**
  antes de elegir cuáles valen.
  - **Una señal sólo significa algo contra su propia pregunta.** En
    `Enumerator_name` el **99.3 %** de las respuestas se repiten —es el nombre
    del encuestador— y en `telephone` el **100 %** es una sola palabra. Las
    mismas señales en `recomendation` marcan 54.7 % y 44 % sobre contenido real.
  - **Señal descartada con su cifra**: «teclado seguido» (asdf, qwer, 1234)
    marca **0 de 1 610**.
  - **Relleno y negativa son cosas distintas**, y el primer intento las juntó:
    con «no» y «ninguno» dentro de relleno, `recomendation` daba **33 % de
    relleno** que era gente contestando que no tenía recomendaciones. Separadas,
    `comentario_encuestador` de acg muestra las dos conviviendo: **8.7 % de
    relleno** (los 103 «.») y **10.4 % de negativas**.
  - **No filtra nada**: `monitoreo_texto_orden_de_lectura()` ordena por dónde
    empezar y devuelve todas las respuestas. Es un visualizador, no un juez.
- **T14 ☑ (2026-08-20, 44 tests R + 5 TS)** — «Lo que se escribió a mano», panel
  en Validación con selector de pregunta, el perfil de esa pregunta y sus
  respuestas en orden de lectura. **No esconde ninguna respuesta** y declara
  cuántas muestra de cuántas hay.
  - **Las preguntas salen del instrumento, no de adivinar la base**: sin
    instrumento el bloque dice justo eso. Una heurística sobre la base marcaba
    como abiertas las coordenadas GPS y la fecha de Kobo.
  - **Los identificadores se excluyen pero quedan declarados** con su motivo
    —en `acnur_pdm`: `Enumerator_name`, `telephone`, `Pulso_code`, más tres
    `srv_*_why` que viven en el repeat y no están en la base—. El filtro por
    nombre puede equivocarse: **el propio test lo cazó excluyendo
    `codigo_postal_why`**, y por eso los patrones van anclados al nombre
    completo.
  - **Verificado por los dos extremos, no en la misma pantalla**: el motor da
    `disponible: false` con su motivo sobre el fixture de aulas, el normalizador
    TS tiene test con ese motivo, y el gate visual pasa con el panel montado.
    La rama **con** datos se razonó contra `acnur_pdm` (12 preguntas, 6
    excluidas) y **no está vista en pantalla**: en aulas no hay instrumento.
- **T15 ☑ (2026-08-20, 62 tests)** — Señales agregadas por grupo, con banda de
  Wilson. Medido en `acnur_pdm` sobre `recomendation`: **9 de 16 aplicadores
  destacan**, y la separación es enorme — dos en **92.5 %** de negativas
  [80–97] contra otros tres en **0 %** [0–10.7].
  - **Mi previsión era que no distinguiría** (grupos de ~22 casos) y **la
    medición la desmintió**: las bandas son anchas pero no se solapan ni de
    lejos. Preverlo no es medirlo.
  - **19 nombres de aplicador que son 17**: «JORGE DEL SOLAR» convive con
    «JORGE  DEL SOLAR» y «Silbia Cruzado» con «silbia cruzado». Se unen
    mayúsculas y espacios —seguro— y **no se une por parecido**: «MARTHA
    VILANUEVA» no es «MARTHA VILLANUEVA», y ese caso se reconoce porque queda
    con un solo registro.
  - **Los grupos sin banda van al final**: el de un caso salía primero con
    100 %, leyéndose como «el peor» sin decir nada.
  - La banda de una tasa es Wilson, no la de la mediana: aguanta el 0 % y el
    100 %, que es la mitad de los aplicadores.
- **T16 ⛔ BLOQUEADO — exige una decisión de Gonzalo (2026-08-20)**. Marcar casos
  para invalidar. **No se escribe nada hasta decidir**, porque el mecanismo **ya
  existe** y crear un segundo sería el defecto de «dos sistemas paralelos» que
  este mismo plan vino a reparar.
  - **Lo que hay**: `production_annulments` del perfil territorial —**17
    funciones y 97 referencias** en `api/R/monitoreo_engine.R`, endpoints
    `/api/monitoreo/territorial/annulments/{preview,apply}`, con estado
    `active`/`reverted`, motivo, responsable y **scope `response` para anular un
    caso puntual por su uuid**—. Es exactamente lo que T16 iba a inventar.
  - **Y su núcleo es genérico**: `filter_rows` con scope `response` busca
    columnas candidatas de uuid y **no depende de UMP ni distrito**. Lo
    territorial son las funciones de bloques/manzanas y que se persiste dentro
    de `cfg$territorial$production_annulments`.
  - **Por qué está bloqueado**: generalizarlo toca `monitoreo_engine.R` y
    `router_monitoreo.R`, **los dos congelados a crecimiento**, y cambia un
    mecanismo que el perfil territorial ya usa en producción. Es un cambio de
    arquitectura con ADR, no un tick.
  - **Las tres salidas, para elegir**: **(1)** generalizar el núcleo a un archivo
    propio y que la persistencia acepte el perfil —lo correcto, y lo más caro—;
    **(2)** que aulas invoque el mecanismo territorial tal cual, aceptando que
    los datos vivan bajo `territorial` —barato y mentiroso—; **(3)** dejar aulas
    sin anulación por ahora y decirlo en la superficie. **Mi recomendación es
    (1)**, y hasta que se decida, T17 puede avanzar sin esto.
- **T17 ☑ (2026-08-20)** — Pestaña propia para las respuestas abiertas, dentro
  de Validación. Es lo que Gonzalo pidió textual: «otra dimensión de validación
  que podría ser un tap o una pestaña en sí misma». Vivía dentro de Registro de
  campo, apretada con otros seis paneles, y leer abiertas es un trabajo entero:
  se entra a hacer eso, no a mirarlo de paso.
  - **El «contrato heredable» no es código compartido**: es que
    `monitoreo_texto_abierto_payload()` **ya es genérico** —no sabe de aulas, se
    le pasan las respuestas y el instrumento—, así que cualquier perfil puede
    publicarlo sin tocar el motor. Lo que falta para heredarlo de verdad es que
    otro perfil lo publique, y eso es trabajo de ese perfil.
  - Verificado en pantalla: la pestaña sale en el rail y en la cabecera, y el
    panel queda solo en su vista. Gate en 0 issues.
### D. Indicadores por aula (T18–T21)

- **T18** — El criterio de aula válida juzga de verdad: veredicto propio contra
  el de la hoja, con el contraste ya escrito.
- **T19 ☑ (2026-08-20, 23 tests R + 5 TS)** — «Qué descarta cada filtro», en
  Validación. Antes sólo viajaba el total de válidas, y con un total no se sabe
  si el criterio trabaja.
  - **Invariante verificado con el dato real**: la cadena deja **2 220** y el
    KPI del perfil dice VÁLIDAS **2 220**. El fixture no guarda las respuestas,
    así que esto sólo se podía comprobar en pantalla, y se comprobó.
  - **Y desmintió mi propia hipótesis.** Escribí que los dos filtros
    —`sexo = F/M`, `p01 = 1/2/3`— aceptaban todos los valores posibles y que los
    dos darían «caen 0». Medido: **`sexo` no descarta ni una, pero `p01`
    descarta 1 480 de 3 700 — el 40 %**. Leer la config no es medir los datos.
  - **Dos cuentas con nombres distintos**: `caen` en cascada (depende del orden)
    y `caen_solo_aqui` exclusivas (no depende). El panel sólo muestra la segunda
    cuando difiere de la primera: repetir el mismo número con dos rótulos
    confunde en vez de informar.
- **T20 ☑ (2026-08-20, 6 tests)** — Ficha del curso-horario: las cuatro fuentes
  del operativo en una lectura —lo esperado, lo que llegó a plataforma, lo que
  anotó el campo y lo que contó el libro—.
  - **Verificada en pantalla con un aula real**: `CH 52` de Letras da esperaba
    **15** de 22 elegibles, plataforma **13** (brecha 2), campo **13**, libro
    **14**. Tres cifras del mismo hecho que sólo se pueden comparar aquí.
  - **Enlazable**: el clic escribe `?…&foco=aula:CH 52`, así que la ficha se
    puede mandar por su URL. Va inline gobernada por `foco`, como el detalle de
    facultad de esta misma sección: no hacía falta un sideover nuevo.
  - **Un defecto propio corregido al verlo**: con el parte presente pero sin
    asistentes anotados, el pie decía «— asistentes», que se lee como una cifra
    rota. Ahora dice cuál falta.
  - **El disparador está donde se puede**: `AulasLoQueFalta` es el único sitio
    que lista aulas pintando sus propias filas —`DataTable` no admite render por
    celda—. La ficha se montó primero en la pestaña equivocada: el disparador
    vivía en `base` y la ficha en `registro`.
- **T21 ☑ (2026-08-20, 5 tests)** — «De dónde se saca», dentro de la ficha y
  **sólo cuando hay brecha**: un aula que llegó a lo suyo no necesita esa
  sección, y pintarla vacía sería un hueco sin propósito (C3).
  - **La cuenta es de SU facultad**, porque la cuota es por facultad: veinte
    reservas libres no sirven si la que perdió el aula tiene cero. Verificado en
    pantalla: `CH 52` → «Le faltan 2. En Letras y Ciencias Humanas queda 1
    reserva sin usar».
  - **Reusa `colchonPorFacultad()`**, el mismo cálculo que pinta el panel del
    colchón. Dos cuentas de lo mismo se separarían en la peor forma: la ficha
    diciendo que hay de dónde sacar y el panel de al lado que no. Hay un test
    que las compara —y que exige que el caso traiga reservas de verdad, porque
    con las dos en cero pasaría sin comprobar nada—.
  - **El banco de extras se queda fuera a propósito**: tiene su propio panel con
    tasa observada y banda, y repetir aquí una versión sin banda daría una cifra
    más optimista y sin su incertidumbre.

### E. Forma y arquitectura (T22–T25)

- **T22 ◐ (2026-08-20)** — Base de control. **El diagnóstico del plan estaba
  desactualizado**: decía «26 columnas crudas» y las columnas siguen siendo 26,
  pero de crudas nada —ya tenían bloques como el libro, columnas vacías
  ocultas, alineación de cifras y escala de proporciones—.
  - **Lo que sí estaba mal, medido en pantalla**: la tabla mide **2 677 px en un
    marco de 892**, así que **el 67 % de sus columnas quedaba fuera de vista** y
    nada lo decía. Se alcanzaban con scroll (C4 cumplido), pero el corte se veía
    como si la tabla acabara ahí: «70T» y «VÁLIDAD…» aparecían truncadas sin
    explicación.
  - **Hecho**: sombra de desplazamiento en las tablas de aulas —dos gradientes
    anclados al contenido y dos al marco, sin JS— y el encabezado declara
    «152 filas de la hoja · **26 columnas**». El número sale de
    `columnasDelControl()`, **la misma cuenta que hace la tabla**, para no tener
    dos definiciones que se separen.
  - **Y la otra mitad, hecha**: entre el veredicto y la tabla flotaban **tres
    líneas de procedencia** —quién llena los validadores, cuántas filas trae
    cada bloque, qué bloque vino vacío— con tres estilos distintos y sin nada
    que dijera que eran lo mismo. Van juntas en su propia caja: el panel pasa de
    seis elementos sueltos a **cuatro bloques** —tarjetas, veredicto,
    procedencia, tabla—. **Cuesta 7 px de alto** (342 → 349) y los vale: eran el
    ruido que competía con el resultado. Ningún texto se borró.
  - **Marcado ◐ y no ☑ a propósito**: «se ve fatal» es un juicio de Gonzalo y lo
    cierra él, no el gate.
- **T23 ◐ (2026-08-20)** — Agenda. **Medido: casi todo ya existía.** La división
  por facultad vive en la pestaña `modelo/facultad` («A dónde ir cada día»):
  agrupa las **196 aulas en sus 20 facultades** por día, con hora, código, aula,
  docente y estado, y las reservas salen ahí con su fecha.
  - **Las 12 columnas de `modelo/agenda` son deliberadas**: son el ciclo de
    contacto —a quién llamo, por qué medio, cuándo, cuántos intentos, en qué
    quedó, para cuándo— y sólo viven ahí. «A quién reemplaza» se quitó a
    propósito para hacerles sitio.
  - **Lo que quedaba de la queja, hecho**: en «A dónde ir cada día» un `R 21.1`
    aparecía junto a `CH 21` sin decir que lo estuviera reemplazando. Ahora cada
    reserva lleva **«reemplaza a CH 21»** bajo su código. No toca el estado
    —que sigue siendo el operativo, porque antes de salir lo que se pregunta es
    si el aula ya se aplicó—, lo dice aparte.
  - **Y el recorte que trajo**: con la marca debajo, la columna del código
    recortaba el identificador del titular —74 px para un texto de 94—. Pasó a
    98 px, **fijos y no `max-content`**: cada fila es su propia grilla, así que
    dejarla crecer habría desalineado las columnas entre filas.
  - **Tercer ítem seguido que este plan describía mal** —con T16 y T22—. El plan
    se escribió la mañana del 2026-08-20 y describe el estado de entonces:
    **comprobar si ya está hecho antes de construirlo**.
- **T24 ◐ (2026-08-20, 3 tests)** — El reemplazo alcanzable. **Medido: la acción
  existe sólo dentro del formulario de un aula** en el registro de campo
  (`apiMonitoreoAulasActivarReemplazo`, botón «Activar reemplazo», visible sólo
  si el estado lo permite —una aplicada no se reemplaza—).
  - **Hecho**: el registro **se abre por dirección**. Llegar con
    `?foco=aula:CH 52` deja esa aula seleccionada y su formulario puesto;
    verificado en pantalla. Antes la selección vivía en un `useState` suelto que
    la URL no podía alcanzar —contra la regla de la casa— y había que buscar el
    aula entre 196 filas.
  - **Falta**: el enlace desde la ficha («registrar cómo fue en campo»). La
    ficha vive en una función de render que no puede cambiar de pestaña sin
    tocar su firma; se quitó a medio hacer en vez de dejarlo colgado.
- **T25** — Pasada de forma sobre Validación entera, con el gate visual en los
  dos viewports.

## Lo aprendido al medir (2026-08-20)

**Los dos bloques que parecían más ambiciosos no estaban bloqueados: estaban en
otro proyecto.** Medir antes de construir ahorró diseñar cinco ticks contra una
base sin `start`/`end` y seis contra una sin preguntas abiertas — y encontró
dónde sí se pueden verificar.

De ahí una regla que este plan adopta: **cuando el fixture del perfil no sostiene
una capacidad, buscar en los proyectos de referencia antes de declararla
bloqueada.** Hay cinco y no todos traen lo mismo.

Y la contraria, igual de importante: **una capacidad verificada contra otro
proyecto no está verificada en éste.** En aulas, las dos superficies tendrán que
decir «este estudio no trae eso» — que es información, no un hueco.

## Reglas de este plan

1. **Primero la finalidad, después el píxel.** Cada superficie declara a quién
   sirve y qué decide.
2. **Medir antes de diseñar.** Varios ticks empiezan por comprobar si el dato
   existe; si no, es deuda declarada y no se fabrica.
3. **Nada de fallbacks callados.** Sin vara, «sin juzgar».
4. El orden es una propuesta, no un contrato: Gonzalo puede reordenar.
