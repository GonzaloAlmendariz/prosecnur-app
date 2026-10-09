# La plomería del cruce DAA — B8h fase 2. El seam existe y nadie lo enhebra.
#
# `aulas_libro_hoja_agendadas(unidades, traslape_daa)` ya sabe añadir la columna
# «TRASLAPE DAA» al final de CADA bloque (fase 1, pineada en
# test-carga-daa-iagen.R — aquí NO se re-pinea la spec ni `aulas_daa_traslape`).
# Pero sus dos llamadores la llaman SIN el parámetro: `aulas_libro_generar`
# (xlsx) y `monitoreo_aulas_publicar_libro` (Sheets). Este archivo fija el rojo
# de enhebrarlo, y el peligro central medido por el lead: con `con_daa` cada
# bloque se ensancha en 1, así que los campos del bloque b se corren +(b-1)
# columnas, y los consumidores de geometría DERIVADA que hoy miden el bloque
# sin la columna apuntarían a la celda equivocada:
#
#   - las fórmulas de arrastre de la hoja de campo
#     (monitoreo_aulas_libro_arrastre.R: `.malar_ancho_agenda()` = 20 hoy)
#     referenciarían la columna vieja de agendadas en los bloques R1+;
#   - los desplegables y calendarios de Sheets
#     (monitoreo_aulas_sheets_formato.R: `.mafs_col_agenda` con stride de 20)
#     caerían corridos en los bloques R1+.
#
# Contrato por punto (rojo salvo donde se declara verde-guardia):
#   1. ROJO — el publicador acepta `traslape_daa` y la hoja publicada gana la
#      columna con el veredicto correcto por código.
#   2. ROJO — `aulas_libro_generar` también la pasa; y con `traslape_daa=NULL`
#      el libro es idéntico al de hoy (guardia del caso normal tras el fix).
#   3. ROJO — CON traslape, las fórmulas de arrastre referencian las columnas
#      CORRIDAS de agendadas (+ (b-1) por bloque).
#   4. ROJO — CON traslape, los setDataValidation de bloques R1+ caen en los
#      índices corridos.
#   5. VERDE-GUARDIA — SIN traslape todo queda como hoy (la columna es
#      CONDICIONAL por dictado del dueño: otros estudios no la llevan).
#   6. VERDE-GUARDIA — la columna es DE IDA: el lector multi-bloque la ignora
#      de vuelta y no inventa campo (fase 1 solo cubría un bloque).
#
# Cómo viaja `traslape_daa` hasta `monitoreo_aulas_publicar_libro_en_sesion`
# (¿parámetro, clave de sesión, config?) es DECISIÓN DEL WRITER y aquí no se
# pinea: solo se pinea la firma del publicador núcleo y del generador xlsx.
#
# Sin red: todo por `.monitoreo_google_api` mockeado sobre el helper compartido
# `.sheets_api_mock()` (helper-sheets-mock.R), envuelto como en
# test-monitoreo-aulas-libro-arrastre.R para aplicar PUT por sub-rango A1 y
# capturar el valueInputOption. Todo acceso por `[[` — el `$` parcial-matchea.

# --- fixture sintético: dos cadenas de profundidad 2 + cruce DAA -------------

.cald_plan <- function() list(
  list(operational_code = "CH 1", titular_operational_code = "CH 1",
       sample_role = "titular", faculty = "Letras y Ciencias Humanas",
       course_name = "CURSO UNO", teacher = "Docente CH 1",
       teacher_phone = "999111222", eligible_n = 40, enrolled_total = 45,
       contact_medium = "WhatsApp", sample_status = "agendada",
       scheduled_date = "2026-08-11", link = "https://x.test/CH1"),
  list(operational_code = "R 1.1", titular_operational_code = "CH 1",
       sample_role = "chain_reserve", replacement_order = 1,
       faculty = "Letras y Ciencias Humanas", course_name = "CURSO DE RESERVA",
       teacher = "Docente R 1.1", eligible_n = 30, link = "https://x.test/R11"),
  list(operational_code = "CH 2", titular_operational_code = "CH 2",
       sample_role = "titular", faculty = "Ciencias Sociales",
       course_name = "CURSO DOS", teacher = "Docente CH 2",
       teacher_phone = "988777666", eligible_n = 25, enrolled_total = 28,
       contact_medium = "Correo", sample_status = "reagendada",
       scheduled_date = "2026-08-12", link = "https://x.test/CH2"),
  list(operational_code = "R 2.1", titular_operational_code = "CH 2",
       sample_role = "chain_reserve", replacement_order = 1,
       faculty = "Ciencias Sociales", course_name = "OTRA RESERVA",
       teacher = "Docente R 2.1", eligible_n = 22, link = "https://x.test/R21")
)

# Veredictos con el formato REAL de `aulas_daa_traslape` (no se re-pinea esa
# función: test-carga-daa-iagen.R ya la cubre). «CH 2» viene mencionado con
# veredicto vacío y «R 2.1» ni aparece: las dos formas de «sin traslape».
.cald_traslape <- function() c(
  "CH 1"  = "AULA EN DAA (TITULAR)",
  "R 1.1" = "DOCENTE EN DAA (COMPL.)",
  "CH 2"  = ""
)

# --- geometría derivada de la spec (+1 del TRASLAPE DAA) ---------------------

.cald_idx <- function(campo) {
  which(vapply(AULAS_AGENDADAS_BLOQUE,
               function(s) identical(s$campo, campo), logical(1)))[[1]]
}
# Ancho del bloque de agendadas CON la columna condicional.
.cald_ancho_con <- function() AULAS_AGENDADAS_ANCHO_BLOQUE + 1L
# Columna (1-based) de un campo en «Aulas Agendadas» con/sin TRASLAPE DAA.
.cald_col_con <- function(campo, b) 1L + (b - 1L) * .cald_ancho_con() + .cald_idx(campo)
.cald_col_sin <- function(campo, b) 1L + (b - 1L) * AULAS_AGENDADAS_ANCHO_BLOQUE + .cald_idx(campo)
# La columna TRASLAPE DAA del bloque b (cierra el bloque).
.cald_col_daa <- function(b) 1L + b * .cald_ancho_con()
.cald_letra <- function(col) openxlsx::int2col(as.integer(col))

# La hoja de campo NO gana la columna (solo agendadas la lleva): su bloque
# sigue midiendo ID MATCH + agenda + parte, derivado de las mismas specs.
.cald_ancho_campo <- function() {
  1L + AULAS_AGENDADAS_ANCHO_BLOQUE + length(prosecnurapp:::.calg_titulos_campo())
}
.cald_campo_col_agenda <- function(campo, b) {
  (b - 1L) * .cald_ancho_campo() + 1L + .cald_idx(campo)
}

# --- mock: el compartido + PUT por sub-rango A1 y captura de opción ----------
# (calca el de test-monitoreo-aulas-libro-arrastre.R; los helpers de un test
# file no se ven desde otro, y este archivo no puede editar los existentes)

.cald_a1_a_int <- function(letras) {
  n <- 0L
  for (ch in strsplit(toupper(letras), "")[[1]]) n <- n * 26L + (utf8ToInt(ch) - 64L)
  n
}

.cald_mock <- function() {
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
      col0 <- max(1L, .cald_a1_a_int(gsub("[^A-Za-z]", "", celda0)))
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

.cald_celda <- function(mock, hoja, fila, col) {
  filas <- mock$env$sheets[[hoja]]$values %||% list()
  if (fila > length(filas)) return("")
  fila_v <- as.list(filas[[fila]] %||% list())
  if (col > length(fila_v)) return("")
  v <- as.character(fila_v[[col]] %||% "")[1]
  if (is.na(v)) "" else v
}

# La referencia A1 que una fórmula de arrastre hace a 'Aulas Agendadas', o ""
# si la celda no es fórmula / no referencia esa hoja. Se pinea la REFERENCIA
# (letra + fila) y no el envoltorio (TO_TEXT hoy): la letra es el contrato.
.cald_ref_agendadas <- function(celda) {
  if (!grepl("^=", celda) || !grepl("'Aulas Agendadas'!", celda, fixed = TRUE)) return("")
  sub(".*'Aulas Agendadas'!([A-Z]+[0-9]+).*", "\\1", celda)
}

.cald_publicar <- function(mock, traslape = NULL) {
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)
  if (is.null(traslape)) {
    monitoreo_aulas_publicar_libro(
      spreadsheet_id = "sheet_libro", plan = .cald_plan()
    )
  } else {
    monitoreo_aulas_publicar_libro(
      spreadsheet_id = "sheet_libro", plan = .cald_plan(),
      traslape_daa = traslape
    )
  }
}

# --- lectores de requests estructurales (calcan test-monitoreo-aulas-sheets-formato.R)

.cald_estructurales <- function(calls) {
  out <- list()
  for (call in calls) {
    if (!grepl(":batchUpdate$", call$url)) next
    if (grepl("values:batchUpdate", call$url, fixed = TRUE)) next
    out <- c(out, call$body$requests %||% list())
  }
  out
}

.cald_validaciones_en <- function(reqs) {
  Filter(Negate(is.null), lapply(reqs, function(r) {
    sdv <- r[["setDataValidation"]]
    if (is.null(sdv)) return(NULL)
    regla <- sdv[["rule"]] %||% list()
    cond <- regla[["condition"]] %||% list()
    valores <- vapply(cond[["values"]] %||% list(), function(v) {
      as.character(v[["userEnteredValue"]] %||% "")
    }, character(1))
    rango <- sdv[["range"]] %||% list()
    list(
      tipo = as.character(cond[["type"]] %||% ""),
      valores = valores,
      sheet_id = suppressWarnings(as.integer(rango[["sheetId"]] %||% NA_integer_))[1],
      col_desde = suppressWarnings(as.integer(rango[["startColumnIndex"]] %||% NA_integer_))[1]
    )
  }))
}

.cald_validaciones_de <- function(mock, hoja) {
  sheet_id <- mock$env$sheets[[hoja]]$sheetId
  Filter(function(v) identical(v$sheet_id, as.integer(sheet_id)),
         .cald_validaciones_en(.cald_estructurales(mock$env$calls)))
}

# --- contexto (verde deliberado): la aritmética que anclan los rojos ---------

test_that("contexto B8h fase 2: la geometría corrida que pinean los rojos, verificada", {
  # Si un generador cambia de forma, los rojos de abajo dejarían de significar
  # «falta la plomería» y pasarían a significar «conté mal»; esto los separa.
  # NADA de letras ni índices literales (B22 va a ensanchar la spec): la
  # aritmética del test se verifica CONTRA LA HOJA REAL que produce el seam.
  # Hoy (spec de 20) el bloque 2 con DAA pone CURSO-HORARIO en W y MEDIO DE
  # CONTACTO en AB; si la spec crece, estas mismas líneas recomputan.
  con_daa <- aulas_libro_hoja_agendadas(.cald_plan(), traslape_daa = .cald_traslape())
  cab_con <- as.character(unlist(con_daa[1, ], use.names = FALSE))
  expect_identical(length(cab_con), 1L + 2L * .cald_ancho_con())
  expect_identical(cab_con[[.cald_col_con("operational_code", 1L)]], "CURSO-HORARIO")
  expect_identical(cab_con[[.cald_col_con("operational_code", 2L)]], "CURSO-HORARIO R1")
  expect_identical(cab_con[[.cald_col_con("contact_medium", 2L)]], "MEDIO DE CONTACTO R1")
  expect_identical(cab_con[[.cald_col_daa(1L)]], "TRASLAPE DAA")
  expect_identical(cab_con[[.cald_col_daa(2L)]], "TRASLAPE DAA R1")

  # Y la aritmética SIN la columna casa con la hoja de hoy: el corrimiento del
  # bloque b es exactamente +(b-1).
  sin_daa <- aulas_libro_hoja_agendadas(.cald_plan())
  cab_sin <- as.character(unlist(sin_daa[1, ], use.names = FALSE))
  expect_identical(cab_sin[[.cald_col_sin("operational_code", 2L)]], "CURSO-HORARIO R1")
  expect_identical(.cald_col_con("operational_code", 2L),
                   .cald_col_sin("operational_code", 2L) + 1L)
  expect_identical(.cald_col_con("operational_code", 1L),
                   .cald_col_sin("operational_code", 1L))

  # Y la hoja de campo NO gana la columna: su bloque sigue midiendo
  # ID MATCH + agenda + parte (geometría real de los generadores).
  ap <- aulas_libro_hoja_aplicadas(.cald_plan())
  expect_identical(as.character(ap[2, .cald_campo_col_agenda("operational_code", 2L)]),
                   "CURSO-HORARIO")
  expect_identical(as.character(ap[3, .cald_campo_col_agenda("operational_code", 1L)]),
                   "CH 1")
  expect_identical(as.character(ap[4, .cald_campo_col_agenda("operational_code", 1L)]),
                   "CH 2")

  # Verde-guardia del seam condicional: NULL y character(0) son «sin cruce».
  expect_identical(aulas_libro_hoja_agendadas(.cald_plan(), traslape_daa = NULL), sin_daa)
  expect_identical(aulas_libro_hoja_agendadas(.cald_plan(), traslape_daa = character(0)), sin_daa)
})

# --- 1. ROJO: el publicador acepta traslape_daa y la columna llega a Sheets --

test_that("B8h plomería: monitoreo_aulas_publicar_libro pasa traslape_daa y la hoja publicada gana la columna", {
  skip_if_not_installed("digest")
  mock <- .cald_mock()
  res <- .cald_publicar(mock, traslape = .cald_traslape())

  # La siembra sigue siendo siembra: el parámetro no cambia el resumen.
  resumen <- Filter(function(h) is.list(h), res$hojas %||% list())
  acciones <- stats::setNames(
    vapply(resumen, function(h) as.character(h$accion %||% ""), character(1)),
    vapply(resumen, function(h) as.character(h$hoja %||% ""), character(1))
  )
  expect_identical(unname(acciones[["Aulas Agendadas"]]), "sembrada")

  # La INTEGRACIÓN, no la spec: la columna llega al remoto con el veredicto
  # correcto por código operativo. Cabecera de cada bloque…
  expect_identical(.cald_celda(mock, "Aulas Agendadas", 1L, .cald_col_daa(1L)),
                   "TRASLAPE DAA")
  expect_identical(.cald_celda(mock, "Aulas Agendadas", 1L, .cald_col_daa(2L)),
                   "TRASLAPE DAA R1")
  # …y veredictos: CH 1 (fila 2) con su reserva R 1.1 en el bloque 2; CH 2
  # (fila 3) mencionado con veredicto vacío y R 2.1 ni mencionado → "".
  expect_identical(.cald_celda(mock, "Aulas Agendadas", 2L, .cald_col_daa(1L)),
                   "AULA EN DAA (TITULAR)")
  expect_identical(.cald_celda(mock, "Aulas Agendadas", 2L, .cald_col_daa(2L)),
                   "DOCENTE EN DAA (COMPL.)")
  expect_identical(.cald_celda(mock, "Aulas Agendadas", 3L, .cald_col_daa(1L)), "")
  expect_identical(.cald_celda(mock, "Aulas Agendadas", 3L, .cald_col_daa(2L)), "")
})

# --- 2. ROJO: el arrastre referencia las columnas CORRIDAS de agendadas ------

test_that("B8h plomería: con traslape, las fórmulas de arrastre apuntan a las columnas corridas (+ (b-1) por bloque)", {
  skip_if_not_installed("digest")
  mock <- .cald_mock()
  .cald_publicar(mock, traslape = .cald_traslape())

  hoja_campo <- "Aulas Aplicadas (Campo)"
  # Referencias esperadas por ARITMÉTICA DESDE LA SPEC (nunca letras a mano —
  # B22 va a ensanchar el bloque): 1 (ID MATCH) + (b-1)*ancho_con_daa + índice
  # del campo en la spec, a letra con el helper del test. Hoy eso da W2/AB2
  # para el bloque 2; si la spec crece, se recomputa solo.
  ref_con <- function(campo, b, fila) {
    sprintf("%s%d", .cald_letra(.cald_col_con(campo, b)), fila)
  }

  # Bloque 1: SIN corrimiento. CURSO-HORARIO de CH 1 (campo fila 3) sigue
  # arrastrando la fila 2 de agendadas en la columna de siempre.
  b1 <- .cald_celda(mock, hoja_campo, 3L, .cald_campo_col_agenda("operational_code", 1L))
  expect_identical(.cald_ref_agendadas(b1), ref_con("operational_code", 1L, 2L),
                   info = sprintf("bloque 1 fila 3: celda %s", deparse(b1)))

  # Bloque 2: corrido +1. Con TRASLAPE DAA el CURSO-HORARIO del bloque 2 de
  # agendadas vive una columna más allá: la fórmula al índice viejo arrastraría
  # el ENLACE DE LA FICHA del bloque 1 disfrazado de curso.
  b2_curso <- .cald_celda(mock, hoja_campo, 3L, .cald_campo_col_agenda("operational_code", 2L))
  expect_identical(.cald_ref_agendadas(b2_curso), ref_con("operational_code", 2L, 2L),
                   info = sprintf("bloque 2 fila 3: celda %s", deparse(b2_curso)))

  # Otro campo del bloque 2 (MEDIO DE CONTACTO), corrido igual.
  b2_medio <- .cald_celda(mock, hoja_campo, 3L, .cald_campo_col_agenda("contact_medium", 2L))
  expect_identical(.cald_ref_agendadas(b2_medio), ref_con("contact_medium", 2L, 2L),
                   info = sprintf("bloque 2 MEDIO fila 3: celda %s", deparse(b2_medio)))

  # Y el ancla POR FILA no se pierde con el corrimiento: CH 2 (campo fila 4)
  # arrastra su propia fila 3 de agendadas.
  b2_f4 <- .cald_celda(mock, hoja_campo, 4L, .cald_campo_col_agenda("operational_code", 2L))
  expect_identical(.cald_ref_agendadas(b2_f4), ref_con("operational_code", 2L, 3L),
                   info = sprintf("bloque 2 fila 4: celda %s", deparse(b2_f4)))
})

# --- 3. ROJO: desplegables y calendarios de bloques R1+ en índices corridos --

test_that("B8h plomería: con traslape, los setDataValidation de bloques R1+ caen en los índices corridos", {
  skip_if_not_installed("digest")
  mock <- .cald_mock()
  .cald_publicar(mock, traslape = .cald_traslape())

  vals <- .cald_validaciones_de(mock, "Aulas Agendadas")
  expect_gt(length(vals), 0L)

  # El desplegable de STATUS MUESTRA (su lista trae «SIN CONTACTAR»): bloque 1
  # intacto y bloque 2 CORRIDO +1 — startColumnIndex derivado de la spec, no
  # un índice a mano. En el índice viejo el chip caería sobre la vecina.
  status <- Filter(function(v) {
    identical(v$tipo, "ONE_OF_LIST") && "SIN CONTACTAR" %in% v$valores
  }, vals)
  cols_status <- sort(vapply(status, function(v) v$col_desde, integer(1)))
  expect_identical(
    cols_status,
    c(.cald_col_con("sample_status", 1L) - 1L, .cald_col_con("sample_status", 2L) - 1L),
    info = sprintf("startColumnIndex de STATUS MUESTRA: %s",
                   paste(cols_status, collapse = ", "))
  )

  # Los calendarios (DATE_IS_VALID) de las dos fechas del bloque, por bloque:
  # el juego completo, con el bloque 2 corrido +1 (derivado de la spec).
  fechas <- Filter(function(v) identical(v$tipo, "DATE_IS_VALID"), vals)
  cols_fechas <- sort(vapply(fechas, function(v) v$col_desde, integer(1)))
  esperadas <- sort(c(
    .cald_col_con("contact_date", 1L) - 1L, .cald_col_con("scheduled_date", 1L) - 1L,
    .cald_col_con("contact_date", 2L) - 1L, .cald_col_con("scheduled_date", 2L) - 1L
  ))
  expect_identical(cols_fechas, esperadas,
                   info = sprintf("startColumnIndex DATE_IS_VALID: %s",
                                  paste(cols_fechas, collapse = ", ")))
})

# --- 4. ROJO: el xlsx también enhebra el parámetro ---------------------------

test_that("B8h plomería: aulas_libro_generar pasa traslape_daa y el xlsx trae la columna en cada bloque", {
  path <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.cald_plan(), path, traslape_daa = .cald_traslape())

  hoja <- readxl::read_excel(path, sheet = "Aulas Agendadas",
                             col_names = FALSE, .name_repair = "minimal")
  expect_identical(ncol(hoja), 1L + 2L * .cald_ancho_con())
  cab <- as.character(unlist(hoja[1, ], use.names = FALSE))
  expect_identical(cab[[.cald_col_daa(1L)]], "TRASLAPE DAA")
  expect_identical(cab[[.cald_col_daa(2L)]], "TRASLAPE DAA R1")
  fila_ch1 <- as.character(unlist(hoja[2, ], use.names = FALSE))
  expect_identical(fila_ch1[[.cald_col_daa(1L)]], "AULA EN DAA (TITULAR)")
  expect_identical(fila_ch1[[.cald_col_daa(2L)]], "DOCENTE EN DAA (COMPL.)")

  # De IDA también en el xlsx: el libro con la columna se reimporta ENTERO y
  # ningún campo del plan se corre ni se inventa (eligible_n y link cierran el
  # bloque: son los primeros en descuadrarse si el lector contara mal).
  out <- aulas_libro_importar(path)
  codigos <- vapply(out$plan, function(u) as.character(u$operational_code %||% ""), character(1))
  expect_setequal(codigos, c("CH 1", "R 1.1", "CH 2", "R 2.1"))
  r11 <- out$plan[[which(codigos == "R 1.1")[[1]]]]
  expect_equal(as.numeric(r11$eligible_n), 30)
  expect_identical(as.character(r11$link %||% ""), "https://x.test/R11")
  expect_false(any(vapply(out$plan, function(u) any(vapply(u, function(v)
    identical(as.character(v)[1], "DOCENTE EN DAA (COMPL.)"), logical(1))), logical(1))))
})

test_that("B8h plomería: generar con traslape_daa = NULL produce el libro de hoy (guardia del caso normal)", {
  # La columna es CONDICIONAL (dictado del dueño: «la DAA es algo particular de
  # este año»): el camino sin cruce —el de los demás estudios— no puede cambiar
  # ni una celda. Rojo hoy solo porque la firma no existe; tras el fix es la
  # guardia anti-regresión del caso normal.
  plan <- .cald_plan()
  p_hoy <- withr::local_tempfile(fileext = ".xlsx")
  p_null <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(plan, p_hoy)
  aulas_libro_generar(plan, p_null, traslape_daa = NULL)

  expect_identical(readxl::excel_sheets(p_null), readxl::excel_sheets(p_hoy))
  leer <- function(p) as.data.frame(
    readxl::read_excel(p, sheet = "Aulas Agendadas", col_names = FALSE,
                       .name_repair = "minimal"),
    stringsAsFactors = FALSE
  )
  expect_identical(leer(p_null), leer(p_hoy))
})

# --- 5. VERDE-GUARDIA: sin traslape, Sheets queda como hoy -------------------

test_that("B8h guardia: publicar SIN traslape no gana columna y conserva fórmulas y validaciones de hoy", {
  # Verde hoy a propósito: pinea el caso normal (sin cruce DAA) para que el
  # fix no lo mueva — la columna es condicional, no permanente.
  skip_if_not_installed("digest")
  mock <- .cald_mock()
  .cald_publicar(mock)

  # Ninguna cabecera TRASLAPE DAA en la hoja publicada.
  cab <- as.character(unlist(mock$env$sheets[["Aulas Agendadas"]]$values[[1]] %||% list(),
                             use.names = FALSE))
  expect_false(any(grepl("TRASLAPE DAA", cab, fixed = TRUE)))
  expect_identical(length(cab), 1L + 2L * AULAS_AGENDADAS_ANCHO_BLOQUE)

  # El arrastre del bloque 2 referencia la columna de siempre (sin corrimiento).
  b2 <- .cald_celda(mock, "Aulas Aplicadas (Campo)", 3L,
                    .cald_campo_col_agenda("operational_code", 2L))
  expect_identical(
    .cald_ref_agendadas(b2),
    sprintf("%s2", .cald_letra(.cald_col_sin("operational_code", 2L)))
  )

  # Y las validaciones en sus índices de siempre.
  vals <- .cald_validaciones_de(mock, "Aulas Agendadas")
  status <- Filter(function(v) {
    identical(v$tipo, "ONE_OF_LIST") && "SIN CONTACTAR" %in% v$valores
  }, vals)
  expect_identical(sort(vapply(status, function(v) v$col_desde, integer(1))),
                   c(.cald_col_sin("sample_status", 1L) - 1L,
                     .cald_col_sin("sample_status", 2L) - 1L))
  fechas <- Filter(function(v) identical(v$tipo, "DATE_IS_VALID"), vals)
  expect_identical(
    sort(vapply(fechas, function(v) v$col_desde, integer(1))),
    sort(c(.cald_col_sin("contact_date", 1L) - 1L,
           .cald_col_sin("scheduled_date", 1L) - 1L,
           .cald_col_sin("contact_date", 2L) - 1L,
           .cald_col_sin("scheduled_date", 2L) - 1L))
  )
})

# --- 6. VERDE-GUARDIA: la columna es DE IDA en un libro multi-bloque ---------

test_that("B8h guardia: el lector multi-bloque ignora TRASLAPE DAA de vuelta y no corre ningún campo", {
  # Fase 1 pineó el lector con UN bloque; el peligro del corrimiento vive en
  # los bloques R1+, así que la guardia se toma sobre la hoja REAL de dos
  # bloques que produce el seam. Verde hoy: el lector ancla por título.
  hoja <- aulas_libro_hoja_agendadas(.cald_plan(), traslape_daa = .cald_traslape())
  titulos <- as.character(unlist(hoja[1, ], use.names = FALSE))
  cuerpo <- as.data.frame(hoja[-1, , drop = FALSE], stringsAsFactors = FALSE)

  filas <- aulas_agendadas_a_plan(cuerpo, titulos = titulos)
  codigos <- vapply(filas, function(u) as.character(u$operational_code %||% ""), character(1))
  expect_setequal(codigos, c("CH 1", "R 1.1", "CH 2", "R 2.1"))

  # Los campos que CIERRAN el bloque (vecinos de la columna nueva) vuelven
  # intactos en el bloque de reemplazo: son los primeros en descuadrarse.
  r11 <- filas[[which(codigos == "R 1.1")[[1]]]]
  expect_equal(as.numeric(r11$eligible_n), 30)
  expect_identical(as.character(r11$link %||% ""), "https://x.test/R11")
  expect_identical(as.character(r11$course_name %||% ""), "CURSO DE RESERVA")

  # De ida: el veredicto no vuelve al plan bajo ningún campo…
  expect_false(any(vapply(filas, function(u) any(vapply(u, function(v)
    identical(as.character(v)[1], "AULA EN DAA (TITULAR)"), logical(1))), logical(1))))
  # …y la columna extra no dispara «campos ausentes».
  expect_length(attr(filas, "campos_ausentes", exact = TRUE) %||% character(0), 0L)
})
