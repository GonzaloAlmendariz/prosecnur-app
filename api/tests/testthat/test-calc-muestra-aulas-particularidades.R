# Particularidades del marco de aulas (calc_muestra_aulas_particularidades.R,
# asesoría muestral 2026-07-15 §12): detección de señales (session_type
# dominante, multi-facultad, código Z, nombre de tesis), decisión manual
# documentada (excluir/incluir/revisado + nota), paso propio del embudo,
# round-trip de la whitelist del workspace y tolerancia a columnas ausentes.

# Bloque sintético de un aula: n estudiantes con los filtros históricos ya
# satisfechos (edad 20, regular, presencial) + señales para las
# particularidades (tipo de sesión, código de curso con o sin Z, nombre).
.part_bloque <- function(aula,
                         sids,
                         curso_id = paste0("C-", aula),
                         curso = paste("Curso", aula),
                         tipo_sesion = "TEORICO",
                         facultad = "FAC1",
                         nivel = "3") {
  n <- length(sids)
  data.frame(
    student_id = sids,
    aula_id = aula,
    curso_id = curso_id,
    curso = curso,
    horario = "H1",
    facultad = facultad,
    programa = "P1",
    sexo = rep(c("F", "M"), length.out = n),
    edad = 20,
    condicion = "regular",
    nivel = rep(nivel, length.out = n),
    modalidad = "presencial",
    tipo_sesion = tipo_sesion,
    stringsAsFactors = FALSE
  )
}

# Base de 10 aulas: 9 con tipo TEORICO y 1 TALLER (dominante al 90% con 2
# categorías), A02 con código Z, A03 "Taller de tesis I", A04 "Síntesis"
# (control anti-falso-positivo del regex de tesis).
.part_base <- function() {
  rbind(
    .part_bloque("A01", c("s01", "s02")),
    .part_bloque("A02", c("s03", "s04"), curso_id = "1701Z"),
    .part_bloque("A03", c("s05", "s06"), curso = "Taller de tesis I"),
    .part_bloque("A04", c("s07", "s08"), curso = "Síntesis musical"),
    .part_bloque("A05", c("s09", "s10")),
    .part_bloque("A06", c("s11", "s12")),
    .part_bloque("A07", c("s13", "s14")),
    .part_bloque("A08", c("s15", "s16")),
    .part_bloque("A09", c("s17", "s18")),
    .part_bloque("A10", c("s19", "s20"), tipo_sesion = "TALLER")
  )
}

# Catálogo con A05 sirviendo a DOS facultades (dos filas facultad_del_curso
# distintas): la señal multi-facultad se deriva de los pares facultad-nivel
# del catálogo, nunca de la facultad del alumno.
.part_catalogo <- function() {
  data.frame(
    aula_id = c("A01", "A05", "A05"),
    curso_id = c("C-A01", "C-A05", "C-A05"),
    facultad_del_curso = c("FAC1", "INGENIERIAS", "CIENCIAS"),
    nivel_curso = c("3", "3", "5"),
    stringsAsFactors = FALSE
  )
}

.part_cfg <- function(extra_config = list()) {
  config <- c(list(filters = list(min_eligible_per_class = 1L)), extra_config)
  calc_muestra_aulas_normalize_config(config)
}

test_that("las cuatro señales aparecen en frame$particularidades", {
  frame <- calc_muestra_aulas_construir(
    base_madre = .part_base(),
    catalogo_curso_horario = .part_catalogo(),
    config = .part_cfg()
  )
  part <- frame$particularidades
  expect_equal(part$schema, "calc_muestra_aulas_particularidades_v1")

  # session_type dominante: 9/10 TEORICO (90%) con 2 categorías no vacías.
  expect_false(is.null(part$session_type_dominante))
  expect_equal(part$session_type_dominante$categoria, "TEORICO")
  expect_equal(part$session_type_dominante$share, 0.9)
  expect_equal(part$session_type_dominante$total_categorias, 2L)

  # multi-facultad: solo A05 (dos facultades del curso en el catálogo).
  expect_equal(part$counts$multi_facultad, 1L)
  expect_length(part$multi_facultad, 1L)
  expect_equal(part$multi_facultad[[1]]$id, "A05")
  expect_equal(part$multi_facultad[[1]]$n_facultades, 2L)
  expect_setequal(unlist(part$multi_facultad[[1]]$facultades), c("INGENIERIAS", "CIENCIAS"))

  # código Z: solo A02 ("1701Z", sufijo tras dígito).
  expect_equal(part$counts$codigo_z, 1L)
  expect_equal(part$codigo_z[[1]]$id, "A02")
  expect_equal(part$codigo_z[[1]]$codigo, "1701Z")

  # nombre tesis: A03 sí, "Síntesis musical" (A04) NO (frontera de palabra).
  expect_equal(part$counts$nombre_tesis, 1L)
  expect_equal(part$nombre_tesis[[1]]$id, "A03")
  expect_equal(part$nombre_tesis[[1]]$curso, "Taller de tesis I")

  expect_equal(part$counts$sin_ids, 0L)
  # Sin decisiones: eco vacío y marco intacto.
  expect_equal(part$decisiones, list())
  expect_equal(part$excluidas_manual, list())
  expect_true(all(frame$aula_frame$included))
})

test_that("regex Z conservador y regex de tesis sin acentos", {
  expect_equal(
    .cm_particularidades_es_codigo_z(c("MAT101Z", "Z-101", "Z2", "AZUL", "LUZ", "C-A01", "")),
    c(TRUE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE)
  )
  expect_equal(
    .cm_particularidades_es_nombre_tesis(c(
      "Taller de tesis I", "SEMINARIO DE TESIS", "Tesis", "Síntesis", "Prótesis dental", ""
    )),
    c(TRUE, TRUE, TRUE, FALSE, FALSE, FALSE)
  )
})

test_that("session_type_dominante es NULL con >2 categorías o share < 85%", {
  expect_null(.cm_particularidades_session_dominante(character(0)))
  # 3 categorías no vacías, aunque la top concentre >= 85%.
  expect_null(.cm_particularidades_session_dominante(
    c(rep("TEORICO", 18), "TALLER", "LABORATORIO")
  ))
  # 2 categorías pero share 80% < 85%.
  expect_null(.cm_particularidades_session_dominante(
    c(rep("TEORICO", 8), rep("TALLER", 2))
  ))
  # Una sola categoría (100%): señal activa con total_categorias 1.
  sola <- .cm_particularidades_session_dominante(rep("TEORICO", 5))
  expect_equal(sola$categoria, "TEORICO")
  expect_equal(sola$share, 1)
  expect_equal(sola$total_categorias, 1L)
})

test_that("decisión 'excluir' saca el CH del marco con razón y paso propios", {
  frame <- calc_muestra_aulas_construir(
    base_madre = .part_base(),
    config = .part_cfg(list(particularidades_decisiones = list(
      A02 = list(decision = "excluir", nota = "Local externo (código Z)"),
      A03 = list(decision = "revisado", nota = "Tesis: se mantiene"),
      A05 = list(decision = "incluir")
    )))
  )
  af <- frame$aula_frame
  # A02 fuera con razón propia; A03/A05 documentadas sin tocar el marco.
  expect_false(af$included[af$classroom_id == "A02"])
  expect_equal(af$exclude_reason[af$classroom_id == "A02"], "particularidad_manual")
  expect_true(af$included[af$classroom_id == "A03"])
  expect_true(af$included[af$classroom_id == "A05"])
  expect_equal(sum(!af$included), 1L)

  # Eco de decisiones en el frame para la UI (estado revisado + notas).
  dec <- frame$particularidades$decisiones
  expect_setequal(names(dec), c("A02", "A03", "A05"))
  expect_equal(dec$A02$decision, "excluir")
  expect_equal(dec$A02$nota, "Local externo (código Z)")
  expect_equal(dec$A03$decision, "revisado")
  expect_equal(frame$particularidades$excluidas_manual, list("A02"))

  # Paso propio del embudo: cierra la cuenta contra marco_aulas.
  embudo <- frame$perfil$embudo_aula
  ultima <- embudo[nrow(embudo), ]
  expect_equal(ultima$id, "particularidad_manual")
  expect_equal(ultima$label, "Particularidades (decisión manual)")
  expect_equal(ultima$excluidos, 1L)
  expect_equal(ultima$conteo, frame$perfil$marco_aulas)
  expect_equal(embudo$conteo[nrow(embudo) - 1L] - 1L, ultima$conteo)

  # Rastro en la auditoría del marco.
  audit <- frame$audit
  expect_equal(audit$value[audit$metric == "particularidad_manual_excluded_n"], "1")
  expect_equal(audit$value[audit$metric == "particularidad_decisiones_n"], "3")
  expect_equal(audit$value[audit$metric == "classroom_included_n"], "9")
})

test_that("'incluir'/'revisado' no alteran el marco ni agregan paso al embudo", {
  base <- .part_base()
  sin_dec <- calc_muestra_aulas_construir(base_madre = base, config = .part_cfg())
  con_doc <- calc_muestra_aulas_construir(
    base_madre = base,
    config = .part_cfg(list(particularidades_decisiones = list(
      A02 = list(decision = "incluir", nota = "Se confirma en marco"),
      A03 = list(decision = "revisado")
    )))
  )
  expect_equal(con_doc$aula_frame$included, sin_dec$aula_frame$included)
  expect_equal(con_doc$aula_frame$exclude_reason, sin_dec$aula_frame$exclude_reason)
  expect_false("particularidad_manual" %in% con_doc$perfil$embudo_aula$id)
  expect_equal(con_doc$perfil$marco_aulas, sin_dec$perfil$marco_aulas)
  # La documentación sí deja rastro auditable (0 exclusiones).
  audit <- con_doc$audit
  expect_equal(audit$value[audit$metric == "particularidad_manual_excluded_n"], "0")
  expect_equal(audit$value[audit$metric == "particularidad_decisiones_n"], "2")
})

test_that("excluir un CH ya excluido por criterios conserva la razón original", {
  base <- rbind(
    .part_bloque("A01", c("s01", "s02")),
    .part_bloque("A02", "s03")  # 1 elegible < min 2 -> min_eligible_per_class
  )
  frame <- calc_muestra_aulas_construir(
    base_madre = base,
    config = calc_muestra_aulas_normalize_config(list(
      filters = list(min_eligible_per_class = 2L),
      particularidades_decisiones = list(A02 = list(decision = "excluir"))
    ))
  )
  af <- frame$aula_frame
  expect_false(af$included[af$classroom_id == "A02"])
  # Ya estaba fuera por criterios: la razón NO se re-etiqueta y el paso manual
  # no aparece (no salió nada nuevo del marco).
  expect_equal(af$exclude_reason[af$classroom_id == "A02"], "min_eligible_per_class")
  expect_equal(frame$particularidades$excluidas_manual, list())
  expect_false("particularidad_manual" %in% frame$perfil$embudo_aula$id)
  audit <- frame$audit
  expect_equal(audit$value[audit$metric == "particularidad_manual_excluded_n"], "0")
})

test_that("normalizador de decisiones: defensivo y estable en round-trip del workspace", {
  ws <- calc_muestra_normalize_estudio(list(
    titulo = "t",
    workspace = list(
      frame_mode = "acreditacion",
      aulas_config = list(particularidades_decisiones = list(
        A01 = list(decision = "excluir", nota = "local externo"),
        A02 = list(decision = "revisar"),                    # inválida -> descartada
        A03 = "incluir",                                     # atajo string
        A04 = list(decision = "REVISADO", nota = c("n1", "n2"))  # case + nota escalar
      ))
    )
  ))$workspace
  dec <- ws$aulas_config$particularidades_decisiones
  expect_setequal(names(dec), c("A01", "A03", "A04"))
  expect_equal(dec$A01, list(decision = "excluir", nota = "local externo"))
  expect_equal(dec$A03, list(decision = "incluir", nota = ""))
  expect_equal(dec$A04, list(decision = "revisado", nota = "n1"))

  # Segundo round-trip estable (no se degrada ni se pierde).
  ws2 <- calc_muestra_normalize_estudio(list(titulo = "t", workspace = ws))$workspace
  expect_equal(ws2$aulas_config$particularidades_decisiones, dec)

  # Ausente -> list() (proyectos viejos) y basura -> list().
  vacio <- calc_muestra_normalize_estudio(list(
    titulo = "t",
    workspace = list(frame_mode = "legacy", aulas_config = list(schema = "calc_muestra_workspace_aulas_v1"))
  ))$workspace$aulas_config$particularidades_decisiones
  expect_equal(vacio, list())
  expect_equal(.cm_particularidades_normalize_decisiones("basura"), list())
  expect_equal(.cm_particularidades_normalize_decisiones(list(1, 2)), list())
})

test_that("tolerancia: columnas ausentes y frames vacíos degradan a listas vacías", {
  # Llamada directa con frame vacío y sin catálogo: nunca error.
  part <- calc_muestra_aulas_particularidades(data.frame(), NULL, NULL)
  expect_null(part$session_type_dominante)
  expect_equal(part$multi_facultad, list())
  expect_equal(part$codigo_z, list())
  expect_equal(part$nombre_tesis, list())
  expect_equal(part$counts$multi_facultad, 0L)
  expect_equal(part$counts$sin_ids, 0L)

  # construir con base mínima (sin curso, sin tipo de sesión, sin catálogo):
  # las señales quedan vacías y el build no falla.
  base_min <- data.frame(
    student_id = c("s1", "s2", "s3", "s4"),
    aula_id = c("A1", "A1", "A2", "A2"),
    stringsAsFactors = FALSE
  )
  frame <- calc_muestra_aulas_construir(base_madre = base_min, config = .part_cfg())
  part <- frame$particularidades
  expect_null(part$session_type_dominante)
  expect_equal(part$multi_facultad, list())
  expect_equal(part$codigo_z, list())
  expect_equal(part$nombre_tesis, list())

  # Decisión sobre un id que no existe en el marco: no-op documentado.
  frame2 <- calc_muestra_aulas_construir(
    base_madre = base_min,
    config = .part_cfg(list(particularidades_decisiones = list(
      NOEXISTE = list(decision = "excluir")
    )))
  )
  expect_true(all(frame2$aula_frame$included))
  expect_equal(frame2$particularidades$excluidas_manual, list())
})
