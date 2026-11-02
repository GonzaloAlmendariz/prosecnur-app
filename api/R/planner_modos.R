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

# Canal del Modelo de Monitoreo → tipo de campaña de Material (ADR 0125 §5).
.PLANNER_CANAL_A_CAMPANA <- c(correo = "correo", telefonico = "telefonica", presencial = "aulas")

#' Los canales que el Modelo de Monitoreo declara por público en acreditación,
#' en el orden de sus rondas (ADR 0125 §5). Contrato: cada unidad del modelo
#' (`monitoreo_config$monitoreo_profile$units[[i]]`, el elenco de
#' `POST /api/monitoreo/actores`) trae
#' `canales = list(list(ronda = 1L, canal = "correo"), list(ronda = 2L, canal =
#' "telefonico"), …)` con `canal` ∈ correo · telefonico · presencial. Devuelve
#' los tipos de campaña distintos, o vacío si ningún público declara canales.
#' Lectura pura.
#' @keywords internal
.planner_canales_del_modelo <- function(s) {
  units <- tryCatch(s$monitoreo_config$monitoreo_profile$units, error = function(e) NULL)
  if (!is.list(units)) return(character(0))
  canales <- unlist(lapply(units, function(u) {
    if (!is.list(u) || !is.list(u$canales)) return(NULL)
    vapply(Filter(is.list, u$canales), function(r) as.character(r$canal %||% "")[1], "")
  }), use.names = FALSE)
  campanas <- unname(.PLANNER_CANAL_A_CAMPANA[intersect(canales, names(.PLANNER_CANAL_A_CAMPANA))])
  unique(campanas[!is.na(campanas)])
}

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
         # ADR 0125 §3: aulas es siempre cursos-horario con fichas QR; el marco
         # de alumnos es un atributo (identidad, variables y metas), no otra
         # selección.
         aulas = "opinion-universitaria",
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
.planner_modos_de <- function(perfiles, canales_acreditacion = character(0)) {
  perfiles <- Filter(function(p) is.list(p) && nzchar(p$tipo %||% ""), perfiles %||% list())
  # ADR 0124: un estudio, un tipo. Un .pulso que guardó dos fija el modo con el primero.
  perfiles <- utils::head(perfiles, 1L)
  tipos <- vapply(perfiles, `[[`, "", "tipo")
  con_calc <- Filter(function(p) identical(p$diseno, "calc-muestra"), perfiles)
  territorial <- Filter(function(p) identical(p$tipo, "territorial") && !identical(p$diseno, "cuotas"), perfiles)
  perfil_calc <- if (length(con_calc)) con_calc[[1]] else if (length(territorial)) territorial[[1]] else NULL
  sin_calc <- Filter(function(p) identical(p$diseno, "cliente"), perfiles)

  modos_mon <- unname(.PLANNER_PERFIL_A_MODO_MONITOREO[tipos])
  familias <- unname(.PLANNER_PERFIL_A_FAMILIA[tipos])
  # ADR 0124: un estudio, un tipo, y el Planner no declara canales. ADR 0125 §5:
  # en acreditación los canales los declara el Modelo de Monitoreo por público
  # (correo, telefónico, presencial; a veces en rondas). Material abre los que
  # el Modelo declara —campañas `telefonica` y `aulas` de siempre con
  # `proposito = "acreditacion"`— y, si todavía no declara ninguno, la de correo.
  campanas <- unname(.PLANNER_PERFIL_A_CAMPANA[tipos])
  if ("acreditacion" %in% tipos && length(canales_acreditacion)) {
    campanas <- c(setdiff(campanas, "correo"), canales_acreditacion)
  }
  # ADR 0125 §4: toda campaña telefónica (también la de acreditación) tiene su
  # supervisión, una campaña `supervision` por lote que arma Material con
  # `relacion$viene_de` apuntando a la telefónica.
  if ("telefonica" %in% campanas) campanas <- c(campanas, "supervision")
  aulas <- Filter(function(p) identical(p$tipo, "aulas"), perfiles)

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
      campanas = as.list(unique(campanas)),
      proposito = if ("acreditacion" %in% tipos) "acreditacion" else NULL
    ),
    # ADR 0125 §3: anónimo o con marco de alumnos. Se guarda en `seleccion`
    # (`marco`) para que ningún .pulso se migre.
    aulas = list(
      con_marco = length(aulas) > 0L && identical(aulas[[1]]$seleccion, "marco")
    ),
    hojas_ruta = list(
      # Sólo el territorial por UMP aleatoria hace hoja de ruta.
      aplica = length(territorial) > 0L,
      # ADR 0125 §2: Hojas trabaja por UMP (aleatorio) o por zona con cuotas
      # por celda. `aplica` pasa a ser verdadero también en cuotas cuando el
      # Home lo lea así (anexo A del ADR).
      modo = {
        t <- Filter(function(p) identical(p$tipo, "territorial"), perfiles)
        if (!length(t)) NULL else if (identical(t[[1]]$diseno, "cuotas")) "cuotas" else "ump"
      }
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
  c(.planner_modos_de(.planner_payload_perfiles(s), .planner_canales_del_modelo(s)),
    list(origen = if (is.null(guardado$secciones$perfiles)) "deducido" else "declarado",
         revision = guardado$revision))
}
