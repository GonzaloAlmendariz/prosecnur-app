# Seguimiento de τ en campo — diseño de la superficie

Tipo: Diseño de superficie y checklist
Estado: Vigente
Fecha: 2026-08-26
Autoridad: Diseño confirmado por Gonzalo el 2026-08-26; la decisión la gobierna el ADR 0082 y este documento no lo reemplaza

Gobierna: [ADR 0082](../adrs/0082-la-tau-del-diseno-es-un-supuesto-fechado-y-el-campo-lo-contrasta.md).
Estudio de referencia: HSVG2026.

## La pregunta que la superficie contesta

> ¿El campo está rindiendo la τ con la que se compró el aforo, y si no, en qué
> facultad y con cuántas reservas se cierra?

No es «qué facultad rinde más» —eso ya lo contesta la pestaña Rendimiento, y es
un ranking para decidir a dónde mandar gente mañana—. Es si el **supuesto que
dimensionó la muestra** se está cumpliendo, que es una pregunta del diseño
contra el campo y de la misma familia que `avance_cuota` (ADR 0079).

## Dónde vive: `Monitoreo > Avance > Efectividad`

Pestaña propia, confirmada por Gonzalo el 2026-08-26.

Descartado Validación: τ no es un control de calidad del dato. Validación
responde «¿esta aula está bien aplicada?»; esto responde «¿el estudio cierra su
cuota?».

Descartado apilarlo bajo Rendimiento: las dos superficies miden efectivas sobre
elegibles y ahí se acaba el parecido. Rendimiento ordena facultades por lo que
deja cada visita —un ranking para repartir gente mañana, con el numerador del
**parte**— y Efectividad contrasta la τ que dimensionó contra la que rinde el
campo, con el numerador de **plataforma**. Vecinas y sin nada que las separe, el
lector no tiene forma de saber cuál está leyendo. El rail las distingue por el
detalle («Qué rinde más, por facultad» contra «La τ del diseño contra la del
campo»), porque los rótulos cortos son sinónimos en castellano.

## Qué se dibuja

### 1. Encabezado del estudio — el supuesto, declarado
Una línea, no una tarjeta: **τ agregada prevista 0,53 · observada 0,51 (banda
0,48–0,54) sobre 68 de 196 aulas aplicadas · respaldo: campo 2025**. Con el
sello de procedencia visible: si la τ viene de `calibracion_embebida` o
`tau_global` en vez del histórico del estudio, lo dice ahí.

### 2. La tabla de decisión — una fila por facultad
Es la superficie principal. Quince filas, ordenadas por déficit proyectado
descendente (la que más riesgo tiene, arriba):

| Columna | Qué es | De dónde sale |
|---|---|---|
| Facultad | | `design_targets.facultades[].facultad` |
| τ prevista | El supuesto de esa facultad | `design_targets...tau` |
| — mix / residual | Los dos factores, en tooltip | `calc_muestra_aulas_tasas_facultad()` |
| τ observada | Efectivas de plataforma / elegibles de aulas aplicadas | bloque nuevo |
| Banda | Intervalo de la observada | bloque nuevo |
| k | Aulas aplicadas que la sostienen | bloque nuevo |
| Alumnos ± | Déficit/superávit acumulado al corte, en alumnos | `(τ_obs − τ_prev) × elegibles_aplicados` |
| Proyección al cierre | Déficit si lo que falta rinde como lo aplicado | `+ (τ_obs − τ_prev) × elegibles_pendientes` |
| Reservas | Libres en las cadenas de esa facultad | `colchonPorFacultad` / `consumoDeCadena` |
| Cierran | Cuántas reservas cubren el déficit proyectado | mismo cálculo que `alcanceDelBanco`, por facultad |

**Se señala una facultad cuando su banda excluye la τ prevista** — nunca cuando
sólo el punto la cruza. Las nueve facultades con residual 1,000 llevan marca de
«el histórico no le dio base propia», para que ese 1,000 no se lea como medido.

### 3. La serie — día y semana
- **Diaria, del estudio**: τ observada acumulada contra la τ prevista ponderada
  por los elegibles ya aplicados. Acumulada y no diaria porque la τ de un día
  es el promedio de una o dos aulas y salta sin significar nada.
- **Semanal, por facultad**: una tabla compacta —semana × facultad, celda con
  la τ de esa semana y su k—. Quince series diarias superpuestas no se leen.
- **`serieDeRendimiento.ts` gana una tercera línea de referencia**: hoy dibuja
  observado y esperado bayesiano (media encogida del propio estudio), y le
  falta el esperado **del diseño**, que es contra el que se compró el aforo.

## Contrato de backend

Bloque nuevo `monitoreo_aulas_efectividad_seguimiento_v1` en el dashboard,
motor en **archivo propio** `api/R/monitoreo_aulas_efectividad_seguimiento.R`
(`monitoreo_aulas_universitarias.R` ya pesa 118 KB y no crece).

`avance_cuota` gana `tau_prevista` **por fila de facultad**: hoy sólo publica la
τ compartida y la deja en `NA` justo cuando difiere por facultad, que es el
caso de HSVG2026.

## Checklist

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| 1 | ADR que registra τ como supuesto declarado, su origen, alcance y qué no cubre | `docs/adrs/0082-*.md` | **Hecho** — aceptado y ratificado el 2026-08-26 |
| 2 | Decidir ubicación de la superficie | `lib/navegacion/catalogos/monitoreo.ts` | **Hecho** — pestaña propia `avance > efectividad` |
| 3 | Fijar el numerador de τ observado como la efectiva de plataforma | ADR 0082 cláusula 3 | **Hecho** — decidido y con test que lo discrimina del parte |
| 4 | Resolver el choque de rótulos: «Del potencial» (parte) vs τ (plataforma) | `rendimientoPorFacultad.ts` | **Pendiente** — fuera del alcance de esta tanda; ver abajo |
| 5 | Motor `monitoreo_aulas_efectividad_seguimiento.R` con τ prevista/observada, banda, k, déficit | `api/R/` | **Hecho** — 49 aserciones |
| 6 | `avance_cuota` publica `tau_prevista` por fila de facultad | `api/R/monitoreo_aulas_avance_cuota.R` | **Hecho** — 120 aserciones sin regresión |
| 7 | Tabla de decisión por facultad con reservas y «cuántas cierran» | `AulasEfectividadSeguimiento.tsx` | **Hecho** — 10 aserciones de render |
| 8 | Marca visible de residual 1,000 = sin base propia (9 de 15 facultades) | motor + fila de la tabla | **Hecho** — `residual_base` en {propia, sin_base, sin_dato} |
| 9 | Serie diaria acumulada del estudio + tabla semanal por facultad | frontend | **Pendiente** — siguiente tanda |
| 10 | Tercera línea (esperado del diseño) en `serieDeRendimiento` | `serieDeRendimiento.ts` | **Pendiente** — siguiente tanda |
| 11 | Tests 1–5 del ADR (contrato, numerador, denominador, banda, no compensación) | `api/tests/testthat/` | **Hecho** |
| 12 | `ui-quick-check` sobre la superficie poblada | QA visual | **Bloqueado** — ver abajo |

### Por qué el 12 está bloqueado y no pendiente

**Ningún proyecto en disco llega poblado a esta superficie.** Se comprobó el
2026-08-26: los cinco proyectos de referencia versionados declaran
`monitoreo: false` en HSVG2026 —el único con el marco de aulas— y los seis
`.pulso` de HSTVG2026 del disco del usuario traen `calc-muestra: ready` con
`monitoreo: pending`, que es el estado real del estudio: **todavía no sale a
campo**. Sembrar la selección en el proyecto anonimizado tampoco vale:
`reference_project_seed_aulas_selection.R` se detiene porque el descuento
secuencial necesita los ids de alumno, que son PII y no viajan en un proyecto
de referencia.

Lo que sí se verificó del render son las diez aserciones de
`AulasEfectividadSeguimiento.test.tsx`, que cubren C1 (declara qué mide antes
de la primera cifra), C3 (sus dos vacíos, distinguibles entre sí) y la regla de
la señal. Lo que queda sin ver en pantalla es la tabla con quince filas reales
y su geometría a 1024×600. **Se desbloquea con el primer corte de campo**, o
antes con una fixture sintética del operativo de aulas, que hoy no existe en el
repo (`ui-quick-check` stubea calc-muestra pero no el dashboard de Monitoreo).

### El ítem 4, dicho y no tocado

El numerador quedó fijado en plataforma, y eso deja dos rótulos que ahora
prometen otro número:

- **«Del potencial»** en `avance > rendimiento` es `effective_surveys /
  eligible_n`: la misma forma que τ, con el numerador del parte.
- **`alcanceDelBanco`** proyecta el banco con `sent_total` al 58,7 %: la misma
  forma, con el numerador de la hoja del equipo.

Ninguno es un defecto nuevo —los dos existían antes de este ADR y nadie los
reportó—, así que se señalan y no se reparan dentro de esta tanda. La opción de
realinear también el banco se ofreció y no fue la elegida: cambiaría una cifra
que el equipo ya viene leyendo.

## E1 — Backtest contra el campo 2025 (2026-08-26)

Se reprodujo el campo 2025 semana a semana contra `.maes_banda_razon()` y
`.maes_senal()`, sobre `calc_muestra_referencia_asistencia$cadenas_reemplazo`
del proyecto real (170 cadenas, **194 escalones aplicados con semana y
elegibles**, 15 facultades, 4 semanas). La τ prevista salió de
`calc_muestra_estudio$componentes[[1]]$aulas_por_estrato[[i]]$tau`.

**La pregunta NO es si converge al final.** La τ de 2026 se ajustó sobre estos
datos, así que la convergencia está garantizada por construcción. Lo que el
backtest mide es el camino: falsas alarmas, ancho de banda y oportunidad.

### Hallazgo 1 — La regla no puede disparar en el escenario que la motivó

La caída de τ que la banda al 95 % detecta es **la semi-amplitud de la banda**
(1,96 × SE), y ésta es la medida:

| Corte | Aulas | Caída detectable (mediana) | Mejor | Peor | Facultades donde −5 % sería detectable |
|---|---|---|---|---|---|
| Tras semana 1 | 86 | 16,3 pp | 5,7 | 26,6 | **0 de 12** |
| Tras semana 2 | 154 | 13,6 pp | 4,7 | 35,5 | **0 de 15** |
| Tras semana 3 | 190 | 12,7 pp | 3,6 | 26,6 | **0 de 15** |

El escenario de estrés que motivó todo esto —τ un 5 % por debajo— vale entre
**2,0 y 4,0 pp** según la facultad. **Ninguna facultad lo detectaría en ningún
corte.** Ni siquiera a nivel de estudio con 190 aulas: detectable 3,2 pp contra
2,6 pp necesarios.

### Hallazgo 2 — La única señal «bajo» del backtest fue falsa

**EE.GG. Ciencias, semana 1**: τ observada 0,332 contra 0,409 prevista, banda
[0,267 – 0,397] → señalada `bajo`. En la semana 2 volvió a `conforme` y ahí se
quedó hasta el final. Es la alarma que se desdice sola, y cayó justo sobre la
facultad de τ más baja — donde equivocarse es más caro.

### Hallazgo 3 — La τ compuesta no reproduce a dos facultades de su propio histórico

Dos señales `sobre` persistieron desde la semana 1 hasta el final, y **no son
ruido**:

| Facultad | τ prevista | τ observada 2025 | Banda | k | Brecha |
|---|---|---|---|---|---|
| Arquitectura y Urbanismo | 0,546 | 0,722 | [0,568 – 0,875] | 7 | **+17,6 pp** |
| Gastronomía, Hotelería y Turismo | 0,682 | 0,924 | [0,888 – 0,961] | 3 | **+24,2 pp** |

Las dos llevan residual 1,000 por `k < 12`. Es la advertencia del ADR con
número: **un 1,000 por falta de base no es «rinde según su mix»**, y aquí el
mix se equivoca por 17 y 24 puntos contra el histórico del que salió.

### Hallazgo 4 — La ventana de reacción se cierra antes que la evidencia llegue

El campo se concentra al principio: **86 · 68 · 36 · 4** aulas por semana. Para
el final de la semana 3 ya se aplicó el **98 %** (190 de 194). Con
`DIAS_DE_ANTICIPACION = 7`, una señal en la semana 2 llega con una semana útil
de agenda; en la semana 3 ya no queda nada que activar.

### Hallazgo 5 — El 4,1 % de las aulas rinde por encima de 1

8 de 194 tienen `efectivas > elegibles`, máximo **1,29**. Los dos campos no
comparten universo exacto. No invalida el τ agregado (0,5300 global 2025), pero
la pantalla puede llegar a mostrar una τ observada mayor que 1 y eso pide una
explicación que hoy no da.

### Agotamiento por semana, medido aquí

τ no acumulada: **0,5515 · 0,5007 · 0,5632 · 0,3239**. Confirma la no
monotonía ya documentada y que la cola de la semana 4 (4 aulas) es la que
arrastra el promedio.

### Qué exige esto decidir

La cláusula 5 del ADR —«la banda dispara la señal, el punto no»— **cumple bien
su mitad defensiva** (mantuvo callada a 13 de 15 facultades y evitó actuar
sobre ruido) y **falla su mitad ofensiva**: no detecta la caída que importa.
Las opciones medidas, para que Gonzalo decida:

- **(a) Cambiar el estadístico**: del test sobre τ al **consumo del margen** —
  el diseño compró aforo de más (`⌈cuota / (p25 × τ)⌉` más reservas), y la
  pregunta operativa es cuánto de ese margen se lleva gastado, no si τ difiere.
  Es la misma vara que ya usa `alcanceDelBanco`.
- **(b) Una cola al 80 %** en vez de dos al 95 %: z de 1,96 → 0,84 baja la
  detectable de 13,6 a ~5,8 pp de mediana. **No alcanza sola** (hacen falta
  2–4 pp) y sube la falsa alarma que el hallazgo 2 ya mostró.
- **(c) Agrupar por tramo de τ** en vez de por facultad: las de τ baja juntas
  (EGC + EGL) dan k=38 y banda mucho más estrecha. Detecta el fenómeno antes;
  la acción sigue siendo por facultad.
- **(d) Conservar la banda sólo como guarda contra el ruido** —para lo que sí
  funciona— y que el disparador sea (a).

Reproducible con los scripts del scratchpad de la sesión: `bt/backtest.R`,
`bt/poder2.R`.

**Trampa cazada al medir esto**: la primera versión calculó la caída detectable
como «distancia del extremo de la banda a la τ prevista», que es negativa
cuando la facultad conforma, y comparándola contra un umbral positivo dio
«15 de 15 detectarían» — exactamente lo contrario de la verdad. La banda se
centra en lo OBSERVADO: la caída detectable es su semi-amplitud.

## Lo aprendido que no hay que reinvestigar

- La τ del diseño **ya llega** a Monitoreo: `.monitoreo_aulas_metas_diseno()`
  la deja en `cfg$design_targets$facultades[[i]]$tau` desde H3. No hay que
  construir el puente, hay que consumirlo.
- `avance_cuota.tasa_esperada` es `NA` en HSVG2026 **por diseño**: el motor se
  niega a promediar quince τ distintas. La τ por fila hay que añadirla, no
  desbloquear la compartida.
- Las tres tasas homónimas (parte / hoja / plataforma) están medidas y
  localizadas en el ADR. `alcanceDelBanco` proyecta el banco con `sent_total`
  al 58,7 %: si el ítem 3 se cierra en «plataforma», esa proyección queda
  midiendo otra cosa que la τ y hay que decidir si se alinea o se rotula.
- El corte `k ≥ 12` y el prior de cinco aulas ya son decisiones argumentadas
  por escrito. La banda debe reusarlos, no inventar un tercer encogimiento.
