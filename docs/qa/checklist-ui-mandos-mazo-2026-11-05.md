# Checklist: todo lo del mazo, configurable en la UI (2026-11-05)

Origen: ítem 15 de la revisión del PPT v7.23 («todo lo que está en este PPT debe estar habilitado de forma intuitiva y
configurable en la UI del editor de PPTs; esa debe ser la vara final»). Auditoría de solo lectura del plan del mazo de
referencia (56 láminas) frente al editor de Gráficos. Un ítem por mando sin control o con control parcial, ordenados por
cuánto los usa el mazo.

Estados: pendiente · en curso · hecho (a revisar) · bloqueado.

| # | Mando | Uso en el mazo | Hoy en la UI | Dónde vive | Estado |
|---|---|---|---|---|---|
| U1 | Tarjetas de diferencias: `cruces`, `rotulos`, `cortos`, `publico`, `max` (`meta.tarjetas_diferencias`) | 27 láminas | solo encender/apagar y «Todos los grupos» (`laminas/diferencias/TarjetasDiferencias.tsx`) | frontend `laminas/diferencias/` (`OpcionesTarjetas.tsx`, `CortosGrupos.tsx`, `modeloTarjetas.ts`); `max` sí lo lee el motor (1 a 9, 4 por defecto) | hecho (a revisar) |
| U2 | Tarjetas por ranura en `p_slide_2_graficos` (`izquierda` / `derecha`) | 5 láminas | nada: `admiteTarjetas` exige `p_slide_1_grafico` | frontend `laminas/diferencias/modeloTarjetas.ts` (`ranuraDeTarjetas`, `metaConTarjetas`); tope 2 por ranura | hecho (a revisar) |
| U3 | Rótulos cortos del estudio (`plan$rotulos_cortos`) | 15 rótulos, todo el mazo | sin superficie | frontend `estilo/RotulosCortos.tsx` (Identidad › Rótulos cortos, `/graficos?pestana=identidad&foco=rotulos`), acción `setRotulosCortos` del store | hecho (a revisar) |
| U4 | `orden_barras` de planes anteriores | 30 gráficos | «orden elegido antes» sin decir cuál | frontend `laminas/ordenCategorias.ts` (`ordenHeredado`): «De mayor a menor, elegido antes»; otro modo lo reemplaza y el valor anterior queda en `overrides` | hecho (a revisar) |
| U5 | Línea por nivel: `titulo_seccion`, `rotulo_total`, `publico`, `nombre_nivel`, `total_arriba`, `grupos` | 1 gráfico | sin control | frontend `laminas/argsDatosGrafico.ts`; `grupos` con las categorías de `cruce` (DatosGrafico) | hecho (a revisar) |
| U6 | Mandos que van por `overrides` (`pista_barras`, `colorear_por_opcion`, `marca_mediana`): la tarjeta escribe en `args` y la migración sólo copia tres args | pista en toda barra de una serie | sin control | frontend `laminas/mandosPorOverrides.ts` (la tarjeta escribe en args y overrides) + backend `graficos_migrar_args_overrides.R` (espejo; si difieren gana overrides); controles en la tarjeta (grupo Cifras) | hecho (a revisar) |
| U7 | Hallazgos: `rotulos` y `cortos`; insertar la lámina desde el selector | 2 láminas | sin control; fuera del selector | frontend `laminas/hallazgos/`, `selectores/tiposLamina.ts` | pendiente |
| U8 | Resumen de diferencias: `seleccion`, `capitulos`, `cruces`, `cortos`, `rotulos`, `max_filas`; insertar la lámina | 1 lámina | solo título, etiqueta y base | backend registro + frontend | pendiente |
| U9 | Etiqueta corta por pregunta en multiapiladas (`etiquetas_vars`) | 1 gráfico | solo con un `var` | frontend `laminas/DatosGrafico.tsx` | pendiente |
| U10 | Histograma: `mostrar_frecuencia`, `marca_mediana`; `ancho_bin` y `mostrar_bins_vacios` retirados | 1 gráfico | sin control | frontend `laminas/argsDatosGrafico.ts` | pendiente |
| U11 | `mostrar_significancia` en multiapiladas por cruce (el registro no lo declara) | 0 hoy | sin control | backend registro | pendiente |
| U12 | `size_ejes`, `size_texto_barras`, `usar_eje_libre` en agrupadas | 8, 7 y 2 gráficos | sin control en la tarjeta | frontend | pendiente |
| U13 | `meta.composicion = "cifra_lateral"` y `meta.cifra`; `tarjetas_diferencias.modo = "en_linea"` | 0 hoy (el motor los sostiene) | sin control | frontend | pendiente |
| U14 | Las listas de la tarjeta (categorías, destacar respuestas) muestran el rótulo completo aunque el estudio declare su corto; de ahí salen desbordes («Académica (grupos de lectura…)») | listas de la tarjeta | rótulo completo | frontend `laminas/SelectorCategorias.tsx` y vecinos | pendiente |
| U15 | En los cruces de las tarjetas, el selector marca «falta la base» en un informe de dos bases; el motor lee el cruce de la base del gráfico, así que ahí es ruido | 27 láminas | aviso de más | frontend `laminas/diferencias/OpcionesTarjetas.tsx` (`VariablePicker`) | pendiente |

Ya configurables (para no rehacerlos): base, título, antetítulo y subtítulo; tipo de lámina y ranuras; paletas por
lista; `residuales_gris`; `limite_superior`; `lectura`, `series` y `segmentos_total` de la línea por nivel; `top2box` en
apiladas y multiapiladas; los mandos del resumen ejecutivo.
