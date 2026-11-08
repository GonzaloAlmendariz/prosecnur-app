# Ayudas de la ola 2 del motor PPT (tests test-ola2-*.R): fixtures sintéticos con el instrumento completo y un lector de
# las cajas de texto de una lámina.
#
# Los fixtures llenan `orders_list` desde las choices (`.freq_augment_orders_list_from_choices`, E5): sin eso los ejes
# muestran los códigos «1»/«2» en vez de las etiquetas, que es lo que el render real hace (reporte_frecuencias.R).
# Datos sintéticos; nunca datos de cliente.

.ola2_instrumento <- function(survey, choices) {
  inst <- list(survey = survey, choices = choices)
  inst$orders_list <- .freq_augment_orders_list_from_choices(NULL, inst$survey, inst$choices)
  inst
}

# Las familias de la QA conjunta (fix3/familias.R): q19/q20 Likert 1-4 + 9, dedicación, ¿conoce?, facultad y sexo.
.ola2_familias <- function() {
  set.seed(1)
  q <- c(rep("2", 2), rep("3", 20), rep("4", 1), rep("1", 2), rep("2", 4), rep("3", 38), rep("4", 6), rep("9", 4))
  q2 <- sample(c("1", "2", "3", "4", "9"), 77, TRUE, prob = c(.05, .1, .5, .3, .05))
  ded <- c(rep("1", 23), rep("2", 54))
  cat6 <- sample(c("a", "b", "c", "d", "e", "f"), 77, TRUE)
  sx <- sample(c("1", "2"), 77, TRUE)
  d <- data.frame(q19 = q, q20 = q2, ded = ded, p18 = sample(c("1", "2"), 77, TRUE, prob = c(.8, .2)), cat6 = cat6, sx = sx,
                  stringsAsFactors = FALSE)
  survey <- data.frame(
    name = c("q19", "q20", "ded", "p18", "cat6", "sx"),
    type = c("select_one lk", "select_one lk", "select_one dd", "select_one sn", "select_one c6", "select_one sx"),
    list_name = c("lk", "lk", "dd", "sn", "c6", "sx"),
    label = c("El reglamento es pertinente", "El reglamento es claro", "Dedicación", "¿Conoce el reglamento?", "Facultad", "Sexo"),
    stringsAsFactors = FALSE)
  choices <- data.frame(
    list_name = c(rep("lk", 5), "dd", "dd", "sn", "sn", rep("c6", 6), "sx", "sx"),
    name = c("1", "2", "3", "4", "9", "1", "2", "1", "2", letters[1:6], "1", "2"),
    label = c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "SIN INF",
              "Tiempo completo (TC)", "Tiempo parcial por asignaturas (TPA)", "Sí", "No",
              "Arquitectura", "Artes escénicas", "Ciencias sociales", "Derecho", "Gestión", "Letras y ciencias humanas",
              "Mujer", "Hombre"),
    stringsAsFactors = FALSE)
  list(data = list(doc = d), inst = list(doc = .ola2_instrumento(survey, choices)))
}

# E1b (diag4/e1b_repel.R): Likert 1-4 + 9 con segmentos chicos vecinos (4 % y 5 % en el lado negativo, 4 % en el extremo
# positivo) y, en la segunda pregunta, un 2 % en el extremo negativo: por debajo del umbral de 3 % que hoy lo oculta.
.ola2_e1b <- function() {
  mk <- function(n, p) unname(unlist(mapply(function(k, m) rep(k, m), names(p), round(p * n / 100))))
  q1 <- mk(200, c("1" = 4, "2" = 5, "3" = 78, "4" = 4, "9" = 9))
  q2 <- mk(200, c("1" = 2, "2" = 6, "3" = 71, "4" = 15, "9" = 6))
  d <- data.frame(q1 = q1, q2 = q2, stringsAsFactors = FALSE)
  lab <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "SIN INF")
  survey <- data.frame(name = c("q1", "q2"), type = "select_one lk", list_name = "lk", label = c("Pregunta uno", "Pregunta dos"),
                       stringsAsFactors = FALSE)
  choices <- data.frame(list_name = "lk", name = c("1", "2", "3", "4", "9"), label = lab, stringsAsFactors = FALSE)
  list(data = list(doc = d), inst = list(doc = .ola2_instrumento(survey, choices)))
}

.ola2_presets <- function() .build_presets(.enriquecer_presets(list(), NULL))

.ola2_pptx <- function(fx, slides) {
  pth <- tempfile("ola2-", fileext = ".pptx")
  invisible(suppressMessages(suppressWarnings(reporte_ppt_plan(
    data = fx$data, instrumento = fx$inst, presets = .ola2_presets(), plan = p_plan(slides = slides),
    path_ppt = pth, mensajes_progreso = FALSE))))
  pth
}

.ola2_lista <- function(fx, slides) {
  suppressMessages(suppressWarnings(reporte_ppt_plan(
    data = fx$data, instrumento = fx$inst, presets = .ola2_presets(), plan = p_plan(slides = slides),
    solo_lista = TRUE, mensajes_progreso = FALSE)))$rendered
}

.ola2_emu <- function(x) as.numeric(x) / 914400

# Formas de una lámina (`<p:sp>` de primer nivel o anidadas, sin componer la transformación de un grupo: igual que
# diag4/solapes.py). `texto` vacío = forma sin texto (barra, línea, guía).
.ola2_formas <- function(pptx, k) {
  s <- .leer_parte_zip(pptx, sprintf("ppt/slides/slide%d.xml", k))
  sps <- regmatches(s, gregexpr("(?s)<p:sp>.*?</p:sp>", s, perl = TRUE))[[1]]
  filas <- lapply(sps, function(b) {
    t <- regmatches(b, gregexpr("<a:t>[^<]*</a:t>", b))[[1]]
    t <- trimws(paste(gsub("</?a:t>", "", t), collapse = ""))
    off <- regmatches(b, regexec('<a:off x="(-?\\d+)" y="(-?\\d+)"', b))[[1]]
    ext <- regmatches(b, regexec('<a:ext cx="(\\d+)" cy="(\\d+)"', b))[[1]]
    if (length(off) < 3 || length(ext) < 3) return(NULL)
    sz <- regmatches(b, regexec('sz="(\\d+)"', b))[[1]]
    x <- .ola2_emu(off[2]); y <- .ola2_emu(off[3]); w <- .ola2_emu(ext[2]); h <- .ola2_emu(ext[3])
    data.frame(texto = t, x0 = x, y0 = y, x1 = x + w, y1 = y + h,
               pt = if (length(sz) >= 2) as.numeric(sz[2]) / 100 else NA_real_,
               cust = grepl("custGeom", b, fixed = TRUE) || grepl('prst="line"', b, fixed = TRUE),
               stringsAsFactors = FALSE)
  })
  out <- do.call(rbind, filas[!vapply(filas, is.null, logical(1))])
  if (is.null(out)) out <- data.frame(texto = character(0), x0 = numeric(0), y0 = numeric(0), x1 = numeric(0),
                                      y1 = numeric(0), pt = numeric(0), cust = logical(0))
  out
}

.ola2_cajas <- function(pptx, k) { f <- .ola2_formas(pptx, k); f[nzchar(f$texto), , drop = FALSE] }

.ola2_es_cifra <- function(t) grepl("^[+-]?\\d+([.,]\\d+)?\\s?%$", t)

# Port de diag4/solapes.py: pares de textos cortos (< 12 caracteres) cuyas cajas se cruzan más de 0.005 in en x y en y.
.ola2_solapes <- function(cajas) {
  c2 <- cajas[nchar(cajas$texto) < 12, , drop = FALSE]
  out <- character(0)
  n <- nrow(c2)
  if (n < 2) return(out)
  for (i in seq_len(n - 1)) for (j in (i + 1):n) {
    a <- c2[i, ]; b <- c2[j, ]
    ox <- min(a$x1, b$x1) - max(a$x0, b$x0); oy <- min(a$y1, b$y1) - max(a$y0, b$y0)
    if (ox > 0.005 && oy > 0.005) out <- c(out, sprintf("%s(%.2fpt) x %s(%.2fpt): %.3f x %.3f in", a$texto, a$pt, b$texto, b$pt, ox, oy))
  }
  out
}

# Aire vertical entre dos cajas (negativo si se pisan en y) y distancia horizontal (0 si se cruzan en x).
.ola2_aire_y <- function(a, b) max(a$y0, b$y0) - min(a$y1, b$y1)
.ola2_dist_x <- function(a, b) max(0, max(a$x0, b$x0) - min(a$x1, b$x1))

# Contraste WCAG 2.x entre dos colores (hex o nombre de R).
.ola2_contraste <- function(c1, c2) {
  lum <- function(col) {
    v <- grDevices::col2rgb(col)[, 1] / 255
    v <- ifelse(v <= 0.03928, v / 12.92, ((v + 0.055) / 1.055)^2.4)
    sum(c(0.2126, 0.7152, 0.0722) * v)
  }
  l <- sort(c(lum(c1), lum(c2)), decreasing = TRUE)
  (l[1] + 0.05) / (l[2] + 0.05)
}
