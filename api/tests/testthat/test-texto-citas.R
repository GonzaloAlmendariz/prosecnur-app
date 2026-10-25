# TXT-4 (plan-texto-abierto-ccss-2026-10-24): selección determinista de citas representativas del comentario abierto.
# Candidatas de 40 a 280 caracteres con contenido; orden por raíces frecuentes; descarte por solape de más del 60 %;
# una por persona; empates con semilla fija. Anonimato: correo, teléfono y URL se borran con «[…]» y los nombres
# propios se marcan para revisión. Fixture sintético: nada sale de un estudio real.

.citas_fx <- function() {
  data.frame(
    id = sprintf("r%02d", 1:16),
    coment = c(
      "-", "no", "Ninguno",
      "Muy corto el horario",
      "La biblioteca de sociales debería abrir más horas, porque los espacios de estudio no alcanzan en época de exámenes.",
      "La biblioteca de sociales debería abrir más horas porque los espacios de estudio no alcanzan en exámenes",
      "Faltan espacios de estudio con enchufes; la biblioteca se llena desde temprano y no hay dónde trabajar en grupo.",
      "Los cursos de métodos deberían tener más práctica con bases de datos reales y menos teoría repetida de otros cursos.",
      "Me gustó el curso porque la profesora Rosales explicó muy bien los métodos cualitativos y el trabajo de campo.",
      "Como dice Bourdieu, el capital cultural pesa: necesitamos tutorías para quienes vienen de colegios públicos.",
      "Escríbanme a alumno.prueba@correo.pe o al 987 654 321 si quieren más detalles sobre los horarios de los cursos.",
      "Revisen https://ejemplo.org/encuesta para ver la propuesta de horarios de cursos y tutorías del ciclo pasado.",
      paste(rep("Los horarios de los cursos cambian cada ciclo y eso complica organizar el trabajo y el estudio.", 4), collapse = " "),
      "q' buena encuesta, ojala sirva pa mejorar los horarios de los cursos y las tutorias del ciclo",
      "Quisiera que la cafetería tenga opciones vegetarianas y precios accesibles para todos los estudiantes.",
      NA
    ),
    coment_recod = c(NA, NA, NA, NA, "A", "A", "A C", "B", "B", "C", "B", "B C", "B", "B", "AB", NA),
    stringsAsFactors = FALSE
  )
}

test_that("el anonimato borra correo, teléfono y URL con «[…]» y no corrige la ortografía", {
  x <- .citas_anonimizar(c(
    "Escríbanme a alumno.prueba@correo.pe o al 987 654 321 si quieren más detalles",
    "Revisen https://ejemplo.org/encuesta para ver la propuesta",
    "  q' buena encuesta,\n ojala sirva pa mejorar  ",
    "\"Entre comillas rectas\""))
  expect_identical(x[1], "Escríbanme a […] o al […] si quieren más detalles")
  expect_identical(x[2], "Revisen […] para ver la propuesta")
  expect_identical(x[3], "q' buena encuesta, ojala sirva pa mejorar")      # sólo se colapsan los espacios
  expect_identical(x[4], "Entre comillas rectas")                          # la lámina pone sus propias comillas
  expect_false(any(grepl("@|https?://|\\d{3} \\d{3}", x)))
})

test_that("las candidatas son comentarios con contenido de 40 a 280 caracteres, ya anonimizados", {
  d <- .citas_fx()
  s <- .citas_seleccionar(d$coment)
  expect_identical(s$base, 12L)                                            # 15 escribieron, 3 no respuestas
  expect_identical(s$escribieron, 15L)
  ch <- nchar(s$candidatas$texto)
  expect_true(all(ch >= 40 & ch <= 280))
  expect_false(any(grepl("Muy corto", s$candidatas$texto)))               # 20 caracteres
  expect_false(any(grepl("cambian cada ciclo", s$candidatas$texto)))      # más de 280
  expect_false(any(grepl("@", s$candidatas$texto)))
  expect_true(any(grepl("q' buena encuesta, ojala sirva pa", s$candidatas$texto, fixed = TRUE)))
})

test_that("propone de 3 a 5 citas, sin dos casi iguales, y en borrador mientras nadie las apruebe", {
  s <- .citas_seleccionar(.citas_fx()$coment)
  expect_true(s$borrador)
  k <- nrow(s$elegidas)
  expect_gte(k, 3L); expect_lte(k, 5L)
  # Las dos versiones del pedido de la biblioteca comparten más del 60 % de sus raíces: entra una sola.
  expect_identical(sum(grepl("^La biblioteca de sociales debería abrir más horas", s$elegidas$texto)), 1L)
  expect_true(all(s$elegidas$id %in% s$candidatas$id))
  expect_true(all(s$candidatas$propuesta[match(s$elegidas$id, s$candidatas$id)]))
  expect_true(any(grepl("sin aprobar", s$avisos)))
})

test_that("la selección es determinista: mismo resultado e ids con las filas en otro orden", {
  d <- .citas_fx()
  a <- .citas_seleccionar(d$coment)
  set.seed(99); o <- sample(nrow(d))
  b <- .citas_seleccionar(d$coment[o])
  expect_identical(a$elegidas$id, b$elegidas$id)
  expect_identical(sort(a$candidatas$id), sort(b$candidatas$id))
  expect_match(a$candidatas$id, "^c[0-9a-f]{10}$")
  # La semilla no toca el generador de números aleatorios de la sesión.
  set.seed(1); r1 <- stats::runif(1); set.seed(1); invisible(.citas_seleccionar(d$coment)); r2 <- stats::runif(1)
  expect_identical(r1, r2)
})

test_that("una sola cita por persona", {
  txt <- c("La biblioteca de sociales necesita más horas de atención durante la época de exámenes finales.",
           "Los cursos de métodos necesitan más práctica con bases de datos y software estadístico.",
           "Las tutorías deberían empezar desde el primer ciclo para quienes vienen de colegios públicos.",
           "Los horarios de los cursos electivos se cruzan con los obligatorios y no permiten elegir.")
  s <- .citas_seleccionar(txt, personas = c("p1", "p1", "p2", "p3"))
  expect_identical(anyDuplicated(s$elegidas$persona), 0L)
  expect_identical(nrow(s$elegidas), 3L)
})

test_that("un nombre propio de persona se marca para revisión; un autor citado, una sigla o el inicio de frase no", {
  r <- .citas_revision(c(
    "Me gustó el curso porque la profesora Rosales explicó muy bien los métodos.",
    "Como dice Bourdieu, el capital cultural pesa en la PUCP y en la Facultad.",
    "Excelente curso. Gracias por todo.",
    "el profe juan nos ayudó bastante con la tesis"))
  expect_match(r[1], "Rosales", fixed = TRUE)
  expect_identical(r[2], "")
  expect_identical(r[3], "")
  expect_match(r[4], "juan", fixed = TRUE)
  s <- .citas_seleccionar(.citas_fx()$coment)
  rev <- s$candidatas$revision[grepl("Rosales", s$candidatas$texto)]
  expect_match(rev, "Rosales", fixed = TRUE)
  expect_true(any(grepl("Rosales", s$candidatas$texto)))                 # se marca, no se borra
})

test_that("cortar una cita usa «[…]» en límite de palabra", {
  x <- "Los cursos de métodos deberían tener más práctica con bases de datos reales y menos teoría repetida."
  y <- .citas_cortar(x, 50)
  expect_true(endsWith(y, " […]"))
  expect_lte(nchar(y), 50)
  cuerpo <- sub(" \\[…\\]$", "", y)
  expect_true(startsWith(x, cuerpo))
  expect_true(substr(x, nchar(cuerpo) + 1L, nchar(cuerpo) + 1L) %in% c(" ", ","))   # no corta una palabra
  expect_identical(.citas_cortar("Corto y entero.", 50), "Corto y entero.")
})

test_that("las aprobadas mandan: se dibujan ésas, en su orden, y las que ya no están se avisan", {
  s0 <- .citas_seleccionar(.citas_fx()$coment)
  ids <- rev(s0$candidatas$id[1:3])
  s <- .citas_seleccionar(.citas_fx()$coment, aprobadas = c(ids, "c0000000000"))
  expect_false(s$borrador)
  expect_identical(s$elegidas$id, ids)
  expect_identical(s$faltantes, "c0000000000")
  expect_true(any(grepl("ya no", s$avisos)))
  # Ninguna aprobada sigue en la base: vuelve al borrador, con aviso.
  s2 <- .citas_seleccionar(.citas_fx()$coment, aprobadas = "c0000000000")
  expect_true(s2$borrador)
  expect_true(any(grepl("sin aprobar", s2$avisos)))
})

test_that("el filtro por un código de Codificación casa el código dentro de una respuesta multicódigo", {
  d <- .citas_fx()
  m <- .citas_filtro_codigos(d, list(coment_recod = "B"))
  expect_identical(m$coment_recod, c("B", "B", "B", "B C", "B", "B"))
  expect_false("AB" %in% m$coment_recod)                                   # «AB» es otro código
  # El resto de los filtros sigue su camino: aquí no se toca.
  sep <- .citas_separar_filtros(list(coment_recod = "B", sexo = "1"), names(d))
  expect_identical(names(sep$codigos), "coment_recod")
  expect_identical(names(sep$resto), "sexo")
})

test_that("TXT-2: una lámina de frases sólo alcanza con cinco frases que usen tres personas o más", {
  expect_false(.txt_ngramas_alcanza(.citas_fx()$coment)$alcanza)
  muchas <- rep(c("biblioteca de sociales", "espacios de estudio", "cursos de métodos", "bases de datos",
                  "trabajo de campo"), each = 3)
  a <- .txt_ngramas_alcanza(paste("Necesitamos", muchas, "ahora"))
  expect_true(a$alcanza); expect_identical(a$frases, 5L)
})
