# GOAL — Monitoreo mira cómo se está trabajando, no solo cuánto falta

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
| Variantes del nombre del agente | `reglas_semilla_agente()` en `reglas_custom_semilla.R` | funciona; en MDV aísla las 3 variantes |
| Cruce identidad ↔ solapamiento | tipo `cruce_identidad` en `reglas_custom_*.R` | funciona; en MDV reduce 21 avisos crudos a 1 |
| Rol de agente e identidad declarados | `operational_config$identity` | ya declarable desde la pantalla de Validación |

No hay que reimplementarlos: hay que decidir **dónde viven** y que Monitoreo los
consuma. Duplicarlos sería la peor salida — dos motores que responden lo mismo
terminan diciendo cosas distintas de la misma base.

## Cola

### Capa 1 · Fundación

**M1 · El rol de agente llega a Monitoreo** ☐
- **Rol**: sin saber qué variable es el encuestador, ninguna señal de calidad de
  campo puede existir sin hardcodear.
- **Objetivo**: que Monitoreo lea `operational_config$identity$agent_variable`
  —la misma declaración que ya usa Validación— en vez de inventar la suya.
- **Cuidado**: Monitoreo tiene su propio roster de encuestadores
  (`monitoreo_actor_roster.R`, códigos PXXX). Antes de nada hay que ver cómo se
  relaciona el rol declarado con ese roster; podrían ser lo mismo con dos
  nombres, y entonces el trabajo es unificar, no agregar.

### Capa 2 · Señales de calidad del trabajo

**M2 · Procedencia del formulario por agente** ☐
- **Rol**: es el caso que abrió el GOAL y el único que se corrige **mientras el
  campo está abierto**.
- **Objetivo**: avisar cuando un agente sigue enviando con una versión que ya no
  es la vigente, con nombre y hora, para que alguien lo llame ese día.
- **Cubre**: las 6 encuestas de MDV recolectadas con el formulario viejo durante
  las ~6 horas en que la encuestadora no había actualizado.
- **Se apoya en**: `detectar_versiones_formulario()`, que ya existe y es
  compartido con Carga y Validación.

**M3 · Identidad del agente** ☐
- **Rol**: proteger todo lo que se reporta por encuestador.
- **Objetivo**: traer el sembrador existente y ofrecer la unificación antes de
  que las tablas salgan con filas fantasma. Se sugiere, nunca se fusiona solo.
- **Cubre**: en MDV, 7 valores distintos para 4 personas.

**M4 · Casos que se pisan** ☐
- **Rol**: el único hallazgo de campo que sobrevivió al filtro en MDV.
- **Objetivo**: traer el tipo `cruce_identidad` y presentarlo como pregunta para
  campo: «¿por qué estas dos encuestas al mismo número corrieron en paralelo?».
- **Cubre**: `H1029` ∩ `VL2004`, mismo teléfono y titular, misma encuestadora,
  solapadas 2 h 13 min.

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

**M8 · Qué se está escribiendo en las preguntas abiertas** ☐
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
- **⛔ Espera decisión**: cómo se separa el texto de contenido del operativo. No
  está en el instrumento —los cuatro operativos de MDV son `text` igual que los
  otros—. Se puede proponer por perfil (los operativos se llenan en el 100 % de
  los casos y tienen formato uniforme) y que el analista confirme, como se hace
  con los demás roles. Pero la señal no es infalible y conviene acordarla.

### Capa 3 · Presentación

**M6 · Las alertas de calidad conviven con las de avance** ☐
- **Rol**: las siete alertas actuales responden «cuánto falta»; estas responden
  «cómo se está trabajando». Mezclarlas sin distinguirlas haría que una brecha
  de cuota y un formulario desactualizado se lean igual.
- **Objetivo**: que el panel las separe y que las de calidad digan a quién
  llamar.

### Capa 4 · Gobierno

**M7 · Qué alerta de calidad detiene el campo** ☐
- **Rol**: una alerta que no cambia ninguna decisión es ruido con presupuesto.
- **Objetivo**: decidir cuáles ameritan parar o corregir sobre la marcha y
  cuáles solo se registran. Probablemente un ADR.
- **Espera decisión de Gonzalo**: es criterio operativo de la casa, no del
  producto.

## Espera decisión de Gonzalo

| Qué | Por qué no puedo yo |
|---|---|
| Si el roster de encuestadores de Monitoreo y el rol de agente son lo mismo | Depende de cómo el equipo usa los códigos PXXX en campo |
| Qué alerta amerita parar el campo (M7) | Criterio operativo del equipo |
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
- **Una alerta sin destinatario no es una alerta.** «Revisar duración» no le
  sirve a nadie; «llamar a X y preguntar por los casos A y B» sí. La diferencia
  la marca V3.
