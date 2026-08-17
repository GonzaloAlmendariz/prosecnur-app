# Checklist — el pipeline de aulas de punta a punta (2026-08-16)

**Pedido de Gonzalo**: recorrer el pipeline *etapa por etapa* para estar seguros
de que ya se pueden generar todas las aulas y los reemplazos de cada titular sin
problemas. Empezar desde la base y subir; en cada etapa, comprobar que
**efectivamente funciona**, no que existe.

**Cuándo**: al cerrar M17 del loop de mejora continua.

**VARA TRANSVERSAL — POR FACULTAD** (Gonzalo, 2026-08-16): «el cálculo es por
facultad, eso debe quedar clarísimo; si necesitamos X alumnos por facultad
tenemos que tener aulas que respondan a ese X». **Toda etapa se verifica
facultad por facultad, no en agregado.** Un total que cuadra puede esconder una
facultad sin aulas. El recorrido se reinicia desde E1 con esta vara.

**Vara**: la etapa pasa cuando su salida se puede *medir* sobre un proyecto real
—no cuando la pantalla la muestra sin error—. Un cero puede ser correcto; hay
que saber por qué. La última etapa es la que Gonzalo nombra dos veces: que cada
titular tenga su cadena completa.

| # | Etapa | Qué hay que comprobar | Dónde vive | Estado |
|---|---|---|---|---|
| E1 | **Base** | El marco carga y sus filas son las que deben ser | `carga_aulas_libro.R` (ajeno: sólo leer) · `calc_muestra_aulas_frame` | ☑ **pasa** |
| E2 | **Criterios de alumnos** | Filtran a quien deben; el elegible sale de aplicarlos, no de un default | `calc_muestra_aulas.R` · pestaña Criterios | ◐ **con observación** |
| E3 | **Criterios de curso-horario** | **Que funcionen de verdad** — Gonzalo lo subraya | `calc_muestra_aulas_catalogo*` · `FacultadDecisionBloque` | ☐ |
| E4 | **Cálculo de la muestra** | El n sale de la fórmula declarada y coincide con lo que publica la UI | `calc_muestra_engine.R` · `CalculoPropuestasTab` | ☐ |
| E5 | **Cuotas de hombres y mujeres por facultad** | Se calculan por facultad y suman lo que deben | `calc_muestra_aulas.R` · `CursosHorarioSexo` | ☐ |
| E6 | **Cuota general por facultad** | Coherente con E5: la general no contradice el desglose por sexo | idem | ☐ |
| E7 | **Alumnos elegibles por curso-horario** | El elegible por CH es calculable y trazable a E2 | `calc_muestra_aulas.R` | ☐ |
| E8 | **Cuántos CH hacen falta por facultad** | Se deriva de E6 ÷ E7 y queda explícito | idem | ☐ |
| E9 | **Selección de aulas** | Cumple las requeridas por facultad de E8, facultad por facultad | `calc_muestra_aulas.R` selector | ◐ **genera bien; falta contrastar con E8** |
| E10 | **Titulares y sus reemplazos** | Cada titular tiene su cadena **completa**; ninguno se queda sin ella | selección + `chain_reserve` | ☑ **pasa** |

## E1 — Base · **pasa** (2026-08-16, sobre `hsvg2026.pulso`)

El marco carga en modo `base_madre`: **5.263 aulas × 36 columnas**, `classroom_id`
sin duplicados. Las cifras cuadran entre sí y con la auditoría del motor:

| Medida | Valor | Cuadre |
|---|---|---|
| Matrículas (`enrolled_total`) | 136.284 | = `input_rows` |
| Elegibles (`eligible_n`) | 106.013 | = `eligible_student_rows` |
| Excluidas | 30.271 | = 136.284 − 106.013, exacto |
| Alumnos únicos | 21.362 | `population_n` |
| Aulas incluidas | 2.561 | = las 2.561 filas de la selección |
| Facultades · programas · niveles | 17 · 142 · 14 | |

El cierre más fuerte: **2.561 incluidas = 30 titulares + 330 reservas + 2.201
pool extra**. La selección cubre exactamente las aulas que el marco declaró
aptas, sin perder ni inventar ninguna.

**Los 920 ceros están explicados**: las 920 aulas con `eligible_n = 0` están
*todas* excluidas, con motivo `min_eligible_per_class|min_eligible`.

### Aviso que condiciona el resto del recorrido

`hsvg2026` sigue **envenenado por el anonimizador viejo**: sus facultades se
llaman «Ricardo Y Ricardo Ricardo», «Nestor DE POSGRADO», y los 33 docentes son
nombres de pila. Sirve para verificar **cantidades y cuadres**, no el
**significado** de las categóricas — y E5, E6, E8 y E9 son «por facultad». Los
conteos por grupo son válidos (17 grupos distintos y estables); lo que no se
puede juzgar con este fixture es si un reparto tiene sentido sustantivo. Esa
capa exige correr el recorrido sobre un proyecto real, no anonimizado.

Anotado menor: `catalog_unmatched_base_classrooms = 1` (match 0,9998).

## Cambio de fixture (2026-08-16, pedido de Gonzalo)

El recorrido pasa a correr sobre el proyecto **real**
`~/Documents/Pulso/HSTVG2026/HSVG2026.pulso` (se lee, no se copia). Con él las
facultades son las reales de la PUCP —ARQUITECTURA Y URBANISMO, DERECHO,
ESTUDIOS GENERALES LETRAS…—, así que E5, E6, E8 y E9 **sí serán juzgables**.

Diferencias con el anonimizado: mismas 5.263 aulas, mismas 136.284 matrículas y
106.013 elegibles, pero **2.468 aulas incluidas** (no 2.561), 157 programas
(no 142) y 21.365 alumnos (no 21.362).

**El proyecto real NO TIENE SELECCIÓN GENERADA**: `calc_muestra_aulas_selection`
es `NULL`. E9 y E10 no podrán leerla — habrá que **generarla**, que es
exactamente lo que Gonzalo quiere saber que funciona.

## E2 — Criterios de alumnos · **con observación**

Los cinco criterios están declarados y **ninguno es letra muerta**; todos
descartan filas reales sobre las 136.284 matrículas:

| Criterio | Capa | Filas que pasan | Descarta |
|---|---|---|---|
| `level` | **instrumento** | 100.920 | 35.364 |
| `age` (≥18) | marco | 123.360 | 12.924 |
| `formation` (pregrado) | marco | 125.003 | 11.281 |
| `condition` (regular) | marco | 124.167 | 12.117 |
| `faculty` | marco | 126.537 | 9.747 |

Los 21 filtros están poblados con valores sensatos: adulto ≥18, pregrado,
condición regular, presencial, mínimo 15 elegibles por aula, y exclusión por
patrón de posgrado/maestría/doctorado y de virtual/remoto/online.

**Lo que falta explicar**: `level` deja pasar 100.920 pero el elegible final es
106.013, **mayor**. Si `level` alimentara el elegible sería imposible. La
hipótesis es que sólo los cuatro criterios de capa `marco` lo alimentan (su
intersección es ≤ 123.360 y 106.013 encaja) y que `instrumento` es otra capa.
Hipótesis, no medición: confirmarlo antes de dar E2 por cerrado.

Anotado para E3: **`teacher` tiene un solo valor único** en toda la base —el
docente no viene informado— y sin embargo `teacher_type` **sí excluye aulas**
(62 solas más varias combinaciones), así que se deriva de otra columna.

Anotado: `require_faculty_prevalence` está en `FALSE` en este proyecto, anterior
al cambio de default a `true`.

## E9 y E10 — La prueba de fuego, GENERADA de verdad (2026-08-16)

Gonzalo autorizó duplicar su `.pulso` y editarlo. Se generó la selección con el
motor sobre la base **real**, en una copia de trabajo del scratchpad; su archivo
original no se tocó.

| Prueba | Resultado |
|---|---|
| Generar la selección | **1,9 segundos**, motor `cube_balanceado` |
| Titulares | 30, los pedidos por `n_aulas` |
| Cadenas | **los 30 con cadena; ninguno sin ella** |
| Reservas por titular | **11 exactas** (min = mediana = max = 11) |
| Equivalencia | las 330 son `misma_celda` |
| Facultad | **330 de 330** reservas en la misma facultad que su titular |
| Total | 30 + 330 + 2.108 pool = **2.468** = aulas incluidas |
| Escribir al `.pulso` y releer | **18,8 MB, las 30 cadenas de 11 sobreviven** |

Reparto de los 30 titulares en 10 facultades: CIENCIAS SOCIALES 5 · CIENCIAS E
INGENIERIA 4 · DERECHO 4 · ESTUDIOS GENERALES LETRAS 4 · CIENCIAS Y ARTES DE LA
COMUN. 3 · ESTUDIOS GENERALES CIENCIAS 3 · ARQUITECTURA Y URBANISMO 2 · ARTE Y
DISEÑO 2 · GESTIÓN Y ALTA DIRECCIÓN 2 · PSICOLOGÍA 1.

**E10 pasa.** La pregunta de Gonzalo —«¿ya podemos generar todas las aulas y los
reemplazos de cada titular sin problemas?»— tiene respuesta afirmativa medida.

**E9 queda a medias por lo que falta, no por un fallo**: el selector genera,
respeta la celda y llena las once reservas, pero contrastar si esos 30 y ese
reparto son *los requeridos por facultad* exige E5–E8, aún sin medir.

Config del selector en el proyecto real: `n_aulas` 30, `replacement_waves` 11,
`selector_engine` cube_balanceado, min/max reemplazos por titular 1/11,
`replacement_depth_strategy` max_complete_chains_by_cell.

## Vara de E7/E8 dada por Gonzalo (2026-08-16)

> «si empieza a hacer E7 y E8 no creo que lleguemos a 30 aulas, probablemente
> lleguemos a 190 o 200, para que lo tomes en cuenta»

**Esto es la vara de E8, y reencuadra E9.** La config del proyecto real trae
`n_aulas = 30`. Si el cálculo de elegibles por curso-horario (E7) y el de CH
necesarios por facultad (E8) arrojan **190–200**, entonces la selección de 30
está corta por un factor de ~6,5: el motor generó correctamente *lo que se le
pidió*, pero se le estaría pidiendo mal.

Consecuencias para el recorrido:

- E7 y E8 **se miden sin mirar `n_aulas`**, para que la cifra salga del cálculo
  y no del parámetro. Recién después se contrasta.
- Si E8 da ~190–200, **E9 no pasa con 30 titulares** por mucho que el sorteo sea
  impecable: el hallazgo sería que `n_aulas` no se deriva de las cuotas.
- Conviene además regenerar la selección con el `n_aulas` que salga de E8 y
  comprobar que el motor **también sostiene 11 cadenas completas a esa escala**
  —con 190 titulares hacen falta ~2.090 reservas y sólo hay 2.468 aulas
  incluidas, así que ahí la holgura se acaba—. Ese es el riesgo real que la
  prueba de 30 no llegó a tocar.

## HALLAZGO — la cadena de 11 no se sostiene a la escala real (2026-08-16)

Gonzalo dio libertad para duplicar y editar el proyecto, así que se regeneró la
selección subiendo `n_aulas` a la escala que él anticipa para E8.

| | n = 30 | n = 190 | n = 200 |
|---|---|---|---|
| Titulares con cadena | 30 / 30 | 190 / 190 | 200 / 200 |
| Reservas por titular | **11 · 11 · 11** | min **1** · mediana 10 · max 11 | min **1** · mediana 9 · max 11 |
| **Con menos de 11** | **0** | **110 (58 %)** | **120 (60 %)** |
| Reservas totales | 330 | 1.631 | 1.674 |
| Facultades cubiertas | 10 | 16 de 17 | 16 de 17 |

**A la escala real la promesa de 11 reservas por titular se rompe para más de la
mitad, y alguno recibe una sola.** El motor no falla ni avisa: devuelve una
selección de aspecto correcto con cadenas mutiladas.

**No es falta de aulas.** 190 titulares necesitan 2.090 reservas y quedan 2.278
aulas disponibles tras apartar los titulares. Sobran en total pero faltan
*dentro de la celda de cada titular*: con `replacement_depth_strategy =
max_complete_chains_by_cell` cada cadena sólo bebe de su propia celda y esa
celda se agota. De las 1.631 reservas, 1.630 son `misma_celda` y sólo 1 bajó a
`celda_equivalente`.

Enlaza con **M10**, la decisión pendiente de Gonzalo: `reserve_depth_target = 6`
y las 11 olas son alcanzables con 30 titulares y **físicamente imposibles con
190** bajo candado por celda. Con candado por facultad probablemente sí — que es
el ajuste ofrecido y no pedido (M4/M10).

**Lo que falta en el producto**: hoy nadie avisa de que 110 de 190 aulas irían a
campo con la cadena corta. Ese aviso es el candidato número uno de reparación en
cuanto E8 confirme la escala.

## E1 POR FACULTAD (2026-08-16) — la vara nueva cambia el diagnóstico

| Facultad | Aulas | Incluidas | Elegibles | Mediana/aula |
|---|---:|---:|---:|---:|
| CIENCIAS E INGENIERIA | 849 | 592 | 18.963 | 32 |
| DERECHO | 575 | 440 | 16.846 | 41 |
| ESTUDIOS GENERALES LETRAS | 482 | 330 | 14.347 | 46 |
| ESTUDIOS GENERALES CIENCIAS | 496 | 319 | 13.056 | 40 |
| CIENCIAS SOCIALES | 236 | 169 | 4.726 | 28 |
| GESTIÓN Y ALTA DIRECCIÓN | 184 | 119 | 3.948 | 36 |
| CIENCIAS Y ARTES DE LA COMUN. | 210 | 162 | 3.546 | 22,5 |
| PSICOLOGÍA | 131 | 100 | 2.425 | 25 |
| ARQUITECTURA Y URBANISMO | 144 | 56 | 1.973 | 28 |
| ARTE Y DISEÑO | 320 | 63 | 1.554 | 21 |
| ARTES ESCÉNICAS | 454 | 45 | 921 | 17 |
| CIENCIAS CONTABLES | 44 | 19 | 527 | 27 |
| EDUCACION | 73 | 19 | 443 | 23 |
| GASTRONOMÍA, HOTELERÍA Y TURISMO | 54 | 17 | 346 | 19 |
| LETRAS Y CIENCIAS HUMANAS | 149 | 16 | 263 | 16 |
| ESCUELA DE POSGRADO | 852 | **2** | 33 | 16,5 |
| **ESCUELA DE ESTUDIOS ESPECIALES** | 10 | **0** | **0** | — |

Total: 5.263 aulas · 2.468 incluidas · **83.917 elegibles en aulas incluidas**
(no los 106.013 del marco: la diferencia vive en aulas descartadas).

**Tres cosas que sólo se ven por facultad:**

1. **ESCUELA DE ESTUDIOS ESPECIALES se queda sin nada**: 10 aulas, **0
   incluidas**. Si el diseño le asigna cuota es imposible de cumplir, y nadie lo
   dice. Candidato a aviso del producto.
2. **Dos aulas de posgrado se colaron**: ESCUELA DE POSGRADO pasa de 852 a 2
   incluidas, lo cual es casi correcto —los criterios excluyen posgrado— pero
   deberían ser **cero**. Candidato de defecto para E3.
3. **Desequilibrio de dos órdenes de magnitud**: 18.963 elegibles en CIENCIAS E
   INGENIERIA frente a 263 en LETRAS Y CIENCIAS HUMANAS. Con cuota por facultad
   las grandes sobran y las chicas van al límite: LETRAS tiene 16 aulas de
   mediana 16, así que juntar ~200 alumnos exigiría 13 de sus 16 aulas y **no
   quedarían reservas** — el mismo agotamiento por celda ya medido a escala.

## E3 — DEFECTO VIVO: la exclusión de posgrado no la hace ningún criterio

Gonzalo: «Posgrado y escuela de estudios especiales no están, se excluyen por
completo». El motor **no lo garantiza**; hoy se cumple de casualidad.

Las 2 aulas de ESCUELA DE POSGRADO que entraron al marco son de INGENIERÍA
CIVIL —«ESTRUCTURAS METÁLICAS AVANZADAS» y «DINÁMICA DE ESTRUCTURAS»—,
presenciales, con 17 y 16 elegibles, y su `exclude_reason` viene **vacía**.

**Causa**: `exclude_level_patterns` busca las palabras *posgrado, postgrado,
maestria, master, doctorado* dentro de la columna `level`. En esta base `level`
es un **número de ciclo** ("1".."9"), nunca un texto. El patrón no coincide
jamás: **el filtro de posgrado no excluye ni una sola aula**.

Lo que excluyó a las otras 850 de posgrado fue, por accidente,
`min_eligible_per_class = 15` — las aulas de posgrado son pequeñas—. Las dos que
superaban el umbral pasaron sin que nada las parara.

Idéntico con ESCUELA DE ESTUDIOS ESPECIALES: sus 10 aulas se excluyen **todas
por `min_eligible_per_class`**, no por ser estudios especiales.

**Riesgo**: bajar el mínimo de elegibles, o un programa de posgrado con aulas
grandes, mete posgrado en el marco y puede sacarlo sorteado.

### DECISIÓN DE GONZALO (2026-08-16): lista explícita, editable en la UI

> «Una lista explícita de facultades excluidas, editable en la UI»

Especificación para implementar entera —backend **y** UI, porque una capacidad
sin consumidor no existe—:

1. **Config**: filtro nuevo `excluded_faculties` en `config$filters`, lista de
   nombres de facultad. Default: vacío (no cambia el comportamiento de nadie),
   y que este proyecto lo pueble con ESCUELA DE POSGRADO y ESCUELA DE ESTUDIOS
   ESPECIALES.
2. **Aplicación**: en `calc_muestra_aulas.R` ~1149, donde hoy vive `level_ok`,
   que es un chequeo **por fila de alumno** —no por aula—, junto a
   `modality_ok` y `session_ok`. Comparación por nombre normalizado de
   `faculty`, no por patrón sobre `level`.
3. **Motivo propio**: `exclude_reason = "faculty_excluida"`, para que la
   exclusión sea legible y no se confunda con `min_eligible_per_class`.
4. **UI**: control editable en la pestaña de Criterios, alimentado por las
   facultades presentes en el marco, con el conteo de aulas que cada exclusión
   descarta.
5. **Evidencia**: test que fije que una facultad listada sale con 0 aulas y con
   motivo `faculty_excluida`, mutante que quite la comparación, y gate.

El filtro viejo `exclude_level_patterns` se mantiene —no rompe nada— pero deja
de ser lo que sostiene la exclusión de posgrado.

### Corrección a E1 por facultad

ESCUELA DE ESTUDIOS ESPECIALES con 0 aulas incluidas **NO es un problema**: está
excluida por diseño. El universo real son **15 facultades**, no 17. La tabla de
E1 se lee sin esas dos filas.

## Lo que ya sabemos, para no reinvestigarlo

- En el proyecto de referencia la selección trae **30 titulares y 330 reservas,
  exactamente 11 por titular** — o sea E10 *se cumple en los datos*. Lo que
  fallaba era mostrarlo: cuatro superficies lo recortaban (M14, M15, M16).
- `bolsas_reemplazo: 11` y `reserve_depth_target: 6` en `universidad/shared/constants.ts`.
- La selección real vive en `state$calc_muestra_aulas_selection$selection`;
  roles `titular` / `chain_reserve` / `extra_reserve_pool`.
- 2025 consumió **0,153 reemplazos por titular** y nunca pasó de la reserva 2
  (M8/M9) — contexto para juzgar si las 11 son necesarias, no para cambiarlas.

## Reglas de este recorrido

- **Una etapa por tanda**, en orden, sin saltar: el pedido es explícitamente
  secuencial porque cada etapa alimenta a la siguiente.
- Cada etapa se marca con **evidencia numérica**, no con «se ve bien».
- Si una etapa falla, se anota **qué la bloquea** y se sigue con las que no
  dependan de ella; las que sí dependan quedan **bloqueadas**, no pendientes.
- Sólo Gonzalo da el checklist por terminado.
