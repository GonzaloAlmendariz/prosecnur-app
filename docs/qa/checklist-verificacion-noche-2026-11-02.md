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
| 8 | Seis segmentados más redefinen el indicador con una sola clase (`cmg-metodos`, `cmv2-aulas-modalidad`, `pulso-emparejamiento-filtro`, `home-settings-nav`, `rec-mail-tabs`, `rec-caja-vistas`): el mismo empate que el hallazgo 4 | varios | contrato `indicadorDelKit` | congelados en el ratchet; no observados en pantalla, no se tocan sin verlos | Cálculo, Carga, Revamp (Home), Material |
| 9 | Monitoreo de aulas sin datos de campo: los vacíos se contienen (C3), pero estiran su marco. Agenda deja 245 px sin usar en «Sin cita» y «Citas vencidas»; Cursos-horario deja un hueco entre filas a 1024 (`capacity-drift`, C2) | — | `cap3-aulas`: `geometryIssues=3` en `aulas-agenda-listas` y `aulas-cursos` | reportado; `features/monitoreo` tiene cambios sin commit de otra sesión | Monitoreo |
| 10 | El pie del riel de aulas dice «Sin act.» cortado dentro de su chip, donde los otros perfiles dicen «CORTE 09/07 07:24» | — | capturas de aulas a 1440 y 1024, abajo del riel | reportado (mismo motivo) | Monitoreo |
| 11 | En Hojas › Muestra a 1024 el rótulo «Corrección por población finita (FPC)» desborda 5 px | — | `cap3-hojas`: `overflow-x` en `.pulso-switch-field-label` | arreglado en 175a4e3e6: baja de línea en el inspector angosto (`angosto.css`), sin tocar el `nowrap` del kit; recaptura a 1024 y 1280 con `issues=0`; gate hojasRuta 811/811 | Hojas de ruta |
| 12 | En Hojas a 1024, «Entre-vistas» y «Contac-tos» se cortan con guion en las cifras del inspector (`rotulo-partido`) | 81f61c795 | `cap3-hojas`: `rotulosPartidos=2` | observación: el guion fue decisión deliberada del dueño («en vez de partirse en cualquier letra»); el detector la marca igual, decide Hojas | Hojas de ruta |
| 13 | Los switches de correos (hallazgo 1) no se pudieron ver en pantalla: ningún proyecto de referencia trae una campaña de correo | 2b3420a32 | `material_campaigns` vacío en los cuatro `state.rds` | pendiente de verlo en vivo con un estudio que tenga correo | Material |
| 14 | C5: al guardar un nombre en la Ficha del estudio, el chip del proyecto y el h1 del Home siguen con el nombre del archivo (lo vio Revamp) | e8aafb4b4 (mío) | dos causas: el chip lee `project_status$name`, que es el archivo; el Home sí recibe el nombre declarado en el overview (ya con test de las dos ramas), pero guardar la Ficha no le avisaba que releyera | arreglado: `project_status$nombre_estudio` (declarado o, sin declarar, el archivo; `name` sigue siendo el archivo, que es el nombre por defecto al guardar como) y la Ficha emite `pulso:project-status-changed` y `pulso:estudio-cambio` al guardar. Tests: R de las dos ramas en `test-project-pulso.R` y vitest `workspaceNombre.test.ts`. Commit d634cddfa; gate R 725/0. Falta verlo en vivo: el cambio de R exige relanzar el backend, que esta noche no se toca | Planner (esta sesión) |
| 15 | Typecheck en rojo por trabajo en curso: `AulasMonitoreoPage.tsx:2092` pasa `publicarLibro` a `ContextoDeSalidas`, que no lo declara | sin commit (Monitoreo, aulas) | `tsc` a las 02:5x, 6 archivos de aulas modificados en el árbol | reportado; no se toca trabajo ajeno sin commit | Monitoreo |

## Ítem 7 del retiro del Planner

Backend dormido de la Bitácora: **bloqueado**. El ADR 0124 §4 dice que las claves de la Bitácora se conservan en los
`.pulso` y nadie las borra; no decide retirar `router_bitacora*.R`, `plan_trabajo` ni `planner_calendario.R`. Borrarlos
sin esa decisión excede lo autorizado esta noche. Va para la mañana: enmendar el ADR o dejarlo dormido.
