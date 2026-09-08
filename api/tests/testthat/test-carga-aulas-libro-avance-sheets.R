# «Avance de campo» llega al Google Sheets como pestaña de la APP — unidad B2.2.
#
# El xlsx la escribe IMPERATIVO (`aulas_libro_escribir_indicadores`, celda a
# celda con openxlsx) y el publicador sólo habla con generadores modelo→filas;
# `aulas_libro_hoja_avance()` es ese camino. Lo que esta suite fija:
#
#   1. el renderer produce las MISMAS cifras que el modelo que alimenta el xlsx
#      —equivalencia pineada en celdas clave, no en la matriz entera—;
#   2. el registro es académico (A13b, «es AVANCE»), nada coloquial;
#   3. `.malp_hojas_app()` la declara hoja de la app y la publicación la emite;
#      contenido remoto no la protege (jamás `respetada`);
#   4. determinismo: la fecha del corte se inyecta o se deriva del modelo — el
#      renderer NO consulta `Sys.Date()` (el imperativo sí, y por eso el xlsx
#      cambia de un día para otro; la pestaña no puede heredar eso: el motor
#      batch+hash compararía dos cortes idénticos como distintos);
#   5. **las cifras viajan como NÚMEROS y no como texto** (2026-09-08). Gonzalo
#      pidió el porcentaje como formato de celda y color que siga al valor, y
#      ninguna de las dos cosas existe sobre una celda de texto.
#
# «Avance de campo» ya está en la lista controlada de pestañas
# (monitoreo_sheets_pestanas.R) y pineada en test-monitoreo-sheets-pestanas.R —
# ese pin no se duplica aquí.

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

# Cinco respuestas en dos días; la quinta NO es efectiva. Desde el 2026-09-08 el
# avance diario es POR FACULTAD y por día, así que cada respuesta tiene que
# poder encontrar su aula: sin `collectorID` el cruce no existe y la tabla
# entera desaparece — que es exactamente lo que pasó en el campo real de
# HSVG2026 cuando el cruce miraba la clave equivocada.
#
# 2026-08-10 → 2 efectivas de Letras; 2026-08-11 → 2 efectivas, acumulado 4.
.cas_respuestas <- function() data.frame(
  collectorID = c("CH 1", "CH 1", "CH 2", "CH 1", "CH 2"),
  `_submission_time` = c("2026-08-10T09:00:00", "2026-08-10T10:00:00",
                         "2026-08-11T09:00:00", "2026-08-11T11:00:00",
                         "2026-08-11T12:00:00"),
  sexo = c("Mujer", "Hombre", "Mujer", "Hombre", "Prefiero no decir"),
  check.names = FALSE, stringsAsFactors = FALSE
)

.cas_cfg <- function() list(source_mapping = list(collector_var = "collectorID"))

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
  partes = .cas_partes(),
  cfg = .cas_cfg()
)

.cas_fecha <- function() as.Date("2026-08-15")

# --- lectura de celdas -------------------------------------------------------

# Las filas publicadas como matriz de TEXTO: la hoja es de bloques, así que los
# pines buscan por ETIQUETA y no por posición de fila — la geometría interna es
# del renderer. Las celdas numéricas se leen aquí como su texto; para pinear
# que son NÚMEROS está `.cas_filas()`, más abajo.
.cas_celdas <- function(filas) {
  expect_true(is.list(filas) && length(filas) > 0L)
  ancho <- max(vapply(filas, length, integer(1)))
  txt <- lapply(filas, function(f) {
    v <- vapply(f, function(x) {
      if (is.numeric(x)) format(x, trim = TRUE, scientific = FALSE) else as.character(x %||% "")
    }, character(1))
    c(trimws(v), rep("", ancho - length(v)))
  })
  matrix(unlist(txt, use.names = FALSE), ncol = ancho, byrow = TRUE)
}

# Las filas tal cual, con sus tipos.
.cas_filas <- function(ind, fecha = .cas_fecha()) aulas_libro_hoja_avance(ind, fecha = fecha)

# La fila cuya primera celda es `etiqueta`, con sus tipos intactos.
.cas_fila_con <- function(filas, etiqueta) {
  i <- which(vapply(filas, function(f) identical(as.character(f[[1]]), etiqueta), logical(1)))
  expect_length(i, 1L)
  filas[[i[[1]]]]
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
  filas <- aulas_libro_hoja_avance(.cas_modelo(), fecha = .cas_fecha())
  # Lista de filas, no data.frame: un data.frame de caracteres no puede llevar
  # texto y número a la vez, y el tipo es justo lo que hace posible el formato
  # de porcentaje y el color por valor (2026-09-08).
  expect_true(is.list(filas))
  expect_false(is.data.frame(filas))
  expect_gt(length(filas), 0L)
  # Rectángulo uniforme: todas las filas del mismo ancho.
  expect_length(unique(vapply(filas, length, integer(1))), 1L)
})

test_that("las cifras llegan a Sheets como NÚMEROS, no como texto", {
  # Hasta el 2026-09-08 esta hoja publicaba «480» y «19.2 %» como cadenas.
  # Con `valueInputOption=RAW` una cadena se guarda como cadena: la celda queda
  # de tipo texto y sobre texto no hay numFmt de porcentaje que aplicar, ni
  # regla de color que compare, ni orden ni suma dentro del documento.
  ind <- .cas_modelo()
  filas <- .cas_filas(ind)
  meta <- .cas_fila_con(filas, "Encuestas de la meta")
  expect_true(is.numeric(meta[[2]]))
  expect_identical(meta[[2]], ind$meta$meta_total)
  # Ninguna celda numérica sale con el signo «%» pegado: el porcentaje es
  # formato de celda, nunca parte del valor ni del rótulo.
  todas <- unlist(lapply(filas, function(f) f[vapply(f, is.character, logical(1))]),
                  use.names = FALSE)
  cabeceras <- unlist(AULAS_AVANCE_CABECERAS, use.names = FALSE)
  expect_false(any(grepl("%", cabeceras, fixed = TRUE)))
  # Y el motor de publicación conserva ese tipo hasta el cuerpo de la petición.
  # `unlist()` NO sirve para comprobarlo: coacciona la lista entera a texto y el
  # pin pasaría con el motor roto. Se recorre celda a celda.
  padded <- prosecnurapp:::.monitoreo_sync_sheets_padded_rows(
    prosecnurapp:::.monitoreo_sheets_values_rows(filas))
  numericas <- sum(vapply(padded, function(fila) {
    sum(vapply(fila, is.numeric, logical(1)))
  }, integer(1)))
  expect_gt(numericas, 0L)
  # La celda de la meta, en el mismo sitio y todavía numérica.
  i <- which(vapply(padded, function(f) identical(as.character(f[[1]]), "Encuestas de la meta"),
                    logical(1)))
  expect_length(i, 1L)
  expect_identical(padded[[i[[1]]]][[2]], ind$meta$meta_total)
})

test_that("B2.2: la meta y el logrado del renderer son los del modelo", {
  # Equivalencia en celdas clave contra el MODELO (los mismos números que hoy
  # escribe el camino imperativo), no la matriz entera.
  ind <- .cas_modelo()
  m <- .cas_celdas(.cas_filas(ind))
  expect_equal(.cas_valor_junto_a(m, "Encuestas de la meta"), ind$meta$meta_total) # 40
  expect_equal(.cas_valor_junto_a(m, "Efectivas conseguidas"), ind$meta$logrado)   # 30
})

test_that("B2.2: una fila del diario y una de aplicadores llevan los números del modelo", {
  ind <- .cas_modelo()
  m <- .cas_celdas(.cas_filas(ind))

  # 2026-08-11 en Letras: 2 efectivas del día y 4 acumuladas.
  fila_dia <- ind$diario[ind$diario[["Día"]] == "2026-08-11", ]
  esperados_dia <- c(fila_dia[["Efectivas del día"]], fila_dia[["Efectivas acumuladas"]])
  en_hoja <- .cas_numeros_de_fila_con(m, "2026-08-11")
  expect_true(all(esperados_dia %in% en_hoja),
              info = sprintf("fila del 2026-08-11: esperaba {%s} dentro de {%s}",
                             paste(esperados_dia, collapse = ", "),
                             paste(en_hoja, collapse = ", ")))

  # Equipo B en el modelo: sus aulas aplicadas y sus fichas en la base.
  fila_apl <- ind$aplicadores[ind$aplicadores$Aplicador == "Equipo B", ]
  expect_equal(nrow(fila_apl), 1L)
  esperados_apl <- c(fila_apl[["Aulas aplicadas"]], fila_apl[["Fichas en la base"]])
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
  m <- .cas_celdas(.cas_filas(ind))
  expect_equal(.cas_valor_junto_a(m, "Encuestas de la meta"), del_xlsx)
})

# --- 2. registro académico (A13b) --------------------------------------------

test_that("B2.2: el título de sección es académico, nada coloquial", {
  # A13b (`3a12a52b`) fijó el registro académico; la pestaña publicada nace con
  # él, no con los rótulos viejos.
  m <- .cas_celdas(.cas_filas(.cas_modelo()))
  expect_true(any(m == "Avance general"))
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
  con_15 <- .cas_celdas(.cas_filas(.cas_modelo(), fecha = as.Date("2026-08-15")))
  con_16 <- .cas_celdas(.cas_filas(.cas_modelo(), fecha = as.Date("2026-08-16")))
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
  expect_true("Avance general" %in% celdas)
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
  # Con cuota del diseño, para que «Faltantes para la meta» del avance diario
  # exista: desde el 2026-09-08 esa columna se mide contra la MUESTRA de la
  # facultad y sin diseño no hay contra qué medirla.
  cuotas = list(meta_diseno = 3158,
                facultades = list(list(facultad = "Letras", cuota = 3158))),
  cfg = .cas_cfg(),
  asignados = list(`CH 1` = "Equipo Unico", `CH 2` = "Equipo Unico")
)

test_that("A9-B6: «Avance general» publica enteros de personas, no medias encuestas", {
  ind <- .cas_modelo_fraccionario()
  g <- ind$general
  fila <- function(et) g[g[[1L]] == et, , drop = FALSE]
  # 3158 es la cuota del diseño; lo conseguido, 1200.4 + 105.9 = 1306.3 -> 1306.
  expect_equal(fila("Muestra")$Total, 3158)
  expect_equal(fila("Efectivas")$Total, 1306)
  # Y lo que falta se mide contra la cuota, por celda y en entero.
  expect_equal(fila("Faltantes para la muestra")$Total, 1852)
  # En la celda publicada no queda parte decimal: media encuesta no existe.
  m <- .cas_celdas(.cas_filas(ind))
  idx <- which(m == "Efectivas", arr.ind = TRUE)
  txt <- m[idx[1, "row"], idx[1, "col"] + 1L]
  expect_false(grepl("[.,][0-9]", txt),
               info = sprintf("la celda de efectivas dice «%s»", txt))
})

test_that("A9-B6: ninguna columna de personas publica decimales; las TASAS sí", {
  ind <- .cas_modelo_fraccionario()
  m <- .cas_celdas(.cas_filas(ind))
  # La cuota de Letras es 3158 y el día 11 el acumulado es 4: faltan 3154.
  en_dia <- .cas_numeros_de_fila_con(m, "2026-08-11")
  expect_true(3154 %in% en_dia,
              info = sprintf("fila del 2026-08-11: {%s}", paste(en_dia, collapse = ", ")))
  # Ninguna columna de CONTEO del avance diario sale con parte decimal: media
  # encuesta no existe.
  conteos <- c("Efectivas del día", "Efectivas esperadas", "Diferencia",
               "Efectivas acumuladas", "Faltantes para la meta")
  for (col in conteos) {
    v <- suppressWarnings(as.numeric(ind$diario[[col]]))
    v <- v[is.finite(v)]
    expect_true(all(abs(v - round(v)) < 1e-9),
                info = sprintf("«%s» publica decimales: %s", col, paste(v, collapse = ", ")))
  }
  # Pin de conservación: una TASA es una razón y su decimal significa algo — la
  # regla de enteros es de los conteos. Aquí las efectivas superan a los
  # elegibles del fixture, así que lo que se sujeta es que NO se redondeó a un
  # entero: sigue siendo fraccionaria.
  tasa <- suppressWarnings(as.numeric(
    ind$aplicadores[["Tasa de rendimiento obtenida"]][[1]]))
  expect_true(is.finite(tasa) && abs(tasa - round(tasa)) > 1e-9)
})

test_that("A9-B6: con cifras fraccionarias, xlsx y Sheets siguen diciendo lo mismo", {
  # El lazo entre los DOS caminos con cifras que obligan a redondear: arreglar
  # sólo el writer del xlsx o sólo el renderer del Sheets deja al equipo con dos
  # cifras distintas para la misma etiqueta.
  ind <- aulas_libro_indicadores(.cas_plan_fraccionario(),
                                 efectivas = .cas_efectivas_fraccionarias())
  libro <- withr::local_tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  aulas_libro_escribir_indicadores(wb, ind)
  openxlsx::saveWorkbook(wb, libro, overwrite = TRUE)
  d <- suppressWarnings(openxlsx::read.xlsx(libro, sheet = "Avance de campo",
                                            colNames = FALSE, skipEmptyRows = FALSE))
  m <- .cas_celdas(.cas_filas(ind))
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
  expect_true("Avance general" %in% celdas)
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
  cuotas = .cas_cuotas(),
  cfg = .cas_cfg()
)

# La fila (1-based) donde una etiqueta aparece como celda, o NA.
.cas_fila_de <- function(m, etiqueta) {
  idx <- which(m == etiqueta, arr.ind = TRUE)
  if (!nrow(idx)) return(NA_integer_)
  as.integer(idx[1, "row"])
}

test_that("B19: los CINCO títulos de bloque y las cabeceras de sus tablas se localizan por etiqueta", {
  filas <- .cas_filas(.cas_modelo_completo())
  m <- .cas_celdas(filas)
  titulos <- unname(AULAS_AVANCE_TITULOS)
  expect_length(titulos, 5L)
  for (t in titulos) {
    expect_false(is.na(.cas_fila_de(m, t)),
                 info = sprintf("título de bloque «%s» ausente", t))
  }
  # Cada tabla lleva su fila de nombres de columna: es la fila que el formato de
  # B19 viste como cabecera. Se localiza por la cabecera COMPLETA y no por su
  # primera celda — cuatro de las cinco empiezan por «Facultad» desde el
  # 2026-09-08, así que la primera celda ya no distingue.
  encontradas <- vapply(filas, function(f) {
    prosecnurapp:::.calac_tabla_de_cabecera(
      vapply(f, function(x) as.character(x), character(1)))
  }, character(1))
  for (clave in names(AULAS_AVANCE_CABECERAS)) {
    expect_equal(sum(encontradas == clave), 1L,
                 info = sprintf("cabecera de la tabla «%s»", clave))
  }
  # Y el orden de los bloques es el del contrato.
  orden <- vapply(titulos, function(t) .cas_fila_de(m, t), integer(1))
  expect_true(all(diff(orden) > 0L))
})

test_that("B19: cada título de bloque llega tras al menos una fila en blanco de separación", {
  m <- .cas_celdas(.cas_filas(.cas_modelo_completo()))
  fila_en_blanco <- function(i) all(!nzchar(m[i, ]))
  for (t in unname(AULAS_AVANCE_TITULOS)) {
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
  # Medido en el libro real del 07/09: 19 de 24 aplicadores tenían una columna
  # en blanco y la fila quedaba con un hueco en medio, que en Sheets se lee como
  # «se olvidaron». El «—» ya es el vocabulario del bloque de meta.
  #
  # Aquí el hueco lo produce la tasa OBTENIDA: a Equipo C sólo le tocó un
  # curso-horario sin respuestas, así que no hay elegibles aplicados con que
  # dividir. Cero y «todavía no sabemos» son dos noticias distintas, y en un
  # aplicador que aún no ha salido la segunda es la cierta.
  ind <- aulas_libro_indicadores(
    .cas_plan(), efectivas = .cas_efectivas(), partes = .cas_partes(),
    cfg = .cas_cfg(),
    asignados = list(`CH 1` = "Equipo A", `CH 2` = "Equipo A", `R 2.1` = "Equipo C")
  )
  col_tasa <- "Tasa de rendimiento obtenida"
  expect_true(any(is.na(ind$aplicadores[[col_tasa]])))
  filas <- .cas_filas(ind)
  clave <- vapply(filas, function(f) {
    prosecnurapp:::.calac_tabla_de_cabecera(
      vapply(f, function(x) as.character(x), character(1)))
  }, character(1))
  cabecera <- which(clave == "aplicador")
  expect_length(cabecera, 1L)
  nombres <- as.character(unlist(filas[[cabecera]]))
  col <- which(nombres == col_tasa)
  fila_c <- which(vapply(filas, function(f) identical(as.character(f[[2]]), "Equipo C"), logical(1)))
  expect_length(fila_c, 1L)
  expect_identical(as.character(filas[[fila_c]][[col]]), "\u2014")
  # Y ninguna celda de la tabla queda en blanco: de la cabecera a la última fila.
  n <- nrow(ind$aplicadores)
  for (i in (cabecera + 1L):(cabecera + n)) {
    celdas <- vapply(filas[[i]], function(x) as.character(x), character(1))[seq_along(nombres)]
    expect_false(any(!nzchar(celdas)),
                 info = sprintf("fila %d con celda en blanco: %s", i, paste(celdas, collapse = "|")))
  }
})

# --- S5: el avance diario ya NO cierra con «Total» --------------------------
#
# Lo hacía cuando la serie era una fila por jornada del estudio entero. Desde el
# 2026-09-08 es una fila por FACULTAD y día: un «Total» al pie sumaría acumulados
# de facultades distintas y diría una cifra que no significa nada. La fila
# «Total» sigue viva donde sí suma, que es la tabla por facultad.

test_that("S5: el avance diario no lleva fila «Total»; la tabla por facultad sí", {
  filas <- .cas_filas(.cas_modelo_completo())
  clave <- vapply(filas, function(f) {
    prosecnurapp:::.calac_tabla_de_cabecera(
      vapply(f, function(x) as.character(x), character(1)))
  }, character(1))
  primera <- vapply(filas, function(f) as.character(f[[1]]), character(1))
  cab_diario <- which(clave == "diario")
  expect_length(cab_diario, 1L)
  expect_false(any(primera[seq(cab_diario, length(primera))] == "Total"))
  cab_fac <- which(clave == "facultad")
  expect_length(cab_fac, 1L)
  expect_identical(primera[[cab_fac + nrow(.cas_modelo_completo()$facultades) + 1L]], "Total")
})

# --- S11: la frase del vacío de aplicadores es UNA, con tildes, en los dos renderers ---

test_that("S11: en Sheets el vacío de aplicadores sale de la misma función que el xlsx", {
  ind <- aulas_libro_indicadores(.cas_plan(), efectivas = .cas_efectivas())
  expect_true(is.null(ind$aplicadores) || !nrow(ind$aplicadores))
  filas <- .cas_filas(ind)
  primera <- vapply(filas, function(f) as.character(f[[1]]), character(1))
  titulo <- which(primera == "Producción por aplicador")
  expect_length(titulo, 1L)
  expect_identical(primera[[titulo + 1L]], .cali_motivo_sin_aplicadores())
  expect_match(primera[[titulo + 1L]], "todavía no hay producción por aplicador")
})
