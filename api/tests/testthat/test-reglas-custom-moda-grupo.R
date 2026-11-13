# Regla propia "Valor distinto del más frecuente en su grupo" (tipo
# `moda_en_grupo`, reglas_custom_moda_grupo.R).
#
# Grano: fila de la tabla principal (la encuesta). Base de cada grupo: las
# encuestas con grupo y valor respondidos. Nombres de columna arbitrarios a
# propósito: los papeles los dice la regla.
#
#   grupo   n   valores
#   COMAS   10  9 con 150110 (una escrita "COMAs"), 1 con 150133   -> marca c10
#   RIMAC   6   5 con 150128, 1 con 150110                         -> marca c16
#   SJL     4   3 valores distintos                                -> grupo chico
#   ATE     6   3 con 150103, 3 con 150104                         -> empate
#   VES     10  5 con 150142, 3 con 150143, 2 con 150144           -> sin apoyo (50 %)
#   (vacío) 1                                                      -> sin datos
#   LIMA    5   4 con 150101, uno sin ubigeo                       -> ese no entra

.moda_datos <- function() {
  grupo <- c(rep("COMAS", 8), "COMAs", "COMAS", rep("RIMAC", 6), rep("SJL", 4),
             rep("ATE", 6), rep("VES", 10), "", rep("LIMA", 5))
  valor <- c(rep("150110", 9), "150133", rep("150128", 5), "150110", "150132", "150133", "150134", "150132",
             rep("150103", 3), rep("150104", 3),
             rep("150142", 5), rep("150143", 3), rep("150144", 2),
             "150110", rep("150101", 4), NA)
  data.frame(respondent_id = sprintf("c%02d", seq_along(grupo)), zz_dist = grupo, cod_x = valor,
             stringsAsFactors = FALSE)
}

.moda_regla <- function(..., id = "RC_MODA", params_extra = list()) {
  list(id = id, activa = TRUE, nombre = "Ubigeo del distrito", tipo = "moda_en_grupo",
       variables = list(),
       params = utils::modifyList(list(grupo = "zz_dist", valor = "cod_x"), params_extra),
       severidad = "advertencia", hallazgo_kind = "caso_validar", ...)
}

.moda_marca <- function(regla, datos = .moda_datos()) {
  rule <- bridge_regla_custom(regla)
  ev <- evaluate_validation_bundle(list(rules = list(rule)), datos, strict = FALSE)
  fila <- ev$resumen[ev$resumen$id_regla == rule$id, ]
  expect_identical(fila$estado_dinamico, "correcta")
  flag <- ev$datos[[rule$flag_name]]
  flag[is.na(flag)] <- FALSE
  sort(datos$respondent_id[flag])
}

# El texto del plan (y del script de limpieza), fuera del motor.
.moda_marca_texto <- function(regla, datos = .moda_datos()) {
  proc <- .compilar_regla_custom(regla)$Procesamiento
  expect_identical(.normalizar_procesamiento(proc), proc)
  expr <- sub("^[A-Za-z0-9_.]+ <- ", "", proc)
  env <- list2env(as.list(datos), parent = baseenv())
  sort(datos$respondent_id[eval(parse(text = expr), envir = env)])
}

test_that("marca el valor distinto del más frecuente y no marca grupos chicos, empates ni sin apoyo", {
  datos <- .moda_datos()
  esperado <- sort(datos$respondent_id[c(10, 16)])
  expect_identical(esperado, c("c10", "c16"))
  regla <- .moda_regla()
  expect_silent(.validar_regla_custom(regla))
  expect_identical(.moda_marca(regla), esperado)
  expect_identical(.moda_marca_texto(regla), esperado)
})

test_that("los umbrales mueven la frontera y se declaran en la medida", {
  datos <- .moda_datos()
  # Con 4 encuestas mínimas, SJL (3 valores distintos, ninguno mayoría) pasa a
  # grupo evaluable pero sin apoyo: 2 de 4 no es la mayoría de nadie.
  med <- moda_grupo_revisar(datos$zz_dist, datos$cod_x, apoyo_min = 60, n_min = 4L)
  expect_identical(med$estado[datos$zz_dist == "SJL"], rep("sin_apoyo", 4))
  # Con 50 % de apoyo, VES (5 de 10 = 50 %) reúne el apoyo y marca a sus 5 distintos.
  med50 <- moda_grupo_revisar(datos$zz_dist, datos$cod_x, apoyo_min = 50, n_min = 5L)
  expect_identical(sum(med50$estado[datos$zz_dist == "VES"] == "marca"), 5L)
  # Con 11 encuestas mínimas ningún grupo tiene referencia.
  med11 <- moda_grupo_revisar(datos$zz_dist, datos$cod_x, n_min = 11L)
  expect_false(any(med11$marca))
})

test_that("la medida cuenta cada estado por encuesta y por grupo, y la suma cierra", {
  l <- .regla_moda_lectura(.moda_datos(), .moda_regla())
  expect_identical(l$n_filas, 42L)
  expect_identical(l$n_marcadas, 2L)
  expect_identical(l$n_grupo_chico, 8L)  # SJL (4) y LIMA (4 con ubigeo)
  expect_identical(l$n_empate, 6L)
  expect_identical(l$n_sin_apoyo, 10L)
  expect_identical(l$n_sin_datos, 2L)  # grupo vacío y ubigeo vacío
  expect_identical(l$n_ok + l$n_marcadas + l$n_grupo_chico + l$n_empate + l$n_sin_apoyo + l$n_sin_datos, l$n_filas)
  expect_identical(l$n_grupos, 6L)
  expect_identical(l$n_grupos_evaluables, 2L)
  expect_identical(l$n_grupos_chicos, 2L)
  expect_identical(l$n_grupos_empate, 1L)
  expect_identical(l$n_grupos_sin_apoyo, 1L)
  # LIMA tiene 5 filas pero una sin ubigeo: el grupo cuenta 4, que es menos de 5.
  expect_equal(l$apoyo_min, 60)
  expect_equal(l$n_min, 5)
})

test_that("un código sin su cero inicial es el mismo valor, no uno distinto", {
  grupo <- rep("SAN SEBASTIAN", 8)
  valor <- c(rep("080105", 5), rep("80105", 2), "081203")
  med <- moda_grupo_revisar(grupo, valor)
  expect_identical(med$estado, c(rep("ok", 7), "marca"))
  expect_identical(med$moda[8], "080105")
  expect_identical(med$n_moda[8], 7L)
})

test_that("la causa nombra el valor, el grupo, la moda y su peso", {
  datos <- .moda_datos()
  med <- .regla_moda_revisar_df(datos, .moda_regla()$params)
  expect_identical(.regla_moda_causa(med, 10L, .moda_regla()$params, list(cod_x = "Ubigeo", zz_dist = "Distrito")),
                   "Ubigeo 150133 en COMAS; en ese distrito 9 de 10 encuestas tienen 150110")
  # Sin etiquetas se usa el nombre de la columna, sin tocarlo.
  expect_identical(.regla_moda_causa(med, 16L, .moda_regla()$params),
                   "cod_x 150110 en RIMAC; en ese zz_dist 5 de 6 encuestas tienen 150128")
  # COMAs y COMAS son el mismo grupo: la forma más escrita da el nombre.
  expect_identical(med$n_grupo[9], 10L)
  expect_identical(med$grupo_forma[9], "COMAS")
})

test_that("el esquema rechaza lo mal formado con su código", {
  codigo <- function(r) tryCatch({ .validar_regla_custom(r); NA_character_ }, api_error = function(e) e$code)
  expect_identical(codigo(.moda_regla(params_extra = list(grupo = ""))), "E_REGLA_SIN_VARS")
  expect_identical(codigo(.moda_regla(params_extra = list(valor = "zz_dist"))), "E_REGLA_INVALIDA")
  expect_identical(codigo(.moda_regla(params_extra = list(apoyo_min = 0))), "E_REGLA_INVALIDA")
  expect_identical(codigo(.moda_regla(params_extra = list(apoyo_min = 101))), "E_REGLA_INVALIDA")
  expect_identical(codigo(.moda_regla(params_extra = list(apoyo_min = "mucho"))), "E_REGLA_INVALIDA")
  expect_identical(codigo(.moda_regla(params_extra = list(n_min = 1))), "E_REGLA_INVALIDA")
  expect_identical(codigo(.moda_regla(params_extra = list(n_min = 5.5))), "E_REGLA_INVALIDA")
  expect_identical(codigo(.moda_regla(params_extra = list(apoyo_min = 70, n_min = 8))), NA_character_)
})

test_that("las variables salen de grupo y valor, con el valor como revisada", {
  r <- .moda_regla()
  expect_identical(.regla_variables_efectivas(r), c("cod_x", "zz_dist"))
  expect_identical(bridge_regla_custom(r)$variables[1], "cod_x")
  expect_identical(validacion_anomalia_tipo("moda_en_grupo"), "contradiccion")
})

test_that("la frase dice los umbrales", {
  ctx <- .vrf_contexto(NULL)
  frase <- function(r) .vrf_texto_plano(.vrf_frase_moda(list(propia = r), ctx))
  expect_identical(frase(.moda_regla()),
                   paste0("Se marca cuando cod_x es distinto del valor más frecuente entre las encuestas con la misma ",
                          "respuesta en zz_dist, si ese valor reúne al menos 60 % del grupo y el grupo tiene al menos 5 encuestas con respuesta."))
  expect_match(frase(.moda_regla(params_extra = list(apoyo_min = 75, n_min = 10))), "al menos 75 % del grupo y el grupo tiene al menos 10 encuestas")
})

test_that("el enunciado del caso sale del grupo entero, fila por fila", {
  datos <- .moda_datos()
  regla <- .moda_regla()
  ctx <- list(moda = .regla_moda_contexto(regla), etiquetas = list(cod_x = "Ubigeo", zz_dist = "Distrito"))
  esp <- .validacion_esperado_por_fila("contradiccion", list(target = "cod_x"), datos, c(10L, 16L, 1L), c("c10", "c16", "c01"),
                                       regla = ctx)
  expect_identical(esp[[1]]$subtipo, "moda_en_grupo")
  expect_identical(esp[[1]]$choque, "Ubigeo 150133 en COMAS; en ese distrito 9 de 10 encuestas tienen 150110")
  expect_match(esp[[1]]$texto, "^c10: Ubigeo 150133 en COMAS; en ese distrito 9 de 10 encuestas tienen 150110\\. ")
  expect_match(esp[[2]]$choque, "^Ubigeo 150110 en RIMAC; en ese distrito 5 de 6 encuestas tienen 150128$")
  # Una encuesta que coincide con la moda no tiene causa.
  expect_identical(esp[[3]]$choque, "")
})

test_that("una regla de otro tipo no trae contexto de moda", {
  expect_null(.regla_moda_contexto(list(tipo = "formato", params = list())))
  expect_null(.regla_moda_contexto(NULL))
})

# --- Conteo previo por HTTP ---------------------------------------------------------

.moda_sesion <- function(dir, datos = .moda_datos()) {
  survey <- data.frame(
    type = "text", name = c("caso", "zz_dist", "cod_x"),
    label = c("Caso", "Distrito", "Ubigeo"),
    required = "", relevant = "", constraint = "", stringsAsFactors = FALSE)
  choices <- data.frame(list_name = "x", name = "1", label = "x", stringsAsFactors = FALSE)
  datos$caso <- sprintf("C-%s", datos$respondent_id)
  xls <- file.path(dir, "formulario.xlsx")
  openxlsx::write.xlsx(list(survey = survey, choices = choices), xls)
  csv <- file.path(dir, "base.csv")
  utils::write.csv(datos, csv, row.names = FALSE, na = "")
  sid <- session_create()
  xm <- save_upload(sid, "xlsform", basename(xls), readBin(xls, "raw", n = file.info(xls)$size))
  dm <- save_upload(sid, "data", basename(csv), readBin(csv, "raw", n = file.info(csv)$size))
  inst <- reporte_instrumento(path = xm$path)
  # "Otra" es la primera y la activa, con otros datos: si algo cae en la
  # primera base, las cifras no calzan.
  otra <- datos[1:2, , drop = FALSE]
  csv2 <- file.path(dir, "otra.csv")
  utils::write.csv(otra, csv2, row.names = FALSE)
  dm2 <- save_upload(sid, "data", basename(csv2), readBin(csv2, "raw", n = file.info(csv2)$size))
  estudio_add_base(sid = sid, nombre = "Otra", xlsform_file_id = xm$file_id, data_file_id = dm2$file_id,
                   data_ext = "csv", rp_data = reporte_data(otra, instrumento = inst), rp_inst = inst,
                   n_filas = nrow(otra), n_columnas = ncol(otra))
  estudio_add_base(sid = sid, nombre = "Distritos", xlsform_file_id = xm$file_id, data_file_id = dm$file_id,
                   data_ext = "csv", rp_data = reporte_data(datos, instrumento = inst), rp_inst = inst,
                   n_filas = nrow(datos), n_columnas = ncol(datos))
  s <- session_get(sid)
  s$estudio$active_base <- "Otra"
  .session_env[[sid]] <- s
  sid
}

test_that("el conteo previo cuenta sobre la base pedida, por id, con la causa y lo que no se evalúa", {
  dir <- withr::local_tempdir()
  sid <- .moda_sesion(dir)
  withr::defer(session_delete(sid))
  r <- .m1_http(.m1_router(), sid, "POST", "/api/validacion/v2/reglas_custom/probar",
                body = as.character(jsonlite::toJSON(.moda_regla(id = ""), auto_unbox = TRUE, null = "null")),
                query = "base_nombre=Distritos")
  expect_identical(r$status, 200L)
  b <- r$body
  expect_identical(b$base_nombre, "Distritos")
  expect_identical(b$n_base, 42L)
  expect_identical(b$n_casos, 2L)
  ids <- vapply(b$ejemplos, function(e) e$id_caso, character(1))
  expect_setequal(ids, c("c10", "c16"))
  c10 <- b$ejemplos[[match("c10", ids)]]
  expect_identical(c10$moda$estado, "marca")
  expect_identical(c10$moda$causa, "Ubigeo 150133 en COMAS; en ese distrito 9 de 10 encuestas tienen 150110")
  expect_identical(c10$moda$n_moda, 9L)
  papeles <- stats::setNames(vapply(c10$valores, `[[`, "", "papel"), vapply(c10$valores, `[[`, "", "variable"))
  expect_identical(papeles[["cod_x"]], "revisada")
  expect_identical(papeles[["zz_dist"]], "comparada")
  l <- b$moda
  expect_identical(l$n_filas, 42L)
  expect_identical(l$n_grupo_chico, 8L)
  expect_identical(l$n_empate, 6L)
  expect_identical(l$n_sin_apoyo, 10L)
  expect_equal(l$apoyo_min, 60)
  expect_equal(l$n_min, 5)
})
