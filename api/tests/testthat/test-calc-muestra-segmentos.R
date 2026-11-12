# Segmentos y cuotas de un público por correo o teléfono (fase 6 del rediseño
# de Cálculo de muestra, D7 y D8): cruce de dos columnas, tabla de conteos,
# grupos de celdas y reparto de la meta por celda, con control o con mínimo.

.sg_base <- function() {
  data.frame(
    fac = c(rep("Letras", 400), rep("Ciencias", 300), rep("Educación", 25), rep("", 5)),
    sexo = c(rep(c("F", "M"), c(250, 150)), rep(c("F", "M"), c(100, 200)), rep(c("F", "M"), c(20, 5)), rep("F", 5)),
    stringsAsFactors = FALSE
  )
}

test_that("el cruce de una base cuenta cada celda y los vacíos quedan como Sin dato", {
  cr <- calc_muestra_segmento_cruce(.sg_base(), "fac", "sexo")
  expect_identical(cr$filas, c("Letras", "Ciencias", "Educación", "Sin dato"))
  expect_identical(cr$columnas, c("F", "M"))
  expect_equal(cr$conteos["Letras", "F"], 250)
  expect_equal(cr$conteos["Sin dato", "F"], 5)
  expect_equal(cr$total, 730)
  uno <- calc_muestra_segmento_cruce(.sg_base(), "fac")
  expect_identical(uno$columnas, "Total")
  expect_error(calc_muestra_segmento_cruce(.sg_base(), "no_existe"), class = "api_error")
})

test_that("una tabla de conteos reconoce Total, % y Meta como calculadas y termina en la primera fila vacía", {
  df <- data.frame(
    `Unidad` = c("Letras", "Ciencias", "Educación", "Total general", "", "Por nivel", "Nivel 1"),
    Mujeres = c("250", "100", "20", "370", "", "Mujeres", "40"),
    Hombres = c("150", "200", "5", "355", "", "Hombres", "60"),
    Todos = c("400", "300", "25", "725", "", "", ""),
    `%` = c("0.55", "0.41", "0.04", "1", "", "", ""),
    Meta = c("50", "40", "3", "93", "", "", ""),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  lec <- calc_muestra_conteos_leer(df, "Sexo")
  expect_identical(lec$categoria, "Unidad")
  expect_identical(unlist(lec$conteo_columnas), c("Mujeres", "Hombres"))
  motivos <- setNames(vapply(lec$calculadas, `[[`, "", "motivo"), vapply(lec$calculadas, `[[`, "", "columna"))
  expect_identical(motivos[["%"]], "nombre")
  expect_identical(motivos[["Meta"]], "nombre")
  expect_identical(motivos[["Todos"]], "suma de las demás")
  expect_identical(lec$cruce$filas, c("Letras", "Ciencias", "Educación"))
  expect_identical(lec$cruce$columna_variable, "Sexo")
  expect_equal(lec$cruce$total, 725)
  expect_length(lec$avisos, 0L)

  # Una fila Total que no cuadra se avisa; no se corrige en silencio.
  df$Mujeres[4] <- "371"
  expect_identical(calc_muestra_conteos_leer(df, "Sexo")$avisos[[1]]$codigo, "total_no_cuadra")
})

test_that("los grupos suman sus celdas, publican las que quedan sin grupo y rechazan una celda en dos grupos", {
  cr <- calc_muestra_segmento_cruce(.sg_base(), "fac", "sexo")
  g <- calc_muestra_segmento_agrupar(cr, list(
    list(nombre = "Letras", celdas = list(list(fila = "Letras", columna = "F"), list(fila = "Letras", columna = "M"))),
    list(nombre = "Mujeres de ciencias y educación", celdas = list(list(fila = "Ciencias", columna = "F"), list(fila = "Educación", columna = "F")))
  ))
  expect_equal(vapply(g$grupos, function(x) as.numeric(x$N), 0), c(400, 120))
  sin <- vapply(g$sin_grupo, function(x) paste(x$fila, x$columna, x$N), "")
  expect_setequal(sin, c("Ciencias M 200", "Educación M 5", "Sin dato F 5"))
  expect_equal(g$total_agrupado + sum(vapply(g$sin_grupo, `[[`, 0, "N")), cr$total)
  expect_error(calc_muestra_segmento_agrupar(cr, list(
    list(nombre = "A", celdas = list(list(fila = "Letras", columna = "F"))),
    list(nombre = "B", celdas = list(list(fila = "Letras", columna = "F"))))), class = "api_error")
  expect_error(calc_muestra_segmento_agrupar(cr, list(list(nombre = "A", celdas = list(list(fila = "Medicina", columna = "F"))))),
               class = "api_error")
})

test_that("la cuota por celda reparte la meta por mayor resto sobre las celdas y cuenta las chicas", {
  cr <- calc_muestra_segmento_cruce(.sg_base(), "fac", "sexo")
  q <- calc_muestra_cuotas_cruce(cr, 100, "celda")
  expect_identical(q$total, 100L)
  expect_identical(as.integer(t(q$cuotas)), distribuir_proporcional_pesos(100, as.numeric(t(cr$conteos))))
  chicas <- vapply(q$chicas, function(x) paste(x$fila, x$columna), "")
  expect_identical(sort(chicas), sort(c("Educación F", "Educación M", "Sin dato F")))
  expect_identical(q$celdas, 7L)
  letras <- q$por_fila[[1]]
  expect_equal(letras$margen, calc_e_desde_n_muestra(letras$n, 400))
})

test_that("con control la meta va por fila y el cruce se publica como esperado", {
  cr <- calc_muestra_segmento_cruce(.sg_base(), "fac", "sexo")
  q <- calc_muestra_cuotas_cruce(cr, 100, "control")
  expect_null(q$cuotas)
  n_fila <- vapply(q$por_fila, `[[`, 0L, "n")
  expect_identical(n_fila, distribuir_proporcional_pesos(100, rowSums(cr$conteos)))
  expect_equal(unname(rowSums(q$esperadas)), as.numeric(n_fila))
  expect_identical(vapply(q$chicas, `[[`, "", "fila"), c("Educación", "Sin dato"))
})

test_that("con mínimo ninguna celda baja de 10 (o de su población) y lo que sube se suma encima", {
  cr <- calc_muestra_segmento_cruce(.sg_base(), "fac", "sexo")
  base <- calc_muestra_cuotas_cruce(cr, 100, "celda")
  q <- calc_muestra_cuotas_cruce(cr, 100, "minimo")
  expect_true(all(q$cuotas >= pmin(10, cr$conteos)))
  expect_identical(q$extra, as.integer(sum(q$cuotas) - 100))
  expect_identical(q$extra, as.integer(sum(pmax(base$cuotas, pmin(10, cr$conteos)) - base$cuotas)))
  expect_equal(q$cuotas["Educación", "M"], 5)
  expect_length(q$chicas, 2L)
  expect_error(calc_muestra_cuotas_cruce(cr, 100, "inventado"), class = "api_error")
  expect_error(calc_muestra_cuotas_cruce(cr, -3, "celda"), class = "api_error")
  expect_error(calc_muestra_cuotas_cruce(cr, 100, "minimo", minimo = -1), class = "api_error")
  # Si las reglas dejan la base vacía, es un 400 que lo dice, no un error interno.
  expect_error(calc_muestra_segmento_cruce(data.frame(fac = character(0)), "fac"), class = "api_error")
})

test_that("las rutas arman el cruce de quienes se invitan, sus grupos y sus cuotas, y leen una tabla de conteos", {
  testthat::skip_if_not_installed("openxlsx")
  base <- .sg_base()
  base$correo <- sprintf("p%03d@ejemplo.edu", seq_len(nrow(base)))
  path <- tempfile("sg-", fileext = ".xlsx"); withr::defer(unlink(path))
  openxlsx::write.xlsx(base, path, sheetName = "datos")
  conteos <- tempfile("sg-c-", fileext = ".csv"); withr::defer(unlink(conteos))
  writeBin(iconv("Unidad;Mujeres;Hombres;Total\nLetras;250;150;400\nEducación;20;5;25\nTotal;270;155;425\n", "UTF-8", "latin1", toRaw = TRUE)[[1]], conteos)
  sid <- session_create(); withr::defer(session_delete(sid))
  m1 <- save_upload(sid, "data", basename(path), readBin(path, "raw", file.size(path)))
  m2 <- save_upload(sid, "data", basename(conteos), readBin(conteos, "raw", file.size(conteos)))

  out <- .bv_call(mount_calc_muestra_marco_publico, "POST", "/api/calc-muestra/marco-publico/cruce", sid, list(
    file_id = m1$file_id, fila = "fac", columna = "sexo",
    reglas = list(list(tipo = "excluir_valores", columna = "fac", valores = list(""))),
    grupos = list(list(nombre = "Letras", celdas = list(list(fila = "Letras", columna = "F"), list(fila = "Letras", columna = "M"))),
                  list(nombre = "Ciencias", celdas = list(list(fila = "Ciencias", columna = "F"), list(fila = "Ciencias", columna = "M"))),
                  list(nombre = "Educación", celdas = list(list(fila = "Educación", columna = "F"), list(fila = "Educación", columna = "M")))),
    cuotas = list(meta = 70, modo = "minimo")))
  expect_identical(out$invitados, 725L)
  expect_equal(out$cruce$total, 725)
  expect_length(out$agrupado$sin_grupo, 0L)
  expect_identical(vapply(out$cuotas$cuotas, function(x) as.integer(x$valores[[1]]), 0L), c(39L, 29L, 10L))
  expect_identical(out$cuotas$extra, 8L)

  co <- .bv_call(mount_calc_muestra_marco_publico, "POST", "/api/calc-muestra/marco-publico/conteos", sid, list(
    file_id = m2$file_id, columna_variable = "Sexo", cuotas = list(meta = 40, modo = "celda")))
  expect_identical(co$categoria, "Unidad")
  expect_identical(unlist(co$cruce$filas), c("Letras", "Educación"))
  expect_identical(co$cuotas$total, 40L)
})
