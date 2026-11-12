# Reglas sugeridas desde el formulario (ítem 28 del checklist del practicante).
#
# Lo que el XLSForm declara y el plan del formulario no revisa, propuesto como
# regla propia lista para revisar, con los casos que marcaría hoy. Lo que el
# plan ya revisa (obligatorias, saltos en los dos sentidos, restricciones) no se
# propone: duplicaría hallazgos en cuanto se lee el plan.

.sf_survey <- function() {
  data.frame(
    type = c("integer", "integer", "text", "integer", "select_one sino"),
    name = c("ubigeo", "edad", "dni", "hijos", "p8"),
    label = c("Ubigeo del distrito", "Edad", "DNI", "Número de hijos", "¿Trabaja?"),
    required = c("yes", "yes", "", "", "yes"),
    relevant = c("", "", "", "", ""),
    constraint = c(". >= 100000 and . <= 999999", ". >= 16 and . <= 25",
                   "string-length(.) = 8", "", ""),
    stringsAsFactors = FALSE
  )
}

.sf_datos <- function() {
  data.frame(
    ubigeo = c("080105", "150101", "080108", "150128", "40101"),
    edad = c(18, 20, 22, 19, 24),
    dni = c("01234567", "12345678", "87654321", "11223344", "44332211"),
    hijos = c("0", "2", "1.5", "NO SABE", "3"),
    p8 = c("1", "2", "1", "2", "1"),
    stringsAsFactors = FALSE
  )
}

test_that("una restricción de rango que equivale a k dígitos se propone como formato si la base trae ceros iniciales", {
  props <- reglas_semilla_formulario(.sf_datos(), .sf_survey())
  dig <- Filter(function(p) identical(p$semilla$origen, "formulario_digitos"), props)
  expect_length(dig, 1L)
  p <- dig[[1]]
  expect_identical(p$tipo, "formato")
  expect_identical(unlist(p$variables), "ubigeo")
  expect_identical(p$params$modo, "digitos")
  expect_identical(p$params$largo_min, 6L)
  expect_identical(p$params$largo_max, 6L)
  # Hoy marca solo "40101" (5 dígitos); los dos "08..." pasan, la restricción numérica los marcaría.
  expect_identical(p$semilla$n_casos_hoy, 1L)
  expect_identical(p$semilla$n_cero_inicial, 2L)
  # La regla se puede guardar tal cual.
  expect_silent(.validar_regla_custom(p))
  # Sin comillas angulares ni punto medio en lo que se muestra.
  textos <- c(p$nombre, p$mensaje, p$semilla$porque)
  expect_false(any(grepl("«|»|·", textos)))
  expect_match(p$semilla$porque, "080105", fixed = TRUE)
})

test_that("un rango que no es de k dígitos o una base sin ceros iniciales no proponen formato", {
  datos <- .sf_datos()
  datos$ubigeo <- c("150101", "150128", "150130", "150131", "150132")
  props <- reglas_semilla_formulario(datos, .sf_survey())
  expect_length(Filter(function(p) identical(p$semilla$origen, "formulario_digitos"), props), 0L)
})

test_that("una pregunta declarada entera con decimales o texto propone el formato de número entero", {
  props <- reglas_semilla_formulario(.sf_datos(), .sf_survey())
  ent <- Filter(function(p) identical(p$semilla$origen, "formulario_entero"), props)
  expect_identical(vapply(ent, function(p) unlist(p$variables), ""), "hijos")
  p <- ent[[1]]
  expect_identical(p$tipo, "formato")
  expect_identical(p$params$modo, "digitos")
  expect_null(p$params$largo_min)
  expect_identical(p$semilla$n_casos_hoy, 2L)   # "1.5" y "NO SABE"
  expect_silent(.validar_regla_custom(p))
  # La edad, entera y con su rango, no se propone: el plan ya la revisa.
  expect_false("edad" %in% vapply(props, function(p) unlist(p$variables)[1], ""))
})

test_that("lo que el plan ya revisa no se propone: obligatorias, saltos y restricciones", {
  props <- reglas_semilla_formulario(.sf_datos(), .sf_survey())
  tipos <- vapply(props, function(p) p$tipo, "")
  expect_false(any(tipos %in% c("no_nulo", "condiciones", "rango_num")))
  # Ni el DNI: su largo de 8 lo revisa el plan como texto, sin perder el cero.
  expect_false("dni" %in% vapply(props, function(p) unlist(p$variables)[1], ""))
})

test_that("si ya existe una regla de formato sobre la pregunta, no se propone otra", {
  existente <- list(list(tipo = "formato", variables = list("ubigeo"), params = list(modo = "digitos")),
                    list(tipo = "formato", variables = list("hijos"), params = list(modo = "digitos")))
  expect_length(reglas_semilla_formulario(.sf_datos(), .sf_survey(), existente), 0L)
})

test_that("las sugeridas de la base llevan los casos que marcan hoy y las del formulario entran en el total", {
  survey <- .sf_survey()
  choices <- data.frame(list_name = c("sino", "sino"), name = c("1", "2"), label = c("Sí", "No"),
                        stringsAsFactors = FALSE)
  survey$type_base <- sub(" .*", "", survey$type)
  survey$list_name <- ifelse(grepl("^select_", survey$type), sub("^\\S+\\s+", "", survey$type), NA_character_)
  datos <- .sf_datos()
  datos$p8[2] <- "7"
  todas <- reglas_semilla_todas(datos, list(), survey = survey, choices = choices)
  origenes <- vapply(todas, function(p) p$semilla$origen, "")
  expect_true(all(c("dominio", "formulario_digitos", "formulario_entero") %in% origenes))
  dom <- todas[[which(origenes == "dominio")]]
  expect_identical(dom$semilla$n_casos_hoy, 1L)
})
