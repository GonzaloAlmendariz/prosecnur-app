# Genera el fixture de paridad TS↔R para la vista previa del calculador.
#
# Evalúa calc_n_muestra / calc_e_desde_n_muestra sobre una grilla de inputs y
# escribe frontend/src/features/calcMuestra/didactica/__tests__/paridad-fixture.json.
# El test vitest `paridad-motor.test.ts` compara los previews TypeScript contra
# estas salidas de referencia; si divergen, CI falla.
#
# Uso: Rscript api/tools/gen_paridad_calc_muestra.R   (desde la raíz del repo)

api_dir <- normalizePath(file.path(dirname(sub("--file=", "", grep("--file=", commandArgs(FALSE), value = TRUE))), ".."))
source(file.path(api_dir, "R", "errors.R"))
source(file.path(api_dir, "R", "helpers_calc_comunes.R"))

grid <- expand.grid(
  N = c(500, 1200, 5000, 10000, 28000, 120000),
  p = c(0.3, 0.5, 0.62),
  confianza = c(0.90, 0.95, 0.99),
  e = c(0.02, 0.025, 0.03, 0.05),
  deff = c(1, 1.2, 1.5, 2),
  KEEP.OUT.ATTRS = FALSE
)

casos <- lapply(seq_len(nrow(grid)), function(i) {
  g <- grid[i, ]
  z <- stats::qnorm(1 - (1 - g$confianza) / 2)
  n <- calc_n_muestra(N = g$N, p = g$p, z = z, e = g$e, deff = g$deff)
  e_real <- calc_e_desde_n_muestra(n = n, N = g$N, p = g$p, z = z, deff = g$deff)
  list(
    input = list(N = g$N, p = g$p, confianza = g$confianza, e = g$e, deff = g$deff),
    esperado = list(z = z, n = as.integer(n), e_real = e_real)
  )
})

out_path <- file.path(api_dir, "..", "frontend", "src", "features", "calcMuestra",
                      "didactica", "__tests__", "paridad-fixture.json")
dir.create(dirname(out_path), recursive = TRUE, showWarnings = FALSE)
jsonlite::write_json(
  list(
    generado_por = "api/tools/gen_paridad_calc_muestra.R (motor R validado)",
    formula = "n = ceil((N * z^2 * p * q * deff) / ((N - 1) * e^2 + z^2 * p * q * deff))",
    casos = casos
  ),
  out_path,
  auto_unbox = TRUE, digits = NA, pretty = TRUE
)
cat(sprintf("Fixture escrito: %s (%d casos)\n", normalizePath(out_path), length(casos)))
