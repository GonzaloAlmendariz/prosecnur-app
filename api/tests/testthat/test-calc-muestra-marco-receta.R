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
