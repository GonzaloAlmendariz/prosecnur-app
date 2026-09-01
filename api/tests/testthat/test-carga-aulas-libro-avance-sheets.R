# «Avance de campo» llega al Google Sheets como pestaña de la APP — unidad B2.2.
#
# Hoy la hoja solo existe en el `.xlsx`: `aulas_libro_indicadores()` devuelve un
# MODELO (`meta`/`diario`/`aplicadores`/`facultades`) y
# `aulas_libro_escribir_indicadores()` lo vuelca IMPERATIVO con openxlsx, celda
# a celda. El publicador (`monitoreo_aulas_publicar_libro`) solo sabe hablar con
# generadores modelo→data.frame de celdas (`aulas_libro_hoja_agendadas`,
# `aulas_libro_hoja_plan_dia`…), así que la hoja de indicadores se queda en
# tierra: `.malp_hojas_app()` publica «Base de control» y «Plan del día» y nada
# más.
#
# Lo que esta suite fija (rojo primero):
#   1. existe `aulas_libro_hoja_avance(ind, fecha)`: el MISMO modelo que ya
#      alimenta el xlsx, como data.frame de celdas; equivalencia pineada en
#      celdas clave, no en la matriz entera.
#   2. el título de sección es el académico de A13b («Avance contra la meta»),
#      nada coloquial.
#   3. `.malp_hojas_app()` la declara TERCERA hoja de la app y la publicación
#      completa la emite; contenido remoto no la protege (jamás `respetada`).
#   4. determinismo: la fecha del corte («Al DD/MM/YYYY») se inyecta o se
#      deriva del modelo — el renderer NO consulta `Sys.Date()` por su cuenta
#      (el camino imperativo sí lo hace, indicadores.R:219, y por eso el libro
#      cambia de un día para otro; la pestaña publicada no puede heredar eso:
#      el motor batch+hash compararía dos cortes idénticos como distintos).
#
# El camino imperativo del xlsx NO cambia en esta unidad: los 22 PASS de
# test-carga-aulas-libro-indicadores.R son vecina intacta, no contrato migrado.
#
# «Avance de campo» ya está en la lista controlada de pestañas
# (monitoreo_sheets_pestanas.R, alta de A13a) y pineada en
# test-monitoreo-sheets-pestanas.R — ese pin no se duplica aquí.

# --- fixtures ----------------------------------------------------------------

# Calca del plan de test-carga-aulas-libro-indicadores.R: dos titulares con
# meta 20 cada uno (meta_total 40) y una reserva que NO suma meta propia.
.cas_plan <- function() list(
  list(operational_code = "CH 1", sample_role = "titular", faculty = "Letras",
       eligible_n = 30, expected_valid = 20),
  list(operational_code = "CH 2", sample_role = "titular", faculty = "Letras",
       eligible_n = 30, expected_valid = 20),
  list(operational_code = "R 2.1", sample_role = "chain_reserve",
       titular_operational_code = "CH 2", faculty = "Letras",
       eligible_n = 28, expected_valid = 20)
)

# Cinco respuestas en dos días; la quinta NO es efectiva. Con la meta 40:
# 2026-08-10 → 2 efectivas, acumulado 2; 2026-08-11 → 2 efectivas, acumulado 4,
# faltan 36.
.cas_respuestas <- function() data.frame(
  `_submission_time` = c("2026-08-10T09:00:00", "2026-08-10T10:00:00",
                         "2026-08-11T09:00:00", "2026-08-11T11:00:00",
                         "2026-08-11T12:00:00"),
  sexo = c("Mujer", "Hombre", "Mujer", "Hombre", "Prefiero no decir"),
  check.names = FALSE, stringsAsFactors = FALSE
)

# Equipo B: 2 aulas, 14 efectivas declaradas (8 + 6), media 7 — abre la tabla
# porque va más flojo que Equipo A (media 20).
.cas_partes <- function() list(
  list(operational_code = "CH 1", applied_by = "Equipo A", effective_surveys = 20),
  list(operational_code = "CH 2", applied_by = "Equipo B", effective_surveys = 8),
  list(operational_code = "R 2.1", applied_by = "Equipo B", effective_surveys = 6)
)

.cas_efectivas <- function() c(`CH 1` = 18, `CH 2` = 12)

# El MISMO modelo que alimenta el xlsx: la equivalencia se pinea contra él.
.cas_modelo <- function() aulas_libro_indicadores(
  .cas_plan(),
  efectivas = .cas_efectivas(),
  responses = .cas_respuestas(),
  validas = c(TRUE, TRUE, TRUE, TRUE, FALSE),
  partes = .cas_partes()
)

.cas_fecha <- function() as.Date("2026-08-15")

# --- lectura de celdas -------------------------------------------------------

# El data.frame de celdas como matriz de texto: la hoja es de bloques, así que
# los pines buscan por ETIQUETA, no por posición de fila — la geometría interna
# es del renderer.
.cas_celdas <- function(hoja) {
  expect_true(is.data.frame(hoja))
  m <- as.matrix(hoja)
  m[] <- trimws(ifelse(is.na(m), "", as.character(m)))
  m
}

# La celda a la derecha de una etiqueta (el patrón etiqueta|valor del bloque de
# meta), como número.
.cas_valor_junto_a <- function(m, etiqueta) {
  idx <- which(m == etiqueta, arr.ind = TRUE)
  if (!nrow(idx)) return(NA_real_)
  fila <- idx[1, "row"]
  col <- idx[1, "col"] + 1L
  if (col > ncol(m)) return(NA_real_)
  suppressWarnings(as.numeric(m[fila, col]))
}

# Los números de la fila que contiene un valor ancla (una fecha del diario, un
# nombre de aplicador).
.cas_numeros_de_fila_con <- function(m, ancla) {
  idx <- which(m == ancla, arr.ind = TRUE)
  if (!nrow(idx)) return(numeric(0))
  fila <- m[idx[1, "row"], ]
  v <- suppressWarnings(as.numeric(fila))
  v[is.finite(v)]
}

# --- 1. el renderer existe y calza con el modelo -----------------------------

test_that("B2.2: existe el renderer modelo→celdas de «Avance de campo»", {
  # El patrón local es aulas_libro_hoja_<hoja>(…): data.frame de celdas que
  # `.malp_df_a_values` adapta fila a fila. Sin él, la hoja no tiene camino a
  # Sheets: el imperativo de openxlsx no produce values.
  expect_true(exists("aulas_libro_hoja_avance", mode = "function"))
  hoja <- aulas_libro_hoja_avance(.cas_modelo(), fecha = .cas_fecha())
  expect_true(is.data.frame(hoja))
  expect_gt(nrow(hoja), 0L)
})

test_that("B2.2: la meta y el logrado del renderer son los del modelo", {
  # Equivalencia en celdas clave contra el MODELO (los mismos números que hoy
  # escribe el camino imperativo), no la matriz entera.
  ind <- .cas_modelo()
  m <- .cas_celdas(aulas_libro_hoja_avance(ind, fecha = .cas_fecha()))
  expect_equal(.cas_valor_junto_a(m, "Encuestas de la meta"), ind$meta$meta_total) # 40
  expect_equal(.cas_valor_junto_a(m, "Efectivas conseguidas"), ind$meta$logrado)   # 30
})

test_that("B2.2: una fila del diario y una de aplicadores llevan los números del modelo", {
  ind <- .cas_modelo()
  m <- .cas_celdas(aulas_libro_hoja_avance(ind, fecha = .cas_fecha()))

  # 2026-08-11 en el modelo: 2 efectivas del día, 4 acumuladas, faltan 36.
  fila_dia <- ind$diario[ind$diario$Dia == "2026-08-11", ]
  esperados_dia <- c(fila_dia$`Efectivas del dia`, fila_dia$`Efectivas acumuladas`,
                     fila_dia$`Falta para la meta`)
  en_hoja <- .cas_numeros_de_fila_con(m, "2026-08-11")
  expect_true(all(esperados_dia %in% en_hoja),
              info = sprintf("fila del 2026-08-11: esperaba {%s} dentro de {%s}",
                             paste(esperados_dia, collapse = ", "),
                             paste(en_hoja, collapse = ", ")))

  # Equipo B en el modelo: 2 aulas, 14 efectivas declaradas, media 7.
  fila_apl <- ind$aplicadores[ind$aplicadores$Aplicador == "Equipo B", ]
  esperados_apl <- c(fila_apl$Aulas, fila_apl$`Efectivas declaradas`,
                     fila_apl$`Media por aula`)
  en_hoja_apl <- .cas_numeros_de_fila_con(m, "Equipo B")
  expect_true(all(esperados_apl %in% en_hoja_apl),
              info = sprintf("fila de Equipo B: esperaba {%s} dentro de {%s}",
                             paste(esperados_apl, collapse = ", "),
                             paste(en_hoja_apl, collapse = ", ")))
})

test_that("B2.2: el renderer dice lo mismo que la hoja imperativa del xlsx", {
  # El lazo entre los DOS caminos: el xlsx que el equipo descarga y la pestaña
  # que verá en Sheets no pueden dar cifras distintas para la misma etiqueta.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.cas_plan(), libro, efectivas = .cas_efectivas())
  d <- suppressWarnings(openxlsx::read.xlsx(libro, sheet = "Avance de campo",
                                            colNames = FALSE, skipEmptyRows = FALSE))
  fila_meta <- which(as.character(d[[1]]) == "Encuestas de la meta")
  expect_length(fila_meta, 1L)
  del_xlsx <- suppressWarnings(as.numeric(d[[2]][[fila_meta]]))

  ind <- aulas_libro_indicadores(.cas_plan(), efectivas = .cas_efectivas())
  m <- .cas_celdas(aulas_libro_hoja_avance(ind, fecha = .cas_fecha()))
  expect_equal(.cas_valor_junto_a(m, "Encuestas de la meta"), del_xlsx)
})

# --- 2. registro académico (A13b) --------------------------------------------

test_that("B2.2: el título de sección es «Avance contra la meta», nada coloquial", {
  # A13b (`3a12a52b`) fijó el registro académico; la pestaña publicada nace con
  # él, no con los rótulos viejos.
  m <- .cas_celdas(aulas_libro_hoja_avance(.cas_modelo(), fecha = .cas_fecha()))
  expect_true(any(m == "Avance contra la meta"))
  coloquiales <- c("Cómo va el campo", "Como va el campo", "Cómo nos va hoy",
                   "Cómo se está trabajando")
  for (rotulo in coloquiales) {
    expect_false(any(grepl(rotulo, m, fixed = TRUE)),
                 info = sprintf("rótulo coloquial «%s» en la hoja publicada", rotulo))
  }
})

# --- 3. determinismo de la fecha del corte -----------------------------------

test_that("B2.2: la fecha del corte se inyecta; el renderer no consulta Sys.Date()", {
  # El camino imperativo escribe «Al DD/MM/YYYY» con Sys.Date() (indicadores.R)
  # y por eso el xlsx cambia de un día para otro. La pestaña de Sheets viaja
  # por el motor batch+hash: si el renderer leyera el reloj, dos publicaciones
  # del MISMO estado en días distintos darían hashes distintos y la hoja se
  # reescribiría sin que nada haya cambiado.
  con_15 <- .cas_celdas(aulas_libro_hoja_avance(.cas_modelo(), fecha = as.Date("2026-08-15")))
  con_16 <- .cas_celdas(aulas_libro_hoja_avance(.cas_modelo(), fecha = as.Date("2026-08-16")))
  expect_true(any(grepl("15/08/2026", con_15, fixed = TRUE)))
  expect_false(any(grepl("15/08/2026", con_16, fixed = TRUE)))
  expect_true(any(grepl("16/08/2026", con_16, fixed = TRUE)))

  # Y el cuerpo no llama al reloj: un default inyectable en la firma es
  # aceptable (la inyección manda, y arriba se probó); un Sys.Date() DENTRO
  # del cuerpo no.
  cuerpo <- paste(deparse(body(aulas_libro_hoja_avance)), collapse = " ")
  expect_false(grepl("Sys.Date", cuerpo, fixed = TRUE),
               info = "el renderer consulta el reloj en su cuerpo")
})

# --- 4. tercera hoja de la APP en el publicador ------------------------------

test_that("B2.2: .malp_hojas_app() declara «Avance de campo» junto a control y plan del día", {
  hojas <- .malp_hojas_app()
  expect_true("Base de control" %in% hojas)
  expect_true("Plan del día" %in% hojas)
  expect_true("Avance de campo" %in% hojas)
  # Y jamás como hoja del equipo: la regla de dueño no la alcanza.
  expect_false("Avance de campo" %in% .malp_hojas_equipo())
})

test_that("B2.2: la publicación completa siembra «Avance de campo» en un documento vacío", {
  skip_if_not_installed("digest")
  mock <- .sheets_api_mock()
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)

  res <- monitoreo_aulas_publicar_libro(
    spreadsheet_id = "sheet_libro",
    plan = .cas_plan(),
    partes = .cas_partes(),
    efectivas = .cas_efectivas()
  )

  # La hoja está en el resumen, con acción de hoja de la app. La extracción es
  # tolerante a la AUSENCIA para que el rojo diga «"" en vez de "sembrada"» y
  # no un subscript out of bounds.
  resumen <- Filter(function(h) identical(as.character(h$hoja %||% ""), "Avance de campo"),
                    res$hojas %||% list())
  expect_length(resumen, 1L)
  accion <- if (length(resumen)) as.character(resumen[[1]]$accion %||% "") else ""
  expect_identical(accion, "sembrada")

  # El mock registró su creación y sus values…
  creadas <- character(0)
  con_values <- character(0)
  for (call in mock$env$calls) {
    if (grepl("/values:batchUpdate$", call$url)) {
      for (entry in call$body$data %||% list()) {
        con_values <- c(con_values, .sheets_api_sin_comillas(entry$range))
      }
    } else if (grepl(":batchUpdate$", call$url)) {
      for (request in call$body$requests %||% list()) {
        titulo <- as.character(request$addSheet$properties$title %||% "")
        if (nzchar(titulo)) creadas <- c(creadas, titulo)
      }
    }
  }
  expect_true("Avance de campo" %in% creadas)
  expect_true("Avance de campo" %in% con_values)

  # …y lo publicado lleva el registro académico y la meta del modelo.
  celdas <- unlist(mock$env$sheets[["Avance de campo"]]$values %||% list(),
                   use.names = FALSE)
  celdas <- trimws(as.character(celdas))
  expect_true("Avance contra la meta" %in% celdas)
  i_meta <- match("Encuestas de la meta", celdas)
  expect_false(is.na(i_meta))
  # El valor viaja en la celda siguiente de su fila (patrón etiqueta|valor);
  # extracción tolerante para que el rojo sea NA vs 40, no un subscript error.
  valor_meta <- if (!is.na(i_meta) && i_meta < length(celdas)) {
    suppressWarnings(as.numeric(celdas[[i_meta + 1L]]))
  } else NA_real_
  expect_equal(valor_meta, 40)
})

test_that("B2.2: contenido remoto NO protege «Avance de campo» — jamás respetada", {
  skip_if_not_installed("digest")
  mock <- .sheets_api_mock()
  # Alguien tecleó sobre la pestaña de la app: la regla de dueño dice que la
  # app la reasserta, como a «Base de control» y «Plan del día».
  mock$seed("Avance de campo", values = list(
    list("indicadores tecleados a mano"),
    list("que la app debe pisar")
  ))
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)

  res <- monitoreo_aulas_publicar_libro(
    spreadsheet_id = "sheet_libro",
    plan = .cas_plan(),
    partes = .cas_partes(),
    efectivas = .cas_efectivas()
  )

  resumen <- Filter(function(h) identical(as.character(h$hoja %||% ""), "Avance de campo"),
                    res$hojas %||% list())
  expect_length(resumen, 1L)
  accion <- if (length(resumen)) as.character(resumen[[1]]$accion %||% "") else ""
  # En positivo, no como `!= "respetada"`: una hoja AUSENTE del resumen daría
  # "" y pasaría un pin negativo sin publicar nada.
  expect_true(accion %in% c("sembrada", "actualizada"),
              info = sprintf("accion = «%s»", accion))

  # El remoto quedó con lo de la app, no con lo tecleado.
  celdas <- trimws(as.character(unlist(mock$env$sheets[["Avance de campo"]]$values %||% list(),
                                       use.names = FALSE)))
  expect_true("Avance contra la meta" %in% celdas)
  expect_false("indicadores tecleados a mano" %in% celdas)
})
