# Redacción de los avisos de ponderación (CLAUDE.md, sección Redacción).
#
# Los avisos que el motor devuelve a la pantalla de Ponderación (`avisos` del
# cálculo y `warnings` de la vista previa) llegaban sin tildes, con comillas
# angulares, con "solo" tildado y con siglas del motor sin presentar. Esta suite
# provoca cada aviso con datos chicos y revisa su texto. Dos guardas para que el
# verde no sea por ausencia:
#   - la autoprueba pasa por el revisor los textos anteriores y exige que caigan;
#   - el barrido exige que cada código de aviso escrito en el motor haya sido
#     provocado aquí: un aviso nuevo sin escenario pone la suite en rojo.
# No fija cifras del cálculo salvo dos avisos de diagnóstico, para dejar dicho de
# qué denominador sale cada número.

.par_dir_r <- function() testthat::test_path("..", "..", "R")

.PAR_SIN_TILDE <- c(
  "diseno", "ponderacion", "poblacion", "categoria", "categorias", "calibracion", "recalibracion",
  "margenes", "minimo", "maximo", "precision", "convergio", "iteracion", "imputacion", "imputo",
  "tamano", "numero", "ningun", "despues", "tambien", "desvio", "segun", "vacio", "ultima"
)

# Los caracteres vetados se arman por su código para que este archivo no los lleve
# escritos: comillas angulares (171 y 187), punto medio (183), raya (8212) y aspa (215).
.par_chr <- function(codigo) intToUtf8(codigo)

# Reglas mecánicas: nombre y patrón (PCRE). Una regla con hallazgo es un defecto.
.PAR_REGLAS <- c(
  comillas_angulares = sprintf("[%s%s]", .par_chr(171L), .par_chr(187L)),
  solo_con_tilde = "(?i)sólo",
  palabra_sin_tilde = paste0("(?i)\\b(", paste(.PAR_SIN_TILDE, collapse = "|"), ")\\b"),
  jerga_del_motor = "(?i)\\b(deff|trim|raking|ipf|n efectivo)\\b|n_eff|max/min",
  separador_vetado = sprintf(" %s |%s|%s|~", .par_chr(183L), .par_chr(8212L), .par_chr(215L)),
  porcentaje_pegado = "[0-9]%",
  decimal_con_coma = "[0-9],[0-9]{1,2}(?![0-9])",
  concordancia_con_uno = "(^|[^0-9.,])1 (casos|ciclos|iteraciones|estratos|variables)\\b"
)

# Hallazgos de un vector de textos: "regla: texto" por cada regla que casa.
.par_hallazgos <- function(textos) {
  textos <- as.character(textos)
  out <- character()
  for (regla in names(.PAR_REGLAS)) {
    malos <- textos[grepl(.PAR_REGLAS[[regla]], textos, perl = TRUE)]
    if (length(malos)) out <- c(out, sprintf("%s: %s", regla, malos))
  }
  invalidos <- textos[!validUTF8(textos)]
  if (length(invalidos)) out <- c(out, sprintf("utf8_invalido: %s", invalidos))
  out
}

# Códigos de aviso escritos en un texto de código: los de `.ponderacion_aviso()` y
# los del `add()` del puente con Analítica.
.par_codigos_en <- function(txt) {
  patron <- "(\\.ponderacion_aviso|\\badd)\\(\\s*\"(warn|info)\",\\s*\"[a-z_]+\""
  hallados <- unlist(regmatches(txt, gregexpr(patron, txt, perl = TRUE)))
  sort(unique(sub(".*\"([a-z_]+)\"$", "\\1", hallados)))
}

# Los del motor y de su puente con Analítica, leídos de las fuentes.
.par_codigos_fuente <- function() {
  archivos <- file.path(.par_dir_r(), c("ponderacion_engine.R", "ponderacion_faltantes.R",
                                        "ponderacion_analitica.R"))
  .par_codigos_en(vapply(archivos, function(f) {
    paste(readLines(f, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  }, character(1)))
}

.par_cfg <- function(margins, ...) list(enabled = TRUE, rake = c(list(margins = margins), list(...)))

.PAR_SEXO <- list(list(var = "sexo", targets = c(H = .5, M = .5)))
.PAR_SEXO_EDAD <- list(
  list(var = "sexo", targets = c(H = .5, M = .5)),
  list(var = "edad", targets = c(joven = .5, mayor = .5))
)

# Muestra desbalanceada en sexo y edad: calibrar a 50/50 deja pesos dispersos.
.par_sesgados <- function() {
  data.frame(sexo = rep(c("H", "H", "M", "M"), c(240, 60, 80, 20)),
             edad = rep(c("joven", "mayor", "joven", "mayor"), c(240, 60, 80, 20)),
             stringsAsFactors = FALSE)
}

# Sexo y edad asociados: el ajuste por márgenes necesita varias iteraciones.
.par_asociados <- function() {
  data.frame(sexo = rep(c("H", "H", "M", "M"), c(200, 40, 60, 100)),
             edad = rep(c("joven", "mayor", "joven", "mayor"), c(200, 40, 60, 100)),
             stringsAsFactors = FALSE)
}

# 200 casos con sexo, edad y zona; sin faltantes.
.par_imputables <- function() {
  set.seed(11)
  data.frame(
    sexo = sample(c("H", "M"), 200, TRUE, prob = c(.6, .4)),
    edad = sample(c("joven", "mayor"), 200, TRUE, prob = c(.6, .4)),
    zona = sample(c("norte", "sur"), 200, TRUE),
    stringsAsFactors = FALSE
  )
}

.PAR_TRES <- c(.PAR_SEXO_EDAD, list(list(var = "zona", targets = c(norte = .5, sur = .5))))

# Resultado a mano con los diagnósticos de un vector de pesos.
.par_resultado <- function(w, ...) {
  c(list(diagnostics = .ponderacion_diagnostics(w), avisos = list()), list(...))
}

# Cada escenario devuelve un resultado de `ponderacion_compute()`; lo que se
# revisa es lo que recibe la pantalla: `.analitica_ponderacion_warnings()`.
.par_escenarios <- function() {
  imp <- .par_imputables()
  list(
    # Diseño: un estrato sin población (plural y singular) y estratos sin casos.
    estratos = ponderacion_compute(
      data.frame(distrito = rep(c("A", "B", "Y", "Z"), c(50, 30, 12, 8)), stringsAsFactors = FALSE),
      list(enabled = TRUE, design = list(var = "distrito", pop_sizes = c(A = 1000, B = 2000, C = 500, D = 300)))
    ),
    estrato_uno = ponderacion_compute(
      data.frame(distrito = c(rep(c("A", "B"), c(50, 30)), NA), stringsAsFactors = FALSE),
      list(enabled = TRUE, design = list(var = "distrito", pop_sizes = c(A = 1000, B = 2000, C = 500)))
    ),
    # Sin tamaño de población a la vez un estrato con nombre y casos sin dato en el estrato.
    estrato_mixto = ponderacion_compute(
      data.frame(distrito = c(rep(c("A", "B", "Z"), c(50, 30, 5)), NA, NA), stringsAsFactors = FALSE),
      list(enabled = TRUE, design = list(var = "distrito", pop_sizes = c(A = 1000, B = 2000)))
    ),
    # Márgenes: categorías sin casos (una y varias), ninguna categoría de la meta con
    # casos (una y varias: la segunda sale de `sin_donantes`) y solo categorías de meta 0.
    categoria_unica_ausente = ponderacion_compute(
      data.frame(sexo = rep(c("H", "M"), c(60, 40)), stringsAsFactors = FALSE),
      .par_cfg(list(list(var = "sexo", targets = c(X = 1))))
    ),
    categoria_meta_cero = ponderacion_compute(
      data.frame(sexo = rep(c("H", "M"), c(60, 40)), stringsAsFactors = FALSE),
      .par_cfg(list(list(var = "sexo", targets = c(H = 0, X = 1))))
    ),
    categoria_una = ponderacion_compute(
      data.frame(sexo = rep(c("H", "M"), c(60, 40)), stringsAsFactors = FALSE),
      .par_cfg(list(list(var = "sexo", targets = c(H = .45, M = .45, X = .10))))
    ),
    categorias_varias = ponderacion_compute(
      data.frame(sexo = rep(c("H", "M"), c(60, 40)), stringsAsFactors = FALSE),
      .par_cfg(list(list(var = "sexo", targets = c(H = .4, M = .4, X = .1, Y = .1))))
    ),
    # Casos fuera del margen: sin dato (varios y uno) y categoría válida sin meta.
    sin_dato = ponderacion_compute(
      data.frame(sexo = c(rep("H", 50), rep("M", 40), rep("99", 6), rep(NA, 4)), stringsAsFactors = FALSE),
      .par_cfg(.PAR_SEXO)
    ),
    sin_dato_uno = ponderacion_compute(
      data.frame(sexo = c(rep("H", 50), rep("M", 40), NA), stringsAsFactors = FALSE),
      .par_cfg(.PAR_SEXO)
    ),
    sin_meta = ponderacion_compute(
      data.frame(sexo = c(rep("H", 50), rep("M", 45), rep("Otro", 5)), stringsAsFactors = FALSE),
      .par_cfg(.PAR_SEXO)
    ),
    # Expansión con metas que no suman lo mismo.
    totales = ponderacion_compute(.par_sesgados(), list(
      enabled = TRUE, escala = "expansion",
      rake = list(margins = list(
        list(var = "sexo", targets = c(H = 6000, M = 4000)),
        list(var = "edad", targets = c(joven = 7000, mayor = 4000))
      ))
    )),
    # Recorte: mueve los márgenes, no se concilia (varios ciclos y uno).
    recorte_mueve = ponderacion_compute(.par_sesgados(), c(.par_cfg(.PAR_SEXO_EDAD), list(trim = list(cap = 4)))),
    recorte_ciclos = ponderacion_compute(.par_sesgados(), c(
      .par_cfg(.PAR_SEXO_EDAD), list(trim = list(cap = 1.2, recalibrar = TRUE, max_ciclos = 5))
    )),
    recorte_un_ciclo = ponderacion_compute(.par_sesgados(), c(
      .par_cfg(.PAR_SEXO_EDAD), list(trim = list(cap = 1.2, recalibrar = TRUE, max_ciclos = 1))
    )),
    # Ajuste por márgenes que no llega (una iteración y dos).
    no_converge_una = ponderacion_compute(.par_asociados(), .par_cfg(.PAR_SEXO_EDAD, max_iter = 1L)),
    no_converge_dos = ponderacion_compute(.par_asociados(), .par_cfg(.PAR_SEXO_EDAD, max_iter = 2L)),
    # Imputación: aplicada (una y dos variables de celda, uno y varios casos), con
    # receptores sin celda, con celdas sin donantes y sin ningún donante.
    imputa_varios = ponderacion_compute(
      within(imp, sexo[seq(5, by = 23, length.out = 8)] <- NA),
      .par_cfg(.PAR_SEXO_EDAD, faltantes = "imputar")
    ),
    imputa_uno = ponderacion_compute(
      within(imp, sexo[7] <- NA), .par_cfg(.PAR_TRES, faltantes = "imputar")
    ),
    imputa_sin_celda = ponderacion_compute(
      within(imp, { sexo[1:3] <- NA; edad[1:3] <- NA }), .par_cfg(.PAR_SEXO_EDAD, faltantes = "imputar")
    ),
    imputa_sin_celda_uno = ponderacion_compute(
      within(imp, { sexo[1] <- NA; edad[1] <- NA; zona[1] <- NA }), .par_cfg(.PAR_TRES, faltantes = "imputar")
    ),
    imputa_solo_una_variable = ponderacion_compute(
      within(imp, sexo[7] <- NA), .par_cfg(.PAR_SEXO, faltantes = "imputar")
    ),
    celda_vacia = ponderacion_compute(
      local({
        mayores <- which(imp$edad == "mayor")
        d <- imp[c(setdiff(seq_len(nrow(imp)), mayores), mayores[1:3]), ]
        d$sexo[d$edad == "mayor"] <- NA
        d
      }),
      .par_cfg(.PAR_SEXO_EDAD, faltantes = "imputar")
    ),
    celda_vacia_uno = ponderacion_compute(
      local({
        mayores <- which(imp$edad == "mayor")
        d <- imp[c(setdiff(seq_len(nrow(imp)), mayores), mayores[1]), ]
        d$sexo[d$edad == "mayor"] <- NA
        d
      }),
      .par_cfg(.PAR_SEXO_EDAD, faltantes = "imputar")
    ),
    sin_donantes = ponderacion_compute(
      data.frame(sexo = rep(NA_character_, 40), edad = rep(c("joven", "mayor"), 20), stringsAsFactors = FALSE),
      .par_cfg(.PAR_SEXO_EDAD, faltantes = "imputar", imputacion = list(umbral = 1))
    ),
    sin_donantes_uno = ponderacion_compute(
      data.frame(sexo = NA_character_, edad = "joven", stringsAsFactors = FALSE),
      .par_cfg(.PAR_SEXO_EDAD, faltantes = "imputar", imputacion = list(umbral = 1))
    ),
    # Diagnósticos que arma el puente con Analítica, sobre pesos escritos a mano.
    diagnostico_alto = .par_resultado(c(rep(1, 90), rep(20, 10)), rake_applied = TRUE, converged = FALSE),
    diagnostico_medio = .par_resultado(c(rep(1, 80), rep(5, 20))),
    diagnostico_con_peso_cero = .par_resultado(c(0, rep(1, 89), rep(20, 10)))
  )
}

.par_avisos_ui <- function(escenarios = .par_escenarios()) {
  unlist(lapply(escenarios, .analitica_ponderacion_warnings), recursive = FALSE, use.names = FALSE)
}

# Errores de configuración que la vista previa muestra con su mensaje.
.par_errores <- function() {
  capturar <- function(expr) tryCatch({ force(expr); NULL }, api_error = function(e) e)
  d <- data.frame(sexo = c(rep("H", 50), rep("M", 40), rep("99", 6), rep(NA, 4)), z = 0, stringsAsFactors = FALSE)
  Filter(Negate(is.null), list(
    capturar(ponderacion_compute(d, .par_cfg(.PAR_SEXO, faltantes = "imputar"))),
    capturar(ponderacion_compute(d, list(enabled = TRUE, design = list(peso_columna = "no_existe")))),
    capturar(ponderacion_compute(d, list(enabled = TRUE, design = list(peso_columna = "z")))),
    capturar(ponderacion_compute(d, c(.par_cfg(.PAR_SEXO), list(escala = "expansion")))),
    # Expansión sin ningún margen, ni estratos, ni peso base.
    capturar(ponderacion_compute(d, list(enabled = TRUE, escala = "expansion")))
  ))
}

test_that("autoprueba: el revisor cae con la redacción anterior de los avisos", {
  anteriores <- c(
    "Efecto de diseno alto (DEFF=2.93): la muestra efectiva baja a 341 de 1000 (pierde 66% de precision). Calibra menos variables o revisa si esta ponderacion vale la pena.",
    "La ponderacion cuesta ~44% de precision (DEFF=1.79, n efectivo 56).",
    "Pesos muy dispersos (max/min=20). Aplica un recorte (trim) para estabilizar la varianza.",
    "El raking no convergio. Suele deberse a objetivos incompatibles o categorias sin casos en la muestra.",
    sprintf("2 casos de %sE2_sex%s sin dato o sin meta (3) conservan su peso en ese margen: el ajuste se aplica sólo a los casos con categoría válida.",
            .par_chr(171L), .par_chr(187L)),
    sprintf("Se imputaron 8 casos por hot-deck dentro de celdas de %ssexo%s %s %sedad%s.",
            .par_chr(171L), .par_chr(187L), .par_chr(215L), .par_chr(171L), .par_chr(187L)),
    "El ajuste no convergió en 1 iteraciones."
  )
  caidos <- .par_hallazgos(anteriores)
  reglas <- unique(sub(":.*$", "", caidos))
  expect_setequal(reglas, c("comillas_angulares", "solo_con_tilde", "palabra_sin_tilde", "jerga_del_motor",
                            "separador_vetado", "porcentaje_pegado", "concordancia_con_uno"))
  # Cada texto anterior cae al menos por una regla.
  for (texto in anteriores) expect_gt(length(.par_hallazgos(texto)), 0L)
  # Un decimal con coma y un texto bien escrito, cada uno por su lado.
  expect_match(.par_hallazgos("El peso mayor queda en 4,25 veces la media."), "^decimal_con_coma")
  expect_identical(.par_hallazgos("10 casos sin dato en \"sexo\" (valores: 98, 99) conservan su peso. Meta: 12.5 % de 10,000."),
                   character())
})

test_that("autoprueba: el lector de códigos ve un aviso nuevo, partido en líneas o del puente", {
  codigo <- '
    avisos[[length(avisos) + 1L]] <- .ponderacion_aviso(
      "warn", "aviso_partido_en_lineas",
      sprintf("texto %d", n)
    )
    add("info", "aviso_del_puente", "texto")
    add_avisos(attr(w, "avisos"))
    add <- function(level, code, message) NULL
    otra_funcion("warn", "no_es_un_aviso")
  '
  expect_identical(.par_codigos_en(codigo), c("aviso_del_puente", "aviso_partido_en_lineas"))
})

test_that("cada aviso que el motor puede emitir se provoca aquí", {
  skip_if_not(dir.exists(.par_dir_r()), "sin fuentes de api/R a mano")
  en_fuente <- .par_codigos_fuente()
  # Si el barrido deja de encontrar códigos, la guarda se habría vuelto muda.
  expect_gte(length(en_fuente), 14L)
  provocados <- unique(vapply(.par_avisos_ui(), function(a) as.character(a$code), character(1)))
  expect_identical(setdiff(en_fuente, provocados), character())
  expect_identical(setdiff(provocados, en_fuente), character())
})

test_that("los avisos de ponderación llegan bien escritos a la pantalla", {
  avisos <- .par_avisos_ui()
  mensajes <- vapply(avisos, function(a) as.character(a$message), character(1))
  expect_gte(length(unique(mensajes)), 25L)
  expect_true(all(nzchar(mensajes)))
  # Cada aviso conserva su forma: nivel, código y mensaje.
  for (a in avisos) {
    expect_true(a$level %in% c("warn", "info"), info = a$code)
    expect_match(a$code, "^[a-z_]+$")
  }
  hallazgos <- .par_hallazgos(mensajes)
  expect_identical(hallazgos, character(), info = paste(hallazgos, collapse = "\n"))
  # Frase completa: empieza en mayúscula o en cifra y termina en punto.
  expect_true(all(grepl("^[A-ZÁÉÍÓÚ0-9]", mensajes)), info = paste(mensajes, collapse = "\n"))
  expect_true(all(grepl("[.]$", mensajes)), info = paste(mensajes, collapse = "\n"))
})

test_that("los avisos concuerdan en número y nombran las variables entre comillas rectas", {
  mensajes <- vapply(.par_avisos_ui(), function(a) as.character(a$message), character(1))
  hay <- function(fragmento) expect_true(any(grepl(fragmento, mensajes, fixed = TRUE)), info = fragmento)
  # Casos fuera del margen: qué mueve el ajuste y sobre qué se calcula la meta.
  cola_margen <- " su peso en ese margen. El ajuste de este margen solo mueve a los casos con categoría válida, y su meta se calcula sobre la suma de los pesos de esos casos."
  hay(paste0("1 caso sin dato en \"sexo\" (valor: vacío) conserva", cola_margen))
  hay(paste0("10 casos sin dato en \"sexo\" (valores: vacío, 99) conservan", cola_margen))
  hay(paste0("5 casos de \"sexo\" sin dato o sin meta (valor: Otro) conservan", cola_margen))
  # Estratos sin tamaño de población: la acción depende de qué falta.
  hay("1 caso está en un estrato sin tamaño de población (vacío): queda con factor 1 en el peso de diseño, sin corrección por estrato. Revisa los casos sin dato en el estrato.")
  hay("20 casos están en estratos sin tamaño de población (Y, Z): quedan con factor 1 en el peso de diseño, sin corrección por estrato. Declara el tamaño de población que falta.")
  hay("7 casos están en estratos sin tamaño de población (vacío, Z): quedan con factor 1 en el peso de diseño, sin corrección por estrato. Declara el tamaño de población que falta y revisa los casos sin dato en el estrato.")
  hay("Un estrato con población no tiene casos en la muestra (C)")
  hay("Hay estratos con población y sin casos en la muestra (C, D)")
  # Categorías sin casos: las metas de las presentes se reescalan; sin ninguna
  # categoría de la meta con casos el margen no se ajusta; si solo quedan con casos
  # categorías de meta 0, la frase no afirma ninguna de las dos cosas.
  hay("El margen \"sexo\" tiene una categoría sin casos en la muestra (X): su meta (10.0 %) no se puede cumplir. Las metas de las demás categorías se reescalan para sumar 100 %.")
  hay("El margen \"sexo\" tiene categorías sin casos en la muestra (X, Y): sus metas (20.0 % en total) no se pueden cumplir. Las metas de las demás categorías se reescalan para sumar 100 %.")
  hay("El margen \"sexo\" tiene una categoría sin casos en la muestra (X): su meta (100.0 %) no se puede cumplir y el margen no se ajusta.")
  hay("El margen \"sexo\" tiene categorías sin casos en la muestra (H, M): sus metas (100.0 % en total) no se pueden cumplir y el margen no se ajusta.")
  expect_true("El margen \"sexo\" tiene una categoría sin casos en la muestra (X): su meta (100.0 %) no se puede cumplir." %in% mensajes)
  # Sin converger: la causa es de las metas o de un cruce vacío, no de una categoría sin casos.
  causa <- ": los márgenes pueden quedar lejos de sus metas. Suele deberse a metas incompatibles entre sí o a combinaciones de categorías de distintos márgenes sin casos en la muestra."
  expect_true(paste0("El ajuste por márgenes no convergió en 1 iteración", causa) %in% mensajes)
  expect_true(paste0("El ajuste por márgenes no convergió en 2 iteraciones", causa) %in% mensajes)
  expect_true(paste0("El ajuste por márgenes no convergió", causa) %in% mensajes)
  expect_false(any(grepl("o a categorías sin casos", mensajes, fixed = TRUE)))
  hay("con los márgenes en 1 ciclo:")
  hay("con los márgenes en 5 ciclos:")
  # Imputación: el porcentaje es de los casos de la base, y la celda de cada caso
  # usa las variables en que ese caso tiene dato.
  hay("Se imputó 1 caso sin dato en \"sexo\" (0.5 % de los casos de la base)")
  hay("Se imputaron 8 casos sin dato en \"sexo\" (4 % de los casos de la base) con el valor de otro caso elegido al azar (hot-deck) entre los casos con el mismo valor en \"edad\", con semilla 20261104. La imputación se usa solo para calcular el peso: la variable de la base no cambia.")
  hay("entre los casos con el mismo valor en \"edad\" y \"zona\" (en las variables donde el caso tiene dato), con semilla")
  hay("entre los casos con el mismo valor en \"edad\" y \"zona\" (en las variables donde el caso tiene dato; en toda la muestra para 1 caso sin dato también en esas variables), con semilla")
  hay("entre los casos con el mismo valor en \"edad\" (en toda la muestra para 3 casos sin dato también en esa variable), con semilla")
  hay("entre todos los casos de la muestra, con semilla")
  hay("1 caso sin dato en \"sexo\" no tenía otro caso con dato")
  hay("3 casos sin dato en \"sexo\" no tenían otro caso con dato")
  hay("1 caso sin dato en \"sexo\" no se imputó porque ningún caso de la base")
  hay("40 casos sin dato en \"sexo\" no se imputaron porque ningún caso de la base")
  hay("El peso de expansión usa el total de \"sexo\" (10,000).")
  hay("activa \"Recalibrar después del recorte\".")
})

test_that("los avisos de diagnóstico dicen de qué base sale cada cifra", {
  # 100 casos: 90 con peso 1 y 10 con peso 20. Tamaño efectivo = 290^2 / 4090 = 20.6;
  # efecto de diseño = 100 / 20.6 = 4.86; pérdida = 1 - 20.6 / 100 = 79 %.
  alto <- .analitica_ponderacion_warnings(.par_resultado(c(rep(1, 90), rep(20, 10))))
  por_codigo <- stats::setNames(lapply(alto, `[[`, "message"), vapply(alto, `[[`, "", "code"))
  expect_identical(names(por_codigo), c("deff_alto", "pesos_extremos"))
  expect_identical(
    por_codigo$deff_alto,
    "Efecto de diseño por ponderación alto (4.86): el tamaño efectivo de la muestra baja a 21 de 100 casos (79 % menos). Calibra con menos variables o revisa si la ponderación es necesaria."
  )
  expect_identical(
    por_codigo$pesos_extremos,
    "Pesos muy dispersos: el mayor es 20 veces el menor. Activa \"Recortar pesos extremos\" o baja su tope para reducir la varianza de los resultados."
  )
  # Con un peso 0, la razón sigue siendo entre pesos mayores que cero (20 / 1) y la frase lo dice.
  con_cero <- .analitica_ponderacion_warnings(.par_resultado(c(0, rep(1, 89), rep(20, 10))))
  extremos <- Filter(function(a) identical(a$code, "pesos_extremos"), con_cero)
  expect_length(extremos, 1L)
  expect_identical(
    extremos[[1]]$message,
    "Pesos muy dispersos: el mayor es 20 veces el menor peso mayor que cero. Activa \"Recortar pesos extremos\" o baja su tope para reducir la varianza de los resultados."
  )
  # 100 casos: 80 con peso 1 y 20 con peso 5. Tamaño efectivo = 180^2 / 580 = 55.9;
  # 1 - 55.9 / 100 = 44 % menos; efecto de diseño = 100 / 55.9 = 1.79.
  medio <- .analitica_ponderacion_warnings(.par_resultado(c(rep(1, 80), rep(5, 20))))
  expect_length(medio, 1L)
  expect_identical(medio[[1]]$code, "deff_medio")
  expect_identical(
    medio[[1]]$message,
    "Por la ponderación, el tamaño efectivo de la muestra es 56 de 100 casos (44 % menos; efecto de diseño por ponderación de 1.79)."
  )
  # Con el ajuste por márgenes sin converger y sin aviso del motor, el puente lo dice una vez.
  sin_converger <- .analitica_ponderacion_warnings(.par_resultado(rep(1, 10), rake_applied = TRUE, converged = FALSE))
  expect_identical(vapply(sin_converger, `[[`, "", "code"), "no_converge")
  expect_match(sin_converger[[1]]$message, "^El ajuste por márgenes no convergió:")
})

test_that("los errores de configuración que muestra la vista previa cumplen la misma redacción", {
  errores <- .par_errores()
  codigos <- vapply(errores, function(e) as.character(e$code), character(1))
  expect_setequal(codigos, c("E_PONDERACION_IMPUTACION_EXCEDE_UMBRAL", "E_PONDERACION_PESO_BASE_INEXISTENTE",
                             "E_PONDERACION_PESO_BASE_INVALIDO", "E_PONDERACION_EXPANSION_SIN_TOTAL"))
  mensajes <- vapply(errores, conditionMessage, character(1))
  hallazgos <- .par_hallazgos(mensajes)
  expect_identical(hallazgos, character(), info = paste(hallazgos, collapse = "\n"))
  # Ningún mensaje nombra un parámetro interno del motor.
  expect_false(any(grepl("total_poblacion|peso_columna", mensajes)))
  # Sin total, con márgenes o sin ellos, el mensaje no afirma cómo están escritas las metas.
  sin_total <- mensajes[codigos == "E_PONDERACION_EXPANSION_SIN_TOTAL"]
  expect_identical(unique(sin_total), "El peso de expansión necesita la población total y no hay de dónde obtenerla: no hay metas en conteos, ni tamaños de estrato, ni peso base. Declara la población total o escribe las metas como conteos.")
  expect_length(sin_total, 2L)
  expect_true(any(grepl("faltan 10 % en \"sexo\", más que el 5 % permitido. Usa \"Dejar fuera del margen\"",
                        mensajes, fixed = TRUE)))
})
