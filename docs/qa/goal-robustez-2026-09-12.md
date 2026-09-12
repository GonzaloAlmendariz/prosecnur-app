# Robustez — la noche del 2026-09-11 al 12

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
| `testthat` completo | **10 rojos** | 10 de la base cerrados |
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
