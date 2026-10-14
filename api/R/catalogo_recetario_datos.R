# Datos sintéticos del catálogo del recetario (checklist-catalogo-recetario-2026-10-14.md, K1).
#
# Gonzalo (2026-10-14): «crear un .pulso que contemple absolutamente todos los gráficos posibles según el recetario».
# Un estudio de acreditación inventado con tres públicos (como el recetario: 52 docentes, 172 estudiantes, 178
# egresados) y dos procesos anteriores de estudiantes para la serie temporal. Cada variable existe porque una página del
# recetario la necesita; el comentario de cada bloque dice cuál. Semilla fija: el .pulso se regenera idéntico.

CATALOGO_RECETARIO_SEMILLA <- 20261014L

.cr_escala <- function(lista, rotulos, sin_inf = TRUE) {
  data.frame(list_name = lista, name = c(seq_along(rotulos), if (sin_inf) 99L),
             label = c(rotulos, if (sin_inf) "SIN INF"), stringsAsFactors = FALSE)
}

.catalogo_recetario_choices <- function() {
  rbind(
    .cr_escala("acuerdo", c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo")),
    # Acreditación (Gonzalo, 2026-10-14: «multiapiladas por tema con misma escala y diferente escala»): los docentes
    # responden los servicios en cinco puntos y los estudiantes en cuatro; los egresados, en la escala de cuatro con
    # otra caja en las etiquetas («Totalmente en Desacuerdo», como en Conta) y con otros nombres de variable.
    .cr_escala("acuerdo5", c("Totalmente en desacuerdo", "En desacuerdo", "Ni de acuerdo ni en desacuerdo", "De acuerdo", "Totalmente de acuerdo")),
    .cr_escala("acuerdo_eg", c("Totalmente en Desacuerdo", "En Desacuerdo", "De Acuerdo", "Totalmente de Acuerdo")),
    .cr_escala("utilidad", c("Nada útil", "Poco útil", "Útil", "Totalmente útil")),
    .cr_escala("satisf", c("Muy insatisfecho", "Insatisfecho", "Satisfecho", "Muy satisfecho")),
    .cr_escala("relacion", c("Nada relacionado", "Poco relacionado", "Algo relacionado", "Relacionado", "Muy relacionado"), sin_inf = FALSE),
    .cr_escala("si_no", c("Sí", "No"), sin_inf = FALSE),
    .cr_escala("sexo", c("Mujer", "Hombre", "Prefiero no responder"), sin_inf = FALSE),
    .cr_escala("ciclo", c("Quinto ciclo", "Sexto ciclo", "Séptimo ciclo", "Octavo ciclo", "Noveno ciclo", "Décimo ciclo"), sin_inf = FALSE),
    .cr_escala("grado", c("Bachiller", "Licenciatura", "Maestría", "Doctorado"), sin_inf = FALSE),
    .cr_escala("situacion", c("Dependiente", "Independiente", "Dependiente e independiente", "Busca empleo", "No trabaja ni busca"), sin_inf = FALSE),
    .cr_escala("ingreso", c("Menos de S/ 1,500", "S/ 1,500 a 2,999", "S/ 3,000 a 4,999", "S/ 5,000 a 7,999", "S/ 8,000 o más"), sin_inf = FALSE),
    .cr_escala("canales", c("Página web de la Facultad", "Reuniones con autoridades", "Correo institucional", "Redes sociales",
                            "Inducción", "Sesiones de clase", "Otro"), sin_inf = FALSE),
    .cr_escala("mejoras", c("Herramientas digitales e inteligencia artificial", "Actualización del plan de estudios",
                            "Práctica en campo, talleres y laboratorios", "Rubros de alta demanda", "Vinculación docente con la industria",
                            "Orientación sobre perfiles profesionales", "Comunicación, liderazgo y habilidades blandas",
                            "Gestión de proyectos y finanzas", "Apoyo a la inserción laboral", "No sabe / Ninguna sugerencia"), sin_inf = FALSE),
    # Mapa de Lima por distrito (p107): el código es el ubigeo, que es lo que el mapa reconoce.
    data.frame(list_name = "distrito", name = c("150101", "150122", "150130", "150131", "150132", "150103", "150117", "150140"),
               label = c("Lima", "Miraflores", "San Borja", "San Isidro", "San Juan de Lurigancho", "Ate", "Los Olivos", "Santiago de Surco"),
               stringsAsFactors = FALSE)
  )
}

# Ítems compartidos por los públicos: lo que compara el informe por actor.
.CR_GESTION <- c("Las autoridades informan a tiempo las decisiones que afectan a la Unidad.",
                 "Los procesos administrativos de la Unidad son ágiles.",
                 "Los requisitos para trámites académicos son claros.",
                 "La Unidad escucha las sugerencias de su comunidad.",
                 "Los espacios de estudio son suficientes.",
                 "La biblioteca cuenta con el material que necesito.")
.CR_COMPETENCIAS <- c("Estados financieros", "Tributación", "Auditoría", "Finanzas", "Visión empresarial", "Costos y presupuestos")
.CR_OE <- c("OE1: Diseña soluciones sostenibles y seguras", "OE2: Gestiona proyectos en equipos multidisciplinarios",
            "OE3: Se actualiza de forma permanente en su campo profesional", "OE4: Actúa con ética y responsabilidad social")
.CR_SERVICIOS <- c("Biblioteca", "Bienestar estudiantil", "Servicio de salud")
.CR_ASPECTOS <- c("Trato del personal", "Tiempo de atención", "Claridad de la información", "Infraestructura")

.cr_fila <- function(type, name, label, relevant = NA_character_) {
  data.frame(type = type, name = name, label = label, relevant = relevant, stringsAsFactors = FALSE)
}

#' Hoja `survey` del público (`docentes`, `estudiantes`, `egresados`; las olas usan la de estudiantes reducida).
#' @keywords internal
.catalogo_recetario_survey <- function(publico) {
  comunes <- rbind(
    .cr_fila("select_one sexo", "sexo", "Sexo"),
    .cr_fila("integer", "edad", "Edad (años)"),
    # Dicotómica y dona (p70, p76).
    .cr_fila("select_one si_no", "conoce_mision", "¿Conoce la misión y los propósitos de la Facultad?"),
    .cr_fila("select_one si_no", "consulta_mision", "¿Sabe dónde consultar la misión?"),
    # Opción múltiple entre actores (p191).
    .cr_fila("select_multiple canales", "canales", "¿Por qué canales conoce la misión y la visión?"),
    # Premisa con Top y Bottom Two Box por público (p79).
    .cr_fila("select_one acuerdo", "tutoria", "La Unidad cuenta con servicios de tutoría académica."),
    # Escala por premisas: divergentes (p71), multiapiladas, matriz de cuadrantes (p91).
    do.call(rbind, lapply(seq_along(.CR_GESTION), function(i) .cr_fila("select_one acuerdo", paste0("gestion_", i), .CR_GESTION[i]))),
    # Competencias del perfil: radar, puntos por competencia, brecha, dimensiones (p88, p93–p99).
    do.call(rbind, lapply(seq_along(.CR_COMPETENCIAS), function(i) .cr_fila("select_one acuerdo", paste0("comp_", i),
      sprintf("La formación desarrolla la competencia: %s.", .CR_COMPETENCIAS[i])))),
    # Satisfacción con la atención (p98, propuesta del recetario que el motor no produce; la escala sí se grafica).
    .cr_fila("select_one satisf", "satisf_general", "En general, ¿qué tan satisfecho está con la atención en la Unidad?"),
    do.call(rbind, lapply(seq_along(.CR_ASPECTOS), function(i) .cr_fila("select_one satisf", paste0("satisf_", i), .CR_ASPECTOS[i]))),
    # Abierta: nube de palabras y de frases (p101–p104).
    .cr_fila("text", "comentario", "¿Qué cambiaría de la carrera?")
  )
  servicios <- switch(publico,
    docentes = do.call(rbind, lapply(seq_along(.CR_SERVICIOS), function(i) .cr_fila("select_one acuerdo5", paste0("serv_", i),
      sprintf("El servicio de %s responde a las necesidades de la comunidad.", tolower(.CR_SERVICIOS[i]))))),
    egresados = do.call(rbind, lapply(seq_along(.CR_SERVICIOS), function(i) .cr_fila("select_one acuerdo_eg", paste0("p40_", i),
      sprintf("El servicio de %s respondía a mis necesidades.", tolower(.CR_SERVICIOS[i]))))),
    do.call(rbind, lapply(seq_along(.CR_SERVICIOS), function(i) .cr_fila("select_one acuerdo", paste0("serv_", i),
      sprintf("El servicio de %s responde a mis necesidades.", tolower(.CR_SERVICIOS[i])))))
  )
  propios <- switch(publico,
    docentes = rbind(
      .cr_fila("select_one grado", "grado", "Grado académico más alto alcanzado"),
      .cr_fila("integer", "anios_docencia", "Años de docencia en la Facultad")
    ),
    estudiantes = rbind(
      .cr_fila("select_one ciclo", "ciclo", "Nivel curricular del estudiante"),          # barras categóricas (p68)
      .cr_fila("integer", "horas_estudio", "Horas de estudio a la semana")
    ),
    egresados = rbind(
      .cr_fila("select_one si_no", "titulo", "¿Cuenta con título universitario?"),        # torta (p69)
      .cr_fila("select_one si_no", "trabaja", "¿Está trabajando actualmente?"),           # dicotómica (p76)
      .cr_fila("select_one situacion", "situacion", "¿Cuál es su situación laboral actual?"),
      .cr_fila("select_one relacion", "relacion", "¿Qué tan relacionado está su trabajo con la carrera?",
               relevant = "selected(${situacion}, '1') or selected(${situacion}, '2') or selected(${situacion}, '3')"),  # llave (p194)
      .cr_fila("select_one ingreso", "ingreso", "Ingreso mensual",
               relevant = "selected(${situacion}, '1')"),                                 # filtro al costado (p193)
      .cr_fila("select_multiple mejoras", "mejoras", "¿Qué podría mejorar la carrera?"),  # ranking (p72–p75)
      .cr_fila("integer", "anio_egreso", "Año de egreso"),                                # histograma (p81)
      .cr_fila("integer", "meses_empleo", "Meses hasta conseguir el primer empleo"),      # caja, media y rango (p83–p84)
      .cr_fila("select_one distrito", "distrito", "Distrito de residencia"),              # mapa por distrito (p107)
      do.call(rbind, lapply(seq_along(.CR_OE), function(i) .cr_fila("select_one utilidad", paste0("oe_", i), .CR_OE[i])))  # p78
    ),
    stop("Público desconocido: ", publico, call. = FALSE)
  )
  rbind(comunes, servicios, propios)
}

# ---- Respuestas -----------------------------------------------------------------------------------------------------

# Escala de acuerdo con una inclinación por público: `nivel` mueve la masa hacia «de acuerdo».
.cr_likert <- function(n, nivel, k = 4L, sin_inf = 0.04) {
  base <- switch(as.character(k), "4" = c(0.08, 0.22, 0.45, 0.25), "5" = c(0.06, 0.11, 0.2, 0.33, 0.3))
  p <- base * exp(nivel * (seq_len(k) - (k + 1) / 2) / k)
  p <- p / sum(p) * (1 - sin_inf)
  sample(c(seq_len(k), if (sin_inf > 0) 99L), n, replace = TRUE, prob = c(p, if (sin_inf > 0) sin_inf))
}

.cr_multiple <- function(n, probs) {
  vapply(seq_len(n), function(i) {
    hit <- which(stats::runif(length(probs)) < probs)
    if (!length(hit)) hit <- which.max(probs)
    paste(hit, collapse = " ")
  }, character(1))
}

# Frases de respuestas abiertas: repiten palabras y pares («habilidades blandas», «mercado laboral», «malla
# curricular») como las del recetario p104, para que la nube y las frases tengan qué contar.
.CR_FRASES <- c(
  "Más cursos de habilidades blandas y liderazgo", "Conectar la malla curricular con el mercado laboral",
  "Actualizar la malla curricular con cursos electivos", "Más proyectos reales con empresas",
  "Cursos de inteligencia artificial aplicada", "Mayor vinculación con el mercado laboral",
  "Gestión de proyectos desde los primeros ciclos", "Más prácticas en el campo laboral",
  "Docentes con experiencia en el mercado", "Talleres de habilidades blandas", "Actualizar el plan de estudios",
  "Más cursos de gestión y finanzas", "Conocimiento técnico más profundo", "Desarrollo de proyectos interdisciplinarios",
  "Mejorar la orientación sobre el campo laboral", "Más laboratorios y talleres prácticos"
)

.cr_texto <- function(n, vacio = 0.25) {
  x <- sample(.CR_FRASES, n, replace = TRUE, prob = rev(seq_along(.CR_FRASES)))
  x[stats::runif(n) < vacio] <- NA_character_
  x
}

#' Respuestas de un público
#' @param publico `docentes`, `estudiantes`, `egresados`, o una ola anterior (`estudiantes_2018`, `estudiantes_2021`).
#' @param n Casos.
#' @param nivel Inclinación de las escalas: los docentes, más de acuerdo; las olas anteriores, menos.
#' @keywords internal
.catalogo_recetario_respuestas <- function(publico, n, nivel) {
  d <- data.frame(id = sprintf("%s-%03d", substr(publico, 1, 3), seq_len(n)), stringsAsFactors = FALSE)
  d$sexo <- sample(1:3, n, replace = TRUE, prob = c(0.52, 0.45, 0.03))
  d$edad <- switch(sub("_.*", "", publico), docentes = round(stats::rnorm(n, 48, 9)), egresados = round(stats::rnorm(n, 29, 4)),
                   round(stats::rnorm(n, 21, 2)))
  d$conoce_mision <- sample(1:2, n, replace = TRUE, prob = c(0.62 + 0.1 * nivel, 0.38 - 0.1 * nivel))
  d$consulta_mision <- sample(1:2, n, replace = TRUE, prob = c(0.7 + 0.08 * nivel, 0.3 - 0.08 * nivel))
  d$canales <- .cr_multiple(n, c(0.48, 0.3, 0.55, 0.36, 0.42, 0.33, 0.05))
  d$tutoria <- .cr_likert(n, nivel, sin_inf = 0.15)
  for (i in seq_along(.CR_GESTION)) d[[paste0("gestion_", i)]] <- .cr_likert(n, nivel + c(0.8, -0.6, 0.2, -1, 0.4, 0)[i])
  for (i in seq_along(.CR_COMPETENCIAS)) d[[paste0("comp_", i)]] <- .cr_likert(n, nivel + 1.2 + c(0.4, 0.3, 0.2, 0.1, -0.2, -0.1)[i], sin_inf = 0.02)
  d$satisf_general <- .cr_likert(n, nivel + 0.5)
  for (i in seq_along(.CR_ASPECTOS)) d[[paste0("satisf_", i)]] <- .cr_likert(n, nivel + c(1, -0.8, 0.3, 0.8)[i])
  d$comentario <- .cr_texto(n)
  for (i in seq_along(.CR_SERVICIOS)) {
    v <- if (identical(publico, "egresados")) paste0("p40_", i) else paste0("serv_", i)
    d[[v]] <- .cr_likert(n, nivel + c(0.5, 0, -0.6)[i], k = if (identical(publico, "docentes")) 5L else 4L)
  }
  if (identical(publico, "docentes")) {
    d$grado <- sample(1:4, n, replace = TRUE, prob = c(0.05, 0.25, 0.5, 0.2))
    d$anios_docencia <- pmax(1L, as.integer(round(stats::rexp(n, 1 / 12))))
  }
  if (startsWith(publico, "estudiantes")) {
    d$ciclo <- sample(1:6, n, replace = TRUE, prob = c(0.13, 0.11, 0.2, 0.19, 0.21, 0.16))
    d$horas_estudio <- pmax(2L, as.integer(round(stats::rnorm(n, 18, 6))))
  }
  if (identical(publico, "egresados")) {
    d$titulo <- sample(1:2, n, replace = TRUE, prob = c(0.31, 0.69))
    d$trabaja <- sample(1:2, n, replace = TRUE, prob = c(0.95, 0.05))
    d$situacion <- sample(1:5, n, replace = TRUE, prob = c(0.52, 0.18, 0.08, 0.15, 0.07))
    trabaja <- d$situacion %in% 1:3
    d$relacion <- ifelse(trabaja, sample(1:5, n, replace = TRUE, prob = c(0.06, 0.11, 0.17, 0.35, 0.31)), NA_integer_)
    d$ingreso <- ifelse(d$situacion == 1, sample(1:5, n, replace = TRUE, prob = c(0.12, 0.3, 0.3, 0.18, 0.1)), NA_integer_)
    d$mejoras <- .cr_multiple(n, c(0.29, 0.27, 0.26, 0.21, 0.15, 0.15, 0.15, 0.13, 0.09, 0.04))
    d$anio_egreso <- sample(2015:2025, n, replace = TRUE, prob = c(4, 5, 6, 8, 9, 10, 11, 12, 12, 11, 9))
    d$meses_empleo <- as.integer(round(pmax(0, stats::rgamma(n, 2, 0.4))))
    d$distrito <- sample(c("150101", "150122", "150130", "150131", "150132", "150103", "150117", "150140"), n, replace = TRUE,
                         prob = c(0.1, 0.12, 0.1, 0.08, 0.2, 0.14, 0.14, 0.12))
    for (i in seq_along(.CR_OE)) d[[paste0("oe_", i)]] <- .cr_likert(n, nivel + c(1, -0.3, 0.8, 1.1)[i], sin_inf = 0.02)
  }
  d
}

#' Bases del catálogo: nombre → `list(survey, data)`, con la semilla fija
#' @keywords internal
.catalogo_recetario_bases <- function() {
  set.seed(CATALOGO_RECETARIO_SEMILLA)
  spec <- list(
    docentes = list(n = 52L, nivel = 0.9, survey = "docentes"),
    estudiantes = list(n = 172L, nivel = 0, survey = "estudiantes"),
    egresados = list(n = 178L, nivel = 0.3, survey = "egresados"),
    # Procesos anteriores de acreditación (serie temporal, p89–p90): el mismo instrumento de estudiantes.
    estudiantes_2018 = list(n = 140L, nivel = -0.7, survey = "estudiantes"),
    estudiantes_2021 = list(n = 158L, nivel = -0.35, survey = "estudiantes")
  )
  lapply(stats::setNames(names(spec), names(spec)), function(b) {
    s <- spec[[b]]
    list(survey = .catalogo_recetario_survey(s$survey), data = .catalogo_recetario_respuestas(b, s$n, s$nivel))
  })
}
