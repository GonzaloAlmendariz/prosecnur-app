# Fixtures del motor de Hallazgos (M2 de Validación). Se apoyan en las de M1
# (helper-validacion-m1.R): dos bases hermanas, "Hogares" y "Personas", con su
# formulario y su base en archivos reales.

# Base donde solo el caso u01 queda marcado, y por dos reglas: edad fuera de
# 16 a 25 (RC_001) y P4 = 1 con P21 entre 4, 5, 6 y 8 (RC_002).
.m2_datos_un_caso_dos_hallazgos <- function() {
  d <- .m1_datos()
  d$edad <- c(15, 18, 20, 21, 22, 16, 25, 24, 19, 19)
  d$p4 <- c(1, 1, 2, 2, 2, 2, 1, 2, 2, 2)
  d$p21 <- c(4, 2, 5, 8, 1, 6, 3, 9, 4, 3)
  d
}

# Audita la base en proceso (el trabajo `callr` se sustituye por el motor, como
# en M1); el sustituto rige solo durante la llamada.
.m2_auditar <- function(sid, base) {
  registro <- new.env(); registro$llamadas <- list()
  testthat::local_mocked_bindings(job_submit = .m1_jobs_en_proceso(registro))
  validacion_auditoria_lanzar(sid, base)
  invisible(validacion_scope_get(sid, base)$evaluacion)
}

.m2_declarar_llave <- function(sid, base, variables) {
  cfg <- normalize_validation_operational_config(list(
    version = 2L, identity = list(enabled = TRUE, variables = as.list(variables))
  ))
  validacion_scope_set(sid, base, "operational_config", cfg)
}

# Ids de los casos que marca una regla, con la llave que rige la base. Corre
# también contra el código anterior a M2 (sin llave), para ver las pruebas en
# rojo por lo que afirman y no por una función que falta.
.m2_ids_marcados <- function(sid, base, id_regla) {
  scope <- validacion_scope_get(sid, base)
  if (!exists(".limpieza_identidad_caso", mode = "function")) {
    return(.limpieza_rule_case_map(scope$evaluacion, id_regla)$case_ids)
  }
  .limpieza_rule_case_map(scope$evaluacion, id_regla,
                          .limpieza_identidad_caso(scope)$variables)$case_ids
}
