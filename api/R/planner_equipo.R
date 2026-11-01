# =============================================================================
# Planner: el equipo de cada perfil, para Material y Monitoreo (ADR 0122 §10)
# =============================================================================
#
# Una sola lista del estudio (P7 resuelta por el ADR: vive en el Planner) y una
# lectura por perfil: encuestadores en territorial y telefónico, aplicadores en
# aulas. Lectura pura; nadie escribe el equipo desde aquí.
#
# Quién entra en un perfil: quien lo declara en `perfiles`. Quien no declara
# ninguno entra por su rol (aplicador → aulas; encuestador → territorial y
# telefónico; operador → telefónico; supervisor → todos).
#
# Datos personales: sólo código y nombre, nunca el DNI. Con `code_format =
# "DNI"` el código ES el DNI: no se expone a nadie y la lectura dice que está
# bloqueada, la misma regla que ya aplica Material a su asignación
# (collection_territorial_asignacion.R).

# Función y no constante: este archivo se carga antes que planner_modelo.R
# (orden alfabético) y PLANNER_TIPOS_PERFIL todavía no existe a esa altura.
.planner_perfiles_de_rol <- function(rol) {
  switch(rol %||% "",
         aplicador = "aulas",
         encuestador = c("territorial", "telefonico"),
         operador = "telefonico",
         supervisor = PLANNER_TIPOS_PERFIL,
         character(0))
}

.planner_persona_en_perfil <- function(p, perfil) {
  declarados <- unlist(p$perfiles %||% list())
  if (length(declarados)) return(perfil %in% declarados)
  perfil %in% .planner_perfiles_de_rol(p$rol)
}

#' El equipo de un perfil de recojo. Lectura pura.
#' @keywords internal
.planner_equipo_de <- function(s, perfil) {
  perfil <- calc_enum(perfil, PLANNER_TIPOS_PERFIL, "")
  if (!nzchar(perfil)) {
    stop_api(404, "E_PLANNER_SECCION", "El Planner no tiene ese perfil de recojo.", details = list(perfil = perfil))
  }
  decl <- .planner_leer(s)$secciones$equipo
  equipo <- if (!is.null(decl)) decl$valor else .planner_proyectar_equipo(s)
  base <- list(ok = TRUE, perfil = perfil, origen = if (is.null(decl)) "proyectado" else "declarado",
               code_format = equipo$code_format)
  if (identical(toupper(equipo$code_format %||% ""), "DNI")) {
    return(c(base, list(bloqueado = TRUE,
                        motivo = "El código del equipo es el DNI: el Planner no lo entrega a otros módulos.",
                        personas = list())))
  }
  personas <- Filter(function(p) .planner_persona_en_perfil(p, perfil), equipo$personas)
  c(base, list(bloqueado = FALSE, personas = lapply(personas, function(p) {
    list(codigo = p$codigo, nombre = p$nombre, rol = p$rol, activo = isTRUE(p$activo))
  })))
}
