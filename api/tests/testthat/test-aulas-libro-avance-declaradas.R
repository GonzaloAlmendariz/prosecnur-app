# =============================================================================
# Las columnas se derivan de lo que el estudio DECLARA
# =============================================================================
#
# Gonzalo, mirando la hoja publicada de CCSS Perfil 2026-II: «todavía hay campos
# vacíos». Eran doce columnas en raya permanente. Una raya es mejor que un cero
# mentiroso, pero **ninguna columna es mejor que una raya**: lo que no se puede
# calcular no reserva sitio.
#
# Y el encargo de fondo: «el propósito final es poder generalizarlo y
# automatizarlo, por lo que la app debe ser robusta a mostrar estudios
# universitarios por facultad y a este, que es un estudio de facultad por
# carreras y principalmente nivel curricular». Por eso la regla es una
# declaración, no un `if` por proyecto.
#
# **La vara de aceptación es HSVG2026**, que declara las cuatro cosas: su hoja
# tiene que salir con las veintitrés columnas de siempre y en el mismo orden. Si
# esta suite deja pasar un recorte ahí, el cambio es un rediseño encubierto.

# --- La declaración, leída de los insumos ------------------------------------

.ladec_fac <- function(nombre, cuota, F = NULL, M = NULL) {
  list(facultad = nombre, faculty_key = .cm_criterios_fac_key(nombre),
       cuota = cuota, cuota_sexo = list(F = F, M = M), tau = 0.5)
}

test_that("la declaración se lee del diseño y no se supone", {
  d <- prosecnurapp:::.calacd_declaracion(NULL)
  expect_false(d$cuotas)
  expect_false(d$meta_sexo)
  expect_false(d$sobremuestra)
  # `por_aula` nace en TRUE: un estudio que no declara eje es de facultad, y ése
  # es el camino de siempre.
  expect_true(d$aulas)

  completo <- list(meta_diseno = 2500, meta_operativa = 3750,
                   facultades = list(.ladec_fac("ARQUITECTURA", 125, F = 70, M = 55)))
  d <- prosecnurapp:::.calacd_declaracion(completo, por_aula = TRUE,
                                          con_sexo_observado = TRUE)
  expect_true(all(unlist(d[c("aulas", "cuotas", "meta_sexo", "observado_sexo",
                             "sobremuestra")])))
  # **`casos` es la única que va al revés**: la disposición de los casos sólo
  # existe cuando el eje se atribuye por PERSONA, porque sólo entonces un
  # cuestionario puede no ser una entrevista efectiva de su celda.
  expect_false(d$casos)
  expect_true(prosecnurapp:::.calacd_declaracion(completo, por_aula = FALSE)$casos)

  # **La sobremuestra exige las DOS cifras**, que es la misma condición que hace
  # que el reparto exista. Con una sola no hay ratio y la columna publicaría una
  # raya para siempre.
  solo_una <- completo; solo_una$meta_operativa <- NULL
  expect_false(prosecnurapp:::.calacd_declaracion(solo_una)$sobremuestra)
  cero <- completo; cero$meta_diseno <- 0
  expect_false(prosecnurapp:::.calacd_declaracion(cero)$sobremuestra)

  # Y la cuota de sexo basta con que la declare UNA celda: un diseño mixto no
  # tiene por qué callar la columna de las que sí la traen.
  mixto <- list(facultades = list(.ladec_fac("A", 10), .ladec_fac("B", 10, F = 6, M = 4)))
  expect_true(prosecnurapp:::.calacd_declaracion(mixto)$meta_sexo)
})

test_that("sin declaración las columnas son las de siempre, byte a byte", {
  # El default de `aulas_avance_columnas_declaradas()` es la constante entera:
  # cualquier llamador que no declare nada hereda el comportamiento anterior.
  for (clave in names(AULAS_AVANCE_CABECERAS)) {
    expect_identical(prosecnurapp:::aulas_avance_columnas_declaradas(clave),
                     AULAS_AVANCE_CABECERAS[[clave]], info = clave)
  }
})

test_that("cada grupo cuelga de su declaración, y de ninguna otra", {
  todo <- list(aulas = TRUE, cuotas = TRUE, meta_sexo = TRUE,
               observado_sexo = TRUE, sobremuestra = TRUE, casos = TRUE)
  cols <- function(clave, ...) {
    d <- utils::modifyList(todo, list(...))
    prosecnurapp:::aulas_avance_columnas_declaradas(clave, d)
  }
  expect_identical(cols("facultad"), AULAS_AVANCE_CABECERAS$facultad)

  sin_aulas <- cols("facultad", aulas = FALSE)
  expect_false(any(c("Aulas aplicadas", "Aulas sobre el plan") %in% sin_aulas))
  # Y NADA más se cae con ella: la sobremuestra y el sexo son otras preguntas.
  expect_true(all(c("Sobremuestra", "Muestra hombres") %in% sin_aulas))

  sin_sm <- cols("facultad", sobremuestra = FALSE)
  expect_false(any(grepl("obremuestra", sin_sm)))
  expect_true("Muestra hombres" %in% sin_sm)

  # **La asimetría del sexo.** Sin META de sexo se van las metas y el avance,
  # pero las efectivas por sexo se quedan: son observación, y el estudio sí las
  # tiene. Sin OBSERVACIÓN se van las efectivas y el avance, y las metas siguen.
  sin_meta <- cols("facultad", meta_sexo = FALSE)
  expect_true(all(c("Efectivas hombres", "Efectivas mujeres") %in% sin_meta))
  expect_false(any(c("Muestra hombres", "Avance muestra hombres",
                     "Sobremuestra mujeres") %in% sin_meta))
  sin_obs <- cols("facultad", observado_sexo = FALSE)
  expect_false(any(c("Efectivas hombres", "Avance muestra mujeres") %in% sin_obs))
  expect_true("Muestra hombres" %in% sin_obs)

  # El rendimiento cuelga de las MISMAS declaraciones: sus columnas de meta
  # salen de `design_targets` por clave de facultad.
  expect_identical(cols("rendimiento"), AULAS_AVANCE_CABECERAS$rendimiento)
  r <- cols("rendimiento", aulas = FALSE)
  expect_false(any(c("Muestra", "Muestra hombres", "Efectivas esperadas hombres") %in% r))
  # Los cuestionarios aplicados por sexo se quedan: salen del cruce de las
  # respuestas, no del diseño.
  expect_true(all(c("Cuestionarios aplicados hombres",
                    "Cuestionarios aplicados mujeres") %in% r))
  expect_false("Muestra" %in% cols("rendimiento", cuotas = FALSE))
  # La disposición de los casos cuelga de su propia puerta, y de ninguna otra.
  sin_casos <- cols("rendimiento", casos = FALSE)
  expect_false(any(c("Entrevistas efectivas", "Casos fuera del universo",
                     "Casos no resueltos") %in% sin_casos))
  expect_true("Cuestionarios aplicados" %in% sin_casos)

  # Las otras tres tablas no cuelgan de esto y no se tocan nunca.
  for (clave in c("general", "aplicador", "diario")) {
    expect_identical(cols(clave, aulas = FALSE, meta_sexo = FALSE,
                          sobremuestra = FALSE, observado_sexo = FALSE),
                     AULAS_AVANCE_CABECERAS[[clave]], info = clave)
  }
})

# --- HSVG2026: la hoja no se mueve -------------------------------------------

.ladec_hsvg_cfg <- function() monitoreo_aulas_normalize_config(list(
  enabled = TRUE, selection_run_id = "run_1", frame_hash = "hash_1",
  plan = list(
    list(classroom_id = "A1", operational_code = "CH 1", label = "a1",
         faculty = "ARQUITECTURA", sample_role = "titular", wave = "M1", orden = 1,
         eligible_n = 30, expected_valid = 10, sample_status = "agendada",
         operational_status = "aplicada", scheduled_date = "2026-09-21"),
    list(classroom_id = "A2", operational_code = "CH 2", label = "a2",
         faculty = "EDUCACIÓN", sample_role = "titular", wave = "M1", orden = 2,
         eligible_n = 30, expected_valid = 10, sample_status = "agendada",
         operational_status = "aplicada", scheduled_date = "2026-09-22")),
  design_targets = list(
    schema = "monitoreo_aulas_design_targets_v1", source = "calc-muestra",
    tasa_esperada = 0.5, tasa_fuente = "tau_disenio", total_cuota = 20,
    meta_diseno = 20, meta_operativa = 30,
    facultades = list(.ladec_fac("ARQUITECTURA", 10, F = 6, M = 4),
                      .ladec_fac("EDUCACIÓN", 10, F = 5, M = 5)),
    selection_run_id = "run_1", frame_hash = "hash_1"),
  source_mapping = list(collector_var = "collectorID", sex_var = "sexo")
))

# Con FECHA y con PARTES, para que las cinco tablas existan: si el avance
# diario o la producción por aplicador salieran vacíos, su cabecera no se
# publicaría y este test no estaría mirando nada.
.ladec_hsvg_resp <- function() data.frame(
  collectorID = c("A1", "A1", "A1", "A2"),
  `_submission_time` = c("2026-09-21T09:00:00", "2026-09-21T10:00:00",
                         "2026-09-21T11:00:00", "2026-09-22T09:00:00"),
  sexo = c("Femenino", "Femenino", "Masculino", "Femenino"),
  check.names = FALSE, stringsAsFactors = FALSE
)

.ladec_hsvg_partes <- function() list(
  list(operational_code = "CH 1", applied_by = "Equipo A", effective_surveys = 3),
  list(operational_code = "CH 2", applied_by = "Equipo B", effective_surveys = 1)
)

.ladec_hsvg_ind <- function() {
  cfg <- .ladec_hsvg_cfg()
  resp <- .ladec_hsvg_resp()
  aulas_libro_indicadores(
    cfg$plan,
    efectivas = monitoreo_aulas_efectivas_por_aula(cfg$plan, resp, cfg),
    responses = resp, validas = rep(TRUE, nrow(resp)),
    partes = .ladec_hsvg_partes(),
    cuotas = cfg$design_targets, cfg = cfg,
    asignados = list(`CH 1` = "Equipo A", `CH 2` = "Equipo B"))
}

test_that("un estudio por FACULTAD con sexo y sobremuestra conserva TODAS sus columnas", {
  # La vara de aceptación. Se comparan las listas ENTERAS, no unas columnas
  # elegidas a mano: un recorte de una sola tiene que doler aquí.
  ind <- .ladec_hsvg_ind()
  expect_identical(names(ind$facultades), AULAS_AVANCE_CABECERAS$facultad)
  # El rendimiento trae TODO menos la disposición de los casos: con el eje en el
  # aula, todo cuestionario aplicado es una entrevista efectiva de su celda y
  # esas tres columnas serían una copia y dos ceros perpetuos.
  expect_identical(names(ind$rendimiento),
                   setdiff(AULAS_AVANCE_CABECERAS$rendimiento,
                           prosecnurapp:::.CALACD_GRUPOS_RENDIMIENTO$casos))
  expect_identical(names(ind$aplicadores), AULAS_AVANCE_CABECERAS$aplicador)
  expect_identical(names(ind$diario), AULAS_AVANCE_CABECERAS$diario)
  expect_identical(names(ind$general), AULAS_AVANCE_CABECERAS$general)
  # Y las diez filas del «Avance general» dictado, en su orden.
  expect_identical(as.character(ind$general[[1L]]), AULAS_AVANCE_FILAS_GENERAL)
  # Con sus cifras vivas, no sólo presentes: la sobremuestra reparte y el sexo
  # cuenta. Si el recorte se hubiera colado, esto sería NA.
  arq <- ind$facultades[ind$facultades$Facultad == "ARQUITECTURA", , drop = FALSE]
  expect_equal(as.numeric(arq$Sobremuestra), 15)
  expect_equal(as.numeric(arq$`Efectivas mujeres`), 2)
  expect_equal(as.numeric(arq$`Muestra hombres`), 4)
})

test_that("y su hoja publicada sigue trayendo las cinco tablas con su cabecera entera", {
  filas <- aulas_libro_hoja_avance(.ladec_hsvg_ind(), fecha = as.Date("2026-09-22"))
  cabeceras <- Filter(nzchar, vapply(filas, function(f) {
    prosecnurapp:::.calac_tabla_de_cabecera(
      vapply(f, function(x) as.character(x %||% ""), character(1)))
  }, character(1)))
  expect_setequal(unname(cabeceras), names(AULAS_AVANCE_CABECERAS))
  # El reverso del Sheets las reconoce a las cinco: sin eso la hoja se publica
  # sin banda, sin anchos y sin color, en silencio.
  expect_length(cabeceras, 5L)
})

# --- El reverso reconoce la cabecera RECORTADA -------------------------------

test_that("el reverso del Sheets reconoce una cabecera recortada, y no la confunde", {
  decl <- list(aulas = FALSE, cuotas = TRUE, meta_sexo = FALSE,
               observado_sexo = FALSE, sobremuestra = FALSE)
  corta <- prosecnurapp:::aulas_avance_columnas_declaradas("facultad", decl)
  expect_identical(prosecnurapp:::.calac_tabla_de_cabecera(corta), "facultad")
  # Y con la palabra del eje en su primera celda, que es como sale publicada.
  expect_identical(
    prosecnurapp:::.calac_tabla_de_cabecera(c("Nivel", corta[-1])), "facultad")
  # El rendimiento recortado también, y NO se hace pasar por la otra.
  r <- prosecnurapp:::aulas_avance_columnas_declaradas("rendimiento", decl)
  expect_identical(prosecnurapp:::.calac_tabla_de_cabecera(r), "rendimiento")
  # Las cinco completas siguen reconociéndose por el camino de siempre.
  for (clave in names(AULAS_AVANCE_CABECERAS)) {
    expect_identical(prosecnurapp:::.calac_tabla_de_cabecera(AULAS_AVANCE_CABECERAS[[clave]]),
                     clave, info = clave)
  }
  # Una fila que no es cabecera de nada sigue sin serlo: el recorte no puede
  # convertir cualquier cosa en tabla.
  expect_identical(prosecnurapp:::.calac_tabla_de_cabecera(c("Facultad", "Cosa rara")), "")
  expect_identical(prosecnurapp:::.calac_tabla_de_cabecera(c("Total", "3")), "")
  # Ni el orden se puede alterar: un subconjunto desordenado no es un recorte.
  expect_identical(prosecnurapp:::.calac_tabla_de_cabecera(
    c("Facultad", "Faltantes muestra", "Avance muestra", "Muestra")), "")
})
