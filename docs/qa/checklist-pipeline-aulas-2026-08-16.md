# Checklist — el pipeline de aulas de punta a punta (2026-08-16)

**Pedido de Gonzalo**: recorrer el pipeline *etapa por etapa* para estar seguros
de que ya se pueden generar todas las aulas y los reemplazos de cada titular sin
problemas. Empezar desde la base y subir; en cada etapa, comprobar que
**efectivamente funciona**, no que existe.

**Cuándo**: al cerrar M17 del loop de mejora continua.

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
| E9 | **Selección de aulas** | Cumple las requeridas por facultad de E8, facultad por facultad | `calc_muestra_aulas.R` selector | ☐ |
| E10 | **Titulares y sus reemplazos** | Cada titular tiene su cadena **completa**; ninguno se queda sin ella | selección + `chain_reserve` | ☐ |

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
