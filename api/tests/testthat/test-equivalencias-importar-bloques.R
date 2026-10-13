source("setup-load-all.R")

# Contrato E4-E7 (R3): importador de la matriz de correspondencias por bloques
# (formato de `Matriz_HSyVbG_PUCP_2022-2026.xlsx`, hoja «Matriz de
# correspondencias»). El xlsx se fabrica aquí con openxlsx y reproduce, con
# textos copiados de la matriz real, cinco bloques:
#   - S-04 orientación sexual: «— fusionadas» y «— (categoría eliminada)»;
#   - S-05 lugar de nacimiento: sin ningún «[código]»;
#   - HS-14 escala de frecuencia con «≈» en el rótulo y 2022 con otro código;
#   - T-01 con un rango «P14 a P49» como variable;
#   - C-04 «No comparable».
# Las bases son sintéticas; b2025 no tiene el 88 en P4 (código de la matriz
# que no existe en la base) y rotula el 99 de otra manera.

.bq_fila <- function(...) {
  x <- c(...)
  length(x) <- 10L
  x[is.na(x)] <- ""
  x
}

.bq_matriz <- function() {
  f <- .bq_fila
  filas <- list(
    f("MATRIZ DE CORRESPONDENCIAS Y ARMONIZACIÓN"),
    f("Encuesta sobre Hostigamiento Sexual (sintética)"),
    f(""),
    f("ID", "Eje / Sección", "Elemento / categoría armonizada", "2022", "2023", "2024", "2025", "2026",
      "Nivel de comparabilidad", "Observación (base de la comparabilidad)"),
    # S-04
    f("S-04", "2. Características sociodemográficas", "Orientación sexual", "", "", "", "", "",
      "Parcialmente comparable", "En 2024 se fusionó 'hombre gay' y 'mujer lesbiana'."),
    f("", "", "N.º de pregunta", "P4", "P4", "P4", "P4", "P4"),
    f("", "", "Enunciado", "¿Cuál es tu orientación sexual?", "¿Cuál es tu orientación sexual?",
      "¿Cuál es tu orientación sexual?", "¿Cuál es tu orientación sexual?", "¿Cuál es tu orientación sexual?"),
    f("", "", "Variable en la base de datos", "P5", "P6", "orientacion_sexual", "P4", "(pendiente)"),
    f("", "", "Heterosexual", "Heterosexual [6]", "Heterosexual [6]", "Heterosexual [1]", "Heterosexual [1]", "Heterosexual [1]"),
    f("", "", "Homosexual — hombre gay", "Hombre homosexual [1]", "Hombre homosexual / gay [1]",
      "Homosexual (gay/lesbiana) [2] — fusionadas", "Homosexual (gay/lesbiana) [2] — fusionadas",
      "Homosexual (gay/lesbiana) [2] — fusionadas"),
    f("", "", "Homosexual — mujer lesbiana", "Mujer homosexual/lesbiana [2]", "Mujer homosexual / lesbiana [2]",
      "Homosexual (gay/lesbiana) [2] — fusionadas", "Homosexual (gay/lesbiana) [2] — fusionadas",
      "Homosexual (gay/lesbiana) [2] — fusionadas"),
    f("", "", "Bisexual", "Bisexual [3]", "Bisexual [3]", "Bisexual [3]", "Bisexual [3]", "Bisexual [3]"),
    f("", "", "Pansexual", "Pansexual [4]", "Pansexual [4]", "— (categoría eliminada)",
      "— (categoría eliminada)", "— (categoría eliminada)"),
    f("", "", "Otra orientación", "Otro (especifique) [0]", "Otro (especifique) [0]",
      "Otra orientación sexual [88]", "Otra orientación sexual [88]", "Otra orientación sexual [88]"),
    f("", "", "No respuesta", "Prefiero no contestar [8]", "No sabe / No responde [8]",
      "No sé / Prefiero no decir [99]", "No sé / Prefiero no decir [99]", "No sé / Prefiero no decir [99]"),
    # S-05
    f("S-05", "2. Características sociodemográficas", "Lugar de nacimiento", "", "", "", "", "",
      "Plenamente comparable", "Misma pregunta y misma lista."),
    f("", "", "N.º de pregunta", "P5", "P5", "P5", "P5", "P5"),
    f("", "", "Enunciado", "¿En qué lugar naciste?", "¿En qué lugar naciste?", "¿En qué lugar naciste?",
      "¿En qué lugar naciste?", "¿En qué lugar naciste?"),
    f("", "", "Variable en la base de datos", "P6", "P7", "lugar_nacimiento", "P5", "(pendiente)"),
    f("", "", "Opciones ofrecidas", "Lista de departamentos del Perú", "Idem 2022", "Idem 2022", "Idem 2022",
      "Lista de departamentos del Perú"),
    f("", "", "Nacimiento fuera del país", "— (sin alternativa)", "— (sin alternativa)",
      "— (sin alternativa)", "— (sin alternativa)", "Fuera del país"),
    # HS-14 escala de frecuencia
    f("HS-14", "4. Hostigamiento sexual", "Comentarios sexuales no deseados", "", "", "", "", "",
      "Plenamente comparable", "Escala con anclaje numérico desde 2024."),
    f("", "", "N.º de pregunta", "P20_0001", "P23_1", "P14", "P14", "P15"),
    f("", "", "Variable en la base de datos", "P20_0001", "P23_1", "P14", "P14", "(pendiente)"),
    f("", "", "Nunca", "Nunca [1]", "Nunca [1]", "Nunca [1]", "Nunca [1]", "Nunca [1]"),
    f("", "", "Una vez", "Una vez [2]", "Una vez [2]", "Una vez [2]", "Una vez [2]", "Una vez [2]"),
    f("", "", "Frecuencia baja  ≈  dos a tres veces", "Pocas veces [3]", "Pocas veces [3]",
      "Dos a tres veces [3]", "Dos a tres veces [3]", "Dos a tres veces [3]"),
    f("", "", "Frecuencia media  ≈  cuatro a cinco veces", "Algunas veces [4]", "Algunas veces [4]",
      "Cuatro a cinco veces [4]", "Cuatro a cinco veces [4]", "Cuatro a cinco veces [4]"),
    f("", "", "Frecuencia alta  ≈  más de cinco veces", "Muchas veces [5]", "Muchas veces [5]",
      "Más de cinco veces [5]", "Más de cinco veces [5]", "Más de cinco veces [5]"),
    f("", "", "No respuesta", "Prefiere no decir [0]", "Prefiere no decir [0]",
      "No sé / Prefiero no decir [99]", "No sé / Prefiero no decir [99]", "No sé / Prefiero no decir [99]"),
    # T-01 rango
    f("T-01", "0. Transversal / Metodológico", "Escala de frecuencia de las baterías", "", "", "", "", "",
      "Parcialmente comparable", "Etiquetas vagas en 2022-2023."),
    f("", "", "Variable en la base de datos", "P20_0001 a P35_0007", "P23_1 a P36_7", "P14 a P49", "P14 a P49", "(pendiente)"),
    f("", "", "Nunca", "Nunca [1]", "Nunca [1]", "Nunca [1]", "Nunca [1]", "Nunca [1]"),
    # C-04 no comparable
    f("C-04", "1. Consentimiento y filtros", "Filtro de mayoría de edad", "", "", "", "", "",
      "No comparable", "Filtro presente sólo en una medición."),
    f("", "", "Variable en la base de datos", "—", "P2", "mayor_edad", "—", "—"),
    f("", "", "Sí", "—", "Sí [1]", "Sí [1]", "—", "—"),
    f("", "", "No", "—", "No [2] → FINALIZAR LA APLICACIÓN", "No [2] → FINALIZAR LA APLICACIÓN", "—", "—")
  )
  do.call(rbind, filas)
}

.bq_escribir_xlsx <- function(path) {
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "Índice y guía")
  openxlsx::writeData(wb, "Índice y guía", data.frame(x = "Guía"), colNames = FALSE)
  openxlsx::addWorksheet(wb, "Matriz de correspondencias")
  openxlsx::writeData(wb, "Matriz de correspondencias", as.data.frame(.bq_matriz(), stringsAsFactors = FALSE),
                      colNames = FALSE)
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

.bq_inst <- function(vars) {
  survey <- do.call(rbind, lapply(names(vars), function(v) {
    data.frame(type = "select_one", name = v, label = v, list_name = paste0("lst_", v),
               section = "S", stringsAsFactors = FALSE)
  }))
  choices <- do.call(rbind, lapply(names(vars), function(v) {
    ch <- vars[[v]]
    if (!length(ch)) return(NULL)
    data.frame(list_name = paste0("lst_", v), name = names(ch), label = unname(ch),
               stringsAsFactors = FALSE)
  }))
  list(survey = survey, choices = choices)
}

.bq_orient <- c(`1` = "Heterosexual", `2` = "Homosexual (gay/lesbiana)", `3` = "Bisexual",
                `88` = "Otra orientación sexual", `99` = "No sé / Prefiero no decir")
.bq_frec <- c(`1` = "Nunca", `2` = "Una vez", `3` = "Dos a tres veces", `4` = "Cuatro a cinco veces",
              `5` = "Más de cinco veces", `99` = "No sé / Prefiero no decir")

.bq_setup <- function(env = parent.frame()) {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  sid <- session_create()
  withr::defer(session_delete(sid), envir = env)
  s <- session_get(sid)
  s$estudio <- list(
    bases = list(b2024 = list(nombre = "b2024"), b2025 = list(nombre = "b2025"),
                 b2026 = list(nombre = "b2026")),
    processing_mode = "multibase", topology_declared = "separate", active_base = "b2024"
  )
  orient25 <- .bq_orient[names(.bq_orient) != "88"]          # sin el 88
  orient25[["99"]] <- "No sabe / No responde"                 # otra etiqueta
  s$rp_inst_sources <- list(
    b2024 = .bq_inst(list(orientacion_sexual = .bq_orient, lugar_nacimiento = character(0),
                          P14 = .bq_frec, mayor_edad = c(`1` = "Sí", `2` = "No"))),
    b2025 = .bq_inst(list(P4 = orient25, P5 = character(0), P14 = .bq_frec)),
    b2026 = .bq_inst(list(P4 = .bq_orient))
  )
  s$rp_data_sources <- list(
    b2024 = data.frame(orientacion_sexual = c(1, 2, 2, 3, 88, 99), P14 = c(1, 1, 2, 5, 99, NA))
  )
  path <- file.path(s$dir, "uploads", "matriz_bloques.xlsx")
  dir.create(dirname(path), recursive = TRUE, showWarnings = FALSE)
  .bq_escribir_xlsx(path)
  s$files[["matriz-bloques"]] <- list(file_id = "matriz-bloques", kind = "matriz", path = path,
                                      original_name = basename(path), size = file.info(path)$size, ext = "xlsx")
  .session_env[[sid]] <- s
  sid
}

.bq_periodos <- list(`2024` = "b2024", `2025` = "b2025", `2026` = "b2026")

.bq_por_id <- function(filas, id) filas[[which(vapply(filas, `[[`, "", "id") == id)]]
.bq_adv <- function(adv, id = NULL, base = NULL, tipo = NULL) {
  Filter(function(a) (is.null(id) || identical(a$id, id)) && (is.null(base) || identical(a$base, base)) &&
           (is.null(tipo) || identical(a$tipo, tipo)), adv)
}

test_that("las celdas se leen por su primer [código] e ignoran las marcas", {
  expect_equal(.equiv_bloques_celda("Homosexual (gay/lesbiana) [2] — fusionadas")[c("codigo", "etiqueta")],
               list(codigo = "2", etiqueta = "Homosexual (gay/lesbiana)"))
  expect_equal(.equiv_bloques_celda("Otros [10] [ESPECIFICA]")$codigo, "10")
  expect_equal(.equiv_bloques_celda("No [2] → FINALIZAR LA APLICACIÓN")$etiqueta, "No")
  expect_false(.equiv_bloques_celda("— (categoría eliminada)")$existe)
  expect_false(.equiv_bloques_celda("")$existe)
  expect_true(is.na(.equiv_bloques_celda("____ años cumplidos [18 o más años]")$codigo))
  expect_equal(.equiv_bloques_variable("(pendiente)")$estado, "pendiente")
  expect_equal(.equiv_bloques_variable("P14 a P49")$estado, "multiple")
  expect_equal(.equiv_bloques_variable("—")$estado, "ausente")
  expect_equal(.equiv_bloques_variable("orientacion_sexual")$variable, "orientacion_sexual")
})

test_that("previsualizar arma las filas de la matriz con su armonización y no toca la sesión", {
  sid <- .bq_setup()
  out <- equiv_bloques_importar(sid, "matriz-bloques", .bq_periodos, modo = "previsualizar")
  expect_null(session_get(sid)$equivalencias_publicos)

  r <- out$resumen
  expect_equal(r$n_bloques, 5L)
  # T-01 (rango) no tiene ninguna variable utilizable y no entra.
  expect_equal(r$n_filas, 4L)
  expect_equal(r$bloques_sin_variables, "T-01")
  expect_equal(r$n_con_armonizacion, 3L)
  expect_equal(r$nuevas, 4L)

  # S-04: gay y lesbiana se funden; las eliminadas en 2024-2026 no entran; 88 y
  # 99 conservan su código y van al final.
  s04 <- .bq_por_id(out$filas_importadas, "S-04")
  expect_equal(s04$etiqueta_estandar, "Orientación sexual")
  expect_equal(s04$seccion, "2. Características sociodemográficas")
  expect_equal(s04$variables, list(b2024 = "orientacion_sexual", b2025 = "P4"))
  esc <- s04$armonizacion$escala
  expect_equal(vapply(esc, `[[`, "", "codigo"), c("1", "2", "3", "88", "99"))
  expect_equal(vapply(esc, `[[`, "", "etiqueta"),
               c("Heterosexual", "Homosexual (gay/lesbiana)", "Bisexual", "Otra orientación", "No respuesta"))
  expect_equal(unlist(s04$armonizacion$por_base$b2024$mapa),
               c(`1` = "1", `2` = "2", `3` = "3", `88` = "88", `99` = "99"))
  expect_true(s04$armonizacion$por_base$b2024$comparable)
  expect_match(s04$armonizacion$por_base$b2024$nota, "fusionó")
  # 2026 no tiene variable todavía, pero su mapa (del cuestionario) se guarda.
  expect_false(is.null(s04$armonizacion$por_base$b2026))
  expect_length(.bq_adv(out$advertencias, "S-04", "b2026", "variable_pendiente"), 1L)
  expect_length(.bq_adv(out$advertencias, "S-04", tipo = "fusion"), 3L)

  # Código de la matriz que no existe en la base: advertencia por fila, no aborta.
  inex <- .bq_adv(out$advertencias, "S-04", "b2025", "codigo_inexistente")
  expect_length(inex, 1L)
  expect_match(inex[[1]]$mensaje, "\\[88\\]")
  expect_length(.bq_adv(out$advertencias, "S-04", "b2025", "etiqueta_distinta"), 1L)
  expect_length(.bq_adv(out$advertencias, "S-04", "b2024", "codigo_inexistente"), 0L)

  # S-05: sin códigos -> sin armonización, con su aviso.
  s05 <- .bq_por_id(out$filas_importadas, "S-05")
  expect_null(s05$armonizacion)
  expect_equal(s05$variables, list(b2024 = "lugar_nacimiento", b2025 = "P5"))
  expect_length(.bq_adv(out$advertencias, "S-05", tipo = "sin_codigos"), 1L)

  # HS-14: orden 1..5 y 99; el rótulo conserva su «≈»; 2022 no está mapeado y
  # no influye (su «Prefiere no decir [0]» no rompe el especial).
  hs <- .bq_por_id(out$filas_importadas, "HS-14")
  expect_equal(vapply(hs$armonizacion$escala, `[[`, "", "codigo"), c("1", "2", "3", "4", "5", "99"))
  expect_equal(hs$armonizacion$escala[[3]]$etiqueta, "Frecuencia baja ≈ dos a tres veces")
  expect_length(.bq_adv(out$advertencias, "HS-14", tipo = "codigo_inexistente"), 0L)

  # T-01: el rango se reporta por base.
  expect_length(.bq_adv(out$advertencias, "T-01", tipo = "variable_no_unica"), 2L)

  # C-04: no comparable.
  c04 <- .bq_por_id(out$filas_importadas, "C-04")
  expect_false(c04$armonizacion$por_base$b2024$comparable)
})

test_that("aplicar fusiona con la matriz vigente sin borrar filas del usuario", {
  sid <- .bq_setup()
  .equiv_guardar_declaracion(sid, list(
    list(seccion = "Propia", etiqueta_estandar = "Mi fila", variables = list(b2024 = "P14")),
    # Misma pregunta escrita a mano antes del import, sin id.
    list(seccion = "", etiqueta_estandar = "Orientación sexual", variables = list(b2025 = "P4"),
         diapositiva = "7")
  ))

  out <- equiv_bloques_importar(sid, "matriz-bloques", .bq_periodos, modo = "aplicar")
  expect_equal(out$resumen$nuevas, 3L)
  expect_equal(out$resumen$actualizadas, 1L)

  equiv <- session_get(sid)$equivalencias_publicos
  etq <- vapply(equiv$filas, `[[`, "", "etiqueta_estandar")
  expect_true("Mi fila" %in% etq)
  expect_equal(sum(etq == "Orientación sexual"), 1L)
  s04 <- equiv$filas[[which(etq == "Orientación sexual")]]
  expect_equal(s04$id, "S-04")
  expect_equal(s04$diapositiva, "7")
  expect_equal(s04$variables[c("b2024", "b2025")], list(b2024 = "orientacion_sexual", b2025 = "P4"))
  expect_false(is.null(s04$armonizacion))
  expect_equal(equiv$armonizacion_periodos, c("b2024", "b2025", "b2026"))
  expect_true(out$estado$declarada)

  # Reaplicar no duplica: casa por id.
  out2 <- equiv_bloques_importar(sid, "matriz-bloques", .bq_periodos, modo = "aplicar")
  expect_equal(out2$resumen$nuevas, 0L)
  expect_equal(out2$resumen$actualizadas, 4L)
  expect_equal(length(session_get(sid)$equivalencias_publicos$filas), 5L)

  # Y la fila importada se puede previsualizar contra los datos de la base.
  p <- .equiv_armon_preview(sid, "S-04", "b2024")
  expect_equal(vapply(p$escala, `[[`, 1L, "n"), c(1L, 2L, 1L, 1L, 1L))
  expect_equal(p$n_sin_mapa, 0L)
})

test_that("mapa_periodos mal formado corta con E_EQUIV_BLOQUES_PERIODOS", {
  sid <- .bq_setup()
  codigo <- function(mp) tryCatch(equiv_bloques_importar(sid, "matriz-bloques", mp), api_error = function(e) e$code)
  expect_equal(codigo(list()), "E_EQUIV_BLOQUES_PERIODOS")
  expect_equal(codigo(list(`2030` = "b2024")), "E_EQUIV_BLOQUES_PERIODOS")
  expect_equal(codigo(list(`2024` = "b1999")), "E_EQUIV_BLOQUES_PERIODOS")
  expect_equal(codigo(list(`2024` = "b2024", `2025` = "b2024")), "E_EQUIV_BLOQUES_PERIODOS")
  # Una hoja sin fila de títulos no es una matriz por bloques.
  expect_equal(tryCatch(.equiv_bloques_parsear(matrix("x", 3, 5)), api_error = function(e) e$code),
               "E_EQUIV_BLOQUES_FORMATO")
})

# Contrato HTTP por el enrutador real de plumber.
.bq_http <- function(sid, body) {
  pr <- plumber::pr() |>
    plumber::pr_set_serializer(.api_serializer()) |>
    mount_equivalencias()
  raw <- charToRaw(enc2utf8(as.character(jsonlite::toJSON(body, auto_unbox = TRUE, null = "null"))))
  entrada <- new.env()
  entrada$rewind <- function() invisible(0L)
  entrada$read <- function(l = -1L) raw
  entrada$read_lines <- function(n = -1L) rawToChar(raw)
  req <- new.env()
  req$REQUEST_METHOD <- "POST"
  req$PATH_INFO <- "/api/carga/equivalencias/importar-bloques"
  req$QUERY_STRING <- ""
  req$HTTP_X_PULSO_SESSION <- sid
  req$HTTP_CONTENT_TYPE <- "application/json"
  req$rook.input <- entrada
  res <- pr$call(req)
  list(status = res$status, body = jsonlite::fromJSON(res$body, simplifyVector = FALSE))
}

test_that("contrato HTTP: POST importar-bloques previsualiza, aplica y valida el modo", {
  sid <- .bq_setup()
  r <- .bq_http(sid, list(file_id = "matriz-bloques", mapa_periodos = .bq_periodos, modo = "previsualizar"))
  expect_equal(r$status, 200L)
  expect_equal(r$body$resumen$n_filas, 4L)
  expect_true(length(r$body$advertencias) > 0L)
  a <- r$body$advertencias[[1]]
  expect_setequal(names(a), c("id", "base", "tipo", "mensaje"))
  expect_null(session_get(sid)$equivalencias_publicos)

  r2 <- .bq_http(sid, list(file_id = "matriz-bloques", mapa_periodos = .bq_periodos, modo = "aplicar"))
  expect_equal(r2$status, 200L)
  expect_equal(r2$body$estado$n_filas, 4L)

  r3 <- .bq_http(sid, list(file_id = "matriz-bloques", mapa_periodos = .bq_periodos, modo = "borrar"))
  expect_equal(r3$status, 400L)
  expect_equal(r3$body$error$code, "E_EQUIV_BLOQUES_MODO")
})

test_that("la no respuesta codificada como especial en alguna base conserva un código especial en la escala", {
  m <- rbind(
    c("ID", "Eje / Sección", "Elemento / categoría armonizada", "2022", "2024",
      "Nivel de comparabilidad", "Observación (base de la comparabilidad)"),
    c("S-99", "2. Sociodemográficas", "Prueba de no respuesta", "", "", "Plenamente comparable", ""),
    c("", "", "Variable en la base de datos", "v22", "v24", "", ""),
    c("", "", "Sí", "Sí [1]", "Sí [1]", "", ""),
    c("", "", "No", "No [2]", "No [2]", "", ""),
    c("", "", "No respuesta", "Prefiere no decir [0]", "No sé / Prefiero no decir [99]", "", "")
  )
  out <- .equiv_bloques_importar_matriz(m, list("2022" = "b22", "2024" = "b24"),
                                        list(b22 = NULL, b24 = NULL))
  arm <- out$filas[[1]]$armonizacion
  codigos <- vapply(arm$escala, function(e) e$codigo, character(1))
  expect_true("99" %in% codigos)
  expect_equal(arm$por_base$b22$mapa[["0"]], "99")
  expect_equal(arm$por_base$b24$mapa[["99"]], "99")
  expect_setequal(setdiff(codigos, "99"), c("1", "2"))
})

test_that("un bloque cuyas categorías son años avisa que la cohorte se armoniza a mano (R4b, punto 6)", {
  m <- rbind(
    c("ID", "Eje / Sección", "Elemento / categoría armonizada", "2024", "2025",
      "Nivel de comparabilidad", "Observación (base de la comparabilidad)"),
    c("S-08", "2. Sociodemográficas", "Año de ingreso", "", "", "Parcialmente comparable", ""),
    c("", "", "Variable en la base de datos", "a24", "a25", "", ""),
    # El rótulo de fila ya es relativo, pero las opciones ofrecidas eran años.
    c("", "", "Primer año", "2024 [1]", "2025 [1]", "", ""),
    c("", "", "Segundo año", "2023 [2]", "2024 [2]", "", ""),
    c("", "", "Tercer año", "2022 [3]", "2023 [3]", "", ""),
    c("", "", "Otro", "Otro [88]", "Otro [88]", "", ""),
    # Bloque de control: etiquetas que no son años.
    c("S-09", "2. Sociodemográficas", "Sexo", "", "", "Plenamente comparable", ""),
    c("", "", "Variable en la base de datos", "s24", "s25", "", ""),
    c("", "", "Mujer", "Mujer [1]", "Mujer [1]", "", ""),
    c("", "", "Hombre", "Hombre [2]", "Hombre [2]", "", "")
  )
  out <- .equiv_bloques_importar_matriz(m, list("2024" = "b24", "2025" = "b25"),
                                        list(b24 = NULL, b25 = NULL))
  adv <- Filter(function(a) identical(a$tipo, "cohorte_por_etiqueta"), out$advertencias)
  expect_length(adv, 1L)
  expect_identical(adv[[1]]$id, "S-08")
  expect_match(adv[[1]]$mensaje, "relativo al año de medición", fixed = TRUE)
  # El importador no infiere el mapa relativo: deja el de los códigos.
  expect_equal(out$filas[[1]]$armonizacion$por_base$b25$mapa[["1"]], "1")
})
