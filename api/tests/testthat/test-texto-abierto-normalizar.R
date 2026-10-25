# TXT-1 (plan-texto-abierto-ccss-2026-10-24): normalización del texto abierto para la nube limpia del comentario
# final. Funciones puras: no respuestas, palabras vacías, raíz (sólo flexiones), frases y conteo por persona.

test_that("las no respuestas se reconocen y el contenido no se confunde con ellas", {
  nr <- c("-", ".", "no", "No.", "Ninguno", "nada", "Ninguna, gracias", "no tengo comentarios", "Todo bien",
          "nop todo okey", "no lo tengo", "gaaaa", "N/A", "   ", NA, "jajaja", "no, nada que agregar")
  expect_true(all(.txt_no_respuesta(nr)))
  si <- c("No hay enchufes en las aulas", "Mejorar la biblioteca de sociales", "mejorar los jps", "más cursos",
          "Nada funciona en el laboratorio")
  expect_false(any(.txt_no_respuesta(si)))
})

test_that("las palabras vacías funcionales incluyen las de base y las de opinión son otra lista", {
  base <- .txt_palabras_vacias("base")
  expect_true(all(c("de", "la", "que", "no") %in% base))
  fun <- .txt_palabras_vacias("funcionales")
  expect_true(all(base %in% fun))
  op <- .txt_palabras_vacias("opinion")
  expect_true(all(c("deberian", "considero", "creo", "gustaria") %in% op))
  expect_false(any(c("curso", "biblioteca", "laboral", "estudiante", "docente", "profesor") %in% c(fun, op)))
})

test_that("la raíz agrupa plurales y formas verbales frecuentes, no sinónimos", {
  r <- .txt_raiz(c("cursos", "curso", "profesores", "sociales", "universidades", "estudiantes", "veces", "clases",
                   "tesis", "aulas", "mejoren", "mejorar", "mejoran", "docentes", "alumnos", "estudio", "estudiar"))
  expect_identical(unname(r[c(1, 2)]), c("curso", "curso"))
  expect_identical(unname(r[3]), "profesor")
  expect_identical(unname(r[4]), "social")
  expect_identical(unname(r[5]), "universidad")
  expect_identical(unname(r[6]), "estudiante")
  expect_identical(unname(r[7]), "vez")
  expect_identical(unname(r[8]), "clase")
  expect_identical(unname(r[9]), "tesis")
  expect_identical(unname(r[10]), "aula")
  expect_identical(unname(r[11:13]), rep("mejorar", 3))          # el infinitivo está en el corpus: las formas se le unen
  expect_identical(unname(r[14]), "docente")
  expect_false(r[[3]] == r[[14]])                                  # profesores ≠ docentes
  expect_false(r[[15]] == r[[6]])                                  # alumnos ≠ estudiantes
  expect_false(r[[16]] == r[[6]])                                  # estudio ≠ estudiante
  # Sin el infinitivo en el corpus, la forma verbal queda sola.
  expect_identical(unname(.txt_raiz("mejoren")), "mejoren")
  # Las equivalencias son opcionales y explícitas.
  r2 <- .txt_raiz(c("profesores", "docentes"), equivalencias = c(profesor = "docente"))
  expect_identical(unname(r2), c("docente", "docente"))
})

test_that("las frases que usan tres personas o más se unen como un término", {
  txt <- c("La biblioteca de sociales cierra temprano", "más horas en la biblioteca de sociales",
           "Biblioteca de Sociales sin enchufes", "la biblioteca central", "espacios de estudio", "espacio de estudio")
  fr <- .txt_frases(.txt_tokens(txt), min_personas = 3)
  expect_true("biblioteca de social" %in% fr$clave)
  expect_identical(fr$forma[fr$clave == "biblioteca de social"], "biblioteca de sociales")
  expect_identical(fr$personas[fr$clave == "biblioteca de social"], 3L)
  expect_false("espacio de estudio" %in% fr$clave)                  # dos personas: no llega
})

test_that("se cuentan personas, no apariciones, y se muestra la forma más frecuente", {
  txt <- c("cursos cursos cursos y más cursos", "un curso práctico", "cursos de verano", "biblioteca", "la biblioteca",
           "Deberían mejorar los cursos, considero")
  t <- .txt_conteo_terminos(txt, contar = "personas", lematizar = TRUE, min_personas = 1)
  expect_identical(t$n[t$palabra == "cursos"], 4)                  # cuatro personas, no siete apariciones
  expect_false("curso" %in% t$palabra)                              # una sola fila por raíz
  expect_identical(t$n[t$palabra == "biblioteca"], 2)
  expect_false(any(c("deberían", "considero", "no") %in% t$palabra))
  t3 <- .txt_conteo_terminos(txt, contar = "personas", lematizar = TRUE, min_personas = 3)
  expect_identical(t3$palabra, "cursos")
  # Con menciones y lematizado se suman las apariciones de la raíz.
  tm <- .txt_conteo_terminos(txt, contar = "menciones", lematizar = TRUE)
  expect_identical(tm$n[tm$palabra == "cursos"], 7)
})

test_that("la frase es un término propio y no le quita la persona a sus palabras", {
  txt <- c("biblioteca de sociales", "la biblioteca de sociales", "Biblioteca de sociales cerrada", "biblioteca central")
  t <- .txt_conteo_terminos(txt, contar = "personas", lematizar = TRUE, min_personas = 1)
  n <- stats::setNames(t$n, t$palabra)
  expect_identical(unname(n["biblioteca de sociales"]), 3)
  expect_identical(unname(n["biblioteca"]), 4)                      # quien dice la frase usa la raíz
  expect_identical(unname(n["sociales"]), 3)
})
