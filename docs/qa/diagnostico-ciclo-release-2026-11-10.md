# Diagnóstico del ciclo de release (2026-11-10)

Tipo: Diagnóstico
Estado: En curso
Fecha: 2026-11-10
Autoridad: pedido del dueño del 2026-11-10 y medición de solo lectura del mismo día sobre GitHub Actions (`gh run list`, `gh run view`, logs de los jobs fallidos), los tags y el historial git

Pedido del dueño: "Mi mayor problema con los releases es que demoran horas de horas de publicarse y siempre hay errores que hacen que se repita otra vez todo". Este documento mide dónde se va el tiempo y qué falla, y propone cambios. La medición fue de solo lectura. Después, con la aprobación del dueño, se aplicaron los cambios 1, 2, 4 y 6 de la tabla (ver "Cambios aplicados"). No se lanzó ninguna corrida, no se publicó ni se creó ningún tag.

## Resumen

1. Desde el corte 0.6.3, 8 de 10 versiones necesitaron más de un push del tag. Fueron 24 corridas de Release para 10 versiones y el tag se movió 14 veces. Entre el primer intento y la publicación pasaron de 1.4 a 10.1 horas. El corte 0.9.6 lleva 16.5 horas de intentos, 10 ejecuciones y sigue sin publicarse.
2. Una corrida de Release que sale bien tarda de 48 a 122 minutos cuando corre el gate de Quality y unos 20 cuando lo reutiliza. Las horas no salen de una corrida lenta: salen de repetir la corrida entera por cada error, porque cada arreglo es un commit nuevo, el tag se mueve y Quality vuelve a empezar.
3. Los errores se descubren de uno en uno. En 14 de 19 corridas de tag, el tag se pusheó sin esperar a que Quality terminara en main, de modo que el gate corrió dos veces en paralelo y falló dos veces por lo mismo.
4. De los 43 runs con algún job fallido, 12 fallaron por comprobaciones que en CI dan rojo antes del primer minuto (gobernanza documental y contratos de scripts). Otros 5 fallaron en el minuto 41 a 92 por una comprobación del lock de R que no depende de nada de lo que corre antes.
5. `check-docs-governance.mjs` sí hizo fallar las dos últimas corridas de Quality en main, pero no fue la única causa ni explica las 6 horas. Hoy, en local, da 366 errores: el próximo push fallará por esto a los 20 segundos.

## Alcance y método

- **Medido**: los últimos 50 runs de `quality.yml` (del 2026-08-04 al 2026-11-01) y los últimos 50 de `release.yml` (del 2026-07-07 al 2026-10-28), con duración por job y por paso, y el log de los jobs fallidos de 43 runs.
- **No medible**: 7 runs anteriores al 2026-08-06 ya no tienen log (GitHub responde HTTP 410). Se conoce el paso que falló, no la causa. Los dos runs fallidos de 0.5.4 tampoco conservan los pasos.
- **No medido**: la duración del pre-flight local completo. La tarea excluía correr la suite de R y el typecheck. Los tiempos locales que figuran abajo son solo de las comprobaciones baratas, cronometradas en esta sesión.
- La duración de un run con varios intentos es la del último intento, salvo en 0.9.6, donde se midieron los siete.
- "Inferido" marca lo que se deduce de las cifras sin haberlo comprobado con un experimento.

## Tasa de fallo

| Workflow | Runs | Éxito | Fallo | Cancelado |
|---|---|---|---|---|
| Quality, 50 runs | 50 | 26 (52.0 %) | 13 (26.0 %) | 11 (22.0 %) |
| Quality desde el 2026-10-10 | 37 | 18 (48.6 %) | 9 (24.3 %) | 10 (27.0 %) |
| Release, 50 runs | 50 | 27 (54.0 %) | 20 (40.0 %) | 3 (6.0 %) |
| Release desde el 2026-10-10 | 17 | 6 (35.3 %) | 10 (58.8 %) | 1 (5.9 %) |

De los 11 runs cancelados de Quality, 8 ya tenían un job en rojo cuando el push siguiente los canceló.

Duración de los runs de Quality que terminan en verde: mediana 38 minutos (mínimo 21, máximo 99). Desde el 2026-10-10, con la suite de R en cuatro shards: mediana 32, máximo 86. Los runs fallidos duran lo mismo (mediana 39) porque un job rojo no detiene a los demás.

Entre el 2026-07-11 y el 2026-08-01 (0.5.5 a 0.6.2) hubo 17 cortes y 16 salieron con una sola corrida, la mayoría de 8 a 11 minutos. El deterioro empieza en 0.6.3.

## Tiempos por job y por paso

Jobs que terminaron en verde entre el 2026-10-12 y el 2026-11-01. Minutos.

| Job o paso | n | Mediana | p90 | Máximo |
|---|---|---|---|---|
| Agentic OS (job entero) | 20 | 0.4 | 0.5 | 0.6 |
| UI contracts (job entero) | 20 | 1.1 | 1.8 | 6.5 |
| Frontend (job entero) | 17 | 6.6 | 8.3 | 15.1 |
| Frontend, typecheck | 17 | 1.7 | 2.2 | 2.2 |
| Frontend, tests | 17 | 3.4 | 4.6 | 10.9 |
| Frontend, build de producción | 17 | 0.8 | 0.9 | 1.1 |
| Backend R, librería exacta (job entero) | 22 | 1.6 | 21.1 | 50.4 |
| Backend R, librería exacta, restaurar y verificar dependencias | 22 | 0.1 | 0.1 | 45.4 |
| Backend R, `R CMD check` (job entero) | 21 | 10.5 | 12.9 | 33.1 |
| Backend R, tests, un shard (job entero) | 74 | 26.1 | 35.6 | 73.5 |
| Shard, paso "R tests" | 74 | 20.7 | 29.4 | 35.8 |
| Shard, `R CMD INSTALL` | 74 | 2.7 | 3.1 | 3.4 |
| Shard, Setup R | 74 | 0.7 | 1.2 | 20.1 |
| Shard, dependencias de sistema (apt) | 74 | 0.5 | 0.9 | 34.4 |
| Release, contrato de canal | 17 | 0.4 | 0.5 | 0.8 |
| Release, búsqueda de un Quality verde | 17 | 0.3 | 0.4 | 0.5 |
| Release, Build Windows (job entero) | 7 | 16.4 | 19.4 | 38.4 |
| Release, Build Windows, instalador y bundle | 7 | 13.8 | 14.6 | 16.2 |
| Release, Build macOS (job entero) | 6 | 16.2 | 19.4 | 20.5 |
| Release, Build macOS, los dos DMG | 6 | 13.0 | 15.7 | 16.9 |
| Release, publicación | 6 | 2.0 | 3.3 | 5.2 |

Lectura de la tabla:

- **El camino crítico de Quality es la suite de R.** Librería (1.6) más el shard más lento. En 34 runs con los cuatro shards completos, el paso "R tests" del shard más lento tiene mediana 22.9 minutos, el promedio de los cuatro 18.3 y el más rápido 12.1. Los archivos se reparten por orden alfabético, no por duración. La suite tiene 1461 archivos de test.
- **La librería de R se recompila entera cuando no hay caché**: 47.0, 48.5 y 50.4 minutos en tres runs, y 21.1 y 24.2 en otros dos. Durante ese tiempo no arranca ningún test de R. El 2026-11-10 el repositorio tiene 0 cachés activas (medido con la API de Actions). Inferido: GitHub desaloja las cachés que nadie lee en 7 días y el último run es del 2026-11-01, así que la próxima corrida pagará esos 47 a 50 minutos.
- **Los máximos de Setup R (20 minutos) y de apt (34 minutos) no son trabajo propio**: son descargas lentas del runner. Explican los shards de 71 a 74 minutos de las corridas de 0.9.4 y 0.9.5, que por eso tardaron 121.6 y 114.1 minutos. Cada uno de los seis jobs de R repite Setup R y apt.
- **Ningún job declara `timeout-minutes`.** El límite efectivo es el de GitHub, 6 horas.
- Una corrida de Release en verde desde el 2026-10-10: 48.4, 52.7, 114.1 y 121.6 minutos las cuatro que corrieron el gate, y 19.4 y 20.5 las dos que reutilizaron un Quality verde del mismo commit.

## Causas de fallo

43 runs con al menos un job fallido (21 de Quality, 22 de Release). Un run con varias causas cuenta en cada una, así que la columna de minutos no se suma. "Minutos" es la duración de las corridas afectadas, es decir, lo que tardó en saberse el resultado. El run del 2026-11-01 cuenta 35 minutos en las causas que no son la instalación colgada.

| Causa | Runs | Minutos de corrida | Minuto en que aparece el rojo | Detectable en local |
|---|---|---|---|---|
| Test de R en rojo | 12 | 510 | 15 a 35 con shards, 20 a 93 antes de los shards | Sí, con la suite del área. La completa tarda cerca de una hora |
| Contratos de scripts de Node (`scripts/tests`) | 10 | 242 | 0.5 | Sí, en segundos |
| Lock de R frente a los binarios de CRAN, en el build | 5 | 226 | 4 a 9 si Quality se reutiliza, 41 a 92 si no | Sí, pero hoy la comprobación vive dentro del script de empaquetado |
| Memoria de Node agotada (typecheck, build, DMG) | 5 | 175 | 3.8 a 17 | No con seguridad (inferido: depende del tope de memoria de cada máquina) |
| Cuota de almacenamiento de artefactos | 1 run, 7 intentos | 153 | 55 en el primer intento, 13 a 18 en los reintentos | No. Es una condición de la cuenta |
| Contratos de UI con Chromium | 6 | 150 | 2 | Sí, si hay Chromium de Playwright instalado |
| Gobernanza documental | 5 | 89 | 0.3 | Sí, en 0.3 segundos |
| Tests de R intermitentes | 2 | 74 | 28 a 35 | No |
| Facturación de la cuenta de GitHub | 1 | 42 | 41, después de un Quality verde | No. Es una condición de la cuenta |
| Instalación de Chromium colgada, sin timeout | 1 | 360 | No terminó | No |
| Dependencias del empaquetado (`msitools`, LibreOffice del staging) | 1 | 9 | 6 a 9 | Solo armando el instalador |
| Contrato entre el router y el tipo del cliente (vitest) | 1 | 11 | 5 | Sí |
| Sin log ni pasos (0.5.4) | 2 | 22 | Sin dato | Sin dato |

Detalle de cada causa:

- **Test de R en rojo.** Tests distintos en cada corte: `test-estandar-grosor` (0.9.1), `test-namespace-contract` (0.8.0), `test-xlsform-formulario-pdf`, `test-collection-render-zonas`, el golden de `test-calc-muestra-aulas` (dos veces, y dependía de la plataforma), `test-reference-projects-fixtures` (el sha256 de `acnur_acg` no coincide con su manifest, 2026-11-01) y un run con más de diez fallos (2026-10-10). Dos runs de 0.5.3 no conservan el log.
- **Contratos de scripts.** En los 8 runs con log falla el mismo test, `vaults-check.test.mjs` ("nodo sin nota en la bóveda", "adaptador generado desactualizado"). El commit `bce4a2c60` retiró la bóveda y ese test el 2026-11-01, pero ese commit no está en GitHub.
- **Lock de R.** "CRAN no satisface el lock (versión distinta)" para `class`, `bslib`, `renv`, `stringi` y `colorspace`, en los cortes 0.6.3, 0.7.0 y 0.9.0. La comprobación la hacen `packaging/windows/download-r-win-binaries.R` y `packaging/macos/download-r-mac-binaries.R`, que corren dentro del build, después de Quality.
- **Memoria de Node.** "JavaScript heap out of memory" en el typecheck y, una vuelta después, en el build de producción (0.9.6), y en el build del DMG (0.9.3, que se publicó sin DMG). Ya corregido con `NODE_OPTIONS` en ambos workflows.
- **Cuota de artefactos.** "Artifact storage quota has been hit" al subir los instalables, al final de un build de 14 a 17 minutos. Se reintentó 7 veces en 13 horas. El commit `bce71851a` pasó el traslado de instalables a la caché de Actions.
- **Facturación.** En el último intento de 0.9.6, Quality pasó en 41 minutos y los dos builds no arrancaron. La anotación del job dice que no se inició porque fallaron pagos recientes de la cuenta o hay que subir el límite de gasto. No se pudo comprobar desde esta sesión si sigue así: hay que mirarlo en "Billing & plans".
- **Tests intermitentes.** `test-secrets` y el tope de rendimiento de `test-collection-origen`, en el primer intento de 0.9.4. Corregidos en `c1f97357`.

## Repeticiones por corte

Corridas de Release disparadas por el push de un tag. "Commits distintos" cuenta a cuántos commits apuntó el tag: uno menos es el número de veces que se movió.

| Versión | Corridas | Commits distintos | Resultado por corrida | Horas del primer intento al último | Publicada |
|---|---|---|---|---|---|
| 0.6.3 | 3 | 3 | cancelada, fallo, fallo | 3.2 | Sí, sin pasar por una corrida verde |
| 0.7.0 | 2 | 2 | fallo, fallo | 2.4 | Sí, sin DMG en la corrida |
| 0.7.1 | 1 (2 intentos) | 1 | éxito | 1.2 | Sí |
| 0.8.0 | 3 | 3 | fallo, fallo, éxito | 3.6 | Sí |
| 0.9.0 | 4 | 4 | fallo, fallo, fallo, éxito | 6.5 | Sí |
| 0.9.1 | 2 | 2 | fallo, éxito | 1.4 | Sí |
| 0.9.3 | 1 | 1 | fallo del DMG | 0.3 | Sí, solo Windows |
| 0.9.4 | 2 | 2 | fallo, éxito | 2.7 | Sí |
| 0.9.5 | 2 | 2 | éxito, éxito | 10.1 | Sí, dos veces |
| 0.9.6 | 4 (10 ejecuciones) | 4 | fallo en las cuatro | 16.5 | No |

- 24 corridas para 10 versiones, 14 movimientos de tag. Solo 0.9.5 y 0.7.1 llegaron a una publicación completa con su primer tag.
- 0.9.2 no tiene tag ni corrida.
- `docs/versiones-app.md` solo registra un commit por corte ("prepara corte") y uno de "publicada" en 0.9.5. Los reintentos no dejan huella ahí: la única fuente son los runs.
- Secuencia de 0.9.6, que muestra el patrón completo: typecheck sin memoria (minuto 3.8, la corrida siguió hasta el 35), arreglo y tag movido, build de producción sin memoria (minuto 16, hasta el 43), arreglo y tag movido, Quality verde y fallo al subir los instalables por cuota (minuto 55), seis reintentos solo de los builds, cambio del workflow y tag movido, Quality verde otra vez (41 minutos) y builds bloqueados por facturación. La suite de R pasó en verde las cuatro veces.

## Lo que se repite entero, lo que va en serie y lo que llega tarde

**Se vuelve a ejecutar entero tras un fallo tardío**

- Cualquier arreglo es un commit nuevo. `precheck` solo reutiliza un Quality verde del mismo commit, o de un ancestro si el diff toca únicamente `api/renv.lock` y `packaging/**` (ADR 0059). Un cambio en `.github/` obliga a correr todo. En 0.9.6 los tres arreglos fueron de workflow y cada uno repitió la suite de R completa.
- Los dos builds se repiten aunque solo haya fallado uno o solo la subida.
- Reintentar los jobs fallidos (`gh run rerun --failed`) sí evita repetir Quality, y se usó en 0.9.6. Solo sirve cuando el arreglo no necesita un commit.

**Corre en serie y esconde el error siguiente**

- Dentro del job Frontend los pasos van uno tras otro y un paso rojo salta los demás: contratos de scripts, baseline de deuda, typecheck, tests, build y los dos audits. Cuando falla el primero (a los 30 segundos), ese run no dice nada del typecheck, los tests ni el build. En 0.9.6 el typecheck rojo escondió el build rojo, que costó otra vuelta de 43 minutos.
- En Agentic OS pasa lo mismo: la gobernanza roja salta el contrato de release.
- Los builds esperan a que termine todo Quality, y la publicación a los dos builds. Es deliberado (el comentario de `release.yml` explica por qué), pero deja las comprobaciones del build al final.

**Comprobaciones baratas que hoy corren tarde**

- La del lock de R frente a los binarios de CRAN (segundos a pocos minutos, solo red) corre dentro del build: minuto 41 a 92.
- La capacidad de subir los instalables se descubre al final de un build de 14 a 17 minutos.
- `pnpm audit` de frontend y de desktop (segundos) son los dos últimos pasos del job Frontend, detrás de typecheck, tests y build.
- `R CMD INSTALL` (2.7 minutos) se repite idéntico en los cuatro shards.

**Trabajo duplicado**

- De las 19 corridas de tag cuyo commit también se pusheó a main, 14 se lanzaron antes de que Quality terminara en main (13 de ellas con un minuto o menos de diferencia). El gate corrió dos veces en paralelo sobre el mismo commit. Las 5 restantes esperaron el verde y reutilizaron el gate: son las corridas de 6 a 20 minutos.

## Lo que un pre-flight local habría detectado

Cronometrado en esta sesión sobre el árbol actual:

| Comprobación | Tiempo local | Resultado hoy |
|---|---|---|
| `node scripts/check-docs-governance.mjs` | 0.3 s | Falla: 366 errores |
| `node --test agentic/tests/*.test.mjs` | 4 s | Pasa |
| `node agentic/sync-agentic-os.mjs --check` y `--audit` | 1 s | Pasan |
| `node scripts/check-r-lock.mjs` | menos de 1 s | Pasa |
| `node scripts/release-contract.mjs preview` | menos de 1 s | Pasa |
| `node scripts/debt-audit.mjs --check` | 7 s | Pasa |

No se corrieron los 14 contratos de `scripts/tests`, el typecheck, vitest ni la suite de R.

Fallos del CI frente a los skills:

| Fallo | Runs | Figura en `/publicar` | Figura en `/preparar-release` |
|---|---|---|---|
| Gobernanza documental | 5 | Sí, con el comando | Sí, con el comando |
| Tests de R deterministas | 12 | Sí ("suite R") | Sí, con el comando de la suite completa |
| Contratos de scripts (`scripts/tests`) | 10 | Solo como "lee `quality.yml` y ejecuta sus gates" | No: la lista solo nombra `release-contract.test.mjs` |
| Contratos de UI con Chromium | 6 | Solo de forma genérica | No |
| Lock de R frente a CRAN | 5 | No | No |
| Tag sin Quality verde en el mismo commit | 14 corridas | Sí: "Quality verde en el mismo SHA" y "no se pushea para ver si CI pasa" | No lo repite |

Por qué estar descrito no lo evitó (inferido de las cifras, no comprobado con las sesiones de cada corte):

- El pre-flight es una lista en prosa que hay que ejecutar a mano, sin un comando único ni un bloqueo. La parte barata (segundos) va mezclada con la suite de R completa (cerca de una hora), así que se omite entera o se corre a medias.
- La lista de `/preparar-release` copia ocho comandos y deja fuera cuatro pasos que `quality.yml` sí ejecuta: `scripts/tests`, `debt-audit`, `check-r-lock` y los contratos de UI. El propio skill pide ejecutar "lo que declaran los workflows vigentes, no una lista recordada", y a continuación da una lista.
- Nada impide pushear el tag antes del verde: la regla existe en el skill y se incumplió en 14 de 19 corridas.
- Hay 2168 commits locales sin pushear desde el 2026-10-28. Con pushes tan espaciados, cada push arrastra semanas de documentos y tests sin validar en CI, y la caché de R ya caducó.

## `check-docs-governance.mjs` y los fallos recientes de Quality en main

Confirmado como causa, descartado como causa única.

| Run | Fecha | Duración | Qué falló |
|---|---|---|---|
| 40683607098 | 2026-10-28 | 40.6 min | Gobernanza (2 errores, minuto 0.3) y `vaults-check.test.mjs` (minuto 0.6). El resto pasó |
| 41257157814 | 2026-11-01 | 360.3 min | Gobernanza (los mismos 2 errores), `vaults-check.test.mjs`, `test-reference-projects-fixtures` en el shard 4 (minuto 34) y la instalación de Chromium, que quedó colgada hasta el tope de 6 horas |

- Los 2 errores de gobernanza eran los mismos en ambos runs: `checklist-monitoreo-acreditacion-2026-10-27.md` y `checklist-monitoreo-territorial-mapa-2026-10-27.md`, no alcanzables desde `docs/README.md`.
- Los 40 minutos del primer run no son de la gobernanza: el rojo salió a los 20 segundos y los shards de R siguieron hasta el final.
- Las 6 horas del segundo tampoco: son del paso "Install Chromium for Playwright", sin `timeout-minutes`.
- Aunque la gobernanza hubiera pasado, los dos runs habrían terminado en rojo por `vaults-check`.
- Los 366 errores de hoy son otra cosa: deuda acumulada en los commits que aún no se pushean. 357 están en `docs/qa`, en 74 archivos. Por tipo: 232 son cabeceras ausentes (Tipo, Autoridad, Fecha, Estado), 68 documentos no alcanzables desde `docs/README.md`, 37 enlaces locales inexistentes, 13 estados no canónicos y 10 fechas inválidas.
- La gobernanza también falló en el corte 0.8.0 (201 errores) y en el primer intento de 0.6.3.

## Cambios propuestos

Ordenados por minutos ahorrados. Los ahorros son estimaciones a partir de las corridas medidas (inferido), no resultados de una prueba.

| N.º | Cambio | Ahorro estimado | Riesgo | Archivos |
|---|---|---|---|---|
| 1 | Pre-flight rápido en un solo comando, con todo lo que en CI falla en menos de un minuto y en local tarda segundos: gobernanza, Agentic OS, `check-r-lock`, contrato de release, `debt-audit` y `scripts/tests`. Los skills lo invocan en vez de copiar la lista | 12 runs, 253 minutos de corrida y 2 movimientos de tag en el periodo. Cada vuelta evitada vale de 30 a 50 minutos | Bajo | `scripts/preflight-rapido.mjs` (nuevo), `Makefile`, `.claude/skills/publicar/SKILL.md`, `.claude/skills/preparar-release/SKILL.md` |
| 2 | Bloquear el push de un tag `v*` si su commit no tiene un Quality verde, con una guarda como las que ya frenan `git add -A` | 7 corridas de Release, 254 minutos, y 7 de los 14 movimientos de tag. No acorta la espera del primer verde: evita pagar el gate dos veces y retaggear | Bajo. Hay que dejar una salida explícita para el caso en que GitHub esté caído | `agentic/hooks/guardas.mjs`, `agentic/tests/guardas-hooks.test.mjs`, `.claude/skills/publicar/SKILL.md` |
| 3 | Comprobar el lock de R frente a los binarios de CRAN al principio, en el job `contract` de Release y en el pre-flight, con un modo de solo verificación en los dos descargadores | 5 runs, 226 minutos. El rojo pasa del minuto 41 a 92 al minuto 1 | Medio: mete una dependencia de red (CRAN o Posit) en un job temprano | `packaging/windows/download-r-win-binaries.R`, `packaging/macos/download-r-mac-binaries.R`, `.github/workflows/release.yml`, `scripts/preflight-rapido.mjs` |
| 4 | `timeout-minutes` en todos los jobs (por ejemplo 15 en los cortos, 60 en los shards y los builds) | 325 minutos en el único caso observado. Además deja de ocupar un runner 6 horas | Bajo. Un tope muy justo cortaría las corridas con Setup R lento (hasta 20 minutos) | `.github/workflows/quality.yml`, `.github/workflows/release.yml` |
| 5 | Mantener viva la caché de la librería de R: una corrida programada cada 5 o 6 días que solo ejecute el job de la librería | 47 a 50 minutos por corrida en frío. Hoy hay 0 cachés: la próxima corrida lo pagará | Bajo. Consume unos 2 minutos de runner por semana | `.github/workflows/quality.yml` (disparador `schedule` y condición por job) o un workflow nuevo |
| 6 | Que un paso rojo no salte los pasos independientes del job Frontend ni de Agentic OS (`if: ${{ !cancelled() }}`), para que una corrida muestre todos los rojos | Una vuelta por corte con dos errores de frontend: 43 minutos en 0.9.6. También habría mostrado el estado del typecheck y los tests en los 10 runs de contratos de scripts | Bajo. El job rojo tarda hasta 7 minutos en vez de 30 segundos | `.github/workflows/quality.yml` |
| 7 | Extender la reutilización del ADR 0059 a un diff que solo toque `.github/workflows/release.yml` | 41 minutos en el cuarto intento de 0.9.6 | Medio: exige enmendar el ADR, y un error en la lista blanca dejaría publicar sin gate | `scripts/release-precheck-lineage.mjs`, su test, `docs/adrs/0059-*.md` |
| 8 | Repartir los archivos de test entre shards por duración medida, e instalar el paquete una sola vez en el job de la librería | Unos 4.6 minutos por corrida por el reparto (22.9 frente a 18.3) y 2.7 por la instalación | Bajo. La tabla de duraciones hay que regenerarla de vez en cuando | `.github/workflows/quality.yml`, un script de reparto nuevo |
| 9 | Subir los dos `pnpm audit` al principio del job Frontend | Segundos por corrida. Un advisory nuevo sale en el minuto 1 y no en el 7 | Bajo | `.github/workflows/quality.yml` |

Fuera de la tabla porque no son cambios de código:

- **Facturación de GitHub.** Es lo último que detuvo a 0.9.6. Requiere que el dueño revise "Billing & plans". Ningún cambio de la tabla lo resuelve.
- **Deuda de gobernanza documental.** 366 errores en 74 archivos. Mientras exista, el primer job del próximo push falla a los 20 segundos. Con el cambio 6 dejaría de esconder el contrato de release, pero el run seguiría en rojo.
- **Estado del repositorio remoto.** `origin/main` está en el commit del 2026-10-28 y hay 2168 commits locales sin pushear. El primer push validará todo eso de una vez, con la caché de R vacía.

## Cambios aplicados

Aprobados por el dueño el 2026-11-10: los cambios 1, 2, 4 y 6. Los cambios 3, 5, 7, 8 y 9 no están aprobados.

| N.º | Qué quedó | Archivos | Comprobación |
|---|---|---|---|
| 1 | `make preflight-rapido`: 9 pasos, unos 16 a 24 segundos, corre todos aunque uno falle. Un contrato lo ata a `quality.yml`: un paso nuevo en los jobs Agentic OS o Frontend tiene que estar espejado o excluido con su motivo | `scripts/preflight-rapido.mjs`, `scripts/tests/preflightRapido.test.mjs`, `Makefile`, los skills `publicar` y `preparar-release` | El contrato pasa (5 tests) y su autoprueba da rojo con un paso sin espejo |
| 2 | Guarda del push de un tag `vX.Y.Z`: pasa con Quality verde en el commit que se empuja, bloquea con Quality en curso o en rojo, y pregunta al dueño si no hay corrida, si se canceló, si GitHub no responde, si el tag sale de una variable, con `--tags` y con `gh release create` | `agentic/hooks/guarda-tag-release.mjs`, `agentic/hooks/guardas.mjs`, `agentic/tests/guarda-tag-release.test.mjs` | 81 tests de Agentic OS en verde. Con el hook real, un push a main pasa en 0.09 segundos sin consultar GitHub y un push de `v0.9.6` consulta en 1.5 segundos |
| 4 | `timeout-minutes` en los 11 jobs con pasos: de 10 a 30 en los cortos, 60 en los builds, 75 en `R CMD check` y 120 en la librería y los shards. El job `quality` de Release llama a un workflow reutilizable y ahí el tope no es válido | `.github/workflows/quality.yml`, `.github/workflows/release.yml` | YAML válido. Sin comprobar en una corrida real |
| 6 | En Agentic OS y Frontend, cada paso independiente corre aunque otro haya fallado (`!cancelled()` más el éxito del paso que instala Node o las dependencias) | `.github/workflows/quality.yml` | YAML válido. Sin comprobar en una corrida real |

Límites conocidos de la guarda: no ve un push escondido en `bash -c`, `eval`, `xargs`, un alias de git ni una expansión de llaves, y solo actúa sobre los comandos de las sesiones de Claude, no sobre un push hecho a mano en la terminal.

El pre-flight sale hoy en rojo por dos causas anteriores a este trabajo: los 366 errores de gobernanza documental y tres conteos desactualizados en `scripts/tests/visual-catalog.test.mjs`.

## Pendiente

- Decisión del dueño sobre qué cambios de la tabla se implementan y en qué orden.
- Comprobar los cambios 4 y 6 en la primera corrida real de Quality: que ningún tope corte un job sano y que un paso rojo deje correr a los demás.
- Comprobar si el sha256 de `acnur_acg` sigue sin coincidir con su manifest en el árbol actual. Falló en CI el 2026-11-01 y los fixtures de referencia cambiaron el 2026-10-31 en commits que no están en GitHub.
