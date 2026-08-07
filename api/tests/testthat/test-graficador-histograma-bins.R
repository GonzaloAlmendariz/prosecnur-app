# L6 / H40 — `bins = N` producia intervalos que no existen.
#
# `ancho_bin` ya rendia cortes enteros («19-20», «21-22»), pero `bins = N` usa
# `seq(length.out=)` y sobre una variable entera (edad, hijos, años de estudio)
# devolvia cortes fraccionarios: «19-22.5» junto a «22.5-26». Nadie tiene 22,5
# años y el limite no dice donde cae quien tiene 22.
#
# Al redondear los cortes aparecio el segundo defecto: la condicion que elige
# el intervalo cerrado exigia que la MEDIANA del paso fuera entera, y `bins`
# produce pasos desiguales (3,4,4,3 → 3.5). Sin esa rama las etiquetas salian
# «19-22» y «22-26»: limite repetido, misma ambiguedad.

bins_de <- function(x, ...) {
  p <- graficar_histograma(
    data = data.frame(edad = x, stringsAsFactors = FALSE),
    var = "edad", usar_canvas = FALSE, exportar = "rplot", ...
  )
  unique(as.character(attr(p, "pulso_histograma_data")$.bin_label))
}

test_that("bins = N no inventa intervalos fraccionarios sobre datos enteros", {
  skip_if_not_installed("ggplot2")

  edad <- c(rep(19:26, times = c(4, 9, 14, 11, 7, 5, 4, 3)), 31, 32, 33)

  for (n in c(3, 4, 5, 8)) {
    etiquetas <- bins_de(edad, bins = n)
    expect_false(
      any(grepl("[.,]", etiquetas)),
      info = paste("bins =", n, "->", paste(etiquetas, collapse = ", "))
    )
  }
})

test_that("los intervalos no repiten su limite", {
  skip_if_not_installed("ggplot2")

  edad <- c(rep(19:26, times = c(4, 9, 14, 11, 7, 5, 4, 3)), 31, 32, 33)
  etiquetas <- bins_de(edad, bins = 4)

  # «19-21», «22-25»… : el fin de un intervalo nunca es el inicio del siguiente.
  bordes <- lapply(strsplit(etiquetas, "-", fixed = TRUE), as.numeric)
  finales  <- vapply(bordes, function(b) b[[length(b)]], numeric(1))
  inicios  <- vapply(bordes, function(b) b[[1L]], numeric(1))
  expect_true(all(inicios[-1] > finales[-length(finales)]))
})

test_that("ancho_bin conserva exactamente el comportamiento que ya tenia", {
  skip_if_not_installed("ggplot2")

  edad <- c(rep(19:26, times = c(4, 9, 14, 11, 7, 5, 4, 3)), 31, 32, 33)

  expect_identical(
    bins_de(edad, ancho_bin = 2),
    c("19-20", "21-22", "23-24", "25-26", "27-28", "29-30", "31-32", "33-34")
  )
  expect_identical(
    bins_de(edad, ancho_bin = 5),
    c("19-23", "24-28", "29-33")
  )
})

test_that("una variable continua sigue cubriendo todo su rango sin perder casos", {
  skip_if_not_installed("ggplot2")

  # El graficador normaliza el rango (floor/ceiling) antes de cortar, asi que
  # aqui no se afirma nada sobre decimales: lo que no puede romperse es que
  # todos los casos caigan en algun intervalo.
  puntaje <- seq(1.0, 4.7, length.out = 40)

  p <- graficar_histograma(
    data = data.frame(edad = puntaje, stringsAsFactors = FALSE),
    var = "edad", bins = 4, usar_canvas = FALSE, exportar = "rplot"
  )
  d <- attr(p, "pulso_histograma_data")

  expect_equal(sum(d$n_bin[!duplicated(d$.bin_label)]), length(puntaje))
  expect_false(any(is.na(d$.bin_label)))
})

# La frecuencia del intervalo encima de la barra es independiente de donde vayan
# las etiquetas de segmento. Antes era inalcanzable: `posicion_etiquetas` es
# excluyente («segmento» O «cima»), asi que pedir el N arriba vaciaba los
# segmentos. La composicion natural del histograma apilado —N del tramo arriba,
# porcentajes dentro— no existia.

etiquetas_de <- function(p) {
  gb <- ggplot2::ggplot_build(p)
  unlist(lapply(gb$data, function(x) if ("label" %in% names(x)) as.character(x$label) else NULL))
}

test_that("la frecuencia del intervalo convive con los porcentajes de segmento", {
  skip_if_not_installed("ggplot2")

  edad <- rep(19:24, times = c(4, 9, 14, 11, 7, 5))
  dat <- data.frame(
    edad = edad,
    sexo = rep(c("1", "2"), length.out = length(edad)),
    stringsAsFactors = FALSE
  )

  p <- graficar_histograma(
    data = dat, var = "edad", grupo = "sexo", ancho_bin = 2,
    modo = "porcentaje_bin", posicion_etiquetas = "segmento", mostrar_valores = TRUE,
    mostrar_n_intervalo = TRUE, usar_canvas = FALSE, exportar = "rplot"
  )

  et <- etiquetas_de(p)
  # Porcentajes en los segmentos...
  expect_true(any(grepl("%$", et)))
  # ...y el N del intervalo arriba: 4+9 = 13 en el primer tramo.
  expect_true("13" %in% et)

  # Apagado por defecto: el N no aparece si no se pide.
  sin <- graficar_histograma(
    data = dat, var = "edad", grupo = "sexo", ancho_bin = 2,
    modo = "porcentaje_bin", posicion_etiquetas = "segmento", mostrar_valores = TRUE,
    usar_canvas = FALSE, exportar = "rplot"
  )
  expect_false("13" %in% etiquetas_de(sin))
})

test_that("con etiquetas en la cima el N del intervalo no se duplica", {
  skip_if_not_installed("ggplot2")

  edad <- rep(19:24, times = c(4, 9, 14, 11, 7, 5))
  dat <- data.frame(edad = edad, sexo = rep(c("1", "2"), length.out = length(edad)),
                    stringsAsFactors = FALSE)

  # En «cima» el resumen superior ya puede incluir el conteo via
  # `etiqueta_cima_modo`: dibujar ademas el N seria escribir dos veces encima.
  p <- graficar_histograma(
    data = dat, var = "edad", grupo = "sexo", ancho_bin = 2,
    modo = "porcentaje_total", posicion_etiquetas = "cima",
    etiqueta_cima_modo = "conteo_total", mostrar_n_intervalo = TRUE,
    usar_canvas = FALSE, exportar = "rplot"
  )
  expect_equal(sum(etiquetas_de(p) == "13"), 1L)
})
