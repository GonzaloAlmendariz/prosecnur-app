# Validación — ¿el motor reproduce el informe de acreditación 2021?

**Fecha**: 2026-08-10 · **Vara**: `2021_Informe_Consolidado Final.pptx` (35 láminas, 21 charts OOXML)
**Datos**: `api/inst/reference_projects/acrconta/acrconta.pulso` (proyecto de referencia, anonimizado)

Documento vivo. Registra lo medido, no lo aparentado: cada fila sale del XML
del deck y del PPTX que produce el motor, o de medir el render en píxeles.

## Cómo se midió

- **Deck**: parseo directo de `ppt/charts/chart*.xml` y `ppt/slides/slide*.xml`.
- **Motor**: los rasgos tipográficos y de color, del XML del PPTX generado; el
  grosor y la separación de barras, midiendo bandas de color sobre el render a
  150 dpi y convirtiendo a cm con el ancho de lámina (33,87 cm).
- El `gapWidth equivalente` del motor no se lee de ningún campo: se deriva de
  `(paso − alto) / alto × 100`, que es la definición de OOXML. Así las dos
  columnas hablan de lo mismo.

## Resultado por tipo de lámina

| Tipo | En el deck | Motor | Estado |
|---|---|---|---|
| **A — Escala / Top Two Box** | láminas 5–6 | `p_slide_top_two_box()` | ✅ Reproduce |
| **B — Batería vertical de N filas** | 8, 12–15, 18–23 | `p_barras_multiapiladas(modo="var")` | ✅ Reproduce |
| **C — Dos bloques por lámina** | 9–11 | `modo="multilista"` | ⚠️ Datos correctos, layout con defecto abierto |
| **D — Radar comparativo** | 16–17 | `p_radar_publicos()` | ⏳ No validado todavía |

## Tipo B — batería (el caso principal)

| Rasgo | Deck 2021 | Motor | |
|---|---|---|---|
| Separación entre barras | `gapWidth 74` | **74** (medido: alto 0,99 cm, paso 1,72 cm) | ✅ |
| Constante con N filas | sí (74 con 1 y con 11 filas) | sí | ✅ |
| Título de lámina | 24 pt bold `C00000` | 24 pt `C00000` | ✅ |
| % dentro de la barra | 14 pt `002060` | 14 pt `002060` | ✅ |
| Rampa ordinal | `F4B183 FFD966 B0D597 8FC36B` | los cuatro presentes | ✅ |
| Semáforo Top 2 Box | ≥80 `80C535` · 70–79 `FFC000` | los tres, con rojo añadido | ✅ |
| Formato numérico | `###0%` sin decimales | `decimales = 0`, medio punto arriba | ✅ |
| Leyenda por lámina | ninguna (se declara una vez) | ninguna | ✅ |
| Ejes | ambos `delete=1` | sin ejes | ✅ |
| Base al pie | no la hay | `Base: 170 (respuestas válidas)` | ➕ propio |
| Etiquetas que no caben | 62 de 91 movidas **a mano** | reposicionadas solas, con conector | ➕ propio |

El alto de barra difiere (0,99 cm contra 1,18 cm del deck con 6 filas) porque
el frame del motor es algo más corto; la **proporción** —que es lo que se ve—
es la misma.

## Tipo C — dos bloques por lámina

**Datos: correctos** desde el fix de la exclusión en subbloques.

    antes:  53% / 40% / 1%(SIN INF)  → Top 2 Box 93% y 91%
    ahora:  54% / 40%                → Top 2 Box 94% y 96%
    tipo B: 54% / 40%                → Top 2 Box 94% y 96%   ✓ coinciden

**Layout: defecto abierto.** Los enunciados de filas vecinas se encabalgan, y
`gapWidth equivalente` da 131 en vez de 74. Diagnóstico hasta donde llegó:

1. En modo `var` dentro de un bloque, el título de fila sale de
   `.title_of_var(v)` —el label completo de la variable— y no del
   `titulos_grupo` que declara el plan. Declarar enunciados breves (como hace
   el deck: «Las decisiones de las autoridades son justas») no tuvo efecto.
2. Con el label completo, el texto mide ~1,9 cm y el paso entre filas ~1,35 cm:
   la colisión es aritmética.
3. `needs_tall_label_slot` reserva alto extra, pero exige ≥5 líneas y estos
   enunciados tienen 3–4. **Bajar el umbral a 3 se probó y se revirtió**: no
   resolvió la superposición y adelgazó la barra de 0,99 a 0,38 cm
   (`gapWidth` 288). El síntoma no estaba ahí.

Queda como trabajo siguiente. Nota importante: el deck 2021 usa enunciados
**editorialmente abreviados**, no el texto completo del instrumento. Parte de
la diferencia es de contenido, no de motor — pero el punto 1 es un defecto real
del motor y hay que cerrarlo antes de dar el tipo C por bueno.

## Tipo D — radar

Medido en el deck y pendiente de generar con el motor:

| Rasgo | Deck 2021 |
|---|---|
| `radarStyle` | `marker` |
| Series | 3 (un público cada una) |
| Grosor de línea | 25 400–28 575 EMU (2 a 2,25 pt) |
| Colores de serie | `002060`, `FFC000`, tema |
| Leyenda | abajo (`legendPos b`) |
| Eje de categorías | visible, 11 pt |

## Decisión de arquitectura relacionada

El motor emite formas y no charts nativos OOXML. Está evaluado con prototipo y
cerrado en el [ADR 0071](../adrs/0071-el-grafico-nativo-cuesta-el-reposicionamiento-de-etiquetas.md):
`mschart` reproduce el XML del deck rasgo a rasgo, pero PowerPoint no mueve una
etiqueta que no entra y eso devolvería a mano el trabajo que el motor elimina.

## Cómo reproducir

```r
pkgload::load_all("api")
st <- load_pulso("api/inst/reference_projects/acrconta/acrconta.pulso")
s  <- session_get(st$session_id)
# plan con los tipos A, B y C; ver el cuerpo en el commit que trajo este doc
reporte_ppt_plan(data = s$rp_data, instrumento = s$rp_inst, plan = plan,
                 presets = presets_acreditacion(esc), path_ppt = "validacion.pptx")
```
