# GOAL · Gráficos crece con verdad metodológica y una UI cada vez más decidible

Tipo: GOAL loop de producto, motor y experiencia
Estado: En curso
Fecha: 2026-08-08
Autoridad: sucede al goal histórico de bibliotecas; no reabre ni reescribe su evidencia

Este loop amplía el catálogo con nuevos tipos de gráfico y mejora continuamente
la UI de Gráficos. El mandato operativo es permanente: cada lote cerrado abre un
recenso con una vara más alta; agotar la cola no termina el goal, obliga a medir
de nuevo.

Fuentes que gobiernan el trabajo:

- `docs/qa/goal-loop-popovers-graficos-2026-08-07.md`: antecedente histórico
  cerrado (L1–L7, V1–V8 y evidencia visual).
- `docs/qa/roadmap-motor-graficos-2026-08-08.md`: deuda y candidatos del motor.
- ADR 0063/0064: declaración y equivalencias multibase.
- ADR 0068: autoridad geométrica de layouts; sólo entra si cambia esa frontera.
- `branding/identity.json`, `branding/direccion-creativa-v3.md` y
  `docs/ui-layout-grammar.md`: identidad y gramática visual vigentes.

## Mandato y límites permanentes

1. Un gráfico nuevo debe cerrar el recorrido motor → registry → editor → preview
   real → PPT/Word/job → pruebas. Visible no significa entregado.
2. La UI falla cerrada: requisito desconocido o insatisfecho nunca se anuncia
   como “Listo para insertar”.
3. Las decisiones metodológicas se declaran; no se deducen por conveniencia de
   render. Si falta autoridad, la decisión entra en la bandeja con recomendación
   conservadora y el loop avanza por otro lote seguro.
4. Cada iteración hace un cambio causal acotado, conserva compatibilidad de
   proyectos y termina con QA independiente y `verificador` serial.
5. `editor-v2.css` permanece congelado. CSS de una capacidad nueva nace en hoja
   propia o en la hoja dueña ya existente cuando el cambio sea estrictamente
   local a esa superficie.
6. Cada lote actualiza este ledger y produce un commit conventional en español.
7. El goal no se marca completo al cerrar un lote. Se recensa catálogo, motor,
   UI y evidencia y se toma el primer lote pendiente.
8. El distribuidor dinámico `ChartLayoutEditor` —«Mapa de espacios»— se
   conserva y entra en el loop como superficie de producto. Debe editar los
   args efectivos publicados por metadata/preset y aproximar con mayor
   fidelidad el render R, sin convertirse en un segundo motor geométrico ni
   sustituirse por coordenadas manuales. Su CSS nuevo vive en hoja propia.

## La vara G1–G8

1. **G1 · Utilidad antes que variedad.** Cada tipo responde una pregunta que el
   catálogo no resuelve con igual claridad; no se aceptan duplicados decorativos.
2. **G2 · Verdad del contrato.** Nombre, forma, requisitos, defaults, presets y
   disponibilidad derivan de una fuente canónica y coinciden en todos los
   consumidores.
3. **G3 · Autoría completa.** Todo tipo insertable puede construirse desde la UI
   sin JSON manual; si sólo nace de un generador, se declara y se encamina allí.
4. **G4 · Método explícito.** Unidad, denominador, población, ponderación,
   intervalo y comparación quedan declarados y probados cuando apliquen.
5. **G5 · Decidibilidad de la UI.** La miniatura explica la forma; la descripción
   explica cuándo usarla; el estado explica qué falta y ofrece un próximo paso.
6. **G6 · Paridad de salida.** Preview real, PPT, Word y jobs consumen el mismo
   elemento; una ruta genérica sin prueba vertical no acredita paridad.
7. **G7 · Compatibilidad y propiedad.** Altas aditivas no mutan `.pulso` ni
   cambian la autoridad de equivalencias/layouts sin decisión o ADR explícito.
8. **G8 · Evidencia observable.** Antes/después en 1440×1000 y 1024×600,
   proyecto canónico y panel abierto; tests de contrato, composición y export;
   verde significa conformidad literal, no ausencia de errores.

La gramática visual heredada V1–V8 y las cláusulas C1–C5 del Contrato de
Superficie siguen siendo obligatorias. El acento Processing sólo pertenece al
chrome; nunca codifica series de datos.

## Censo C0 · 2026-08-08

| Superficie | Estado medido | Brecha que abre el loop |
|---|---|---|
| Catálogo | 23 graficadores, 6 familias; 20 layouts | La ola 4 agregó cuatro tipos sin cerrar todo su recorrido de autoría/contrato |
| Dumbbell y Serie temporal | Motores y constructores presentes | Exigen `vars` nombradas pero el picker genérico crea `args={}` y las anuncia listas |
| Preview | Render real por PPT | El preflight sólo reconoce `var/vars` y bloquea falsamente territorio/dimensiones |
| Presets | Backend declara 23 familias aplicables/expresas | El mapa TS omite categóricas, nube, histograma y los cuatro tipos nuevos |
| Iconos | Blueprints de 23 | El icono compacto degrada cuatro tipos nuevos y varios IDs Lucide a fallback |
| Contrato frontend | Histórico 20 slides / 19 graficadores | No existe un censo sucesor que gobierne los 23 actuales |
| Export | Routing genérico por `.graf_names()` | La ola 4 no tiene gate vertical por tipo y el test no exige export público real |
| UI real | V1/V4/V5/V6/V7/V8 conformes | En `acnur_acg` monobase, Dumbbell/Serie dicen “Listo para insertar” (G2/G3/G5) |

Baseline reproducible:

- HEAD inicial: `b290a2a3`.
- Frontend: typecheck verde; 42 archivos / 250 tests verdes.
- R focal: 787 expectativas, cero fallos.
- BEFORE: acta externa de sesión `D1-BEFORE-AUDIT.md`, SHA-256
  `713e1ddcb3498f622588c4ac450f08fcc9f60f58e5d792120333f16abcfea844`.
- AFTER candidato de G2-L0: acta externa de sesión
  `G2-L0-QA-AFTER.md`, SHA-256
  `6d42d227e768b294ddef3c3057e776f5fa14aa8a2232dcd07d3640ed6149047f`
  y probe funcional final SHA-256
  `78704d34713f383be160d2c1dad6d4a1aa8799e692023b653037183fbab4fcdd`.
  Addendum post-shim SHA-256
  `ee0fc6adabc13ac8619ec40acee490e8a0afce7b9ed3d64a41f879aa23a6cc81`
  y reporte dual-view SHA-256
  `47d060301117b224a19d47e77139fa7d6550563d1d99b16879015db8b0e7d807`.
- BEFORE causal de G2-L0.1: acta externa `G2-L0.1-QA-BEFORE.md`,
  SHA-256 `efa69d15da0401e45153878607b09a44b9fbb5282c996fc380ec6bd952e26c8b`,
  y reporte dirigido SHA-256
  `38472e8f03d999b44a47a561e49899086d27e26bbf2491312c61271a51e98427`.
- AFTER causal de G2-L0.1: acta externa `G2-L0.1-QA-AFTER.md`,
  SHA-256 `f69b58784affe92741cc4d5e2a67846792bc6cf112fc0cb43c368f370c7fdb2a`,
  reporte dirigido SHA-256
  `c3de5d9de01c6774efc9dd34bfbefc952dd69160d133c3564c9b7fece7b286a7`
  y manifiesto de las 24 capturas SHA-256
  `efd23f003c4f41a6c8703b5647bbd0212742dd47e1b5048add2e1e3c35432a4d`.
- Scope lock de G2-L1: `prosecnur-graficos-g2-l1-scope-lock.md`, SHA-256
  `8e9afbcd87075d616ac0960dcfcddafa32060529d84cd2d37b2531e9081daa46`.
- Scope lock del copy de familia de G2-L1:
  `prosecnur-graficos-g2-l1-family-copy-scope-lock.md`, SHA-256
  `2ec76bb9df0fb5287eae15306c0cbd458c9fa0d02691bec9aac562b60c02cf4b`.
- BEFORE de G2-L1: acta externa `G2-L1-QA-BEFORE.md`, SHA-256
  `d821de4b82ba70263ba4d3b4cb97d396cbb6d30563d3fe4d6a4fd15b4df1467e`;
  evidencia estructurada SHA-256
  `6ed428ea22870efc0b7b9b6afa6fe05cafe90cd145284ce940d0fb1bf5e47bf5`,
  reporte del runner SHA-256
  `60ff022e148251feff7b568b4f9178ffd5a02e8a55111696873f1aea783461ea`
  y manifiesto de cuatro capturas SHA-256
  `7d76e5a2fbdf91894281c951675755ec2d142210f0dfd8e63a8efbbe6ad20657`.
- AFTER de G2-L1: acta externa `G2-L1-QA-AFTER.md`, SHA-256
  `88fc923256390871d3265d311f44e0880b8599b9b057d9a09676ca593c6b84e0`;
  reporte del runner dual-view SHA-256
  `b4e7a31fc06152ca49e03e89cd3b3c36da86ef6fa9b4dbe342bb4ca4efef9a35`,
  flujo real de autoría y preview SHA-256
  `56d6a3e4eb914d563be18a2b2b0e3015f0640713c0db23bbea4c8a02c5201bfa`,
  inventario dirigido SHA-256
  `0905bce67de39cf46fda10282bc01666f3ec4ab4654ac98246fe63ecd206e375`
  y manifiesto íntegro SHA-256
  `368fc2cc5c91bc26ba50cb4c83c8b2a324c27f7b250757bdb421e583a70286ab`.

## Cola viva de lotes

| Lote | Alcance | Vara | Estado |
|---|---|---|---|
| **G2-L0 · Verdad operativa post-ola 4** | Contrato machine-readable, fail-closed de autoría/capacidad, preview por requisito real, args/aliases, presets, iconos y censo 20/23 | G2, G3, G5–G8 | **cerrado · I0–I4 · `feat(graficos): cerrar contrato operativo del catálogo`** |
| **G2-L0.1 · Guardas metodológicas de la ola 4** | Verificar y cerrar escala común de divergentes, elegibilidad/denominador de lollipop, firma/peso de Dumbbell y orden temporal acreditado | G2–G4, G6–G8 | **cerrado · I5–I11 · `fix(graficos): cerrar guardas metodológicas de la ola 4`** |
| **G2-L1 · Puntos comparativos v1** | Una base, indicadores/códigos declarados por grupo, punto + N, sin línea/IC/significancia ni selección múltiple | G1–G8 | **cerrado · I12–I17 · `feat(graficos): incorporar puntos comparativos`** |
| **G2-L1.5 · Distribuidor dinámico profesional** | Preservar `ChartLayoutEditor`/«Mapa de espacios»; recenso de familias, unidades, ratios, mínimos, densidad, fidelidad control→render R/PPT y acabado visual antes de una mejora causal | G2, G5–G8 | **pendiente prioritario tras G2-L1 · mandato de Gonzalo** |
| **G2-L2 · Heatmap de cruce v1** | `select_one × select_one`, normalización por columna, N visible y S/D para base cero | G1–G8 | pendiente · segundo tipo seguro |
| **G2-L3 · Respuesta múltiple con denominador declarado** | Casos/menciones visibles, elección explícita y guard de grano | G1–G8 | pendiente de ratificación de D3 |
| **G2-L4 · Intervalos de confianza** | Congelar varianza, ponderación y diseño; motor + editor + salida vertical | G1–G8 | bloqueado metodológicamente por D2; no detiene el loop |
| **G2-L5 · Coroplético de resultados** | Marco geográfico, datos territoriales reales y verificación visual | G1–G8 | pendiente de fixture territorial real |
| **G2-L6 · Deuda visual/motor** | Recenso A4/A5, el «1 error» heredado del onboarding con 0 slides y nuevas fricciones de UI; un defecto causal por iteración | G2, G5–G8 | pendiente |
| **G2-LR · Recenso recurrente** | Repetir catálogo→motor→UI→outputs, elevar vara y añadir lotes | G1–G8 | recurrente; nunca se agota |

## Gate por lote

- Scope lock y dirección/contrato congelados antes de escribir producto.
- Ownership exacto, máximo dos writers, sin globs solapados.
- Baseline focal antes y después; `git diff --check`.
- Contrato React↔R y compatibilidad revisados independientemente.
- Si cambia lo que el gráfico afirma: revisión metodológica independiente.
- QA real BEFORE/AFTER a 1440×1000 y 1024×600, mismo proyecto y estado.
- `verificador` serial después de integrar las revisiones.
- Ledger + registro de iteración actualizados y commit conventional en español.

## Ledger de cobertura

| Criterio | Evidencia acumulada | Estado |
|---|---|---|
| G1 utilidad | Dictamen G2-D1: puntos comparativos descriptivos primero; heatmap de cruce segundo | verde para cola L1–L2 |
| G2 contrato | Registry 24/24 publica `var_cruces_corte`; constructor, preset y fail-closed React↔R reauditorados con P0/P1/P2 = 0 | verde |
| G3 autoría | Autoría real desde slot: indicador, grupo y corte; vacío y duplicado bloqueados, combinación válida restituida en ambos viewports | verde |
| G4 método | D9 acreditada: porcentaje ponderado, `n` crudo, peso/filtros, exclusiones, escala, orden, 2–12 grupos y denominador cero fail-closed | verde |
| G5 UI | Tipo 24 abre Comparación, blueprint `#002457` de puntos independientes, `n =`, copy directo, contadores 24/5 y tercera fila alcanzable | verde |
| G6 salida | El mismo elemento atraviesa reconstrucción, PPTX/DOCX, jobs y preview PPT real 200 a 1440×1000 y 1024×600 | verde |
| G7 compatibilidad | Alta aditiva, firmas/defaults posicionales idénticos a HEAD; sin bump `.pulso`, ADR, dispatcher ni CSS congelado | verde |
| G8 evidencia | BEFORE/AFTER con hashes y manifiestos íntegros; 1.651 expectativas R, frontend 44/44 archivos y 281/281 tests, typecheck forzado cero | verde |

## Registro de iteraciones

- **I0 · 2026-08-08 · Arranque y G2-L0** — Se preservó el goal histórico como
  cerrado y se constituyó este sucesor. Tres carriles read-only censaron catálogo,
  contratos y UI real. Primer causal: el registry mezcla requisito técnico con
  prosa y permite insertar dos constructores que necesitan `vars` nombradas que
  el editor no puede producir. Dirección congelada: «Instrumento sereno»,
  geometría estable, explicación honesta y sin color de marca dentro de los
  datos. El scope lock de sesión se identifica como
  `prosecnur-graficos-g2-l0-scope-lock.md`. La revisión metodológica
  independiente fijó el orden seguro `p_puntos_comparativos` descriptivo →
  `p_heatmap_cruce`; ambos conservan numerador, denominador, peso y grano, y
  excluyen inferencia/SM en v1. El mismo dictamen abrió G2-L0.1: antes del tipo
  24 hay que acreditar que la ola 4 actual no mezcla escalas, pesos, temporalidad
  ni normalización de menciones bajo una apariencia descriptiva.

- **I1 · 2026-08-08 · Contrato operativo 20/23** — El registry R agregó de
  forma aditiva `capability_key`, `requirement_label`, `authoring_mode`,
  `data_requirement` y `preset_key`; el wire se normaliza como `unknown` y el
  frontend falla cerrado. Dumbbell y Serie temporal quedaron
  `generated + named_vars`; dimensiones y territorio dejaron de heredar el
  falso requisito `var`. El preset del registry gobierna formulario, slot,
  preview y panel de estilo; el mapa TS queda como fallback. Se promovieron los
  controles antes descartados de divergentes, lollipop y serie; los aliases de
  umbral se normalizan antes del whitelist. El censo sucesor fija 20 slides / 23
  graficadores y ocho iconos/blueprints dejan de degradar a fallback.

- **I2 · 2026-08-08 · Rechazo causal y reparación metodológica** — La primera
  revisión rechazó el lote: excluir «Negativa» reindexaba Neutral como negativa,
  una ref vaciada podía omitirse y el copy prometía una matriz/generador que no
  existe. Las regresiones fallaron antes de la reparación. El plan ahora fija la
  escala original antes de excluir, valida escala común y ambos lados por ref,
  recalcula el denominador después del filtro y pasa un `reparto` semántico
  aditivo al motor. Frecuencia ausente y vaciado son errores distintos que
  nombran la ref. El contraejemplo conserva Neutral y acredita saldo `+37.5 pp`.
  Registry, picker y preflight dicen literalmente que se requiere un plan
  compatible preexistente y que la biblioteca aún no puede crearlo/completarlo.
  La segunda revisión metodológica aprobó: P0=0, P1=0; las deudas restantes
  siguen acotadas a G2-L0.1.

- **I3 · 2026-08-08 · Compatibilidad y candidato de cierre** — El guardián de
  contratos encontró un P1 adicional: tres formals nuevos se habían intercalado
  en constructores exportados. Se movieron a la cola y se añadieron llamadas
  posicionales reales; el recheck acredita `PREFIX_NAMES=TRUE` y
  `PREFIX_DEFAULTS=TRUE`, P0=0/P1=0/P2=0. La curación pre-commit detectó que los
  iconos nuevos evitaban el shim obligatorio; una regresión falló 1/7 antes de
  mover los cuatro exports a `src/vendor/lucide-react.ts`. El registry ya tiene
  una sola fuente vendor y los ocho IDs conservan su SVG. Gate integrado:
  frontend typecheck 0 y 43 archivos / 274 tests; R focal 1,349 expectativas
  verdes (747 metadata, 88
  ola 4, 54 serie y 460 argumentos UI). Las tres advertencias tidyselect de
  argumentos UI y las advertencias de fuente Arial en composición nacen en
  líneas históricas no tocadas. QA AFTER independiente: 8 PASS / 0 FAIL / 0
  DEBT / 0 INVALID, 0 errores de consola/página/API/recurso y 0 requests
  fallidos en 1440×1000 y 1024×600. El addendum post-shim acredita 16/16
  firmas SVG idénticas, los dos estados fail-closed y cero errores en ambos
  viewports. Actas y probes: hashes registrados en C0.
  `editor-v2.css` permanece intacto, SHA-256
  `aed5548e28d8008d8458d51f409487d7b4892d35daa4223492193130daf6bb7f`.
  El primer gate serial rechazó exclusivamente la gobernanza del ledger nuevo;
  el producto, el contrato y la evidencia visual permanecieron verdes.

- **I4 · 2026-08-08 · Gobernanza documental y cierre de G2-L0** — El rechazo
  documental se reparó por causal: `docs/README.md` enlaza el ledger; la cabecera
  usa `Estado: En curso` y `Fecha: 2026-08-08`; la evidencia vigente conserva
  nombres lógicos y SHA-256 sin rutas efímeras. El gate documental pasó de 13 a
  10 errores: `CANDIDATE_ERRORS=0`; nueve pertenecen a archivos tracked intactos
  respecto a HEAD y uno al prompt untracked explícitamente excluido. El
  `verificador` repitió el gate desde cero y emitió **APPROVED, P0=0/P1=0**:
  `git diff --check` 0, typecheck 0, Gráficos 43/43 archivos y 274/274 tests,
  contrato/iconos 19/19, R focal 105 tests y 1.349 expectativas, cuatro probes
  `jq -e` verdaderos y QA 16/16 en ambos viewports. G2-L0 queda cerrado con el
  commit conventional registrado en la cola; el goal continúa en G2-L0.1.

- **I5 · 2026-08-08 · Censo causal y contrato de G2-L0.1** — Tres revisiones
  read-only separaron método y superficie de export. El baseline focal seguía
  verde, pero contraejemplos literales demostraron tres falsos verdes: un 90 %
  ponderado se estimaba como 50 %; una selección múltiple con 8 menciones A y 8
  B sobre 10 casos se normalizaba como 50/50 en vez de conservar 80/80; y dos
  escalas con igual código y etiquetas semánticamente distintas se aceptaban.
  El dictamen metodológico añadió orden de polaridad no declarado, filtros
  guardados pero ignorados, grano `repeat` no gobernado, temas/periodos
  incompletos descartados y errores de referencia tragados. El guardián de
  contratos encontró además divergencia G6: los jobs califican refs históricas
  con la base activa y `/api/graficos/preview-slide` no. Se congeló el scope
  `prosecnur-graficos-g2-l01-scope-lock.md`: firma E1 exacta, peso/filtro por
  fuente, sólo grano plano independiente, orden y matrices completas,
  divergentes con dirección explícita, Lollipop v1 sólo `select_one`, `top_n`
  visual con nota y preview con la misma calificación canónica que export. La
  siguiente iteración debe empezar por regresiones RED; aún no hay producto
  modificado en este lote.

- **I6 · 2026-08-08 · Regresiones RED de método y vertical** — Un autor de
  regresiones con ownership exclusivo creó dos suites nuevas y sólo actualizó
  las expectativas históricas autorizadas de firma/copy. La suite metodológica
  cargó en 3,7 s y falló por el contrato ausente: `.radar_mb_pct` no acepta
  pesos, `.radar_mb_datos` no acepta filtros, el caso 9/1 devuelve 50 % en vez
  de 90 %, y E1, selección múltiple, `repeat`, tipo desconocido, refs/cortes
  incompatibles, matrices incompletas y dirección inversa no fallan como deben.
  La vertical cargó en 5,0 s y llegó a cuatro `ggplot` reales: Dumbbell produjo
  −50 pp en vez de +50 pp al ignorar el filtro, Serie 83,3/33,3 en vez de
  50/100, Lollipop dejó el caption `NULL` y preview conservó `p1` donde el job
  usa `docentes$p1`. Ambos comandos terminaron el runner sin error de carga y
  reportaron exclusivamente expectativas rojas causales; `git diff --check`
  quedó limpio. Queda habilitada la ola del único writer backend.

- **I7 · 2026-08-08 · BEFORE visual dirigido de G2-L0.1** — QA independiente
  abrió el proyecto canónico `acnur_acg` y el panel real direccionable de la
  biblioteca en 1440×1000 y 1024×600. Ocho celdas conservaron geometría estable
  pero fallaron contenido: Barras/Lollipop aparecen listas sin dirección,
  elegibilidad ni denominador; `Opciones a ocultar` sigue en el registry y el
  inspector sólo muestra cuatro decisiones; Dumbbell/Serie mantienen el
  fail-closed `Requiere plan compatible`, pero dicen «respuestas válidas» sin
  peso, grano, firma, referencia/comparación u orden temporal acreditado.
  Veredicto: visual 8/8 PASS, contenido 0/8 PASS; C1–C4 verdes, C5 rojo; G2/G5
  rojos y G8 verde. Cero errores de consola, página, API, red, overflow, scroll
  jail o geometría. Los hashes del acta y reporte quedaron registrados en C0.

- **I8 · 2026-08-08 · Implementación candidata y borde asimétrico** — El único
  writer backend reutilizó los helpers canónicos de peso, filtros, firma E1 y
  grano; añadió las colas internas compatibles `pesos`, `filtros` y
  `direccion_escala`, además del argumento público final `direccion_escala`.
  Dumbbell fija primera fuente como referencia,
  segunda como comparación y matriz completa; Serie exige secuencia o
  permutación completa; Lollipop falla fuera de `select_one` plano, conserva un
  `Total` sustantivo y declara `top_n` en el pie; preview califica refs por el
  mismo helper de los jobs. Durante la integración, el swap inicial de lados
  falló un nuevo contraejemplo de cuatro niveles: con `n_negativas=1` producía
  tres niveles negativos. Una micro-regresión RED fijó 3 vs 1 sin alterar el
  orden visible; el reparto pasó a derivarse sobre la escala invertida y quedó
  verde. Gate repetido por el lead: 119 tests y 1.094 expectativas verdes en
  seis suites (64 metodología, 8 vertical, 126 radar, 88 ola 4, 54 temporal y
  754 metadata). Única advertencia ambiental: `testthat` fue construido bajo R
  4.5.2. `editor-v2.css` sigue intacto con el SHA congelado de I3. El candidato
  pasa ahora a revisión metodológica, contractual y QA AFTER independientes.

- **I9 · 2026-08-08 · Rechazo independiente y reparación causal** — La primera
  revisión metodológica post-candidato rechazó dos P1: el adaptador sólo veía
  una columna literal `peso` e ignoraba `attr(data, "var_peso")`; y Serie
  validaba el formal, pero un `orden_periodos` inválido podía entrar después por
  preset u override. Un autor independiente añadió tres regresiones que dejaron
  cinco fallos causales: 50/2 en vez de 90/10, override duplicado o ajeno y
  preset duplicado aceptados. El mismo writer backend reparó sólo dos archivos:
  el adaptador local honra la columna de peso pública con fallback canónico, y
  el orden efectivo se fusiona y valida antes del cálculo, usando el mismo
  vector en matriz y gráfico. La reauditoría ejecutó los contraejemplos
  literales y aprobó **P0=0/P1=0/P2=0**; D5–D8 siguen conformes y D3 permanece
  deuda explícita. Gate del lead: las seis suites focales suman 1.105
  expectativas verdes y las tres suites de refs/jobs/args otras 100; el
  comparador de preview terminó verde con su warning ambiental conocido de
  timeout del render headless y fallback, y typecheck terminó en cero.

- **I10 · 2026-08-08 · QA AFTER y rechecks independientes** — QA abrió la
  biblioteca real en `acnur_acg` a 1440×1000 y 1024×600 y comparó las mismas
  ocho celdas del BEFORE. Resultado: 8/8 PASS visual, 8/8 PASS de contenido y
  8/8 combinadas, C1–C5, V1–V8 y G2/G5/G8 conformes, sin errores de consola,
  página, requests, respuestas HTTP, geometría ni scroll jail. Barras muestra
  `Dirección de la escala`; Lollipop, `Excluir del denominador`; y
  Dumbbell/Serie conservan `Requiere plan compatible` mientras declaran
  selección plana, peso/filtros, E1 y referencia/orden. Los hashes de acta,
  reporte y manifiesto de 24 capturas están en C0; el fixture y el status del
  producto quedaron idénticos pre/post. El guardián contractual rechecó el
  candidato post-I9: **COMPATIBLE, P0=0/P1=0/P2=0**, prefijos/defaults públicos
  estables, tres colas internas compatibles, paridad preview/jobs, persistencia
  intacta y sin necesidad de ADR o migración. Frontend repitió typecheck cero y
  43/43 archivos con 274/274 tests. `editor-v2.css` conserva el SHA congelado.
  El lote pasa ahora, y sólo ahora, al `verificador` serial.

- **I11 · 2026-08-08 · Gate serial y cierre de G2-L0.1** — El `verificador`
  ejecutó el candidato ya integrado y emitió **APPROVED, P0=0/P1=0/P2=0**.
  Acreditó ownership exacto de 11 paths, tres paths del usuario excluidos,
  staging vacío y `git diff --check` cero; 1.105 expectativas en seis suites R,
  100 en refs/jobs/args y 56 en preview/export, todas verdes. El único warning
  del comparador es el timeout conocido del renderer primario con fallback
  exitoso. Typecheck terminó en cero y Gráficos pasó 43/43 archivos y 274/274
  tests; AST confirmó firmas, prefijos/defaults y tres colas internas
  compatibles. `shasum -c` verificó el acta y las 24 capturas, el fixture
  `.pulso` quedó idéntico y el CSS congelado conserva su hash. La stopping rule
  queda satisfecha y el commit conventional registrado en la cola cierra este
  lote. El goal permanece activo y toma inmediatamente G2-L1.

- **I12 · 2026-08-08 · Censo, método y BEFORE de G2-L1** — Tres carriles
  read-only congelaron arquitectura, estimando y dirección visual antes de
  escribir producto. El tipo 24 será `p_puntos_comparativos`: una sola base,
  `var` y `cruces` `select_one` planas e independientes, uno o más códigos
  objetivo y 2–12 grupos observados. El porcentaje usa el peso efectivo; `n`
  cuenta filas válidas crudas con peso positivo y jamás reutiliza la frecuencia
  ponderada. Filtros y exclusiones actúan antes del denominador, un grupo con
  base cero falla cerrado y el orden proviene del instrumento salvo permutación
  completa explícita. La gramática usa un punto uniforme por grupo, eje 0–100 y
  ningún tallo, segmento, IC, significancia o ranking implícito. El contrato
  operativo nuevo es `var_cruces_corte`, simétrico en React y R; no requiere
  CSS, migración `.pulso`, nuevo ADR ni editar el dispatcher PPT congelado. QA
  real en `acnur_acg` acreditó 2/2 viewports, cero errores/overflow/jail y fijó
  el orden AFTER `Puntos comparativos → Brecha → Serie → Radar → Tabla`, los
  contadores 24/5 y la tercera fila alcanzable a 1024×600. El scope lock y los
  hashes BEFORE constan en C0. La oleada siguiente comienza con regresiones RED
  bajo ownership exclusivo de tests.

- **I13 · 2026-08-08 · Regresiones RED de G2-L1** — Un autor independiente
  con ownership exclusivo de tests fijó firma pública, corte multicode,
  estimando 9/1 frente a 1/1 con el mismo `n` crudo, filtros, exclusiones,
  código 99 explícito, corte trivial, denominador cero, peso, grano, fuente,
  cardinalidad y orden. La suite metodológica cargó y produjo un único fallo
  causal por constructor ausente, con cinco bloques subordinados skipped. La
  vertical reconstruye el mismo plan y lo encamina a workers PPTX/DOCX en un
  directorio temporal; falla antes de exportar porque el graficador no está
  registrado. El registry R mide 23 frente a 24. En frontend, 31 expectativas
  pasan y cinco fallan por `comparison-dots`/`var_cruces_corte` desconocidos,
  preset nulo, preflight permisivo y blueprint ausente. El blueprint esperado
  fija cuatro puntos, marca `n =` y cero conectores. Typecheck permanece verde,
  el test histórico de refs conserva 11 expectativas y `git diff --check` es
  cero. La implementación puede comenzar con dos writers de producto y globs
  R/React no solapados.

- **I14 · 2026-08-08 · Candidato GREEN y copy verdadero de familia** — Dos
  writers no solapados integraron el motor R y el contrato React. El backend
  añadió estimador, graficador, constructor, renderer dinámico, registry 24/24,
  preset, preflight por `var_cruces_corte` y exports sin tocar el dispatcher
  PPT congelado. Peso declarado, filtros, escala, códigos, exclusiones, grano,
  cardinalidad, orden y denominador fallan cerrados; cada grupo conserva un
  punto azul `#002457`, porcentaje y `n` crudo sobre eje 0–100. La nota
  metodológica no puede ser reemplazada y cualquier nota de usuario se anexa.
  React reconoce el requisito, acepta corte multicode, normaliza
  `comparison-dots` y dibuja cuatro puntos con `n =`, sin conectores y sin usar
  Processing como dato. El QA BEFORE encontró además que `Series y tablas`
  quedaba falso: una micro-regresión falló 1/7 y un único cambio lo dejó en
  `Grupos, series y tablas`, 7/7 verde. El gate del lead instaló el candidato en
  una biblioteca R temporal —sin tocar la instalación del usuario— y acreditó
  950 expectativas en método, vertical, metadata, refs, borradores y jobs;
  PPTX/DOCX reales suman 12. Frontend pasó 44/44 archivos y 277/277 tests,
  typecheck cero y `git diff --check` cero. El CSS congelado conserva su hash.
  El candidato pasa ahora a método, contratos y QA AFTER independientes.

- **I15 · 2026-08-08 · Revisión adversarial y segundo GREEN de G2-L1** — La
  revisión independiente rechazó el primer candidato con divergencias
  falsables. Un peso almacenado como factor se convertía a los códigos internos
  de R: etiquetas `9/1` producían 66,7 % en vez de 90 % y una etiqueta `-1`
  evadía la guarda. React, a su vez, anunciaba listo un corte con blancos o
  duplicados post-`trim` y permitía que indicador y agrupación fueran la misma
  referencia, mientras R fallaba cerrado. El blueprint declaraba los puntos
  con `--pulso-primary`, token que el frame de Gráficos redefine al teal de
  Procesamiento pese a que D9 exige tinta de datos `#002457`. El copy de
  exclusiones nombraba además un solape con «el indicador» cuando la frontera
  real son los códigos objetivo del corte. Un typecheck forzado encontró además
  que el primer narrowing releía propiedades `unknown`, y el registry anunciaba
  `preset_key = puntos_comparativos` sin publicarlo en `/presets-metadata`, por
  lo que el formulario ocultaba sus overrides. Un autor independiente fijó los
  contraejemplos visuales y de preflight en RED; el contrato catálogo→preset se
  congeló con otro RED causal. El segundo GREEN parsea factores por sus
  etiquetas literales, conserva el rechazo de negativos, normaliza y exige
  códigos no vacíos/únicos, separa `var` de `cruces`, usa locales tipados, fija
  los cuatro puntos en `#002457`, corrige el copy y cataloga nueve formals reales
  del preset sin permitir reemplazar subtítulo ni nota metodológica. En proceso
  fresco contra una instalación temporal del candidato pasaron 1.651
  expectativas R —incluidas 86 metodológicas, 12 verticales reales, metadata,
  presets y argumentos UI—; frontend pasó 44/44 archivos y 281/281 tests,
  `tsc -b --force` cero y `git diff --check` limpio. Las reauditorías
  metodológica y contractual cerraron GO con P0/P1/P2 = 0. El CSS congelado
  conserva su SHA-256; el AFTER dual-view permanece como gate abierto.

- **I16 · 2026-08-08 · AFTER real y cierre de QA de G2-L1** — QA visual
  independiente abrió el catálogo y el editor sobre una copia aislada de
  `acnur_acg`, sin editar producto. El runner y el inventario pasaron 2/2
  viewports: catálogo 24, familia Comparación 5, orden
  `Puntos comparativos → Brecha → Serie → Radar → Tabla`, hint
  `Grupos, series y tablas`, blueprint con cuatro puntos `#002457` y `n =`,
  sin conectores ni uso del teal Processing como tinta de datos. El flujo real
  creó slide y slot, insertó el tipo 24 desde Datos, bloqueó el estado vacío,
  configuró `A1_leg × E2_sex` con corte `4 = De acuerdo`, obtuvo preview PPT
  real 200 mediante `artifact-tool`, expandió nueve argumentos de preset,
  persistió `size_punto` de 4,2 a 4,8, bloqueó un corte duplicado y restauró el
  estado válido también a 1024×600. No hubo errores de consola, página,
  request o HTTP, ni overflow, scroll jail o geometría inválida. La aserción
  cruda `defaultsPublished=false` se descartó porque preguntaba por una entrada
  monolítica inexistente en `/presets-defaults`: el contrato público vive en
  `/presets-metadata` y sus defaults por argumento sí coinciden con el renderer.
  Acta, reportes, capturas y manifiesto pasaron `shasum -a 256 -c`; los puertos
  5174/8788 quedaron sin listeners. QA cierra APROBADO con P0/P1/P2 = 0 y el
  lote pasa al `verificador` serial.

- **I17 · 2026-08-08 · Gate serial y cierre de G2-L1** — El `verificador`
  independiente cerró COMPLETE/GO con P0/P1/P2 = 0. En proceso fresco contra
  la instalación temporal del candidato repitió los 11 archivos contratados:
  166 tests, 1.651 expectativas, cero fallos, errores o skips; las 12
  expectativas verticales ejercitaron PPTX y DOCX reales. Frontend repitió
  44/44 archivos y 281/281 tests, y `tsc -b --force` salió cero. La firma
  pública conserva nueve formals exactos; registry, blueprint, categoría,
  requisito, modo de autoría y preset coinciden, y los nueve argumentos del
  preset no exponen subtítulo ni nota metodológica. El scope contiene 21/21
  candidatos, excluye 3/3 paths del usuario, no incluye sorpresas y mantiene el
  staging vacío antes del cierre. `git diff --check` salió cero, el CSS
  congelado conserva SHA-256
  `aed5548e28d8008d8458d51f409487d7b4892d35daa4223492193130daf6bb7f`,
  el dispatcher PPT no tiene diff y BEFORE/AFTER validan todos sus manifiestos.
  Un barrido suplementario ajeno al set contratado observó sólo un skip
  ambiental por ausencia de `{callr}`; no afecta el gate y la repetición exacta
  contratada terminó sin skips. G2-L1 cumple G1–G8 y se cierra con commit
  conventional; el goal global sigue activo y toma inmediatamente G2-L1.5.

## Bandeja de decisiones

| ID | Decisión | Recomendación y supuesto conservador | Estado |
|---|---|---|---|
| D1 | ¿Dumbbell/Serie se editan manualmente o sólo nacen de equivalencias? | Mantener `generated` y fail-closed en picker hasta diseñar un editor tema→refs por base con E1 y orden temporal acreditado | asumido para G2-L0; decisión de producto pendiente |
| D2 | Método de IC (B5) | Rechazar el alcance general: Wilson 95% sólo es recomendación para proporción plana no ponderada; falta ratificar método ponderado/repeat, alcance y simultaneidad | pendiente de Gonzalo; B5 queda fuera sin detener otros lotes |
| D3 | Denominador múltiple (B7) | Recomendar `casos_validos`: unidad con ≥1 código elegible declarado; casos y menciones siempre rotulados y seleccionados explícitamente | pendiente de ratificación; supuesto conservador = no implementar todavía |
| D4 | Primer tipo descriptivo tras L0 | `p_puntos_comparativos` v1: una base, punto + N por grupo, indicador explícito, sin líneas/IC/significancia/SM; después `p_heatmap_cruce` por columna | resuelto por revisión independiente |
| D5 | Dirección semántica de la escala divergente | Añadir `direccion_escala` de cola; default compatible `negativo_positivo`, alternativa `positivo_negativo`; los ítems invertidos se recodifican antes del gráfico | congelado para G2-L0.1 |
| D6 | Peso, filtros, grano y firma multibase | Aplicar peso/filtro por fuente; exigir plano independiente y firma E1 código+etiqueta idéntica; `repeat`, desconocido, ref ausente o corte fuera de escala fallan cerrados | congelado para G2-L0.1 |
| D7 | Elegibilidad de Lollipop antes de resolver D3 | V1 sólo `select_one` plano; exclusión cambia denominador, `top_n` sólo visibilidad y debe notificar truncamiento; selección múltiple/repeat no se normalizan | congelado para G2-L0.1; D3 sigue pendiente |
| D8 | Orden de Dumbbell y Serie temporal | Dumbbell usa primera fuente como referencia y segunda como comparación; Serie exige orden completo acreditado; tema o periodo incompleto falla en vez de desaparecer o puentearse | congelado para G2-L0.1 |
| D9 | Estimando y gramática de puntos comparativos v1 | Una base, indicador `select_one` + códigos objetivo, corte `select_one`, peso efectivo y filtros estrictos; porcentaje ponderado con `n` crudo visible, orden del instrumento, 2–12 grupos, eje 0–100 y puntos sin conectores/IC/significancia/SM | congelado para G2-L1 por revisión metodológica independiente |
| D10 | Frontera del distribuidor dinámico de espacios | Conservar `ChartLayoutEditor` como control de los args efectivos; metadata/presets fijan nombres, unidades, defaults y límites, y el render R/PPT es el oracle visual. React puede mostrar y editar la distribución, pero no inventar semántica ni una geometría alternativa. La matriz de placeholders de slide de ADR 0068 permanece separada e intacta | resuelto por mandato de Gonzalo · gobierna G2-L1.5 |
