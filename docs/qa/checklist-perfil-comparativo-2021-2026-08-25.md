# Checklist — perfil comparable 2021 vs 2026 (ACRD CONTA)

**Pedido**: hacer comparables las variables de perfil contra el 2021, con el 2021 en barras grises.
**Fuente del 2021**: `ACRD CONTA/Matriz-2.xlsx`, hojas `* comparativo` (porcentajes ya calculados; no hay microdatos 2021).
**Proyecto**: `ACRD CONTA/v5_Conta 14-08 equivalencias.pulso` (66 láminas; perfil en las 6 láminas `p_slide_4_graficos_poblacion`).
**Decidido con Gonzalo (2026-08-25)**: dos barras por categoría — 2026 en azul institucional, 2021 en gris —, y se agrega
«Su puesto pertenece a» al cuadrante libre de administrativos.

## Dónde vive cada cosa

| Pieza | Dónde |
|---|---|
| Motor que dibuja el perfil | `api/R/graficador_barras_agrupadas.R` (`graficar_barras_agrupadas`) |
| Quien arma sus datos | `.render_barras_agrupadas` en `api/R/reporte_plan_ppt.R` — **congelado**, no se toca |
| Precedente del mismo problema | `api/R/graficos_top2box_comparativo.R` — el histórico se declara en el plan, no se calcula de otra base |
| Declaración por lámina | `graficos_config$plan$slides[[i]]$payload$<cuadrante>$args$overrides` del `.pulso` |

## Estado del motor al empezar

`graficar_barras_agrupadas` ya sabe dibujar N series con color por serie (`cols_porcentaje`, `etiquetas_series`,
`colores_series`). Lo que **no** existe es una puerta para inyectar una serie cuyos valores no salen de la base:
el renderer construye una sola columna `pct` desde `freq_table_spss` y no hay ningún camino declarativo.
Grep de `comparativo` sobre `graficador_barras_agrupadas.R`: cero coincidencias.

## Ítems

Proyecto resultante: `ACRD CONTA/v6_Conta 2021-2026 comparativo.pulso` (el v5 queda intacto).

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| M1 | Puerta declarativa `comparativo` en el motor de barras agrupadas | `api/R/graficos_barras_comparativo.R` + formal en `graficador_barras_agrupadas.R` | **hecho** |
| M2 | Test de regresión del motor | `api/tests/testthat/test-graficos-barras-comparativo.R` — 42 pass | **hecho** |
| M3 | La cifra que no entra en la barra al partirse en dos (defecto que abrió M1) | `.barras_comparativo_size_cifra()` | **hecho** |
| M4 | Aviso cuando una categoría del histórico no resuelve contra ninguna barra | `.barras_comparativo_normalizar()` | **hecho** |
| M5 | Guarda de legibilidad del color de la ola anterior | `.barras_comparativo_avisar_contraste()` | **hecho** |
| M6 | La leyenda nombraba las series al revés de como se dibujan | `invertir_leyenda` con comparativo | **hecho** |
| M7 | El dodge no entraba en la cuenta del alto y la cifra se salía de su barra | `.barras_comparativo_size_cifra(dodge=)` | **hecho** |
| M8 | El aire entre categorías se aprovecha con dos series (dodge 0,70 → 0,90) | `width_dodge_eff` | **hecho** |
| M9 | El panel se calcula descontando el cromo real, no con una fracción adivinada | `.barras_comparativo_size_cifra(header_in, legend_in, caption_in)` | **hecho** |
| M10 | Cabecera y leyenda recortadas a lo que su texto necesita (0,756 y 0,750 → 0,422) | `.barras_comparativo_header()` | **hecho** |
| M11 | Las dos barras de una categoría van pegadas; el aire queda entre categorías | `.BARRAS_COMPARATIVO_DODGE` + grosor igualado al dodge | **hecho** |
| M12 | **Los tres paneles de `poblacion_3` salían rotados una posición** | contrato en `reporte_plan_helpers.R` + `test-ppt-contrato-poblacion-3.R` | **hecho** |
| M13 | Los cuatro huecos de `poblacion_4` recuperan el aire muerto de la lámina (2,565 → 2,82 in) | contrato por coordenadas + `.POBLACION_4_ALTO_SLOT_IN` | **hecho** |
| M14 | La marca «(respuestas válidas)» deja de anexarse por defecto | `.REPORTE_PLAN_BASE_MARCAR_REDUCIDA` en `reporte_plan_base_criterio.R` | **hecho** |
| E1 | Estudiantes · Sexo (`p5`) ← 41 / 59 | slide `s-fc9xh146` sup-izq | **hecho** |
| E2 | Estudiantes · Rango de edades (`p3_recod`) ← 47 / 41 / 7 / 5 | `s-fc9xh146` inf-izq | **hecho** |
| E3 | Estudiantes · Nivel curricular (`p6`) ← 17 / 22 / 13 / 14 / 13 / 21 | `s-fc9xh146` sup-der | **hecho** |
| D1 | Docentes · Sexo (`p5`) ← 67 / 31 | `s-gfzbp621` sup-izq | **hecho** |
| D2 | Docentes · Rango de edades (`p4_recod`) ← 19 / 19 / 19 / 44 | `s-gfzbp621` inf-izq | **hecho** |
| D3 | Docentes · Departamento académico (`p7`) ← 90 / 4 / 4 / 2 | `s-gfzbp621` sup-der | **hecho** |
| G1 | Egresados · Sexo (`p5`) ← 35 / 65 | `s-vrp6di4s` sup-izq | **hecho** |
| G2 | Egresados · Rango de edades (`p4_recod`) ← 50 / 43 / 5 / 3 | `s-vrp6di4s` inf-izq | **hecho** |
| G3 | Egresados · Máximo grado (`p7`) ← Bachiller 100 | `s-vrp6di4s` inf-der | **hecho** |
| G4 | Egresados · ¿Cuenta con título? (`p8`) ← 41 / 59 | `s-ml5sv1z4` sup-izq | **hecho** — torta → barras |
| G5 | Egresados · Tiempo primer trabajo (`p10`) ← 71 / 10 / 8 / 6 / — / 3 | `s-ml5sv1z4` sup-der | **hecho** |
| G6 | Egresados · ¿Se encuentra trabajando? (`p11`) ← 89 / 11 | `s-ubhvx42k` sup-izq | **hecho** — torta → barras |
| G7 | Egresados · Trabajo relacionado (`p12`) ← 95 / 5 | `s-ubhvx42k` inf-izq | **hecho** — torta → barras |
| A1 | Administrativos · Sexo (`p4`) ← 18 / 82 | `s-dqc4y5vx` sup-izq | **hecho** |
| A2 | Administrativos · Rango de edades (`p3_recod`) ← 6 / 41 / 24 / 29 | `s-dqc4y5vx` inf-izq | **hecho** |
| A3 | Administrativos · Años trabajando (`p5_recod`) ← 35,3 / 23,5 / 41,2 | `s-dqc4y5vx` sup-der | **hecho** |
| A4 | Administrativos · «Su puesto pertenece a» (`areadetrabajo`) ← 76,5 / 23,5 — variable nueva | `s-dqc4y5vx` inf-der | **hecho** |
| V1 | Render y revisión visual de las 6 láminas | `perfil_v6d.pptx`, exportado por la API real | **hecho** |
| V2 | Guías magenta de layout apagadas (`debug_ph`) | config del proyecto | **hecho** |
| V3 | Las tres tortas convertidas a barras agrupadas | `s-ml5sv1z4` sup-izq · `s-ubhvx42k` sup-izq e inf-izq | **hecho** |
| V4 | Cuadrantes de relleno vaciados (Sexo duplicado y el rótulo que mentía) | `s-fc9xh146` · `s-ml5sv1z4` · `s-ubhvx42k`, inf-der | **hecho** |
| V5 | Las tres láminas de 3 gráficos pasan a `p_slide_3_graficos_poblacion`, con la variable de más categorías en el panel alto | `s-fc9xh146` (Nivel curricular) · `s-ml5sv1z4` (Tiempo primer trabajo) · `s-ubhvx42k` (Sueldo) | **hecho** |
| V6 | La cifra de las barras, igual en todo el mazo: 12 pt | `presets$base$args$size_texto_barras` del `.pulso` | **hecho** |
| V7 | Todos los tramos declarados a mano en ascendente (menos estudiantes, que ya lo estaba) | `s-dqc4y5vx` (años trabajando, edades) · `s-vrp6di4s` · `s-gfzbp621` | **hecho** |

**G4, G6 y G7 eran tortas.** Una torta dibuja una sola distribución y no tiene dónde poner la ola anterior. Gonzalo
pidió convertirlas (2026-08-25): pasan a `p_barras_agrupadas` con la geometría de los cuadrantes de barras vecinos de
su misma lámina, y el `textos_negrita` cambia de «etiquetas» (el token del pie) a «valores» (el de barras).
Las tres calculan sobre respuestas válidas: 178, 176 y 172.

## Lo que el trabajo destapó en el motor

Tres defectos que solo aparecen al pedir dos series, y que la lámina de perfil monocroma tapaba:

1. **La cifra no entra en la barra.** El perfil declara `preservar_tamanos_texto = TRUE` y 13,9 pt; al partirse la
   categoría en dos, seis categorías dejan barras de 9,5 pt y el texto se monta sobre la vecina. La escala existente
   (`n_series <= 2 ~ 1.00`) no reduce nada con dos series, y `preservar_tamanos_texto` no reduce nunca.
   Reparado midiendo contra el alto del **cajón** (`alto`, 2,565 in), no contra el nominal.
2. **El nominal miente.** `n_categorias * alto_por_categoria` da 6,12 in donde hay 2,565, y `canvas_h_panel_in` llega
   `NULL` siempre en PPT. Con el nominal la cuenta dice que todo entra y en el render se solapa. Es la misma trampa
   documentada para las etiquetas de eje de la lámina 13.
3. **La leyenda nombraba las series al revés de como se dibujan.** En horizontal el eje va volteado: la serie
   declarada primera se dibuja abajo de su grupo mientras la leyenda la nombra primera. El lector veía gris arriba y
   leía «2026, 2021». Se invierte la leyenda con comparativo, lo que además deja el orden cronológico.
4. **El aire entre grupos no entraba en la cuenta.** `width_dodge` vale 0,70, así que la barra real es un 30 % más
   baja de lo que suponía el cálculo: la cifra «cabía» y salía montada sobre el borde de su propia barra («Rango de
   edades», 47 % y 43 %). Ahora el dodge entra en la fórmula y, con dos series, se aprieta a 0,90 —ese aire era lo
   único que sobraba— para que cada barra gane un 29 % de alto.
5. **Blanco sobre gris claro no está.** `graficador_barras_agrupadas.R` nunca usó
   `graficador_contraste_texto.R` porque hasta ahora todas sus barras eran oscuras. Resuelto por el lado del color de
   barra (`#808080`, el gris más claro bajo el umbral 0,52 de la casa) para conservar la cifra blanca en las dos
   series, con una guarda que avisa si alguien declara un gris que la vuelva ilegible.

## De dónde salió el alto, y el límite que queda

El cajón de un cuadrante mide 2,565 in y el motor lo reparte como `alto − cabecera − leyenda − pie`. Medido con
`trace()`: cabecera 0,756, leyenda **0,750**, pie 0 → panel **1,393 in**. La leyenda pesaba más que la cabecera para
una sola línea de texto, y las dos juntas se llevaban el 59 % del cajón.

Recortadas ambas a lo que su texto necesita (0,422 cada una), el panel pasa a **1,721 in, un 24 % más**. Con eso las
barras engordan y la cifra deja de tocar sus bordes. La otra ganancia fue el aire entre grupos (`width_dodge`
0,70 → 0,90, +29 % de alto por barra).

**Lo que no se puede empujar más**: seis categorías en dos series son doce barras de 9,9 pt de alto. Una cifra de
13,9 pt no entra ahí; en «Nivel curricular» queda en 7,4 pt, más chica que la etiqueta del eje. Bajar de ahí exige
una decisión editorial —menos categorías, o darle a ese cuadrante más de un cuarto de lámina—, no más ajuste de
motor.

**Y una lección de método**: las tres veces que estimé el panel con una fracción (0,62 → 0,73) la erré, la última por
un 34 %, y el síntoma siempre fue el mismo: la cuenta decía que la cifra cabía y en el render salía montada sobre el
borde de su barra. Se resolvió midiendo el reparto dentro del motor con `trace()`, no ajustando la fracción.

## El layout de tres, y el defecto que destapó

`p_slide_3_graficos_poblacion` ya existía para exactamente este caso —su propia descripción dice que «el alto es para
la variable con más categorías»— y las tres láminas que quedaron con tres gráficos pasaron a él. Con el panel alto,
«Nivel curricular» (6 categorías) y «Sueldo mensual bruto» (6) dejan de necesitar reducción de cifra: salen a los
13,9 pt declarados.

Al migrarlas apareció un defecto **preexistente del motor**: los tres paneles salían **rotados una posición** —lo
declarado `superior_izquierda` aterrizaba en el panel alto de la derecha—. La causa está en el contrato
(`reporte_plan_helpers.R`), que mapeaba los slots a los `pic` del layout por analogía con `poblacion_4`:

```
                     contrato decía    plantilla real (officer::layout_properties)
  pic 1              izquierda arriba  DERECHA, alto doble (offx 7.78, cy 5.34)
  pic 2              izquierda abajo   izquierda arriba    (offx 0.51, offy 1.33)
  pic 3              derecha alto      izquierda abajo     (offx 0.50, offy 4.11)
```

En `poblacion_4` el orden del layout sí es el de lectura, y de ahí salió el supuesto. Nadie lo había medido porque
este mazo es el primero que usa el layout de tres. Corregido y fijado con `test-ppt-contrato-poblacion-3.R`, que
comprueba los dos contratos contra la geometría medida.

**Riesgo a vigilar**: si algún proyecto existente usaba `poblacion_3` y alguien compensó la rotación a mano
reordenando sus slots, esta corrección se la invierte. No se encontró ninguno, pero conviene mirarlo si aparece un
mazo viejo con ese layout.

## Docentes y administrativos: por qué NO cambian de layout

Tienen **cuatro** gráficos y `p_slide_3_graficos_poblacion` admite tres; ningún layout de la plantilla ofrece cuatro
paneles con uno alto (medido: `poblacion_4` son cuatro de 2,56 iguales; `poblacion_5` y `_6` bajan a 2,05). Pasarlas
al de tres exigiría mover un gráfico a otra lámina, que es una decisión editorial, no un ajuste.

No hizo falta: estirando los huecos de `poblacion_4` a 2,82 in —el aire que la lámina ya tenía sin dibujar— la cifra
de 12 pt entra en todos sus cuadrantes salvo los de cuatro categorías, que quedan en 11,6. Medido:

| alto del hueco | 3 categorías | 4 categorías | 5 categorías |
|---|---|---|---|
| 2,565 (plantilla) | 12,0 | 10,0 | 8,0 |
| **2,82 (nuevo)** | **12,0** | **11,6** | 9,4 |
| 2,90 | 12,0 | 12,0 | 9,6 — **no cabe en la lámina** |

El techo es la lámina: el título termina en 1,10 y la banda de la base empieza en 6,91, así que dos filas de 2,82
dejan 0,11 in de gap y 0,04 de margen. No hay de dónde sacar más.

Cuadrantes de 5+ categorías con comparativo solo existen en las láminas ya migradas al panel alto, donde entran a
12 pt. «Año de egreso» tiene 5 pero no tiene dato 2021: una sola serie, sin reducción.

## La marca «(respuestas válidas)», revertida

Gonzalo preguntó por qué el pie decía «Base: 176 egresados (respuestas válidas)» cuando el entregable del 14-08 dice
«Base: 178 egresados». Rastreado:

| Versión | Pie de la misma lámina |
|---|---|
| Entregado 14-08 | `Base: 178 egresados` |
| v5 original, sin tocar | `Base: 176 respuestas` |
| v6 antes de revertir | `Base: 176 egresados (respuestas válidas)` |

**El 176 ya venía del v5**: no lo introdujo esta tanda. Lo que cambió fue el sufijo, como efecto de convertir esa
torta a barras — cada graficador rotula la base por una ruta distinta, y la de barras aplicaba la marca editorial
B56/W-8.

La marca se revierte por decisión del dueño de entregables: **«la base ya dice cuando hay menos»**. Y es cierto —el
defecto que B56 decía reparar (dos bases distintas leídas como errata) lo resuelve la CIFRA, que es distinta; la
marca repetía en palabras lo que el número ya decía, en el único renglón de la lámina donde no sobra espacio. El
propio `test-reporte-plan-actor-bases.R` lo ilustra: «Base: 12» y «Base: 24» conviven y se distinguen solas.

No se borró el mecanismo: la DETECCIÓN de base reducida (exclusión, no-respuesta, filtros, prorrateo multiactor) es
la parte cara y sigue probada; lo que cambió es el default (`marcar = FALSE`). Reactivable con `marcar = TRUE`.

**Nota**: el entregado del 14-08 rotulaba `Base: 178` mientras sus porcentajes salían de 176, 172 y 167 —un rótulo
que promete otro número—. El pie de ahora dice el denominador real sin adjetivarlo.

| Pregunta | Válidas | Sin respuesta |
|---|---|---|
| ¿Se encuentra trabajando? | 176 de 178 | 2 |
| Trabajo relacionado a Contabilidad | 172 de 178 | 6 |
| Sueldo mensual bruto | 167 de 178 | 11 |

## Tramos desordenados: viene del instrumento

El motor dibuja las categorías en el orden de la hoja `choices`, y cuatro de las cinco listas de tramos no siguen el
orden del tramo:

| Base | Lista | Orden en `choices` | Veredicto |
|---|---|---|---|
| Administrativos | `lst_p5_recod` | [2] 11-20 · [1] 1-10 · [3] 21+ | aleatorio → **ordenado a mano** |
| Administrativos | `lst_p3_recod` | [2] 36-45 · [1] 26-35 · [3] 46-55 · [4] 56+ | aleatorio → **ordenado a mano** |
| Egresados | `lst_p4_recod` | [3] 30-35 · [1] 22-25 · [2] 26-29 · [4] 36+ | aleatorio → **ordenado a mano** |
| Docentes | `lst_p4_recod` | [4] 51+ · [3] 41-50 · [2] 31-40 · [1] 18-30 | descendente → **ordenado a mano** |
| Estudiantes | `lst_p3_recod` | [1] 19-21 · [2] 22-25 · [3] 26-30 · [4] 30+ | ya ordenado |

El de docentes se había respetado por ir en descendente entero —parecía decisión editorial y no descuido—. No lo
era: «en realidad todos los de edades, menos estudiantes». Los cuatro van ahora en ascendente.

**Trampa al declararlos**: el orden manual empareja por cadena EXACTA (`intersect`), y lo que no empareja se va al
final SIN avisar. La etiqueta de docentes es «De 31 a  40 años», con DOBLE espacio en el instrumento. El script
verifica cada etiqueta declarada contra las `choices` reales de esa variable antes de escribir nada, y aborta con la
lista de las reales; comprobado con un espacio simple, que lo caza.

Se arregla en el plan (`orden_barras = "manual"` + `orden_categorias_manual`, ambos por `overrides`) y no en el
instrumento: el instrumento es el insumo del cliente y tocarlo movería también codificación y tablas.

El comparativo no se ve afectado por el reorden — alinea por etiqueta de categoría, no por posición.

## Sin dato 2021 — quedan monocromas (no es omisión)

Docentes: Dedicación docente, Máximo grado alcanzado. Egresados: Año de egreso, Año de título, Sueldo mensual bruto.
La matriz los trae vacíos en la columna 2021.

## Lo aprendido investigando (para no reinvestigarlo)

1. **La `Matriz-2.xlsx` trae tres celdas corrompidas** en `Administrativos comparativo`, todas en la columna del 2021:
   - Fila 9, opción `46296` → es `1-10` leído por Excel como fecha (serial 46296 = 2026-10-01).
   - Filas 11-12, valores `76470.59` y `23529.41` → son `0,7647` y `0,2353` multiplicados por 100 000.
     Cuadran exacto con 13/17 y 4/17. Los ítems A3 y A4 usan los valores corregidos.
2. **Los tramos de edad de estudiantes no son idénticos entre olas**: la matriz 2021 rotula `18-21` y `31 a más`;
   el instrumento 2026 rotula `De 19 a 21 años` y `De 30 años a más`. Se comparan como equivalentes porque así
   viene la matriz del cliente, pero el corte del tramo cambió.
3. **Los porcentajes 2026 de la matriz cuadran con la base** en las 17 variables verificadas: la matriz no está
   desfasada respecto del `.pulso` v5.
4. **`areadetrabajo` existe en la base de administrativos y en el instrumento** (`lst_areadetrabajo`: Facultad /
   Departamento Académico) pero no estaba en ninguna lámina; el cuadrante inferior derecho apuntaba a
   `docentes$p5` y salía vacío.
5. **Las variables de perfil viven en la data adaptada**, no en los `.sav`: los `.sav` traen `q0005`, la adaptada
   trae `p5`. Un cuadrante de perfil se resuelve contra la adaptada de su base.

## Hallazgos fuera de alcance (no se tocan en esta tanda)

- `s-ml5sv1z4` inferior-derecha declara `p_pie` con título «¿Se encuentra trabajando?» apuntando a `egresados$p5`,
  que es Sexo. El título promete un número que la variable no da, y la pregunta de verdad vive en la lámina siguiente
  (`s-ubhvx42k` sup-izq). Verificado: no se ve en el entregable porque el icono ocupa ese espacio.
- Tres cuadrantes de relleno apuntan a variables ajenas a su lámina (`s-fc9xh146` inf-der → `estudiantes$p5`;
  `s-ubhvx42k` inf-der → `egresados$p5`; `s-dqc4y5vx` inf-der → `docentes$p5`). Salen vacíos porque no tienen
  `overrides`, pero la declaración es engañosa. A4 repara el de administrativos.
- El audit de congelados llega en rojo desde antes de esta tanda: `calc_muestra_aulas.R` (+36) y
  `CalcMuestraPage.tsx` (+66), de la rama `rescate/graficos-lote-nueve`. No es de este trabajo.
- `test-graficador-alto-y-leyenda.R:173` falla desde antes (`.reporte_plan_multiactor_canvas_defaults()$canvas_w_etiquetas`
  da 0,10 contra 0,17 esperado). Comprobado revirtiendo el graficador a HEAD: 39 pass / 1 fail en los dos casos. Es de
  multiactor, no de barras agrupadas.
- **Los cuadrantes de relleno no llegan al cliente.** Comprobado contra `Informe Contabilidad 14-08.pptx` (láminas 12 y
  13): ahí el cuarto espacio lo ocupa el ICONO de la lámina y no se dibuja ningún cuarto gráfico. En los exports de
  revisión de esta sesión sí aparecen —«Sexo» de egresados, una vez como torta rotulada «¿Se encuentra trabajando?» y
  otra como barras sin título— porque el `.pulso` no guarda iconos y el motor avisa que la lámina se generó sin él.
  O sea: el rótulo mentiroso de `s-ml5sv1z4` inf-der es una declaración engañosa en el plan, no un defecto visible.
  Sigue conviniendo limpiarla, porque cualquiera que suba o cambie el icono la destapa.
