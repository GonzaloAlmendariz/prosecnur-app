# Las tablas de cruces no se vuelven cuadráticas con el número de variables.
# HSyVbG 2026 (2026-10-21, H16): 331 variables en una hoja no terminaban en 81
# minutos porque openxlsx recorre todos los estilos previos en cada escritura.

.crr_fixture <- function(n_vars) {
  set.seed(1)
  nombres <- sprintf("p%02d", seq_len(n_vars))
  data <- as.data.frame(c(
    setNames(lapply(nombres, function(v) as.character(sample(1:4, 60, TRUE))), nombres),
    list(seg = as.character(sample(1:3, 60, TRUE)))
  ), stringsAsFactors = FALSE)
  instrumento <- list(
    survey = data.frame(name = c(nombres, "seg"),
                        type = c(rep("select_one esc", n_vars), "select_one grupo"),
                        list_name = c(rep("esc", n_vars), "grupo"),
                        label = c(paste("Pregunta", nombres), "Segmento"), stringsAsFactors = FALSE),
    choices = data.frame(list_name = c(rep("esc", 4), rep("grupo", 3)),
                         name = c(1:4, 1:3), label = c(paste("Opción", 1:4), paste("Grupo", 1:3)),
                         stringsAsFactors = FALSE)
  )
  list(data = data, instrumento = instrumento, secciones = list(General = nombres))
}

# Mayor cantidad de objetos de estilo que openxlsx tiene a la vista al cerrar
# cada tabla: es lo que recorre en cada addStyle(stack = TRUE) y writeData.
.crr_max_estilos_visibles <- function(n_vars) {
  fx <- .crr_fixture(n_vars)
  visto <- 0L
  archivar <- get(".xlsx_archivar_estilos", envir = asNamespace("prosecnurapp"))
  testthat::local_mocked_bindings(.xlsx_archivar_estilos = function(wb, archivo) {
    visto <<- max(visto, length(wb$styleObjects))
    archivar(wb, archivo)
  })
  out <- tempfile(fileext = ".xlsx")
  on.exit(unlink(out), add = TRUE)
  suppressMessages(reporte_cruces(data = fx$data, instrumento = fx$instrumento,
                                  SECCIONES = fx$secciones, cruces = "seg",
                                  path_xlsx = out, show_sig = TRUE))
  visto
}

test_that("los estilos a la vista de openxlsx no crecen con el número de variables", {
  pocos <- .crr_max_estilos_visibles(3)
  muchos <- .crr_max_estilos_visibles(12)
  expect_gt(pocos, 0L)
  # Con el archivado cada tabla sólo ve sus propios estilos (más los del título
  # de sección en la primera). Sin él, 12 variables ven ~4 veces lo de 3.
  expect_lte(muchos, pocos)
})

test_that("archivar y compactar los estilos no cambia lo que se ve en el libro", {
  fx <- .crr_fixture(6)
  escribir <- function(path) suppressMessages(reporte_cruces(
    data = fx$data, instrumento = fx$instrumento, SECCIONES = fx$secciones,
    cruces = "seg", path_xlsx = path, show_sig = TRUE))
  con <- tempfile(fileext = ".xlsx"); sin <- tempfile(fileext = ".xlsx")
  on.exit(unlink(c(con, sin)), add = TRUE)
  objetos_al_guardar <- NA_integer_
  local({
    guardar <- openxlsx::saveWorkbook
    testthat::local_mocked_bindings(saveWorkbook = function(wb, ...) {
      objetos_al_guardar <<- length(wb$styleObjects)
      guardar(wb, ...)
    }, .package = "openxlsx")
    escribir(con)
  })
  local({
    testthat::local_mocked_bindings(.xlsx_archivar_estilos = function(wb, archivo) invisible(wb),
                                    .xlsx_restaurar_estilos = function(wb, archivo) invisible(wb))
    escribir(sin)
  })
  # Al guardar hay un objeto por estilo distinto, no uno por cada addStyle.
  expect_lt(objetos_al_guardar, 60L)
  a <- .xlsx_estilos_por_celda(con); b <- .xlsx_estilos_por_celda(sin)
  expect_setequal(names(a), names(b))
  expect_identical(a[names(b)], b)
  leer <- function(path, parte) {
    d <- tempfile(); on.exit(unlink(d, recursive = TRUE))
    utils::unzip(path, files = parte, exdir = d)
    gsub(' s="[0-9]+"', "", readLines(file.path(d, parte), warn = FALSE, encoding = "UTF-8"))
  }
  # Valores, combinaciones y anchos: idénticos salvo el id de estilo.
  expect_identical(leer(con, "xl/worksheets/sheet1.xml"), leer(sin, "xl/worksheets/sheet1.xml"))
})

test_that("compactar deja en cada celda el estilo del último objeto que la nombra", {
  a <- openxlsx::createStyle(textDecoration = "bold")
  b <- openxlsx::createStyle(fgFill = "#EEEEEE")
  a2 <- openxlsx::createStyle(textDecoration = "bold")  # mismo estilo, otra copia
  objetos <- list(
    list(style = a, sheet = "S", rows = c(1L, 2L), cols = c(1L, 1L)),
    list(style = b, sheet = "S", rows = 2L, cols = 1L),
    list(style = a2, sheet = "S", rows = 3L, cols = 1L),
    list(style = b, sheet = "T", rows = 1L, cols = 1L)
  )
  out <- .xlsx_compactar_estilos(objetos)
  expect_length(out, 3L)  # S/negrita, S/relleno, T/relleno
  celda <- function(hoja, r) {
    for (o in out) if (o$sheet == hoja && any(o$rows == r & o$cols == 1L)) return(.xlsx_firma_estilo(o$style))
    NA_character_
  }
  expect_identical(celda("S", 1L), .xlsx_firma_estilo(a))
  expect_identical(celda("S", 2L), .xlsx_firma_estilo(b))
  expect_identical(celda("S", 3L), .xlsx_firma_estilo(a))
  expect_identical(celda("T", 1L), .xlsx_firma_estilo(b))
})

test_that("la ficha técnica no se agrega a las tablas de cruces ni a la base salvo que se pida", {
  # Gonzalo, 2026-10-22: «la ficha técnica es un pdf aparte que no se agrega a ninguna tabla, es un bug».
  fx <- .crr_fixture(2)
  out <- tempfile(fileext = ".xlsx"); on.exit(unlink(out), add = TRUE)
  suppressMessages(reporte_cruces(data = fx$data, instrumento = fx$instrumento, SECCIONES = fx$secciones,
                                  cruces = "seg", path_xlsx = out, show_sig = FALSE))
  expect_false("Ficha tecnica" %in% openxlsx::getSheetNames(out))
  base <- tempfile(fileext = ".xlsx"); on.exit(unlink(base), add = TRUE)
  .bases_write_xlsx(fx$data, fx$data, base, valores = "codigos",
                    ficha_tecnica = list(instrumento = fx$instrumento, reporte = "Base"))
  expect_false("Ficha tecnica" %in% openxlsx::getSheetNames(base))
})
