# Pendientes al cerrar el loop de Monitoreo y Aulas — 2026-10-28

Tipo: Acta de cierre de loop
Estado: Vigente
Fecha: 2026-10-28
Autoridad: Cierre dictado por Gonzalo; las fichas siguen en `revamp-monitoreo/aulas.md` y las líneas L* en `goal-modernizacion-ui-2026-10-10.md`

Gonzalo detuvo el loop indefinido a las ~17:25 («vamos cerrando el reloj y
dejándolo como está, anotando lo pendiente»). Esto queda tal como estaba: nada se
mergeó ni se borró al cerrar. `main` local va **175 commits por delante de
`origin/main`** sin pushear; el push queda para cuando Gonzalo lo pida.

## Lo que quedó cerrado hoy (en `main`, local)

| Ítem | Commit | Verificación |
|---|---|---|
| Arranque del bundle: TDZ «Cannot access 'Al' before initialization» (ciclo de chunks monitoreo-core ↔ monitoreo-telefonico por los `core/*Comunes` del L33) | `e2175c895` | Repro de arranque sobre el bundle, contrato `nucleoNoImportaPerfil`; Meta B añadió `chunksSinCiclos` (`369c55e6b`) |
| Aulas A1 · Avance › Resumen | merge `6bb3d97a9` | Captura 1440/1280 sin hallazgos |
| A1: ritmo con la cifra sobre cada barra del día, banda propia y metas a la izquierda | `30909ab9f`, `9c8d6f5b3` | Captura 1440/1280 sin hallazgos |
| Aulas A2 · Avance › Por facultad (Por nivel) | merge `8b659a7fc` | Captura 1440/1280/1024 `ok=true`; gate aulas 340/4663 |
| Riel de contexto: fecha del corte de 8 a 10 px (L29) | `caaea7e4f` | Visto en captura |
| Territorial › Faltante y UMP: la cabecera fija ya no tapa la fila | `8601c35f0` | Captura `ok=true` |
| Territorial › Control › Bandeja: la cabecera fija ya no tapa la fila (36 px reales) | `307a75c25` | Captura `ok=true` |
| Territorial › Bandeja: duración de más de una hora en «45:59 h» (antes «2759:15») | `7faba4ce5` | Captura 1280 `ok=true` |
| Territorial › Control: la readiness «sin-puente» era el TDZ del arranque | — | Control carga en captura |
| Territorial › Faltante: «60 o más» fuera de su tarjeta a 1280 | — | Ya no aparece en captura |

## Pendiente, en orden

| # | Qué | Dónde vive | Estado |
|---|---|---|---|
| 1 | ~~Aulas A3 · Avance › Cursos-horario~~ | merge `23a275cb4` (2026-10-31) | **Cerrado**: recaptura sin rótulos partidos ni textos fuera a 1440/1366/1024; queda un desborde en la sub-vista heredada «Estado del campo» a 1024 (cabecera del panel «Respuestas que pide el plan…») |
| 2 | ~~Aulas A4 · Avance › Rendimiento y A5 · Avance › Salidas~~ | `docs/qa/revamp-monitoreo/aulas.md` §3; tableros en el lienzo https://claude.ai/artifact/DUz7BW49dHvfQX34wrmaPo (`project/A4-Rendimiento.dc.html`, `project/A5-Salidas.dc.html`) | **Cerrado** 2026-10-31: A4 en `e15c5cca0` y `d91a046ff`, A5 en `538820197`; capturas 1440/1280/1024 sin hallazgos en las vistas nuevas |
| 3 | Aulas, resto de fichas: Insumos (I1–I3), Modelo (M1–M2), Control (Ctl1–Ctl8), paneles y estados | `aulas.md` §3 | Pendiente |
| 4 | Territorial › Bandeja a 1280: el aplicador se parte en tres líneas («P132 · Venturo / Perales Rosa / Magda») y las filas quedan altas | `profiles/territorial/control/bandeja.css` | Pendiente. El detector no lo marca: sólo se ve en la captura |
| 5 | L33 parte 2: los 51 componentes restantes, uno por commit con captura | GOAL `docs/qa/goal-modernizacion-ui-2026-10-10.md` | Pendiente |
| 6 | L14 (TabHeading en Monitoreo), L25 y L26 en Monitoreo | GOAL | Pendiente |
| 7 | Tipar `refuerzos.rendimiento` en el cliente (hoy A2 lo lee de forma defensiva) | `frontend/src/api/monitoreo.ts` | Pendiente; no bloquea |
| 2b | B3 · Territorial: asignado contra observado (`codigo_planificado`), pedido por Material | Archivo nuevo en `api/R/monitoreo_territorial_*`; contrato en `docs/qa/contrato-equipo-territorial-2026-10-31.md` | Encolado tras el ADR 0121 F2. **Leer la foto enviada (`envio`) y su `sample_fingerprint`, no la muestra viva** (`hojas_ruta_runs[[fase]]$workspace_outputs`, cruce X5 de `arquitectura-campo-planner-2026-10-31.md` §9): si se vuelve a sortear, la viva compara contra otra muestra |
| 2c | Cruces con Hojas de ruta y Cálculo (revisados por guardian-contratos, `arquitectura-campo-planner-2026-10-31.md` §12). X5: la lectura de la muestra viva llama a `.hojas_ruta_ensure_runs(sid)` (router_monitoreo.R:620), que puede escribir en el estado de Hojas de ruta; falta saber si marca el proyecto como modificado. X6: la copia a `design_targets` es correcta como foto, pero no guarda la huella de su origen, fija `monitoreo_profile` (:5461-5467) y acepta `estudio`, `selection` y `frame` desde el body (:5447-5449, :5650), lo que permite inyectar un plan no persistido. X7 y X8: ciclo Cálculo → Monitoreo → Material → Monitoreo, se corrigen juntos con Material | router_monitoreo.R (congelado: el arreglo va a un archivo nuevo) | Pendiente; no bloquea. X7 y X8 esperan el turno coordinado con Material |
| 2d | **PII**: `enumerator_roster$assignments` (nombres y DNI de los encuestadores) es una lista de registros; `pulso_anonimizar_proyecto.R` y `pulso_detectar_pii` sólo recorren data.frames, así que ni se anonimiza ni lo ve el gate de proyectos de referencia | `api/scripts/pulso_anonimizar*` | **Cerrado** por la sesión Anonimizador (ec07d41d0): roster, asignación de Material y equipo del Planner se anonimizan y `pulso_detectar_pii` los ve |
| 2e | Telefónico: el lector del barrido descarta en silencio las filas sin Status (9 en el barrido RMS, hallazgo de Meta B en C8). Debe avisar cuántas quedaron fuera y por qué | lector del barrido de telefónico (`monitoreo_sheets_origen.R` / `monitoreo_telefonico_cola.R`); informe sin datos personales en `~/Documents/Pulso/01_Estudios/2026_ACNUR_RMS/Revision_barrido_RMS_2026-10-31.md` | Pendiente; no urgente |
| 8 | Limpiar los worktrees de agentes ya mergeados: `agent-a3c482c61f6bd5b8c` (A1) y `agent-ac16cbeac941345aa` (A2). `agent-adfbd8f406336e5eb` no es de este loop: verificar su dueño antes de tocarlo | `.claude/worktrees/` | Pendiente; no se borró al cerrar |

**Traspaso (2026-10-31):** lo que sigue de esta lista pasa a una sesión nueva que propone Meta B, con alcance `frontend/src/features/monitoreo/**` y `api/R/monitoreo_*`. La sesión que cerró el loop no vuelve a tocar Monitoreo.

## Decisiones que esperan a Gonzalo

| Pregunta | Contexto | Qué pasa con cada respuesta |
|---|---|---|
| A2: ¿la franja y «Qué rindió» deben usar la **misma** definición? | La franja cuenta lo que **declara el libro** (4 reemplazos, 5 refuerzos; `monitoreo_aulas_desenlaces_por_tipo`); la tabla cuenta las aulas **ya aplicadas** según su procedencia (8 y 0; `monitoreo_aulas_refuerzos` → `rendimiento`). Hoy cada bloque declara su base en el subtítulo (`f1725105f`) | Sí → unificar en el motor, en un solo criterio. No → queda como está |
| A3: Titulares con **seis** cifras (agrega «Reemplazados» para que sumen los 174 del sorteo; la maqueta tiene cinco que suman 182) | Decisión del agente, en la rama A3 | Aceptar, o volver a cinco |
| A3: Cobertura con **seis** tramos (agrega «Sin respuestas») y «Por encima de lo previsto» en azul de marca | Rama A3 | Aceptar o ajustar |
| Acreditación queda «sin guardar» al abrir el proyecto | Lo causa `.pulso_load_choice_maps`, que es deliberado (`test-carga-review.R:455`). Meta B lo muestra en el panel de L22 | Decidir si la migración al abrir debe marcar el proyecto como modificado |
| D10–D12, P17, universo de la cuota, umbrales, «Fecha de asignación» | Ver el GOAL y `aulas.md` §0 / §6 | Siguen abiertas |

## Cómo retomarlo

- Para capturar se usa el bundle de producción, no el dev server:
  - `vite build --mode development` en un worktree y `launch.R` en 8891.
  - Después, `scripts/ui-quick-check.mjs --url … --require-geometry --timeout-ms 420000`.
  - Las rutas van con `--route` y `&qaWarmup=skip`.
  - La cola de capturas se comparte con la sesión de Meta B (lock `locks/pesado` del scratchpad): las corridas van en serie.
- Proyectos: Aulas con una copia de trabajo de HSVG 2026; Territorial con `acnur_acg` (proyecto de referencia, copia de corrida).
- Nunca usar los puertos 8787 ni 5173, que son del usuario.
