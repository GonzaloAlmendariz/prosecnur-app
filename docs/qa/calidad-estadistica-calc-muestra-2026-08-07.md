# Calidad estadística del Cálculo de muestra (aulas) — problema y reparación

- **Fecha**: 2026-08-07
- **Origen**: auditoría metodológica de tres lentes (metodología, backend, frontend+ADRs) sobre el feature completo. Veredicto de partida: **APTO CON OBSERVACIONES** — el diseño por defecto es defendible; los defectos viven en configuraciones no-default y en la referencia histórica de asistencia.
- **Alcance de este documento**: solo el eje estadístico. Cada sección explica *qué estaba mal*, *por qué importa* (con el ejemplo más simple posible), *qué se cambió* y *cómo se verifica ahora*.

---

## La idea que une los cuatro defectos mayores

En un muestreo probabilístico, cada aula tiene una **probabilidad de inclusión** (π): la chance de salir sorteada. Esa π no es decorativa — es la base del **peso analítico** (`peso = 1/π`) con el que después se estima cualquier cifra del estudio. La regla de oro es una sola:

> **La π que se publica debe ser la π del mecanismo que realmente sorteó.**

Si el motor sortea de una manera pero declara la π de otra, los pesos quedan sesgados y ninguna advertencia lo delata: la salida *parece* correcta, tiene columnas de probabilidad y pesos con seis decimales, pero describe un sorteo que no ocurrió. Tres de los cuatro defectos mayores eran exactamente eso, cada uno por una vía distinta. El cuarto era una tasa que mezcla universos (numerador con gente que el denominador no cuenta) y por eso puede superar el 100 %.

**Importante**: la configuración por defecto de la app (motor `cube_balanceado` + π prescritas + descuento post-hoc) **no estaba afectada**. Los defectos se activaban al elegir motores alternativos o el descuento secuencial en-sorteo.

---

## Defecto 1 — `estratificado_aleatorio` publicaba la π de otro motor

### Qué estaba mal

El motor `estratificado_aleatorio` sortea aulas **al azar simple** dentro de cada estrato: todas tienen la misma chance (`sample()` uniforme, `calc_muestra_aulas.R`). Pero la función que publica las probabilidades (`.cm_aulas_design_probabilities`) calculaba π **proporcional al tamaño del aula** (PPS sobre la medida de tamaño winsorizada) para *todos* los motores, sin distinguir cuál sorteó.

### Por qué importa — el ejemplo mínimo

Un estrato con 2 aulas: A tiene 80 elegibles, B tiene 20. Se sortea 1 aula al azar simple.

- **π real**: A = 50 %, B = 50 % (el sorteo es uniforme).
- **π publicada**: A = 80 %, B = 20 % (proporcional al tamaño).
- **Pesos resultantes**: A pesaba 1/0.80 = 1.25 cuando debía pesar 2.0; B pesaba 5.0 cuando debía pesar 2.0.

Toda estimación ponderada con esos pesos **sobrerrepresenta sistemáticamente a las aulas chicas y subrepresenta a las grandes**, sin que ningún número de la salida lo delate.

### Qué se cambió

`.cm_aulas_design_probabilities` ahora recibe el motor y **distingue**: para `estratificado_aleatorio` publica `π = min(1, cuota_h/N_h)` uniforme por estrato — la π del sorteo que de verdad corre. La pik que devuelve el propio sorteo (`.cm_aulas_pick_indices`) usa la misma fórmula, así que declaración y mecanismo son la misma cosa. Los casos borde quedaron revisados: cuota ≥ N publica π = 1 (certeza), estrato de 1 aula publica π = 1, estrato excluido publica π = 0.

### Cómo se verifica ahora

`test-calc-muestra-aulas-pi-empirica.R`: sortea 1.500 veces con semillas distintas y compara la **frecuencia empírica de inclusión** contra la π publicada (tolerancia 4·SE). Antes del fix, el desvío llegaba a 0.50 (π publicada 0.874 para un aula que salía el 37,5 % de las veces); ahora la frecuencia reproduce la π. El test incluye un control positivo (`sistematico_pps`, que siempre estuvo bien) que valida que el arnés mide de verdad.

---

## Defecto 2 — el cube no fijaba el tamaño y lo arreglaba en silencio

### Qué estaba mal

Dos cosas encadenadas:

1. El muestreo balanceado (`sampling::samplecube`) garantiza un tamaño de muestra fijo **solo si la propia π es una de las variables de balance**. La matriz de balance del motor (`.cm_aulas_balance_matrix`) incluía intercepto y variables del marco, pero **no incluía π** — así que el cube podía devolver 18 o 22 aulas cuando la cuota era 20.
2. Cuando eso pasaba, `.cm_aulas_fix_pick_count` **agregaba o quitaba aulas por sorteo ponderado, sin dejar rastro**: ni warning, ni metadata. La selección final ya no era la del cube, y las π declaradas dejaban de corresponder al mecanismo compuesto (cube + parche).

### Por qué importa

Es la versión silenciosa del defecto 1: el parche final redistribuye probabilidad entre aulas de una forma que nadie declaró. En marcos donde el cube erraba el tamaño con frecuencia, la π realizada podía desviarse de la prescrita de forma sistemática — y el usuario defendía ante un comité un diseño balanceado que en realidad terminaba en un sorteo mixto no documentado.

### Qué se cambió

Dos movimientos:

1. **π entra a la matriz de balance** como primera columna (`.cm_aulas_balance_matrix` acepta `pik`; `pick_cube` y `pick_local` la pasan). Es la forma canónica de Deville–Tillé: balancear sobre π hace que el cube entregue (casi siempre) exactamente la cuota pedida.
2. **Ningún ajuste es silencioso**: cuando el parche de tamaño (`.cm_aulas_fix_pick_count`) todavía tiene que actuar, devuelve cuántas aulas agregó/quitó y la selección lo divulga como warning metodológico + metadata `size_adjustment` que viaja con el resultado. Además el recorte ya no puede quitar **unidades de certeza** (π = 1) salvo último recurso con warning.

Consecuencia deliberada: el golden del cube (`simulacion.rds`) se regeneró — con π en el balance el sorteo es otro, y es el correcto.

### Cómo se verifica ahora

`test-calc-muestra-aulas-pi-empirica.R`: antes del fix, el 28 % de los sorteos crudos del cube no calzaba la cuota y el 100 % de esos ajustes era silencioso. Ahora el test exige descalce crudo ≤ 5 % y **cero ajustes sin divulgar**, más la sanidad empírica de las π.

---

## Defecto 3 — el descuento secuencial cambiaba el sorteo pero no la π

### Qué estaba mal

El **descuento secuencial de repetidos** (pedido metodológico real: no contar dos veces al estudiante que ya cayó en un aula anterior) convierte el sorteo en un proceso *sucesivo*: después de cada aula seleccionada, los elegibles "netos" de las restantes se recalculan y la medida de tamaño cambia (`.cm_descuento_pick_indices`). Ese es el mecanismo real.

Pero las π publicadas (`pi_design`/`pi_final`) seguían saliendo del **diseño estático** — el marco original, sin descuento — con `probability_source = "prescribed_design"`. El Monte Carlo que habría estimado la π verdadera del proceso sucesivo (`mc_prescribed_transparency`) nacía apagado.

### Por qué importa — el ejemplo mínimo

Un aula grande cuyos alumnos ya quedaron cubiertos por aulas previas **pesa como chica en los sorteos siguientes** (su neto es bajo) → su chance real de salir es menor que la del diseño estático. Publicar la π estática la hace ver *más probable* de lo que fue → su peso 1/π queda *más chico* de lo que corresponde → las estimaciones subponderan justo a las aulas con más traslape. El sesgo crece con el traslape del marco, que en universidades es grande (1.55 aulas por alumno en PUCP 2025).

### Qué se cambió

Cuando el descuento secuencial muerde **en el sorteo** (modo sequential con motor secuencial), la π ya no es calculable en fórmula cerrada — así que se **estima** con el Monte Carlo de transparencia, que ahora se enciende por defecto en esa configuración. El MC simula el proceso completo real (mismas olas, mismo flag de descuento, semillas independientes — verificado por revisión), y la selección publica:

- `probability_source = "monte_carlo_sequential_discount"` (antes decía `prescribed_design`, que era falso),
- `pi_final = pi_mc` con el rescate a π de diseño divulgado cuando el conteo MC es 0,
- el presupuesto por escala existente (menos corridas = más varianza, **nunca sesgo**, con el SE de las corridas ejecutadas divulgado).

La **comparación de métodos**, que no corre MC por costo, dejó de fingir: cuando su sorteo aplicó descuento, publica `probability_source = "prescribed_design_reference"` con la advertencia de que sus π son referenciales del diseño estático.

El default de la app (cube + descuento post-hoc) no cambió: ahí el descuento no altera el sorteo y las π prescritas siguen siendo exactas.

### Cómo se verifica ahora

`test-calc-muestra-aulas-descuento-pi.R`: contrato completo (source, mc_runs > 0, pi_mc finita, rescate divulgado) más una propiedad estadística direccional: en un marco con traslape fuerte, `pi_mc` del aula grande solapada queda **por debajo** de su π de diseño estático — exactamente el sesgo que antes quedaba oculto en los pesos.

---

## Defecto 4 — la tasa de asistencia prohibida seguía publicada (ADR 0060)

### Qué estaba mal

El ADR 0060 prohíbe expresamente la tasa `asistentes / elegibles`: pone en el numerador a **todos** los presentes (elegibles o no) y en el denominador **solo a los elegibles**. Mezcla universos y produce valores imposibles — en la base PUCP 2025 supera el 100 % en 31 de 194 aulas, con un máximo de 230 % (`HUM113-0238`: 10 elegibles, 23 presentes).

Pese a la prohibición:

- La **serie semanal** de la referencia histórica seguía publicando `asistencia = asistentes/elegibles` (`calc_muestra_asistencia_referencia.R:647`).
- El **tramo "asistencia" de la cadena** usaba el numerador crudo `asistentes` sobre `elegibles` cuando la base trae glosario (`:1737-1739`).
- `pct_ya_medidas` se calculaba sobre `asistentes` (todos los presentes) cuando el ADR la define sobre `asistentes_elegibles` — denominador inflado, tasa subestimada (`:648`, `:1553`).
- Y el **frontend legalizaba el defecto**: el normalizador aceptaba tasas > 1 si el backend adjuntaba una advertencia (`calcMuestra.ts:2950-2952`), cuando el ADR exige que un valor > 1 se trate como defecto de fórmula, no como dato.

### Por qué importa

La pestaña Histórico existe para **transferir tasas de un estudio pasado como anclas del diseño nuevo** (tasa de asistencia → cuántas aulas necesito). Un ancla inflada por mezcla de universos dimensiona mal el operativo siguiente: si la "asistencia" dice 110 % donde la asistencia de elegibles real era 65 %, el estudio nuevo sale a campo con menos aulas de las que necesita. Las fórmulas sancionadas por el ADR están acotadas a 1 **por construcción**:

```
asistencia_elegibles = asistentes_elegibles / elegibles     (≤ 1 siempre)
pct_ya_medidas       = ya_medidas / asistentes_elegibles
```

y cuando `asistentes_elegibles` no fue observado en campo, no se publica un valor puntual sino el intervalo `[min, max]` (cota inferior: efectivas confirmadas; superior: `min(asistentes − no_elegibles_detectados, elegibles)`).

### Qué se cambió

El saneamiento cubre **todos los paths** y las **tres capas**:

**Backend (R)** — `calc_muestra_asistencia_referencia.R`:
- La serie semanal, la cadena, el global, las celdas por dimensión y el embudo por facultad usan el numerador sancionado `asistentes_elegibles = min(max(0, asistentes − no_elegibles), elegibles)` — capado a elegibles como exige la identidad del ADR.
- **Ninguna tasa imposible se publica**: valor fuera de [0,1] → `tasa = NA` + marca `residual_negativo = TRUE`, conservando numerador y denominador para diagnóstico (guarda centralizada `.cm_asist_tasa_imposible`). Cubre también `pct_ausencia` (antes podía salir negativa), `efectividad` y `pct_ya_medidas` del embudo.
- `pct_ya_medidas` divide entre `asistentes_elegibles`, no entre todos los presentes.
- El **intervalo del ADR** se publica aditivamente: `asistencia_elegibles_min` (efectivas confirmadas / elegibles) y `asistencia_elegibles_max` (cota superior / elegibles). El campo `asistencia` queda en la cota superior, comentado como cota y no como observación — porque el `no_elegibles` de una base puede ser solo "los detectados".

**Frontend (TS)** — `calcMuestra.ts`:
- El normalizador es **fail-closed**: cualquier tasa > 1 invalida el tramo, con o sin advertencia del backend (antes una advertencia la "legalizaba").
- Acepta la forma sancionada del backend (tasa NA + conteos + marca `residual_negativo`) y **solo** esa: sin marca sigue rechazando, marca con tasa poblada rechaza, marca ilegible rechaza.
- El cruce global↔cadena distingue el glosario: con glosario el numerador capado puede ser menor que el crudo del global (nunca mayor).

**Persistencia (.pulso)** — `project_pulso.R`:
- Los campos nuevos entraron a las whitelists (sobreviven guardar/abrir).
- **Migración en carga**: un `.pulso` guardado con el contrato viejo (tasas > 1 persistidas) se sanea al abrir (tasa → NA + marca, conteos intactos, idempotente), cumpliendo el punto 11 del ADR («un .pulso v1 abre sin pérdida») — sin esto, el fail-closed del frontend habría dejado el Histórico vacío en proyectos antiguos.

### Cómo se verifica ahora

`test-calc-muestra-asistencia-adr0060.R` (fixture con el caso HUM113-0238 del ADR: 10 elegibles, 23 presentes), las suites ampliadas de referencia/fuente, los tests de migración en `test-project-pulso-asistencia.R`, y el arnés vitest que acepta el tramo residual legítimo y rechaza todo lo demás.

---

## Defectos menores reparados en el mismo lote

| # | Qué estaba mal | Por qué importa | Qué se cambió |
|---|---|---|---|
| M1 | Existían **dos copias de la fórmula del tamaño de muestra**: la canónica con `ceiling()` y una territorial con `round()` (`calc_muestra_engine.R`) | `round()` puede entregar un n que incumple el margen de error declarado por 1 caso; y dos fuentes de la misma fórmula derivan | La territorial ahora delega en `calc_n_muestra` (una sola fuente, `ceiling`). El caso N=25.000, e=5 % pasó de n=378 (bajo el margen) a n=379. Test: `test-calc-muestra-formula-unica.R` |
| M2 | Un aula con **0 elegibles recibía medida de tamaño 1** (`eligible[eligible <= 0] <- 1`) y por tanto π > 0: podía salir sorteada un aula donde no hay a quién encuestar | Desperdicia cuota y contamina las π del resto del estrato | MOS 0 para aulas sin elegibles (π = 0 salvo que la cuota exceda las aulas con elegibles, caso en que el fallback uniforme se publica honesto). Test en `test-calc-muestra-formula-unica.R` |
| M3 | Los gates de composición c7/c8/c8_facultad **dejan pasar los cursos-horario sin dato** (`is.na(x) \| x >= umbral`) sin declararlo en ninguna parte | Es un supuesto permisivo razonable, pero invisible: el usuario no sabía cuántas aulas entraron al marco sin que el criterio pudiera evaluarse | Cada gate publica `composicion_na_n` — cuántos cursos-horario lo pasaron por NA (grano verificado: los que *pasaron*, no todos los NA; sin señal publica NA, porque desconocido ≠ cero). Tipado en el frontend; superficie de UI pendiente |

---

## Lo que NO cambió (y el usuario debe seguir conociendo)

Estos son supuestos declarados del diseño, no defectos. Se listan porque el investigador debe poder citarlos:

1. **deff es un insumo del usuario, nunca se estima del marco** (default 1.5; canónico PUCP 2.0). El motor no contrasta el deff asumido contra los datos.
2. **tau (tasa de asistencia asumida) default 0.7** si no se transfiere una referencia histórica; con Histórico, se descompone en eslabones con IC bootstrap.
3. **Winsorización p90 de la medida de tamaño**: las aulas gigantes reciben π menor que el PPS puro — varianza a cambio de sesgo controlado, estándar en la práctica.
4. **Piso de 1 aula por estrato**: sobrerrepresenta estratos chicos en unidades; la π lo compensa en los pesos.
5. **`pi_student` asume independencia entre aulas** y `weight_student` es un agregado por aula, no un peso individual — ambos rotulados en la salida.
6. **p = 0.5** (varianza máxima) como default del cálculo de n.

## Gobernanza

- **ADR 0066** («La probabilidad publicada es la del sorteo ejecutado») nace con esta reparación: es el contrato normativo de las π de selección que antes no existía.
- **ADR 0060** pasa de «no iniciada» a **parcial**, con el detalle de qué puntos de Cumplimiento cubre este lote (4, 5, 11) y cuáles siguen pendientes (guard 9 de vocabulario, punto 10 de `poblacion`, catálogo de filtros de corte declarado).

## Pendientes declarados (no cubiertos por este lote, anotados a propósito)

1. El test direccional del MC secuencial mide con `sistematico_pps`; falta la misma medición con `estratificado_aleatorio`.
2. El normalizador TS parsea `serie_campo`/embudos sin guardas de rango (acepta cualquier finito); si algún día se endurece, hay que espejar los casos de migración.
3. `media_ch` de una celda desbordada puede publicar > 1 (no es probabilidad declarada; nadie la congela aún).
4. Caso borde irrepresentable en el cliente: IC bootstrap con cota > 1 mientras la tasa agregada es ≤ 1 (solo con filas sucias que no desbordan el agregado).
5. UI para `residual_negativo`, `composicion_na_n` y el intervalo `asistencia_elegibles_min/max`: los datos ya viajan tipados, la superficie que los muestra es trabajo del loop de frontend.
6. El supuesto de que `no_elegibles` de una base es un conteo exhaustivo (y no solo «los detectados») queda comentado en el código; cuando el screening fue parcial, `asistencia` es cota superior con sesgo al alza no detectable — el propio ADR 0060 lo documenta para la base 2025.

## Gate de verificación (2026-08-07)

Veredicto del verificador independiente: **APTO**.

```
R (locale en_US.UTF-8, testthat::test_file por archivo): 21/21 archivos OK
  2510 PASS / 0 FAIL / 0 WARN / 0 SKIP
  contrato: pi-empirica 137 · descuento-pi 20 · asistencia-adr0060 73 · formula-unica 15
  núcleo: aulas (goldens) 128 · aulas-descuento 70 · mc-prescrito 21 · mc-budget 43 ·
  costo-sync 26 · asistencia-referencia 1007 · asistencia-fuente 23 · asistencia-criterios 89 ·
  aulas-criterios 92 · engine 124 · perfil 117 · distribucion 185 · project-pulso 194 ·
  project-pulso-asistencia 63 · workspace-whitelist 42 · http-contract-asistencia 35 · errors-registry 6
vitest (src/features/calcMuestra + src/api): 146 files / 1354 tests passed, exit 0
tsc --noEmit: exit 0 (directo, sin pipe)
agentic OS --audit: exit 0, ningún archivo congelado creció
git status: 16 modificados + 7 untracked, todos dentro de la unidad
```

El proceso completo fue: auditoría de 3 lentes → contrato congelado (D1–D7) → tests rojos que demuestran cada defecto → implementación (2 writers) → revisión metodológica (APTO CON OBSERVACIONES) + revisión de contratos (NO APTO con 3 bloqueos) → ronda de reparación → cobertura faltante → gate APTO.
