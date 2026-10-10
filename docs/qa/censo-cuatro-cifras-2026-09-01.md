# Censo de las cuatro cifras — A9-B7 (2026-09-01)

Tipo: Censo QA (insumo de diseño de B7)
Estado: Vigente
Fecha: 2026-09-01
Autoridad: Evidencia de QA; no reemplaza un ADR

Generado por el barrido read-only del loop nocturno. Fuente de la unidad: `checklist-tres-fuentes-monitoreo-2026-08-27.md` fila B7. Este doc es el insumo de diseño de B7; el checklist vivo apunta aquí.

# Censo A9‑B7 — las cuatro cifras de «cuántas encuestas hay»

Fuentes leídas: `docs/qa/checklist-tres-fuentes-monitoreo-2026-08-27.md:47,150-166,208-224`, `docs/qa/checklist-operativo-aulas-2026-08-31.md:32,34`, `docs/adrs/0082-la-tau-del-diseno-es-un-supuesto-fechado-y-el-campo-lo-contrasta.md:66-75,105-109,156`.

## 0. El mapa de claves de payload (esto es lo que cambia el censo)

Las «cuatro cifras» son en realidad **cuatro conceptos repartidos en nueve claves**, y una décima que no es una cifra y se lee como si lo fuera:

| # | Concepto | Claves del payload | Dónde nace |
|---|---|---|---|
| 1 | **Asistentes** | `observed_students` (alias `attendees`, `asistentes`) | parte «CANTIDAD DE ASISTENTES» + control «N ASISTENTES EN AULA» |
| 2 | **Enviadas / llegadas (crudo)** | `kpis.respuestas_total` · `course_status.responses_total` · `control.sent_total` | `monitoreo_aulas_universitarias.R:2118` · `:945` · `carga_base_control.R:35` |
| 3 | **Efectivas de plataforma** | `kpis.respuestas_validas` · `course_status.respuestas_validas` · `control.efectivas_obtenidas` | `monitoreo_aulas_universitarias.R:2117,946` · `monitoreo_aulas_efectivas.R:27` |
| 4 | **Efectivas del parte** | `effective_surveys` (alias `efectivas`) | `carga_aulas_aplicadas.R:31` |
| — | **NO es cifra: veredicto** | `valid_total`, `valid_population` | `carga_base_control.R:67-68` (`solo_lectura`, hermanas de 70T/70P) |

**Las tres claves de la cifra 2 no son intercambiables**: `kpis.respuestas_total` cuenta *todas* las filas de la base (`length(response_classroom)`), atribuidas o no; `course_status.responses_total` cuenta sólo las atribuidas a esa aula; `control.sent_total` lo cuenta el equipo a mano en su Excel. Suman cosas distintas y hoy comparten familia de rótulo.

## 1. Banda de KPIs — `kpisDeAulas.ts`

| línea | cifra (por el campo) | rótulo actual | ¿confundible? |
|---|---|---|---|
| `:488` | **2** `kpis.respuestas_total` | «Respuestas leídas» · *filas que llegaron de la plataforma* | Sí — con la columna «Respuestas totales», que es otro alcance |
| `:412` | **3** `kpis.respuestas_validas` | «**Válidas**» · *respuestas de la plataforma que pasan los controles de validez* | Sí — sobrevive «válida» tras A11; y la pista sí distingue |
| `:297` | (no es cifra) `kpis.aulas_aplicadas` | «Cursos‑horario aplicados» · *declarados en el registro de campo* | **No** — rótulo de referencia |
| `:199` | (personas de cuota) | «Cuota por recoger» · *…lo que falta se suma grupo a grupo* | No |
| `:376` | (cursos‑horario) `kpis.brechas` | «Cursos‑horario bajo su meta» | No |

Las dos que pintan cifras del catálogo (`:488` y `:412`) **nunca coinciden en pantalla**: `:488` es de la sección Fuentes, `:412` de Avance. Eso las salva de un choque directo, no de la homonimia.

## 2. Avance en respuestas — `AulasAvanceEnRespuestas.tsx` / `avanceEnRespuestas.ts`

| línea | cifra | rótulo | ¿confundible? |
|---|---|---|---|
| `avanceEnRespuestas.ts:95` → `.tsx:120` | **3** `respuestas_validas` | «N de M respuestas que pide el plan» / «N cubren meta» | Parcial |
| `.tsx:31-35,155` | **3** `kpis.respuestas_validas` (`validasTotales`) | «N se recogieron en eslabones que ya no son el que cuenta en su cadena» | **No — es el puente que el precedente obligó a escribir** |
| `AulasPestanaResumen.tsx:111,124` | meta | «Cumplimiento aula por aula» · *meta N · suma de metas por curso‑horario* | No |

Ésta es la superficie modelo: dos lecturas de la misma cifra 3 con distinto alcance y un renglón que las reconcilia.

## 3. Control del libro — `AulasControlDelLibro.tsx` (pestaña `calidad/base`)

| línea | cifra | rótulo | ¿confundible? |
|---|---|---|---|
| `:543-553` (banda de pérdida) | **2** `sent_total` → **¿3?** `valid_total` | «De **N enviadas** cuentan **M** · se pierden X (P % pasa)» | **CHOQUE 1 — ver abajo** |
| `aulasPresentation.ts:85` | **2** `sent_total` | «Total enviadas» | No |
| `aulasPresentation.ts:116` | **3** `efectivas_obtenidas` | «Efectivas que llegaron» | Parcial (no dice «de plataforma») |
| `aulasPresentation.ts:114` | meta | «Meta de efectivas del curso‑horario» | No |
| `aulasPresentation.ts:25` | **1** `observed_students` | «Cantidad de asistentes» | No |
| `aulasPresentation.ts:94-95` | veredicto | «Válido total» / «Válido población» | **Sí — un dedo debajo de la banda que suma ese mismo campo como cifra** |
| `AulasMatrizUmbrales.tsx:29` | veredicto | «Sólo asistentes» | No |

## 4. Fichas — `AulasFichaDeAula.tsx` / `fichaDeAula.ts`

| línea | cifra | rótulo | ¿confundible? |
|---|---|---|---|
| `:87` | meta `expected_valid` | «Se esperaba» · *de N elegibles* | No |
| `:92` | **3** `respuestas_validas` | «**Llegó a plataforma**» | No |
| `:97` + `:105` | **4** `effective_surveys` + **1** `attendees` | «**Anotó el campo**» · *N asistentes · M rechazos* | No |
| `:111-113` | **2** `sent_total` | «**Contó el libro**» · *enviadas según el equipo* | No |
| `fichaDeAula.ts:118` | veredicto `valid_total` | (no pintado, va a `veredicto`) | No |

**Éste es el juego mínimo de nombres que ya existe y que ya funciona: las cuatro cifras, cuatro rótulos, ninguno repetido, cada uno nombrando su fuente.**

## 5. Registro de campo — `RegistroDeCampo.tsx`

| línea | cifra | rótulo | ¿confundible? |
|---|---|---|---|
| `:781` | **1** | «Cantidad de asistentes» | No |
| `:792` | (repartidas) `applied_surveys` | «Encuestas aplicadas» | Sí — «encuestas» a secas junto a «efectivas» |
| `:815` | **4** `effective_surveys` | «Cantidad de efectivas» | Sí — sin «del parte»; es el formulario, el contexto lo salva |
| `AulasSeccionConsultas.tsx:197` | **1**+**4** | «N partes no cuadran: asistentes menos rechazos y duplicados no dan las **efectivas declaradas**» | No |
| `AulasSeccionConsultas.tsx:228` | **1**,**4** | columnas del parte | No |

## 6. Efectividad / señales

| superficie:línea | cifra | rótulo | ¿confundible? |
|---|---|---|---|
| `AulasEfectividadSeguimiento.tsx:366` | **3** | «se cuenta la respuesta que llegó a la plataforma y pasó los filtros» | **No — referencia** |
| `AulasEfectividadSeguimiento.tsx:431` | **3** | «N de M alumnos» | Parcial |
| `AulasSenalesPorAula.tsx:148-149` | **3**, con respaldo **4** | «se cuenta la efectiva que llegó a la plataforma…; si no hay, respalda el parte de campo **y la fila lo dice**» | **No — referencia** |
| `AulasSenalesPorAula.tsx:211,215` | **3**/**4** | «N efectivas de M elegibles · **del parte**» | No |
| `AulasRendimientoPorFacultad.tsx:142` | **4** | «Efectivas por visita» (`title`: *del parte de campo*) | No |
| `AulasRendimientoPorFacultad.tsx:151` | **4** | «**De los que asistieron**» | Parcial (numerador sin fuente) |
| `AulasRendimientoPorFacultad.tsx:154` | **4** | «**De los elegibles**» | **Sí — CHOQUE 5** |
| `AulasAlcanceDelBanco.tsx:112-115` | **2** `sent_total` | «Con lo que la Base de control da por enviado… **No es la efectiva de plataforma**» | **No — referencia** |

## 7. Parte contra plataforma (referencia de buen rótulo)

`AulasParteContraPlataforma.tsx` + `parteContraPlataforma.ts:23-28,109-134`

| línea | cifra | rótulo |
|---|---|---|
| `.tsx:140` | **4** vs **3** | «**parte** N · **plataforma** M» |
| `.tsx:80-89` | descuento | «El filtro del instrumento explica X de las Y diferencias» |
| `.tsx:59-61,92-94,118-121` | **2** ausente | «La base no publica el total de respuestas atribuidas; la comparación es contra las efectivas, sin descontar el filtro» |

Compara contra el **crudo** (`responses_total`, fallback `respuestas_validas + filter_rejected`) y declara cuándo no puede. Es el único sitio del perfil donde las cuatro distinciones están simultáneamente nombradas y auditables.

## 8. Otras superficies del frontend

| superficie:línea | cifra | rótulo | ¿confundible? |
|---|---|---|---|
| `embudoDelOperativo.ts:132` | **2** `respuestas_total` | «Respuestas recibidas» · *respuestas, ya no cursos‑horario* | Sí — cuarto nombre de la cifra 2 |
| `embudoDelOperativo.ts:148` | **3** | «Encuestas que cuentan» · *pasan el filtro de efectividad* | No |
| `AulasCadenaDeFiltros.tsx:45` | **2**→**3** | «De **N respuestas**, la cadena deja **M**» | **Sí — CHOQUE 4** |
| `AulasEmbudoDelAula.tsx:53,59` | **1**→ | «N personas estaban en el aula» / «quedaron M respuestas» | Parcial |
| `embudoDelAula.ts:71,105` | **4** | descuadre «declaradas» | No |
| `AulasBrechaEstratoChart.tsx:89,93` | **3** | «**Efectivas**» / «%{x} efectivas» | **Sí — CHOQUE 2** |
| `AulasHistoriaCadena.tsx:69` | **3** | cabecera «**Válidas**» | Sí (A11) |
| `AulasAvanceParaCliente.tsx:207` | **3** | «Encuestas logradas» | Parcial |
| `AulasAvanceCuota.tsx:69` / `avanceCuota.ts:181` | **3** | «N de M personas» / «N recogidas» | Parcial |
| `AulasRitmoDiario.tsx:122` | **3** (`validas`/día) | «N respuestas en M **días de recolección**» | **No — referencia** (se separó a propósito de la de abajo) |
| `AulasRitmoPorFacultad.tsx:76,94` | **4** | «N días **con parte de campo**» / «N en M días» | **No — referencia** |
| `AulasSerieDeRendimiento.tsx:830` | **4** | «N **efectivas del parte**» | **No — referencia** |
| `AulasSerieDeRendimiento.tsx:961` | **4** | «Acumulado por día · **encuestas del parte contra la meta**» | **No — referencia** |
| `AulasSerieDeRendimiento.tsx:1058-1062` | **3** vs **4** | «las dos de sexo salen de las respuestas atribuidas y la verde, **del parte**: por eso no suman» | **No — puente explícito** |
| `AulasTrabajoDeLosEquipos.tsx:61,67,102` | **4** | «N efectivas por curso‑horario del estudio» | Parcial |
| `AulasLoQueFalta.tsx:262-275` | **3**/**4**/**2** | los **tres** orígenes nombrados y la mezcla declarada | **No — referencia** |
| `coberturaPorAula.ts:43,57` | **3** | «Sin respuestas» / «Llegó a lo esperado» | No |
| `aulasPresentation.ts:189` | meta `expected_valid` | «**Válidas esperadas**» | **Sí — CHOQUE 6** |
| `aulasPresentation.ts:211` | **2** `responses_total` | «Respuestas totales» | **Sí — CHOQUE 3** |
| `aulasPresentation.ts:216` | **3** | «Respuestas válidas» (con nota explícita de por qué NO se traduce a «efectivas») | Sí (A11) |
| `aulasPresentation.ts:28` | **4** | «Cantidad de efectivas» | Sí |
| `aulasPresentation.ts:36` | **4** derivada | «Efectivas que implica el parte» | No |

## 9. El libro

### 9.1 Base de control — `carga_base_control.R` + `carga_aulas_libro_generar.R:406-560`

| campo | encabezado de la hoja | cifra | ¿lo escribe la app? | ¿confundible? |
|---|---|---|---|---|
| `sent_total` | **TOTAL ENVIADAS** | 2 | no (lo llena el equipo) | No |
| `sent_vs_total` / `sent_vs_population` | **VS TOTAL** / **VS POBLACION** | razón de la 2 | no | Sí — «VS TOTAL» no dice contra qué total |
| `efectivas_esperadas` | EFECTIVAS ESPERADAS | meta | sí (`:506`) | No |
| `efectivas_obtenidas` | **EFECTIVAS OBTENIDAS** | **3** | sí (`:516`, de `monitoreo_aulas_efectivas_por_aula`) | Parcial |
| `efectivas_brecha` | EFECTIVAS: DIFERENCIA | 3 − meta | sí (`:520`) | No |
| `elegibles_esperados` | ELEGIBLES: BASE DEL % | padrón | sí (`:509`) | No (ya renombrado por un defecto real) |
| `observed_students` | N ASISTENTES EN AULA | 1 | sí desde el parte (`:490`) | No |
| `valid_total` / `valid_population` | **VALIDO TOTAL / POBLACION** | **veredicto** | no (`solo_lectura`) | **Sí — CHOQUE 1** |

La cabecera del bloque es explícita (`carga_base_control.R:69-76`): «Efectivas: la definicion es la de la PLATAFORMA… No es lo que el aplicador anota en su parte». El vocabulario está bien fijado **en el R**.

### 9.2 «Cómo va el campo» (xlsx) — `carga_aulas_libro_indicadores.R`

| línea | cifra | rótulo | ¿confundible? |
|---|---|---|---|
| `:264` | meta | «Encuestas de la meta» | Parcial («encuestas» a secas) |
| `:265` | **3** | «**Efectivas conseguidas**» | **Sí — CHOQUE 5** |
| `:128` | **3** | «**Efectivas del dia**» | Sí |
| `:126` | **3** | «**Efectivas acumuladas**» | Sí |
| `:153,157` | **4** `effective_surveys` | «**Efectivas declaradas**» / «Media por aula» | **Sí — CHOQUE 5** |
| `:296-302` | puente | «Estas cifras salen de la plataforma, no del parte de campo…» | **sólo se escribe si `sin_dato`** |

### 9.3 «Avance de campo» (Sheets) — `carga_aulas_libro_avance.R` + `carga_aulas_libro_avance_facultad.R`

Espeja exactamente lo anterior: `:119` «Encuestas de la meta», `:120` «Efectivas conseguidas» (3), `:126` el mismo puente condicional, y las tablas del modelo compartido → «Efectivas declaradas» (4). Añade:

| línea | cifra | rótulo | ¿confundible? |
|---|---|---|---|
| `avance_facultad.R:113-116` | **3** | «**Conseguidas**» / «Conseguidas mujeres» / «Conseguidas hombres» | Sí — la columna sola no dice su fuente |
| `avance_facultad.R:108` | cuota | «Muestra» | No (con nota `:105-107,116-118`) |
| `avance.R:133` | — | «La cuota es de cada facultad y de cada sexo…» | No |

### 9.4 Hoja de campo — «Aulas Aplicadas (Campo)» — `carga_aulas_libro_generar.R:251-254`

`CANTIDAD DE ASISTENTES` (1) · `% ASISTENCIA` · `CANTIDAD DE RECHAZOS` · `DUPLICADOS (YA RESPONDIERON)` · `CANTIDAD DE EFECTIVAS` (**4**). No conviven cifras 2 ni 3 en esta hoja → sin choque interno. Es la fuente literal del rótulo «efectivas» que después colisiona en el resto del libro.

### 9.5 «Plan del día» — `carga_aulas_libro_plan_dia.R`

No pinta ninguna de las cuatro. Sin hallazgo.

---

# Conteos

| cifra | superficies del frontend que la pintan | hojas del libro | rótulos distintos en uso |
|---|---|---|---|
| **1 · asistentes** | 7 | 2 (Base de control, hoja de campo) | 3 («asistentes», «Cantidad de asistentes», «personas en el aula») |
| **2 · enviadas/crudo** | 9 | 1 (Base de control) | **5** («Respuestas leídas», «Respuestas totales», «Respuestas recibidas», «Total enviadas»/«enviadas», «lo que la hoja da por enviado») |
| **3 · efectivas de plataforma** | 18 | 3 (control, indicadores, avance) | **9** («Válidas», «Efectivas», «Efectivas conseguidas», «Efectivas que llegaron», «Conseguidas», «Encuestas logradas», «Encuestas que cuentan», «Llegó a plataforma», «respuestas») |
| **4 · efectivas del parte** | 14 | 2 (hoja de campo, indicadores/avance) | **6** («Cantidad de efectivas», «efectivas del parte», «Efectivas declaradas», «Efectivas por visita», «Anotó el campo», «efectivas» a secas) |

- **Superficies que declaran su fuente explícitamente: 11** (ficha, parte‑contra‑plataforma, alcance del banco, señales, lo que falta, serie de rendimiento ×2, ritmo diario, ritmo por facultad, KPI de aplicados, avance en respuestas).
- **Choques identificados: 6.** Uno de ellos (#1) no es sólo de rótulo: es un **error de lectura de campo**.

---

# Los choques, rankeados

### 1 · La banda de pérdida suma un veredicto y lo pinta como cifra 3 — **el propio panel de B7**
`perdidaDelControl.ts:47` lee `fila.valid_total` como conteo; `AulasControlDelLibro.tsx:543-553` lo pinta como *«De N enviadas cuentan M · se pierden X (P % pasa)»*.

`valid_total` es un **veredicto** en todos los demás sitios del repo, sin excepción:
- `api/R/carga_base_control.R:67` — «VALIDO TOTAL», `solo_lectura`, hermana de `70T`/`70P`; **no está en `.cbc_numericos`** (`:122-127`), o sea llega como texto.
- `api/R/monitoreo_aulas_control.R:239` + `.mac_verdict` (`:110-119`) — acepta `SI`/`NO`/`CUMPLE`/`NO CUMPLE`/`1`/`0`.
- `api/scripts/qa_pulso_aulas_campo.R:746` — el sembrador escribe `if (enviadas >= 0.7*asistentes) 1 else 0`.
- `api/tests/testthat/test-carga-base-control.R:34` — `expect_identical(f$valid_total, "NO CUMPLE")`.
- `aulasPresentation.ts:528-531` y `aulasPresentation.test.ts:166-173` — «`valid_total` / `valid_population`, que son **veredictos 0/1**».
- `AulasControlDelLibro.tsx:256` — `COLUMNAS_DE_VEREDICTO`; `aulasPresentation.ts:94` lo rotula «Válido total».
- `fichaDeAula.ts:118` — lo lee como `veredicto`.
- `estadoDeAplicacion.ts:53` — el tramo «Cumple» sale de `CUMPLE` en **VALIDO TOTAL**.

Consecuencia: sobre un libro sembrado con banderas, la banda dice algo como «De 4.000 enviadas cuentan 120 · se pierden 3.880 (3 % pasa)», y sobre un libro con `SI`/`NO` textual manda todas las filas a `sinRevisar`. Y está **a dos líneas de la columna «Válido total»**, que pinta ese mismo campo como marca de sí/no: mismo dato, dos lecturas, misma pantalla. La evidencia de cierre del checklist («de 2 009 enviadas cuentan 1 811 · 90 % pasa», `checklist-tres-fuentes:224`) no se puede reproducir con ningún productor de `valid_total` que exista hoy en el repo.

### 2 · «Efectivas» nombra la cifra 3 y la 4, y el gráfico de estratos justifica el rótulo con la columna de la otra
`AulasBrechaEstratoChart.tsx:87-93` pinta `brechaPorEstrato.validas` ← `respuestas_validas` (**cifra 3**) con `name: "Efectivas"` y `hovertemplate: "%{y}: %{x} efectivas"`. El comentario que lo autoriza dice literalmente: *«`CANTIDAD DE EFECTIVAS` es la columna del parte de campo; "Recogidas" era mío»* — es decir, **cambió el rótulo de la cifra 3 citando la columna de la cifra 4**. Bajo D‑L12/A11 el rótulo es defendible; la procedencia escrita es la equivocada, y el gráfico no dice de qué fuente sale mientras sus vecinos de otras pestañas («efectivas del parte», `AulasSerieDeRendimiento.tsx:830`) sí lo dicen. `xaxis.title = "respuestas"` y `ariaLabel = "Respuestas recogidas…"` añaden un tercer nombre para el mismo eje.

### 3 · La cifra 2 tiene cinco rótulos y tres denominadores, dos de ellos casi homónimos
- «Respuestas leídas» (`kpisDeAulas.ts:488`) = `kpis.respuestas_total` = **todas** las filas de la base (`monitoreo_aulas_universitarias.R:2118`), atribuidas o no.
- «Respuestas totales» (`aulasPresentation.ts:211`) = `course_status.responses_total` = **sólo las atribuidas a esa aula** (`:945`).
- «Respuestas recibidas» (`embudoDelOperativo.ts:132`) = la primera.
- «Total enviadas» / «enviadas» (`aulasPresentation.ts:85`, `AulasControlDelLibro.tsx:545`) = `sent_total`, contada por el equipo.
- «lo que la hoja da por enviado» (`AulasAlcanceDelBanco.tsx:112`, `AulasLoQueFalta.tsx:274`) = la misma `sent_total`, aquí sí nombrada.

La suma de la columna «Respuestas totales» es ≤ el KPI «Respuestas leídas» por construcción, y no hay ningún puente. Los dos rótulos difieren en una palabra.

### 4 · Validación: dos cifras de «cuánto llegó» a una pestaña de distancia, sin puente — la forma exacta del precedente
- `calidad/controles` → `AulasCadenaDeFiltros.tsx:45`: «**De 1 811 respuestas**, la cadena deja **1 637**» (cifra 2 de plataforma → cifra 3).
- `calidad/base` → `AulasControlDelLibro.tsx:545`: «**De 2 009 enviadas cuentan 1 811**» (cifra 2 del libro → supuesta cifra 3).

El mismo número, **1 811**, aparece en los dos paneles significando cosas opuestas: en uno es lo que **entra** a la cadena de filtros, en el otro lo que **sale** de la revisión del equipo. Toda la distinción vive en la diferencia «respuestas» / «enviadas», y ninguno de los dos declara su fuente. Es literalmente la geometría de «VÁLIDAS 2,220» contra «2,163 cubren meta», con el agravante de que aquí las dos cifras coinciden en valor.

### 5 · El libro dice «Efectivas» dos veces por hoja con dos numeradores, y sólo pone el puente cuando faltan los datos
En «Cómo va el campo» (`carga_aulas_libro_indicadores.R`) y en «Avance de campo» (`carga_aulas_libro_avance.R`) conviven:
- «**Efectivas conseguidas**» (`:265` / `:120`) = cifra 3;
- «**Efectivas del dia**» / «**Efectivas acumuladas**» (`:128`, `:126`) = cifra 3;
- «**Conseguidas**» (avance por facultad, `avance_facultad.R:113`) = cifra 3, sin fuente;
- «**Efectivas declaradas**» (producción por aplicador, `:153`) = cifra 4.

El puente («Estas cifras salen de la plataforma, no del parte de campo…») se escribe **sólo dentro de `if (sin_dato)`** (`indicadores.R:296`, `avance.R:125`). O sea: cuando faltan las cifras de plataforma, la hoja explica la distinción; cuando **ambas están presentes** —que es cuando de verdad chocan— no dice nada. El comentario de `indicadores.R:291-295` describe ese caso exacto («3 508 efectivas declaradas… quien lee elige cuál creer») y lo deja sin cubrir.

### 6 · Residuos de vocabulario que A11 dio por cerrados
`checklist-operativo-aulas-2026-08-31.md:34` declara «grep de hoy: cero rótulos visibles con "válida" en el sentido de encuesta en el perfil aulas». En el árbol de trabajo de hoy quedan cinco:
- `kpisDeAulas.ts:412` — **«Válidas»**, valor de la tarjeta que preside la banda de Avance;
- `AulasHistoriaCadena.tsx:69` — cabecera de columna **«Válidas»**;
- `aulasPresentation.ts:216` — «Respuestas válidas»;
- `aulasPresentation.ts:262` — «Respuestas válidas sin curso‑horario»;
- `aulasPresentation.ts:189` — **«Válidas esperadas»** (`expected_valid`), que además es una **meta** y convive en la misma tabla con «Respuestas válidas», el conseguido: dos rótulos a una palabra de distancia para el objetivo y el logro.

*(Choque menor adjunto, ADR 0082 a medio cumplir): `AulasRendimientoPorFacultad.tsx:154` publica «De los elegibles» con numerador `effective_surveys` (cifra 4) y un `title` que no nombra la fuente, a dos pestañas de la τ observada de `AulasEfectividadSeguimiento` (cifra 3) y del alcance del banco (cifra 2). El ADR pedía que las tres tasas declararan su numerador; sólo «Efectivas por visita» (`:142`) lo hace.*

---

# Rotulación que YA distingue (materia prima para el juego mínimo, sin vocabulario nuevo)

| cifra | palabras ya en uso donde SÍ se distingue | dónde |
|---|---|---|
| 1 | «asistentes», «los que estaban en el aula» | `AulasFichaDeAula.tsx:105`, `embudoDelAula.ts:98` |
| 2 | «lo que la Base de control da por **enviado**» · «filas que llegaron de la plataforma» · «el total de **respuestas atribuidas**» | `AulasAlcanceDelBanco.tsx:112`, `kpisDeAulas.ts:491`, `AulasParteContraPlataforma.tsx:59` |
| 3 | «**la efectiva de plataforma**» · «llegó a plataforma» · «la respuesta que llegó y **pasó los filtros**» | `AulasAlcanceDelBanco.tsx:114`, `AulasFichaDeAula.tsx:92`, `AulasEfectividadSeguimiento.tsx:366`, `monitoreo_aulas_efectivas.R:1-11` |
| 4 | «**efectivas del parte**» · «lo que anotó el aplicador al salir» · «Efectivas declaradas» · «Anotó el campo» | `AulasSerieDeRendimiento.tsx:830`, `AulasLoQueFalta.tsx:273`, `carga_aulas_libro_indicadores.R:153`, `AulasFichaDeAula.tsx:97` |
| — | «Válido total» / «Cumple» = **veredicto**, no cifra | `aulasPresentation.ts:94`, `estadoDeAplicacion.ts:53` |

Las tres piezas doctrinales que ya fijan esto por escrito y no hay que reinventar: `api/R/monitoreo_aulas_efectivas.R:1-18` (la definición canónica), `api/R/monitoreo_aulas_cruce_hojas.R:21-32` (por qué `effective_surveys` y `sent_total` no se cruzan), y `docs/adrs/0082-…:66-75,105-109` (la tabla de los tres numeradores y la regla «con su propio rótulo, nunca junto a τ bajo el mismo nombre»).