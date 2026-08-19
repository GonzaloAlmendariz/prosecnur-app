# Docente único entre titulares (EF2, era EFECTIVIDAD).
#
# Pedido textual de Gonzalo (2026-08-18): «un mismo docente, por más que sean
# dos cursos horarios diferentes, no sea seleccionado de forma repetida (…)
# no molestar al docente» — un docente contactado dos veces puede negarse a la
# segunda, y la selección no tiene vuelta atrás.
#
# Medido antes de implementar (VARA 3): en los 203 titulares vigentes había 8
# docentes repetidos (17 aulas), dos casos CRUZANDO facultades → el dedup es
# GLOBAL sobre M1, no por estrato. Riesgo de ahogo medido: 80 estratos, CERO
# con docentes_únicos < cuota (78 con holgura ≥2×) → restricción dura viable.
#
# Diseño: reparación POST-sorteo por intercambio determinista, registrada
# (VARA 0: el sacrificio de aleatoriedad se declara, nunca se esconde):
#   - Sólo toca filas M1 (titulares). Las olas se usan para el intercambio
#     inverso cuando el candidato ya estaba de reserva (unicidad global).
#   - De cada grupo en conflicto CONSERVA el aula del estrato con MENOS
#     alternativas (protege al escaso) y repara en los demás.
#   - Candidato: misma celda (estrato), docente no presente en M1, mayor
#     eligible_n; empate por classroom_id. Sin RNG: reproducible.
#   - Sin candidato → el repetido SE QUEDA y se declara `no_reparable`.
#   - Todo ajuste viaja en attr `docente_unico` + warning con cifras.

.cm_docente_key <- function(x) {
  v <- toupper(trimws(as.character(x %||% "")))
  v[is.na(v)] <- ""
  v
}

.cm_aulas_docente_unico_reparar <- function(selection_df, aula_frame, selector) {
  activo <- selector$docente_unico %||% TRUE
  registro <- list(activo = isTRUE(activo), ajustes = list(), no_reparables = list())
  if (!isTRUE(activo) || !nrow(selection_df) || !"teacher" %in% names(selection_df)) {
    attr(selection_df, "docente_unico") <- registro
    return(selection_df)
  }

  es_m1 <- selection_df$wave == "M1"
  doc_sel <- .cm_docente_key(selection_df$teacher)
  doc_frame <- .cm_docente_key(aula_frame$teacher)

  # Conflictos: docentes no vacíos con >1 aula M1, en orden estable.
  m1_docs <- doc_sel[es_m1]
  repetidos <- sort(names(which(table(m1_docs[nzchar(m1_docs)]) > 1)))

  for (docente in repetidos) {
    idx_grupo <- which(es_m1 & doc_sel == docente)
    if (length(idx_grupo) < 2L) next
    # Alternativas por estrato: aulas de la celda NO seleccionadas en M1 y
    # con docente fuera de M1 (o sin docente conocido).
    alternativas <- vapply(idx_grupo, function(i) {
      st <- selection_df$stratum[[i]]
      en_celda <- which(aula_frame$stratum == st)
      cand <- doc_frame[en_celda]
      libres <- !(as.character(aula_frame$classroom_id[en_celda]) %in%
                    as.character(selection_df$classroom_id[es_m1]))
      sum(libres & (!nzchar(cand) | !(cand %in% doc_sel[es_m1])))
    }, numeric(1))
    # Conserva donde MENOS alternativas hay; empate por classroom_id.
    orden <- order(alternativas, as.character(selection_df$classroom_id[idx_grupo]))
    conservar <- idx_grupo[orden[[1L]]]
    for (i in setdiff(idx_grupo[orden], conservar)) {
      st <- selection_df$stratum[[i]]
      en_celda <- which(aula_frame$stratum == st)
      # Docentes hoy en M1 (estado vivo: se actualiza tras cada swap).
      docs_m1 <- doc_sel[es_m1]
      elegibles <- en_celda[
        !(as.character(aula_frame$classroom_id[en_celda]) %in%
            as.character(selection_df$classroom_id[es_m1])) &
          (!nzchar(doc_frame[en_celda]) | !(doc_frame[en_celda] %in% docs_m1))
      ]
      if (!length(elegibles)) {
        registro$no_reparables[[length(registro$no_reparables) + 1L]] <- list(
          docente = docente, stratum = st,
          classroom_id = as.character(selection_df$classroom_id[[i]])
        )
        next
      }
      eleg_n <- suppressWarnings(as.numeric(aula_frame$eligible_n[elegibles]))
      eleg_n[!is.finite(eleg_n)] <- 0
      pick <- elegibles[order(-eleg_n, as.character(aula_frame$classroom_id[elegibles]))][[1L]]
      saliente <- as.character(selection_df$classroom_id[[i]])
      entrante <- as.character(aula_frame$classroom_id[[pick]])
      # Si el entrante ya estaba de reserva en una ola, esa fila recibe al
      # saliente: intercambio que conserva la unicidad global de classroom_id.
      en_ola <- which(!es_m1 & as.character(selection_df$classroom_id) == entrante)
      comunes <- intersect(names(selection_df), names(aula_frame))
      if (length(en_ola)) {
        fila_saliente <- selection_df[i, comunes, drop = FALSE]
        selection_df[en_ola[[1L]], comunes] <- fila_saliente
        doc_sel[en_ola[[1L]]] <- docente
      }
      selection_df[i, comunes] <- aula_frame[pick, comunes, drop = FALSE]
      doc_sel[i] <- doc_frame[[pick]]
      registro$ajustes[[length(registro$ajustes) + 1L]] <- list(
        docente = docente, stratum = st, saliente = saliente, entrante = entrante,
        intercambiado_con_ola = length(en_ola) > 0L
      )
    }
  }

  if (length(registro$ajustes) || length(registro$no_reparables)) {
    aviso <- sprintf(
      paste0(
        "Docente unico entre titulares: %d ajuste(s) por intercambio en la ",
        "misma celda (registrados; sacrificio de aleatoriedad declarado)%s."
      ),
      length(registro$ajustes),
      if (length(registro$no_reparables)) {
        sprintf("; %d repetido(s) sin candidato se conservan y se declaran",
                length(registro$no_reparables))
      } else ""
    )
    attr(selection_df, "warnings") <- c(attr(selection_df, "warnings") %||% character(0), aviso)
  }
  attr(selection_df, "docente_unico") <- registro
  selection_df
}
