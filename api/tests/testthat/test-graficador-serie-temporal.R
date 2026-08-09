source("setup-load-all.R")

# El catalogo no tenia forma de mostrar evolucion: `geom_line` solo aparecia en
# el radar, para cerrar su poligono. La serie temporal consume el MISMO df tidy
# `(eje, grupo, valor, n)` del motor multibase, leido al reves: un punto por
# base (la ola) y una linea por tema.

.df_serie <- function() {
  data.frame(
    eje = rep(c("Acceso a servicios", "Documentacion"), each = 3),
    grupo = rep(c("Linea de base", "Ola 2", "Ola 3"), times = 2),
    valor = c(45, 58, 67, 30, 34, 33),
    n = rep(400L, 6),
    stringsAsFactors = FALSE
  )
}

.capas_de <- function(p, clase) Filter(function(l) inherits(l$geom, clase), p$layers)

test_that("dibuja una linea por tema y respeta el orden de las olas", {
  skip_if_not_installed("ggplot2")
  p <- graficar_serie_temporal(.df_serie())

  expect_true(length(.capas_de(p, "GeomLine")) >= 1L)
  # El eje X conserva el orden de aparicion, no el alfabetico.
  expect_identical(
    attr(p, "pulso_serie_periodos"),
    c("Linea de base", "Ola 2", "Ola 3")
  )
  expect_identical(
    attr(p, "pulso_serie_series"),
    c("Acceso a servicios", "Documentacion")
  )
})

test_that("el orden alfabetico no manda: Ola 10 va despues de Ola 2", {
  # Es el defecto clasico de una serie con etiquetas de texto. Ordenar
  # alfabeticamente invierte la evolucion y el grafico miente.
  skip_if_not_installed("ggplot2")
  df <- data.frame(
    eje = "Tema", grupo = c("Ola 2", "Ola 10"), valor = c(20, 80),
    stringsAsFactors = FALSE
  )
  p <- graficar_serie_temporal(df)
  expect_identical(attr(p, "pulso_serie_periodos"), c("Ola 2", "Ola 10"))
})

test_that("un orden explicito de periodos gana sobre el de aparicion", {
  skip_if_not_installed("ggplot2")
  p <- graficar_serie_temporal(
    .df_serie(),
    orden_periodos = c("Ola 3", "Ola 2", "Linea de base")
  )
  expect_identical(
    attr(p, "pulso_serie_periodos"),
    c("Ola 3", "Ola 2", "Linea de base")
  )
})

test_that("un periodo no listado en el orden explicito no se pierde", {
  skip_if_not_installed("ggplot2")
  p <- graficar_serie_temporal(.df_serie(), orden_periodos = c("Ola 3"))
  expect_true(all(c("Linea de base", "Ola 2", "Ola 3") %in% attr(p, "pulso_serie_periodos")))
  expect_identical(attr(p, "pulso_serie_periodos")[[1]], "Ola 3")
})

test_that("respeta el orden de un factor que ya venga ordenado", {
  # `.radar_mb_datos` devuelve `grupo` como factor con los niveles en el orden
  # de declaracion de las fuentes; ese orden es la respuesta correcta.
  skip_if_not_installed("ggplot2")
  df <- .df_serie()
  df$grupo <- factor(df$grupo, levels = c("Ola 3", "Ola 2", "Linea de base"))
  p <- graficar_serie_temporal(df)
  expect_identical(
    attr(p, "pulso_serie_periodos"),
    c("Ola 3", "Ola 2", "Linea de base")
  )
})

test_that("las cifras salen en porcentaje sobre cada punto", {
  skip_if_not_installed("ggplot2")
  p <- graficar_serie_temporal(.df_serie(), mostrar_valores = TRUE)
  capas <- .capas_de(p, "GeomText")
  expect_true(length(capas) >= 1L)
  etiquetas <- unlist(lapply(capas, function(l) as.character(l$data$.lab)))
  expect_true("45%" %in% etiquetas)
  expect_true("67%" %in% etiquetas)
})

test_that("la escala 0-1 se convierte a porcentaje y no se dibuja como 0,45", {
  skip_if_not_installed("ggplot2")
  df <- .df_serie()
  df$valor <- df$valor / 100
  p <- graficar_serie_temporal(df, escala_valor = "proporcion_1", mostrar_valores = TRUE)
  capas <- .capas_de(p, "GeomText")
  etiquetas <- unlist(lapply(capas, function(l) as.character(l$data$.lab)))
  expect_true("45%" %in% etiquetas)
  expect_false(any(grepl("^0", etiquetas)))
})

test_that("apagar las cifras deja el grafico sin capa de texto", {
  skip_if_not_installed("ggplot2")
  p <- graficar_serie_temporal(.df_serie(), mostrar_valores = FALSE)
  expect_length(.capas_de(p, "GeomText"), 0L)
})

test_that("destacar el ultimo punto agrega un marcador y no una serie nueva", {
  skip_if_not_installed("ggplot2")
  con <- graficar_serie_temporal(.df_serie(), destacar_ultimo = TRUE)
  sin <- graficar_serie_temporal(.df_serie(), destacar_ultimo = FALSE)
  expect_gt(length(.capas_de(con, "GeomPoint")), length(.capas_de(sin, "GeomPoint")))
  # El realce no debe aparecer en la leyenda: no es un tema mas.
  extra <- .capas_de(con, "GeomPoint")
  expect_true(any(vapply(extra, function(l) isFALSE(l$show.legend), logical(1))))
})

test_that("una sola ola no revienta, aunque no haya evolucion que mostrar", {
  skip_if_not_installed("ggplot2")
  df <- data.frame(eje = c("A", "B"), grupo = "Unica", valor = c(10, 20),
                   stringsAsFactors = FALSE)
  expect_s3_class(graficar_serie_temporal(df), "ggplot")
})

test_that("un hueco en una ola no inventa tendencia", {
  # Si un tema no se midio en una ola, la linea no puede saltar por encima como
  # si el dato existiera.
  skip_if_not_installed("ggplot2")
  df <- .df_serie()
  df$valor[2] <- NA_real_
  p <- graficar_serie_temporal(df)
  expect_s3_class(p, "ggplot")
  # El valor ausente sigue siendo NA en los datos, no un cero ni un interpolado.
  datos <- p$data
  expect_true(any(is.na(datos$.y)))
  expect_false(any(datos$.y %in% 0, na.rm = TRUE))
})

test_that("dos cifras que chocan en el mismo periodo van a lados opuestos", {
  # El primer render con cuatro series mostraba "60%" y "58%" superpuestos donde
  # las lineas se cruzan. Poner todas las cifras arriba desperdicia la mitad del
  # espacio.
  vj <- .serie_temporal_vjust(
    periodos = c("Ola 2", "Ola 2"),
    valores = c(58, 60),
    separacion = 5
  )
  expect_equal(length(unique(vj)), 2L)
  expect_true(any(vj < 0))   # una arriba
  expect_true(any(vj > 0))   # la otra abajo
})

test_that("dos cifras con aire de sobra se quedan las dos arriba", {
  vj <- .serie_temporal_vjust(
    periodos = c("Ola 2", "Ola 2"),
    valores = c(20, 70),
    separacion = 5
  )
  expect_true(all(vj < 0))
})

test_that("periodos distintos no se estorban entre si", {
  vj <- .serie_temporal_vjust(
    periodos = c("Ola 1", "Ola 2"),
    valores = c(50, 51),
    separacion = 5
  )
  expect_true(all(vj < 0))
})

test_that("con mas series que el limite las cifras se apagan y se declara", {
  # Alternar da DOS posiciones; con ocho series juntas las cifras se pisan igual
  # y el resultado se lee peor que sin cifras. El motor declara su limite en vez
  # de dibujar un amasijo — mismo criterio que `max_categorias` en categoricas.
  skip_if_not_installed("ggplot2")
  df <- do.call(rbind, lapply(1:8, function(i) data.frame(
    eje = paste("Indicador", i), grupo = c("Ola 1", "Ola 2"),
    valor = c(30 + i * 3, 34 + i * 3), stringsAsFactors = FALSE
  )))
  p <- graficar_serie_temporal(df, mostrar_valores = TRUE)

  expect_length(.capas_de(p, "GeomText"), 0L)
  expect_true(attr(p, "pulso_serie_cifras_omitidas"))
})

test_that("subir el limite devuelve las cifras", {
  skip_if_not_installed("ggplot2")
  df <- do.call(rbind, lapply(1:8, function(i) data.frame(
    eje = paste("Indicador", i), grupo = c("Ola 1", "Ola 2"),
    valor = c(30 + i * 3, 34 + i * 3), stringsAsFactors = FALSE
  )))
  p <- graficar_serie_temporal(df, mostrar_valores = TRUE, max_series_con_cifras = 10)
  expect_true(length(.capas_de(p, "GeomText")) >= 1L)
  expect_false(attr(p, "pulso_serie_cifras_omitidas"))
})

test_that("apagar las cifras a mano no se reporta como omision del motor", {
  # Son dos cosas distintas: el analista las apago, o el motor no pudo. Un
  # grafico sin cifras y sin distinguir el caso no se puede diagnosticar.
  skip_if_not_installed("ggplot2")
  p <- graficar_serie_temporal(.df_serie(), mostrar_valores = FALSE)
  expect_false(attr(p, "pulso_serie_cifras_omitidas"))
})

test_that("exige las columnas que promete", {
  expect_error(graficar_serie_temporal(data.frame(a = 1)), "no existe")
  expect_error(graficar_serie_temporal(data.frame()), "al menos una fila")
})

test_that("la leyenda se apaga con la posicion ninguna", {
  skip_if_not_installed("ggplot2")
  p <- graficar_serie_temporal(.df_serie(), leyenda_posicion = "ninguna")
  expect_identical(as.character(p$theme$legend.position), "none")
})

test_that("el constructor del plan arma un ppt_element utilizable", {
  el <- p_serie_temporal(
    vars = list("Acceso" = c("ola1$p1", "ola2$p1")),
    corte = "3,4",
    corte_etiqueta = "% de acuerdo"
  )
  expect_s3_class(el, "ppt_element")
  expect_identical(el$.element_type, "serie_temporal")
  expect_identical(el$corte_etiqueta, "% de acuerdo")
  # `var = NULL` explicito: sin el, `el$var` haria match parcial con `vars` y
  # tumbaria el mazo entero.
  expect_null(el$var)
  expect_true("var" %in% names(el))
})

test_that("serie temporal conserva su prefijo y llamada posicional historicos", {
  expect_identical(
    names(formals(p_serie_temporal)),
    c(
      "vars", "corte", "corte_etiqueta", "orden_periodos", "mostrar_valores",
      "valores_decimales", "destacar_ultimo", "colores_series", "limite_y",
      "titulo", "overrides", "base", "filtros",
      "max_series_con_cifras", "mostrar_puntos", "mostrar_grid_y"
    )
  )

  colores <- c(Acceso = "#123456")
  el <- p_serie_temporal(
    list(Acceso = c("ola1$p1", "ola2$p1")),
    "3,4",
    "% de acuerdo",
    c("ola1", "ola2"),
    FALSE,
    2L,
    FALSE,
    colores,
    c(0, 100),
    "Titulo serie posicional"
  )
  expect_identical(el$title_slide, "Titulo serie posicional")
  expect_identical(el$overrides$valores_decimales, 2L)
  expect_false(el$overrides$destacar_ultimo)
  expect_identical(el$overrides$colores_series, colores)
  expect_identical(el$overrides$limite_y, c(0, 100))

  nombrado <- p_serie_temporal(
    vars = list(Acceso = c("ola1$p1", "ola2$p1")),
    corte = "3,4",
    max_series_con_cifras = 9L,
    mostrar_puntos = FALSE,
    mostrar_grid_y = FALSE
  )
  expect_identical(nombrado$overrides$max_series_con_cifras, 9L)
  expect_false(nombrado$overrides$mostrar_puntos)
  expect_false(nombrado$overrides$mostrar_grid_y)
})

test_that("los controles publicados sobreviven constructor y rebuild", {
  el <- .graficos_rebuild_graf_json(
    list(
      graficador = "p_serie_temporal",
      args = list(
        vars = list(Acceso = c("ola1$p1", "ola2$p1")),
        corte = "3,4",
        max_series_con_cifras = 9,
        mostrar_puntos = FALSE,
        mostrar_grid_y = FALSE
      )
    )
  )
  expect_equal(el$overrides$max_series_con_cifras, 9L)
  expect_false(el$overrides$mostrar_puntos)
  expect_false(el$overrides$mostrar_grid_y)
})

test_that("el constructor exige nombre en cada tema y codigos en el corte", {
  expect_error(p_serie_temporal(vars = list(), corte = "3"), "lista nombrada")
  expect_error(
    p_serie_temporal(vars = list(c("a$b")), corte = "3"),
    "necesita nombre"
  )
  expect_error(
    p_serie_temporal(vars = list("Tema" = "a$b"), corte = ""),
    "al menos un codigo"
  )
})

test_that("el dispatcher del motor encuentra el renderer por convencion", {
  # Es lo que permite que el tipo exista sin agregar una linea al archivo
  # congelado a crecimiento.
  expect_true(exists(".render_serie_temporal", mode = "function"))
})
