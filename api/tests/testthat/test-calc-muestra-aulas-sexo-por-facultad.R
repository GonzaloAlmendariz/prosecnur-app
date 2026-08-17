# El balance de sexo se publicaba SOLO en agregado, y el agregado cuadra.
#
# En HSVG2026 el informe de representatividad dice: 53,8% de mujeres en el marco
# contra 52,1% en lo seleccionado, dentro de la tolerancia de 2,5 puntos, TRUE.
# Por dentro, con las mismas cifras, ARTE Y DISEÑO tiene 2 aulas titulares que
# ofrecen 62% de mujeres donde su cuota pide 76% —14 puntos— y CIENCIAS Y ARTES
# DE LA COMUN. 57% donde pide 64%.
#
# El motor ya cruza los dos ejes: los estratos del sorteo son
# `FACULTAD / SEXO / GRUPO` y cada aula lleva su composicion en `sex_top_*`. Lo
# que faltaba era publicar el cruce, porque la cuota de hombres y mujeres es POR
# FACULTAD y un balance global no responde esa pregunta.

.spf_aula <- function(id, faculty, f, m, included = TRUE, role = NULL) {
  fila <- data.frame(
    classroom_id = id, faculty = faculty,
    sex_top_1 = "F", sex_top_1_n = f, sex_top_2 = "M", sex_top_2_n = m,
    stringsAsFactors = FALSE
  )
  if (!is.null(role)) fila$sample_role <- role
  if (is.null(role)) fila$included <- included
  fila
}

.spf_frame <- function(...) list(aula_frame = do.call(rbind, list(...)))
.spf_sel <- function(...) list(selection = do.call(rbind, list(...)))

.spf_fila <- function(out, clave) {
  filas <- out$sexo_por_facultad$filas
  for (f in filas) if (identical(f$faculty_key, clave)) return(f)
  NULL
}

.spf_key <- function(x) .cm_aulas_scalar(.cm_criterios_fac_key(x), "")

test_that("los conteos por sexo salen del top-2 y no de un solo campo", {
  df <- data.frame(
    sex_top_1 = c("F", "M"), sex_top_1_n = c(30, 40),
    sex_top_2 = c("M", "F"), sex_top_2_n = c(10, 5),
    stringsAsFactors = FALSE
  )
  c2 <- .cm_aulas_sexo_conteos(df)
  expect_equal(c2$f, c(30, 5))
  expect_equal(c2$m, c(10, 40))
})

test_that("sin columnas de sexo no se inventa un cero", {
  # Un cero se leeria como «medido y sin mujeres», que es otra afirmacion.
  c2 <- .cm_aulas_sexo_conteos(data.frame(faculty = "X", stringsAsFactors = FALSE))
  expect_true(all(is.na(c2$f)))
  expect_true(all(is.na(c2$m)))
})

test_that("la proporcion de una facultad sale de sus propias aulas", {
  # Control: si esto mezclara facultades, todos los tests de abajo medirian el
  # promedio global, que es exactamente el defecto que se repara.
  p <- .cm_aulas_sexo_por_facultad(rbind(
    .spf_aula("A1", "ARTE Y DISEÑO", 24, 15),
    .spf_aula("D1", "DERECHO", 91, 39)
  ))
  expect_equal(round(p[[.spf_key("ARTE Y DISEÑO")]]$prop_f, 3), round(24 / 39, 3))
  expect_equal(round(p[[.spf_key("DERECHO")]]$prop_f, 3), round(91 / 130, 3))
})

test_that("el bloque compara cada facultad contra SU cuota, no contra el total", {
  # Marco: ARTE Y DISEÑO 76% mujeres, CIENCIAS E INGENIERIA 25%. Un agregado
  # los promedia y ninguna de las dos se reconoce en el resultado.
  frame <- .spf_frame(
    .spf_aula("A1", "ARTE Y DISEÑO", 380, 120),
    .spf_aula("A2", "ARTE Y DISEÑO", 380, 120),
    .spf_aula("C1", "CIENCIAS E INGENIERIA", 125, 375),
    .spf_aula("C2", "CIENCIAS E INGENIERIA", 125, 375)
  )
  sel <- .spf_sel(
    .spf_aula("A1", "ARTE Y DISEÑO", 62, 38, role = "titular"),
    .spf_aula("C1", "CIENCIAS E INGENIERIA", 25, 75, role = "titular")
  )
  out <- calc_muestra_aulas_adjuntar_sexo_facultad(sel, frame)
  arte <- .spf_fila(out, .spf_key("ARTE Y DISEÑO"))
  ing <- .spf_fila(out, .spf_key("CIENCIAS E INGENIERIA"))
  expect_equal(arte$marco_prop_mujeres, 0.76)
  expect_equal(arte$titulares_prop_mujeres, 0.62)
  expect_equal(arte$brecha_pp, -14)
  expect_equal(ing$marco_prop_mujeres, 0.25)
  expect_equal(ing$brecha_pp, 0)
  expect_equal(arte$estado, "medido")
})

test_that("se mide sobre las TITULARES, no sobre titulares mas reservas", {
  # Son las que se visitan y las que entregan la cuota. En HSVG2026 hay 30
  # titulares y 330 reservas: contar las reservas diria «sus 36 aulas» de una
  # facultad que visita 3, y ademas cambiaria la composicion medida.
  frame <- .spf_frame(.spf_aula("A1", "ARTE Y DISEÑO", 760, 240))
  sel <- .spf_sel(
    .spf_aula("A1", "ARTE Y DISEÑO", 76, 24, role = "titular"),
    .spf_aula("A2", "ARTE Y DISEÑO", 0, 100, role = "chain_reserve"),
    .spf_aula("A3", "ARTE Y DISEÑO", 0, 100, role = "extra_reserve_pool")
  )
  out <- calc_muestra_aulas_adjuntar_sexo_facultad(sel, frame)
  fila <- .spf_fila(out, .spf_key("ARTE Y DISEÑO"))
  expect_equal(out$sexo_por_facultad$base, "titulares")
  expect_equal(fila$aulas_titulares, 1L)
  expect_equal(fila$titulares_prop_mujeres, 0.76)
  expect_equal(fila$brecha_pp, 0)
})

test_that("sin rol de titular cae a la seleccion y lo declara", {
  # Una seleccion sin `sample_role` no se queda muda; dice sobre qué midio.
  sel <- .spf_sel(.spf_aula("A1", "ARTE Y DISEÑO", 62, 38, role = "chain_reserve"))
  out <- calc_muestra_aulas_adjuntar_sexo_facultad(
    sel, .spf_frame(.spf_aula("A1", "ARTE Y DISEÑO", 760, 240))
  )
  expect_equal(out$sexo_por_facultad$base, "seleccion_sin_bolsa_extra")
  expect_equal(.spf_fila(out, .spf_key("ARTE Y DISEÑO"))$aulas_titulares, 1L)
})

test_that("las aulas EXCLUIDAS no entran en la cuota de referencia", {
  # La cuota se reparte sobre la poblacion del marco, no sobre lo que quedo
  # fuera por criterios. Contarlas moveria la referencia contra la que se juzga.
  frame <- .spf_frame(
    .spf_aula("A1", "ARTE Y DISEÑO", 760, 240, included = TRUE),
    .spf_aula("A9", "ARTE Y DISEÑO", 0, 5000, included = FALSE)
  )
  out <- calc_muestra_aulas_adjuntar_sexo_facultad(
    .spf_sel(.spf_aula("A1", "ARTE Y DISEÑO", 76, 24, role = "titular")), frame
  )
  expect_equal(.spf_fila(out, .spf_key("ARTE Y DISEÑO"))$marco_prop_mujeres, 0.76)
})

test_that("el aviso lleva las dos cifras y la brecha, y concuerda en numero", {
  a <- .cm_aulas_aviso_sexo_facultad("ARTE Y DISEÑO", 0.76, 0.62, 2)
  expect_true(grepl("sus 2 aulas titulares ofrecen", a, fixed = TRUE))
  expect_true(grepl("62%", a, fixed = TRUE))
  expect_true(grepl("76%", a, fixed = TRUE))
  expect_true(grepl("14 puntos por debajo", a, fixed = TRUE))
  # Una sola aula no dice «sus 1 aula titular ofrecen».
  uno <- .cm_aulas_aviso_sexo_facultad("PSICOLOGÍA", 0.60, 0.80, 1)
  expect_true(grepl("su única aula titular ofrece 80%", uno, fixed = TRUE))
  expect_false(grepl("ofrecen", uno, fixed = TRUE))
  # Un punto no se pluraliza. Con la tolerancia por defecto —2,5 puntos— este
  # aviso nunca sale, asi que se prueba con la de un estudio mas exigente.
  expect_true(grepl(
    "1 punto por encima",
    .cm_aulas_aviso_sexo_facultad("X", 0.50, 0.51, 3, tolerancia = 0.005),
    fixed = TRUE
  ))
})

test_that("el aviso calla por debajo de la tolerancia del propio estudio", {
  # Ocho avisos de un punto entierran el de catorce. El umbral no se inventa:
  # es el que el estudio ya aplica al agregado.
  expect_equal(.cm_aulas_aviso_sexo_facultad("X", 0.60, 0.62, 4), "")
  expect_true(nzchar(.cm_aulas_aviso_sexo_facultad("X", 0.60, 0.64, 4)))
  # Con una tolerancia mas ancha, la misma brecha calla.
  expect_equal(.cm_aulas_aviso_sexo_facultad("X", 0.60, 0.64, 4, tolerancia = 0.10), "")
})

test_that("la tolerancia se lee del objetivo del marco", {
  vars <- data.frame(variable = c("faculty", "sex"), tolerance = c(0.05, 0.08),
                     stringsAsFactors = FALSE)
  expect_equal(.cm_aulas_tolerancia_sexo(list(config = list(objective = list(variables = vars)))), 0.08)
  # Sin objetivo publicado se usa la del eje sexo del informe agregado.
  expect_equal(.cm_aulas_tolerancia_sexo(NULL), 0.025)
  expect_equal(.cm_aulas_tolerancia_sexo(list(config = list())), 0.025)
})

test_that("sin marco la fila queda en sin_dato y no inventa una cuota", {
  out <- calc_muestra_aulas_adjuntar_sexo_facultad(
    .spf_sel(.spf_aula("A1", "ARTE Y DISEÑO", 62, 38, role = "titular")), NULL
  )
  fila <- .spf_fila(out, .spf_key("ARTE Y DISEÑO"))
  expect_true(is.na(fila$marco_prop_mujeres))
  expect_true(is.na(fila$brecha_pp))
  expect_equal(fila$estado, "sin_dato")
  expect_equal(fila$aviso, "")
})

test_that("el bloque es aditivo y no pisa lo que el sorteo publico", {
  sel <- .spf_sel(.spf_aula("A1", "ARTE Y DISEÑO", 62, 38, role = "titular"))
  sel$representativity <- list(overall_score = 36.9)
  sel$selection_run_id <- "run-1"
  out <- calc_muestra_aulas_adjuntar_sexo_facultad(
    sel, .spf_frame(.spf_aula("A1", "ARTE Y DISEÑO", 760, 240))
  )
  expect_equal(out$representativity$overall_score, 36.9)
  expect_equal(out$selection_run_id, "run-1")
  expect_equal(nrow(out$selection), 1L)
})

test_that("sin seleccion no se adjunta nada", {
  expect_null(calc_muestra_aulas_adjuntar_sexo_facultad(NULL)$sexo_por_facultad)
  expect_null(calc_muestra_aulas_adjuntar_sexo_facultad(list())$sexo_por_facultad)
})

test_that("el payload de estado lo publica: el helper solo no basta", {
  # Un test del helper no protege la APLICACION. El bloque se deriva al servir,
  # en el unico punto por el que pasan la via sincrona y la del job; si nadie lo
  # llamara ahi, los tests de arriba seguirian verdes y la UI no veria nada.
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  expect_null(.cm_state_payload(sid)$aulas$selection)
  session_set(sid, "calc_muestra_aulas_frame",
              .spf_frame(.spf_aula("A1", "ARTE Y DISEÑO", 760, 240)))
  session_set(sid, "calc_muestra_aulas_selection",
              .spf_sel(.spf_aula("A1", "ARTE Y DISEÑO", 62, 38, role = "titular")))

  bloque <- .cm_state_payload(sid)$aulas$selection$sexo_por_facultad
  expect_equal(bloque$schema, "calc_muestra_aulas_sexo_por_facultad_v1")
  expect_equal(.spf_fila(list(sexo_por_facultad = bloque), .spf_key("ARTE Y DISEÑO"))$brecha_pp, -14)
})

test_that("las facultades salen ordenadas de la peor brecha a la mejor", {
  # Quien lee necesita ver arriba la que no llega, no buscarla en la lista.
  frame <- .spf_frame(
    .spf_aula("A1", "ARTE Y DISEÑO", 760, 240),
    .spf_aula("D1", "DERECHO", 650, 350)
  )
  sel <- .spf_sel(
    .spf_aula("A1", "ARTE Y DISEÑO", 62, 38, role = "titular"),
    .spf_aula("D1", "DERECHO", 70, 30, role = "titular")
  )
  out <- calc_muestra_aulas_adjuntar_sexo_facultad(sel, frame)
  claves <- vapply(out$sexo_por_facultad$filas, function(f) f$faculty_key, character(1))
  expect_equal(claves[[1]], .spf_key("ARTE Y DISEÑO"))
})
