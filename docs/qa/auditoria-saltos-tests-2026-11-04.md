# Auditoría de saltos en los tests de R (4 nov 2026)

Tipo: Registro QA fechado
Estado: Vigente
Fecha: 2026-11-04
Autoridad: encargo de coordinación (Meta B); decisiones de la sesión, revisables por Gonzalo

Encargo de coordinación (Meta B): auditar los tests de `api/tests/testthat/` que se apagan según dónde corren, y no
por una causa del propio test. Revivir los que no deberían estar saltados, arreglar lo que salga rojo y poner un
guardián. Lo destapó el verificador: el test del deploy manual del tablero llevaba `skip_on_cran()`, seguía
esperando un resultado que el código ya no daba, y ningún gate local lo veía. Decisiones de la sesión,
**revisables por Gonzalo**.

## Dónde corre cada cosa

| Entorno | `NOT_CRAN` | `CI` | Herramientas |
|---|---|---|---|
| `make gate-area`, `testthat::test_file`, corrida local | sin fijar | sin fijar | Quarto, LibreOffice, poppler, etc., según la máquina |
| CI (`quality.yml`, job backend-r, 4 shards con `test_dir`) | `true` (lo exporta `r-lib/actions/setup-r`; se ve en el log como `NOT_CRAN: true`) | `true` | poppler-utils; **sin** Quarto, Typst, LibreOffice, magick, pyreadstat ni Playwright |

Corrección de una premisa: en c94562fb0 y 619b2d994 escribí que el CI no fija `NOT_CRAN`. Sí la fija, y lo corregí en
d7d88d60e. Un `skip_on_cran` mudo no apaga el test en el CI; lo deja fuera del gate local que se corre al cerrar
un cambio, y su rojo sale recién en el CI.

## Lo que se arregló

| # | Qué | Antes | Después | Commit |
|---|---|---|---|---|
| 1 | Deploy manual del tablero (`test-dashboard-publish-space.R`) | `skip_on_cran`, fuera del gate local, esperando 0 de un script que ya se negaba | Corre siempre, con fuente real (acnur_pdm), y suma el caso sin fuente | 5e60479e3, c94562fb0 |
| 2 | Cinco renders reales con Quarto (calc-muestra general-sin-aulas ×3, sustento, muestra territorial) | `skip_on_cran` en local y sin Quarto en el CI: no corrían en ninguna parte | Sin `skip_on_cran`: corren donde hay Quarto. Revivieron en verde (23, 25 y 222 expectativas) | 619b2d994 |
| 3 | Bloque real de `launch_server.R` | Solo se buscaba la llamada en el texto | Se ejecuta contra cuatro estados y además se prueba que no disfraza un error ajeno | 619b2d994 |
| 4 | `test-monitoreo-publish-qa.R`, los dos PDF cliente | «No PDF text extractor» en el CI: solo se probaba `pypdf`, que el CI no tiene, aunque poppler estaba instalado | Prueba primero `pdftotext`. La cifra de cada tarjeta es la primera que sigue a «ENCUESTAS», porque pdftotext lee los rótulos de una fila antes que sus cifras. Las cifras ya cuadraban con el Sheets cliente | f3fcb38a0 |
| 5 | `test-aulas-libro-casos-por-aula.R`, «el alto de cada fila se reasienta» | «empty test» en el CI: solo afirmaba dentro de un bucle que en verde no da vueltas | Afirma siempre: hay altos pedidos y ninguna fila que no sea cabecera queda sin el suyo | 3a3a040d9 |
| 6 | `test-hojas-ruta-engine.R` | Skip de archivo en CI desde 8699413d6 (may 2026), con una variable de reactivación que ningún workflow fija: los 65 tests no corrían nunca en el CI | Medido: 155–215 s en local. Los 8 de integración (~95 s) se apagan solo en CI, con motivo y opt-in (`PROSECNUR_RUN_HOJAS_RUTA_ENGINE_CI=1`). Los 57 restantes corren siempre (~1,7 min con `CI=true`, 0 fallas). En gate-area corren los 65 | 3ed0e52be |

Guardián: `scripts/tests/saltosPorEntornoConMotivo.test.mjs`. Corre en el CI, en el job frontend.

- Exige `# skip_on_cran: <por qué>` o `# skip_on_ci: <por qué>` en el bloque de comentarios que está justo encima de cada `skip_on_cran()`, `skip_on_ci()` o salto condicionado a `Sys.getenv("CI")`/`GITHUB_ACTIONS`.
- Reconoce el salto en tres formas: en la misma línea, dentro de una llamada que se abre más arriba, o como cuerpo de un `if (CI)`.
- Un `if (CI) fail(...)` no es un salto y pasa.
- Tiene autopruebas de las tres formas y del falso positivo de `test-xlsform-formulario-pdf.R`.

## Tests que hoy solo corren en local, por herramienta

El CI no instala estas herramientas. Agregarlas cambia el tiempo y el costo del CI, así que **lo decide Gonzalo**.
Fuente: los motivos de skip («Reason:») de los 4 shards de la corrida 41257157814 (1 nov), cruzados con un grep de
los `skip_if_not` del árbol.

| Herramienta | Suites (tests saltados en CI) | Qué se deja de ver en el CI |
|---|---|---|
| Quarto | `test-reporte-calc-muestra-general-sin-aulas.R` (3), `test-reporte-calc-muestra-sustento.R` (1), `test-reporte-muestra-territorial-marco.R` (1), `test-engine-reporte-enumeradores-integracion.R` (2) | Los reportes HTML/PDF de Cálculo de muestra, muestra territorial y enumeradores, renderizados de verdad |
| LibreOffice (`soffice`, renderer headless) | `test-graficos-preview-lamina.R` (4), `test-graficos-preview-compare.R` (3), `test-reporte-word-visor.R` (2), `test-graficos-miniaturas.R` (1), `test-xlsform-editor-word-visor.R` (1) | La vista previa de láminas PPT, las miniaturas y el visor de Word |
| magick | `test-engine-dimensiones-iconos-foda-radar.R` (2) | Los íconos y el radar FODA rasterizados |
| pyreadstat (Python) | `test-analitica-bases.R` (2) | La lectura de `.sav` por la ruta de Python |
| node + Playwright | `test-collection-mail-huecos.R` (1) | El render del correo de material de campo |
| `validate.py` (skill docx) | `test-reporte-word-identidad.R` (1) | La validación OOXML del Word |

Fuera de esta tabla quedan los saltos por fixtures o rutas locales que no viajan al CI. No son de herramienta y
no cambian con instalar nada. Son estos: `test-corpus-instrumentos.R` (`PULSO_CORPUS_DIR`),
`test-engine-surveymonkey-fixture-amdt.R`, `test-engine-construir-plantilla-ppt.R`, `test-carga-sav-preview.R`,
`test-calc-muestra-criterios.R` (scratchpad), `test-analitica-script-replica.R` (carpeta temporal `tmp` del repo, 2),
`test-reporte-ppt-saneo-ooxml.R`, `test-reference-projects-fixtures.R` y `test-calc-muestra-aulas-seleccion-nivel-curso.R`.

## Bitácora

- 4 nov: deploy manual revivido, cinco renders de Quarto revividos, launcher con su bloque real y guardián de
  `skip_on_cran`.
- 4 nov: corregida la premisa de `NOT_CRAN`; extractor de PDF del QA de publicación; test vacío del libro de aulas;
  hojas-ruta-engine vuelve al CI; guardián ampliado a `skip_on_ci` y a los skips por `CI`; inventario de
  herramientas para Gonzalo.
