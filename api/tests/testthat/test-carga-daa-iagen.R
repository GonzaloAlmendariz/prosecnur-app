# B8h — el traslape con la DAA (oleada libro v4,
# docs/qa/checklist-operativo-aulas-2026-08-31.md).
#
# La base «BD Muestra IAGEN (Pulso PUCP).xlsx» que entregó Gonzalo: hojas por
# facultad con filas por CURSO-HORARIO (Clave Curso + Horario numérico), SIN
# docente, y la calidad POR COLOR de celda (leyenda de la hoja «N»: blanco =
# titular, gris FFD9D9D9 = complementario). La hoja «N» es un resumen TECLEADO:
# se usa solo como CONTRASTE con aviso —lección de la hoja de validaciones
# tecleada—, jamás como fuente.
#
# Ajuste del lead (2026-09-01, dictado fresco): «lo de la DAA es algo particular
# de este año, no es algo que siempre pase». La columna TRASLAPE DAA es
# CONDICIONAL: sin cruce el bloque de agenda queda EXACTAMENTE como declara la
# spec (ni columna ni cabecera fantasma); con cruce, el bloque gana TRASLAPE
# DAA al final del contexto. La columna es DE IDA: `aulas_agendadas_a_plan`
# empareja por título contra la spec y lo desconocido se ignora, así que ningún
# lector la lee de vuelta (verificado sobre el registro de campos del lector).
#
# El fixture es SINTÉTICO (openxlsx con fills), nunca la base real en el repo.

# --- fixture: un xlsx DAA mínimo con fills ------------------------------------

# `filas`: lista por hoja de facultad; cada fila es list(clave, horario, gris).
# `n`: el resumen tecleado de la hoja «N» (facultad → cuenta), o NULL.
.daa_xlsx <- function(filas_por_hoja, n = NULL) {
  path <- withr::local_tempfile(fileext = ".xlsx", .local_envir = parent.frame())
  wb <- openxlsx::createWorkbook()
  if (!is.null(n)) {
    openxlsx::addWorksheet(wb, "N")
    openxlsx::writeData(wb, "N", n)
  }
  gris <- openxlsx::createStyle(fgFill = "#D9D9D9")
  for (hoja in names(filas_por_hoja)) {
    openxlsx::addWorksheet(wb, hoja)
    filas <- filas_por_hoja[[hoja]]
    df <- data.frame(
      `Clave Curso` = vapply(filas, function(f) f$clave, character(1)),
      Horario = vapply(filas, function(f) as.numeric(f$horario), numeric(1)),
      check.names = FALSE, stringsAsFactors = FALSE
    )
    openxlsx::writeData(wb, hoja, df)
    for (i in seq_along(filas)) {
      if (isTRUE(filas[[i]]$gris)) {
        # El gris va en TODA la fila de datos (clave y horario): así el rojo no
        # depende de en cuál celda mire el lector la leyenda de color.
        openxlsx::addStyle(wb, hoja, gris, rows = i + 1L, cols = 1:2,
                           gridExpand = TRUE, stack = TRUE)
      }
    }
  }
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

# La anatomía mínima que cubre las tres trampas medidas: cero a la izquierda
# (703.0 → «0703»), horario ya de 4 dígitos, y calidad por fill.
.daa_fixture_base <- function() list(
  `ECONOMÍA` = list(
    list(clave = "ECO101", horario = 101, gris = FALSE),
    list(clave = "MAT202", horario = 703, gris = TRUE)
  ),
  HISTORIA = list(
    list(clave = "HIS305", horario = 1015, gris = FALSE)
  )
)

.daa_n_cuadra <- function() data.frame(
  Facultad = c("ECONOMÍA", "HISTORIA"), N = c(2, 1),
  stringsAsFactors = FALSE
)

# --- el lector ----------------------------------------------------------------

test_that("B8h: carga_daa_iagen lee las hojas de facultad con clave normalizada", {
  path <- .daa_xlsx(.daa_fixture_base(), n = .daa_n_cuadra())
  res <- carga_daa_iagen(path)

  expect_s3_class(res, "data.frame")
  expect_true(all(c("clave", "calidad") %in% names(res)))
  # tolower(ClaveCurso) + "_" + horario con CERO-PAD a 4: el Horario llega
  # NUMÉRICO (101, 703.0, 1015) y sin el pad «0101»/«0703» jamás casarían con
  # un classroom_id.
  expect_setequal(res$clave, c("eco101_0101", "mat202_0703", "his305_1015"))
})

test_that("B8h: la calidad sale del COLOR de la celda, no de una columna", {
  path <- .daa_xlsx(.daa_fixture_base(), n = .daa_n_cuadra())
  res <- carga_daa_iagen(path)
  calidad <- stats::setNames(as.character(res$calidad), res$clave)
  # Leyenda de la hoja N: blanco/sin fill = titular; gris FFD9D9D9 = complementario.
  expect_identical(unname(calidad[["eco101_0101"]]), "titular")
  expect_identical(unname(calidad[["mat202_0703"]]), "complementario")
  expect_identical(unname(calidad[["his305_1015"]]), "titular")
})

test_that("B8h: la hoja «N» tecleada NO es fuente y cuadrar no deja aviso", {
  path <- .daa_xlsx(.daa_fixture_base(), n = .daa_n_cuadra())
  res <- carga_daa_iagen(path)
  # N no aporta filas: solo las 3 de las hojas de facultad.
  expect_identical(nrow(res), 3L)
  # Y cuando el resumen tecleado CUADRA con lo contado, no hay nada que avisar.
  avisos <- attr(res, "avisos", exact = TRUE) %||% character(0)
  expect_length(avisos, 0L)
})

test_that("B8h: si la hoja «N» no cuadra, el aviso dice la causa y las dos cifras", {
  # La lección de la hoja de «Validaciones» tecleada: un resumen a mano puede
  # decir OK porque alguien lo tecleó. El contraste avisa CON cifras (lo
  # contado y lo tecleado) para que el descuadre se pueda perseguir.
  n_roto <- data.frame(Facultad = c("ECONOMÍA", "HISTORIA"), N = c(5, 1),
                       stringsAsFactors = FALSE)
  path <- .daa_xlsx(.daa_fixture_base(), n = n_roto)
  res <- carga_daa_iagen(path)
  # El descuadre NO cambia lo leído: las hojas de facultad mandan.
  expect_identical(nrow(res), 3L)
  avisos <- attr(res, "avisos", exact = TRUE) %||% character(0)
  expect_gte(length(avisos), 1L)
  con_causa <- vapply(avisos, function(a) {
    grepl("ECONOM", a) && grepl("\\b5\\b", a) && grepl("\\b2\\b", a)
  }, logical(1))
  expect_true(any(con_causa),
              info = paste("avisos:", paste(avisos, collapse = " | ")))
})

test_that("B8h: sin hoja «N» el lector no se cae — el contraste es opcional", {
  path <- .daa_xlsx(.daa_fixture_base(), n = NULL)
  res <- carga_daa_iagen(path)
  expect_identical(nrow(res), 3L)
})

# --- el cruce en dos niveles, con el catálogo DTI como puente -----------------

# El DAA extendido para las precedencias: HISTORIA gana un CH complementario
# del mismo docente que dicta el titular.
.daa_fixture_cruce <- function() {
  base <- .daa_fixture_base()
  base$HISTORIA <- c(base$HISTORIA,
                     list(list(clave = "FIL222", horario = 404, gris = TRUE)))
  base
}

# El catálogo DTI (el puente): qué docente dicta cada CH del semestre.
.daa_catalogo <- function() data.frame(
  classroom_id = c("eco101_0101", "mat202_0703", "his305_1015", "fil222_0404",
                   "soc404_0505", "qui777_0999", "art123_0111"),
  teacher = c("DOC_A", "DOC_B", "DOC_C", "DOC_C", "DOC_B", "DOC_C", "DOC_Z"),
  stringsAsFactors = FALSE
)

.daa_unidad <- function(code, aula, docente) list(
  operational_code = code, titular_operational_code = code,
  sample_role = "titular", classroom_id = aula, teacher = docente,
  eligible_n = 30
)

test_that("B8h: el cruce distingue aula/docente y titular/compl., y manda el más fuerte", {
  path <- .daa_xlsx(.daa_fixture_cruce(),
                    n = data.frame(Facultad = c("ECONOMÍA", "HISTORIA"),
                                   N = c(2, 2), stringsAsFactors = FALSE))
  daa <- carga_daa_iagen(path)
  unidades <- list(
    # Nivel AULA: el classroom_id del aula muestreada está en la DAA.
    .daa_unidad("CH 1", "eco101_0101", "DOC_A"),   # aula titular
    .daa_unidad("CH 2", "mat202_0703", "DOC_B"),   # aula complementario
    # Nivel DOCENTE: el aula no está, pero su docente dicta OTRO CH de la DAA.
    .daa_unidad("CH 3", "soc404_0505", "DOC_B"),   # DOC_B dicta mat202 (compl.)
    # titular > compl. dentro del nivel docente: DOC_C dicta his305 (titular)
    # Y fil222 (compl.) — manda el titular.
    .daa_unidad("CH 4", "qui777_0999", "DOC_C"),
    # Sin traslape por ningún nivel: vacío, no un default inventado.
    .daa_unidad("CH 5", "art123_0111", "DOC_Z"),
    # aula > docente entre niveles: el aula está como COMPL. y el docente
    # dictaría un titular — manda el aula igual.
    .daa_unidad("CH 6", "mat202_0703", "DOC_C")
  )
  cruce <- aulas_daa_traslape(unidades, daa, .daa_catalogo())

  esperado <- c(
    `CH 1` = "AULA EN DAA (TITULAR)",
    `CH 2` = "AULA EN DAA (COMPL.)",
    `CH 3` = "DOCENTE EN DAA (COMPL.)",
    `CH 4` = "DOCENTE EN DAA (TITULAR)",
    `CH 5` = "",
    `CH 6` = "AULA EN DAA (COMPL.)"
  )
  for (code in names(esperado)) {
    expect_identical(unname(cruce[[code]]) %||% "", unname(esperado[[code]]),
                     info = sprintf("traslape de %s", code))
  }
})

# --- la columna condicional en la hoja del agendador --------------------------

test_that("B8h: sin cruce, el bloque de agenda NO gana columna fantasma", {
  # «No es una columna que se emplee para otros estudios»: un plan sin cruce
  # DAA produce el bloque EXACTO de la spec, mismo ancho y ninguna cabecera
  # TRASLAPE DAA en ninguna parte.
  hoja <- aulas_libro_hoja_agendadas(list(.daa_unidad("CH 1", "eco101_0101", "DOC_A")))
  cab <- as.character(unlist(hoja[1, ], use.names = FALSE))
  expect_false(any(grepl("TRASLAPE DAA", cab, fixed = TRUE)))
  expect_identical(ncol(hoja), 1L + AULAS_AGENDADAS_ANCHO_BLOQUE)
})

test_that("B8h: con cruce, cada bloque gana TRASLAPE DAA al final y con su valor", {
  reserva <- .daa_unidad("R 1.1", "soc404_0505", "DOC_B")
  reserva$titular_operational_code <- "CH 1"
  reserva$sample_role <- "chain_reserve"
  reserva$replacement_order <- 1
  unidades <- list(.daa_unidad("CH 1", "eco101_0101", "DOC_A"), reserva)

  cruce <- c(`CH 1` = "AULA EN DAA (TITULAR)",
             `R 1.1` = "DOCENTE EN DAA (COMPL.)")
  hoja <- aulas_libro_hoja_agendadas(unidades, traslape_daa = cruce)
  cab <- as.character(unlist(hoja[1, ], use.names = FALSE))

  # 21 columnas por bloque: la spec + TRASLAPE DAA cerrando el contexto, con el
  # sufijo de papel en el bloque de reemplazo como el resto de la cabecera.
  expect_identical(ncol(hoja), 1L + 2L * (AULAS_AGENDADAS_ANCHO_BLOQUE + 1L))
  titulos_bloque <- prosecnurapp:::.calg_titulos_agenda()
  expect_identical(cab[[1L + AULAS_AGENDADAS_ANCHO_BLOQUE + 1L]], "TRASLAPE DAA")
  expect_identical(cab[[length(cab)]], "TRASLAPE DAA R1")
  expect_identical(cab[1L + seq_along(titulos_bloque)], unname(titulos_bloque))

  fila <- as.character(unlist(hoja[2, ], use.names = FALSE))
  expect_identical(fila[[1L + AULAS_AGENDADAS_ANCHO_BLOQUE + 1L]],
                   "AULA EN DAA (TITULAR)")
  expect_identical(fila[[length(fila)]], "DOCENTE EN DAA (COMPL.)")
})

test_that("B8h: un aula sin valor de cruce sale con la celda vacía, no con NA", {
  cruce <- c(`CH 1` = "AULA EN DAA (TITULAR)")
  hoja <- aulas_libro_hoja_agendadas(list(
    .daa_unidad("CH 1", "eco101_0101", "DOC_A"),
    .daa_unidad("CH 2", "art123_0111", "DOC_Z")
  ), traslape_daa = cruce)
  fila_2 <- as.character(unlist(hoja[3, ], use.names = FALSE))
  expect_identical(fila_2[[1L + AULAS_AGENDADAS_ANCHO_BLOQUE + 1L]], "")
})

test_that("B8h: los lectores toleran la forma con TRASLAPE DAA (columna de ida)", {
  # El lector empareja por título contra la spec y lo desconocido se ignora:
  # una hoja con la columna extra se lee entera y TRASLAPE DAA no vuelve al
  # plan (de ida, informativa). Derivado de la spec vigente: sobrevive al
  # reorden sin tocarse.
  titulos_bloque <- unname(prosecnurapp:::.calg_titulos_agenda())
  titulos <- c("ID MATCH", titulos_bloque, "TRASLAPE DAA")
  fila <- c("1", rep("", length(titulos_bloque)), "AULA EN DAA (TITULAR)")
  fila[[1L + which(titulos_bloque == "CURSO-HORARIO")[[1]]]] <- "CH 9"
  fila[[1L + which(titulos_bloque == "NOMBRE DE DOCENTE")[[1]]]] <- "Docente X"
  df <- as.data.frame(rbind(fila), stringsAsFactors = FALSE)

  filas <- aulas_agendadas_a_plan(df, titulos = titulos)
  expect_length(filas, 1L)
  expect_identical(filas[[1]]$operational_code, "CH 9")
  expect_identical(filas[[1]]$teacher, "Docente X")
  # De ida: ningún campo del plan recibe el traslape.
  expect_false(any(vapply(filas[[1]], function(v)
    identical(as.character(v), "AULA EN DAA (TITULAR)"), logical(1))))
  # Y la columna extra no dispara «campos ausentes»: no es un campo del bloque.
  expect_length(attr(filas, "campos_ausentes", exact = TRUE) %||% character(0), 0L)
})
