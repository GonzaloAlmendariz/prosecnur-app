# Checklist: las bases hijas siguen "Familia por base" (2026-11-10)

Tipo: Checklist de pedido con varias indicaciones
Estado: En curso
Fecha: 2026-11-10
Autoridad: contrato del `revisor-metodologico` del 2026-11-10 (aprobado con supuestos); las decisiones del dueño están sin confirmar

Situación: en pausa desde el 2026-11-10. Gonzalo respondió las preguntas de este cambio y después dijo que no las había entendido, así que ninguna respuesta cuenta como decisión. No se cambió el motor. El comportamiento vigente es el de `main` antes de la fusión: la hija repeat hereda la familia de su madre y no pasa por "Familia por base". Para retomar hay que explicarle el caso con un ejemplo de un estudio real antes de preguntar nada.

Origen: al fusionar la rama de Gráficos con `main` se juntaron dos cambios del motor de diferencias. La rama traía "Familia por base" ([ADR 0128](../adrs/0128-una-regla-de-diferencias-por-estudio.md)) y `main` traía que una base hija repeat hereda la familia de su madre (§4 ter del mismo ADR). La fusión dejó a la hija por el camino de `main`, sin la regla del informe ni el plan filtrado por base.

## Ítems

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| H1 | En un estudio de varias bases, la hija y la madre se prueban con la regla del informe (`.sig_regla_informe`), pasada por `.sig_regla_de_base` para cada una. Con una sola base, todo queda bit a bit como hoy | `api/R/reporte_cruces_grano.R`, `api/R/graficos_significancia_jobs.R` | ☐ |
| H2 | Toda combinación que venga del plan pasa por `.sig_plan_de_base`: con la base madre para la familia de la madre y con la hija para la de la hija. Una ranura de otra base o de base ambigua no cuenta en ninguna de las dos, y el aviso sigue saliendo una vez | `api/R/reporte_cruces_grano.R` | ☐ |
| H3 | La familia de la madre que usa la hija es exactamente la que el job arma para la madre como base activa. `ctx$familias[[madre]]` es esa misma, y `ctx$madre` lleva `base_familia` en multibase para que la nota nombre la base correcta | `api/R/reporte_cruces_grano.R`, `api/R/graficos_significancia_familia_bases.R` | ☐ |
| H4 | Hija cuya madre no trae el conglomerado: las variables propias siguen con el contraste por persona con Bonferroni por fila y no entran en la familia. La madre va como muestreo aleatorio simple, con su nota (propuesta del revisor; sin confirmar por el dueño) | motor y `api/R/cruces_significancia.R` | ☐ |
| H5 | Una tabla de la hija que cruza una variable heredada con una variable propia entra en la familia de la hija, a grano de registro, como comparación propia (sin confirmar por el dueño) | `api/R/reporte_cruces_grano.R` | ☐ |
| H6 | Una lámina que grafica sobre la hija una variable heredada se calcula sobre la madre, con su regla y su familia, y sale igual que desde la madre (sin confirmar por el dueño) | motor de Gráficos, por ubicar | ☐ Fase 2: es un cambio del render, con su propio test |
| H7 | El camino de la hija es una sola función que llaman el export, el inspector (`router_graficos_diferencias.R`) y las familias de otras bases | `api/R/` | ☐ |
| H8 | Hija exportada sin su madre: la familia usa la misma base deduplicada que la tabla (`.cruces_grano_madre_deduplicada`) | `api/R/reporte_cruces_grano.R` | ☐ |
| H9 | Tests que llevan una hija por `.sig_informe_preparar`: casos A, C y D de abajo y los casos límite | `api/tests/testthat/` | ◐ Escritos y en rojo contra el motor actual (16 tests, 34 expectativas fallidas, 1 skip). El archivo está fuera del árbol de tests, en la carpeta temporal del repo (`hija-repeat-familia-por-base/`), para que no ponga en rojo las corridas de otras sesiones mientras el cambio esté en pausa |
| H10 | El §4 ter del ADR 0128 dice la decisión y deja de remitir a "decisión aparte" | `docs/adrs/0128-una-regla-de-diferencias-por-estudio.md` | ☐ |

## Valores esperados

Fixture de `api/tests/testthat/test-reporte-cruces-grano-repeat.R`. Analítica en A y C: `cruces_vars = area`, secciones `ciclo` y `nivel_resp`, sin plan. Medidos por el revisor con una sonda que arma el contrato con las funciones existentes.

| Caso | Madre | Hija | Otros |
|---|---|---|---|
| A. Normal: Rao-Scott por aula, columna presente | m = 1, p = 1.256e-08, sin atributo | m = 2, p = {1.256e-08, 1.59e-06}, q = {2.512e-08, 1.59e-06} | `base_familia = "hija"`; no cambia respecto de hoy |
| C. El conglomerado solo existe en una tercera base | m = 1, p = 1.359e-14, atributo `mas_sin_conglomerado = "madre"` | m = 1 (H4: las propias no entran) | `ctx$madre` igual a la madre por el job; la tabla heredada lleva letras y la nota de muestreo aleatorio simple |
| D. Plan con una ranura `otra$ciclo` por `area` y una pelada; Analítica vacía | m = 0 | m = 1, p = 1.59e-06 | `familias` sin `otra`; aviso `E_SIG_BASE_AMBIGUA` para la lámina |

Estado medido antes del cambio (2026-11-10): caso C da m hija = 0 y m madre = 0, sin atributo; caso D da m hija = 2 y la familia de la madre pasa de 0 a 1.

## Casos límite que el test debe cubrir

1. Hija sola en las fuentes con la madre adjunta: sin `base_familia`; m = 2 y madre m = 1.
2. Hija sin madre: la familia usa la deduplicada, no el grano de registro.
3. Familia vacía (m = 0): sin error.
4. Sin regla guardada: la propuesta sale de todas las bases y no depende de su orden.
5. Corrección `bonferroni_fila`: familia nula, m = 0 y `madre` presente.
6. Un grupo del cruce sin registros en la hija: no aporta p y la heredada conserva su n.
7. La madre exportada no cambia sus letras por existir la hija.
8. Una hija sin variables propias tiene `m_hija == m_madre`, y ningún p de registro de una heredada está en la familia.

## Preguntas que quedaron sin decidir

1. Hija cuya madre no trae el conglomerado: cómo se prueban sus variables propias (contraste por persona como hoy, la persona como conglomerado, o muestreo simple de registros).
2. Una tabla de la hija que cruza una variable heredada con una propia: entra en la familia de la hija o sale sin letras.
3. Una lámina que grafica sobre la hija una variable heredada: se calcula sobre la madre o no se marca.
4. En una tabla heredada que queda a grano de registro, si la comparación con el cruce heredado cuenta una vez o dos en la familia.

## Lo que se sabe (no reinvestigar)

- La hija trae la columna de conglomerado solo si la madre la trae (`analitica_repeats_grano.R`, `analitica_repeats.R`): las dos la tienen o ninguna.
- Hoy la hija toma la regla de su propia base y la madre la suya, sin pasar por `.sig_regla_informe`. En el caso C la regla queda sin el atributo y `.sig_diseno_invalido` anula toda evaluación.
- Hoy la familia de la madre se arma con el plan entero y `.sig_var_local` le quita el prefijo de base, de modo que una ranura `otra$ciclo` se prueba sobre la madre y cuenta.
- `.sig_contexto_con_familias` calcularía `familias[[madre]]` con la hija como activa y sin Analítica, distinta de `ctx$madre$familia`: por eso H3 la fija.
- Riesgo que evita H4: probar la hija sin conglomerado como muestreo simple de registros ignora que varios registros son de la misma persona y subestima la varianza.
