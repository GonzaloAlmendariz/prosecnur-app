# Sugeridas al mirar la base, por contenido (ítem 51 del checklist del
# practicante). Cada tipo de propuesta tiene su caso positivo, con la cifra que
# marca el motor, y un caso negativo que no debe proponerse. Las bases son
# inventadas: ningún nombre de columna sale de un estudio real, y el sembrador
# no puede depender de ellos.

source("setup-load-all.R")

set.seed(51)

.sc_survey <- function(filas) {
  d <- do.call(rbind, lapply(filas, function(f) data.frame(
    type = f[[1]], name = f[[2]], label = f[[3]], stringsAsFactors = FALSE)))
  d$type_base <- sub("\\s.*$", "", d$type)
  d$list_name <- ifelse(grepl("^select_", d$type), sub("^\\S+\\s+", "", d$type), "")
  d
}

.sc_escala <- function(lista, n = 5, con_na = TRUE) {
  d <- data.frame(list_name = lista, name = as.character(seq_len(n)),
                  label = paste("Grado", seq_len(n)), stringsAsFactors = FALSE)
  if (con_na) d <- rbind(d, data.frame(list_name = lista, name = "88", label = "No aplica"))
  d
}

.sc_origenes <- function(props) vapply(props, function(p) p$semilla$origen %||% "", character(1))

.sc_de <- function(props, origen) Filter(function(p) identical(p$semilla$origen, origen), props)

# Toda propuesta se puede guardar y auditar tal cual.
.sc_insertable <- function(p) {
  expect_silent(.validar_regla_custom(p))
  r <- p; r$id <- "RC_T"
  expect_true(is.list(bridge_regla_custom(r)))
}

# --- 1. Baterías ----------------------------------------------------------------

.sc_bateria_base <- function(n = 60, k = 10, n_iguales = 6) {
  m <- matrix(sample(as.character(1:5), n * k, replace = TRUE), n, k)
  m[seq_len(n_iguales), ] <- "3"
  d <- as.data.frame(m, stringsAsFactors = FALSE)
  names(d) <- sprintf("b_%d", seq_len(k))
  d
}

test_that("propone misma respuesta en una batería de 10 ítems con su escala y la opción No aplica", {
  d <- .sc_bateria_base()
  s <- .sc_survey(lapply(names(d), function(v) list("select_one esc", v, paste("Ítem", v))))
  ch <- .sc_escala("esc")
  props <- .semilla_con_cifra(d, reglas_semilla_baterias(d, s, ch))
  p <- .sc_de(props, "bateria_iguales")
  expect_length(p, 1L)
  p <- p[[1]]
  expect_identical(unlist(p$variables), sprintf("b_%d", 1:10))
  expect_identical(p$params$patron, "iguales")
  expect_identical(p$params$minimo, 8L)
  expect_identical(unlist(p$params$no_cuentan), "88")
  expect_identical(p$semilla$n_casos_hoy, 6L)
  expect_match(p$semilla$porque, "b_1 a b_10 comparten la escala de 1 a 5 y la opción 88 (No aplica)", fixed = TRUE)
  .sc_insertable(p)
})

test_that("no propone misma respuesta en una batería corta ni sin escala del formulario", {
  d <- .sc_bateria_base(k = 4)
  s <- .sc_survey(lapply(names(d), function(v) list("select_one esc", v, v)))
  expect_length(.sc_de(reglas_semilla_baterias(d, s, .sc_escala("esc")), "bateria_iguales"), 0L)
  # Las mismas 10 preguntas declaradas como texto: sin lista, no hay batería.
  d10 <- .sc_bateria_base()
  s10 <- .sc_survey(lapply(names(d10), function(v) list("text", v, v)))
  expect_length(reglas_semilla_baterias(d10, s10, .sc_escala("esc")), 0L)
})

test_that("una batería donde la mitad responde todo igual va como para revisar, con su causa", {
  d <- .sc_bateria_base(n = 60, n_iguales = 30)
  s <- .sc_survey(lapply(names(d), function(v) list("select_one esc", v, v)))
  p <- .semilla_con_cifra(d, reglas_semilla_baterias(d, s, .sc_escala("esc", con_na = FALSE)))[[1]]
  expect_true(isTRUE(p$semilla$para_revisar))
  expect_match(p$semilla$causa_revision, "Marca 30 de 60 casos (50.0 %), más del 30 %", fixed = TRUE)
})

test_that("propone el bloque No aplica saltado a medias por los ítems que se marcan 88 juntos", {
  n <- 60
  m <- matrix(sample(as.character(1:5), n * 6, replace = TRUE), n, 6)
  m[1:12, ] <- "88"                      # bloque saltado entero: no se marca
  m[13:14, 1:5] <- "88"; m[13:14, 6] <- "2"  # 88 en 5 de 6 y una respuesta: se marca
  d <- as.data.frame(m, stringsAsFactors = FALSE); names(d) <- sprintf("m_%d", 1:6)
  d$otra_1 <- sample(as.character(1:5), n, replace = TRUE)
  s <- .sc_survey(lapply(names(d), function(v) list("select_one esc", v, v)))
  props <- .semilla_con_cifra(d, reglas_semilla_baterias(d, s, .sc_escala("esc")))
  p <- .sc_de(props, "bateria_no_aplica")
  expect_length(p, 1L)
  p <- p[[1]]
  expect_identical(unlist(p$variables), sprintf("m_%d", 1:6))
  expect_identical(p$params$patron, "codigo")
  expect_identical(p$params$minimo, 5L)  # 85 % de 6 sería el bloque entero: queda 1 libre
  expect_identical(p$semilla$n_casos_hoy, 2L)
  expect_identical(p$semilla$n_bloque_completo, 12L)
  .sc_insertable(p)
})

test_that("sin opción No aplica en la lista no se buscan bloques", {
  m <- matrix(sample(as.character(1:5), 60 * 6, replace = TRUE), 60, 6); m[1:12, ] <- "5"
  d <- as.data.frame(m, stringsAsFactors = FALSE); names(d) <- sprintf("m_%d", 1:6)
  s <- .sc_survey(lapply(names(d), function(v) list("select_one esc", v, v)))
  expect_length(.sc_de(reglas_semilla_baterias(d, s, .sc_escala("esc", con_na = FALSE)), "bateria_no_aplica"), 0L)
})

# --- 2. Fechas que deben cuadrar -----------------------------------------------------

.sc_fechas <- function(n = 40) {
  f1 <- as.Date("2026-10-01") + sample(0:20, n, replace = TRUE)
  f2 <- f1; f2[1:2] <- f2[1:2] + 3
  f3 <- f1 + sample(1:4, n, replace = TRUE); f3[3:4] <- f1[3:4] - 2
  data.frame(alfa = format(f1, "%d.%m.%Y"), beta = format(f2, "%d.%m.%Y"),
             gama = format(f3, "%d.%m.%y"), stringsAsFactors = FALSE)
}

test_that("propone deben ser iguales y el orden de una fecha casi siempre posterior", {
  d <- .sc_fechas()
  props <- .semilla_con_cifra(d, reglas_semilla_fechas_pares(d))
  ig <- .sc_de(props, "fechas_iguales")
  expect_length(ig, 1L)
  expect_identical(unlist(ig[[1]]$semilla$columnas), c("alfa", "beta"))
  expect_identical(ig[[1]]$params$patron, "duracion")
  expect_identical(ig[[1]]$semilla$n_casos_hoy, 2L)
  expect_match(ig[[1]]$semilla$porque, "coinciden en 38 de 40 casos", fixed = TRUE)
  ord <- .sc_de(props, "fechas_orden")
  # gama va después de alfa y de beta: dos pares, cada uno con su regla.
  expect_setequal(vapply(ord, function(p) paste(unlist(p$semilla$columnas), collapse = ">"), ""),
                  c("alfa>gama", "beta>gama"))
  a_g <- Filter(function(p) identical(unlist(p$semilla$columnas)[1], "alfa"), ord)[[1]]
  expect_identical(a_g$params$patron, "orden")
  expect_identical(a_g$semilla$n_casos_hoy, 2L)
  for (p in props) .sc_insertable(p)
})

test_that("no propone nada entre dos fechas que no guardan relación", {
  n <- 40
  d <- data.frame(alfa = format(as.Date("2026-10-01") + sample(0:30, n, TRUE), "%d.%m.%Y"),
                  beta = format(as.Date("2026-10-01") + sample(0:30, n, TRUE), "%d.%m.%Y"),
                  stringsAsFactors = FALSE)
  expect_length(reglas_semilla_fechas_pares(d), 0L)
})

# --- 3. Catálogo de ubigeos y moda -----------------------------------------------------

test_that("propone catálogo y moda en las dos direcciones cuando ubigeo y distrito cuadran", {
  lugares <- data.frame(ub = c("150110", "150128", "150132", "150101"),
                        di = c("COMAS", "RIMAC", "SAN JUAN DE LURIGANCHO", "LIMA"), stringsAsFactors = FALSE)
  k <- rep(1:4, each = 10)
  d <- data.frame(cod_lugar = lugares$ub[k], nom_lugar = lugares$di[k], stringsAsFactors = FALSE)
  d$cod_lugar[1] <- "150128"  # una encuesta de COMAS con el ubigeo del RIMAC
  props <- .semilla_con_cifra(d, reglas_semilla_lugar(d))
  cat_p <- .sc_de(props, "lugar_catalogo")
  expect_length(cat_p, 1L)
  expect_setequal(unlist(cat_p[[1]]$params$roles), c("cod_lugar", "nom_lugar"))
  expect_identical(cat_p[[1]]$params$roles$ubigeo, "cod_lugar")
  expect_identical(cat_p[[1]]$semilla$n_casos_hoy, 1L)
  moda <- .sc_de(props, "lugar_moda")
  expect_setequal(vapply(moda, function(p) paste(p$params$grupo, p$params$valor), ""),
                  c("nom_lugar cod_lugar", "cod_lugar nom_lugar"))
  expect_identical(Filter(function(p) p$params$grupo == "nom_lugar", moda)[[1]]$semilla$n_casos_hoy, 1L)
  for (p in props) .sc_insertable(p)
})

test_that("no propone catálogo sobre columnas que no son lugares", {
  d <- data.frame(color = sample(c("ROJO", "AZUL", "VERDE"), 40, TRUE),
                  animal = sample(c("PERRO", "GATO"), 40, TRUE), stringsAsFactors = FALSE)
  expect_length(reglas_semilla_lugar(d), 0L)
})

# --- 4. Hora de inicio y hora de fin ----------------------------------------------------

.sc_horas <- function(n = 40) {
  ini <- 8 * 60 + sample(0:300, n, TRUE)
  fin <- ini + sample(25:45, n, TRUE)
  fin[1] <- ini[1] - 20   # fin antes que inicio
  fin[2] <- ini[2] + 200  # duración larga
  data.frame(hora_inicio = sprintf("%02d:%02d", ini %/% 60, ini %% 60),
             hora_fin_h = fin %/% 60, hora_fin_min = fin %% 60, stringsAsFactors = FALSE)
}

test_that("empareja la hora de inicio con la de fin repartida y propone orden y duración", {
  d <- .sc_horas()
  props <- .semilla_con_cifra(d, reglas_semilla_horas(d))
  ord <- .sc_de(props, "horas_orden")
  expect_length(ord, 1L)
  expect_identical(ord[[1]]$params$fin$partes, "hora_minutos")
  expect_identical(unlist(ord[[1]]$params$fin$variables), c("hora_fin_h", "hora_fin_min"))
  expect_identical(ord[[1]]$semilla$n_casos_hoy, 1L)
  dur <- .sc_de(props, "horas_duracion")
  expect_length(dur, 1L)
  expect_identical(dur[[1]]$params$patron, "duracion")
  # La larga (200 min) y la del revés.
  expect_identical(dur[[1]]$semilla$n_casos_hoy, 2L)
  for (p in props) .sc_insertable(p)
})

test_that("sin inicio y fin en el nombre no empareja horas", {
  d <- .sc_horas()
  names(d) <- c("hora_a", "hora_b_h", "hora_b_min")
  expect_length(reglas_semilla_horas(d), 0L)
})

# --- 5. Teléfono o documento repetido ------------------------------------------------------

test_that("propone respuestas repetidas en una columna que parece teléfono y casi no se repite", {
  tel <- sprintf("9%08d", sample(1e7:9e7, 40))
  tel[2] <- tel[1]
  d <- data.frame(contacto = tel, stringsAsFactors = FALSE)
  props <- .semilla_con_cifra(d, reglas_semilla_repetidos(d))
  expect_length(props, 1L)
  expect_identical(props[[1]]$tipo, "duplicados")
  expect_identical(props[[1]]$semilla$parece, "teléfono")
  expect_identical(props[[1]]$semilla$n_casos_hoy, 2L)
  .sc_insertable(props[[1]])
})

test_that("no propone repetidas en un número que se repite por diseño ni en la llave declarada", {
  d <- data.frame(contacto = rep(sprintf("9%08d", 1:5), 8), stringsAsFactors = FALSE)
  expect_length(reglas_semilla_repetidos(d), 0L)
  tel <- sprintf("9%08d", sample(1e7:9e7, 40)); tel[2] <- tel[1]
  d2 <- data.frame(llave = tel, stringsAsFactors = FALSE)
  cfg <- list(identity = list(variables = list("llave")))
  expect_length(reglas_semilla_repetidos(d2, cfg), 0L)
})

# --- 6. Atributos del recopilador ---------------------------------------------------------

.sc_recop <- function() {
  enc <- rep(c("ANA", "BETO", "CARLA", "DIEGO"), each = 15)
  sexo <- rep(c("2", "1", "2", "1"), each = 15)
  sexo[3] <- "1"
  data.frame(enc = enc, sexo_enc = sexo, opinion = sample(as.character(1:5), 60, TRUE),
             stringsAsFactors = FALSE)
}

test_that("propone el valor distinto al habitual para un dato del recopilador declarado", {
  d <- .sc_recop()
  cfg <- list(identity = list(agent_variable = "enc"))
  props <- .semilla_con_cifra(d, reglas_semilla_recopilador(d, cfg))
  expect_length(props, 1L)
  expect_identical(props[[1]]$params, list(grupo = "enc", valor = "sexo_enc"))
  expect_identical(props[[1]]$semilla$n_casos_hoy, 1L)
  .sc_insertable(props[[1]])
})

test_that("sin recopilador declarado no propone, ni sobre una pregunta que varía", {
  d <- .sc_recop()
  expect_length(reglas_semilla_recopilador(d, NULL), 0L)
  cfg <- list(identity = list(agent_variable = "enc"))
  expect_false(any(vapply(reglas_semilla_recopilador(d, cfg), function(p) p$params$valor == "opinion", logical(1))))
})

# --- 7. Variantes de escritura (detector) ----------------------------------------------------

test_that("el detector marca un valor que solo difiere en mayúsculas de la escritura más común", {
  d <- data.frame(lugar = c(rep("COMAS", 30), "COMAs", rep("LIMA", 20)), stringsAsFactors = FALSE)
  s <- .vdc_variantes(d, "lugar", NULL)
  expect_false(is.null(s))
  expect_identical(s$tipo, "variante")
  expect_identical(s$filas, 31L)
  expect_match(s$texto, "\"COMAs\" (1) frente a \"COMAS\" (30)", fixed = TRUE)
  res <- validacion_detector_consistencia(d)
  expect_true("variante" %in% vapply(res$sugerencias, `[[`, "", "tipo"))
})

test_that("el detector no marca variantes en una columna escrita sin criterio", {
  d <- data.frame(lugar = c(rep("COMAS", 20), rep("Comas", 12), rep("LIMA", 20)), stringsAsFactors = FALSE)
  expect_null(.vdc_variantes(d, "lugar", NULL))
})

# --- Integración ----------------------------------------------------------------------------

test_that("reglas_semilla_todas incluye las propuestas por contenido con su cifra y deja al final las para revisar", {
  d <- cbind(.sc_bateria_base(n = 40), .sc_fechas(40))
  d <- cbind(d, data.frame(extra_1 = rep("1", 40)))
  s <- .sc_survey(lapply(sprintf("b_%d", 1:10), function(v) list("select_one esc", v, v)))
  props <- reglas_semilla_todas(d, list(), survey = s, choices = .sc_escala("esc"))
  o <- .sc_origenes(props)
  expect_true(all(c("bateria_iguales", "fechas_iguales", "fechas_orden") %in% o))
  nuevas <- props[o %in% c("bateria_iguales", "fechas_iguales", "fechas_orden")]
  expect_true(all(vapply(nuevas, function(p) is.integer(p$semilla$n_casos_hoy) && p$semilla$n_casos_hoy > 0L, logical(1))))
  rev <- vapply(props, function(p) isTRUE(p$semilla$para_revisar), logical(1))
  if (any(rev)) expect_true(all(rev[min(which(rev)):length(rev)]))
  # Una regla ya escrita no se vuelve a proponer.
  ya <- list(list(tipo = "bateria", variables = as.list(sprintf("b_%d", 1:10))))
  expect_false("bateria_iguales" %in% .sc_origenes(reglas_semilla_todas(d, ya, survey = s, choices = .sc_escala("esc"))))
})

test_that("una propuesta que el motor no puede evaluar no se ofrece y se avisa con su causa", {
  d <- data.frame(x = 1:3)
  mala <- list(tipo = "tipo_que_no_existe", variables = list("x"), params = list(),
               nombre = "Mala", semilla = list(origen = "prueba", porque = ""))
  expect_warning(out <- .semilla_con_cifra(d, list(mala)), "Sugerida sin evaluar \\(Mala\\)")
  expect_length(out, 0L)
})

test_that("el detector no busca variantes en texto casi único, como una dirección", {
  dir <- c(sprintf("JR LOS PINOS %d", 1:40), "Jr Los Pinos 1")
  d <- data.frame(direccion = dir, stringsAsFactors = FALSE)
  expect_null(.vdc_variantes(d, "direccion", NULL))
})
