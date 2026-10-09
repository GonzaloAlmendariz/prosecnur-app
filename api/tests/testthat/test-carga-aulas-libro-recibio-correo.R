# «RECIBIÓ CORREO» para reemplazos y aulas extra — B22 del checklist del
# operativo (docs/qa/checklist-operativo-aulas-2026-08-31.md).
#
# Dictado de Gonzalo (2026-09-01, textual): «En el caso de todos los reemplazos
# y aulas extra se necesita una columna que esté a la izquierda de la columna
# del status, que es si ya recibió el correo electrónico. Puede ser algo como
# "RECIBIÓ CORREO" con sí y no y por defecto no. Porque a ellos se les va a
# enviar un correo y al día siguiente llamar en función de los que necesitemos.
# En cambio a los titulares se les llama a todos hoy».
#
# DECISIÓN DEL LEAD (cerrada): la columna entra a `AULAS_AGENDADAS_BLOQUE`
# (spec única, TODOS los bloques uniformes — arrastre/formato/validaciones la
# heredan solos) ENTRE «NÚMERO DE INTENTOS» y «STATUS MUESTRA»; sembrada «No»
# en los bloques R1+ y en las dos hojas Extra de B14, VACÍA en el bloque
# titular (no aplica: a los titulares se les llama hoy — el vacío es contenido,
# no un default inventado); desplegable con exactamente {Sí, No} (xlsx y
# Sheets).
#
# Contrato por punto (rojo salvo el contexto):
#   0. VERDE-CONTEXTO — los vecinos reales y la aritmética por título,
#      verificados contra la hoja que producen los generadores HOY: si un
#      generador cambia de forma, los rojos de abajo pasarían a significar
#      «conté mal» y esto los separa.
#   1. ROJO — la spec declara «RECIBIÓ CORREO» inmediatamente después de
#      `contact_attempts` («NÚMERO DE INTENTOS») e inmediatamente antes de
#      `sample_status` («STATUS MUESTRA»).
#   2. ROJO — la hoja de agendadas (profundidad 3) siembra «No» en los bloques
#      R1+ por unidad PRESENTE, deja "" el bloque titular y "" el eslabón
#      ausente; y la aritmética funciona igual CON la columna condicional
#      «TRASLAPE DAA» (B8h) activa.
#   3. ROJO — un valor ya registrado en el plan se DEVUELVE («se devuelve lo
#      que ya esté registrado», la doctrina del generador): la siembra no pisa
#      un «Sí».
#   4. ROJO — las dos hojas Extra de B14 llevan la columna sembrada «No».
#   5. ROJO — desplegable con exactamente {Sí, No}: en el xlsx (lista en
#      «Listas» con el nombre EXACTO de la columna, validación por bloque y en
#      la hoja Extra) y en los requests de Sheets (por bloque, con y sin DAA,
#      y en la pestaña Extra).
#   6. ROJO — roundtrip del lector: un «Sí» tecleado en R1 vuelve al plan bajo
#      el campo de la spec, la siembra «No» roundtripea, el titular vuelve
#      vacío y los vecinos del bloque no se descuadran.
#   7. ROJO — la fusión con el plan de sesión deja pasar el campo
#      (`AULAS_LIBRO_CAMPOS_PROPIOS` es una lista cerrada: fuera de ella, el
#      «Sí» tecleado se leería y moriría en silencio camino al plan — y «al
#      día siguiente llamar en función de los que necesitemos» exige que la
#      app pueda leerlo).
#
# DECISIONES DECLARADAS AL WRITER (pineadas aquí):
#   - El campo ES de vuelta, no solo de ida: el dictado dice que la llamada
#     del día siguiente se decide «en función de los que necesitemos», y esa
#     decisión se toma en la app leyendo el libro. El nombre del campo lo
#     decide el writer: estos tests lo resuelven DESDE LA SPEC por el título
#     «RECIBIÓ CORREO» y solo pinean que el lector/fusión lo devuelven bajo
#     ese mismo nombre canónico (sugerencia: `email_received`, en el idioma de
#     `teacher_email`/`contact_medium`).
#   - El desplegable {Sí, No} se pinea UNIFORME en todos los bloques, titular
#     incluido: el dictado lo exige para reemplazos y extras, y la decisión
#     del lead («todos los bloques uniformes — las validaciones la heredan
#     solos») hace del titular un heredero natural; su celda va vacía y la
#     validación de la casa ya es allowBlank/strict = FALSE, así que el chip
#     en el titular no obliga a nada.
#   - La siembra se observa por ROL en cadenas normales (titular en bloque 1).
#     El caso degenerado —cadena sin titular en el plan, donde el bloque 1 lo
#     ocupa una reserva— NO se pinea: rol y posición divergen ahí y esa
#     decisión es del writer.
#
# Sin red, sin mocks: todos los puntos se fijan sobre los constructores puros
# (`aulas_libro_hoja_agendadas`, los generadores de extras, los builders de
# requests de Sheets) y sobre el xlsx real de `aulas_libro_generar`. La
# plomería publicador→builders ya la pinea test-carga-aulas-libro-daa-plomeria.R
# y no se re-pinea aquí.

# --- geometría derivada de la spec, por TÍTULO ---------------------------------

.rc_TITULO <- "RECIBIÓ CORREO"

.rc_idx_campo <- function(campo) {
  which(vapply(AULAS_AGENDADAS_BLOQUE,
               function(s) identical(s$campo, campo), logical(1)))[[1]]
}

# El índice de «RECIBIÓ CORREO» en la spec, localizado por su TÍTULO primario —
# nunca por nombre de campo (lo decide el writer) ni por posición literal.
.rc_idx <- function() {
  which(vapply(AULAS_AGENDADAS_BLOQUE,
               function(s) identical(s$titulos[[1]], .rc_TITULO), logical(1)))
}

.rc_campo <- function() AULAS_AGENDADAS_BLOQUE[[.rc_idx()[[1]]]]$campo

# Guarda de rojo: sin la columna en la spec, cada test falla AQUÍ con el
# contrato en el mensaje en vez de morir en un subscript out of bounds.
.rc_spec_ok <- function(punto) {
  if (length(.rc_idx()) == 1L) return(TRUE)
  fail(sprintf(
    paste0("B22 (%s): la spec AULAS_AGENDADAS_BLOQUE no declara la columna ",
           "«%s» — el dictado la exige entre «NÚMERO DE INTENTOS» y ",
           "«STATUS MUESTRA» para marcar a qué reemplazos/extras ya se les ",
           "envió el correo."), punto, .rc_TITULO))
  FALSE
}

# Ancho del bloque de agendadas, con la condicional «TRASLAPE DAA» si aplica.
.rc_ancho <- function(con_daa = FALSE) {
  AULAS_AGENDADAS_ANCHO_BLOQUE + as.integer(isTRUE(con_daa))
}
# Columna (1-based) del índice `idx` de la spec en el bloque `b` de la hoja.
.rc_col <- function(idx, b, con_daa = FALSE) {
  1L + (b - 1L) * .rc_ancho(con_daa) + idx
}

.rc_fila <- function(hoja, i) as.character(unlist(hoja[i, ], use.names = FALSE))

# Una celda leída de un xlsx real: readxl devuelve NA donde la app escribió "".
.rc_norm <- function(v) {
  v <- as.character(v)[1]
  if (is.na(v)) "" else v
}

# --- fixture: dos cadenas (profundidad 3 y 2) + banco de extras ----------------

.rc_plan <- function() list(
  list(operational_code = "CH 1", titular_operational_code = "CH 1",
       sample_role = "titular", faculty = "Letras y Ciencias Humanas",
       course_name = "CURSO UNO", teacher = "Docente CH 1",
       teacher_phone = "999111222", contact_attempts = 2,
       sample_status = "agendada", eligible_n = 40, link = "https://x.test/CH1"),
  list(operational_code = "R 1.1", titular_operational_code = "CH 1",
       sample_role = "chain_reserve", replacement_order = 1,
       faculty = "Letras y Ciencias Humanas", course_name = "CURSO DE RESERVA",
       teacher = "Docente R 1.1", contact_attempts = 4,
       eligible_n = 30, link = "https://x.test/R11"),
  list(operational_code = "R 1.2", titular_operational_code = "CH 1",
       sample_role = "chain_reserve", replacement_order = 2,
       faculty = "Letras y Ciencias Humanas", course_name = "OTRA RESERVA",
       teacher = "Docente R 1.2", eligible_n = 28, link = "https://x.test/R12"),
  list(operational_code = "CH 2", titular_operational_code = "CH 2",
       sample_role = "titular", faculty = "Ciencias Sociales",
       course_name = "CURSO DOS", teacher = "Docente CH 2",
       teacher_phone = "988777666", sample_status = "agendada",
       eligible_n = 25, link = "https://x.test/CH2"),
  list(operational_code = "R 2.1", titular_operational_code = "CH 2",
       sample_role = "chain_reserve", replacement_order = 1,
       faculty = "Ciencias Sociales", course_name = "TERCERA RESERVA",
       teacher = "Docente R 2.1", eligible_n = 22, link = "https://x.test/R21")
)

.rc_extras <- function() list(
  list(operational_code = "EXTRA 2", titular_operational_code = "",
       sample_role = "extra_reserve_pool", faculty = "Ciencias Sociales",
       course_name = "CURSO EXTRA DOS", teacher = "Docente E2",
       eligible_n = 18, link = "https://x.test/E2"),
  list(operational_code = "EXTRA 1", titular_operational_code = "",
       sample_role = "extra_reserve_pool", faculty = "Arte y Diseno",
       course_name = "CURSO EXTRA UNO", teacher = "Docente E1",
       eligible_n = 15, link = "https://x.test/E1")
)

# --- 0. VERDE-CONTEXTO: vecinos reales y aritmética, verificados ---------------

test_that("contexto B22: los vecinos reales de la spec y la aritmética por título, verificados", {
  # Los nombres REALES, no adivinados: el campo de intentos se titula «NÚMERO
  # DE INTENTOS» y el del status «STATUS MUESTRA». Si alguno se renombra, los
  # rojos de abajo cambiarían de significado y esto lo delata primero.
  expect_identical(
    AULAS_AGENDADAS_BLOQUE[[.rc_idx_campo("contact_attempts")]]$titulos[[1]],
    "NÚMERO DE INTENTOS")
  expect_identical(
    AULAS_AGENDADAS_BLOQUE[[.rc_idx_campo("sample_status")]]$titulos[[1]],
    "STATUS MUESTRA")

  # La aritmética `1 + (b-1)*ancho + idx` casa con la hoja REAL que producen
  # los generadores, hoy y después del ensanche (nada de letras ni índices
  # literales: la spec crece y estas mismas líneas recomputan).
  hoja <- aulas_libro_hoja_agendadas(.rc_plan())
  cab <- .rc_fila(hoja, 1L)
  expect_identical(length(cab), 1L + 3L * .rc_ancho())
  expect_identical(cab[[.rc_col(.rc_idx_campo("operational_code"), 1L)]],
                   "CURSO-HORARIO")
  expect_identical(cab[[.rc_col(.rc_idx_campo("contact_attempts"), 2L)]],
                   "NÚMERO DE INTENTOS R1")
  expect_identical(cab[[.rc_col(.rc_idx_campo("sample_status"), 3L)]],
                   "STATUS MUESTRA R2")

  # Y con la condicional del cruce DAA el paso crece en 1 (B8h): la misma
  # aritmética con `con_daa = TRUE`.
  con_daa <- aulas_libro_hoja_agendadas(
    .rc_plan(), traslape_daa = c("CH 1" = "AULA EN DAA (TITULAR)"))
  cab_daa <- .rc_fila(con_daa, 1L)
  expect_identical(length(cab_daa), 1L + 3L * .rc_ancho(TRUE))
  expect_identical(cab_daa[[.rc_col(.rc_idx_campo("operational_code"), 2L, TRUE)]],
                   "CURSO-HORARIO R1")
  expect_identical(cab_daa[[1L + .rc_ancho(TRUE)]], "TRASLAPE DAA")
})

# --- 1. ROJO: la spec declara la columna entre INTENTOS y STATUS ---------------

test_that("B22: la spec declara «RECIBIÓ CORREO» entre NÚMERO DE INTENTOS y STATUS MUESTRA", {
  if (!.rc_spec_ok("spec")) return(invisible(NULL))
  idx <- .rc_idx()[[1]]
  # El dictado B22 textual es «a la izquierda de la columna del status»: el pin
  # duro es pegado a STATUS MUESTRA. Después de los intentos basta con DESPUÉS
  # (no inmediatamente): B23 metió «STATUS DE LLAMADA» en medio del clúster de
  # la llamada, y ese orden lo pinea contrato-v4 — relajado a conciencia
  # 2026-09-01.
  expect_gt(idx, .rc_idx_campo("contact_attempts"))
  expect_identical(idx, .rc_idx_campo("sample_status") - 1L,
                   info = "«RECIBIÓ CORREO» no va inmediatamente antes de STATUS MUESTRA")
  # El ancho derivado la cuenta: no hay una segunda lista que actualizar.
  expect_identical(AULAS_AGENDADAS_ANCHO_BLOQUE, length(AULAS_AGENDADAS_BLOQUE))
})

# --- 2. ROJO: siembra en la hoja de agendadas (con y sin DAA) ------------------

test_that("B22: la hoja de agendadas siembra «No» en R1+ y deja VACÍO el bloque titular", {
  if (!.rc_spec_ok("siembra en agendadas")) return(invisible(NULL))
  idx <- .rc_idx()[[1]]
  hoja <- aulas_libro_hoja_agendadas(.rc_plan())
  cab <- .rc_fila(hoja, 1L)
  expect_identical(cab[[.rc_col(idx, 1L)]], .rc_TITULO)
  expect_identical(cab[[.rc_col(idx, 2L)]], paste(.rc_TITULO, "R1"))
  expect_identical(cab[[.rc_col(idx, 3L)]], paste(.rc_TITULO, "R2"))

  f_ch1 <- .rc_fila(hoja, 2L)
  f_ch2 <- .rc_fila(hoja, 3L)
  # Titular: vacío ES el contenido («a los titulares se les llama a todos
  # hoy») — un «No» aquí hablaría con la voz de un dato que no existe.
  expect_identical(f_ch1[[.rc_col(idx, 1L)]], "")
  expect_identical(f_ch2[[.rc_col(idx, 1L)]], "")
  # TODOS los reemplazos presentes arrancan en «No» (el default del dictado).
  expect_identical(f_ch1[[.rc_col(idx, 2L)]], "No")
  expect_identical(f_ch1[[.rc_col(idx, 3L)]], "No")
  expect_identical(f_ch2[[.rc_col(idx, 2L)]], "No")
  # Eslabón AUSENTE (la cadena de CH 2 no tiene R2): "" — sembrar «No» en un
  # bloque sin aula inventaría una fila fantasma al releer.
  expect_identical(f_ch2[[.rc_col(idx, 3L)]], "")

  # Guardia de vecinos: los valores del bloque R1 siguen bajo SU título
  # (derivado por nombre — el ensanche no puede correr a nadie).
  expect_identical(f_ch1[[.rc_col(.rc_idx_campo("contact_attempts"), 2L)]], "4")
  expect_identical(f_ch1[[.rc_col(.rc_idx_campo("eligible_n"), 2L)]], "30")
  expect_identical(f_ch1[[.rc_col(.rc_idx_campo("link"), 2L)]], "https://x.test/R11")

  # Y la misma siembra con la condicional «TRASLAPE DAA» activa: la columna
  # nueva no es la última del bloque, así que las dos conviven por aritmética.
  con_daa <- aulas_libro_hoja_agendadas(
    .rc_plan(), traslape_daa = c("CH 1" = "AULA EN DAA (TITULAR)"))
  cab_daa <- .rc_fila(con_daa, 1L)
  f_daa <- .rc_fila(con_daa, 2L)
  expect_identical(cab_daa[[.rc_col(idx, 2L, TRUE)]], paste(.rc_TITULO, "R1"))
  expect_identical(f_daa[[.rc_col(idx, 1L, TRUE)]], "")
  expect_identical(f_daa[[.rc_col(idx, 2L, TRUE)]], "No")
  expect_identical(f_daa[[.rc_col(idx, 3L, TRUE)]], "No")
})

# --- 3. ROJO: la siembra no pisa lo registrado ---------------------------------

test_that("B22: un valor ya registrado se DEVUELVE — la siembra no pisa un «Sí»", {
  if (!.rc_spec_ok("eco de lo registrado")) return(invisible(NULL))
  idx <- .rc_idx()[[1]]
  campo <- .rc_campo()
  plan <- .rc_plan()
  # El operativo ya marcó que R 1.1 recibió su correo; regenerar el libro no
  # puede devolverlo a «No» — la regla de todo el bloque de agenda («escribir
  # vacío siempre borraba el operativo en curso»).
  plan[[2]][[campo]] <- "Sí"
  hoja <- aulas_libro_hoja_agendadas(plan)
  f_ch1 <- .rc_fila(hoja, 2L)
  expect_identical(f_ch1[[.rc_col(idx, 2L)]], "Sí",
                   info = sprintf("el generador no lee `%s` de la unidad: re-siembra el default", campo))
  # Los demás reemplazos conservan su default.
  expect_identical(f_ch1[[.rc_col(idx, 3L)]], "No")
})

# --- 4. ROJO: las dos hojas Extra de B14 ---------------------------------------

test_that("B22: las dos hojas Extra llevan la columna sembrada «No»", {
  if (!.rc_spec_ok("hojas Extra")) return(invisible(NULL))
  idx <- .rc_idx()[[1]]
  banco <- aulas_libro_extras_banco(c(.rc_plan(), .rc_extras()))
  expect_length(banco, 2L)

  # «Aulas Agendadas (Extra)»: bloque único — ID MATCH + spec, sin sufijo.
  ag <- aulas_libro_hoja_agendadas_extra(banco)
  cab <- .rc_fila(ag, 1L)
  expect_identical(cab[[1L + idx]], .rc_TITULO)
  for (i in 2:3) {
    expect_identical(.rc_fila(ag, i)[[1L + idx]], "No",
                     info = sprintf("agendadas (Extra), fila %d sin sembrar", i))
  }

  # «Aulas Aplicadas (Extra)»: banda + fila de campos + datos; la agenda que
  # repite sale del MISMO despachador, así que hereda la siembra.
  ap <- aulas_libro_hoja_aplicadas_extra(banco)
  campos_fila <- .rc_fila(ap, 2L)
  expect_identical(campos_fila[[1L + idx]], .rc_TITULO)
  for (i in 3:4) {
    expect_identical(.rc_fila(ap, i)[[1L + idx]], "No",
                     info = sprintf("aplicadas (Extra), fila %d sin sembrar", i))
  }
})

# --- 5. ROJO: desplegable {Sí, No} en el xlsx y en Sheets ----------------------

test_that("B22: el xlsx trae la lista {Sí, No} en «Listas» y la validación por bloque y en la Extra", {
  if (!.rc_spec_ok("desplegable xlsx")) return(invisible(NULL))
  idx <- .rc_idx()[[1]]
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(c(.rc_plan(), .rc_extras()), libro)

  # La lista vive en «Listas» con el nombre EXACTO de su columna («cada lista
  # se llama exactamente como su columna») y trae exactamente Sí y No.
  listas <- suppressMessages(openxlsx::read.xlsx(
    libro, sheet = "Listas", colNames = FALSE,
    skipEmptyRows = FALSE, skipEmptyCols = FALSE))
  titulos_listas <- as.character(unlist(listas[1, ], use.names = FALSE))
  col_lista <- which(titulos_listas == .rc_TITULO)
  expect_length(col_lista, 1L)
  if (length(col_lista) != 1L) return(invisible(NULL))
  valores <- as.character(listas[-1, col_lista[[1]]])
  valores <- valores[!is.na(valores) & nzchar(valores)]
  expect_identical(valores, c("Sí", "No"))

  # La validación de CADA bloque apunta a ESA lista (rango derivado de la
  # posición real de la lista, formato de `.calf_rango`).
  letra_lista <- openxlsx::int2col(col_lista[[1]])
  rango_esperado <- sprintf("'Listas'!$%s$2:$%s$3", letra_lista, letra_lista)
  v <- validaciones_de(libro, "Aulas Agendadas")
  for (b in 1:3) {
    letra <- openxlsx::int2col(.rc_col(idx, b))
    hay <- v$formula == rango_esperado & grepl(sprintf("^%s[0-9]", letra), v$sqref)
    expect_true(any(hay),
                info = sprintf("sin desplegable {Sí, No} en el bloque %d (columna %s)", b, letra))
  }

  # La hoja Extra también lo hereda, a la geometría del bloque único.
  vx <- validaciones_de(libro, AULAS_LIBRO_HOJA_AGENDADAS_EXTRA)
  letra_x <- openxlsx::int2col(1L + idx)
  expect_true(
    any(vx$formula == rango_esperado & grepl(sprintf("^%s[0-9]", letra_x), vx$sqref)),
    info = sprintf("sin desplegable {Sí, No} en la hoja Extra (columna %s)", letra_x))

  # Y las celdas del libro REAL salen sembradas: titular vacío, R1 «No»,
  # extras «No» (readxl devuelve NA donde la app escribió "").
  hoja <- readxl::read_excel(libro, sheet = "Aulas Agendadas",
                             col_names = FALSE, .name_repair = "minimal")
  expect_identical(.rc_norm(hoja[2, .rc_col(idx, 1L)]), "")
  expect_identical(.rc_norm(hoja[2, .rc_col(idx, 2L)]), "No")
  extra <- readxl::read_excel(libro, sheet = AULAS_LIBRO_HOJA_AGENDADAS_EXTRA,
                              col_names = FALSE, .name_repair = "minimal")
  expect_identical(.rc_norm(extra[2, 1L + idx]), "No")
})

test_that("B22: los setDataValidation de Sheets llevan {Sí, No} por bloque, con y sin DAA, y en la pestaña Extra", {
  if (!.rc_spec_ok("desplegable Sheets")) return(invisible(NULL))
  idx <- .rc_idx()[[1]]

  # Lector de requests: valores del ONE_OF_LIST + columna 0-based. Acceso por
  # `[[` — el `$` parcial-matchea.
  extraer <- function(reqs) {
    Filter(Negate(is.null), lapply(reqs, function(r) {
      sdv <- r[["setDataValidation"]]
      if (is.null(sdv)) return(NULL)
      cond <- (sdv[["rule"]] %||% list())[["condition"]] %||% list()
      if (!identical(as.character(cond[["type"]] %||% ""), "ONE_OF_LIST")) return(NULL)
      list(
        valores = vapply(cond[["values"]] %||% list(), function(v) {
          as.character(v[["userEnteredValue"]] %||% "")
        }, character(1)),
        col_desde = suppressWarnings(
          as.integer((sdv[["range"]] %||% list())[["startColumnIndex"]] %||% NA_integer_))[1]
      )
    }))
  }
  solo_si_no <- function(vals) Filter(function(v) {
    length(v$valores) == 2L && setequal(v$valores, c("Sí", "No"))
  }, vals)

  # La hoja principal, a profundidad 3, en las dos geometrías (B8h): el juego
  # completo de columnas de la spec, uniforme en todos los bloques (decisión
  # declarada en la cabecera).
  for (con_daa in c(FALSE, TRUE)) {
    reqs <- monitoreo_aulas_sheets_validaciones_requests(
      "Aulas Agendadas", 7L, n_filas = 6L, profundidad = 3L, con_daa = con_daa)
    cols <- sort(vapply(solo_si_no(extraer(reqs)), function(v) v$col_desde, integer(1)))
    esperadas <- sort(vapply(1:3, function(b) .rc_col(idx, b, con_daa) - 1L, integer(1)))
    expect_identical(
      cols, esperadas,
      info = sprintf("startColumnIndex {Sí, No} con con_daa=%s: %s (esperaba %s)",
                     con_daa, paste(cols, collapse = ", "),
                     paste(esperadas, collapse = ", ")))
  }

  # La pestaña «Aulas Agendadas (Extra)», a su bloque único.
  filas <- rep(list(list("x")), 4L)
  reqs_x <- aulas_libro_extras_sheets_requests(11L, AULAS_LIBRO_HOJA_AGENDADAS_EXTRA, filas)
  cols_x <- vapply(solo_si_no(extraer(reqs_x)), function(v) v$col_desde, integer(1))
  expect_identical(cols_x, .rc_col(idx, 1L) - 1L,
                   info = sprintf("startColumnIndex {Sí, No} en la Extra: %s",
                                  paste(cols_x, collapse = ", ")))
})

# --- 6. ROJO: roundtrip del lector ---------------------------------------------

test_that("B22: un «Sí» tecleado en R1 vuelve al plan bajo el campo de la spec", {
  if (!.rc_spec_ok("roundtrip del lector")) return(invisible(NULL))
  idx <- .rc_idx()[[1]]
  campo <- .rc_campo()

  hoja <- aulas_libro_hoja_agendadas(.rc_plan())
  titulos <- .rc_fila(hoja, 1L)
  cuerpo <- as.data.frame(hoja[-1, , drop = FALSE], stringsAsFactors = FALSE)
  # El equipo marca que R 1.1 ya recibió su correo — en la columna localizada
  # por título, nunca por letra.
  cuerpo[1, .rc_col(idx, 2L)] <- "Sí"

  filas <- aulas_agendadas_a_plan(cuerpo, titulos = titulos)
  codigos <- vapply(filas, function(u) as.character(u$operational_code %||% ""), character(1))
  expect_setequal(codigos, c("CH 1", "R 1.1", "R 1.2", "CH 2", "R 2.1"))
  de <- function(cod) filas[[which(codigos == cod)[[1]]]]

  # El tecleado vuelve bajo el campo canónico de la spec…
  expect_identical(as.character(de("R 1.1")[[campo]] %||% ""), "Sí",
                   info = sprintf("el lector no emite `%s`: el «Sí» muere camino al plan", campo))
  # …la siembra roundtripea…
  expect_identical(as.character(de("R 1.2")[[campo]] %||% ""), "No")
  expect_identical(as.character(de("R 2.1")[[campo]] %||% ""), "No")
  # …y el titular vuelve vacío (no aplica, no un «No» inventado).
  expect_identical(as.character(de("CH 1")[[campo]] %||% ""), "")

  # La columna no dispara «campos ausentes» ni descuadra a los vecinos que
  # cierran el bloque (los primeros en correrse si el lector contara mal).
  expect_length(attr(filas, "campos_ausentes", exact = TRUE) %||% character(0), 0L)
  expect_equal(as.numeric(de("R 1.1")$eligible_n), 30)
  expect_identical(as.character(de("R 1.1")$link %||% ""), "https://x.test/R11")
})

# --- 7. ROJO: la fusión con el plan de sesión deja pasar el campo --------------

test_that("B22: la fusión deja pasar la CORRECCIÓN — fuera de AULAS_LIBRO_CAMPOS_PROPIOS el «Sí» no pisa al «No»", {
  if (!.rc_spec_ok("fusión con el plan")) return(invisible(NULL))
  campo <- .rc_campo()
  # La lista cerrada es el patrón más caro del repo, y aquí muerde en el flujo
  # EXACTO del dictado: el día 1 se importa el libro y el plan queda con el
  # «No» sembrado; se envía el correo; el día 2 el equipo marca «Sí» y se
  # reimporta. Un campo fuera de la lista solo LLENA vacíos (fusión, rama
  # `.alf_vacio(base[[campo]])`): la corrección «No» → «Sí» se rehusaría en
  # silencio. El libro POSEE este dato (su hoja lo pregunta), así que entra a
  # la declaración.
  expect_true(campo %in% AULAS_LIBRO_CAMPOS_PROPIOS,
              info = sprintf("`%s` no está declarado en AULAS_LIBRO_CAMPOS_PROPIOS", campo))

  previo <- .rc_plan()
  previo[[2]][[campo]] <- "No"   # el estado tras la importación del día 1
  nuevo <- .rc_plan()
  nuevo[[2]][[campo]] <- "Sí"    # lo que el equipo marcó el día 2
  out <- aulas_libro_fusionar_plan(previo, nuevo)
  codigos <- vapply(out$plan, function(u) as.character(u$operational_code %||% ""), character(1))
  fusionada <- out$plan[[which(codigos == "R 1.1")[[1]]]]
  expect_identical(as.character(fusionada[[campo]] %||% ""), "Sí",
                   info = "la corrección del libro no llegó al plan de sesión")
})
