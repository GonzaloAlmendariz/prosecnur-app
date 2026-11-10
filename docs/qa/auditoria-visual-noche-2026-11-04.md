# Auditoría visual de los nueve módulos (4 nov 2026, madrugada)

Tipo: Auditoría QA fechada
Estado: En curso
Fecha: 2026-11-04
Autoridad: Encargo de coordinación (Meta B) para la madrugada del 2026-11-04

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
| 11 | Cálculo de muestra | Datos › Estudio | acg | Un estudio territorial (`acnur_acg`) abre Cálculo en modo «Conglomerados en aulas» con «Encuesta a estudiantes»; la franja «Sin cifra todavía» lista ocho cifras en un renglón | C5 | ☑ decidido por coordinación (Meta B), **revisable por Gonzalo**: manda la Ficha (ADR 0123 y 0124). Sin escenario guardado, Cálculo ya abría en el modo del tipo. Con un escenario guardado de otro modo, un aviso nombra las dos fuentes (si el tipo lo declaró la Ficha o se dedujo del estudio) y ofrece «Alinear con la ficha», que pasa por la confirmación de lo que se pierde; nunca se sobrescribe en silencio. Alinear con un estudio territorial deja el estudio guardado como territorial (antes sólo navegaba a Hojas de ruta y el escenario viejo volvía a abrirse). `diferenciaDeTipo.ts` con test, y la interacción del aviso con test. Captura acg 1440 y 1024 `ok=true`. El clic en vivo no se verificó: el warm start se colgó en 93 % por HMR |
| 12 | Formularios | Editor | acg 1024 | El Home dice «66 preguntas; el editor tiene abierto un borrador de 1 pregunta» y el editor abre ese borrador («Nuevo formulario», «pregunta_1») en vez del instrumento del estudio | C5 | ☑ la biblioteca del editor sólo tenía ese borrador, y nada en el editor sabía que el estudio ya tenía su instrumento (el XLSForm de la base, `instrumento_adaptado`). Ahora `/api/xlsform-editor/forms` trae `instrumento_del_estudio`. Si ningún formulario viene de ese archivo y todos son más chicos, el editor aterriza en la biblioteca, no en el borrador, y ofrece «Abrir el instrumento del estudio» (`/import-instrumento-estudio`), que lo agrega como un formulario más. El borrador no se toca y conserva su autosave. Tests en R y en vitest. Captura acg 1440 y 1024 `ok=true` |
| 13 | Procesamiento (Validación) | Explorar respuestas | acg 1440 | La base activa («Monitoreo territorial») arriba a la derecha va en monoespaciada: es un nombre, no un código | P8 | ☐ sin sesión asignada |
| 14 | Procesamiento (grilla compartida) | Carga › Datos y Analítica › Base final | acg | La cabecera fija tapa 32–41 px de la fila que asoma tras desplazar (`cabecerasQueTapan`) | C4 | ☑ 1f8075374: la fila de filtros perdía por especificidad y quedaba en `top: 0`, sobre la de nombres; ahora se ancla bajo ella con su alto real (`useAltoDeCabecera`) y las filas encajan bajo la cabecera al desplazar. Captura acg 1440 y 1024 en las dos vistas: `ok=true`, 0 cabeceras que tapan |
| 15 | Dashboard | Resumen de sección | pdm | «Cargando...» con tres puntos en un recuadro punteado | C3 | ☐ anotado en `formato-dashboard-2026-11-04.md` |
| 16 | Home | Composición | hsvg 1440 | Con tres módulos, la grilla queda centrada con ~280 px vacíos arriba | — | se queda: es la composición centrada declarada del Home |

## Bloqueo del gate al cerrar (4 nov, ~05:00)

`app/auditReadyRoutes` («Codificación y Validación exponen sus marcas de readiness») falla en el árbol compartido:
`validacion/tabs/ExplorarTab.tsx` tiene 3 marcas `validacion-explorar` y el contrato espera 2. En HEAD tiene 2: es
trabajo sin commitear de otra sesión en `validacion/`, no de esta. Los commits de Home y Gráficos se hicieron con el
resto del gate en verde (755 de 756 y 2,411 de 2,412).

## Segunda pasada: 1710×1107, 1366×768 y 1280×720 (4 nov 2026, mañana)

Encargo de coordinación: los otros tres anchos de la matriz de QA, con los mismos dos proyectos, arreglando todo salvo
`monitoreo/` y `validacion/` (ocupados por sus sesiones) y cuidando que el arreglo de un ancho no rompa los otros.

- `acnur_acg` (`cap/m3-acg`): 12 rutas (Home, Cálculo, Formularios, Hojas de ruta, Material, Monitoreo, Carga,
  Validación, Codificación, Analítica, Gráficos, Dashboard) × 3 anchos, 36 capturas y 36 md5 distintos, `ok=true`.
- `hsvg2026` (`cap/m3-hsvg`): 9 rutas × 3 anchos, 27 capturas y 27 md5 distintos, `ok=true`.

El runner no marcó nada en ninguno de los tres anchos. Los hallazgos salieron de mirar cada captura:

| # | Módulo (dueño) | Vista | Proyecto, ancho | Qué se ve | Cláusula | Estado |
|---|---|---|---|---|---|---|
| 17 | Hojas de ruta | Miga del mapa con una ciudad abierta | acg 1280 | «Lima y Callao **,** clic en un distrito…»: la coma inicial queda suelta por el hueco del contenedor flex (el mismo defecto que 5d2dd72ad arregló en otra miga) | C1 | ☑ 39f6cb854 (entre paréntesis) |
| 18 | Hojas de ruta | Miga del atlas | hsvg 1366 | «Perú **,** 26 ciudades con cartografía…», y sus variantes de departamento y ciudad | C1 | ☑ 39f6cb854, con test de las cuatro variantes |
| 19 | Hojas de ruta | Inspector › Marco territorial › Cartografía | acg 1280 | «Callao 2019 · Lima Metropolitana 2017»: `rotuloDeCartografia` (en `api/hojasRuta.ts`, fuera del guard del módulo) unía con « · » | P3 | ☑ 39f6cb854 (punto y coma: cada cobertura ya lleva comas), con test |
| 20 | Cálculo de muestra | Datos › Estudio | hsvg 1710 | ~100 px en blanco entre «Nombre y cliente se declaran en la ficha» y el alcance: la nota (64912ee26) cayó en la fila `1fr` de la grilla | C2 | ☑ c900e0e16 (fila propia) |
| 21 | Monitoreo | Cursos-horario › Avance › Por facultad | hsvg 1280 | «CAÍDOS SIN RELEVO» parte en dos renglones en la franja de cuatro cifras, y la columna izquierda deja un hueco alto bajo «Cuota por facultad» | C2 | ☐ para la sesión de Monitoreo |
| 22 | Carga | Plan › Qué tiene cada base | hsvg 1280 | El vacío «Aún no hay una base definida» flota en un área tintada alta (la fila vacía mide el alto del listado) | C3 | se queda: el vacío vive en su sección y dice cómo se llena |
| 23 | Home | Composición | hsvg 1710 | Con tres módulos, ~330 px vacíos arriba | — | se queda (composición centrada declarada, como el #16) |

**Control de los arreglos en los cinco anchos** (1710, 1440, 1366, 1280 y 1024), contra la pila de la sesión:
Cálculo y Hojas de ruta con `hsvg2026` (`cap/fx-hsvg`, 10 capturas) y Hojas de ruta › Territorio con `acnur_acg`
(`cap/fx-acg`, 5 capturas): `ok=true` en todas. Gate: tsc 0, Hojas de ruta 877 tests y Cálculo 3,033.

Formularios ya muestra el arreglo de su sesión (63d22771b: «El estudio ya tiene su instrumento… Abrir el instrumento
del estudio»), y Cálculo el aviso de tipo («El estudio se lee como Territorial presencial… Alinear con la ficha»):
los hallazgos 11 y 12 de la primera pasada quedan atendidos por sus dueños.
