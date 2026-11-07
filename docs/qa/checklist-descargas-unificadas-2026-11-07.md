# Checklist: descargas unificadas (2026-11-07)

Pedido: censar todas las formas en que Prosecnur genera algo y lo entrega como
archivo, para unificar la pantalla de carga, el nombrado y la ubicación del
guardado. Orden: censo → prototipo (artifact) → implementación.

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| 1 | Censo completo y absoluto de toda salida descargable | `docs/qa/censo-descargas-2026-11-07.md` + `censo-descargas-2026-11-07/{backend,frontend}.json`, `entrega.md`. 141 disparadores, 164 salidas del motor (148 archivos, 16 publicaciones); semillas y cruce endpoint por endpoint sin huecos | hecho; espera revisión de Gonzalo |
| 2 | Unificar la pantalla de carga de toda generación | Propuesta: tarjeta de generación + bandeja «Entregables», sobre `useJob`/`JobProgress`, una sola señal en movimiento (vista «Espera»). Forma según contenedor: bloque (98), anclada (32), en la fila (6), se retira (5); 9 ejemplos reales en la vista «Por contenedor». Regla por contenedor aprobada; el resultado es un contenedor de archivo con acciones neutras | regla aprobada; contenedor rediseñado (v5) espera visto bueno |
| 3 | Unificar el nombrado de los archivos | `Estudio_Entregable[_Base][_Detalle]_Fecha.ext`, rótulo por salida en el prototipo (vista «Nombre»); extiende `.export_filename()`. Decidido: palabras `Frecuencias_por_base`, tildes y ñ transliteradas, fecha `07_11_26` (la de `.export_filename()`) | decidido; espera implementación |
| 4 | Unificar la ubicación del guardado | Decidido: `Entregables\<Módulo>\` junto al .pulso en escritorio, sin diálogo; descargas en navegador (vista «Ubicación») | decidido |
| 5 | Prototipo como artifact | https://claude.ai/artifact/8S4BRaszzE1tChaRcAUVRk | publicado; espera revisión |
| 6 | Implementar | Fases en la vista «Decisiones»: defectos → `entregable_registrar()` + ADR → Electron → `useGeneracion` → migración con ratchet | listo para empezar: decisiones cerradas el 2026-11-07 |

## Notas

- 2026-11-07, indicaciones de Gonzalo sobre el prototipo: (a) la mayoría de usuarios usa Windows, no Mac → «Mostrar en la carpeta», rutas `C:\`, límite de 260, Excel bloquea el archivo abierto; (b) nada de doble spinner → el botón solo se deshabilita y la barra de la tarjeta es lo único que se mueve; (c) los botones viven en contenedores distintos → clasificación por contenedor y regla de forma, con ejemplos (aprobada: «Me convence»); (d) «no debería haber botones resaltados ni subrayados, todo deberían ser contenedores profesionales» → la tarjeta pasa a contenedor de archivo: ícono del formato, nombre, estado, peso y carpeta, con acciones neutras de igual peso (Abrir, Mostrar en la carpeta, Más) y sin enlaces. Los botones que disparan la generación conservan por ahora el estilo de su módulo.

- Infraestructura central encontrada: file store de sesión (`s$files`) servido por
  `GET /api/files/<id>/download` (router_sistema.R:783); el nombre visible sale de
  `meta$original_name`.
- Ya existe una regla de nombre: `.export_filename()` = slug del proyecto + base +
  etiqueta + fecha. No todos los registradores la usan.
