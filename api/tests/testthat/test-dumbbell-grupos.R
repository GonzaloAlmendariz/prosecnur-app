source("setup-load-all.R")

# G17 (Gonzalo, 2026-10-13: «el lollipop de brechas también era un gráfico bastante interesante»; elegido: dos grupos de
# una base, como la lámina 250 del diseño). `p_dumbbell` con `cruce` y `grupos` compara dos grupos de una misma base.
.db_sources <- function() {
  set.seed(11); n <- 200
  d <- data.frame(sexo = rep(c("1", "2"), each = n / 2), a = c(rep("4", 80), rep("1", 20), rep("4", 50), rep("1", 50)),
                  b = sample(c("1", "2", "3", "4"), n, TRUE), stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = c("sexo", "a", "b"), type = c("select_one sx", "select_one esc", "select_one esc"),
                                   label = c("Sexo", "Pregunta A", "Pregunta B"), stringsAsFactors = FALSE),
               choices = data.frame(list_name = c("sx", "sx", rep("esc", 4)), name = c("1", "2", "1", "2", "3", "4"),
                                    label = c("Mujer", "Hombre", "Nada", "Poco", "Algo", "Mucho"), stringsAsFactors = FALSE))
  list(data_sources = list(b1 = d), inst_sources = list(b1 = inst))
}

test_that("la brecha entre dos grupos se calcula pregunta por pregunta, con el nombre de cada grupo", {
  src <- .db_sources()
  temas <- .dumbbell_grupos_temas(c("b1$a", "b1$b"), src)
  expect_identical(names(temas), c("Pregunta A", "Pregunta B"))
  d <- .dumbbell_grupos_datos(temas, "4", "b1$sexo", c("1", "2"), src)
  expect_identical(levels(d$grupo), c("Mujer", "Hombre"))
  a <- d[d$eje == "Pregunta A", ]
  expect_equal(a$valor, c(80, 50))
  expect_equal(a$n, c(100, 100))
})

test_that("el constructor con cruce pide dos grupos y no exige dos bases", {
  el <- p_dumbbell(vars = list("b1$a", "b1$b"), corte = list("3", "4"), cruce = "b1$sexo", grupos = list("1", "2"))
  expect_identical(el$cruce, "b1$sexo")
  expect_identical(el$grupos, c("1", "2"))
  expect_identical(el$corte, "3,4")
  expect_error(p_dumbbell(vars = list("b1$a"), corte = "4", cruce = "b1$sexo", grupos = "1"), "dos grupos")
})

test_that("una pregunta de otra base que el cruce se rechaza con un motivo claro", {
  src <- .db_sources(); src$data_sources$b2 <- src$data_sources$b1; src$inst_sources$b2 <- src$inst_sources$b1
  expect_error(.dumbbell_grupos_datos(list(X = "b2$a"), "4", "b1$sexo", c("1", "2"), src), "misma base")
})
