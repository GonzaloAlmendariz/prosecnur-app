# Formato sistemático en Cálculo de muestra y Gráficos — 2 nov 2026 (noche)

Doc vivo. Encargo de coordinación para la noche del 2 al 3 de noviembre, con el pedido de Gonzalo:
«no es solo un pequeño ajuste, es un tema sistemático que debe solucionarse» y «Formato en Cálculo y Gráficos».

Método: el de Material de campo (`docs/qa/revamp-material-de-campo-construccion-2026-11-02.md`, sección
«Causas compartidas»). Cada patrón P1–P9 se mide en su fuente, se arregla ahí, un patrón por commit, y queda con
un guard que sólo deja bajar el conteo.

Alcance de escritura: `frontend/src/features/calcMuestra/` y `frontend/src/features/graficos/` (sólo la UI de la
app: nunca `api/R/graficador_*` ni `reporte_*`). Lo que pida `components/` o `lib/` se pide a coordinación.

## Medición inicial (2 nov 2026, 23 h)

Script reproducible: cuenta sin comentarios, excluye tests. «Zona» es la carpeta; en Cálculo,
`universidad/*` es el modo `opinion-universitaria` (cursos-horario), `general/` sirve a `marco-disponible`,
`acreditacion` y `territorial-handoff` (MesaGeneral, MesaAcreditacion, TerritorialHandoff), y `(raíz)`,
`didactica/` y `motor/` son compartidos (página, selector de tipo, didáctica del método).

### Cálculo de muestra (77 hojas, 385 fuentes)

| zona | P1 px | P1 rol | P2 cajas css | P2 h2–h4 | P3 · código | P3 · total | P4 `.length}` | P4 `toFixed` | P5 vacío propio (tsx) | P5 clases css | P5 espera a mano | P6 chip/estado | P8 `<code>` | P8 mono css |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| (raíz) | 126 | 0 | 39 | 4 | 6 | 13 | 4 | 1 | 2 | 17 | 0 | 7 | 0 | 0 |
| didactica | 35 | 0 | 19 | 0 | 24 | 34 | 1 | 4 | 1 | 1 | 0 | 1 | 0 | 6 |
| general | 83 | 4 | 13 | 28 | 56 | 87 | 3 | 2 | 8 | 3 | 3 | 5 | 11 | 6 |
| motor | 21 | 3 | 3 | 1 | 19 | 27 | 0 | 0 | 1 | 3 | 0 | 2 | 0 | 0 |
| universidad/(raíz) | 34 | 0 | 12 | 0 | 4 | 10 | 0 | 0 | 0 | 10 | 0 | 0 | 0 | 6 |
| universidad/aulas | 155 | 7 | 46 | 11 | 83 | 127 | 13 | 44 | 16 | 9 | 0 | 6 | 3 | 7 |
| universidad/calculo | 126 | 11 | 42 | 11 | 42 | 62 | 4 | 26 | 6 | 9 | 0 | 10 | 2 | 0 |
| universidad/criterios | 125 | 7 | 32 | 2 | 36 | 131 | 8 | 9 | 11 | 12 | 0 | 6 | 1 | 0 |
| universidad/definicion | 182 | 6 | 50 | 18 | 48 | 95 | 10 | 9 | 9 | 5 | 0 | 8 | 2 | 2 |
| universidad/marco | 196 | 16 | 51 | 14 | 77 | 222 | 19 | 2 | 25 | 24 | 0 | 10 | 0 | 3 |
| universidad/salidas | 51 | 1 | 11 | 4 | 7 | 11 | 2 | 0 | 6 | 10 | 1 | 7 | 0 | 3 |
| universidad/shared + ui | 49 | 2 | 10 | 0 | 4 | 14 | 1 | 1 | 0 | 0 | 0 | 1 | 1 | 5 |
| dominio + hooks | 0 | 0 | 0 | 0 | 5 | 12 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| **total** | **1,183** | 57 | 328 | 93 | **411** | 845 | 65 | 100 | **85** | 103 | 4 | 63 | 20 | 38 |

Tamaños de letra en px: 276 de 11, 217 de 10, 183 de 12, 143 de 11.5, 118 de 10.5, 77 de 13, 32 de 14, 30 de 12.5 y
una cola de 15 a 21 (y seis de 9 px, bajo el piso de 10). El kit de vacíos ya se usa a medias: 29 `EmptyState`,
4 `LoadingBlock`, pero 85 vacíos con clase propia (`cmv2-classroom-empty`, `cmv2-crit-empty`, `cmv2-crc-*-empty`,
`cmv2-descriptive-empty-state`…) y 4 esperas escritas a mano. De los 845 « · », 434 están en comentarios; los 411
de código son el blanco real de P3.

### Gráficos (51 hojas, 367 fuentes)

| zona | P1 px | P1 `fontSize` inline | P2 cajas css | P2 h2–h4 | P3 · código | P4 `.length}` | P5 vacío propio | P5 clases css | P5 espera a mano | P6 chip/estado | P8 `<code>` | P8 mono css |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| (raíz) | 50 | 69 | 7 | 12 | 25 | 43 | 11 | 4 | 7 | 20 | 7 | 0 |
| v2 (estilos del workbench) | 699 | 0 | 292 | 5 | 0 | 4 | 4 | 110 | 0 | 0 | 0 | 56 |
| laminas | 141 | 0 | 45 | 22 | 4 | 25 | 15 | 12 | 3 | 13 | 0 | 0 |
| estilo | 74 | 0 | 19 | 13 | 0 | 7 | 4 | 5 | 2 | 8 | 0 | 0 |
| estiloInforme | 35 | 0 | 7 | 4 | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| vistaGeneral | 27 | 0 | 8 | 2 | 0 | 8 | 6 | 5 | 0 | 0 | 0 | 0 |
| resto (word, indice, multiapiladas, compartir…) | 68 | 0 | 23 | 15 | 9 | 7 | 1 | 1 | 1 | 8 | 1 | 0 |
| **total** | **1,094** | **69** | 401 | 73 | 38 | 95 | 41 | 137 | 13 | 50 | 8 | 56 |

`font-size` por rol en Gráficos: 0. Más 69 `fontSize` en estilos en línea de JSX (casi todos en `ArgField.tsx`).

## Patrones, fuente y guard

| # | Patrón | Fuente en Cálculo / Gráficos | Arreglo | Guard | Estado |
|---|---|---|---|---|---|
| P5 | Vacíos y cargas a mano | Cálculo: 18 clases propias de vacío de bloque (27 sitios) y 4 esperas sueltas; la fuente eran `ClassroomEmptyState` y `DescriptiveEmptyNotice`. Gráficos: 13 esperas escritas a mano y 15 vacíos con clase propia | Vacío de bloque por `EstadoVacio`; espera por `LoadingBlock`. Las dos primitivas locales de Cálculo envuelven `EstadoVacio`; se borran sus reglas CSS | `calcMuestra/` y `graficos/vaciosYCargasDelKit.contract.test.ts`, meta 0 | **hecho** — `74cea55a9`, `6b041df24` |
| P1 | Letra en px | 1,165 y 1,094 declaraciones | Regla de Material: ≥18 kpi; 15–17 title; 12–14.5 subtitle (seminegrita) o body; 10.6–11.5 eyebrow (mayúsculas) o caption; ≤10.5 micro | `features/calcMuestra` y `features/graficos` en `MODULOS` de `letraPorRol`. Cálculo en meta 0; Gráficos con 9 excepciones que dibujan el medio (planos `blueprint`, muestra de leyenda, métricas de 6 px en los marcos miniatura) | **hecho** — `1e4739397`, `aecedbc9c` |
| P4 | Cifras sin miles o con formateador propio | Cálculo: `fmtInt` local más dos copias, `enumerar` propio y 20 `toLocaleString`. Gráficos: conteos de variables crudos y un `toLocaleString("es")` con coma decimal en Medidas del estándar | `fmtInt` delega en `lib/formatoNumero`; decimales con `formatoDecimal` y los mismos dígitos (ninguna cifra cambia de valor) | `cifrasDelFormateador.contract.test.ts` en los dos: `toLocaleString` suelto, `.replace(".", ",")` y `{x.length}` crudo en meta 0 (Cálculo declara dos que no se muestran: una clave y un grid CSS) | **hecho** — `f727e832c`, `0296c711f`; coma decimal (23 `toFixed(n).replace(".", ",")`) en `34ed84890`, con guard |
| P3 | Punto medio como separador | Cálculo: 348 líneas, 38 de ellas `join(" · ")`. Gráficos: 38 líneas | Lista con coma o `lib/enumerar`; avisos con punto y coma; precisión entre paréntesis | `puntoMedio.contract.test.ts`: Gráficos en meta 0 salvo 8 líneas que leen el formato del backend («… · E_X»); Cálculo con `join(" · ")` en meta 0 y ratchet por archivo | **hecho** — Gráficos `84a0b8f98`; Cálculo `e9c25e1e3`, `70ad50374`, `bdc01dd6e`: de 107 archivos a 12, los que quedan son fórmulas (`p·(1−p)`, `memoriaLatex`) o el corpus de referencia |
| P2 | Cajas propias en vez de `Panel` | 326 / 401 reglas con borde, radio y padding; 0 `Panel` en ambos | Cabecera de bloque por `components/Panel`, cifras por `CifrasEnTarjeta`, avance por `BarraDeAvance` | `cajasPropias.contract.test.ts` en los dos, ratchet por hoja (`f7d95f96c`) | **línea base** — Entrega (8 bloques) ya es `Panel` (`5eb4cedc9`); el resto baja con cada vista que pase al kit |
| P6 | Estado mezclado con acción | 63 / 45 clases de chip o estado | `EstadoChip` del kit (llegó la noche del 2 nov, `00281fc94`) | `calcMuestra/estadoChip.contract.test.ts`: ratchet de `cmv2-pill-soft` (13 → 8; las que quedan son notas) | **hecho** — Cálculo `def1386b9` (Propuestas, Ficha ejecutiva, Entregables, Variables; filete entre estado y botón), Gráficos `67c254efc` (Colores de respuestas). El «GUARDADO» en mayúsculas de la cabecera de Gráficos lo pinta `components/SaveStatusIndicator`: kit, queda para su dueño |
| P5b | Carga de bloque sin marca de readiness | 3 en Cálculo, 13 en Gráficos | `CargaDeBloque` del kit (`651a38e23`) | los dos `vaciosYCargasDelKit` exigen que ninguna `LoadingBlock` en línea quede fuera | **hecho** — `c931243e1` |
| P8 | Monoespaciada para metadatos | 20 / 8 `<code>`, 38 / 56 reglas mono | Letra del sistema con cifras tabulares; el valor técnico en `title`. Monoespaciada sólo para columnas, variables, fórmulas y símbolos | `monoespaciada.contract.test.ts` en los dos, ratchet de `<code>` por archivo | **hecho** para `<code>` (`a591265b5`, y la línea de reproducibilidad de la Ficha en `05bda1e54`); reglas CSS mono pendientes |
| P1b | Letra en línea (JSX) | Gráficos: 68 `fontSize` numéricos | Misma regla que las hojas | `graficos/letraEnLinea.contract.test.ts`, meta 0 | **hecho** — `7919d9ab5` |

### Verificación de P5 + P1 + P4 + P3a en Cálculo (capturas)

HSVG2026 (copia de corrida), 49 vistas a 1280×720 y 1440×1000, antes en `tmp/visual-qa/calc/est-*` (worktree en HEAD
previo) y después en `desp1-*`. Las 49 capturas cambian (md5 distinto en todas). Agregados iguales salvo
`rotulosPartidos`: dos nuevos, ambos por el guion de «curso-horario» al subir de 12 a 13 px (tarjeta de variable en
Datos › Variables y nombre del archivo en Datos › Fuentes). Arreglados en `f936edc75` y `22cee538d`. `textosFuera` 0.

Hallazgo de método: con HSVG2026 los modos `marco-disponible` y `acreditacion` aterrizan mudos en la vista del
estudio (11 capturas byte a byte iguales). Para esos modos se usa otro `.pulso` (acreditación: el de las corridas de
Gráficos; muestra general: un proyecto vacío).

## Vistas de Cálculo, de la peor a la menos fea (estado con selección guardada, 1280×720)

Proyecto: `tmp/qa-campanas-0111/aulas.pulso` (selección corrida, propuesta sin calcular). Capturas antes en
`tmp/visual-qa/calc/uni-antes-*` y después en `rec-desp-*`.

| # | Vista | Qué estaba mal | Qué se hizo | Commit |
|---|---|---|---|---|
| 1 | Selección › Simulación (y las demás pestañas bloqueadas) | Un párrafo de aviso y un panel en blanco; prosa con «Se conserva 30 titulares, …, corrida sel_…» | Aviso de etapa con el recorrido Marco → Cálculo → Método → Selección → Reemplazos (hecho, falta, espera), la causa con su acción y lo que la pestaña entregará; el id de la corrida en su propia línea | `32a875b0e` |
| 2 | Entrega › Cierre (Ficha ejecutiva) | Cinco «pendiente» a 21 px; reproducibilidad en monoespaciada | `CifraMotor` (53 usos) pinta la ausencia como rótulo apagado; la línea de reproducibilidad en la letra del sistema | `05bda1e54` |
| 3 | Selección › Objetivo | Tres «pendiente» gigantes, «P1 · universidad», «engine» | Lo mismo por `CifraMotor`; «P1, universidad»; «motor» | `05bda1e54`, `831a1337f` |
| 4 | Cálculo › Propuestas sin calcular | Un vacío aplastado en una fila y el panel en blanco | `EstadoVacio` y las dos propuestas en esqueleto con su camino de etapas, sin adelantar cifras | `2e09f72ad` |
| 5 | Franja «Diseño vigente» (todas las vistas universitarias) | «Sin cifra todavía» en dos renglones; «· reconstruye»; «frame no verificable» | Una línea, lista con «y», «reconstrúyelo», «marco no verificable» | `2e9cb8c15` |
| 6 | Selección › Titulares sin selección | La nota de preparación repetía el recorrido | Se va la nota; quedan las cuatro cifras | `9e9398751` |
| 7 | Todas las pestañas (41) | El antetítulo decía «Cálculo de muestra», que ya está en el chip | Sección y posición: «Selección · pestaña 3 de 10» | `9d73f58cf` |
| 8 | Entrega › Entregables | Fuentes del sustento con nombres de campo entre comillas invertidas; «paso 3» | Lenguaje llano y el campo en `title`; «Cálculo › Propuestas» | `b3b9d4b56` |
| 9 | Títulos repetidos (P9) | Alumnos por CH, Pase a Monitoreo, Solidez y nueve antetítulos de Muestra general y Acreditación repetían su pestaña; «Falta seleccionar» dos veces en la banda | Títulos que dicen lo que contiene el bloque | `73cba84b2` y vecinos |

Pendiente conocido del encargo: Selección › Simulación «Falta comparar los métodos» con método elegido ya estaba
resuelto en `b17f9b193` (antes de esta noche); con la selección guardada sin objetivo, la causa es Cálculo y el
recorrido lo dice.

Límite de la medición: `marco-disponible` no tiene un `.pulso` de referencia; con HSVG2026 y con un proyecto vacío
la dirección aterriza muda en otra vista. Sus cambios (P3 en `general/`, P5, P1) quedan verificados por tests, no por
captura.

## Bitácora

- 23 h: medición inicial y doc.
- 23–00 h: P5, P1, P4 y P3 en los dos módulos, con sus guards; capturas antes y después de Cálculo.
- `lib/enumerar` y `lib/formatoNumero` ya existían (Material y Analítica): P3 y P4 dejaron de esperar.
- 23:30 h: `EstadoChip` y `CargaDeBloque` llegan al kit: P6 y P5b en los dos módulos.
- Hallazgos de paso: `toLocaleString("es")` con coma decimal en Medidas del estándar (Gráficos, `0296c711f`) y 23
  `toFixed(n).replace(".", ",")` en los dos módulos (`34ed84890`). Decisión reversible: las guías (cm) y la letra (pt)
  de Gráficos tenían la coma afirmada en un test; se siguió la convención de `lib/formatoNumero`.
- 06:40 h: Entrega pasa sus ocho bloques a `Panel` (`5eb4cedc9`). El pendiente de coordinación sobre `.cmg-metodos` y
  `.cmv2-aulas-modalidad` (indicadorDelKit) ya estaba saldado en `866036a52`, antes de esta noche.
- 00:15 h: capturas finales (`tmp/visual-qa/calc/final-*`, `gid-*`): Identidad de Gráficos `ok=true` a 1280 y 1440;
  sin rótulos partidos; Pase a Monitoreo con «Pendiente» apagado. Quedan dos hallazgos previos del Explorador que
  dependen de los datos anonimizados (deriva de 2.5 px en la fila de filtros y una etiqueta larga con line-clamp) y la
  cabecera fija del Panorama.
- 00:10 h: verificador independiente — **PASA CON OBSERVACIONES** (tsc limpio, gate Cálculo 310/3004, Gráficos
  268/2363, guards en verde, P4 sin cambio de valor). Observaciones atendidas: nombres `coma`/`coma1` que ya devolvían
  punto, rótulo «13,333 in» de un test, este doc. Higiene: `f727e832c` y `e9c25e1e3` arrastraron ~130 archivos de
  Monitoreo que su sesión tenía en el índice compartido (no se perdió nada; avisado a Monitoreo). Desde ahí, commits
  con `git commit -- <rutas>`.
- Hueco sin guard: los `toFixed(n)` que quedan no llevan separador de millares; hoy todos son tasas, márgenes o cm por
  debajo de 1,000.
