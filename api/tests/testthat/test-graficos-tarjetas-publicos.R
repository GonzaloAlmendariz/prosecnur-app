source("setup-load-all.R")

# Tarjetas de diferencias entre públicos (ADR 0138). Los doce casos de la revisión metodológica del 2026-11-08, más el
# render del contraste de dos públicos (PPT y Word) y el contrato HTTP del inspector.
#
# Las cifras del caso 1 son las de Arte (propósitos claros y servicio de salud, Top Two Box): con muestreo aleatorio
# simple y pesos 1 la prueba z depende sólo de los conteos, así que la base sintética reproduce los seis p ajustados de
# la tabla retirada (ADR 0137). Arte no declara equivalencias: la matriz de los casos 5 se arma en memoria.

# ---- Fixtures --------------------------------------------------------------------------------------------------------

.tp_acuerdo <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo")
.tp_inst <- function(etq = .tp_acuerdo, cod = c("1", "2", "3", "4"), vars = c("p1", "p2"), repeat_group = NULL) {
  i <- list(survey = data.frame(name = vars, type = "select_one lk", label = paste("Pregunta", vars), stringsAsFactors = FALSE),
            choices = data.frame(list_name = "lk", name = cod, label = etq, stringsAsFactors = FALSE), orders_list = NULL)
  if (!is.null(repeat_group)) i$repeat_group <- repeat_group
  i
}
# x casos en el Top Two Box (códigos `ttb`) de n válidos; N filas en total (las demás sin respuesta).
.tp_col <- function(x, n, N = n, ttb = c("3", "4"), resto = c("1", "2")) {
  c(rep(ttb, length.out = x), rep(resto, length.out = n - x), rep(NA_character_, N - n))
}
.tp_arte <- function() {
  ds <- list(docentes = data.frame(p1 = .tp_col(87, 93, 115), p2 = .tp_col(71, 115), stringsAsFactors = FALSE),
             estudiantes = data.frame(p1 = .tp_col(147, 184, 279), p2 = .tp_col(233, 279), stringsAsFactors = FALSE),
             administrativos = data.frame(p1 = .tp_col(68, 70, 85), p2 = .tp_col(73, 85), stringsAsFactors = FALSE))
  list(data_sources = ds, inst_sources = stats::setNames(rep(list(.tp_inst()), 3), names(ds)))
}
.tp_vars_arte <- list(proposito = c("docentes$p1", "estudiantes$p1", "administrativos$p1"),
                      salud = c("docentes$p2", "estudiantes$p2", "administrativos$p2"))
.tp_regla <- function(prueba = "z", correccion = "bonferroni_fila") {
  r <- .sig_regla_fabrica(); r$prueba <- prueba; r$correccion <- correccion; r
}
.tp_opt <- function(...) .tpub_opcion(list(tarjetas_diferencias = list(entre_publicos = TRUE, ...)))
.tp_calc <- function(src, vars, regla = .tp_regla(), equiv = NULL, vars_lamina = vars, ...) {
  .tpub_calcular(.tpub_temas_declarados(vars, vars_lamina, equiv), "3,4", src, regla, .tp_opt(), ...)
}
.tp_tema <- function(r, tema) Filter(function(te) identical(te$tema, tema), r$temas)[[1]]

# El cálculo de la tabla retirada (graficos_significancia_publicos.R, 6766488c1), como oráculo: z con proporción combinada
# por par y Bonferroni dentro de la fila.
.tp_legado <- function(x, n) {
  K <- ncol(x); pares <- utils::combn(K, 2)
  pv <- matrix(NA_real_, nrow(x), ncol(pares))
  for (i in seq_len(nrow(x))) for (k in seq_len(ncol(pares))) {
    a <- pares[1, k]; b <- pares[2, k]
    pp <- (x[i, a] + x[i, b]) / (n[i, a] + n[i, b]); se <- sqrt(pp * (1 - pp) * (1 / n[i, a] + 1 / n[i, b]))
    pv[i, k] <- 2 * stats::pnorm(-abs((x[i, a] / n[i, a] - x[i, b] / n[i, b]) / se))
  }
  t(apply(pv, 1, stats::p.adjust, method = "bonferroni"))
}

# ---- 1. Paridad con la tabla retirada ---------------------------------------------------------------------------------

test_that("1. con z y Bonferroni por fila reproduce los seis p ajustados de la tabla retirada", {
  r <- .tp_calc(.tp_arte(), .tp_vars_arte)
  padj <- unlist(lapply(r$temas, function(te) .tpub_pares(te)$p_ajustado))
  esperado <- c(0.009104, 0.8791, 0.001966, 8.596e-06, 0.0005114, 1)
  expect_equal(sort(padj), sort(esperado), tolerance = 1e-3)
  x <- rbind(c(87, 147, 68), c(71, 233, 73)); n <- rbind(c(93, 184, 70), c(115, 279, 85))
  expect_equal(sort(padj), sort(as.vector(.tp_legado(x, n))), tolerance = 1e-9)
  # Y agrega lo que la tabla no tenía: el umbral y el veredicto por par, con los públicos de Arte.
  pr <- .tpub_pares(.tp_tema(r, "proposito"))
  expect_identical(pr$veredicto[pr$a == "docentes" & pr$b == "estudiantes"], "marcada")
  expect_identical(pr$dif_pp[pr$a == "docentes" & pr$b == "estudiantes"], 14)
  expect_identical(pr$veredicto[pr$a == "administrativos" & pr$b == "docentes"], "no_significativa")
  expect_true(all(r$temas[[1]]$ev$pares$a != ".resto"))   # pares, nunca frente al resto
})

# ---- 2. Rao-Scott contra survey ---------------------------------------------------------------------------------------

test_that("2. Rao-Scott apilado por público coincide con survey::svyby sobre un diseño estratificado por público", {
  skip_if_not_installed("survey")
  set.seed(138)
  aulas <- rep(sprintf("a%02d", 1:20), each = 8)
  efecto <- stats::rnorm(20, 0, 0.8)[as.integer(factor(aulas))]
  A <- data.frame(aula = aulas, p1 = ifelse(stats::runif(160) < stats::plogis(0.9 + efecto), "4", "1"),
                  peso = round(stats::runif(160, 0.6, 1.8), 3), stringsAsFactors = FALSE)
  B <- data.frame(p1 = ifelse(stats::runif(150) < 0.55, "3", "2"), peso = 1.3, stringsAsFactors = FALSE)
  src <- list(data_sources = list(docentes = A, estudiantes = B),
              inst_sources = list(docentes = .tp_inst(vars = "p1"), estudiantes = .tp_inst(vars = "p1")))
  regla <- .tp_regla("rao_scott"); regla$conglomerado <- "aula"
  r <- .tp_calc(src, list(t = c("docentes$p1", "estudiantes$p1")), regla)
  te <- r$temas[[1]]
  par <- te$ev$pares
  df <- data.frame(y = c(as.numeric(A$p1 %in% c("3", "4")), as.numeric(B$p1 %in% c("3", "4"))),
                   publico = rep(c("docentes", "estudiantes"), c(160, 150)),
                   cl = c(paste0("docentes:", A$aula), paste0("estudiantes:", seq_len(150))), w = c(A$peso, B$peso))
  des <- survey::svydesign(ids = ~cl, strata = ~publico, weights = ~w, data = df)
  est <- survey::svyby(~y, ~publico, des, survey::svymean, covmat = TRUE)
  V <- stats::vcov(est); m <- stats::coef(est)
  se_survey <- sqrt(V[1, 1] + V[2, 2] - 2 * V[1, 2])
  expect_equal(unname(te$ev$celdas$p[match(c("docentes", "estudiantes"), te$ev$celdas$grupo)]), unname(m), tolerance = 1e-10)
  expect_equal(par$se, se_survey, tolerance = 1e-8)
  expect_equal(abs(par$dif), abs(unname(m[1] - m[2])), tolerance = 1e-10)
  # Grados de libertad: el mínimo del par (19 aulas − 1 estrato frente a 149), no los del apilado.
  expect_identical(as.integer(par$gl), 19L)
  expect_equal(par$p, 2 * stats::pt(-abs(par$dif / se_survey), df = 19), tolerance = 1e-8)
})

# ---- 3. Base mínima ---------------------------------------------------------------------------------------------------

test_that("3. un público bajo la base mínima no se compara (sobre respuestas válidas sin ponderar)", {
  src <- .tp_arte()
  src$data_sources$administrativos <- data.frame(p1 = .tp_col(18, 20, 85), p2 = .tp_col(18, 20, 85), stringsAsFactors = FALSE)
  r <- .tp_calc(src, .tp_vars_arte)
  te <- .tp_tema(r, "salud")
  gr <- .tpub_grupos(te)
  expect_false(gr$comparable[gr$base == "administrativos"])
  expect_identical(gr$n[gr$base == "administrativos"], 20)   # 85 filas, 20 válidas
  expect_match(gr$motivo[gr$base == "administrativos"], "no se compara")
  pr <- .tpub_pares(te)
  expect_true(all(pr$veredicto[pr$a == "administrativos" | pr$b == "administrativos"] == "no_comparable"))
  expect_identical(pr$veredicto[pr$a == "estudiantes" & pr$b == "docentes"], "marcada")
  # La tarjeta no menciona al público que no se comparó.
  t <- Filter(function(x) identical(x$fila, "salud"), r$tarjetas)[[1]]
  expect_false(any(grepl("Administrativos", t$lineas)))
})

# ---- 4. Denominador cero ----------------------------------------------------------------------------------------------

test_that("4. un público sin respuestas válidas da NA sin error", {
  src <- .tp_arte()
  src$data_sources$administrativos$p2 <- NA_character_
  expect_no_error(r <- .tp_calc(src, .tp_vars_arte))
  te <- .tp_tema(r, "salud")
  gr <- .tpub_grupos(te)
  expect_true(is.na(gr$p[gr$base == "administrativos"]))
  expect_identical(gr$n[gr$base == "administrativos"], 0)
  expect_false(gr$comparable[gr$base == "administrativos"])
  pr <- .tpub_pares(te)
  sin <- pr$a == "administrativos" | pr$b == "administrativos"
  expect_true(all(pr$veredicto[sin] == "no_comparable") && all(is.na(pr$p_ajustado[sin])))
  # Con dos públicos de tres sin datos, el tema se abstiene entero.
  src$data_sources$estudiantes$p2 <- NA_character_
  te2 <- .tp_tema(.tp_calc(src, .tp_vars_arte), "salud")
  expect_identical(te2$estado, "abstencion")
})

# ---- 5. Equivalencia declarada ----------------------------------------------------------------------------------------

test_that("5. un tema sin equivalencia, o emparejado por nombre, se rechaza; la matriz o el par explícito lo declaran", {
  src <- .tp_arte()
  vars <- list(proposito = c("docentes$p1", "estudiantes$p1"))
  # Lo que la regla expande de `base$*` (pares por nombre) no declara nada.
  comodin <- list(`Preguntas comunes` = c("docentes$*", "estudiantes$*"))
  tt <- .tpub_temas_declarados(vars, comodin, equiv = NULL)
  expect_true(is.na(tt[[1]]$equivalencia))
  r <- .tp_calc(src, vars, vars_lamina = comodin)
  expect_identical(r$temas[[1]]$estado, "sin_equivalencia")
  expect_length(r$tarjetas, 0L)
  expect_true(all(.tpub_pares(r$temas[[1]])$veredicto == "sin_equivalencia"))
  # La matriz de equivalencias (en memoria: Arte no la declara) sí lo declara...
  equiv <- list(bases = c("docentes", "estudiantes"),
                filas = list(list(etiqueta_estandar = "Propósitos claros", variables = list(docentes = "p1", estudiantes = "p1"))))
  expect_identical(.tpub_temas_declarados(vars, comodin, equiv)[[1]]$equivalencia, "matriz")
  # ...salvo una fila sugerida sin confirmar.
  equiv$filas[[1]]$sugerida <- TRUE
  expect_true(is.na(.tpub_temas_declarados(vars, comodin, equiv)[[1]]$equivalencia))
  # El par explícito de la lámina (lo que escribe «Revisar emparejado») es un par confirmado.
  expect_identical(.tpub_temas_declarados(vars, vars, NULL)[[1]]$equivalencia, "emparejado")
})

# ---- 6. Escalas distintas ---------------------------------------------------------------------------------------------

test_that("6. escalas de tema distinto (acuerdo frente a satisfacción) se abstienen", {
  src <- .tp_arte()
  src$inst_sources$estudiantes <- .tp_inst(etq = c("Muy insatisfecho", "Insatisfecho", "Satisfecho", "Muy satisfecho"))
  r <- .tp_calc(src, .tp_vars_arte)
  te <- .tp_tema(r, "proposito")
  expect_identical(te$estado, "escalas_distintas")
  expect_identical(te$motivo, "escalas distintas, no se compara")
  expect_true(all(.tpub_pares(te)$veredicto == "escalas_distintas"))
  expect_length(r$tarjetas, 0L)
})

# ---- 7. Top Two Box por posición --------------------------------------------------------------------------------------

test_that("7. el Top Two Box con códigos distintos por base se resuelve por posición", {
  src <- .tp_arte()
  cod_b <- c("10", "20", "30", "40")
  src$inst_sources$estudiantes <- .tp_inst(cod = cod_b)
  src$data_sources$estudiantes <- data.frame(p1 = .tp_col(147, 184, 279, ttb = c("30", "40"), resto = c("10", "20")),
                                             p2 = .tp_col(233, 279, ttb = c("30", "40"), resto = c("10", "20")),
                                             stringsAsFactors = FALSE)
  cod <- .tpub_codigos_por_base(c(docentes = "p1", estudiantes = "p1"), "3,4", src)
  expect_true(cod$ok)
  expect_identical(cod$codigos$estudiantes, c("30", "40"))
  r <- .tp_calc(src, .tp_vars_arte)
  gr <- .tpub_grupos(.tp_tema(r, "proposito"))
  expect_equal(gr$p[gr$base == "estudiantes"], 100 * 147 / 184)
  # Mismos p ajustados que con los códigos de siempre.
  r0 <- .tp_calc(.tp_arte(), .tp_vars_arte)
  expect_equal(.tpub_pares(.tp_tema(r, "proposito"))$p_ajustado, .tpub_pares(.tp_tema(r0, "proposito"))$p_ajustado)
})

# ---- 8. Filtro sobre una columna ausente ------------------------------------------------------------------------------

test_that("8. un filtro sobre una columna que una base no tiene hace abstenerse a esa base", {
  src <- .tp_arte()
  for (b in c("docentes", "estudiantes")) src$data_sources[[b]]$sexo <- rep(c("1", "2"), length.out = nrow(src$data_sources[[b]]))
  r <- .tp_calc(src, .tp_vars_arte, filtros = list(sexo = "1"))
  te <- .tp_tema(r, "salud")
  gr <- .tpub_grupos(te)
  expect_false(gr$comparable[gr$base == "administrativos"])
  expect_match(gr$motivo[gr$base == "administrativos"], "\"sexo\"", fixed = TRUE)
  expect_true(gr$comparable[gr$base == "docentes"])
  expect_identical(gr$n[gr$base == "estudiantes"], 140)   # el filtro sí se aplicó donde existe
})

# ---- 9. Base repeat ---------------------------------------------------------------------------------------------------

test_that("9. una base repeat se abstiene", {
  src <- .tp_arte()
  src$inst_sources$administrativos <- .tp_inst(repeat_group = "visitas")
  te <- .tp_tema(.tp_calc(src, .tp_vars_arte), "salud")
  gr <- .tpub_grupos(te)
  expect_false(gr$comparable[gr$base == "administrativos"])
  expect_match(gr$motivo[gr$base == "administrativos"], "grupo repetido")
  expect_true(all(.tpub_pares(te)$veredicto[.tpub_pares(te)$a == "administrativos" | .tpub_pares(te)$b == "administrativos"] == "no_comparable"))
})

# ---- 10. Conciliación con el gráfico ----------------------------------------------------------------------------------

test_that("10. si las cifras de la prueba no cuadran con el gráfico, el tema se abstiene", {
  src <- .tp_arte()
  bien <- list(salud = c(docentes = 100 * 71 / 115, estudiantes = 100 * 233 / 279, administrativos = 100 * 73 / 85))
  r <- .tp_calc(src, .tp_vars_arte["salud"], referencia = bien)
  expect_identical(r$temas[[1]]$estado, "evaluable")
  expect_length(r$tarjetas, 1L)
  mal <- bien; mal$salud[["estudiantes"]] <- mal$salud[["estudiantes"]] + 1
  r2 <- .tp_calc(src, .tp_vars_arte["salud"], referencia = mal)
  expect_identical(r2$temas[[1]]$estado, "abstencion")
  expect_identical(r2$temas[[1]]$motivo, .TPUB_MOTIVO_NO_CUADRA)
  expect_length(r2$tarjetas, 0L)
  expect_true(all(.tpub_pares(r2$temas[[1]])$veredicto == "no_comparable"))
})

# ---- 11. Dos públicos: la tarjeta de dos grupos -----------------------------------------------------------------------

test_that("11. con dos públicos la tarjeta es la de dos grupos del ADR 0129 (sin fila Total)", {
  src <- .tp_arte()
  r <- .tpub_calcular(.tpub_temas_declarados(list(salud = c("docentes$p2", "estudiantes$p2"))), "3,4", src, .tp_regla(),
                      .tpub_opcion(list(tarjetas_diferencias = list(entre_publicos = TRUE,
                                                                     cortos = list(docentes = "docentes", estudiantes = "estudiantes")))))
  tp <- r$tarjetas[[1]]
  # La misma comparación como cruce de dos grupos dentro de una base (los dos públicos apilados).
  pila <- data.frame(q = ifelse(c(src$data_sources$docentes$p2, src$data_sources$estudiantes$p2) %in% c("3", "4"), "1", "2"),
                     publico = rep(c("docentes", "estudiantes"), c(115, 279)), stringsAsFactors = FALSE)
  fuente <- list(data = pila, survey = NULL, choices = NULL, orders_list = NULL)
  ev <- .tarjetas_evaluar_cruce(fuente, "q", "publico", .tp_regla(), familia = NULL, filas = "1")
  tg <- .tarjetas_seleccionar(ev$pruebas, ev$celdas, ev$grupos, ev$totales, "dicotomica", "publico", filas_visibles = "1")[[1]]
  expect_identical(tp$grupos[, c("codigo", "etiqueta", "dir", "fragil")], tg$grupos[, c("codigo", "etiqueta", "dir", "fragil")])
  expect_equal(tp$grupos$p, tg$grupos$p)
  expect_identical(tp$fragil, tg$fragil)
  expect_equal(tp$brecha, tg$brecha)
  expect_true(all(names(tg) %in% names(tp)))                    # la forma de la tarjeta de dos grupos, entera
  # Sin Total: entre públicos exigiría padrones.
  expect_true(isTRUE(tp$sin_total)); expect_true(is.na(tp$total)); expect_null(tp$lineas)
  expect_identical(tp$tipo, "entre_publicos"); expect_identical(r$rotulos_cruce[[tp$cruce]], "Entre públicos")
})

test_that("11b. con tres o más públicos, una línea por par marcado: 99 % primero, luego por diferencia, tope de cuatro", {
  r <- .tp_calc(.tp_arte(), .tp_vars_arte)
  t <- Filter(function(x) identical(x$fila, "salud"), r$tarjetas)[[1]]
  expect_identical(t$lineas, c("Administrativos\u00a086% frente a Docentes\u00a062%: +24\u00a0pp\u00a0▲",
                               "Estudiantes\u00a084% frente a Docentes\u00a062%: +22\u00a0pp\u00a0▲"))
  expect_false(grepl("«|»", paste(t$lineas, collapse = "")))   # comillas rectas en lo visible
  pares <- data.frame(veredicto = c("fragil", "marcada", "marcada", "marcada", "marcada", "marcada"),
                      p_a = c(90, 60, 70, 80, 75, 65), p_b = c(10, 50, 50, 50, 50, 50), stringsAsFactors = FALSE)
  v <- .tpub_pares_visibles(pares, .tp_regla())
  expect_identical(nrow(v), 4L)
  expect_identical(v$veredicto, rep("marcada", 4))           # la frágil de 80 puntos va después de las del 99 %
  expect_identical(v$p_a - v$p_b, c(30, 25, 20, 15))
  rr <- .tp_regla(); rr$fragiles <- "ocultar"
  expect_false(any(.tpub_pares_visibles(pares, rr)$veredicto == "fragil"))
  hay_fr <- .tpub_hay_fragiles(r$tarjetas)
  expect_identical(r$nota, paste0("Diferencias entre públicos (muestras independientes): prueba z, p < 0.05 con corrección de ",
                                  "Bonferroni dentro de cada tema, al menos 10 puntos y 30 casos por público.",
                                  if (hay_fr) " △ Frágil: p ajustado entre 0.01 y 0.05." else ""))
})

# ---- 12. Familia propia -----------------------------------------------------------------------------------------------

test_that("12. la familia entre públicos no cambia ninguna letra de la familia de una base", {
  set.seed(12)
  src <- .tp_arte()
  d <- src$data_sources$estudiantes
  d$sexo <- sample(c("1", "2"), nrow(d), replace = TRUE)
  d$p2[d$sexo == "1"] <- ifelse(stats::runif(sum(d$sexo == "1")) < 0.95, "4", "1")
  src$data_sources$estudiantes <- d
  regla <- .tp_regla("z", "bh_informe")
  plan_base <- list(slides = list(list(id = "b1", payload = list(list(graficador = "p_barras_agrupadas",
                                                                      args = list(var = "p2", cruces = "sexo"))))))
  cfg <- list(significancia = regla, plan = plan_base)
  letras <- function() {
    ctx <- .sig_contexto_estudio(d, src$inst_sources$estudiantes, cfg, list())
    ev <- .sig_veredictos(.sig_evaluar_pregunta(.sig_fuente(d, src$inst_sources$estudiantes), "p2", "sexo", ctx$regla),
                          ctx$regla, ctx$familia)
    list(familia = ctx$familia, marcas = ev$marcas, pares = ev$pares[, c("fila", "a", "b", "p_ajustado", "veredicto")])
  }
  antes <- letras()
  expect_gt(antes$familia$m, 0L)                                # la base tiene su familia de BH...
  expect_gt(NROW(antes$marcas), 0L)                             # ...y letras que podrían cambiar
  plan_pub <- list(slides = list(list(id = "c1", payload = list(meta = list(tarjetas_diferencias = list(entre_publicos = TRUE)),
                                                                list(graficador = "p_dumbbell", args = list(vars = .tp_vars_arte, corte = list("3", "4")))))))
  fam <- .tpub_familia_plan(plan_pub, src, NULL, regla)
  expect_identical(fam$m, 6L)                                   # sólo los seis pares entre públicos
  r <- .tp_calc(src, .tp_vars_arte, regla, familia = fam$tabla)
  expect_false(isTRUE(r$familia$local))
  despues <- letras()
  expect_identical(despues, antes)                              # ninguna letra de la base cambia
  expect_false(identical(fam$tabla, antes$familia))             # y no son el mismo objeto
  # El contexto del informe lleva las dos familias por separado.
  ctx <- .tpub_en_contexto(list(regla = regla, familia = antes$familia), plan_pub, src, NULL)
  expect_identical(ctx$familia, antes$familia)
  expect_identical(ctx$familia_publicos, fam$tabla)
})

# ---- Opción de la lámina ----------------------------------------------------------------------------------------------

test_that("la opción entre públicos no enciende las tarjetas de una base, y viceversa", {
  m <- list(tarjetas_diferencias = list(activo = TRUE, entre_publicos = TRUE, temas = list("salud"), indicador = "De acuerdo",
                                        cortos = list(docentes = "Docentes TC")))
  o <- .tpub_opcion(m)
  expect_true(o$entre_publicos); expect_identical(o$temas, "salud"); expect_identical(o$indicador, "De acuerdo")
  expect_identical(o$cortos, c(docentes = "Docentes TC"))
  expect_null(.tarjetas_opcion(m))
  expect_null(.tpub_opcion(list(tarjetas_diferencias = TRUE)))
  expect_null(.tpub_opcion(list(tarjetas_diferencias = list(entre_publicos = TRUE, activo = FALSE))))
  r <- .tpub_calcular(.tpub_temas_declarados(.tp_vars_arte), "3,4", .tp_arte(), .tp_regla(), o)
  expect_identical(vapply(r$tarjetas, `[[`, "", "fila"), "salud")
})

# ---- Render: PPT, Word e inspector ------------------------------------------------------------------------------------

.tp_contraste <- function() {
  rot <- c("Los propósitos de la carrera son claros", "La biblioteca atiende a tiempo", "El servicio de salud es oportuno")
  inst <- list(survey = data.frame(name = paste0("p", 1:3), type = "select_one lk", label = rot, stringsAsFactors = FALSE),
               choices = data.frame(list_name = "lk", name = c("1", "2", "3", "4", "9"), label = c(.tp_acuerdo, "Sin información"),
                                    stringsAsFactors = FALSE), orders_list = NULL)
  base <- function(n, ttb, seed) {
    set.seed(seed)
    d <- as.data.frame(lapply(ttb, function(t) { k <- round(n * t); sample(c(rep(c("3", "4"), length.out = k), rep(c("1", "2", "9"), length.out = n - k))) }),
                       stringsAsFactors = FALSE)
    names(d) <- paste0("p", seq_along(ttb)); d
  }
  ds <- list(docentes = base(115, c(.93, .70, .52), 1), estudiantes = base(279, c(.80, .66, .38), 2))
  vars <- stats::setNames(lapply(1:3, function(i) c(paste0("docentes$p", i), paste0("estudiantes$p", i))), rot)
  list(src = list(data_sources = ds, inst_sources = list(docentes = inst, estudiantes = inst)), vars = vars)
}

test_that("el contraste de dos públicos lleva sus tarjetas y el pie de la prueba en el PPT nativo y en el Word", {
  skip_if_not_installed("officer")
  cx <- .tp_contraste()
  plan <- p_plan(slides = list(p_slide_1_grafico(p_dumbbell(vars = cx$vars, corte = c("3", "4"), estilo = "resumen"),
                                                 titulo = "Docentes y estudiantes", meta = list(tarjetas_diferencias = list(entre_publicos = TRUE)))))
  out <- suppressWarnings(reporte_ppt_plan(data = cx$src$data_sources, instrumento = cx$src$inst_sources, plan = plan,
                                           solo_lista = TRUE, mensajes_progreso = FALSE))
  t <- attr(out$rendered[[1]], "pulso_tarjetas")
  expect_identical(t$tipo, "entre_publicos")
  expect_gte(length(t$tarjetas), 1L)
  expect_true(all(vapply(t$temas, `[[`, "", "estado") == "evaluable"))   # la conciliación con las pesas cuadra
  expect_match(attr(out$rendered[[1]], "pulso_sig_nota"), "muestras independientes", fixed = TRUE)
  f <- tempfile(fileext = ".pptx"); on.exit(unlink(f), add = TRUE)
  suppressWarnings(reporte_ppt_plan(data = cx$src$data_sources, instrumento = cx$src$inst_sources, plan = plan, path_ppt = f,
                                    mensajes_progreso = FALSE))
  expect_true(file.exists(f))
  xml <- paste(readLines(unz(f, "ppt/slides/slide1.xml"), warn = FALSE, encoding = "UTF-8"), collapse = "")
  expect_match(xml, "prosecnur:tarjetas_diferencias", fixed = TRUE)
  expect_match(xml, "ENTRE PÚBLICOS", fixed = TRUE)
  expect_match(xml, "Diferencias entre públicos (muestras independientes)", fixed = TRUE)
  expect_false(grepl("tarjeta:total", xml, fixed = TRUE))                 # sin fila Total
  expect_identical(lengths(regmatches(xml, gregexpr("muestras independientes", xml, fixed = TRUE))), 1L)   # el pie una vez
  docx <- tempfile(fileext = ".docx"); on.exit(unlink(docx), add = TRUE)
  suppressWarnings(reporte_word_plan(data = cx$src$data_sources, instrumento = cx$src$inst_sources, plan = plan, path_docx = docx,
                                     mensajes_progreso = FALSE))
  expect_true(file.exists(docx))
  doc <- paste(readLines(unz(docx, "word/document.xml"), warn = FALSE, encoding = "UTF-8"), collapse = "")
  expect_match(doc, "Diferencias entre públicos (muestras independientes)", fixed = TRUE)
  medios <- utils::unzip(docx, list = TRUE)$Name
  expect_gte(sum(grepl("^word/media/.*\\.png$", medios)), 2L)               # el contraste y la imagen de tarjetas
})

test_that("la tarjeta de líneas mide y dibuja sus pares con el mismo backend en el Word", {
  r <- .tp_calc(.tp_arte(), .tp_vars_arte)
  t <- r$tarjetas[[1]]
  expect_gt(.lam_tarjeta_alto(t, 3), 0.6)
  png <- .word_tarjetas_png(r)
  on.exit(unlink(as.character(png)), add = TRUE)
  expect_true(file.exists(as.character(png)))
  expect_gt(attr(png, "alto"), 0.5)
})

test_that("HTTP: GET /api/graficos/diferencias responde la lámina entre públicos con modo_letras entre_publicos", {
  skip_if_not_installed("plumber")
  src <- .tp_arte()
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "estudio", list(bases = list(docentes = list(nombre = "docentes"), estudiantes = list(nombre = "estudiantes"),
                                                administrativos = list(nombre = "administrativos")),
                                   active_base = "docentes", processing_mode = "multibase"))
  session_set(sid, "rp_data_sources", src$data_sources)
  session_set(sid, "rp_inst_sources", src$inst_sources)
  plan <- list(slides = list(list(id = "c1", payload = list(meta = list(tarjetas_diferencias = list(entre_publicos = TRUE)),
                                                            list(graficador = "p_dumbbell", args = list(vars = .tp_vars_arte, corte = list("3", "4")))))))
  .graficos_config_set(sid, list(plan = plan, significancia = list(prueba = "z", correccion = "bonferroni_fila")))
  pr <- mount_graficos_diferencias(plumber::pr_set_serializer(plumber::pr(), .api_serializer()))
  req <- as.environment(list(REQUEST_METHOD = "GET", PATH_INFO = "/api/graficos/diferencias", QUERY_STRING = "slide=c1",
                             HTTP_X_PULSO_SESSION = sid, HEADERS = c(`x-pulso-session` = sid),
                             rook.input = list(read = function(...) raw(0), rewind = function() invisible(0), read_lines = function(...) character())))
  res <- pr$call(req)
  expect_identical(as.integer(res$status), 200L)
  body <- jsonlite::fromJSON(as.character(res$body), simplifyVector = FALSE)
  l <- body$lamina
  expect_identical(l$modo_letras, "entre_publicos")
  expect_identical(l$estado, "con_marcas")
  expect_length(l$temas, 2L)
  sal <- Filter(function(x) identical(x$fila, "salud"), l$tarjetas)[[1]]
  expect_identical(sal$tipo, "entre_publicos")
  expect_setequal(names(sal$grupos[[1]]), c("base", "etiqueta", "p", "n", "comparable", "motivo"))
  expect_true(all(c("a", "b", "p_a", "p_b", "dif_pp", "p_ajustado", "veredicto") %in% names(sal$pares[[1]])))
  expect_true(all(vapply(sal$pares, `[[`, "", "veredicto") %in% .TPUB_VEREDICTOS))
  expect_match(l$nota, "muestras independientes", fixed = TRUE)
  # Sin lámina: el 404 de siempre.
  req$QUERY_STRING <- "slide=nada"
  expect_identical(as.integer(pr$call(req)$status), 404L)
})

# ---- Segunda entrega: radar por públicos y panorama ------------------------------------------------------------------
#
# Tres públicos con seis criterios (el radar dibuja la telaraña desde cinco), una pregunta propia en docentes (d8) y otra
# en estudiantes (q7) que no tienen par, y una matriz de equivalencias con las cuatro primeras filas confirmadas: p5 y p6
# existen con el mismo nombre en las tres bases, pero sin fila de la matriz no son un tema emparejado.

.tp_rot6 <- c("Los propósitos de la carrera son claros", "La biblioteca atiende a tiempo", "El servicio de salud es oportuno",
              "Los laboratorios están equipados", "La tutoría acompaña el avance", "La plana docente es suficiente")
.tp_tres <- function() {
  etq <- c(.tp_acuerdo, "Sin información")
  inst <- function(vars, labels) list(survey = data.frame(name = vars, type = "select_one lk", label = labels, stringsAsFactors = FALSE),
                                      choices = data.frame(list_name = "lk", name = c("1", "2", "3", "4", "9"), label = etq, stringsAsFactors = FALSE),
                                      orders_list = NULL)
  base <- function(n, ttb, seed, vars) {
    set.seed(seed)
    d <- as.data.frame(lapply(ttb, function(t) { k <- round(n * t); sample(c(rep(c("3", "4"), length.out = k), rep(c("1", "2", "9"), length.out = n - k))) }),
                       stringsAsFactors = FALSE)
    names(d) <- vars; d
  }
  v <- paste0("p", 1:6)
  ds <- list(docentes = base(115, c(.93, .70, .52, .80, .75, .60), 1, v),
             estudiantes = base(279, c(.80, .66, .38, .55, .62, .58), 2, v),
             administrativos = base(85, c(.97, .85, .86, .70, .50, .66), 3, v))
  ds$estudiantes$q7 <- base(279, .5, 4, "q7")$q7
  ds$docentes$d8 <- base(115, .7, 5, "d8")$d8
  list(data_sources = ds,
       inst_sources = list(docentes = inst(c(v, "d8"), c(.tp_rot6, "Pregunta propia de docentes")),
                           estudiantes = inst(c(v, "q7"), c(.tp_rot6, "Pregunta propia de estudiantes")),
                           administrativos = inst(v, .tp_rot6)))
}
.tp_vars6 <- stats::setNames(lapply(1:6, function(i) paste0(c("docentes", "estudiantes", "administrativos"), "$p", i)), .tp_rot6)
.tp_equiv6 <- function(filas = 1:4) {
  list(bases = c("docentes", "estudiantes", "administrativos"),
       filas = lapply(filas, function(i) list(etiqueta_estandar = .tp_rot6[i],
                                              variables = list(docentes = paste0("p", i), estudiantes = paste0("p", i),
                                                               administrativos = paste0("p", i)))))
}
.tp_meta <- list(tarjetas_diferencias = list(entre_publicos = TRUE))
.tp_lamina <- function(graficador, args, id = "s") list(id = id, meta = .tp_meta, payload = list(meta = .tp_meta, list(graficador = graficador, args = args)))
.tp_lamina_radar <- function(vars = .tp_vars6, id = "r") .tp_lamina("p_radar", list(modo = "publicos", vars = vars, corte = "3,4"), id)
.tp_lamina_panorama <- function(id = "p") .tp_lamina("p_panorama", list(vars = list("docentes$*", "estudiantes$*", "administrativos$*"), corte = "3,4"), id)
# El render del motor lee las fuentes con dynGet: se llama desde un marco que las tiene.
.tp_render <- function(f, el, src) { data_sources <- src$data_sources; instrument_sources <- src$inst_sources; suppressWarnings(f(el)) }
.tp_calc_lamina <- function(slide, src, equiv = NULL, p = NULL, regla = .tp_regla(), opt = .tpub_opcion(.tp_meta)) {
  el <- .tpub_elemento_de_lamina(slide)
  tt <- .tpub_temas_de_elemento(el, src, equiv)
  ref <- if (is.null(p)) NULL else .tpub_referencia_render(el, p, attr(p, "pulso_espec"), tt$vars_render)
  list(el = el, tt = tt, ref = ref, r = .tpub_calcular(tt$temas, el$corte, src, regla, opt, referencia = ref))
}

test_that("radar con tres públicos: tarjetas de líneas con los tres pares, 99 % primero y luego por diferencia, con tope", {
  src <- .tp_tres()
  p <- .tp_render(.render_radar_publicos, p_radar_publicos(vars = .tp_vars6, corte = "3,4"), src)
  x <- .tp_calc_lamina(.tp_lamina_radar(), src, p = p)
  expect_identical(x$el$.element_type, "radar_publicos")
  expect_true(all(vapply(x$tt$temas, `[[`, "", "equivalencia") == "emparejado"))   # vars del radar: el par explícito
  expect_true(all(vapply(x$r$temas, `[[`, "", "estado") == "evaluable"))           # concilia con la espec del radar
  # Pares: los tres de cada tema, nunca frente al resto, sin fila Total.
  for (te in x$r$temas) {
    pr <- .tpub_pares(te)
    expect_identical(nrow(pr), 3L)
    expect_setequal(paste(pmin(pr$a, pr$b), pmax(pr$a, pr$b)),
                    c("administrativos docentes", "administrativos estudiantes", "docentes estudiantes"))
    expect_false(any(te$ev$pares$a == ".resto"))
  }
  t <- Filter(function(z) identical(z$fila, "El servicio de salud es oportuno"), x$r$tarjetas)[[1]]
  expect_identical(t$lineas, c("Administrativos\u00a086% frente a Estudiantes\u00a038%: +48\u00a0pp\u00a0▲",
                               "Administrativos\u00a086% frente a Docentes\u00a052%: +34\u00a0pp\u00a0▲",
                               "Docentes\u00a052% frente a Estudiantes\u00a038%: +14\u00a0pp\u00a0△"))
  expect_true(isTRUE(t$sin_total)); expect_identical(t$tipo, "entre_publicos")
  # Tope de tarjetas: cinco temas con diferencias, cuatro tarjetas por defecto, de mayor a menor brecha y frágiles al final.
  expect_identical(x$r$total, 5L)
  expect_length(x$r$tarjetas, 4L)
  br <- vapply(x$r$tarjetas, function(z) z$brecha, 0)
  fr <- vapply(x$r$tarjetas, function(z) isTRUE(z$fragil), TRUE)
  expect_identical(order(fr, -br), seq_along(br))
  dos <- .tpub_calcular(x$tt$temas, "3,4", src, .tp_regla(), .tpub_opcion(list(tarjetas_diferencias = list(entre_publicos = TRUE, max = 2))),
                        referencia = x$ref)
  expect_identical(vapply(dos$tarjetas, `[[`, "", "fila"), vapply(x$r$tarjetas[1:2], `[[`, "", "fila"))
})

test_that("panorama: sólo los temas que la matriz empareja llevan tarjeta; base$* por nombre y preguntas sin par no", {
  src <- .tp_tres()
  x <- .tp_calc_lamina(.tp_lamina_panorama(), src, equiv = .tp_equiv6())
  expect_identical(x$el$.element_type, "panorama")
  expect_identical(names(x$tt$vars_render), .tp_rot6[1:4])                         # p5 y p6 comparten nombre, sin fila
  expect_true(all(vapply(x$tt$temas, `[[`, "", "equivalencia") == "matriz"))
  expect_false(any(grepl("q7|d8", unlist(x$tt$vars_render))))                     # preguntas propias de un público
  expect_identical(unname(x$tt$vars_render[[1]]), c("docentes$p1", "estudiantes$p1", "administrativos$p1"))
  expect_gte(length(x$r$tarjetas), 1L)
  # Sin matriz, el panorama no tiene temas emparejados: va sin tarjetas.
  sin <- .tp_calc_lamina(.tp_lamina_panorama(), src, equiv = NULL)
  expect_length(sin$tt$temas, 0L); expect_length(sin$r$tarjetas, 0L); expect_null(sin$r$nota)
  # Una fila sugerida no empareja, y una fila con su pregunta en un solo público del panorama tampoco.
  eq <- .tp_equiv6(1:2); eq$filas[[1]]$sugerida <- TRUE
  eq$filas[[3]] <- list(etiqueta_estandar = "Propia", variables = list(estudiantes = "q7", egresados = "q7"))
  expect_identical(names(.tpub_temas_de_elemento(x$el, src, eq)$vars_render), .tp_rot6[2])
})

test_that("conciliación contra la espec de cada figura: radar, líneas y puntos, barras y panorama", {
  src <- .tp_tres()
  mueve <- function(x, i) { x[i] <- x[i] + 0.02; x }
  estados <- function(r) vapply(r$temas, `[[`, "", "estado")
  # Radar (telaraña): la matriz eje × público.
  p <- .tp_render(.render_radar_publicos, p_radar_publicos(vars = .tp_vars6, corte = "3,4"), src)
  expect_identical(attr(p, "pulso_espec")$tipo, "radar")
  expect_true(all(estados(.tp_calc_lamina(.tp_lamina_radar(), src, p = p)$r) == "evaluable"))
  e <- attr(p, "pulso_espec"); e$valores[3, 2] <- e$valores[3, 2] + 0.01; attr(p, "pulso_espec") <- e
  r <- .tp_calc_lamina(.tp_lamina_radar(), src, p = p)$r
  expect_identical(estados(r)[3], "abstencion"); expect_identical(r$temas[[3]]$motivo, .TPUB_MOTIVO_NO_CUADRA)
  expect_true(all(estados(r)[-3] == "evaluable"))
  # Líneas y puntos (dos públicos, menos de cinco criterios): `a` y `b` de las pesas.
  v2 <- lapply(.tp_vars6[1:4], `[`, 1:2)
  p2 <- .tp_render(.render_radar_publicos, p_radar_publicos(vars = v2, corte = "3,4"), src)
  expect_identical(attr(p2, "pulso_espec")$tipo, "pesas")
  expect_true(all(estados(.tp_calc_lamina(.tp_lamina_radar(v2), src, p = p2)$r) == "evaluable"))
  e2 <- attr(p2, "pulso_espec"); e2$b <- mueve(e2$b, 1); attr(p2, "pulso_espec") <- e2
  expect_identical(estados(.tp_calc_lamina(.tp_lamina_radar(v2), src, p = p2)$r)[1], "abstencion")
  # Barras comparativas (tres públicos, menos de cinco criterios): los datos del gráfico.
  v3 <- .tp_vars6[1:4]
  p3 <- .tp_render(.render_radar_publicos, p_radar_publicos(vars = v3, corte = "3,4"), src)
  expect_null(attr(p3, "pulso_espec"))
  expect_true(.tpub_figura_admite(.tpub_elemento_de_lamina(.tp_lamina_radar(v3)), NULL, p3))
  expect_true(all(estados(.tp_calc_lamina(.tp_lamina_radar(v3), src, p = p3)$r) == "evaluable"))
  p3$data$valor <- mueve(p3$data$valor, 2)
  expect_identical(sum(estados(.tp_calc_lamina(.tp_lamina_radar(v3), src, p = p3)$r) == "abstencion"), 1L)
  # Panorama: `valores` e `items` de cada público.
  pp <- .tp_render(.render_panorama, p_panorama(vars = c("docentes$*", "estudiantes$*", "administrativos$*"), corte = "3,4"), src)
  expect_identical(attr(pp, "pulso_espec")$items[[3]], paste0("p", 1:6))
  xp <- .tp_calc_lamina(.tp_lamina_panorama(), src, equiv = .tp_equiv6(), p = pp)
  expect_true(all(estados(xp$r) == "evaluable"))
  expect_equal(xp$ref, .tpub_referencia_inspector(xp$el, xp$tt$vars_render, src))   # el inspector lee lo mismo
  ep <- attr(pp, "pulso_espec"); ep$valores[[2]] <- mueve(ep$valores[[2]], 4); attr(pp, "pulso_espec") <- ep
  expect_identical(estados(.tp_calc_lamina(.tp_lamina_panorama(), src, equiv = .tp_equiv6(), p = pp)$r), c(rep("evaluable", 3), "abstencion"))
  # Una espec ilegible no apaga la conciliación: todos los temas se abstienen.
  pe <- p; attr(pe, "pulso_espec")$valores <- attr(pe, "pulso_espec")$valores[1:2, ]
  expect_true(all(estados(.tp_calc_lamina(.tp_lamina_radar(), src, p = pe)$r) == "abstencion"))
  # Una figura que no es de las del elemento no lleva tarjetas.
  expect_false(.tpub_figura_admite(list(.element_type = "panorama"), list(tipo = "radar")))
  expect_false(.tpub_figura_admite(list(.element_type = "radar_publicos"), list(tipo = "panorama")))
})

test_that("la familia entre públicos (m) suma los temas del radar y del panorama una sola vez", {
  src <- .tp_tres()
  regla <- .tp_regla("z", "bh_informe")
  m_de <- function(...) .tpub_familia_plan(list(slides = list(...)), src, .tp_equiv6(), regla)$m
  expect_identical(m_de(.tp_lamina_radar(.tp_vars6[1:3])), 9L)                     # tres temas por tres pares
  expect_identical(m_de(.tp_lamina_panorama()), 12L)                               # cuatro temas emparejados
  # El panorama repite los tres temas del radar (mismas refs, mismo corte): sólo p4 entra nuevo.
  expect_identical(m_de(.tp_lamina_radar(.tp_vars6[1:3]), .tp_lamina_panorama()), 12L)
  # Y el contraste de dos públicos suma sus pares sin repetirlos.
  dumb <- .tp_lamina("p_dumbbell", list(vars = list(t = c("docentes$p5", "estudiantes$p5")), corte = list("3", "4")), "d")
  expect_identical(m_de(.tp_lamina_radar(.tp_vars6[1:3]), .tp_lamina_panorama(), dumb), 13L)
  # El inspector usa la misma familia.
  plan <- list(slides = list(.tp_lamina_radar(.tp_vars6[1:3]), .tp_lamina_panorama()))
  fam <- .tpub_familia_plan(plan, src, .tp_equiv6(), regla)
  j <- .tpub_lamina_json(.tp_lamina_panorama(), src, regla, equiv = .tp_equiv6(), familia = fam$tabla)
  expect_identical(j$modo_letras, "entre_publicos")
  expect_identical(j$familia$m, 12L); expect_false(j$familia$local)
  expect_length(j$temas, 4L)
  jr <- .tpub_lamina_json(.tp_lamina_radar(), src, .tp_regla(), equiv = NULL)
  expect_identical(jr$estado, "con_marcas"); expect_length(jr$temas, 6L)
  expect_true(all(vapply(jr$temas, `[[`, "", "estado") == "evaluable"))           # concilia con `.radar_mb_datos`
})

test_that("el radar y el panorama llevan sus tarjetas y el pie una vez en el PPT; el radar cede su tabla al panel", {
  skip_if_not_installed("officer")
  src <- .tp_tres()
  op <- options(prosecnur.sig_informe = list(regla = .sig_regla_fabrica(), equivalencias_publicos = .tp_equiv6()))
  on.exit(options(op), add = TRUE)
  plan <- p_plan(slides = list(
    p_slide_1_grafico(p_radar(modo = "publicos", vars = .tp_vars6, corte = "3,4"), titulo = "Radar por público", meta = .tp_meta),
    p_slide_1_grafico(p_panorama(vars = c("docentes$*", "estudiantes$*", "administrativos$*"), corte = "3,4"),
                      titulo = "Panorama por público", meta = .tp_meta)))
  avisos <- character(0)
  out <- withCallingHandlers(
    reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources, plan = plan, solo_lista = TRUE, mensajes_progreso = FALSE),
    message = function(m) { avisos <<- c(avisos, conditionMessage(m)); invokeRestart("muffleMessage") },
    warning = function(w) invokeRestart("muffleWarning"))
  for (k in 1:2) {
    t <- attr(out$rendered[[k]], "pulso_tarjetas")
    expect_identical(t$tipo, "entre_publicos", info = k)
    expect_gte(length(t$tarjetas), 1L)
    expect_true(all(vapply(t$temas, `[[`, "", "estado") == "evaluable"), info = k)
  }
  expect_false(isTRUE(attr(out$rendered[[1]], "pulso_espec")$con_tabla))
  expect_true(any(grepl("la tabla del radar deja su lugar al panel de tarjetas", avisos, fixed = TRUE)))
  expect_false(any(grepl("aún no están disponibles", avisos, fixed = TRUE)))       # el aviso de la primera entrega se fue
  f <- tempfile(fileext = ".pptx"); on.exit(unlink(f), add = TRUE)
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources, plan = plan,
                                                     path_ppt = f, mensajes_progreso = FALSE)))
  for (k in 1:2) {
    xml <- paste(readLines(unz(f, sprintf("ppt/slides/slide%d.xml", k)), warn = FALSE, encoding = "UTF-8"), collapse = "")
    expect_match(xml, "ENTRE PÚBLICOS", fixed = TRUE)
    expect_identical(lengths(regmatches(xml, gregexpr("muestras independientes", xml, fixed = TRUE))), 1L)
    expect_false(grepl("tarjeta:total", xml, fixed = TRUE))
    expect_false(grepl("ADR", xml, fixed = TRUE))                                   # el entregable no cita el ADR
    expect_false(grepl("«|»", xml))
  }
  xml1 <- paste(readLines(unz(f, "ppt/slides/slide1.xml"), warn = FALSE, encoding = "UTF-8"), collapse = "")
  expect_false(grepl("<a:tbl>", xml1, fixed = TRUE))
})

# ---- Revisión metodológica del 2026-11-09 (P2): la regla propuesta se resuelve sobre todas las bases -------------------

.tp_con_aula <- function() {
  src <- .tp_tres()
  set.seed(22)
  for (b in c("docentes", "estudiantes")) src$data_sources[[b]]$aula <- sample(sprintf("a%02d", 1:15), nrow(src$data_sources[[b]]), TRUE)
  src   # administrativos no trae aula: entra como muestreo aleatorio simple
}

test_that("P2. sin regla guardada, la regla entre públicos es la misma sea cual sea la base activa y el orden de las bases", {
  src <- .tp_con_aula()
  temas <- .tpub_temas_declarados(.tp_vars6[1:3], .tp_vars6[1:3], NULL)
  marcas <- list()
  for (orden in list(c("administrativos", "docentes", "estudiantes"), c("estudiantes", "administrativos", "docentes"))) {
    ds <- src$data_sources[orden]
    for (activa in orden) {
      rb <- .sig_regla_del_estudio(NULL, ds[[activa]], NULL)
      expect_identical(rb$origen, "propuesta")
      r <- .tpub_regla_de_contexto(list(regla = rb$regla, origen = rb$origen), ds)
      expect_identical(r$prueba, "rao_scott")                  # alguna base trae el aula
      expect_identical(r$conglomerado, "aula")
      expect_identical(r$correccion, "bh_informe")
      res <- .tpub_calcular(temas, "3,4", list(data_sources = ds, inst_sources = src$inst_sources), r, .tp_opt())
      pr <- do.call(rbind, lapply(res$temas, function(te) te$ev$pares))
      pr <- pr[order(pr$fila, pr$a, pr$b), c("fila", "a", "b", "p_ajustado", "veredicto")]
      rownames(pr) <- NULL
      marcas[[length(marcas) + 1L]] <- pr
    }
  }
  for (m in marcas[-1]) expect_equal(m, marcas[[1]])
  # Sin aula en ninguna base, la propuesta es la z con Bonferroni por fila.
  r0 <- .tpub_regla_de_contexto(NULL, .tp_tres()$data_sources)
  expect_identical(r0$prueba, "z"); expect_identical(r0$correccion, "bonferroni_fila")
})

test_that("P2. una regla guardada manda tal cual entre públicos; el contexto del informe resuelve la propuesta y su familia", {
  src <- .tp_con_aula()
  guardada <- .tp_regla("z", "bonferroni_fila")
  expect_identical(.tpub_regla_de_contexto(list(regla = guardada, origen = "estudio"), src$data_sources), guardada)
  # La base activa (administrativos, sin aula) propone z; entre públicos se resuelve Rao-Scott y su familia de BH.
  rb <- .sig_regla_del_estudio(NULL, src$data_sources$administrativos, NULL)
  plan <- list(slides = list(.tp_lamina_radar(.tp_vars6[1:4])))
  ctx <- .tpub_en_contexto(list(regla = rb$regla, origen = rb$origen), plan, src, .tp_equiv6())
  expect_identical(ctx$regla$prueba, "z")                       # la regla de la base no se toca
  expect_identical(ctx$regla_publicos$prueba, "rao_scott")
  expect_gt(ctx$familia_publicos$m, 0L)
  # El contexto liviano del worker conserva el origen.
  expect_identical(.sig_contexto_liviano(list(regla = rb$regla, origen = "propuesta"))$origen, "propuesta")
})

test_that("P3. con la familia del plan, un p ajeno a ella queda «fuera_de_familia», no se marca y el tema dice por qué", {
  src <- .tp_tres()
  rg <- .tp_regla(correccion = "bh_informe")
  fam <- .tpub_familia_plan(list(slides = list(.tp_lamina_radar())), src, NULL, rg)
  temas <- .tpub_temas_declarados(.tp_vars6, .tp_vars6, NULL)
  # Mismas cifras que la familia: todo par está en ella.
  r <- .tpub_calcular(temas, "3,4", src, rg, .tp_opt(), familia = fam$tabla)
  pr <- do.call(rbind, lapply(r$temas, function(te) te$ev$pares))
  expect_false(any(pr$veredicto == "fuera_de_familia"))
  expect_gt(sum(pr$veredicto %in% c("marcada", "fragil")), 0L)
  # Otra fuente (la vista previa leyó otras cifras): sus p no están en la familia y ninguno se ajusta con un vecino.
  src2 <- src; src2$data_sources$estudiantes <- src2$data_sources$estudiantes[-(1:5), ]
  r2 <- .tpub_calcular(temas, "3,4", src2, rg, .tp_opt(), familia = fam$tabla)
  p2 <- do.call(rbind, lapply(r2$temas, function(te) te$ev$pares))
  fuera <- !.sig_bh_en_familia(p2$p, fam$tabla)
  expect_gt(sum(fuera), 0L)
  expect_true(all(p2$veredicto[fuera] == "fuera_de_familia"))
  expect_true(all(is.na(p2$p_ajustado[fuera])))
  expect_true("fuera_de_familia" %in% .TPUB_VEREDICTOS)
  te_f <- Filter(function(te) isTRUE(te$fuera_de_familia > 0L), r2$temas)
  expect_gt(length(te_f), 0L)
  expect_true(all(vapply(te_f, function(te) identical(te$motivo, .TPUB_MOTIVO_FUERA_FAMILIA), logical(1))))
  # Antes del arreglo esos pares se marcaban con el q de un vecino (9 de 12 en la sonda f.R).
  expect_identical(sum(fuera & p2$veredicto %in% c("marcada", "fragil")), 0L)
  # Sin familia del plan (local) no se exige: la familia son los temas de la llamada.
  r3 <- .tpub_calcular(temas, "3,4", src2, rg, .tp_opt(), familia = NULL)
  expect_false(any(unlist(lapply(r3$temas, function(te) te$ev$pares$veredicto)) == "fuera_de_familia"))
})

test_that("P4. la familia entre públicos cuenta cada PAR una vez: radar de tres y contraste de dos, y cortes en otro orden", {
  src <- .tp_tres(); rg <- .tp_regla(correccion = "bh_informe")
  m_de <- function(...) .tpub_familia_plan(list(slides = list(...)), src, .tp_equiv6(), rg)$m
  expect_identical(m_de(.tp_lamina_radar()), 18L)                                    # 6 temas × 3 pares
  dumb <- function(corte, id) .tp_lamina("p_dumbbell", list(vars = list(t = c("docentes$p1", "estudiantes$p1")), corte = corte), id)
  expect_identical(m_de(.tp_lamina_radar(), dumb(list("3", "4"), "d")), 18L)         # el par docentes-estudiantes ya estaba (antes 19)
  expect_identical(m_de(dumb(list("3", "4"), "d1"), dumb(list("4", "3"), "d2")), 1L) # mismo corte en otro orden (antes 2)
  r43 <- .tp_lamina("p_radar", list(modo = "publicos", vars = .tp_vars6, corte = "4,3"), "r2")
  expect_identical(m_de(.tp_lamina_radar(), r43), 18L)                               # antes 36
  # Un filtro distinto sí es otra comparación.
  rf <- .tp_lamina("p_radar", list(modo = "publicos", vars = .tp_vars6, corte = "3,4", filtros = list(p6 = c("3", "4"))), "rf")
  expect_gt(m_de(.tp_lamina_radar(), rf), 18L)
})

test_that("P5. la línea del par: «86%» sin espacio, y el público con su cifra y «+48 pp ▲» unidos por espacios duros", {
  l <- .tpub_linea_par("Administrativos", 86.2, "Estudiantes", 37.9, 48)
  expect_identical(l, "Administrativos 86% frente a Estudiantes 38%: +48 pp ▲")
  expect_false(grepl(" %", l, fixed = TRUE))
  # La medida de la tarjeta corta por espacios comunes: cada bloque unido es una sola palabra.
  expect_identical(strsplit(l, "\\s+")[[1]], c("Administrativos 86%", "frente", "a", "Estudiantes 38%:", "+48 pp ▲"))
  expect_identical(.tpub_linea_par("A", 50, "B", 40, 10, fragil = TRUE), "A 50% frente a B 40%: +10 pp △")
})

test_that("P6. el pie dice el nivel, el alcance de la corrección y, si hay frágiles, qué significa △", {
  rz <- .tp_regla()
  expect_identical(.tpub_texto_pie(rz),
                   paste0("Diferencias entre públicos (muestras independientes): prueba z, p < 0.05 con corrección de Bonferroni ",
                          "dentro de cada tema, al menos 10 puntos y 30 casos por público."))
  rb <- .tp_regla("rao_scott", "bh_informe"); rb$conglomerado <- "aula"; rb$alfa <- 0.1; rb$umbral_puntos <- 0
  expect_identical(.tpub_texto_pie(rb, local = FALSE, hay_fragiles = TRUE),
                   paste0("Diferencias entre públicos (muestras independientes): Rao-Scott por aula, p < 0.1 con corrección de ",
                          "Benjamini-Hochberg sobre las comparaciones entre públicos del informe y al menos 30 casos por público. ",
                          "△ Frágil: p ajustado entre 0.01 y 0.1."))
  expect_match(.tpub_texto_pie(rb, local = TRUE), "entre públicos de esta lámina", fixed = TRUE)
  # En el cálculo: sin familia del plan la BH es la de la lámina; con frágiles visibles, la leyenda va.
  r <- .tpub_calcular(.tpub_temas_declarados(.tp_vars6), "3,4", .tp_tres(), .tp_regla(correccion = "bh_informe"), .tpub_opcion(.tp_meta))
  expect_match(r$nota, "de esta lámina", fixed = TRUE)
  expect_identical(grepl("△ Frágil", r$nota, fixed = TRUE), .tpub_hay_fragiles(r$tarjetas))
  expect_false(grepl("\u00ab|\u00bb", r$nota))
})

test_that("P7. la tarjeta y el inspector dicen qué indicador se probó aunque la lámina no lo nombre", {
  src <- .tp_tres()
  r <- .tpub_calcular(.tpub_temas_declarados(.tp_vars6), "3,4", src, .tp_regla(), .tpub_opcion(.tp_meta))
  expect_gt(length(r$tarjetas), 0L)
  for (t in r$tarjetas) expect_identical(t$indicador, "De acuerdo + Totalmente de acuerdo")
  expect_identical(.tpub_tema_json(r$temas[[1]], .tp_regla())$indicador, "De acuerdo + Totalmente de acuerdo")
  # El nombre del gráfico (corte_etiqueta) y el de la lámina mandan, en ese orden inverso.
  r2 <- .tpub_calcular(.tpub_temas_declarados(.tp_vars6), "3,4", src, .tp_regla(), .tpub_opcion(.tp_meta), corte_etiqueta = "Top Two Box")
  expect_identical(r2$tarjetas[[1]]$indicador, "Top Two Box")
  o <- .tpub_opcion(list(tarjetas_diferencias = list(entre_publicos = TRUE, indicador = "Acuerdo")))
  r3 <- .tpub_calcular(.tpub_temas_declarados(.tp_vars6), "3,4", src, .tp_regla(), o, corte_etiqueta = "Top Two Box")
  expect_identical(r3$tarjetas[[1]]$indicador, "Acuerdo")
  # El elemento de la lámina trae el corte_etiqueta del radar guardado.
  sl <- .tp_lamina("p_radar", list(modo = "publicos", vars = .tp_vars6, corte = "3,4", corte_etiqueta = "Top Two Box"), "r")
  expect_identical(.tpub_elemento_de_lamina(sl)$corte_etiqueta, "Top Two Box")
  l <- .tpub_lamina_json(sl, src, .tp_regla())
  expect_identical(l$tarjetas[[1]]$indicador, "Top Two Box")
})

test_that("P8. sin cifras del gráfico que cotejar el tema se abstiene con motivo, no se salta la conciliación", {
  src <- .tp_tres()
  temas <- .tpub_temas_declarados(.tp_vars6[1:3])
  # NULL: no se concilia (lo usa la familia). Vacío: el gráfico no se pudo leer y cada tema se abstiene.
  r0 <- .tpub_calcular(temas, "3,4", src, .tp_regla(), .tp_opt(), referencia = NULL)
  expect_true(all(vapply(r0$temas, `[[`, "", "estado") == "evaluable"))
  r1 <- .tpub_calcular(temas, "3,4", src, .tp_regla(), .tp_opt(), referencia = list())
  expect_true(all(vapply(r1$temas, `[[`, "", "estado") == "abstencion"))
  expect_true(all(vapply(r1$temas, `[[`, "", "motivo") == .TPUB_MOTIVO_SIN_REFERENCIA))
  expect_length(r1$tarjetas, 0L)
  # La espec de las pesas que no se deja leer (tipo ajeno) da NULL, que el render convierte en vacío.
  expect_null(.tpub_referencia_pesas(list(tipo = "otro"), list(t = c("docentes$p1", "estudiantes$p1"))))
})

test_that("P8. una fila compuesta de la matriz se abstiene en el panorama con su motivo, no como «sin equivalencia»", {
  src <- .tp_tres()
  eq <- .tp_equiv6(1:5)
  eq$filas[[5]]$derivada <- list(por_base = list(docentes = list(variables = list("p5", "p6"), codigos = list())))
  x <- .tp_calc_lamina(.tp_lamina_panorama(), src, equiv = eq)
  te5 <- Filter(function(te) identical(te$tema, .tp_rot6[5]), x$r$temas)[[1]]
  expect_identical(te5$estado, "sin_equivalencia")
  expect_identical(te5$motivo, .TPUB_MOTIVO_COMPUESTO)
  otros <- Filter(function(te) te$tema %in% .tp_rot6[1:4], x$r$temas)
  expect_true(all(vapply(otros, `[[`, "", "estado") == "evaluable"))
  expect_false(any(vapply(x$r$temas, function(te) identical(te$motivo, .TPUB_MOTIVO_SIN_EQUIV), logical(1))))
})
