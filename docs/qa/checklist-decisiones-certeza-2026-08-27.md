# Checklist — las siete decisiones de Gonzalo y la cola del loop de cobertura

Fecha de apertura: 2026-08-27. Doc vivo: se marca conforme se cierra cada ítem
y **sólo Gonzalo lo da por terminado**.

## La vara

Gonzalo, textual (2026-08-27):

> «cada uno de ellos no sólo es una comprobación e implementación en el backend,
> también lo es en el frontend»

Un ítem se cierra cuando el usuario **puede ver el efecto o tomar la decisión
desde la pantalla**, no cuando el motor está reparado y el test verde. Todo ítem
cerrado en backend se reabre con su mitad front hasta que esa mitad exista.

Y la regla de evidencia, también suya:

> «valida todo, no solo des por confirmar las cosas, porque sí, y validalas
> siempre desde la aplicación misma»

## Las siete decisiones

| # | Decisión (textual de Gonzalo) | Dónde vive | Backend | Frontend | Estado |
|---|---|---|---|---|---|
| 1 | «Lo segundo» — la comparación de métodos no es prerrequisito para **leer** una selección ya hecha, sólo para ejecutar una nueva | `aulas/aulasSurfaceState.tsx` | — | `eae20369` | ☑ **cerrada** |
| 2 | «Si ratifica» — ADR 0080, el workspace se resella entero | `docs/adrs/0080-…md` | — | — | ☑ **cerrada** `f233cc8c` (Ratificado + mordidas 6 y 7) |
| 3 | «Verificar como se hizo en el archivo ULT, entiendo que allí cada una fue 1000 corridas» | `calc_muestra_aulas_certeza.R` · `CertezaCoberturaPanel.tsx` | medido | `10ef2c7e` | 🔒 **EVALUADA CON TIEMPOS MEDIDOS, decide Gonzalo** — ver el análisis abajo |
| 4a | «se muda a cálculo» — el editor de afijación | `calculo/TitularesFacultadEditor.tsx` | `a3b8918b` | `b98f9635` | ☑ **cerrada y vista en pantalla** — el stepper bajó a la columna Titulares de «Cursos-horario requeridos» y ya no exige certificación corrida |
| 4b | «certeza completo se va a cálculo y tiene su propia pestaña bien explicada al final de las demás pestañas» | `calculo/CalculoCertezaTab.tsx` | — | `d93e9bd5` + `e34ee2b3` | ☑ **cerrada y vista en pantalla** |
| 4c | «y selección ya sabes de los cambios de aulas hechos en certeza» | `aulas/classroomLabModel.ts` · `aulas/FijasPendientesAviso.tsx` | — | `d13e624c` | ☑ **cerrada y vista en pantalla** — el aviso existía pero no se encendía nunca para el componente de facultad, y además decía «fijaste 15» cuando el analista tocó una |
| 5 | «Cambiémoslo, sí» — renombrar `promedio_conglomerado`, que guarda el P25 | `calc_muestra_engine.R` · workspace | — | — | ☐ **pendiente** — el dato está bien y el estadístico ya se declara (`estadistico = p25`); lo que engaña es el nombre del campo |
| 6 | «Necesita su ADR, necesita su propia pestaña al final de las pestañas actuales de selección porque es la última decisión» — rerandomización | ADR nuevo · `aulas/` | — | — | ☐ **pendiente** — la de más valor metodológico |
| 7 | «El sustento metodológico que creamos fue específico… el que crea la app debe ser más general pero considerar a detalle todo lo que escribimos en el de las 23 páginas» | motor de entregables | — | — | ☐ **pendiente** |

## Decisión 3, evaluada — tiempos medidos, no estimados

**Qué hace hoy.** `.cm_certeza_corridas` reproduce las 15 facultades exactas:
`disponibles ≤ 60` → las 1.000 pedidas; si no, `⌈1.000 × 60 / disponibles⌉`.
Es un presupuesto de **tiempo**: mantiene `corridas × disponibles ≈ 60.000`.

**Calibración medida el 2026-08-27** sobre el backend con el código actual:
Derecho solo, 3 evaluaciones × 205 sorteos sobre 293 filas = **64 segundos**,
o sea **355 µs por (sorteo × fila de marco)**. Con eso, la certificación
completa de las 15 cuesta **10,5 min**.

**Tres veredictos quedan dentro de su propio error de muestreo** (margen sobre
el 95% menor que 2 EE): CIENCIAS E INGENIERÍA (m/EE 1,62), EE.GG. CIENCIAS
(0,99) y DERECHO (0,08). Son las tres de marco más grande, es decir las de
mayor cuota: **el reparto da menos evidencia justo donde el veredicto está más
apretado**.

**La prueba directa de que es ruido**: la misma medición de Derecho con 18
aulas, repetida con la misma configuración y los mismos 205 sorteos, dio
**95,12 %** la primera vez y **96,10 %** la segunda. La diferencia (0,98pp) es
0,68 EE, perfectamente normal — pero el umbral está en 95,00 %, así que una
corrida deja margen 0,12pp y la otra 1,10pp. **El veredicto de Derecho se
decide por dónde cayó el ruido.**

| Opción | Tiempo | Qué resuelve |
|---|---:|---|
| **A** · dejar la fórmula | 10,5 min | nada nuevo; tres veredictos en el ruido |
| **B** · 1.000 para todas | **29,3 min** (2,80×) | sólo C&I |
| **C** · segunda pasada dirigida a lo que su margen pide, tope 1.000 | **13,6 min** (1,30×) | C&I y EE.GG. Ciencias |
| **D** · resolver también Derecho (~4.500 sorteos) | **36,0 min** (3,43×) | las tres |

Sorteos que cada una necesita para que su margen valga 2 EE: C&I **219** (tiene
144), EE.GG. Ciencias **1.722** (tiene 420), Derecho **~4.500** juntando las dos
corridas (tiene 205).

**Recomendación: C.** El tope se queda en 1.000; una segunda pasada vuelve a
correr sólo las facultades cuyo margen esté dentro de 2 EE, con los sorteos que
su margen pide (`4·p(1−p)/margen²`); lo que ni así se resuelve se declara
empate en vez de seguir gastando. B cuesta 16 minutos más que C y resuelve
menos.

**Corrección de una cifra que di antes**: estimé que Derecho necesitaba
~129.000 sorteos. Ese número salía de un solo punto ruidoso (margen 0,12pp).
Con las dos corridas juntas el margen es 0,61pp y hacen falta ~4.500 — caro,
pero no absurdo. La decisión sobre Derecho es real y no está cerrada de
antemano.


## La cola del loop de cobertura

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| D1 | El agregador de aulas de certeza | `calculo/TitularesFacultadEditor.tsx` | ☑ `b98f9635` — el editor salió de la tarjeta de certificación, que lo escondía hasta haber sorteado |
| D2 | La certeza no limpiaba `faculty_targets` y sorteaba la selección, no el marco | `calc_muestra_aulas_certeza.R` | ☑ los dos lados: `8ed2f0a3` + `042be9d8` |
| D3 | La búsqueda no evaluaba el candidato que nombra | — | ☑ es D2, no era defecto aparte |
| D4 | `promedio_conglomerado` guarda el P25 | workspace | 🔒 más suave de lo dicho: sólo el nombre engaña — es la decisión 5 |
| D5 | `.cm_certeza_corridas` escala por marco, no por precisión | `calc_muestra_aulas_certeza.R` | ◐ front cerrado (`10ef2c7e`: se ven las corridas y el ruido); **cuántas correr decide Gonzalo** — es la decisión 3 |
| D6 | El landing del cubo se colgaba con muchas columnas de balance | `calc_muestra_aulas_balance_saneo.R` | ☑ `a288a0d5`, `dadf4547`, `569905b9` |
| D7 | `program` en `balance_vars` degeneraba el cubo | idem | ☑ neutralizado y declarado en pantalla con su cifra |
| D8 | Las cuatro rutas de aulas resolvían el config distinto | `calc_muestra_aulas_config_fusion.R` | ☑ `17ac55d9` — era la raíz de D2 vista desde el config |
| F1 | `seed` sin control en la UI | `aulas/AulasObjetivoTab.tsx:329` | ☑ **falso** — el control existe como `semilla`. NO construirlo |
| F2 | `balance_vars` sin control | `aulas/VariablesBalanceControl.tsx` | ☑ `fa500edd` — falta verlo en pantalla |
| F3 | `coverage_weight` y `pps_weight` sin control | `calc_muestra_aulas_cube_determinista.R` | ☑ medido (`84727850`): con el motor vigente sólo anotan un score; sólo deciden con `pool_controlado`. Construir el control es decisión de producto, no defecto |
| B1 | Rerandomización: falta el bucle y el criterio | — | ☐ es la decisión 6 |
| B2 | Matriz por CH y facultad con sexo | `calc_muestra_aulas_export_workbook.R` | ☑ `e3330224` — hoja «Sexo por facultad» |
| B3 | Base de contactos de docentes titulares | — | ☐ pendiente |
| B4 | Sustento metodológico como documento, no hoja de Excel | — | 🔒 **bloqueado** — es la decisión 7 |
| B5 | El libro de tres dimensiones | — | ☑ ya existía; cerrado por la sesión de Monitoreo |

## Fuera de la lista, por pedido urgente suyo

| Ítem | Estado |
|---|---|
| «Necesito que lo repares porque la otra sesión está validando monitoreo y necesita tener las 174 aulas reales del sorteo» — la corrida no se publicaba por diferir en cantidad | ☑ `bcb33dff` + `0bfe6d27`: ahora decide la identidad y la cantidad se declara |

## Hallazgos abiertos por otras sesiones

| Hallazgo | Quién lo mide | Qué implica de mi lado |
|---|---|---|
| El 25 % de los titulares de 2025 no se sostuvo (24 reemplazadas, 19 a reserva, 8 reagendadas de 170), y se cae en las facultades **pequeñas**: Artes Escénicas 4 de 7, Gestión 3 de 6, Educación 2 de 4, Gastronomía 1 de 2 | `infallible-mayer-024785-cb` | Son las mismas que la simulación dice que no llegan a su cuota. La holgura ahí no es refinamiento: es condición para que la facultad exista en el resultado. **Insumo de la decisión de afijación** |
| `aplicada` es canónico para `operational_status` y NO existe para `sample_status`; las seis palabras reales caen a `sin_contactar` | idem, `monitoreo_aulas_estados_no_reconocidos.R` | Una reserva marcada «aplicada» se cuenta como reserva **libre** y la cola de contacto la vuelve a llamar. No tocar `sample_status` sin avisarles |

## El 165 contra 174, resuelto

No era una cifra desfasada: **es el otro escenario**. `cmp-cine0qk8`
(universidad) tiene cero fijaciones y `aulas_base_total = 165`;
`cmp-cine0qk8-fac` (facultad) tiene las **15 `aulas_base_fijas` que suman 174**.
La app abre en `P1 · Universidad` y el sorteo real se hizo con `P2 · Facultades`.
Cualquier superficie que lea `currentAulasTarget` sin fijar el escenario dirá
165 con datos vigentes.

## Lo aprendido en los que aún no se tocan

- **4a**: el mecanismo existe entero (`estratosConAulaExtra`, `estratosConAjusteAula`,
  `fijasPendientes`) y el stepper ±1 está en `CertificacionFacultadCard.tsx:252-261`.
  **La causa** de que no se pueda usar es la línea 130: `if (!certificacion) return null`.
  Sin certificación corrida no hay forma de subir aulas desde la pantalla. En
  `AulasObjetivoTab.tsx:87-95` el número se muestra pero es de sólo lectura.
- **5**: `alumnos_por_ch_decision.estadistico = p25` sí está registrado y confirmado
  por el usuario. El P25 coincide exacto en las 15 facultades; la media difiere
  hasta 12 puntos (EGC 52,9 real contra 46,5 declarado).
- **6**: de 50 sorteos sólo **25** cerraban las 30 celdas; cobertura mínima mediana
  **0,998**; la elegida fue semilla **202** con cobertura mínima **1,079**.

## Trampas que costaron un ciclo

- **Un objeto compartido arrastra decisiones que no son suyas.** El marco se
  reparte a los dos componentes por diseño, pero `aulas_base_fijas` viajaba
  dentro y el componente de facultad llegaba sin las suyas. Escribir de vuelta
  las borraba: un clic pasó de **15 fijaciones que suman 174** a **1 que suma 9**.
  Reparado en `a3b8918b`. El tell fue mirar el estado real cuando la pantalla
  decía cero fijaciones y la API decía quince.
- **Declarar una pestaña en el catálogo no la hace visible.** El strip la consume
  desestructurando por posición y descarta el resto en silencio. Cerrado con test
  de paridad en `universidadTabs.test.ts`, para las cuatro secciones.
- **Tres contadores separados** cuentan las pestañas: `catalogos.test.ts`,
  `manifiesto.test.ts` y `modulesNavigation.test.ts`. Los tres suben juntos.
- **Vitest da rojos falsos con el dev server arriba**: tres contratos que leen
  disco se pasan de los 5 s. Corridos solos, verdes.
- **Un `state.rds` extraído es una foto y el `.pulso` sigue vivo.** Comparar
  timestamps antes de medir.
