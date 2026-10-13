# Ítem 1f — «Agrupar categorías» en Codificación (codificacion_agrupar.R).
#
# Casos replicados de HSyVBG 2026: P4 orientación sexual (con «Otro» de texto),
# P5 lugar de nacimiento (resto) y P8 año de ingreso (rangos sobre códigos que
# son años, más «Otro» con un año escrito). Además: validación del nombre de la
# variable nueva frente a catálogos que reservan `<parent>_recod` aunque no estén
# aplicados, aplicación por ppra_adaptar_data/ppra_adaptar_instrumento,
# reaplicación idempotente, plan, gate de Gráficos, reparación del .pulso,
# configuración JSON y contrato HTTP real.

source("setup-load-all.R")

.agr_cat <- function(codigo, etiqueta, codigos = character(0), rango = NULL,
                     otros_textos = character(0), otros_numerico = FALSE,
                     otros_resto = FALSE, resto = FALSE) {
  list(codigo = codigo, etiqueta = etiqueta, codigos = as.list(codigos), rango = rango,
       otros_textos = as.list(otros_textos), otros_numerico = otros_numerico,
       otros_resto = otros_resto, resto = resto)
}

.agr_spec_p4 <- function(target = "P4_recod") {
  list(
    parent = "P4", target = target, text_col = "P4_otro", codigo_otro = "88",
    categorias = list(
      .agr_cat("98", "No sabe / prefiere no decir", codigos = "99", otros_resto = TRUE),
      .agr_cat("1", "Heterosexual", codigos = "1"),
      .agr_cat("2", "No heterosexual", codigos = c("2", "3"), otros_textos = c("Pansexual", "queer"))
    )
  )
}

test_that("P4: códigos, «Otro» por texto, «Otro» al resto y especial", {
  df <- data.frame(
    P4 = c(1, 2, 3, 88, 88, 99, NA, 88),
    P4_otro = c("", "", "", "  PANSEXUAL ", "prefiero no decir", "", "", ""),
    stringsAsFactors = FALSE
  )
  out <- codif_agrupar_df(df, .agr_spec_p4())
  # 88 sin texto: no hay categoría con el código 88 ni resto -> NA.
  expect_identical(out, c("1", "2", "2", "2", "98", "98", NA, NA))
  # La original no se toca.
  expect_identical(df$P4, c(1, 2, 3, 88, 88, 99, NA, 88))
})

test_that("P5: códigos explícitos, resto para lo demás y NA se queda NA", {
  spec <- list(
    parent = "P5", target = "P5_recod",
    categorias = list(
      .agr_cat("1", "Lima y Callao", codigos = c("15", "7")),
      .agr_cat("2", "Fuera del país", codigos = "27"),
      .agr_cat("3", "Otras regiones", resto = TRUE)
    )
  )
  df <- data.frame(P5 = c("15", "7", "27", "4", "11", NA, ""), stringsAsFactors = FALSE)
  expect_identical(codif_agrupar_df(df, spec), c("1", "1", "2", "3", "3", NA, NA))
  # Un especial 80-99 («No responde») no cae en «Otras regiones» por resto.
  df99 <- data.frame(P5 = c("99", "4"), stringsAsFactors = FALSE)
  expect_identical(codif_agrupar_df(df99, spec), c(NA, "3"))
})

test_that("P8: rangos sobre códigos-año y «Otro» numérico con rango", {
  spec <- list(
    parent = "P8", target = "P8_recod", text_col = "P8_otro", codigo_otro = "88",
    categorias = list(
      .agr_cat("1", "2021 o antes", rango = list(min = NULL, max = 2021), otros_numerico = TRUE),
      .agr_cat("2", "2022-2023", rango = list(min = 2022, max = 2023), otros_numerico = TRUE),
      .agr_cat("3", "2024 o después", rango = list(min = 2024, max = NULL))
    )
  )
  df <- data.frame(
    P8 = c("2019", "2021", "2022", "2023", "2024", "2026", "88", "88", "88"),
    P8_otro = c("", "", "", "", "", "", "2017", "hace mucho", "2023"),
    stringsAsFactors = FALSE
  )
  # «hace mucho» no es número y no hay otros_resto: cae a la ruta por código;
  # 88 no está en ningún rango de años -> NA.
  expect_identical(codif_agrupar_df(df, spec), c("1", "1", "2", "2", "3", "3", "1", NA, "2"))
  # Un rango abierto («2021 o antes») no se traga el 99 «No responde»; un código
  # explícito sí lo agrupa.
  df99 <- data.frame(P8 = "99", P8_otro = "", stringsAsFactors = FALSE)
  expect_identical(codif_agrupar_df(df99, spec), NA_character_)
  spec$categorias[[4]] <- .agr_cat("99", "No responde", codigos = "99")
  expect_identical(codif_agrupar_df(df99, spec), "99")
})

test_that("validación: códigos únicos, un solo resto, target distinto y otros sin text_col", {
  val <- function(spec, ocupados = character(0)) {
    tryCatch(codif_agrupar_validar_spec(codif_agrupar_normalizar_spec(spec), ocupados),
             error = function(e) e)
  }
  base <- .agr_spec_p4()
  expect_identical(val(base)$parent, "P4")

  dup <- base; dup$categorias[[2]]$codigo <- "98"
  expect_identical(val(dup)$code, "E_CODIF_AGRUPACION_INVALIDA")

  dos_restos <- list(parent = "P5", target = "P5_recod", categorias = list(
    .agr_cat("1", "A", resto = TRUE), .agr_cat("2", "B", resto = TRUE)))
  expect_identical(val(dos_restos)$code, "E_CODIF_AGRUPACION_INVALIDA")

  mismo <- base; mismo$target <- "P4"
  expect_identical(val(mismo)$code, "E_CODIF_AGRUPACION_INVALIDA")

  sin_texto <- base; sin_texto$text_col <- NULL
  expect_identical(val(sin_texto)$code, "E_CODIF_AGRUPACION_INVALIDA")

  origen_doble <- base; origen_doble$categorias[[1]]$codigos <- list("1")
  expect_identical(val(origen_doble)$code, "E_CODIF_AGRUPACION_INVALIDA")

  ocupado <- val(base, ocupados = c(P4_recod = "la codificación de «P4»"))
  expect_identical(ocupado$code, "E_CODIF_AGRUPACION_TARGET_OCUPADO")
  expect_identical(ocupado$status, 409)
  expect_identical(ocupado$details$sugerido, "P4_agrup")
})

# ---- Sesión: caso real HSyVBG (catálogo sin aplicar reserva `<parent>_recod`) ---

.agr_write_xlsform <- function(path) {
  survey <- data.frame(
    type = c("select_one lst_p4", "text", "select_one lst_p5"),
    name = c("P4", "P4_otro", "P5"),
    label = c("Orientación sexual", "Otra orientación", "Lugar de nacimiento"),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = c(rep("lst_p4", 5), rep("lst_p5", 3)),
    name = c("1", "2", "3", "88", "99", "7", "15", "27"),
    label = c("Heterosexual", "Gay o lesbiana", "Bisexual", "Otro", "Prefiero no responder",
              "Callao", "Lima", "Extranjero"),
    stringsAsFactors = FALSE
  )
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "survey"); openxlsx::writeData(wb, "survey", survey)
  openxlsx::addWorksheet(wb, "choices"); openxlsx::writeData(wb, "choices", choices)
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

.agr_data <- function() {
  data.frame(
    `_index` = 1:6,
    P4 = c(1, 2, 3, 88, 88, 99),
    P4_otro = c("", "", "", "pansexual", "prefiero no decir", ""),
    P5 = c(15, 7, 27, 4, 11, 15),
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

.agr_session <- function() {
  td <- tempfile("codif-agrupar-"); dir.create(td)
  inst <- .agr_write_xlsform(file.path(td, "inst.xlsx"))
  dat <- file.path(td, "data.xlsx")
  openxlsx::write.xlsx(.agr_data(), dat, overwrite = TRUE)
  sid <- session_create()
  save_upload(sid, "xlsform", "inst.xlsx", readBin(inst, "raw", n = file.info(inst)$size))
  save_upload(sid, "data", "data.xlsx", readBin(dat, "raw", n = file.info(dat)$size))
  sid
}

test_that("HSyVBG: grupos_recod sin aplicar y familia en modo padre reservan <parent>_recod", {
  skip_if_not_installed("openxlsx")
  sid <- .agr_session()
  on.exit(session_delete(sid), add = TRUE)
  # Catálogo de P4 definido y NO aplicado (no hay `aplicado` ni columna _recod).
  codif_set(sid, "grupos_recod", list(P4 = list(list(codigo = "5", etiqueta = "Otra", respuestas = list("x")))))
  # P5: familia select_one en modo padre sin grupos todavía.
  codif_set(sid, "familias_draft", list(rows = list(
    list(parent = "P5", tipo = "select_one", modo_so = "padre", text_col = "")
  )))

  g4 <- codif_agrupacion_get(sid, "P4")
  expect_identical(g4$target_sugerido, "P4_agrup")
  expect_true("P4_recod" %in% unlist(g4$nombres_ocupados))
  expect_identical(g4$text_col_sugerida, "P4_otro")
  n_por <- stats::setNames(vapply(g4$codigos, function(x) x$n, integer(1)),
                           vapply(g4$codigos, function(x) x$codigo, character(1)))
  expect_identical(unname(n_por[c("1", "88", "99")]), c(1L, 2L, 1L))
  expect_identical(g4$codigos[[1]]$etiqueta, "Heterosexual")
  textos <- vapply(g4$textos_otro, function(x) x$texto, character(1))
  expect_setequal(textos, c("pansexual", "prefiero no decir"))
  expect_true(is.na(g4$spec))

  err <- tryCatch(codif_agrupacion_set(sid, "P4", .agr_spec_p4("P4_recod")), error = function(e) e)
  expect_identical(err$code, "E_CODIF_AGRUPACION_TARGET_OCUPADO")
  expect_match(conditionMessage(err), "P4_agrup", fixed = TRUE)

  err5 <- tryCatch(codif_agrupacion_set(sid, "P5", list(target = "P5_recod", categorias = list(
    .agr_cat("1", "Lima y Callao", codigos = c("15", "7")), .agr_cat("3", "Otras", resto = TRUE)
  ))), error = function(e) e)
  expect_identical(err5$code, "E_CODIF_AGRUPACION_TARGET_OCUPADO")

  ok <- codif_agrupacion_set(sid, "P4", .agr_spec_p4("P4_agrup"))
  expect_identical(ok$spec$target, "P4_agrup")
  cats <- stats::setNames(vapply(ok$vista_previa$categorias, function(x) x$n, integer(1)),
                          vapply(ok$vista_previa$categorias, function(x) x$codigo, character(1)))
  expect_identical(unname(cats[c("1", "2", "98")]), c(1L, 3L, 2L))
  # Re-guardar la propia agrupación con su mismo target no choca consigo misma.
  expect_identical(codif_agrupacion_set(sid, "P4", .agr_spec_p4("P4_agrup"))$spec$target, "P4_agrup")
  expect_identical(codif_agrupacion_get(sid, "P4")$target_sugerido, "P4_agrup")

  # Otra agrupación no puede reusar el target de la de P4.
  err_otra <- tryCatch(codif_agrupacion_set(sid, "P5", list(target = "P4_agrup", categorias = list(
    .agr_cat("1", "Lima", codigos = "15")))), error = function(e) e)
  expect_identical(err_otra$code, "E_CODIF_AGRUPACION_TARGET_OCUPADO")

  # Parent inexistente y borrado.
  expect_identical(tryCatch(codif_agrupacion_get(sid, "NOPE"), error = function(e) e)$code,
                   "E_CODIF_AGRUPACION_PARENT")
  borrado <- codif_agrupacion_set(sid, "P4", NULL)
  expect_true(is.na(borrado$spec))
  expect_null(codif_get(sid, "agrupaciones")$P4)
})

test_that("multibase: la agrupación se guarda en la base pedida y no cae en la primera", {
  skip_if_not_installed("openxlsx")
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  td <- file.path(session_get(sid)$dir, "qa"); dir.create(td, recursive = TRUE)
  inst_path <- .agr_write_xlsform(file.path(td, "inst.xlsx"))
  for (nombre in c("estudiantes", "docentes")) {
    dat_path <- file.path(td, paste0(nombre, ".xlsx"))
    openxlsx::write.xlsx(.agr_data(), dat_path, overwrite = TRUE)
    im <- save_upload(sid, "xlsform", "inst.xlsx", readBin(inst_path, "raw", n = file.info(inst_path)$size))
    dm <- save_upload(sid, "data", basename(dat_path), readBin(dat_path, "raw", n = file.info(dat_path)$size))
    inst <- reporte_instrumento(path = im$path)
    estudio_add_base(sid = sid, nombre = nombre, xlsform_file_id = im$file_id,
                     data_file_id = dm$file_id, data_ext = "xlsx",
                     rp_data = reporte_data(.agr_data(), instrumento = inst), rp_inst = inst)
  }
  estudio_active_base_set(sid, "estudiantes")
  codif_agrupacion_set(sid, "P4", .agr_spec_p4("P4_recod"), base = "docentes")
  expect_null(codif_get(sid, "agrupaciones", source = "estudiantes"))
  expect_identical(codif_get(sid, "agrupaciones", source = "docentes")$P4$target, "P4_recod")
  expect_length(codif_agrupaciones_para_aplicar(sid, "estudiantes"), 0L)
  expect_length(codif_agrupaciones_para_aplicar(sid, "docentes"), 1L)
  expect_identical(tryCatch(codif_agrupacion_get(sid, "P4", base = "nope"), error = function(e) e)$code,
                   "E_CODIF_MATRIX_BASE_NOT_FOUND")
})

# ---- Aplicación: data + instrumento, e idempotencia --------------------------

.agr_aplicar <- function(td, inst_in, data_in, sufijo, agrupaciones) {
  tpl <- file.path(td, "plantilla_vacia.xlsx")
  if (!file.exists(tpl)) openxlsx::write.xlsx(data.frame(x = 1), tpl, overwrite = TRUE)
  data_out <- file.path(td, paste0("data_", sufijo, ".xlsx"))
  inst_out <- file.path(td, paste0("inst_", sufijo, ".xlsx"))
  ppra_adaptar_data(path_instrumento = inst_in, path_datos = data_in, path_plantilla = tpl,
                    out_path = data_out, agrupaciones = agrupaciones)
  ppra_adaptar_instrumento(path_instrumento_in = inst_in, path_data_adaptada = data_out,
                           path_instrumento_out = inst_out, agrupaciones = agrupaciones)
  list(data = data_out, inst = inst_out)
}

test_that("aplicar crea la columna y la select_one con su lista; reaplicar no duplica", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  td <- tempfile("codif-agrupar-aplicar-"); dir.create(td)
  inst_in <- .agr_write_xlsform(file.path(td, "inst.xlsx"))
  data_in <- file.path(td, "data.xlsx")
  openxlsx::write.xlsx(.agr_data(), data_in, overwrite = TRUE)
  agr <- list(codif_agrupar_normalizar_spec(.agr_spec_p4("P4_recod")))

  r1 <- .agr_aplicar(td, inst_in, data_in, "1", agr)
  d1 <- as.data.frame(readxl::read_excel(r1$data))
  expect_identical(sum(names(d1) == "P4_recod"), 1L)
  # Columna después del verbatim de «Otro»: P4, P4_otro, P4_recod.
  expect_identical(match("P4_recod", names(d1)), match("P4_otro", names(d1)) + 1L)
  expect_identical(as.character(d1$P4_recod), c("1", "2", "2", "2", "98", "98"))
  expect_identical(as.numeric(d1$P4), c(1, 2, 3, 88, 88, 99))

  s1 <- readxl::read_excel(r1$inst, sheet = "survey")
  c1 <- readxl::read_excel(r1$inst, sheet = "choices")
  fila <- s1[s1$name == "P4_recod", ]
  expect_identical(nrow(fila), 1L)
  expect_identical(fila$type, "select_one lst_P4_recod")
  expect_identical(fila$label, "Orientación sexual")
  lista <- c1[c1$list_name == "lst_P4_recod", ]
  # Catálogo propio (no arrastra el original) y el especial 98 al final.
  expect_identical(lista$name, c("1", "2", "98"))
  expect_identical(lista$label, c("Heterosexual", "No heterosexual", "No sabe / prefiere no decir"))

  # Reaplicar sobre la salida adaptada: una columna, una fila, la misma lista.
  r2 <- .agr_aplicar(td, r1$inst, r1$data, "2", agr)
  d2 <- as.data.frame(readxl::read_excel(r2$data))
  expect_identical(sum(names(d2) == "P4_recod"), 1L)
  expect_identical(as.character(d2$P4_recod), as.character(d1$P4_recod))
  s2 <- readxl::read_excel(r2$inst, sheet = "survey")
  c2 <- readxl::read_excel(r2$inst, sheet = "choices")
  expect_identical(sum(s2$name == "P4_recod"), 1L)
  expect_identical(c2$name[c2$list_name == "lst_P4_recod"], c("1", "2", "98"))
  expect_identical(nrow(c2), nrow(c1))
})

test_that("plan de adaptación y has_user_state incluyen las agrupaciones", {
  skip_if_not_installed("openxlsx")
  sid <- .agr_session()
  on.exit(session_delete(sid), add = TRUE)
  expect_false(.codif_apply_has_user_state(sid))
  codif_agrupacion_set(sid, "P4", .agr_spec_p4("P4_recod"))
  expect_true(.codif_apply_has_user_state(sid))
  plan <- .compute_plan_adaptacion(sid)
  item <- Filter(function(p) identical(p$tipo, "agrupacion"), plan$preguntas)
  expect_length(item, 1L)
  expect_identical(item[[1]]$nueva_variable, "P4_recod")
  expect_identical(item[[1]]$n_respuestas_afectadas, 6L)
  expect_identical(plan$totales$n_variables_nuevas, 1L)
  expect_identical(plan$totales$n_codigos_nuevos, 3L)
})

test_that("gate de Gráficos: la agrupación cuenta como recod definida y reconoce su target", {
  cat <- list(P4_agrup = list(list(codigo = "1", etiqueta = "Heterosexual")))
  sin <- graficos_recod_gate_evaluate(cat, list(), targets = list(P4_agrup = "P4_agrup"))
  expect_identical(sin$recod_pendientes, "P4_agrup")
  con <- graficos_recod_gate_evaluate(
    cat, list(P4_agrup = list(list(code = "1", label = "Heterosexual"))),
    targets = list(P4_agrup = "P4_agrup")
  )
  expect_length(con$recod_pendientes, 0L)
  expect_length(con$recod_orphan, 0L)
  expect_length(con$recod_drift, 0L)
})

test_that("reparación del .pulso no pisa un <parent>_recod que es de una agrupación", {
  s <- list(codif_por_base = list(b = list(
    familias_draft = list(rows = list(list(parent = "P4", tipo = "select_one", modo_so = "padre", text_col = "P4_otro"))),
    grupos_recod = list(),
    agrupaciones = list(P4 = list(parent = "P4", target = "P4_recod"))
  )))
  expect_length(.pulso_parent_recod_repairs(s, "b"), 0L)
  s$codif_por_base$b$agrupaciones <- list()
  expect_length(.pulso_parent_recod_repairs(s, "b"), 1L)
})

test_that("configuración JSON: export lleva las agrupaciones y el import las restituye", {
  skip_if_not_installed("openxlsx")
  sid <- .agr_session()
  on.exit(session_delete(sid), add = TRUE)
  codif_agrupacion_set(sid, "P4", .agr_spec_p4("P4_recod"))
  bundle <- codif_config_export(sid)
  expect_length(bundle$agrupaciones, 1L)
  # Ida y vuelta por JSON real (como lo descarga y sube la UI).
  bundle <- jsonlite::fromJSON(
    jsonlite::toJSON(bundle, auto_unbox = TRUE, null = "null", na = "null"),
    simplifyVector = FALSE
  )

  sid2 <- .agr_session()
  on.exit(session_delete(sid2), add = TRUE)
  prev <- codif_config_preview_import(sid2, bundle)
  expect_identical(prev$agrupaciones[[1]]$status, "compatible")
  res <- codif_config_apply_import(sid2, bundle, selections = list())
  expect_identical(res$summary$agrupaciones_importadas, 1L)
  sp <- codif_get(sid2, "agrupaciones")$P4
  expect_identical(sp$target, "P4_recod")
  expect_identical(
    codif_agrupar_df(.agr_data(), sp),
    codif_agrupar_df(.agr_data(), .agr_spec_p4("P4_recod"))
  )
})

test_that("contrato HTTP: GET/POST /api/codificacion/agrupacion", {
  srv <- http_contract_server()
  base <- http_contract_upload_base(srv)
  sid <- base$sid

  falta <- http_get(srv, "/api/codificacion/agrupacion", sid = sid)
  expect_identical(falta$status, 400L)
  expect_identical(falta$json$error$code, "E_NO_PARENT")

  g <- http_get(srv, "/api/codificacion/agrupacion?parent=region", sid = sid)
  expect_identical(g$status, 200L)
  expect_null(g$json$spec)
  expect_identical(g$json$target_sugerido, "region_recod")
  expect_setequal(vapply(g$json$codigos, function(x) x$codigo, ""), c("norte", "sur"))

  spec <- list(parent = "region", target = "region_recod", text_col = NULL, codigo_otro = NULL,
               categorias = list(
                 list(codigo = "1", etiqueta = "Norte", codigos = list("norte"), rango = NULL,
                      otros_textos = list(), otros_numerico = FALSE, otros_resto = FALSE, resto = FALSE),
                 list(codigo = "2", etiqueta = "Resto", codigos = list(), rango = NULL,
                      otros_textos = list(), otros_numerico = FALSE, otros_resto = FALSE, resto = TRUE)
               ))
  p <- http_post_json(srv, "/api/codificacion/agrupacion", body = list(parent = "region", spec = spec), sid = sid)
  expect_identical(p$status, 200L)
  expect_identical(p$json$spec$target, "region_recod")
  expect_identical(p$json$spec$categorias[[1]]$codigos, list("norte"))
  expect_null(p$json$spec$text_col)
  n <- vapply(p$json$vista_previa$categorias, function(x) as.integer(x$n), 0L)
  expect_identical(n, c(4L, 4L))

  g2 <- http_get(srv, "/api/codificacion/agrupacion?parent=region", sid = sid)
  expect_identical(g2$json$spec$categorias[[2]]$resto, TRUE)

  mal <- spec; mal$categorias[[2]]$codigo <- "1"
  r_mal <- http_post_json(srv, "/api/codificacion/agrupacion", body = list(parent = "region", spec = mal), sid = sid)
  expect_identical(r_mal$status, 400L)
  expect_identical(r_mal$json$error$code, "E_CODIF_AGRUPACION_INVALIDA")

  plan <- http_get(srv, "/api/codificacion/plan-adaptacion", sid = sid)
  expect_true("agrupacion" %in% vapply(plan$json$preguntas, function(x) x$tipo, ""))

  del <- http_post_json(srv, "/api/codificacion/agrupacion", body = list(parent = "region", spec = NULL), sid = sid)
  expect_identical(del$status, 200L)
  expect_null(del$json$spec)
})
