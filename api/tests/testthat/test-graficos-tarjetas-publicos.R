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
  expect_identical(t$lineas, c("Administrativos 86 % frente a Docentes 62 %: +24 pp ▲",
                               "Estudiantes 84 % frente a Docentes 62 %: +22 pp ▲"))
  expect_false(grepl("«|»", paste(t$lineas, collapse = "")))   # comillas rectas en lo visible
  pares <- data.frame(veredicto = c("fragil", "marcada", "marcada", "marcada", "marcada", "marcada"),
                      p_a = c(90, 60, 70, 80, 75, 65), p_b = c(10, 50, 50, 50, 50, 50), stringsAsFactors = FALSE)
  v <- .tpub_pares_visibles(pares, .tp_regla())
  expect_identical(nrow(v), 4L)
  expect_identical(v$veredicto, rep("marcada", 4))           # la frágil de 80 puntos va después de las del 99 %
  expect_identical(v$p_a - v$p_b, c(30, 25, 20, 15))
  rr <- .tp_regla(); rr$fragiles <- "ocultar"
  expect_false(any(.tpub_pares_visibles(pares, rr)$veredicto == "fragil"))
  expect_identical(r$nota, paste0("Diferencias entre públicos (muestras independientes): prueba z, corrección de Bonferroni, ",
                                  "al menos 10 puntos y 30 casos por público."))
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
