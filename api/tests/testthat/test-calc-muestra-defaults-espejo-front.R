# El front y el motor no pueden declarar defaults distintos para el mismo
# criterio, y si lo hacen tiene que ser a proposito y por escrito.
#
# Asi paso desapercibido `min_elegibles_aula = 15`: el motor tenia su default y
# `constants.ts` tenia otro, el del front GANA —R lo lee como alias de
# `min_eligible_per_class`— y los dos decian 15, asi que nadie noto que eran dos
# fuentes. Cuando se corrigio solo el motor, el gate salio verde y el defecto
# siguio vivo: un proyecto nuevo seguia recortando 3.491 de 5.269
# cursos-horario sin un solo criterio declarado.
#
# Este test compara los defaults espejados y falla si aparece una divergencia
# NUEVA. Las conocidas se declaran abajo con su motivo: quedan documentadas en
# vez de escondidas.

.dfe_constants <- function() {
  path <- file.path("..", "..", "..", "frontend", "src", "features", "calcMuestra",
                    "universidad", "shared", "constants.ts")
  if (!file.exists(path)) {
    path <- file.path(rprojroot::find_root(rprojroot::has_dir(".git")), "frontend", "src",
                      "features", "calcMuestra", "universidad", "shared", "constants.ts")
  }
  path
}

.dfe_valor <- function(txt, clave) {
  # Toma el valor literal de `clave: <valor>,` dentro del bloque de defaults.
  m <- regmatches(txt, regexpr(sprintf("\n  %s: [^\n]*", clave), txt))
  if (!length(m)) return(NA_character_)
  v <- sub(sprintf("^\n  %s: ", clave), "", m)
  trimws(sub(",\\s*$", "", v))
}

test_that("los defaults espejados coinciden entre el front y el motor", {
  path <- .dfe_constants()
  skip_if_not(file.exists(path), "constants.ts no disponible en este entorno")
  txt <- paste(readLines(path, warn = FALSE), collapse = "\n")
  motor <- calc_muestra_aulas_default_config()$filters

  # clave del front -> clave del motor
  espejo <- c(
    min_elegibles_aula = "min_eligible_per_class",
    min_age = "min_age",
    require_adult = "require_adult",
    require_undergraduate = "require_undergraduate",
    require_in_person = "require_in_person",
    require_stable_teacher = "require_stable_teacher",
    require_faculty_prevalence = "require_faculty_prevalence",
    min_faculty_prevalence_pct = "min_faculty_prevalence_pct",
    min_prevalence_pct = "min_prevalence_pct",
    min_cycle_homogeneity_pct = "min_cycle_homogeneity_pct"
  )

  # Divergencias CONOCIDAS y deliberadas. Cada una con su motivo; si una deja de
  # ser cierta, este test lo dice al fallar por el otro lado.
  conocidas <- list(
    require_faculty_prevalence = paste(
      "El front lo activa (true) y el motor no. Es el criterio de composicion",
      "por facultad al 80%: exigir que la mayoria de elegibles del aula sea de",
      "esa facultad. Medido en la cascada 2026 recorta -62 en Ciencias e",
      "Ingenieria y -43 en Arte y Diseno. Puede ser deliberado; la decision es",
      "de Gonzalo y esta anotada en el encargo del loop."
    )
  )

  divergen <- character(0)
  for (clave_front in names(espejo)) {
    v_front <- .dfe_valor(txt, clave_front)
    if (is.na(v_front)) next
    v_motor <- motor[[espejo[[clave_front]]]]
    if (is.null(v_motor)) next
    igual <- identical(tolower(v_front), tolower(as.character(v_motor)))
    if (!igual) divergen <- c(divergen, sprintf("%s (front=%s, motor=%s)", clave_front, v_front, v_motor))
  }

  nuevas <- divergen[!vapply(divergen, function(d) {
    any(vapply(names(conocidas), function(k) startsWith(d, k), TRUE))
  }, TRUE)]

  expect_identical(
    nuevas, character(0),
    label = "divergencias NUEVAS entre los defaults del front y los del motor"
  )
})

test_that("el minimo de elegibles por aula es 1 en los DOS lados", {
  # El caso concreto que motivo este archivo: ningun criterio es global, y el
  # minimo por aula se decide POR FACULTAD. Si alguien vuelve a poner 15 en
  # cualquiera de los dos sitios, esto lo dice.
  path <- .dfe_constants()
  skip_if_not(file.exists(path), "constants.ts no disponible en este entorno")
  txt <- paste(readLines(path, warn = FALSE), collapse = "\n")
  expect_identical(.dfe_valor(txt, "min_elegibles_aula"), "1")
  expect_identical(calc_muestra_aulas_default_config()$filters$min_eligible_per_class, 1L)
})
