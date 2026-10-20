# El índice de refs de /plan/coverage (graficos_plan_coverage.R) responde lo mismo que comparar ref por ref con
# `.graficos_ref_matches_var`, que es la definición. Se agregó por velocidad (Arte, 2026-10-20): recorrer la lista por
# cada variable era la mitad del endpoint, que ocupa el hilo de Plumber delante de la lectura del Top Two Box.

test_that(".graficos_is_var_ref_in con índice equivale a comparar ref por ref", {
  refs <- list("docentes$p1", "p2", " estudiantes$p3 ", NULL, NA, "", "$p4", "docentes$p5$x", list("administrativos$p6"))
  ind <- .graficos_ref_indice(refs)
  casos <- expand.grid(source = c("docentes", "estudiantes", "administrativos", ""),
                       name = c("p1", "p2", "p3", "p4", "p5", "p5$x", "p6", "p9", ""),
                       stringsAsFactors = FALSE)
  for (i in seq_len(nrow(casos))) {
    s <- casos$source[i]; n <- casos$name[i]
    esperado <- any(vapply(refs, .graficos_ref_matches_var, logical(1), source = s, name = n))
    expect_identical(.graficos_is_var_ref_in(ind, s, n), esperado, info = paste(s, n))
    expect_identical(.graficos_is_var_ref_in(refs, s, n), esperado, info = paste("sin índice", s, n))
  }
  expect_false(.graficos_is_var_ref_in(list(), "docentes", "p1"))
  expect_false(.graficos_is_var_ref_in(.graficos_ref_indice(character()), "docentes", "p1"))
})
