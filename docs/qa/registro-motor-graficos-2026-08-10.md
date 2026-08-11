# Registro del motor de gráficos — errores, pendientes y formato 2021

Tipo: Registro vivo de defectos y pendientes del motor
Estado: En curso
Fecha: 2026-08-10
Autoridad: Consolida el estado medido del motor; no certifica que un ítem esté reparado sin su evidencia

**Corte**: 2026-08-10 · **Rama de origen**: `trabajo/preset-acreditacion-top2box`
**Banco de prueba**: `~/Documents/Pulso/ACRD CONTA/Conta 09-08 equivalencias.pulso`
(4 bases, 67 láminas, 50 gráficos) y `api/inst/reference_projects/acrconta/`.

Documento vivo. Existe porque dos sesiones trabajaron el mismo motor en paralelo
y el estado real quedó repartido entre commits, un doc de validación y dos hilos
de conversación. Aquí se consolida **qué está reparado, qué sigue roto, qué falta
decidir y qué del deck 2021 llega de verdad al usuario**.

Cada ítem lleva un identificador para poder citarlo entre sesiones. Las medidas
salen de renderizar el `.pulso` real contra el `HEAD` del día y medir el PPTX o
el ráster; lo que viene de la otra sesión está marcado como tal.

Complementa —no reemplaza— a
[Validación contra el deck de acreditación 2021](validacion-deck-acreditacion-2021.md),
que mide rasgo a rasgo si el motor reproduce la vara. Ese doc responde *«¿el motor
puede?»*; este responde *«¿le llega al analista?»*.

---

## Estado en una pantalla

| | |
|---|---|
| **Aplicado y verificado** | R-01 a R-10 · E-01, E-02, E-04, E-05, E-06, E-07, E-08, E-09, E-10 · P-01, P-03, P-05 · contrato Word |
| **Diagnosticado, sin aplicar** | **E-11** las etiquetas sobre el segmento vecino |
| **Observaciones nuevas sin clasificar** | O-01 guías ausentes en láminas de solo texto · O-02 el runtime del analista sirve código viejo hasta reiniciar |
| **Decisiones tomadas** | **P-02** dos filas, repartidas parejo (aplicado) · **P-06** el aire vertical se deja como está |
| **Decisiones pendientes** | ninguna |

No queda ninguna decisión pendiente. **E-11** es lo único diagnosticado sin
aplicar, y no por falta de tiempo: resultó no ser un fix mecánico (ver su
diagnóstico). Todo lo demás ya está aplicado y verificado.

---

## 0. El hallazgo que ordena todo lo demás

**El preset de acreditación está medido, implementado, testeado y es inalcanzable.**

`presets_acreditacion()` no tiene ningún llamador de producto: solo lo invoca
`test-graficos-top2box-comparativo.R`. Lo confirma un grep sobre `api/R/` y
`frontend/src/`.

Eso importa porque el preset **ya resuelve** cuatro de los defectos que siguen
apareciendo en el mazo del cliente: excluye `SIN INF` del denominador, fija la
rampa ordinal, apaga la leyenda por lámina y ordena la jerarquía tipográfica. El
analista no puede encenderlo desde la UI, así que cada proyecto los vuelve a
sufrir uno por uno.

Mientras `E-01`, `E-04` y `E-06` se traten como bugs sueltos van a volver. La
reparación de fondo es **`P-01`**: darle un camino de producto al preset.

---

## 1. Errores resueltos

### Verificados en esta sesión

| ID | Defecto | Causa raíz | Commit |
|---|---|---|---|
| **R-01** | Paletas invertidas: el «Sí» salía celeste y el «No» azul marino | `as.character(pal)` borraba los **nombres** en `.reporte_plan_palette_for_levels()`; el match por etiqueta quedaba muerto y **toda** paleta se repartía por posición | `7237c32e` |
| **R-02** | El export moría entero al reabrir el proyecto | El PNG del ícono subido en Gráficos no viajaba en el `.pulso`: `.pulso_collect_input_fids()` recogía iconos del consolidado pero no de `graficos_config` | `7237c32e` |
| **R-03** | «SIN INF» montado sobre «En desacuerdo» al pasar a dos filas | Tres capas: alto de fila plano de 0,24" ciego al cuerpo de letra; reparto de multilista pagando 0,70 planas (una fila) por leyenda; y el cuerpo sin ceder ante la fila que le tocó | `07ad5024` |
| **R-04** | El editor pedía colorear escalas inventadas | El catálogo agrupaba por `list_name`, que en multibase solo es único **dentro** de una base. 22 de 43 listas colisionaban | `86c117ca` |
| **R-09** | Los enunciados del eje salían **fuera** de la lámina, y un tamaño declarado de 14 pt se dibujaba a 9,5 | `ancho_max_eje_y` mide en caracteres y `canvas_w_etiquetas` en fracción del canvas: describen la misma caja y nadie los conciliaba. El wrap desbordado disparaba además el auto-ajuste vertical hasta su piso de 9,6 pt | `c3e54d39` |
| **R-10** | El interruptor de guías de layout no tenía efecto en ningún entregable | Los tres workers de export apagaban `debug_ph_bordes` siempre | `c9cf1a49` |

**R-01 — la medición.** Instrumentando la función durante un render real:

    antes:   entra {No=#9DC3E6, Sí=#081F5C}  →  sale {Sí=#9DC3E6, No=#081F5C}
    después: entra {No=#9DC3E6, Sí=#081F5C}  →  sale {Sí=#081F5C, No=#9DC3E6}

En una escala ordinal el orden guardado coincide con el de los niveles y el error
era invisible. En una dicotomía guardada `{No, Sí}` contra niveles `{Sí, No}`
intercambiaba los dos colores.

**R-04 — la medición.** `lst_p6` pasó de una entrada de 17 opciones que no existe
en ninguna base a las cuatro escalas reales:

| Antes | Ahora |
|---|---|
| `lst_p6` — 17 opciones · 4 bases | `lst_p6` — 3 opc · docentes *(grados)* |
| | `lst_p6` — 6 opc · estudiantes *(ciclos)* |
| | `lst_p6` — 6 opc · egresados *(años)* |
| | `lst_p6` — 2 opc · administrativos *(Sí/No)* |

La clave de guardado sigue siendo `list_name`: las escalas homónimas tienen
etiquetas disjuntas (verificado: cero solapes) y conviven en el mismo mapa
etiqueta → color. Sin migración de `.pulso` y sin tocar el lookup del render.

### Relatados por la sesión «Revisión formato PPT motor»

| ID | Defecto | Commit |
|---|---|---|
| **R-05** | `titulos_grupo` se ignoraba en modo `var` — la firma lo aceptaba en todos los modos y lo descartaba en silencio | `7237c32e` |
| **R-06** | El subbloque de `multilista` perdía `excluir_opciones`: `SIN INF` volvía al denominador y el Top 2 Box daba 93 % donde la batería daba 94 % | `7b274c6d` |
| **R-07** | La leyenda de la lámina `top_two_box` se pisaba con etiquetas largas — importa porque es la **única** declaración de la escala cuando se apaga la leyenda por lámina | `eaa417da` |
| **R-08** | La paleta de acreditación se ataba a la literalidad de la etiqueta: «Totalmente en Desacuerdo» con mayúscula no matcheaba y 2 de 4 claves caían al default | `da2a6207` |

**R-01 y R-08 son capas distintas y hacen falta las dos.** R-08 arregla el camino
**preset → motor** (`.graficos_mk_palette()`); R-01 el camino **paleta guardada del
proyecto → motor** (`.reporte_plan_palette_for_levels()`). Ninguno cubre al otro.

> **Cuidado con el fallback posicional que R-08 conserva.** En una escala ordinal
> de 4 puntos el orden coincide y es una red razonable. En una dicotomía es una
> moneda al aire — es exactamente el mecanismo de R-01. No conviene generalizarlo
> fuera de la rampa de acreditación.

---

## 2. Errores persistentes

Medidos sobre el render del `.pulso` real contra el `HEAD` de hoy.

| ID | Defecto | Estado | Severidad |
|---|---|---|---|
| **E-01** | **Top 2 Box = 100 % en escalas de 2 categorías.** `top2box` suma las dos primeras columnas; en una dicotomía son las dos | ✅ **RESUELTO** `bf158aa3` | — |
| **E-02** | **Títulos de grupo encabalgados** en bloques `var_cruce` con 2+ grupos de 1 variable | ✅ **RESUELTO** por `c3e54d39`: el encabalgamiento venía del wrap desbordado | — |
| **E-03** | **Alto de lámina en blanco** entre el gráfico y el pie | ✅ **CERRADO por decisión** (`P-06`): 12 % en baterías es respiro; se acepta | — |
| **E-04** | **`SIN INF` en el denominador** cuando el proyecto no declara la exclusión | ✅ **RESUELTO en origen** por `P-01`: el perfil lo excluye. Los proyectos ya armados necesitan aplicar la línea | Baja |
| **E-05** | ~~Segmentos chicos sin cifra~~ → **mal diagnosticado**. `umbral_mostrar_etiqueta` REUBICA, no oculta, y `umbral_ocultar_etiqueta = 0`: el motor no calla ninguna etiqueta. El defecto real era otro: un segmento de 0,4 % se rotulaba **«0%»** | ✅ **RESUELTO** `0a53b30c`: ahora «<1%» | — |
| **E-06** | **Leyenda de 5 categorías que roza** en bloques comprimidos | ✅ **RESUELTO** por `R-03` + `c3e54d39` | — |
| **E-07** | **Enunciado de tema truncado o fuera de la lámina** | ✅ **RESUELTO** `c3e54d39` | — |
| **E-08** | **Colores de serie del radar** no eran los del deck | ✅ **RESUELTO** `9f999bfe`: navy y ámbar medidos, dentro del perfil | — |
| **E-11** | **Las etiquetas chicas se dibujan sobre el segmento VECINO** y el motor las sigue tratando como interiores | ⚠️ **ABIERTO** — diagnosticado con coordenadas, ver abajo | Media |
| **E-09** | **Las guías de layout no llegaban a ningún entregable** pese al interruptor activo | ✅ **RESUELTO** `c9cf1a49` | — |
| **E-10** | **La banda de leyenda reservaba 2,4× lo que dibuja** | ✅ **RESUELTO** `69c96d34`: de 38 a 31 px, y a 16 pt sin cambio | — |

### E-11 — medido, y no es donde parecía

Instrumentando el estado de las etiquetas durante un render:

| Etiqueta | Su segmento | Dónde se dibuja | `.label_fuera` |
|---|---|---|---|
| `<1%` | `[0.000, 0.004]` | **0.032** | FALSE |
| `2%`  | `[0.004, 0.024]` | **0.105** | FALSE |
| `1%`  | `[0.000, 0.012]` | **0.102** | FALSE |
| `5%`  | `[0.012, 0.062]` | 0.034 ✓   | FALSE |

El motor las trata como INTERIORES aunque estén hasta ocho anchos fuera de su
segmento, así que no reciben el conector que sí tienen las declaradas «fuera».
Se leen como si rotularan a la categoría vecina.

**Lo que se probó y NO era**: acotar el repelido de `repeler_etiquetas_peq` a
los límites del propio segmento (`.repel_x_min`/`.repel_x_max`). No cambió una
sola etiqueta — el desplazamiento ya viene hecho de una etapa anterior, entre
`.limitar_una_label_fuera_por_barra_apiladas`,
`.acomodar_labels_dentro_barra_apiladas` y
`.forzar_labels_dentro_barra_apiladas`. El cambio se revirtió por no tener
efecto demostrado.

Quien lo tome: el siguiente paso es instrumentar esas tres etapas por separado
para ver cuál mueve la etiqueta fuera de su segmento, y decidir si al salirse
debe marcarse `.label_fuera = TRUE` —lo que le daría su conector— o quedarse
dentro y encoger.

### E-01 es una regresión reciente y sistémica

`8e783a95` puso `barra_extra_preset = "top2box"` como **defecto** de
`barras_apiladas` y `multi_apiladas` en `.PRESETS_DEFAULT_PULSO`. Verificado:

```
barras_apiladas$barra_extra_preset = top2box
multi_apiladas$barra_extra_preset  = top2box
barras_apiladas$mostrar_barra_extra = TRUE
```

Antes la columna aparecía solo donde se declaraba; ahora sale en **toda** pregunta
Sí/No de **todo** proyecto. La guarda natural es la misma que ya se usa para el
aviso: con menos de 3 categorías, `top2box` no significa nada y la columna debería
caer a `"ninguno"`.

### E-03 — el aire está en el lugar equivocado

No es que falte contenido: es que el canvas se coloca conservando su proporción y
el sobrante se acumula abajo. Ya existe `.barras_pad_superior()` para repartirlo,
pero en láminas de pocas filas el bloque no crece lo suficiente para absorberlo.
Relacionado con `E-02`: ambos salen del reparto de alto entre bloques.

---

## 3. Pendientes de decisión o implementación

| ID | Pendiente | Estado |
|---|---|---|
| **P-01** | **Dar camino de producto al preset de acreditación** | ✅ **HECHO** `a6e2e97c`: aparece en «Líneas visuales» como perfil, junto al de ACNUR |
| **P-02** | **Política de leyenda.** Decidido: se quedan DOS filas —el solape ya estaba resuelto, así que era preferencia de espacio y no corrección— pero repartidas parejo | ✅ **HECHO** `02480098`: 5 → 3+2, 6 → 3+3, 7 → 4+3 |
| **P-03** | **Guarda de `top2box` para escalas de 2 categorías** (`E-01`) | ✅ **HECHO** `bf158aa3` |
| **P-04** | **Reparto de alto en bloques `var_cruce` de varios grupos** (`E-02`, `E-03`) | Parcial: `E-02` cayó con el wrap; queda el aire de `E-03` |
| **P-05** | **Piso de la banda de leyenda** (`E-10`) | ✅ **HECHO** `69c96d34` |
| **P-06** | **El aire bajo el canvas** (`E-03`, 12–20 %) | ✅ **DECIDIDO: se deja como está.** El 12 % de las baterías es respiro razonable sobre el pie; los dos levers cambiaban el layout de todos los mazos ya entregados a cambio de un caso minoritario |

### El contrato Word roto por el defecto de `top2box` — ✅ resuelto en `6e412067`

`test-reporte-word-barra-extra.R` llevaba **4 fallos en HEAD** desde `8e783a95`.

El contrato B54/W-5 dice que Word apaga la columna extra salvo que se haya
PEDIDO, y distinguía «pedido» de «por defecto» mirando si `barra_extra_preset`
estaba declarado. Al volverse defecto global, todo parece pedido y Word ya no
puede aplicar su piso — el que existe porque el lienzo de 6,1" no da para esa
columna. Dos salidas: que Word compare contra el suelo de Pulso para saber qué
es deliberado, o que el contrato cambie y el Word también muestre Top 2 Box.
Se tomó la primera: un valor igual al de fábrica es herencia y manda Word; uno
distinto es elección del analista y se respeta. Quien quiera la columna en Word
la declara por lámina, que es donde el pedido sí es inequívoco.

### P-02 — la medición completa

A 16 pt, la leyenda de 5 categorías mide **1,139 npc** contra un tope de **0,96**:

| Componente | npc | % |
|---|---|---|
| **texto** | 0,867 | **76 %** |
| cuadritos | 0,132 | 12 % |
| separación entre ítems | 0,104 | 9 % |
| separación cuadrito↔texto | 0,036 | 3 % |

Toda la separación junta son 0,140. Llevarla a cero deja **0,999** — sigue sin
entrar, y en la práctica ni baja tanto porque `key_gap` y `slot_gap` tienen pisos
duros. Achicar además el cuadrito llega a 1,108.

Lo único que mueve la aguja es el cuerpo de letra, porque el texto es tres cuartos
del presupuesto. El umbral está en **~12,7 pt**: a 13 pt son 0,976 (dos filas), a
12,5 pt son 0,949 (una fila).

Dos resultados contraintuitivos: acortar las etiquetas a «Tot. en desacuerdo /
Tot. de acuerdo» baja de 75 a 63 caracteres y **sigue en dos filas**; y quitar
`SIN INF` tampoco alcanza, porque las cuatro que quedan son las largas.

**Las dos salidas reales**: que el motor prefiera una fila achicando la letra
hasta un piso configurable, o apagar la leyenda por lámina como hace el deck 2021
—que declara la escala una vez en su lámina 5 y no la repite en las 16 de
resultados—. La segunda es la del preset y no cuesta código.

---

## 4. Formato, presets y mecanismos del deck 2021

Los cuatro tipos de lámina **se reproducen** — el detalle rasgo a rasgo está en
[el doc de validación](validacion-deck-acreditacion-2021.md). Lo que sigue es la
otra pregunta: **cuánto de eso llega al analista sin escribir R**.

| Elemento medido en el deck | Implementado | Alcanzable desde la UI |
|---|---|---|
| Rampa ordinal `F4B183 FFD966 B0D597 8FC36B` | ✅ `.PRESET_ACRD_RAMPA` | ❌ solo vía `presets_acreditacion()` |
| `gapWidth 74` (`grosor_barras = 0.575`) | ✅ | ❌ ídem |
| Jerarquía pregunta 16 > dato 14 > fila 13 | ✅ | ❌ ídem |
| Exclusión de `SIN INF` del denominador | ✅ | ❌ ídem *(causa de `E-04`)* |
| Leyenda apagada por lámina | ✅ | ❌ ídem *(evitaría `E-06` y `P-02`)* |
| Título de lámina = dimensión, no enunciado | ✅ | ❌ ídem |
| Columna Top 2 Box | ✅ | ✅ **es defecto** desde `8e783a95` *(causa de `E-01`)* |
| Semáforo por umbral (≥80 / 70–79 / <80) | ✅ | ✅ cortes editables desde la UI (`78b2f171`) |
| Comparativo interanual con tendencia | ✅ | ⚠️ se declara **por lámina** en el plan; el histórico es una cifra de informe previo, no una base procesable |
| Gris `BFBFBF` para categorías fuera de escala | ✅ | ❌ vía preset |
| Reposicionamiento de etiquetas chicas | ➕ **propio** — el deck movió 62 de 91 a mano | ✅ automático |
| Nota de base al pie | ➕ **propio** | ✅ automático |
| Charts nativos OOXML | ❌ **decidido que no** | — ADR 0071 |

**Lectura**: de once rasgos del deck, nueve están implementados y **seis solo se
alcanzan escribiendo R**. Esa columna de la derecha es el trabajo que falta, y es
`P-01`.

### Mecanismo cerrado: formas, no charts nativos

[ADR 0071](../adrs/0071-el-grafico-nativo-cuesta-el-reposicionamiento-de-etiquetas.md).
`mschart` reproduce el XML del deck rasgo a rasgo y valida limpio, pero PowerPoint
no mueve una etiqueta que no entra: en el prototipo 2 de 3 filas quedaron
ilegibles. El deck de referencia tiene 62 de 91 etiquetas desplazadas a mano;
migrar devolvería ese trabajo a una persona.

---

## 4bis. Observaciones nuevas, sin clasificar todavía

Cosas vistas al medir, que no son bugs registrados ni tienen dueño aún.

**O-01 — las guías no llegan a las láminas de solo texto.** `debug_ph_bordes`
vive en el canvas de los graficadores, así que Portada, Índice y Separador no
reciben marcos ni en el preview ni ahora en el export. El esqueleto de carga sí
dibuja cajas rosadas, lo que hace la ausencia más confusa. Importa desde que las
guías llegan al entregable (`E-09`): una portada cuyo título desborda sigue sin
poder diagnosticarse con ellas.

**O-03 — el enunciado del eje ahora se trunca en vez de salirse.** El fix de
`R-09` acotó el wrap al ancho del canal, así que un enunciado que no entra ya no
invade la lámina: se corta con elipsis («…difundidos entre los…»). Es honesto
—se ve que hay más— y mejor que mentir con texto fuera de la caja, pero en un
informe de acreditación se pierde el final de la frase. El lever es el ancho del
canal (`canvas_w_etiquetas`), que hoy declara el proyecto.

**O-02 — el runtime del analista sirve código viejo hasta que se reinicia.** El
export de «Conta 10-08» del 10/08 a las 18:03 salió con la paleta invertida y
las columnas Top 2 Box de 100 %, defectos reparados a las 14:40 y 18:09. El
mismo `.pulso` renderizado contra `HEAD` sale correcto. El launcher reinstala el
paquete cuando detecta la fuente más nueva, pero solo **al arrancar**: una sesión
larga sirve el paquete instalado viejo sin avisar. No es un bug del motor, pero
explica reportes que no reproducen y cuesta horas de diagnóstico cada vez.

---

## 5. Trampas — no repetirlas

Recogidas de las dos sesiones. Cada una costó tiempo real.

- **El reparto de alto de multilista no se arregla midiendo el canvas.** Se probó
  que cada bloque reportara su alto intrínseco y `plot_grid()` lo usara como
  `rel_heights`. Corrige la leyenda pero rompe los títulos de grupo: el canvas no
  sabe que el canal lateral necesita 6 líneas. **La estimación conoce los títulos,
  la medición conoce la leyenda; ninguna sola alcanza.**
- **No bajes el umbral de `needs_tall_label_slot` de 5 a 3 líneas.** No resuelve el
  encabalgamiento y adelgaza la barra de 0,99 a 0,38 cm (`gapWidth` 288).
- **Los tests que miden `out$rendered` en `multilista` pasan verde sin medir nada**:
  el resultado es un `plot_grid` y su `$data` viene vacío. Medir sobre el PPTX.
- **`suppressWarnings()` del renderer se traga los `warning()` del graficador.**
  Para avisarle algo al usuario, `message()`.
- **Unidades mezcladas**: `size_texto_barras` va a `geom_text()` (mm), el resto a
  `cowplot::draw_text()` (pt). 14 pt en la barra son `14 / ggplot2::.pt ≈ 4,9`.
- **`as.character()` borra los nombres de un vector con nombres.** Causa de `R-01`.
- **Un `list_name` no identifica una escala en multibase.** Causa de `R-04`.
- **Las guías de layout no llegan a las láminas de solo texto** (ver `O-01`).
- **Un assert sobre el objeto ggplot de un canvas no ve las etiquetas dibujadas**
  y pasa en verde sin medir nada. Le pasó a la regresión del «0%»: hubo que sacar
  la regla a `.pulso_fmt_pct_unidades()` para poder verificarla.
- **Acotar el repelido de etiquetas no mueve una sola etiqueta**: el
  desplazamiento ya viene hecho de una etapa anterior (ver `E-11`).

---

## Cómo reproducir el banco de prueba

```r
Sys.setlocale("LC_ALL", "en_US.UTF-8")
pkgload::load_all("api")
sid <- load_pulso("~/Documents/Pulso/ACRD CONTA/Conta 09-08 equivalencias.pulso")$session_id
cfg <- session_get(sid)$graficos_config
scoped <- .graficos_processing_sources(sid)
# el worker es el mismo que corre POST /api/graficos/ppt
graficos_job_worker_ppt(
  rp_data_path = ..., rp_inst_path = ...,
  plan = .normalize_plan(cfg$plan),
  presets = .enriquecer_presets(cfg$presets, FALSE),
  paletas = cfg$paletas,
  active_base = .graficos_active_base_name(sid),
  auto_otros_slides = TRUE, result_path = "conta.pptx"
)
```

Y para verlo: `soffice --headless --convert-to pdf` + `pdftoppm -png -r 80`.

> **Ojo**: el ícono del plan no viaja en los `.pulso` guardados **antes** de `R-02`.
> Un `.pulso` viejo necesita sustituirlo por un marcador o el export muere entero.

## 5bis. Cierre de la sesión del 2026-08-11 (tarde)

Lo que hay que saber para retomar. Tres hallazgos de arquitectura y dos errores
míos de medición que costaron vueltas.

### El bloque de una multilista ES una unidad configurable

Es la respuesta a «dos gráficos en bloques distintos necesitan tamaños
distintos», que se había dado por imposible. Un `p_barras_multiapiladas` con
`modo = "multilista"` guarda sus bloques en `args$bloques`, y **cada bloque se
renderiza recursivamente con sus propios `overrides`**
(`reporte_plan_ppt.R:4748`). O sea, todo lo que acepta el graficador se puede
declarar por bloque sin tocar el motor. Verificado aplicando
`color_texto_barras` distinto a dos bloques del mismo gráfico (lámina 38: azul
en el Likert, blanco en el dicotómico).

Además el bloque acepta **`altura_rel`** (`reporte_plan_ppt.R:4607`), que fija
su parte del reparto vertical; por defecto sale de sus filas + título +
leyenda. **Ninguna de las dos cosas tiene superficie en la UI**: hoy sólo se
tocan editando el `.pulso`. Ese es el trabajo pendiente, no construir el
mecanismo.

### Los constructores del plan tiran lo que no es formal suyo

`p_barras_agrupadas()` declara ocho formals y **no tiene `...`**: `var, titulo,
cruces, overrides, base, filtros, mostrar_ceros, excluir_opciones`. Cualquier
otro arg guardado al nivel del slot se cae al construir el elemento y no llega
al motor. Es lo que hacía de `orden_categorias_manual` una **reparación
fantasma**: guardado en el `.pulso`, visible en pantalla, ausente del PPT.
Medido con `trace()`: cero llamadas al graficador lo recibían.

Reparado con `via_overrides = TRUE` en el registro, que el formulario respeta
para enrutar a `args.overrides`. **Si añades un arg de graficador que el
constructor no acepta, decláralo así o no surtirá efecto.**

### Dos errores de medición míos, para no repetirlos

1. **Buscar un literal exacto.** Conté las cabeceras del Top 2 Box con
   `<a:t>TOP2BOX</a:t>` y di 0 cuando eran 50: la cabecera se escribe **«Top 2
   Box»**. El aserto no distinguía el caso bueno del malo.
2. **Clasificar por la clave equivocada.** Declaré «cero gráficos mixtos»
   mirando `args$vars`, que está **vacío** en `modo = "multilista"` porque las
   escalas viven en `args$bloques`. Los mixtos eran justo esos. La detección
   fiable mira los dos modos y, cuando el catálogo de escalas no resuelve una
   variable, cuenta las categorías **en los datos**, que es lo que el motor
   dibuja.

Y una tercera que no es de medición sino de alcance: el XML del `.pptx` **no
sirve** para auditar nada que esté dentro del gráfico —porcentajes, leyendas,
colores de barra—, porque el motor incrusta cada gráfico como imagen. Ahí sólo
se pueden auditar los textos de lámina. Lo de dentro se juzga en la PNG.

### Estado del proyecto del cliente

`V3_Conta 11-08 equivalencias.pulso` quedó editado con: Top 2 Box y Bottom 2 Box
declarados, `preservar_tamanos_texto`, `size_ejes = 13.5`, las cuatro escalas
reordenadas por código, secciones de prueba en el Índice, `color_titulo` en el
azul de marca, y el texto de porcentaje en azul salvo en las **12 unidades
dicotómicas** (5 gráficos completos y 7 bloques), donde va blanco porque el
relleno es azul marino. Respaldo previo en
`V3_Conta 11-08 equivalencias.RESPALDO-antes-de-A1A2A3A5A7.pulso`.

Queda abierto, por decisión del usuario: los enunciados que se pisan (láminas
24, 30, 62, 66), los 31 truncados, la cabecera «Top 2 Box» cortada por arriba,
el ícono «Perfil» que no viaja y los errores de contenido del plan. Las guías
magenta se dejan encendidas a propósito.

## 6. Verificación de cierre — 2026-08-11

Render completo del banco (`Conta 10-08`, 67 láminas) y revisión de la UI real
con el proyecto abierto. Todo lo de abajo está medido sobre ese mazo, no
supuesto.

### Reparado en esta sesión

**«Agregar sección» del Índice no creaba nada.** Causa exacta:
`serializeIndiceModel()` descarta las secciones sin título
(`indiceModel.ts:105`), y el botón creaba una con `titulo: ""`. El clic añadía,
el commit filtraba, y el modelo volvía idéntico — no-op por construcción. El
mismo filtro borraba una sección existente en cuanto le vaciabas el título para
reescribirlo. Reparado con un borrador local en `IndiceBuilder.tsx`: la UI
conserva lo que el analista tiene entre manos y al motor sigue yendo sólo lo
que tiene título. Una firma evita que el borrador tape un cambio de fuera
(deshacer, cambio de slide).

Consecuencia visible: el editor de sección **ya existía completo** —selector de
ícono del foco con los 10 del catálogo, subtemas, reordenar, eliminar— y no se
podía ver porque el botón nunca abría la fila. De ahí que «no se entienda dónde
se agregan los subíndices».

### Pendiente, con evidencia

| # | Hallazgo | Evidencia |
|---|---|---|
| V-1 | **822 runs de texto en negro puro** (#000000), segundo color más usado del mazo, contra 156 del azul de marca (#081F5C). Afecta a los enunciados del eje y a la leyenda de las multi-apiladas. | Conteo de `<a:rPr>` sobre las 68 láminas |
| V-2 | **0 tablas nativas de PowerPoint** en todo el mazo. La tabla del radar se dibuja como geometría, así que no se puede editar como tabla. | `grep <a:tbl>` = 0 |
| V-3 | **6 formas se salen de la lámina** en 5 láminas (22, 24, 34, 36×2, 55); la peor, 1,7 mm. Todas enunciados largos del eje. | Geometría de cada forma vs. 13,33 × 7,5 in |
| V-4 | **Enunciados truncados con «…»** cuando no caben en el canal (lámina 39: «La Unidad facilita los medios necesarios para que los…»). | Render de la lámina 39 |
| V-5 | La columna **TOP2BOX queda reservada y vacía** cuando el motor la omite por escala de 2 categorías. El motor ya avisa; la lámina conserva el hueco y la cabecera. | Lámina 39, bloque «¿Conoce los criterios… egreso y titulación?» |
| V-6 | **«(respuestas válidas)»** se añade a la nota de base en 9 láminas con un denominador distinto del total (47: 51/109/161 frente a 52/172/178) sin decir qué hace válida a una respuesta. | Barrido de textos |
| V-7 | **La nota de base vive en el gráfico**, no en la lámina. No hay forma de decidir dónde va. | Pedido de Gonzalo, 2026-08-11 |
| V-8 | **El PNG del ícono no se puede teñir**; entra tal cual (negro). | Pedido de Gonzalo, 2026-08-11 |
| V-9 | **«Colores de focos» del Índice es un campo de texto libre** que se anuncia como HEX y da de ejemplo `88, 90, 96`, que no son HEX. En la pestaña de al lado, «Color de numeración de subíndices» sí tiene muestra de color. | UI real, Índice |
| V-10 | **«Íconos de los focos» pide teclear rutas SVG/PNG a mano**, sin hablar con el catálogo de íconos de Configuración global. | UI real, Índice |

V-1 y V-5 son las dos que más ensucian el entregable a la vista. V-2 es la que
más molesta al editar. Ninguna se aplicó en esta sesión: V-1 mueve el color de
mazos ya entregados y V-2 cambia el mecanismo de render, así que las dos exigen
decisión.

### V-11 · Dónde se define qué es un Top 2 Box *(medido 2026-08-11)*

**El denominador ya cumple lo acordado.** Verificado con la aritmética de la
lámina 39: Estudiantes reparte 2 % + 7 % + 48 % + 37 % + 6 % = 100 % y su
TOP2BOX es 85 % = 48 + 37. El 6 % de SIN INF **está en el denominador** y sólo
queda fuera del numerador, que es lo correcto. Egresados igual: 42 + 52 = 94 %.

**Quién elige las categorías hoy.** Si nadie las declara, `.default_box_cols()`
(`graficador_barras_apiladas.R:65`) toma las **dos últimas categorías por
posición**, después de descartar las especiales (`.is_special_box_choice`):
`tail(eligible, 2)`. Es decir, asume que la escala viene ordenada de peor a
mejor. Si una escala no respeta ese orden, el motor suma las dos equivocadas
**sin avisar**.

**El caso dicotómico es otro problema, no el mismo.** Con Sí/No hay 2 elegibles,
`tail(eligible, 2)` las toma ambas y el Top 2 Box da 100 % por construcción. Por
eso existe `.barra_extra_minimo = c(top2box = 3L, top3box = 4L, bottom2box = 3L)`,
que hoy lo omite y emite aviso. Un Top 2 Box de escala de 5 y uno de escala de 2
no son el mismo indicador y no deberían resolverse con la misma regla posicional.

**Dónde se puede declarar hoy, y dónde no:**

| Argumento | Superficie |
|---|---|
| `top2box_labels` | **sólo el inspector de la lámina**, en `p_barras_multiapiladas` («Etiquetas Top 2», grupo `valores`) |
| `top3box_labels` | ninguna |
| `bottom2box_labels` | ninguna |

O sea: se declara lámina por lámina, sólo para Top 2, y no existe en Estilo
global. **Lo que pide Gonzalo —declarar en Estilo cuáles son los indicadores
Top 2 Box / Bottom 2 Box del estudio— no existe.** Es adición (un bloque nuevo
en Estilo), pero define un default metodológico que afecta a todo el mazo, así
que exige su decisión: qué categorías por tipo de escala, y qué hacer cuando la
escala no tiene suficientes.

Pendiente de que Gonzalo precise: **el uso de los colores por elemento**
(enunciado, leyenda, valores dentro de barra, columna de box). Se relaciona con
V-1 —822 runs en negro— pero la regla que debería regir no está escrita.

## 7. Revisión estética pendiente — lista de Gonzalo, 2026-08-11

**El diagnóstico de fondo es correcto: no se hizo una revisión estética del mazo.**
Se validaron invariantes medibles (color del texto, formas fuera de lámina,
avisos del motor, cálculo del Top 2 Box) y se dio por bueno el resto sin mirar
lámina por lámina. Esta sección existe para que eso se haga con método.

**Error de banco de pruebas detectado al revisar esto**: el script de validación
—entonces un archivo suelto fuera del repo, hoy `scripts/qa_graficos_medir.R`—
forzaba `auto_otros_slides = TRUE`, cuando el default
del registro es `FALSE` y el router lo resuelve del proyecto. Se estuvo
validando un mazo distinto del que produce la app. Corregido; con el flag en
`FALSE` el mazo sigue teniendo 67 láminas, lo que demuestra que **las láminas de
«otros» están guardadas en el plan del proyecto, no las genera el motor**: hay
que decidir si se borran del plan o si el render las omite por criterio.

### Cola de la revisión estética

| # | Ítem | Estado |
|---|---|---|
| E-1 | Índice: los íconos de los focos no están configurados; falta probar que cambiarlos cambie algo, y probar con subíndices de prueba | sin empezar |
| E-2 | Objetivo: el texto sale invertido | sin diagnosticar |
| E-3 | Probar un PNG real de Pulso como ícono; hoy no se ve que funcione | ligado a la ref. perdida del ícono «Perfil» |
| E-4 | Perfil (docente y estudiante): probar títulos por variable agrupada, no sólo el del slide | sin empezar |
| E-5 | Las láminas de «otros» no deben renderizarse salvo declaración explícita | **medido**: viven en el plan, no en el motor |
| E-6 | Cada gráfico necesita título propio además del título de lámina; configurarlo en el proyecto | sin empezar |
| E-7 | Sin Top 2 Box por defecto en dicotómicos | el mecanismo ya existe (declaración por nombre); falta aplicarlo al proyecto |
| E-8 | Separación entre bloques inconsistente entre láminas | sin medir |
| E-9 | La leyenda cambia de tamaño entre láminas; debería ser una sola en todo el mazo. Igual para etiquetas y todo texto | sin medir |
| E-10 | Porcentajes más grandes que su propia barra | sin medir |
| E-11 | Wrap demasiado corto y textos truncados con «…» | medido antes: 6 formas fuera de lámina, truncados en varias |
| E-12 | Las tablas deben ser NATIVAS de PPT en todos los casos, con el formato de la casa | **contradice el ADR 0071**; exige revertirlo con ADR nuevo |

E-9 y E-12 son los dos de mayor alcance: el primero exige una pasada de
consistencia tipográfica sobre las 67 láminas, y el segundo revertir una
decisión de arquitectura documentada.

### Medición de las 67 láminas — 2026-08-11

Rasterizadas las 67 y medidos los `sz` de cada run contra el XML del `.pptx`
(centésimas de punto, sin estimar por píxel).

**E-9 · Tipografía inconsistente — confirmado y localizado.**

| Rol | Tamaños en el mazo | Dominantes | Outliers |
|---|---|---|---|
| Porcentajes | 4 | 18,5 pt (48 láminas) y 15,9/16,0 pt (mismo tamaño, ruido de redondeo) | **9,0 pt en 47 y 48** |
| Leyenda / etiqueta corta | 9 | 13,5 pt (47 láminas) y 10,5 pt (42) | 7,4 (l. 9) · 8,0 (9, 47, 48) · 9,0 y 9,5 (47, 48) · 9,6 (24) · 12,0 (9, 10) · 15,9 (52, 66) |

Lo grave no son los outliers sino la mezcla **dentro de una misma lámina**:
**42 láminas mezclan tamaños de porcentaje** y **46 mezclan tamaños de
etiqueta**. Dos bloques contiguos del mismo slide se leen con tipografías
distintas.

Las láminas **47 y 48** son el caso extremo: todo achicado a la vez
(porcentajes 9 pt, leyenda 8/9/9,5 pt) porque el motor bajó la letra para
encajar tres bloques de alturas dispares.

**E-11 · Truncados — 31 textos** terminan en «…» (láminas 21, 22, 25, 26, 28,
30, 47…). El enunciado no cabe en el canal y se corta en vez de reducir el
canal o envolver.

**E-10 · Porcentajes más grandes que su barra — confirmado visualmente** en la
lámina 9: «10 %», «3 %» y «2 %» desbordan sus barras. La etiqueta no se
reubica ni encoge cuando la barra es más corta que su propio rótulo.

**E-8 · Separación entre bloques — confirmado** en la lámina 47: tres bloques
de 2, 3 y 1 filas reparten el alto sin compensar, y la leyenda queda encima de
la última barra.

**Ícono ausente**: el cuadro blanco del centro en las láminas de perfil es la
referencia perdida del ícono «Perfil», visible en la lámina 9.

### E-13 · Orden manual de barras por gráfico *(pedido 2026-08-11)*
En barras agrupadas hace falta una opción **sólo del gráfico**, no del preset
global, para reordenar las barras a mano — además de los órdenes que ya existen
(instrumento, mayor a menor…). La interacción que Gonzalo pide es la misma con
la que hoy se reordenan los slides: arrastrar o subir/bajar, no teclear una
lista de códigos.

El argumento ya existe: `orden_categorias_manual`, declarado como `codigos_list`
y consumido por `overrides` —o sea, ya es por gráfico y no por preset—. Lo que
falta es la superficie: un tipo de input que muestre las categorías reales de
esa escala como filas reordenables, en vez de un campo de texto.

Se apoya en lo mismo que el selector de categorías del Top 2 Box: el catálogo de
escalas ya devuelve las etiquetas reales con sus códigos y las bases que las
usan.

**Verificado en pantalla — 2026-08-11.** Lámina 7 «PERFIL DEL DOCENTE», slot
Superior izquierda (`p_barras_agrupadas`, `docentes$p5`), pestaña **Estilo** del
inspector. La cadena completa, con su control en cada paso:

| Paso | Lo que se ve | Control |
|---|---|---|
| Sin orden propio | «Sin orden propio: se usa el del instrumento» + las 7 escalas del estudio como botones sembradores | el campo no muestra filas |
| Sembrado con «Masculino · Femenino · Prefiero no responder» | filas numeradas 1/2/3 con ↑↓, botón «Volver al orden del instrumento», badge **Ajuste** | el campo pasa de lista de escalas a filas |
| ↑ en la fila 3 | 1 Masculino · 2 Prefiero no responder · 3 Femenino | el orden cambia sólo en ese gráfico |
| Persistencia | `args.orden_categorias_manual = ["Masculino","Prefiero no responder","Femenino"]` en el slot | GET del config con el `sid` del navegador |
| «Volver al orden del instrumento» | vuelve la lista de escalas | el arg desaparece del config |

El motor lo consume en `graficador_barras_agrupadas.R:676` y **tiene prioridad
sobre `orden_barras`**, tal como promete el texto del campo.

Dos matices medidos que el commit no dice: el valor se guarda en `args` de nivel
superior, **no en `overrides`** (sigue siendo por gráfico, así que la propiedad
que importa se cumple); y el sembrador ofrece **las 7 escalas del estudio**, no
la del `var` de ese gráfico, que ya conoce.

**Trampa de medición de esta sesión.** Verifiqué contra el `sid` del bootstrap
(`e5ac9caa…`) y daba «no persiste». El navegador abrió el proyecto por
deep-link `?pulso=`, o sea con **otro `sid`** (`6ad0debf…`, en
`localStorage["pulso.sessionId"]`). El backend es un kv-store por `sid`: medir
con el `sid` equivocado no lee otro estado, lee otro proyecto. Lo mismo vale
para el scope: si el plan es «un informe conjunto», el autosave escribe en
`/api/graficos/consolidado/draft` y no en `/api/graficos/config`.

### E-16 · V3 perdió la declaración del Top 2 Box *(medido 2026-08-11)*

Revisadas las 67 láminas de `V3_Conta 11-08 equivalencias.pulso` una por una,
rasterizadas a PNG. **La regresión que manda sobre todo lo demás:**

| | 10-08 CONFIGURADO | V3 11-08 |
|---|---|---|
| Cabeceras `TOP2BOX` en el mazo | **51**, en 42 láminas | **0** |
| Textos truncados con «…» | 31, en 22 láminas | 31, en 22 láminas |

**Causa exacta**: el preset `multi_apiladas` de V3 perdió cuatro declaraciones
que el 10-08 sí tiene.

| Argumento | 10-08 | V3 |
|---|---|---|
| `mostrar_barra_extra` | TRUE | TRUE |
| `barra_extra_preset` | `top2box` | `top2box` |
| `top2box_labels` | De acuerdo · Totalmente de acuerdo · Satisfecho · Muy satisfecho · Sí | **ausente** |
| `bottom2box_labels` | En desacuerdo · Totalmente en desacuerdo · Insatisfecho · Muy insatisfecho | **ausente** |
| `preservar_tamanos_texto` | TRUE | **ausente** |
| `size_ejes` | 13.5 | **ausente** |

Con `mostrar_barra_extra = TRUE` pero sin categorías declaradas, el motor omite
la columna y lo avisa — **37 veces** en el render de V3, medido con el comando
`avisos`: *«La columna top2box se omite: no hay categorías declaradas»*. O sea,
el motor no falló ni lo hizo en silencio: la declaración no viajó. V3 se
construyó sobre una rama sin la configuración de la sesión anterior.

La pérdida de `preservar_tamanos_texto` y `size_ejes` explica de paso por qué V3
se ve con letra más grande: el motor volvió a su autoajuste.

**Lo que V3 sí mejoró**, verificado en pantalla: títulos propios por gráfico en
las láminas de perfil (E-6), la lámina 24 pasó de un amasijo de siete enunciados
superpuestos a legible, y la tipografía general subió.

**Lo que V3 no cambió ni empeoró**: los 31 truncados (idénticos), las cuatro
escalas invertidas de E-15, el ícono «Perfil» que no viaja, y `debug_ph.activo
= TRUE` — el mazo sale con las guías magenta de layout impresas en todas las
láminas con gráfico.

**Lo que V3 empeoró**: al subir la tipografía, la leyenda inferior quedó cortada
a media altura en varias láminas (18, 26, 30, 32, 38), y los bloques perdieron
la separación vertical que los distinguía — la lámina 13 se lee como una tabla
corrida de ocho filas en vez de dos bloques.

### E-11 · Los 31 truncados: dónde están de verdad y por qué *(medido 2026-08-11)*

**La premisa del archivo congelado era falsa.** El recorte no vive en
`.render_barras_multiapiladas` ni en `reporte_plan_ppt.R`, sino en
`api/R/graficador_helpers_titulos_grupo.R:51` (`.barras_acotar_titulo_grupo`),
que ya es archivo propio y **no** está congelado. Nada bloqueaba el arreglo.

Medido con su control, sobre «Conta 10-08 CONFIGURADO»:

| Render | Textos con «…» |
|---|---|
| normal | **31**, en 22 láminas |
| con `.barras_acotar_titulo_grupo` desactivada (misma firma) | **0** |

Es esa función y sólo esa. El mecanismo: el título de bloque se acota a
`n_filas × 3 × alto_rel` líneas, así que **un bloque de una fila admite tres
líneas** y un enunciado de 100+ caracteres, envuelto en el canal del grupo,
necesita seis. En las láminas de escalas mixtas `alto_rel` baja el cupo a dos o
incluso a una.

**Ahora el recorte avisa.** Emite un `[PULSO-AVISO]` con el enunciado **entero**,
el cupo y las líneas que hacían falta. El nuevo comando `avisos` del arnés lo
mide: 31 emitidos, 31 distintos, uno por texto cortado. Antes: 31 «…» en el
entregable y **cero** avisos — el motor decidía en silencio y el analista no
tenía forma de recuperar el texto completo.

Ojo con el techo: `.pulso_avisos_de_job()` deduplica y **corta en 8**. Con 31
avisos distintos la UI muestra 8. El tope es deliberado («una lista de veinte
avisos no se lee»), pero con este volumen conviene decidir si sube o si esta
familia se agrupa en un solo aviso con su cuenta.

**Por qué el canal no puede variar por bloque.** Los bloques se apilan en
VERTICAL dentro de un mismo gráfico y comparten las bandas horizontales
—`x_group0`, `x_bars0`, … se calculan una vez por gráfico
(`graficador_barras_apiladas.R:2803-2843`)—. Ensanchar la columna de grupo de un
bloque y no la del vecino desalinearía el arranque de las barras entre bloques.
Lo que sí puede variar por bloque es el **alto**: más filas o filas más altas
suben el cupo de líneas de ESE bloque sin mover a los demás. Es la vía para que
dos bloques con etiquetas de largo distinto convivan.

### E-15 · Las cuatro escalas desordenadas, medidas de verdad *(2026-08-11)*

El diagnóstico de partida —«`lst_p4_recod`, `lst_p3_recod`, `lst_p5_recod` y
`lst_p10` desordenadas»— sale del comando `escalas` del arnés, que ordena por el
**primer número de la etiqueta**. Es una heurística y su propio aviso lo dice.
Medido contra el orden que el instrumento declara de verdad, con el **código**
al lado, el cuadro cambia:

| Escala | Base | Orden declarado (código) | Veredicto |
|---|---|---|---|
| `lst_p4_recod` | docentes | 4, 3, 2, 1 | **invertida** (de mayor a menor edad) |
| `lst_p4_recod` | egresados | 3, 1, 2, 4 | **revuelta** |
| `lst_p3_recod` | administrativos | 2, 1, 3, 4 | **1 y 2 permutados** |
| `lst_p5_recod` | administrativos | 2, 1, 3 | **1 y 2 permutados** |
| `lst_p3_recod` | estudiantes | 1, 2, 3, 4 | correcta |
| `lst_p10` | egresados | 1, 2, 3, 4, 5, 6 | **correcta — falso positivo** |

O sea: **`lst_p10` no está desordenada.** Va «0 meses → Menos de 2 meses → Entre
2 y 6 → Entre 6 meses y 1 año → Más de 1 año → No he encontrado trabajo», que es
el orden correcto; la heurística la marcó porque no sabe leer «Más de 1 año»
frente a «Menos de 2 meses». Y `lst_p10` en docentes/administrativos ni siquiera
son meses: son Sí/No.

**La señal fiable es el código, no la etiqueta.** En las cuatro (base, escala)
rotas el instrumento declara las opciones fuera del orden de su propio código
ordinal. Son cuatro gráficos: láminas 7, 8 y 11 (×2).

**El puente variable → escala, implementado.**
`/api/graficos/paletas-sugeridas` ahora devuelve, por escala, las `variables`
que la usan (`api/R/graficos_escalas_variables.R`, leído del
`type = "select_one <list_name>"` del `survey`). Con eso el campo «Orden manual
de categorías» pone delante **la escala de la pregunta que se está editando** y
manda el resto a «Otras escalas del estudio», en vez de ofrecer las 23 y esperar
que el analista reconozca la suya.

Trampa que sólo apareció midiendo sobre el proyecto real: **el `list_name` no
alcanza para atribuir**. El colector separa las homónimas (`lst_p10`,
`lst_p10#2`, `lst_p10#3`) porque en cada base son otra escala, y atribuir por
nombre le daba a las tres las seis variables del nombre: la Sí/No de docentes
ofrecía los meses desde el egreso como si fueran suyos. Se acota por las
`fuentes` que el colector ya calcula. El test unitario no lo vio porque usaba
`list_name` distintos por base.

### E-14 · El buscador de ajustes contaba lo que no podía mostrar *(reparado 2026-08-11)*

Descubierto al buscar «orden» desde la pestaña **Datos**: el conteo decía
**«3 de 50»** y justo debajo **«Ningún ajuste coincide con "orden"»**. Las dos
cosas a la vez, y ninguna útil.

Causa: en `GraficadorForm.tsx` la búsqueda corría sobre los 50 args del
graficador completo y el filtro por pestaña (`groupFilter`) se aplicaba
**después**, al agrupar. El contador contaba coincidencias que la lista tenía
prohibido pintar. `orden_categorias_manual` es del grupo `estilo` → pestaña
Estilo; desde Datos era invisible y la superficie afirmaba que no existía. Es
una falla **C4 (alcance)**: el ajuste existe y la pantalla dice que no.

Reparado invirtiendo el orden —filtrar por pestaña y luego buscar—, con tres
consecuencias visibles:

- El contador cuenta lo que se ve: «orden» en Estilo da **3 de 46**.
- Lo que cae fuera se anuncia con su pestaña en vez de desaparecer: «dividir»
  en Estilo da *«Ningún ajuste de esta pestaña coincide con "dividir". 1 en
  Datos.»*
- Datos ya no ofrece buscador: tiene 4 ajustes y el umbral es 6. Antes ofrecía
  «Buscar entre 50 ajustes…» para poder mostrar 4.

El reparto grupo → pestaña salió de `GraficadorSlot.tsx` a `argTabs.ts` (el
formulario lo necesita y el slot ya importa el formulario: reexportar evita el
ciclo). Ojo con `normalizeArgGroup`, que colapsa `estilo`, `filtro` y `semaforo`
en `valores`: indexar el reparto por el grupo normalizado hace que `filters`
pise a `style` y todo Estilo se anuncie como Filtros. Se indexa por el nombre
crudo, que es único por pestaña.

## 8. Cómo retomar — arnés de medición y trampas (2026-08-11)

Lo que sigue existe porque en esta sesión reporté **cuatro conclusiones falsas
seguidas**, todas del mismo tipo: medir un proxy en vez del dato. Cada una costó
varias corridas. Están aquí para no repetirlas.

### El arnés que funciona

**Render en proceso** (no por job `callr`), que es lo que permite instrumentar:

```r
sid <- load_pulso("<ruta>.pulso")$session_id
cfg <- session_get(sid)$graficos_config
sc  <- .graficos_processing_sources(sid)
pres <- .build_presets(.enriquecer_presets(cfg$presets, cfg$debug_ph))
slides_r <- .graficos_job_rebuild_slides(
  .graficos_calificar_refs_plan(.normalize_plan(cfg$plan), .graficos_active_base_name(sid)),
  setNames(lapply(.slide_names(), function(nm)
    list(grafs = setdiff(.slide_slots(nm), "icono"))), .slide_names()),
  .graf_names(), .graficos_icon_registry(sid, cfg),
  report = function(...) NULL, base_error = function(m) m, item_label = "slide")
reporte_ppt_plan(data = sc$data_sources, instrumento = sc$inst_sources,
  path_ppt = out, presets = pres, plan = p_plan(slides = slides_r),
  template_pptx = NULL, template_id = NULL,
  auto_otros_slides = FALSE, mensajes_progreso = FALSE)
```

**Instrumentar un graficador** — con `trace()`, NUNCA con un envoltorio propio:

```r
trace("graficar_barras_apiladas", where = asNamespace("prosecnurapp"),
      print = FALSE, tracer = quote({ ...capturar del environment()... }))
```

### Las cuatro trampas, con su síntoma

1. **Un envoltorio con sólo `...` rompe el render.** El renderer filtra los
   argumentos contra `formals(fun)`; sin formals no filtra y la llamada revienta
   con «unused arguments». Lo reporté como «láminas degradadas del producto» y
   era mío. `trace()` conserva la firma; un `function(...)` no.
2. **El banco forzaba `auto_otros_slides = TRUE`** cuando el default es `FALSE`.
   Se estuvo validando un mazo distinto del que produce la app.
3. **Clasificar texto por posición miente.** Medir «tamaños de etiqueta» por
   coordenada metió títulos de lámina y notas de base en el mismo saco y produjo
   E-9, un defecto que no existía. Lo real se ve trazando qué recibe cada rol.
4. **`var_categoria` no es la columna de la etiqueta**; el texto que se dibuja
   sale de `var_etiqueta_categoria`. Y el dato guarda **códigos**, no etiquetas:
   las etiquetas viven en las choices del instrumento.
5. **Persistir no es aplicar.** Verifiqué que `orden_categorias_manual` quedaba
   guardado y lo di por «verificado de punta a punta». No llegaba al motor: el
   constructor del elemento lo tiraba. Un valor guardado y visible en pantalla
   no prueba nada sobre el entregable — la prueba es el render.
6. **El XML del `.pptx` no ve dentro del gráfico.** Cada gráfico se incrusta
   como imagen: porcentajes, leyendas y colores de barra no son texto y no se
   pueden contar ahí. Medir «cuántos porcentajes quedaron ilegibles» por XML da
   0 siempre. Eso se juzga en la PNG.
7. **El `sid` del bootstrap no es el del navegador.** Abrir por deep-link
   `?pulso=` crea una sesión nueva; el backend es un kv-store por `sid`, así que
   leer con el `sid` equivocado devuelve otro proyecto, no un estado viejo. El
   del navegador está en `localStorage["pulso.sessionId"]`. Y si el plan es «un
   informe conjunto», el autosave escribe en `/api/graficos/consolidado/draft`,
   no en `/api/graficos/config`. Ambas cosas me hicieron reportar «no persiste»
   sobre algo que sí persistía.

Regla que sale de todo esto: **un aserto que no distingue el caso bueno del malo
no verifica nada**. Cada medición debe incluir su control — si declarar y no
declarar dan el mismo resultado, la medición está ciega.

### Estado para continuar

El control de orden de barras (`d01a819d`) **ya se vio en pantalla** y funciona
de punta a punta; el detalle está en E-13. En el camino salió E-14, el buscador
de ajustes que contaba lo que no podía mostrar, también reparado y verificado.

Lo que manda para retomar está en **§5bis**: el bloque de una multilista es una
unidad configurable con `overrides` y `altura_rel` propios, y le falta
superficie en la UI. Ese es el trabajo con más rendimiento pendiente.

Lo siguiente por orden: los **enunciados que se pisan** (láminas 24, 30, 62, 66)
y los **31 truncados**. El recorte NO está bloqueado por ningún archivo
congelado — vive en `graficador_helpers_titulos_grupo.R`, que es archivo propio.

Servers de la sesión: backend 8806 (proyecto CONFIGURADO) y frontend 5173.
`.claude/launch.json` apunta el 8806 al `.pulso` **CONFIGURADO**, que es el que
lleva declarado el Top 2 Box.
