# TXT-8/9 (O3b-a, plan-texto-abierto-ccss-2026-10-24): la aprobación de citas acepta una versión editada por el analista.
# `citas_aprobadas` sigue aceptando la lista de ids y además objetos `{id, texto, sic}`:
#   - `texto` sólo vale si es un RECORTE del original (fragmentos contiguos, «[…]» donde se quitó algo) o una CORRECCIÓN
#     LEVE (hasta dos letras por palabra, sin palabras nuevas). Si no, se dibuja el original y se avisa.
#   - `sic = TRUE` dibuja el original con «[sic]» tras las palabras marcadas o, sin marcas, al final.
#   - El motor nunca corrige solo. Fixture sintético.

.ce_orig <- "Los docentes deberían tener más pdoer de decisión. Algunos del curso de estadística son muy malos y no explican nada."

test_that("una corrección leve (pdoer → poder) se acepta como corrección", {
  v <- .citas_validar_edicion(.ce_orig, sub("pdoer", "poder", .ce_orig))
  expect_true(v$ok)
  expect_identical(v$tipo, "correccion")
  expect_identical(v$texto, sub("pdoer", "poder", .ce_orig))
  # Una tilde o una letra cambiada también; un acento en una palabra corta, también.
  expect_true(.citas_validar_edicion("No hay adceso a la biblioteca", "No hay acceso a la biblioteca")$ok)
  expect_true(.citas_validar_edicion("ojala sirva la encuesta", "ojalá sirva la encuesta")$ok)
})

test_that("un recorte a la primera oración, o con «[…]» donde se quitó algo, se acepta como recorte", {
  v <- .citas_validar_edicion(.ce_orig, "Los docentes deberían tener más pdoer de decisión.")
  expect_true(v$ok); expect_identical(v$tipo, "recorte")
  v <- .citas_validar_edicion(.ce_orig, "Los docentes deberían tener más pdoer de decisión. Algunos del curso […] no explican nada.")
  expect_true(v$ok); expect_identical(v$tipo, "recorte")
  # «[...]» con tres puntos se lee como «[…]» y se dibuja tipográfico.
  v <- .citas_validar_edicion(.ce_orig, "Los docentes deberían tener más pdoer [...] decisión.")
  expect_true(v$ok); expect_match(v$texto, "pdoer […] decisión", fixed = TRUE)
  # Recorte y corrección a la vez: las dos marcas.
  v <- .citas_validar_edicion(.ce_orig, "Los docentes deberían tener más poder de decisión.")
  expect_true(v$ok); expect_setequal(v$tipo, c("recorte", "correccion"))
})

test_that("un texto inventado, una palabra nueva o un corte a media frase sin «[…]» se rechazan con su causa", {
  v <- .citas_validar_edicion(.ce_orig, "La facultad es excelente y todos los cursos son buenos.")
  expect_false(v$ok); expect_true(nzchar(v$motivo))
  v <- .citas_validar_edicion(.ce_orig, sub("más pdoer", "mucho más poder", .ce_orig))
  expect_false(v$ok)
  v <- .citas_validar_edicion(.ce_orig, "Los docentes deberían tener más pdoer")          # corta a media frase sin marca
  expect_false(v$ok)
  v <- .citas_validar_edicion(.ce_orig, sub("malos", "buenos", .ce_orig))                 # cambia el sentido: no es errata
  expect_false(v$ok)
  v <- .citas_validar_edicion("No hay sillas suficientes en el aula", "Sí hay sillas suficientes en el aula")
  expect_false(v$ok)                                                                       # palabra corta: sólo tildes
})

test_that("sic marca las palabras pedidas o, sin marcas, el final; una marca que no está se avisa", {
  s <- .citas_marcar_sic("Más pdoer, y adceso.", c("pdoer", "adceso"))
  expect_identical(s$texto, "Más pdoer [sic], y adceso [sic].")
  expect_length(s$no_encontradas, 0L)
  expect_identical(.citas_marcar_sic("Más pdoer.", character(0))$texto, "Más pdoer. [sic]")
  s <- .citas_marcar_sic("Más pdoer.", "fantasma")
  expect_identical(s$no_encontradas, "fantasma")
  expect_identical(s$texto, "Más pdoer. [sic]")
})

test_that("citas_aprobadas acepta ids sueltos y objetos {id, texto, sic}; p_citas guarda ids y ediciones aparte", {
  n <- .citas_aprobadas_normalizar(list("c0000000001", list(id = "c0000000002", texto = "Uno."),
                                        list(id = "c0000000003", sic = TRUE), list(id = "c0000000004", sic = list("pdoer"))))
  expect_identical(n$ids, sprintf("c%010d", 1:4))
  expect_null(n$ediciones[["c0000000001"]])
  expect_identical(n$ediciones[["c0000000002"]]$texto, "Uno.")
  expect_true(n$ediciones[["c0000000003"]]$sic)
  expect_identical(n$ediciones[["c0000000004"]]$sic_palabras, "pdoer")
  # Un data.frame (JSON simplificado) también.
  df <- data.frame(id = c("c1", "c2"), texto = c(NA, "Dos."), sic = c(TRUE, FALSE), stringsAsFactors = FALSE)
  n2 <- .citas_aprobadas_normalizar(df)
  expect_identical(n2$ids, c("c1", "c2")); expect_true(n2$ediciones$c1$sic); expect_identical(n2$ediciones$c2$texto, "Dos.")
  el <- p_citas("coment", citas_aprobadas = list(list(id = "c0000000002", texto = "Uno."), "c0000000001"))
  expect_identical(el$citas_aprobadas, c("c0000000002", "c0000000001"))
  expect_identical(el$citas_ediciones[["c0000000002"]]$texto, "Uno.")
  expect_identical(p_citas("coment", citas_aprobadas = list("c1", "c2"))$citas_aprobadas, c("c1", "c2"))   # compatibilidad
})

.ce_fx <- function() c(
  .ce_orig,
  "Faltan espacios de estudio con enchufes; la biblioteca se llena desde temprano y no hay adceso en grupo.",
  "Los cursos de métodos deberían tener más práctica con bases de datos reales y menos teoría repetida de otros cursos.")

test_that("la selección dibuja la edición válida, el original ante la inválida (y lo avisa) y nunca corrige sola", {
  s0 <- .citas_seleccionar(.ce_fx())
  id <- s0$candidatas$id[match(.ce_fx(), s0$candidatas$texto)]
  ed <- list()
  ed[[id[1]]] <- list(texto = "Los docentes deberían tener más poder de decisión.")      # recorte + corrección
  ed[[id[2]]] <- list(texto = "La universidad no escucha a nadie.")                         # inventado
  ed[[id[3]]] <- list(sic = TRUE)
  s <- .citas_seleccionar(.ce_fx(), aprobadas = id, ediciones = ed, min_citas = 1L)
  expect_false(s$borrador)
  expect_identical(s$elegidas$texto[1], "Los docentes deberían tener más poder de decisión.")
  expect_identical(s$elegidas$texto[2], .ce_fx()[2])
  expect_identical(s$elegidas$texto[3], paste(.ce_fx()[3], "[sic]"))
  expect_identical(s$elegidas$ajuste, c("recorte+correccion", "rechazada", "sic"))
  expect_true(any(grepl("no es un recorte ni una corrección leve", s$avisos)))
  # Sin ediciones, el texto es el original: «adceso» no se corrige solo.
  s2 <- .citas_seleccionar(.ce_fx(), aprobadas = id, min_citas = 1L)
  expect_identical(s2$elegidas$texto, .ce_fx())
  expect_identical(s2$elegidas$ajuste, rep("", 3))
})
