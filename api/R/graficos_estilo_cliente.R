# =============================================================================
# graficos_estilo_cliente.R — el estilo del cliente: logos propios y perfil de letra (A6 R3, ADR 0094)
# =============================================================================
#
# Contrato: docs/qa/contrato-word-estilo-f6-2026-10-11.md (§1 forma, §2 R3, §7 decisiones de Gonzalo 14–16).
#
# `config.estilo_cliente` guarda SÓLO lo que difiere del default (ADR 0094 §1): recetario → perfil del catálogo
# (`profile_id`, `.PPT_STYLE_PROFILES[[id]]$estilo_cliente`) → proyecto. Clave ausente = «Del recetario»; presente =
# «Propio». Forma:
#
#   { "version": 1, "ambito": "proyecto" | "base",
#     "logos": { "portada_izquierda" | "portada_derecha" | "contraportada": { "file_id": "…", "nombre": "UNSA" } },
#     "letra": { "paso": "estandar" | "grande" | "muy_grande", "roles": { "<rol>": "<paso>" } } }
#
# Logos por `file_id` del file store (nunca por ruta): viajan en `files/` del `.pulso` y el worker recibe rutas resueltas
# (`.graficos_estilo_cliente_resolver`). Un logo no es secreto; `estilo_cliente` no lleva rutas ni credenciales.
#
# ÁMBITO (decisión 14 de Gonzalo: «Por base o por proyecto, depende del usuario»). El usuario lo elige:
# - "proyecto": el estilo vive UNA vez, en `s$graficos_config$estilo_cliente` (el portador de proyecto), y aplica a
#   todas las bases. En un proyecto sin hermanas independientes es el único portador que existe, así que es su default.
# - "base": cada base guarda el suyo en `graficos_config_por_base[[base]]$estilo_cliente`, como hoy `paletas` y
#   `presets`. Es el default en hermanas independientes (cada base es un estudio con su propio cliente posible).
# El ámbito elegido vive en el portador de proyecto (`s$graficos_config$estilo_cliente$ambito`) y, como todo lo demás,
# sólo si difiere del default. Cambiar de ámbito COPIA y no pierde:
# - base → proyecto: el estilo que el usuario estaba viendo (el de la base activa) pasa a ser el del proyecto; las copias
#   de cada base se conservan intactas (no se aplican mientras el ámbito sea "proyecto").
# - proyecto → base: la base activa queda con el estilo del proyecto; cada base hermana CON config y sin estilo propio
#   recibe una copia; las que ya tenían el suyo lo recuperan; el del proyecto se conserva para una vuelta posterior.
# Las bases sin config todavía heredan como cualquier config (`.graficos_config_inherit_candidate`).

#' Versión de la forma de `estilo_cliente`
#' @keywords internal
.ESTILO_CLIENTE_VERSION <- 1L

#' Ámbitos que el usuario puede elegir
#' @keywords internal
.ESTILO_CLIENTE_AMBITOS <- c("proyecto", "base")

#' Pasos de letra con nombre (K13, spec-tamano-letra-perfil-f6-2026-10-10.md §2): puntos que se suman al recetario
#' @keywords internal
.ESTILO_CLIENTE_PASOS <- c(estandar = 0, grande = 2, muy_grande = 4)

#' Roles de «Afinar por elemento» y los tokens del estándar que desplaza cada uno (PPT: `ppt.tipografia`, Word:
#' `word.tipografia`). Todo token numérico pertenece a un rol: el paso global alcanza a toda la jerarquía.
#' `grafico_minimo` del Word y `cifra_minimo` del PPT son pisos, no tamaños, y no se desplazan. La portada del recetario
#' PPT (`portada_*`, lamina_identidad.R) es de «titulos», como la del Word.
#' @keywords internal
.ESTILO_CLIENTE_ROLES <- list(
  titulos   = list(ppt = c("titulo", "antetitulo", "portada_rotulo", "portada_titulo", "portada_encargo", "portada_fecha",
                           "portada_encargo_izquierda", "portada_fecha_izquierda", "portada_encargo_banda", "portada_fecha_banda"),
                   word = c("titulo_1", "titulo_2", "numero_capitulo")),
  preguntas = list(ppt = c("pregunta", "cuerpo", "narrativa"), word = c("lectura", "cuerpo", "toc_1", "toc_2")),
  cifras    = list(ppt = c("cifra", "cifra_fuera", "cifra_destacada"), word = "grafico_cifra"),
  rotulos   = list(ppt = c("leyenda", "actor", "rotulo_top_two_box"), word = c("rotulo", "grafico_rotulo", "grafico_leyenda")),
  base      = list(ppt = c("base", "n"), word = "base")
)

#' Lugares de logo del Word y el logo del recetario que ocupa cada uno cuando el cliente no sube el suyo
#' @keywords internal
.ESTILO_CLIENTE_LOGOS_RECETARIO <- list(
  portada_izquierda = list(logo = "pucp", nombre = "PUCP"),
  portada_derecha   = list(logo = "pulso", nombre = "PULSO PUCP"),
  contraportada     = list(logo = "pulso", nombre = "PULSO PUCP")
)

#' Tope de tamaño de un logo subido
#' @keywords internal
.ESTILO_CLIENTE_LOGO_MAX_BYTES <- 5 * 1024^2

.ec_png_firma <- as.raw(c(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A))
.ec_obj_vacio <- function() stats::setNames(list(), character(0))   # `{}` en JSON, no `[]`
.ec_txt <- function(v) { v <- as.character(unlist(v) %||% "")[1]; if (length(v) && !is.na(v)) trimws(v) else "" }
.ec_bad <- function(...) stop_api(400, "E_BAD_ESTILO_CLIENTE", paste0(...))

# --- Defaults ---------------------------------------------------------------------------------------------------------

#' Lo que el perfil del catálogo declara para el estilo del cliente (hoy ningún perfil lo hace: rige el recetario)
#' @keywords internal
.graficos_estilo_cliente_de_perfil <- function(profile_id = "") {
  pid <- .ec_txt(profile_id)
  if (!nzchar(pid) || !exists(".PPT_STYLE_PROFILES", inherits = TRUE)) return(list())
  x <- (.PPT_STYLE_PROFILES[[pid]] %||% list())$estilo_cliente
  if (.graficos_is_obj(x)) .graficos_estilo_cliente_validos(x) else list()
}

#' Default del estilo del cliente: recetario y, encima, el perfil del catálogo (decisión 15: por proyecto con el default
#' del perfil). Sin ámbito: el ámbito no es estilo y su default depende del proyecto (`.graficos_estilo_cliente_ambito_default`).
#' @keywords internal
.graficos_estilo_cliente_default <- function(profile_id = "") {
  base <- list(version = .ESTILO_CLIENTE_VERSION, logos = .ec_obj_vacio(),
               letra = list(paso = "estandar", roles = .ec_obj_vacio()))
  perfil <- .graficos_estilo_cliente_de_perfil(profile_id)
  if (length(perfil)) base <- .graficos_deep_merge(base, perfil)
  base
}

#' Ámbito por defecto: "base" en hermanas independientes (como `paletas` y `presets`), "proyecto" en lo demás
#' @keywords internal
.graficos_estilo_cliente_ambito_default <- function(sid) {
  indep <- exists("estudio_is_independent_siblings", mode = "function") &&
    isTRUE(tryCatch(estudio_is_independent_siblings(sid), error = function(e) FALSE))
  if (indep) "base" else "proyecto"
}

#' Ámbito vigente: el elegido (guardado en el portador de proyecto) o el default
#' @keywords internal
.graficos_estilo_cliente_ambito <- function(sid, s = NULL) {
  s <- s %||% session_get(sid, required = FALSE)
  a <- .ec_txt(((s$graficos_config %||% list())$estilo_cliente %||% list())$ambito)
  if (a %in% .ESTILO_CLIENTE_AMBITOS) a else .graficos_estilo_cliente_ambito_default(sid)
}

#' Defaults que `GET /api/graficos/config` publica para «Modificado» (decisión 5a): estilo del perfil + ámbito default
#' @keywords internal
.graficos_estilo_cliente_defaults_publicos <- function(sid, profile_id = "") {
  c(.graficos_estilo_cliente_default(profile_id), list(ambito = .graficos_estilo_cliente_ambito_default(sid)))
}

#' Catálogo de opciones del estilo del cliente (lugares de logo, pasos, roles con su tamaño del recetario)
#' @keywords internal
.graficos_estilo_cliente_opciones <- function() {
  pt_de <- function(medio, tokens) {
    vals <- lapply(tokens, function(k) tryCatch(.std_valor(medio, "tipografia", k), error = function(e) NULL))
    stats::setNames(vals, tokens)[!vapply(vals, is.null, logical(1))]
  }
  list(
    version = .ESTILO_CLIENTE_VERSION,
    ambitos = as.list(.ESTILO_CLIENTE_AMBITOS),
    pasos = lapply(names(.ESTILO_CLIENTE_PASOS), function(p) list(id = p, desplazamiento_pt = .ESTILO_CLIENTE_PASOS[[p]])),
    roles = lapply(names(.ESTILO_CLIENTE_ROLES), function(r) list(
      id = r, ppt = pt_de("ppt", .ESTILO_CLIENTE_ROLES[[r]]$ppt), word = pt_de("word", .ESTILO_CLIENTE_ROLES[[r]]$word))),
    logos = lapply(names(.ESTILO_CLIENTE_LOGOS_RECETARIO), function(k) c(list(lugar = k), .ESTILO_CLIENTE_LOGOS_RECETARIO[[k]]))
  )
}

# --- Validación ---------------------------------------------------------------------------------------------------------

#' Valida un `estilo_cliente` que llega del editor (estricto: 400 `E_BAD_ESTILO_CLIENTE`)
#'
#' Claves desconocidas de primer nivel se conservan sin interpretar (contrato §1). Un logo no puede traer ruta: sólo
#' `file_id` (y `nombre`); un `file_id` que existe en el file store y no es PNG es `E_BAD_LOGO`.
#' @param x `estilo_cliente` tal como llega.
#' @param s Sesión (opcional) para comprobar los `file_id`.
#' @return `x` como lista.
#' @keywords internal
.graficos_estilo_cliente_validar <- function(x, s = NULL) {
  x <- .as_json_list(x)
  if (is.null(x)) return(list())
  if (!.graficos_is_obj(x)) .ec_bad("«estilo_cliente» debe ser un objeto.")
  if (!is.null(x$version) && !identical(suppressWarnings(as.integer(unlist(x$version))[1]), .ESTILO_CLIENTE_VERSION)) {
    .ec_bad(sprintf("«estilo_cliente.version» debe ser %d.", .ESTILO_CLIENTE_VERSION))
  }
  if (!is.null(x$ambito) && !.ec_txt(x$ambito) %in% .ESTILO_CLIENTE_AMBITOS) {
    .ec_bad("«estilo_cliente.ambito» debe ser proyecto o base; llegó «", .ec_txt(x$ambito), "».")
  }
  if (!is.null(x$letra)) {
    l <- .as_json_list(x$letra)
    if (!.graficos_is_obj(l)) .ec_bad("«estilo_cliente.letra» debe ser un objeto.")
    pasos <- names(.ESTILO_CLIENTE_PASOS)
    if (!is.null(l$paso) && !.ec_txt(l$paso) %in% pasos) {
      .ec_bad("«letra.paso» debe ser ", paste(pasos, collapse = ", "), "; llegó «", .ec_txt(l$paso), "».")
    }
    if (!is.null(l$roles)) {
      r <- .as_json_list(l$roles)
      if (!.graficos_is_obj(r)) .ec_bad("«letra.roles» debe ser un objeto.")
      fuera <- setdiff(names(r), names(.ESTILO_CLIENTE_ROLES))
      if (length(fuera)) .ec_bad("Rol de letra desconocido: ", paste(fuera, collapse = ", "), ".")
      for (k in names(r)) if (!is.null(r[[k]]) && !.ec_txt(r[[k]]) %in% pasos) {
        .ec_bad("«letra.roles.", k, "» debe ser ", paste(pasos, collapse = ", "), ".")
      }
    }
  }
  if (!is.null(x$logos)) {
    lg <- .as_json_list(x$logos)
    if (!.graficos_is_obj(lg)) .ec_bad("«estilo_cliente.logos» debe ser un objeto.")
    fuera <- setdiff(names(lg), names(.ESTILO_CLIENTE_LOGOS_RECETARIO))
    if (length(fuera)) .ec_bad("Lugar de logo desconocido: ", paste(fuera, collapse = ", "), ".")
    for (k in names(lg)) {
      e <- lg[[k]]
      if (is.null(e)) next
      if (!.graficos_is_obj(e)) .ec_bad("«logos.", k, "» debe ser un objeto con file_id.")
      if (any(c("path", "ruta") %in% names(e))) .ec_bad("«logos.", k, "» no puede llevar rutas: sólo file_id.")
      fid <- .ec_txt(e$file_id)
      meta <- if (nzchar(fid) && is.list(s)) (s$files %||% list())[[fid]] else NULL
      if (!is.null(meta) && !identical(tolower(.ec_txt(meta$ext)), "png")) {
        stop_api(400, "E_BAD_LOGO", sprintf("El logo de «%s» debe ser un PNG.", k))
      }
    }
  }
  x
}

#' Lector tolerante de lo persistido: descarta con aviso cada bloque inválido y conserva el resto
#' @keywords internal
.graficos_estilo_cliente_validos <- function(x) {
  x <- .as_json_list(x)
  if (!.graficos_is_obj(x) || !length(x)) return(list())
  for (k in intersect(names(x), c("version", "ambito", "letra", "logos"))) {
    ok <- tryCatch({ .graficos_estilo_cliente_validar(x[k]); TRUE }, api_error = function(e) {
      warning(sprintf("Se descartó «estilo_cliente.%s» guardado: %s", k, conditionMessage(e)), call. = FALSE)
      FALSE
    })
    if (!ok) x[[k]] <- NULL
  }
  x
}

# --- Diff (ADR 0094) ------------------------------------------------------------------------------------------------------

#' Quita de `estilo_cliente` lo que coincide con su default; el ámbito no entra (lo maneja el guardado)
#'
#' Fuera: `letra.paso` igual al default, roles iguales al paso que heredarían, logos sin `file_id`, rutas, contenedores
#' vacíos y `version` si no queda nada. Lo desconocido se conserva.
#' @return Lista con sólo decisiones (`list()` si no queda ninguna).
#' @keywords internal
.graficos_estilo_cliente_solo_decisiones <- function(x, profile_id = "") {
  x <- .as_json_list(x)
  if (!.graficos_is_obj(x) || !length(x)) return(list())
  def <- .graficos_estilo_cliente_default(profile_id)
  out <- list()
  for (k in setdiff(names(x), c("version", "ambito"))) {
    v <- x[[k]]
    if (is.null(v) || (is.list(v) && !length(v))) next
    if (identical(k, "letra") && .graficos_is_obj(v)) {
      paso <- .ec_txt(v$paso)
      paso_ef <- if (nzchar(paso)) paso else def$letra$paso
      l <- list()
      if (nzchar(paso) && !identical(paso, def$letra$paso)) l$paso <- paso
      roles <- .as_json_list(v$roles) %||% list()
      roles_def <- def$letra$roles %||% list()
      r <- list()
      for (rol in names(roles)) {
        p <- .ec_txt(roles[[rol]])
        heredado <- .ec_txt(roles_def[[rol]] %||% paso_ef)
        if (nzchar(p) && !identical(p, heredado)) r[[rol]] <- p
      }
      if (length(r)) l$roles <- r
      for (extra in setdiff(names(v), c("paso", "roles"))) l[[extra]] <- v[[extra]]
      if (length(l)) out$letra <- l
      next
    }
    if (identical(k, "logos") && .graficos_is_obj(v)) {
      lg <- list()
      for (lugar in names(v)) {
        e <- .as_json_list(v[[lugar]])
        if (!.graficos_is_obj(e) || !nzchar(.ec_txt(e$file_id))) next
        e$path <- NULL; e$ruta <- NULL
        e$file_id <- .ec_txt(e$file_id)
        if (!is.null(e$nombre) && !nzchar(.ec_txt(e$nombre))) e$nombre <- NULL
        if (!identical(e$file_id, .ec_txt(((def$logos %||% list())[[lugar]] %||% list())$file_id))) lg[[lugar]] <- e
      }
      if (length(lg)) out$logos <- lg
      next
    }
    out[[k]] <- v
  }
  if (!length(out)) return(list())
  c(list(version = .ESTILO_CLIENTE_VERSION), out)
}

#' Repone el default (recetario + perfil) debajo de las decisiones, con el ámbito vigente (lectura: GET y export)
#' @keywords internal
.graficos_estilo_cliente_con_defaults <- function(x, profile_id = "", ambito = NULL) {
  x <- .graficos_estilo_cliente_validos(x)
  ambito <- .ec_txt(ambito %||% x$ambito)
  x$ambito <- NULL
  out <- .graficos_deep_merge(.graficos_estilo_cliente_default(profile_id), x)
  if (nzchar(ambito)) out$ambito <- ambito
  out
}

# Pone (o quita, si es NULL o vacío) el estilo de una config: nunca queda una clave con `NULL` ni `list()`.
.ec_poner <- function(cfg, v) {
  if (is.null(v) || (is.list(v) && !length(v))) cfg$estilo_cliente <- NULL else cfg$estilo_cliente <- v
  cfg
}

# Diff + el ámbito sólo si difiere de su default.
.ec_con_ambito <- function(body, ambito, ambito_default) {
  if (!identical(ambito, ambito_default)) body$ambito <- ambito
  body
}

# --- Lectura y guardado por ámbito --------------------------------------------------------------------------------------

#' Pone en una config leída el estilo del cliente que le corresponde según el ámbito (sin escribir nada)
#'
#' @param cfg Config de la base (o del proyecto, sin hermanas independientes).
#' @param base Base de la config (`""` si no hay hermanas independientes).
#' @return `cfg` con `estilo_cliente` = decisiones + `ambito` (siempre presente, para que el editor lo pinte).
#' @keywords internal
.graficos_estilo_cliente_en_config <- function(sid, s, cfg, base = "") {
  if (!is.list(cfg)) return(cfg)
  ambito <- .graficos_estilo_cliente_ambito(sid, s)
  base <- .ec_txt(base)
  cuerpo <- if (!nzchar(base) || identical(ambito, "proyecto")) {
    ((s %||% list())$graficos_config %||% list())$estilo_cliente
  } else {
    cfg$estilo_cliente
  }
  cuerpo <- .graficos_estilo_cliente_validos(cuerpo)
  cfg$estilo_cliente <- c(.graficos_estilo_cliente_solo_decisiones(cuerpo, cfg$profile_id), list(ambito = ambito))
  cfg
}

#' Prepara el `estilo_cliente` de una config que se va a guardar, según el ámbito
#'
#' Lo llama `.graficos_config_set` antes de escribir. Sin `estilo_cliente` en la config entrante (un autosave que no lo
#' transporta) se conserva el guardado. Con él: se valida (400), se queda con las decisiones y se escribe donde dice el
#' ámbito; si el ámbito cambia, copia sin perder (ver cabecera). Puede escribir el portador de proyecto
#' (`graficos_config`) y las configs de las bases hermanas; devuelve la config a guardar en su portador.
#' @keywords internal
.graficos_estilo_cliente_al_guardar <- function(sid, cfg) {
  if (!is.list(cfg)) return(cfg)
  s <- session_get(sid)
  base <- .graficos_scoped_base(sid)
  configs <- s$graficos_config_por_base %||% list()
  previa_base <- if (nzchar(base)) (configs[[base]] %||% list())$estilo_cliente else NULL
  proyecto <- s$graficos_config
  if (is.null(cfg$estilo_cliente)) {
    return(.ec_poner(cfg, if (nzchar(base)) previa_base else (proyecto %||% list())$estilo_cliente))
  }
  x <- .graficos_estilo_cliente_validar(cfg$estilo_cliente, s)
  amb_def <- .graficos_estilo_cliente_ambito_default(sid)
  amb_actual <- .graficos_estilo_cliente_ambito(sid, s)
  amb_nuevo <- .ec_txt(x$ambito)
  if (!nzchar(amb_nuevo)) amb_nuevo <- amb_actual
  cuerpo <- .graficos_estilo_cliente_solo_decisiones(x, cfg$profile_id)
  if (!nzchar(base)) return(.ec_poner(cfg, .ec_con_ambito(cuerpo, amb_nuevo, amb_def)))
  cuerpo_proyecto <- .graficos_estilo_cliente_solo_decisiones(
    .graficos_estilo_cliente_validos((proyecto %||% list())$estilo_cliente), cfg$profile_id)
  if (identical(amb_nuevo, "proyecto")) {
    nuevo_proyecto <- .ec_con_ambito(cuerpo, "proyecto", amb_def)
    cfg <- .ec_poner(cfg, previa_base)   # la copia de la base se conserva, sin aplicarse
  } else {
    nuevo_proyecto <- .ec_con_ambito(cuerpo_proyecto, "base", amb_def)
    cfg <- .ec_poner(cfg, cuerpo)
    if (identical(amb_actual, "proyecto") && length(cuerpo_proyecto)) {
      hermanas <- setdiff(names(configs), base)
      cambio <- FALSE
      for (b in hermanas) {
        if (is.list(configs[[b]]) && is.null(configs[[b]]$estilo_cliente)) {
          configs[[b]]$estilo_cliente <- cuerpo_proyecto
          cambio <- TRUE
        }
      }
      if (cambio) session_set(sid, "graficos_config_por_base", configs)
    }
  }
  previo <- (proyecto %||% list())$estilo_cliente
  if (!length(nuevo_proyecto)) nuevo_proyecto <- NULL
  if (!identical(previo, nuevo_proyecto) && (is.list(proyecto) || !is.null(nuevo_proyecto))) {
    session_set(sid, "graficos_config", .ec_poner(proyecto %||% list(), nuevo_proyecto))
  }
  cfg
}

#' Aplica el diff de `estilo_cliente` a una config sin ámbito (borrador del consolidado): sólo decisiones, sin `ambito`
#' @keywords internal
.graficos_estilo_cliente_config_solo_decisiones <- function(cfg) {
  if (!is.list(cfg) || is.null(cfg[["estilo_cliente"]])) return(cfg)
  .ec_poner(cfg, .graficos_estilo_cliente_solo_decisiones(.graficos_estilo_cliente_validos(cfg[["estilo_cliente"]]), cfg$profile_id))
}

#' Valida el `estilo_cliente` del body de `POST /config` antes de normalizar (el normalizador es tolerante)
#' @keywords internal
.graficos_estilo_cliente_validar_body <- function(parsed, sid) {
  src <- if (.graficos_is_obj(parsed$config)) parsed$config else parsed
  x <- src$estilo_cliente %||% src$estiloCliente
  if (!is.null(x)) .graficos_estilo_cliente_validar(x, session_get(sid, required = FALSE))
  invisible(TRUE)
}

# --- Logos: forma portable, colecta, poda y nombre ---------------------------------------------------------------------

#' Forma portable: un logo sólo por `file_id` (una ruta heredada se traduce al `file_id` que la registra o se quita)
#' @keywords internal
.graficos_estilo_cliente_portable <- function(x, files = list()) {
  if (!.graficos_is_obj(x) || !.graficos_is_obj(x$logos) || !length(x$logos)) return(x)
  rutas <- vapply(files %||% list(), function(m) {
    p <- .ec_txt((m %||% list())$path); if (nzchar(p)) normalizePath(p, winslash = "/", mustWork = FALSE) else ""
  }, character(1))
  for (lugar in names(x$logos)) {
    e <- x$logos[[lugar]]
    if (!is.list(e)) next
    ruta <- .ec_txt(e$path %||% e$ruta)
    if (!nzchar(.ec_txt(e$file_id)) && nzchar(ruta) && length(rutas)) {
      hit <- names(rutas)[rutas == normalizePath(ruta, winslash = "/", mustWork = FALSE)]
      if (length(hit)) e$file_id <- hit[[1]]
    }
    e$path <- NULL; e$ruta <- NULL
    x$logos[[lugar]] <- e
  }
  x
}

# Los cuatro portadores de config de la sesión.
.ec_portadores <- function(s) {
  c(list(s$graficos_config), unname(s$graficos_config_por_base %||% list()),
    list((s$graficos_consolidado_draft %||% list())$config), list((s$graficos_consolidado %||% list())$config))
}

#' `file_id` de los logos del cliente en todos los portadores: inputs del proyecto que viajan en el `.pulso`
#' @keywords internal
.graficos_estilo_cliente_fids <- function(s) {
  out <- character(0)
  for (cfg in .ec_portadores(s)) {
    for (e in (((cfg %||% list())$estilo_cliente %||% list())$logos %||% list())) {
      fid <- .ec_txt((e %||% list())$file_id)
      if (nzchar(fid)) out <- c(out, fid)
    }
  }
  unique(out)
}

#' Nombre humano de un logo por su `file_id` («el logo «UNSA» (portada, izquierda)»), o NULL si no es un logo
#' @keywords internal
.graficos_estilo_cliente_nombre_de_ref <- function(s, fid) {
  for (cfg in .ec_portadores(s)) {
    lg <- ((cfg %||% list())$estilo_cliente %||% list())$logos %||% list()
    for (lugar in names(lg)) {
      if (identical(.ec_txt((lg[[lugar]] %||% list())$file_id), fid)) {
        n <- .ec_txt(lg[[lugar]]$nombre)
        return(if (nzchar(n)) sprintf("el logo «%s» (%s)", n, .ec_lugar_humano(lugar)) else sprintf("el logo de %s", .ec_lugar_humano(lugar)))
      }
    }
  }
  NULL
}

.ec_lugar_humano <- function(lugar) {
  switch(lugar, portada_izquierda = "portada, izquierda", portada_derecha = "portada, derecha",
         contraportada = "contraportada", lugar)
}

#' Al abrir un `.pulso`: un logo cuyo PNG no viajó se retira de su estilo (y el Word vuelve al del recetario), con aviso
#' @return El estado con los logos huérfanos podados.
#' @keywords internal
.graficos_estilo_cliente_podar_huerfanos <- function(s) {
  vivo <- function(fid) {
    p <- .ec_txt(((s$files %||% list())[[fid]] %||% list())$path)
    nzchar(p) && file.exists(p)
  }
  podados <- character(0)
  podar <- function(cfg) {
    lg <- ((cfg %||% list())$estilo_cliente %||% list())$logos
    if (!is.list(lg) || !length(lg)) return(cfg)
    for (lugar in names(lg)) {
      fid <- .ec_txt((lg[[lugar]] %||% list())$file_id)
      if (nzchar(fid) && vivo(fid)) next
      n <- .ec_txt(lg[[lugar]]$nombre)
      podados <<- c(podados, if (nzchar(n)) sprintf("«%s» (%s)", n, .ec_lugar_humano(lugar)) else .ec_lugar_humano(lugar))
      lg[[lugar]] <- NULL
    }
    cfg$estilo_cliente$logos <- if (length(lg)) lg else NULL
    cfg
  }
  if (is.list(s$graficos_config)) s$graficos_config <- podar(s$graficos_config)
  if (is.list(s$graficos_config_por_base) && length(s$graficos_config_por_base)) {
    s$graficos_config_por_base <- lapply(s$graficos_config_por_base, function(c) if (is.list(c)) podar(c) else c)
  }
  if (is.list(s$graficos_consolidado_draft)) s$graficos_consolidado_draft$config <- podar(s$graficos_consolidado_draft$config)
  if (is.list(s$graficos_consolidado)) s$graficos_consolidado$config <- podar(s$graficos_consolidado$config)
  podados <- unique(podados)
  if (length(podados)) {
    .pulso_aviso(sprintf(paste0("El proyecto no traía el PNG de %d logo(s) del cliente (%s) y se retiraron del estilo: ",
                                "el Word usa el logo por defecto. Vuelve a subirlos en Estilo del cliente > Logos."),
                         length(podados), paste(podados, collapse = ", ")))
  }
  s
}

# --- Resolver para el worker ----------------------------------------------------------------------------------------------

#' Desplazamientos de letra por token, a partir del paso global y los roles afinados
#' @return `list(ppt = c(token = pt), word = c(token = pt))` sólo con desplazamientos distintos de cero.
#' @keywords internal
.graficos_estilo_cliente_desplazos <- function(letra) {
  letra <- .as_json_list(letra) %||% list()
  paso <- .ec_txt(letra$paso); if (!paso %in% names(.ESTILO_CLIENTE_PASOS)) paso <- "estandar"
  roles <- .as_json_list(letra$roles) %||% list()
  ppt <- numeric(0); word <- numeric(0)
  for (rol in names(.ESTILO_CLIENTE_ROLES)) {
    p <- .ec_txt(roles[[rol]]); if (!p %in% names(.ESTILO_CLIENTE_PASOS)) p <- paso
    d <- .ESTILO_CLIENTE_PASOS[[p]]
    if (d == 0) next
    ppt[.ESTILO_CLIENTE_ROLES[[rol]]$ppt] <- d
    word[.ESTILO_CLIENTE_ROLES[[rol]]$word] <- d
  }
  list(ppt = ppt, word = word)
}

.ec_es_png <- function(path) {
  con <- tryCatch(file(path, "rb"), error = function(e) NULL)
  if (is.null(con)) return(FALSE)
  on.exit(close(con))
  b <- readBin(con, "raw", 8L)
  length(b) == 8L && identical(b, .ec_png_firma)
}

#' Resuelve el estilo del cliente de una config a lo que necesita el worker: rutas de logos y desplazamientos de letra
#'
#' Un logo cuyo archivo falta (o no es PNG) degrada al del recetario —el de PULSO PUCP o PUCP según su lugar— con aviso.
#' @param cfg Config efectiva (normalizada) del export.
#' @param medio `"word"` o `"ppt"`: sólo cambia el texto del aviso (en el PPT el logo por defecto es el de la plantilla).
#' @return `list(logos = list(lugar = ruta), letra = list(ppt, word), avisos = chr)` sin lo vacío; `list()` si no hay
#'   nada que aplicar (el router entonces no pasa el argumento al worker).
#' @keywords internal
.graficos_estilo_cliente_resolver <- function(sid, cfg, medio = "word") {
  x <- .graficos_estilo_cliente_validos((cfg %||% list())$estilo_cliente)
  s <- session_get(sid, required = FALSE)
  logos <- list(); avisos <- character(0)
  for (lugar in intersect(names(x$logos %||% list()), names(.ESTILO_CLIENTE_LOGOS_RECETARIO))) {
    e <- x$logos[[lugar]]
    fid <- .ec_txt((e %||% list())$file_id)
    if (!nzchar(fid)) next
    p <- .ec_txt((((s %||% list())$files %||% list())[[fid]] %||% list())$path)
    if (nzchar(p) && file.exists(p) && .ec_es_png(p)) {
      logos[[lugar]] <- normalizePath(p, winslash = "/", mustWork = TRUE)
      next
    }
    n <- .ec_txt(e$nombre)
    avisos <- c(avisos, sprintf("El logo %s de la %s no está en el proyecto: %s.",
                                if (nzchar(n)) sprintf("«%s»", n) else "propio", .ec_lugar_humano(lugar),
                                if (identical(medio, "ppt")) "el PowerPoint usa el de la plantilla"
                                else sprintf("el Word usa el de %s", .ESTILO_CLIENTE_LOGOS_RECETARIO[[lugar]]$nombre)))
  }
  desplazos <- .graficos_estilo_cliente_desplazos(x$letra)
  out <- list()
  if (length(logos)) out$logos <- logos
  if (length(desplazos$ppt) || length(desplazos$word)) out$letra <- desplazos
  if (length(avisos)) out$avisos <- avisos
  out
}

#' Aplica los desplazamientos de letra en el proceso (worker): devuelve las opciones previas para `on.exit(options(.))`
#' @keywords internal
.graficos_estilo_cliente_aplicar_letra <- function(letra) {
  if (!is.list(letra) || (!length(letra$ppt) && !length(letra$word))) return(list(prosecnur.letra_desplazo = getOption("prosecnur.letra_desplazo")))
  options(prosecnur.letra_desplazo = list(ppt = letra$ppt %||% numeric(0), word = letra$word %||% numeric(0)))
}

# --- Subida de logos ------------------------------------------------------------------------------------------------------

#' Guarda un logo PNG subido en base64 y lo registra en el file store
#'
#' Sólo PNG (la firma de 8 bytes, como los íconos), hasta 5 MB y con cabecera IHDR legible. No toca la config: el editor
#' pone el `file_id` en `estilo_cliente.logos.<lugar>` y lo guarda con su autosave.
#' @param parsed Body: `nombre`, `data_base64` (con o sin prefijo `data:`), `lugar` opcional (se valida).
#' @return `list(ok, file_id, nombre, lugar, sha256, ancho_px, alto_px, aspecto, uploaded_at)`.
#' @keywords internal
.graficos_estilo_cliente_subir_logo <- function(sid, parsed) {
  s <- session_get(sid)
  nombre <- .ec_txt(parsed$nombre)
  data_b64 <- .ec_txt(parsed$data_base64 %||% parsed$dataBase64)
  lugar <- .ec_txt(parsed$lugar)
  if (!nzchar(nombre)) stop_api(400, "E_BAD_LOGO", "Falta «nombre» del logo.")
  if (!nzchar(data_b64)) stop_api(400, "E_BAD_LOGO", "Falta «data_base64» con el PNG del logo.")
  if (nzchar(lugar) && !lugar %in% names(.ESTILO_CLIENTE_LOGOS_RECETARIO)) {
    stop_api(400, "E_BAD_LOGO", sprintf("Lugar de logo desconocido: «%s».", lugar))
  }
  bytes <- tryCatch(jsonlite::base64_dec(sub("^data:[^;]*;base64,", "", data_b64)),
                    error = function(e) stop_api(400, "E_BAD_LOGO", "El logo no es base64 válido."))
  if (length(bytes) > .ESTILO_CLIENTE_LOGO_MAX_BYTES) stop_api(400, "E_BAD_LOGO", "El logo supera los 5 MB.")
  if (length(bytes) < 24L || !identical(bytes[1:8], .ec_png_firma) || !identical(rawToChar(bytes[13:16]), "IHDR")) {
    stop_api(400, "E_BAD_LOGO", "El logo debe ser un PNG válido.")
  }
  ent <- function(x) sum(as.numeric(as.integer(x)) * 256^(3:0))
  ancho <- ent(bytes[17:20]); alto <- ent(bytes[21:24])
  if (ancho < 1 || alto < 1) stop_api(400, "E_BAD_LOGO", "El PNG del logo no declara su tamaño.")
  dir_logos <- file.path(s$dir, "logos")
  dir.create(dir_logos, showWarnings = FALSE, recursive = TRUE)
  path <- file.path(dir_logos, paste0(uuid::UUIDgenerate(), ".png"))
  writeBin(bytes, path)
  slug <- gsub("(^_+|_+$)", "", gsub("[^a-z0-9]+", "_", tolower(iconv(nombre, to = "ASCII//TRANSLIT", sub = ""))))
  meta <- .register_output_file(sid, "graficos_logo", path, original_name = paste0("logo_", if (nzchar(slug)) slug else "cliente", ".png"))
  list(ok = TRUE, file_id = meta$file_id, nombre = nombre, lugar = if (nzchar(lugar)) lugar else NULL,
       sha256 = digest::digest(file = path, algo = "sha256"), ancho_px = ancho, alto_px = alto, aspecto = ancho / alto,
       uploaded_at = meta$uploaded_at)
}

# --- Share: los logos viajan en el paquete -------------------------------------------------------------------------------

#' Entradas de assets del paquete compartible para los logos del cliente (copia cada PNG al stage)
#' @return `list(assets, config)` con los logos sólo por `file_id`.
#' @keywords internal
.graficos_estilo_cliente_share_assets <- function(sid, cfg, stage_dir) {
  lg <- ((cfg %||% list())$estilo_cliente %||% list())$logos %||% list()
  if (!is.list(lg) || !length(lg)) return(list(assets = list(), config = cfg))
  dir.create(file.path(stage_dir, "files", "logos"), recursive = TRUE, showWarnings = FALSE)
  assets <- list()
  for (lugar in names(lg)) {
    fid <- .ec_txt((lg[[lugar]] %||% list())$file_id)
    meta <- if (nzchar(fid)) tryCatch(get_file(sid, fid), error = function(e) NULL) else NULL
    if (is.null(meta) || !file.exists(.ec_txt(meta$path))) next
    rel <- file.path("files", "logos", paste0(fid, ".png"))
    file.copy(meta$path, file.path(stage_dir, rel), overwrite = TRUE)
    assets[[length(assets) + 1L]] <- list(kind = "graficos_logo", old_file_id = fid, lugar = lugar,
                                          original_name = .ec_txt(meta$original_name %||% basename(rel)), ext = "png", path = rel,
                                          sha256 = digest::digest(file = meta$path, algo = "sha256"))
  }
  cfg$estilo_cliente <- .graficos_estilo_cliente_portable(cfg$estilo_cliente, list())
  list(assets = assets, config = cfg)
}

#' Materializa un logo del paquete compartible en la sesión destino; devuelve su `file_id` nuevo o NULL
#' @keywords internal
.graficos_estilo_cliente_share_materializar <- function(sid, asset, stage) {
  src <- file.path(stage, .ec_txt(asset$path))
  if (!file.exists(src) || !.ec_es_png(src)) return(NULL)
  dir_logos <- file.path(session_get(sid)$dir, "logos")
  dir.create(dir_logos, recursive = TRUE, showWarnings = FALSE)
  dest <- file.path(dir_logos, paste0(uuid::UUIDgenerate(), ".png"))
  file.copy(src, dest, overwrite = TRUE)
  .register_output_file(sid, "graficos_logo", dest, original_name = .ec_txt(asset$original_name %||% basename(dest)))$file_id
}

#' Reemplaza los `file_id` de los logos según el remapeo del paquete compartible
#' @keywords internal
.graficos_estilo_cliente_remapear <- function(cfg, remap) {
  lg <- ((cfg %||% list())$estilo_cliente %||% list())$logos
  if (!is.list(lg) || !length(lg) || !length(remap)) return(cfg)
  for (lugar in names(lg)) {
    old <- .ec_txt((lg[[lugar]] %||% list())$file_id)
    if (nzchar(old) && !is.null(remap[[old]])) lg[[lugar]]$file_id <- remap[[old]]
  }
  cfg$estilo_cliente$logos <- lg
  cfg
}

# --- Huella de miniaturas (grupo d) ----------------------------------------------------------------------------------------

#' Lo del estilo del cliente que entra en la huella de una lámina: desplazamientos de letra y sha256 de cada logo
#' @param estilo Lo que devuelve `.graficos_estilo_cliente_resolver()` (o `NULL`).
#' @keywords internal
.graficos_estilo_cliente_huella <- function(estilo) {
  if (!is.list(estilo) || !length(estilo)) return(NULL)
  logos <- estilo$logos %||% list()
  if (length(logos)) logos <- lapply(logos[order(names(logos), method = "radix")], function(p) .mini_sha256_archivo(p))
  list(letra = estilo$letra %||% list(), logos = logos)
}
