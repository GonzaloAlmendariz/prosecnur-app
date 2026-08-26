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
