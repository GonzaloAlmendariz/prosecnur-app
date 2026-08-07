# L6 / H36-H37 — `metrica` y `formato` de p_numerico eran fantasmas de motor.
#
# El registry declaraba las cuatro metricas (mean/median/N/pct) y un formato de
# salida, pero `.render_numerico()` calculaba `mean()` fijo y rotulaba la serie
# como "Media" pase lo que pase. El default declarado por el constructor era un
# tercero ("N", por el orden de `match.arg`): tres declaraciones distintas para
# la misma particula.
#
# Banco discriminante: ingreso con cola larga, donde media y mediana no pueden
# confundirse en ningun grupo (grupo 2: media 6320 vs mediana 1200).

make_numerico_fixture <- function() {
  ingreso <- c(rep(1000, 10), rep(1200, 6), 9000, 12000, 15000, 20000)
  dat <- data.frame(
    ingreso = ingreso,
    sexo    = c(rep("1", 10), rep("2", 10)),
    stringsAsFactors = FALSE
  )
  attr(dat$ingreso, "label") <- "Ingreso mensual"
  attr(dat$sexo, "label") <- "Sexo"

  inst <- list(
    survey = data.frame(
      name      = c("ingreso", "sexo"),
      type      = c("integer", "select_one lst_sexo"),
      list_name = c(NA_character_, "lst_sexo"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = rep("lst_sexo", 2),
      name      = c("1", "2"),
      label     = c("Hombres", "Mujeres"),
      stringsAsFactors = FALSE
    ),
    orders_list = NULL
  )

  list(data = dat, instrumento = inst)
}

# El suelo editorial de produccion lo aplica `.enriquecer_presets` en el router,
# no `reporte_ppt_plan`. Un test que corre con `p_presets()` vacio no ve el
# preset de la casa (colores navy, N sobre barras) y por tanto no prueba lo que
# el cliente recibe: lo montamos explicitamente.
presets_produccion <- function() {
  p_presets(barras_numericas = .PRESETS_DEFAULT_PULSO$barras_numericas)
}

render_numerico <- function(..., presets = presets_produccion()) {
  fx <- make_numerico_fixture()
  reporte_ppt_plan(
    data        = fx$data,
    instrumento = fx$instrumento,
    plan        = list(diapo_001 = p_slide_1_grafico(grafico = p_numerico(...))),
    presets     = presets,
    solo_lista  = TRUE,
    mensajes_progreso = FALSE
  )$rendered[[1]]
}

numerico_valores <- function(p) {
  d <- attr(p, "pulso_numerico_data")
  stats::setNames(as.numeric(d$valor), as.character(d$categoria))
}

test_that("la metrica declarada es la que se calcula, no siempre la media", {
  skip_if_not_installed("ggplot2")

  medias <- numerico_valores(render_numerico("ingreso", cruce = "sexo", metrica = "mean"))
  expect_equal(unname(medias[["Hombres"]]), 1000)
  expect_equal(unname(medias[["Mujeres"]]), 6320)

  # El defecto: pedir mediana devolvia exactamente las medias de arriba.
  medianas <- numerico_valores(render_numerico("ingreso", cruce = "sexo", metrica = "median"))
  expect_equal(unname(medianas[["Hombres"]]), 1000)
  expect_equal(unname(medianas[["Mujeres"]]), 1200)
  expect_false(isTRUE(all.equal(unname(medianas[["Mujeres"]]), unname(medias[["Mujeres"]]))))

  conteos <- numerico_valores(render_numerico("ingreso", cruce = "sexo", metrica = "N"))
  expect_equal(unname(conteos[["Hombres"]]), 10)
  expect_equal(unname(conteos[["Mujeres"]]), 10)

  # pct = participacion del grupo sobre el total de casos validos.
  pcts <- numerico_valores(render_numerico("ingreso", cruce = "sexo", metrica = "pct"))
  expect_equal(unname(pcts[["Hombres"]]), 50)
  expect_equal(unname(pcts[["Mujeres"]]), 50)
})

test_that("sin cruce cada metrica rinde su propio numero", {
  skip_if_not_installed("ggplot2")

  expect_equal(unname(numerico_valores(render_numerico("ingreso", metrica = "mean"))[[1]]), 3660)
  expect_equal(unname(numerico_valores(render_numerico("ingreso", metrica = "median"))[[1]]), 1100)
  expect_equal(unname(numerico_valores(render_numerico("ingreso", metrica = "N"))[[1]]), 20)
  # Sin cruce, pct es la cobertura: casos validos sobre casos de la base.
  expect_equal(unname(numerico_valores(render_numerico("ingreso", metrica = "pct"))[[1]]), 100)
})

test_that("el default efectivo de metrica es el declarado y es la media", {
  skip_if_not_installed("ggplot2")

  # El constructor declaraba "N" por orden de match.arg mientras el motor
  # rendia medias. Se unifica en "mean", que es lo que el preset editorial
  # asume (colores_series keyed "Media") y lo que la UI ofrece primero.
  expect_identical(p_numerico("ingreso")$metrica, "mean")

  p <- render_numerico("ingreso", cruce = "sexo")
  expect_identical(attr(p, "pulso_numerico_metrica"), "mean")
  expect_equal(unname(numerico_valores(p)[["Mujeres"]]), 6320)
})

test_that("la leyenda nombra la metrica que se esta mostrando", {
  skip_if_not_installed("ggplot2")

  expect_identical(attr(render_numerico("ingreso", metrica = "mean"), "pulso_numerico_etiqueta"), "Media")
  expect_identical(attr(render_numerico("ingreso", metrica = "median"), "pulso_numerico_etiqueta"), "Mediana")
  expect_identical(attr(render_numerico("ingreso", metrica = "N"), "pulso_numerico_etiqueta"), "Casos")
  expect_identical(attr(render_numerico("ingreso", metrica = "pct"), "pulso_numerico_etiqueta"), "Porcentaje")

  # Una etiqueta explicita del analista sigue mandando sobre la automatica.
  p <- render_numerico("ingreso", metrica = "median", overrides = list(etiqueta_serie = "Ingreso tipico"))
  expect_identical(attr(p, "pulso_numerico_etiqueta"), "Ingreso tipico")
})

test_that("cambiar de metrica no le roba el color de la casa a la serie", {
  skip_if_not_installed("ggplot2")

  # Trampa real: el preset trae colores_series keyed por la ETIQUETA
  # ("Media" = "#081F5C"). Al renombrar la serie a "Mediana" el lookup por
  # nombre fallaba y .graficos_mk_palette caia al azul generico #0B4F8C.
  for (m in c("mean", "median", "N", "pct")) {
    p <- render_numerico("ingreso", cruce = "sexo", metrica = m)
    expect_identical(
      unname(attr(p, "pulso_numerico_colores")[[1]]),
      "#081F5C",
      info = paste("metrica:", m)
    )
  }
})

test_that("formato envuelve el numero ya formateado por la casa", {
  skip_if_not_installed("ggplot2")

  # "S/ %s" debe respetar los separadores de la casa (miles ".", decimal ",")
  # en vez de reemplazar el formateo por un sprintf crudo.
  p <- render_numerico("ingreso", metrica = "mean", formato = "S/ %s")
  expect_identical(attr(p, "pulso_numerico_etiquetas_valor"), "S/ 3.660,0")

  # Una conversion numerica se aplica al valor crudo.
  p2 <- render_numerico("ingreso", metrica = "mean", formato = "%.2f")
  expect_identical(attr(p2, "pulso_numerico_etiquetas_valor"), "3660.00")

  # Sin formato, manda el formateo de la casa.
  p3 <- render_numerico("ingreso", metrica = "mean")
  expect_identical(attr(p3, "pulso_numerico_etiquetas_valor"), "3.660,0")
})

test_that("un formato invalido degrada sin matar la lamina", {
  skip_if_not_installed("ggplot2")

  # Una conversion que sprintf no conoce no puede matar la lamina: cae al
  # formateo de la casa.
  p <- expect_no_error(render_numerico("ingreso", metrica = "mean", formato = "%.2y"))
  expect_s3_class(p, "ggplot")
  expect_identical(attr(p, "pulso_numerico_etiquetas_valor"), "3.660,0")

  # `%d` es legitimo mientras el valor sea entero (R lo acepta sobre doubles
  # de parte decimal nula) y entonces manda sobre el formateo de la casa.
  p2 <- expect_no_error(render_numerico("ingreso", cruce = "sexo", metrica = "mean", formato = "%d"))
  expect_s3_class(p2, "ggplot")
  expect_identical(unname(attr(p2, "pulso_numerico_etiquetas_valor"))[[2]], "6320")

  # Con parte decimal, ese mismo `%d` es error duro: debe caer a la casa.
  p3 <- expect_no_error(render_numerico("ingreso", metrica = "pct", formato = "%d"))
  expect_s3_class(p3, "ggplot")

  expect_no_error(render_numerico("ingreso", metrica = "mean", formato = ""))
})

test_that("las metricas de conteo se rotulan sin decimales fantasma", {
  skip_if_not_installed("ggplot2")

  # N = 20 no puede leerse "20,0"; y el "N = 20" encima de la barra sobra
  # cuando la barra YA es el conteo.
  p <- render_numerico("ingreso", metrica = "N")
  expect_identical(attr(p, "pulso_numerico_etiquetas_valor"), "20")
  expect_false(isTRUE(attr(p, "pulso_numerico_n_sobre_barras")))

  # La media conserva su decimal y su N encima.
  p2 <- render_numerico("ingreso", metrica = "mean")
  expect_identical(attr(p2, "pulso_numerico_etiquetas_valor"), "3.660,0")
  expect_true(isTRUE(attr(p2, "pulso_numerico_n_sobre_barras")))
})

test_that("pct se rotula como porcentaje", {
  skip_if_not_installed("ggplot2")

  p <- render_numerico("ingreso", cruce = "sexo", metrica = "pct")
  expect_identical(unname(attr(p, "pulso_numerico_etiquetas_valor"))[[1]], "50,0%")
})

test_that("la metrica degrada sin romper con datos vacios o de un solo caso", {
  skip_if_not_installed("ggplot2")

  fx <- make_numerico_fixture()
  uno <- fx$data[1, , drop = FALSE]

  for (m in c("mean", "median", "N", "pct")) {
    p <- reporte_ppt_plan(
      data = uno, instrumento = fx$instrumento,
      plan = list(diapo_001 = p_slide_1_grafico(
        grafico = p_numerico("ingreso", cruce = "sexo", metrica = m)
      )),
      presets = p_presets(), solo_lista = TRUE, mensajes_progreso = FALSE
    )$rendered[[1]]
    expect_s3_class(p, "ggplot")
  }

  vacio <- fx$data[0, , drop = FALSE]
  expect_no_error(
    reporte_ppt_plan(
      data = vacio, instrumento = fx$instrumento,
      plan = list(diapo_001 = p_slide_1_grafico(
        grafico = p_numerico("ingreso", metrica = "median")
      )),
      presets = p_presets(), solo_lista = TRUE, mensajes_progreso = FALSE
    )
  )
})

# H38 — una barra corta perdia su etiqueta: el umbral dentro/fuera comparaba el
# VALOR ABSOLUTO contra 0.15 (un umbral pensado para proporciones), asi que con
# magnitudes crudas toda etiqueta caia dentro; en una barra de altura casi nula,
# escrita en el blanco del preset, el grupo desaparecia de la lamina.

etiquetas_barras <- function(p) {
  gb <- ggplot2::ggplot_build(p)
  do.call(rbind, lapply(gb$data, function(x) {
    if (!all(c("label", "colour") %in% names(x))) return(NULL)
    data.frame(label = as.character(x$label), colour = as.character(x$colour),
               y = as.numeric(x$y), stringsAsFactors = FALSE)
  }))
}

test_that("una barra corta conserva su etiqueta legible fuera de la barra", {
  skip_if_not_installed("ggplot2")

  args <- list(
    data = data.frame(
      categoria = c("Hombres", "Mujeres"),
      N         = c(5, 5),
      v1        = c(12, 480000),
      stringsAsFactors = FALSE
    ),
    var_categoria = "categoria", var_n = "N", vars_valor = "v1",
    etiquetas_series = c(v1 = "Media"),
    color_texto_barras = "white",
    mostrar_n_sobre_barras = TRUE,
    usar_canvas = FALSE, exportar = "rplot"
  )

  et <- etiquetas_barras(do.call(graficar_barras_numericas, args))

  corta <- et[et$label == "12,0", , drop = FALSE]
  expect_equal(nrow(corta), 1L)
  # No puede quedar escrita en blanco (seria invisible sobre el lienzo).
  expect_false(tolower(corta$colour[[1]]) %in% c("white", "#ffffff"))
  # Y debe salir de la barra: por encima de su propia altura.
  expect_gt(corta$y[[1]], 12)

  # La barra alta conserva su etiqueta dentro, en el blanco del preset.
  alta <- et[et$label == "480.000,0", , drop = FALSE]
  expect_equal(nrow(alta), 1L)
  expect_true(tolower(alta$colour[[1]]) %in% c("white", "#ffffff"))

  # El N de la barra corta se apila POR ENCIMA de la etiqueta de valor.
  n_corta <- et[et$label == "N = 5" & et$y < 480000, , drop = FALSE]
  expect_gte(nrow(n_corta), 1L)
  expect_gt(max(n_corta$y), corta$y[[1]])
})

test_that("el umbral dentro/fuera sigue leyendo igual los datos proporcionales", {
  skip_if_not_installed("ggplot2")

  # Con proporciones el criterio relativo coincide con el absoluto de antes:
  # 0.60 va dentro y 0.06 va fuera (0.06/0.60 = 0.10 < 0.15).
  args <- list(
    data = data.frame(categoria = c("A", "B"), N = c(10, 10), v1 = c(0.60, 0.06),
                      stringsAsFactors = FALSE),
    var_categoria = "categoria", var_n = "N", vars_valor = "v1",
    etiquetas_series = c(v1 = "Media"), usar_canvas = FALSE, exportar = "rplot"
  )

  et <- etiquetas_barras(do.call(graficar_barras_numericas, args))
  dentro <- et[et$label == "0,6", , drop = FALSE]
  fuera  <- et[et$label == "0,1", , drop = FALSE]

  expect_equal(nrow(dentro), 1L)
  expect_equal(nrow(fuera), 1L)
  expect_lt(dentro$y[[1]], 0.60)   # centrada dentro de la barra
  expect_gt(fuera$y[[1]], 0.06)    # empujada por encima de la barra
})

test_that("formato_etiqueta del graficador no altera a quien no lo usa", {
  skip_if_not_installed("ggplot2")

  base <- data.frame(categoria = "Total", N = 10, v1 = 3660, stringsAsFactors = FALSE)
  args <- list(
    data = base, var_categoria = "categoria", var_n = "N", vars_valor = "v1",
    etiquetas_series = c(v1 = "Media"), usar_canvas = FALSE, exportar = "rplot"
  )

  sin <- do.call(graficar_barras_numericas, args)
  con <- do.call(graficar_barras_numericas, c(args, list(formato_etiqueta = "S/ %s")))

  etiqueta <- function(p) {
    gb <- ggplot2::ggplot_build(p)
    labs <- unlist(lapply(gb$data, function(x) if ("label" %in% names(x)) as.character(x$label) else NULL))
    labs[nzchar(labs)][[1]]
  }

  expect_identical(etiqueta(sin), "3.660,0")
  expect_identical(etiqueta(con), "S/ 3.660,0")
})
