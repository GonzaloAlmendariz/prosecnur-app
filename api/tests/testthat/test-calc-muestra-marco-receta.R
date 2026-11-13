# Receta del marco de un público (D6 y D7): declarar el marco desde Actores
# aplica las reglas, etiqueta cada persona con su segmento, escribe N y un
# estrato por segmento en el actor, y la selección sortea sobre el mismo marco.

.rc_estudio <- function() {
  comp <- calc_muestra_normalize_componente(list(
    id = "cmp-doc", actor = "Docentes", actor_id = "docentes", tecnica = "barrido",
    origen_tamano = "cobertura_esperada", canal_recojo = "correo",
    parametros = list(cobertura_objetivo = .2, tau = .25)
  ))
  calc_muestra_normalize_estudio(list(macro_familia = "acreditacion", componentes = list(comp)))
}

.rc_base <- function() {
  n <- 200L
  data.frame(
    codigo = sprintf("D%04d", seq_len(n)),
    cat = rep(c("Contratado", "Principal", "Auxiliar", "Asociado"), c(120, 30, 30, 20)),
    ded = c(rep(c("TPA", "DTC", "TPC20"), c(100, 15, 5)), rep(c("DTC", "TPA"), c(25, 5)), rep(c("DTC", "TPA"), c(20, 10)), rep("DTC", 20)),
    depto = rep(c("Ingeniería", "Externo", "Derecho", "Ingeniería"), c(100, 10, 50, 40)),
    correo = sprintf("d%03d@ejemplo.edu", seq_len(n)),
    stringsAsFactors = FALSE
  )
}

.rc_receta <- function() list(
  columnas = list(id = "codigo", correo = "correo"),
  usos = list(codigo = "id", correo = "correo", cat = "cuota", ded = "cuota", depto = "regla"),
  reglas = list(list(tipo = "excluir_valores", columna = "depto", valores = list("Externo"))),
  segmento = list(nombre = "Condición y categoría", fila = "cat", columna = "ded", grupos = list(
    list(nombre = "Contratado TPA", celdas = list(list(fila = "Contratado", columna = "TPA"), list(fila = "Contratado", columna = "TPC20"))),
    list(nombre = "Contratado TC", celdas = list(list(fila = "Contratado", columna = "DTC"))),
    list(nombre = "Ordinario principal", celdas = list(list(fila = "Principal", columna = "DTC"), list(fila = "Principal", columna = "TPA"))),
    list(nombre = "Ordinario auxiliar", celdas = list(list(fila = "Auxiliar", columna = "DTC"), list(fila = "Auxiliar", columna = "TPA"))),
    list(nombre = "Ordinario asociado", celdas = list(list(fila = "Asociado", columna = "DTC")))
  ))
)

test_that("aplicar la receta deja a los invitados y etiqueta a cada uno con su grupo", {
  ap <- calc_muestra_marco_aplicar_receta(.rc_base(), .rc_receta())
  expect_identical(nrow(ap$datos), 190L)
  expect_identical(ap$columna_segmento, "Condición y categoría")
  tab <- table(ap$datos[["Condición y categoría"]])
  esperado <- with(subset(.rc_base(), depto != "Externo"), c(
    `Contratado TPA` = sum(cat == "Contratado" & ded %in% c("TPA", "TPC20")),
    `Contratado TC` = sum(cat == "Contratado" & ded == "DTC"),
    `Ordinario principal` = sum(cat == "Principal"), `Ordinario auxiliar` = sum(cat == "Auxiliar"),
    `Ordinario asociado` = sum(cat == "Asociado")))
  expect_identical(as.integer(tab[names(esperado)]), unname(as.integer(esperado)))
  expect_false(anyNA(ap$datos[["Condición y categoría"]]))
})

test_that("sin nombre, el segmento se nombra por sus columnas y no pisa una columna de la base", {
  r <- .rc_receta(); r$segmento$nombre <- ""
  ap <- calc_muestra_marco_aplicar_receta(.rc_base(), r)
  expect_identical(ap$columna_segmento, "cat por ded")
  expect_true(all(c("cat", "ded") %in% names(ap$datos)))
})

test_that("una celda sin grupo o la regla de una encuesta por persona no entran en la receta", {
  r <- .rc_receta(); r$segmento$grupos[[5]] <- NULL
  expect_error(calc_muestra_marco_aplicar_receta(.rc_base(), r), class = "api_error")
  r2 <- .rc_receta(); r2$reglas <- list(list(tipo = "una_por_persona"))
  expect_error(calc_muestra_marco_aplicar_receta(.rc_base(), r2), class = "api_error")
  r3 <- .rc_receta(); r3$columnas$id <- ""
  expect_error(calc_muestra_marco_aplicar_receta(.rc_base(), r3), class = "api_error")
})

test_that("declarar con receta escribe N y estratos en el actor, guarda la receta y sortea el mismo marco", {
  testthat::skip_if_not_installed("openxlsx")
  path <- tempfile("rc-", fileext = ".xlsx"); withr::defer(unlink(path))
  openxlsx::write.xlsx(.rc_base(), path, sheetName = "datos")
  sid <- session_create(); withr::defer(session_delete(sid))
  meta <- save_upload(sid, "data", basename(path), readBin(path, "raw", file.size(path)))
  session_set(sid, "calc_muestra_estudio", .rc_estudio())

  out <- .bv_call(mount_calc_muestra_marco_publico, "POST", "/api/calc-muestra/marco-publico/declarar", sid,
                  list(componente_id = "cmp-doc", file_id = meta$file_id, hoja = "datos", receta = .rc_receta()))
  expect_true(out$ok)
  comp <- out$componente
  expect_identical(as.integer(comp$marco$marco_validado), 190L)
  labels <- vapply(comp$marco$estratos, `[[`, "", "label")
  expect_setequal(labels, c("Contratado TPA", "Contratado TC", "Ordinario principal", "Ordinario auxiliar", "Ordinario asociado"))
  expect_identical(sum(vapply(comp$marco$estratos, function(e) as.integer(e$N), 0L)), 190L)
  estado <- session_get(sid)$calc_muestra_general
  expect_identical(estado$marcos[["cmp-doc"]]$receta$segmento$nombre, "Condición y categoría")
  expect_identical(estado$marcos[["cmp-doc"]]$invitados$pasos[[1]]$quitadas, 10L)
  expect_identical(estado$marcos[["cmp-doc"]]$columnas$estrato, "Condición y categoría")

  sel <- .bv_call(mount_calc_muestra_general, "POST", "/api/calc-muestra/general/seleccionar", sid,
                  list(componente_id = "cmp-doc", semilla = 7))
  expect_true(sel$ok)
  expect_identical(nrow(as.data.frame(do.call(rbind, lapply(sel$unidades, as.data.frame)))) > 0, TRUE)
})

test_that("las cuotas del marco guardado reparten la meta por segmento y por una segunda variable", {
  base <- .rc_base(); base$sexo <- rep(c("F", "M"), length.out = nrow(base))
  r <- .rc_receta(); r$usos$sexo <- "cuota"
  solo <- calc_muestra_marco_cuotas(base, r, 50, "celda")
  expect_identical(solo$cuotas$total, 50L)
  expect_identical(solo$cruce$columnas, "Total")
  expect_identical(unlist(solo$columnas_cuota), "sexo")
  cruz <- calc_muestra_marco_cuotas(base, r, 50, "minimo", 10L, "sexo")
  expect_identical(cruz$cruce$columnas, c("F", "M"))
  expect_true(all(cruz$cuotas$cuotas >= pmin(10, cruz$cruce$conteos)))
  expect_error(calc_muestra_marco_cuotas(base, r, 50, "celda", 10L, "depto"), class = "api_error")
  sin <- r; sin$segmento <- list(nombre = "", fila = "", columna = "", grupos = list())
  expect_error(calc_muestra_marco_cuotas(base, sin, 50), class = "api_error")
})

test_that("la ruta de cuotas lee el marco guardado del actor", {
  testthat::skip_if_not_installed("openxlsx")
  base <- .rc_base(); base$sexo <- rep(c("F", "M"), length.out = nrow(base))
  path <- tempfile("rc-c-", fileext = ".xlsx"); withr::defer(unlink(path))
  openxlsx::write.xlsx(base, path, sheetName = "datos")
  sid <- session_create(); withr::defer(session_delete(sid))
  meta <- save_upload(sid, "data", basename(path), readBin(path, "raw", file.size(path)))
  session_set(sid, "calc_muestra_estudio", .rc_estudio())
  r <- .rc_receta(); r$usos$sexo <- "cuota"
  .bv_call(mount_calc_muestra_marco_publico, "POST", "/api/calc-muestra/marco-publico/declarar", sid,
           list(componente_id = "cmp-doc", file_id = meta$file_id, hoja = "datos", receta = r))
  out <- .bv_call(mount_calc_muestra_marco_publico, "POST", "/api/calc-muestra/marco-publico/cuotas", sid,
                  list(componente_id = "cmp-doc", meta = 60, modo = "control", columna = "sexo"))
  expect_true(out$ok)
  expect_identical(out$cuotas$total, 60L)
  expect_length(out$cruce$filas, 5L)
  expect_identical(unlist(out$cuotas$esperadas[[1]]$valores) > 0, c(TRUE, TRUE))
})

test_that("la ruta de cuotas responde 400 con su causa si el actor no tiene base cargada", {
  sid <- session_create(); withr::defer(session_delete(sid))
  session_set(sid, "calc_muestra_estudio", .rc_estudio())
  res <- plumber:::PlumberResponse$new()
  ep <- .bv_endpoint(mount_calc_muestra_marco_publico, "POST", "/api/calc-muestra/marco-publico/cuotas")
  out <- ep$getFunc()(req = .bv_req(sid, list(componente_id = "cmp-doc", meta = 50, modo = "celda")), res = res)
  expect_equal(res$status, 400)
  expect_match(paste(unlist(out), collapse = " "), "no tiene una base cargada")
})

test_that("una tabla de conteos se guarda como marco: N, un segmento por fila y cuotas por el cruce", {
  path <- tempfile("rc-conteos-", fileext = ".csv"); withr::defer(unlink(path))
  writeBin(iconv("Unidad;Mujeres;Hombres;Total;%;Meta\nLetras;250;150;400;0.55;50\nEducación;20;5;25;0.03;3\nCiencias;100;200;300;0.41;40\nTotal;370;355;725;1;93\n",
                 "UTF-8", "latin1", toRaw = TRUE)[[1]], path)
  sid <- session_create(); withr::defer(session_delete(sid))
  meta <- save_upload(sid, "data", basename(path), readBin(path, "raw", file.size(path)))
  session_set(sid, "calc_muestra_estudio", .rc_estudio())
  dec <- .bv_call(mount_calc_muestra_marco_publico, "POST", "/api/calc-muestra/marco-publico/declarar-conteos", sid,
                  list(componente_id = "cmp-doc", file_id = meta$file_id, columna_variable = "Sexo"))
  expect_true(dec$ok)
  expect_identical(as.integer(dec$componente$marco$marco_validado), 725L)
  expect_setequal(vapply(dec$componente$marco$estratos, `[[`, "", "label"), c("Letras", "Educación", "Ciencias"))
  marco <- session_get(sid)$calc_muestra_general$marcos[["cmp-doc"]]
  expect_identical(marco$fuente, "conteos")
  expect_identical(marco$columnas$id, "Unidad")

  por_fila <- .bv_call(mount_calc_muestra_marco_publico, "POST", "/api/calc-muestra/marco-publico/cuotas", sid,
                       list(componente_id = "cmp-doc", meta = 70, modo = "celda"))
  expect_identical(por_fila$cuotas$total, 70L)
  expect_identical(unlist(por_fila$cruce$columnas), "Total")
  expect_identical(unlist(por_fila$columnas_cuota), "Sexo")
  cruce <- .bv_call(mount_calc_muestra_marco_publico, "POST", "/api/calc-muestra/marco-publico/cuotas", sid,
                    list(componente_id = "cmp-doc", meta = 70, modo = "minimo", columna = "Sexo"))
  expect_identical(unlist(cruce$cruce$columnas), c("Mujeres", "Hombres"))
  expect_gt(cruce$cuotas$extra, 0L)
  expect_error(calc_muestra_marco_cuotas_conteos(.cm_mp_leer(path), marco$receta, 70, "celda", 10L, "Otra"), class = "api_error")
  # Otros conteos, otro hash: la selección no confunde dos tablas.
  df <- .cm_mp_leer(path); df$Hombres[1] <- "151"
  otro <- calc_muestra_marco_conteos_declarar(.rc_estudio(), list(), "cmp-doc", df, file_id = "f", columna_variable = "Sexo")
  expect_false(identical(otro$marco$marco_hash, marco$marco_hash))

  # El listado de envío no sale de una tabla de conteos: la selección lo dice.
  res <- plumber:::PlumberResponse$new()
  ep <- .bv_endpoint(mount_calc_muestra_general, "POST", "/api/calc-muestra/general/seleccionar")
  out <- ep$getFunc()(req = .bv_req(sid, list(componente_id = "cmp-doc")), res = res)
  expect_equal(res$status, 400)
  expect_match(paste(unlist(out), collapse = " "), "tabla de conteos")
})

test_that("los rótulos corregidos se aplican después de las reglas y nombran segmentos y cruces", {
  base <- .rc_base(); base$sexo <- rep(c("F", "M"), length.out = nrow(base))
  r <- .rc_receta(); r$usos$sexo <- "cuota"
  r$rotulos <- list(sexo = list(F = "Mujeres", M = "Hombres", X = ""), depto = list(Externo = "Fuera"))
  ap <- calc_muestra_marco_aplicar_receta(base, r)
  # La regla excluye "Externo" sobre el valor original: el rótulo no la desarma.
  expect_identical(nrow(ap$datos), 190L)
  expect_setequal(unique(ap$datos$sexo), c("Mujeres", "Hombres"))
  expect_null(ap$receta$rotulos$sexo$X)
  cu <- calc_muestra_marco_cuotas(base, r, 50, "celda", 10L, "sexo")
  expect_setequal(cu$cruce$columnas, c("Mujeres", "Hombres"))
  # Sin grupos, el segmento toma los rótulos de su columna.
  sin <- r; sin$segmento <- list(nombre = "Sexo", fila = "sexo", columna = "", grupos = list())
  expect_setequal(unique(calc_muestra_marco_aplicar_receta(base, sin)$datos$Sexo), c("Mujeres", "Hombres"))
})

test_that("un rótulo con nombre vacío se ignora y la columna sin rótulos queda como venía", {
  df <- data.frame(s = c("A", "", NA, " B"), n = 1:4, stringsAsFactors = FALSE)
  r <- .cm_receta_rotulos(list(s = list(A = "Alfa"), n = list("1" = "uno")))
  r$s[[""]] <- "Sin dato"
  r <- .cm_receta_rotulos(r)
  out <- .cm_receta_rotular(df, r)
  expect_identical(out$s, c("Alfa", "", NA, " B"))
  expect_identical(out$n[2:4], c("2", "3", "4"))
})
