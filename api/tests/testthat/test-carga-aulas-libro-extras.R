# B14 — las hojas de las aulas extra (docs/qa/checklist-operativo-aulas-2026-08-31.md).
#
# Dictado de Gonzalo (2026-09-01, textual): «algo que también falta […] las
# aulas adicionales de cada facultad: deberían haber dos hojas, una de aulas
# agendadas y otra de aulas aplicadas, para las aulas extra; y la base de
# control no, porque la base de control toma todo sin importar el código».
#
# Contrato congelado por el lead:
#   1. El banco extra (extra_reserve_pool, hoy filtrado fuera del libro) gana
#      «Aulas Agendadas (Extra)» y «Aulas Aplicadas (Extra)» con las MISMAS
#      mecánicas de las hojas principales: bloque v4 derivado de la spec, a
#      profundidad 1 (los extras no tienen cadena) — un solo bloque por hoja.
#   2. Filas agrupadas POR FACULTAD: orden alfabético de facultad y dentro por
#      código.
#   3. La hoja de campo (Extra) arrastra su agenda desde la agendadas (Extra) —
#      mismo mecanismo B9 (fórmulas TO_TEXT, USER_ENTERED, ancla por código).
#   4. Dueño: ambas son del EQUIPO (siembra única, `respetada` al republicar).
#   5. Los lectores las leen con la misma maquinaria (partes de extras entran
#      por código como siempre); un libro SIN las hojas extra se lee igual.
#   6. Las hojas extra reciben las mismas validaciones y formato (todo deriva;
#      aquí se pinea solo que APARECEN con sus desplegables).
#   7. Las dos hojas nuevas entran a la lista de pestañas controladas de Sheets.
#   8. `aulas_libro_generar` las emite SOLO si hay extras en el plan; sin
#      extras el libro es idéntico al de hoy (sin hojas fantasma).
#
# ESTADO REAL MEDIDO HOY (2026-09-01, main 8556f3dc), declarado y no pineado
# salvo donde se indica:
#   - Un extra con fila de CONTROL registrada YA entra hoy a «Base de control»
#     por código y su fila vuelve al libro (verde deliberado abajo): el dictado
#     «toma todo sin importar el código» ya se cumple por esa vía.
#   - Un extra SOLO con parte de campo BLOQUEA hoy la generación entera:
#     E_AULAS_LIBRO_SIN_CADENAS (asimetría declarada por el lead 2026-08-31 en
#     `.calg_reservas_sin_cadena`). Qué pasa con ese caso bajo B14 (¿va a la
#     hoja Extra en vez de reventar?) NO está en el contrato congelado: queda
#     como hueco para el lead, y estos tests no usan esa configuración.
#   - Un extra con parte-solo NO gana fila automática en «Base de control»
#     (misma regla que las reservas: titular | con_control). Tampoco pineado.
#
# Sin red: la publicación pasa por `.monitoreo_google_api` mockeado sobre
# `.sheets_api_mock()` (helper-sheets-mock.R), envuelto aquí —mismo patrón que
# test-monitoreo-aulas-libro-arrastre.R— para capturar el `valueInputOption`
# de cada escritura y aplicar PUTs por sub-rango A1.

.ext_hoja_ag <- "Aulas Agendadas (Extra)"
.ext_hoja_ap <- "Aulas Aplicadas (Extra)"

.ext_hojas_hoy <- c("Aulas Agendadas", "Aulas Aplicadas (Campo)",
                    "Base de control", "Plan del día", "Avance de campo",
                    # Entró el 2026-09-09, detrás del avance: qué se consiguió
                    # agendar, con los reemplazos dentro.
                    "Avance de agendación",
                    "Listas")

# --- fixture: 1 titular de contraste + extras de dos facultades ---------------

.ext_unidad <- function(code, rol, faculty,
                        toc = if (identical(rol, "titular")) code else "") {
  list(
    operational_code = code, titular_operational_code = toc,
    sample_role = rol, replacement_order = NA,
    faculty = faculty, course_name = paste("CURSO", code),
    teacher = paste("Docente", code), teacher_phone = "987654321",
    teacher_email = "docente@pucp.edu.pe", label = "AUL101_0101", level = 2,
    enrolled_total = 33, eligible_n = 30,
    wave = if (identical(rol, "extra_reserve_pool")) "Extra" else "M1"
  )
}

# El plan del contrato: 2 extras de 2 facultades + 1 titular para contraste.
# El orden del plan pone Ciencias Sociales ANTES que Arte a propósito: el
# alfabético de facultad tiene que observarse contra el orden de llegada.
.ext_plan <- function() list(
  .ext_unidad("CH 1", "titular", "Ciencias Sociales"),
  .ext_unidad("EXTRA 2", "extra_reserve_pool", "Ciencias Sociales"),
  .ext_unidad("EXTRA 1", "extra_reserve_pool", "Arte y Diseno")
)

.ext_titulos_agenda <- function() unname(prosecnurapp:::.calg_titulos_agenda())
.ext_titulos_campo <- function() unname(prosecnurapp:::.calg_titulos_campo())

# Columna de un campo dentro del bloque único (1 = ID MATCH), derivada de la
# spec — nunca un número a mano.
.ext_col_agenda <- function(titulo) {
  1L + which(.ext_titulos_agenda() == titulo)[[1]]
}
.ext_col_campo <- function(titulo) {
  1L + length(.ext_titulos_agenda()) + which(.ext_titulos_campo() == titulo)[[1]]
}

.ext_leer <- function(path, hoja) {
  suppressMessages(openxlsx::read.xlsx(
    path, sheet = hoja, colNames = FALSE,
    skipEmptyRows = FALSE, skipEmptyCols = FALSE
  ))
}

# La hoja pedida, o UNA falla limpia con el estado de hoy si no existe: así el
# rojo de cada test dice «falta la hoja» en vez de ahogarse en un error de
# openxlsx a mitad de camino.
.ext_hoja_o_falla <- function(path, hoja) {
  hojas <- openxlsx::getSheetNames(path)
  if (!hoja %in% hojas) {
    testthat::fail(sprintf(
      "el libro no trae la hoja «%s» (B14 sin implementar); hojas presentes: %s",
      hoja, paste(hojas, collapse = " | ")
    ))
    return(NULL)
  }
  .ext_leer(path, hoja)
}

.ext_celda_txt <- function(d, fila, col) {
  v <- as.character(d[fila, col])
  if (length(v) != 1L || is.na(v)) "" else v
}

# Los códigos (y una columna acompañante) de las filas de DATOS de una hoja de
# agenda extra: se filtran las filas cuya celda de código está vacía, para
# tolerar bandas de facultad u otro chrome que el writer decida.
.ext_filas_con_codigo <- function(d, desde = 2L) {
  col_cod <- .ext_col_agenda("CURSO-HORARIO")
  filas <- seq.int(desde, nrow(d))
  filas[vapply(filas, function(r) nzchar(.ext_celda_txt(d, r, col_cod)), logical(1))]
}

# --- contexto (verde deliberado): lo que HOY es verdad y debe seguir siéndolo -

test_that("contexto B14: sin extras en el plan, el libro es idéntico al de hoy", {
  # Contrato 8, mitad guardia: sin extras NO aparecen hojas fantasma. Verde hoy
  # y verde tras el fix.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(list(.ext_unidad("CH 1", "titular", "Ciencias Sociales")), libro)
  expect_identical(openxlsx::getSheetNames(libro), .ext_hojas_hoy)
})

test_that("contexto B14: el banco extra sigue fuera de las hojas principales", {
  # Las hojas del equipo no ganan filas de extras por B14: los extras van a SUS
  # hojas. Verde hoy (se filtran) y verde tras el fix.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.ext_plan(), libro)
  ag <- .ext_leer(libro, "Aulas Agendadas")
  col_cod <- .ext_col_agenda("CURSO-HORARIO")
  cods <- vapply(seq.int(2L, nrow(ag)), function(r) .ext_celda_txt(ag, r, col_cod), character(1))
  expect_identical(cods[nzchar(cods)], "CH 1")
  expect_false(any(grepl("^EXTRA ", cods)))
})

test_that("contexto B14: la Base de control ya toma un EXTRA por código (estado declarado)", {
  # El dictado: «la base de control no, porque la base de control toma todo sin
  # importar el código». Medido hoy: una fila de control registrada con código
  # EXTRA vuelve al libro. Este verde deja pineado que B14 NO puede regresarlo.
  plan <- .ext_plan()
  ctl <- list(list(operational_code = "EXTRA 1", applicator = "Ana", sent_total = 10))
  # Con parte APLICADA: desde el 2026-09-07 la hoja sólo escribe el aula
  # aplicada o con respuestas. Lo que este test sujeta es que el CÓDIGO extra no
  # la excluya, y para eso el aula tiene que calificar por lo demás.
  h <- aulas_libro_hoja_control(
    plan, control = ctl,
    partes = list(list(operational_code = "EXTRA 1", estado = "APLICADA", intento = 1L)))
  titulos <- as.character(unlist(h[2, ], use.names = FALSE))
  col_cod <- which(titulos == "CURSO-HORARIO")[[1]]
  cods <- vapply(seq.int(3L, nrow(h)), function(r) .ext_celda_txt(h, r, col_cod), character(1))
  expect_true("EXTRA 1" %in% cods)
  # Y el lector de control lee ese código como cualquier otro.
  dfc <- as.data.frame(rbind(c("EXTRA 1", "30", "7")), stringsAsFactors = FALSE)
  filas <- base_control_a_filas(dfc, c("CURSO-HORARIO", "MATRICULADOS ELEGIBLES", "TOTAL ENVIADAS"))$filas
  expect_length(filas, 1L)
  expect_identical(as.character(filas[[1]]$operational_code), "EXTRA 1")
})

test_that("contexto B14: un libro sin hojas extra se sigue leyendo igual (tolerancia)", {
  # Contrato 5, mitad tolerancia: el fix no puede volver obligatorias las hojas
  # nuevas — los libros vivos del operativo no las traen. Verde hoy y después.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(list(.ext_unidad("CH 1", "titular", "Ciencias Sociales")), libro)
  out <- aulas_libro_importar(libro)
  codigos <- vapply(out$plan, function(r) as.character(r$operational_code %||% ""), character(1))
  expect_true("CH 1" %in% codigos)
  expect_identical(out$resumen$partes_de_campo, 0L)
})

# --- ROJO 1: el generador emite las dos hojas extra (contrato 8) --------------

test_that("B14: aulas_libro_generar emite las dos hojas extra cuando el plan trae banco", {
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.ext_plan(), libro)
  hojas <- openxlsx::getSheetNames(libro)
  expect_true(.ext_hoja_ag %in% hojas,
              info = sprintf("falta «%s»; hojas presentes: %s", .ext_hoja_ag,
                             paste(hojas, collapse = " | ")))
  expect_true(.ext_hoja_ap %in% hojas,
              info = sprintf("falta «%s»; hojas presentes: %s", .ext_hoja_ap,
                             paste(hojas, collapse = " | ")))
})

# --- ROJO 2: bloque v4 a profundidad 1 (contrato 1) ---------------------------

test_that("B14: «Aulas Agendadas (Extra)» lleva el bloque v4 a profundidad 1", {
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.ext_plan(), libro)
  d <- .ext_hoja_o_falla(libro, .ext_hoja_ag)
  if (is.null(d)) return(invisible(NULL))
  cab <- as.character(unlist(d[1, ], use.names = FALSE))
  cab <- cab[!is.na(cab)]
  # Un solo bloque: la cabecera es EXACTAMENTE ID MATCH + los 20 títulos v4,
  # sin sufijos « R1» (los extras no tienen cadena de reemplazos).
  expect_identical(cab, c("ID MATCH", .ext_titulos_agenda()))
  expect_identical(sum(cab == "ID MATCH"), 1L)
})

test_that("B14: «Aulas Aplicadas (Extra)» es ID MATCH + agenda v4 + parte v4, un solo bloque", {
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.ext_plan(), libro)
  d <- .ext_hoja_o_falla(libro, .ext_hoja_ap)
  if (is.null(d)) return(invisible(NULL))
  # Misma maquinaria del lector (`aulas_aplicadas_leer`): fila 1 banda de
  # grupo (contenido libre — el lector la ignora), fila 2 los campos.
  campos <- as.character(unlist(d[2, ], use.names = FALSE))
  campos <- campos[!is.na(campos)]
  expect_identical(campos, c("ID MATCH", .ext_titulos_agenda(), .ext_titulos_campo()))
  expect_identical(sum(campos == "ID MATCH"), 1L)
})

# --- ROJO 3: agrupadas por facultad, dentro por código (contrato 2) -----------

test_that("B14: las filas extra van por facultad alfabética y dentro por código", {
  # Tres extras para poder observar las DOS dimensiones: el plan llega con
  # Ciencias Sociales primero y con EXTRA 3 antes que EXTRA 2.
  plan <- list(
    .ext_unidad("CH 1", "titular", "Ciencias Sociales"),
    .ext_unidad("EXTRA 3", "extra_reserve_pool", "Ciencias Sociales"),
    .ext_unidad("EXTRA 1", "extra_reserve_pool", "Arte y Diseno"),
    .ext_unidad("EXTRA 2", "extra_reserve_pool", "Ciencias Sociales")
  )
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(plan, libro)
  d <- .ext_hoja_o_falla(libro, .ext_hoja_ag)
  if (is.null(d)) return(invisible(NULL))
  filas <- .ext_filas_con_codigo(d)
  col_cod <- .ext_col_agenda("CURSO-HORARIO")
  col_fac <- .ext_col_agenda("FACULTAD")
  cods <- vapply(filas, function(r) .ext_celda_txt(d, r, col_cod), character(1))
  facs <- vapply(filas, function(r) .ext_celda_txt(d, r, col_fac), character(1))
  expect_identical(cods, c("EXTRA 1", "EXTRA 2", "EXTRA 3"))
  expect_identical(facs, c("Arte y Diseno", "Ciencias Sociales", "Ciencias Sociales"))
})

test_that("B14: la hoja de campo (Extra) va fila a fila con la agendadas (Extra)", {
  # Mismas mecánicas que el M1 de 2025 (orden espejo): sin esto el arrastre por
  # código no tiene geometría estable que anclar.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.ext_plan(), libro)
  ag <- .ext_hoja_o_falla(libro, .ext_hoja_ag)
  ap <- .ext_hoja_o_falla(libro, .ext_hoja_ap)
  if (is.null(ag) || is.null(ap)) return(invisible(NULL))
  col_cod <- .ext_col_agenda("CURSO-HORARIO")
  cods_ag <- vapply(.ext_filas_con_codigo(ag, desde = 2L),
                    function(r) .ext_celda_txt(ag, r, col_cod), character(1))
  cods_ap <- vapply(.ext_filas_con_codigo(ap, desde = 3L),
                    function(r) .ext_celda_txt(ap, r, col_cod), character(1))
  expect_identical(cods_ap, cods_ag)
})

# --- ROJO 4: mismos desplegables (contrato 6, solo presencia) -----------------

test_that("B14: «Aulas Agendadas (Extra)» aparece con sus desplegables", {
  # No se re-pinea lo derivado (listas y columnas ya los vigila el contrato-v4
  # de las hojas principales): solo que la hoja extra RECIBE validaciones y que
  # salen de la hoja «Listas», como todas.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.ext_plan(), libro)
  hojas <- openxlsx::getSheetNames(libro)
  if (!.ext_hoja_ag %in% hojas) {
    fail(sprintf("el libro no trae la hoja «%s» (B14 sin implementar)", .ext_hoja_ag))
    return(invisible(NULL))
  }
  v <- validaciones_de(libro, .ext_hoja_ag)
  expect_gt(nrow(v), 0L)
  expect_true(all(grepl("Listas", v$formula, fixed = TRUE)),
              info = "hay validaciones que no apuntan a la hoja «Listas»")
})

# --- ROJO 5: los lectores, con la misma maquinaria (contrato 5) ---------------

test_that("B14: un libro con hojas extra devuelve sus partes y su agenda por código", {
  # El fixture se construye A MANO con las specs del producto (las hojas extra
  # aún no se generan): libro principal real + las dos hojas extra con la
  # geometría del contrato (agendadas 1 fila de cabecera; campo banda + campos).
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(list(.ext_unidad("CH 1", "titular", "Ciencias Sociales")), libro)

  u_extra <- c(.ext_unidad("EXTRA 1", "extra_reserve_pool", "Arte y Diseno"),
               list(contact_medium = "WhatsApp", sample_status = "agendada",
                    scheduled_date = "2026-09-15"))
  agenda_extra <- prosecnurapp:::.calg_celdas_agenda(u_extra)
  parte_extra <- list(
    observed_students = 20, refusals = 1, duplicates = 2, effective_surveys = 7,
    applied_by = "Ana", actual_room = "Z101", applied_date = "2026-09-16",
    applied_time = "10:00", application_status = "APLICADA"
  )
  celdas_parte <- prosecnurapp:::.cap_celdas_parte(parte_extra, u_extra, .ext_titulos_campo())

  wb <- openxlsx::loadWorkbook(libro)
  openxlsx::addWorksheet(wb, .ext_hoja_ag)
  openxlsx::writeData(wb, .ext_hoja_ag, as.data.frame(rbind(
    c("ID MATCH", .ext_titulos_agenda()),
    c("1", agenda_extra)
  ), stringsAsFactors = FALSE), colNames = FALSE)
  openxlsx::addWorksheet(wb, .ext_hoja_ap)
  ancho <- 1L + length(.ext_titulos_agenda()) + length(.ext_titulos_campo())
  openxlsx::writeData(wb, .ext_hoja_ap, as.data.frame(rbind(
    c("EXTRA", rep("", ancho - 1L)),
    c("ID MATCH", .ext_titulos_agenda(), .ext_titulos_campo()),
    c("1", agenda_extra, celdas_parte)
  ), stringsAsFactors = FALSE), colNames = FALSE)
  openxlsx::saveWorkbook(wb, libro, overwrite = TRUE)

  out <- aulas_libro_importar(libro)

  # Los partes de extras entran por código, como siempre.
  codigos_parte <- vapply(out$partes, function(p) as.character(p$operational_code %||% ""), character(1))
  expect_true("EXTRA 1" %in% codigos_parte,
              info = sprintf("el parte del EXTRA 1 no volvió; partes leídos: %s",
                             paste(codigos_parte, collapse = ", ") %||% "(ninguno)"))
  if ("EXTRA 1" %in% codigos_parte) {
    pt <- out$partes[[which(codigos_parte == "EXTRA 1")[[1]]]]
    expect_equal(as.numeric(pt$effective_surveys), 7)
  }

  # Y la agenda del extra se lee con la misma maquinaria (entra por código; la
  # fusión de sesión ya sabe casarla con el banco).
  codigos_plan <- vapply(out$plan, function(r) as.character(r$operational_code %||% ""), character(1))
  expect_true("EXTRA 1" %in% codigos_plan,
              info = sprintf("la agenda del EXTRA 1 no volvió; plan leído: %s",
                             paste(codigos_plan, collapse = ", ")))
  if ("EXTRA 1" %in% codigos_plan) {
    fila <- out$plan[[which(codigos_plan == "EXTRA 1")[[1]]]]
    expect_identical(as.character(fila$contact_medium %||% ""), "WhatsApp")
  }
})

# --- la publicación a Sheets: mock con captura de valueInputOption ------------
# Copia local del wrapper de test-monitoreo-aulas-libro-arrastre.R (el patrón
# declarado del helper: cada archivo lleva su copia); aplica escrituras por
# sub-rango A1 y registra `{titulo, rango, opcion, values}` por escritura.

.ext_col_a1 <- function(letras) {
  n <- 0L
  for (ch in strsplit(toupper(letras), "")[[1]]) n <- n * 26L + (utf8ToInt(ch) - 64L)
  n
}

.ext_mock <- function() {
  base <- .sheets_api_mock()
  base$env$writes <- list()

  aplicar <- function(rango, values, opcion) {
    titulo <- .sheets_api_sin_comillas(rango)
    if (!nzchar(titulo) || is.null(base$env$sheets[[titulo]])) return(invisible(NULL))
    a1 <- sub("^[^!]*!?", "", as.character(rango %||% "")[1])
    hoja <- base$env$sheets[[titulo]]$values %||% list()
    if (!nzchar(a1)) {
      hoja <- values %||% list()
    } else {
      celda0 <- sub(":.*$", "", a1)
      col0 <- max(1L, .ext_col_a1(gsub("[^A-Za-z]", "", celda0)))
      fila_txt <- gsub("[^0-9]", "", celda0)
      fila0 <- if (nzchar(fila_txt)) as.integer(fila_txt) else 1L
      for (i in seq_along(values %||% list())) {
        idx_fila <- fila0 + i - 1L
        while (length(hoja) < idx_fila) hoja[[length(hoja) + 1L]] <- list()
        fila <- as.list(hoja[[idx_fila]] %||% list())
        celdas <- values[[i]] %||% list()
        for (j in seq_along(celdas)) {
          idx_col <- col0 + j - 1L
          while (length(fila) < idx_col) fila[[length(fila) + 1L]] <- ""
          fila[[idx_col]] <- celdas[[j]]
        }
        hoja[[idx_fila]] <- fila
      }
    }
    base$env$sheets[[titulo]]$values <- hoja
    base$env$writes[[length(base$env$writes) + 1L]] <- list(
      titulo = titulo, rango = as.character(rango %||% "")[1],
      opcion = as.character(opcion %||% "")[1], values = values %||% list()
    )
    invisible(NULL)
  }

  handler <- function(url, method = "GET", body = NULL) {
    if (grepl("/values:batchUpdate$", url)) {
      base$env$calls[[length(base$env$calls) + 1L]] <-
        list(url = url, method = method, body = body)
      opcion <- as.character(body$valueInputOption %||% "")[1]
      for (entry in body$data %||% list()) {
        aplicar(entry$range, entry$values %||% list(), opcion)
      }
      return(list(totalUpdatedSheets = length(body$data %||% list())))
    }
    if (grepl("/values/", url) && !identical(method, "GET")) {
      base$env$calls[[length(base$env$calls) + 1L]] <-
        list(url = url, method = method, body = body)
      opcion <- if (grepl("valueInputOption=", url)) {
        sub(".*valueInputOption=([^&]*).*", "\\1", url)
      } else {
        as.character(body$valueInputOption %||% "")[1]
      }
      rango <- utils::URLdecode(sub("[?].*$", "", sub(".*/values/", "", url)))
      aplicar(rango, body$values %||% list(), opcion)
      return(list(updatedRange = rango))
    }
    base$handler(url, method = method, body = body)
  }

  list(env = base$env, handler = handler, seed = base$seed)
}

.ext_celda_mock <- function(mock, hoja, fila, col) {
  filas <- mock$env$sheets[[hoja]]$values %||% list()
  if (fila > length(filas)) return("")
  fila_v <- as.list(filas[[fila]] %||% list())
  if (col > length(fila_v)) return("")
  v <- as.character(fila_v[[col]] %||% "")[1]
  if (is.na(v)) "" else v
}

.ext_publicar <- function(mock, plan = .ext_plan()) {
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)
  monitoreo_aulas_publicar_libro(spreadsheet_id = "sheet_libro", plan = plan)
}

.ext_acciones <- function(res) {
  hojas <- Filter(is.list, res$hojas %||% list())
  stats::setNames(
    vapply(hojas, function(h) as.character(h$accion %||% ""), character(1)),
    vapply(hojas, function(h) as.character(h$hoja %||% ""), character(1))
  )
}

# --- ROJO 6: la siembra publica las dos hojas extra (contratos 1 y 6) ---------

test_that("B14: la publicación a Sheets siembra las dos hojas extra", {
  skip_if_not_installed("digest")
  mock <- .ext_mock()
  res <- .ext_publicar(mock)
  acc <- .ext_acciones(res)
  expect_true(.ext_hoja_ag %in% names(acc),
              info = sprintf("la publicación no declara «%s»; hojas declaradas: %s",
                             .ext_hoja_ag, paste(names(acc), collapse = " | ")))
  expect_true(.ext_hoja_ap %in% names(acc),
              info = sprintf("la publicación no declara «%s»; hojas declaradas: %s",
                             .ext_hoja_ap, paste(names(acc), collapse = " | ")))
  if (all(c(.ext_hoja_ag, .ext_hoja_ap) %in% names(acc))) {
    expect_identical(unname(acc[[.ext_hoja_ag]]), "sembrada")
    expect_identical(unname(acc[[.ext_hoja_ap]]), "sembrada")
    # Y la pestaña sembrada trae de verdad los códigos EXTRA.
    celdas <- as.character(unlist(mock$env$sheets[[.ext_hoja_ag]]$values, use.names = FALSE))
    expect_true(any(grepl("^EXTRA ", celdas)),
                info = "la pestaña extra se declaró sembrada pero no trae códigos EXTRA")
  }
})

# --- ROJO 7: el arrastre entre las hojas extra (contrato 3) -------------------

test_that("B14: la hoja de campo (Extra) arrastra su agenda desde «Aulas Agendadas (Extra)»", {
  skip_if_not_installed("digest")
  mock <- .ext_mock()
  .ext_publicar(mock)
  if (is.null(mock$env$sheets[[.ext_hoja_ap]])) {
    fail(sprintf("la publicación no sembró «%s»: no hay dónde mirar el arrastre", .ext_hoja_ap))
    return(invisible(NULL))
  }
  # Fila 3 (primera de datos), columna del CURSO-HORARIO: fórmula TO_TEXT que
  # referencia la agendadas EXTRA — no la principal, y no una copia de valor.
  celda <- .ext_celda_mock(mock, .ext_hoja_ap, 3L, .ext_col_agenda("CURSO-HORARIO"))
  expect_true(grepl("^=TO_TEXT\\(", celda),
              info = sprintf("se esperaba fórmula TO_TEXT; hay %s", deparse(celda)))
  expect_true(grepl(.ext_hoja_ag, celda, fixed = TRUE),
              info = sprintf("la fórmula no referencia «%s»: %s", .ext_hoja_ag, deparse(celda)))
  expect_false(grepl("'Aulas Agendadas'!", celda, fixed = TRUE),
               info = "la hoja extra arrastra de la agendadas PRINCIPAL, no de la suya")

  # Toda escritura con fórmulas hacia la hoja extra declara USER_ENTERED (con
  # RAW, Sheets guardaría el texto sin computar); el resto sigue RAW.
  con_formula <- Filter(function(w) {
    celdas <- as.character(unlist(w$values, use.names = FALSE))
    identical(w$titulo, .ext_hoja_ap) && any(grepl("^=", celdas[!is.na(celdas)]))
  }, mock$env$writes)
  expect_gt(length(con_formula), 0L)
  for (w in con_formula) {
    expect_identical(w$opcion, "USER_ENTERED",
                     info = sprintf("escritura con fórmulas sobre %s fue %s",
                                    w$titulo, deparse(w$opcion)))
  }

  # Contra-pin: las columnas de CAMPO del bloque extra siguen siendo tecleables.
  status_apl <- .ext_celda_mock(mock, .ext_hoja_ap, 3L, .ext_col_campo("STATUS DE APLICACIÓN"))
  expect_false(grepl("^=", status_apl))
})

# --- ROJO 8: dueño EQUIPO — siembra única, respetadas al republicar (contrato 4)

test_that("B14: republicar respeta las hojas extra ya sembradas (dueño equipo)", {
  skip_if_not_installed("digest")
  mock <- .ext_mock()
  .ext_publicar(mock)
  corte <- length(mock$env$writes)

  plan2 <- .ext_plan()
  plan2[[2]]$contact_medium <- "Presencial"
  res <- .ext_publicar(mock, plan = plan2)
  acc <- .ext_acciones(res)
  expect_true(all(c(.ext_hoja_ag, .ext_hoja_ap) %in% names(acc)),
              info = sprintf("la republicación no declara las hojas extra; declaradas: %s",
                             paste(names(acc), collapse = " | ")))
  if (all(c(.ext_hoja_ag, .ext_hoja_ap) %in% names(acc))) {
    expect_identical(unname(acc[[.ext_hoja_ag]]), "respetada")
    expect_identical(unname(acc[[.ext_hoja_ap]]), "respetada")
  }
  writes_nuevos <- if (length(mock$env$writes) > corte) {
    mock$env$writes[seq.int(corte + 1L, length(mock$env$writes))]
  } else {
    list()
  }
  tocadas <- vapply(writes_nuevos, function(w) w$titulo, character(1))
  expect_false(any(tocadas %in% c(.ext_hoja_ag, .ext_hoja_ap)),
               info = sprintf("la republicación escribió sobre: %s",
                              paste(unique(tocadas), collapse = ", ")))
})

# --- ROJO 9: la lista de pestañas controladas (contrato 7) --------------------

test_that("B14: las dos hojas extra están en la lista de pestañas controladas", {
  lista <- monitoreo_sheets_pestanas_controladas()
  faltan <- setdiff(c(.ext_hoja_ag, .ext_hoja_ap), lista)
  expect_identical(faltan, character(0),
                   info = "hojas extra fuera de la lista controlada de Sheets")
  # Capturado y no expect_silent: el validador revienta con stop_api y un error
  # duro taparía el mensaje literal que este rojo debe conservar.
  veto <- tryCatch({
    .monitoreo_sheets_validate_controlled_tabs(c(
      "Aulas Agendadas", "Aulas Aplicadas (Campo)", "Base de control",
      .ext_hoja_ag, .ext_hoja_ap
    ))
    ""
  }, error = function(e) conditionMessage(e))
  expect_identical(veto, "",
                   info = "el validador de pestañas controladas rechaza las hojas extra")
})
