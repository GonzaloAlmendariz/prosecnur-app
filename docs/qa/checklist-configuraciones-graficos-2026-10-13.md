# Checklist · configuraciones de los gráficos contra el recetario

Tipo: Checklist e inventario
Estado: Vigente
Fecha: 2026-10-13
Autoridad: Gonzalo: «los gráficos aún no tienen las suficientes configuraciones como deberían». Sólo Gonzalo da por terminado un ítem

Gonzalo (2026-10-13), al retomar el ítem 9 de la maqueta: «un problema fundamental es que los gráficos aún no tienen
las suficientes configuraciones como deberían». La maqueta sólo puede reflejar los ajustes que el gráfico tiene, así que
el ítem 9 de `checklist-maqueta-ficha-2026-10-13.md` se cumple aquí, configuración por configuración.

Vara: **cada variante que el recetario dibuja (cap. 2, p66–p112, y cap. 3, p186–p198) se puede pedir desde el editor y la
maqueta la muestra.** Sólo Gonzalo da por terminado un ítem.

## Cómo se midió

- Variantes del recetario: texto de `docs/qa/motor-ppt-2026-10-06/4-recetario/recetario-moderna.pptx` (título y nota de
  cada página).
- Lo que el editor ofrece: `GET /api/graficos/registry` (args por tipo).
- Lo que el motor sabe hacer: los formales de cada `graficar_*` contra los args del registro. Hay entre 60 y 147 formales
  por graficador y el registro publica entre 2 y 27. Muchos son tamaños y colores finos, que no cuentan aquí.
- Que un formal exista no prueba que salga en la lámina nativa (ADR 0093): cada fila dice si se verificó el dibujo
  nativo.
- El registro no es la única puerta: la pestaña Gráfico edita con componentes propios Top Two Box, Bottom Two Box
  (`tarjetaGrafico/TwoBoxGrafico.tsx`), resaltar la mayor, casos en las etiquetas y respuestas por público. Lo que no
  está ni en el registro ni en esos componentes **no se puede pedir** desde la app (el editor de overrides se retiró
  con los estilos guardados).
- Segunda clase de brecha, la peor: **controles que el editor muestra y el motor descarta**. Un arg del registro que no
  es formal del constructor `p_*`, ni `via_overrides`, ni arg del preset, se cae en `.clean_rebuild_args()`
  (router_graficos.R:203) y la lámina sale igual.

## Inventario

| # | Recetario | Configuración | Motor nativo | Editor | Estado |
|---|---|---|---|---|---|
| 1 | p79 | Escalas: columna Bottom Two Box junto a la Top Two Box | sí: `espec$box2` en `lamina_escala.R` (~198) | sí, pestaña Gráfico (`TwoBoxGrafico.tsx`) | hecho, por verificar: la maqueta dibuja la columna Bottom Two Box al lado de la Top Two Box y la ficha la nombra (`geometriaFicha.ts`, rol `btb`) |
| 2 | p79 | Escalas: fila Total separada por filete | sólo sin grupos (`is.null(var_grupo_id)`); no sale en «Públicos por tema» | no | **decidido, no se construye por ahora** (Gonzalo, 2026-10-14): «debería ser un tipo de multiapilada, pero normalmente no es algo que solamos hacer, nos gusta diferenciar entre los actores». Si se retoma, va como lectura propia de multiapiladas, no como interruptor en las láminas por actor |
| 3 | p74–p75 | Ranking en barras de 0 a 100 %, sin y con marcas del eje («Opcional brindar ambas opciones», 2026-10-09) | sí: 0–100 % ya es el defecto; `marcas_eje` en `lamina_categorica.R` (~58) | sí: «Marcas del eje» en la pestaña Gráfico | hecho, por verificar: formal `marcas_eje` de `p_barras_agrupadas()` → `overrides` (prueba en `test-graficos-controles-llegan.R`), arg en el registro, control y glifo con sus marcas. La escala de 0 a 100 % ya era el defecto; el eje libre no se ofrece |
| 4 | p73 | «Otros» y «No sabe» al final; la más marcada en oscuro | sí | sí (`agrupar_resto_en_otros`, `otros_al_final`) | ya está |
| 5 | p68 | Cifra con sus casos («13% · 22 estudiantes») | sí | sí (`formato_valor`) | ya está |
| 6 | p78 | Top Two Box | sí | sí (`top2box`) | ya está |
| 7 | p196 | Base chica: frecuencias «5 de 12» | sí | sí («Casos junto al porcentaje», configuración del informe) | ya está |
| 8 | p69 | Torta con leyenda de cifras: cifra, rótulo y «56 de 178» | por verificar | no (`mostrar_n_en_etiquetas` sin registro) | por verificar |
| 9 | p70 | Dona: qué respuesta va al centro y su frase | por verificar | no | por verificar |
| 10 | p71 | Divergentes con columnas Top Two Box, Bottom Two Box y SIN INF | por verificar | parcial (`mostrar_saldo`, `incluir_neutro`) | por verificar |
| 11 | p83–p84 | Caja y media-rango: media, atípicos, línea de referencia, significativos destacados | por verificar | no (`mostrar_media`, `mostrar_outliers`, `mostrar_ref_line`, `destacar_significativos` sin registro) | por verificar |
| 12 | p85 | Conteos por año: matriz de conteos con totales por fila y columna | no se encontró graficador | no | bloqueado: decidir si es tipo nuevo o modo de Tabla |
| 13 | p94 | Puntos por competencia, alternativa al radar, con rango «96 a 98%» | por verificar (¿Puntos comparativos?) | por verificar | por verificar |
| 14 | p95 | Mapa de calor: «* menos de 15 casos» y diferencia con el total | brecha sí; marca de base chica por verificar | brecha sí | por verificar |
| 15 | p98 | Peso en la satisfacción (regresión) con TTB/BTB | no se encontró (la FODA está retirada) | no | bloqueado: tipo nuevo, decisión metodológica |
| 16 | p103 | Nube de frases (dos y tres palabras) | no: la nube sólo cuenta palabras | no | bloqueado: tipo o modo nuevo |
| 17 | p104 | Pregunta abierta: frases y temas | no | no | bloqueado: depende de la codificación |
| 18 | p111–p112 | Diferencias significativas: intervalo de la diferencia; tabla de letras entre públicos | letras en `lamina_categorica.R`; tabla multi-pregunta por verificar | `mostrar_significancia` en apiladas y agrupadas | por verificar |
| 19 | p191 | Opción múltiple entre actores (base de cada actor, puede sumar más de 100) | por verificar | por verificar | por verificar |
| 20 | p192–p194 | Pregunta filtro y subpregunta; filtro al costado; llave sobre varias categorías | `llave` en `reporte_plan_slides.R`, por verificar | por verificar | por verificar |

## Controles muertos (el editor los muestra, el motor los descarta)

Medidos el 2026-10-13 con la regla de arriba sobre todo el registro. Contrato: `test-graficos-controles-llegan.R`.

| # | Gráfico | Control | Estado |
|---|---|---|---|
| M1 | Ranking en barras | «Marcar diferencias significativas» y su nivel | arreglado: formales de `p_barras_agrupadas()` → `overrides` |
| M2 | Barras apiladas | «Marcar diferencias significativas» y su nivel | arreglado: formales de `p_barras_apiladas()` → `overrides` |
| M3 | Ranking en barras | «Respetar ancho de etiquetas» | arreglado: formal → `overrides` |
| M4 | Indicador numérico | «Base del gráfico» | pendiente: el constructor no la recibe |
| M5 | Mapa de calor por criterio | Filtros | pendiente: el constructor no los recibe |
| M6 | FODA | Variable e índice de iteración | no aplica: FODA retirada; sólo planes viejos |

## Orden

0. **Controles muertos (M1–M5):** primero, porque mienten. M1–M3 hechos; M4–M5 siguen.
1. **Tanda 1:** lo que el motor nativo ya dibuja y el editor no ofrece (ítems 1 y 3; el 2 quedó decidido en contra). Cada configuración va con
   su arg en el registro, su control en la pestaña Gráfico, su ajuste en la ficha de la maqueta y su dibujo en el glifo.
2. **Tanda 2:** verificar en la lámina nativa las filas «por verificar» y pasarlas a tanda 1 o a bloqueadas.
3. **Tanda 3:** lo que no existe (ítems 12, 15, 16 y 17). Cada uno exige decidir qué es antes de construirlo.
