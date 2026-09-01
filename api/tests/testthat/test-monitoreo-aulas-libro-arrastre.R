# B9 — las hojas del equipo no se hablan entre sí (arrastre por fórmula, M4).
#
# El defecto del operativo (2026-08-31, libro EN USO): Gonzalo cambió medio de
# contacto y estado en «Aulas Agendadas» y «Aulas Aplicadas (Campo)» no se
# movió. En 2025 el mecanismo era el ARRASTRE POR FÓRMULA: la hoja de campo
# arrastraba los datos de agenda de cada aula con fórmulas intra-Sheets; hoy la
# siembra copia esos datos como VALORES y las dos hojas quedan congeladas cada
# una por su lado.
#
# Contrato congelado por el lead:
#   1. En la SIEMBRA a Sheets, las columnas de AGENDA de cada bloque de la hoja
#      de campo (ID MATCH + los 20 títulos de agenda) se escriben como FÓRMULAS
#      de arrastre a 'Aulas Agendadas' POR POSICIÓN DE FILA. Geometría real,
#      verificada corriendo los generadores: «Aulas Agendadas» lleva UNA fila
#      de cabecera (primera fila de datos = fila 2) y la hoja de campo lleva
#      DOS (grupo + campos; primera fila de datos = fila 3). El ancla es
#      campo fila 3 ← agendadas fila 2, campo fila 4 ← agendadas fila 3.
#      Las 14 columnas de CAMPO del bloque (parte + ficha escaneada) siguen
#      sembrándose como valores tecleables.
#   2. Las fórmulas exigen USER_ENTERED. El publicador escribe RAW (decisión
#      round-trip, cabecera de monitoreo_aulas_publicar_libro.R): el contrato
#      es que las escrituras QUE LLEVAN fórmula van USER_ENTERED y todo lo
#      demás —«Aulas Agendadas» incluida— sigue RAW. Se pinea el RESULTADO
#      (la celda contiene fórmula que referencia 'Aulas Agendadas') y la
#      opción del request, no el mecanismo por rangos que el writer elija.
#   3. El round-trip NO se rompe: la API de lectura devuelve valores
#      COMPUTADOS, no fórmulas, así que el lector de agendadas+campo sigue
#      funcionando con el mock devolviendo valores.
#   4. La regla de dueño queda intacta: la app siembra UNA vez (ahora con
#      fórmulas) y jamás reescribe las hojas del equipo (`respetada`).
#   5. El `.xlsx` descargable queda declarado FASE 2 (la urgencia es el Sheets
#      vivo); su rojo con openxlsx::writeFormula no se fija aquí.
#
# Sin red: todo pasa por `.monitoreo_google_api` mockeado sobre el helper
# compartido `.sheets_api_mock()` (helper-sheets-mock.R), envuelto aquí para
# capturar el `valueInputOption` de cada escritura de values y para aplicar
# escrituras por sub-rango A1 en su posición (el helper solo reemplaza la
# pestaña entera, y el mecanismo del fix puede escribir rangos de fórmulas).

# --- fixture: dos titulares para poder pinear el arrastre POR FILA -----------

.mala_plan <- function() list(
  list(operational_code = "CH 1", titular_operational_code = "CH 1",
       sample_role = "titular", faculty = "Letras y Ciencias Humanas",
       course_name = "CURSO UNO", teacher = "Docente CH 1", eligible_n = 40,
       contact_medium = "WhatsApp", sample_status = "agendada",
       scheduled_date = "2026-08-11"),
  list(operational_code = "R 1.1", titular_operational_code = "CH 1",
       sample_role = "chain_reserve", replacement_order = 1,
       faculty = "Letras y Ciencias Humanas", course_name = "CURSO DE RESERVA",
       eligible_n = 30),
  list(operational_code = "CH 2", titular_operational_code = "CH 2",
       sample_role = "titular", faculty = "Ciencias Sociales",
       course_name = "CURSO DOS", teacher = "Docente CH 2", eligible_n = 25,
       contact_medium = "Correo", sample_status = "reagendada",
       scheduled_date = "2026-08-12")
)

# Un parte del equipo con el vocabulario del LECTOR (carga_aulas_aplicadas.R),
# que es de donde viene en un estudio real.
.mala_partes <- function() list(
  list(operational_code = "CH 1", intento = 1L, observed_students = 30,
       refusals = 2, duplicates = 0, effective_surveys = 28,
       applied_by = "Ana", actual_room = "L321", applied_date = "2026-08-12")
)

.mala_hoja_agendadas <- "Aulas Agendadas"
.mala_hoja_campo <- "Aulas Aplicadas (Campo)"

# Columnas del bloque 1 de la hoja de campo (1 = ID MATCH; luego la agenda y
# luego el parte), DERIVADAS de las mismas specs que usan los generadores.
# Antes eran literales (12/15/33/35/37) y cada reorden del bloque obligaba a
# recontarlas a mano; derivadas, el reorden v4 —y cualquier futuro— las
# recomputa solo. El test de contexto sigue verificando la geometría para que
# un rojo no pueda significar «conté mal».
.mala_col_agenda <- function(campo) {
  idx <- which(vapply(AULAS_AGENDADAS_BLOQUE,
                      function(s) identical(s$campo, campo), logical(1)))
  1L + idx[[1]]
}
.mala_col_parte <- function(titulo) {
  1L + AULAS_AGENDADAS_ANCHO_BLOQUE +
    which(prosecnurapp:::.calg_titulos_campo() == titulo)[[1]]
}
.mala_ancho_bloque <- function() {
  1L + AULAS_AGENDADAS_ANCHO_BLOQUE + length(prosecnurapp:::.calg_titulos_campo())
}
.mala_col_id_match <- 1L
.mala_col_curso <- .mala_col_agenda("operational_code")
.mala_col_medio <- .mala_col_agenda("contact_medium")   # el campo que Gonzalo cambió
.mala_col_status <- .mala_col_agenda("sample_status")   # el otro campo que cambió
.mala_col_status_apl <- .mala_col_parte("STATUS DE APLICACIÓN")  # del equipo, tecleable
.mala_col_ficha <- .mala_col_parte("ENLACE DE FICHA ESCANEADA")  # del equipo
.mala_col_curso_b2 <- .mala_ancho_bloque() + .mala_col_agenda("operational_code")

# --- mock: el compartido + captura de valueInputOption y rangos A1 -----------

.mala_col_a1 <- function(letras) {
  n <- 0L
  for (ch in strsplit(toupper(letras), "")[[1]]) n <- n * 26L + (utf8ToInt(ch) - 64L)
  n
}

.mala_mock <- function() {
  base <- .sheets_api_mock()
  base$env$writes <- list()

  aplicar <- function(rango, values, opcion) {
    titulo <- .sheets_api_sin_comillas(rango)
    if (!nzchar(titulo) || is.null(base$env$sheets[[titulo]])) return(invisible(NULL))
    a1 <- sub("^[^!]*!?", "", as.character(rango %||% "")[1])
    hoja <- base$env$sheets[[titulo]]$values %||% list()
    if (!nzchar(a1)) {
      # Pestaña entera: reemplaza, igual que el helper compartido.
      hoja <- values %||% list()
    } else {
      celda0 <- sub(":.*$", "", a1)
      col0 <- max(1L, .mala_col_a1(gsub("[^A-Za-z]", "", celda0)))
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
      # PUT/POST a un rango suelto (values.update): el otro mecanismo posible.
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

.mala_celda <- function(mock, hoja, fila, col) {
  filas <- mock$env$sheets[[hoja]]$values %||% list()
  if (fila > length(filas)) return("")
  fila_v <- as.list(filas[[fila]] %||% list())
  if (col > length(fila_v)) return("")
  v <- as.character(fila_v[[col]] %||% "")[1]
  if (is.na(v)) "" else v
}

.mala_es_formula <- function(celda) grepl("^=", celda)

.mala_arrastra_agendadas <- function(celda) {
  .mala_es_formula(celda) && grepl("Aulas Agendadas", celda, fixed = TRUE)
}

# Escrituras de values que llevan al menos una fórmula en su payload.
.mala_writes_con_formula <- function(mock) {
  Filter(function(w) {
    celdas <- as.character(unlist(w$values, use.names = FALSE))
    any(grepl("^=", celdas[!is.na(celdas)]))
  }, mock$env$writes)
}

.mala_publicar <- function(mock, plan = .mala_plan(), partes = .mala_partes()) {
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)
  monitoreo_aulas_publicar_libro(
    spreadsheet_id = "sheet_libro", plan = plan, partes = partes
  )
}

# --- contexto (verde deliberado): la geometría que anclan los pines ----------

test_that("contexto B9: geometría fila-a-fila y columnas del bloque, verificadas", {
  # Si un generador cambia de forma, el rojo de abajo dejaría de significar
  # «falta el arrastre» y pasaría a significar «conté mal»; este test lo separa.
  ag <- aulas_libro_hoja_agendadas(.mala_plan())
  ap <- aulas_libro_hoja_aplicadas(.mala_plan(), partes = .mala_partes())

  # «Aulas Agendadas»: UNA fila de cabecera; datos desde la fila 2.
  expect_identical(as.character(ag[1, 1]), "ID MATCH")
  expect_identical(as.character(ag[2, .mala_col_curso]), "CH 1")
  expect_identical(as.character(ag[3, .mala_col_curso]), "CH 2")

  # Hoja de campo: DOS filas de cabecera (grupo + campos); datos desde la 3.
  expect_identical(as.character(ap[1, 1]), "TITULAR")
  expect_identical(as.character(ap[2, .mala_col_id_match]), "ID MATCH")
  expect_identical(as.character(ap[2, .mala_col_curso]), "CURSO-HORARIO")
  expect_identical(as.character(ap[2, .mala_col_medio]), "MEDIO DE CONTACTO")
  expect_identical(as.character(ap[2, .mala_col_status]), "STATUS MUESTRA")
  expect_identical(as.character(ap[2, .mala_col_status_apl]), "STATUS DE APLICACIÓN")
  expect_identical(as.character(ap[2, .mala_col_ficha]), "ENLACE DE FICHA ESCANEADA")
  expect_identical(as.character(ap[2, .mala_col_curso_b2]), "CURSO-HORARIO")
  expect_identical(as.character(ap[3, .mala_col_curso]), "CH 1")
  expect_identical(as.character(ap[4, .mala_col_curso]), "CH 2")
})

# --- 1. ROJO: la siembra arrastra la agenda por fórmula ----------------------

test_that("B9: la hoja de campo sembrada arrastra la agenda de 'Aulas Agendadas' por fórmula", {
  skip_if_not_installed("digest")
  mock <- .mala_mock()
  .mala_publicar(mock)

  # El ancla del bloque 1, fila 3 de campo ← fila 2 de agendadas: la celda del
  # CURSO-HORARIO tiene que ser una FÓRMULA que referencia 'Aulas Agendadas',
  # no la copia como valor («CH 1») que hoy congela las dos hojas.
  curso <- .mala_celda(mock, .mala_hoja_campo, 3L, .mala_col_curso)
  expect_true(.mala_arrastra_agendadas(curso),
              info = sprintf("CURSO-HORARIO bloque 1 fila 3: se esperaba fórmula a 'Aulas Agendadas'; hay el valor copiado %s", deparse(curso)))

  # Los dos campos que Gonzalo cambió en la agenda y la hoja de campo no vio.
  medio <- .mala_celda(mock, .mala_hoja_campo, 3L, .mala_col_medio)
  expect_true(.mala_arrastra_agendadas(medio),
              info = sprintf("MEDIO DE CONTACTO fila 3: se esperaba fórmula; hay %s", deparse(medio)))
  status <- .mala_celda(mock, .mala_hoja_campo, 3L, .mala_col_status)
  expect_true(.mala_arrastra_agendadas(status),
              info = sprintf("STATUS MUESTRA fila 3: se esperaba fórmula; hay %s", deparse(status)))

  # ID MATCH también deja de copiarse como valor (contrato: ID MATCH + los 20).
  id_match <- .mala_celda(mock, .mala_hoja_campo, 3L, .mala_col_id_match)
  expect_true(.mala_es_formula(id_match),
              info = sprintf("ID MATCH fila 3: se esperaba fórmula; hay %s", deparse(id_match)))

  # POR POSICIÓN DE FILA: la fila 4 de campo arrastra la fila 3 de agendadas
  # (CH 2), no una copia congelada. Se pinea el observable —dejar de ser el
  # valor tecleado— y no la forma exacta de la fórmula, para no prohibir el
  # mecanismo por rangos/array que el writer elija.
  curso_f4 <- .mala_celda(mock, .mala_hoja_campo, 4L, .mala_col_curso)
  expect_false(identical(curso_f4, "CH 2"),
               info = "CURSO-HORARIO fila 4 sigue siendo la copia como valor «CH 2»")

  # Cada bloque arrastra: el bloque 2 (REEMPLAZO 1) también, hoy sembrado "".
  curso_b2 <- .mala_celda(mock, .mala_hoja_campo, 3L, .mala_col_curso_b2)
  expect_true(.mala_arrastra_agendadas(curso_b2),
              info = sprintf("CURSO-HORARIO bloque 2 fila 3: se esperaba fórmula; hay %s", deparse(curso_b2)))

  # Contra-pin: las columnas de CAMPO del bloque siguen siendo valores
  # tecleables del equipo, nunca fórmulas.
  expect_false(.mala_es_formula(.mala_celda(mock, .mala_hoja_campo, 3L, .mala_col_status_apl)))
  expect_false(.mala_es_formula(.mala_celda(mock, .mala_hoja_campo, 3L, .mala_col_ficha)))
})

# --- 2. ROJO: las fórmulas viajan con USER_ENTERED; lo demás sigue RAW -------

test_that("B9: la siembra de la hoja de campo declara USER_ENTERED para sus fórmulas y la agenda sigue RAW", {
  skip_if_not_installed("digest")
  mock <- .mala_mock()
  .mala_publicar(mock)

  # Tiene que existir al menos UNA escritura de values con fórmulas hacia la
  # hoja de campo (hoy: cero — toda la siembra copia valores).
  con_formula <- .mala_writes_con_formula(mock)
  expect_gt(length(con_formula), 0L)
  expect_true(any(vapply(con_formula, function(w) {
    identical(w$titulo, .mala_hoja_campo)
  }, logical(1))),
  info = "ninguna escritura con fórmulas toca 'Aulas Aplicadas (Campo)'")

  # Toda escritura que lleve fórmulas declara USER_ENTERED: con RAW, Sheets
  # guardaría el texto «='Aulas Agendadas'!B2» sin computarlo.
  for (w in con_formula) {
    expect_identical(w$opcion, "USER_ENTERED",
                     info = sprintf("escritura con fórmulas sobre %s fue %s", w$titulo, deparse(w$opcion)))
  }

  # «Todo lo demás sigue RAW»: la siembra de 'Aulas Agendadas' conserva la
  # decisión round-trip («0205» no se convierte en 205).
  writes_agendadas <- Filter(function(w) identical(w$titulo, .mala_hoja_agendadas), mock$env$writes)
  expect_gt(length(writes_agendadas), 0L)
  for (w in writes_agendadas) {
    expect_identical(w$opcion, "RAW",
                     info = sprintf("la siembra de 'Aulas Agendadas' fue %s", deparse(w$opcion)))
  }
})

# --- 3. guarda: el round-trip lee VALORES computados y sigue en pie ----------

test_that("B9: el lector de agendadas+campo sigue funcionando con la API devolviendo valores", {
  # La API de lectura (`spreadsheets.values.get`) devuelve valores COMPUTADOS,
  # nunca fórmulas: para el lector, un libro con arrastre se ve igual que uno
  # con valores copiados. El mock siembra ese resultado computado.
  mock <- .mala_mock()
  ag <- aulas_libro_hoja_agendadas(.mala_plan())
  ap <- aulas_libro_hoja_aplicadas(.mala_plan(), partes = .mala_partes())
  a_values <- function(hoja) lapply(seq_len(nrow(hoja)), function(i) as.list(as.character(hoja[i, ])))
  mock$seed(.mala_hoja_agendadas, values = a_values(ag))
  mock$seed(.mala_hoja_campo, values = a_values(ap))
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)

  hojas <- aulas_libro_leer_de_sheets("sheet_libro")
  expect_true(all(c("agendadas", "aplicadas") %in% names(hojas)))
  res <- aulas_libro_importar_valores(hojas)

  codigos <- vapply(res$plan, function(r) as.character(r$operational_code %||% ""), character(1))
  expect_true(all(c("CH 1", "CH 2") %in% codigos))
  ch1 <- res$plan[[which(codigos == "CH 1")[[1]]]]
  expect_identical(as.character(ch1$contact_medium %||% ""), "WhatsApp")

  codigos_parte <- vapply(res$partes, function(p) as.character(p$operational_code %||% ""), character(1))
  expect_true("CH 1" %in% codigos_parte)
  parte <- res$partes[[which(codigos_parte == "CH 1")[[1]]]]
  expect_equal(as.numeric(parte$effective_surveys), 28)
})

# --- 4. guarda: la regla de dueño queda intacta tras el arrastre -------------

test_that("B9: republicar no reescribe las hojas del equipo aunque ahora se siembren con fórmulas", {
  skip_if_not_installed("digest")
  mock <- .mala_mock()
  .mala_publicar(mock)

  corte <- length(mock$env$writes)
  # El plan cambió en la app: la regla es de dueño, no de delta — ni la nueva
  # escritura de fórmulas puede colarse en una republicación.
  plan2 <- .mala_plan()
  plan2[[1]]$contact_medium <- "Presencial"
  res <- .mala_publicar(mock, plan = plan2)

  resumen <- Filter(function(h) is.list(h), res$hojas %||% list())
  acciones <- stats::setNames(
    vapply(resumen, function(h) as.character(h$accion %||% ""), character(1)),
    vapply(resumen, function(h) as.character(h$hoja %||% ""), character(1))
  )
  expect_identical(unname(acciones[[.mala_hoja_agendadas]]), "respetada")
  expect_identical(unname(acciones[[.mala_hoja_campo]]), "respetada")

  writes_nuevos <- if (length(mock$env$writes) > corte) {
    mock$env$writes[seq.int(corte + 1L, length(mock$env$writes))]
  } else {
    list()
  }
  tocadas <- vapply(writes_nuevos, function(w) w$titulo, character(1))
  expect_false(any(tocadas %in% c(.mala_hoja_agendadas, .mala_hoja_campo)),
               info = sprintf("la republicación escribió sobre: %s",
                              paste(unique(tocadas), collapse = ", ")))
})
