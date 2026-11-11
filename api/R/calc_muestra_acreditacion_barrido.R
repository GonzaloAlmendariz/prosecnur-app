# ADR 0143: en acreditación, por correo, teléfono o mixto se invita a toda la
# base. El cuadro del ADR 0091 sorteaba docentes y egresados sin mirar el
# canal; en campo se invita (o se llama) a todos y el sesgo se controla con
# cuotas por segmento, no con un sorteo previo.

.CM_CANALES_BARRIDO <- c("online_email", "telefonico", "mixto")

# Cobertura por defecto cuando el usuario no declara meta: la mínima del
# documento PULSO de marzo 2026, la misma que ya usaba el cuadro.
.CM_COBERTURA_BARRIDO <- c(estudiantes = 0.60, docentes = 0.60, administrativos = 0.80, egresados = 0.50)

.CM_CONTROL_BARRIDO <- c(docentes = "dedicacion_docente", egresados = "ciclo_egreso")

.CM_ACTOR_BARRIDO_ROTULO <- c(estudiantes = "Estudiantes", docentes = "Docentes",
                              administrativos = "Administrativos", egresados = "Egresados")

#' Inferencia del cuadro para los canales que se barren; NULL si no aplica.
.cm_cuadro_inferir_barrido <- function(actor, canal) {
  if (!canal %in% .CM_CANALES_BARRIDO || !actor %in% names(.CM_COBERTURA_BARRIDO)) return(NULL)
  cobertura <- .CM_COBERTURA_BARRIDO[[actor]]
  via <- switch(canal, telefonico = "se llama a toda la base", mixto = "se contacta a toda la base",
                "se invita a toda la base")
  out <- list(
    tecnica = "intencion_censal",
    minimo_cobertura = cobertura,
    regla = "barrido_por_canal",
    justificacion = sprintf(
      "%s: %s (intención censal); la meta es la declarada o, sin ella, el %.0f%% del documento PULSO, y se controla con cuotas por segmento.",
      .CM_ACTOR_BARRIDO_ROTULO[[actor]], via, 100 * cobertura)
  )
  if (actor %in% names(.CM_CONTROL_BARRIDO)) out$variable_control <- .CM_CONTROL_BARRIDO[[actor]]
  out
}

#' Reparte la meta de una intención censal entre segmentos y mide si alcanza.
#'
#' Proporcional a N_h (mayor resto, suma exacta) y, encima, el mínimo por
#' segmento: un segmento cuya parte proporcional queda bajo el mínimo sube a
#' min(mínimo, N_h) SIN descontar a los demás, así que el total del público
#' crece en lo que agrega el mínimo (decisión de Gonzalo, 2026-11-11: "Sumarlo
#' encima"; antes el mínimo se descontaba de los segmentos grandes y el total
#' quedaba fijo). Cada segmento se invita entero (n_campo = N_h) y se esperan
#' N_h · tasa completas.
#' @return list(distribucion, no_alcanzan (rótulos), n_total, agregado_minimo)
.cm_barrido_por_segmento <- function(n_objetivo, estratos, piso, tasa) {
  N_h <- vapply(estratos, function(e) as.integer(e$N), 1L)
  prop <- .cm_general_reparto(n_objetivo, N_h, piso = 0L)
  minimo <- pmin(as.integer(max(0L, piso)), N_h)
  n_h <- pmax(prop, minimo)
  distribucion <- lapply(seq_along(estratos), function(i) {
    esperadas <- N_h[[i]] * tasa
    list(
      estrato = estratos[[i]]$label,
      N = N_h[[i]],
      n = as.integer(n_h[[i]]),
      n_proporcional = as.integer(prop[[i]]),
      n_campo = N_h[[i]],
      respuesta_necesaria = if (N_h[[i]] > 0L) n_h[[i]] / N_h[[i]] else NA_real_,
      completas_esperadas = esperadas,
      alcanza = esperadas >= n_h[[i]] - 1e-9,
      regla = if (n_h[[i]] > prop[[i]]) sprintf("minimo_%d", piso) else "proporcional",
      precision_e = NA_real_
    )
  })
  no_alcanzan <- vapply(Filter(function(d) !d$alcanza, distribucion), `[[`, "", "estrato")
  list(distribucion = distribucion, no_alcanzan = no_alcanzan,
       n_total = as.integer(sum(n_h)), agregado_minimo = as.integer(sum(n_h) - sum(prop)))
}

#' Aviso de los segmentos: los que no alcanzan y el mínimo que no cupo.
#'
#' Si el público entero ya no alcanza (`publico_no_alcanza`), sólo se nombran
#' los segmentos que piden más que el público: con reparto proporcional todos
#' piden lo mismo y listarlos repetía el aviso general (DCI docentes A: los
#' cinco segmentos al 34 % frente a una respuesta de 31.6 %).
.cm_barrido_aviso_segmentos <- function(seg, piso, tasa, cobertura = NA_real_, publico_no_alcanza = FALSE) {
  avisos <- character()
  fallan <- Filter(function(d) !d$alcanza, seg$distribucion)
  if (publico_no_alcanza && is.finite(cobertura))
    fallan <- Filter(function(d) d$respuesta_necesaria > cobertura + 0.005, fallan)
  if (length(fallan)) {
    detalle <- vapply(fallan, function(d)
      sprintf("%s (%d de %d, %.0f %% de respuesta)", d$estrato, d$n, d$N, 100 * d$respuesta_necesaria), "")
    avisos <- c(avisos, sprintf(
      "Con una respuesta esperada del %.0f %% no alcanzan su meta: %s.", 100 * tasa, paste(detalle, collapse = "; ")))
  }
  if (seg$agregado_minimo > 0L) avisos <- c(avisos, sprintf(
    "El mínimo de %d por segmento agrega %d %s a la meta del público.", piso, seg$agregado_minimo,
    if (seg$agregado_minimo == 1L) "encuesta" else "encuestas"))
  avisos
}
