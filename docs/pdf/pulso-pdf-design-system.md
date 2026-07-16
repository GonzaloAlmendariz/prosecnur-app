# Sistema de diseño "Pulso PDF"

> Capa estética + primitivas reutilizables para todos los motores de PDF de la app.
> **No es una plantilla rígida.** Se estandariza la *familia* (paleta, cabecera/pie,
> logo, tipografía, reglas, estilo de tablas, calibración de ancho); el *layout de
> contenido* lo compone cada motor según su propósito.

Motor de referencia (gold standard): [`api/R/reporte_codebook_pdf.R`](../../api/R/reporte_codebook_pdf.R).
Kit compartido (opt-in para motores nuevos/refactorizados): [`api/R/pulso_pdf_theme.R`](../../api/R/pulso_pdf_theme.R).
Helpers de medición/wrap: [`api/R/reporte_formulario_pdf.R`](../../api/R/reporte_formulario_pdf.R)
(`.form_pdf_text`, `.form_pdf_wrap`, `.form_pdf_lines_height`).

---

## 0. Vía técnica

- **`grDevices::pdf()` + `grid`**, coordenadas en `npc` (0–1). Nada de HTML/LaTeX/Chrome.
- `png` es **soft-dependency** (solo para el logo) con fallback textual "PULSO PUCP".
- **Cero dependencias externas nuevas.** Solo paquetes ya en `api/DESCRIPTION` Imports.
- Quarto (`reporte_enumeradores.R`, `reporte_muestra_territorial.R`, `reporte_calc_muestra.R`,
  `reporte_manuales.R`) depende del **CLI de Quarto** — riesgoso en app empaquetada.
  **Evítalo para motores nuevos.**

---

## Dos capas

### (a) Capa estandarizable — la "familia" (normativa)

Todo motor de PDF debería adoptar esto. Vive en `pulso_pdf_theme.R`.

#### Tokens de color — `pulso_pdf_tokens()`
| Token | Hex | Uso |
|-------|-----|-----|
| `navy` | `#002457` | Marca: títulos, reglas, énfasis. **Canónico** (coincide con `pulso_plotly_palette()$primary`). |
| `ink` | `#1f2933` | Texto principal. |
| `soft` | `#5f6b7a` | Secundario: subtítulos, códigos, periodo, nº pág. |
| `faint` | `#8792a2` | Terciario: notas tenues, ejes. |
| `rule` | `#d0d5dd` | Hairline de divisores. |
| `line` | `#d8e0ef` | Regla de cabecera/pie. |
| `tbl_header` | `#e9eef6` | Banda de encabezado de tabla. |
| `tbl_zebra` | `#f6f8fb` | Zebra de filas pares. |
| `tbl_frame` | `#c3ccdb` | Marco exterior + regla bajo encabezado. |
| `tbl_div` | `#c9d1de` | Divisor de columnas. |
| `success` `warn` `danger` | `#0f766e` `#b7791f` `#be123c` | Acentos **semánticos** (no decorativos), para dashboards. |

#### Escala tipográfica — `pulso_pdf_type()` (pt)
Título 15 bold navy · Subtítulo 9.5 soft · Sección 13 · Cuerpo 8.0 · Código/celda 7.8 ·
Pie 8.0 soft · Caption/KPI 6.4. Fuente: la por defecto del device (`Helvetica`).
`lineheight` ~1.05. **Texto alineado a la izquierda** (nada de justificado con "ríos").

#### Cabecera — `pulso_pdf_header(titulo, subtitulo, ...)`
Título (navy, bold) + subtítulo (soft) + **regla navy fina** (`lwd 1.1`) bajo la cabecera.
Parámetros expuestos: `titulo`, `subtitulo`.

#### Pie — `pulso_pdf_footer(page_no, periodo, ...)`
**logo Pulso-PUCP (izq) · periodo mes-año (centro, p. ej. "Julio 2026") · "Pág. N" (der) · hairline.**
El logo YA identifica a Pulso → el centro **NO** repite "Fuente: Pulso".

#### Logo — `.pulso_pdf_draw_logo(x, y, width_npc, geo, ...)`
Rutas candidatas: `system.file("hojas_ruta/assets/logo_pulso.png"|"www/pulso-pucp-logo.png", package="prosecnurapp")`
+ fallback `getwd()/api/inst/...`. **Corrección de aspecto** (imagen 1078×423):
```r
h_npc <- width_npc * (img_h / img_w) * (page_w / page_h)
```
El factor `page_w/page_h` es imprescindible: en una hoja no cuadrada `npc` no es
isométrico y sin él el logo se deforma. Se invierte solo/automáticamente por
orientación (portrait `8.27/11.69` vs landscape `11.69/8.27`).

#### Calibración de ancho — `pulso_pdf_chars(w_npc)`
~`w*150` char/npc a ~7.9pt: los caracteres-por-línea se calibran para **llenar** la
columna (antes se cortaba temprano dejando blanco a la derecha).

#### Parámetros estándar de todo motor
`titulo`, `subtitulo`, `periodo`, ruta de salida.

### (b) Capa particular — el layout de contenido (libre por motor)

**Esto NO se estandariza.** Cada PDF compone su propio layout:
- **Libro de códigos** → dos columnas + tablas Código|Etiqueta + índice con simulación
  de layout determinista (calcula la página de cada bloque antes de dibujar).
- **Avance de acreditación** (vertical) → KPIs + **avance diario** (combo barras+línea, doble eje).
- **Avance territorial** (apaisado) → dashboard con **mapa coroplético** + tarjetas por distrito.
- **Producción** → tarjetas de métrica + tablas.

> La **doble columna es del codebook, NO un default.** Un avance quiere dashboard
> apaisado, no dos columnas.

**Regla: hardcodear menos.** Si algo solo aplica a un PDF, vive en ese motor, no en el kit.

---

## Catálogo de patrones gráficos probados (reutilizables)

Patrones ya iterados que conviene conservar/reusar (su *esencia*, con libertad de elevarlos):

1. **Avance diario** (`draw_effective_trend`, `monitoreo_engine.R:~20396`): combo de barras
   verticales (nuevas efectivas) + línea acumulada con doble eje, checkpoints de lunes con
   guías punteadas y etiquetas selectivas. Densidad sin ruido (ticks `pretty()`, muestreo de fechas si n>28).
2. **Mapa de zonas aplicadas** (`draw_coverage_map`, `monitoreo_engine.R:~22430`): coroplético real
   con `sf`/geojson, capas ordenadas (contexto → activos → zonas → aplicadas verdes → contorno navy → labels),
   emparejamiento robusto por múltiples claves, labels con caja anti-solape.
3. **Panel de estado** con anillo de progreso + medidor de gradiente + rejilla de tiles.
4. **Tarjeta con franja de acento** (`rr()` roundrect + barra de acento izquierda): patrón común de KPI.
5. **Tabla estructurada** (`.codebook_pdf_draw_block`): banda de encabezado, zebra, marco, divisor,
   código alineado con la primera línea de la etiqueta.

---

## Trampas (obligatorio)

- **Locale UTF-8**: correr R con `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` (el parser falla con tildes en otro locale).
- **Aspecto del logo**: aplicar el factor `page_w/page_h` (ver arriba).
- **Char-per-npc**: calibrar para llenar el ancho, no cortar temprano.
- **Cero-deps**: solo paquetes en `api/DESCRIPTION` Imports.
- **Verificación por render a PNG**: `pdftoppm -png -r 110 -f N -l N archivo.pdf out` + inspección visual.
  **Nunca asumir** que "se ve bien".
- **No romper QA**: `api/tests/testthat/` + contratos `docs/qa/monitoreo/…` (p. ej. el PDF territorial
  cliente debe conservar `ENCUESTAS\n{efectivas}` por distrito y el total; ver
  `test-monitoreo-publish-qa.R`).

---

## Estado de alineación de los motores (jul 2026)

| Motor | Página | Header/Footer/Logo | Navy | Alineación |
|-------|--------|--------------------|------|------------|
| Libro de códigos | Vertical | Completos (logo PNG) | `#002457` | ★ Gold standard |
| Kit `pulso_pdf_theme` | Ambas | Completos (logo PNG) | `#002457` | ★ Referencia |
| Formulario XLSForm | Vertical | Logo = **texto** | navy textual | Parcial |
| Monitoreo acreditación | Vertical | Logo PNG; footer sin logo | `#002457` (outlier `#06346f` ya unificado; verificado 2026-07-15, sin rastro en `api/R/`) | Parcial |
| Monitoreo territorial | Apaisado | Logo PNG; footer "Fuente: …" | `#002457` | Parcial (reencuadrado a cuota) |
| Monitoreo producción | Vertical | Logo = **texto "PULSO"** | `#002457` hardcode | Parcial |
| Hojas de ruta | Mixta | Logo PNG | — | n/a (mapas) |

Oportunidades de alineación (no bloqueantes, ver plan): unificar navy de acreditación a `#002457`,
dar logo raster a producción, homogeneizar footer hacia logo·periodo·página.
