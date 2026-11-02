# Checklist · Verificación de lo construido el 1 y 2/11 — 2026-11-02

Encargo de coordinación, con la autorización de Gonzalo de esa noche: comprobar «que lo construido esté todo bien,
mejoras palpables» y que «toda la app esté consistente», sin consultarle. Lo que dependa de él va «para la mañana».
Reglas: sin push, sin relanzar ni reinstalar backends, sin borrar páginas fuera del ADR 0124 y sin cambiar cifras
visibles. Si un defecto cae en un archivo con cambios sin commit de otra sesión, se reporta con su dueño.

Universo: `git log --since="2026-11-01 00:00"`, con 201 commits, 143 de ellos de código. Las corridas pesadas van en
serie con el candado `pesado.sh` de las notas compartidas, porque el de octubre ya no existía.

## Inventario por área (commits de código)

| Área | Commits | Frontend tocado | Backend tocado |
|---|---|---|---|
| Monitoreo (aulas, territorial, telefónico, acreditación, core) | 38 | `features/monitoreo` (109 archivos) | `monitoreo_*`, `router_monitoreo.R` |
| Hojas de ruta | 24 | `features/hojasRuta` (104) | `hojas_ruta_*`, `router_hojas_ruta.R` |
| Formularios (impreso, Word, Constructor) | 20 | `features/xlsformEditor` (94) | `reporte_formulario_*`, `xlsform_*` |
| Material de campo | 19 | `features/recopiladores` (27) | `collection_*` |
| Planner y estudio (ADR 0123, 0124) | 14 | `features/bitacora` (borrada), `features/estudio` | `planner_*`, `router_planner.R` |
| Carga y procesamiento | 9 | `features/carga`, `procesamiento` | `carga_platform_jobs.R`, `surveymonkey_multibase.R` |
| Home | 4 | `features/home` | `project_overview` |
| Kit, gate y QA | 6 | `components`, `scripts` | — |
| Cálculo de muestra | 3 | `features/calcMuestra` | `calc_muestra_identidad.R`, representatividad |
| Analítica, codificación, PDF | 4 | `features/analitica`, `codificacion` | `pulso_pdf_theme.R` |

## Gates

| Gate | Alcance | Resultado |
|---|---|---|
| R, `gate-area` con patrón | las suites tocadas el 1 y 2/11 y sus vecinas por patrón: 60 suites (54 del área + 6 transversales) | verde sobre d7ec9eef8: 2933 pass, 0 fail, 0 suites rotas |
| Front, `gate-front` por área | monitoreo (6575), hojasRuta (808), xlsformEditor (1667), recopiladores (1721), carga (1419), calcMuestra (2955), home (712), analitica (861), codificacion (813), procesamiento (650), components (828), cada uno con sus transversales | un solo rojo, el mismo en las 11 áreas: `inputsDelKit` (hallazgo 1, saldado en 2b3420a32) |
| Typecheck | árbol entero | rojo en e8aafb4b4 por `modulesNavigation.test.ts` (hallazgo 3); verde desde 3881304c5 |

## Capturas (ui-quick-check, 1440x1000 salvo que se diga)

| Proyecto | Perfil | Rutas | Resultado |
|---|---|---|---|
| hsvg2026 | aulas | `/monitoreo?seccion=avance`, `?seccion=control`, `/material-campo`, `/calc-muestra`, `/?panel=estudio`, a 1440x1000 y 1024x600 | 10 capturas, 0 issues; pero Monitoreo no entra a aulas: el `.pulso` de referencia no trae `monitoreo_config` y abre el selector con aulas «Sugerido». Las dos secciones dieron la misma imagen (8 de 10 distintas), así que no prueban nada de aulas (hallazgo 5) |
| acnur_acg | territorial | `/monitoreo?seccion=control`, `?seccion=avance`, `/hojas-ruta`, `/editor-xlsform`, `/carga`, a 1440 y 1024 | 10 capturas distintas, 0 issues; `desplazamientoH=2` a 1024 (hallazgo 6); segmentado ilegible en Hojas de ruta (hallazgo 4) |
| acnur_pdm | telefónico | `/monitoreo?seccion=insumos`, `?seccion=avance`, `/material-campo`, a 1440 y 1024 | 6 capturas distintas, 0 issues |
| acrconta | acreditación | `/monitoreo?seccion=avance`, `?seccion=modelo`, `/calc-muestra`, a 1440 y 1024 | 6 capturas distintas, 0 issues; «sin guardar» al abrir, explicado (hallazgo 7) |

## Hallazgos

| # | Hallazgo | Commit de origen | Evidencia | Estado | Dueño |
|---|---|---|---|---|---|
| 1 | Contrato `inputsDelKit` en rojo en `main`: casillas nuevas en `recopiladores/correos/EncuadreDeFoto.tsx` y `VistaParaRevision.tsx` | deac41f80 | el mismo rojo en los 11 gates de área: «Casillas nuevas en …: 0 → 1» | arreglado en 2b3420a32: las dos casillas pasan a `PulsoSwitch` (K1); contrato y suites de correos 1097/1097; falta verlo en pantalla | Material (hojas-material) |
| 2 | `moduleCardModel.ts` conserva la tarjeta de la Bitácora (`case "diseno-estudio"`, `facts.bitacora`, `dateViz`) sin consumidor tras el ADR 0124 | e8aafb4b4 | sólo la alcanza un slug desconocido | reportado | Revamp (Home) |
| 3 | Typecheck en rojo: `EXPECTED_PRIMARY_NAVIGATION` exigía la clave `diseno-estudio`, que sigue en la unión de slugs como legado | e8aafb4b4 (mío) | `tsc`: TS2741 en `modulesNavigation.test.ts:24` | arreglado en 3881304c5; `tsc` 0, el test 9/9 | Planner (esta sesión) |
| 4 | El segmentado «Todos · 50 / Elegidos · 6» del Territorio (y todos los `hr-muestra-opciones` del lienzo) pinta la opción activa en el acento con el texto del mismo color, ilegible | regla de una sola clase que empata con el indicador del kit en `theme.css` | captura de acnur_acg en `/hojas-ruta` a 1440 y 1024 | arreglado en a0ee2b850 (selector compuesto), con el contrato nuevo `indicadorDelKit` (transversal, ratchet de los seis selectores de una clase que quedan; 3/3); visto en pantalla: «Todos · 50» se lee a 1024 (`cap3-hojas`) | Hojas de ruta |
| 5 | Monitoreo de aulas no se pudo capturar con el `.pulso` de referencia: no elige ruta y abre el selector; `--click-tab "Elegir"` se aplica a cada ruta y cuelga la segunda | — (el comportamiento es del ADR 0122 P2, no una regresión) | `state.rds` de hsvg2026 sin `monitoreo_config` | resuelto para la verificación: copia con `aulas_universitarias` elegido (R, `build_pulso`); Brechas, Agenda, Resumen y Cursos-horario capturados a 1440 y 1024 | — |
| 6 | A 1024, la Bandeja de Control (264 px) y Faltante (164 px) de Monitoreo territorial esconden Motivo, Distancia y Duración tras un desplazamiento horizontal sin indicio visible | — | `desplazamientoHDetalle` de acnur_acg | observación: el contrato lo permite; `features/monitoreo` tiene cambios sin commit de otra sesión, no se toca | Monitoreo |
| 7 | acrconta queda «sin guardar» sólo con abrirlo | — | `project_status`: «choice_code_mapping (migrado al abrir un .pulso antiguo)» | no es defecto: migración declarada de un `.pulso` viejo | — |
| 8 | Seis segmentados más redefinen el indicador con una sola clase (`cmg-metodos`, `cmv2-aulas-modalidad`, `pulso-emparejamiento-filtro`, `home-settings-nav`, `rec-mail-tabs`, `rec-caja-vistas`): el mismo empate que el hallazgo 4 | varios | contrato `indicadorDelKit` | congelados en el ratchet; no observados en pantalla, no se tocan sin verlos | Cálculo, Carga, Revamp (Home), Material · 2026-11-02, los dos de Material vistos en pantalla con un correo creado sobre una copia de acnur_acg (1024): `rec-mail-tabs` pinta la activa en verde sobre su fondo al 13 % y `rec-caja-vistas`, texto oscuro sobre el indicador blanco; los dos se leen. El empate de la regla de una sola clase no los vuelve ilegibles; quedan en el ratchet sin tocar |
| 9 | Monitoreo de aulas sin datos de campo: los vacíos se contienen (C3), pero estiran su marco. Agenda deja 245 px sin usar en «Sin cita» y «Citas vencidas»; Cursos-horario deja un hueco entre filas a 1024 (`capacity-drift`, C2) | — | `cap3-aulas`: `geometryIssues=3` en `aulas-agenda-listas` y `aulas-cursos` | reportado; `features/monitoreo` tiene cambios sin commit de otra sesión | Monitoreo |
| 10 | El pie del riel de aulas dice «Sin act.» cortado dentro de su chip, donde los otros perfiles dicen «CORTE 09/07 07:24» | — | capturas de aulas a 1440 y 1024, abajo del riel | reportado (mismo motivo) | Monitoreo |
| 11 | En Hojas › Muestra a 1024 el rótulo «Corrección por población finita (FPC)» desborda 5 px | — | `cap3-hojas`: `overflow-x` en `.pulso-switch-field-label` | arreglado en 175a4e3e6: baja de línea en el inspector angosto (`angosto.css`), sin tocar el `nowrap` del kit; recaptura a 1024 y 1280 con `issues=0`; gate hojasRuta 811/811 | Hojas de ruta |
| 12 | En Hojas a 1024, «Entre-vistas» y «Contac-tos» se cortan con guion en las cifras del inspector (`rotulo-partido`) | 81f61c795 | `cap3-hojas`: `rotulosPartidos=2` | observación: el guion fue decisión deliberada del dueño («en vez de partirse en cualquier letra»); el detector la marca igual, decide Hojas | Hojas de ruta · ☑ 2026-11-02 (Hojas decide): ninguna palabra se parte. Las cifras reparten la fila y ninguna baja de su palabra más larga (`min-width: min-content`); si no cabe, pasa a la fila siguiente. Medido en las cinco secciones a 1440 (todas en una fila) y 1024 (Muestra y Manzanas en dos), sin cortes ni desbordes |
| 13 | Los switches de correos (hallazgo 1) no se pudieron ver en pantalla: ningún proyecto de referencia trae una campaña de correo | 2b3420a32 | `material_campaigns` vacío en los cuatro `state.rds` | pendiente de verlo en vivo con un estudio que tenga correo | Material · ☑ 2026-11-02, visto en vivo con un fixture mínimo (campaña de correo creada sobre una copia de acnur_acg, foto de prueba generada en el navegador): «Invitación de prueba» en Exportar › Vista para revisión y «Quitar los márgenes de la imagen» en un Destacado con foto; los dos se nombran por su rótulo (aria-labelledby) y alternan con un clic |
| 14 | C5: al guardar un nombre en la Ficha del estudio, el chip del proyecto y el h1 del Home siguen con el nombre del archivo (lo vio Revamp) | e8aafb4b4 (mío) | dos causas: el chip lee `project_status$name`, que es el archivo; el Home sí recibe el nombre declarado en el overview (ya con test de las dos ramas), pero guardar la Ficha no le avisaba que releyera | arreglado: `project_status$nombre_estudio` (declarado o, sin declarar, el archivo; `name` sigue siendo el archivo, que es el nombre por defecto al guardar como) y la Ficha emite `pulso:project-status-changed` y `pulso:estudio-cambio` al guardar. Tests: R de las dos ramas en `test-project-pulso.R` y vitest `workspaceNombre.test.ts`. Commit d634cddfa; gate R 725/0. Falta verlo en vivo: el cambio de R exige relanzar el backend, que esta noche no se toca | Planner (esta sesión) |
| 15 | Typecheck en rojo por trabajo en curso: `AulasMonitoreoPage.tsx:2092` pasa `publicarLibro` a `ContextoDeSalidas`, que no lo declara | sin commit (Monitoreo, aulas) | `tsc` a las 02:5x, 6 archivos de aulas modificados en el árbol | reportado; no se toca trabajo ajeno sin commit | Monitoreo |

## Ítem 7 del retiro del Planner

Backend dormido de la Bitácora: **bloqueado**. El ADR 0124 §4 dice que las claves de la Bitácora se conservan en los
`.pulso` y nadie las borra; no decide retirar `router_bitacora*.R`, `plan_trabajo` ni `planner_calendario.R`. Borrarlos
sin esa decisión excede lo autorizado esta noche. Va para la mañana: enmendar el ADR o dejarlo dormido.

## Segunda pasada (2/11, mañana)

Encargo de coordinación tras el «Sigue» de Gonzalo: lo que entró desde ~01:30 (cadena de Sheets R13, R6, R8, R14 y R15
de Material, a517d2ece, f46f263e6, 4206995f8 y e4d104f9f), un build de producción y gates y capturas por perfil. Se
interrumpió para el ADR 0125 (9f5f73608, 166b6c71c) y se retomó después.

| Paso | Alcance | Resultado |
|---|---|---|
| Build de producción | `vite build` del árbol en bcad195fc, en una carpeta temporal, servido por un Plumber propio en el 8895 con la copia de hsvg2026 en aulas | compila sin error; con el bundle montan los 12 destinos (Home y Ficha, Cálculo, Formularios, Hojas, Material, Monitoreo en `monitoreo-aulas-avance-porfacultad`, Carga, Validación, Codificación, Analítica, Gráficos, Tablero), sin errores sin capturar; sólo dos 409 de `validacion/v2/explorar/variables` en un proyecto sin base |
| QA anterior a 9d500b2b5 | ¿vale la QA de la primera pasada? | sí: `ui-quick-check` levanta Vite en desarrollo (`scripts/ui-quick-check.mjs:491-497`), no el bundle; el TDZ de app-core ↔ monitoreo-core sólo existía en el build |
| Front, `gate-front` por área | monitoreo (6578), recopiladores (1730), home (715), calcMuestra (2959), analitica (864), aulasFlow (641), estudio (641), project (663), hojasRuta (811), cada uno con sus transversales | verde en las nueve |
| Typecheck | árbol entero | 0 errores: el hallazgo 15 se cerró cuando aulas commiteó su trabajo |
| R, cadena de Sheets R13 | `gate-area` con patrón `libro\|sheets\|entrega\|publicar` (suites con `helper-sheets-mock.R`, sin red) | 3971 pass, 0 fail. En el front, `tablasEnSheets.test.ts` y `DeliverySection.test.tsx` prueban el orden y los cortes con dobles |

Capturas de la segunda pasada, todas distintas (`md5`):

| Proyecto | Rutas y viewports | Resultado |
|---|---|---|
| hsvg2026 aulas | Insumos › Fuentes, Avance › Salidas, Control y Cálculo, a 1440 y 1024 | 8 de 8 distintas, 0 issues. El `ok=false` lo causó la dirección que pedí: Fuentes es una pestaña de Insumos y el runner aterrizó bien. «Construir en Material» se ve en Salidas (hallazgo 18) |
| acnur_acg territorial | Avance, Control, Analítica y Validación, a 1280 y 1024 | 8 de 8 distintas; 80 issues, todos en Control › Bandeja a 1024 (hallazgo 17) |
| acnur_pdm telefónico | Avance e Insumos, a 1440 y 1024 | 4 de 4 distintas, 0 issues |
| acrconta acreditación | Avance y Modelo, a 1440 y 1024 | 4 de 4 distintas, 0 issues |

Material › Entrega (R13, R14 y R15) no se pudo ver en pantalla: ningún `.pulso` de referencia trae campañas, y
Material aterriza en `vacio:sin-campanas` (lo mismo que el hallazgo 13).

### Hallazgos de la segunda pasada

| # | Hallazgo | Commit de origen | Evidencia | Estado | Dueño |
|---|---|---|---|---|---|
| 2 | (de la primera pasada) tarjeta muerta de la Bitácora en `moduleCardModel.ts` | e8aafb4b4 | — | cerrado por 0c44980cd | Revamp |
| 6 | (de la primera pasada) a 1024, la Bandeja territorial escondía Motivo, Distancia y Duración | — | `p2-acg`, Control a 1024: las ocho columnas se ven, `desplazamientoH=0` | resuelto con el `bandeja.css` en curso de Monitoreo; ver el 17 | Monitoreo |
| 10 | (de la primera pasada) «Sin act.» cortado al pie del riel de aulas | — | `p2-aulas`: el chip dice «Sin corte» entero | cerrado | Monitoreo |
| 15 | (de la primera pasada) typecheck en rojo por trabajo de aulas | — | `tsc` 0 | cerrado | Monitoreo |
| 16 | Monitoreo no montaba con el bundle de producción entre e8aafb4b4 y 9d500b2b5 | e8aafb4b4 (mío, por el chunk de `panelEstudio.ts`) | arreglado por 9d500b2b5 | verificado con el bundle: montan los 12 destinos | Planner (esta sesión) |
| 17 | En Control › Bandeja a 1024, el botón del código de caso desborda 2–4 px (60 px de caja, 62 de contenido: 80 `overflow-x` y 16 `texto-fuera`), y «R144» se parte en la columna UMP (5 `rotulo-partido`) | `bandeja.css` sin commit de Monitoreo | `p2-acg/report.json` | reportado a Monitoreo; es su archivo con cambios en curso | Monitoreo |
| 18 | En Avance › Salidas de aulas, «Libro del operativo» ofrece «Construir en Material», pero su línea dice «Se conecta en Insumos › Fuentes»; la vista previa cierra con un «·» suelto | 347a18545 | `p2-aulas`, Salidas a 1024 | reportado a Monitoreo | Monitoreo |

### Corte de la segunda pasada sobre 856c97999

Lo que entró después de 0fc705e23: ADR 0125 en código (32f208721, 856c97999), envío por cuotas de Hojas
(e84b0165d), territorial por cuotas en Material (9441c48b6), tablas construidas y distribución de aulas en Monitoreo
(9494202a4, 4dd011300), las efectivas del Home (2cb7659e9, 75bce08bc), la Bandeja y Faltante a 1024 (192274eb8,
62361f04e) y el ratchet del indicador de Cálculo (866036a52).

| Gate | Alcance | Resultado |
|---|---|---|
| R, `gate-area` con patrón | handoff a carga, envío de Hojas por cuotas, tablas de aulas, overview y efectivas de Monitoreo, campañas, Planner y overview del proyecto, más los transversales | 1007 pass, 0 fail |
| Front, `gate-front` | monitoreo (6581), home (717), calcMuestra (2960), recopiladores (1733), hojasRuta (817) y components (832), con sus transversales | verde en las seis |
| Typecheck | árbol entero | 0 |

El hallazgo 17 (Bandeja a 1024) lo tomó Monitoreo en 192274eb8; falta recapturarlo. El 18 sigue abierto con su dueño.

Recaptura a 1024 sobre bde2547c3:
- **Hallazgo 17, cerrado** por 192274eb8: Control › Bandeja de acnur_acg da `ok=true`, 0 issues, `desplazamientoH=0`.
- **Hallazgo 18, cerrado** por bde2547c3: en Avance › Salidas de hsvg2026 (aulas), la fila del libro dice «Material lo
  arma sobre el Sheets del estudio, en Material › Entrega». «Construir en Material» queda activo aunque todavía no
  haya libro, y la vista previa sin plan es un vacío limpio, sin separador colgado.
- El `ok=false` de esa captura es un 409 de `/api/monitoreo/aulas/avance-tablas`: el vacío esperado de un proyecto sin
  plan de aulas, el mismo que la pantalla declara. 0 issues visuales.

## Tercera pasada (2/11, desde las 08:00)

Encargo de la coordinación tras el «Ya volvimos» de Gonzalo. Alcance:
- cuotas de punta a punta: e84b0165d, 9441c48b6, 5c710ec16, a09329446, b3003cc50, 0e82e4f51, 25e8c9243, a188f16bf;
- supervisión: ea6b50a14, bb86b0252, 3b9779174, 51cf4f62c;
- barrido: ae2814128, 1cefd3326;
- padrón: f42e758f9, 5896629cd;
- canales: c36597d3d;
- guardas 409: d3c62f254;
- efectivas: 2cb7659e9.

Antes, el A3 del ADR 0125 dejó dicho que el catálogo del Veredicto es propuesta de Hojas, revisable por Gonzalo
(9bba5c4d5).

| Gate | Alcance | Resultado |
|---|---|---|
| R, `gate-area` con patrón | las 15 suites que tocaron esos commits, más campañas, Planner, correo y los transversales (sobre 9bba5c4d5) | 5223 pass, 1 fail: `test-errors-registry`, por `errors_registry.R` sin commit de otra sesión; aislada después, 6/6 (hallazgo 19) |
| Front, `gate-front` | monitoreo (6587), recopiladores (1748), hojasRuta (822), lib (932), api (1225), con sus transversales | dos rojos, cada uno con su dueño (hallazgos 20 y 21) |
| Typecheck | árbol entero | 0 |

Capturas a 1440x1000, una por perfil, todas con `ok=true` y 0 issues:

| Proyecto | Rutas | Lo que se ve |
|---|---|---|
| copia de acnur_acg declarada en cuotas | Hojas de ruta, Monitoreo › Avance y Material | Hojas aterriza en Territorio · Población · Muestra · Entrega, el modo cuotas (`/api/planner/modos`: `modo = cuotas`, `aplica = TRUE`). Monitoreo sigue por UMP, y es lo correcto: el envío guardado es por UMP y declarar cuotas no reenvía. El avance por zona y celda (25e8c9243, a188f16bf) sólo se ve con un envío `kind = "cuotas"`, que ningún `.pulso` de referencia trae; lo cubren `test-hojas-ruta-envio-cuotas` y `test-monitoreo-territorial-cuotas` |
| acnur_acg | Monitoreo › Avance | sin cambios visibles respecto de la segunda pasada |
| hsvg2026 aulas | Monitoreo › Avance | limpio |
| acnur_pdm | Monitoreo › Avance | limpio |
| acrconta | Monitoreo › Modelo | limpio |

Contrato contra código:
- **Supervisión (A3):** Material cumple. Id `supervision.<lote_id>`, `relacion$viene_de = "telefonica.principal"`, las tres
  columnas fijas y el catálogo del Veredicto (`collection_campaigns_supervision.R`).
- **Barrido (A2):** la app siembra sólo la estructura y el analista pega los nombres y teléfonos. Faltaba en el ADR la
  separación barrido/control, que Gonzalo decidió y el código ya cumple (1cefd3326, d3c62f254); quedó en el A2
  (31e47423d), con la duda de las columnas sensibles para Gonzalo.

### Hallazgos de la tercera pasada

| # | Hallazgo | Commit de origen | Evidencia | Estado | Dueño |
|---|---|---|---|---|---|
| 19 | `test-errors-registry` cae en el gate con `errors_registry.R` modificado sin commit | trabajo en curso de otra sesión | aislado sobre 5e6010d5f: 6/6 | observación: se cierra cuando esa sesión commitee | Monitoreo |
| 20 | `materialCampanas.test.ts` espera cuatro tipos y ya son cinco, con `supervision` | ea6b50a14 | `gate-front api`: 1 fail | cerrado por Hojas en aef9f3e62 (api 1225/1225) | Hojas (Material) |
| 21 | `estadosAtadosAlMotor.contract.test.ts`: `en_zona` sigue en `VOCABULARIO_PROPIO`, pero el motor ya lo publica | 25e8c9243 / a188f16bf | `gate-front monitoreo`: 1 fail, también aislado | reportado | Monitoreo |
| 22 | A3, lectura de Monitoreo: `supervision/resultados/leer` todavía leía las pestañas «Ronda N» de su hoja propia, no la base de Material por `llave` y lote | — | `monitoreo_supervision_rondas.R:541` | en obra: `monitoreo_supervision_desde_material.R` sin commit; ca7e5052b ya dice que «Monitoreo la lee por lote» | Monitoreo |
| 23 | No se puede ver el avance por cuotas en pantalla | — | ningún `.pulso` de referencia trae un envío `kind = "cuotas"` | observación: haría falta un proyecto de referencia en cuotas | Hojas + Monitoreo |
