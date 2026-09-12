# Robustez — la noche del 2026-09-11 al 12

> **Hay DOS documentos de robustez con fecha del 12/09 y es a propósito.**
> `goal-robustez-app-2026-09-12.md` es el MARCO: el catálogo de clases de
> defecto, con el listón de que una clase sólo está cerrada con un guard que la
> caza, probado matando un mutante, y un barrido con su cifra. Éste es el
> DIARIO de una noche: qué se midió, qué se arregló y las recetas que costaron
> encontrar. Si buscas «cómo se cierra una clase», ve al otro; si buscas «qué
> pasó y cómo reproducirlo», estás en el bueno.

Encargo de Gonzalo: «Deja la app robusta y solida en un loop deifnido de mejora
continua». Lo que sigue es lo que se midió, lo que se arregló y —sobre todo— las
recetas que costaron tiempo encontrar, para que el siguiente no las repita.

## La vara, y las cifras

Tres afirmaciones comprobables, no impresiones:

1. **Verde de verdad, no verde por indulto.** Sin rojos «heredados» tolerados: un
   rojo ajeno se localiza y se escala, no se ignora.
2. **Nada crece sin gobierno.** `node agentic/sync-agentic-os.mjs --audit` verde.
3. **Lo que el operativo usa a diario no se rompe**, verificado contra HSVG2026
   real y no contra fixtures.

| | Línea base (11/09, 23:10) | Cierre (12/09, madrugada) |
|---|---|---|
| Typecheck | limpio | limpio |
| Vitest | **5 rojos** de 8.929 | **0** — 933 archivos, 8.930 tests |
| `testthat` completo | **10 rojos** | **36.093 pass, 0 fail** (medido por la otra sesión, `b2fd0662`) |
| `--audit` / `--check` | 2 congelados crecidos | verdes |
| PDF de avance | — | 11 páginas, cifras cuadradas |

## Los defectos que llegaban al usuario

**Un 500 al construir el marco** (`f02b96fc`). `POST /api/calc-muestra/marco/construir`
devolvía 500 `E_INTERNAL` —sin mensaje, sólo un `error_id`— para cualquier
sesión que hubiera cargado antes la referencia histórica de asistencia. La causa:
`referencia$cadenas_reemplazo$filas`, donde `cadenas_reemplazo` no viene ausente
sino **`NA`**; `NA$filas` **lanza** «$ operator is invalid for atomic vectors» y
`%||%` no lo atrapa porque sólo mira el NULL. El sellador corre fuera de los dos
`tryCatch` del endpoint, así que ni siquiera se degradaba a un 400 accionable.

**«Cursos-horario planificados» decía 74 donde son 174** (`324e03f3`). La tarjeta
leía `course_status_con_meta` bajo un rótulo que promete «titulares del plan»:
74 planificados con 87 aplicados encima. La rama por facultad YA leía
`rol.titulares.total`, así que con foco el número era correcto y sin foco no, en
la misma tarjeta.

**La semana 2 se habría escrito en la hoja de la semana 1** (`83d98403`). La
mitad que ESCRIBE de la sincronización tomaba `hojas_dist[[1]]`.

**La ficha de papel pedía «Efectivas» y la hoja espera «encuestas aplicadas»**
(`786f4082`). Quien transcribe traducía en cada aula — 193 veces.

**El paquete de defensa se negaba sin decir por qué** (`9afd8ab5`). Seis motivos,
un solo aviso; para el caso que ADR 0066 vuelve normal mandaba a revisar tres
cosas que estaban bien.

## Los guards que tenían razón, y los que se tapaban entre sí

- El **oráculo de la radiografía** llevaba rojo desde `8c4f96c1` y era la CUARTA
  vez que se quedaba así sin que nadie mirara (antes F71, F114, G39). Se
  re-bendijo **confinado**: ver receta abajo.
- El pin de **STATUS MUESTRA** medía «cuántos teclea el equipo» y preguntaba por
  el desplegable; dejaron de ser la misma pregunta cuando llegó un estado que
  escribe la app.
- El **censo de transporte HTTP** cazó `collection_drive.R`. El código estaba
  bien; faltaba su test de módulo, sin el cual entrar al censo es un permiso en
  blanco. Importa porque Plumber es monohilo: una subida sin timeout no da error,
  **cuelga el backend entero**.
- La **ficha de papel**: el test del sentido inverso TAPABA al del derecho,
  pidiendo la palabra vieja desde una tercera copia del vocabulario.
- El **test de los KPIs** estaba verde porque su fixture daba 174 a las DOS
  poblaciones. Con cifras iguales no puede distinguir de cuál lee.

## Recetas que costaron encontrar

**Sacar el mensaje de un `E_INTERNAL`.** Nunca viaja al cliente, pero el servidor
de contrato escribe su stderr a un fichero y el handle lo expone: `srv$err_file`
(`helper-http-contract.R:93`). Da la línea `[prosecnur-app] E_INTERNAL <id>: <mensaje>`.
Para montar el diagnóstico, copiar la CABECERA del fichero de contrato (todo lo
anterior al primer `test_that`; ahí viven los `.i18b_*`) a un
`test-zzz-diag-500.R` y añadirle un `test_that` propio: el helper necesita el
`teardown_env` de testthat y no corre fuera de uno. Borrar el temporal.

**Confinar un oráculo antes de re-bendecirlo.** Enumerar rutas, no podar: podar
dice «algo cambió», enumerar dice QUÉ. Extraer el motor viejo con
`git archive <sha> api` a un directorio aparte —nunca `checkout` sobre el árbol
compartido— y reconstruir el payload **con SU fixture**: usar el de hoy mezcla el
cambio del motor con el del fixture. Si el reconstruido reproduce el hash
esperado, la comparación es fiable. Runners: `rad_viejo.R`, `rad_diff.R`.

**Renderizar el PDF con el árbol de trabajo.** `build_monitoreo_aulas_report_model(snapshot, cfg, include_targets)`
—no `monitoreo_aulas_report_model`— y `monitoreo_aulas_advance_report_pdf(model, out)`.
Para contar páginas, leer BYTES y contar `/Type /Page[^s]`: `rawToChar` sobre un
PDF revienta por multibyte.

## Trampas del entorno, medidas

- **El disco está en iCloud y el I/O está saturado.** `git log -S`, `git diff`
  sobre rutas amplias y `grep -rl` sobre todo `frontend/src` pasan de 180 s.
  Acotar la ruta o lanzarlo en segundo plano.
- **Dos de los cinco rojos de vitest se cerraron solos** mientras se trabajaba,
  porque la otra sesión commiteó. Antes de perseguir un rojo ajeno:
  `git log --oneline -8`.
- **Un rojo puede ser del reloj, no del código.** `test-secrets.R` salió rojo en
  la corrida completa y verde en solitario: la derivación LEGADA mira `nodename`,
  que en macOS cambia al cambiar de red, y la suite tarda una hora. Es el propio
  incidente del 2026-09-08 que ese fichero documenta. Pineado en `a2837015`.
- **`CalcMuestraPage.tsx` está a dos líneas de su tope** (3.928 con base 3.930).

## Lo que no se hizo, y por qué

- **E5 se retiró por falsa.** «Un aula sin aplicador no avisa» era mío: el motor
  lo declara (`no_cubiertos`, `por_confirmar`), la UI lo enseña y la hoja lo
  escribe. Lo di por ausente porque mi runner buscaba claves inventadas y un
  `%||% list()` sobre un nombre que no existe devuelve vacío sin quejarse.
- **Los monolitos** (`monitoreo_engine.R` 38.682, `TelefonicoMonitoreoPage.tsx`
  20.397) no se parten por gusto: sólo cuando una etapa obligue a tocarlos.

## La fila insertada del libro, pendiente de decisión suya

En «Aulas Aplicadas (Campo)» hay una fila añadida a mano con `CH 14` duplicado e
`ID MATCH 10` (la cadena de `CH 15`), sin columnas R, con un parte completo
—ELECTRICIDAD INDUSTRIAL, 09/09 15:22, 7 encuestas—. `CH 14` acumula 14
efectivas y `CH 15` y toda su cadena están en 0. Es operativo, no técnico:
Gonzalo dijo «dejemos eso».

## Una medición de una hora sobre un árbol compartido no es una medición

La última corrida completa de `test_dir` terminó con **6 rojos**
—`test-errors-registry.R` y cinco de `test-kobo-errores-tipados.R`— y al
correrlos acto seguido dieron **0**. No eran reales: la corrida tarda una hora y
`4ed2a801` (el arreglo de Kobo de la otra sesión) aterrizó en mitad de ella, así
que `load_all` leyó un árbol a medio escribir. Es el mismo patrón que ya había
dado un falso rojo en vitest esa misma noche.

Consecuencia práctica: **la suite completa sólo mide de verdad cuando nadie más
commitea**, y con dos sesiones sobre el mismo árbol eso no se puede suponer. Lo
que sí vale es el gate del ÁREA tocada, que dura segundos y no da tiempo a que
el árbol cambie debajo — que es, además, lo que la casa ya pide. La corrida
completa queda para `/publicar` y `/preparar-release`, donde el árbol está
quieto.

Corolario para leer un rojo de una corrida larga: **antes de diagnosticarlo,
re-correr ese fichero solo**. Si pasa, era el árbol moviéndose; si falla, es
tuyo.

## ABIERTO — una CUARTA definición de «aplicado», medida

`monitoreo_aulas_aula_aplicada.R` se abre diciendo: «**Una sola definición de
"este curso-horario se aplicó"**. Había tres, y las tres daban respuestas
distintas sobre las mismas aulas el 2026-09-07 […] Aquí está, y las tres la
llaman.»

**No las tres: hay una cuarta que no la llama.**
`monitoreo_aulas_rol_y_estado()` cuenta `aplicado` como
`application_state %in% c("en_aplicacion","cerrando")`, y `application_state` lo
deriva el propio tablero (`monitoreo_aulas_universitarias.R:1422`) de
`operational_status` y `responses_total` — nunca pregunta por el parte.

**Medido sobre HSVG2026, misma entrada por los dos caminos:**

| | tablero | PDF / canónica |
|---|---|---|
| efectivas | 1.390 | 1.390 ✓ |
| muestra | 2.500 | 2.500 ✓ |
| titulares del plan | 174 | 174 ✓ |
| **aulas aplicadas** | **73** | **75** ✗ |
| facultades | 15 | 15 ✓ |

La diferencia se localiza en **una sola aula, `CH 3`**: su parte la declara
aplicada y todavía no tiene respuestas, así que la canónica la cuenta —«el parte
es el veredicto de quien estuvo ahí»— y `application_state` la deja en
`pendiente`. (El otro punto de diferencia entre 74 y 75 es `R 131.1`, una reserva
aplicada, que el desglose por rol cuenta aparte y no en titulares: eso es
correcto.)

Consecuencia: la misma pantalla puede decir 73 en el desglose por rol y 75 en su
KPI, sobre el mismo corte.

**Y el cotejo por facultad separa dos cosas que no son la misma.** Difieren DOS
facultades, no una, y por motivos distintos:

| Facultad | tablero (rol) | PDF | qué es |
|---|---|---|---|
| CIENCIAS E INGENIERIA | 17 | 18 | **el defecto**: `CH 3`, titular con parte y sin respuestas |
| ARTE Y DISEÑO | 6 | 7 | **no es defecto**: `R 131.1`, reserva de cadena aplicada |

La segunda no hay que «arreglarla»: el desglose por rol la cuenta —con razón— en
`reemplazos.utilizado` y no en `titulares.aplicado`, mientras que la columna
«Aulas aplicadas» del PDF responde a otra pregunta, «en cuántas aulas se
aplicó», donde la reserva sí entra. Son dos preguntas legítimas con dos
respuestas legítimas, y por eso **las dos columnas no se pueden comparar de
frente**: quien vaya a arreglar el defecto tiene que restar antes esta
diferencia definicional, o «arreglará» un acierto.

El resto del cotejo por facultad sale limpio: 15 de 15 coinciden en efectivas y
en muestra.

**Y hay una TERCERA superficie que rompe el empate.** El libro operativo —la
hoja «Avance de campo», la que el equipo mira a diario— suma **75**, igual que
el PDF: su `carga_aulas_libro_avance_facultad.R:123` llama a
`monitoreo_aulas_aula_aplicada()` con su comentario diciéndolo. Así que de las
tres superficies, dos usan la definición única y la que se desvía es el desglose
por rol del tablero. Eso no decide qué arreglo es el correcto, pero sí dice
dónde está lo raro.

**Por qué no se arregló en el acto.** Vive en `monitoreo_aulas_universitarias.R`
—motor grande y en el área que la otra sesión está commiteando esta misma noche,
incluido `1d4f3888`, que va justo de motores comparando el estado en crudo— y la
derivación de `application_state` alimenta varios paneles. Tocarla a ciegas
ripplea. Queda con su reproducción hecha: `<scratchpad>/cotejo.R` compara las dos
lecturas sobre la misma entrada y `<scratchpad>/cual2.R` nombra el aula que
difiere.

## Autoevaluación contra el listón del marco

El marco pide tres cosas para dar una clase por cerrada: guard, mutante muerto y
barrido con su cifra. Contra esa vara, **el barrido de `$` sobre `NA`
(`95c19b00`) está a medias**: tiene el barrido y su cifra —cuatro slots, cinco
consumidores, un solo sitio sin guarda— y tiene la regresión del sitio
concreto (`f02b96fc`), pero **no tiene un guard de la CLASE**: si mañana
aparece un quinto slot o un sexto consumidor, nada lo caza. Queda declarado como
lo que es, a medio cerrar, y no como hecho.

## Una afirmación del código, comprobada — y era cierta

`.calg_celdas_parte` reparte los valores a las columnas con un `switch` POR
TÍTULO, y su comentario afirma: «un titulo que este switch no conozca sale
vacio, y el barrido de ida y vuelta lo caza».

Comprobado desalineando una rama —`"CANTIDAD DE RECHAZOS" = n("rechazos")`
renombrada, dejando la cabecera intacta y la celda vacía—: **caen 3 tests**,
`test-carga-aulas-libro-roundtrip.R` (dos) y `test-carga-aulas-libro.R`. La
afirmación era cierta y el guard existe, así que **no hay clase nueva**.

Se anota porque un resultado negativo también cierra una pregunta, y porque la
alternativa —dejarla escrita como «hallazgo» sin medirla— es exactamente lo que
dos etapas falsas de esta misma noche costaron.

## Tres clases que faltan en el catálogo común

`goal-robustez-app-2026-09-12.md` es el catálogo compartido —ya recogió la 10,
«la mitad que ESCRIBE se queda sin migrar», que salió de aquí—. Estas tres son
de esta sesión, tienen guard y mutante muerto, y **les toca entrar ahí**:

| Clase | Guard | Mutante |
|---|---|---|
| Un slot que sale `NA` en vez de ausente, con `$` encadenado encima | `test-calc-muestra-referencia-slots-na.R` | 2 fallos al revertir `f02b96fc` |
| La misma cifra sale de dos fuentes según la rama | `kpisDeAulas.test.ts`, «coherencia general vs facultad» | 2 fallos al volver a `course_status_con_meta` |
| Dos superficies nombran distinto el mismo campo | `test-collection-bundle-carpetas.R`, derivado de `.calg_titulos_campo()` | 2 + 2: rótulo de la ficha, y columna renombrada en la spec |

No se añadieron directamente porque esa sesión está escribiendo ese fichero cada
pocos minutos y meterse ahí en caliente es cómo se pierde el trabajo del otro.
Se suman cuando pare.

Y una nota sobre la segunda: su invariante no es «lee el campo X» sino **«lo
general es la suma de lo particular»**. Eso es lo que la hace resistente — un
guard que fija la fuente se rompe con cualquier refactor legítimo; uno que fija
la coherencia sólo se rompe cuando el dato deja de cuadrar, que es justo lo que
se quiere vigilar.

## Los DOS «74» no son el mismo 74

El barrido de tarjetas del marco (`8c572302`) publica una tabla con 75, 74 y 73,
y las tres descripciones son correctas. Pero conviene decir una cosa más, porque
es la trampa de toda esta jornada en su forma más pura: **hay dos conjuntos
distintos de 74 aulas y coinciden sólo en el tamaño.**

Medido (`<scratchpad>/dos74.R`):

| Conjunto | n | Composición |
|---|---|---|
| A · titulares con respuestas | 73 | — |
| **B · titulares por la canónica** | **74** | A **+ `CH 3`** (parte, sin respuestas) |
| **C · todo lo que tiene respuestas** | **74** | A **+ `R 131.1`** (reserva de cadena) |
| D · todo por la canónica | 75 | A + `CH 3` + `R 131.1` |

`identical(sort(B), sort(C))` → **FALSE**. Sólo en B: `CH 3`. Sólo en C:
`R 131.1`.

Importa para quien tome la decisión pendiente: si se lee «74» en dos sitios y se
asume que hablan de lo mismo, se empareja un numerador de un conjunto con un
denominador del otro y el resultado parece coherente. Coincidir en el número no
prueba que sea el mismo dato — es la misma lección que ya costó una sesión con
las tasas, y aquí aparece con dos conjuntos que difieren en exactamente un
elemento cada uno.

## El punto ciego del cotejo entre superficies

El cotejo que encontró la cuarta definición de «aplicado» compara VALORES: la
misma entrada por dos caminos, campo a campo. Tiene un punto ciego que conviene
dejar escrito, porque acaba de demostrarse.

`efa3bd98` arregló que `brechaDeLaFacultad` leyera `achieved`, un campo que el
motor **no publica en ninguna parte**: la rama principal era código muerto y
todo pasaba por el respaldo `target - missing`. Medido sobre el operativo: las
**30 celdas** de `quotas_sex_faculty` traen `observed` y **ninguna** trae
`achieved`; y en las **30**, `observed == target - missing`.

Es decir: el respaldo daba exactamente el mismo número que la rama correcta, así
que **ningún cotejo de valores podía verlo**. Mi barrido comparó esas cuotas
contra el PDF y salió limpio — con razón, porque los valores lo estaban.

La pregunta que sí lo caza no es «¿cuánto vale?» sino **«¿de qué campo lo
sacaste?»**, que es una pregunta de procedencia y no de valor. El guard que
corresponde es el de la otra sesión —clase 11, «un respaldo que se usa
siempre»—, y por eso las dos formas de mirar se necesitan: una ve los números
que no cuadran, la otra ve los caminos que nadie recorre.

## La pregunta de procedencia, aplicada al PDF de cliente

Aprendida la lección del punto ciego, se le hizo al PDF la pregunta que el
cotejo de valores no puede hacer: **¿de qué campos lee, y existen?**

Lee muy poco de fuera, que es parte de por qué aguanta:

| Origen | Claves que lee | Estado |
|---|---|---|
| `cfg$aulas_universitarias` | `plan`, `partes_campo`, `design_targets` | las tres presentes y con contenido (1.392 · 72 · 12) |
| `snapshot` | `data`, `synced_at` | las dos presentes (1.519 filas · sello ISO) |

Ninguna rama muerta ni respaldo tapando una clave inexistente. Se anota porque
un barrido de procedencia que sale limpio también cierra una pregunta, y porque
deja dicho **cuál es exactamente la superficie de contacto del PDF con el resto
de la app**: cinco claves. Cuanto más pequeña, menos sitios donde el entregable
puede envenenarse sin avisar.

## La clase 11 barrida también en R: 41 campos, cero casos

La otra sesión barrió la clase 11 —«un respaldo que se usa siempre»— en el
perfil del frontend: 299 campos, dos casos. Falta la otra mitad, que es la mía:
**los campos del PLAN que leen el PDF de cliente y el generador del libro.**

Barrido: **41 campos**. Cuatro salieron marcados y los cuatro se explican, con
lo que quedan **cero casos reales**:

| Campo | Veredicto |
|---|---|
| `sex_top_` | **artefacto de mi propio barrido**: la regex `[a-z_]+` cortaba antes del dígito de `sex_top_1` / `sex_top_2`, que sí existen |
| `aula_utilizada` | lo AÑADE `aulas_libro_anotar_aula_utilizada()` antes de la lectura (`carga_aulas_libro_generar.R:1334`) |
| `estado_aplicacion` | lo AÑADE el mismo paso previo (línea 1356) |
| `notes` | vivo en OTRA estructura: es el nombre que usa la hoja (`carga_aulas_agendadas.R:105`) y el lector lo mapea a `replacement_note`. El sitio de lectura ya lo explica: «leer solo `notes` perdia las 190 observaciones de 2025» |

Mismo criterio que ellos aplicaron a `sex_key`: **un alias muerto se arregla;
uno vivo en otro sitio sólo necesita decirse.** Aquí no había ninguno muerto.

Y una nota sobre el primero, que es la advertencia que más se repite en este
documento: **el primer sospechoso fue mi instrumento.** Un barrido con una regex
demasiado estrecha inventa hallazgos igual que un runner con claves inventadas;
verificar el instrumento antes de acusar al medido es lo que separa un hallazgo
de una pérdida de tiempo.

## Lo publicado para la semana 2, verificado contra lo que se armó

Releída la pestaña «Semana 2» del Sheets de los aplicadores y cotejada con el
reparto que la generó:

| | |
|---|---|
| Citas publicadas | **50**, las mismas 50 del reparto |
| Publicadas que no estaban en el reparto | **0** |
| Del reparto sin publicar | **0** |
| Días | 14, 15, 16, 17 y 18/09 |
| Aplicadores distintos | 17 |

**Un aviso operativo, no un defecto.** De las 50 citas, una está a nombre de
**«Interno Pulso»**, que no es ninguno de los 19 de la semana: `CH 107`,
miércoles 16/09, 08:50, aula Z201, Ciencias Sociales, MACROECONOMÍA 2. Viene de
una fijación que ya estaba en la hoja del coordinador.

**Y la app no sólo la respeta: lo tiene declarado.** «INTERNO PULSO» es el
comodín del operativo, dictado por Gonzalo el 2026-09-04 —«cuando no hay
aplicadores disponibles y lo termina haciendo alguien de Pulso»—; vive en
`MONITOREO_AULAS_INTERNO_PULSO`, entra en `equipo` para las fijaciones
(`monitoreo_aulas_distribucion_ciclo.R:335`) y tiene su advertencia de
disponibilidad callada a propósito, porque no es una persona con horario. El
solape sí se le avisa: «dos citas a la misma hora no las cubre nadie, ni Pulso».

Así que no es un hueco del guard sino una decisión codificada, y la nota se
queda como lo que es —operativa—: esa cita significa **«va alguien de Pulso»**, y
alguien tiene que estar en Z201 el miércoles a las 08:50.

Y 17 aplicadores distintos sobre 19 disponibles: los dos sin carga son Damaso
Abanto y Dolores Resurrección, por el modo concentrado, ya reportado.

## El libro de cliente de aulas, que nunca se ha publicado, sí se arma

En la pantalla de Salidas, «GOOGLE SHEETS · CLIENTE» sale **Pendiente**: para
este estudio ese entregable no se ha generado nunca. Un entregable que nadie ha
ejercitado es justo el que falla el día que hace falta, así que se probó a
armarlo con el estado real.

`monitoreo_publication_model(..., audience = "client")` construye sin error:

| | |
|---|---|
| Familia detectada | `university_classroom_fieldwork` |
| Pestañas | **6** — Portada · Resumen de aulas · Avance agregado · Cuotas y brechas · Avance diario · Corte y fuentes |
| Marcos vacíos | **ninguno** |

No prueba que el contenido sea el correcto —eso pide leerlo, y publicarlo
necesita el go de Gonzalo—, pero sí que el motor no se cae y que las seis
pestañas traen datos. Que es lo que separa «no lo hemos usado» de «no funciona».

Un tropiezo del camino que vale como aviso: `monitoreo_publication_model()` NO
acepta `reports=`; el dashboard entra por `dashboard=` y de ahí saca los
informes. Pasárselo da «unused argument» y parece un fallo del motor cuando es
del llamador.

### Y una descripción que nombra otra familia — sin consumidor verificado

Al mirar el CONTENIDO de ese modelo (y no sólo su forma) aparece esto: la
pestaña titulada **«Resumen de aulas»** lleva la descripción **«Resumen agregado
de avance territorial.»** Las otras cinco están bien; sólo ésa nombra otra
familia. Se ve que el texto se heredó del modelo territorial y nadie lo movió al
crear el de aulas.

Dos observaciones más del mismo vistazo, y las dos son de criterio, no de
código: «Avance agregado» y «Cuotas y brechas» describen **«umbral interno»** en
un libro de CLIENTE, y la regla de la casa para estos entregables es la
contraria —lo interno se queda fuera; al cliente le importa el avance en sí
mismo—.

**Lo que NO está verificado, y por eso esto no se declara defecto:** si el campo
`description` llega a la hoja publicada o se queda en el modelo. Buscado sin
encontrarlo: ningún serializador de `api/R` lo escribe de forma evidente. Hasta
saberlo, esto es «el modelo dice una cosa rara», no «el cliente lee una cosa
rara», y la diferencia es justo la que separa un hallazgo de una suposición.
**RESUELTO en el tick siguiente, y sin publicar nada.** No hacía falta un Sheets
de prueba: se construyeron las pestañas con sus valores
(`monitoreo_publication_sheets_tabs(..., audience = "client")`) y se barrieron
las **1.862 celdas** de las seis. «territorial» y «umbral interno» aparecen en
**cero**.

Es decir: `description` es metadata del modelo y **no llega a la hoja**. El
cliente no lee nada de eso. Queda como higiene del código —un texto heredado que
conviene corregir cuando se toque ese fichero— y **no como defecto del
entregable**.

Lo que vale como método: la pregunta «¿lo ve el cliente?» se contestó
construyendo la salida y mirando sus celdas, no razonando sobre el código. Es
más barato, es concluyente, y no toca el Sheets de nadie.

## ~~El «Plan del día» se rompe el lunes~~ — RETRACTADO: mi medición estaba mal

La hoja «Plan del día» del libro operativo —la que campo abre para saber qué
toca hoy— tiene su bloque de cabecera roto: la celda de la fórmula muestra
**`#REF!`**.

Medido sobre la hoja publicada, sin tocarla:

| | |
|---|---|
| Filas reservadas para el desborde del filtro | **24** (entre las dos cabeceras «FECHA AGENDADA», filas 3 y 29) |
| Día más cargado del listado | **2026-09-14 con 28 citas** |
| Días que desbordan la reserva | **sólo el 14/09** |

El mecanismo está documentado en el propio motor
(`monitoreo_aulas_plan_dia_selector.R:121`): «FILTER revienta con `#REF!` si el
desborde choca con una celda ocupada», y por eso reserva «tantas filas como
aulas trae el día más cargado» —`reserva <- max(as.integer(table(fechas)))`—.

**La reserva y el listado que van en la MISMA hoja no cuadran entre sí**: 24
contra 28. O sea que la reserva se calculó sobre un listado con menos citas del
que acabó publicado al lado. Consecuencia concreta: **el lunes por la mañana,
elegir «2026-09-14» en el selector deja el bloque en `#REF!`**, justo el día más
cargado del operativo y justo cuando más gente lo va a abrir. Los demás días
caben y funcionan.

### RETRACTACIÓN

**Todo el párrafo de arriba, salvo el `#REF!`, está MAL.** Al escribir el guard
falló sobre el fixture de un test —reserva 1 contra «máximo» 2, con dos días de
una cita cada uno— y eso delató al instrumento: yo contaba como cita **cualquier
fila que empezara por una fecha**, y las filas de sección, los subtotales de
jornada y el bloque de pendientes también la llevan.

Con el criterio de PRODUCCIÓN —`.mapds_fechas_aula()`, que exige
`CURSO-HORARIO` en la fila— la hoja del operativo da:

| | |
|---|---|
| Filas contadas | 159 |
| Día más cargado | **2026-09-09 con 24** |
| Reserva | **24** |
| ¿Cabe? | **SÍ** |

La reserva es exacta y **el lunes no se rompe nada por desborde**. El `#REF!` de
la fila 4 es real y sigue ahí, pero su causa **no es** la que dije y queda
**abierta y sin diagnosticar**.

Lo que sí queda hecho es el guard, y con el criterio bueno: la reserva ha de ser
siempre `>=` el día más cargado **contado como lo cuenta producción**. Mutante
muerto: fijarla en 8 lo pone en rojo. Vive en
`test-monitoreo-aulas-plan-dia-formato.R`.

**La lección es la de siempre y esta vez me tocó a mí**: medí la hoja con un
criterio mío en vez de con el del código que la escribe, y con eso «encontré» un
defecto que no existía y lo reporté como urgente. El guard no sólo cerró el
invariante: fue lo que me delató, porque falló donde no debía. Escribir la
prueba antes de creerse el hallazgo es lo que separó esto de una alarma falsa
entregada.

### Y el `#REF!` diagnosticado: ni la fórmula, ni el área, ni los datos

Cerrado el hilo, con todo medido sobre la hoja viva y sin escribir en ella:

| Comprobación | Resultado |
|---|---|
| La fórmula | **intacta y bien formada** — `IF($B$1="";…;IFERROR(FILTER(A30:U234;…);…))` |
| El área del desborde (filas 4–27) | **vacía en A:Z**; sólo la fila 4 tiene la fórmula |
| Filas que devuelve el FILTER para el día elegido (11/09) | **18**, con **24** libres |
| Para el día más cargado (09/09) | **24**, con 24 libres: cabe exacto |

Es decir: la fórmula está bien, el sitio donde desborda está libre y lo que
devuelve cabe. **El `#REF!` no puede venir de un desborde.**

La explicación que queda —y se declara como la más probable, NO como verificada—
es que sea un **valor calculado obsoleto**: la fórmula se escribe en un PUT
aparte (`USER_ENTERED`) después del `values:batchUpdate` que reescribe la hoja,
y en ese instante intermedio el listado está en otras filas. Si nadie ha abierto
el documento desde la última publicación, la API devuelve ese valor viejo en
caché.

**Cómo confirmarlo en cinco segundos y sin herramientas**: abrir el documento y
mirar esa celda. Google recalcula al abrir. Si se arregla sola, era eso; si
sigue en `#REF!` con la fórmula y el área que acabamos de comprobar, entonces sí
hay algo que no entendemos y merece volver.

## Un singular que se hizo plural deja consumidores atrás

La clase más rentable del cierre. `83d98403` hizo que el Sheets de los
aplicadores llevara **una pestaña por semana**. El productor quedó bien; los
consumidores que leían «la hoja» en singular, no. Aparecieron **cinco**, uno
por uno y a lo largo de varias horas:

| # | Dónde | Qué hacía mal | Commit |
|---|---|---|---|
| 1 | publicar la distribución | el aviso decía cuántas citas, no qué semana quedó sin tocar | `72f31ddb` |
| 2 | sincronizar | el recibo contaba qué hizo y callaba en qué pestaña | `f33ee814` |
| 3 | `pestanas_ajenas` | restaba contra la PRIMERA: «Semana 2» salía declarada ajena | `5e9b4fe6` |
| 4 | `filas_del_equipo` | leía sólo la primera: lo escrito en la 2 no entraba al análisis | `5e9b4fe6` |
| 5 | **la adopción** | fijaba sólo la semana 1, así que el sorteo podía **mover la 2** | `7df233cc` |

El quinto es el caro: adoptar es lo que congela el reparto para que agendar un
aula nueva no reordene asignaciones ya comunicadas a las diecinueve personas.
Leyendo una sola pestaña, ese blindaje cubría media operación.

**Cómo se busca, y es mecánico:** cuando un cambio convierte un singular en
plural, `grep` del nombre viejo (`hoja`, `$hoja`, `.mapd_hoja()`) y visitar a
TODOS los que lo consumían. El productor no es el trabajo; el barrido sí. Y el
apilado dejó de estar inline: `monitoreo_aulas_distribucion_valores(id, hojas)`
es el único sitio donde vive, para que el sexto consumidor no pueda nacer
distinto.

Emparenta con «cambié lo que el sistema hace y no cambié lo que el sistema
cuenta»: tres de los cinco eran exactamente eso.

## El `#REF!` del «Plan del día»: un error puede ser un recuerdo

Cerrado el 2026-09-12 con el mensaje literal de Google, no con una hipótesis.
`effectiveValue.errorValue.message` decía **«Array result was not expanded
because it would overwrite data in B4»** — y B4 estaba vacía (sin
`userEnteredValue`), la hoja sin merges (0) ni rangos protegidos (0), y el día
elegido cabía: 18 filas para una reserva de 24.

`FILTER` no es volátil: mientras ninguna entrada cambie, Google sirve el
resultado cacheado. **Abrir el documento no recalcula** — que era la salida que
yo había supuesto y le dije al lead, y era falsa. Reescribir la misma fórmula
tampoco basta (Sheets ve el mismo contenido): hay que **vaciar la celda y
volver a ponerla**. `32030b5b` lo hace, pero sólo cuando ya vio un error.

**La receta cara, para no repetirla**: pedirle a Sheets el motivo se hace con
`?includeGridData=true&ranges=<A1>&fields=sheets(data(rowData(values(effectiveValue))))`.
`values.get` sólo devuelve `#REF!` como texto y no dice por qué.
