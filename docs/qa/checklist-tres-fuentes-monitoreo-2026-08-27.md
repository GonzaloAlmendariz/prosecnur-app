# Checklist dimensionado: las tres fuentes de Monitoreo

Tipo: Checklist de trabajo
Estado: Vigente
Fecha: 2026-08-27
Autoridad: Encargo de Gonzalo del 2026-08-27 — «saber si a nivel de la agendación todo ya está bien y se toma en cuenta, luego a nivel de registro de campo, y a nivel de base de control». Calibrado con el campo real de 2025 y probado sobre la selección real de HSVG2026

Un operativo de aulas se lee de **tres fuentes** y cada una responde una pregunta
distinta. El checklist se dimensiona por ellas, más una cuarta banda transversal.

Estados: ☑ **cubierto** · ⚠ **parcial** (existe pero no basta) · ☐ **falta** ·
⛔ **bloqueado** (espera decisión de Gonzalo).

---

## A · AGENDACIÓN — «¿tenemos con quién y para cuándo?»

Hoja «Aulas Agendadas». Responde el trabajo de **quien llama al docente**.

| # | Qué | Estado | Dónde vive |
|---|---|---|---|
| A1 | El ciclo de contacto completo en la tabla: a quién, por qué medio, qué día, cuántos intentos, en qué quedó, para cuándo | ☑ | `AulasMonitoreoPage` · agenda |
| A2 | Aviso de riesgo por insistencia — **la tercera gestión dobla la caída** (36-38 % contra 17-19 %, medido 2025) | ☑ | `agendamiento.ts` · `UMBRAL_DE_RIESGO` |
| A3 | Aviso por **sin medio de contacto** — en 2025 fueron 14 de 170 y **cayeron las catorce** | ☑ | `agendamiento.ts` |
| A4 | Anticipación: cuántos días antes hay que llamar | ☑ | `DIAS_DE_ANTICIPACION = 7`; medición independiente da **exactamente 7** |
| A5 | Las reservas dormidas no se cuentan como «por agendar» | ☑ | `seVaAAgendar()` |
| A6 | El recorte del payload se declara donde se leen sus cifras | ☑ | franja: «contado sobre 500 de 1 512 filas» |
| A7 | **`TASA_DE_CAIDA = 0.235` no se reproduce desde el libro de 2025**, y «caída» significa dos cosas | ⛔ | medido sobre el libro real: ver § abajo. **Mi «16 % / 36 %» anterior era falso y queda retirado** |
| A8 | **El eje de `sample_status` no se declara**: sigue la **agendación**, no la aplicación, y en pantalla se lee como «el estado del aula» | ☐ | ver § «El error de medición» |
| A9 | **El gráfico de aulas agendadas se comprime demasiado** (Gonzalo) | ☐ | `AulasAgendaPorDia` |
| A10 | **Se sigue agendando en la semana 2** — en 2025 **no**: una sola llamada. Ninguna superficie lo dice | ☐ | — |

---

## B · REGISTRO DE CAMPO — «¿qué se recogió y a qué ritmo?»

Parte de campo. Responde el trabajo de **quien va al aula**.

| # | Qué | Estado | Dónde vive |
|---|---|---|---|
| B1 | Ritmo diario y por semana, con su mejor día | ☑ | `AulasRitmoDiario` |
| B2 | El embudo del aula: asistentes → rechazos → duplicados → efectivas | ☑ | `AulasEmbudoDelAula` |
| B3 | Rendimiento por facultad día a día, con la vara del diseño | ☑ | `serieDeRendimiento` (E7) |
| B4 | Las dos llegadas: con lo que rinde el campo y con lo que pedía el diseño | ☑ | E5 |
| B5 | **El «hoy» del estudio**: `generated_at` **no es el corte** — dice «al 27 de agosto» con el estudio sincronizado al 12/09 | ☐ | `AulasMonitoreoPage:1572` (S4) |
| B6 | **Decimales sobre personas**: «1 306,3 cubren meta» | ☐ | S3 |
| B7 | **Las cuatro cifras de «cuántas encuestas hay»** conviven sin distinguirse: asistentes → **enviadas** → válidas → efectivas del parte. Entre enviadas y válidas se pierde el **9-13 %** | ⚠ | veta «una palabra para dos cosas» |
| B8 | **«El parte contra la plataforma» da un diagnóstico equivocado y manda a arreglar lo que no está roto** | ☐ | ver § abajo |

---

## C · BASE DE CONTROL — «¿el control de calidad cuadra?»

Hoja «Base de control». Responde **si lo recogido vale**.

| # | Qué | Estado | Dónde vive |
|---|---|---|---|
| C1 | Se llena entera y a tiempo | ☑ | medido: **190 de 190** aulas de las tres primeras semanas traen reparto por sexo, enviadas y asistentes |
| C2 | Reparto por sexo aula por aula, y la serie que lo dibuja | ☑ | `serieDeRendimiento` |
| C3 | Reconciliación parte ↔ control (asistentes, % asistencia, quién aplicó) | ☑ | control `book_sheets_cross_check` |
| C4 | 7 columnas con datos y cabecera vacía | ☑ | **funciona como debe**: el control las detecta y da el remedio —«ponles nombre en la hoja para que entren»—. Sin cabecera no hay a qué campo mapearlas; el arreglo es del Excel, no de la app |
| C5 | El reemplazo de 70T / 70P | ☑ | **ya está hecho**: ver § abajo |

---

## D · TRANSVERSAL — filtros, procedencia y forma

| # | Qué | Estado | Nota |
|---|---|---|---|
| D1 | **Definir los filtros de encuesta válida desde la app** | ☑ | **Sí existe**: `guardarCriterio` escribe `valid_filters` y el panel enseña «cuentan N de M». Era la octava vez en esta sesión que verificar antes de declarar una ausencia evitó una afirmación falsa |
| D2 | **Ver QUÉ respuestas no pasan y por cuál filtro** | ☑ | **Existe de punta a punta**: `monitoreo_aulas_cadena_filtros()` publica el desglose con **dos lecturas distintas** —`caen` en cascada y `caen_solo_aqui`— y `AulasCadenaDeFiltros` lo dibuja. No lo veía porque **mi fixture declaraba `valid_filters` vacío**. Novena falsa ausencia de la sesión |
| D8 | **El embudo de Fuentes cuenta las descartadas con otro criterio que la etapa de al lado** | ☐ | ver § abajo — dice «−67 descartadas» y caen **174** |
| D3 | **Declarar el instrumento** (qué XLSForm rige) desde Fuentes | ☐ | distinto de D1 |
| D4 | **La meta cuenta reservas dormidas**: hoy 26 543, sumando las 1 259 reservas que sólo entran si cae su titular | ◐ | **DECIDIDO (27-08): la meta es el `n_objetivo` del escenario ACTIVO → 2 500.** Falta aplicarlo. Ver § abajo |
| D16 | **La selección no estampa a qué componente pertenece** | ☐ | el vínculo entre el sorteo y su objetivo se deduce por coincidencia de un número; por eso 165 y 174 convivieron sin que nada chillara |
| D17 | **`aulas_base_total` del componente queda viejo cuando el sorteo se recorre** | ☐ | el componente activo guarda 165 y el sorteo, 47 min posterior, dio 174. Nada marca la cifra como caduca |
| D5 | **C-F procedencia**, tercera pregunta: ¿de qué corrida del sorteo sale cada cifra? | ⚠ | sólo el KPI «Cursos-horario» estampa el `selection_run_id` |
| D6 | **Abuso de tablas sin complemento visual** (Gonzalo) | ☐ | ver § abajo |
| D7 | **Códigos poco entendibles para una persona común** (Gonzalo) | ☐ | «CH 1», «M1», `sin_contactar`, «70T» |
| D9 | **Cifras que no se leen: texto oscuro sobre barra oscura** (Gonzalo) | ☑ | medido, no juzgado a ojo: 5 de 8 etiquetas bajo 3,0 de contraste. Ver § abajo |
| D10 | **Cifras partidas a media cifra** en «Dónde falta más» (Gonzalo) | ☑ | «7,006» rompía como «7,00» / «6»: el `<strong>` encogía bajo su contenido dentro de 128 px |
| D11 | **Dos facultades distintas que se leen igual** | ☑ | «ESTUDIOS GENERALES LETRAS» y «… CIENCIAS» truncaban ambas a «ESTUDIOS GENERALES …» |
| D12 | **Las facultades siguen desalineadas** (Gonzalo, 2ª pasada) | ☑ | `.aulas-facultad-nombre` es un `<button>` y **un botón centra su texto**: nadie declaró `text-align` y se heredaba del user-agent |
| D13 | **Todos los números son bastante pequeños** (Gonzalo, 2ª pasada) | ☑ | `layout.font` de Plotly gobierna el tick **y** la cifra dentro de la barra: el dato salía a 10 px, tamaño de mobiliario de eje |
| D14 | **Verificar que Plotly no encoja de vuelta las cifras de 12 px** | ☑ | medido con los anchos reales: **no encoge**. Ver § abajo |
| D15 | **La pareja de Avance no termina a la misma altura** (Gonzalo) | ☑ | escalón de **31 px**; la paridad se sostenía con dos números casados a mano en dos archivos. Ver § abajo |

---

## El error de medición que Gonzalo cazó

Reporté que 78 de 174 filas decían «Aplicada» y «Sin contactar» a la vez. Gonzalo
objetó: **«en 2025 no se lleva un aula si no se había agendado previamente con el
docente»**. Tenía razón y el error era del generador.

Medido sobre el libro real:

- Las **149 aulas aplicadas tienen llamada previa registrada. Cero excepciones.**
- Su `STATUS MUESTRA` es `AGENDADA` (119), `EN RESERVA 1` (19), `REAGENDADA` (8)
  o `REEMPLAZADA` (3). **Ninguna dice «aplicada».**

`sample_status` **sigue el eje de la agendación**, no el de la aplicación. Yo
sembré «aplicada» ahí, un valor que no existe en esa columna, y fabriqué las 78
contradicciones. Generador corregido.

**Qué queda en pie y qué no**: el marcador (`estadoDeMuestraLegible.ts`) es
correcto por construcción —«sin contactar» y «ya se aplicó» no pueden ser ciertos
a la vez— pero **no tiene un caso real conocido**, y las 78 que reporté eran mías.
Queda como guarda, no como hallazgo.

**Lo que sí es hallazgo, y es A8**: la columna se titula «STATUS DE MUESTRA» y no
dice de qué eje habla. Un lector la interpreta como el estado del aula.

## El 165 contra 174: tampoco era lo que dije

Reporté que el workspace guardaba un **165 desfasado**. **No es desfasado: es el
otro escenario.** Verificado sobre el estado real:

| componente | estratos con `aulas_base_fijas` | suma | `aulas_base_total` |
|---|---|---|---|
| `cmp-cine0qk8` · Universidad | 15 | **0** | **165** |
| `cmp-cine0qk8-fac` · Facultades | 15 | **174** | **174** |

La app abre en **P1 · Universidad**, donde el objetivo es 165; el sorteo real se
hizo con **P2 · Facultades**, donde viven las 174. La cifra es vigente — lo que
falta es que la pantalla diga **de qué escenario** habla la que enseña, que es
exactamente D5.

## Sobre las tablas sin complemento visual

Inventario del perfil: **10 gráficos** (uno por cada ~3 tablas) y la sección de
Agenda es **tabla pura** salvo la franja de días. Lo que Gonzalo describe se
concentra ahí y en Consultas.

Candidatos con dato ya disponible, sin motor nuevo:

- **Agendación**: el embudo `por agendar → gestionadas → agendadas → aplicadas`
  como barra apilada. Hoy son cuatro tiles sueltos.
- **Contactabilidad**: histograma de gestiones con el umbral 3 marcado. La
  distribución existe (`intentos`), sólo se publica su mediana.
- **Base de control**: la pérdida `enviadas → válidas` como banda, que hoy no se
  dibuja en ningún sitio.


## D8 · «−67 descartadas» cuando caen 174

Con los filtros del instrumento sembrados —consentimiento y screener de más de un
ciclo— el embudo de **Fuentes** dice:

> RESPUESTAS RECIBIDAS **1 811** · *−67 descartadas por el filtro*
> ENCUESTAS QUE CUENTAN **1 637** · pasan el filtro de efectividad

**1 811 − 1 637 = 174**, no 67. Las dos etapas del mismo embudo cuentan con
criterios distintos:

- «Encuestas que cuentan» sale de `respuestas_validas`, o sea de la **cadena de
  filtros declarada**.
- La merma sale de `filter_rejected`, que se calcula con
  `.monitoreo_aulas_filter_passed()`.

Y esa función **no mira la cadena declarada**: busca en la base una columna
llamada `filter_passed`, `pasa_filtro`, `apto`, `elegible`, `eligible`,
`screening_status`, `estado_filtro`, `consent` o **`consentimiento`**, y si la
encuentra, cuenta sobre ella. Como el instrumento de este estudio abre con la
pregunta de consentimiento, **la columna se llama exactamente así**, y la merma
pasó a ser la caída de ese único filtro (1 811 ÷ 27 ≈ 67) en vez de la de los dos.

Es la familia de «una lista cerrada se traga lo que no reconoce», del revés: una
lista que **reconoce de más**. Un estudio que nombre su variable de consentimiento
de la forma natural ve su embudo medido por esa columna y no por el criterio que
declaró.

**La regla que falta**: cuando el estudio declara `valid_filters`, la cadena
declarada manda; la heurística por nombre de columna es el camino para estudios
que no declaran nada.

**No lo reparo todavía** porque toca `monitoreo_aulas_universitarias.R`, que es
archivo congelado a crecimiento, y porque la heurística existe para un caso real
—estudios sin criterio declarado— que hay que preservar. Queda medido y con la
regla propuesta.


## B8 · un diagnóstico seguro y equivocado

Con los filtros del instrumento declarados, el panel «El parte contra la
plataforma» dice:

> ⚠ **Las dos fuentes no se corresponden.** Descuadran **74 de 78** cursos-horario
> comparables. Con esa proporción el problema no está en lo que anotó el campo:
> es que **las respuestas no se están atribuyendo al mismo curso-horario** que
> declara el parte. Revisa qué columna identifica el aula en la base, en Fuentes.

**La atribución está perfecta.** Medido sobre los mismos datos: el filtro descarta
al menos una respuesta en **exactamente 74** de las 78 aulas, y en las otras **4**
no descarta ninguna. El descuadre es el filtro, no la atribución.

Las dos cifras que compara son **legítimamente distintas**:

- el **parte** declara `effective_surveys`, lo que el aplicador contó en el aula;
- la **plataforma** aporta las respuestas **que pasan la cadena de filtros**.

En cuanto un estudio declara un criterio de validez, las dos dejan de coincidir
**por diseño**. El panel interpreta esa diferencia como fallo de atribución,
afirma que «el problema no está en lo que anotó el campo» y manda a revisar una
columna que está bien. Un analista se iría a cazar un problema inexistente.

Es la veta de siempre —dos cosas distintas con el mismo nombre, aquí «encuestas
del aula»— y la cuarta cifra del catálogo de B7.

**La regla que falta**: antes de acusar a la atribución hay que descontar lo que
el filtro explica. Si `parte − plataforma ≈ descartadas por el filtro`, no hay
descuadre que reportar; y si sobra diferencia después de descontarlo, **ésa** es
la que apunta a la atribución.

## Las tres piezas visuales, cerradas y vistas

**Encargo de Gonzalo**: «hay muchas tablas por todas partes, pero no hay ningún
elemento visual que lo complemente».

| pieza | dónde | qué enseña | visto |
|---|---|---|---|
| **Escalera de la cadena de filtros** | Validación · registro | qué filtro cuesta más, en escala común | ☑ «de 1 811 la cadena deja 1 637», pasos a 96,3 % y 90,4 % |
| **Histograma de gestiones** | Agenda, panel propio y **plegado** | la cola que la mediana esconde | ☑ 55·90 y cola de 7·5·7·6·4 = **29** |
| **Banda de pérdida** | Validación · base | la cuarta cifra, sin representación hasta ahora | ☑ «de 2 009 enviadas cuentan 1 811 · se pierden 198 (90 % pasa)» |

### Lo que costó cada una, que es la parte reutilizable

- **Medir contra lo que el consumidor consume.** El histograma salía vacío por
  leer `course_status` —recortado a 500 filas y con menos columnas— en vez de
  `dashboard.agenda`, **con los tiles de al lado marcando 119 y 29 sobre los
  mismos datos**.
- **La sección es de política `viewport`: sus paneles se reparten el alto.** Un
  panel nuevo abierto dejó la franja de días del vecino en **0 px**. El propio
  panel lo advertía en su comentario. Se repara plegando, no con `min-height`:
  eso la devuelve pero **invade la tabla 78 px**, y el CSS ya decía «acotar el
  ELEMENTO no sirve, hay que acotar la PISTA».
- **Un token se verifica por su valor computado**, no por encontrar su
  definición. Medidos en esta página: `--pulso-accent`,
  `--pulso-module-accent`, `--pulso-ok-fg` y `--pulso-danger` salen **vacíos**;
  `--pulso-primary`, `--pulso-success-fg`, `--pulso-warn-fg` y `--pulso-text`
  resuelven.
- **Una fixture que no siembra un bloque hace parecer inexistente su
  superficie.** Pasó tres veces: sin `efectivas_esperadas` no había vara del
  diseño, sin `valid_filters` no había cadena de filtros, y sin `libro` no había
  Base de control. La tercera vez ya era patrón.

### Rótulos largos en columnas de cifras — criterio abierto

Gonzalo lo señaló sobre «Número de intentos»: celdas de **un dígito** y ~150 px
de columna, porque `.es-cifra` lleva `white-space: nowrap` y **la cabecera fija
el ancho**. Ahora es «Intentos» y mide **78**.

Es una familia, no un caso:

| rótulo | ancho | nota |
|---|---|---|
| «Nivel del curso» | **122 px** sobre dígitos sueltos | **no tocado**: es canónico del mapeo de Cálculo y tiene tests allí |
| «Cantidad de asistentes» | | su comentario dice que copia el nombre del libro **a propósito** |
| «Cantidad de efectivas» · «Cantidad de rechazos» | | «cantidad de» es redundante en una columna de cifras |
| «Estudiantes del sexo mayoritario» | 31 caracteres | junto a una columna «Sexo mayoritario» |

**Decisión pendiente de Gonzalo**: hay tensión real entre fidelidad al nombre del
libro —que sirve para cruzar con el Excel— y el ancho. No se resuelve por cuenta
propia.

## D9-D11 · lo que se veía mal, medido

Gonzalo lo dijo mirando por encima: «veo barras con colores oscuros y texto negro
que casi ni se nota, o diseños desalineados con texto gigante». Las tres cosas
eran reales y ninguna se parecía a las otras.

**El texto sobre las barras.** Plotly elige solo el color del texto que va DENTRO
de una barra, y su heurístico se equivoca justo en el medio de la escala: sobre
`pendiente` (#7a8796) dejaba su gris #444. Contraste **2,66**. La misma barra con
la tinta de la casa da **4,43**.

| etiqueta | dónde | antes | ahora |
|---|---|---|---|
| `79` | Status de aplicación | 2,66 | **4,43** |
| `1355` → `1,355` | Cursos-horario por cobertura | 2,66 | **4,43** |
| `1,259` | Status de aplicación | 3,78 | **6,30** |
| `38` · `34` · `6` | Cursos-horario por cobertura | 5,01 | **16,22** |

Medir antes de reparar evitó tres reparaciones inventadas: `38`, `34` y `6`
**caían fuera de la barra**, sobre papel blanco, y ya estaban bien. Sólo se ven
mal si uno compara el texto contra el relleno del `path` hermano sin mirar dónde
cae la caja. El criterio correcto es geométrico, no de parentesco en el DOM.

El arreglo no recolorea nada: `tintaSobre()` elige, entre la tinta oscura de la
app y el blanco, la que más contrasta con el relleno que ya existe. Su contrato
(`tintaLegible.contract.test.ts`) exige **4,3 y no 4,5**, y eso está declarado:
`efectiva`, `parcial` y `pendiente` tocan techo en 4,37-4,43 con cualquiera de
las dos tintas. Llegar a los 4,5 de WCAG exige oscurecer la paleta, que es una
decisión de identidad —arrastra a PPT y PDF, que leen los mismos hex— y no de
este helper. **Un contrato que afirmara 4,5 excluyendo a los tres que no llegan
sería verde por ausencia**, que es justo lo que esta sesión viene evitando.

De paso: Cobertura escribía `String(t.aulas)` → «1355» a dos centímetros del
«1,259» del panel de al lado. El mismo número en dos formatos. El comentario del
otro gráfico ya avisaba de ese defecto —arreglado ahí, no aquí—.

**Segunda pasada: lo que seguía mal después de arreglar el contraste.**

Gonzalo volvió a mirar y señaló tres cosas más. Las tres eran ciertas y ninguna
la había cazado yo, porque las tres viven en un default que nadie escribió.

*Las facultades desalineadas* no eran el truncado —eso ya estaba arreglado—:
`.aulas-facultad-nombre` es un `<button>`, y **un botón centra su texto por
defecto**. Con los nombres centrados, «DERECHO» arranca en x≈128 y «ESTUDIOS
GENERALES LETRAS» en x≈83: la columna se lee como un bloque irregular en vez de
como una lista. Ninguna regla del proyecto declaraba `text-align`; el valor lo
ponía el user-agent. Es el mismo patrón que el `white-space: nowrap` heredado
del padre: **el estilo que gobierna no está en el archivo que uno lee**.

*Los números pequeños* salen de que `layout.font` de Plotly gobierna dos cosas
distintas con un solo valor: los ticks del eje **y** el texto dentro de la
barra. `fuenteDeEjeAulas()` declara 10 px porque los ejes de este perfil van a
10 px —decisión deliberada, documentada ahí mismo—, y de propina la cifra sobre
la barra heredaba el tamaño de una marca de eje. Pero **el tick es mobiliario y
el número sobre la barra es el dato**. Se separan: `fuenteDeCifraEnBarra()` a
12 px semibold, el eje se queda donde estaba.

*El «79» que se sigue viendo gris* es la misma cosa por el otro lado. Su relleno
**es** gris (`pendiente`), y eso no se toca sin recolorear la paleta. Pero 4,43
de contraste a 10 px se siente flojo y a 12 px semibold no: es exactamente la
razón por la que WCAG pide 4,5 en texto normal y acepta 3,0 en texto grande. El
contraste y el tamaño no eran dos quejas: eran una.

**Las cifras partidas.** `.aulas-facultad-cifra` era un flex dentro de una
columna de 128 px, compartida con «respuestas faltan · 3%». El `<strong>` encogía
por debajo de su contenido y «7,006» se rompía **a media cifra**. Pasa a grid
alineado a la derecha, con la cifra sobre el rótulo y `white-space: nowrap`.

**Las dos facultades idénticas.** El rótulo truncaba a una línea en 190 px, así
que «ESTUDIOS GENERALES LETRAS» y «ESTUDIOS GENERALES CIENCIAS» quedaban las dos
como «ESTUDIOS GENERALES …»: dos filas con cifras distintas (3 245 y 2 908) y el
mismo texto visible. Ensanchar la columna vuelve a aplastar las cifras; abreviar
sería inventar nombres. Se le dan dos líneas: las cortas siguen ocupando una.

Con eso, **las 15 facultades se leen enteras y no queda ninguna colisión**.

La trampa del arreglo merece nota: el primer intento fue `-webkit-line-clamp`
con `display: -webkit-box`, y **el clamp se aplicaba pero no hacía nada**. El
rótulo es item de un grid, y un grid item blockifica su display: quedaba en
`flow-root` y el box legacy nunca existía. El computado lo dice —`clamp: 2` con
`display: flow-root`— pero sólo si uno lo lee en vez de asumir que la regla que
ganó la cascada es la que gobierna. Además `white-space: nowrap` no venía de
ninguna regla propia: **se heredaba del botón padre**.

### D14 · el riesgo de subir el tamaño, que hay que medir

Subir la cifra a 12 px puede deshacerse solo. `AulasEstadoChart` usa
`textposition: "inside"` fija, y Plotly trae `constraintext` activo por defecto
en barras: **si el texto no cabe en el segmento, lo encoge para que quepa**. Los
segmentos de «sin agendar» (79), «agendada» (96) y «aplicada» (78) son
estrechos, así que sus cifras podrían volver a ~10 px por su cuenta y dejar la
mejora sólo en los tramos anchos.

**Medido, y el riesgo no se materializa.** Con los anchos reales de los cuatro
segmentos, pedir 12 px da 12 px computados en los cuatro, con el `weight: 600`
aplicado y todos cabiendo dentro de su barra:

| cifra | ancho de su barra | pedido | computado | ¿cabe? |
|---|---|---|---|---|
| `79` | 56 px | 12 | **12 px** | sí |
| `96` | 68 px | 12 | **12 px** | sí |
| `78` | 55 px | 12 | **12 px** | sí |
| `1,259` | 894 px | 12 | **12 px** | sí |

Se midió el `font-size` **computado del `<text>` en el SVG**, no el que pedimos
en el trace —que es la diferencia entre declarar y comprobar—, y se comparó
contra una corrida idéntica pidiendo 10 px para tener el contraste del método.

Lo interesante es **cómo** se midió, porque la librería R estaba bloqueada por
la instalación de una tercera sesión y sin paquete no se puede abrir un `.pulso`:
se montó el mismo trace en una página suelta servida por el propio dev server,
con los anchos y las cifras reales. **Una pregunta sobre Plotly no necesitaba la
app entera para contestarse**, y eso desbloqueó una verificación que parecía
tener que esperar media hora.

### D15 · un ajuste no es un criterio

Gonzalo lo dijo señalando el panel: «éste tiene menos altura que el de su lado,
¿ves? Son esas cosas las que me hacen dar cuenta de que no tiene muchos criterios
muchas veces». Tenía razón en el hecho y, sobre todo, en el diagnóstico.

**El hecho, medido.** Los dos paneles de `.aulas-avance-pareja` terminaban con
31 px de diferencia: 464 contra 495.

| | izquierda | derecha |
|---|---|---|
| cabecera | 36 | 36 |
| cuerpo | **392** = gráfico 360 + pie 26 + hueco 6 | **422** = lectura 14 + hueco 8 + lista 400 |

**La causa no es un descuido, es una ausencia de mecanismo.** La paridad existía
y era deliberada: el CSS de la lista decía «400 px […] con el gráfico vecino a
360 los dos paneles quedan a la par», y el TSX del gráfico decía «sube a 360 para
que la pareja quede pareja». Dos comentarios que declaran la misma intención, dos
constantes en **archivos que no se referencian**. Cuando después se añadió la
línea «15 facultades · 0 con su meta cumplida», quien la añadió no tenía forma de
saber que acababa de romper un equilibrio: nada en su archivo lo mencionaba.

Un ajuste sólo aguanta hasta el siguiente cambio. Un criterio sobrevive.

**El arreglo es el mecanismo, no el número.** Un solo token en la hoja, y el tope
de la lista derivado de él con la cuenta escrita:

```css
--aulas-cobertura-alto: 360px;
max-height: calc(var(--aulas-cobertura-alto) + 10px);
```

Los +10 son el pie del gráfico (26) y su hueco (6) menos la lectura de la lista y
los suyos (22). El TSX ya no guarda su copia del 360: lo lee de la hoja con
`altoDeclarado()`, el mismo idiom con el que `fuenteDeEjeAulas()` ya leía los
colores. **Mover el alto del gráfico ahora mueve el tope de la lista solo.**

Escalón resultante, medido: **1 px**.

**Lo que NO se tocó, y por qué.** El `align-items: start` de la pareja es una
decisión documentada: forzar `stretch` estiraba el gráfico —cuyo alto fija
Plotly y por tanto no puede crecer— y el gate lo marcó como `capacity-drift` de
380 px de hueco muerto. Así que la igualdad no se impone desde fuera: se hace que
el lado que **sí puede** encoger (la lista, que scrollea) se ajuste al que no
puede. Sin vacío sin dueño.

**El patrón general, que es lo aprovechable.** Cuando dos valores tienen que
moverse juntos y viven separados, el comentario que explica la relación no la
protege —la documenta para quien ya está mirando ese archivo, que es justo quien
no la va a romper—. La rompe el que toca el otro. La única defensa es que exista
**una sola fuente**, o un gate que compare las dos.

### D4 · decidido — la meta es 2 500, y el 165 era una foto vieja

**La decisión (Gonzalo, 27-08).** «Cumplimiento en respuestas» mide contra el
`n_objetivo` del **escenario activo** del cálculo de muestra. Hoy eso es **2 500**.
No es hardcodear un número: es leer el objetivo del componente cuyo escenario
está activo, coherente con que lo que declara Cálculo de muestra es lo que
Monitoreo usa.

**Las cuatro varas, con su procedencia verificada en el `.pulso` real:**

| vara | qué es | dónde vive |
|---|---|---|
| **2 500** | `n_objetivo` de Universidad — la fórmula da 2 310, redondeado a múltiplo de 100 | `cmp-cine0qk8`, escenario **activo** |
| 3 750 | `n_operativo` del mismo: 2 500 + 1 250 de sobremuestra | mismo componente |
| 4 050 | `n_objetivo` de Facultades — fórmula 3 727 | `cmp-cine0qk8-fac`, **inactivo** |
| 3 150 | suma del `expected_valid` de las 174 titulares: lo que el diseño predice | derivado del plan |

**El susto del 165 contra el 174, y por qué se resuelve.** El componente activo
declara `aulas_base_total = 165`; el sorteo que salió a campo tiene **174** aulas
en 73 estratos. No son dos alternativas: **el 165 está caduco**.

1. El sorteo se sella a las **14:28** y los dos componentes se computaron a las
   **13:41**. Lo que corrió después manda sobre lo guardado antes — ADR 0066.
2. El componente de Facultades es **incoherente consigo mismo**: declara 174
   aulas base pero dice necesitar 294. No puede ser el dueño del sorteo de 174.
3. **La aritmética lo cierra.** Las 174 titulares tienen meta de diseño de 3 150.
   Contra 2 500 eso es un colchón del 26 %, razonable. Contra 4 050 sería el
   78 %: estarías planificando quedarte corto desde el día cero, y un sorteo no
   se diseña para fallar.

**La regla que sale de aquí, y que vale más que el número:** el **objetivo** se
lee del escenario activo; el **número de aulas** se lee de la selección que
corrió, nunca del `aulas_base_total` guardado en el componente.

### El 40 apareció: sale del fixture, no del libro

`TASA_DE_CAIDA = 0.235` se documenta como «medidos sobre la hoja *Aulas
Agendadas* del **libro real**». No sale de ahí. Sale del fixture sintético
`aulas_campo.pulso`, donde los 170 titulares se reparten en **130 aplicadas, 16
agendadas sin aplicar y 24 sin estado**: los no aplicados son 16 + 24 = **40**.

En el libro real la misma cuenta da **21 de 170 = 12,4 %**. Y el 23,5 % no
aparece en ninguna celda de las 19 hojas del libro.

No es un error de cálculo: es un rótulo que atribuye una cifra a una fuente que
no la produce. Mismo patrón que «un rótulo promete otro número», aplicado a la
procedencia en vez de al valor.

### Los libros crecen a lo ANCHO, y ninguna hoja resumen tiene el total

Aviso de Gonzalo, y es una regla para el importador, no una curiosidad de 2025:
los libros de **agendación** y de **registro de campo** ponen un bloque de
columnas por tipo de aula —titular, reemplazo 1, 2, 3…— uno detrás de otro. En
«Aulas Agendadas» son **12 bloques**: el primero de 21 columnas (lleva
`ID.MATCH`) y los once siguientes de 20. La etiqueta lo confirma: el bloque *b*
lleva «Muestra 0*b*».

**Leerlo con paso 21 en todos desplaza los offsets** y hace que el «status» del
bloque 2 salgan fechas y el del 3, nombres de día. Pasó en la primera pasada.

Y lo que de verdad importa: **el total de aulas aplicadas no está en ninguna
hoja resumen.**

| | aulas con fecha de aplicación |
|---|---|
| barrido horizontal completo | **199** |
| hoja «Aulas Aplicadas (Campo)» | 170 |
| de más en el horizontal | **29**, de los que **26 son las «aulas adicionales»** |

Los 170 están todos dentro de los 199. Y **6 de los 29 que faltan son
titulares**: la hoja de campo no es un registro completo ni de su propio tipo de
aula. Leer sólo la hoja que parece completa devuelve un subconjunto sin que nada
avise —y da 143 titulares aplicados en vez de **149**, o sea 15,9 % de caída en
vez de **12,4 %**—.

### A7 · la constante no se reproduce, y «caída» son dos cosas

Medido sobre `Hostigamiento PUCP 2025_BD Aulas Agendadas-6.xlsx`, hoja «Aulas
Agendadas», 170 filas. La hoja repite un bloque por eslabón de la cadena: el
primero tiene 21 columnas (lleva `ID.MATCH`) y los siguientes 20 — leerla con
paso 21 desplaza todo y hace que el status del eslabón 2 salgan fechas.

**Primero: retiro una cifra mía.** Este checklist decía «llamado antes del campo
16 %, llamado durante 36 %, abanico de 2,3×». **No reproduce.** La escribí sin
dejar la derivación, y hoy no la puedo sustanciar. Los números reales están
abajo y el efecto es más fuerte, pero eso no salva la afirmación: era falsa.

**La constante tampoco reproduce.** El código dice «de 170 titulares, 40
necesitaron reemplazo (23,5 %)». Ninguna definición da 40:

| qué se cuenta | n | tasa |
|---|---|---|
| el titular **no llegó a aplicarse** | 21 | 12,4 % |
| `STATUS = REEMPLAZADA` | 24 | 14,1 % |
| **usó algún reemplazo** | 46 | 27,1 % |
| aulas de reemplazo consumidas | 50 | 29,4 % |
| todo lo que no es `AGENDADA` | 51 | 30,0 % |
| **lo que declara la constante** | **40** | **23,5 %** |

**Por qué es difícil: «reemplazo» significa dos cosas.**

| | usó reemplazo | no lo usó |
|---|---|---|
| el titular **sí** se aplicó | **25** | 124 |
| el titular **no** se aplicó | **21** | 0 |

Hay 25 aulas donde el titular salió **y además** entró un reemplazo: eso es
refuerzo, no caída. Las 19 marcadas «EN RESERVA 1» se aplicaron *y* consumieron
reserva. Sólo **21 son caídas** en el sentido que la fórmula necesita —el titular
no ocurrió y hubo que poner otro—. Es otra vez la veta de «una palabra para dos
cosas», ahora en el eje del reemplazo.

**El «efecto de llamar antes» NO existe: es A2 visto por un proxy mal leído.**

Primero medí que llamando antes del 8 de septiembre caía el 5,3 % y llamando
después el 21,3 %, y lo presenté como un abanico de 4× por anticipación. Gonzalo
lo objetó —«casi el 100 % se llamó antes de que empezara el campo»— y al
comprobarlo se cae:

| grupo | n | intentos (mediana) | necesitó >1 intento |
|---|---|---|---|
| llamado 2-5 sep | 95 | **1** | 41 % |
| llamado 8+ sep | 75 | **3** | **88 %** |

**`FECHA.DE.LLAMADA` no registra cuándo se decidió llamar: registra cuándo se
logró contactar.** El equipo llamó a todos desde el 2 de septiembre; los que
contestaron a la primera quedaron fechados 2-5 y los que costaron tres intentos
acabaron fechados 8+. Leí una variable de **resultado** como si fuera una
**decisión**.

La anticipación nunca fue el problema: cero aulas se llamaron después de su
propia sesión, mediana 7 días, mínimo 0.

Lo que hay debajo es la caída por insistencia, que **ya es A2 y ya avisa**:

| intentos | aulas | caen |
|---|---|---|
| 1 | 64 | **4,7 %** |
| 2 | 41 | 14,6 % |
| 3 | 29 | 13,8 % |
| 4+ | 33 | ~20 % |

**Queda vivo de A7 sólo lo primero**: la constante no se reproduce y «reemplazo»
mezcla sustitución con refuerzo. No hay palanca de «llamar antes» que ganar.

**Lo que está en juego.** Para una brecha de 50 aulas, `aulasAPedir` da: 53 al
5,3 %, 58 al 12,4 %, 64 al 21,3 %, 66 al 23,5 % (hoy), 69 al 27,1 %. **Dieciséis
aulas de diferencia** para la misma brecha: cuántos docentes se molestan y cuánta
reserva se quema.

**Pendiente de decisión**, y va en dos pasos: primero qué evento cuenta como
caída —sin eso la tasa no se puede fijar—, y después si es una sola tasa o dos
según se llame antes o durante el campo.

## Los criterios de encuesta efectiva salen del XLSForm 2026, no del calco

**Encargo de Gonzalo**: «parece que estuvieras haciendo un calco en vez de revisar
los criterios que hacen efectiva una encuesta **usando el XLSForm que tenemos** y
cómo declaramos los filtros iniciales **con las variables que tenemos**».

Leído el instrumento real —`BBDD2026/Instrumento2026.xlsx`, hoja `survey`, 161
filas—, esto es lo que declara:

| variable | tipo | qué pregunta |
|---|---|---|
| `consent_1` | `select_one yesno` · **required** | ¿estás dispuesto(a) a participar voluntariamente? |
| `consent_2` | `select_one yesno` · **required** | ¿a que la información se conserve y se emplee para investigación? |
| `filtro` | `select_one yesno` · **required** | ¿tienes más de un ciclo/semestre estudiando en la PUCP? |

- Valores: **`1` = Sí · `2` = No**.
- **La cascada la declara el propio formulario**: el `relevant` de `filtro` es
  literalmente `${consent_1} = '1' and ${consent_2} = '1'`. El orden no se
  inventa — está escrito en el instrumento.
- `consent_1` y `consent_2` gobiernan 11 preguntas cada uno; `filtro`, 10.

Resembrada la simulación con esas variables, la cadena de validez enseña:

> De 1 811 respuestas, la cadena deja **1 607**.
> `consent_1` −45 (**30 sólo por éste**) · `consent_2` −66 (0 sólo por éste) ·
> `filtro` −93

Las dos lecturas del módulo —cascada y exclusiva— se separan de verdad en el
primer paso, que es para lo que existen.

### El 70T/70P: el generador ya lo había reemplazado; la tabla no se enteró

`carga_base_control.R` marca `70T`/`70P` como `solo_lectura` y dice que «la hoja
que generamos YA NO ESCRIBE esa columna»; se conservan sólo para leer un libro
viejo. Pero `AulasControlDelLibro` las pintaba igual, vacías, junto con los tres
validadores y cortas/largas. Aplicado `columnasConDato` —el criterio ya existía y
ésta era la única tabla del perfil que no lo usaba—: **de 26 columnas a 9**.

### Los tiempos: el instrumento SÍ los declara

`start` y `end` son tipos del XLSForm y Kobo los rellena solo. La pantalla decía
«este estudio no trae tiempos de respuesta» y **era la fixture, no el producto**:
sembrados, aparece

> La mitad de las respuestas se contestó en **16 min o menos** (la mitad central,
> entre 11 y 21 min) · **1 811** respuestas con duración · **0** pasan de 120 min

**Y ahí está el control fino que falta**, dicho por la propia pantalla: «este
estudio **no ha declarado a partir de cuántos minutos una respuesta es
sospechosa**». La maquinaria de duración existe; el umbral no está declarado. Es
el equivalente temporal de los `valid_filters`, y hoy no hay dónde declararlo.

### Décima falsa ausencia, y el patrón ya es ley

Cuatro veces en este loop una fixture sin sembrar hizo parecer inexistente una
capacidad del producto: `efectivas_esperadas` (sin vara del diseño),
`valid_filters` (sin cadena de filtros), `libro` (sin Base de control) y ahora
`start`/`end` (sin tiempos). **Antes de declarar que la app no puede hacer algo,
comprobar que la fixture lo alimenta.**


## C4 y C5 no eran huecos: los escribí yo mal

Séptima y octava vez en este loop que doy por ausente algo que existe — y estas
dos llegaron al checklist que Gonzalo leyó, así que la corrección importa.

### C5 · el reemplazo de 70T/70P está hecho, y es lo que Gonzalo pidió

El generador del libro **ya no escribe** esas dos casillas de sí/no. Escribe seis
columnas en su lugar:

`EFECTIVAS ESPERADAS` · `ELEGIBLES: BASE DEL %` · `% EFECTIVAS ESPERADO` ·
`EFECTIVAS OBTENIDAS` · `% EFECTIVAS OBTENIDO` · `EFECTIVAS: DIFERENCIA`

Que es, literalmente, lo que Gonzalo había pedido al revisar el libro: «en vez de
setenta t y setenta p debería ser el porcentaje de efectivas, si ese porcentaje…
cuál es el esperado, cuál es el que se hizo, y si ese porcentaje es superior o
inferior». Y con dos cuidados que valen: el % lleva su denominador al lado para
no cruzar la hoja, y **un aula sin aplicar deja la celda vacía, no en cero** —
«cero efectivas» y «todavía no sabemos» son dos noticias distintas.

Lo que yo escribí en C5 **conflacionaba dos cosas**: las columnas del libro (que
están reemplazadas) y el **criterio de aula válida** (`aula_valida`), que es otra
cosa. Ése existe, se declara desde la pantalla, y en este estudio simplemente no
está declarado — que es la app funcionando como debe: «sin declarar no juzga».

### C4 · el aviso ES el producto funcionando

Las 7 columnas con datos y cabecera vacía no se pueden leer **por definición**:
sin título no hay a qué campo mapearlas. El control las detecta, dice cuántas
son y da el remedio exacto —«ponles nombre en la hoja para que entren»—. El
arreglo es del Excel del equipo, no de la app.

### El coste del patrón, que ya conviene nombrar

Ocho veces en este loop: `efectivas_esperadas`, `valid_filters`, `libro`,
`start`/`end`, `duracion_sospecha_min`, `cadena_filtros`, C5 y C4. Cinco eran
**fixture sin sembrar**, una **tipo sin ampliar**, y dos **premisa mía sin
comprobar**. Las dos últimas son las peores porque no las cazó ninguna medición:
las escribí en un checklist y ahí se quedaron hasta que fui a trabajarlas.

**Regla**: un ítem de checklist que dice «falta X» no se escribe sin haber
buscado X. Y si el ítem lleva tiempo escrito, se re-verifica antes de trabajarlo,
porque el que lo escribió —yo— pudo equivocarse.
