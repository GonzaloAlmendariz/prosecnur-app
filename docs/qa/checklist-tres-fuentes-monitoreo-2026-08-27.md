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
| A7 | **`TASA_DE_CAIDA = 0.235` es un promedio que esconde un abanico de 2,3×**: llamado antes del campo **16 %**, llamado durante **36 %** | ⛔ | cambiarla mueve `aulasAPedir` en toda la alerta |
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
| C4 | **7 columnas con datos y cabecera vacía** — se avisa pero no se leen | ⚠ | `unnamed_control_columns` |
| C5 | **70T / 70P**, el criterio de aula válida de 2025, no se usa en ninguna superficie de 2026 | ☐ | ver [[dos-observaciones-y-el-70T-70P-desfasado]] |

---

## D · TRANSVERSAL — filtros, procedencia y forma

| # | Qué | Estado | Nota |
|---|---|---|---|
| D1 | **Definir los filtros de encuesta válida desde la app** | ☑ | **Sí existe**: `guardarCriterio` escribe `valid_filters` y el panel enseña «cuentan N de M». Era la octava vez en esta sesión que verificar antes de declarar una ausencia evitó una afirmación falsa |
| D2 | **Ver QUÉ respuestas no pasan y por cuál filtro** | ☑ | **Existe de punta a punta**: `monitoreo_aulas_cadena_filtros()` publica el desglose con **dos lecturas distintas** —`caen` en cascada y `caen_solo_aqui`— y `AulasCadenaDeFiltros` lo dibuja. No lo veía porque **mi fixture declaraba `valid_filters` vacío**. Novena falsa ausencia de la sesión |
| D8 | **El embudo de Fuentes cuenta las descartadas con otro criterio que la etapa de al lado** | ☐ | ver § abajo — dice «−67 descartadas» y caen **174** |
| D3 | **Declarar el instrumento** (qué XLSForm rige) desde Fuentes | ☐ | distinto de D1 |
| D4 | **S1 · la meta cuenta reservas dormidas**: 25 922 = 3 150 titulares + 22 772 de 1 259 reservas | ⛔ | varas: titulares 3 150 · cuota facultad 4 050 · objetivo 2 500 · sobremuestra 3 750. **Cuál manda lo decide Gonzalo** |
| D5 | **C-F procedencia**, tercera pregunta: ¿de qué corrida del sorteo sale cada cifra? | ⚠ | sólo el KPI «Cursos-horario» estampa el `selection_run_id` |
| D6 | **Abuso de tablas sin complemento visual** (Gonzalo) | ☐ | ver § abajo |
| D7 | **Códigos poco entendibles para una persona común** (Gonzalo) | ☐ | «CH 1», «M1», `sin_contactar`, «70T» |

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
