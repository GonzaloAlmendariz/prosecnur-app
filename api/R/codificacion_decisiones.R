# ADR 0078 — marcar una variable abre una decisión, no la cierra.
#
# Una codificación está completa cuando no le quedan variables marcadas sin
# decidir, no cuando todas las marcadas tienen categorías. Este archivo traduce
# el `status` operativo que ya calcula el router al vocabulario de decisiones
# del ADR, y cuenta el pendiente.
#
# Se deriva de `status` a propósito, en vez de recalcularse en paralelo: dos
# taxonomías de estado sobre los mismos datos divergen, y ya nos pasó.

# Las seis formas en que puede estar una variable frente a la decisión de
# codificarla. Las tres primeras la cierran; las tres últimas no.
CODIF_DECISIONES <- c(
  "categorizada",       # tiene categorías y toda respuesta tiene destino
  "no_categorizar",     # decisión explícita, con motivo
  "sin_material",       # no hay respuestas: se cierra sola
  "sin_marcar",         # nadie declaró la intención; no entra en ningún conteo
  "pendiente",          # marcada, con respuestas, sin categorías
  "pendiente_parcial",  # catálogo creado, respuestas sin asignar
  "requiere_config"     # marcada pero le falta declarar el modo (SO sin modo)
)

# Las que dejan trabajo abierto. `sin_material` no está: no hay nada que
# decidir. `sin_marcar` tampoco: la decisión solo aplica a lo que alguien
# declaró que iba a codificar.
CODIF_DECISIONES_ABIERTAS <- c("pendiente", "pendiente_parcial", "requiere_config")

.codif_decision_de_pregunta <- function(status, marcada, no_categorizar = NULL) {
  # Una decisión explícita gana sobre cualquier estado derivado: es el punto
  # del ADR — «no categorizar» cierra igual que categorizar.
  if (is.list(no_categorizar) && length(no_categorizar)) return("no_categorizar")
  if (!isTRUE(marcada)) return("sin_marcar")
  switch(as.character(status %||% ""),
    "completo"        = "categorizada",
    "sin-datos"       = "sin_material",
    "no-iniciado"     = "pendiente",
    "en-curso"        = "pendiente_parcial",
    "requiere-config" = "requiere_config",
    "no-aplica"       = "sin_marcar",
    "pendiente"
  )
}

# El número accionable del punto 4 del ADR: cuántas quedan sin decidir y
# cuáles, con cuántas respuestas tiene cada una. No un porcentaje de avance:
# «te quedan 3» se puede actuar, «68% codificado» no.
.codif_resumen_decisiones <- function(preguntas) {
  vacio <- list(
    marcadas = 0L, sin_decidir = 0L, categorizadas = 0L,
    no_categorizar = 0L, sin_material = 0L, pendientes = list()
  )
  if (!length(preguntas)) return(vacio)

  decisiones <- vapply(preguntas, function(p) as.character(p$decision %||% ""), character(1))
  marcadas <- vapply(preguntas, function(p) isTRUE(p$marcada), logical(1))
  abiertas <- decisiones %in% CODIF_DECISIONES_ABIERTAS

  pendientes <- lapply(preguntas[abiertas], function(p) {
    list(
      parent = as.character(p$parent %||% ""),
      parent_label = as.character(p$parent_label %||% ""),
      decision = as.character(p$decision %||% ""),
      n_respuestas = as.integer(p$n_respuestas %||% 0L),
      n_unicas = as.integer(p$n_unicas %||% 0L),
      n_codificadas = as.integer(p$n_codificadas %||% 0L)
    )
  })
  # Primero las que más trabajo tienen detrás: es el orden en que conviene
  # atacarlas y el que hace evidente cuál importa.
  orden <- order(-vapply(pendientes, function(p) p$n_respuestas, integer(1)))

  list(
    marcadas = as.integer(sum(marcadas)),
    sin_decidir = as.integer(sum(abiertas)),
    categorizadas = as.integer(sum(decisiones == "categorizada")),
    no_categorizar = as.integer(sum(decisiones == "no_categorizar")),
    sin_material = as.integer(sum(decisiones == "sin_material")),
    pendientes = unname(pendientes[orden])
  )
}

# ---------------------------------------------------------------------------
# «No categorizar»: la decisión de primera clase del punto 2 del ADR
# ---------------------------------------------------------------------------
# Vive en el state de codificación scopeado por base (`codif_por_base`), que se
# persiste entero en el `.pulso` menos los caches `inst`/`data`. No hace falta
# whitelist: lo que hace falta es no llamarla `inst` ni `data`.

.codif_no_categorizar_todas <- function(sid, source = NULL) {
  val <- codif_get(sid, "decisiones_no_categorizar", source = source)
  if (is.list(val)) val else list()
}

.codif_no_categorizar_de <- function(sid, parent, source = NULL) {
  todas <- .codif_no_categorizar_todas(sid, source = source)
  reg <- todas[[as.character(parent %||% "")]]
  if (is.list(reg) && length(reg)) reg else NULL
}

# Registrar exige motivo: una decisión sin porqué no se distingue de un olvido,
# que es exactamente el problema que el ADR vino a resolver.
codif_no_categorizar_set <- function(sid, parent, motivo, source = NULL) {
  parent <- trimws(as.character(parent %||% ""))
  if (!nzchar(parent)) {
    stop_api(400, "E_CODIF_NO_PARENT", "Falta la variable sobre la que se decide.")
  }
  motivo <- trimws(as.character(motivo %||% ""))
  if (!nzchar(motivo)) {
    stop_api(400, "E_CODIF_MOTIVO_REQUERIDO",
             "Decidir no categorizar exige un motivo: sin el porque no se distingue de un olvido.")
  }
  todas <- .codif_no_categorizar_todas(sid, source = source)
  todas[[parent]] <- list(
    motivo = motivo,
    decidido_en = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  )
  codif_set(sid, "decisiones_no_categorizar", todas, source = source)
  invisible(todas[[parent]])
}

# Revertirla la devuelve a pendiente; no borra nada más.
codif_no_categorizar_unset <- function(sid, parent, source = NULL) {
  parent <- trimws(as.character(parent %||% ""))
  todas <- .codif_no_categorizar_todas(sid, source = source)
  if (is.null(todas[[parent]])) {
    stop_api(409, "E_CODIF_SIN_DECISION",
             "Esta variable no tiene registrada una decision de no categorizar.")
  }
  todas[[parent]] <- NULL
  codif_set(sid, "decisiones_no_categorizar", todas, source = source)
  invisible(TRUE)
}

# Lo que se va a entregar sin recodificar, para la advertencia del punto 5 y
# para el libro de códigos. Las tres razones no son lo mismo y el entregable
# tiene que poder distinguirlas.
.codif_sin_recodificar <- function(preguntas) {
  interes <- c(CODIF_DECISIONES_ABIERTAS, "no_categorizar")
  hits <- Filter(function(p) as.character(p$decision %||% "") %in% interes, preguntas)
  lapply(hits, function(p) {
    dec <- as.character(p$decision %||% "")
    list(
      parent = as.character(p$parent %||% ""),
      parent_label = as.character(p$parent_label %||% ""),
      decision = dec,
      motivo = as.character((p$no_categorizar %||% list())$motivo %||% ""),
      n_respuestas = as.integer(p$n_respuestas %||% 0L),
      deliberado = identical(dec, "no_categorizar")
    )
  })
}

# ---------------------------------------------------------------------------
# El `status` operativo, en un solo lugar
# ---------------------------------------------------------------------------
# Vivía dentro del endpoint que lista las preguntas. Al necesitarlo también
# `/aplicar` —para declarar qué se entrega sin recodificar— la opción de
# recalcularlo allá habría creado la segunda taxonomía que este archivo existe
# para evitar. Ahora los dos llaman aquí.
.codif_status_de_pregunta <- function(tipo, modo_so, use_flag, n_respuestas, n_unicas, n_codificadas) {
  needs_config <- identical(tipo, "select_one") && !(modo_so %in% c("padre", "hijo"))
  if (!isTRUE(use_flag)) return("no-aplica")
  if (needs_config) return("requiere-config")
  if (as.integer(n_respuestas %||% 0L) == 0L) return("sin-datos")
  if (as.integer(n_codificadas %||% 0L) == 0L) return("no-iniciado")
  if (as.integer(n_codificadas %||% 0L) < as.integer(n_unicas %||% 0L)) return("en-curso")
  "completo"
}

# Las decisiones de todas las preguntas del draft, sin pasar por el endpoint
# que arma el payload completo (que además lee etiquetas, secciones y
# candidatos de texto que acá no hacen falta).
.codif_decisiones_del_draft <- function(sid, draft, data_df, source = NULL) {
  rows <- draft$rows %||% list()
  if (!length(rows)) return(list())
  marcadas_set <- codif_get(sid, "marcadas", source = source) %||% list()
  recod_todas <- codif_get(sid, "respuestas_recod", source = source) %||% list()
  no_cat_todas <- .codif_no_categorizar_todas(sid, source = source)

  lapply(rows, function(r) {
    parent <- as.character(r$parent %||% "")
    tipo <- as.character(r$tipo %||% "")
    modo_so <- as.character(r$modo_so %||% "")
    stats <- .pregunta_stats(r, data_df)
    n_cod <- length(recod_todas[[parent]] %||% list())
    status <- .codif_status_de_pregunta(
      tipo = tipo, modo_so = modo_so, use_flag = isTRUE(r$use),
      n_respuestas = stats$n_respuestas, n_unicas = stats$n_unicas, n_codificadas = n_cod
    )
    marcada <- nzchar(as.character(r$text_col %||% "")) || isTRUE(marcadas_set[[parent]])
    no_cat <- no_cat_todas[[parent]]
    list(
      parent = parent,
      parent_label = as.character(r$parent_label %||% parent),
      marcada = marcada,
      n_respuestas = as.integer(stats$n_respuestas %||% 0L),
      n_unicas = as.integer(stats$n_unicas %||% 0L),
      n_codificadas = as.integer(n_cod),
      no_categorizar = no_cat,
      decision = .codif_decision_de_pregunta(status, marcada, no_cat)
    )
  })
}
