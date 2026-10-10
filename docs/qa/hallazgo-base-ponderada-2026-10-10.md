# Hallazgo: con peso del estudio, la «Base» del informe es la suma de pesos

Tipo: Hallazgo metodológico (revisor-metodologico, solo lectura)
Estado: Esperando decisión de Gonzalo (S1–S5)
Fecha: 2026-10-10
Autoridad: Evidencia de lectura de código y mediciones; no reemplaza un ADR

## Qué pasa

Cuando una base tiene peso del estudio, el motor rotula como «Base: N» la **suma de pesos** de quienes respondieron, no el
número de casos. Medido en una lámina 22 con 100 casos: el pie y los paneles dicen «Base: 160 respuestas». Con pesos de
expansión (ADR 0090, `peso_base = 1/pi`) diría miles; con pesos normalizados, cifras no enteras («47.38») o mayores que los
entrevistados en un subgrupo. La regla de bases chicas (< 30) también se evalúa sobre la suma de pesos: 20 casos con peso
2.25 suman 45 y no se marcan.

El recetario siempre expresa la base en personas («Base: 52 docentes y 172 estudiantes»; «con menos de 30 personas, junto
al porcentaje va el número de casos, “12 de 15”»). La práctica estándar (Pew, AAPOR, tablas SPSS publicadas) es la misma:
**la base es el n sin ponderar y los porcentajes van ponderados**.

## Dónde está

El origen es `freq_table_spss` (`api/R/reporte_frecuencias.R:1306`, vigente; `n` = `sum(peso)` en `:1335-1415`), que sólo
mira una columna llamada `peso`. De ahí lo toman:

- Pie de lámina y del Word: `.base_auto_from_var` / `.base_auto_from_refs` / `.base_auto_from_element` /
  `.base_auto_de_elementos` (`reporte_plan_ppt.R:3443-3605`), `.base_por_grafico` (`reporte_plan_base_por_grafico.R:60`),
  `entry$base` del Word (`reporte_plan_ppt.R:3119`, `reporte_plan_word.R:489`).
- Dimensiones y FODA: `reporte_plan_ppt.R:3754-3769` (`sum(w)` explícito).
- Cruces: `reporte_plan_ppt.R:5195-5211`.
- Base reducida: `reporte_plan_base_criterio.R:67-87`.
- Público de los paneles nativos: `.espec_n_base` (`lamina_categorica.R:205-212`), `lamina_mixtas.R` (encabezados),
  `lamina_compositor.R:254-257`.
- n por barra (trunca con `as.integer`): `lamina_categorica.R:23, 219`, `lamina_circulares.R:74, 103`,
  `lamina_numericos.R:68, 186, 253`, `lamina_escala.R:28, 166-216`.
- Bases chicas: `lamina_escala.R:187`, `graficador_n_por_barra.R`.

Ya lo hacen bien (porcentaje ponderado, n sin ponderar): `graficador_puntos_comparativos.R:313/329`,
`graficos_mapa_resultado_plan.R:71`, `graficos_cifra.R`.

Riesgo adicional: la cifra y los puntos comparativos resuelven el peso por `attr(data, "var_peso")` o la columna `peso`;
`freq_table_spss` sólo por `peso`. Si `var_peso` apunta a otra columna, la misma lámina mezcla ponderado y sin ponderar.

## Regla propuesta (para congelar si Gonzalo la aprueba)

- I1. «Base: N» = casos con respuesta válida (tras filtros, exclusiones y saltos, con peso > 0), sin ponderar, entero. Vale
  para pie, panel, público, n por barra, «k de n» y el Word.
- I2. Porcentajes, medias, medianas y Top Two Box siguen ponderados.
- I3. Bases chicas sobre el n de I1 (el n efectivo de Kish sólo en la ficha técnica).
- I4. Selección múltiple: personas con al menos una marca.
- I5. Una sola resolución del peso en todo el motor (`var_peso`, si no `peso`), compartida por `freq_table_spss`.
- I6. Multibase: cada parte del pie cuenta casos de su base.
- I7. Base reducida: universo y total válido en casos.

Implementación sugerida: no cambiar el `n` de `freq_table_spss` (los tabulados XLSX pueden querer frecuencias ponderadas);
añadir `n_casos` y que bases, especs y paneles lo lean. Cambio de contrato deliberado: `test-reporte-base-criterio.R:296-306`
pasa de «Base: 47» a «Base: 44».

## Decisiones de Gonzalo

- S1. ¿La base es n sin ponderar también en los tabulados XLSX, o sólo en láminas y Word? (recomendado: sólo láminas y Word)
- S2. ¿La ponderación se declara una vez por documento («Cómo leer» y ficha técnica), no en cada lámina? (recomendado: sí)
- S3. ¿El umbral de bases chicas usa n sin ponderar? (recomendado: sí)
- S4. ¿Se renombra el sello «Base ponderada (n_eff = X)» a «Resultados ponderados (n efectivo = X)»? (recomendado: sí)
- S5. Verificado en parte (2026-10-10): `base_universe` de dimensiones **es suma de pesos**
  (`indicador_dimensiones_shared.R:1287-1288`, `sum(w)` con `.dim_safe_weights`). El n de `preparar_escala` es la columna
  `var_n` que le pasa el graficador (`graficos_espec_escala.R:88`), calculada aguas arriba con las tablas de frecuencia; por
  eso hereda el `n` ponderado de `freq_table_spss`. Falta confirmarlo por cada camino (multiapiladas por bloque, cruces).
