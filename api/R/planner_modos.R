# =============================================================================
# Planner: el modo que el perfil de recojo fija en cada módulo (ADR 0122 §4)
# =============================================================================
#
# La tabla «perfil → modo» vive aquí y sólo aquí. Cálculo de muestra, Material
# de campo, Monitoreo, Hojas de ruta y el Home la consultan (fase P2) en vez de
# preguntarle al usuario el tipo de estudio. Lectura pura: parte del payload
# del Planner (lo declarado o, si no, lo deducido para el modo) y no escribe nada.
#
# Con un perfil, cada módulo aterriza en su modo. Con varios, el landing del
# módulo lista sólo los declarados (§8): por eso cada módulo recibe la LISTA de
# sus modos y, aparte, el que corresponde cuando hay uno solo.

# Familia del cable de Monitoreo (ADR 0044: `family` no se renombra).
.PLANNER_PERFIL_A_FAMILIA <- c(
  territorial = "territorial",
  aulas = "aulas_universitarias",
  telefonico = "telefonico",
  acreditacion = "acreditacion"
)

# Modo de Monitoreo en la navegación (lib/modules.ts).
.PLANNER_PERFIL_A_MODO_MONITOREO <- c(
  territorial = "territorial",
  aulas = "aulas",
  telefonico = "telefonico",
  acreditacion = "acreditacion"
)

# Tipo de campaña de Material (collection_campaigns.R, .MCAMP_TIPOS).
.PLANNER_PERFIL_A_CAMPANA <- c(
  territorial = "territorial",
  aulas = "aulas",
  telefonico = "telefonica",
  acreditacion = "correo"
)

# `macro_familia` que `iniciar-estudio` toma del Planner (.CM_MACRO_FAMILIAS).
# Sale del MODO de Cálculo y no del perfil: `inferDesk` manda
# `listado_telefonico` a la mesa legacy, así que un telefónico nuevo debe llegar
# como `estudio_propio`, que es lo que la UI de Cálculo envía para «marco
# disponible» (aviso de la sesión de Monitoreo y Cálculo, P2). Leer un .pulso
# viejo sigue traduciendo `listado_telefonico` → telefónico (proyección, §7).
.PLANNER_MODO_A_MACRO <- c(
  `territorial-handoff` = "territorial",
  `opinion-universitaria` = "encuesta_estudiantes",
  `marco-disponible` = "estudio_propio",
  acreditacion = "acreditacion"
)

.planner_modo_calc <- function(perfil) {
  # Territorial por conveniencia o cuotas: no hay sorteo ni hoja de ruta, así
  # que Cálculo no tiene un puntero a Hojas de ruta que ofrecer.
  if (identical(perfil$tipo, "territorial")) {
    return(if (identical(perfil$diseno, "cuotas")) NULL else "territorial-handoff")
  }
  switch(perfil$tipo,
         aulas = if (identical(perfil$seleccion, "marco")) "marco-disponible" else "opinion-universitaria",
         telefonico = "marco-disponible",
         acreditacion = "acreditacion",
         NULL)
}

#' Los modos que los perfiles del estudio fijan en cada módulo. Lectura pura.
#'
#' `calc$modo` sale del único perfil con `diseno = calc-muestra` (§4); si no
#' hay, de un territorial (puntero a Hojas de ruta); si tampoco, es `NULL` y
#' Cálculo muestra su vacío propio. `monitoreo$modos` y `material$campanas` son
#' listas: con más de un perfil, el landing del módulo ofrece sólo esas.
#' @keywords internal
.planner_modos_de <- function(perfiles) {
  perfiles <- Filter(function(p) is.list(p) && nzchar(p$tipo %||% ""), perfiles %||% list())
  tipos <- vapply(perfiles, `[[`, "", "tipo")
  con_calc <- Filter(function(p) identical(p$diseno, "calc-muestra"), perfiles)
  territorial <- Filter(function(p) identical(p$tipo, "territorial") && !identical(p$diseno, "cuotas"), perfiles)
  perfil_calc <- if (length(con_calc)) con_calc[[1]] else if (length(territorial)) territorial[[1]] else NULL
  sin_calc <- Filter(function(p) identical(p$diseno, "cliente"), perfiles)

  modos_mon <- unname(.PLANNER_PERFIL_A_MODO_MONITOREO[tipos])
  familias <- unname(.PLANNER_PERFIL_A_FAMILIA[tipos])
  # Acreditación no es sólo por correo (Gonzalo, 1/11): sus campañas salen de sus
  # canales, correo y teléfono. Qué abre su canal presencial con QR lo decide
  # Material (checklist-planner-q5, ítem 4b). Los demás perfiles abren la suya,
  # y cualquiera que declare el canal correo abre además campañas de correo.
  campanas <- unlist(lapply(perfiles, function(p) {
    canales <- unlist(p$canales)
    if (!identical(p$tipo, "acreditacion")) return(unname(.PLANNER_PERFIL_A_CAMPANA[p$tipo]))
    c(if ("correo" %in% canales) "correo", if ("telefono" %in% canales) "telefonica")
  }))
  con_correo <- vapply(perfiles, function(p) "correo" %in% unlist(p$canales), logical(1))
  if (any(con_correo)) campanas <- c(campanas, "correo")

  modo_calc <- if (is.null(perfil_calc)) NULL else .planner_modo_calc(perfil_calc)
  list(
    perfiles = as.list(tipos),
    calc = list(
      modo = modo_calc,
      perfil = if (is.null(perfil_calc)) NULL else perfil_calc$tipo,
      macro_familia = if (is.null(modo_calc)) NULL else unname(.PLANNER_MODO_A_MACRO[[modo_calc]]),
      # Perfiles cuya muestra entrega el cliente: Cálculo no tiene nada que hacer con ellos.
      del_cliente = as.list(vapply(sin_calc, `[[`, "", "tipo"))
    ),
    monitoreo = list(
      modos = as.list(modos_mon),
      familias = as.list(familias),
      modo = if (length(modos_mon) == 1L) modos_mon[[1]] else NULL,
      familia = if (length(familias) == 1L) familias[[1]] else NULL
    ),
    material = list(
      campanas = as.list(unique(campanas))
    ),
    hojas_ruta = list(
      # Sólo el territorial por UMP aleatoria hace hoja de ruta.
      aplica = length(territorial) > 0L
    ),
    territorial = list(
      seleccion = {
        t <- Filter(function(p) identical(p$tipo, "territorial"), perfiles)
        if (length(t)) t[[1]]$seleccion else NULL
      }
    )
  )
}

#' Los modos según el Planner de la sesión: de los perfiles declarados o, sin
#' declaración, deducidos de lo que ya guardan los módulos (ADR 0123 §5).
#' @keywords internal
.planner_modos <- function(s) {
  guardado <- .planner_leer(s)
  c(.planner_modos_de(.planner_payload_perfiles(s)),
    list(origen = if (is.null(guardado$secciones$perfiles)) "deducido" else "declarado",
         revision = guardado$revision))
}
