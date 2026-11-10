# Checklist: descargas unificadas (2026-11-07)

Tipo: Checklist de pedido con varias indicaciones
Estado: En curso
Fecha: 2026-11-07
Autoridad: Pedido del 2026-11-07 de censar y unificar las descargas; las decisiones y los vistos buenos son de Gonzalo

Pedido: censar todas las formas en que Prosecnur genera algo y lo entrega como
archivo, para unificar la pantalla de carga, el nombrado y la ubicación del
guardado. Orden: censo → prototipo (artifact) → implementación.

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| 1 | Censo completo y absoluto de toda salida descargable | `docs/qa/censo-descargas-2026-11-07.md` + `censo-descargas-2026-11-07/{backend,frontend}.json`, `entrega.md`. 141 disparadores, 164 salidas del motor (148 archivos, 16 publicaciones); semillas y cruce endpoint por endpoint sin huecos | hecho; espera revisión de Gonzalo |
| 2 | Unificar la pantalla de carga de toda generación | Propuesta: tarjeta de generación + bandeja "Entregables", sobre `useJob`/`JobProgress`, una sola señal en movimiento (vista "Espera"). Forma según contenedor: bloque (98), anclada (32), en la fila (6), se retira (5); 9 ejemplos reales en la vista "Por contenedor". Regla por contenedor aprobada; el resultado es un contenedor de archivo con acciones neutras | regla aprobada; contenedor rediseñado (v5) espera visto bueno |
| 3 | Unificar el nombrado de los archivos | `Estudio_Entregable[_Base][_Detalle]_Fecha.ext`, rótulo por salida en el prototipo (vista "Nombre"); extiende `.export_filename()`. Decidido: palabras `Frecuencias_por_base`, tildes y ñ transliteradas, fecha `07_11_26` (la de `.export_filename()`) | decidido; espera implementación |
| 4 | Unificar la ubicación del guardado | Decidido: `Entregables\<Módulo>\` junto al .pulso en escritorio, sin diálogo; descargas en navegador (vista "Ubicación") | decidido |
| 5 | Prototipo como artifact | https://claude.ai/artifact/8S4BRaszzE1tChaRcAUVRk | publicado; espera revisión |
| 6 | Implementar | Fases en la vista "Decisiones": defectos → `entregable_registrar()` + ADR → Electron → `useGeneracion` → migración con ratchet | en curso: fases 1 (`318e66b33`), 2 (`eecc17c8f`, ADR 0133), 3 (`dbee82353`) y 4 (`49723ab95`) hechas; fase 5 (migración de los demás módulos) pendiente |

## Fase 1: defectos (commit `318e66b33`)

| Defecto | Dónde vive | Estado |
|---|---|---|
| 26 `window.open` de descargas que Electron niega | `frontend/src/lib/descargas.ts` (`descargarArchivo`) + 17 componentes | hecho; Electron en runtime sin verificar |
| UUID del job en el nombre y tildes sin codificar (10 cabeceras) | `api/R/helpers_descarga.R` (`.content_disposition`) | hecho; probado por HTTP en proceso |
| Evidencia de Monitoreo escrita en la subcarpeta `qa` de `tmp`, relativa al cwd; el cliente elegía `out_dir` | `.session_downloads_dir()`; routers de Monitoreo | hecho |
| Dashboard › Base de datos falla en silencio y se ofrece en modo público | `BaseDatosTab` (`ErrorBlock`, `publicMode`) | hecho; QA visual pendiente |
| Clase `spin` inexistente (Ocurrencias) | `pulso-spin` | hecho |
| Portapapeles sin respaldo de Electron (8 sitios) | `copiarTexto` | hecho |
| URL a `/api/muestra-aulas/reporte/descargar`, ruta inexistente | borrada de `api/calcMuestra.ts` | hecho |
| "Ver el informe" de Hojas de ruta que ahora descarga | rótulo "Descargar el informe" | hecho |
| Archivos de "Cerrar y generar base" que la UI nunca ofrece | Validación | pasa a la fase 5 (migración) |
| "Actualizar" de aulas que también publica en Sheets | Monitoreo aulas | pasa a la fase 5; pide decisión de rótulo o flujo |
| `save-to-project` rechaza tildes y más de 80 caracteres | `router_proyecto.R` | pasa a la fase 2 (regla de nombre) |
| Nombres iguales para contenidos distintos | rótulos por salida | pasa a la fase 2 |

Gates: `test-descargas-entrega.R` 29 OK; gate R del área 1711 pass, 0 fail; 3 tests front nuevos 15 OK; `make gate-front` 743 OK; `tsc` limpio; auditoría sin hallazgos. Quedan 4 rojos que no son de esta fase (PulsoButton, StageStepper y PulsoSwitch por 2afac10cb y 7ba64a57b; `estadosAtadosAlMotor` por ea4473e15). Hallazgos para fases siguientes: el paquete de evidencia devuelve rutas absolutas del temporal de sesión, y el cuerpo de la petición elige el PDF que se copia al paquete (`monitoreo_router_publicacion.R` ~373).

## Fase 2: un registro, un nombre y una carpeta (commit `eecc17c8f`, ADR 0133)

| Pieza | Dónde vive | Estado |
|---|---|---|
| Registro único y catálogo por kind (124 kinds; 84 se copian, 40 no) | `api/R/entregables_registro.R`, `api/R/entregables_catalogo.R` | hecho |
| Nombre `Estudio_Entregable[_Base][_Detalle]_dd_mm_yy.ext` | `entregable_nombre()`; `.export_filename()` delega | hecho |
| Copia sin diálogo a `Entregables\<Módulo>\`, `_2` sin distinguir mayúsculas, ruta larga, modo público | `entregable_registrar()` | hecho; Windows real sin verificar |
| Multibase: solo se copia el ZIP | `run_report_per_base`, `.zip_outputs` | hecho (decisión del lead) |
| `save-to-project` limpia en vez de rechazar; `Entregables/<Módulo>`; `_2`; fin de `x.xlsx.xlsx` | `router_proyecto.R` | hecho |
| ZIP de CSV y de Excel con nombres distintos | `.zip_outputs` por kind | hecho |
| Analítica (sync y job) y Gráficos (PPT, Word, consolidado) devuelven `guardado_en` y no abren el diálogo | `entregable_respuesta()`; `useReporteRun`, `GenerateFooter`, `ExportarInformeMenu` | hecho; Electron y UI sin verificar |
| Flujos que guardan a mano o no se ofrecen: Editor XLSForm, Correos, Subir Kobo, limpieza, piezas del handoff | catálogo con `guardar = FALSE` | transitorio hasta la fase 5 |

Verificación: el verificador rechazó la primera entrega porque el informe compartido de Gráficos se copiaba y además abría el diálogo; se corrigió y se recomprobó (`test-entregables-respuesta.R` 51 OK, vitest de Gráficos 1988 OK). Gate R del área: 6587 pass, 0 fail, 0 rotas. Punta a punta en proceso con dos proyectos de referencia: nombre con el código del estudio, copia en `Entregables/Procesamiento`, `_2` en la segunda generación, nada en modo público, job de Cruces real con una sola copia. Pendiente: llamadores que aún pasan su propio nombre (`base_limpia_<base>`, correos, handoff) se migran en la fase 5.

## Fase 3: Electron (commit `dbee82353`)

| Pieza | Dónde vive | Estado |
|---|---|---|
| Descarga sin diálogo a Descargas, `_2` sin pisar, reserva entre simultáneas, aviso `descarga:terminada` | `desktop/descargas.cjs` (`instalarDescargas`), `main.cjs` | hecho; caso feliz en Electron real sin verificar |
| Descargas ilegible (EPERM de macOS) → diálogo y aviso igual | `instalarDescargas` | hecho y probado en Electron real |
| "Abrir" y "Mostrar en la carpeta" solo para entregables en Descargas o `<proyecto>/Entregables` | `rutaPermitida`, `crearHandlersEntregable`, IPC con `trustedHandle` | hecho; rechazos probados en Electron real |
| Rutas UNC y flujos NTFS rechazados antes de tocar disco; el log no copia rutas ni textos del sistema | `rutaPermitida`, `esMotivoPropio` | hecho (hallazgos del verificador) |
| Puente en el front con respaldo inerte en navegador | `frontend/src/lib/escritorio.ts`, `features/project/types.ts` | hecho; lo consume el kit de la fase 4 |

Gates: `pnpm -C desktop test` 69/69; `escritorio.test.ts` 19/19; `tsc` limpio; audit limpio; `make gate-front` 743/744 con un timeout por contención de la máquina (`GlidingTabList` 9/9 aislado). Pendiente de probar a mano, sobre todo en Windows: generar sin proyecto guardado, descargar dos veces y ver `X` y `X_2` en Descargas sin diálogo; "Abrir" y "Mostrar en la carpeta"; la marca de "archivo de Internet" (Vista protegida de Office). Riesgo aceptado: `.xls` sigue en la lista porque la app genera la carga de campo de aulas en ese formato.

## Fase 4: contenedor de archivo y bandeja (commit `49723ab95`)

| Pieza | Dónde vive | Estado |
|---|---|---|
| `useGeneracion` (sync y job con avance real, cancelar, fallo legible) | `frontend/src/components/entregables/useGeneracion.ts` | hecho |
| Contenedor de archivo en tres formas (bloque, anclada, fila), acciones neutras, una sola señal | `ContenedorEntregable.tsx`, `entregables.css` | hecho; QA visual r2 conforme |
| Bandeja "Entregables" en la barra superior | `BandejaEntregables.tsx`, `bandejaStore.ts`, `app/Layout.tsx` | hecho; QA visual conforme |
| Piloto bloque: Analítica (8 panes, pie "Generar") | `PaneKit.tsx`, `useReporteRun.ts` | hecho |
| Piloto anclada: Gráficos (menú "Exportar"), sin colapso a ícono al exportar | `ExportarInformeMenu.tsx`, `editor-v2.css` (4 selectores, sin crecer) | hecho |
| Ratchet de entregas propias | `entregablesRatchet.contract.test.ts`, BASE 41 (antes 43) | hecho; baja con cada módulo migrado |

QA visual: la primera ronda rechazó (bloque estirado a todo el alto, disparador de Gráficos colapsado a 1024, foco invisible); la segunda, con fallos reales provocados por la API, dio 31 PASS y 0 FAIL a 1440x1000 y 1024x600. Gates: `tsc` limpio, vitest de kit, Analítica y Gráficos 2345/2345, `make gate-front` 750/750, audit limpio. Pendiente: Electron real (Abrir, Mostrar en la carpeta, Guardar como, aviso de descarga) y el foco de "Cancelar" a 1024. Observaciones bajas: a 1024 el contenedor queda al ras del borde inferior (falta `scroll-margin-bottom`); la anclada tapa "Ver avisos" hasta que se cierra.

## Fase 5: migración (en curso)

| Oleada | Alcance | Commit | Estado |
|---|---|---|---|
| 0 | Ratchet ampliado (blobs, enlaces a URLs de descarga, helpers de CSV) y `urlDelArchivo` para imágenes en línea | `50ebd5ee3` | hecho; BASE 56 |
| 1 | Material de campo al kit (28 filas del censo); normalizadores de Material; kit con "ver sin descargar" y alineación de la anclada; nombres del motor alineados en ~30 salidas; ficha de prueba con archivo; "Cerrar y generar base" devuelve sus archivos; ZIP de correos se copian | `70b122050` | hecho; BASE 41; verificador rechazó una vez (Paquetes territoriales copiaba y descargaba; comillas angulares) y se corrigió |
| 2 | Monitoreo (26 filas); Hojas de ruta, Cálculo de muestra, Dashboard y Carga; motor: reportes por job y PDF de Monitoreo registran su archivo, base del dashboard y diferencias de integración devuelven JSON, todas las rutas informan `guardado_en`, Excel real de la carga de campo de aulas | `50b00abff` (+ `b55a322f9`, arreglo de parseo de `router_hojas_ruta.R` que dejó un commit ajeno) | hecho; BASE 15; verificador aprobó con pendientes (QA visual y Electron) |
| 3 | Gráficos, Analítica, ConfigIoButtons, Codificación, Editor XLSForm y Validación al kit; "Cerrar y generar base" ofrece sus tres archivos; el export del Editor es entregable (ya no se cuela como instrumento); previas del impreso, visor Word y vista previa de lámina sin copia; se borra `SaveEntregableButton.tsx` | `bbf6ce5a8` | hecho; BASE 0 (ningún archivo fuera del kit hace su propia entrega); verificador aprobó con pendientes |
| 3b | Portapapeles y publicaciones en el contenedor | sin commit | pendiente; el kit aún no muestra resultados que no son archivo |
| 4 | QA visual por muestreo de los módulos migrados en las oleadas 1–3 y prueba en Electron real (Windows) | `b750081a9`, `8147812d4`, `14bf1eea0`, `5accea786`, `c1d454ae1`, `c4a0a20f5`, `ebca1bd32`, `1fdf0e89c` | QA visual en tres rondas (Chromium sin interfaz, macOS): la tercera aceptó con 20 de 20 celdas; verificador aprobado. Electron en Windows sigue pendiente |
| 5 | Limpieza de lo que quedó sin uso: `FilenameInput.tsx`, `apiSaveEntregable`, `apiListProjectDir`, `exportWarningDetail`, `textoExportando`, `AplicarResult`, la variante `export` de `XlsformTransferNotice`, CSS huérfano en `theme.css` y `validacion-v2.css`, y tres comentarios que dicen que el paquete metodológico no se registra | sin commit | pendiente |

Decisiones pendientes de Gonzalo: (1) el "Actualizar" de Monitoreo › Aulas que también republica en Sheets: que el rótulo lo diga o separar las acciones; (2) los archivos DENTRO del ZIP de evidencia de Monitoreo siguen en inglés; (3) las piezas DENTRO del ZIP de Hojas de ruta pierden la ñ; (4) "Cerrar y generar base" copia sus tres archivos a Entregables en cada cierre (con `_2`, `_3` si se repite).

Desvíos del glosario que hizo el motor en la oleada 1, por exactitud: la ficha de UMP titular se llama "Ficha de UMP" (antes todas decían "de reemplazo"); el libro de UMP es "UMP" con detalle `faltantes`, `<responsable>` o `determinadas`; la evidencia de Monitoreo es "Evidencia de publicación" con detalle "para el cliente" o "interna". Pendientes del motor: los archivos DENTRO del ZIP de evidencia siguen en inglés (esquema versionado que lee `audit_projects.R`) y las piezas dentro del ZIP de Hojas de ruta pierden la ñ (`hojas_ruta_sanitize_filename`, motor congelado); ambos piden decisión.

### QA visual de la oleada 4 (2026-11-10)

Matriz de 146 celdas (superficie, estado y viewport en 1440x1000 y 1024x600) sobre copias de acnur_acg, hsvg2026, acrconta, acrconta_mazo y acnur_pdm. Resultado: 109 conformes, 25 rechazos, 8 en deuda y 4 inválidas. El kit cumple una sola señal, nada subrayado, ningún diálogo nativo, comillas rectas y C1–C4. Multibase copia solo el ZIP y la vista previa del Impreso no deja archivo.

| Hallazgo | Dónde vive | Estado |
|---|---|---|
| H1 (crítico): "Cerrar y generar base" sin decisiones listas escribía y promovía una base vacía; Carga quedaba en 0 respuestas; la revisión decía "Estudio: NA" | `limpieza_finalize` + `limpieza_cierre_base.R` (nuevo), `validacion_report_html.R`, `E_LIMPIEZA_BASE_VACIA` | hecho en `14bf1eea0`. No era de la fase 5: atajo de `ee2614b06` (mayo), crítico desde la promoción del ADR 0076. Test rojo de 13 fallas y luego verde; acnur_acg queda en 1283 × 141 |
| H2: con `_2` en la carpeta, el contenedor y la bandeja mostraban el nombre sin sufijo | `entregable_registrar()` adopta el basename de la copia; `archivoDesdeRespuesta` usa el basename de `guardado_en` | hecho en `b750081a9` y `5accea786` |
| H3: la anclada del visor de lámina no colgaba del botón a 1440 | `laminas/ejeDeEntrega.ts`, `VisorLamina.tsx` | hecho en `5accea786`; medido en 1440 y 1024 |
| H4: el visor de lámina mostraba `lamina-3.pptx` y bajaba otro nombre | `estadoLamina.ts`, `api/graficos.ts` | hecho en `5accea786` |
| H5: Impreso con código y fecha dos veces (y sin copiar, por pasar de 240); avisos del impreso sin tildes; plantilla de Analítica, guía del plan y matriz poblacional fuera de la regla | `xlsform_editor_export.R`, `reporte_formulario_*.R`; `nombreConEstudio.ts`, `archivoLocal.ts` | hecho en `8147812d4` y `5accea786` |
| H6: Población no deshabilitaba su "Descargar"; Adaptar tenía un texto al lado del botón (segunda señal) | `MenuDelCajon.tsx`, `AdaptarAplicacion.tsx` | hecho en `5accea786`. Queda a revisar: el foco del teclado pasa a una región que solo lee el lector de pantalla |
| H7: bloque pegado al disparador (0 px) en Libro de códigos y Dashboard › Base de datos | `.pulso-entregable-grupo` | hecho en `5accea786`; 8 px medidos |
| H8: plan portátil saltaba 39 px; nombre cortado a mitad de extensión; bandeja sin sigla en curso; Adaptar copiaba una plantilla interna sin anunciarla | `compartir.css`, `NombreArchivo.tsx`, `BandejaEntregables.tsx`, `router_codificacion.R` (`copiar = FALSE`) | hecho en `5accea786` y `8147812d4` |
| H9: "Bases separadas" de Carga sin descarga de la base preparada (hueco desde octubre) | `carga/fuentes/BasesDelEstudio.tsx`; forma fila del kit | hecho en `c1d454ae1`; la fila mide 34 px en curso, lista y fallo |

Segunda ronda (19 conformes y 4 rechazos) y su nueva medición (20 de 20 conformes, en `ebca1bd32` y `1fdf0e89c`):

| Hallazgo | Dónde vive | Estado |
|---|---|---|
| Crítico: en Monitoreo › Cursos-horario › Salidas, la fila de fallo de "Generar libro" encogía el texto vecino a 0 px y la fila crecía de 65 a 797 px | kit (el texto de la fila aporta 16ch); `SalidasDeMonitoreo.tsx` con renglón propio; mismo arreglo en Material generado | hecho; la fila crece 46 px y el botón no se mueve. Material generado no se vio en pantalla (sin material en la sesión) |
| Revisión HTML: 9 filas NA en "Reglas con más casos", encabezados en inglés, celdas con raya | `validacion_report_html.R` | hecho; las reglas sin conteo se avisan aparte |
| Foco de Adaptar en un elemento invisible | `AdaptarAplicacion.tsx`, `ContenedorEntregable` (`enfocar`) | hecho; el foco cae en el contenedor visible con contorno |
| C2 en Bases del estudio: la rejilla estiraba a las hermanas (`ui-quick-check` lo daba verde por ausencia) | `basesDelEstudio.css` (`align-items: start`) | hecho, con test que falla si la rejilla estira |
| Ancladas de "Matriz para el cliente" y "Plantilla" fuera del eje | `components/entregables/ejeDeEntrega.ts` (sube desde Gráficos) | hecho; Δ ≤ 0.3 px en las cuatro ancladas |
| Impreso con dos fechas cuando el formulario trae la suya; mensajes de aulas sin tildes | `xlsform_editor_export.R`; `carga_aulas_libro_generar.R`, `monitoreo_aulas_publicar_libro.R`, `router_monitoreo.R` (una línea) | hecho |
| `__pulsoNav.ir("dashboard/dashboard/base-datos")` no navegaba | `lib/navegacion/manifiesto.ts` | hecho; test que recorre todo el manifiesto |

Abiertos que no son de esta línea:

- **Comillas angulares (29 pares).** Vienen de los nombres de regla que arma el motor de Validación (`validacion_ast_introspect.R`, `validacion_methodology_report.R`, `validacion_rule_factory.R` y otros, unas 150), y `validacion_methodology_report.R:993` compara uno de esos nombres de forma literal. Las comparte la sesión de Validación.
- **La revisión dice "0 de 94 reglas evaluadas" y "Total inconsistencias 0" en verde** con 9 reglas sin conteo: es una cifra con dos lecturas, para `revisor-metodologico`.
- En la copia fresca, "Ejecutar auditoría" tardó unos 910 s en volver a habilitarse aunque el job duró 14.8 s. Sin investigar.
- La portada de la lámina dice "Informe de resultados13 jun." (falta un espacio).
- En Monitoreo, la causa del fallo se corta con puntos suspensivos; el `title` completo se comprobó en Carga.

Sin cubrir, con la causa comprobada: Monitoreo de aulas (ningún proyecto de referencia lo trae; hsvg2026 no tiene el módulo), armado de paquetes de Material de campo (hsvg2026 dice "Sin unidades en el plan"), Material territorial (acnur_acg pide volver a sortear en Manzanas), anexo y paquete de Cálculo de muestra (falta confirmar "Alumnos por CH"), Comparativos (acrconta_mazo sin preguntas armonizadas), forma fila en Hojas de ruta (pide repartir cuotas y volver a sortear) y en Material de campo (sin artefactos de Paquetes). Electron y Windows no se probaron.

### Pendiente original

Los 41 archivos que el ratchet aún cuenta, módulo por módulo, hasta 0: Material de campo, Monitoreo, Hojas de ruta, Cálculo de muestra, Codificación, Carga, Validación (incluye ofrecer la base limpia de "Cerrar y generar base"), Editor XLSForm, Correos y Dashboard. Al migrar cada flujo se retira su `guardar = FALSE` transitorio del catálogo y su nombre propio pasa a `entregable_nombre()`. Decisión pendiente: el "Actualizar" de aulas que también publica en Sheets.

## Notas

- 2026-11-07, indicaciones de Gonzalo sobre el prototipo: (a) la mayoría de usuarios usa Windows, no Mac → "Mostrar en la carpeta", rutas `C:\`, límite de 260, Excel bloquea el archivo abierto; (b) nada de doble spinner → el botón solo se deshabilita y la barra de la tarjeta es lo único que se mueve; (c) los botones viven en contenedores distintos → clasificación por contenedor y regla de forma, con ejemplos (aprobada: "Me convence"); (d) "no debería haber botones resaltados ni subrayados, todo deberían ser contenedores profesionales" → la tarjeta pasa a contenedor de archivo: ícono del formato, nombre, estado, peso y carpeta, con acciones neutras de igual peso (Abrir, Mostrar en la carpeta, Más) y sin enlaces. Los botones que disparan la generación conservan por ahora el estilo de su módulo.

- Infraestructura central encontrada: file store de sesión (`s$files`) servido por
  `GET /api/files/<id>/download` (router_sistema.R:783); el nombre visible sale de
  `meta$original_name`.
- Ya existe una regla de nombre: `.export_filename()` = slug del proyecto + base +
  etiqueta + fecha. No todos los registradores la usan.
