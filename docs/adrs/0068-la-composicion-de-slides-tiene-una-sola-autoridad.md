# ADR 0068: La composición de slides tiene una sola autoridad

Estado: Aceptada

Implementación: L7 del GOAL de bibliotecas de Gráficos

Fecha: 2026-08-07

Fecha de decisión: 2026-08-07

Reemplaza: —

Extiende: ADR 0003, ADR 0006 y ADR 0023

## Contexto

Gráficos mantenía dos interpretaciones de una misma lámina: el motor PPT
resolvía layouts, placeholders, presets y calibraciones después de abrir la
plantilla, mientras React dibujaba referencias locales por `kind` y el endpoint
individual reconstruía otra geometría desde el contrato nominal. Una tarjeta
podía verse plausible y aun así no representar el PPT que se exportaría.

Se evaluaron tres alternativas: mantener ambas geometrías y sincronizarlas por
tests; publicar capturas rasterizadas para toda la biblioteca; o extraer el
contrato efectivo del renderer y usarlo como autoridad común. La primera deja
dos fuentes de verdad y la segunda vuelve costosa y frágil una biblioteca de 20
tipos. Se elige la tercera.

## Decisión

La composición geométrica de las 20 láminas de Gráficos se resuelve una sola
vez en R, después de seleccionar la plantilla y aplicar presets y
calibraciones. El renderer PPT y los serializers consumen literalmente ese
mismo objeto versionado.

- El contrato público aditivo es `graficos.slide_layout_matrix/v2`, servido por
  `GET /api/graficos/slide-layout-matrix` bajo el dominio `/api/graficos`; el
  query cerrado `scope=active|consolidated` selecciona la misma configuración
  que exportará cada editor.
- El wire sólo contiene identidad y huella de plantilla, canvas, tipo,
  `render_key`, layout, regiones normalizadas y diagnósticos. No contiene
  paths, `sid`, datos, secretos ni atributos internos del renderer.
- El endpoint v1 individual permanece como adaptador de compatibilidad; no es
  otra autoridad geométrica.
- La identidad institucional es explícita y transitoria mediante
  `template_id` o `profile_id`. No se infiere desde nombres o rutas y esta
  decisión no agrega campos a `.pulso`.
- Los workers de exportación propagan esa identidad hasta
  `reporte_ppt_plan()`; una plantilla institucional no puede declararse como
  genérica por perder el argumento al cruzar un job.
- React falla cerrado si schema, versión, identidad, `render_key`, layout,
  slots o coordenadas divergen. Card, hero y preview de referencia consumen la
  misma matriz; el PNG del renderer conserva precedencia como oracle visual.
- La caché frontend se separa por sesión, scope, identidad, revisión efectiva
  y generación de hidratación. No consulta por un reloj supuesto: sólo una
  hidratación o escritura exitosa acredita la revisión exacta que puede pedir
  la matriz. La huella devuelta distingue plantilla y presets.

## Consecuencias

La biblioteca representa el espacio que usa el PPT real y desaparecen los
mapas paralelos entre router, renderer y React. El contrato es auditable,
path-free y no cambia persistencia ni modo público.

El costo es que una modificación de layouts, calibraciones o presets ahora es
un cambio contractual visible: debe invalidar la caché, mantener el adaptador
v1 y probar renderer y UI juntos. Plantillas secundarias seguirán necesitando
su propia evidencia; no se permite inventar geometría local cuando una matriz
no resuelve.

## Cumplimiento

- `api/R/graficos_slide_template_contract.R` es la autoridad y
  `api/R/reporte_plan_ppt.R` consume su contrato interno.
- Los tests R fijan 20 tipos, seis mutantes causales, ausencia de paths, el
  endpoint v2, compatibilidad v1 y un deck ACNUR real de 20 sentinelas.
- Los tests de jobs fijan la propagación explícita de `template_id`.
- Los tests TypeScript fijan schema/versión, identidad, `render_key`, layout,
  regiones, ack de persistencia, invalidación generacional de caché e igualdad
  card–hero–preview.
- La QA visual abre el popover real con `acnur_acg` en 1440×1000 y 1024×600 y
  compara sus firmas de composición.
- `editor-v2.css`, la plantilla binaria y el proyecto canónico permanecen
  inmutables; cambiar cualquiera exige otro scope y evidencia propia.

## Notas

Relacionado con [ADR 0003](0003-motor-r-integrado.md),
[ADR 0006](0006-modulos-por-dominio.md) y
[ADR 0023](0023-acnur-kobo-mapas-cobertura-graficos.md).
