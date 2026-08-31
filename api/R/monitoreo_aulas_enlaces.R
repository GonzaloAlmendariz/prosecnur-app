# ¿Dos cursos-horario distintos comparten el mismo enlace de recopilador?
#
# La atribucion de una respuesta a su curso-horario va por el enlace: si dos
# aulas comparten uno, sus respuestas entran por la misma puerta y **no hay forma
# de separarlas despues**. El estudio lo descubre al cuadrar, o no lo descubre.
#
# Medido sobre HSVG2026 «como 2025» el 2026-08-30: de 192 filas en campo salen
# **158 enlaces distintos**, y **25 estan compartidos por cadenas distintas**. El
# enlace lleva el `classroom_id` TRUNCADO, asi que dos aulas que solo difieren en
# el ultimo digito reciben el mismo formulario:
#
#     CH 11   classroom_id "1ind53_0833"   link ".../1ind53_0"
#     CH 35   classroom_id "1ind53_0832"   link ".../1ind53_0"
#
# Los `classroom_id` NO colisionan —192 distintos para 192 filas—, asi que el
# truncamiento pasa al construir el enlace, fuera de esta app: ni el anonimizador
# ni el motor escriben `link`. Lo que si faltaba aqui es **decirlo**: ninguna de
# las once reglas de `validation` miraba el enlace.
#
# Solo las filas EN JUEGO. Una reserva dormida comparte enlace con su titular por
# construccion —es su respaldo— y contarla seria una alarma permanente sobre algo
# que no puede pasar: la dormida no sale a campo.

#' Enlaces de recopilador compartidos por cursos-horario distintos.
#'
#' @param en_juego data.frame de las filas que salen a campo.
#' @return lista con `enlaces` (cuantos estan repetidos), `aulas` (cuantas filas
#'   los comparten), `comprobable` y `ejemplos`.
#' @export
monitoreo_aulas_enlaces_compartidos <- function(en_juego = data.frame()) {
  vacio <- list(enlaces = 0L, aulas = 0L, comprobable = FALSE, ejemplos = character(0),
                truncado = NA_integer_, sin_personalizar = 0L)
  if (!is.data.frame(en_juego) || !nrow(en_juego) || !("link" %in% names(en_juego))) return(vacio)

  link <- trimws(as.character(en_juego$link))
  codigo <- if ("operational_code" %in% names(en_juego)) {
    trimws(as.character(en_juego$operational_code))
  } else rep("", length(link))
  con_link <- nzchar(link)
  if (!any(con_link)) return(vacio)

  # **Una URL de captura BASE se comparte por diseño, y eso no es el defecto.**
  #
  # `captureUrl.ts` y su espejo en R lo definen: la URL de captura es «la
  # direccion sobre la que se cuelgan los parametros de personalizacion POR
  # UNIDAD (`?d[campo]=valor` en Kobo)» y que despues se convierte en QR. Dos
  # aulas pueden compartir la base si cada QR lleva su `collectorID`: lo que
  # separa las respuestas es el parametro, no la direccion.
  #
  # Asi que este control solo tiene algo que decir cuando los enlaces YA estan
  # personalizados. Sin un solo parametro en el plan —medido sobre HSVG2026
  # «como 2025»: 0 de 1.424 con `?`, 0 con `collectorID`, 0 con campo `qr`— el
  # estudio esta en el paso ANTERIOR y avisar aqui seria una alarma sobre un
  # estado normal. `sin_datos`, que es lo que la lista usa para «no se pudo
  # comprobar».
  #
  # Lo escribo despues de haberme equivocado: la primera version comparaba las
  # bases y declaraba 51 cursos-horario en conflicto sobre un proyecto que
  # todavia no habia generado sus QR.
  personalizados <- grepl("[?]", link, perl = TRUE)
  if (!any(personalizados)) {
    return(list(enlaces = 0L, aulas = 0L, comprobable = FALSE,
                ejemplos = character(0), truncado = NA_integer_,
                sin_personalizar = sum(con_link)))
  }
  con_link <- con_link & personalizados

  link <- link[con_link]
  codigo <- codigo[con_link]
  repes <- names(which(table(link) > 1L))
  if (!length(repes)) {
    return(list(enlaces = 0L, aulas = 0L, comprobable = TRUE, ejemplos = character(0),
                truncado = NA_integer_, sin_personalizar = 0L))
  }

  cuantas <- sum(link %in% repes)
  # Un ejemplo por enlace repetido, con los codigos que lo comparten: sin eso el
  # aviso dice que hay un problema y no a donde ir.
  ejemplos <- vapply(utils::head(repes, 3L), function(l) {
    sprintf("%s", paste(utils::head(codigo[link == l], 4L), collapse = " y "))
  }, character(1), USE.NAMES = FALSE)

  list(enlaces = length(repes), aulas = as.integer(cuantas),
       comprobable = TRUE, ejemplos = ejemplos,
       truncado = .maen_largo_truncado(en_juego), sin_personalizar = 0L)
}

#' Cuantos caracteres del identificador conserva el enlace, si es que lo trunca.
#'
#' **El diagnostico que convierte «comparten enlace» en algo arreglable.** Medido
#' sobre HSVG2026 «como 2025»: las **1.424 filas** tienen la cola del enlace igual
#' a los **8 primeros caracteres** de su `classroom_id`, sin una sola excepcion.
#' No es un error aislado: quien genero los enlaces corto el identificador a ocho,
#' y con ids de once eso colisiona en cuanto dos aulas comparten ese prefijo.
#'
#' Devuelve `NA_integer_` cuando la relacion no es sistematica —menos del 90 % de
#' las filas—, porque entonces el enlace viene de otro sitio y decir «esta
#' truncado» seria inventar la causa.
#'
#' @param filas data.frame con `link` y `classroom_id`.
#' @return entero con el largo conservado, o `NA_integer_`.
#' @noRd
.maen_largo_truncado <- function(filas) {
  if (!is.data.frame(filas) || !nrow(filas)) return(NA_integer_)
  if (!all(c("link", "classroom_id") %in% names(filas))) return(NA_integer_)
  link <- trimws(as.character(filas$link))
  id <- trimws(as.character(filas$classroom_id))
  ok <- nzchar(link) & nzchar(id)
  if (!any(ok)) return(NA_integer_)
  # Sin el parametro por unidad: lo que se compara con el identificador es la
  # direccion, no el `?d[collectorID]=...` que se cuelga encima.
  colas <- sub("[?].*$", "", sub(".*/", "", link[ok]))
  ids <- id[ok]
  es_prefijo <- startsWith(ids, colas) & nchar(colas) < nchar(ids)
  if (mean(es_prefijo) < 0.9) return(NA_integer_)
  largos <- unique(nchar(colas[es_prefijo]))
  if (length(largos) != 1L) return(NA_integer_)
  as.integer(largos)
}
