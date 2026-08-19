# Defensas del auto-plan de Graficos contra el descarte silencioso.
#
# ACNUR V3 / PDM MedVida 2026 llego al cliente con nueve preguntas mal
# resueltas y nadie se entero hasta que un analista comparo el XLSForm con el
# PPT a mano. Las causas se repararon aguas arriba (el filtro de
# identificadores en `graficos_plan_coverage.R`, la columna de etiqueta en
# `codificacion_aplicar_instrumento.R`), pero la falla de fondo era otra: el
# motor descartaba con datos en la mano y no lo decia en ninguna parte. El
# popover de cobertura agrupaba todo bajo "No graficables", truncado a ocho
# filas, asi que una pregunta cerrada con 87 respuestas y un campo `telephone`
# vacio caian en la misma bolsa gris.
#
# Estas dos deteciones son la ultima linea: dan igual los helpers de aguas
# arriba, si el mazo va a salir incompleto o numerado, se dice. Y se dice la
# causa y que hacer, no solo el hecho (`docs/qa/checklist-acnur-v3-preguntas-
# ausentes-2026-08-19.md`).

# Tipos que el analista declara para MEDIR algo y que hoy no tienen lamina.
# Las fechas quedan deliberadamente fuera: `date` cubre por igual la fecha del
# resultado de un tramite y `mand_Date`/`start`/`end`, la marca de tiempo de la
# entrevista. Avisar de las fechas obligaba a avisar de las de sistema, y once
# de los primeros veinte avisos sobre este mismo estudio eran metadata del
# formulario. Un aviso que se ignora no sirve; la fecha sustantiva queda
# anotada en la cola del checklist, no en un canal que hay que aprender a
# ignorar.
.graficos_tipos_sin_lamina <- c("integer", "decimal", "range")

#' Descartes que no deberian haber pasado en silencio.
#'
#' Dos familias, ambas deterministas —sin umbral arbitrario, porque el umbral
#' es justo lo que dejaba fuera a `reva_Tram_obs` (6 respuestas) mientras
#' avisaba de `Sos_empresa` (87):
#'
#'   * una **pregunta cerrada** descartada por algo que no es control operativo
#'     nunca es correcto: su respuesta es la lista de opciones;
#'   * una **numerica con datos** si es un descarte legitimo del motor, pero
#'     tiene salida conocida —tramificarla en Codificacion— y el analista
#'     necesita que se la nombren.
#'
#' Todo lo demas calla: abiertas crudas, campos integrados en su madre, control
#' operativo, identificadores y los tipos que son estructura del formulario
#' (`calculate`, `start`, `end`, `note`). Son descartes correctos y ya viven,
#' listados uno por uno, en el popover de cobertura.
#'
#' Una numerica que ya tiene su `_recod` graficable no llega aca: el inventario
#' la marca `cubierta_por_recodificada` antes de evaluar graficabilidad.
#' @keywords internal
.graficos_descartes_sustantivos <- function(sources) {
  out <- list()
  for (src in sources %||% list()) {
    source_name <- .graficos_scalar_chr(src$name, "default")
    for (v in src$variables %||% list()) {
      if (!identical(.graficos_scalar_chr(v$status, ""), "no_graficable")) next
      n <- suppressWarnings(as.integer(v$n_non_empty %||% 0L))
      if (is.na(n) || n <= 0L) next
      tipo <- .graficos_base_type(v$tipo)
      motivo <- .graficos_scalar_chr(v$exclusion_reason, "")
      etiqueta <- .graficos_scalar_chr(v$label, .graficos_scalar_chr(v$name, ""))
      cerrada <- tipo %in% c("select_one", "select_multiple")

      clase <- if (cerrada && !identical(motivo, "metadato/control operativo del formulario")) {
        "cerrada_descartada"
      } else if (tipo %in% .graficos_tipos_sin_lamina) {
        "sin_lamina_posible"
      } else {
        next
      }

      out[[length(out) + 1L]] <- list(
        source = source_name,
        var = .graficos_scalar_chr(v$name, ""),
        label = etiqueta,
        tipo = tipo,
        n_non_empty = n,
        exclusion_reason = motivo,
        clase = clase
      )
    }
  }
  out
}

#' Catalogos que saldrian numerados.
#'
#' Una lista cuyas etiquetas son sus propios codigos produce un grafico con
#' "1, 2, 3, 96, 97" en el eje. Es el sintoma de que la recodificacion copio
#' etiquetas vacias y su fallback las reemplazo por el codigo.
#'
#' Criterio: al menos **dos** opciones con la etiqueta igual al codigo (o
#' vacia) y al menos la mitad de la lista. Los dos filtros hacen falta: sin el
#' de dos, una lista `Yes/No` dispara porque "No" se etiqueta "No"; sin el de
#' la mitad, una categoria suelta mal etiquetada bastaria. Calibrado contra el
#' instrumento de ACNUR V3: 5 listas en la version rota, 0 falsos positivos
#' sobre las 91 listas de la reparada.
#' @keywords internal
.graficos_catalogos_numerados <- function(sources) {
  vistos <- character(0)
  out <- list()
  for (src in sources %||% list()) {
    source_name <- .graficos_scalar_chr(src$name, "default")
    for (v in src$variables %||% list()) {
      # Solo importan las que pueden llegar al mazo.
      if (!(.graficos_scalar_chr(v$status, "") %in% c("cubierta", "sin_usar"))) next
      items <- v$choices %||% list()
      if (length(items) < 2L) next
      codigos <- vapply(items, function(it) .graficos_scalar_chr(it$name, ""), character(1))
      etiquetas <- vapply(items, function(it) .graficos_scalar_chr(it$label, ""), character(1))
      numeradas <- !nzchar(etiquetas) | etiquetas == codigos
      n_num <- sum(numeradas)
      if (n_num < 2L || n_num < length(items) / 2) next

      lista <- .graficos_scalar_chr(v$list_name, .graficos_scalar_chr(v$name, ""))
      clave <- paste(source_name, lista, sep = "$")
      if (clave %in% vistos) next
      vistos <- c(vistos, clave)
      out[[length(out) + 1L]] <- list(
        source = source_name,
        var = .graficos_scalar_chr(v$name, ""),
        label = .graficos_scalar_chr(v$label, .graficos_scalar_chr(v$name, "")),
        list_name = lista,
        n_numeradas = as.integer(n_num),
        n_opciones = length(items)
      )
    }
  }
  out
}

.graficos_frase_descarte <- function(d) {
  quien <- sprintf("«%s» (%s, %d respuesta%s)",
                   d$label, d$var, d$n_non_empty, if (d$n_non_empty == 1L) "" else "s")
  switch(
    d$clase,
    cerrada_descartada = sprintf(
      "%s es una pregunta cerrada y quedo fuera del mazo por «%s». Una cerrada responde con su lista de opciones: revisa el filtro, no el instrumento.",
      quien, d$exclusion_reason
    ),
    sin_lamina_posible = sprintf(
      "%s es %s y no tiene lamina posible. Tramificala en Codificacion —crea «%s_recod»— para que entre al mazo.",
      quien, d$tipo, d$var
    ),
    sprintf("%s quedo fuera del mazo.", quien)
  )
}

.graficos_frase_catalogo_numerado <- function(c) {
  sprintf(
    "El catalogo de «%s» (%s) saldria numerado: %d de %d opciones tienen el codigo como etiqueta. Revisa la recodificacion antes de exportar.",
    c$label, c$list_name, c$n_numeradas, c$n_opciones
  )
}

#' Avisos de cobertura listos para el canal `warnings`.
#' @keywords internal
.graficos_avisos_de_descarte <- function(sources) {
  descartes <- .graficos_descartes_sustantivos(sources)
  numerados <- .graficos_catalogos_numerados(sources)
  c(
    vapply(descartes, .graficos_frase_descarte, character(1)),
    vapply(numerados, .graficos_frase_catalogo_numerado, character(1))
  )
}
