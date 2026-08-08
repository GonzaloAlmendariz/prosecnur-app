source("setup-load-all.R")

# LOS DEFAULTS VIVEN EN DOS CAPAS Y ESO ES DELIBERADO.
#
#   - El REGISTRY declara el default del PRESET: la identidad editorial de la
#     casa (tamaños, colores, geometría del canvas).
#   - La FUNCIÓN declara el default del motor desnudo: un fallback neutro para
#     quien la llama fuera del plan.
#
# Unificar las dos capas rompería el diseño: el preset existe justamente para
# sobrescribir al motor. Pero hay una clase de divergencia que sí es un defecto:
# la SEMÁNTICA, la que cambia QUÉ dice el gráfico y no cómo se ve. Ahí el motor
# sin preset produce una lámina distinta de la que la UI promete, y
# `reporte_ppt_plan()` acepta un plan sin presets (`presets %||% list()`), así
# que el camino existe.
#
# Este contrato congela la lista de divergencias semánticas conocidas. No las
# prohíbe: las declara. Si aparece una nueva, el gate falla y alguien decide si
# es deliberada.

.dmr_map <- list(
  barras_agrupadas = "graficar_barras_agrupadas",
  barras_categoricas = "graficar_barras_categoricas",
  barras_apiladas = "graficar_barras_apiladas",
  pie = "graficar_pie",
  donut = "graficar_pie",
  histograma = "graficar_histograma",
  boxplot = "graficar_boxplot",
  media_rango = "graficar_media_rango",
  radar_tabla = "graficar_radar",
  barras_numericas = "graficar_barras_numericas",
  serie_temporal = "graficar_serie_temporal"
)

# Args cuyo valor cambia QUÉ muestra el gráfico: qué cifra, qué forma, qué
# elementos aparecen y en qué orden. Lo demás (tamaños, colores, espaciados,
# geometría del canvas) es estilo y se espera que diverja.
.dmr_semanticos <- c(
  "formato_valor", "tipo_pie", "ordenar_categorias", "invertir_barras",
  "invertir_leyenda", "mostrar_barra_extra", "mostrar_n_sobre_barras",
  "mostrar_eje_y", "mostrar_tabla_derecha", "mostrar_valores",
  "mostrar_frecuencia", "mostrar_leyenda", "mostrar_puntos", "mostrar_media",
  "mostrar_rango", "escala_valor", "orientacion", "barra_extra_preset"
)

# Divergencias semánticas ACEPTADAS hoy, con su porqué. Cada entrada es
# "preset|arg" -> motivo.
.dmr_aceptadas <- c(
  "barras_agrupadas|invertir_barras" =
    "El preset invierte el orden para leer de mayor a menor arriba; el motor desnudo respeta el orden de los datos.",
  "barras_agrupadas|mostrar_barra_extra" =
    "El motor la trae encendida por su uso histórico fuera del plan; el preset la apaga porque la base vive en el slide (doctrina B36).",
  "pie|invertir_leyenda" =
    "El preset ordena la leyenda como el pie se dibuja; el motor no asume sentido de giro.",
  "pie|ordenar_categorias" =
    "El preset ordena por tamaño natural del sector; el motor respeta el orden recibido.",
  "pie|tipo_pie" =
    "El motor nace donut por su uso en grids densas; el preset del tipo `pie` lo devuelve a pie.",
  "barras_numericas|mostrar_n_sobre_barras" =
    "El preset muestra la base sobre cada barra (KPI comparativo); el motor desnudo no la asume.",
  "barras_numericas|mostrar_eje_y" =
    "Con la cifra sobre la barra el eje sobra, y el preset lo apaga; el motor lo deja.",
  "radar_tabla|mostrar_tabla_derecha" =
    "El preset `radar_tabla` es el radar CON tabla; el motor desnudo dibuja solo el radar (de ahí `p_radar`)."
)

.dmr_norm <- function(x) {
  if (is.null(x)) return(NA_character_)
  if (is.call(x) || is.symbol(x)) {
    d <- tryCatch(eval(x), error = function(e) NULL)
    if (is.null(d)) return(NA_character_)
    x <- d
  }
  if (!length(x)) return(NA_character_)
  paste(as.character(x[[1]]), collapse = "")
}

.dmr_divergencias <- function() {
  pr <- .PRESETS_META
  out <- character(0)
  for (k in names(.dmr_map)) {
    if (is.null(pr[[k]])) next
    fn <- tryCatch(get(.dmr_map[[k]], mode = "function"), error = function(e) NULL)
    if (is.null(fn)) next
    fml <- formals(fn)
    for (a in pr[[k]]$args) {
      nm <- as.character(a$name %||% "")
      if (!nzchar(nm) || !nm %in% .dmr_semanticos || !nm %in% names(fml)) next
      if (!("default" %in% names(a))) next
      d_reg <- .dmr_norm(a$default)
      d_mot <- .dmr_norm(fml[[nm]])
      if (is.na(d_reg) || is.na(d_mot)) next
      if (!identical(d_reg, d_mot)) {
        out <- c(out, stats::setNames(paste0(d_reg, " vs ", d_mot), paste0(k, "|", nm)))
      }
    }
  }
  out
}

test_that("ninguna divergencia semántica nueva entra sin declararse", {
  div <- .dmr_divergencias()
  nuevas <- setdiff(names(div), names(.dmr_aceptadas))
  expect_identical(
    nuevas, character(0),
    label = paste0(
      "Divergencia semántica no declarada entre el registry y el motor: ",
      paste(paste0(nuevas, " (", div[nuevas], ")"), collapse = "; "),
      ". Alinea el default del motor con lo que la UI promete, o declárala en ",
      "`.dmr_aceptadas` con su motivo."
    )
  )
})

test_that("no quedan divergencias declaradas que ya se resolvieron", {
  # Una excepción que sobrevive a su causa es ruido: hace pasar el gate por una
  # razón que ya no existe.
  div <- .dmr_divergencias()
  muertas <- setdiff(names(.dmr_aceptadas), names(div))
  expect_identical(
    muertas, character(0),
    label = paste0(
      "Estas divergencias ya no existen y sobran de `.dmr_aceptadas`: ",
      paste(muertas, collapse = ", ")
    )
  )
})

test_that("cada divergencia aceptada trae su motivo escrito", {
  expect_true(all(nzchar(trimws(.dmr_aceptadas))))
  expect_true(all(nchar(.dmr_aceptadas) > 30))
})

test_that("un grafico de porcentajes muestra porcentajes aunque no haya preset", {
  # El caso que disparó este contrato: el registry prometía "porcentaje" y la
  # función traía "valor", así que un render sin preset escribía "56" donde la
  # UI decía 56%.
  fml <- formals(graficar_barras_categoricas)
  expect_identical(eval(fml$formato_valor)[[1]], "porcentaje")

  reg <- NULL
  for (a in .PRESETS_META$barras_categoricas$args) {
    if (identical(a$name, "formato_valor")) reg <- a$default
  }
  expect_identical(as.character(reg), "porcentaje")
})

test_that("el valor Min-Max del registry existe de verdad en el motor", {
  # Elegir "Min-Max" en la UI abortaba el render: el registry decía `min_max` y
  # `graficar_media_rango()` espera `minmax`.
  opciones <- NULL
  for (a in .PRESETS_META$media_rango$args) {
    if (identical(a$name, "tipo_rango")) {
      opciones <- vapply(a$choices, function(ch) as.character(ch$value), character(1))
    }
  }
  expect_false(is.null(opciones))
  acepta <- eval(formals(graficar_media_rango)$tipo_rango)
  expect_true(all(opciones %in% acepta))
})

test_that("el alias del valor viejo sigue leyendose para no romper proyectos guardados", {
  # Quien ya eligió esa opción tiene `min_max` persistido en su `.pulso`; abrir
  # ese proyecto no puede reventar.
  skip_if_not_installed("ggplot2")
  df <- data.frame(
    g = rep(c("A", "B"), each = 20),
    v = c(seq(1, 20), seq(5, 24)),
    stringsAsFactors = FALSE
  )
  expect_no_error(
    graficar_media_rango(
      data = df, var_categoria = "g", var_valor = "v",
      mostrar_rango = TRUE, tipo_rango = "min_max", exportar = "rplot"
    )
  )
})
