# Escalabilidad arquitectónica — corte 2026-07-29

Tipo: Evaluación QA de arquitectura

Estado: Vigente como línea base fechada

Autoridad: Evidencia; no reemplaza ADR ni contrato ejecutable

Última revisión: 2026-07-29

## Veredicto

Prosecnur tiene una base **adecuada, con reservas, para su contrato local-first
de un analista por proceso**. El code splitting, el warmup explícito, los jobs
en subprocesos y el formato `.pulso` filtrado permiten crecer en módulos y
evitan que varias operaciones pesadas bloqueen la interfaz.

No está demostrado que el sistema mantenga tiempos y memoria previsibles para
volúmenes arbitrariamente mayores que los proyectos de referencia. Tampoco
existe un scheduler global que limite subprocesos simultáneos. La aplicación no
es multiusuario ni pretende escalar horizontalmente; esa ausencia es una
frontera deliberada, no un defecto contra el contrato actual.

El resultado global es **ámbar**: la dirección arquitectónica es correcta para
el producto local, pero la capacidad necesita un gate reproducible por volumen
y la mantenibilidad está limitada por varios archivos monolíticos.

## Alcance y método

Esta revisión es local, estática y basada en evidencia versionada. Se
inspeccionaron la arquitectura canónica, ADR de proyecto y warmup, registro de
jobs, sesión, configuración de chunks, proyectos de referencia y el plan de
performance vigente. No se ejecutaron benchmarks nuevos ni se usaron datos de
cliente.

Por eso se distinguen tres clases de afirmación:

- **verificado por contrato:** se observa directamente en código o ADR;
- **medido previamente:** tiene cifras en evidencia fechada, no repetidas en
  este corte;
- **no demostrado:** falta un ensayo reproducible o un umbral acordado.

## Matriz de capacidad

| Eje | Estado | Evidencia | Límite o deuda |
|---|---|---|---|
| Contrato de despliegue | Verde | Arquitectura local, `127.0.0.1`, una sesión de analista y monolito modular | Multiusuario, colaboración simultánea y escalado horizontal están fuera de alcance |
| Carga del frontend | Verde con margen corto | Todas las páginas principales usan `lazyWithReload`; Vite separa `app-core`, Monitoreo y Plotly; el plan de performance registra 128 KB gzip pre-render y ~37 KB CSS de arranque | El norte documentado es <120 KB gzip; cualquier cambio de chunks requiere smoke de rutas y control de ciclos TDZ |
| Preparación de módulos | Ámbar | `warmupRegistry.ts` limita concurrencia en el frontend y `ModuleWarmupBoundary` espera frontend/backend con progreso | El warmup frío sigue dependiendo del costo del proyecto y puede crear trabajo redundante si no hay cache válida |
| Cómputo pesado | Ámbar | `job_submit()` ejecuta operaciones con `callr::r_bg`, progreso, cancelación y resultados por sesión | Cada submit crea un proceso; no hay cola global, cuota por sesión ni backpressure por CPU/memoria |
| Estado y memoria | Ámbar | `session_store.R` aísla por `sid`; archivos temporales viven bajo `tempdir()/prosecnur/<sid>` | Estado principal en memoria y argumentos RDS de jobs pueden duplicar datos; uso crece con sesiones, bases y jobs concurrentes |
| Persistencia `.pulso` | Verde para portabilidad; ámbar para volumen | ZIP con `manifest.json`, `state.rds` filtrado e inputs en `files/`; secretos y entregables quedan fuera | Guardado completo, sin escritura incremental ni concurrencia; el tamaño depende de inputs y de la disciplina de excluir caches |
| APIs y tablas grandes | Ámbar | Hay previews/caps y caches en áreas como Monitoreo; una prueba cubre un payload público de 5.203 filas | No existe política transversal de paginación/virtualización ni matriz de volumen para todos los módulos |
| Escala de referencia | Ámbar | Cuatro proyectos anonimizados: aproximadamente 372 KB, 1,7 MB, 7,2 MB y 7,7 MB; auditoría sintética de 132 KB | Esos tamaños prueban flujos reales conocidos, no un techo de filas, columnas, repeats, mapas o bases simultáneas |
| Evolución modular | Rojo | Hay 262 archivos R y 1.096 TS/TSX, con suites amplias por capa | Concentraciones de 39.975 líneas en `monitoreo_engine.R`, 38.160 en `monitoreo.css`, 30.216 en `theme.css` y páginas de perfil de 18–20 mil líneas elevan costo y radio de regresión |
| Observabilidad de capacidad | Ámbar | Existen matrices y scripts de performance focalizados, además de progreso de jobs | No hay un reporte único que compare tiempo pico, RSS, tamaño `.pulso` y payload por fixture en cada corte |

## Evidencia cuantitativa disponible

Las cifras siguientes son resultados consignados en
[`plan-optimizacion-perf-2026-07.md`](../plan-optimizacion-perf-2026-07.md) o una
foto tomada el 2026-07-29 a las 22:37 -05 sobre `0c7ed846` más el working tree
concurrente. Los conteos describen ese instante; no son baselines congelados.

| Señal | Valor | Clase |
|---|---:|---|
| Archivos `api/R/*.R` | 263 | Foto estática con archivos versionables |
| Archivos frontend TS/TSX | 1.107 | Foto estática con archivos versionables |
| Suites backend `test-*.R` | 262 | Foto estática con archivos versionables |
| Tests frontend `*.test.ts(x)` | 297 | Foto estática con archivos versionables |
| Mayor proyecto de referencia versionado | ~7,7 MB | Foto de archivos, no benchmark |
| Payload pre-render después de olas 1–3 | 128 KB gzip | Medido previamente |
| CSS de arranque después de olas 1–3 | ~37 KB raw | Medido previamente |
| `GET /api/monitoreo/state` con cache hit | ~10 ms | Medido previamente en el plan |
| Warmup territorial frío re-medido | 59,0 s desde 82,8 s | Medido previamente en el plan |

Estas cifras no deben convertirse en SLA sin repetirlas en un entorno fijado y
guardar máquina, fixture, commit, tamaño de entrada, mediana y percentil alto.

## Riesgos que gobiernan la escala

### P1 — Capacidad sin presupuesto reproducible

No existe una matriz que haga crecer filas, columnas, repeats, bases y jobs y
falle al superar umbrales. Una optimización local puede mejorar un perfil y
degradar otro sin que el gate lo detecte.

### P1 — Concurrencia de jobs sin backpressure

`job_submit()` arranca un `callr::r_bg` por solicitud. La separación protege el
hilo de Plumber, pero no protege la máquina ante varios jobs pesados. Antes de
promover concurrencia adicional se necesita una cuota por proceso/sesión, una
cola visible y política de cancelación/limpieza.

### P1 — Monolitos que frenan la escala del equipo

El problema no es solo el tiempo de ejecución. Archivos de decenas de miles de
líneas concentran estado, estilos y reglas, dificultan aislar cambios y hacen
que el costo de verificación crezca. La lista de archivos congelados debe seguir
siendo un gate; funcionalidad nueva debe nacer en módulos pequeños con contrato.

### P2 — Memoria proporcional a estado y workers

La sesión vive en memoria y los jobs pueden serializar inputs a RDS. Falta medir
RSS pico y duplicación para el mayor fixture con uno, dos y varios jobs. Sin esa
medición, el límite efectivo es la RAM de la máquina y no un presupuesto del
producto.

### P2 — Políticas de tablas no uniformes

Algunas superficies aplican caps, previews o virtualización, pero no hay una
regla común para respuestas, casos, mapas y tablas exportables. Todo endpoint
que pueda devolver O(n) filas debe declarar si pagina, resume, limita o entrega
un artefacto descargable.

## Gate propuesto

El gate de escalabilidad debe producir un JSON y un resumen Markdown por
fixture. Para cada corte registra:

1. commit, SO, CPU, RAM y versión de R/Node;
2. tamaño del `.pulso`, filas, columnas, bases, repeats y puntos geográficos;
3. apertura fría y caliente, warmup total y tiempo de entrada por módulo;
4. RSS del proceso principal y pico agregado de workers;
5. cantidad máxima de jobs, cancelaciones y archivos temporales residuales;
6. payload y tiempo p50/p95 de endpoints de estado y tablas;
7. tamaño pre-render, chunks calientes y CSS cargado;
8. resultado funcional de `reference-project-verify`.

La matriz mínima usa los cuatro proyectos de referencia y una semilla sintética
escalonada. Debe incluir al menos 1×, 5× y 10× del mayor volumen representativo,
sin copiar datos personales. Los umbrales iniciales se aprueban solo después de
la primera corrida estable; hasta entonces el gate informa tendencia y falla
únicamente por crash, pérdida de datos, job huérfano o crecimiento no acotado.

## Decisiones y acciones siguientes

| Prioridad | Acción | Evidencia de cierre |
|---|---|---|
| P1 | Crear benchmark sintético transversal y reporte versionable | Matriz repetible con filas/columnas/bases, tiempos y RSS |
| P1 | Diseñar límite y cola global de jobs | ADR o extensión aceptada, pruebas de cuota/cancelación y UI de estado |
| P1 | Continuar extracción de monolitos congelados | Ningún archivo crece sobre baseline; responsabilidades nuevas viven fuera |
| P2 | Declarar contrato de volumen por endpoint/table view | Paginación, cap explícito, virtualización o artefacto para cada superficie O(n) |
| P2 | Medir guardado/apertura y tamaño `.pulso` por fixture | Presupuesto por fixture y alerta ante caches/entregables incorporados |
| P3 | Consolidar matrices históricas de performance | Un índice separa línea base actual de evidencia archivada |

## Fuentes

- [Arquitectura canónica](../arquitectura-prosecnur.md)
- [ADR 0002 — formato `.pulso`](../adrs/0002-formato-pulso.md)
- [ADR 0021 — arranque y warm start](../adrs/0021-arranque-con-proyecto-y-warm-start.md)
- [Plan de optimización medido](../plan-optimizacion-perf-2026-07.md)
- [Baseline de deuda](deuda-baseline.md)
- [`api/R/jobs.R`](../../api/R/jobs.R)
- [`api/R/session_store.R`](../../api/R/session_store.R)
- [`frontend/vite.config.ts`](../../frontend/vite.config.ts)
- [`frontend/src/app/warmupRegistry.ts`](../../frontend/src/app/warmupRegistry.ts)
