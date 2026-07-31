# Loop de bóvedas — dos grafos que se hablan

Prosecnur tiene hoy una bóveda Obsidian que describe la aplicación y un `docs/`
que describe por qué la aplicación es así. Ninguno de los dos sabe que el otro
existe, y ninguno se entera cuando la app cambia. Este loop los convierte en dos
grafos con una costura verificable, y deja un instrumento que mide la distancia
entre lo documentado y lo que corre.

| Campo | Valor |
|---|---|
| Versión | 1.0 |
| Fecha | 2026-07-31 |
| Estado | Iteraciones 1–5 aplicadas; instrumento en verde; cierre humano pendiente |
| Alcance | Bóveda de producto (`Obsidian_Prosecnur/`), bóveda de sistema (`docs/`), la costura entre ambas, el sello de vigencia y el canvas como etapa de trabajo |
| Fuera de alcance | Reescribir el contenido de las 195 notas, publicar direcciones que la app todavía no publica, y mover ADRs a frontmatter |
| Cierra | Solo Gonzalo. El instrumento mide; no declara la convergencia |

## El defecto que corrige

La bóveda actual afirma `documentacion: completa` en 195 de 195 notas. Es una
afirmación sin verificador: nada la vuelve a poner en duda cuando la app cambia.
Entre el 28 y el 31 de julio se retiró Enciclopedia, se añadió la sección Canvas
a Bitácora y el módulo de fichas QR se convirtió en Recopiladores — y las 195
notas siguieron diciendo «completa».

El problema no es que la bóveda esté desactualizada. Es que **no tiene forma de
saberlo**. Marcar «completa» una nota genérica convierte una laguna conocida en
una laguna invisible; marcar «completa» una bóveda entera sin verificador
convierte la deriva en algo que solo se descubre leyendo.

Lo mismo del otro lado: de 16 skills, tres citan un ADR. De 13 agentes, seis
citan un documento. `docs/README.md` ya declara que `frontend/src/lib/modules.ts`
es la fuente única de navegación, pero nadie ejecuta esa norma contra nada.

## Las dos bóvedas

**Producto** — `Obsidian_Prosecnur/`. Qué hace cada pantalla, para quien usa la
app. Jerarquía del [ADR 0044](adrs/0044-jerarquia-y-direcciones-de-navegacion.md):
Prosecnur → Módulo → Modo → Sección → Pestaña. Ya existe, con 195 notas y una
plantilla que codifica sus reglas.

**Sistema** — `docs/`. Por qué la app es así y cómo se construye: ADRs,
arquitectura, normas de superficie, planes, evidencia de QA. Ya existe con 154
documentos y un orden de precedencia declarado. Le falta representar el agentic
OS: las 16 skills y los 13 agentes son hoy la única parte del sistema que no
tiene entrada en su propia documentación.

Son dos y no una porque responden preguntas distintas y caducan a ritmos
distintos. Producto caduca cuando cambia la UI; sistema caduca cuando cambia una
decisión. Fundirlas obligaría a revisar las dos con el ritmo de la más volátil.

Son dos y no cinco porque cada bóveda extra es una frontera más que mantener, y
la costura solo escala si hay pocas.

## La costura: la dirección canónica

Ambas bóvedas se unen por lo único que las dos ya nombran: **la dirección**
(`modulo/modo/seccion/pestana`), extraída del contrato vivo, no de prosa.

- Una nota de producto declara qué dirección documenta — con `ruta_app` cuando
  la app publica su ubicación, y con el campo nuevo `nodo:` cuando no.
- Un documento de sistema declara qué direcciones gobierna, en una sección
  `## Gobierna` con la lista en backticks.
- `scripts/vaults-check.mjs --generar` escribe `docs/sistema/direcciones/`: una
  nota por módulo con cada dirección, su sello, si está documentada y qué
  documento la gobierna. Es un adaptador generado, como `.codex/`, y no se edita
  a mano.

La sección `## Gobierna` va en prosa y no en frontmatter a propósito: los 154
documentos de `docs/` se escribieron sin frontmatter, y exigirlo para participar
del puente convertiría una mejora incremental en una migración.

## El sello: cómo «completa» se vuelve falsable

Cada nodo del contrato tiene un **sello** — el hash de su forma y la forma
completa de todos sus descendientes: identificadores, etiquetas visibles,
rutas, orden y publicación. Una nota que se declara `completa` debe llevar
`verificado_contra: <sello>`.

Cuando el nodo cambia en `modules.ts`, su sello cambia y todas las notas selladas
contra el valor anterior caducan solas. `completa` deja de ser una opinión
permanente y pasa a significar «alguien la revisó contra esta forma del contrato».

El sello no dice que la prosa sea buena — eso lo sigue juzgando una persona con
las reglas de la plantilla. Dice que la pantalla que describe todavía es esa.

## Los bocetos: el canvas como etapa, no como anexo

`Bocetos/` ya tiene un `.canvas` con ideas sueltas sobre Fuentes de Monitoreo.
Ese es el punto de entrada natural de una idea, y el loop lo reconoce como
primera etapa en vez de tratarlo como material aparte:

**boceto → decisión → contrato → pantalla → nota.** Un nodo del canvas puede
anclarse a una dirección real escribiendo `direccion:: monitoreo/acreditacion/fuentes`.
El instrumento verifica esas anclas, así que un boceto que apunta a una pantalla
que ya no existe se detecta como cualquier otra deriva. Cuando la idea madura, el
canvas es el borrador del ADR; el ADR declara su `## Gobierna`; el contrato crea
la dirección; la nota de producto la documenta y la sella.

## El ciclo

Cada iteración es **auditar → ejecutar → verificar**, y solo cierra cuando
Gonzalo lo dice.

1. **Auditar** — `make vaults-check`. La salida es la lista de deriva por código.
2. **Ejecutar** — se ataca una causa por iteración, no una lista de archivos.
   Cada código de hallazgo tiene un dueño distinto: unos se arreglan en la
   bóveda, otros en el contrato, otros en la app.
3. **Verificar** — se vuelve a correr y se compara el conteo contra la iteración
   anterior. Un código que baja a cero y vuelve a subir señala que la causa no
   era la que se creía.

Criterio de convergencia: `make vaults-check` en verde con `V3 = 0` y `V5 = 0`,
sostenido a través de un cambio de UI real. Verde por conformidad, no por
ausencia: una bóveda vacía también da cero.

## Iteración 0 — estado medido al 2026-07-31

`node scripts/vaults-check.mjs`, contra 85 nodos del contrato vivo, 195 notas de
producto, 154 de sistema y 1 boceto.

| Código | Qué señala | Conteo | Dónde se arregla |
|---|---|---:|---|
| V1 | Dirección que no resuelve | 8 | Bóveda: 7 notas sin `ruta_app` y 1 con el modo `aulas` renombrado |
| V1b | El contrato no llega a pestaña | 66 | Contrato: las pestañas de Monitoreo viven en las páginas de perfil |
| V3 | Nodo del contrato sin nota | 36 | Bóveda: Recopiladores 10, calc-muestra 18, Procesamiento 5, Bitácora 1 |
| V4 | Fuente citada que ya no existe | 6 | Bóveda: `sheets_api.R` y `AcreditacionEstadosLlamada.ts` |
| V5 | «completa» sin sello vigente | 49 | Bóveda: sellar tras revisar |
| V8 | Nota sin `nodo:` en módulo que no publica dirección | 71 | Bóveda hoy; app cuando cumpla el ADR 0044 |
| B1 | Puente roto | 0 | — |
| C1 | Boceto anclado a dirección inexistente | 0 | — |

`V5 = 49` cuenta solo las notas cuya dirección ya resuelve: las 71 de `V8` no
llegan a evaluarse. Al cerrar `V8` el conteo de `V5` sube antes de bajar, y eso
es señal de que la medición mejoró, no de que la bóveda empeoró.

Tres lecturas que el conteo hace visibles:

**V1b no es culpa de la bóveda.** Monitoreo documenta 66 pestañas que
`modules.ts` no declara: viven dentro de cada página de perfil y solo se publican
en tiempo de ejecución con `useRegistrarPestanasMonitoreo`. El contrato no llega
al nivel que la bóveda ya documenta. Se arregla en el contrato, no en las notas.

**V8 mide un incumplimiento del ADR 0044, no un descuido.** 71 notas colapsan
sobre tres direcciones de módulo — 33 dicen `/calc-muestra`, 10 `/recopiladores`,
5 `/tablero` — porque esos módulos nunca escriben `?seccion=`. El campo `nodo:`
lo resuelve del lado de la documentación; publicar la dirección lo resuelve de
verdad.

**El puente encontró deriva en su primer disparo.** `CLAUDE.md` y el
[ADR 0022](adrs/0022-monitoreo-perfiles-frontend-dinamicos.md) llaman
`cursos-horario` a un modo que el contrato sigue identificando como `aulas`.
Dos vocabularios para la misma pantalla, y ninguna de las dos fuentes se
contradecía a sí misma: hacía falta cruzarlas.

## Iteraciones propuestas

Cada una tiene una causa, un dueño y un criterio de salida medible.

**1 · Sellar la bóveda de producto contra el contrato.** Añadir `nodo:` donde la
URL no alcanza y `verificado_contra:` donde la nota se sostenga; degradar a
`parcial` lo que no se revise de verdad. Salida: `V5 = 0` y `V8 = 0`.
Decisión previa que solo Gonzalo puede tomar: **versionar o no la bóveda de
producto**. Hoy está en `.gitignore`, que es precisamente por qué derivó sin que
nadie lo viera. Sin versionarla, el chequeo no puede entrar al CI.

**2 · Extender el contrato al nivel de pestaña.** Un catálogo por perfil de
Monitoreo que el extractor pueda leer sin montar la página, y que las páginas
consuman en lugar de declarar sus pestañas inline. Salida: `V1b = 0` sin duplicar
catálogos. Riesgo conocido: ya hubo una copia desincronizada y por eso existe el
registro en runtime; el catálogo debe ser la fuente, no una segunda copia.

**3 · Reconciliar la estructura desviada.** Recopiladores (el módulo entero
todavía es «Fichas QR»), los modos de calc-muestra, las pestañas de Procesamiento
y la sección Canvas de Bitácora. Salida: `V3 = 0` y `V4 = 0`.

**4 · Representar el agentic OS en la bóveda de sistema.** Una nota por skill y
por agente, generadas desde `.claude/` y `agentic/manifest.json` — canónico más
adaptador generado, el mismo patrón que ya gobierna `.codex/`. Cada una declara
qué direcciones toca y qué rama de orquestación sirve. Salida: las 8 ramas de
`CLAUDE.md` navegables desde el grafo, y `--check` fallando si una skill aparece
sin entrada.

**5 · Cerrar el ciclo del boceto.** Llevar un boceto real del canvas hasta ADR,
contrato y nota, y comprobar que el instrumento acompaña cada salto. Si el ADR
precede al canvas, el ejemplo debe llamarse **validación retrospectiva** y no
puede presentarse como causal. Salida: un ejemplo completo documentado, no una
regla más.

## Ejecución del 2026-07-31

Gonzalo solicitó aplicar el plan y la bóveda de producto pasó a ser parte
versionada del repositorio; solo `.obsidian/` y `.DS_Store` permanecen locales.
El baseline se reprodujo antes de editar: 85 nodos, 195 notas de producto, 154
notas de sistema, 1 boceto y 170 hallazgos bloqueantes.

El estado integrado es:

| Medida | Resultado |
|---|---:|
| Nodos del contrato vivo | 201 |
| Notas de producto | 206 |
| Nodos con nota única | 201 de 201 |
| Notas de sistema | 192 |
| Entradas agentic | 29 (16 skills + 13 agentes) |
| Ramas agentic | 8 de 8 |
| Anclas canvas / promovidas | 1 / 1 |
| Hallazgos bloqueantes | 0 |

El contrato creció con 68 pestañas de Monitoreo, 24 de Cálculo de muestra, 20
nuevas de Procesamiento y 4 de Dashboard. Ocho nodos —las cuatro pestañas de
Validación y las cuatro de Dashboard— existen en el contrato pero declaran que
la aplicación todavía no publica su dirección; sus notas usan `nodo:` y el
recorrido de QA no inventa deep-links para ellas.

Las 195 afirmaciones iniciales de documentación completa se degradaron de forma
conservadora. El estado final contiene una sola nota `completa`, la del módulo
`recopiladores`, sellada contra la forma completa de su árbol; las demás
permanecen `parcial`. Cuatro notas retiradas conservan su prosa como
`historica: true`, sin tipo, padre ni tag estructural.

El ejemplo promovido es deliberadamente retrospectivo: el canvas lo declara de
forma literal y verifica ADR 0046 aceptado → contrato → pantalla → nota sellada,
sin afirmar que un boceto posterior haya causado la decisión. El primer
candidato, `monitoreo/acreditacion/fuentes`, volvió a `parcial` al comprobarse
que la pantalla vigente permite editar actores y canal telefónico desde
`monitoreo_profile.units`, en contradicción con el ADR 0045 aceptado. El loop no
oculta esa divergencia ni inventa una autoridad que la resuelva.

La compuerta `make vaults-check` queda en CI y falla por deriva. `make
vaults-audit` conserva el informe no bloqueante y `make vaults-index` regenera
el adaptador de direcciones. El criterio técnico de convergencia (`V3 = 0`,
`V5 = 0` y cero bloqueantes) se cumple; el cierre del loop continúa reservado a
Gonzalo. El checker exige además que `ruta_app` corresponda al `nodo:` o a uno
de sus ancestros publicados, que los sellos de contenedores incorporen la forma
de todos sus descendientes y que solo el sentinel exacto autorice sobrescribir
un adaptador generado.

## Enrutamiento agentic

El loop cae en la **rama 8 — Gobernar** de `CLAUDE.md`, con excursiones a la
rama 1 cuando toque el contrato. El reparto:

- Deriva estructural y decisiones de frontera → `guardian-contratos`.
- Cambios en `modules.ts` y en los catálogos de pestañas → `frontend-react`,
  con el contrato congelado antes de escribir.
- Significado de lo que una pantalla promete → `revisor-metodologico` y
  `/contrato-superficie` (la cláusula C1 es lo que una nota de producto
  debería estar copiando, no reinventando).
- Gate final → `verificador`, con el diff acotado: este loop toca documentación
  y un script, así que su gate es `vaults-check` más `check-docs-governance`, no
  la suite completa.

## Lo que este loop no hace

- No juzga si la prosa de una nota es buena. Eso lo siguen decidiendo las reglas
  de `Plantillas/Plantilla de nota.md` y una persona.
- No documenta bugs. Siguen viviendo en los planes fechados, que se mueven cada
  semana; meterlos en la bóveda la volvería obsoleta al ritmo de los fixes.
- No publica direcciones que la app no publica. `V8` mide esa deuda y la deja a
  la vista; cerrarla es trabajo del ADR 0044, no de la documentación.
- No declara la convergencia. El instrumento cuenta; el loop lo cierra Gonzalo.
