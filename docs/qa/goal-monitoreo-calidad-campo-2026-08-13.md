# GOAL — Monitoreo mira cómo se está trabajando, no solo cuánto falta

Tipo: Registro de goal loop
Estado: En curso
Fecha: 2026-08-13
Autoridad: Evidencia de la ejecución que documenta; no reemplaza contratos ejecutables ni ADR aceptados


**Abierto:** 2026-08-13 · **Cierra:** solo Gonzalo · **Cadencia:** lote por lote
**Ámbito:** módulo **Monitoreo** (`/monitoreo`). Parte del código que se cita
vive hoy en archivos de Validación (`reglas_custom_*.R`): traerlo es el trabajo,
no un error del doc.

## La calidad que se persigue

Monitoreo hoy responde una sola pregunta: **¿cuánto falta para la meta?** Sus
siete alertas lo dicen todas —`brecha_relevante`, `brecha_menor`,
`sin_objetivo`, `minimo_estadistico`, `benchmark_bajo`,
`subcuotas_incompletas`, `reemplazo_sin_motivo`—: miden avance contra objetivo.

Ninguna mira **cómo se está recolectando**.

El caso que abre el GOAL: en `ACNUR MDV AGOSTO`, una encuestadora trabajó **casi
seis horas con una versión desactualizada del formulario** mientras sus tres
compañeros ya usaban la corregida. Seis encuestas salieron con saltos y
catálogos viejos. Monitoreo no lo vio, y era exactamente el momento en que
todavía se podía parar el campo — cuando se descubrió, en Validación, ya solo
quedaba corregir el dato.

La calidad perseguida: **que el equipo se entere durante el campo de lo que hoy
descubre después**, y que cada aviso diga a quién llamar y qué preguntarle.

## Cómo avanza este GOAL

Lote por lote, con la misma cadencia del GOAL de validación extrínseca: no se
abre el siguiente hasta que el anterior tiene test con control, medición sobre
un proyecto real, gate escalado al diff y commit.

## Vara

| # | Afirmación | Cómo se mide |
|---|---|---|
| **V1** | Ninguna señal nombra el nombre de una variable de un proyecto | `grep` de nombres de MDV/ACNUR/HSVG en el motor devuelve 0. El agente y las llaves llegan del rol declarado en `operational_config`, que ya existe |
| **V2** | Una señal sola no alerta | El aviso aparece cuando ≥2 señales caen sobre el mismo caso o el mismo agente. Control en MDV: 15 duraciones largas + 24 solapamientos + 1 llave repetida → **1 caso** que merece llamada |
| **V3** | La alerta nombra al agente, el hecho y qué preguntar | Cada aviso trae el agente, los casos concretos y una pregunta concreta para campo. Nunca «revisar» a secas |
| **V4** | La duración no se usa sin declarar de dónde sale | `end` se corre cuando el formulario queda abierto —en MDV hay entrevistas de 44 h—. Toda métrica de tiempo declara su fuente y su margen, o no se muestra |
| **V5** | Lo que Monitoreo alerta es accionable **durante** el campo | Cada señal responde: si esto salta hoy, ¿qué se puede hacer hoy? Lo que solo sirve para el post-mortem es de Validación, no de acá |
| **V6** | El equipo con nombres sucios no degrada el reporte por agente | Las variantes se detectan y se ofrecen para unificar antes de que las tablas por encuestador salgan con filas fantasma. En MDV: 7 valores para 4 personas |
| **V7** | Calibrable por estudio sin tocar código | Umbrales y activación en la config del proyecto, versionados en el `.pulso` |

## Lo que ya existe y hay que traer

Del GOAL de validación extrínseca salieron dos motores que **funcionan y están
probados**, pero cuya pregunta es de Monitoreo:

| Qué | Dónde vive hoy | Estado |
|---|---|---|
| Variantes del nombre del agente | `reglas_semilla_agente()` en `reglas_custom_semilla.R` | **traído en M3**: Monitoreo lo llama, no lo copia |
| Cruce identidad ↔ solapamiento | tipo `cruce_identidad` en `reglas_custom_*.R` | **traído en M4**: mismo criterio, grano de par |
| Rol de agente e identidad declarados | `operational_config$identity` | ya declarable desde la pantalla de Validación |

No hay que reimplementarlos: hay que decidir **dónde viven** y que Monitoreo los
consuma. Duplicarlos sería la peor salida — dos motores que responden lo mismo
terminan diciendo cosas distintas de la misma base.

## Cola

### Capa 1 · Fundación

**M1 · El rol de agente llega a Monitoreo** ☑ *(2026-08-13)*
- **Rol**: sin saber qué variable es el encuestador, ninguna señal de calidad de
  campo puede existir sin hardcodear.
- **Objetivo**: que Monitoreo lea `operational_config$identity$agent_variable`
  —la misma declaración que ya usa Validación— en vez de inventar la suya.
- **Dónde vive**: `monitoreo_agente_declarado()` en
  `api/R/monitoreo_calidad_campo.R` (archivo nuevo: `monitoreo_engine.R` está
  congelado a crecimiento).
- **Evidencia**: devuelve la variable declarada; sin declaración devuelve `""`,
  **nunca un nombre inventado**. Un test verifica que el archivo no llama al
  roster territorial y no menciona variables de ningún proyecto.
- **Resuelto (2026-08-13)**: el roster y el rol **no son lo mismo y ambos se
  quedan**. `monitoreo_territorial_enumerator_roster_from_excel()` es una lista
  de encuestadores subida en Excel con códigos PXXX, solo del perfil
  territorial, y dice **quién debería trabajar**. `agent_variable` es una columna
  de la data y dice **quién trabajó**. Planificado y observado son preguntas
  distintas.
- **Ojo con el nombre**: `pulso_code` significa **código de caso** en un estudio
  telefónico (`H1010`) y **código de encuestador** en territorial —
  `codigo_encuestador` lo lista como alias. El mismo nombre, dos cosas; una
  razón más para que el rol se declare y no se adivine.

**M9 · Cruzar planificado con observado** ☑ *(2026-08-15)*
- **Rol**: la pregunta que aparece al tener las dos listas y que hoy no responde
  nadie.
- **Objetivo**: quién envió datos sin estar en el padrón, y quién está en el
  padrón sin haber enviado nada. Lo primero es un encuestador no autorizado o un
  nombre mal escrito; lo segundo, alguien que no arrancó.
- **Dónde vive**: `monitoreo_alertas_padron()`. Empareja por nombre normalizado
  **y por código**: en territorial la misma columna trae una cosa o la otra
  según el estudio.
- **La dependencia con M3, resuelta midiendo**: un valor que no está en el
  padrón pero se parece a uno que sí está sale con `probable_variante = TRUE` y
  con otra pregunta. Un tipeo y un intruso no se preguntan igual, y sin esa
  distinción el cruce acusaría a media plantilla.
- **Evidencia** sobre el equipo real de MDV con un padrón de 5 (los 4 que
  trabajaron + una que no arrancó):

  | Aviso | Actor | Qué dice |
  |---|---|---|
  | `envio_sin_padron` | `Mary` | se parece a «Mary Berrocal» → probable variante |
  | `envio_sin_padron` | `JORGE DE SOLAR` | se parece a «JORGE DEL SOLAR» → probable variante |
  | `envio_sin_padron` | `957130752` | no se parece a nadie → **¿quién es?** |
  | `padron_sin_envio` | `Rosa Quispe` | está en el padrón y no envió nada |

- **Controles**: sin padrón cargado, **0 alertas** —no se inventa un padrón
  desde la data—; padrón que coincide con lo observado, **0**; columna con
  códigos `PXXX` en vez de nombres, **0**.
- **Ojo**: ninguno de los cuatro proyectos de referencia tiene padrón cargado
  (0 asignaciones en los cuatro), así que el cruce se midió con un padrón
  construido sobre el equipo real de MDV. La mitad «planificada» del cruce
  todavía no existe en ningún `.pulso` versionado.

### Capa 2 · Señales de calidad del trabajo

**M2 · Procedencia del formulario por agente** ☑ *(2026-08-13)*
- **Rol**: es el caso que abrió el GOAL y el único que se corrige **mientras el
  campo está abierto**.
- **Objetivo**: avisar cuando un agente sigue enviando con una versión que ya no
  es la vigente, con nombre y hora, para que alguien lo llame ese día.
- **Cubre**: las 6 encuestas de MDV recolectadas con el formulario viejo durante
  las ~6 horas en que la encuestadora no había actualizado.
- **Se apoya en**: `detectar_versiones_formulario()`, que ya existe y es
  compartido con Carga y Validación — no se reimplementó.
- **Evidencia** sobre `ACNUR MDV AGOSTO`, con el rol declarado:

  > **[bloqueante] formulario_desactualizado** — Mary Berrocal envió 6 de sus 23
  > encuestas con una versión anterior del formulario, desde 2026-07-30T17:01.
  > Sus saltos y catálogos son los de esa versión, y eso no se corrige después:
  > conviene confirmar hoy que ya actualizó.
  >
  > *¿Mary Berrocal ya actualizó el formulario en su equipo? Si sigue con el
  > anterior, cada encuesta nueva se pierde igual.*

- **Controles**: sin rol declarado, **0 alertas**; base con una sola versión
  (98 casos), **0 alertas**; un caso suelto no nombra a nadie —puede ser un envío
  rezagado ya corregido— y el mínimo es del criterio, no del motor.
- **Severidad alta**, como se decidió: es la única señal que produce datos
  irrecuperables. Y la app **no frena**: avisa.

**M3 · Identidad del agente** ☑ *(2026-08-15)*
- **Rol**: proteger todo lo que se reporta por encuestador.
- **Objetivo**: traer el sembrador existente y ofrecer la unificación antes de
  que las tablas salgan con filas fantasma. Se sugiere, nunca se fusiona solo.
- **Cubre**: en MDV, 7 valores distintos para 4 personas.
- **Dónde vive**: `monitoreo_alertas_identidad()`, que **llama** a
  `reglas_semilla_agente()` y traduce su salida a alerta. No se reimplementó
  nada, y un test compara variante por variante contra el sembrador para que no
  puedan divergir.
- **Dos preguntas distintas, no una**: «se parece a otro nombre» se resuelve
  unificando; «no se parece a nada» no —puede ser un dato de otra cosa escrito
  en la casilla del encuestador—. En MDV el `957130752` es exactamente ese
  segundo caso.
- **Evidencia** sobre `ACNUR MDV AGOSTO`: **3 avisos**, uno por variante.

  > **[advertencia] identidad_agente** — «JORGE DE SOLAR» aparece en 1 encuesta
  > y se parece mucho a «JORGE DEL SOLAR». Si son la misma persona, el reporte
  > por encuestador la está partiendo en dos filas.
  >
  > *¿«JORGE DE SOLAR» y «JORGE DEL SOLAR» son la misma persona? Si lo son,
  > conviene unificarlos antes de sacar cualquier tabla por encuestador.*

- **Controles**: sin rol declarado, **0**; equipo escrito siempre igual
  (101 casos), **0**.
- **Severidad `advertencia`** por M7: el dato está, solo está mal atribuido. Lo
  urgente es corregirlo *antes* de que salga un reporte por agente.

**M4 · Casos que se pisan** ☑ *(2026-08-15)*
- **Rol**: el único hallazgo de campo que sobrevivió al filtro en MDV.
- **Objetivo**: traer el tipo `cruce_identidad` y presentarlo como pregunta para
  campo: «¿por qué estas dos encuestas al mismo número corrieron en paralelo?».
- **Dónde vive**: `monitoreo_alertas_cruce()`.
- **Mismo criterio, otro grano**: la regla de Validación marca **casos**; para
  llamar a campo hace falta el **par** —quién lo hizo y cuánto se pisan—. Un
  test compara los casos que nombra Monitoreo con los que marca
  `.regla_expr_cruce_identidad()` sobre la misma base: tienen que ser los
  mismos.
- **Evidencia** sobre `ACNUR MDV AGOSTO`: **370 pares se solapan en el tiempo,
  1 comparte además identidad**. Ese es el aviso:

  > **[advertencia] cruce_identidad** — VL2004 y H1029 son de la misma persona
  > encuestada y corrieron a la vez, solapadas 2 h 13 min. Las dos las hizo
  > Silbia Cruzado, que no pudo estar en las dos.
  >
  > *¿Por qué Silbia Cruzado tiene dos encuestas de la misma persona corriendo
  > en paralelo? Puede ser un formulario que quedó abierto, o una encuesta que
  > se rehízo sin cerrar la anterior.*

- **El mismo agente cambia la pregunta**: dos encuestadores distintos a la misma
  hora puede ser la misma entrevista cargada dos veces; el mismo encuestador es
  físicamente imposible. Son dos preguntas y salen distintas.
- **Controles**: solaparse sin identidad, **0**; compartir identidad sin
  solaparse, **0**; llave vacía —que emparejaría a todos los casos sin dato—,
  **0**; sin llaves declaradas, **0**.
- **V4 cumplida**: cada aviso declara en `detalle$fuente_tiempo` de qué columnas
  sale el solape. Si el fin es el `end` de la plataforma, hereda que se corre
  con el formulario abierto — y por eso el criterio exige también identidad.

**M5 · Una duración que se pueda usar** ☐
- **Rol**: hoy no hay ninguna métrica de tiempo confiable, y el equipo la
  necesita para saber si una entrevista se está haciendo bien.
- **Objetivo**: encontrar una medida de duración que no dependa de `end`, o
  declarar explícitamente su margen. Sin eso, ninguna alerta de tiempo es
  defendible.
- **⛔ Bloqueado por una pregunta abierta**: ¿existe en Kobo/ODK una marca de
  tiempo por pregunta o por página que permita medir la entrevista real? Si no
  existe, la respuesta honesta es que la duración no se mide y el ítem se cierra
  diciendo eso.

**M8 · Qué se está escribiendo en las preguntas abiertas** ☑ *(2026-08-15)*
- **Dónde vive**: `api/R/monitoreo_abiertas.R` (archivo propio) y el rol nuevo
  `operational_config$abiertas`, declarable desde la misma pantalla de
  Validación que los demás.
- **Qué cuenta como «no dice nada»**, elegido midiendo sobre las 69 respuestas
  reales y no por gusto:

  | Señal | Marca en MDV | Veredicto |
  |---|---|---|
  | adyacencia de teclado | **10 de 69** | **descartada** — cualquier frase contiene pares de teclas vecinas |
  | sin vocales | **1** (`hjk`) | se queda |
  | sin letras, carácter repetido, un solo carácter | 0 | se quedan: no cuestan nada y cubren lo que MDV no tiene |
  | 5+ consonantes seguidas | 0 | se queda: caza `asdfghjkl` y el español llega a cuatro (`abstracto`, `obstrucción`) |

- **Evidencia** sobre `ACNUR MDV AGOSTO`: **1 alerta**, la real.

  > **[advertencia] abierta_sin_contenido** — En «¿Qué otra barrera?
  > (RevB_barriers_other)» hay 1 de 15 respuestas que no dicen nada: «hjk» (no
  > tiene ninguna vocal). Todas las escribió Silbia Cruzado.
  >
  > *¿Qué le respondieron a Silbia Cruzado en esa pregunta? Mientras el caso
  > esté fresco todavía se puede recuperar; en Codificación ya no.*

- **Controles**: sin instrumento, **0** —adivinar por nombre de columna es lo
  que ninguna señal puede hacer—; las 10 respuestas legítimas de prueba, **0**;
  y la razón medida de que las independientes se declaren: vigilar el teléfono
  marcaría **103 de 104 casos**, porque no tiene letras.
- **Una alerta por pregunta, no por respuesta**: si alguien escribió tres veces
  cualquier cosa en la misma pregunta, es un problema con tres casos.
- **El sugeridor separa contenido de captura operativa** con la evidencia a la
  vista (respuestas, palabras promedio) y marca `probable_operativa`, porque
  declarar una operativa alertaría en cada caso de la base. **Lo que ya tiene
  otro rol queda fuera**: medido, sin eso el nombre del encuestador —2,2
  palabras, repetido entre casos— se proponía como texto de contenido.
- **Límites conocidos y medidos, que quedan escritos**: un manotazo pronunciable
  (`qwertyuiop` tiene vocales y no encadena consonantes) **no se detecta**, y un
  acrónimo sin vocales (`RH`, `PC`) **se marca de más**. Con avisos de
  advertencia, el segundo cuesta una mirada; el primero es el techo honesto del
  detector.

- **Rol**: hoy la app **muestra** las respuestas abiertas y es el analista quien
  descubre, leyendo, que alguien escribió cualquier cosa. Y las descubre en
  Codificación, cuando el campo ya cerró. Es la misma inversión que el resto del
  GOAL: mostrar es tarde, alertar es a tiempo.
- **Objetivo**: avisar cuando una respuesta abierta no dice nada —tecleo al
  azar, un guion, una letra suelta— con el agente y el caso, para llamarlo ese
  día.
- **Distingue dos clases**, como pidió el equipo:
  - **Dependientes de una pregunta anterior** (el «otro, especifique»): en MDV
    son **18 de 24**. Son respuestas de contenido y todas deben vigilarse.
  - **Independientes**: 6 en MDV, y acá está la trampa — cuatro no son
    respuestas del encuestado sino **captura operativa** (código de caso, código
    externo, teléfono, nombre del encuestador). Solo dos son texto de contenido.
- **Evidencia** sobre `ACNUR MDV AGOSTO`: 69 respuestas en las dependientes, **1
  dudosa** (`hjk` en una pregunta de barreras). Es poco, y aun así hoy nadie se
  entera hasta Codificación.
- **Resuelto (2026-08-13)**: por defecto se vigilan **solo las dependientes**.
  El «otro, especifique» es contenido por construcción, así que no hay falsos
  positivos posibles; en MDV eso son 18 de 24 y cubre el caso típico. Las
  independientes de contenido se **suman declarándolas**, con la app sugiriendo
  cuáles parecen serlo. Inferirlo para todas se descartó: un falso positivo
  sobre un campo operativo alerta en **cada caso de la base** — el detector
  marcó 103 de 104 teléfonos.

### Capa 3 · Presentación

**M6 · Las alertas de calidad conviven con las de avance** ☑ *(2026-08-15)*
- **Rol**: las siete alertas actuales responden «cuánto falta»; estas responden
  «cómo se está trabajando». Mezclarlas sin distinguirlas haría que una brecha
  de cuota y un formulario desactualizado se lean igual.
- **Dónde vive**: `monitoreo_calidad_campo_bloque()` arma las cuatro señales y
  el router las publica como `calidad_campo`, **fuera de `dashboard$alertas`**.
  En el front, `CalidadDeCampo.tsx` + `useCalidadDeCampo.ts`, montados desde
  `MonitoreoWorkbenchChrome` —chrome compartido y no congelado—, así que los
  cuatro perfiles lo tienen sin tocar sus page-files.
- **Dónde se muestra**: en **Avance** (donde viven las de «cuánto falta», que es
  lo que el ítem pide) y en **Validación**. Fuera de esas dos sería ruido: nadie
  entra a Fuentes o Modelo a decidir a quién llamar hoy.
- **El vacío también informa**: el bloque viaja siempre y trae un `motivo`.
  «Falta declarar quién recolecta» y «el campo está limpio» se ven igual y
  significan lo contrario, así que la pantalla dice cuál de los dos es (C3), y
  el primero indica dónde se resuelve.
- **Verificado en la app**, sobre un segundo proyecto y no el que abrió el GOAL
  —`acnur_pdm`, 2.726 casos, telefónico— con el rol declarado: el bloque
  aparece encabezando Avance y atrapa **tres variantes que MDV no tenía**: un
  doble espacio (`JORGE  DEL SOLAR`), una `L` caída (`MARTHA VILANUEVA`) y una
  diferencia de mayúsculas (`silbia cruzado`).
- **Tres casos del mismo tipo son un problema, no tres**: medido en pantalla,
  tres avisos sueltos ocupaban ~300 px encima del gráfico de avance. Se agrupan
  por tipo, con las instancias dentro y tope de 4 visibles; un solo caso
  bloqueante tiñe a todo su grupo para que no se diluya.
- **Geometría**: el bloque va **dentro** del contenido, no como fila del `main`.
  Ese grid declara sus filas por familia (`auto minmax(0,1fr)`, con y sin
  status) y un hijo de más se lleva una fila declarada: medido, el bloque
  quedaba en **25 px de alto**. Adentro mide 245 px, sin scroll horizontal
  a 800 px de ancho (C2).

### Capa 4 · Gobierno

**M7 · Qué alerta de calidad detiene el campo** ☑ *(2026-08-15)*
- **Escrito en**
  [ADR 0077 — Avisa fuerte lo que sigue produciendo daño](../adrs/0077-avisa-fuerte-lo-que-sigue-produciendo-dano.md).
- **El criterio quedó más filoso al escribirlo.** «Datos irrecuperables» sonaba
  bien pero no discrimina: una respuesta abierta vacía también se pierde si el
  campo cierra. Lo que sí distingue es si **el conjunto de casos afectados sigue
  abierto**. Una encuestadora con el formulario viejo produce una encuesta
  perdida más por cada hora; un nombre mal escrito, dos encuestas superpuestas o
  un `hjk` son hechos ya ocurridos sobre un conjunto cerrado — llamar hoy o
  mañana cambia lo fácil que será resolverlo, no cuántos casos hay.
- **Y es una prueba, no una lista**: antes de darle severidad alta a una señal
  nueva hay que poder responder «¿esto sigue creciendo?». Si no, es advertencia.
- **Rol**: una alerta que no cambia ninguna decisión es ruido con presupuesto.
- **Resuelto (2026-08-13)**: **solo procedencia avisa fuerte**. El formulario
  desactualizado es la única señal que produce datos **irrecuperables** — una
  encuesta hecha con el formulario viejo no se arregla después, mientras que las
  otras tres se corrigen o se explican. Sale con severidad bloqueante y con el
  nombre del agente; las demás informan.
- **Y un límite que no se cruza**: la app **nunca frena el campo sola**. Avisar
  fuerte es su techo; parar es decisión del coordinador. Un bloqueo automático
  sobre una señal con falsos positivos costaría más que el problema que evita.
- **Dónde se escribió**: ADR propio y no una extensión del 0075. El 0075
  gobierna el gate de Validación **después** del campo —qué hace que una base
  esté validada— y este gobierna los avisos **durante** el campo. Son la misma
  familia de decisiones en dos momentos distintos, y mezclarlas habría hecho
  que ninguno de los dos se pudiera citar solo.

## Decisiones tomadas — 2026-08-13

| Qué | Decisión |
|---|---|
| Roster PXXX vs rol de agente | **Ambos**, son planificado y observado. Se agrega el cruce (M9) |
| Qué preguntas abiertas vigilar | **Solo las dependientes** por defecto; las independientes se declaran |
| Qué alerta frena el campo | **Solo procedencia**, con severidad alta. La app nunca frena sola |

## Decisiones tomadas — 2026-08-15

| Qué | Decisión |
|---|---|
| M3 y M9 avisan del mismo valor sucio | **El padrón manda.** Con padrón cargado, la cercanía se mide contra él y el aviso de identidad solo cubre lo que el cruce no nombró. Sin padrón —casi todos los estudios— identidad trabaja sola. Resuelto una vez en `monitoreo_alertas_equipo()`, no en cada pantalla |
| Dónde vive el bloque en la pantalla | **Dentro del contenido de Avance y Validación**, no como fila del `main`: ese grid declara sus filas por familia y un hijo de más se lleva una declarada (medido: 25 px de alto) |
| Cómo se presentan varios casos del mismo tipo | **Agrupados**, con las instancias dentro y tope de 4 visibles. Tres avisos sueltos ocupaban ~300 px encima del gráfico; un caso bloqueante tiñe a todo su grupo |
| Cómo se decide que dos nombres son el mismo | **Una sola definición** (`.semilla_nombres_cercanos()`), compartida por Validación y Monitoreo. Dos criterios: distancia ≤ 2 (tipeo) o uno prefijo del otro (nombre incompleto — ahí la distancia es enorme y el prefijo es lo único que lo ve) |

## Espera decisión de Gonzalo

| Qué | Por qué no puedo yo |
|---|---|
| Umbrales de tiempo, si M5 resulta medible | Criterio metodológico de la casa |

## Medición de partida

`ACNUR MDV AGOSTO SIN LIMPIAR.pulso`, 104 casos, 4 encuestadores.

| | |
|---|---|
| Alertas que Monitoreo emite hoy | 7 tipos, **todas de avance contra meta** |
| Alertas sobre cómo se trabajó | **0** |
| Encuestas con formulario desactualizado | 6, durante ~6 h, sin aviso |
| Valores distintos de encuestador | 7 para 4 personas |
| Duraciones implausibles | 15 (máx. 44 h) |
| Pares solapados del mismo agente | 24 · **1** con identidad compartida |
| Preguntas de texto abierto | 24 · **18 dependientes** de otra pregunta, 6 independientes |
| De las independientes, texto de contenido | **2** — las otras 4 son captura operativa |
| Respuestas abiertas dudosas | 1 de 69 en las dependientes, descubierta recién en Codificación |

## Trampas

- **`end` no es el fin de la entrevista.** Se corre si el formulario queda
  abierto: en MDV hay una de 36 h que «cubre» mecánicamente todo lo que esa
  encuestadora hizo en dos días. Cualquier métrica de duración, de solapamiento
  o de contención hereda ese defecto.
- **La contención no filtra nada.** Exigir que una entrevista esté contenida en
  otra parecía más estricto que el solape parcial; medido, pasa de 24 pares a 23
  — porque la contención *es* la consecuencia del formulario abierto, no una
  señal distinta. (Medido el 2026-08-12.)
- **La cardinalidad no distingue un agente de una pregunta abierta.** Ordenar
  candidatas por «menos valores distintos» pone primero toda dicotómica; lo que
  discrimina es si los valores parecen nombres de persona.
- **Dos motores para la misma pregunta terminan discrepando.** Lo que ya existe
  en Validación se trae, no se reimplementa. Ver `detectar_versiones_formulario()`,
  compartido hoy por Carga y Validación con un test que compara sus salidas.
- **No todo campo `text` es una respuesta abierta.** Un detector de «esto no
  dice nada» aplicado a todos los `text` marcó 103 de 104 teléfonos como basura,
  porque no tienen letras. El código de caso, el teléfono y el nombre del
  encuestador son captura operativa y el instrumento no los distingue del texto
  de contenido. (Medido el 2026-08-13.)
- **El padrón de encuestadores no existe en ningún proyecto real.** Los cuatro
  de referencia traen 0 asignaciones, así que M9 solo se puede medir con un
  padrón armado a mano. Antes de dar por buena cualquier conclusión del cruce
  sobre un estudio, verificar que el Excel esté subido. (Medido el 2026-08-15.)
- **Un nombre mal escrito parece un intruso.** Sin medir la cercanía contra el
  padrón, las 2 variantes de MDV saldrían como «encuestador no autorizado» junto
  al único valor que sí lo amerita, y la alerta perdería toda su fuerza por
  dilución. (Medido el 2026-08-15.)
- **Un hijo de más rompe un grid de filas declaradas.** `mon-workbench-main`
  declara `auto minmax(0,1fr)` (y una variante con status): el bloque nuevo se
  llevó la fila del status y quedó en **25 px**. La regla: contenido nuevo va
  dentro del contenido, no como fila hermana de un template cerrado. (Medido el
  2026-08-15.)
- **La adyacencia de teclado no detecta tecleo al azar.** Parecía la señal
  obvia para cazar un `hjk` y marcó **10 de 69** respuestas reales: cualquier
  frase en español contiene pares de teclas vecinas («as», «er», «op»). Lo que
  sí discrimina es la ausencia de vocales y las rachas de consonantes que
  ninguna palabra tiene. (Medido el 2026-08-15.)
- **Una alerta sin destinatario no es una alerta.** «Revisar duración» no le
  sirve a nadie; «llamar a X y preguntar por los casos A y B» sí. La diferencia
  la marca V3.
