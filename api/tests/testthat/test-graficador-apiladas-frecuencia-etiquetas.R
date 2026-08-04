# La frecuencia entre paréntesis («77% (133)») la decide `mostrar_n_en_etiquetas`,
# que nace en FALSE. Pero el graficador la pintaba igual en cuanto recibía
# `cols_n`, sin mirar el flag: `cols_n` trae los DATOS de N —el motor los pasa
# para la barra extra y los totales— y se estaba tomando como la orden de
# escribirlos.
#
# Las cinco llamadas del motor de plan pasan `cols_n` junto con
# `mostrar_n_en_etiquetas = FALSE` (reporte_plan_ppt.R), o sea que el propio
# llamador pedía no mostrarla. El resultado era que ninguna lámina de apiladas
# —incluidas las multiapiladas que comparan públicos— podía salir sólo con
# porcentaje, y el switch del estilo común no servía de nada.

.apiladas_fixture_con_n <- function() {
  data.frame(
    categoria = c("Docentes", "Estudiantes"),
    N = c(52L, 172L),
    pct_si = c(0.98, 0.77),
    pct_no = c(0.02, 0.23),
    n_si = c(51L, 133L),
    n_no = c(1L, 39L),
    stringsAsFactors = FALSE
  )
}

.etiquetas_de <- function(p) {
  build <- ggplot2::ggplot_build(p)
  textos <- unlist(lapply(build$data, function(capa) {
    if ("label" %in% names(capa)) as.character(capa$label) else NULL
  }))
  unique(textos[nzchar(textos)])
}

.render_apiladas <- function(mostrar_n) {
  graficar_barras_apiladas(
    data = .apiladas_fixture_con_n(),
    var_categoria = "categoria",
    var_n = "N",
    cols_porcentaje = c("pct_si", "pct_no"),
    etiquetas_grupos = c(pct_si = "Sí", pct_no = "No"),
    cols_n = c(pct_si = "n_si", pct_no = "n_no"),
    mostrar_n_en_etiquetas = mostrar_n,
    mostrar_barra_extra = FALSE,
    exportar = "rplot",
    usar_canvas = FALSE
  )
}

test_that("con mostrar_n_en_etiquetas = FALSE la etiqueta es sólo el porcentaje", {
  skip_if_not_installed("ggplot2")
  etiquetas <- .etiquetas_de(.render_apiladas(FALSE))
  expect_true(any(grepl("^98\\s*%$", trimws(etiquetas))))
  expect_false(any(grepl("\\(51\\)", etiquetas)))
  expect_false(any(grepl("\\(133\\)", etiquetas)))
})

test_that("con mostrar_n_en_etiquetas = TRUE vuelve la frecuencia", {
  skip_if_not_installed("ggplot2")
  etiquetas <- .etiquetas_de(.render_apiladas(TRUE))
  expect_true(any(grepl("\\(51\\)", etiquetas)))
  expect_true(any(grepl("\\(133\\)", etiquetas)))
})

# El camino real de los entregables es el canvas, y ahí la frecuencia entraba
# por otra puerta: `etiquetas_arriba_si_no_caben` —un ajuste de POSICIÓN, que el
# preset de la casa trae en TRUE— aplicaba la variante con `(n)` a todas las
# etiquetas. Un flag de dónde va el texto decidía qué dice el texto. La decisión
# vive ahora en un helper propio.

test_that(".apiladas_etiquetas_con_frecuencia sólo agrega el N cuando se lo piden", {
  lab <- c("98%", "2%", "77%")
  n_txt <- c("51", "1", "133")

  apagado <- .apiladas_etiquetas_con_frecuencia(lab, n_txt, FALSE)
  expect_identical(apagado$lab, lab)
  # También la variante desplazada: mover una etiqueta no cambia lo que informa.
  expect_identical(apagado$lab_arriba, lab)

  encendido <- .apiladas_etiquetas_con_frecuencia(lab, n_txt, TRUE)
  expect_identical(encendido$lab, c("98% (51)", "2% (1)", "77% (133)"))
  expect_identical(encendido$lab_arriba, encendido$lab)
})

test_that(".apiladas_etiquetas_con_frecuencia respeta segmentos sin dato", {
  # Un segmento sin porcentaje visible no gana una frecuencia suelta.
  res <- .apiladas_etiquetas_con_frecuencia(c("98%", ""), c("51", "3"), TRUE)
  expect_identical(res$lab, c("98% (51)", ""))

  # Y un porcentaje sin N se queda como está.
  res2 <- .apiladas_etiquetas_con_frecuencia(c("98%", "2%"), c("51", ""), TRUE)
  expect_identical(res2$lab, c("98% (51)", "2%"))
})
