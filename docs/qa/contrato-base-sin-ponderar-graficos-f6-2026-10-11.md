# Contrato — base sin ponderar en Gráficos (S1–S4, I1–I7)

Tipo: Contrato de implementación
Estado: Vigente
Fecha: 2026-10-11
Autoridad: Decisiones S1–S4 de Gonzalo (lote 13, 2026-10-11); revisor-metodologico; lead de la Meta A

Fuente de las decisiones: `hallazgo-base-ponderada-2026-10-10.md`. Invariantes de dominio copiados: `.claude/skills/
dominio-prosecnur/SKILL.md` §2 (multibase: estado por base) y §5 (códigos especiales 90–99 no se borran; `peso` se
recalcula de forma determinista); `.claude/skills/nucleo-metodologico/SKILL.md` §Ponderación (trim y re-normalización a
media = n; n efectivo de Kish = (Σw)²/Σw²).

## 0. Unidad, base y grano

- Unidad: la fila de la base graficada (en una hija repeat, el miembro). Población: filas tras filtros, exclusiones y
  saltos de la lámina, con peso > 0.
- Base (I1): entero de casos con respuesta válida, sin ponderar. Ponderado (I2): %, medias, medianas, Top Two Box.
- `n` (ponderado, como hoy) y `n_casos` (casos) salen del mismo vector de pesos y en la misma llamada:
  `n_casos == #{w > 0}` sobre las mismas filas que suman `n`. Huérfanos de repeat (peso NA → 0) quedan fuera de ambas.

## 1. Dónde nace cada n hoy (suma de pesos salvo donde se indica)

`freq_table_spss` (`reporte_frecuencias.R:1306`; copia muerta en `:861`): SM con madre (`:1373-1384`), SM dummies
(`:1395-1424`), select_one (`:1438-1474`, sin filtrar peso > 0), `.completar_categorias` (`:214-288`). Envoltura
`.tab_freq` (`reporte_plan_ppt.R:3350-3362`); `.reporte_plan_prepare_freq_options` (`reporte_plan_opciones.R:91-121`)
reconstruye sólo `Opciones` y `n` (ahí se perdería `n_casos`). Por familia: categórica/pie (`reporte_plan_ppt.R:6072-6181`;
graficador `graficador_barras_categoricas.R:271-284`; `.espec_n_base` `lamina_categorica.R:205-212`); apilada/escala
(`reporte_plan_ppt.R:4407-4478`; `graficos_espec_escala.R:84-88, 134-140`; `.lam_base_chica`, `.lam_casos_texto`,
«N respuestas» en `lamina_escala.R`; fila Total `graficador_fila_total.R:20-37`); multiapilada (`:4967-4986`); cruces
(`:5195-5234`, `:5427-5458`, `:5591`, `:5869`, `:5946`); base del pie PPT y Word (`:3435-3605`,
`reporte_plan_base_por_grafico.R:60`, `reporte_plan_word.R:489`); base reducida (`reporte_plan_base_criterio.R:67-87`);
dimensiones/FODA/criterios (`indicador_dimensiones_shared.R:1287-1379`, `reporte_plan_ppt.R:3740-3771`,
`graficos_espec_dimensiones.R:97, 117-137`); numéricos (`:6682-6688`, `:3676`, `:3705`); radar multibase
(`graficos_radar_multibase.R:31-52`). Ya correctos: mapa resultado, puntos comparativos, cifra. n por barra
(`graficador_n_por_barra.R:44-75`) compara misma unidad.

## 2. Campos

1. `freq_table_spss(..., casos = FALSE)` opt-in: con `TRUE` añade `n_casos` entero por fila y Total (select_one = suma;
   múltiple = personas con al menos una marca y w > 0, no la suma). Opt-in porque el XLSX vuelca el data.frame entero
   (S1: los tabulados no cambian).
2. `.tab_freq` y las llamadas directas (`:5195`, `:5591`, `:5869`) piden `casos = TRUE`; `prepare_freq_options` arrastra y
   suma `n_casos` al deduplicar.
3. Helper nuevo `.plan_base_de_tab(tab_crudo, tab_filtrado, es_sm)` → `list(n, n_casos)`; reemplaza las ~7 copias de
   «N desde Total o suma si hubo exclusión»; la exclusión recalcula ambas.
4. Tabla ancha: `N` + `N_casos`; `n_i` + `nc_i`.
5. Graficadores (apiladas, agrupadas, categóricas, pie): args opcionales `var_n_casos` / `cols_n_casos`; % y fila Total
   con `var_n`; «Base», «(33)», «N =», `mostrar_frecuencia` con casos; sin el arg, `n_casos := n`.
6. Especificaciones: escala `filas$n_casos` y `box$casos` = suma de casos crudos de las columnas del box (no
   `prop × n`); categórica `n_casos` y `n_base_casos`; dimensiones `n_respondieron` en casos; lector único
   `.espec_casos(x) = x$n_casos %||% x$n`.
7. A casos: pie «Base: N» (PPT y Word), `.format_n_caption`, `.reporte_plan_base_componer_nota`, «x de y»,
   `.lam_base_chica` (umbral < 30), «N respuestas», «Masculino (33)», `.n_barra_procede`, público de paneles, detalle de
   «Otros», base reducida (I7: universo = casos con peso > 0), base de dimensiones/FODA/criterios.
8. Siguen ponderados: `pct`, `pct_exacto`, cifras, Top Two Box, promedio, fila Total (ver D-a), orden de grupos de
   dimensiones (S-e), XLSX completos (S1).
9. `n_casos` es entero por construcción; prohibido `as.integer()` sobre una cifra ponderada que se muestre.

## 3. S2 y S4

- Texto único en `reporte_ponderacion_sello.R:84-95`: aplicada con n efectivo → «Resultados ponderados (n efectivo = X)»
  (`format(round(n_eff), big.mark = ",", trim = TRUE)`); sin n efectivo → «Resultados ponderados». Fallback y «sin
  config» no cambian.
- n efectivo sólo en la ficha técnica: Word/XLSX fila «Ponderación» (`reporte_ficha_tecnica.R:236-247`); PPT añade la
  fila con un helper cuando la corrida está ponderada y la tabla no la trae (el texto del usuario manda); multibase por base.
- S2: el sello por lámina se apaga (`.reporte_plan_nota_base_sellada`, `reporte_plan_opciones.R:547-559`, devuelve la nota
  intacta; afecta `reporte_plan_ppt.R:3605` y `:4138` sin editarlo).
- «Cómo leer» del Word (`reporte_word_como_leer.R:127-133`), corrida ponderada: «Los porcentajes están ponderados. La
  base de cada gráfico es el número de personas que respondieron, sin ponderar; por eso, en grupos chicos, “12 de 15”
  puede no coincidir con el porcentaje.»
- Cifra: «Con el peso del estudio» (`graficos_cifra.R:56-58, 79`) → «Base: n respuestas» en casos.

## 4. Sin ponderación: cero cambio visible (test obligatorio)

Sin `peso` o con pesos 1: `n_casos == n` en cada fila; notas byte a byte iguales (`test-reporte-ponderacion-sello.R:318-319`).

## 5. Rebanadas

`reporte_plan_ppt.R` en línea base exacta 9817: sólo sustituciones con saldo ≤ 0 (el helper de §2.3 libera líneas).
`graficador_dimensiones.R` no se toca.
- Writer A (datos y plan): `reporte_frecuencias.R`, `reporte_plan_opciones.R`, `reporte_plan_base_criterio.R`,
  `reporte_plan_base_por_grafico.R`, `indicador_dimensiones_shared.R`, `graficos_espec_dimensiones.R`, nuevo
  `reporte_plan_base_casos.R`, `reporte_plan_ppt.R` (sólo sustituciones, incluido el enganche de la ficha en `:8141`).
- Writer B (especificaciones, renderers y documento): `graficos_espec_escala.R`, `graficos_espec_categorica.R`,
  `lamina_*.R`, `graficador_barras_apiladas.R`, `graficador_barras_agrupadas.R`, `graficador_barras_categoricas.R`,
  `graficador_pie_dicotomico.R`, `graficador_fila_total.R`, `graficador_n_por_barra.R`, `graficos_cifra.R`,
  `reporte_ponderacion_sello.R`, `reporte_word_como_leer.R`, `reporte_word_documento.R`, nuevo
  `lamina_ficha_ponderacion.R`. B funciona sin los campos nuevos (`n_casos := n`).

## 6. Tests (fixture: 20 casos peso 2.25, 10 peso 1, 2 peso 0, 3 NA → n = 55, n_casos = 30)

1 sin pesos idéntico (mutantes: `n_casos = nrow`, contar peso 0); 2 `freq_table_spss(casos=TRUE)` 55/30 (`round(n)`);
3 XLSX sin columna nueva (default TRUE); 4 SM Total = personas ≠ suma; 5 umbral: 20×2.25 es chica, 40×0.5 no (usar n);
6 «12 de 20» con 48 % (`floor(prop × n_casos + 0.5)`); 7 redondeo con n = 47.6 (`as.integer(n)`); 8 exclusión select_one
(tomar el Total); 9 I7 `test-reporte-base-criterio.R:305` «Base: 47» → «Base: 44» a propósito; 10 I6 multibase «52
docentes y 172 estudiantes»; 11 huérfanos de repeat fuera; 12 denominador cero sin «Base: 0»; 13 `mostrar_todo` con
`n_casos = 0`; 14 `.espec_n_base` lee `n_base_casos` (mediana); 15 `.n_barra_procede` casos contra casos; 16 S2/S4 (cambian
a propósito `test-reporte-ponderacion-sello.R:67-69, 95, 118, 123, 206, 211, 292, 342`); 17 fila Total según D-a.
Ningún proyecto de referencia trae pesos: inyectar `peso` sintético en memoria sobre `acrconta_mazo` dentro del test.

## 7. Decisiones abiertas (Gonzalo) y supuestos

- D-a fila Total por actores: hoy por `var_n` ponderado y su cabecera promete «cada actor pesa por su base válida».
  Recomendado: misma base → ΣW; varias bases → `n_casos`.
- D-b S2 puede dejar un entregable sin declarar su ponderación (el Word sólo arma «Cómo leer» con escalas; el PPT no
  tiene «Cómo leer» y su ficha es opcional). Recomendado: con ponderación, «Cómo leer» automático se enciende y un PPT
  ponderado sin ficha da advertencia en `graficos_verificar_mazo.R`.
- D-c fallback «Base sin ponderar (ponderación configurada no aplicada)»: recomendado llevarlo al documento con una
  advertencia de corrida.
- Supuestos: S-a «x de y» en casos no coincide con el % ponderado (se explica); S-b texto de «Cómo leer»; S-c la cifra deja
  «Con el peso del estudio»; S-d S4 sólo renombra «aplicada»; S-e orden de grupos de dimensiones por base ponderada.
- ADR recomendado (no bloquea): «La base es casos y los porcentajes van ponderados».
- Fuera de alcance (ítems aparte): medias numéricas sin peso (`reporte_plan_numerico.R:88-97`, viola I2); tres
  resolutores de peso (I5); base de `dim_heatmap_criterios` ignora `el$filtros`; `freq_table_spss` duplicada; n efectivo de
  hijas repeat.
