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
| P4 | Cifras sin miles o con formateador propio | Cálculo: `fmtInt` local más dos copias, `enumerar` propio y 20 `toLocaleString`. Gráficos: conteos de variables crudos y un `toLocaleString("es")` con coma decimal en Medidas del estándar | `fmtInt` delega en `lib/formatoNumero`; decimales con `formatoDecimal` y los mismos dígitos (ninguna cifra cambia de valor) | `cifrasDelFormateador.contract.test.ts` en los dos: `toLocaleString` suelto en meta 0 y `{x.length}` crudo como ratchet (39 en Cálculo, 66 en Gráficos) | **hecho** — `f727e832c`, `0296c711f` |
| P3 | Punto medio como separador | Cálculo: 348 líneas, 38 de ellas `join(" · ")`. Gráficos: 38 líneas | Lista con coma o `lib/enumerar`; avisos con punto y coma; precisión entre paréntesis | `puntoMedio.contract.test.ts`: Gráficos en meta 0 salvo 8 líneas que leen el formato del backend («… · E_X»); Cálculo con `join(" · ")` en meta 0 y ratchet de 310 líneas en 107 archivos | Gráficos **hecho** (`84a0b8f98`); Cálculo **en curso** (`e9c25e1e3`, baja con cada vista rediseñada) |
| P2 | Cajas propias en vez de `Panel` | 326 / 401 reglas con borde, radio y padding; 0 `Panel` en ambos | Cabecera de bloque por `components/Panel`, cifras por `CifrasEnTarjeta`, avance por `BarraDeAvance` | — | pendiente (va con las vistas rediseñadas) |
| P6 | Estado mezclado con acción | 63 / 45 clases de chip o estado | `EstadoChip` del kit | — | espera al kit (Material) |
| P8 | Monoespaciada para metadatos | 20 / 8 `<code>`, 38 / 56 reglas mono | Letra del sistema; el valor técnico en `title` | — | pendiente |

### Verificación de P5 + P1 + P4 + P3a en Cálculo (capturas)

HSVG2026 (copia de corrida), 49 vistas a 1280×720 y 1440×1000, antes en `tmp/visual-qa/calc/est-*` (worktree en HEAD
previo) y después en `desp1-*`. Las 49 capturas cambian (md5 distinto en todas). Agregados iguales salvo
`rotulosPartidos`: dos nuevos, ambos por el guion de «curso-horario» al subir de 12 a 13 px (tarjeta de variable en
Datos › Variables y nombre del archivo en Datos › Fuentes). Arreglados en `f936edc75` y `22cee538d`. `textosFuera` 0.

Hallazgo de método: con HSVG2026 los modos `marco-disponible` y `acreditacion` aterrizan mudos en la vista del
estudio (11 capturas byte a byte iguales). Para esos modos se usa otro `.pulso` (acreditación: el de las corridas de
Gráficos; muestra general: un proyecto vacío).

## Bitácora

- 23 h: medición inicial y doc.
- 23–00 h: P5, P1, P4 y P3 en los dos módulos, con sus guards; capturas antes y después de Cálculo.
- `lib/enumerar` y `lib/formatoNumero` ya existían (Material y Analítica): P3 y P4 dejaron de esperar.
