# El cubo balanceado debe balancear DENTRO del estrato.
#
# Hallazgo J1 (checklist ae8e7845): el sorteo corre por estrato (facultad ×
# sexo × tamaño) y tres de las cinco balance_vars del diseño son CONSTANTES
# dentro de cada estrato. `model.matrix` falla ENTERO ante un factor de un
# solo nivel y el tryCatch degradaba la matriz completa a intercepto+pik:
# program y level — que SÍ varían y son lo único balanceable — se perdían con
# las constantes, sin aviso. El «cubo balanceado» del diseño vigente quedaba
# como sorteo pi-only por estrato.

.bs_estrato <- function() {
  # Un estrato real: facultad/sexo/tamaño constantes, programa y nivel variando.
  data.frame(
    classroom_id = paste0("CH", 1:8),
    faculty = "DERECHO", sex_top_1 = "F", size_group = "G2",
    program = rep(c("DERECHO", "CS POLITICA"), 4),
    level = rep(c("4", "6", "8", "10"), 2),
    eligible_n = c(20, 25, 30, 22, 28, 24, 26, 21),
    stringsAsFactors = FALSE
  )
}
.bs_vars <- c("faculty", "sex_top_1", "size_group", "program", "level")

test_that("las variables que varian SOBREVIVEN a las constantes del estrato", {
  df <- .bs_estrato()
  m <- .cm_aulas_balance_matrix(df, .bs_vars, pik = rep(0.5, 8))
  cols <- colnames(m)
  # Antes: solo pik+intercept. Ahora: program y level aportan columnas.
  expect_true(any(grepl("^program", cols)))
  expect_true(any(grepl("^level", cols)))
  expect_true(all(c("pik", "intercept") %in% cols))
  expect_gt(ncol(m), 2L)
})

test_that("las constantes descartadas SE DECLARAN, no se tragan", {
  m <- .cm_aulas_balance_matrix(.bs_estrato(), .bs_vars, pik = rep(0.5, 8))
  descartadas <- attr(m, "balance_vars_descartadas", exact = TRUE)
  expect_setequal(descartadas, c("faculty", "sex_top_1", "size_group"))
})

test_that("CONTROL: sin constantes la matriz no cambia de forma", {
  df <- .bs_estrato()
  m <- .cm_aulas_balance_matrix(df, c("program", "level"), pik = rep(0.5, 8))
  # pik + intercept + 2 programas + 3 niveles: model.matrix da todos los
  # niveles al PRIMER factor y aplica contrastes (n-1) a los siguientes.
  expect_identical(ncol(m), 7L)
  expect_length(attr(m, "balance_vars_descartadas", exact = TRUE), 0L)
})

test_that("todo constante degrada a intercepto+pik pero DICIENDO cuales", {
  df <- .bs_estrato()
  m <- .cm_aulas_balance_matrix(df, c("faculty", "sex_top_1"), pik = rep(0.5, 8))
  expect_setequal(colnames(m), c("pik", "intercept"))
  expect_setequal(attr(m, "balance_vars_descartadas", exact = TRUE), c("faculty", "sex_top_1"))
})

test_that("numerica constante tambien se descarta y declara", {
  df <- .bs_estrato()
  df$constante_num <- 7
  m <- .cm_aulas_balance_matrix(df, c("program", "constante_num"), pik = rep(0.5, 8))
  expect_true(any(grepl("^program", colnames(m))))
  expect_false("constante_num" %in% colnames(m))
  expect_setequal(attr(m, "balance_vars_descartadas", exact = TRUE), "constante_num")
})

test_that("el sorteo del cubo en un estrato con constantes queda balanceado por lo que varia", {
  # Integración: con la matriz reparada, lcube/samplecube reciben columnas de
  # program/level. La igualdad exacta de la muestra no se asierta (depende del
  # solver); lo verificable es que el pick corre y respeta la cuota.
  df <- .bs_estrato()
  pik <- rep(0.5, 8)
  sel <- list(balance_vars = .bs_vars, spread_vars = list())
  picked <- .cm_aulas_pick_local(df, pik, sel, seed = 123)
  if (is.null(picked)) skip("BalancedSampling no disponible en esta maquina")
  expect_length(unique(picked), 4L)
})

test_that("la perdida de balance SE DECLARA en el warning del pick", {
  df <- .bs_estrato()
  df$stratum <- "DERECHO / F / G2"
  sel <- list(balance_vars = .bs_vars, spread_vars = list(), n_aulas = 4)
  picked <- .cm_aulas_pick_indices(df, 4L, sel, "cube_balanceado", seed = 42)
  expect_true(any(grepl("sin variacion dentro del estrato", picked$warning)))
  expect_true(any(grepl("faculty, sex_top_1, size_group", picked$warning)))
  # CONTROL: un engine sin balance no declara nada de esto.
  picked_pps <- .cm_aulas_pick_indices(df, 4L, sel, "sistematico_pps", seed = 42)
  expect_false(any(grepl("sin variacion", picked_pps$warning)))
})

test_that("un method_id no reconocido ya no cae en silencio al cubo", {
  # El router rechaza con 400; a nivel de engine, el default centinela lo
  # delata: la resolucion con default vacio devuelve vacio.
  expect_identical(.cm_aulas_engine_key("no_existe_tal_motor", default = ""), "")
  expect_identical(.cm_aulas_engine_key("cube_balanceado", default = ""), "cube_balanceado")
})

test_that("el score del pool etiqueta su fuente y la degradacion se declara", {
  df <- data.frame(
    classroom_id = c("A", "B"), stratum = "S", eligible_n = c(10, 20),
    unique_student_ids = c("s1|s2", "s3"), duplicate_overlap = c(0, 0),
    unique_added = c(2, 1), stringsAsFactors = FALSE
  )
  sel <- list(balance_vars = list(), n_aulas = 1)
  # Camino sano: el objetivo evalua y la fuente lo dice.
  sano <- .cm_aulas_candidate_score(df, df, sel, objective = NULL)
  expect_identical(attr(sano, "score_fuente", exact = TRUE), "representatividad")
  # Camino degradado (aula_frame invalido tumba el objetivo): heuristico
  # ETIQUETADO, con el valor exacto de la formula de cobertura/duplicados.
  degradado <- .cm_aulas_candidate_score(df, NULL, sel, objective = NULL)
  expect_identical(attr(degradado, "score_fuente", exact = TRUE), "heuristico")
  expect_equal(as.numeric(degradado), 3 + 0.15 * (log1p(10) + log1p(20)), tolerance = 1e-9)
})

# --- El pivotal local corre DE VERDAD (lcube 2.x: lcube(prob, Xspread, Xbal)) --
#
# Medido en HSVG2026: la llamada de dos argumentos erraba SIEMPRE en
# BalancedSampling 2.1.1, el tryCatch la tragaba y el else-if por EXISTENCIA
# nunca intentaba lpm2 -> el pivotal local jamas corrio; todo estrato con
# sorteo caia a cubo y el sello "de los cuatro metodos" comparaba tres.

.snl_frame <- function(n = 20L) {
  data.frame(
    classroom_id = paste0("A", seq_len(n)),
    faculty = rep(c("F1", "F2"), length.out = n),
    level = rep(c("1", "2", "3", "4"), length.out = n),
    eligible_n = 10 + seq_len(n),
    stringsAsFactors = FALSE
  )
}

test_that("pick_local devuelve una muestra valida con BalancedSampling instalada", {
  skip_if_not_installed("BalancedSampling")
  df <- .snl_frame()
  pik <- .cm_aulas_inclusion_probabilities(df$eligible_n, 5L)
  sel <- list(balance_vars = list("faculty", "level"), spread_vars = list())
  picked <- .cm_aulas_pick_local(df, pik, sel, seed = 77L)
  # El defecto exacto: aqui venia NULL y el motor caia a cubo declarando
  # «equivalente».
  expect_false(is.null(picked))
  expect_true(all(picked >= 1L & picked <= nrow(df)))
  expect_length(picked, 5L)
})

test_that("pick_local sortea de verdad: no son siempre las primeras filas", {
  skip_if_not_installed("BalancedSampling")
  # Si los INDICES de 2.x se leyeran como indicadores (which(out > 0)), toda
  # semilla devolveria 1..quota. Dos semillas distintas deben poder diferir y
  # ninguna debe ser mecanicamente el prefijo.
  df <- .snl_frame(24L)
  pik <- .cm_aulas_inclusion_probabilities(df$eligible_n, 6L)
  sel <- list(balance_vars = list("faculty", "level"), spread_vars = list())
  muestras <- lapply(c(11L, 22L, 33L, 44L), function(s) .cm_aulas_pick_local(df, pik, sel, seed = s))
  expect_true(all(!vapply(muestras, is.null, logical(1))))
  prefijos <- vapply(muestras, function(m) identical(sort(m), seq_len(6L)), logical(1))
  expect_false(all(prefijos))
  expect_gt(length(unique(vapply(muestras, function(m) paste(sort(m), collapse = ","), character(1)))), 1L)
})

# El costo del aterrizaje del cubo crece como 2^columnas. Medido sobre
# `.cm_aulas_samplecube_estable` con 60 aulas y cuota 20: 16 columnas tardan
# 1,4 s, 20 tardan 29,2 s y 24 no terminaron en 930 s. No falla: se cuelga, y
# un timeout no lo rescata porque el trabajo ocurre en codigo compilado que no
# atiende interrupciones. La guarda tiene que ir ANTES del aterrizaje.
#
# El caso que lo disparo: `program` con 1 049 niveles en HSVG2026 daba 1 048
# columnas, y sobre los 76 estratos del marco la mediana quedaba en 9 pero el
# maximo en 146, con 18 estratos por encima de 20. Una variable que aporta mas
# columnas de las que el aterrizaje puede recorrer no balancea nada: entra en
# la misma categoria que una constante y se trata igual, descartandola y
# DECLARANDOLA.

.bs_estrato_ancho <- function(n = 40L, niveles = 30L) {
  data.frame(
    classroom_id = paste0("CH", seq_len(n)),
    faculty = "DERECHO", sex_top_1 = "F", size_group = "G2",
    program = paste0("P", rep(seq_len(niveles), length.out = n)),
    level = rep(c("4", "6"), length.out = n),
    eligible_n = rep(20, n),
    stringsAsFactors = FALSE
  )
}

test_that("una variable con demasiados niveles se descarta y se declara, no cuelga el sorteo", {
  df <- .bs_estrato_ancho()
  m <- .cm_aulas_balance_matrix_saneada(df, .bs_vars, pik = rep(0.5, nrow(df)))

  # La cota es sobre las columnas que llegan al aterrizaje; + intercepto y pik.
  expect_lte(ncol(m), .CM_AULAS_MAX_BALANCE_COLS + 2L)
  expect_true("program" %in% attr(m, "balance_vars_descartadas"))

  # Lo que si cabe sobrevive: `level` varia y aporta una sola columna.
  expect_false("level" %in% attr(m, "balance_vars_descartadas"))
})

test_that("por debajo de la cota no se descarta nada por cardinalidad", {
  df <- .bs_estrato_ancho(n = 40L, niveles = 3L)
  m <- .cm_aulas_balance_matrix_saneada(df, .bs_vars, pik = rep(0.5, nrow(df)))
  expect_false("program" %in% attr(m, "balance_vars_descartadas"))
  expect_false("level" %in% attr(m, "balance_vars_descartadas"))
})

# El aviso de balance se recalcula aparte de la matriz, asi que las dos lecturas
# de la misma regla pueden divergir: cuando la cota por cardinalidad entro, el
# aviso seguia reportando solo las variables SIN VARIACION y callaba el descarte
# que de verdad cambia el diseno del usuario. La capacidad existe solo si el
# analista puede verla.
test_that("el aviso nombra tambien lo descartado por cardinalidad, no solo lo constante", {
  df <- .bs_estrato_ancho()
  selector <- list(balance_vars = .bs_vars, spread_vars = list())
  msg <- .cm_aulas_balance_descartadas_warning(df, selector, "cube_balanceado")

  expect_length(msg, 1L)
  expect_match(msg, "program")           # la que la cota descarta
  expect_match(msg, "niveles|cardinal")  # y POR QUE se descarto
  expect_match(msg, "faculty")           # las constantes se siguen declarando
})

test_that("sin descartes por cardinalidad el aviso no inventa ninguno", {
  df <- .bs_estrato_ancho(n = 40L, niveles = 3L)
  selector <- list(balance_vars = .bs_vars, spread_vars = list())
  msg <- .cm_aulas_balance_descartadas_warning(df, selector, "cube_balanceado")
  expect_false(any(grepl("niveles|cardinal", msg)))
})
