# Checklist — pendientes de Cálculo de muestra tras la revisión del 2026-08-15

Tipo: Checklist de trabajo (documento vivo)
Estado: En curso
Fecha: 2026-08-15
Autoridad: Inventario verificado de pendientes; **sólo Gonzalo lo cierra**

Sale de una revisión profunda de backend y frontend pedida el 2026-08-15, no de
una intuición ni de releer los docs vivos. Todo lo que está aquí se comprobó
corriendo el código; lo que **no** se pudo comprobar está marcado como tal y
dice qué haría falta para comprobarlo.

## Lo que la revisión encontró sano

Esto se mide para que el checklist no se lea como «el módulo está mal». No lo
está: los gates pasan y los defectos estadísticos grandes ya están cerrados.

| Gate | Resultado |
|---|---|
| Typecheck TS | **0 errores** |
| Vitest `src/features/calcMuestra` | **142 archivos · 1251 tests verdes** |
| testthat calc-muestra (64 archivos, `test_file` uno a uno) | **4573 PASS · 0 FAIL · 0 WARN · 1 SKIP** |
| `any` / `@ts-ignore` en producción del módulo | **0** |
| `stop()` crudo en los routers del módulo | **0** |

Y lo que ya se cerró de los docs vivos anteriores: **D10** (Consistencia es
pestaña propia después de Fuentes), **A6** (Alumnos por CH declara su vacío y
cumple C1/C3), los **cuatro defectos estadísticos del ADR 0066** (el test de π
empírica corre verde sobre los tres motores), el **comparador P1↔P2** con
emisor R y el **Relato** del ADR 0067.

## La tabla

Se dibuja entera cada vez que este checklist se mencione.

| # | Qué falta | Dónde vive | Coste | Estado |
|---|---|---|---|---|
| C1 | El gate de archivos congelados está rojo en main | `agentic/manifest.json` | minutos | ☑ **hecho** (2026-08-15) · línea base 5155 → 5161, `--audit` OK |
| C2 | Las exclusiones del marco no declaran su causa | motor R (`calc_muestra_aulas.R`) | bajo | ☑ **hecho** (2026-08-15) · verificado con mutante: 5 FAIL sin el fix, 0 con él |
| C3 | Construir el marco congela la app | router R (`router_calc_muestra.R`) | medio | ☑ **hecho** (2026-08-15) · verificado en la app: 177 s de job, backend respondiendo en 2–57 ms |
| C4 | El test direccional del MC secuencial mide un solo motor | tests R | bajo | ☑ **hecho** (2026-08-15) · control negativo; caza el Defecto 1 del ADR 0066 |
| C5 | Tres campos viajan tipados y no los muestra nadie | frontend | bajo | ☑ **hecho** (2026-08-15) · los tres tienen superficie; abrió el hallazgo L10 del GOAL |
| C6 | Un test gateado que ya no puede correr nunca | tests R | decisión | ⛔ **bloqueado** · exige decisión de Gonzalo |
| C7 | ¿Sigue el marco de referencia con 0 elegibles? | **fixture** | bajo | ☑ **reparado** (2026-08-15) · criterio reescrito al vocabulario de su base: 0 → **21.362 elegibles** |
| C8 | Titulares, Reemplazos y Sustento con selección real | frontend + corrida | verificación | ◐ **el dato ya existe** · selección de 30 titulares persistida; falta la auditoría visual |

**Seis cerrados el 2026-08-15** (C1–C5 y C7). Queda **C6**, que espera una
decisión tuya, y **C8**, que ya tiene su dato —30 titulares persistidos— y sólo
necesita una pila viva para la auditoría visual.

C7 se investigó a fondo y cambió de naturaleza: no es un defecto del motor sino
del **fixture**. El detalle vive en el GOAL
(`goal-calc-muestra-marco-defendible-2026-08-15.md`), que es el doc vivo de este
trabajo.

---

## C1 — El gate de archivos congelados está rojo en main ☑

**Cerrado el 2026-08-15.** Línea base subida de 5155 a **5161** en
`agentic/manifest.json`: +2 del commit `7e8d0292` (la conexión al motor
determinista) y +4 del arreglo de C2. `node agentic/sync-agentic-os.mjs --audit`
pasa sin hallazgos bloqueantes.

### Qué pasaba

```
$ node agentic/sync-agentic-os.mjs --audit
ERROR: archivo congelado creció: api/R/calc_muestra_aulas.R
       5157 líneas vs 5155 de línea base (+2)
```

El working tree está limpio, así que esto está **commiteado**: hoy cualquiera
que corra el audit se lo encuentra rojo.

### Por qué importa

La regla de la casa dice que un archivo congelado no crece: la funcionalidad
nueva va a un archivo propio. Aquí lo interesante es que **el commit culpable
hizo lo correcto**. [`7e8d0292`](../adrs/) («el sorteo balanceado da la misma
muestra en toda máquina») puso sus 142 líneas nuevas en un archivo propio,
`calc_muestra_aulas_cube_determinista.R`. Lo que dejó atrás fueron +4/-2 líneas
de *conexión* en el congelado — el llamado al archivo nuevo.

Ese es exactamente el caso que la regla contempla: crecer un congelado se
permite, pero **de forma deliberada**, subiendo su línea base en el mismo
commit. Lo que no se permite es que crezca sin que nadie lo declare, porque es
así como un archivo pasa de 5.155 a 20.000 líneas sin que ningún commit suelto
parezca culpable.

### Dónde vive

`agentic/manifest.json`, clave `policy.frozen_growth_files`, línea ~625:
`"api/R/calc_muestra_aulas.R": 5155`.

### Cómo se cierra

Subir la línea base a 5157 con el porqué en el mensaje del commit. **No** mover
las dos líneas a otro archivo: son la llamada al motor determinista y ahí es
donde tienen que estar.

### Cómo se verifica

```bash
node agentic/sync-agentic-os.mjs --audit
```

---

## C2 — Las exclusiones del marco no declaran su causa ☑

Este es el hallazgo **A2** del ledger del loop v2 («0 de 136.284 exclusiones con
`exclude_reason` vacío»). La revisión encontró la causa raíz y la reprodujo.

**Cerrado el 2026-08-15.** El apartado «Qué se cambió» va al final de esta
sección; lo de arriba se conserva porque explica por qué el defecto era
invisible, que es lo que evita que vuelva.

### Qué pasaba

Cuando el motor construye el marco, cada fila descartada se publica en
`frame$exclusions` con una columna `exclude_reason` que dice por qué se cayó.
Para las filas que descarta un **criterio de alumno de capa `marco`**, esa
columna sale **vacía**.

### Por qué importa — el ejemplo mínimo

Cuatro estudiantes, dos de pregrado y dos de maestría. Se activa el criterio
«formación = pregrado» en capa marco, que es la forma canónica de decir «mi
población objetivo son los de pregrado».

| Estudiante | Formación | ¿Entra al marco? | Razón publicada |
|---|---|---|---|
| s1 | pregrado | sí | — |
| s2 | maestría | **no** | *(vacío)* |
| s3 | pregrado | sí | — |
| s4 | maestría | **no** | *(vacío)* |

El motor **acierta**: s2 y s4 no deben entrar. Lo que falla es que la salida no
puede explicar por qué. Y ese «por qué» no es decorativo: es lo que sostiene el
marco ante un comité. Con 136.284 filas excluidas y ninguna razón, la pantalla
sólo puede decir «se cayeron 136.284» — que es indistinguible de un bug de
mapeo que tiró la base entera.

Es la misma familia de defecto que los cuatro del ADR 0066: **el resultado es
correcto pero la declaración no lo acompaña**, y por eso nadie puede auditarlo.

### Dónde vive

[`api/R/calc_muestra_aulas.R:1180`](../../api/R/calc_muestra_aulas.R). La
elegibilidad se calcula con ocho señales:

```r
eligible_student <- sid_ok & age_ok & condition_ok & level_ok
eligible_student <- eligible_student & alumno_sel$marco_ok     # <- la octava
eligible_row     <- eligible_student & modality_ok & session_ok & classroom_ok

reason_rows <- mapply(function(a, b, c, d, e, f, g) {          # <- solo siete
  .cm_aulas_reason(c(student_id = a, age = b, condition = c, level = d,
                     modality = e, session_type = f, classroom_id = g))
}, sid_ok, age_ok, condition_ok, level_ok, modality_ok, session_ok, classroom_ok)
```

`marco_ok` entra en `eligible_row` y **no** entra en `reason_rows`. Como
`.cm_aulas_reason()` devuelve `""` cuando todos los flags que recibe son `TRUE`
(línea 956), una fila que sólo cae por el criterio de alumno se publica muda.

### Por qué el arreglo es barato

La infraestructura ya distingue los dos conceptos. En la línea 1337 el motor ya
pasa **ambas** señales por separado a la capa de criterios:

```r
row_base_ok     = sid_ok & age_ok & condition_ok & level_ok & modality_ok &
                  session_ok & classroom_ok,
alumno_marco_ok = alumno_sel$marco_ok
```

Falta que `reason_rows` refleje esa misma distinción. Conviene que la razón
nombre **qué criterio** recortó (el `id` de la variable), no un genérico
`criterio_alumno`: `criterios_alumno_report` ya lleva ese detalle por criterio.

### Qué se cambió

Dos movimientos, ninguno en el camino legacy:

1. **La razón se produce donde se conoce el criterio.**
   `calc_muestra_aulas_criterios_alumno()` (en `calc_muestra_aulas_criterios.R`,
   que no está congelado) devuelve ahora `marco_razon` junto a `marco_ok`: un
   vector por fila con el **id del criterio** que la recortó, y sólo de los de
   capa `marco` —los de instrumento/procesamiento se reportan pero no sacan a
   nadie, así que no justifican una exclusión—.
2. **El motor la concatena.** Una línea en `calc_muestra_aulas.R` une
   `reason_rows` con `marco_razon` usando el mismo
   `.cm_criterios_concat_razones()` que ya se usaba para las razones de aula, de
   modo que una fila con varias causas las declara todas separadas por `|`.

La razón nombra el criterio (`formation`, `level`) y no un genérico
`criterio_alumno`: con el genérico habría que adivinar cuál de los criterios
activos se llevó las filas, que es justo lo que había que arreglar.

**El frontend no necesitó cambios.** La tabla `MOTIVOS` de
`exploradorBasesValores.ts` ya traducía `formation`, `condition`, `age`, `level`
y `faculty`, y ya parseaba el separador `|`. Estaba esperando estas razones
desde hacía tiempo; el motor nunca se las mandaba. Eso confirma que el defecto
era el eslabón que faltaba y no una capa sin construir.

### Cómo se verifica

`api/tests/testthat/test-calc-muestra-aulas-exclusion-razon.R` — 5 tests, 16
asserts:

| Test | Qué fija |
|---|---|
| Una fila que solo cae por un criterio de alumno declara ese criterio | El defecto exacto |
| Ninguna exclusión queda muda, con suite y sin suite | El invariante en **los dos caminos** |
| Una fila que cae por dos criterios de alumno los declara ambos | La concatenación |
| Un criterio de capa instrumento no excluye ni inventa razón | Que la semántica de capa siga intacta |
| Sin criterios de alumno activos las razones legacy no cambian | No-regresión del camino viejo |

**Verificado con mutante**, que es lo que separa un guard de un test decorativo:
con la línea del fix desactivada, **5 asserts fallan** en los tres tests que
miden el defecto; los dos de retro-compat siguen verdes, como debe ser —no
miden el defecto, miden que no se rompa nada—. Con el fix, 0 fallos.

Suite del módulo tras el cambio: **65 archivos · 4589 PASS · 0 FAIL · 0 WARN ·
1 SKIP** (el SKIP sigue siendo C6).

### Una trampa que costó dos intentos, anotada para no repetirla

El primer borrador del test daba por hecho que una fila podía caer a la vez por
edad (filtro legacy) y por formación (criterio de alumno). **No puede**: con la
suite activa los filtros legacy de alumno quedan en `TRUE` a propósito
(`calc_muestra_aulas.R:1124`, «suite activa ⇒ suite manda»). Los dos caminos son
excluyentes por diseño, y por eso el test los mide por separado.

El segundo intento buscó la segunda causa en un `classroom_id` vacío. Tampoco:
el motor **deriva** el `classroom_id` desde curso y horario cuando falta, así
que esa fila sigue siendo elegible y nunca llega a `exclusions`.

---

## C3 — Construir el marco congela la app ◐

Este es el lote **I21b** del loop v2, abierto desde el 2026-08-02.

**Implementado el 2026-08-15**, con el detalle al final de la sección. Queda
**a medias a propósito**: lo verificable sin levantar la app está verde, pero la
corrida real sobre una base institucional todavía no se hizo, y esa es la única
que prueba que los nueve minutos se fueron.

### Qué pasaba

`POST /api/calc-muestra/marco/construir` lee las cuatro tablas de entrada y
llama a `calc_muestra_aulas_construir()` **en el hilo de Plumber**, de forma
totalmente síncrona. Con el marco de HSVG2026 (136.284 filas) eso midió **más
de 9 minutos de app bloqueada**, con el banner sin progreso y el sello
diciendo «al día» durante toda la corrida.

### Por qué importa

Plumber es monohilo. Mientras esa ruta corre, **ninguna otra petición se
atiende**: la app entera queda muerta, no sólo Cálculo de muestra. Y como no
hay job, tampoco hay progreso ni cancelación — quien apretó el botón no sabe si
faltan diez segundos o diez minutos, y si se equivocó de configuración no puede
hacer más que esperar.

### Dónde vive

[`api/R/router_calc_muestra.R:756`](../../api/R/router_calc_muestra.R).

Lo que hace fácil el arreglo es que **sus dos rutas vecinas ya resolvieron esto**
y el patrón está listo para copiar:

| Ruta | ¿Job? | Gate |
|---|---|---|
| `/aulas/comparar-metodos` | sí (línea ~850) | `.cm_aulas_run_as_job(frame_n, costo)` |
| `/aulas/seleccionar` | sí (línea ~987) | mismo gate |
| `/aulas/certeza`, `/reporte` | sí | — |
| **`/marco/construir`** | **no** | **ninguno** |

`.cm_aulas_run_as_job()` (línea 158) decide por número de aulas y por coste
estimado; las rutas con job traen además `on_complete` con verificación de
`frame_hash`, para no persistir un resultado cuyo marco ya cambió.

### La trampa conocida

Los workers `callr` resuelven funciones contra el **paquete instalado**, no
contra `load_all()`, y necesitan el bootstrap de locale UTF-8. Los tests que
disparen jobs reales exigen `R CMD INSTALL` antes. Está documentado en el skill
`/jobs-asincronos` y es la trampa que ya se pagó dos veces.

### Qué se cambió

Cuatro piezas, ninguna de las cuales altera el camino síncrono:

1. **El motor sabe reportar.** `calc_muestra_aulas_construir()` acepta
   `on_progress` y emite **seis hitos reales** —leer la base, depurar elegibles,
   agrupar cursos-horario, aplicar criterios, perfilar, radiografía—. No es un
   reloj: son las etapas que de verdad consumen el tiempo. Ninguna toca RNG, por
   eso la vía job y la síncrona dan el mismo marco con la misma semilla.
2. **Un archivo nuevo, `calc_muestra_aulas_construir_job.R`**, con el emisor de
   progreso, el gate y el `on_complete`. Va aparte porque el motor está
   congelado a crecimiento.
3. **El gate mide lo único medible antes de construir.** Los otros jobs se
   deciden por n de aulas, pero aquí el marco todavía no existe: se cuentan las
   **filas de entrada** (la base madre, o estudiantes + inscripciones en modo dos
   bases). Umbral 20.000, ajustable con
   `PULSO_CALC_MUESTRA_CONSTRUIR_JOB_THRESHOLD` para poder ejercitar ambos
   caminos sin fabricar una base gigante.
4. **La lectura de tablas se queda en el hilo del router**, a propósito: es I/O
   rápido y es lo que produce los errores accionables de mapeo, que deben llegar
   como 400 inmediato y no enterrados dentro de un job.

En el frontend, `apiCalcMuestraMarcoConstruir` reusa el tipo
`CalcMuestraAulasAsyncResponse` que ya existía, y `construirMarcoDesdeFuentes`
espera el job con el mismo `esperarJobAulas` que ya usaban comparar y
seleccionar — con su barra de progreso y su cancelación. No hubo que construir
infraestructura nueva.

### Cómo se verifica

`api/tests/testthat/test-calc-muestra-aulas-construir-job.R` — 6 tests, 27
asserts: el gate por modo de entrada, el umbral y su variable de entorno (con
valor basura incluido), **la paridad sync↔job** por `frame_hash` y por cada
bloque del marco, que el progreso no altere el resultado, y que los hitos salgan
en orden hasta el sexto.

**Verificado con mutante**: devolviendo `NULL` desde el emisor de progreso y
quitando el `force = TRUE`, caen 3 tests con error y 2 con fallo. Los dos del
gate siguen verdes, que es lo correcto —miden otra cosa—.

Gate tras el cambio: **66 archivos · 4616 PASS · 0 FAIL**, typecheck 0, vitest
142 archivos / 1251 tests.

### Lo que falta para darlo por cerrado

Una corrida real: abrir un proyecto con base institucional, construir el marco y
comprobar que la app responde mientras tanto, que la barra avanza por las seis
etapas y que cancelar funciona. Es lo único que prueba que los nueve minutos de
bloqueo se fueron — el resto es infraestructura verificada, no el efecto.

---

## C4 — El test direccional del MC secuencial mide un solo motor

Pendiente 1 del doc de calidad estadística del 2026-08-07, declarado a
propósito en su momento y todavía abierto.

### Qué pasa

`test-calc-muestra-aulas-descuento-pi.R` verifica que el descuento secuencial
publique la π del sorteo que de verdad ocurrió. Lo mide **sólo con
`sistematico_pps`**:

| Test | `sistematico_pps` | `estratificado_aleatorio` | `cube_balanceado` |
|---|---:|---:|---:|
| `...descuento-pi.R` | 4 | **0** | 0 |
| `...descuento.R` | 8 | 2 | 4 |
| `...pi-empirica.R` | 2 | 2 | 3 |

### Por qué importa

`estratificado_aleatorio` es justo el motor que protagonizó el **Defecto 1** del
ADR 0066: publicaba la π de otro motor y nadie lo notaba. Ese defecto está
reparado y `pi-empirica` lo cubre — pero **en el camino sin descuento
secuencial**. La combinación «estratificado_aleatorio + descuento secuencial»
es la única celda de la matriz que ningún test direccional mira, y es
precisamente el cruce de las dos cosas que ya fallaron por separado.

### Dónde vive

`api/tests/testthat/test-calc-muestra-aulas-descuento-pi.R`.

### Qué se cambió

**Cerrado el 2026-08-15**, pero no copiando el arnés: la dirección esperada
resultó ser **la contraria**, y descubrirlo era el trabajo.

Con PPS la medida de tamaño manda, así que descontar repetidos mueve la π: las
aulas grandes solapadas pierden probabilidad y las chicas disjuntas la ganan.
Con `estratificado_aleatorio` el sorteo es **uniforme dentro del estrato** y la
MOS no interviene — recalcularla sobre netos no cambia la chance de nadie
mientras el aula conserve elegibles.

Medido en el mismo marco de traslape, 400 corridas:

| | A1 (100) | A2 (100) | A3 (30) | A4 (30) |
|---|---:|---:|---:|---:|
| π declarada | 0.500 | 0.500 | 0.500 | 0.500 |
| π medida por MC | 0.505 | 0.483 | 0.490 | 0.523 |

Desvío máximo 0.023, con SE ≈ 0.025. La π no se mueve, y las aulas de 100 y las
de 30 tienen la misma — que es exactamente lo que distingue este motor del PPS.

El test que salió es un **control negativo**: prueba que el arnés MC no fabrica
divergencias donde no las hay. Copiar el test de PPS habría producido un rojo
que parecería un defecto del motor cuando el motor está bien.

### Cómo se verifica

`test-calc-muestra-aulas-descuento-pi.R`, tercer test. Margen 0.10 (4 SE), que
tolera el ruido y queda muy por debajo de la separación que produciría una π
proporcional al tamaño (0.769 vs 0.231).

**Verificado con mutante**: reintroduciendo el Defecto 1 del ADR 0066 —que
`estratificado_aleatorio` vuelva a publicar π PPS— caen **5 asserts**. Los otros
dos tests del archivo siguen verdes, porque miden PPS y el mutante no los toca.
Además de cerrar la celda que faltaba, el test queda como guard de esa
regresión concreta.

---

## C5 — Tres campos viajan tipados y no los muestra nadie

Pendiente 5 del doc de calidad estadística. Estaba declarado como «trabajo del
loop de frontend»; se cerró un tercio.

### Qué pasa

| Campo | Motor R | Tipo en `api/calcMuestra.ts` | ¿Alguna superficie lo muestra? |
|---|---|---|---|
| `residual_negativo` | ✅ | ✅ | ✅ `HistoricoEstudioPanel.tsx` |
| `composicion_na_n` | ✅ | ✅ | ✅ **desde 2026-08-15** · `CriterioComposicionCard.tsx` |
| `asistencia_elegibles_min` / `_max` | ✅ | ✅ | ✅ **desde 2026-08-15** · `BarraTasa` en la serie semanal |

El tipo de `composicion_na_n` lo decía con todas las letras: *«divulgación
aditiva: frames previos no lo traen y no hay UI en esta ronda»*. Esa ronda nunca
llegó hasta hoy.

### Por qué importa

Son señales de **calidad del dato**, no adornos. `composicion_na_n` dice cuántos
casos entraron a una composición sin valor en la variable que la define; el
intervalo `elegibles_min/max` acota la asistencia cuando el screening fue
parcial y la cifra puntual no se puede defender sola.

Un dato de calidad que viaja tipado y no se muestra es peor que uno que no
existe: el backend cree que ya avisó, y quien decide nunca vio el aviso. Es
media capa construida, y la mitad que falta es justo la que habla.

Conecta con el ADR 0060, que documenta para la base 2025 que `asistencia` puede
ser cota superior con sesgo al alza no detectable. El intervalo existe
precisamente para que esa advertencia sea visible; hoy no lo es.

### Dónde vive

Tipos en `frontend/src/api/calcMuestra.ts`. La superficie natural es la misma
que ya muestra `residual_negativo`.

### Qué se cambió (`composicion_na_n`)

Vive ahora dentro de cada paso de `CriterioComposicionCard`, pegada al recorte:
*«**37** de los 420 que quedan entraron sin señal que medir: el criterio no los
evalúa, los deja pasar»*. Sale de `perfil.opcionales[id].composicion_na_n`, que
es del marco ejecutado y global al criterio.

La regla que la hace honesta: **sin cifra o en cero, no hay línea**. Un 0 sobre
un frame que no trae la clave afirmaría que se midió y no había ninguno, cuando
la verdad es que no se midió.

**Verificado con mutante**: quitando el guard del cero y haciendo que los tres
pasos lean el mismo criterio, caen **3 de los 5 tests**. Los 2 que sobreviven
son los que miden otra cosa (frame sin la clave, tarjeta sin el prop).

### Qué se cambió (el intervalo de elegibles)

La asistencia de elegibles no se observa: se acota. `BarraTasa` acepta ahora
`cotaInferior` y, con las dos cotas, deja de afirmar un punto: sólido hasta lo
cierto, tramado hasta el techo, y la cifra como rango (`62%–87%`).

El vacío queda clasificado (C3) por construcción: sin glosario el motor no
publica el intervalo, la barra es la de siempre y no insinúa incertidumbre. Y
sólo cambia de forma cuando el intervalo es **real** —cota finita y menor que el
valor—, así que ni un intervalo degenerado ni un payload imposible (suelo por
encima del techo) producen una barra rara.

**Verificado con mutante**: colapsando el guard a `cotaInferior != null` caen
**3 de los 6 tests** — degenerado, cota mayor que el valor, y valor nulo.

### Lo que abrió: L10 del GOAL

Rastreando las cotas apareció que el agregado **ya publica el intervalo sin
decirlo**: la tasa de «Asistencia» del panel es la cota superior y la de
«Rendimiento» es la inferior, están una al lado de la otra y nada dice que son
las dos cotas de la misma cantidad. Queda anotado como L10 porque cambia la
lectura de la cifra principal y merece decidirse, no colarse.

---

## C6 — Un test gateado que ya no puede correr nunca ⛔

### Qué pasa

`test-calc-muestra-criterios.R:518` — el test `[gated]` que verifica **población
exacta y marco cerca de 2483** contra la base canónica real — se salta siempre:

```r
.crit_canonico_path <- function() {
  p <- Sys.getenv("PULSO_CALC_MUESTRA_CANONICO", "")
  if (nzchar(p)) return(p)
  file.path(Sys.getenv("SCRATCH_DIR"),
            "-Users-gonzaloalmendariz-Documents-Pulso-prosecnur-app",
            "d3fb0ab9-eaa6-4dbe-a202-fd6df5f384bb", "scratchpad", "canonico.xlsx")
}
```

Ese UUID es el scratchpad de **una sesión que ya no existe**. Es el único SKIP
de los 64 archivos del módulo.

### Por qué importa

El comentario que lo acompaña dice que el modo permisivo «cuadraba 2479 por
cancelación de dos errores»: dos defectos que se compensaban y daban una cifra
casi correcta. Este test es exactamente el que caza esa clase de bug —el que no
se ve porque el número *parece* bien— y hoy no corre en local ni en CI.

Un SKIP permanente es peor que un test borrado: el borrado se nota, el SKIP se
lee como cobertura.

### Por qué está bloqueado

Exige una decisión que no es mía. Tres caminos, con distinto precio:

1. **Versionar una fixture anonimizada** derivada de la base canónica. Da
   cobertura real en CI, pero exige pasarla por `pulso_anonimizar.R` y verificar
   que el anonimizador no destruya las categóricas — hay antecedente:
   `hsvg2026` quedó envenenado por eso.
2. **Documentar `PULSO_CALC_MUESTRA_CANONICO`** como gate manual explícito y
   dejar el fallback muerto fuera. El test sigue sin correr en CI, pero deja de
   fingir que podría.
3. **Retirar el test** y anotar por qué. Honesto, pero pierde la única defensa
   contra la cancelación de errores.

**Decisión pendiente de Gonzalo.** El fallback al UUID muerto se retira en
cualquiera de los tres casos.

---

## C7 — ¿Sigue el marco de referencia con 0 elegibles?

### Qué pasa

El ledger del loop v2 registra el hallazgo **A1**: al reconstruir el marco del
proyecto de referencia, el motor devolvía **0 elegibles de 29.083**, con
`excluded_rows = 136.284` de `input_rows = 136.284`. Es decir, se cayó todo.

### Por qué está aquí y no en la lista de confirmados

**No se verificó en esta revisión.** No corrí el proyecto de referencia. Está
anotado para que no se dé por cerrado sin comprobarlo, ni por abierto sin
volver a medirlo.

### La hipótesis que vale la pena probar primero

A1 y C2 pueden ser el mismo defecto visto por dos lados. C2 demuestra que los
criterios de alumno de capa `marco` recortan sin dejar rastro; si en HSVG2026
un criterio de ese tipo está recortando de más, se explicarían a la vez los 0
elegibles **y** las 136.284 exclusiones mudas. Con C2 arreglado, reconstruir el
marco diría por fin qué criterio se llevó las filas — que es información que hoy
no existe.

**Actualización 2026-08-15: C2 ya está cerrado**, así que este diagnóstico dejó
de ser a ciegas. Al reconstruir el marco, cada exclusión declara ahora qué
criterio se la llevó — que es exactamente la información que faltaba para saber
si los 0 elegibles son un criterio recortando de más o un problema distinto.
Este es el siguiente ítem por rentabilidad.

### Cómo se verifica

```bash
make reference-project-run REFERENCE_PROJECT=hsvg2026
```

Y comprobar `input_rows`, `excluded_rows` y elegibles contra el frame guardado
(21.365 elegibles). Cuidado con el ruido conocido: el anonimizador renombró las
facultades como personas («Andres», «Elena Diego»), así que la pantalla no se
puede leer «por facultad» en ese fixture aunque las cifras cuadren.

---

## C8 — Titulares, Reemplazos y Sustento con selección real

### Qué pasa

Es el frente **F39** del loop de frontend. Las tres pestañas existen en el
catálogo de navegación (`aulas`: `seleccion`, `reemplazos`, `auditoria`, más
`aulas-relato` del ADR 0067) y el módulo pasa sus gates. Lo que no se hizo es
auditarlas **con una corrida real cargada**.

### Por qué importa — la lección de F37

El propio loop midió el precio de no hacerlo: **Sustento llevaba toda la sesión
declarada limpia con 0 desbordes, porque su gráfico no tenía nada que dibujar.**
Al llegar el dato aparecieron cuatro.

Una superficie sin datos no está aprobada: está **sin medir**. Es la misma regla
del gate de la casa — verde por conformidad, no por ausencia.

### Cómo se verifica

Generar una selección real y recorrer las tres superficies con la matriz de
viewports (1710×1107, 1440×1000, 1366×768, 1280×720, 1024×600), con `/ver-ui`
y dirección canónica:

```
window.__pulsoNav.ir("calc-muestra/aulas/seleccion")
```

Contra las cinco cláusulas del Contrato de Superficie, citando por código
(`C2 en Aulas > Reemplazos`), nunca «se ve raro».

---

## Cómo se corre la verificación de este checklist

```bash
node agentic/sync-agentic-os.mjs --audit
pnpm -C frontend exec tsc --noEmit --pretty false
pnpm -C frontend exec vitest run src/features/calcMuestra
```

Para los tests R del módulo, **uno a uno con `test_file`** — `test_dir` con
filtro da falsos rojos, y el locale tiene que ser `en_US.UTF-8`:

```bash
Rscript -e 'Sys.setlocale("LC_ALL","en_US.UTF-8"); pkgload::load_all("api", quiet=TRUE); for (f in list.files("api/tests/testthat", pattern="^test-.*calc-muestra.*\\.R$", full.names=TRUE)) print(testthat::test_file(f, reporter="silent"))'
```

Línea base contra la que comparar (el SKIP es siempre C6):

| Corte | Archivos | PASS | FAIL |
|---|---:|---:|---:|
| Apertura del checklist (2026-08-15) | 64 | 4573 | 0 |
| Tras cerrar C1 y C2 (2026-08-15) | **65** | **4589** | **0** |
