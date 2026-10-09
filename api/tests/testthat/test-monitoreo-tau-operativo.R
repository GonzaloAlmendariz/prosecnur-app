test_that("sin evidencia, el operativo ES el de diseno", {
  t <- monitoreo_tau_operativo(exitos = 0, intentos = 0, tau_diseno = 0.55)
  expect_equal(t$operativo, 0.55)
  expect_equal(t$peso_evidencia, 0)
  expect_equal(t$estado, "sin_evidencia")
})

test_that("no haber medido no es haber medido cero", {
  # `observado` NA y no 0: si fuera 0, una celda sin empezar se leeria en
  # pantalla como una celda que va fatal.
  t <- monitoreo_tau_operativo(0, 0, 0.55)
  expect_true(is.na(t$observado))
  expect_equal(monitoreo_tau_veredicto(t), "como_el_diseno")
})

test_that("con mucha evidencia converge al observado", {
  t <- monitoreo_tau_operativo(exitos = 400, intentos = 1000, tau_diseno = 0.55)
  expect_equal(t$observado, 0.4)
  expect_gt(t$peso_evidencia, 0.98)
  expect_lt(abs(t$operativo - 0.4), 0.01)
})

test_that("el peso es exactamente la mitad a los k0 intentos", {
  t <- monitoreo_tau_operativo(5, 10, 0.55, k0 = 10)
  expect_equal(t$peso_evidencia, 0.5)
  # media de 0,50 observado y 0,55 de diseno
  expect_equal(t$operativo, 0.525)
})

test_that("es la media posterior del Beta-Binomial, no una mezcla inventada", {
  # (k0*tau + exitos) / (k0 + intentos) tiene que dar lo mismo que la forma
  # ponderada, que es la que se enseña en pantalla.
  for (n in c(1, 7, 33, 250)) {
    e <- round(n * 0.42)
    t <- monitoreo_tau_operativo(e, n, 0.55, k0 = 10)
    esperado <- (10 * 0.55 + e) / (10 + n)
    expect_equal(t$operativo, esperado, tolerance = 1e-12)
  }
})

test_that("un campo que rinde poco baja el operativo, pero menos que el observado", {
  # Es el comportamiento que hace util la separacion: el observado se hunde y el
  # operativo se mueve lo que la evidencia justifica.
  t <- monitoreo_tau_operativo(exitos = 1, intentos = 5, tau_diseno = 0.55)
  expect_equal(t$observado, 0.2)
  expect_gt(t$operativo, 0.2)
  expect_lt(t$operativo, 0.55)
})

describe("el veredicto mira la banda, no la diferencia de puntos", {
  it("con poca evidencia no declara diferencia aunque el observado se aleje", {
    # 1 de 4 es 0,25 contra un diseno de 0,55: treinta puntos abajo. Con cuatro
    # intentos eso no es una senal, es ruido.
    t <- monitoreo_tau_operativo(1, 4, 0.55)
    expect_lt(t$observado, t$diseno)
    expect_equal(monitoreo_tau_veredicto(t), "como_el_diseno")
  })

  it("con evidencia suficiente sí la declara", {
    t <- monitoreo_tau_operativo(150, 600, 0.55)
    expect_equal(monitoreo_tau_veredicto(t), "por_debajo")
  })

  it("y tambien cuando el campo va mejor de lo previsto", {
    t <- monitoreo_tau_operativo(500, 600, 0.55)
    expect_equal(monitoreo_tau_veredicto(t), "por_encima")
  })
})

test_that("datos rotos se declaran, no se corrigen en silencio", {
  # Mas exitos que intentos no es una tasa mayor que 1: es un dato mal armado.
  t <- monitoreo_tau_operativo(exitos = 20, intentos = 10, tau_diseno = 0.55)
  expect_equal(t$estado, "exitos_sobre_intentos")
  expect_true(is.na(t$observado))
  expect_equal(t$operativo, 0.55)  # se queda en el diseno, no inventa

  for (malo in list(-1, 1.4, NA_real_, "hola")) {
    t <- monitoreo_tau_operativo(5, 10, malo)
    expect_equal(t$estado, "diseno_invalido")
    expect_true(is.na(t$operativo))
  }
})

test_that("la banda se estrecha conforme llega evidencia", {
  ancho <- function(n) {
    t <- monitoreo_tau_operativo(round(n * 0.55), n, 0.55)
    t$banda[2] - t$banda[1]
  }
  expect_gt(ancho(5), ancho(50))
  expect_gt(ancho(50), ancho(500))
})

test_that("la version por celdas conserva el orden y marca cada estado", {
  celdas <- data.frame(
    celda = c("EEGG LETRAS / F / G4", "ARQUITECTURA / M / G1", "DERECHO / F / G2"),
    exitos = c(150, 0, 500),
    intentos = c(600, 0, 600),
    tau_diseno = c(0.43, 0.57, 0.57),
    stringsAsFactors = FALSE
  )
  r <- monitoreo_tau_operativo_celdas(celdas)
  expect_equal(r$celda, celdas$celda)                       # orden conservado
  expect_equal(r$estado, c("actualizado", "sin_evidencia", "actualizado"))
  expect_equal(r$veredicto[2], "como_el_diseno")            # sin evidencia
  expect_equal(r$veredicto[3], "por_encima")
  expect_equal(r$operativo[2], 0.57)                        # sin datos, el diseno
})

test_that("un data.frame sin las columnas que hacen falta devuelve vacio, no revienta", {
  expect_equal(nrow(monitoreo_tau_operativo_celdas(data.frame(a = 1))), 0L)
  expect_equal(nrow(monitoreo_tau_operativo_celdas(NULL)), 0L)
})
