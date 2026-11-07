# Un .pulso guardado antes del ADR 0123 puede traer el equipo y los códigos
# declarados en el Planner. Hoy esas secciones sólo se leen (respaldo de
# lectura de Material hasta la fase Q6), así que los tests las siembran como
# vendrían de ese .pulso, sin pasar por `.planner_declarar`, que ya no las acepta.
.planner_sembrar_legado <- function(sid, seccion, valor) {
  actual <- .planner_leer(session_get(sid))
  actual$secciones[[seccion]] <- list(valor = .planner_normalizar_seccion(seccion, valor),
                                      declarado_en = "2026-10-31T12:00:00Z")
  actual$revision <- actual$revision + 1L
  session_set(sid, "planner", .planner_a_persistir(actual))
  invisible(actual)
}
