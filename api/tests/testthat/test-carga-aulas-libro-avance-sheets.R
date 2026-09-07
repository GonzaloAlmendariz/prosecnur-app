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

# --- 5. A9-B6: sin decimales sobre personas/encuestas ------------------------
#
# `.cala_num_txt` copia el `round(x, 1)` de `cifra_limpia` y publica «3157.8»
# como texto en la pestaña. Media encuesta no existe. La regla congelada
# (checklist 2026-08-31, A9-B6) es la misma que la del xlsx: META al entero mas
# proximo (floor(x + 0.5)), lo CONSEGUIDO hacia abajo, lo que FALTA hacia
# arriba; tasas y promedios conservan su decimal. Y los DOS caminos tienen que
# moverse juntos: el pin de equivalencia de abajo lo fuerza.

.cas_plan_fraccionario <- function() list(
  # 1578.9 x 2 = 3157.8: la cifra vista en el libro real.
  list(operational_code = "CH 1", sample_role = "titular", faculty = "Letras",
       eligible_n = 30, expected_valid = 1578.9),
  list(operational_code = "CH 2", sample_role = "titular", faculty = "Letras",
       eligible_n = 30, expected_valid = 1578.9)
)

# 1200.4 + 105.9 = 1306.3: el logrado fraccionario visto en la UI.
.cas_efectivas_fraccionarias <- function() c(`CH 1` = 1200.4, `CH 2` = 105.9)

.cas_modelo_fraccionario <- function() aulas_libro_indicadores(
  .cas_plan_fraccionario(),
  efectivas = .cas_efectivas_fraccionarias(),
  responses = .cas_respuestas(),
  validas = c(TRUE, TRUE, TRUE, TRUE, FALSE),
  partes = list(
    list(operational_code = "CH 1", applied_by = "Equipo Unico", effective_surveys = 8),
    list(operational_code = "CH 2", applied_by = "Equipo Unico", effective_surveys = 5)
  ),
  # La media sale de la PLATAFORMA desde el 2026-09-07 —la del parte llegaba al
  # cerrar y en la primera semana casi no existe—, así que se atribuye por el
  # reparto: 1200.4 + 105.9 = 1306.3 en 2 cursos-horario, media 653.15 -> 653.2.
  # El decimal LEGITIMO que este test defiende sigue estando: es un promedio.
  asignados = list(`CH 1` = "Equipo Unico", `CH 2` = "Equipo Unico")
)

test_that("A9-B6: el bloque de meta publica enteros — meta al mas proximo, logrado abajo, falta arriba", {
  m <- .cas_celdas(aulas_libro_hoja_avance(.cas_modelo_fraccionario(), fecha = .cas_fecha()))
  # 3157.8 -> 3158; 1306.3 -> 1306; 1851.5 -> 1852.
  expect_equal(.cas_valor_junto_a(m, "Encuestas de la meta"), 3158)
  expect_equal(.cas_valor_junto_a(m, "Efectivas conseguidas"), 1306)
  expect_equal(.cas_valor_junto_a(m, "Faltan"), 1852)
  # Y en el TEXTO publicado no queda parte decimal: la pestaña va en RAW, lo
  # que hay en la celda es exactamente lo que el operativo lee.
  idx <- which(m == "Encuestas de la meta", arr.ind = TRUE)
  txt <- m[idx[1, "row"], idx[1, "col"] + 1L]
  expect_false(grepl("[.,][0-9]", txt),
               info = sprintf("la celda de la meta dice «%s»", txt))
})

test_that("A9-B6: «Falta para la meta» del diario sube al entero; la media conserva su decimal", {
  m <- .cas_celdas(aulas_libro_hoja_avance(.cas_modelo_fraccionario(), fecha = .cas_fecha()))
  # 3157.8 - 4 acumuladas = 3153.8 respuestas por recoger -> 3154 (hacia arriba).
  en_dia <- .cas_numeros_de_fila_con(m, "2026-08-11")
  expect_true(3154 %in% en_dia,
              info = sprintf("fila del 2026-08-11: {%s}", paste(en_dia, collapse = ", ")))
  expect_false(any(abs(en_dia - 3153.8) < 1e-9),
               info = "la columna publica 3153.8: decimales sobre encuestas")
  # Pin de conservacion (hoy verde): «Media por curso-horario» es un promedio y
  # su decimal significa algo — la regla de enteros es de los conteos.
  en_apl <- .cas_numeros_de_fila_con(m, "Equipo Unico")
  expect_true(653.2 %in% en_apl,
              info = sprintf("fila de Equipo Unico: {%s}", paste(en_apl, collapse = ", ")))
})

test_that("A9-B6: con cifras fraccionarias, xlsx y Sheets siguen diciendo lo mismo", {
  # Pin de conservacion (hoy verde: ambos publican el mismo round(x, 1)). El
  # pin de equivalencia de arriba usa enteros 40/30 y no discrimina; este obliga
  # a que la regla de redondeo aterrice en los DOS caminos a la vez — arreglar
  # solo `cifra_limpia` o solo `.cala_num_txt` deja al equipo con dos cifras
  # distintas para la misma etiqueta.
  ind <- aulas_libro_indicadores(.cas_plan_fraccionario(),
                                 efectivas = .cas_efectivas_fraccionarias())
  libro <- withr::local_tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  aulas_libro_escribir_indicadores(wb, ind)
  openxlsx::saveWorkbook(wb, libro, overwrite = TRUE)
  d <- suppressWarnings(openxlsx::read.xlsx(libro, sheet = "Avance de campo",
                                            colNames = FALSE, skipEmptyRows = FALSE))
  m <- .cas_celdas(aulas_libro_hoja_avance(ind, fecha = .cas_fecha()))
  for (etq in c("Encuestas de la meta", "Efectivas conseguidas", "Faltan")) {
    fila <- which(as.character(d[[1]]) == etq)
    expect_length(fila, 1L)
    del_xlsx <- suppressWarnings(as.numeric(d[[2]][[fila]]))
    expect_equal(.cas_valor_junto_a(m, etq), del_xlsx,
                 info = sprintf("«%s»: xlsx y Sheets divergen", etq))
  }
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

# --- 6. B19: la hoja se organiza en bloques localizables por etiqueta ---------
#
# Dictado de Gonzalo (2026-09-01, textual): «tiene una estructura muy, muy
# fea; no se ven bien las tablas, no se organiza bien, no se entiende cómo se
# organiza; se ve como toda esa información, no como una tabla». El REDISEÑO
# es de presentación (las bandas y cabeceras las emite el formato de Sheets —
# contrato rojo en test-monitoreo-aulas-formato-avance.R); lo que esta sección
# pinea es el invariante del que ese formato cuelga: los títulos de bloque y
# las cabeceras de tabla son localizables POR ETIQUETA en el contenido del
# renderer, y los bloques se separan con al menos una fila en blanco. Los
# números de la equivalencia xlsx↔Sheets ya están pineados arriba y NO
# cambian: B19 cambia la presentación, no el contenido.

# El bloque de facultades exige cuotas del diseño (sin ellas no existe, misma
# regla que el xlsx): un fixture con UNA facultad basta para que la hoja
# traiga los cuatro bloques.
.cas_cuotas <- function() list(
  meta_diseno = 40, meta_operativa = 60,
  facultades = list(
    list(facultad = "Letras", cuota = 40, cuota_sexo = list(F = 20, M = 20))
  )
)

.cas_modelo_completo <- function() aulas_libro_indicadores(
  .cas_plan(),
  efectivas = .cas_efectivas(),
  responses = .cas_respuestas(),
  validas = c(TRUE, TRUE, TRUE, TRUE, FALSE),
  partes = .cas_partes(),
  cuotas = .cas_cuotas()
)

# La fila (1-based) donde una etiqueta aparece como celda, o NA.
.cas_fila_de <- function(m, etiqueta) {
  idx <- which(m == etiqueta, arr.ind = TRUE)
  if (!nrow(idx)) return(NA_integer_)
  as.integer(idx[1, "row"])
}

test_that("B19: los cuatro títulos de bloque y las cabeceras de sus tablas se localizan por etiqueta", {
  m <- .cas_celdas(aulas_libro_hoja_avance(.cas_modelo_completo(), fecha = .cas_fecha()))
  titulos <- c("Avance contra la meta", "Avance por facultad",
               "Producción por aplicador", "Avance diario")
  for (t in titulos) {
    expect_false(is.na(.cas_fila_de(m, t)),
                 info = sprintf("título de bloque «%s» ausente", t))
  }
  # Cada tabla del modelo lleva su fila de nombres de columna: es la fila que
  # el formato de B19 viste como cabecera, localizada por su primera etiqueta.
  for (cab in c("Facultad", "Aplicador", "Dia")) {
    fila <- .cas_fila_de(m, cab)
    expect_false(is.na(fila), info = sprintf("cabecera de tabla «%s» ausente", cab))
  }
  # Y el orden de los bloques es el del modelo (meta, facultades,
  # aplicadores, diario): la geometría interna es del renderer, el ORDEN es
  # del contrato.
  filas <- vapply(titulos, function(t) .cas_fila_de(m, t), integer(1))
  expect_true(all(diff(filas) > 0L))
})

test_that("B19: cada título de bloque llega tras al menos una fila en blanco de separación", {
  m <- .cas_celdas(aulas_libro_hoja_avance(.cas_modelo_completo(), fecha = .cas_fecha()))
  fila_en_blanco <- function(i) all(!nzchar(m[i, ]))
  for (t in c("Avance contra la meta", "Avance por facultad",
              "Producción por aplicador", "Avance diario")) {
    fila <- .cas_fila_de(m, t)
    expect_false(is.na(fila), info = sprintf("título «%s» ausente", t))
    if (!is.na(fila)) {
      expect_true(fila > 1L && fila_en_blanco(fila - 1L),
                  info = sprintf("el bloque «%s» no se separa del anterior (fila %d)", t, fila))
    }
  }
})

# --- S4 (loop estética, 2026-09-07): el vacío de una celda de tabla se declara ---

test_that("S4: en Sheets, la celda sin dato de una tabla sale «—», no vacía", {
  # Medido en el libro real del 07/09: 19 de 24 aplicadores sin parte tenían
  # «Efectivas declaradas» en blanco y la fila quedaba con un hueco en medio;
  # el «—» ya es el vocabulario del bloque de meta y de la procedencia.
  ind <- aulas_libro_indicadores(
    .cas_plan(), efectivas = .cas_efectivas(), partes = .cas_partes(),
    # Equipo C tiene un curso-horario asignado y ningún parte: su columna
    # «Efectivas declaradas» es NA en el modelo.
    asignados = list(`CH 1` = "Equipo A", `CH 2` = "Equipo C")
  )
  expect_true(any(is.na(ind$aplicadores$`Efectivas declaradas`)))
  filas <- .malp_df_a_values(aulas_libro_hoja_avance(ind, fecha = .cas_fecha()))
  cabecera <- which(vapply(filas, function(f) identical(unlist(f)[[1]], "Aplicador"), logical(1)))
  expect_length(cabecera, 1L)
  nombres <- as.character(unlist(filas[[cabecera]]))
  col <- which(nombres == "Efectivas declaradas")
  fila_c <- which(vapply(filas, function(f) identical(unlist(f)[[1]], "Equipo C"), logical(1)))
  expect_length(fila_c, 1L)
  expect_identical(as.character(unlist(filas[[fila_c]]))[[col]], "\u2014")
  # Y ninguna celda de la tabla queda en blanco: de la cabecera a la última fila.
  n <- nrow(ind$aplicadores)
  for (i in (cabecera + 1L):(cabecera + n)) {
    celdas <- as.character(unlist(filas[[i]]))[seq_along(nombres)]
    expect_false(any(!nzchar(celdas)), info = sprintf("fila %d con celda en blanco: %s", i, paste(celdas, collapse = "|")))
  }
})
