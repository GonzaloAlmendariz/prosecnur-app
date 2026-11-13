# Personas que figuran en más de un público de un barrido por correo (ADR 0143, D9).
#
# En la propuesta cada público se cuenta con su marco completo: el cruce no se
# descuenta, se dice y se muestra. A qué público va una persona compartida se
# decide con el cliente en el listado de envío. Lo que sí se avisa aquí es el
# peor caso: si todas las personas compartidas terminan en el otro público, la
# meta de este exige una respuesta mayor (meta / (invitados - compartidos)).
#
# Se cruza por correo normalizado (minúsculas, sin espacios), nunca por nombre.

#' Cruce entre públicos por correo.
#'
#' @param publicos lista de list(id, nombre, correos): los correos de las personas
#'   invitadas de cada público (una entrada por persona; vacío o NA = sin correo).
#' @param metas lista nombrada id -> meta de encuestas (opcional).
#' @param tasas lista nombrada id -> respuesta esperada en proporción (opcional).
#' @return list(publicos = [{id, nombre, invitados, sin_correo, compartidos,
#'   pares = [{id, nombre, n}], meta, tasa, exige, exige_sin_compartidos,
#'   alcanza, alcanza_sin_compartidos}], hay_cruce).
calc_muestra_cruce_entre_publicos <- function(publicos, metas = list(), tasas = list()) {
  publicos <- if (is.list(publicos)) publicos else list()
  claves <- lapply(publicos, function(p) {
    x <- .cm_marco_correo_clave(unlist(p$correos %||% list()))
    x[is.na(x)] <- ""
    x
  })
  unicos <- lapply(claves, function(x) unique(x[nzchar(x)]))
  num <- function(lst, id) {
    v <- suppressWarnings(as.numeric(lst[[id]] %||% NA))
    if (length(v) != 1 || !is.finite(v)) NA_real_ else v
  }
  salida <- lapply(seq_along(publicos), function(i) {
    p <- publicos[[i]]
    id <- calc_str(p$id, "")
    x <- claves[[i]]
    con_correo <- nzchar(x)
    otros <- setdiff(seq_along(publicos), i)
    pares <- lapply(otros, function(j) {
      list(id = calc_str(publicos[[j]]$id, ""), nombre = calc_str(publicos[[j]]$nombre, ""),
           n = sum(con_correo & x %in% unicos[[j]]))
    })
    union_otros <- unique(unlist(unicos[otros], use.names = FALSE))
    compartidos <- sum(con_correo & x %in% union_otros)
    invitados <- length(x)
    meta <- num(metas, id)
    tasa <- num(tasas, id)
    libres <- invitados - compartidos
    exige <- if (is.finite(meta) && invitados > 0) meta / invitados else NA_real_
    exige_sin <- if (is.finite(meta) && libres > 0) meta / libres else NA_real_
    alcanza <- function(e) if (!is.finite(tasa) || tasa <= 0 || !is.finite(e)) NA else e <= tasa
    list(
      id = id, nombre = calc_str(p$nombre, ""), invitados = invitados,
      sin_correo = sum(!con_correo), compartidos = compartidos, pares = pares,
      meta = if (is.finite(meta)) meta else NULL, tasa = if (is.finite(tasa)) tasa else NULL,
      exige = if (is.finite(exige)) exige else NULL,
      exige_sin_compartidos = if (is.finite(exige_sin)) exige_sin else NULL,
      alcanza = alcanza(exige),
      # Sin personas libres la meta no se alcanza si todas van al otro público.
      alcanza_sin_compartidos = if (is.finite(meta) && meta > 0 && libres <= 0) FALSE else alcanza(exige_sin)
    )
  })
  list(publicos = salida, hay_cruce = any(vapply(salida, function(s) s$compartidos > 0, logical(1))))
}

#' Correos de los invitados de un actor con marco por persona y columna de correo.
#' NULL si el actor no se puede cruzar (tabla de conteos o sin columna de correo).
.cm_cruce_correos_del_actor <- function(datos, receta) {
  if (identical(calc_str(receta$tipo, ""), "conteos")) return(NULL)
  col <- calc_str((receta$columnas %||% list())$correo, "")
  if (!nzchar(col)) return(NULL)
  ap <- calc_muestra_marco_aplicar_receta(datos, receta)
  if (!col %in% names(ap$datos)) return(NULL)
  as.character(ap$datos[[col]])
}
