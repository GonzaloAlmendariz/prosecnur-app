# Sembrado de criterios de revisión — GOAL validación extrínseca, lote 1 (L2).
#
# El sembrador propone criterios ya formados para que la cobertura no dependa de
# que alguien sepa que debe escribirlos. Lo que se fija acá:
#   - propone solo cuando hay algo que proponer (control negativo explícito)
#   - lo propuesto es insertable tal cual: pasa el schema real
#   - lo propuesto, compilado y evaluado, marca exactamente los casos correctos
#   - no nombra variables de ningún proyecto

source("setup-load-all.R")

.sem_base <- function(versiones, extra = list()) {
  d <- data.frame(
    `_uuid` = sprintf("u%02d", seq_along(versiones)),
    `_submission_time` = sprintf("2026-08-%02dT10:00:00", seq_along(versiones)),
    `__version__` = versiones,
    stringsAsFactors = FALSE, check.names = FALSE
  )
  for (nm in names(extra)) d[[nm]] <- extra[[nm]]
  d
}

test_that("no propone nada cuando la base viene de una sola versión", {
  # Control negativo: si el sembrador propusiera igual, el aserto de abajo no
  # distinguiría una base sana de una mezclada.
  d <- .sem_base(rep("vA", 10))
  expect_length(reglas_semilla_procedencia(d), 0L)
})

test_that("no propone nada cuando la base no registra versión", {
  d <- data.frame(`_uuid` = c("u1", "u2"), p1 = c("a", "b"),
                  stringsAsFactors = FALSE, check.names = FALSE)
  expect_length(reglas_semilla_procedencia(d), 0L)
})

test_that("propone el criterio cuando conviven dos versiones, con la mayoritaria como vigente", {
  d <- .sem_base(c(rep("vNueva", 8), rep("vVieja", 2)))
  props <- reglas_semilla_procedencia(d)

  expect_length(props, 1L)
  p <- props[[1]]
  expect_identical(p$tipo, "fuera_catalogo")
  expect_identical(unlist(p$variables), "__version__")
  expect_identical(unlist(p$params$valores), "vNueva")
  expect_identical(p$semilla$n_casos_afectados, 2L)
  expect_identical(p$severidad, "advertencia")
})

test_that("lo propuesto es insertable tal cual: pasa el schema real de reglas custom", {
  # Si el candidato no valida, el analista recibe una propuesta que no puede
  # guardar — el sembrado sería decorativo.
  d <- .sem_base(c(rep("vNueva", 8), rep("vVieja", 2)))
  p <- reglas_semilla_procedencia(d)[[1]]
  expect_no_error(.validar_regla_custom(p))
})

test_that("lo propuesto, evaluado, marca exactamente los casos de la versión no vigente", {
  # El aserto que de verdad verifica: se compila con el compilador real y se
  # evalúa sobre la base. Sin esto, un candidato bien formado pero con la
  # versión equivocada pasaría igual.
  d <- .sem_base(c(rep("vNueva", 8), rep("vVieja", 2)))
  p <- reglas_semilla_procedencia(d)[[1]]

  expr <- .regla_expr_fuera_catalogo("`__version__`", p$params)
  marcados <- which(as.logical(eval(parse(text = expr), envir = d)))

  expect_identical(marcados, 9:10)
  expect_true(all(d[["__version__"]][marcados] == "vVieja"))
})

test_that("no vuelve a proponer lo que ya está cubierto", {
  # Idempotencia: sin esto, cada carga acumula el mismo criterio otra vez.
  d <- .sem_base(c(rep("vNueva", 8), rep("vVieja", 2)))
  ya <- list(list(id = "RC_001", tipo = "fuera_catalogo",
                  variables = list("__version__"), params = list(valores = list("vNueva"))))
  expect_length(reglas_semilla_procedencia(d, ya), 0L)

  # Pero un criterio sobre OTRA variable no lo cubre.
  otra <- list(list(id = "RC_001", tipo = "fuera_catalogo",
                    variables = list("p1"), params = list(valores = list("a"))))
  expect_length(reglas_semilla_procedencia(d, otra), 1L)
})

test_that("desempata por el envío más reciente cuando las versiones están parejas", {
  # 5 y 5: la mayoría no decide. Manda la última que llegó, porque una versión
  # se publica y a partir de ahí se usa.
  d <- .sem_base(c(rep("vVieja", 5), rep("vNueva", 5)))
  p <- reglas_semilla_procedencia(d)[[1]]
  expect_identical(unlist(p$params$valores), "vNueva")
})

test_that("el sembrador no nombra variables de ningún proyecto", {
  # V1 de la vara: solo metadatos de plataforma y roles declarados.
  fuente <- readLines(
    testthat::test_path("..", "..", "R", "reglas_custom_semilla.R"),
    warn = FALSE
  )
  prohibidas <- c("name_ppl", "Pulso_code", "telephone", "emp_impact",
                  "Em_NowWork", "Enumerator_name", "proyecto_ppl")
  for (v in prohibidas) {
    expect_false(any(grepl(v, fuente, fixed = TRUE)),
                 info = sprintf("el sembrador menciona '%s'", v))
  }
})

test_that("reglas_semilla_todas reúne lo de cada sembrador", {
  d <- .sem_base(c(rep("vNueva", 8), rep("vVieja", 2)))
  expect_length(reglas_semilla_todas(d), 1L)
  expect_length(reglas_semilla_todas(.sem_base(rep("vA", 5))), 0L)
})

# --- Lote 2 · dominio de las preguntas de opción única -----------------------

.sem_survey <- function() {
  data.frame(
    name = c("p_sexo", "p_nse", "p_texto"),
    type_base = c("select_one", "select_one", "text"),
    list_name = c("lst_sexo", "lst_nse", NA),
    stringsAsFactors = FALSE
  )
}
.sem_choices <- function() {
  data.frame(
    list_name = c("lst_sexo", "lst_sexo", "lst_nse", "lst_nse", "lst_nse"),
    name = c("1", "2", "A", "B", "C"),
    label = c("Hombre", "Mujer", "Alto", "Medio", "Bajo"),
    stringsAsFactors = FALSE
  )
}

test_that("no propone dominio cuando todos los valores están en catálogo", {
  # Control negativo del sembrador de dominio.
  d <- data.frame(p_sexo = c("1", "2", "1"), p_nse = c("A", "B", "C"),
                  p_texto = c("x", "y", "z"), stringsAsFactors = FALSE)
  expect_length(reglas_semilla_dominio(d, .sem_survey(), .sem_choices()), 0L)
})

test_that("propone una regla por variable con valores fuera de su lista", {
  d <- data.frame(p_sexo = c("1", "2", "9"),      # 9 no existe
                  p_nse = c("A", "B", "C"),        # todas válidas
                  p_texto = c("x", "y", "z"),
                  stringsAsFactors = FALSE)
  props <- reglas_semilla_dominio(d, .sem_survey(), .sem_choices())

  expect_length(props, 1L)
  p <- props[[1]]
  expect_identical(unlist(p$variables), "p_sexo")
  expect_identical(unlist(p$semilla$valores_fuera), "9")
  expect_identical(p$semilla$n_casos_afectados, 1L)
  # El catálogo admitido incluye los especiales de la casa.
  expect_true(all(c("1", "2", "98", "99") %in% unlist(p$params$valores)))
})

test_that("los valores especiales de la casa no se reportan como fuera de catálogo", {
  # Sin esta tolerancia, toda pregunta que use 98/99 sin declararlos en choices
  # produciría un falso positivo por caso.
  d <- data.frame(p_sexo = c("1", "98", "99"), p_nse = c("A", "B", "C"),
                  p_texto = c("x", "y", "z"), stringsAsFactors = FALSE)
  expect_length(reglas_semilla_dominio(d, .sem_survey(), .sem_choices()), 0L)
})

test_that("lo propuesto por dominio es insertable y marca los casos correctos", {
  d <- data.frame(p_sexo = c("1", "2", "9", "7"), p_nse = c("A", "B", "C", "A"),
                  p_texto = c("x", "y", "z", "w"), stringsAsFactors = FALSE)
  p <- reglas_semilla_dominio(d, .sem_survey(), .sem_choices())[[1]]

  expect_no_error(.validar_regla_custom(p))
  expr <- .regla_expr_fuera_catalogo("p_sexo", p$params)
  expect_identical(which(as.logical(eval(parse(text = expr), envir = d))), 3:4)
})

test_that("dominio ignora preguntas que no son select_one ni están en la base", {
  d <- data.frame(p_texto = c("libre", "texto"), stringsAsFactors = FALSE)
  expect_length(reglas_semilla_dominio(d, .sem_survey(), .sem_choices()), 0L)
})

test_that("todo lo sembrado sale marcado con su origen", {
  # L12: sin esta marca, 100 criterios sembrados entierran los que una persona
  # escribió con criterio propio.
  d <- .sem_base(c(rep("vNueva", 8), rep("vVieja", 2)),
                 extra = list(p_sexo = c(rep("1", 9), "9")))
  props <- reglas_semilla_todas(d, list(), .sem_survey(), .sem_choices())

  expect_length(props, 2L)                       # procedencia + dominio
  expect_true(all(vapply(props, function(p) identical(p$origen, "sembrado"), logical(1))))
})

test_that("el origen por defecto es manual y solo admite valores conocidos", {
  expect_identical(.regla_origen(list()), "manual")
  expect_identical(.regla_origen(list(origen = "sembrado")), "sembrado")
  expect_identical(.regla_origen(list(origen = "inventado")), "manual")
})

# --- Lote 3 · identidad del caso y del agente -------------------------------

.sem_cfg <- function(agente = "", llaves = character(0), enabled = TRUE) {
  list(identity = list(enabled = enabled, variables = llaves, agent_variable = agente))
}

test_that("no propone agente si el estudio no declaró el rol", {
  # V1 de la vara: sin declaración no se adivina la columna. Este es el control
  # que impide que el sembrador termine nombrando variables de un proyecto.
  d <- data.frame(quien = c("Ana Perez", "Ana Perez", "Ana Prez"),
                  stringsAsFactors = FALSE)
  expect_length(reglas_semilla_agente(d, NULL), 0L)
  expect_length(reglas_semilla_agente(d, .sem_cfg(agente = "")), 0L)
  # Declarada una columna que no existe en la base, tampoco.
  expect_length(reglas_semilla_agente(d, .sem_cfg(agente = "otra_col")), 0L)
})

test_that("no propone agente cuando los nombres del equipo están limpios", {
  d <- data.frame(quien = c(rep("Ana Perez", 5), rep("Luis Diaz", 4)),
                  stringsAsFactors = FALSE)
  expect_length(reglas_semilla_agente(d, .sem_cfg(agente = "quien")), 0L)
})

test_that("propone agente ante una variante del mismo nombre", {
  d <- data.frame(
    quien = c(rep("Ana Perez", 6), rep("Luis Diaz", 5), "Ana Prez"),
    stringsAsFactors = FALSE
  )
  props <- reglas_semilla_agente(d, .sem_cfg(agente = "quien"))
  expect_length(props, 1L)
  p <- props[[1]]
  expect_identical(unlist(p$variables), "quien")
  expect_identical(unlist(p$semilla$variantes), "Ana Prez")
  # El catálogo admitido es el equipo depurado, sin la variante.
  expect_setequal(unlist(p$params$valores), c("Ana Perez", "Luis Diaz"))
  expect_no_error(.validar_regla_custom(p))
})

test_that("propone agente cuando el campo trae algo que no es un nombre", {
  d <- data.frame(
    quien = c(rep("Ana Perez", 6), rep("Luis Diaz", 5), "987654321"),
    stringsAsFactors = FALSE
  )
  p <- reglas_semilla_agente(d, .sem_cfg(agente = "quien"))[[1]]
  expect_identical(unlist(p$semilla$variantes), "987654321")
})

test_that("lo propuesto por agente marca exactamente las variantes", {
  d <- data.frame(
    quien = c(rep("Ana Perez", 6), rep("Luis Diaz", 5), "Ana Prez"),
    stringsAsFactors = FALSE
  )
  p <- reglas_semilla_agente(d, .sem_cfg(agente = "quien"))[[1]]
  expr <- .regla_expr_fuera_catalogo("quien", p$params)
  expect_identical(which(as.logical(eval(parse(text = expr), envir = d))), 12L)
})

test_that("identidad_candidatas perfila llaves y agentes sin nombrar nada", {
  d <- data.frame(
    codigo = sprintf("C%03d", 1:20),               # llave: 20/20 distintos
    quien = rep(c("Ana", "Luis"), each = 10),      # agente: 2 distintos
    respuesta = rep(c("1", "2", "3", "4"), 5),     # ni una cosa ni la otra
    stringsAsFactors = FALSE
  )
  out <- identidad_candidatas(d)
  expect_identical(vapply(out$llaves, function(x) x$variable, character(1)), "codigo")
  expect_true("quien" %in% vapply(out$agentes, function(x) x$variable, character(1)))
  expect_false("codigo" %in% vapply(out$agentes, function(x) x$variable, character(1)))
})

test_that("operational_config declara identidad y valida contra las variables reales", {
  cfg <- normalize_validation_operational_config(
    list(version = 2L,
         identity = list(enabled = TRUE, variables = list("codigo"), agent_variable = "quien")),
    available_variables = c("codigo", "quien")
  )
  expect_true(cfg$identity$enabled)
  expect_identical(cfg$identity$variables, "codigo")
  expect_identical(cfg$identity$agent_variable, "quien")

  # Rol declarado sobre una variable que no está en la base: se corta.
  err <- tryCatch(normalize_validation_operational_config(
    list(version = 2L,
         identity = list(enabled = TRUE, variables = list("no_existe"))),
    available_variables = c("codigo", "quien")
  ), error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_OPERATIONAL_VARIABLE_UNKNOWN")

  # Activado sin llaves: incompleto.
  err2 <- tryCatch(normalize_validation_operational_config(
    list(version = 2L, identity = list(enabled = TRUE, variables = list()))
  ), error = function(e) e)
  expect_identical(err2$code, "E_OPERATIONAL_IDENTITY_INCOMPLETE")
})

test_that("la config sin identidad sigue siendo válida: el default no rompe proyectos viejos", {
  cfg <- normalize_validation_operational_config(list(version = 2L))
  expect_false(cfg$identity$enabled)
  expect_identical(cfg$identity$variables, character(0))
  expect_identical(cfg$identity$agent_variable, "")
})

test_that("el sugeridor de agentes prefiere lo que parece un nombre de persona", {
  # Sin esta señal, ordenar por cardinalidad pone primero toda dicotómica y deja
  # al encuestador fuera del top: en un proyecto real quedaba en el puesto 7.
  d <- data.frame(
    equipo = rep(c("Ana Perez", "Luis Diaz", "Rosa Vega"), length.out = 30),
    abierta = rep(sprintf("respuesta %02d", 1:15), 2),
    dicotomica = rep(c("Si", "No"), 15),
    stringsAsFactors = FALSE
  )
  agentes <- vapply(identidad_candidatas(d)$agentes, function(x) x$variable, character(1))
  expect_identical(agentes[1], "equipo")
})

# --- Lote 4 · continuidad de la secuencia de envíos -------------------------

test_that("no propone continuidad cuando la secuencia está completa", {
  d <- data.frame(`_index` = 1:10, check.names = FALSE)
  expect_length(reglas_semilla_continuidad(d), 0L)
})

test_that("propone continuidad cuando faltan envíos", {
  d <- data.frame(`_index` = c(1:5, 7:10), check.names = FALSE)   # falta el 6
  props <- reglas_semilla_continuidad(d)
  expect_length(props, 1L)
  p <- props[[1]]
  expect_identical(p$tipo, "continuidad_secuencia")
  expect_identical(unlist(p$semilla$faltantes), 6L)
  expect_no_error(.validar_regla_custom(p))
})

test_that("continuidad marca la fila anterior a cada hueco, y nunca el último caso", {
  # La anomalía no es de ninguna fila presente: son las que faltan. Se marca la
  # que precede al hueco, que es la información accionable.
  d <- data.frame(`_index` = c(1, 2, 3, 5, 6, 9), check.names = FALSE)
  expr <- .regla_expr_continuidad_secuencia("`_index`")
  marcados <- which(as.logical(eval(parse(text = expr), envir = d)))
  # 3 precede al hueco del 4; 6 precede al del 7. El 9 es el máximo: después no
  # falta nada, simplemente no hay más.
  expect_identical(marcados, c(3L, 5L))
})

test_that("continuidad exige exactamente una variable", {
  err <- tryCatch(.validar_regla_custom(list(
    tipo = "continuidad_secuencia", variables = list("a", "b")
  )), error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_REGLA_SECUENCIA_VARS")
})

test_that("el tipo nuevo compila por el dispatch real", {
  r <- list(id = "RC_900", tipo = "continuidad_secuencia",
            variables = list("_index"), nombre = "Continuidad", mensaje = "x")
  out <- .compilar_regla_custom(r)
  # El compilador devuelve la fila del plan con nombres humanos: `Procesamiento`
  # es la columna con la expresión R, no `procesamiento`.
  expect_true(grepl(".sq_", as.character(out$Procesamiento), fixed = TRUE))
})

# --- Lote 5 · cruce señal x identidad ---------------------------------------

.sem_cruce_base <- function(llaves, inicios, fines) {
  data.frame(k = llaves, ini = inicios, fin = fines, stringsAsFactors = FALSE)
}

test_that("no marca nada cuando comparten llave pero no se solapan", {
  # Control: la llave repetida sola no basta. Dos entrevistas al mismo hogar,
  # una después de la otra, son legítimas.
  d <- .sem_cruce_base(
    c("tel1", "tel1"),
    c("2026-08-03T10:00:00", "2026-08-03T12:00:00"),
    c("2026-08-03T11:00:00", "2026-08-03T13:00:00")
  )
  expr <- .regla_expr_cruce_identidad(c("ini", "fin", "k"))
  expect_identical(which(as.logical(eval(parse(text = expr), envir = d))), integer(0))
})

test_that("no marca nada cuando se solapan pero no comparten llave", {
  # Control: el solape solo mide una propiedad del `end`, que se corre si el
  # formulario queda abierto. Sin identidad compartida no afirma nada.
  d <- .sem_cruce_base(
    c("tel1", "tel2"),
    c("2026-08-03T10:00:00", "2026-08-03T10:30:00"),
    c("2026-08-03T12:00:00", "2026-08-03T11:00:00")
  )
  expr <- .regla_expr_cruce_identidad(c("ini", "fin", "k"))
  expect_identical(which(as.logical(eval(parse(text = expr), envir = d))), integer(0))
})

test_that("marca los dos casos cuando coinciden identidad y solape", {
  d <- .sem_cruce_base(
    c("tel1", "tel1", "tel2"),
    c("2026-08-03T10:00:00", "2026-08-03T10:30:00", "2026-08-03T15:00:00"),
    c("2026-08-03T12:00:00", "2026-08-03T11:00:00", "2026-08-03T16:00:00")
  )
  expr <- .regla_expr_cruce_identidad(c("ini", "fin", "k"))
  expect_identical(which(as.logical(eval(parse(text = expr), envir = d))), 1:2)
})

test_that("la llave puede ser una tupla de varias variables", {
  d <- data.frame(
    tel = c("t1", "t1", "t1"),
    quien = c("A", "A", "B"),          # solo las dos primeras comparten tupla
    ini = c("2026-08-03T10:00:00", "2026-08-03T10:30:00", "2026-08-03T10:15:00"),
    fin = c("2026-08-03T12:00:00", "2026-08-03T11:00:00", "2026-08-03T11:30:00"),
    stringsAsFactors = FALSE
  )
  expr <- .regla_expr_cruce_identidad(c("ini", "fin", "tel", "quien"))
  expect_identical(which(as.logical(eval(parse(text = expr), envir = d))), 1:2)
})

test_that("cruce_identidad exige inicio, fin y al menos una llave", {
  err <- tryCatch(.validar_regla_custom(list(
    tipo = "cruce_identidad", variables = list("ini", "fin")
  )), error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_REGLA_CRUCE_VARS")
})

test_that("cruce_identidad compila por el dispatch real", {
  r <- list(id = "RC_901", tipo = "cruce_identidad",
            variables = list("start", "end", "telephone"),
            nombre = "Cruce", mensaje = "x")
  out <- .compilar_regla_custom(r)
  expect_true(grepl(".k_", as.character(out$Procesamiento), fixed = TRUE))
})
