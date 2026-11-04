# Carácter y estado común de una cuota — ADR 0126.
#
# Gonzalo, 2026-11-03: el avance de cuotas «no deja claro o permite que el
# modelo distinga claramente cuotas establecidas como metas de cuotas
# referenciales». Cada cuota declara `caracter`:
#
# - `meta`: un número que el estudio se compromete a alcanzar; tiene faltante y
#   veredicto, y no se compensa entre celdas (ADR 0079).
# - `referencial`: describe la composición esperada; no tiene faltante ni
#   veredicto. Si trae número, es una referencia, nunca un piso.
#
# **Sin declaración, ninguna cifra cambia** (ADR 0126 §2): todo número que hoy
# recibe veredicto —incluida la meta 0, que telefónico da por «Cumple»— sigue
# siendo meta; lo que hoy no tiene número es referencial.
#
# Las lecturas de avance publican `caracter`, `fuente` y `estado_cuota` de forma
# ADITIVA: `Estado cuota`, `estado` y `cumplimiento.estado` siguen como están,
# porque los leen el motor, el PDF, el front y el conteo de brechas.

.MONITOREO_CUOTA_CARACTERES <- c("meta", "referencial")

# «meta» / «referencial», o "" si no se declaró o el valor no es del vocabulario.
.monitoreo_cuota_caracter_declarado <- function(x) {
  v <- tolower(trimws(.monitoreo_scalar(x, "")))
  if (v %in% .MONITOREO_CUOTA_CARACTERES) v else ""
}

# Lo que un goal declara además de su número, para la lista blanca de
# `monitoreo_normalize_config` (congelado: la llama en una sola línea). Un campo
# fuera de esta función no sobrevive la ida y vuelta del `.pulso`.
.monitoreo_goal_declarado <- function(goal, g) {
  # `objetivo` declara si el actor se barre entero o si el mínimo ES el acuerdo.
  # La meta siempre fue un PISO interno, no el objetivo.
  objetivo <- .monitoreo_scalar(g$objetivo %||% g$objective %||% "", "")
  if (objetivo %in% c("barrido", "minimo")) goal$objetivo <- objetivo
  caracter <- .monitoreo_cuota_caracter_declarado(g$caracter)
  if (nzchar(caracter)) goal$caracter <- caracter
  goal
}

#' El carácter efectivo de una cuota.
#'
#' @param declarado lo que declaró el estudio (`""` si nada).
#' @param meta el número de la cuota, `NA` si no tiene.
#' @return lista con `caracter` y `aviso` (`""` si no hay nada que decir).
#' @keywords internal
.monitoreo_cuota_caracter <- function(declarado = "", meta = NA_real_) {
  d <- .monitoreo_cuota_caracter_declarado(declarado)
  m <- suppressWarnings(as.numeric(meta)[1])
  if (identical(d, "referencial")) return(list(caracter = "referencial", aviso = ""))
  if (identical(d, "meta")) {
    if (is.finite(m) && m > 0) return(list(caracter = "meta", aviso = ""))
    return(list(caracter = "referencial",
                aviso = "Declarada como meta sin número: se muestra como referencial hasta que tenga uno."))
  }
  list(caracter = if (is.finite(m) && m >= 0) "meta" else "referencial", aviso = "")
}

#' El estado común de una cuota (ADR 0126 §4), vectorizado.
#'
#' `cumple`/`falta` sólo para una meta, y `sin_base` cuando no alcanza y no hay
#' universo donde buscarla (el «Sin base» de telefónico). Una referencial con
#' universo es `referencial`; sin él, `sin_comparador`.
#'
#' @param caracter vector de `meta`/`referencial`.
#' @param meta, efectivas, universo vectores numéricos del mismo largo.
#' @return vector de caracteres.
#' @keywords internal
.monitoreo_cuota_estado <- function(caracter, meta, efectivas, universo) {
  caracter <- as.character(caracter)
  meta <- suppressWarnings(as.numeric(meta))
  efectivas <- suppressWarnings(as.numeric(efectivas))
  efectivas[!is.finite(efectivas)] <- 0
  universo <- suppressWarnings(as.numeric(universo))
  con_universo <- is.finite(universo) & universo > 0
  es_meta <- caracter %in% "meta" & is.finite(meta)
  ifelse(
    es_meta,
    ifelse(efectivas >= meta, "cumple", ifelse(con_universo, "falta", "sin_base")),
    ifelse(con_universo, "referencial", "sin_comparador")
  )
}

# Una referencial con universo y ninguna efectiva: un hecho, no una alarma. Una
# celda vacía impide posestratificar o hacer raking.
.monitoreo_cuota_celda_vacia <- function(caracter, efectivas, universo) {
  efectivas <- suppressWarnings(as.numeric(efectivas))
  universo <- suppressWarnings(as.numeric(universo))
  as.character(caracter) %in% "referencial" & is.finite(universo) & universo > 0 &
    (!is.finite(efectivas) | efectivas <= 0)
}

# ---- Telefónico: las filas de `cuotas_variable` ------------------------------

.MONITOREO_CUOTA_FILTROS_DE_ACTOR <- c("Actor", "actor", "dim_actor", "unidad", "Unidad", "Publico objetivo",
                                       "Público objetivo", "publico_objetivo", "público_objetivo")

# El goal que declara una fila. La fila «Total» sólo lee goals SIN actor; la de
# un actor, sólo goals de ESE actor (es como el motor reparte las metas:
# `allow_actorless = FALSE`), así una global referencial no le gana a la meta
# propia del actor por el orden de la lista. `NULL` si ninguno.
.monitoreo_cuota_goal_de_fila <- function(goals, actor, variable, valor) {
  global <- actor %in% c("Total", "Todos")
  for (g in goals %||% list()) {
    if (!is.list(g)) next
    f <- g$filters %||% g$filtros %||% list()
    if (!is.list(f) || !variable %in% names(f)) next
    if (!identical(.monitoreo_scalar(f[[variable]], ""), valor)) next
    claves_actor <- intersect(names(f), .MONITOREO_CUOTA_FILTROS_DE_ACTOR)
    if (global != !length(claves_actor)) next
    if (!global && !any(vapply(claves_actor, function(k) identical(.monitoreo_scalar(f[[k]], ""), actor), logical(1)))) next
    return(g)
  }
  NULL
}

#' Marca las filas de cuota telefónica con el contrato del ADR 0126.
#'
#' Añade `Caracter`, `Fuente` (`declarada`, `columna` o vacío), `Referencia` y
#' `estado_cuota`. Una cuota DECLARADA referencial deja de juzgarse: su número
#' pasa de `Meta` a `Referencia` (las tarjetas y la barra del modo leen `Meta`
#' como meta), `Estado cuota` pasa a «Sin meta» —un valor que todos sus lectores
#' ya conocen— y no suma a las brechas. Sin declaración nada de eso cambia.
#' @keywords internal
.monitoreo_cuotas_marcar_telefonico <- function(out, goals = list()) {
  if (!is.data.frame(out) || !nrow(out)) return(out)
  n <- nrow(out)
  caracter <- character(n)
  fuente <- character(n)
  for (i in seq_len(n)) {
    g <- .monitoreo_cuota_goal_de_fila(goals, out$Actor[[i]], out$Variable[[i]], out$Valor[[i]])
    meta <- out$Meta[[i]]
    meta_goal <- if (is.null(g)) NA_integer_ else .monitoreo_int(g$meta %||% g$n, NA_integer_)
    fuente[[i]] <- if (is.finite(meta_goal)) "declarada" else if (is.finite(meta)) "columna" else ""
    caracter[[i]] <- .monitoreo_cuota_caracter(if (is.null(g)) "" else g$caracter, meta)$caracter
  }
  declarada_ref <- caracter == "referencial" & is.finite(out$Meta)
  out$Referencia <- ifelse(declarada_ref, out$Meta, NA_integer_)
  if (any(declarada_ref)) {
    out$Meta[declarada_ref] <- NA_integer_
    out$`Estado cuota`[declarada_ref] <- "Sin meta"
    out$Brecha[declarada_ref] <- NA_integer_
    out$`Avance meta`[declarada_ref] <- NA_real_
  }
  out$Caracter <- caracter
  out$Fuente <- fuente
  out$estado_cuota <- .monitoreo_cuota_estado(caracter, out$Meta, out$Efectivas, out$Universo)
  out
}

# ---- Aulas: las filas de `avance_cuota` y sus niveles ------------------------

#' Marca las filas de `avance_cuota` con el contrato del ADR 0126 (aditivo).
#'
#' Una fila con cuota del diseño es `meta` (fuente `declarada`; con la vigencia
#' degradada la cuota sale del plan y es `respaldo`). `sin_aulas_en_plan` es una
#' meta `sin_base`. `sin_cuota` no se exige: es `referencial` y, sin cuota con
#' que compararla, `sin_comparador`. `fuera_del_diseno` no es una cuota: es el
#' residual `sin_celda` y no lleva carácter.
#' @keywords internal
.monitoreo_cuotas_marcar_aulas <- function(filas) {
  lapply(filas, function(f) {
    if (!is.list(f)) return(f)
    estado <- .monitoreo_scalar(f$estado, "")
    if (identical(estado, "fuera_del_diseno")) return(f)
    cuota <- .monitoreo_num(f$cuota, NA_real_)
    validas <- .monitoreo_num(f$respuestas_validas, 0)
    if (identical(estado, "sin_cuota") || !is.finite(cuota)) {
      f$caracter <- "referencial"
      f$fuente <- ""
      f$estado_cuota <- "sin_comparador"
      return(f)
    }
    f$caracter <- "meta"
    f$fuente <- if (identical(.monitoreo_scalar(f$fuente_fila, ""), "diseno")) "declarada" else "respaldo"
    f$estado_cuota <- if (validas >= cuota) "cumple" else if (identical(estado, "sin_aulas_en_plan")) "sin_base" else "falta"
    f
  })
}

#' Los dos niveles de la meta de aulas (Gonzalo, 2026-09-08: muestra y
#' sobremuestra son las dos metas del estudio). `muestra` se juzga por celda,
#' sin compensar (ADR 0079): se cumple cuando ninguna celda con cuota tiene
#' brecha. `sobremuestra` sólo existe como total: su veredicto compara el total
#' y lo declara con `compensa = TRUE`.
#' @keywords internal
#' @param sobremuestra la sobremuestra TOTAL (meta + excedente; `meta_operativa`
#'   del diseño), no el excedente.
.monitoreo_aulas_niveles_de_meta <- function(meta_diseno, sobremuestra, total) {
  validas <- .monitoreo_num(total$respuestas_validas, 0)
  brecha <- .monitoreo_num(total$brecha, NA_real_)
  niveles <- list()
  if (is.finite(.monitoreo_num(meta_diseno, NA_real_))) {
    niveles[[length(niveles) + 1L]] <- list(
      nivel = "muestra", meta = meta_diseno, caracter = "meta", compensa = FALSE,
      estado_cuota = if (is.finite(brecha)) (if (brecha <= 0) "cumple" else "falta") else "sin_base"
    )
  }
  if (is.finite(.monitoreo_num(sobremuestra, NA_real_))) {
    niveles[[length(niveles) + 1L]] <- list(
      nivel = "sobremuestra", meta = sobremuestra, caracter = "meta", compensa = TRUE,
      estado_cuota = if (validas >= sobremuestra) "cumple" else "falta"
    )
  }
  niveles
}

# ---- Territorial por cuotas: celdas, marginales y composición por zona -------

#' Aplica a una zona del avance por cuotas el carácter que declaró Hojas de ruta.
#'
#' La matriz de una zona es sexo × rango de edad. Sin declaración (o todo meta)
#' cada celda es una meta, como siempre. Si una dimensión es referencial:
#' - sus celdas dejan de exigirse: la cifra pasa a `referencia`, `meta` y
#'   `falta` a 0;
#' - lo que se exige es la MARGINAL de la dimensión que queda meta (edad si el
#'   sexo es referencial y al revés), sin compensar entre sus categorías; con
#'   las dos referenciales, sólo el total de la zona;
#' - la dimensión referencial se describe en `composicion`: lo obtenido frente a
#'   su parte en el reparto de Hojas de ruta (no un universo observado), con su
#'   n y `celda_vacia`.
#' `unidades` y `unidades_completas` cuentan lo que se exige, sean celdas o
#' marginales.
#' @param contar `function(dimension, categoria)` que cuenta las efectivas de la
#'   zona sobre los casos (sexo o edad legibles por separado); sin ella se suman
#'   las celdas, que dejan fuera a un caso con la OTRA dimensión ilegible.
#' @keywords internal
.monitoreo_cuotas_marcar_zona <- function(zona, caracter = list(), contar = NULL) {
  celdas <- zona$celdas %||% list()
  ref <- intersect(names(Filter(function(v) identical(v, "referencial"), caracter %||% list())), c("sexo", "edad"))
  clave <- function(c, dim) if (dim == "sexo") .monitoreo_scalar(c$sexo, "") else .monitoreo_scalar(c$rango_edad, "")
  if (!length(ref)) {
    zona$celdas <- lapply(celdas, function(c) {
      c$caracter <- "meta"
      c$estado_cuota <- if (c$efectivas >= c$meta) "cumple" else "falta"
      c
    })
    zona$marginales <- list()
    zona$composicion <- list()
    zona$unidades <- length(celdas)
    zona$unidades_completas <- as.integer(sum(vapply(celdas, function(c) c$falta == 0L, logical(1))))
    return(zona)
  }
  n_celdas <- vapply(celdas, function(c) as.numeric(c$meta), numeric(1))
  ef_celdas <- vapply(celdas, function(c) as.numeric(c$efectivas), numeric(1))
  agrupar <- function(dim) {
    cats <- unique(vapply(celdas, clave, "", dim = dim))
    lapply(cats, function(k) {
      en <- vapply(celdas, clave, "", dim = dim) == k
      ef <- if (is.function(contar)) contar(dim, k) else sum(ef_celdas[en])
      list(dimension = dim, categoria = k, n = sum(n_celdas[en]), efectivas = ef)
    })
  }
  meta_dims <- setdiff(c("sexo", "edad"), ref)
  # Con las dos referenciales sólo se exige el total: sus efectivas son las de
  # la zona (las mismas de `zona$efectivas`), no la suma de celdas.
  marginales <- if (length(meta_dims)) agrupar(meta_dims[[1]]) else
    list(list(dimension = "zona", categoria = .monitoreo_scalar(zona$nombre, ""), n = sum(n_celdas),
              efectivas = if (is.function(contar)) contar("zona", "") else .monitoreo_num(zona$efectivas, sum(ef_celdas))))
  marginales <- lapply(marginales, function(g) {
    meta <- as.integer(g$n)
    list(dimension = g$dimension, categoria = g$categoria, meta = meta, efectivas = as.integer(g$efectivas),
         falta = as.integer(max(0L, meta - g$efectivas)), caracter = "meta",
         estado_cuota = if (g$efectivas >= meta) "cumple" else "falta")
  })
  tot_n <- sum(n_celdas)
  composicion <- unlist(lapply(ref, function(dim) {
    grupos <- agrupar(dim)
    # Lo obtenido sobre los casos con categoría CONOCIDA en esta dimensión.
    tot_ef <- sum(vapply(grupos, function(g) as.numeric(g$efectivas), numeric(1)))
    lapply(grupos, function(g) {
    obtenida <- if (tot_ef > 0) 100 * g$efectivas / tot_ef else NA_real_
    esperada <- if (tot_n > 0) 100 * g$n / tot_n else NA_real_
    list(dimension = dim, categoria = g$categoria, efectivas = as.integer(g$efectivas), referencia = as.integer(g$n),
         obtenida_pct = obtenida, esperada_pct = esperada,
         diferencia_pp = if (is.finite(obtenida) && is.finite(esperada)) obtenida - esperada else NA_real_,
         celda_vacia = g$n > 0 && g$efectivas <= 0, caracter = "referencial",
         estado_cuota = if (tot_n > 0) "referencial" else "sin_comparador")
    })
  }), recursive = FALSE)
  zona$celdas <- lapply(celdas, function(c) {
    c$caracter <- "referencial"
    c$referencia <- c$meta
    c$meta <- 0L
    c$falta <- 0L
    c$estado_cuota <- if (tot_n > 0) "referencial" else "sin_comparador"
    c
  })
  zona$celdas_completas <- 0L
  zona$marginales <- marginales
  zona$composicion <- composicion
  zona$unidades <- length(marginales)
  zona$unidades_completas <- as.integer(sum(vapply(marginales, function(g) g$falta == 0L, logical(1))))
  zona$caracter <- caracter
  zona
}
