# Checklist — el pipeline de aulas de punta a punta (2026-08-16)

Tipo: Checklist QA fechado
Estado: En curso
Fecha: 2026-08-16
Autoridad: Evidencia de la ejecución que documenta; no reemplaza contratos ejecutables ni ADR aceptados


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
| E2 | **Criterios de alumnos** | Filtran a quien deben; el elegible sale de aplicarlos, no de un default | `calc_muestra_aulas.R` · pestaña Criterios | ☑ **pasa** (H3 resuelto: son dos capas) |
| E3 | **Criterios de curso-horario** | **Que funcionen de verdad** — Gonzalo lo subraya | `calc_muestra_aulas_catalogo*` · `FacultadDecisionBloque` | ☑ **pasa** |
| E4 | **Cálculo de la muestra** | El n sale de la fórmula declarada y coincide con lo que publica la UI | `calc_muestra_engine.R` · `CalculoPropuestasTab` | ☑ **pasa** |
| E5 | **Cuotas de hombres y mujeres por facultad** | Se calculan por facultad y suman lo que deben | `calc_muestra_aulas.R` · `CursosHorarioSexo` | ☑ **pasa** |
| E6 | **Cuota general por facultad** | Coherente con E5: la general no contradice el desglose por sexo | idem | ☑ **pasa** |
| E7 | **Alumnos elegibles por curso-horario** | El elegible por CH es calculable y trazable a E2 | `calc_muestra_aulas.R` | ☑ **pasa, con hallazgo H6** |
| E8 | **Cuántos CH hacen falta por facultad** | Se deriva de E6 ÷ E7 y queda explícito | idem | ☑ **pasa — fórmula exacta 15/15** |
| E9 | **Selección de aulas** | Cumple las requeridas por facultad de E8, facultad por facultad | `calc_muestra_aulas.R` selector | ☑ **pasa** — con margen publicado |
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

## E4 — Cálculo de la muestra · **pasa**, y el reparto por facultad existe

El estudio real tiene **dos componentes**, ambos con las 15 facultades como
estratos, y cada uno reparte:

| | Universidad (conglomerado) | Facultad (estratificado independiente) |
|---|---:|---:|
| n objetivo | 2.500 | 4.986 |
| n operativo | 3.750 | 5.984 |
| **Aulas** | **177 base + 92 extra = 269** | **478** |

La estimación de Gonzalo —«190 o 200»— encaja con la variante de universidad,
que pide **177 aulas base**.

**Aviso de instrumentación**: el reparto NO vive en `resultado$estratos` —ese
campo no existe— sino en `distribucion_estratos` y `aulas_por_estrato`. Mi
primera medición dio NA en las 15 por buscar donde no era.

### El cruce que importa: requeridas contra existentes (variante por facultad)

| Facultad | Requiere | Tiene (E1) | Consume |
|---|---:|---:|---:|
| **LETRAS Y CIENCIAS HUMANAS** | **16** | **16** | **100 %** |
| CIENCIAS CONTABLES | 14 | 19 | 74 % |
| EDUCACION | 14 | 19 | 74 % |
| ARQUITECTURA Y URBANISMO | 36 | 56 | 64 % |
| ARTES ESCÉNICAS | 28 | 45 | 62 % |
| GASTRONOMÍA, HOTELERÍA Y TURISMO | 10 | 17 | 59 % |
| ARTE Y DISEÑO | 35 | 63 | 56 % |
| GESTIÓN Y ALTA DIRECCIÓN | 35 | 119 | 29 % |
| PSICOLOGÍA | 30 | 100 | 30 % |
| CIENCIAS SOCIALES | 38 | 169 | 22 % |
| CIENCIAS Y ARTES DE LA COMUN. | 33 | 162 | 20 % |
| ESTUDIOS GENERALES CIENCIAS | 47 | 319 | 15 % |
| ESTUDIOS GENERALES LETRAS | 47 | 330 | 14 % |
| DERECHO | 46 | 440 | 10 % |
| CIENCIAS E INGENIERIA | 49 | 592 | 8 % |

**LETRAS Y CIENCIAS HUMANAS necesita las 16 aulas que tiene**: todas titulares,
**cero reemplazos posibles**. CONTABLES y EDUCACIÓN quedan con 5 aulas de margen
para 14 titulares, muy por debajo de las 11 reservas por titular del diseño.

Esto explica desde arriba lo que se midió desde abajo: la cadena se rompía a 190
titulares no por falta global de aulas, sino porque **las facultades chicas se
agotan**. Ahora se sabe cuáles y cuánto.

## E5 y E6 — Cuotas por facultad y sexo · **pasan las dos**

La cuota por sexo SÍ existe: los dos componentes declaran
`meta$variable_control = "facultad_sexo"` y el resultado la trae en
`distribucion_sub` —30 entradas = 15 facultades × 2 sexos, con N y n cada una—.
`cuotas_matriz` está vacía, pero no es donde vive esto.

Componente por facultad (n = 4.986):

| Facultad | N_M | n_M | N_F | n_F | n | %F |
|---|---:|---:|---:|---:|---:|---:|
| ARQUITECTURA Y URBANISMO | 336 | 117 | 744 | 259 | 376 | 69 % |
| ARTE Y DISEÑO | 229 | 83 | 792 | 286 | 369 | 78 % |
| ARTES ESCÉNICAS | 283 | 140 | 307 | 152 | 292 | 52 % |
| CIENCIAS CONTABLES | 87 | 67 | 96 | 73 | 140 | 52 % |
| CIENCIAS E INGENIERIA | 3.385 | 384 | 1.127 | 128 | 512 | 25 % |
| CIENCIAS SOCIALES | 598 | 185 | 689 | 214 | 399 | 54 % |
| CIENCIAS Y ARTES DE LA COMUN. | 301 | 123 | 531 | 218 | 341 | 64 % |
| DERECHO | 1.036 | 169 | 1.933 | 314 | 483 | 65 % |
| EDUCACION | 39 | 29 | 158 | 118 | 147 | 80 % |
| EG CIENCIAS | 2.404 | 353 | 951 | 139 | 492 | 28 % |
| EG LETRAS | 1.395 | 206 | 1.932 | 286 | 492 | 58 % |
| GASTRONOMÍA, HOTELERÍA Y TURISMO | 48 | 39 | 80 | 66 | 105 | 63 % |
| GESTIÓN Y ALTA DIRECCIÓN | 412 | 152 | 574 | 212 | 364 | 58 % |
| LETRAS Y CIENCIAS HUMANAS | 97 | 70 | 128 | 93 | 163 | 57 % |
| PSICOLOGÍA | 177 | 82 | 496 | 229 | 311 | 74 % |
| **SUMA** | **21.365** | | | | **4.986** | |

**Las dos sumas cuadran exactas** —2.500 y 4.986— y la población por sexo suma
los 21.365 alumnos. El reparto respeta la composición real de cada facultad:
Ingeniería 25 % mujeres, Educación 80 %.

**E6 queda resuelta con E5**: la cuota general por facultad es la columna `n` y
es exactamente la suma de sus dos sexos, por construcción.

**La superficie existe y no recorta**: `didactica/DistribucionFacultadSexo`,
montada en `universidad/salidas/SalidasResultadosTab`, deriva las series de los
`sub` presentes y pinta todas las categorías; el helper
`universityDistributionRows` (`shared/study.ts`) arma cuota, sexo, error y p.
Sin `slice` ni topes, a diferencia de las cinco superficies de la familia de
recortes.

Trampa de instrumentación pagada: los `sub` del motor son **«M» y «F»**
—masculino y femenino—, no «H» y «M». Filtrar por «H» da 100 % en las quince
filas; ese fue el síntoma.

## E7 y E8 — **pasan**, y la fórmula se reconstruye exacta

`aulas_base = ⌈ cuota ÷ (alumnos_por_CH × τ) ⌉`, con τ = 0,53 de tasa de
respuesta esperada. **Falla en 0 de 15** facultades, en los dos componentes.
Los campos viven en `resultado$aulas_por_estrato`: `cuota`, `avg_conglomerado`,
`estadistico_usado`, `tau`, `aulas_base`, `aulas_reemplazo`,
`aulas_extra_operativas`, `aulas_total`, `tipo_aula`, `precision_e`.

| | Componente universidad | Componente facultad |
|---|---:|---:|
| Alumnos por CH usados | **28,0** | **20,0** |
| Aulas base | **177** | 478 |
| Aulas total | 269 | 478 |

**Las ~190 aulas de Gonzalo son las 177 base del componente universidad.**

### H6 — un solo «alumnos por CH» para las quince facultades

El motor usa **un único `avg_conglomerado`** —28 o 20 según el componente— para
todas. Pero el elegible real por aula va de **16 (LETRAS Y CIENCIAS HUMANAS) a
46 (EG LETRAS)**. Aplicar 20 a las dos deja corta a una y sobra en la otra.

Y **`alumnos_por_ch_decision` está SIN CONFIRMAR**: `denominador`,
`estadistico_default` y `confirmado_at` vacíos, `por_facultad` con **0
entradas**, pese a que `frame$alumnos_por_ch` SÍ trae la tabla por facultad con
`media`, `p25` y `p50` para las 18 categorías. **La capacidad de decidir el
estadístico por facultad existe en los datos y no se está usando.**

Consecuencia medida: el uso de aulas por facultad va del **7 % al 100 %**.
LETRAS Y CIENCIAS HUMANAS necesita las 16 que tiene porque se le asignan 20
alumnos por aula; con su mediana real de 16 necesitaría **20 aulas, más de las
que existen**.

Uso por facultad en el componente de facultad: LETRAS Y CIENCIAS HUMANAS 100 % ·
CONTABLES 74 % · EDUCACION 74 % · ARQUITECTURA 64 % · ARTES ESCÉNICAS 62 % ·
GASTRONOMÍA 59 % · ARTE Y DISEÑO 56 % · PSICOLOGÍA 30 % · GESTIÓN 29 % ·
CIENCIAS SOCIALES 22 % · CIENCIAS Y ARTES COMUN. 20 % · EG CIENCIAS 15 % ·
EG LETRAS 14 % · DERECHO 10 % · CIENCIAS E INGENIERIA 8 %.

## H6 — el motor SÍ sabe hacerlo por facultad, y nadie se lo pide

Gonzalo: «el número de alumnos por curso-horario nuevamente es por facultad.
Repítelo conmigo, POR FACULTAD. No es lo mismo una facultad de Derecho que
tiene muchos más estudiantes que una de Gastronomía que tiene muchos menos. La
cantidad de aulas que vamos a requerir responde a cuál es la cuota que tenemos
que llegar por facultad de hombres y mujeres, y a cuántos alumnos hay en
promedio por curso-horario —ese promedio puede ser el mínimo entre la media y la
mediana, el cuartil más pequeño; hay varias formas».

**La capacidad existe entera.** `calc_muestra_alumnos_por_ch_resolver_estudio`
(`api/R/calc_muestra_alumnos_por_ch.R`) resuelve el estadístico POR FACULTAD, y
`calc_muestra_alumnos_por_ch_adjuntar_auditoria` (~613) sobreescribe el
`avg_conglomerado` y el `estadistico_usado` de cada estrato con el suyo, más un
bloque `alumnos_por_ch` con referencia, `frame_hash`, denominador,
`faculty_key`, estadístico y valor. Los cuatro estadísticos que admite son
exactamente los que nombra Gonzalo: **`media`, `mediana`, `p25` y
`min_mediana_media`**.

**CORRECCIÓN (mismo día)**: dije que no la llamaba nadie en producción y **era
falso**. La cadena SÍ está conectada: `POST /api/calc-muestra/calcular`
(`router_calc_muestra.R:423`) llama a
`calc_muestra_alumnos_por_ch_calcular_estudio`, que encadena
`resolver_estudio` → `calcular_estudio` → `adjuntar_auditoria` →
`distribucion_adjuntar` → `comparacion_adjuntar`. Mi grep buscó
`_resolver_estudio` y `_adjuntar_auditoria` y no el envoltorio, que es el que
llama el router.

**La causa real es otra y es un DEFAULT**: el resolutor devuelve sin tocar nada
cuando `alumnos_por_ch_decision` es `NULL` —compatibilidad explícita con
proyectos previos al contrato v1— y en el proyecto real está vacía. No es que
nadie llame al motor: **es que nadie ha tomado la decisión**, y sin decisión el
motor se queda con el `avg_conglomerado` global. El «por facultad» no llega al
número de aulas por omisión, no por incapacidad.

Por eso las quince facultades comparten un único `avg_conglomerado` —20 o 28
según el componente—. No es que el motor no sepa distinguir Derecho de
Gastronomía: **sabe hacerlo y nadie se lo pide**. Y por eso
`alumnos_por_ch_decision` está vacía en el proyecto real: no hay ruta que la
escriba ni que la aplique.

### Decisión de Gonzalo: `min_mediana_media` por defecto, cambiable por facultad

El mecanismo de override por facultad YA EXISTE
(`calc_muestra_alumnos_por_ch.R` ~514): `method <- if (is.null(override))
decision$estadistico_default else override`, con `override =
decision$por_facultad[[faculty_key]]` y validación contra la whitelist de los
cuatro métodos. Lo que falta es que un estudio nuevo **nazca con la decisión
tomada** en vez de con `alumnos_por_ch_decision` vacía.

El propio archivo documenta que **`min_mediana_media` es el estadístico que
aplicó el diseño de 2025** —la hoja «TD Estudiantes» lo llama «Mínimo entre
mediana y media»—, así que el default que pidió Gonzalo coincide con el
precedente.

**Trampa de nombres, ya documentada en el código**: el estadístico de
conglomerado del Recorrido llama `min_media_mediana` a lo mismo, con los dos
términos invertidos. Son contratos distintos y ninguno lee la whitelist del
otro.

Guardas del resolutor, para la reparación: exige
`workspace$frame_mode == "opinion_universitaria"`, devuelve sin tocar nada si
`alumnos_por_ch_decision` es `NULL` —compatibilidad con proyectos previos al
contrato v1— y falla con `schema_invalido` si el schema no cuadra.

**Corrección de encuadre**: decir «177 aulas base» es una cifra agregada y no
significa nada sin su desglose. La cifra honesta es la tabla de 15 filas —
Derecho 46 aulas para 483 encuestas, Gastronomía 10 para 105, Letras y Ciencias
Humanas 16 para 163—. El 177 es sólo su suma.

## H6 — la reparación NO es auto-confirmar: es hacer visible lo pendiente

Al ir a implementar el default apareció una guarda que cambia la naturaleza del
arreglo. `calc_muestra_alumnos_por_ch_resolver_estudio` exige `confirmado_at` no
vacío y falla con **`sin_confirmacion` — «Confirma la decisión de alumnos por CH
antes de calcular»**, además de exigir `denominador == "elegible"` y un
estadístico de la whitelist.

O sea: el contrato pide **deliberadamente que una persona firme** esa decisión
metodológica. Hacer que un estudio nazca con `confirmado_at` puesto sería
**firmar por el analista** una decisión que cambia el número de aulas de cada
facultad. No se hace.

**El defecto real, entonces, no es que falte el default: es el SILENCIO.**
Cuando `alumnos_por_ch_decision` es `NULL`, el resolutor devuelve el estudio
intacto —compatibilidad con proyectos previos al contrato v1— y el motor calcula
con el `avg_conglomerado` global **sin avisar de nada**. El analista no se entera
de que hay una decisión pendiente que decide, facultad por facultad, cuántas
aulas necesita.

**Reparación en dos piezas**, para el siguiente tick:

1. Que el estudio nazca con la decisión **propuesta y sin confirmar**:
   `denominador = "elegible"`, `estadistico_default = "min_mediana_media"`
   —la elección de Gonzalo, y la que aplicó el diseño de 2025—, `por_facultad`
   vacío para que cada facultad herede y pueda sobreescribirse, y
   `confirmado_at` VACÍO.
2. Que la falta de confirmación **se vea**: hoy el path `NULL` es mudo. O el
   resultado publica un aviso de que se está usando el promedio global en vez de
   la cifra por facultad, o la UI pide la confirmación antes de dar el cálculo
   por bueno. Sin esto, el arreglo del punto 1 sólo cambia dónde está el
   silencio.

Guardas completas del resolutor, para no romperlas: `frame_mode ==
"opinion_universitaria"`; `decision NULL` → devuelve intacto; schema distinto →
`schema_invalido`; `confirmado_at` vacío → `sin_confirmacion`; denominador o
estadístico inválidos → `decision_incompleta`; frame ausente o con schema
distinto de `calc_muestra_aulas_frame_v1` → `frame_ausente`; y compara el
`frame_hash` del contrato con el del frame.

## H3 — RESUELTO: no hay contradicción, hay dos capas

`criterios_alumno_report$criterios$level` dice `filas_pasan: 100920` mientras el
elegible del marco es 106.013, **mayor**. Parecía imposible. No lo es: **cada
criterio de alumno lleva una CAPA** y sólo una recorta N.

`api/R/calc_muestra_aulas_criterios.R` lo dice en el propio código: «"marco"
reduce N; "instrumento" se aplica al cuestionario; "procesamiento" se aplica
post-campo». Y en el evaluador (~1500): **«Solo la capa "marco" recorta N, así
que solo ella justifica una exclusión: instrumento/procesamiento se reportan
pero no sacan a nadie del marco»**, con `marco_ok <- marco_ok & flag` dentro de
`if (identical(layer, "marco"))`.

`level` tiene `defaultLayer = "instrumento"` (línea 58, «Ciclo o nivel
curricular»), y el comentario nombra el caso: **el «ciclo 1 → instrumento» de
HST**. En este estudio el ciclo no saca a nadie del marco: decide qué se le
pregunta a quién. Los 106.013 salen de los cuatro criterios de capa `marco`
—age, formation, condition, faculty—, cuya intersección es ≤ 123.360.

**El motor está bien. Lo que falta es claridad**: la pestaña presenta las cinco
filas juntas sin decir a qué capa pertenece cada una, y
`frontend/src/features/calcMuestra/dominio/criteriosMarco.ts:116` reconoce que
«la UI todavía no expone un selector de capa». Por eso una lectura razonable de
esa pantalla lleva a creer que el elegible sale de las cinco. Candidato de
mejora: mostrar la capa junto a cada criterio y qué hace cada capa.

## H5 y H8 — barrido de mejoras después del recorrido (2026-08-17)

**H5 · cerrado, no había defecto.** La geometría de la tarjeta de facultades
excluidas nunca se había medido porque el viewport reportaba 0×0. La causa era
la instrumentación: el dev server de Gonzalo escucha en **IPv6**, así que
`127.0.0.1:5183` no conecta y `localhost:5183` sí. Medida sobre la pila viva con
el proyecto real: 1156×172 a 1280×720 y 900×202 a 1024×600, sin desbordes y sin
scroll horizontal de documento. Los quince nombres refluyen solos.

**H8 · reparado (`df7a9aba`) — la capa se podía leer pero no cambiar.** El motor
distingue tres capas y sólo `marco` recorta el universo; el catálogo publica
`defaultLayer` por variable y el dominio del front ya tenía `capaDe` y `setLayer`
**con tests**. Nadie llamaba a `setLayer` desde producción: la capa de cada
criterio era la que trajera el proyecto y no había mando para moverla. En
HSVG2026: «Ciclo o nivel curricular» en `instrumento` deja pasar 100.920 de
136.284 y no recorta; las otras cuatro en `marco` sí. Si el estudio quisiera
sacar del marco a los de primer ciclo —no preguntarles y descartarlos después,
sino no muestrearlos— no podía decirlo. Ahora cada tarjeta de criterio de alumno
trae el selector, con una línea de qué hace la capa vigente.

Es el mismo patrón que H6, H1 y H2 con una vuelta más: no es que el motor
callara, es que **la capacidad existía completa y sin consumidor**.

Sin cubrir y anotado en el commit: `seleccionInicial` y `seleccionCanonica`
siguen fijando `marco` para todo criterio de alumno. Es deliberado —retro-compat
con el path legacy— y hoy ninguna tiene consumidor en producción.

## Estado final del recorrido (2026-08-16)

Las once etapas cerradas. Lo que el recorrido destapó y quedó reparado:

| Hallazgo | Qué era | Commits |
|---|---|---|
| Familia de recortes | El mismo tope en **cinco superficies**: dos en el panel de rutas, las tarjetas de titular, el export a Excel y la tabla de sugerencias | `4c2114e8` … `438f2e2b` |
| E3 | `exclude_level_patterns` no excluía **ni una** aula: buscaba «posgrado» en un campo numérico | `e8b06e7b` … `2e6684eb` |
| H7 | El proyecto real **no podía calcular**: 409 por una decisión con los seis campos vacíos | `afdd7c0f` |
| H6 | Un solo «alumnos por CH» para quince facultades, y la decisión sin firmar era muda | `f8507a32`, `5b051d70` |
| E11 | Nada protegía que un criterio de una facultad no se filtrara a las demás | `505c5043` |
| H1 y H2 | El motor sabía que una facultad se queda sin reemplazos y no lo decía | `c3e17367` |
| H3 | Falsa alarma: dos capas, no una contradicción | — |
| H5 | Falsa alarma: la tarjeta no desborda; el 0×0 era la instrumentación (IPv6) | — |
| H8 | La capa del criterio se podía leer pero no cambiar: `setLayer` sin consumidor | `df7a9aba` |

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
