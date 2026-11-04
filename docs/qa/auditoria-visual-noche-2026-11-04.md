# Auditoría visual de los nueve módulos (4 nov 2026, madrugada)

Encargo de coordinación (Meta B): recorrer el homepage y las secciones principales de cada módulo a 1440×1000 y
1024×600 con `acnur_acg` y `hsvg2026`, anotar lo que se ve mal o desfasado con su cláusula del Contrato de Superficie
(C1 declara qué es, C2 marco estable, C3 contiene su vacío, C4 todo alcanzable; C5 entrega lo que promete) y su
módulo dueño. Arreglar Home, Bitácora, Recopiladores y Gráficos; dejar anotado el resto para su sesión.

## Cómo se midió

Una pila propia de la sesión fuera del candado (Vite 5191, API 8891, `--keep-servers`) y el runner con `--url`:

```bash
UI_QA_API_PORT=8891 node scripts/ui-quick-check.mjs --url http://127.0.0.1:5191 --project <copia>.pulso \
  --route / --route /calc-muestra … --viewport 1440x1000 --viewport 1024x600 --sin-popovers --timeout-ms 420000
```

- `acnur_acg` (`cap/aud-acg`): 10 rutas × 2 viewports, 20 capturas y 20 md5 distintos.
- `hsvg2026` (`cap/aud-hsvg`): 9 rutas × 2 viewports, 18 capturas y 18 md5 distintos.
- Capturas en el scratchpad de la sesión (no versionadas).

**Aviso para quien lea capturas**: el Chromium headless del runner no resuelve Menlo; toda monoespaciada sale en Courier
en la captura aunque la pila de fuentes esté bien. En Electron sobre macOS resuelve Menlo. No es un hallazgo.

## Hallazgos

| # | Módulo (dueño) | Vista | Proyecto, viewport | Qué se ve | Cláusula | Estado |
|---|---|---|---|---|---|---|
| 1 | Home | Tarjetas de módulo | acg 1024 | El pie de la tarjeta se parte y el renglón nuevo empieza con el filete separador («\| 1,200 entrevistas», «\| Importado origen») | C2 | ☑ 5f3c71d67 |
| 2 | Home | Tarjetas de módulo | acg 1024 | Las dos filas difieren 2.7 px de alto con contrato `equal` (`equal-frame-drift`) | C2 | ☑ 5f3c71d67 (`grid-auto-rows: 1fr`) |
| 3 | Home | Tarjetas de módulo | acg y hsvg 1440 | La descripción se corta a media palabra («…selección de unidad…», «…para el equ»), contra la regla del propio Home | C1 | ☑ 5f3c71d67 (dos renglones) |
| 4 | Gráficos | «Prepara la base para graficar» | hsvg 1024 | `scroll-jail`: el bloque exige 420 px dentro de un cuerpo de 354 que no desplaza | C4 | ☑ 20b352708 |
| 5 | Bitácora | `/bitacora` | acg | Redirige a `/?panel=estudio` (Ficha del estudio): la Bitácora como página se retiró. El mapa de módulos de `CLAUDE.md` todavía la lista con sus secciones | — | ☑ 435e13b2e (`CLAUDE.md` › «Módulos y rutas», con el ADR 0124) |
| 6 | Bitácora | Ficha del estudio | acg | El nombre del estudio está vacío («Sin declarar todavía») mientras Cálculo › Estudio muestra «Encuesta a estudiantes» como título | C5 | ☑ 64912ee26: la Ficha manda (ADR 0124); Cálculo deja de editar su título, lo lee de la Ficha y adopta su copia, con test. Con la Ficha vacía, Cálculo muestra la copia que usa y el enlace para declararla |
| 7 | Recopiladores (Material de campo) | Campañas | acg y hsvg | Vacío correcto («Todavía no hay campañas») con su acción; sin hallazgos | — | sin cambios |
| 8 | Gráficos | Informe | acg 1440 | «GUARDADO» en versalitas junto a «0 láminas»: lo pinta `components/SaveStatusIndicator` (kit) | — | anotado al kit (ya estaba en el doc de Cálculo y Gráficos) |
| 9 | Monitoreo | Tarjeta del Home | acg | «1,283 de 1,200 efectivas, meta cumplida» con «86 % avance de meta»; en otra corrida la misma tarjeta dijo 107 %, y Monitoreo › Avance dice 107 % | C5 | ☑ (ver commit «la tarjeta territorial del Home…»): el porcentaje venía de `k$avance_pct`, calculado sobre otra meta; ahora se usa sólo si cuadra con efectivas sobre meta (±1 punto) y si no se deriva de ese par |
| 10 | Cálculo de muestra | Resumen del diseño | acg 1440 y 1024 | Grupo `calc-muestra/resumen-diseno` visible sin miembros visibles (`geometryCoverageMisses`) | C1/C3 | ☑ (commit «la franja de diseño vigente…»): sin ninguna cifra la rejilla `equal` no se monta y queda sólo «Sin cifra todavía». Captura acg 1440 y 1024 `ok=true`, 0 faltas de cobertura |
| 11 | Cálculo de muestra | Datos › Estudio | acg | Un estudio territorial (`acnur_acg`) abre Cálculo en modo «Conglomerados en aulas» con «Encuesta a estudiantes»; la franja «Sin cifra todavía» lista ocho cifras en un renglón | C5 | ☐ para la sesión de Cálculo |
| 12 | Formularios | Editor | acg 1024 | El Home dice «66 preguntas; el editor tiene abierto un borrador de 1 pregunta» y el editor abre ese borrador («Nuevo formulario», «pregunta_1») en vez del instrumento del estudio | C5 | ☐ para la sesión de Formularios |
| 13 | Procesamiento (Validación) | Explorar respuestas | acg 1440 | La base activa («Monitoreo territorial») arriba a la derecha va en monoespaciada: es un nombre, no un código | P8 | ☐ sin sesión asignada |
| 14 | Procesamiento (grilla compartida) | Carga › Datos y Analítica › Base final | acg | La cabecera fija tapa 32–41 px de la fila que asoma tras desplazar (`cabecerasQueTapan`) | C4 | ☑ 1f8075374: la fila de filtros perdía por especificidad y quedaba en `top: 0`, sobre la de nombres; ahora se ancla bajo ella con su alto real (`useAltoDeCabecera`) y las filas encajan bajo la cabecera al desplazar. Captura acg 1440 y 1024 en las dos vistas: `ok=true`, 0 cabeceras que tapan |
| 15 | Dashboard | Resumen de sección | pdm | «Cargando...» con tres puntos en un recuadro punteado | C3 | ☐ anotado en `formato-dashboard-2026-11-04.md` |
| 16 | Home | Composición | hsvg 1440 | Con tres módulos, la grilla queda centrada con ~280 px vacíos arriba | — | se queda: es la composición centrada declarada del Home |

## Bloqueo del gate al cerrar (4 nov, ~05:00)

`app/auditReadyRoutes` («Codificación y Validación exponen sus marcas de readiness») falla en el árbol compartido:
`validacion/tabs/ExplorarTab.tsx` tiene 3 marcas `validacion-explorar` y el contrato espera 2. En HEAD tiene 2: es
trabajo sin commitear de otra sesión en `validacion/`, no de esta. Los commits de Home y Gráficos se hicieron con el
resto del gate en verde (755 de 756 y 2,411 de 2,412).
