# Los tres desenlaces de un aula que no se resolvio sola: reemplazo (A),
# complemento (B) y refuerzo (C).
#
# Gonzalo, 2026-09-10: «quiero empezar a ver la parte de reemplazos para aulas
# complementarias (B) o aulas de refuerzo (C)».
#
# **Las definiciones son suyas y viven en el libro** (`carga_aulas_libro_formato.R`):
#
#   A  REEMPLAZADA POR    el aula cayo —rechazo o no se aplico— y otra ocupa su
#                         lugar. El titular SALE y la reserva entra.
#   B  COMPLEMENTADA CON  el aula rindio poco y se suma su cadena u otra
#                         reserva. El titular NO sale: los dos cuentan.
#   C  APLICADA DE REFUERZO  no es del aula: faltaban alumnos o un sexo para la
#                         meta y se salio a una reserva por decision operativa.
#
# **Por que hacia falta un motor y no un conteo en la pantalla.** Los tres se
# escriben en la misma columna del libro —STATUS DE APLICACION— y hasta hoy el
# normalizador de monitoreo solo conocia «APLICADA» y «NO APLICADA»: los otros
# tres caian en `pendiente`, asi que un aula aplicada de refuerzo se contaba
# como si nadie la hubiera tocado. Eso se arreglo en
# `monitoreo_aulas_desenlace_aplicacion()`; esto publica el reparto.
#
# **A y B se declaran desde el TITULAR; C desde la reserva.** Es el reparto por
# eslabon que el propio libro impone: un titular puede haber sido reemplazado o
# complementado —y entonces dice con CUAL en «AULA UTILIZADA»—, y una reserva
# solo puede ser la aplicacion de refuerzo, que se explica sola. Contar C desde
# el titular, o A desde la reserva, seria leer la hoja al reves.

#' Reparte los desenlaces de reemplazo, complemento y refuerzo.
#'
#' **No confundir con `monitoreo_aulas_reemplazos.R`**, que es el gesto de
#' ACTIVAR un reemplazo desde la app. Esto sólo cuenta lo que el libro ya
#' declara. Es la razón de que el archivo tenga otro nombre: el primero que le
#' puse chocaba con aquél y lo sobrescribió entero.
#'
#' @param df data.frame del plan seguido, con `application_status`,
#'   `sample_role`, `faculty`, `operational_code` y `aula_utilizada`.
#' @return lista con `reemplazadas`, `complementadas`, `refuerzos`, cada una con
#'   su total, su reparto por facultad y sus filas; mas `sin_aula_utilizada`,
#'   que cuenta los casos A y B que no dicen CON CUAL.
#' @export
monitoreo_aulas_desenlaces_por_tipo <- function(df) {
  vacio <- list(
    reemplazadas = .mar_grupo(),
    complementadas = .mar_grupo(),
    refuerzos = .mar_grupo(),
    sin_aula_utilizada = 0L,
    total = 0L
  )
  df <- .monitoreo_aulas_df(df, "plan")
  if (!nrow(df)) return(vacio)

  estado <- vapply(
    .mar_col(df, "application_status"),
    monitoreo_aulas_desenlace_aplicacion, character(1), USE.NAMES = FALSE
  )
  rol <- tolower(trimws(.mar_col(df, "sample_role")))
  es_titular <- rol == "titular"

  # A y B las declara el titular; C, la reserva. Se respeta el eslabon aunque el
  # libro traiga el verbo en la fila equivocada: contar una C desde un titular
  # inflaria los refuerzos con aulas que nadie salio a reforzar.
  reemplazadas <- .mar_grupo(df[estado == "reemplazada_por" & es_titular, , drop = FALSE])
  complementadas <- .mar_grupo(df[estado == "complementada_con" & es_titular, , drop = FALSE])
  refuerzos <- .mar_grupo(df[estado == "aplicada_de_refuerzo" & !es_titular, , drop = FALSE])

  # **Un A o un B sin «AULA UTILIZADA» es media frase.** Los dos verbos terminan
  # en preposicion justamente porque piden un CUAL, y sin el no se puede seguir
  # la cadena ni comprobar que la reserva que entro es la que el sorteo asigno.
  con_verbo <- df[estado %in% c("reemplazada_por", "complementada_con") & es_titular, , drop = FALSE]
  sin_cual <- if (nrow(con_verbo)) sum(!nzchar(trimws(.mar_col(con_verbo, "aula_utilizada")))) else 0L

  list(
    reemplazadas = reemplazadas,
    complementadas = complementadas,
    refuerzos = refuerzos,
    sin_aula_utilizada = as.integer(sin_cual),
    total = as.integer(reemplazadas$total + complementadas$total + refuerzos$total)
  )
}

#' Una columna del plan como texto, o vacio si no viene.
#' @noRd
.mar_col <- function(df, campo) {
  if (!campo %in% names(df)) return(rep("", nrow(df)))
  x <- df[[campo]]
  x[is.na(x)] <- ""
  as.character(x)
}

#' El grupo de un desenlace: cuantos, de que facultades y cuales.
#'
#' Sin filas devuelve la MISMA forma con ceros: un consumidor que recibe `NULL`
#' en un caso y una lista en otro acaba con dos ramas, y una de las dos se
#' prueba sola.
#' @noRd
.mar_grupo <- function(filas = NULL) {
  if (is.null(filas) || !nrow(filas)) {
    return(list(total = 0L, por_facultad = list(), aulas = list()))
  }
  fac <- .mar_col(filas, "faculty")
  fac[!nzchar(trimws(fac))] <- "Sin facultad"
  tabla <- sort(table(fac), decreasing = TRUE)
  por_facultad <- lapply(names(tabla), function(f) {
    list(facultad = f, aulas = as.integer(tabla[[f]]))
  })
  aulas <- lapply(seq_len(nrow(filas)), function(i) {
    list(
      codigo = .mar_col(filas, "operational_code")[i],
      facultad = fac[i],
      titular = .mar_col(filas, "titular_operational_code")[i],
      # CON CUAL se resolvio. Vacia cuando el coordinador no la lleno, y eso se
      # publica: es media frase, no un dato ausente cualquiera.
      aula_utilizada = .mar_col(filas, "aula_utilizada")[i],
      motivo = .mar_col(filas, "replacement_reason")[i],
      efectivas = suppressWarnings(as.numeric(.mar_col(filas, "effective_surveys")[i]))
    )
  })
  list(total = nrow(filas), por_facultad = por_facultad, aulas = aulas)
}
