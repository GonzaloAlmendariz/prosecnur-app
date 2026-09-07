# El puente plataforma/parte de la hoja «Avance de campo» — B7.3 (choque 5 del
# censo `docs/qa/censo-cuatro-cifras-2026-09-01.md`).
#
# En la hoja conviven dos familias de cifras con casi el mismo nombre:
#   · «Efectivas conseguidas» / «Efectivas del dia» — cifra de PLATAFORMA;
#   · «Efectivas declaradas» (produccion por aplicador) — cifra del PARTE.
# El puente que las distingue («Estas cifras salen de la plataforma, no del
# parte de campo…») hoy solo se escribe dentro de `if (sin_dato)`
# (carga_aulas_libro_indicadores.R:296, carga_aulas_libro_avance.R:125): cuando
# faltan los datos la hoja explica la distincion, y cuando AMBAS cifras estan
# presentes —que es cuando de verdad chocan; el comentario de indicadores.R:291
# describe ese caso exacto y lo deja sin cubrir— no dice nada.
#
# Contrato congelado por el lead (B7.3):
#   1. hoja con plataforma Y partes → el puente aparece y nombra las dos
#      fuentes (hoy: ausente → ROJO); con datos, el texto se adapta —dice que
#      la meta/el diario salen de la plataforma y la produccion por aplicador
#      del parte, y que por eso pueden no cuadrar— y NO repite la causal del
#      caso vacio («se llenan al cargar…»), que con la base cargada seria falsa;
#   2. hoja sin datos de plataforma → el motivo actual se conserva (verde hoy);
#   3. xlsx y Sheets escriben el MISMO puente (equivalencia capa contra capa);
#   4. registro academico, una o dos celdas, sin parafrasear titulos.
#
# El puente se detecta por SEMANTICA, no por posicion ni por texto exacto: una
# celda que nombra las dos fuentes («plataforma» y «parte») a la vez. Una nota
# partida de modo que ninguna celda nombre ambas no es un puente: quien lee una
# celda suelta no ve el enlace. Asi el rojo cae por el puente ausente y no por
# una fila que se corrio, y el writer conserva la libertad de redaccion que el
# contrato le deja.

# --- fixtures ----------------------------------------------------------------

# Calca del plan de test-carga-aulas-libro-indicadores.R: dos titulares con
# meta 20 (meta_total 40) y una reserva que no suma meta propia.
.pnt_plan <- function() list(
  list(operational_code = "CH 1", sample_role = "titular", faculty = "Letras",
       eligible_n = 30, expected_valid = 20),
  list(operational_code = "CH 2", sample_role = "titular", faculty = "Letras",
       eligible_n = 30, expected_valid = 20),
  list(operational_code = "R 2.1", sample_role = "chain_reserve",
       titular_operational_code = "CH 2", faculty = "Letras",
       eligible_n = 28, expected_valid = 20)
)

.pnt_respuestas <- function() data.frame(
  `_submission_time` = c("2026-08-10T09:00:00", "2026-08-10T10:00:00",
                         "2026-08-11T09:00:00", "2026-08-11T11:00:00",
                         "2026-08-11T12:00:00"),
  sexo = c("Mujer", "Hombre", "Mujer", "Hombre", "Prefiero no decir"),
  check.names = FALSE, stringsAsFactors = FALSE
)

.pnt_partes <- function() list(
  list(operational_code = "CH 1", applied_by = "Equipo A", effective_surveys = 20),
  list(operational_code = "CH 2", applied_by = "Equipo B", effective_surveys = 8),
  list(operational_code = "R 2.1", applied_by = "Equipo B", effective_surveys = 6)
)

# El caso del choque: las DOS familias presentes. Plataforma (efectivas 30,
# diario con dos dias) Y partes (34 «efectivas declaradas» por aplicador).
.pnt_modelo_completo <- function() aulas_libro_indicadores(
  .pnt_plan(),
  efectivas = c(`CH 1` = 18, `CH 2` = 12),
  responses = .pnt_respuestas(),
  validas = c(TRUE, TRUE, TRUE, TRUE, FALSE),
  partes = .pnt_partes()
)

# El caso vacio que hoy SI tiene puente: partes declarados, plataforma sin
# leer. Es la geometria del comentario de indicadores.R:291 —«—» arriba y
# efectivas declaradas abajo— y su motivo actual se conserva (pin 2).
.pnt_modelo_sin_plataforma <- function() aulas_libro_indicadores(
  .pnt_plan(),
  efectivas = NULL,
  partes = .pnt_partes()
)

# --- lectura de celdas -------------------------------------------------------

# La hoja del xlsx, aplanada a celdas de texto. El contrato vive en la CELDA
# escrita, no en el modelo; `skipEmptyRows = FALSE` es la trampa conocida de
# `read.xlsx` (los indices no se usan aqui, pero la lectura queda completa).
.pnt_celdas_xlsx <- function(ind) {
  libro <- withr::local_tempfile(fileext = ".xlsx", .local_envir = parent.frame())
  wb <- openxlsx::createWorkbook()
  aulas_libro_escribir_indicadores(wb, ind)
  openxlsx::saveWorkbook(wb, libro, overwrite = TRUE)
  d <- suppressWarnings(openxlsx::read.xlsx(libro, sheet = "Avance de campo",
                                            colNames = FALSE, skipEmptyRows = FALSE))
  v <- trimws(as.character(unlist(lapply(d, as.character), use.names = FALSE)))
  v[!is.na(v) & nzchar(v)]
}

# La misma hoja por el camino de Sheets. La fecha se inyecta: el determinismo
# del renderer ya esta pineado en test-carga-aulas-libro-avance-sheets.R.
.pnt_celdas_sheets <- function(ind) {
  hoja <- aulas_libro_hoja_avance(ind, fecha = as.Date("2026-08-15"))
  v <- trimws(as.character(unlist(hoja, use.names = FALSE)))
  v[!is.na(v) & nzchar(v)]
}

# Una celda es puente si nombra las DOS fuentes. `\\bparte` y no `parte`: el
# «reparte el aforo» de la nota de sobremuestra no es un puente.
.pnt_puentes <- function(celdas) {
  celdas[grepl("plataforma", celdas, ignore.case = TRUE) &
           grepl("\\bparte", celdas, ignore.case = TRUE)]
}

# --- pin 1: con las dos familias, el puente aparece (ROJO hoy) ---------------

test_that("B7.3: con plataforma Y partes, la hoja xlsx escribe el puente que nombra las dos fuentes", {
  celdas <- .pnt_celdas_xlsx(.pnt_modelo_completo())

  # Autocontrol del fixture (un sin-hallazgos vale lo que el fixture): las dos
  # familias estan DE VERDAD en la hoja y no hay huecos que disparen el
  # `if (sin_dato)` actual. Si esto cae, el rojo de abajo no mide el choque.
  expect_true("Efectivas conseguidas" %in% celdas)
  expect_true("Encuestas aplicadas (parte)" %in% celdas)
  expect_false(any(celdas == "—"))

  puentes <- .pnt_puentes(celdas)
  expect_true(
    length(puentes) >= 1L,
    info = paste(
      "la hoja tiene «Efectivas conseguidas» (plataforma) y «Efectivas",
      "declaradas» (parte) y ninguna celda nombra las dos fuentes: quien lee",
      "elige cual creer — el puente solo existe dentro de if (sin_dato)"
    )
  )
  # Una o dos celdas (contrato del lead): mas es sobreexplicar.
  expect_true(length(puentes) <= 2L,
              info = paste("el puente ocupa", length(puentes), "celdas"))
  # Y adaptado al caso: con la base cargada, la causal del caso vacio miente.
  expect_false(any(grepl("se llenan al cargar", puentes, fixed = TRUE)),
               info = "con datos presentes el puente repite la causal de sin_dato")
})

test_that("B7.3: con plataforma Y partes, la pestaña de Sheets escribe el mismo tipo de puente", {
  celdas <- .pnt_celdas_sheets(.pnt_modelo_completo())

  expect_true("Efectivas conseguidas" %in% celdas)
  expect_true("Encuestas aplicadas (parte)" %in% celdas)
  expect_false(any(celdas == "—"))

  puentes <- .pnt_puentes(celdas)
  expect_true(
    length(puentes) >= 1L,
    info = paste(
      "la pestaña publicada lleva las dos familias de «efectivas» sin ninguna",
      "celda que nombre plataforma y parte — el puente solo existe dentro de",
      "if (sin_dato) (carga_aulas_libro_avance.R:125)"
    )
  )
  expect_true(length(puentes) <= 2L,
              info = paste("el puente ocupa", length(puentes), "celdas"))
  expect_false(any(grepl("se llenan al cargar", puentes, fixed = TRUE)),
               info = "con datos presentes el puente repite la causal de sin_dato")
})

# --- pin 3: xlsx y Sheets dicen lo MISMO (ROJO hoy: ninguno lo dice) ---------

test_that("B7.3: xlsx y Sheets escriben el MISMO puente — la equivalencia capa contra capa lo cubre", {
  # El lazo entre los dos caminos ya esta pineado para las cifras
  # (test-carga-aulas-libro-avance-sheets.R); esto lo extiende al puente: el
  # equipo que descarga el xlsx y el que mira la pestaña no pueden recibir dos
  # explicaciones distintas de por que sus «efectivas» no cuadran.
  ind <- .pnt_modelo_completo()
  px <- .pnt_puentes(.pnt_celdas_xlsx(ind))
  ps <- .pnt_puentes(.pnt_celdas_sheets(ind))
  expect_true(length(px) >= 1L, info = "el xlsx no escribe puente con las dos familias presentes")
  expect_true(length(ps) >= 1L, info = "la pestaña de Sheets no escribe puente con las dos familias presentes")
  # La comparacion solo significa algo cuando ambos existen; sin el guard, dos
  # vacios darian un identical(character(0), character(0)) verde por ausencia.
  if (length(px) && length(ps)) {
    expect_identical(sort(px), sort(ps),
                     info = "los dos caminos explican la diferencia con textos distintos")
  }
})

# --- pin 2: sin datos de plataforma, el motivo actual se conserva (verde hoy) --

test_that("B7.3 pin de conservacion: sin datos de plataforma, el motivo actual se queda en los dos caminos", {
  # El caso vacio ya esta bien servido y no debe moverse: «—» en el bloque de
  # meta, «Efectivas declaradas» mas abajo, y UNA celda que dice de donde
  # saldrian las cifras y por que aun no estan. Un arreglo que reescriba este
  # texto o lo duplique cambia un verde que hoy significa algo.
  ind <- .pnt_modelo_sin_plataforma()
  for (celdas in list(.pnt_celdas_xlsx(ind), .pnt_celdas_sheets(ind))) {
    expect_true("Encuestas aplicadas (parte)" %in% celdas)
    expect_true(any(celdas == "—"))
    puentes <- .pnt_puentes(celdas)
    expect_length(puentes, 1L)
    expect_true(any(grepl("se llenan al cargar la base de respuestas", puentes, fixed = TRUE)),
                info = paste("el motivo del caso vacio cambio:", paste(puentes, collapse = " | ")))
  }
})
