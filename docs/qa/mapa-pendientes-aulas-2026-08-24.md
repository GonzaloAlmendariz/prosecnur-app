# Mapa de lo pendiente — cursos-horario, 2026-08-24

Cierre del loop de mejora sobre **cálculo de muestra → procesamiento →
recopiladores (QR) → monitoreo**. Esto es el relevo: lo que queda, dónde vive y
qué está medido.

**Lo que NO es**: un plan de trabajo con fechas. El orden dentro de cada bloque
es de valor descendente, pero quién lo toma y cuándo es decisión de Gonzalo.

---

## 1. Decisiones que sólo puede tomar Gonzalo

Bloqueadas, no pendientes. Ninguna se puede resolver leyendo código.

| # | Decisión | Dónde vive | Qué pasa con cada respuesta |
|---|---|---|---|
| D1 | **La vara de aula válida no la declara ningún estudio.** `monitoreo_aulas_criterio_aula(cfg)` existe con `modo="esperado"` y tolerancia `alfa`, y **sí hay UI** (`AulasCriterioDeAula`, guarda con `apiMonitoreoAulasConfig`). Pero `cfg$aula_valida` viene vacío en el proyecto de referencia. | `api/R/monitoreo_aulas_criterio_aula.R` · `frontend/.../AulasCriterioDeAula.tsx` | **Default `esperado` cuando hay metas** → una línea en el normalizador de config. **Declaración explícita** → el panel tiene que avisar cuando falta, hoy calla. |
| D2 | **2.168 de 2.616 aulas tienen meta fraccionaria** (13,4 · 12,3 · 9,3…). Sale de `elegibles × tasa`, así que es correcta, pero no se pueden conseguir 0,4 encuestas. | `calc_muestra_aulas_efectividad.R` | **Redondear hacia arriba** sube el objetivo del estudio en **+1.112 respuestas**. **Dejarla fraccionaria** obliga a que toda pantalla que la muestre explique que es un valor esperado, no una cuota. |
| D3 | **¿El parte del libro debe mover el avance de Monitoreo?** Hoy son dos ejes separados a propósito: `operational_status` (lo escribe la app) y `partes_campo` (lo escribe el Excel). El avance sólo mira el primero. | `monitoreo_aulas_reconciliacion.R` | Si sí: un parte importado sube el avance sin que nadie registre en la app. Si no: queda como está y la UI ya lo declara. |
| D4 | **El bootstrap de Madow con asistencia real 2025 de Kamila es mejor que lo nuestro.** ¿Lo adoptamos? | `revision-kamila-21-08.md` §5 | Adoptarlo exige rehacer el dimensionamiento con su método y comparar contra el nuestro facultad por facultad. |

---

## 2. Revisión del trabajo de Kamila — entregada, sin enviar

`scratchpad/revision-kamila-21-08.md`, 454 líneas, **17 correcciones** con
ubicación y cifra. Los tres hallazgos graves están verificados a mano sobre sus
propios archivos:

- **La cuota de una facultad se llena con alumnos de otra.** 1.636 de 5.269
  cursos-horario aparecen con más de una FACULTAD en el catálogo y no hay regla
  declarada para resolverlo: `INT124-0305` figura como titular de Gastronomía
  siendo 9 filas de EE.GG. Letras contra 2. Son 15 de 190 titulares.
- **Tres cifras distintas de titulares**: el docx dice 196, su hoja 6 da **190**.
- **Dos criterios aplicados en bloque** (categoría docente y homogeneidad ≥80 %),
  que es exactamente la vara 3.

**Pendiente**: mandárselo —lo hace Gonzalo, no la app—, y si lo pide, confirmar
el recorte por facultad de esos dos criterios.

---

## 3. Producto — lo que queda del recorrido

| # | Pendiente | Estado | Dónde vive |
|---|---|---|---|
| P1 | **La hoja «Avance de campo» del libro no se ha mirado NUNCA** (hasta A13a, 2026-08-31, se llamaba «Cómo va el campo»). Es la única de las cuatro sin revisar campo por campo. | ☐ | `api/R/carga_aulas_libro*.R` · anatomía en `docs/qa/anatomia-excels-aulas-2026-08-16.md` |
| P2 | **El tile «BRECHAS 193 · en 15 facultades» de Consultas** probablemente repite el defecto ya reparado en cadenas: la brecha de un aula sin aplicar no es una brecha, es trabajo pendiente. | ☐ | `brechasKpi(dashboard)` en `kpisDeAulas.ts` |
| P3 | **Lista final de ajustes de la simulación** (paso 6): el cierre del ejercicio de las 193 aulas con datos de campo. | ☐ | este doc lo sustituye en parte |
| P4 | **El bundle de 2.616 fichas QR nunca se generó end-to-end.** Compilar funciona (2.616 páginas en 11,5 s); el render tiene que ir por `collection_material_render_job`, no por `collection_material_render_compiled`. | ☐ | `api/R/collection_materials.R` |

**Método que funciona para P1**, y es lo reutilizable: enumerar las columnas
declaradas (`grep "campo *=" api/R/carga_*.R`) y cruzar cada una contra **quién
la produce** (`pon("TÍTULO"` en `carga_aulas_libro_generar.R`) y **quién la
muestra** (grep en `frontend/src`, con nombres precisos — un grep de `label` o
`notes` da 11.510 falsos positivos). Cinco patrones ya confirmados: rótulo que
promete otra cosa que su contenido · columna duplicada de otra · campo que se lee
y nadie muestra · criterio que cuelga de columnas retiradas · **campo escrito que
no está en ningún grupo y por eso no se pinta**.

---

## 4. Rendimiento — el foco con el que se cerró el loop

Lo hecho: **la caché del dashboard de aulas** (`da0924b8`). Aulas era la única
familia que reconstruía su dashboard en cada request, y encima fuera del
`if (should_build_dashboard)`, así que se reconstruía **incluso cuando el
tablero general venía de caché**. Los 6 requests de una apertura pasan de
**21,5 s a 3,6 s**.

| # | Pendiente | Cifra medida | Riesgo |
|---|---|---|---|
| R1 | **Recortar el payload por `report_scope`.** `toJSON` del dashboard de aulas son **2,76 s y 11,9 MB** por request, dominados por `agenda` (2.616 elementos). Los 4 requests con `include_reports=1` lo pagan: **~11 s**. | 2,76 s · 11,9 MB | **Alto.** Exige saber qué sección necesita `agenda` de verdad: Validación lista las 700, y recortar de más vacía la pantalla. Verificar consumidor por consumidor. |
| R2 | **La representación del plan.** Como lista-de-listas pesa **47 MB**; el mismo plan como data.frame, **3 MB — 16× menos**. Y está duplicado: `monitoreo_aulas_plan` y `monitoreo_config$…$plan` son `identical`. El state entero son **230 MB**. | 47 MB vs 3 MB | **Muy alto.** Cambiar la representación toca todo el motor de aulas. `monitoreo_perf.R` unidad 3.3 ya hizo el transpose vectorizado en otros call sites: mirarlo antes. |
| R3 | **Las piezas de `monitoreo_perf.R` que aulas no usa.** `grep monitoreo_data_fingerprint\|\.mperf_` en `monitoreo_aulas*.R` da **cero**: fingerprint barato en vez de sha256 («la causa #1 de los congelamientos»), transpose vectorizado, caché de `monitoreo_variables()`, cap de payload. | — | Bajo por pieza. Empezar por el fingerprint. |
| R4 | **Territorial**, que Gonzalo señala como el más pesado. `monitoreo_territorial_cache.R` son 836+ líneas de caché propia. | **sin medir** | **Medir con un proyecto territorial antes de tocar.** No asumir que está mal por ser grande. |

### Lo que ya se descartó midiendo — no volver a mirarlo

- **La configuración SÍ sobrevive al `.pulso`.** Era la hipótesis abierta del
  loop anterior («S2: la config no sobrevive»), y es **falsa**. Probado el
  ciclo completo sobre el proyecto de 193 titulares: tras `strip_caches`
  (guardar) y `.pulso_renormalize_after_load` (abrir), sobreviven intactos
  `estadistico_default = "p25"`, su `frame_hash`, el `confirmado_at`, las 2.616
  unidades de la selección, los **15 rangos de nivel** y las **10 facultades con
  mínimo de elegibles**. El guardado no filtra nada: es `strip_caches` +
  `saveRDS`.

  **Y cuando un proyecto aparece «vacío» la causa es otra**: tiene cargada otra
  base. Medido el 2026-08-24 sobre `HSVG2026.pulso`, sus archivos fuente son
  `2025.00507905 BD estudiantes y curso-horario` y
  `HSVBG2025_referencia_para_motor.xlsx` — **la base de 2025**. La copia con la
  selección de 193 carga `207915-Alumnos matriculados 2026-2.xlsx` y
  `207915-Cursos-Horarios 2026-2.xlsx`, que es el semestre del estudio.

  La prueba que lo delata sin abrir los archivos: **el catálogo del proyecto
  activo contiene el 100 % (1.012 de 1.012) de los cursos-horario del marco
  2025**, y el de 2026-2 contiene el 89 % (896). Un catálogo de un semestre nuevo
  no puede contener entero el marco del anterior. Los dos catálogos comparten
  sólo **4.045 códigos**: 1.218 están sólo en uno y 1.224 sólo en el otro, y
  quitando el sufijo de horario siguen siendo ~490 cursos distintos en cada
  lado — no es una redescarga con retoques, son dos bases.

  **Regenerar el cálculo sobre el proyecto activo no lo arregla: sortearía aulas
  del semestre pasado.** El cálculo no estaba roto; estaba bien calculado sobre
  la base equivocada.

  El resto de esta nota describe el mismo caso desde el lado del marco: Medido en `HSVG2026.pulso` (24 Ago): catálogo de **5.263**
  cursos-horario y `confirmado_at` vacío, contra el de la selección buena, que
  tiene **5.269** y su decisión firmada contra ese hash. Sin decisión confirmada
  no hay estadístico divisor, y el cálculo devuelve **269 y 431 aulas** en vez de
  ~190 — fuera de la vara de 170–210. Se arregla confirmando la decisión en
  Marco › Alumnos por CH, no tocando la persistencia.

- **El session store no cuesta**: 0,00 s para leer o escribir el state de 230 MB.
  Es un environment, no copia.
- `readRDS` del state: 0,56 s. `unzip` del `.pulso`: 0,08 s.
- **El payload light ya recorta los reportes por su cuenta.** Se probó a envolver
  `dashboard$aulas_universitarias_reports <- aulas_dashboard` en
  `if (isTRUE(include_reports))` y **el mutante no mató el test**: no ahorra
  nada. Revertido.

---

## 5. Deuda medida y sin tocar

- **28 componentes que no importa nadie**, incluido `EnumeradoresPane.tsx` (801
  líneas). Medido hace días; no re-verificado.
- **`elegibles_esperados` sigue siendo una columna que duplica
  `MATRICULADOS POBLACION`.** Se renombró a `ELEGIBLES: BASE DEL %` para que
  deje de prometer una meta, pero el número sigue repetido en la misma fila.
  Retirarla es una decisión sobre el formato del libro que usa el equipo.

---

## 6. Infraestructura de trabajo

- **El cron del `/loop` no dispara desde el 18 Ago 21:31.** Verificado contando
  ticks en el transcript: 55 en total, ninguno en seis días, con el job sano en
  `CronList`. Un `/loop` local sólo corre mientras la sesión viva **y esté
  ociosa**; la alternativa durable es `/schedule`, que corre en la nube.
- **En esta rama (`rescate/graficos-lote-nueve`) NO se puede regenerar el
  NAMESPACE**: `roxygenise` deja +320/−34 y borra `run_app` y
  `build_plumber_app`. Ningún test lo detecta porque `load_all` exporta todo.
- **El backend del 8787 corre el código anterior.** Las mejoras de R de esta
  sesión están medidas y testeadas, pero **no verificadas en la app corriendo**:
  ese proceso es de Gonzalo y relanzarlo es suyo.

---

## 7. Lo cerrado en este loop — no rehacerlo

| Commit | Qué reparó |
|---|---|
| `81efbf6d` | La cola de contacto era una tabla cuya tercera columna servía **teléfono** en unas filas y **fecha de cita** en otras. Dos tablas, citas primero (estaban a 6.500 px de scroll), fecha en calendario. |
| `51df3e22` | El panel de observaciones contaba **la agenda entera** como denominador: «4 de 2.616 partes» con 13 unidades en campo. |
| `74b968e9` | El veredicto de aula válida colgaba de `70T`/`70P`, **columnas que la app ya no escribe** → `NA` en el 100 % de los estudios de 2026. Y las observaciones son **DOS columnas en dos hojas**; el panel leía una. |
| `471aeee2` | Correcciones a mi propio commit: la meta se lee de `expected_valid` y nunca de `elegibles_esperados` (habría exigido el 100 % de asistencia). |
| `b9faa95d` | Guardia de la fórmula vigente (12 tests) y retirada de `tauImplicito`, que reconstruía un τ inexistente. |
| `e74292d4` | `ELEGIBLES ESPERADOS` → `ELEGIBLES: BASE DEL %`. El panel «lo que falta» entra por `efectiva` y calcula la brecha como meta − obtenidas. |
| `c9a3a78c` | El bloque del esperado **no estaba en ningún grupo**: el inspector pintaba `70T`/`70P` y no la meta. Y «ningún eslabón llegó a su meta» sobre 183 aulas sin visitar. |
| `52d25b62` | Corrección de una premisa mía: **en es-PE el separador decimal es el punto**. |
| `da0924b8` | La caché del dashboard de aulas. |

### Cifras que no hay que recalcular

Plan **2.616** = 193 titulares + 507 reservas en cadena + 1.916 del pool ·
registro de campo lista **700** (titulares + cadena, sin pool) · simulación: 10
aplicadas en 5 días, 213 efectivas, 3 partes, 4 observaciones de 10 gestionadas ·
Base de control **47 campos, 43 escritos, 5 grupos** · apertura = **6 requests de
state** · marco 2026 con el criterio de nivel en bloque **2.426 de 5.263**.

**La fórmula vigente**, fijada por test (`test-efectividad-formula-vigente.R`):

```
efectivas_esperadas = eligible_n × rendimiento_ref(tramo de tamaño) × factor_facultad
```

2.616 de 2.616 cuadran así; **0 de 2.616 con `p_aplicada_ref`** — el tipo de
docente no entra, es capa operativa. La tasa por facultad («composición × razón
O/E») es `mix × factor_residual`, calibrada en **6 de 15** facultades: C&I 0,972
(k=40) · Derecho 1,115 (k=16) · EE.GG. Letras 0,985 (k=23) · EE.GG. Ciencias
0,917 (k=26) · Arte y Diseño 0,910 (k=12) · CCSS 0,960 (k=17). Las otras nueve
—614 aulas— van con factor 1: el criterio se declara sólo donde el histórico da
base.
