# GOAL — Cálculo de muestra: reconstruir HSyVbG desde cero y llegar al 2025

Tipo: Goal operativo (loop de convergencia)
Estado: Abierto
Fecha: 2026-08-16
Autoridad: Objetivo de trabajo medible; **sólo Gonzalo lo cierra**

## Por qué existe

El módulo tiene sus piezas verificadas una a una —el marco declara sus causas,
la π es la del sorteo ejecutado, el build no congela la app— pero **nadie ha
recorrido el camino entero de principio a fin con los ojos de quien lo usa por
primera vez**, comprobando en cada parada que el número que sale es el que
debería salir.

La vara de ese recorrido no es una opinión: es el **estudio HSyVbG 2025**, que ya
se hizo, con su marco, sus criterios, sus cuotas y sus aulas seleccionadas. Si
partiendo de las mismas bases el módulo no reproduce ese diseño —o produce uno
distinto y no sabe explicar por qué—, entonces no sirve para el 2026.

Este loop simula esa reconstrucción **desde cero**: sólo las bases, ninguna
decisión heredada, y validando cada eslabón antes de pasar al siguiente. No es
una auditoría de código: es una reconstrucción con testigo.

## La vara

Ocho paradas, en el orden en que ocurren. Cada una se cierra antes de abrir la
siguiente, y cada una se mide contra 2025.

| | Parada | Cómo se mide |
|---|---|---|
| **V1** | **Elegibles tras criterios de alumno** | El conteo reproduce el de 2025, o la diferencia tiene una causa nombrada y defendible |
| **V2** | **Cursos-horario elegibles tras criterios de CH** | Igual que V1, sobre la unidad de muestreo |
| **V3** | **Los criterios se entienden solos** | Alguien que no los escribió sabe qué recorta cada uno **antes** de aplicarlo, y lo confirma viendo el efecto |
| **V4** | **La UI deja ver lo que cada criterio hace** | Para cada criterio: cuántos llegan, cuántos deja fuera, sobre qué distribución corta — sin cambiar de pantalla |
| **V5** | **Tamaño de muestra** | n reproduce el de 2025 con los mismos parámetros, y cada parámetro (z, p, e, deff, m̄) es rastreable a una decisión |
| **V6** | **Alumnos por curso-horario, por facultad** | El estadístico por facultad reproduce el de 2025 y la elección (P25 / mediana / media) está justificada |
| **V7** | **Aulas por facultad** | El reparto reproduce el de 2025, y donde difiera se explica por el criterio que lo movió |
| **V8** | **Selección por cubo: titulares y reemplazos** | La muestra sorteada **se comporta como** la de 2025 —perfil por facultad, tamaño de aula, tipo de curso— y las cadenas de reemplazo son operables en campo |

**V8 no exige aulas idénticas.** Un sorteo probabilístico con otra semilla da
otras aulas y eso es correcto. Lo que tiene que reproducirse es el
**comportamiento**: si la muestra de 2026 se parece a la de 2025 en composición
y cobertura, el mecanismo sirve; si sistemáticamente sobrerrepresenta algo que
2025 no sobrerrepresentaba, hay un defecto.

## La cola

| # | Qué | Vara | Estado |
|---|---|---|---|
| L1 | Reunir el material de 2025 | — | ☑ **completo** (2026-08-16) · Gonzalo señaló `Historico 2025/`: la selección entera está ahí |
| L2 | Arrancar un proyecto **vacío** y cargar sólo las bases | V1 | ☐ · necesita una pila SIN bootstrap; la de trabajo arranca con un `.pulso` precargado (ver abajo) |
| L3 | Aplicar criterios de alumno uno a uno, midiendo el recorte de cada uno | V1, V3 | ◐ **medido** (2026-08-16) · tabla abajo; falta el contraste con 2025 (L4, bloqueado) |
| L4 | Contrastar elegibles contra 2025 y explicar toda diferencia | V1 | ☑ **cuadra exacto** (2026-08-16) · 21.365 = 21.365 |
| L5 | Aplicar criterios de curso-horario, mismo método | V2, V3 | ◐ **medido** (2026-08-16) · tabla abajo; razón duplicada confirmada, arreglo pendiente |
| L6 | Contrastar CH elegibles contra 2025 | V2 | ☑ **cuadra exacto** (2026-08-16) · 2.468 = 2.468 |
| L7 | Auditar que cada criterio muestra su efecto en la UI | V4 | ☑ **cerrado** (2026-08-16, `7addb99c`) · el motor publica `filas_total` y cada tarjeta de criterio de alumno dice a cuántos dejó fuera; el 0 de `level` se pinta de aviso |
| L8 | Calcular el tamaño y contrastar n contra 2025 | V5 | ◐ **n planificado ENCONTRADO** (2026-08-16) · cuota 3.807 contra 3.303 logradas; falta correr el motor y contrastar |
| L9 | Decidir alumnos por CH por facultad y contrastar | V6 | ◐ **reproduce exacto** · el estadístico YA está justificado en la UI; lo que falta es de 2025, que nunca firmó la decisión |
| L10 | Obtener aulas por facultad y contrastar el reparto | V7 | ☑ **el patrón SÍ estaba** (2026-08-16) · 15 facultades, 194 aulas, en el histórico; contraste abajo |
| L11 | Sortear con el cubo y comparar el perfil con la muestra de 2025 | V8 | ◐ **perfil medido y confirmado** (2026-08-16) · idéntico con y sin descuento; el contraste con 2025 sigue bloqueado |
| L12 | Verificar que titulares y reemplazos sirven en campo | V8 | ◐ **diferencia explicada** (2026-08-16) · estaba comparando agendadas contra agendadas de n distintos; ver abajo |

## L1 · el material de 2025 (2026-08-16)

Gonzalo señaló `~/Documents/Pulso/HSTVG2026/HSVG2026.pulso` (19 MB, proyecto de
cliente **sin anonimizar** — se lee, no se copia al repo ni se commitea).

| Qué trae | |
|---|---|
| Bases | ✅ `BD estudiantes y curso-horario 2025-2.xlsx` + `Instrumento2026.xlsx` |
| Marco construido | ✅ 5.263 cursos-horario |
| **Histórico de asistencia** | ✅ `HSVBG2025_referencia_para_motor.xlsx` |
| Simulación de reemplazos | ✅ |
| **Aulas seleccionadas en 2025** | ❌ `calc_muestra_aulas_selection` vacía |
| Comparación de métodos | ❌ ausente |

El histórico, que es lo que hace medible V8:

```
agendados 1.012 · aplicados 194 · observados 194
tasa de asistencia 0,791 (k = 194)
glosario_completo = FALSE
```

**Qué desbloquea y qué no.** Con esto V1–V7 pueden medirse contra el marco y las
cuotas que este proyecto ya tiene. **V8 no**, o no del todo: el histórico dice
cómo *rindió* el campo 2025 —asistencia, cobertura— pero no **qué aulas se
sortearon**, que es contra lo que había que comparar el perfil de la muestra
nueva.

Ojo con el `glosario_completo = FALSE`: la referencia se leyó en modo degradado,
así que su tasa de asistencia es **bruta sobre matriculados**, no sobre
elegibles. Es la trampa del ADR 0060 y afecta a cómo se lee ese 0,791 —conviene
releer el intervalo antes de usarlo como vara.

## L12 · titulares y reemplazos (2026-08-16)

La configuración que el proyecto lleva guardada:

| | |
|---|---|
| Motor de sorteo | `cube_balanceado` |
| Titulares | **30** |
| **Olas de reemplazo** | **11** |
| Estratificación | `faculty`, `sex_top_1`, `size_group` |
| Descuento secuencial | activado |
| Corridas Monte Carlo | 500 |
| Semilla | 20260619 |

30 titulares × 11 olas = **hasta 330 reemplazos**, que es exactamente el
`chain_reserve` que el motor genera hoy con esta config. La cadena está bien
dimensionada respecto de sí misma.

### La diferencia de escala que hay que explicar

El histórico de 2025 registra **1.012 aulas agendadas** para 194 aplicadas. El
diseño guardado aquí suma **360 aulas en cadena** (30 + 330).

**No es necesariamente un defecto**, y hay una lectura inocente: este `.pulso` es
la preparación de **2026**, no el diseño ejecutado en 2025, así que compararlos
es comparar dos estudios. Pero la diferencia es de casi el triple y toca
directamente a V8 —«las cadenas de reemplazo son operables en campo»—, así que
merece una respuesta explícita antes de dar la parada por buena:

- ¿El diseño 2026 es deliberadamente más chico que el de 2025?
- ¿O los 1.012 de 2025 incluyen algo que estas 360 no cuentan —reagendas,
  visitas repetidas, aulas que se agendaron y no se aplicaron—?

La segunda lectura es plausible: 1.012 agendadas contra 194 aplicadas es una
proporción de casi 5 a 1, que se parece más a un registro de intentos que a una
cadena de reemplazos planificada.

**Es exactamente la clase de diferencia que la regla de este loop manda no dejar
pasar**, y no se puede cerrar sin el entregable de campo de 2025.

### La simulación tampoco se guardó

`calc_muestra_aulas_replacement_simulation` está **ausente**. Cuarto artefacto
del cálculo que el proyecto no conserva, junto al n, las aulas totales y el
reparto por estrato. Refuerza el patrón: **el `.pulso` guarda decisiones, no
resultados.**

## L7 · el recorte por criterio no llega a la pantalla (2026-08-16)

**V4 falla, y en un punto muy concreto.** El motor calcula cuánto recorta cada
criterio de alumno y lo publica:

```r
out$criterios_alumno_report <- alumno_sel$report   # calc_muestra_aulas.R:1520
```

| | |
|---|---|
| Lo publica el motor | ✅ |
| Está tipado en `api/calcMuestra.ts` | ❌ **cero** |
| Lo consume alguna superficie | ❌ **cero** |

No es «viaja tipado y nadie lo lee», que es el patrón conocido: **ni siquiera
viaja**. El cliente no declara ese campo.

Lo que la UI sí muestra es el impacto **agregado** —`ImpactoStrip` con
`estudiantesLive` / `estudiantesHard`—: cuántos estudiantes quedan en total. Y
para los criterios de curso-horario existe `RecorteDelPaso`, que sí dice llegan
/ deja fuera / quedan.

**El hueco está en los criterios de alumno.** Puedes ver que quedan 21.365, pero
no que `age` se llevó 12.924, `condition` 12.117 y `formation` 11.281 — que es
justo lo que hace falta para decidir un criterio, no el total.

### Y explica por qué `level` pasa desapercibido

El criterio que está activo y no recorta nada sólo se detecta calculándolo a
mano, como se hizo en L3. Con el desglose en pantalla, un `0` al lado de `level`
lo delataría de un vistazo.

Los dos hallazgos son el mismo: **la superficie no distingue un criterio que
muerde de uno que no**, y esa distinción es la vara V3 entera.

### Primer paso dado: el dato ya cruza al cliente (2026-08-16)

`normalizeCalcMuestraCriteriosAlumnoReporte` tipa y normaliza el reporte, con la
regla que lo hace útil: **devuelve `null` cuando el frame no lo trae, y descarta
un criterio cuyo conteo no venga**, en vez de publicar un `0`. Un cero afirmaría
que el criterio no dejó pasar a nadie —lo contrario de lo que significa un
conteo ausente—, y esa distinción entre «no se midió» y «midió cero» es
exactamente lo que este dato existe para hacer visible.

Verificado con mutante: quitando esos dos guards caen 2 de los 5 tests.

**Falta la superficie**, que es donde el hallazgo se cierra de verdad: una
columna por criterio con cuánto recorta, y un `0` visible al lado de `level`.

## L10 · el reparto de aulas por facultad (2026-08-16)

Los dos componentes traen **15 estratos** con N que suma **21.365** —cuadra con
los elegibles— pero **todos los campos del reparto están en cero**:
`cuota_fija`, `sobremuestra_fija`, `aulas_base_fijas`,
`aulas_extra_operativas`, `promedio_conglomerado`, `mediana_conglomerado`,
`tau`. Ni un estrato con valor.

**V7 se queda sin patrón, igual que V5.** No hay contra qué contrastar el
reparto de 2025 dentro del proyecto.

### El patrón real: el `.pulso` guarda decisiones, no resultados

Tres artefactos del cálculo faltan en el proyecto guardado, y ya no parece
casualidad:

| Artefacto | ¿Se conserva? |
|---|---|
| Parámetros (z, p, e, deff) | ✅ |
| Marco y estratos con su N | ✅ |
| Decisión de alumnos por CH | ✅ |
| **n calculado** | ❌ |
| **Aulas totales** | ❌ |
| **Reparto por estrato** | ❌ |

Lo que entra a la decisión sobrevive; **lo que sale del motor, no**. Y eso hace
que un proyecto archivado no pueda mostrar su propio diseño muestral sin
recalcularlo —con el marco y la decisión exactos de entonces, que es
precisamente la cadena que resultó frágil en el GOAL hermano—.

Es la misma pregunta de contrato que abrió L8, ahora con tres casos en vez de
uno: **¿el resultado del cálculo debería sobrevivir en el `.pulso`?**

### De paso: 15 estratos frente a 18 facultades

Los componentes reparten sobre **15 estratos**; `alumnos_por_ch` publica **18
facultades**. La diferencia cuadra con el criterio `faculty`, que lista 15: las
otras tres son las que el criterio excluye —posgrado, estudios especiales y el
consorcio—.

No es un defecto, pero conviene tenerlo presente al comparar tablas: **una misma
palabra, «facultad», cuenta 18 en el marco y 15 en el diseño.** Comparar las dos
sin notarlo produce una diferencia que no existe.

## L9 · alumnos por CH por facultad (2026-08-16)

El marco de 2025 publica `alumnos_por_ch` con **18 facultades**. Recalculado
desde su propio `aula_frame` y contrastado fila a fila:

| | |
|---|---|
| Facultades publicadas | 18 |
| Facultades recalculadas | 18 |
| Mismas claves | ✅ |
| **Filas con diferencia en `n_ch` o P25** | **0 de 18** |

Muestra (nombres reales, este proyecto no está anonimizado):
`ciencias_e_ingenieria` 592 CH con P25 = 24, `ciencias_sociales` 169 con 21,
`arquitectura_y_urbanismo` 56 con 22,5, `arte_y_diseno` 63 con 18.

**La mitad reproducible de V6 queda cerrada**: el estadístico por facultad sale
del marco ejecutado y se recalcula idéntico, sin recomputar nada por otra vía.

Lo que falta de V6 no es aritmética sino justificación: **por qué P25 y no
mediana o media**. La decisión está guardada, pero el motivo de elegir el
conservador —una cuarta parte de los CH tiene ese valor o menos— es metodológico
y pertenece al estudio, no al motor.

## L8 · el tamaño (2026-08-16)

El `.pulso` de 2025 conserva **los parámetros y el marco**, pero sus dos
componentes tienen **`resultado` vacío**: el n calculado no se persiste.

| Componente | z | p | e | deff | N |
|---|---:|---:|---:|---:|---:|
| P1 · universidad | 1,96 | 0,3 | 0,025 | 2,0 | 21.365 |
| P2 · facultad | 1,96 | 0,5 | 0,050 | 1,5 | 21.365 |

Reproducido con esos parámetros:

```
P1  n0 = 1290,8  ->  finita 1217,3  ->  x deff = 2434,6   ->  2.435
P2  n0 =  384,2  ->  finita  377,4  ->  x deff =  566,1   ->    567
```

**V5 no se puede cerrar todavía**, y no por el motor: el patrón contra el que
comparar —el n que se usó de verdad en 2025— no está en el proyecto. Habría que
sacarlo del informe o del entregable de campo.

Lo que sí queda establecido: con los parámetros guardados, el tamaño es
**reproducible y trazable paso a paso** —muestra infinita, corrección por
población finita, efecto de diseño—, que es la mitad de V5 que sí depende del
módulo.

### Que el `.pulso` no conserve el n es un hallazgo, no un detalle

Un proyecto guardado que lleva sus parámetros pero no su resultado **no puede
defender su propio tamaño de muestra** sin recalcularlo. Y recalcular exige que
el marco vigente sea el mismo, que es justo la cadena que en el GOAL hermano
resultó frágil (L14: el objetivo se borraba en cada guardado).

Conecta directamente: si el resultado del cálculo se limpia al invalidar la
decisión de alumnos por CH, un `.pulso` archivado acaba sin el n con el que se
trabajó. Merece mirarse como pregunta de contrato: **¿el resultado del cálculo
debería sobrevivir en el proyecto guardado?**

## L4 y L6 · el contraste contra 2025 (2026-08-16)

**V1 y V2 quedan cerradas: reproducen el estudio de 2025 al dígito.**

| | Medido hoy | Patrón 2025 | Diferencia |
|---|---:|---:|---:|
| Universo (estudiantes únicos) | **29.090** | 29.090 | **0** |
| **Elegibles** | **21.365** | 21.365 | **0** |
| Cursos-horario totales | 5.263 | 5.263 | **0** |
| **CH elegibles (marco)** | **2.468** | 2.468 | **0** |

El patrón sale del `perfil` que el propio marco de 2025 lleva guardado
(`universo`, `cobertura.elegibles`, `aulas_totales`, `marco_aulas`); lo medido
sale de aplicar la suite de criterios a la base cruda y deduplicar por
estudiante.

**Cero diferencias que explicar**, así que la regla de «no se avanza con una
diferencia sin explicar» no frena aquí: V1 y V2 están cerradas y las paradas
siguientes (tamaño, alumnos por CH, aulas por facultad) parten de una base
verificada, no heredan desvío.

### La trampa de las dos unidades

Costó un intento: **136.284 filas ≠ 29.090 estudiantes**. La base es
alumno × curso-horario, así que un estudiante aparece tantas veces como cursos
lleva. Los criterios se evalúan por fila —106.013 filas pasan— pero el elegible
se cuenta **deduplicando por `student_id`**, y sólo entonces salen los 21.365.

Comparar 106.013 contra 21.365 habría dado una diferencia enorme y falsa. Cuando
una parada no cuadre, lo primero es comprobar que ambos lados hablan de la misma
unidad.

### `student_id` no está en el mapping

Segundo intento fallido: `mapping$student_id` no existe, así que resolver esa
columna por el mapping devuelve vacío y todo colapsa. El código de estudiante se
lee de `Código PUCP` directamente. La regla del mapping vale para las variables
de criterio, **no para la llave**.

## V1 · recorte de cada criterio de alumno (medido 2026-08-16)

Sobre el fixture reparado, 136.284 filas de la hoja `MATRICULADO`:

| Criterio | Pasan | Recorta | % | Capa |
|---|---:|---:|---:|---|
| `faculty` | 126.537 | 9.747 | 7,2 % | marco |
| `condition` | 124.167 | 12.117 | 8,9 % | marco |
| `formation` | 125.003 | 11.281 | 8,3 % | marco |
| `age` | 123.360 | 12.924 | 9,5 % | marco |
| `level` | 100.920 | 35.364 | 25,9 % | **instrumento** |
| **Todos (capa marco)** | **106.013** | **30.271** | **22,2 %** | |

Las 30.271 cuadran con las exclusiones que publica el marco construido, así que
la medición es consistente con el motor. **Verificado contra `frame$audit` el
2026-08-16**: `input_rows` 136.284, `eligible_student_rows` 106.013,
`excluded_rows` 30.271, `population_n` 21.365, `classroom_n` 5.263,
`classroom_included_n` 2.468. El agregado siempre estuvo bien; lo que estaba mal
era el reparto por criterio.

> **Corregido el 2026-08-16.** Esta tabla llegó a publicar `level` con recorte 0
> en capa marco y `faculty` con 128.018. Las cifras buenas son las de arriba,
> leídas del `criterios_alumno_report` que el propio proyecto trae guardado:
> `level` es el que MÁS recorta y su capa es `instrumento`. Detalle al final del
> documento.

**La suma de los recortes individuales de capa marco (46.069) supera al conjunto
(30.271)** porque muchas filas caen por más de un criterio a la vez — se ve en
las razones combinadas que publica el marco (`age|condition`,
`condition|formation`…). Eso significa que **el recorte de un criterio no se
puede leer aislado**: quitarlo no devuelve sus 12.000 filas, devuelve sólo las
que no caían también por otro.

### `level` recorta mucho y aun así no reduce el marco

Es el criterio que **más** discrimina de los cinco: deja fuera 35.364 filas de
136.284. Y sin embargo no toca la población elegible, porque su capa es
**`instrumento`**: por diseño se reporta y se valida después del campo, no
recorta el marco.

Para V3 —«los criterios se entienden solos»— éste es el caso exigente, pero no
por lo que escribí primero. Un criterio que recorta un cuarto de las filas y aun
así no cambia el marco es indistinguible, mirando sólo el marco, de uno que no
hace nada. La distinción está en la capa, y la pantalla tiene que decirla — cosa
que hoy hace: la tarjeta muestra «deja pasar N · en capa instrumento no recorta
el marco, se valida después».

> **Este bloque decía lo contrario** hasta el 2026-08-16: que `level` estaba
> declarado con `fromValue = NA` y dejaba pasar las 136.284 filas, con tres
> lecturas posibles sobre si era un error de configuración o de anonimización.
> Nada de eso era cierto. Salió de calcular el recorte a mano contra `Ciclo
> (2025-I)` en vez de contra la columna mapeada, y sobrevivió varios ticks
> porque nadie —yo— volvió a mirar el `criterios_alumno_report` que el propio
> proyecto trae guardado. La lección quedó anotada en el loop: leer la fuente,
> no la memoria.

## V2 · recorte de los criterios de curso-horario (medido 2026-08-16)

Sobre el marco del proyecto **real** de 2025-2 (no el fixture): 5.263
cursos-horario.

Cifras leídas del `exclude_reason` del `aula_frame` guardado, verificadas una a
una el 2026-08-16: la tabla cuadra exacta con la fuente.

| Criterio | Recorta | % del marco |
|---|---:|---:|
| `min_eligible` | 2.320 | 44,1 % |
| `min_eligible_per_class` | 2.320 | 44,1 % |
| `enrolled_total` | 1.755 | 33,3 % |
| `session_type` | 997 | 18,9 % |
| `modality` | 638 | 12,1 % |
| `teacher_type` | 398 | 7,6 % |
| **Resultado** | **2.795 excluidos** | **53,1 %** → quedan **2.468** |

**Ninguno de los 2.795 excluidos queda sin razón declarada.** Es el fix de L1 del
GOAL hermano funcionando sobre un proyecto de cliente real, no sobre el fixture.

El marco de CH se recorta **más de la mitad**, y el peso está muy concentrado: el
mínimo de elegibles por aula se lleva 44 puntos de los 53.

### Hallazgo: `min_eligible` y `min_eligible_per_class` recortan exactamente lo mismo

2.320 los dos, hasta la unidad. Y **son distintos por diseño**: el frontend los
rotula aparte —«Mínimo de alumnos elegibles» y «Mínimo por aula (filtro base)»—
precisamente porque *«aparecen juntos y con el mismo nombre eran
indistinguibles»*.

**Resuelto: es una razón duplicada, no dos criterios.** Medido comparando los
conjuntos, no los totales:

```
min_eligible           2.320
min_eligible_per_class 2.320
ambos a la vez         2.320
solo uno u otro            0
conjuntos idénticos     TRUE
```

Y esas 2.320 son exactamente las aulas con `eligible_n < 15`, que es el umbral
de `filters$min_eligible_per_class`. Mientras tanto,
`criterios_seleccion$minEligible` está **vacío (`{}`)**: el criterio de la suite
no está configurado en este proyecto.

Así que **actúa un solo filtro y el motor emite dos razones para él**. Dos
consecuencias, y la segunda es la grave:

1. Quien sume recortes por razón cuenta 2.320 dos veces — la suma de esta tabla
   ya no es interpretable sin saberlo.
2. La pantalla muestra **dos criterios donde hay uno**. El usuario cree estar
   decidiendo algo que ya está decidido, y si mueve el que no actúa no pasa
   nada, sin que nada se lo diga.

Es exactamente el defecto que V3 vigila.

**Arreglado (2026-08-16).** Cuando el criterio de la suite no trae umbral propio
y hereda el del filtro legacy, **el flag se conserva y la razón se calla**: el
corte se sigue aplicando, pero quien lo firma es el filtro de quien realmente
vino la decisión. Con umbral propio, la suite sí publica su razón, porque
entonces decide algo distinto.

Suite tras el cambio: **68 archivos · 4648 PASS · 0 FAIL**.

### El primer test era un falso verde

Vale anotarlo porque es la clase de error que este loop existe para atrapar. La
regresión inicial montaba el caso con `byVariable = list()` — suite vacía— y
pasaba en verde. **Con el defecto reintroducido también pasaba**: con la suite
inactiva ese criterio ni se evalúa, así que el test no distinguía nada.

Se arregló activando la suite con un criterio cualquiera. Sólo entonces el
mutante cayó. **Una regresión de criterios necesita la suite activa, o mide un
camino que el defecto ni recorre.**

## Trampa medida: la columna se toma del mapping, no del nombre

Primera medición de esta tabla dio `level` recortando el **100 %**. El error era
mío: elegí la columna a ojo (`Ciclo (2025-I)`) cuando el mapping del proyecto
apunta a `Nivel curricular`. Dos columnas plausibles, y la equivocada convierte
un criterio inocuo en uno que vacía la base.

Vale para todo este loop: **las columnas se resuelven por
`frame$config$mapping`, nunca por el nombre que parece.**

## Reglas de este loop

**Una parada por vez, y no se avanza con una diferencia sin explicar.** Un
número que no cuadra y se deja para después contamina todas las paradas
siguientes: si los elegibles difieren en 300, el tamaño, las cuotas y las aulas
heredan ese desvío y ya no se puede saber cuál de los cuatro falla.

**Diferencia explicada ≠ diferencia corregida.** Si 2026 excluye 40 alumnos que
2025 incluía porque el criterio de edad cambió a propósito, eso es una
diferencia **cerrada**. Lo que no vale es «serán redondeos».

**Se anota lo aprendido de cada parada, incluso cuando cuadra a la primera.** De
dónde sale cada cifra y qué la mueve es justo lo que la próxima reconstrucción
no tendrá que reinvestigar.

**El recorrido es el de un usuario, no el de la API.** Lo aprendido en el GOAL
hermano: `POST /calcular` devuelve `409 facultades_incompletas` porque el
handoff Marco → Cálculo vive en el frontend. Una validación sólo por HTTP se
salta pasos que el usuario sí recorre — y son justo los que fallan.

## Trampas heredadas (ya pagadas, no volver a pagarlas)

Vienen de `goal-calc-muestra-marco-defendible-2026-08-15.md`, que conviene leer
antes de empezar:

1. **Llamar al motor no es reproducir el flujo.** Se midió A1 por llamada
   directa y se dio por reparado cuando por la app seguía roto.
2. **Con la suite de criterios activa, los filtros legacy de alumno NO filtran**
   (`calc_muestra_aulas.R:1124`). Afecta directamente a V1.
3. **El fixture `hsvg2026` estuvo envenenado**: el anonimizador cambió los
   valores de facultad y no los criterios guardados. Reparado, pero explica por
   qué cualquier cifra vieja de ese proyecto es sospechosa.
4. **Las facultades del fixture son nombres de persona.** Se puede validar «por
   facultad» a nivel de conteo, no de nombre.
5. **El orden importa:** firmar la decisión de Alumnos por CH obliga a
   reconstruir el marco. Hacerlo al revés cuesta dos reconstrucciones de 4 min.
6. **`testthat::test_dir` con filtro da falsos rojos**; usar `test_file`, locale
   `en_US.UTF-8`.

## Lo que espera a Gonzalo

| # | Decisión | Por qué no puedo yo |
|---|---|---|
| L1-bis | **Dónde está la selección de aulas de 2025**: el `.pulso` señalado trae bases, marco e histórico de asistencia, pero su `calc_muestra_aulas_selection` está vacía. ¿Existe en otro archivo —el entregable de campo, una hoja de ruta, el Excel que se mandó a la universidad—? | Sin ella, V8 sólo puede medirse por el rendimiento agregado (0,791 de asistencia), no por el perfil de las aulas sorteadas, que es lo que este loop quería contrastar |

## Cómo se corre cada visita

Reusar la pila propia antes de levantar nada; el **8787 es de Gonzalo y no se
toca**. Sondear el front por `localhost`, no por `127.0.0.1`. Toda espera de
servidor con bucle y tope de tiempo.

```bash
make dev-status
```

## L11 · Perfil de lo que sortea el cubo sobre el marco de 2025 (2026-08-16)

Sorteo real sobre el marco del `.pulso` de 2025-2 (2.468 cursos-horario
incluidos, semilla 20260619, selector `cube_balanceado`, familia
`balanced_probability`, 2,2 s). El `.pulso` no trae selección guardada, así que
esto es lo que el motor produce hoy con esa configuración — no lo que se hizo en
2025, que sigue sin patrón.

**Lo que sale**: 30 titulares, 330 reservas en cadena, 2.108 en bolsa extra.

| Dimensión | Marco | Titulares | Lectura |
|---|---|---|---|
| Facultades cubiertas | 16 | **10** | 6 facultades sin ninguna aula |
| Ciencias Sociales | 6,8% | 16,7% (5) | sobrerrepresentada 2,5× |
| Ciencias e Ingeniería | 24,0% | 13,3% (4) | a la mitad |
| Tamaño de aula (G1–G4) | — | — | cercano: 33/30/20/17% contra 28/24/30/18% |
| Elegibles por aula | media 34, mediana 33 | media 32,7, mediana 30,5 | cuadra |

**El hallazgo que no necesitaba el entregable de 2025**: el diseño declara **84
estratos** y sortea **30 titulares**. 54 estratos no pueden recibir ninguna aula
por aritmética, antes de cualquier azar. El motor puntuaba la representatividad
en 36,9/100 con Facultad en 0,0 (distancia 1,000) y avisaba del desbalance, pero
nombrando el hecho y no la causa. Reparado en `1f19284b`.

Queda abierto si 84 estratos sobre 30 aulas es lo que se quiso en 2025 o una
deriva de la configuración guardada: eso lo decide el entregable.

**Dos cosas más que el sorteo dejó a la vista**, sin tocar todavía:

- `descuento_sin_ids`: **resuelto** (2026-08-16, `9b655112`). No era un mapeo
  que faltara: el `.pulso` lo guardó 0.7.1 el 2026-08-06, dos días antes de que
  los ids pasaran a subrogarse en vez de borrarse al guardar (`a859b321`, F114).
  Reconstruido desde su propio archivo fuente (93,6 s, 5.263 aulas) la columna
  vuelve. El motor de hoy está bien; lo que fallaba era el aviso, que decía el
  síntoma en jerga interna y tapaba dos situaciones opuestas —marco recuperable
  contra marco anónimo por diseño—. Ahora dice cuál es y, cuando la hay, la
  salida.

### El descuento no mueve este diseño (2026-08-16)

Rehíce el marco desde el archivo fuente del propio `.pulso` —139,9 s, y hay que
pasarle la hoja `CURSO Y HORARIO` o salen 0 incluidas— y volví a sortear con el
descuento activo. **Reproduce las 2.468 incluidas exactas** y el perfil sale
idéntico: las mismas 30 aulas, las mismas 10 facultades, los mismos 30 estratos.

La razón se mide: entre las 30 titulares hay **981 exposiciones alumno-aula y
972 alumnos únicos**, o sea 9 repetidos (0,9%). El descuento aplica —modo
`post_hoc`, sin advertencias— y no tiene prácticamente nada que descontar. La
métrica agregada lo dice bien ("Perdida por duplicacion 0.9%") y `ya_cubiertos`
sale 0 en los 30 estratos porque cada uno lleva una sola aula: los 9 repetidos
cruzan estratos, no se solapan dentro de ninguno.

**El perfil de L11 vale tal cual.** Con el marco reconstruido el score global
sube de 36,9 a 45,6, pero eso es sólo que cobertura y duplicación dejan de ser
NA y entran al promedio — la selección no cambió.
- `session_type` está vacío en todo el marco de 2025, así que esa dimensión del
  perfil no se puede contrastar con nada.

## La diferencia de V8 estaba mal planteada (2026-08-16)

«1.012 aulas agendadas en 2025 contra 360 en cadena» comparaba dos cosas que no
son comparables. El histórico de asistencia que viaja en el `.pulso`
(`calc_muestra_referencia_asistencia`, de `HSVBG2025_referencia_para_motor.xlsx`)
lo dice entero:

| 2025 | |
|---|---|
| Aulas **agendadas** | 1.012 |
| Aulas **aplicadas** | **194** |
| Matriculados en esas 194 | 7.070 |
| Elegibles presentes | 6.232 · asistentes 4.931 (tasa 0,791) |
| Encuestas enviadas | 3.698 (75,0% de los asistentes) |
| Encuestas **válidas** | **3.303** (89,3% de las enviadas) |

Las 1.012 agendadas sostienen **194 aulas aplicadas**: 5,22 agendadas por aula
que efectivamente se aplicó. Este diseño reserva 12 por titular (30 titulares +
330 en cadena), o sea que su cadena es **más conservadora**, no más corta. La
diferencia real no está en la cadena: está en el n — 194 aulas contra 30.

**Corrección a lo que anoté antes**: dije que el `.pulso` no conserva el n de
2025 y es inexacto. Conserva el **logrado** —194 aulas, 3.303 válidas— en esta
referencia. Lo que falta es el **planificado**, que es otra cosa y sigue
necesitando el entregable: 194 aplicadas puede ser el objetivo cumplido o lo que
quedó tras perder aulas por el camino, y esas dos historias piden decisiones
distintas.

**La referencia no es evangelio**: se declara `verificada: FALSE`, con 21
registros inconsistentes de 194 verificables, 3 casos con más asistentes que
matriculados y 21 con más enviadas que asistentes. Y su propio aviso lo dice:
`referencia_post_hoc_no_equivale_a_medicion_del_marco_vigente`.

## La cadena de 11 no cabe en la mitad de las celdas (2026-08-16)

Medido sobre el marco real de 2025-2, y verificado paso a paso antes de
concluir nada:

- Las reservas salen **siempre del mismo estrato** que su titular: 330 de 330.
  Así que una celda necesita al menos 12 cursos-horario para sostener un titular
  más sus 11 reservas.
- De los **84 estratos, 44 no llegan a 12**. Entre los cuatro estudios que caben
  ahí sólo hay 219 cursos-horario de los 2.468 — son celdas chicas, pero son la
  mitad del diseño.
- El sorteo medido no cayó en ninguna, pero **por poco**: el estrato más chico
  que recibió titular tiene 13 CH y llenó su cadena justo, dejando uno de sobra.
  28 de los 30 elegidos están entre los 30 más grandes, y aun así el más chico
  quedó a uno de la línea. No es un riesgo remoto.

### Corrección (2026-08-16, medida): la celda corta no se queda en cero

Escribí antes que una celda de un solo curso-horario dejaría a su titular «sin
ninguna reserva posible». **Es falso**, y lo cacé leyendo el mecanismo en vez de
suponerlo. La estrategia por defecto es `max_complete_chains_by_cell` con
`min_replacements_per_titular = 1`, y el candado de celda —`strict_cell`— sólo
se activa **pasada** esa primera reserva. Verificado llamando directamente al
selector de cadena: en profundidad 1 elige un curso-horario de la misma
**facultad** aunque sea de otro estrato; de la 2 en adelante, si no hay nada en
su propia celda, no elige nada.

Así que esa celda termina con **una** reserva, no cero. Y ahí está lo que de
verdad preocupa: `reserve_depth_target` vale **1** de fábrica mientras el diseño
construye cadenas de **11**. Con profundidad 1 el objetivo se cumple, así que ni
el motor ni la pantalla dicen nada — un titular con una sola reserva, y encima
de otra celda, pasa por conforme. El objetivo no mide lo que el diseño pretende.

Esto no invalida el aviso de `08fb3c9e` —una celda en cero sigue siendo posible
si se agota el pool entero, y el promedio seguiría tapándola—, pero sí corrige
cuál es el caso frecuente: no es el cero, es el uno que nadie mira.

Cuánto muerde depende de la profundidad elegida:

| Reservas por titular | Celdas que no la sostienen |
|---|---|
| 1 | 5 de 84 |
| 3 | 17 de 84 |
| 5 | 22 de 84 |
| **11** (el diseño actual) | **44 de 84** |

El motor ya avisa cuando una celda queda por debajo del objetivo (`08fb3c9e`),
pero avisa **después de sortear**. La pregunta de fondo —si el sorteo debería
evitar las celdas que no pueden sostener la cadena, o si debe poder caer en
ellas y quedarse corto— no la decide el motor: sesgar la selección para evitar
celdas chicas cambia las probabilidades de inclusión, y eso es una decisión
metodológica con consecuencias en los pesos.

**Bloqueado, no pendiente.** Espera decisión de Gonzalo entre tres caminos —y,
a la luz de la corrección de arriba, con una cuarta pregunta previa: si
`reserve_depth_target` debería seguir en 1 cuando el diseño arma cadenas de 11,
porque mientras valga 1 ningún aviso puede detectar una cadena que se quedó a
un décimo de lo previsto:

1. **Dejarlo como está** y confiar en el aviso posterior: el diseño acepta que
   una celda chica se quede sin cadena completa y se cubra con la bolsa extra.
2. **Bajar la profundidad** a una que quepa en más celdas (con 5 caen 22 en vez
   de 44), aceptando menos colchón donde sí había sitio.
3. **Agrupar los estratos chicos** antes de sortear, que es la misma salida que
   ya pide el aviso de estratos inalcanzables — 84 estratos para 30 aulas.

La tercera resuelve dos problemas de una vez y no toca las probabilidades del
sorteo, pero cambia el diseño muestral y por eso no la elijo yo.

## El «porqué del P25» no está en el `.pulso` de 2025 (2026-08-16)

Fui a documentar la justificación del estadístico de alumnos por curso-horario y
encontré dos cosas, ninguna de ellas la que esperaba.

**Primera: la justificación ya existe.** Los tres métodos llegan a pantalla con
su lectura, no como etiquetas sueltas:

| Método | Lo que dice la UI |
|---|---|
| **P25** | «Conservador: una cuarta parte de los CH tiene este valor o menos» |
| Mediana | «Centro robusto: divide los CH elegibles en dos mitades» |
| Media | «Promedio: sensible a CH excepcionalmente grandes» |

Y el aviso lo remata: «P25 es la recomendación provisional por su lectura
conservadora». O sea que L9 no pedía escribir una justificación que faltara: ya
estaba escrita, y dice por qué, no sólo qué. **Nada que arreglar aquí.**

**Segunda, y ésta sí importa: en el `.pulso` de 2025 la decisión está VACÍA.**
`alumnos_por_ch_decision` llega con todos sus campos en `""` —`schema`,
`frame_hash`, `denominador`, `estadistico_default`, `por_facultad` vacío,
`confirmado_at` vacío—. Nunca se firmó.

Eso corrige la pregunta que este loop venía arrastrando: **«el porqué del P25»
no tiene respuesta dentro del proyecto**, porque en 2025 no se eligió P25 ni
ningún otro estadístico por esta vía. El `p25` que aparece hoy es el *default*
del cliente (`metodoAlumnosPorChInicial` cae a `"p25"` cuando no hay nada
guardado), no una decisión heredada.

Y matiza lo que anoté como «L9 reproduce exacto»: lo que reproduce exacto es el
**snapshot** —media, P25 y mediana por facultad, calculados desde el marco—, que
no depende de ninguna decisión firmada. El contraste contra lo que 2025 usó de
verdad sigue esperando el entregable.

## L2 necesita una pila sin proyecto precargado (2026-08-16)

Intenté arrancar el camino desde cero y me topé con lo obvio en cuanto lo miré:
**la pila de trabajo arranca con un proyecto ya abierto**. El backend del 8801
corre con `PULSO_BOOTSTRAP_PROJECT` apuntando al proyecto de referencia
`hsvg2026.pulso`, y el front que respondía mostraba otro estudio ya cargado. Con
un `.pulso` precargado no hay «proyecto vacío» que recorrer: el BootGate ya pasó
y el marco ya existe.

Tampoco sirve pedirle una sesión virgen al backend por HTTP: `/api/session` no
existe en esa forma —devuelve 404— y `/api/calc-muestra/state` sin cabecera
responde `E_NO_SESSION`. El camino de sesión limpia es el del propio arranque,
no un endpoint que se pueda invocar de lado.

Así que L2 **no es un ítem de medición sino de montaje**: hace falta levantar
una pila propia sin `PULSO_BOOTSTRAP_PROJECT`, cargar sólo las dos hojas del
archivo de 2025 (`MATRICULADO` y `CURSO Y HORARIO`) y recorrer Definición →
Criterios → Marco anotando qué se rompe y qué no se explica solo. Es el único
ítem de la cola que no espera ni una decisión ni el entregable, así que conviene
hacerlo con el tiempo que pide —el marco tarda ~140 s— en vez de a trozos.

## L2 · Lo que encuentra quien empieza desde cero (2026-08-16)

Levanté una pila propia sin `PULSO_BOOTSTRAP_PROJECT` (puerto 8811, cerrada al
terminar) y recorrí el camino desde una base mínima. Dos cosas, y la segunda es
un defecto en algo que construí yo hace unos ticks.

**Primera, una corrección más a lo que había supuesto**: el marco **no exige** el
catálogo de cursos-horario. Con una base mínima de alumnos y `catalogo = NULL`
salen 2 aulas y las 2 incluidas. Lo de «sin la hoja CURSO Y HORARIO salen 0
incluidas» era cierto del archivo real de 2025, no una regla del motor — y la
causa está en la segunda cosa.

**Segunda: un criterio declarado sobre una columna que la base no trae deja
pasar a todo el mundo, en silencio.** Declarando `formation` en capa marco sobre
una base que no tiene esa columna, el reporte publica `filas_pasan = 4` de 4 y el
marco incluye las 2 aulas. Los `warnings` del frame hablan de modalidad y de
condición académica —auditorías suyas— pero **ninguno dice que se declaró un
criterio sobre una columna ausente**.

Eso rompe justamente la superficie de L7 (`7addb99c`): la tarjeta de ese
criterio diría «en el marco construido dejó fuera a 0: está declarado y no
filtra a nadie», que es **falso**. No es que el criterio no restrinja: es que no
se pudo evaluar. Son las dos cosas que ese desglose existe para distinguir, y ahí
las confunde.

La UI sí avisa al declarar —`CriterioCard` pinta «variable sin columna mapeada»—,
así que el hueco está en el lado del motor: el reporte no marca la diferencia
entre «evaluado y no recortó» y «no evaluable», y por eso la pantalla afirma lo
primero cuando pasa lo segundo.

**Pendiente concreto** (no bloqueado, no exige decisión): que
`calc_muestra_aulas_criterios_alumno` marque en su reporte los criterios cuya
columna no está en las filas, y que la tarjeta lo diga en vez de «no filtra a
nadie».

## Corrección importante: `level` sí discrimina, y está en capa instrumento (2026-08-16)

Barriendo el módulo leí el `criterios_alumno_report` que el proyecto real trae
guardado, y desmiente lo que vengo repitiendo desde hace varios ticks.

| Criterio | Filas que deja pasar | Capa |
|---|---|---|
| **level** | **100.920** | **instrumento** |
| age | 123.360 | marco |
| formation | 125.003 | marco |
| condition | 124.167 | marco |
| faculty | 126.537 | marco |

**`level` es el criterio que MÁS discrimina de los cinco**, no el que no muerde:
deja fuera 35.364 filas de las 136.284. Lo que había escrito —«estaba declarado
y dejaba pasar las 136.284 filas»— es falso. Vino de una medición temprana hecha
a mano con la columna equivocada (`Ciclo (2025-I)` en vez de la mapeada), y esa
lectura se me quedó pegada como ejemplo motivador en varios commits y notas.

**Y la razón por la que no reduce el marco es otra, y está bien**: `level` vive
en capa **instrumento**, no en marco. Por diseño se reporta y se valida después,
no recorta la población. Eso no es un defecto: es la elección de capa que el
módulo permite hacer, y el motor la respeta.

**Qué se salva y qué no.** Las tres piezas construidas siguen siendo correctas y
útiles —el desglose por criterio, `filas_total` y `evaluable`—, y la propia
tarjeta ya trata bien este caso: para un criterio de capa instrumento dice «deja
pasar N · en capa instrumento no recorta el marco, se valida después», que es
exactamente lo que pasa con `level`. Lo que estaba mal era el relato, no el
código. Pero conviene saberlo: **en el proyecto real de 2025-2 no hay ningún
criterio de alumno inerte**, los cinco discriminan.

## L10 · el reparto por facultad de 2025 estaba en el histórico (2026-08-16)

Escribí que el reparto de aulas por facultad «tampoco se persiste». **Es falso, y
lo señaló Gonzalo.** Miré la estructura de `calc_muestra_referencia_asistencia`
por encima —`str` a dos niveles— y no abrí `dimensiones`, que es donde está.

La dimensión `facultad` trae **15 filas** con las aulas aplicadas de cada una.
Suman **194 exactas**, y sus matriculados suman **7.070**: cuadra con el global,
así que es el reparto real y no una muestra de él. Hay además
`celdas_criterios$rows` con **150 filas** de facultad × celda (tamaño, rango
horario, tipo de sesión), que suman 582 = 194 × 3 dimensiones.

| Facultad | 2025 (aulas aplicadas) | Sorteo de hoy (30 titulares) |
|---|---:|---:|
| CIENCIAS E INGENIERIA | 40 (20,6%) | 4 (13,3%) |
| ESTUDIOS GENERALES CIENCIAS | 26 (13,4%) | 3 (10,0%) |
| ESTUDIOS GENERALES LETRAS | 23 (11,9%) | 4 (13,3%) |
| CIENCIAS SOCIALES | 17 (8,8%) | 5 (16,7%) |
| DERECHO | 16 (8,2%) | 4 (13,3%) |
| ARTE Y DISEÑO | 12 (6,2%) | 2 (6,7%) |
| CIENCIAS Y ARTES DE LA COMUN. | 11 (5,7%) | 3 (10,0%) |
| **ARTES ESCÉNICAS** | 11 (5,7%) | **0** |
| GESTIÓN Y ALTA DIRECCIÓN | 9 (4,6%) | 2 (6,7%) |
| ARQUITECTURA Y URBANISMO | 7 (3,6%) | 2 (6,7%) |
| **EDUCACION** | 7 (3,6%) | **0** |
| PSICOLOGÍA | 6 (3,1%) | 1 (3,3%) |
| **LETRAS Y CIENCIAS HUMANAS** | 4 (2,1%) | **0** |
| **GASTRONOMÍA, HOTELERÍA Y TURISMO** | 3 (1,5%) | **0** |
| **CIENCIAS CONTABLES** | 2 (1,0%) | **0** |

**2025 cubrió 15 facultades; el sorteo de hoy cubre 10.** Las cinco que caen son
las cinco más chicas, y entre ellas suman 27 aulas del operativo de 2025 —
ARTES ESCÉNICAS sola aportó 11, más que ARQUITECTURA o EDUCACION.

Esto no es un defecto del sorteo: con 30 titulares no caben 15 facultades
repartidas como en un operativo de 194. Pero **da contenido a la decisión
bloqueada de la cadena**: las facultades que hoy quedan fuera son exactamente
las que 2025 sí cubrió, y agrupar los estratos chicos —la tercera opción— es lo
que las devolvería.

**Lo que sigue sin estar**: la lista de aulas una a una. Las 150 filas tienen
grano facultad × celda, sin ningún identificador de curso, horario ni aula. Así
que L11 —contrastar el PERFIL de las aulas sorteadas contra las de 2025— sigue
necesitando el entregable; lo que ya no necesita nada es el reparto por facultad.

## La selección de 2025 existe entera: `Historico 2025/` (2026-08-16)

Segunda vez en el mismo día que doy por ausente algo que estaba, y otra vez lo
señaló Gonzalo. La carpeta `~/Documents/Pulso/HSTVG2026/Historico 2025/` tiene
siete archivos; el central es
**`HSVBG2025_base_historica_aulas_ADR0060.xlsx`**: 1.012 aulas × **136 columnas**,
en cuatro hojas —Base completa (1.012), Solo aplicadas (194), No aplicadas y
reemplazadas (36), Resumen aplicabilidad (39)— más un Diccionario de las 136
columnas.

Trae lo que este loop llevaba pidiendo: `curso_horario`, `estrato_id`,
`posicion_cadena`, `rol_en_cadena`, `fue_titular`, `ola_muestra`, `resultado`,
`prob_seleccion`, `peso_diseno`, `meta_cuota`, `candidatos_en_cadena`,
`aulas_aplicadas_estrato`, `estrato_requirio_reemplazo`, y el detalle de campo
completo por aula.

### Lo medido, que corrige varias cosas que escribí

| | 2025 (real) | Diseño de hoy |
|---|---:|---:|
| Estratos | **170** | 84 |
| Titulares | **170** (uno por estrato) | 30 |
| Aulas agendadas | 1.012 | 360 |
| Cadena por titular | **3 a 12, mediana 6** | 11 fija |
| Olas | **12** | 11 |
| Aulas aplicadas | 194 | — |
| **Cuota planificada** | **3.807** | — |
| Válidas logradas | 3.303 (86,8% de la cuota) | — |

**Tres correcciones a lo que este documento afirmaba:**

1. **El n planificado es 3.807**, suma de `meta_cuota` por estrato. Escribí que
   «sigue sin patrón». Lo hay, y el operativo cumplió el 86,8%.
2. **Los titulares fueron 170, no 194.** Las 194 son aulas *aplicadas*: algunos
   estratos aplicaron más de una. Comparar 194 con 30 titulares mezclaba dos
   cosas.
3. **La cadena de 2025 NO era de profundidad fija.** Iba de 3 a 12 candidatos con
   mediana 6, adaptada a lo que cada estrato daba. El diseño de hoy usa 11
   uniformes — y ésa es justo la rigidez que deja 44 de 84 celdas sin poder
   sostenerla.

Ese tercer punto informa directamente la decisión bloqueada de la cadena: el
precedente de 2025 no es «11 para todos» ni «bajar a 5 para todos», sino
**profundidad variable según lo que el estrato permite**, que es una cuarta
opción que este loop no había considerado porque no tenía el dato.

**Queda por medir** (siguiente tick): contrastar `prob_seleccion` y `peso_diseno`
contra los π que calcula el motor, el perfil de las 170 titulares contra el
sorteo, y por qué 170 estratos en 2025 frente a 84 hoy.

## En 2025 el estrato era un cupo, no una celda de cruce (2026-08-16)

Medido sobre las 1.012 filas. Los 170 estratos de 2025 **no son celdas de un
cruce de atributos**: entre las 170 titulares sólo hay 42 combinaciones distintas
de facultad × tamaño, 81 con horario y 98 añadiendo tipo de docente. Hay más
estratos que combinaciones, así que varios comparten atributos: `estrato_id` es
un **cupo de sorteo** correlativo (1…170), no una clave compuesta.

Y el candado del reemplazo era otro:

| | Candado de la cadena | Qué podía variar |
|---|---|---|
| **2025** | **Facultad** — 0 de 170 cadenas mezclan facultades | Tamaño: **148 de 170** cadenas mezclan tamaños |
| **Hoy** | **La celda entera** (`strict_cell`, facultad/sexo/tamaño) desde la 2ª reserva | Sólo la 1ª reserva puede salir de la facultad |

En 2025 el reemplazo tenía que ser de la misma facultad y punto; podía ser de
otro tamaño sin problema, y en el 87% de las cadenas lo fue. Hoy el motor exige
la celda completa a partir de la segunda reserva, y por eso 44 de 84 celdas no
pueden llenar una cadena de 11 — no hay tantas aulas dentro de una celda tan
fina.

**Esto informa la decisión bloqueada mejor que las tres opciones que planteé.**
El precedente real no es «bajar la profundidad» ni «agrupar los estratos», sino
**aflojar el candado**: cadena por facultad en vez de por celda, con la
profundidad que cada cupo permita. Con ese candado las 44 celdas cortas dejan de
serlo, porque el pool pasa a ser la facultad entera.

Sigue siendo decisión de Gonzalo —cambiar el candado cambia la equivalencia entre
titular y reemplazo, y con ello lo que significa la sustitución—, pero ahora la
opción está medida y tiene precedente en el operativo que se quiere replicar.

**Perfil de las 170 titulares de 2025**, para el contraste de L11:

| Dimensión | Reparto |
|---|---|
| Facultad (15) | C. e Ingeniería 39 · EG Ciencias 25 · EG Letras 19 · Derecho 16 · C. Sociales 15 |
| Tamaño (5) | 16-25: 46 · 36-50: 42 · >50: 36 · 26-35: 31 · ≤15: 15 |
| Bloque horario (4) | Regular tarde 65 · Regular mañana 63 · Especial mañana 34 · Especial noche 8 |
| Tipo de docente (2) | Contratado 145 · Ordinario principal 25 |
| Modalidad | Presencial 170 (única) |

## Las probabilidades de 2025 y las del motor no viven en la misma escala (2026-08-16)

| | 2025 (170 titulares) | Motor (30 titulares) |
|---|---|---|
| π mínimo · mediana · máximo | 0,009 · **0,529** · 0,999 | 0,004 · **0,024** · 0,081 |
| π medio | 0,525 | 0,027 |
| CV de π | 0,557 | 0,709 |
| Peso mediano | 1,89 | 41,9 |
| **Suma de pesos** | **935,9** | **2.105** |

Veinte veces de diferencia en el π típico. La suma de pesos explica por qué: si el
peso es 1/π, su suma estima el marco del que se sortea, y **cada diseño está
estimando un marco distinto**.

- El **motor** suma 2.105 sobre un marco medido de **2.468** cursos-horario
  elegibles: lo recupera con un 15% de subestimación. Es una comprobación
  razonable de que sus π son coherentes con su propio marco.
- **2025** suma 935,9, o sea que sorteaba de un marco de unas **936 aulas** —
  menos de la mitad de las 2.468 que el mismo criterio da hoy.

**No concluyo que ninguno esté mal.** Son años distintos y el marco de 2025 pudo
construirse con criterios más estrechos, o con la base del semestre anterior. Lo
que sí queda medido es que **la diferencia entre los dos diseños no es sólo de n
(170 contra 30) sino de universo (936 contra 2.468)**, y las dos cosas se
multiplican: por eso el π de 2025 es veinte veces mayor y no cinco.

**Para Gonzalo**: ¿el marco de 2025 era efectivamente de ~936 cursos-horario? Si
lo era, replicar el diseño exige replicar también ese recorte, no sólo el n; si
no lo era, el `prob_seleccion` del histórico mide otra cosa —π dentro del cupo,
por ejemplo— y hay que leerlo con esa clave.

## El sorteo reparte un n global hacia abajo; no suma las aulas que pide cada facultad (2026-08-16)

Lo preguntó Gonzalo: si en Cálculo se define **cuántos cursos-horario hay que
visitar por facultad**, la selección debería ir facultad por facultad hasta
llenar ese número. **No lo hace, y va exactamente al revés.**

Medido en el código y en la config del proyecto real:

- El selector recibe **`n_aulas = 30`**, un número **global**. Los `strata_cols`
  —facultad, sexo, tamaño— sirven para **balancear** el sorteo, no para fijar
  cupos.
- `calc_muestra_aulas.R:3298` hace
  `quotas <- .cm_aulas_quota_by_stratum(aula_frame, selector$n_aulas)`: **deriva**
  las cuotas por estrato **repartiendo el n global** en proporción a los
  elegibles de cada estrato.
- Y cuando `n_total < nº de estratos` —30 contra 84, que es el caso— el reparto
  ni siquiera es proporcional: `order(weights, decreasing = TRUE)[seq_len(n_total)]`
  se queda con **los 30 estratos más grandes y da 0 a los otros 54**.

Esa línea es la causa mecánica de que el sorteo cubra 10 facultades y no 15: no
es el azar del cubo, es un **corte por tamaño previo al sorteo**.

**El camino que Gonzalo describe no existe hoy.** El módulo sí calcula por
estrato lo que hace falta —el panel de Certeza publica `cuota`, `aulas_formula` y
`aulas_certeza` por fila—, pero **ese resultado no alimenta al selector**: no hay
ruta desde «esta facultad necesita N aulas» hacia el sorteo. Las dos mitades
existen y no se tocan.

Y es justo lo que 2025 sí hizo: **170 cupos, un titular por cupo**, con reparto
por facultad que cubrió las 15.

**DECIDIDO por Gonzalo (2026-08-16): el diseño pasa a cuotas por facultad, como
2025, pero sorteando con los métodos actuales.** El precedente manda en la
ESTRUCTURA —cupos por facultad, no un n global repartido hacia abajo— y el motor
manda en el CÓMO: los cuatro métodos que hoy compara son más sofisticados que el
sorteo de 2025 y se conservan.

### Contrato del cambio

Los cuatro métodos son `cube_balanceado`, `local_pivotal_balanceado`,
`sistematico_pps` y `estratificado_aleatorio` (`.cm_aulas_engine_key`), con sus
familias `balanced_probability`, `pps_probability` y `stratified_probability`.

Lo que cambia es **de dónde sale el número de aulas**, no cómo se sortean:

| | Hoy | Con cuotas |
|---|---|---|
| Entrada del selector | `n_aulas` global (30) | cuota por facultad/estrato |
| Reparto | `.cm_aulas_quota_by_stratum` divide el n hacia abajo, y con n < nº estratos se queda con los de mayor peso y deja el resto en 0 | la cuota la fija Cálculo/Certeza por estrato |
| n total | dato de entrada | **suma de las cuotas** |
| Método de sorteo | los cuatro | **los cuatro, sin cambio** — se aplican dentro de cada cuota |

**Lo que hay que cuidar al implementarlo**, porque es donde se rompe:

1. **π y pesos se redefinen.** Sortear k de N dentro de una facultad no da el
   mismo π que sortear 30 de 2.468 balanceando por facultad. `pi_final` y
   `weight_classroom` tienen que recalcularse con el nuevo esquema o los pesos
   analíticos quedan mal.
2. **El corte silencioso desaparece, pero puede volver por otra puerta**: si una
   facultad pide más aulas de las que tiene elegibles, hay que decirlo —es el
   mismo patrón de «el aviso dice la causa» que ya se corrigió tres veces hoy—.
3. **La cadena de reemplazos** sigue siendo decisión aparte (candado por
   facultad y profundidad variable), pero se vuelve más natural con cupos: en
   2025 cada cupo tenía su propia cadena.
4. **El test de `.cm_aulas_quota_by_stratum`** debe fijar primero el
   comportamiento de hoy para que el cambio sea visible en el diff, no
   silencioso. ☑ **hecho** (2026-08-16, punto 4 cerrado) — ver abajo.

---

## De dónde sale la cuota: la respuesta estaba en el diseño muestral (2026-08-16)

Gonzalo señaló `~/Documents/Pulso/HST UNSA/Diseño Muestral PUCP- 2 Escenarios 2
(2025-2026)/Diseño Muestral HSyVBG PUCP 2026 - Propuesta con dos escenarios.xlsx`.
Cuatro hojas: `Cursos-Horario` (23.133), `Estudiantes` (**136.284** — es
exactamente nuestro marco de entrada), `TD Estudiantes` y `Diseño Muestral`.

La pregunta bloqueante queda contestada, y de forma inequívoca: **la cuota de
aulas de cada facultad sale del cálculo de alumnos por curso-horario.** La
cadena, verificada al dígito sobre las dos tablas:

```
n_facultad → sobremuestra → aulas = ceil(sobremuestra / alumnos_por_CH_facultad)
```

| | Escenario 1 | Escenario 2 |
|---|---|---|
| Parámetros | **globales**: 95%, e=2,47%, p=30%, deff=2 | **por facultad**: confianza 0,90/0,95, e=0,05/0,07/0,10, p=0,2–0,6, deff=1,5 |
| n total | 2.500 | 4.050 |
| Afijación | proporcional a N (1.080/21.365 → 126) | **no proporcional**: cada facultad calcula su propio n |
| Sobremuestra | ×1,5 → 3.754 | ×1,2 → 4.865 |
| **Aulas por aplicar** | **162** | **235** |
| Ponderación | — | columna `W` explícita (N_h/N ÷ n_h/n) |

Ambas columnas de «Aulas por aplicar» reproducen exacto con
`ceil(sobremuestra / alumnos_por_CH)`: verificado en las 15 filas de cada
escenario. Y el N total de las dos, **21.365**, es el mismo número que ya cuadró
en L4.

También aparece la cuota por **sexo**: cada facultad trae `Mujeres (n)` y
`Hombres (n)`, repartidos proporcionalmente dentro de la facultad en el
escenario 1 y con el n propio en el escenario 2.

### Lo que esto cambia del contrato

El selector **recibe la cuota calculada**, no la calcula: el número nace en
Cálculo de muestra (n por facultad → sobremuestra → división por alumnos/CH) y
baja al sorteo. Las tres piezas de esa cadena ya existen por separado en el
motor —`alumnos_por_ch` publica la media y el P25 por facultad efectiva—, pero
nadie las encadena hasta «aulas por facultad».

### Corrección al encuadre: los estratos en cero no son el problema

Escribí que el reparto actual deja 54 de 84 estratos sin ninguna aula. Es
cierto, pero **es un síntoma de un n de 30, no del reparto**. Medido sobre el
marco real (4.343 aulas elegibles, 53 estratos facultad×tamaño):

| n | entradas | estratos sin entrada | aulas con π = 0 |
|---|---|---|---|
| 30 | 30 | 23 | 456 de 4.343 |
| 53 | 53 | 0 | 0 |
| **162** (escenario 1) | 53 | 0 | 0 |
| **235** (escenario 2) | 53 | 0 | 0 |

Con el n real del diseño **ningún estrato queda fuera**. Así que la razón para
cambiar el reparto no es la cobertura: es que **la regla de asignación es otra**.
Hoy se reparte proporcional a `eligible_n`; el escenario 2 es deliberadamente no
proporcional —Ciencias e Ingeniería tiene N=4.512 y recibe 17 aulas, mientras
Arte y Diseño con N=1.021 recibe 34, porque sus parámetros de precisión son
distintos—. Ningún reparto proporcional puede producir eso.

### Punto 4 cerrado: el reparto de hoy está fijado en test

`api/tests/testthat/test-calc-muestra-aulas-cuota-por-estrato.R`, 31
expectativas. Fija cuatro cosas y la consecuencia de cada una:

- con n ≥ nº estratos, reparto proporcional a `eligible_n` **con piso 1** y suma
  exacta (comprobado también con n = 84, 100, 162, 235 y 400);
- con n < nº estratos, los sobrantes **no quedan en 0: quedan sin entrada** —
  medido, era la duda del tick—. Todo lo que recorre `names(quotas)` (el sorteo,
  el aviso de cuota no factible) nunca llega a preguntar por ellos;
- la consecuencia medible de esa ausencia: **π = 0 exacto**, no probabilidad
  baja. Cobertura cero;
- el peso degenerado cae a 1 y no a 0, que es lo que evita un `NaN` cuando el
  marco entero viene sin tamaños.

Verificado con cinco mutantes sobre el fuente, revertido después (control 0/31):

| Mutante | Fallos |
|---|---|
| Los excluidos en 0 en vez de sin entrada | 5 |
| Sin piso 1 | 8 |
| Elige los estratos de menor peso | 5 |
| Peso degenerado cae a 0 | 1 |
| La suma deja de cuadrar | 7 |

El cuarto mutante **no lo detectaba la primera versión del test**: con
`na.rm = TRUE` un `NA` suelto ya suma 0, así que en el fixture original las dos
ramas daban el mismo resultado. Hizo falta el caso con **todos** los estratos
sin tamaño para separarlas. Un mutante que sobrevive no siempre es un mutante
equivalente: aquí era un hueco del fixture.

### Trampa: `frame_ok.rds` del scratchpad no sirve para nada por facultad

Sus 18 facultades se llaman «Andres», «Karina Y Elena DE LA Jimenez.», «Ricardo
Ricardo Gabriela». Viene del proyecto anonimizado, cuyas categóricas destruyó el
anonimizador. Los totales agregados sí son válidos; cualquier contraste por
facultad contra el Excel exige el `.pulso` real.

---

## L13 · Qué de la hoja de diseño muestral ya existe en el motor (2026-08-16)

Medido contra el código y corriendo el motor, no leyendo por encima. La
respuesta corta: **casi todo existe, y una pieza está escrita a mano.**

Hay un preset, `calc_muestra_aplicar_preset_hsvg()`
(`api/inst/catalogos/preset_hsvg_pucp.json`), que ya trae las 15 facultades con
su `N`, `N_a`/`N_b` (mujeres/hombres), `e_facultad`, `p_facultad` y
`confianza_facultad`. Y hay dos tests de backtesting en
`test-calc-muestra-engine.R` que reproducen **los dos escenarios del Excel**.

| Pieza | Estado | Evidencia |
|---|---|---|
| (a) n por facultad con parámetros propios | ☑ existe y **cuadra** | `.cm_calc_estratificado_independiente` dimensiona cada facultad con su `p_facultad`, `z` y `e_facultad`, y **`n_teorico` es la suma de las cuotas**: 4.049 contra los 4.050 del Excel (la cuadratura operativa añade 1 al dominio mayor) |
| (b) cuotas por sexo dentro de facultad | ☑ existe | sub-distribución proporcional a `N_a`/`N_b`; la pestaña de Distribución declara grano «facultad efectiva × sexo» |
| (c) sobremuestra | ☑ existe y **cuadra exacto** | `n_operativo` = 3.754 (escenario 1) y 4.865 (escenario 2), los dos números del Excel |
| (d) la división que da «aulas por aplicar» | ◐ **la fórmula existe pero el preset la pisa** | ver abajo |
| (e) ponderación W | ☐ **no está** | no aparece en el motor ni en las pestañas; lo más cercano es un caption sobre afijación proporcional en `CalculoPropuestasTab` |

La pestaña `CalculoCursosHorarioFacultadTab` ya publica por facultad: cuota,
método R, alumnos por CH, titulares, reservas y total a coordinar.

### (d) es el hallazgo: las aulas del preset están escritas a mano

`.cm_calc_estratificado` tiene la fórmula:

```r
aulas_base <- if ((e$aulas_base_fijas %||% 0L) > 0L) e$aulas_base_fijas
              else ceiling(cuota / (avg_e * tau_e))
```

y el preset HSVG **rellena `aulas_base_fijas` en las 15 facultades**, así que la
fórmula nunca corre. Los valores fijados son 11, 13, 11, 3, 33, 12, 9, 21, 4,
20, 18, 3, 8, 5, 6 — que son **exactamente los del Excel más uno, en todas**.
Suman 177 contra los 162 del Excel, y el test lo documenta como «bolsa uniforme
de +1 aula por facultad».

Dejando que la fórmula calcule (`aulas_base_fijas = 0`), el total se acerca
—166 contra 162— pero **el reparto por facultad no se parece**:

| Facultad | Cuota | avg × τ | Fórmula | Excel | Dif |
|---|---|---|---|---|---|
| Estudios Generales Letras | 389 | 41,4 × 0,39 | 25 | 17 | **+8** |
| Derecho | 347 | 37,2 × 0,60 | 16 | 20 | **−4** |
| Arquitectura y Urbanismo | 126 | 37,8 × 0,55 | 7 | 10 | **−3** |
| Psicología | 79 | 22,1 × 0,50 | 8 | 5 | **+3** |
| Ciencias Contables | 21 | 25,2 × 0,60 | 2 | 2 | 0 |
| Gestión y Alta Dirección | 115 | 32,0 × 0,55 | 7 | 7 | 0 |

El total cuadra por cancelación, no por acuerdo. La causa está en el divisor: el
motor usa `promedio_conglomerado × τ` y el Excel usa una única columna
«Estudiantes por Curso-Horario» que **mezcla valores calculados y valores puestos
a mano**. Nueve de sus quince entradas son redondas (20, 15, 11, 25, 22, 15, 16,
10, 25) y seis traen decimales de cálculo (24,882 · 20,113 · 26,696 · 32,217 ·
35,949 · 26,433). Ninguna fórmula única puede reproducir esa columna, porque no
salió de una sola fórmula.

### Lo que esto cambia para el trabajo pendiente

La cadena `n_facultad → sobremuestra → aulas` **ya está construida**: lo que
falta no es capacidad de cálculo, es que el número de aulas de cada facultad deje
de venir fijado. Dos preguntas que sólo Gonzalo puede contestar:

- **El +1 por facultad**: ¿es una decisión operativa vigente (bolsa de holgura) o
  un residuo del preset? Cambia si el motor debe sumarlo o si la referencia real
  son los 162.
- **El divisor**: ¿la columna «Estudiantes por Curso-Horario» del Excel se
  reemplaza por `promedio_conglomerado × τ` del marco —que es medido y trazable,
  pero da otro reparto—, o hay que poder fijarla por facultad como hizo la hoja?

Hasta que eso se decida, el cambio a cuotas por facultad no puede implementarse
sin elegir por Gonzalo, así que queda **bloqueado**, no pendiente.

---

## Corrección: la columna del Excel SÍ sale de una fórmula única (2026-08-16)

En el tick anterior concluí que «Estudiantes por Curso-Horario» mezclaba valores
puestos a mano con valores calculados, y que ninguna fórmula única la
reproducía. **Es falso, y lo era por haber leído sólo una hoja del Excel.**

La hoja `TD Estudiantes` trae la derivación completa, facultad por facultad, y
su última columna se llama literalmente **«Mínimo entre mediana y media»**:

| Facultad | Mediana | Media | mín | Excel usa |
|---|---|---|---|---|
| Arquitectura y Urbanismo | 20 | 27,585 | **20** | 20 |
| Ciencias Contables | 26 | 24,882 | **24,882** | 24,882 |
| Derecho | 33 | 26,696 | **26,696** | 26,696 |
| Estudios Generales Letras | 40 | 35,949 | **35,949** | 35,949 |
| Psicología | 25 | 47,886 | **25** | 25 |

Las quince coinciden. Los «valores redondos puestos a mano» eran las **medianas**
—enteras por naturaleza— y los «decimales de cálculo» eran las **medias**. Una
sola regla, conservadora: se queda con el divisor más pequeño de los dos, que es
el que pide más aulas.

La hoja trae además Cuartil 1 y Cuartil 3, que es de donde salía la pregunta del
P25: **está en la fuente como contexto, no como el estadístico elegido.**

### El motor ya implementa esa regla, y nadie la alimenta

`.cm_estadistico_conglomerado_estrato` acepta tres modos: `media`, `mediana` y
**`min_media_mediana`** — exactamente la regla de 2025. Pero degrada a `media`
salvo que el estrato traiga `mediana_conglomerado > 0`, y **el preset la trae en
0 en las quince**.

Peor: `mediana_conglomerado` **no aparece ni una vez en todo el frontend**. El
campo existe en R, `calc_muestra_perfil.R` calcula `est_aula_mediana` por
facultad, el adaptador la lee como `estAulaMediana` — y nadie conecta las dos
puntas. Es el patrón de siempre: una capacidad existe sólo si alguien la
consume. `min_media_mediana` hoy no puede dispararse en producción.

### La fórmula reproduce el Excel exacto cuando se la alimenta

Corriendo el motor con `min_media_mediana`, las medianas y medias de 2025 y
τ = 1/1,5:

| Configuración | Titulares | Dif contra el Excel, facultad a facultad |
|---|---|---|
| media del marco · τ del marco | 199 | 2,4,4,0,7,3,2,−2,1,3,8,−1,1,2,3 |
| media del Excel · τ del marco | 206 | 2,4,4,0,7,3,2,2,1,4,11,−1,1,2,2 |
| **media del Excel · τ = 1/1,5** | **162** | **0,0,0,0,0,0,0,0,0,0,0,0,0,0,0** |
| solo mediana · τ del marco | 197 | 2,4,4,0,7,3,1,−2,1,3,8,−1,1,2,2 |

Reproducción perfecta. Y con la holgura de +1 por facultad da **177**, que es
exactamente lo que el preset tiene escrito a mano. Así que
`aulas_base_fijas` **no era un número inventado: es lo que la fórmula produce con
los parámetros de 2025**. El motor siempre pudo calcularlo; le faltaban los
insumos.

### Decisiones de Gonzalo (2026-08-16)

1. **El +1 por facultad es holgura operativa vigente. Se mantiene.**
2. Sobre el divisor: sin preferencia técnica, pero con dos restricciones —
   **todo por facultad, nunca general**, y **los titulares no deben pasar mucho
   de 200**.

Esas dos restricciones deciden el caso, y no hacia la regla de 2025:

- τ = 1/1,5 es un factor **general** —la misma compensación de no respuesta para
  las quince facultades—. Reproduce 2025, pero contradice «todo por facultad».
- τ del marco es **medido por facultad** (0,39 a 1,00) y da **199 titulares**,
  justo por debajo del umbral de 200.

**Recomendación medida**: `min_media_mediana` con la mediana y la media del
marco y τ por facultad → **199 titulares + 15 reservas = 214 aulas a
coordinar**. Cumple las dos restricciones, es trazable al marco ejecutado y no
depende de un factor global heredado.

Lo que falta para que eso corra no es fórmula, es **cableado**: llevar
`est_aula_mediana` del perfil a `mediana_conglomerado` del estrato, y poner
`estadistico_conglomerado` en `min_media_mediana`.

---

## L14 · Hay dos motores de aulas, y el de R está congelado en 2025 (2026-08-16)

Iba a cablear `est_aula_mediana` → `mediana_conglomerado` y me encontré con que
la app ya calcula esto por otro lado. Corrección al encuadre del tick anterior
(«nadie conecta las puntas»): **sí las conecta, pero en otra capa.**

`frontend/src/features/calcMuestra/dominio/motor.ts` implementa la cadena del
Excel completa y fiel:

```ts
sobremuestra = round(cuota.n * factorSobremuestra)
estAula      = estudiantesPorAula(facultad, resumenEstAula)   // mín(mediana, media)
aulas        = ceil(sobremuestra / estAula) + bolsaExtraPorFacultad
```

con `escenario1` y `escenario2` nombrados como las dos propuestas de la hoja, y
alimentado por `datosProyecto.ts`, que toma `estAulaMediana`/`estAulaMedia`
**vivos del marco**. Incluso ofrece un tercer resumen, la cota inferior del
bootstrap, que degrada a mín(mediana, media) en facultades con menos de 15
cursos-horario.

El motor R, en cambio, calcula `ceil(cuota / (promedio_conglomerado × τ))`, y en
el preset ni siquiera llega a hacerlo.

### El defecto: `aulas_base_fijas` congela la cifra

`aulas_base_fijas` cortocircuita la fórmula cuando viene > 0, y el preset la
trae rellena en las quince. Medido:

| Marco | Con las fijas (como se envía) | Sin las fijas |
|---|---|---|
| 2025 | 177 | 166 |
| aulas la **mitad** de grandes | **177** | 324 |
| aulas el **doble** de grandes | **177** | — |

Partir a la mitad el tamaño de los cursos-horario **no mueve ni un aula**. La
fórmula sí reacciona (166 → 324, casi el doble, como manda la aritmética), así
que no es una limitación del motor: es una constante puesta encima.

Mientras el marco sea el de 2025 hace lo correcto —reproduce el estudio al
dígito—. Con el marco de 2026 el motor seguiría pidiendo las 177 aulas de 2025 y
la pantalla, que sí usa datos vivos, diría otra cosa. **Nadie avisaría.**

Fijado en `api/tests/testthat/test-calc-muestra-aulas-fijas-congelan-el-marco.R`
(16 expectativas), con dos mutantes verificados sobre el fuente y revertidos:

| Mutante | Fallos |
|---|---|
| Ignorar `aulas_base_fijas` (el arreglo futuro) | 4 |
| `min_media_mediana` deja de declarar que degradó | 1 |

Control 0/16, y `test-calc-muestra-engine.R` sigue en 138/138.

El cuarto test deja demostrado lo otro: `min_media_mediana` **hoy no cambia ni
una cifra**, porque el preset trae `mediana_conglomerado = 0` en las quince y el
motor degrada a la media en silencio. Alimentada la mediana, el modo manda y el
resultado se mueve.

### La decisión que queda

Son dos fuentes de verdad para el mismo número, y hay que quedarse con una:

- **La cadena TS** ya es fiel al Excel y usa datos vivos, pero vive en el
  frontend y no es la que alimenta el sorteo de aulas.
- **El motor R** es el que produce `aulas_por_estrato`, que es lo que consume el
  sorteo — y es el que está congelado.

Lo natural es descongelar R y darle los insumos que le faltan (la mediana por
facultad del perfil, el modo `min_media_mediana`), dejando la cadena TS como
vista previa. Pero eso **mueve los dos tests de backtesting** de
`test-calc-muestra-engine.R`, que hoy afirman 177 y 250, así que no se hace de
callado: es el siguiente paso y tiene que verse en el diff.

---

## L15 · El divisor de cada facultad ya sale del marco (2026-08-16)

Al abrir el cableado apareció que el congelamiento era más ancho de lo
reportado: el preset —y su espejo en `constants.ts`— fija **tres** cosas por
facultad, no una: `cuota_fija`, `sobremuestra_fija` y `aulas_base_fijas`. O sea
que el n por facultad que en L13 di por «calculado y cuadra» también venía
escrito cuando se corre el preset tal cual.

Pero eso sólo pasa con el preset. **Tras cargar una base real el estudio
sincroniza los estratos desde el marco** (`estratosDesdeFrame`), y esos estratos
salen con sólo `label`, `N`, `N_a`, `N_b` y las etiquetas de sexo: sin fijas
—bien— y también **sin `promedio_conglomerado`**. Sin él, R cae al parámetro
global: **28 alumnos por curso-horario para las quince facultades**, que es
exactamente el «general» que Gonzalo descartó.

Y `mediana_conglomerado` no llegaba nunca, por una razón más simple de lo que
parecía: **no estaba declarada en `CalcMuestraEstrato`**. R la acepta desde
siempre; el frontend no tenía cómo enviarla. Ese era el eslabón que faltaba para
que `min_media_mediana` pudiera dispararse.

### Lo implementado

`frontend/src/features/calcMuestra/universidad/marco/divisorDelMarco.ts`, una
función pura, `conDivisorDelMarco(estratos, facultades)`, que refresca los dos
divisores desde el perfil del marco emparejando por slug de facultad. Conectada
en los **dos** puntos donde el estudio absorbe estratos del marco:

- `CalcMuestraPage.tsx` — el handoff Marco → Cálculo, que es el camino normal;
- `UniversidadDesk.tsx` — la auto-reparación de proyectos guardados antes del
  sync automático.

Lo que deliberadamente **no** hace: pisar un divisor existente con un valor
inútil. Una facultad que el perfil no conoce, o que no tiene ningún
curso-horario elegible, conserva el suyo. «El marco no dice nada» no es «el
marco dice cero», y confundirlos es una división por cero.

### El efecto, medido

| | Titulares | Reservas |
|---|---|---|
| Hoy, tras cargar una base (promedio global 28 para las 15) | 180 | 15 |
| **Con la media por facultad** (este cableado) | **166** | 15 |
| + la mediana, con `min_media_mediana` (la regla de 2025) | 199 | 15 |

Las tres cumplen el umbral de 200. El cableado mueve 180 → 166 y, sobre todo,
deja de repartir con un número único para toda la universidad.

Verificación: `divisorDelMarco.test.ts` con 6 casos y dos mutantes sobre el
fuente (quitar la mediana → 2 fallos; quitar el guard del divisor útil → 1),
control 6/6 y fuente revertido. `tsc --noEmit` en 0 y los 153 archivos de
vitest de `calcMuestra` en 1.311/1.311.

### Lo que queda, y por qué no se hizo aquí

Poner `estadistico_conglomerado` en `min_media_mediana` es lo que lleva de 166 a
199 y reproduce la regla del diseño de 2025. **No se tocó**: cambiar ese default
mueve los dos tests de backtesting del preset (177 y 250), que son la
certificación de que el repo reproduce 2025. Eso merece su propio commit, con
los números nuevos y su porqué a la vista — que es justo lo que se avisó antes
de empezar.

---

## L16 · El estadístico que elige el Recorrido ya llega al motor (2026-08-16)

`parametros.estadistico_conglomerado` estaba **declarado en TypeScript y nadie
lo escribía**. Su propio comentario decía que es «espejo del `resumenEstAula`
del Recorrido», y el Recorrido tiene ese ajuste con default
`min_mediana_media` —la regla de 2025—, pero el parámetro nunca viajaba: R se
quedaba en su default, `media`, mientras la pantalla mostraba otra cosa.

### Por qué nadie lo había cableado: los nombres están cruzados

| | |
|---|---|
| Recorrido (TS) | `min_mediana_media` |
| Motor (R) | `min_media_mediana` |

Las mismas dos palabras en orden distinto. Un pase directo no rompe nada
visible: `calc_enum` no reconoce el valor, cae al default y el motor sigue
dividiendo por la media **sin decirlo**. Ese silencio es lo que hace que el
módulo de traducción exista en vez de una asignación.

`li_bootstrap` no tiene equivalente —la cota inferior del intervalo la calcula
el perfil, no el motor de tamaño— y se traduce a `min_media_mediana`: es el
mismo cálculo al que el propio Recorrido degrada cuando el intervalo falta, y
el más conservador de los tres que R sabe hacer. No es equivalencia exacta y
queda dicho en el módulo.

### Lo implementado

- `universidad/marco/estadisticoConglomerado.ts`, traducción explícita.
- `prepareUniversityStudyForCalculation` acepta el resumen y lo escribe en los
  dos componentes; omitirlo deja el parámetro como esté, para no decidir por
  los llamadores que no conocen el Recorrido.
- Conectado en los dos sitios que calculan: `CalcMuestraPage` y
  `UniversidadDesk`, leyendo `perfil.resumenEstAula` del store.

Verificación: 4 + 4 casos nuevos y tres mutantes sobre el fuente, revertidos —
el cableado que no escribe nada (2 fallos), el pase directo del nombre cruzado
(5 fallos) y, del tick anterior, quitar la mediana (2)—. Control 269/269 en
`universidad/marco`, `tsc --noEmit` en 0 y **1.319/1.319** en vitest de
`calcMuestra`.

### El aviso sobre los backtestings no aplicaba

Avisé dos veces de que esto movería los dos tests de backtesting del preset (177
y 250). **No se movieron**, y siguen en 138/138: el cambio vive en el payload
que arma el frontend, y esos tests corren el preset JSON de R, que no se tocó.

Tampoco se le puso el modo al preset, y es deliberado: mientras el preset siga
trayendo `aulas_base_fijas`, el modo no cambiaría ni una cifra —sólo el
`estadistico_usado` que reporta—, y añadirle las medianas de 2025 sería meter
otra constante donde el problema es justamente que hay constantes. El preset
existe para reproducir 2025; el camino vivo ya toma sus divisores del marco
desde L15.

---

## L17 · La cadena viva, verificada contra el marco real (2026-08-16)

L15 y L16 se verificaron con tests y con el preset. Faltaba la pregunta que los
tests no contestan: **¿el marco real tiene con qué alimentarlos?** Un cableado
puede estar perfecto y ser un no-op si la fuente no publica el dato.

Medido sobre el frame del estudio real:

- El perfil **sí** publica `est_aula_mediana` y `est_aula_media` por facultad,
  para las 15, con `est_aula_n_ch` al lado (577, 373, 310, 423, 144, 93…). Hay
  con qué.
- El emparejamiento por slug —el punto donde este tipo de cableado suele fallar
  en silencio— da **15 de 15**. Los estratos salen de la columna `faculty` de
  `population` y los divisores del perfil de R: dos rutas distintas, mismos
  nombres tras normalizar.

Y el payload que el frontend arma ahora, corrido contra el motor:

| Configuración | Titulares | Reservas | `estadistico_usado` |
|---|---|---|---|
| Como estaba (sin divisores → global 28) | 180 | 15 | `media` |
| Con la media por facultad (L15) | **154** | 15 | `media` |
| **Con mediana y `min_media_mediana`** (L15 + L16) | **160** | 15 | **`min_media_mediana`** |

Los cuatro puntos que había que comprobar quedan comprobados: los divisores
llegan por facultad y no en global; el estadístico viaja; el motor **declara
haberlo usado** en las quince y no degrada a la media; y los titulares quedan en
160, cómodamente bajo el umbral de 200.

Las cifras no coinciden con las del tick anterior (166 y 199) y es lo esperado:
aquellas salían de las medianas y medias del preset —las de 2025— y éstas del
marco real cargado. Que se muevan es exactamente el comportamiento que faltaba.

### Lo que sigue abierto

El recorrido visual de `CalculoCursosHorarioFacultadTab` renderizada sigue sin
hacerse. Lo verificado aquí es el motor y el payload, no la pantalla.

---

## Corrección de fondo: la decisión de Alumnos por CH manda sobre todo (2026-08-16)

Abrir la pantalla con el proyecto real cambió el diagnóstico de los tres ticks
anteriores. **La app ya elige el divisor por facultad, y por otro mecanismo.**

En Marco hay una pestaña «Alumnos por CH» que ofrece, por facultad,
**P25 · Mediana · Media**, con la distribución del marco a la vista y **P25 como
recomendación**. Eso responde de paso una pregunta que llevaba abierta todo el
loop: **el porqué del P25 no está en 2025 — es la recomendación propia de
Prosecnur**, por lectura conservadora, y la hoja de 2025 usaba otra cosa
(`mín(mediana, media)`).

La decisión se persiste en `workspace.aulas_config.alumnos_por_ch_decision`, y
al calcular, `calc_muestra_alumnos_por_ch_resolver_estudio` la aplica sobre cada
estrato:

```r
estrato$promedio_conglomerado <- normalized_value
estrato$mediana_conglomerado  <- 0
estrato$aulas_base_fijas      <- 0L
...
comp$parametros$estadistico_conglomerado <- "media"
```

con este comentario en el propio motor: *«La decisión vigente prevalece sobre
`aulas_base_fijas` y sobre los estadísticos legacy que el frontend hubiese
materializado antes»*. Y el router `/calcular` pasa **siempre** por ahí.

### Qué de lo que escribí queda en pie y qué no

- **L14 sobreestimó el congelamiento.** `aulas_base_fijas` congela el motor
  llamado directamente, pero la ruta real de la app lo pone en 0 en cada
  cálculo. La app no estaba congelada como dije; el preset sí lo está.
- **L15 y L16 no cambian lo que produce la app** cuando hay decisión
  confirmada: el divisor y el estadístico que cableé se sobrescriben. Aplican
  sólo mientras no haya decisión —proyectos anteriores al contrato v1, o antes
  de confirmar—, donde antes se caía al global 28 y ahora se usa el valor por
  facultad. Es una mejora del estado intermedio, no del resultado final.
- **L17 no era end-to-end.** Medí llamando a `calc_muestra_calcular_componente`,
  que se salta `resolver_estudio`. Por eso mis cifras se movían: estaba midiendo
  el motor, no el camino del endpoint. Un «verificado contra el marco real» que
  no pasa por la ruta real no es una verificación end-to-end, y así lo llamé.

Lo medido sobre datos reales sigue siendo cierto —el perfil publica mediana y
media por facultad, y el emparejamiento por slug da 15 de 15—; lo que era falso
es la conclusión sobre su efecto.

### Lo que la pantalla sí confirma

Abierta con el proyecto real, la mesa cuadra con el resto del GOAL: 29.090
estudiantes de universo, **21.365 elegibles**, 5.263 cursos-horario de universo
y **2.468 elegibles**. Los mismos números de L4 y L6, ahora vistos en pantalla.

La pestaña «Cursos-horario requeridos» renderiza con su vacío clasificado —«Los
cursos-horario requeridos aparecen al recalcular la muestra · Confirma Alumnos
por CH en Marco y ejecuta la propuesta»—, que es C3 cumplido: la superficie
contiene su propio vacío y dice qué hacer.

### Qué hacer con L15 y L16

No son dañinas —la decisión pone `mediana_conglomerado` en 0 y el estadístico en
`media`, así que no hay conflicto— pero sí engañosas: código que parece decidir
el divisor cuando no lo decide. Antes de dejarlas o retirarlas hay que resolver
la pregunta de fondo, que ahora es otra: **si el divisor debe seguir eligiéndose
en «Alumnos por CH» con P25/mediana/media, o si debe ofrecer también
`mín(mediana, media)`, que es lo que usó el diseño de 2025.** Eso lo decide
Gonzalo.

---

## L19 · El proyecto real NO puede calcular (2026-08-16)

Medido por la ruta real, que es la lección del tick anterior: confirmar la
decisión de Alumnos por CH en pantalla y pulsar «Calcular muestra» sobre
`HSVG2026.pulso`.

`POST /api/calc-muestra/calcular` → **409**:

```json
{"code":"E_CALC_MUESTRA_ALUMNOS_CH_DECISION",
 "message":"Cada componente P1/P2 debe cubrir exactamente las facultades del marco vigente.",
 "details":{"reason":"facultades_incompletas",
            "faltantes":["escuela_de_posgrado"],"sobrantes":[]}}
```

### La causa: dos universos que no se cortan igual

- El contrato de alumnos por CH enumera las facultades con al menos **un
  curso-horario elegible** (`.cm_alumnos_por_ch_fila_es_muestreable`).
- Los estratos del estudio salen de las facultades con **estudiantes
  elegibles**.

Y en la pantalla se ve el caso exacto: **Escuela de Posgrado, 2 cursos-horario
elegibles y 33 matrículas**. Pasa el primer filtro; no pasa el segundo, porque
el estudio es de pregrado regular. `setequal(seen, contract_keys)` falla y no
hay forma de calcular sin tocar los criterios.

Lo llamativo es que **el caso opuesto ya estaba resuelto**: Escuela de Estudios
Especiales tiene 0 cursos-horario elegibles y el motor la filtra, con este
comentario propio: *«el contrato pedía algo imposible»*. Es el mismo problema
por el otro lado, y ese lado no está contemplado.

### Lo que el usuario ve

Sólo la frase genérica: «Cada componente P1/P2 debe cubrir exactamente las
facultades del marco vigente». El `faltantes` viaja en el payload y **no llega a
la pantalla**, así que no hay manera de saber qué facultad falta ni por qué. Es
otra vez el patrón de «el aviso dice el hecho, no la causa» — y aquí además deja
al usuario bloqueado.

Fijado en `api/tests/testthat/test-calc-muestra-alumnos-ch-facultad-sin-alumnos.R`
(10 expectativas), con dos mutantes sobre el fuente y revertidos: quitar el
filtro de CH elegibles (2 fallos) y subirlo a 5 aulas, que excluiría posgrado
(4 fallos). Control 10/10.

### La decisión, que es metodológica

No la tomo yo. Son tres caminos y no dan el mismo estudio:

1. **Exigir la cobertura sobre la intersección** de los dos universos: una
   facultad sin estudiantes elegibles no puede recibir cuota, así que tampoco
   debería exigirse. Es el arreglo mínimo y simétrico con el que ya existe.
2. **Sacar los cursos-horario de posgrado del marco**, porque un aula cuyos
   alumnos no son del estudio no es una unidad muestreable. Toca los criterios
   de curso-horario, no el guard.
3. Dejarlo como está y **hacer que el error diga la causa** —qué facultad y por
   qué—, aceptando que el usuario tenga que ajustar los criterios a mano.

Las tres son defendibles; la 1 y la 2 cambian el marco, la 3 no. Mientras no se
decida, **el estudio real no calcula**.

---

## L20 · El bloqueo tiene nombre y el arreglo ya existe apagado (2026-08-16)

Medido sobre el `.pulso` real. La asimetría de L19 no era «una facultad sin
alumnos»: es que **la facultad del CURSO y la facultad del ESTUDIANTE son cosas
distintas**.

Los dos cursos-horario de Escuela de Posgrado que bloquean el cálculo son:

| classroom_id | curso | elegibles | matriculados | `faculty_match_share` |
|---|---|---|---|---|
| `1civ15_0001` | Estructuras Metálicas Avanzadas | 17 | 40 | **0** |
| `1civ26_0001` | Dinámica de Estructuras | 16 | 51 | **0** |

17 + 16 = 33, exactamente las matrículas que muestra la pantalla. Son cursos de
Civil catalogados bajo Escuela de Posgrado, y su `faculty_match_share = 0`
significa que **ninguno de sus 33 alumnos elegibles pertenece a esa facultad**.
El marco estratifica los cursos-horario por la facultad del curso; el estudio
estratifica a los estudiantes por la suya. Cuando no coinciden, el contrato pide
una facultad que el estudio no puede declarar.

### No es un caso aislado

De los 2.468 cursos-horario incluidos, **107 tienen `faculty_match_share = 0`**,
repartidos en 13 facultades y con **3.169 matrículas elegibles**: Ciencias e
Ingeniería 23, Ciencias Sociales 19, Gestión 18, Derecho 17, Psicología 11,
Comunicación 5, Arquitectura 4, Contables 4, **Posgrado 2**, y uno cada una en
Arte y Diseño, Artes Escénicas, Gastronomía y Letras. Posgrado sólo destaca
porque es la única facultad que **no existe** entre los estratos del estudio; en
las demás el desajuste pasa desapercibido.

### El criterio que lo arregla ya está en el motor, y está apagado

`c8_facultad` —criterio 8, parte 1, «coherencia de facultad»— compara
`faculty_match_share` contra `min_faculty_prevalence_pct`, cuyo **default es
0,80**. Pero sólo se aplica si la config lo pide:

```r
c8_facultad = isTRUE(filtros$require_faculty_prevalence)
```

y el proyecto real no lo pide: sus criterios de aula son sólo `byVariable`,
`courseLevelRanges`, `minEligible` y `manualExcludedClassrooms`. Por eso los 107
pasan.

Encendiéndolo, medido sobre el marco real:

| Umbral | CH incluidos | Caen | Facultades | ¿Sigue Posgrado? |
|---|---|---|---|---|
| — (hoy) | 2.468 | — | **16** | sí |
| 0,50 | 2.207 | 261 | **15** | no |
| **0,80** (default) | **2.112** | 356 | **15** | no |
| 0,90 | 2.025 | 443 | **15** | no |

Cualquiera de los tres deja **exactamente las 15 facultades del diseño** y
desbloquea el cálculo. Y con un diseño que pide del orden de 160–200 titulares,
hasta 2.025 cursos-horario es marco de sobra.

### Lo que esto cambia de la decisión pendiente

La opción 2 —«sacar los cursos-horario de posgrado del marco»— **no necesita
código**: es encender un criterio que ya existe, con su default. Y hace algo más
honesto que quitar posgrado: quita **todas** las aulas cuya facultad no describe
a sus alumnos, que son 107 y no 2.

Sigue siendo decisión de Gonzalo, porque cambia el marco: 356 cursos-horario
menos al umbral por defecto. Pero ahora la opción está cuantificada y no exige
tocar el motor.

---

## L21 · El error de cobertura ya dice su causa (2026-08-16)

Medido primero quién perdía el dato: **R lo perdía**. El payload sí traía
`faltantes` y `sobrantes` en `details`, pero el `message` era genérico, y la UI
muestra `e.message`. Así que el arreglo va en el motor y sirve a todos los
consumidores —pantalla, logs, cualquier otro cliente—, no sólo a esta vista.

`api/R/calc_muestra_alumnos_por_ch_cobertura.R` construye el mensaje. Antes y
después, sobre el proyecto real:

> **Antes** · «Cada componente P1/P2 debe cubrir exactamente las facultades del
> marco vigente.»
>
> **Ahora** · «El marco tiene cursos-horario de escuela_de_posgrado y el estudio
> no la declara como facultad. Suele pasar cuando un curso está catalogado bajo
> una facultad a la que no pertenece ninguno de sus alumnos elegibles: revisa el
> criterio de coherencia de facultad en Marco › Cursos-horario, o incluye esa
> facultad en el estudio.»

Tres decisiones que el módulo documenta:

- **Faltante y sobrante se dicen distinto.** Que el marco tenga aulas que el
  estudio no cubre, y que el estudio declare una facultad sin aulas elegibles,
  son problemas opuestos con salidas opuestas. Decir «no coinciden» manda a
  girar la perilla equivocada la mitad de las veces.
- **Con más de cuatro facultades el mensaje resume** («a, b, c, d y 2 más») y el
  detalle estructurado sigue completo en `details`.
- **Sin ninguna de las dos listas vuelve al mensaje genérico.** Ese caso no
  debería ocurrir, y si ocurre es peor inventar una causa que quedarse en el
  hecho.

### Verificación

22 expectativas nuevas, con tres mutantes sobre el fuente y revertidos: volver
al mensaje genérico (**10 fallos**), que el sobrante suene igual que el faltante
(2) y quitar el resumen (1). Control 22/22.

Y por la **ruta real**, que es la lección de este loop: reinicié la API propia
para que tomara el cambio, reabrí el proyecto, reconfirmé la decisión y pulsé
«Calcular muestra». El 409 sigue —el bloqueo de fondo es una decisión de
Gonzalo, no un bug— pero ahora la pantalla dice qué facultad y por qué.

Suites del área en verde: `alumnos-por-ch` 91/91, contrato HTTP 44/44,
`facultad-sin-alumnos` 10/10, `engine` 138/138.

Una nota honesta: el ajuste de tildes del mensaje se hizo **después** de esa
corrida, así que la captura de pantalla muestra el texto sin acentuar. El
contenido verificado en vivo es el mismo; los acentos los cubre el test.

---

## L22 · El registro de diseño de 2025 existe entero (2026-08-16)

`Historico 2025/HSVBG2025_referencia_para_motor.xlsx` tiene tres hojas —
`referencia` (1.012 × 29), `diseno` (20 × 3) y `cuotas` (15 × 4)— y la de
`diseno` es el acta del estudio, campo por campo:

| Campo | Valor |
|---|---|
| `poblacion_objetivo` | 22.234 |
| `nivel_confianza` · `proporcion_esperada` · `deff` | 0,95 · 0,30 · 2 |
| `margen_error` | 0,0246 |
| `muestra` | 2.500 |
| `ratio_sobremuestra` · `sobremuestra` | 1,5 · 3.750 |
| **`aulas_marco`** | **1.097** |
| `aulas_dimensionadas` | 170 |
| `aulas_aplicadas` | 194 |
| `tasa_respuesta_asumida` | 0,7038 |
| `afijacion` | Proporcional por facultad y sexo |
| **`metodo_seleccion`** | **Sistemático sobre el marco** |
| `metodo_ajuste` | Recorte aleatorio por celda |
| `efectivas_logradas` | 3.303 |
| `base_analitica` | 2.500 |
| `casos_recortados` | 803 |
| `ponderado` · `ponderacion_alcance` | Sí · sólo en Estudios Generales Letras |

### Lo que cierra

- **La vara de V2 tiene número: el marco de 2025 era de 1.097 cursos-horario**,
  no ~936 como veníamos suponiendo. La suposición era nuestra, no de la fuente.
- `aulas_dimensionadas = 170` confirma los 170 cupos ya medidos, y
  `aulas_aplicadas = 194` las 194 aplicadas.
- **El método de 2025 fue sistemático sobre el marco**, que es uno de los cuatro
  del motor (`sistematico_pps`). No hubo cubo ni pivotal.
- La diferencia entre 3.807 y 3.303 que arrastrábamos queda explicada del todo:
  se lograron **3.303 efectivas** y se recortaron **803 al azar dentro de cada
  celda** para analizar sobre 2.500.
- La ponderación existió y fue **quirúrgica**: sólo Estudios Generales Letras.

Las cuotas por facultad de 2025 están completas y suman 2.500 exactas (1.221
mujeres, 1.279 hombres): Arquitectura 123, Arte y Diseño 117, Artes Escénicas
70, Contables 21, Ciencias e Ingeniería 523, Ciencias Sociales 148, Comunicación
95, Derecho 286, Educación 26, EEGG Ciencias 424, EEGG Letras 435, Gastronomía
16, Gestión 114, Letras y CCHH 25, Psicología 77.

### Lo que informa la decisión 1, con precedente en vez de opinión

**Nuestro marco de 2026 es 2,25 veces el de 2025 para una población menor**:
2.468 cursos-horario sobre 21.365 estudiantes, contra 1.097 sobre 22.234. Los
criterios de curso-horario de 2026 son bastante más permisivos que los de 2025.

Y encendiendo la coherencia de facultad al 0,80 el marco quedaría en 2.112 —que
**sigue siendo casi el doble** del de 2025—. Así que la opción de encenderla no
acerca el diseño a 2025: lo deja todavía más ancho.

Un límite de lo medido, dicho como tal: **no encontré ningún criterio de
coherencia de facultad documentado en 2025.** El diccionario de
`base_aplicabilidad` no lo menciona —sí menciona que los elegibles excluyen
primer ciclo— y la hoja de `Alertas` de `relacion_cursos_horario_aplicados` son
alertas de campo (exceso de respuestas, supera población, duración), no
criterios de selección. Que no esté documentado no prueba que no se aplicara,
pero tampoco hay precedente que invocar.

---

## L23 · El diseño ya excluía esas facultades, y la app no lo aplica a las aulas (2026-08-16)

La hoja `Cursos-Horario` del Excel de diseño (23.133 filas) resultó ser el
universo de **2026**, no de 2025: tiene **5.262 cursos-horario únicos**, que son
los 5.263 de nuestro marco. Y tiene una columna llamada literalmente **«Facultad
del curso»** —la distinción que costó tres ticks encontrar ya estaba nombrada en
la fuente—.

Su universo trae **18 facultades**, y las tres que la tabla de diseño no incluye
son exactamente:

| Facultad del curso | CH en el universo |
|---|---|
| **Escuela de Posgrado** | **773** |
| Escuela de Estudios Especiales | 246 |
| Consorcio de Universidades | 10 |

Es decir: **quien hizo el diseño ya había decidido excluirlas.** No es una
ambigüedad que haya que resolver ahora; es una decisión tomada, con las 15
facultades restantes en la tabla de cuotas.

### Y la app ya tiene esa lista — pero sólo se la aplica a los estudiantes

En Marco › Criterios del estudiante, el criterio **Facultad** está marcado como
`ESTRATIFICA` y tiene **15 de 18** seleccionadas: las mismas 15. La pantalla
incluso avisa de que «dejó fuera a 0», porque Formación y Condición ya habían
filtrado a esos estudiantes antes.

Lo que no ocurre es lo otro: **esa selección de 15 no se aplica a los
cursos-horario**. Un curso catalogado bajo una facultad excluida entra al marco
igual, siempre que sus alumnos pasen los criterios de estudiante.

### El efecto, medido sobre el marco real

| Opción | CH incluidos | Caen | Facultades | ¿Desbloquea? |
|---|---|---|---|---|
| Hoy | 2.468 | — | 16 | no |
| Coherencia de facultad al 0,80 | 2.112 | **356** | 15 | sí |
| **Aplicar la lista de 15 del diseño** | **2.466** | **2** | **15** | **sí** |

Los dos cursos-horario que caen son exactamente `1civ15_0001` y `1civ26_0001`,
los de Posgrado. Ninguna otra facultad excluida tiene cursos-horario elegibles en
este marco.

### Lo que esto cambia para la decisión de Gonzalo

Aparece una cuarta opción, y es la más pequeña y la única con precedente
documentado: **aplicar a los cursos-horario la misma lista de facultades que el
estudio ya declaró para los estudiantes.** Quita 2 aulas en vez de 356, deja el
marco en 2.466, y no inventa un criterio nuevo: usa una selección que el usuario
ya hizo en la pantalla.

Sigue siendo decisión suya, porque las dos cosas se pueden querer a la vez —la
lista arregla el bloqueo, y la coherencia de facultad seguiría siendo un
criterio útil por su cuenta, dado que 107 aulas incluidas tienen
`faculty_match_share = 0`—. Pero ya no hay que elegir entre opciones igualmente
opinables: una de ellas es lo que el diseño hizo.

### Lo que no está en ninguna fuente

Cómo se llegó a los **1.097 cursos-horario del marco de 2025**. El número está
declarado en la hoja `diseno`, pero su derivación no aparece: ni en
`base_aplicabilidad` (su diccionario documenta que los elegibles excluyen primer
ciclo, nada sobre el marco), ni en `relacion_cursos_horario_aplicados` (196
aplicados y 77 alertas de campo), ni en «BD Aulas Agendadas» —que es la agenda
operativa: hojas por día de aplicación, 26 aulas adicionales y una planilla de
118 filas—. Queda como límite conocido, no como pendiente de buscar.

---

## L24 · Por qué la lista de facultades no llega a las aulas (2026-08-16)

El hueco de L23 tiene un mecanismo, y costó tres mutantes acertarlo.

`.cm_criterios_var_registry()` declara cada variable de criterio con su
**scope**. Hoy:

| scope | variables |
|---|---|
| `alumno` | formation, condition, age, **faculty** (`estratifica = TRUE`), level |
| `aula` | modality, session_type, teacher_type, course_level, condicion_curso, enrolled_total, campus |

**No hay ninguna variable de scope aula que apunte a la facultad del curso.** Y
el scope no lo decide quien llama: `.cm_criterios_normalize_seleccion` lo
reescribe desde el registro, así que pedir la facultad con `scope = "aula"`
la devuelve igualmente como `"alumno"`, y el guard del lado aula la descarta.

Lo comprobé con mutantes, y dos de los tres **no** movieron nada:

| Mutante | Fallos | Qué enseña |
|---|---|---|
| `faculty` pasa a `scope = "aula"` en el registro | **3** | es lo único que conecta las dos puntas |
| Quitar el guard `if (!identical(crit$scope, "aula")) next` | 0 | el guard es la segunda línea, no la primera |
| Añadir `faculty` al recorrido del bucle | 0 | tampoco basta: el scope sigue diciendo alumno |

Es una distinción que importa para el arreglo: no es que el criterio esté
apagado, es que **no está cableado de ese lado**, y el interruptor es una sola
entrada del registro.

Fijado en `api/tests/testthat/test-calc-muestra-criterios-facultad-no-alcanza-aulas.R`
(10 expectativas, fixture sintético) con un control que demuestra que el motor
sí sabe recortar por variables de aula: la misma selección sobre `modality` deja
fuera el aula que no cumple.

### Una nota sobre el propio test

La primera versión del fixture usaba `categorias` donde el normalizador espera
`categories`, así que la regla llegaba vacía y no recortaba nada. **Lo cazó el
test de control**, que estaba puesto justamente para eso: si el caso positivo
también hubiera pasado en falso, el archivo entero habría certificado un hueco
que no era el medido.
