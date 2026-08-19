# El gate de llegada TIENE consumidor: se anota al guardar cada frame nuevo.
#
# Medido el 2026-08-19: calc_muestra_aulas_novedades existia sin ningun
# llamador fuera de su archivo (grep vacio) y la revision de llegada de la
# base 2026 se hizo a mano fuera de la app. El hook vive en
# .cm_criterios_frame_guardar — el UNICO punto por el que pasan la via
# sincrona y el on_complete del job — y compara contra el llegada_snapshot
# del frame que esta por ser reemplazado.

.ng_base <- function(facultades) {
  filas <- do.call(rbind, lapply(seq_along(facultades), function(i) {
    data.frame(
      ALUMNO = sprintf("s%d_%02d", i, 1:20),
      CLAVECURSO = paste0("CUR", i),
      HORARIO = "0101",
      NOMBREFAC = facultades[[i]],
      NOMBRESPECI = "P1",
      SEXO = "F",
      EDAD = 20,
      CONDI = "regular",
      NIVELCURR = "3",
      MODLIDAD = "presencial",
      stringsAsFactors = FALSE
    )
  }))
  rownames(filas) <- NULL
  filas
}

.ng_cfg <- function() {
  calc_muestra_aulas_normalize_config(list(
    mapping = list(
      student_id = "ALUMNO", course_id = "CLAVECURSO", schedule = "HORARIO",
      faculty = "NOMBREFAC", program = "NOMBRESPECI", sex = "SEXO",
      age = "EDAD", condition = "CONDI", level = "NIVELCURR", modality = "MODLIDAD"
    ),
    filters = list(min_eligible_per_class = 1L)
  ))
}

test_that("la primera construccion no compara; la segunda canta la facultad nueva", {
  cfg <- .ng_cfg()
  f1 <- calc_muestra_aulas_construir(base_madre = .ng_base(c("FAC1", "FAC2")), config = cfg)
  expect_identical(f1$llegada_snapshot$schema, "cm_llegada_snapshot_v1")
  f2 <- calc_muestra_aulas_construir(base_madre = .ng_base(c("FAC1", "FAC2", "FAC NUEVA")), config = cfg)

  primera <- calc_muestra_aulas_novedades_anotar(f1, NULL)
  expect_false(primera$novedades$comparado)

  segunda <- calc_muestra_aulas_novedades_anotar(f2, f1)
  expect_true(segunda$novedades$comparado)
  tipos <- vapply(segunda$novedades$bloques, function(b) b$tipo, character(1))
  expect_true("facultad_nueva" %in% tipos)
  vals <- segunda$novedades$bloques[[which(tipos == "facultad_nueva")[1]]]$valores
  expect_true(any(vapply(vals, function(v) identical(v$valor, "FAC NUEVA"), logical(1))))
})

test_that("el hook real del guardado anota las novedades en la sesion (e2e)", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  cfg <- .ng_cfg()
  f1 <- calc_muestra_aulas_construir(base_madre = .ng_base(c("FAC1", "FAC2")), config = cfg)
  g1 <- .cm_criterios_frame_guardar(sid, f1)
  expect_false(g1$novedades$comparado)

  f2 <- calc_muestra_aulas_construir(base_madre = .ng_base(c("FAC1", "FAC2", "FAC NUEVA")), config = cfg)
  g2 <- .cm_criterios_frame_guardar(sid, f2)
  expect_true(g2$novedades$comparado)
  tipos <- vapply(g2$novedades$bloques, function(b) b$tipo, character(1))
  expect_true("facultad_nueva" %in% tipos)
  # Y lo guardado en sesion es lo mismo que se devolvio: la UI lo puede leer.
  en_sesion <- session_get(sid)[["calc_muestra_aulas_frame"]]
  expect_true(en_sesion$novedades$comparado)
})

test_that("una llegada identica queda declarada limpia o sin bloques", {
  cfg <- .ng_cfg()
  f1 <- calc_muestra_aulas_construir(base_madre = .ng_base(c("FAC1", "FAC2")), config = cfg)
  f2 <- calc_muestra_aulas_construir(base_madre = .ng_base(c("FAC1", "FAC2")), config = cfg)
  out <- calc_muestra_aulas_novedades_anotar(f2, f1)
  expect_true(out$novedades$comparado)
  graves <- Filter(function(b) identical(b$gravedad, "alta"), out$novedades$bloques)
  expect_length(graves, 0L)
})
