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
| L1 | Reunir el material de 2025 | — | ◐ **parcial** (2026-08-16) · bases e histórico de asistencia localizados; **falta la selección de aulas de 2025** |
| L2 | Arrancar un proyecto **vacío** y cargar sólo las bases | V1 | ☐ |
| L3 | Aplicar criterios de alumno uno a uno, midiendo el recorte de cada uno | V1, V3 | ◐ **medido** (2026-08-16) · tabla abajo; falta el contraste con 2025 (L4, bloqueado) |
| L4 | Contrastar elegibles contra 2025 y explicar toda diferencia | V1 | ☑ **cuadra exacto** (2026-08-16) · 21.365 = 21.365 |
| L5 | Aplicar criterios de curso-horario, mismo método | V2, V3 | ◐ **medido** (2026-08-16) · tabla abajo; razón duplicada confirmada, arreglo pendiente |
| L6 | Contrastar CH elegibles contra 2025 | V2 | ☑ **cuadra exacto** (2026-08-16) · 2.468 = 2.468 |
| L7 | Auditar que cada criterio muestra su efecto en la UI | V4 | ☑ **cerrado** (2026-08-16, `7addb99c`) · el motor publica `filas_total` y cada tarjeta de criterio de alumno dice a cuántos dejó fuera; el 0 de `level` se pinta de aviso |
| L8 | Calcular el tamaño y contrastar n contra 2025 | V5 | ◐ **calculado, sin patrón** (2026-08-16) · el `.pulso` no conserva el n de 2025 |
| L9 | Decidir alumnos por CH por facultad y contrastar | V6 | ◐ **reproduce exacto** (2026-08-16) · 18 facultades, 0 diferencias; falta justificar el estadístico |
| L10 | Obtener aulas por facultad y contrastar el reparto | V7 | ⛔ **sin patrón** (2026-08-16) · el reparto tampoco se persiste |
| L11 | Sortear con el cubo y comparar el perfil con la muestra de 2025 | V8 | ☐ |
| L12 | Verificar que titulares y reemplazos sirven en campo | V8 | ◐ **config leída** (2026-08-16) · 30 titulares × 11 olas; diferencia de escala con 2025 sin explicar |

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
| `faculty` | 128.018 | 8.266 | 6,1 % | marco |
| `condition` | 124.167 | 12.117 | 8,9 % | marco |
| `formation` | 125.003 | 11.281 | 8,3 % | marco |
| `age` | 123.360 | 12.924 | 9,5 % | marco |
| `level` | 136.284 | **0** | **0,0 %** | marco |
| **Todos (capa marco)** | **106.013** | **30.271** | **22,2 %** | |

Las 30.271 cuadran con las exclusiones que publica el marco construido, así que
la medición es consistente con el motor.

**La suma de los recortes individuales (44.588) supera al conjunto (30.271)**
porque muchas filas caen por más de un criterio a la vez — se ve en las razones
combinadas que publica el marco (`age|condition`, `condition|formation`…). Eso
significa que **el recorte de un criterio no se puede leer aislado**: quitarlo no
devuelve sus 12.000 filas, devuelve sólo las que no caían también por otro.

### Hallazgo: `level` está activo y no recorta nada

Es un criterio de capa marco, declarado, con `kind = ordinal` y **`fromValue =
NA`**. Deja pasar las 136.284 filas.

Tres lecturas posibles, y hay que decidir cuál antes de tocar nada:

1. **Correcto y deliberado**: en 2025 no se filtró por ciclo, y el criterio está
   presente sólo para dejar constancia de que se consideró.
2. **Configurado a medias**: alguien lo activó y no fijó el umbral, así que
   parece que filtra y no filtra.
3. **Perdido en la anonimización**, como pasó con `faculty`.

Para V3 —«los criterios se entienden solos»— este caso es el más exigente: un
criterio que aparece activo y no recorta es exactamente lo que hace desconfiar
del resto. **La UI debería decir «este criterio no está recortando» sin que haya
que calcularlo.**

## V2 · recorte de los criterios de curso-horario (medido 2026-08-16)

Sobre el marco del proyecto **real** de 2025-2 (no el fixture): 5.263
cursos-horario.

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
