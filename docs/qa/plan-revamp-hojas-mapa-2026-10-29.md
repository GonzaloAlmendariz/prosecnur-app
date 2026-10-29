# Plan — revamp de Hojas de ruta con el mapa como lienzo (2026-10-29)

Origen: prototipo aprobado por Gonzalo (`tmp/revamp-hojas-material/mapa2.html`, artefacto
https://claude.ai/artifact/RE6A3fibXXzeKMUEX28ZfX, versión 8) y su checklist
`docs/qa/checklist-revamp-hojas-mapa-2026-10-28.md` (paridad §7, capacidades §8 y §9).

## Principios que no se negocian

1. **El motor de R es la fuente de verdad.** El prototipo calcula en JS; en la app el N, las cuotas y el sorteo salen de `api/R`. La vista previa instantánea puede usar un espejo en TS del cálculo de tamaño, siempre que un test de contrato pruebe que da lo mismo que R sobre los proyectos de referencia. En el prototipo ya cuadró: 392 · 624 · 1.200 · ±2,83 % · 1.334 en `acnur_acg`.
2. **Nada crece en los congelados.** `HojasRutaPage.tsx` (8.908) y `hojas_ruta_engine.R` (10.305) quedan en su línea base. Lo nuevo va en archivos propios: `features/hojasRuta/mapa/**` y `api/R/hojas_ruta_<tema>.R`.
3. **Paridad antes de retirar.** La página vieja convive detrás de un interruptor hasta que la nueva cubra todo §7. El borrado lleva doble confirmación (gate 3).
4. **Cada unidad cierra con su gate y su commit.** Mínimo: `make gate-front AREA=hojasRuta`, más `pnpm -C frontend exec vitest run src/components src/lib` (el gate por área no cubre `tablasDelKit` ni `panelesDeclarados`), `tsc --noEmit` y `node agentic/sync-agentic-os.mjs --audit`. Si toca R: `make gate-area AREA=hojas_ruta`. Si toca UI: captura con `/ver-ui` sobre `acnur_acg` a 1440×1000 y 1024×600. Termina en `verificador`.

## Decisiones de Gonzalo (tomadas el 2026-10-29)

| # | Decisión | Opciones | Decidido |
|---|---|---|---|
| D1 | Dónde viven las secciones | (a) En la barra superior, como manda el ADR 0042 y como hacen todos los módulos; el lienzo gana el ancho del rail. (b) En un rail lateral como en el prototipo, con un ADR nuevo que reemplace al 0042 para este módulo | **(a) Barra superior** |
| D2 | Dónde vive el Avance de campo (A1, A2) | (a) En Monitoreo territorial, que ya lee `hojas_ruta_runs` y tiene su mapa; Hojas enlaza. (b) Como sección «Campo» de Hojas que lee de Monitoreo | **(a) En Monitoreo**; Hojas enlaza |
| D3 | Las etapas bloqueadas (decisión pendiente del brief original) | Bloquear en duro, como hoy, o dejar entrar a cualquier sección y mostrar qué falta | **Entrar y ver qué falta** |
| D4 | El filtro del marco, las exclusiones y el N inflado cambian el diseño muestral | Sí, con revisión metodológica y su ADR | **ADR + revisión metodológica** |

## Fases y unidades

Cada unidad es un commit. «Dueño» es el agente que implementa; las revisiones van en paralelo y el lead integra.

### Fase 0 · Contrato (1 unidad)

| U | Qué | Dueño | Gate |
|---|---|---|---|
| U0 | **ADR 0114 «Hojas de ruta: el mapa es el lienzo»**, que fija: secciones (según D1), las cinco regiones (barra, estructura, lienzo, inspector, cajón), el contrato de datos de la geometría compacta, el límite con Monitoreo (D2) y Material (E2), y el marco elegible (D4). Las secciones e ids **no cambian** (ADR 0108 §5): «Entrega» no vuelve, y sus salidas, el plan de campo, el informe y el envío viven en el panel `salidas` de Selección. Los paneles nuevos quedan en el ADR y se declaran en `PANELES_POR_MODULO` recién en U4, cuando se montan (un panel declarado sin superficie haría que el QA abra algo inexistente) | lead | documental: no toca código |

### Fase 1 · El lienzo cartográfico (3 unidades)

| U | Qué | Dueño | Gate |
|---|---|---|---|
| U1 | **Geometría compacta por distrito** en el backend: `api/R/hojas_ruta_geometria.R` + `GET /api/hojas-ruta/geometria?ubigeo=`. Manzanas (id, viviendas, zona, NSE por nivel en texto, anillos en metros con origen común), vías mayores con nombre y zonas. Douglas-Peucker con anillos partidos en su punto más lejano; gzip; caché en `~/.prosecnurapp/cartografia_cache`. Test: Ate trae 8.916 manzanas, ningún anillo colapsado y el NSE «Bajo» domina | `backend-r` | `make gate-area AREA=hojas_ruta`; test nuevo `test-hojas-ruta-geometria.R` |
| U2 | **Componente `LienzoMapa`** (`features/hojasRuta/mapa/lienzo/`): Canvas con un `Path2D` por pieza y su caja, dibujo solo de lo visible, capa base en un lienzo aparte que se reutiliza escalada al moverse, cámara con vuelo (≤ 620 ms y respeto de reduced-motion), rueda ×0,0065 y pellizco ×0,014, capas Manzanas · Viviendas · NSE, flotantes (miga, capas, leyenda, escala, zoom). Carga por distrito al confirmarlo | `frontend-react` | vitest de cámara y recorte; **presupuesto de rendimiento**: armar SJL < 100 ms y capa base < 20 ms (medido en el prototipo: 40 ms y 16 ms) |
| U3 | **Capas de dominio sobre el lienzo**: titulares (protagonistas, color del módulo; rojo y ámbar solo si la titular tiene problema), reemplazos discretos y numerados sin líneas, rótulos de distrito con anticolisión, contorno de los 50 distritos | `frontend-react` | vitest; captura con `/ver-ui` |

### Fase 2 · El esqueleto nuevo (1 unidad)

| U | Qué | Dueño | Gate |
|---|---|---|---|
| U4 | **`HojasRutaMapaPage`** con barra del documento (fase y regla del piloto, lo decidido, por revisar, bitácora, enviar), estructura, lienzo, inspector y cajón de tablas. Montada con `lazyWithReload` y detrás de un interruptor (`?vista=mapa` en dev). Usa el store del feature; los overlays con `usePanelDireccionable` (`?panel=`). Registra su readiness `data-audit-ready` | `frontend-react` | gate front; contrato de superficie C1–C4 con `ui-quick-check` |

### Fase 3 · Paridad, una sección por unidad (6 unidades)

Cada una conecta los endpoints que ya existen; ninguna inventa cálculo en el front.

| U | Sección | Qué incluye (de §7) | Dueño |
|---|---|---|---|
| U5 | Territorio | Mapa de los 50 distritos, clic agrega o quita, catálogo con interruptores y buscador, zonas de Lima, borrador frente a confirmados, «Confirmar selección» con la consecuencia dicha, arranque vacío | `frontend-react` |
| U6 | Población | Editor de rangos (peso por rango, aviso de huecos y solapes, presets), cortes por terciles a deciles, sexo, agrupar filas, matriz y proporcional en el cajón, Excel | `frontend-react` |
| U7 | Muestra | Inspector con el motor completo (tres lógicas del N, márgenes, p, DEFF con guía ICC, respuesta, asignación, FPC, ajustes, alternativas, «¿De dónde sale?»), reparto por distrito editable y pegable, cuotas en el cajón. **Espejo TS + test de contrato contra R** en `acnur_acg` y `hsvg2026` | `frontend-react` + `autor-regresiones` (contrato) |
| U8 | Manzanas (sorteo) | Método con diagrama, ponderar, semilla con «Otra», esquina, salto con K de vista previa, reemplazos 0–10 y su política, historial de ruteos | `frontend-react` |
| U9 | Selección | Rutas por distrito con «por revisar», ficha de la UMP con reemplazos en orden, revisión contra el marco, tablas de titulares, reemplazos y cuotas en el cajón | `frontend-react` |
| U10 | Selección › panel `salidas` | ZIP con progreso, Excel operativo, reemplazos puntuales en filas con interruptor, PDF de prueba | `frontend-react` |

Revisión de fase: `qa-visual-desktop` (matriz de 5 viewports) + `guardian-contratos` + `verificador`.

### Fase 4 · Capacidades nuevas (7 unidades)

| U | Capacidad | Backend (archivo nuevo) | Front | Revisión |
|---|---|---|---|---|
| U11 | **Marco elegible**: mínimo de viviendas + áreas excluidas con motivo (B2) + aviso de zonas que no alcanzan (B4) | `hojas_ruta_marco_elegible.R`: el filtro entra al sorteo y al reparto por zonas; las exclusiones se guardan en la config del run; aviso `W_ZONE_SHORT_BEFORE_DRAW` (registrado en `errors_registry.R`) | Inspector de Sorteo; dibujo del polígono en el lienzo | `revisor-metodologico` (D4) |
| U12 | **No respuesta e ICC medido** (B3): `inflate_for_response` + biblioteca de ICC por estudio, que traslada el ICC y no el DEFF | `hojas_ruta_tamano_extras.R` | Supuestos de Muestra | `revisor-metodologico` |
| U13 | **Comparar semillas** (B5): sorteo en seco con otra semilla y métricas (NSE frente al marco, por revisar, km, mediana) | `POST /sample-preview?dry_run=1` en un archivo nuevo | Sorteo | — |
| U14 | **Plan de campo y costo** (B1): jornadas por cercanía, días según encuestadores, costo en vivo junto al N y en los escenarios | Persistir plan y supuestos de costo en el run | Entrega y Muestra; escenarios | — |
| U15 | **Vista previa de la hoja de ruta** (C1) y **hoja del día** (C3) | Endpoint que devuelve la ficha de una UMP (PNG o PDF de una página) con el motor PDF actual; motor nuevo `hojas_ruta_hoja_dia.R` con el kit Pulso PDF | Overlays con `?panel=hoja&foco=<ump>` | `especialista-entregables`; QA visual leyendo el render |
| U16 | **Informe de diseño muestral** (C2): botón sobre `POST /reporte-decisional`, que ya existe; se le suman marco elegible, plan y costo | Ampliar el reporte en archivo nuevo | Entrega | `especialista-entregables` |
| U17 | **Bitácora de decisiones** (D1) persistida en el `.pulso` (`hojas_ruta_runs$bitacora`) | `hojas_ruta_bitacora.R`; se escribe desde cada endpoint que muta | Overlay `?panel=bitacora` | `guardian-contratos` (persistencia `.pulso`) |

### Fase 5 · El lazo con el campo (2 unidades; depende de D2 y de E2)

| U | Qué | Dueño |
|---|---|---|
| U18 | **Avance por UMP y activación de reemplazos con motivo** (A1, A2) sobre el lienzo compartido, montado en Monitoreo territorial (D2); Hojas enlaza. El motivo y la tasa de reemplazo quedan para el próximo estudio | `frontend-react` + `backend-r` (Monitoreo) |
| U19 | **Envío a Material** (A3) con la vista previa de la campaña territorial | espera E2 (`ump_territorial_v1`) |

### Fase 6 · Retiro y cierre (1 unidad)

| U | Qué |
|---|---|
| U20 | Quitar el interruptor, retirar `HojasRutaPage.tsx` con doble confirmación (gate 3) y ADR, bajar su línea base en `agentic/manifest.json`, migrar o borrar los tests de la página vieja, matriz visual completa, `verificador`, `/cerrar-trabajo`. Notas de versión con `/notas-parche` |

## Orden y paralelismo

- **Serie obligatoria:** U0 → U1 → U2 → U4. El resto depende del contrato, del lienzo y del esqueleto.
- **En paralelo después de U4**, con dos escritores como máximo y globs sin solape: U3 con U5, U6 con U7 y U8 con U9.
- **Fase 4:** los backends U11, U12 y U13 pueden ir en paralelo con sus fronts, siempre que el contrato se congele antes.
- **Fase 5** queda fuera del camino crítico: U18 vive en Monitoreo (D2) y U19 espera a E2.

## Riesgos y cómo se cubren

| Riesgo | Cobertura |
|---|---|
| El espejo TS del cálculo diverge de R | Test de contrato en dos proyectos de referencia; R manda al guardar |
| Rendimiento con muchos distritos | Presupuesto de rendimiento en U2; carga por distrito; caché de la capa base |
| El sorteo deja de ser reproducible por el marco elegible o las exclusiones | Exclusiones y mínimo en la config del run, más la bitácora (U17) |
| Romper consumidores de `hojas_ruta_runs` (Monitoreo, Ficha técnica, Diseño del estudio) | `guardian-contratos` en U11, U12 y U17; no se renombran campos existentes |
| Dos páginas conviviendo demasiado tiempo | Interruptor con fecha de retiro en el ADR; U20 en el plan |

## Qué no entra

- Marco fuera de Lima y Callao (ítem D2 de la §9 del checklist): es un proyecto aparte de datos.
- Neyman y cuotas distintas de sexo y edad: no existen hoy y nadie las pidió.
