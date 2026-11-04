source("setup-load-all.R")

# Lenguaje inclusivo con paréntesis (Gonzalo, revisión del PPT v7 de CCSS, lámina 18): la barra pasa a paréntesis en
# todo texto del job, de forma uniforme para que etiquetas, datos y plan sigan casando.

test_that("las barras de género pasan a paréntesis y lo demás no se toca", {
  x <- c("Abuelos/as", "de los/las estudiantes", "¿Cómo te sientes más cómodo/a estudiando?", "Tíos/as y primos/as",
         "Todos/Todas", "alumno/alumna", "Automóvil y/o moto", "1/2 de las clases", "Hasta secundaria completa", NA)
  expect_identical(.inclusivo_parentesis(x),
                   c("Abuelos(as)", "de los(as) estudiantes", "¿Cómo te sientes más cómodo(a) estudiando?", "Tíos(as) y primos(as)",
                     "Todos(as)", "alumno(a)", "Automóvil y/o moto", "1/2 de las clases", "Hasta secundaria completa", NA))
  expect_identical(.inclusivo_parentesis(.inclusivo_parentesis(x)), .inclusivo_parentesis(x))   # idempotente
  expect_identical(.inclusivo_parentesis(c("con las/los docentes", "el/la tutor(a)", "mis padres/tutores")),
                   c("con las(os) docentes", "el(la) tutor(a)", "mis padres/tutores"))
})

test_that("se aplica a valores, nombres, niveles de factor y etiquetas de haven, sin tocar rutas", {
  d <- data.frame(id = 1:2, quien = c("Abuelos/as", "Tíos/as"), f = factor(c("Hermanos/as", "Hermanos/as")), stringsAsFactors = FALSE)
  inst <- list(path = "/tmp/a/os/form.xlsx", dicc_label_to_code = list(crianza = c(`Abuelos/as` = "1")),
               choices = data.frame(name = "1", label = "Abuelos/as"))
  d2 <- .inclusivo_en(d); i2 <- .inclusivo_en(inst)
  expect_identical(d2$quien, c("Abuelos(as)", "Tíos(as)"))
  expect_identical(levels(d2$f), "Hermanos(as)")
  expect_identical(names(i2$dicc_label_to_code$crianza), "Abuelos(as)")
  expect_identical(i2$choices$label, "Abuelos(as)")
  expect_identical(i2$path, "/tmp/a/os/form.xlsx")
  expect_identical(names(d2), names(d))
  attr(d, "instrumento_reporte") <- list(choices = data.frame(label = "Tíos/as"))
  expect_identical(attr(.inclusivo_en(d), "instrumento_reporte")$choices$label, "Tíos(as)")
  h <- structure(c(1, 2), labels = c(`Abuelos/as` = 1, `Tíos/as` = 2), class = c("haven_labelled", "vctrs_vctr", "double"))
  expect_identical(names(attr(.inclusivo_en(h), "labels")), c("Abuelos(as)", "Tíos(as)"))
  ch <- structure(c("Abuelos/as", "Tíos/as"), label = "¿Cómo te sientes más cómodo/a?", labels = c(`Abuelos/as` = "Abuelos/as"))
  ch2 <- .inclusivo_en(ch)
  expect_identical(attr(ch2, "label"), "¿Cómo te sientes más cómodo(a)?")
  expect_identical(names(attr(ch2, "labels")), "Abuelos(as)")
  expect_identical(as.vector(ch2), c("Abuelos(as)", "Tíos(as)"))
  rec <- structure(c("1", "2"), labels = c(`1` = "Abuelos/as", `2` = "Tíos/as"))   # recodificada: código = etiqueta
  expect_identical(unname(attr(.inclusivo_en(rec), "labels")), c("Abuelos(as)", "Tíos(as)"))
  expect_identical(names(attr(.inclusivo_en(rec), "labels")), c("1", "2"))
})

test_that("el job trabaja sobre copias: los RDS originales no cambian", {
  f <- tempfile(fileext = ".rds"); saveRDS(list(default = data.frame(x = "Abuelos/as")), f)
  r <- .inclusivo_preparar_job(f, f, list(slides = list(list(payload = list(titulo = "Tíos/as")))))
  expect_false(identical(r$data, f))
  expect_identical(readRDS(f)$default$x, "Abuelos/as")
  expect_identical(readRDS(r$data)$default$x, "Abuelos(as)")
  expect_identical(r$plan$slides[[1]]$payload$titulo, "Tíos(as)")
  expect_identical(.inclusivo_preparar_job(f, f, list(), activo = FALSE)$data, f)
})

test_that("los rótulos cortos del estudio reemplazan el rótulo entero en datos, instrumento y plan, nunca un pedazo", {
  largo <- "Por beca de estudios (puede ser beca 18 o alguna otra beca externa a la universidad a la que se haya accedido)"
  f <- tempfile(fileext = ".rds")
  saveRDS(list(default = data.frame(x = c(largo, "Trabajo", paste(largo, "y más")), stringsAsFactors = FALSE)), f)
  plan <- list(rotulos_cortos = stats::setNames(list("Por beca (Beca 18 u otra externa)"), largo),
               slides = list(list(payload = list(titulo = "T", orden = largo))))
  r <- .inclusivo_preparar_job(f, f, plan)
  expect_identical(readRDS(r$data)$default$x, c("Por beca (Beca 18 u otra externa)", "Trabajo", paste(largo, "y más")))
  expect_identical(r$plan$slides[[1]]$payload$orden, "Por beca (Beca 18 u otra externa)")
  expect_identical(names(r$plan$rotulos_cortos), largo)   # el mapa mismo no se reescribe
  sin <- .inclusivo_preparar_job(f, f, list(slides = list()))
  expect_identical(readRDS(sin$data)$default$x[1], largo)
})
