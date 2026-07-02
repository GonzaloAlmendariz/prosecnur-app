# ADR 0023: ACNUR Kobo y mapas de cobertura en Graficos

## Estado

Aceptada.

## Fecha

2026-06-25.

## Contexto

El proyecto ACNUR/KOICA necesita producir PPTs desde datos Kobo con una estructura cercana a reportes Kobo-style, pero usando el motor propio de Prosecnur. El flujo debe evitar trabajar sobre el `.pulso` original y debe permitir importar desde Kobo en Carga sin descarga manual obligatoria.

ACNUR es un estilo general de plan: usa la linea visual azul ACNUR y reporta resultados en graficos de barras agrupadas sin comparativo territorial por defecto. ACNUR/KOICA territorial es un modo especifico dentro de ese estilo: agrega mapas de cobertura al inicio y puede cruzar cada variable por intervencion/comparacion o distrito.

La informacion territorial ya vive repartida entre Hojas de Ruta y Monitoreo. Para este caso, la cobertura efectiva se interpreta como registros con `advance_valid == TRUE` y estado validado (`validation_status` o equivalente `"validada"`), y los distritos KOICA se fijan por ubigeo:

- Intervencion: `150132` San Juan de Lurigancho, `150135` San Martin de Porres, `150108` Chorrillos.
- Comparacion: `150103` Ate, `150133` San Juan de Miraflores, `150117` Los Olivos.

## Decision

Se incorpora un contrato transversal conservador:

- Proyecto expone `POST /api/project/duplicate` para guardar una copia `.pulso` con `build_pulso`, abrirla en la sesion actual si se solicita y no persistir secretos.
- Carga eleva Kobo a fuente de primera clase: detecta fuentes heredadas desde Monitoreo, lista assets via `/api/carga/platform/kobo/assets` y persiste `KoboSourceSpec` al importar XLSForm + submissions.
- Graficos agrega el preset `acnur_kobo_cruncher_plus`, con colores ACNUR y resultados en barras agrupadas. Por defecto no inserta mapas ni cruces territoriales.
- El modo ACNUR/KOICA territorial activa mapas al inicio solo cuando existen capacidades de Hojas de Ruta + Monitoreo territorial, y permite comparativos opcionales por grupo KOICA o distrito.
- El plan sugerido puede derivar `__koica_group` y `__district` como variables virtuales de cruce, sin exponerlas como preguntas graficables.
- El graficador `p_mapa_cobertura_territorial()` consume contexto territorial serializable. Si hay geometria de Hojas de Ruta, pinta zonas; si no la hay, degrada a resumen legible.

## Consecuencias

- La UI puede generar una copia de prueba y trabajar sobre ella sin tocar el `.pulso` original.
- Los tokens Kobo siguen en Conexiones/secretos locales y no entran al `.pulso`.
- Los mapas quedan acoplados a datos serializables de Hojas de Ruta + Monitoreo, no a closures ni caches pesados.
- La v1 cubre el caso Lima/Callao KOICA; fuera de esa cartografia el PPT conserva una visualizacion fallback.
- Kobo Cruncher queda como referencia de estructura publica, no como dependencia de runtime.

## Cumplimiento

- Tests de Graficos deben validar que ACNUR general no inserta mapas ni comparativos, que el modo territorial inserta mapas al inicio cuando corresponde, deriva cruces KOICA y omite variables no graficables.
- Typecheck frontend debe cubrir la UI de duplicacion, Carga/Kobo y selector de plan sugerido.
- Cualquier nuevo conector Kobo debe seguir usando el almacen local de secretos y persistir solo metadatos no sensibles en `.pulso`.
