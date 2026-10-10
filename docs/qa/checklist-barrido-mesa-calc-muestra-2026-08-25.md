# Barrido de la mesa de Cálculo de muestra contra el Contrato de Superficie

Tipo: Barrido QA contra el Contrato de Superficie
Estado: En curso
Fecha: 2026-08-25
Autoridad: Encargo de Gonzalo. Evidencia de QA; no reemplaza un ADR

**Encargo de Gonzalo, 2026-08-25**: «haz el barrido completo de la mesa».

## Por qué existe este documento

En una sola sesión Gonzalo encontró **cuatro defectos de la misma familia**,
uno tras otro, mirando la pantalla mientras trabajaba:

| lo que vio | qué afirmaba la superficie | qué pasaba de verdad |
|---|---|---|
| «cupo de reserva 15» | «la mitad de los titulares» (=90) | un fijo de 1 por facultad que no consume nadie |
| aviso rojo de decisión caducada | «la decisión cambió desde esta corrida» | ya estaba reconfirmada y el cálculo hecho |
| «No existe un marco vigente» | ausencia de marco | el marco existía; la vista estaba cargando |
| «Paso 1 · Paso 2 · Paso 3» | que hay tres pasos con contenido | los kickers sin su contenido debajo |

Los cuatro son **la superficie hablando antes de saber**: declara, promete o
niega sin haber comprobado. Sus palabras: «me preocupa que tengas que seguir
este tipo de correcciones tan absurdas». Tiene razón, y el problema de fondo no
son los cuatro defectos: es que los encuentre él, de a uno, en el orden en que
le estorban. Este barrido busca la clase entera de una vez.

## Cómo se mide

- **C1–C4** con `scripts/ui-quick-check.mjs --require-geometry`, matriz
  `1440×1000` y `1024×600`, sobre el `.pulso` real reparado
  (`sim/hsvg2026_reparado.pulso`, marco `260edb37ff26`, 179 aulas).
- **C5 exige juicio** y se hace leyendo cada superficie: ¿entrega lo que su
  rótulo promete? Todo vacío se clasifica en las tres categorías del contrato
  (legítimo / por fixture / por desconexión). **Sólo la 3 autoriza añadir.**
- **Verde por conformidad, no por ausencia**: se reportan tres números
  —conformes / no conformes / **no declaradas**—, nunca uno.

## Superficies de la mesa

18 direcciones canónicas, todas bajo `calc-muestra/opinion-universitaria`:

**30 superficies**, todas bajo `calc-muestra/opinion-universitaria`. Ojo con los
nombres: la top bar rotula «Selección» y «Entrega», pero sus claves canónicas son
`aulas` y `salidas`. Pedirle al runner `.../seleccion` falla con
«no existe en el manifiesto»; la lista de arriba sale del propio manifiesto.

| Sección (rótulo · clave) | Pestañas |
|---|---|
| **Datos** · `definicion` | def-estudio · def-bases · def-consistencia · def-variables · def-explorador · def-historico |
| **Marco** · `marco` | marco-criterios-alumno · marco-alumnos-ch · marco-ch-radiografia · marco-poblacion · marco-aulas · marco-cobertura |
| **Cálculo** · `calculo` | calculo-diseno · calculo-propuestas · calculo-ch-facultad · calculo-distribucion |
| **Selección** · `aulas` | objetivo · metodo · laboratorio · seleccion · solidez · perfil · reemplazos · aulas-relato · auditoria |
| **Entrega** · `salidas` | salidas-coincidencia · salidas-guia · salidas-resultados · salidas-entregables · salidas-monitoreo |

## Tablero

Se dibuja entero cada vez que se mencione. Un contador oculta justo lo que el
checklist existe para hacer visible.

**Cobertura: 6 de 30 medidas · 5 con reporte · 1 sin reporte.** No se resume en
un número de conformes: una superficie sin reporte no es una superficie conforme.

| # | Superficie | Cláusula | Hallazgo | Estado |
|---|---|---|---|---|
| B1 | Datos › Estudio | C1–C4 | 2 grupos declarados, 0 no declaradas, sin drift ni scroll jail en 1440×1000 y 1024×600 | ✅ conforme |
| B2 | Datos › Fuentes | C1–C4 | ídem | ✅ conforme |
| B3 | Datos › Consistencia | C1–C4 | ídem | ✅ conforme |
| B4 | Datos › Consistencia | **C5 · rótulo** | **Doble encabezado**: el panel dice «Consistencia · llaves entre estudiante y curso-horario» y debajo repite «Consistencia entre fuentes · Comprueba que la relación estudiante–curso-horario conserve sus llaves». El segundo parafrasea al primero (regla de la casa: no sobreexplicar) | ⬜ por reparar |
| B5 | Datos › Variables | C1–C4 | 4 grupos declarados, 0 no declaradas | ✅ conforme |
| B6 | Datos › Explorador | — | **SIN REPORTE**: el runner abortó con «No hay puente de navegación (window.__pulsoNav)». Fallo de entorno, no de la superficie; **no cuenta como conforme** | 🔁 remedir |
| B7 | Datos › Histórico | C1–C4 | sin hallazgos | ✅ conforme |
| B8 | Datos › Estudio (mapa del recorrido) | **C5 · rótulo** | El pin dice **«Estás aquí»** y señala «Seleccionar cursos-horario» mientras el usuario está en Datos › Estudio. El comportamiento es deliberado —marca la primera etapa PENDIENTE (`DefEstudioTab.tsx:99`)— pero la palabra promete ubicación y entrega otra cosa | ⬜ por reparar (rótulo) |

| B9 | Marco › Población | **C1 · readiness** | `MarcoPoblacionTab.tsx` **no declara `data-audit-ready`**: el runner corta con `sin-marca-de-readiness` incluso midiéndola sola. Nadie —ni el QA ni la app— puede saber si terminó de montar | ⬜ por reparar |
| B10 | Marco › Cursos-horario | **C1 · readiness** | ídem en `MarcoAulasTab.tsx`. (Ojo: `CursosHorarioMarcoTab.tsx:847` sí declara, pero es otro componente) | ⬜ por reparar |
| B11 | Cálculo › Cursos-horario requeridos | **C5 cat. 3 · desconexión** | «No existe un marco vigente que acredite este resultado» se mostraba con `aulasState: null`, que significa «aún no pregunté», no «no hay». La señal `aulasStateChecked` YA existe en `CalcMuestraPage.tsx:1093` y no llegaba a la superficie | ✅ reparado |

| B13 | Selección › Reemplazos | C5 | **CONFORME y bien resuelto**: declara «Ruta ilustrativa, todavía no operativa», dice que la cadena real aparece sólo con selección acreditada, y los tres bloques en «pendiente» explican qué son. Incluso enuncia el modelo correcto: «no son una bolsa suelta: pertenecen a una titular específica». Vacío legítimo (cat. 1) contenido dentro de su caja | ✅ |
| B14 | Selección › Reemplazos | — | La ruta ilustrativa dibuja **R5.1 … R5.11, once escalones**. NO es defecto de la superficie: `depth={config.bolsas_reemplazo}` (AulasReemplazosTab.tsx:225) es fiel a la config. El 11 frente a los 2–4 del documento es asunto de **A3**, no del barrido | ↗️ a A3 |

| B15 | Selección › Titulares | C5 | **CONFORME**: explica que se llena al haber selección y muestra los 4 pasos de preparación con datos reales (2.471 CH · 2.500 entrevistas · método · 179 titulares). El paso 2 dice «2.500 entrevistas — el cálculo fija cuánto se necesita representar»: dimensiona contra la MUESTRA, no la sobremuestra de 3.750, que es la regla de Gonzalo | ✅ |

| B16 | Selección › Perfil de la muestra | **C1 · readiness** | El estado vacío declaraba **`data-audit-ready="false"`**. Un vacío es un estado TERMINAL, no una carga: decía «no he terminado» de una vista terminada, el gate no la medía y el puente la daba por no lista. Mismo precedente que Analítica, ya sellado en `auditReadyRoutes.contract.test.ts` | ✅ reparado |
| — | Selección › Perfil de la muestra | C3 | **DESCARTADO tras mirar el CSS**: parecía que el panel estiraba el vacío ~400 px, pero `.cmv2-perfil-vacio` es `min-height: 240px` y no estira; el alto lo pone el panel de sección, que tiene frontera visible — capacidad legítima, no hueco sin dueño. Lectura apresurada de la captura | ❌ falso |

## 🔬 LA CAUSA REAL DE LOS `sin-marca-de-readiness`, y las tres hipótesis falsas

Esto costó la mayor parte del barrido y es lo más reutilizable que salió de él.

**La causa**: `CalcMuestraPage.tsx` devolvía, mientras el store se hidrataba, un
`<LoadingBlock label="Cargando mesa de muestra..." />` **sin marca alguna**. Ese
estado no es el BootGate (hay proyecto) ni la pantalla de warm start (otro
selector), así que `estadoListo()` no encontraba `[data-audit-ready]` y devolvía
`sin-marca-de-readiness` — un mensaje que se lee como «esta pestaña no declara
readiness» y **acusa a la vista que se intentaba medir**.

**La prueba**: al declarar ese estado con `data-audit-ready="false"`, el mismo
runner sobre la misma dirección pasó de `sin-marca-de-readiness` a
**`marca-en-false`**. El mensaje dejó de acusar a la pestaña y pasó a decir la
verdad: la mesa afirma que todavía no está lista.

**Y el resto del fallo es TIEMPO, no defecto**: el runner espera 30 s
(`UI_QA_TIMEOUT_MS`) y un `.pulso` real de ~12 MB tarda más en hidratar. Para
barrer un proyecto de este tamaño hay que pasar `--timeout-ms 90000`.

### Las tres hipótesis que resultaron falsas — no las repitas

| # | Hipótesis | Cómo se refutó |
|---|---|---|
| 1 | «Las pestañas no declaran readiness» | `calculo-diseno` **siguió fallando** después de añadirle `data-audit-ready` |
| 2 | «Es sólo contención de CPU» | Cierta pero parcial: explicaba los rojos que bailaban, no los `ROJO 3/3` |
| 3 | «Es el BootGate» | Se le añadió `data-boot-gate` y un motivo propio en el puente; el runner **siguió diciendo `sin-marca-de-readiness`**, no `sin-proyecto-abierto` |

Las reparaciones que salieron de 1 y 3 **se conservan** —declarar readiness en una
pestaña raíz y distinguir el BootGate son correctas por contrato— pero ninguna
era la causa, y venderlas como tal habría dejado el defecto vivo.

**Nota sobre el BootGate**: se marcó con `data-boot-gate`, NO con
`data-audit-ready`. Declararlo listo haría que el QA capturara esa pantalla
creyendo que es la pestaña pedida: cambiar un rojo honesto por un verde falso.

### ⚠️ TODOS los `sin-marca-de-readiness` de esta corrida son RUIDO, no defectos

**Medido, no supuesto.** La misma dirección (`aulas/objetivo`) corrida tres veces
seguidas dio **pasa · falla · pasa**, con un worker de R al **101 % de CPU** por
el cálculo de certeza corriendo en paralelo. El puente agota su espera de
readiness cuando la máquina está saturada, y el runner lo reporta como si la
superficie no declarara nada.

Lo que lo delató antes de medirlo: `aulas/metodo` y `aulas/laboratorio` **pasan**
sin declarar readiness propia, y `aulas/objetivo` **falla** en idéntica
condición. Una misma causa no da dos resultados.

Y el clavo final: `calculo-diseno` **volvió a fallar después** de añadirle
`data-audit-ready`. La declaración no era la causa.

**Consecuencia**: las superficies marcadas `sin-marca-de-readiness` en la corrida
`barrido3` quedan **NO MEDIDAS**, no «no conformes». Hay que rehacer el barrido
con la máquina en reposo. No las cuentes como conformes tampoco: no se
comprobaron.

**Lección de método**: un barrido visual compite por CPU con cualquier job pesado
del backend. Antes de correrlo, comprobar que no haya workers de R al 100 %
(`ps aux | grep "[R] --no-echo"`), o los rojos que salgan serán del reloj, no
del código.

**Y el corolario, que costó una segunda tanda contaminada**: cada invocación de
`ui-quick-check --project` levanta SU PROPIA pila (API de R + Vite). Dos
invocaciones a la vez se saturan entre ellas. Al re-medir hay que hacerlo **en
serie**, nunca lanzando una repetición de control mientras el barrido corre —
que es exactamente el error que se cometió aquí y volvió a teñir de rojo
`marco-poblacion` y `marco-aulas` incluso después de declararles readiness.

### Falsos hallazgos descartados, para que nadie los reabra

- **«El runner no alcanza readiness en `def-estudio`»**: pasó en la corrida que
  encadenaba 30 direcciones seguidas; corriendo la superficie sola da readiness
  `['calc-muestra-motor','calc-muestra']` sin problema. Era del encadenamiento,
  no de la pestaña.
- **«El pin Estás aquí está mal calculado»**: está bien calculado; lo que falla
  es cómo se llama.

## Ya cerrados antes de abrir el barrido

| # | Superficie | Cláusula | Hallazgo | Commit |
|---|---|---|---|---|
| P1 | Cálculo › Cursos-horario requeridos | C5 | «cupo de reserva» prometía la mitad de los titulares y entregaba un fijo de 1 que no consumía nadie | `ba1564e3` |
| P2 | Mesa (mensaje global) | C5 | el aviso de caducidad sobrevivía a su propia reparación | `796bdeca` |

## Deuda declarada, no reparada aquí

- `tokensDefinidos.contract` en rojo por 4 tokens huérfanos en
  `monitoreo/profiles/aulas/aulasMonitoreo.css` (commit `8f977230`, ajeno).
- `CalcMuestraPage.tsx` está **+34 líneas sobre su línea base** de archivo
  congelado por commits anteriores; el audit del agentic OS falla por eso.
