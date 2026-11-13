# Regla propia "Combinación fuera de catálogo" (tipo `combinacion_catalogo`,
# reglas_custom_catalogo.R) y endpoints del catálogo (router_catalogo_ubigeo.R).
#
# Grano: fila de la tabla principal (la encuesta). La cifra es la del motor:
# encuestas marcadas sobre las filas que evalúa la auditoría. Los casos se
# cruzan por el id del motor (respondent_id), nunca por posición.
#
# Nombres de columna arbitrarios a propósito: el papel lo dice la regla.
#
#   id   lugar_a    zz_prov   qq9             cod_x    domic
#   c01  PIURA      SULLANA   LOS OLIVOS      150133   COMAS
#   c02  LIMA       LIMA      COMAS           150110   COMAS
#   c03  LIMA       LIMA      AV COSTANERA    80101    CUSCO
#   c04  LIMA       LIMA      EL RIMAC        150110
#   c05  CUSCO      CUSCO     SAN GERONIMO    999999   COMAS
#   c06  VENEZUELA  CARACAS   LOS TEQUES      150128   COMAs
#   c07                                                SJM
#   c08  LIMA       CALLAO    VENTANILLA      150132   SJL

.cat_datos <- function() {
  data.frame(
    respondent_id = sprintf("c%02d", 1:8),
    lugar_a = c("PIURA", "LIMA", "LIMA", "LIMA", "CUSCO", "VENEZUELA", "", "LIMA"),
    zz_prov = c("SULLANA", "LIMA", "LIMA", "LIMA", "CUSCO", "CARACAS", "", "CALLAO"),
    qq9 = c("LOS OLIVOS", "COMAS", "AV COSTANERA", "EL RIMAC", "SAN GERONIMO", "LOS TEQUES", "", "VENTANILLA"),
    cod_x = c("150133", "150110", "80101", "150110", "999999", "150128", "", "150132"),
    domic = c("COMAS", "COMAS", "CUSCO", "", "COMAS", "COMAs", "SJM", "SJL"),
    stringsAsFactors = FALSE
  )
}

.cat_regla <- function(roles, ..., id = "RC_CAT", params_extra = list()) {
  list(id = id, activa = TRUE, nombre = "Lugar", tipo = "combinacion_catalogo",
       variables = list(), params = c(list(roles = roles), params_extra),
       severidad = "advertencia", hallazgo_kind = "caso_validar", ...)
}

.cat_nacimiento <- function(...) .cat_regla(list(departamento = "lugar_a", provincia = "zz_prov", distrito = "qq9"), ...)
.cat_domicilio <- function(...) .cat_regla(list(ubigeo = "cod_x", distrito = "domic"), ...)

.cat_marca <- function(regla, datos = .cat_datos()) {
  rule <- bridge_regla_custom(regla)
  ev <- evaluate_validation_bundle(list(rules = list(rule)), datos, strict = FALSE)
  fila <- ev$resumen[ev$resumen$id_regla == rule$id, ]
  expect_identical(fila$estado_dinamico, "correcta")
  flag <- ev$datos[[rule$flag_name]]
  flag[is.na(flag)] <- FALSE
  sort(datos$respondent_id[flag])
}

# El texto del plan (y del script de limpieza), fuera del motor.
.cat_marca_texto <- function(regla, datos = .cat_datos()) {
  proc <- .compilar_regla_custom(regla)$Procesamiento
  expect_identical(.normalizar_procesamiento(proc), proc)
  expr <- sub("^[A-Za-z0-9_.]+ <- ", "", proc)
  env <- list2env(as.list(datos), parent = baseenv())
  flag <- eval(parse(text = expr), envir = env)
  sort(datos$respondent_id[flag])
}

.cat_ambos <- function(regla, esperado, datos = .cat_datos()) {
  expect_silent(.validar_regla_custom(regla))
  expect_identical(.cat_marca(regla, datos), sort(esperado))
  expect_identical(.cat_marca_texto(regla, datos), sort(esperado))
}

test_that("lugar de nacimiento: marca errores y nombres no reconocidos, por encuesta", {
  # c01 Los Olivos fuera de Sullana; c03 "AV COSTANERA"; c05 "SAN GERONIMO";
  # c06 Venezuela; c08 Callao no es provincia de Lima. c04 "EL RIMAC" calza.
  .cat_ambos(.cat_nacimiento(), c("c01", "c03", "c05", "c06", "c08"))
  # Lo omitido no se marca.
  .cat_ambos(.cat_nacimiento(params_extra = list(omitir = list("Venezuela"))), c("c01", "c03", "c05", "c08"))
})

test_that("un subconjunto de papeles: solo ubigeo y distrito", {
  # c01 150133 no es Comas; c05 999999 no existe. c03 "80101" se lee como
  # 080101 (Cusco); c06 "COMAs" con 150128 (Rímac) no calza; c04 y c07 están
  # incompletas y no se marcan salvo que se pida.
  .cat_ambos(.cat_domicilio(), c("c01", "c05", "c06"))
  .cat_ambos(.cat_domicilio(params_extra = list(marcar_incompletos = TRUE)), c("c01", "c04", "c05", "c06", "c07"))
})

test_that("las variables salen de los papeles, con la más específica como revisada", {
  r <- .cat_regla(list(ubigeo = "cod_x", provincia = "zz_prov", distrito = "qq9"))
  expect_identical(.regla_variables_efectivas(r), c("qq9", "zz_prov", "cod_x"))
  rule <- bridge_regla_custom(r)
  expect_identical(rule$variables[1], "qq9")
  expect_identical(validacion_anomalia_tipo("combinacion_catalogo"), "valor_invalido")
})

test_that("el esquema rechaza papeles mal formados con su código", {
  codigo <- function(r) tryCatch({ .validar_regla_custom(r); NA_character_ }, api_error = function(e) e$code)
  expect_identical(codigo(.cat_regla(list(distrito = "qq9"))), "E_REGLA_SIN_VARS")
  expect_identical(codigo(.cat_regla(list(distrito = "qq9", provincia = "qq9"))), "E_REGLA_INVALIDA")
  expect_identical(codigo(.cat_regla(list(distrito = "qq9", region = "lugar_a"))), "E_REGLA_INVALIDA")
  expect_identical(codigo(.cat_regla(list(distrito = "qq9", provincia = "zz_prov"),
                                     params_extra = list(catalogo = "narnia"))), "E_REGLA_INVALIDA")
})

test_that("el enunciado del caso dice la causa y trae el candidato, sin aplicarlo", {
  ctx <- .regla_catalogo_contexto(.cat_nacimiento())
  e <- .regla_catalogo_enunciado(ctx, list(lugar_a = "PIURA", zz_prov = "SULLANA", qq9 = "LOS OLIVOS"))
  expect_identical(e$hecho, "declaró departamento \"PIURA\", provincia \"SULLANA\", distrito \"LOS OLIVOS\"")
  expect_identical(e$choque, "Los Olivos no es un distrito de Sullana (Piura)")
  expect_identical(e$estado, "error")
  expect_identical(e$candidatos[[1]]$valor, "Lima")
  ok <- .regla_catalogo_enunciado(ctx, list(lugar_a = "LIMA", zz_prov = "LIMA", qq9 = "COMAS"))
  expect_identical(ok$hecho, "")
  d <- .regla_catalogo_enunciado(.regla_catalogo_contexto(.cat_domicilio()), list(cod_x = "150133", domic = "SJL"))
  expect_identical(d$choque, "Ubigeo 150133 corresponde a San Juan de Miraflores (Lima, Lima), no a San Juan de Lurigancho")
})

test_that("la frase nombra los papeles y el catálogo", {
  ctx <- .vrf_contexto(NULL)
  frase <- function(r) .vrf_texto_plano(.vrf_frase_catalogo(list(propia = r), ctx))
  expect_identical(frase(.cat_domicilio()),
                   "Se marca cuando la combinación de distrito domic y ubigeo cod_x no existe en Ubigeos del Perú (INEI), o algún nombre no se reconoce.")
  expect_identical(frase(.cat_nacimiento(params_extra = list(omitir = list("VENEZUELA")))),
                   paste0("Se marca cuando la combinación de departamento lugar_a, provincia zz_prov y distrito qq9",
                          " no existe en Ubigeos del Perú (INEI), o algún nombre no se reconoce.",
                          " No se revisan los casos con \"VENEZUELA\"."))
})

# --- Conteo previo, propuesta y catálogo por HTTP --------------------------------

.cat_sesion <- function(dir, datos = .cat_datos()) {
  survey <- data.frame(
    type = "text", name = c("caso", "lugar_a", "zz_prov", "qq9", "cod_x", "domic"),
    label = c("Caso", "Región", "Provincia", "Distrito", "Ubigeo", "Distrito del domicilio"),
    required = "", relevant = "", constraint = "", stringsAsFactors = FALSE)
  choices <- data.frame(list_name = "x", name = "1", label = "x", stringsAsFactors = FALSE)
  datos$caso <- sprintf("C-%s", datos$respondent_id)
  xls <- file.path(dir, "formulario.xlsx")
  openxlsx::write.xlsx(list(survey = survey, choices = choices), xls)
  csv <- file.path(dir, "base.csv")
  utils::write.csv(datos, csv, row.names = FALSE)
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
  estudio_add_base(sid = sid, nombre = "Lugares", xlsform_file_id = xm$file_id, data_file_id = dm$file_id,
                   data_ext = "csv", rp_data = reporte_data(datos, instrumento = inst), rp_inst = inst,
                   n_filas = nrow(datos), n_columnas = ncol(datos))
  s <- session_get(sid)
  s$estudio$active_base <- "Otra"
  .session_env[[sid]] <- s
  sid
}

test_that("el conteo previo cuenta sobre la base pedida, por id, con la causa y el candidato de cada caso", {
  dir <- withr::local_tempdir()
  sid <- .cat_sesion(dir)
  withr::defer(session_delete(sid))
  regla <- .cat_nacimiento(id = "")
  r <- .m1_http(.m1_router(), sid, "POST", "/api/validacion/v2/reglas_custom/probar",
                body = as.character(jsonlite::toJSON(regla, auto_unbox = TRUE, null = "null")),
                query = "base_nombre=Lugares")
  expect_identical(r$status, 200L)
  b <- r$body
  expect_identical(b$base_nombre, "Lugares")
  expect_identical(b$n_base, 8L)
  expect_identical(b$n_casos, 5L)
  ids <- vapply(b$ejemplos, function(e) e$id_caso, character(1))
  expect_setequal(ids, c("c01", "c03", "c05", "c06", "c08"))
  c01 <- b$ejemplos[[match("c01", ids)]]$catalogo
  expect_identical(c01$estado, "error")
  expect_identical(c01$causa, "Los Olivos no es un distrito de Sullana (Piura)")
  expect_identical(c01$candidatos[[1]]$valor, "Lima")
  c03 <- b$ejemplos[[match("c03", ids)]]$catalogo
  expect_identical(c03$estado, "no_reconocido")
  expect_true(c03$a_investigar)
  c05 <- b$ejemplos[[match("c05", ids)]]$catalogo
  expect_identical(c05$candidatos[[1]]$entidad$ubigeo, "080104")
  l <- b$catalogo
  expect_identical(l$n_filas, 8L)
  expect_identical(l$n_ok + l$n_incompletas + l$n_error + l$n_no_reconocido + l$n_omitidas + l$n_sin_datos, l$n_filas)
  expect_identical(l$n_error, 2L)
  expect_identical(l$n_no_reconocido, 3L)
  expect_identical(l$n_sin_datos, 1L)
  expect_true("VENEZUELA" %in% vapply(l$no_reconocidos, `[[`, "", "valor"))
})

.cat_router <- function() {
  mount_catalogo_ubigeo(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
}

test_that("la propuesta de papeles mira la base pedida y no la primera", {
  dir <- withr::local_tempdir()
  sid <- .cat_sesion(dir)
  withr::defer(session_delete(sid))
  r <- .m1_http(.cat_router(), sid, "GET", "/api/validacion/v2/reglas_custom/catalogo/proponer",
                query = "base_nombre=Lugares")
  expect_identical(r$status, 200L)
  b <- r$body
  expect_identical(b$base_nombre, "Lugares")
  expect_identical(b$estado, "propuesta")
  expect_identical(b$n_filas, 8L)
  # Columnas de "Lugares" (la primera base no tiene datos de lugar distintos,
  # pero solo 2 filas): la propuesta trae dos papeles o más en cada grupo.
  roles <- lapply(b$propuestas, function(g) unlist(Filter(Negate(is.null), g$roles)))
  expect_true(all(vapply(roles, length, integer(1)) >= 2L))
  expect_true(all(unlist(roles) %in% c("lugar_a", "zz_prov", "qq9", "cod_x", "domic")))
  expect_gte(length(b$propuestas), 1L)
  expect_gte(length(b$columnas), 4L)
  otra <- .m1_http(.cat_router(), sid, "GET", "/api/validacion/v2/reglas_custom/catalogo/proponer")$body
  expect_identical(otra$base_nombre, "Otra")
  expect_identical(otra$n_filas, 2L)
})

test_that("buscar y cascada responden con la ruta completa y validan la entrada", {
  pr <- .cat_router()
  b <- .m1_http(pr, "x", "GET", "/api/catalogos/ubigeo/buscar", query = "q=san%20juan%20de%20lur&nivel=distrito")
  expect_identical(b$status, 200L)
  it <- b$body$items[[1]]
  expect_identical(it$ubigeo, "150132")
  expect_identical(it$departamento, "Lima")
  expect_identical(it$ruta, "San Juan de Lurigancho (Lima, Lima)")
  expect_identical(.m1_http(pr, "x", "GET", "/api/catalogos/ubigeo/buscar", query = "q=a&nivel=pais")$status, 400L)
  expect_identical(.m1_http(pr, "x", "GET", "/api/catalogos/ubigeo/buscar", query = "q=a&limite=0")$status, 400L)
  c <- .m1_http(pr, "x", "GET", "/api/catalogos/ubigeo/cascada", query = "departamento=Piura")
  expect_identical(c$body$nivel, "provincia")
  expect_true("Sullana" %in% vapply(c$body$items, `[[`, "", "provincia"))
  expect_identical(.m1_http(pr, "x", "GET", "/api/catalogos/ubigeo/cascada", query = "provincia=Lima")$status, 400L)
  expect_identical(.m1_http(pr, "x", "GET", "/api/catalogos/ubigeo/cascada", query = "departamento=Narnia")$status, 404L)
})
