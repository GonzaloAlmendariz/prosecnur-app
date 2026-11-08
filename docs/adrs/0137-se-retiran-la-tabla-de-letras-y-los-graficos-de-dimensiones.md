# ADR 0137: se retiran la tabla de letras entre públicos y los gráficos de dimensiones

Estado: Propuesto (decisión de Gonzalo del 2026-11-08; quedan dos puntos abiertos, ver «Pendiente de Gonzalo»)
Fecha: 2026-11-08
Autoridad: Gonzalo, sobre el catálogo de láminas: «Pensé que esta forma de mostrar significancia ya estaba desfasada en
favor de otra más moderna con tarjetas»; «Creo que gráficos exclusivos para dimensiones ya ni tienen cabida en la app»;
y, al preguntarle si se retiran: «Sí, retíralos con ADR».

## Contexto

Gráficos ofrece seis tipos que el catálogo mostró como desfasados o que no se ven bien:

- `p_significancia_publicos`: tabla de letras que compara el mismo tema entre públicos. Las tarjetas de diferencias
  (ADR 0129) son la forma vigente de mostrar significancia. Además, esta tabla reimplementa la prueba z fuera de la regla
  del estudio (ADR 0127).
- La familia exclusiva de dimensiones: `p_dim_radar`, `p_dim_heatmap`, `p_dim_heatmap_criterios`,
  `p_dim_comparativo_radarbar` y `p_dim_foda` (más el resto `p_dim_radar_tabla`, ya retirado de hecho).

El análisis de Dimensiones de Analítica, su semáforo, el Dashboard (incluido su FODA) y las columnas de índice que llegan a
Gráficos (`idx_*`, `sub_*`, `r100_*`) **no se retiran**.

Inventario de impacto (revisión de contratos del 2026-11-08): ningún proyecto de referencia usa estos tipos; sólo el
catálogo sintético del recetario. Puede haber proyectos de cliente fuera del repo que los usen.

## Decisión

Se retiran en dos fases, como en el ADR 0098.

**Fase 1: compatibilidad, sin borrar nada.** Un archivo nuevo `api/R/graficos_retirados.R` declara los tipos retirados
como literales congelados, con su nombre legible y su reemplazo sugerido.

- Un plan guardado conserva el `graficador` y los `args` tal cual. No hay migración, no se marca el proyecto como
  modificado y no cambia el formato del `.pulso`.
- Validar: un tipo retirado es una advertencia, no un error. El export no se bloquea.
- Reconstruir, miniaturas y vista previa: salen como marco en blanco con su título y un aviso de la lámina. El
  entregable del cliente no cita el ADR.
- Editor: la ranura dice «Tipo de gráfico retirado», propone el reemplazo y permite cambiarlo. Al cambiar, los `args`
  viejos se descartan.
- Los presets `dim_*` guardados se ignoran sin aviso.

**Fase 2: borrado**, con la Fase 1 ya integrada. Salen los constructores, renderers, graficadores, piezas nativas, presets,
plantilla `foda_dimensional`, la familia «Dimensiones» del selector, sus íconos y sus tests. Antes de borrar
`graficador_dimensiones.R` se rescatan a un archivo propio los helpers que otros consumen: el lienzo «Sin datos» de todos
los gráficos (`.dim_blank_canvas`) y los íconos de `p_radar` y del Dashboard. Un test falla si esas funciones faltan. Los
congelados sólo bajan: se rebajan sus líneas base.

Reemplazos sugeridos:

| Retirado | Reemplazo |
|---|---|
| `p_significancia_publicos` | Tarjetas de diferencias (ADR 0129), con la salvedad de «Pendiente de Gonzalo» 2 |
| Un índice por cruce | `p_media_rango` (con semáforo) o `p_numerico` sobre la columna `idx_*` |
| Criterios de una dimensión | `p_tabla` en modo caja o `p_barras_multiapiladas` sobre los ítems |
| FODA | El FODA del Dashboard |

## Pendiente de Gonzalo

1. `p_dim_heatmap` tiene además una variante pregunta × cruce (L10-6 y L10-10 de CCSS Perfil, 2026-10-24): es el único
   mapa de calor del registro. O se retira con el resto, o esa variante pasa a un tipo propio («Mapa de calor por cruce»).
2. Las tarjetas comparan grupos de un cruce dentro de una base. La tabla de letras compara el mismo tema entre bases
   distintas. Al retirarla, la app se queda sin prueba de diferencias entre públicos, y ningún tipo vigente dibuja varios
   índices juntos por cruce. Hay que aceptarlo por escrito, o pedir que las tarjetas cubran la comparación entre públicos.

## Consecuencias

- Los proyectos que usen estos tipos abren y exportan; la lámina sale en blanco con aviso hasta que el analista la cambie.
- Desaparecen exports del paquete (`p_dim_*`, `graficar_*_dimensiones`): va en las notas de versión.
- Se enmiendan los ADR 0129 (reemplaza a la tabla de letras), 0127 (se cierra la nota de la z reimplementada), 0093 (N5
  retirado), 0097 (sale el comparativo de dimensiones) y 0092 (`graficador_dimensiones.R` deja de figurar como congelado).
- El borrado de archivos exige la confirmación de Gonzalo al commitear (CLAUDE.md, gate 3).
