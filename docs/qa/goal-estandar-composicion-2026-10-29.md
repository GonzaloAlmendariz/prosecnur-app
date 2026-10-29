# GOAL — el motor define su estándar de composición (2026-10-29)

Encargo de Gonzalo: «Ahora que ya tenemos un estándar más fino, tratemos de mejorar la UI y que el motor defina mejor sus
estándares, elementos visuales, y que todo esté fino y no construido por encima».

## Vara

- **V1.** Toda decisión de composición de la familia escala (Sí/No, multilista, filtro, líneas y puntos con tabla) vive con
  nombre en el estándar (`exportar_estandar.R` → `estandar_pulso.json`) y se lee con un accesor.
- **V2.** Cero parches muertos o superpuestos.
- **V3.** Un refactor que no busca cambiar el dibujo deja la geometría de Arte idéntica a la de referencia (forma por forma).
- **V4.** La UI de Gráficos nombra y muestra lo mismo que decide el motor.

## Punto de partida (medido)

2455 literales decimales en 67 archivos `lamina_*.R`; 43 constantes `.LAM_*`, ninguna en el JSON.

## E1 — inventario de la familia escala

Abreviaturas: E `lamina_escala.R`, T `lamina_escala_temas.R`, LL `lamina_escala_llenar.R`, AI `lamina_escala_aire.R`,
ML `lamina_multilista.R`, SN `lamina_sino_escala.R`, FS `lamina_filtro_sub.R`, FC `lamina_filtro_sub_conta.R`,
TC `lamina_tabla_costado.R`, NU `lamina_numericos.R` (pesas). Líneas al 2026-10-29.

### Muerto (V2)

| # | Qué | Dónde | Por qué |
|---|---|---|---|
| D1 | `ancho_como_escala` y `.lam_multilista_igualar_ancho` | SN:37-41, ML:258 | nadie lee el campo; el ancho sale de `WB <- cb$ancho_barra` (E:312) |
| D2 | `fin_bloque`, `ttb_col`, `con_ttb`, `L` en `.lam_multilista_bloques` | E:420, E:273, ML:332-333, ML:257 | asignados y nunca leídos |
| D3 | `verde` | E:270 | asignado, no usado |
| D4 | `- dx_btb` | E:292 | siempre 0: la rama «solo» exige sin Bottom Two Box |
| D5 | parámetro `compartida` de `.lam_multilista_disponible` | ML:182 | no se usa |
| D6 | `.LAM_BASE_CHICA_N` | E:186 | nadie lo lee |
| D7 | parámetro `holgura` de `.lam_escala_temas_aire` | T:36 | el llamador nunca lo pasa |

### Desfasado (defecto real)

| # | Qué | Dónde | Efecto |
|---|---|---|---|
| S1 | `.lam_escala_chica_por_premisa` mide la cifra chica sobre la barra vieja (~7,52 in sin box) | AI:57 | el plan de la multilista puede no ver cifras chicas que sí se dibujan (6,2 in) |
| S2 | la cifra chica se juzga con dos anchos en el mismo bloque | E:349 vs E:382 | decisiones de grosor y de aire con barras distintas |
| S3 | 0,36 escrito a mano donde existe `aire_cifra_chica`; 0,34 casi igual | E:340, E:350, ML:155-162 | dos números para la misma regla |

### Superpuesto (V1/V2)

- **Aire vertical de la escala**, cuatro etapas que se deshacen: estirar `f_` (E:328) → aire de cifras chicas
  (E:340-351) → engrosar (E:324) → G11 recompacta y mueve aire entre temas (T:35-81) → centrar (LL:65, doble render).
- **La multilista repite todo**: `.lam_multilista_grosor` (ML:150-164), estirar `f` (ML:272), llenar en 3 pasadas
  (ML:312-329), y cada bloque lo vuelve a aplicar.
- **Aire mínimo calculado dos veces**: `.lam_aire_minimo` (AI:23-36) y `pide` de G11 (T:45-48).
- **Alto útil de tres maneras**: E:144, E:581, ML:182.
- **Aire barra → leyenda en seis lugares**: 0,55 (E:302), 0,3/0,45 (E:421), 0,12/0,45/0,09 (ML:334-336), 0,17 (FC:41,55),
  `leyenda_y − 0,05` (E:628, NU:259).
- **Rótulo TOP TWO BOX sobre la franja**: 0,45 (E, FC, ML «arriba») vs 0,37 (`.LAM_MULTILISTA_ROTULO_TTB`) vs 0,40 (FS:131).
- **Columna del box**: 1,5 in en E:211/230 y 1,3 en FS:83; el JSON dice `columna_top_two_box = 1` (sin consumidor).
- **Tipografía fuera de `tipografia`**: 20 pt (E:288, FS:190), 22, 26, 28, 10,5, 11 pt.

### Candidatos a `ppt.composicion` (E2)

aire_fila 0,24 · gap_premisas 0,26/0,08 · aire_tema 0,14 · aire_entre_temas_max 0,9/1,0 · aire_publicos_max 0,65 ·
aire_leyenda 0,30/0,45 · leyenda_piso 0,32 · rotulo_box_sobre 0,45 · columna_box 1,5 (y 1,25 con BTB) · grosor_holgado
(tabla Conta) · margen_bloque 0,1/0,15 · tabla_costado (col1, col, fila, hueco…).

## E5 — inventario de las demás familias (2026-10-29)

Abreviaturas: cat `lamina_categorica.R`, mix `lamina_mixtas.R`, pan `lamina_paneles.R`, dest `lamina_dicotomia_estandar.R`,
circ `lamina_circulares.R`, div `lamina_divergentes.R`. Ninguno llamaba a `.std_comp()`.

### Muerto (V2)

| # | Qué | Dónde | Estado |
|---|---|---|---|
| D8 | `.lam_panel_en_grilla` sin llamadores | cat:366 | ☑ fuera |
| D9 | `yf` asignado y no leído | cat:115 | ☑ fuera |
| D10 | `k` asignado y no leído en `.lam_circular_cabe` | circ:122 | ☑ fuera |
| D11 | parámetros `x`, `y` de `.lam_panel_barras_compactas` | cat:342, mix:206 | ☑ fuera |
| D12 | defaults `g = 0.34`, `fila = 0.66` | pan:28 | ☒ no es muerto: los usa test-lamina-panel-rotulo-box.R |

### Duplican una llave que ya existe

| # | Literal | Dónde | Llave |
|---|---|---|---|
| U1 ☑ | 0,5 entre columnas de la mixta | mix:24 | `geometria.separacion_paneles` |
| U2 ☑ | 0,36 aire de cifra chica | pan:81 | `geometria.aire_cifra_chica` |
| U3 ☑ | 34 pt cifra destacada | mix:300, circ:71, circ:101 | `tipografia.cifra_destacada` |
| U4 ☑ | 13 pt pregunta del panel | pan:13-14, mix:159, cat:280 | `tipografia.pregunta` |
| U5 ☑ | 12 pt rótulos de categoría (llave nueva `tipografia.rotulo_categoria`) | cat:30, 95; mix:185, 202; circ:102, 136 | `tipografia.actor` |
| U6 ☒ | pila de cifra de la torta 0,62/0,3/0,26 | circ:71-75 | `geometria.cifra_pieza` (casi igual): pieza distinta (lám. 69 vs `cifra()` de 21-22), 0,01 in; no se unifica |
| U7 ☑ | reserva 0,45 bajo las barras | cat:76 | `.LAM_USO_AREA$reserva` |

### Dos mecanismos para una decisión

- ☒ Rectángulos de la mixta (mix:30-76) contra `ppt.tipos_lamina`: coinciden en posición (filetes en 3,5 y 4,16, arranques
  en 3,7 y 4,36). Difieren en convención: la ranura del estándar termina 0,2 in antes del filete y el panel del motor llega
  hasta él (`exportar_estandar.R`: «3.5 − 0.2 − y1»). Única diferencia real: 2mas1, 0,05 in (panel de abajo en 4,0 contra
  4,05); el motor sigue a `recetario_m2b.R`. No se unifica: no cambia nada visible y el JSON comparte `y2`/`h2` con otros tipos.
- ☑ Alto de la pregunta del panel: `.lam_lineas` al dibujar (pan:13) y `.lam_ancho_tinta` al reservar (mix:159). Medido:
  la reserva quedaba una línea corta en 12 de 369 preguntas de las muestras a 6 in y 64 a 4 in. Ahora una sola cuenta,
  `.lam_panel_lineas` (corte por palabras sobre la tinta), para dibujar, reservar y el encabezado del Sí/No.
- ☑ Leyenda del panel copiada de `.lam_leyenda` (mix:134-146): el bucle que dibuja las filas es uno solo,
  `.lam_leyenda_dibujar` (lamina_escala.R); cada leyenda conserva lo suyo (límites, plan, tope sobre la base). Geometría idéntica.
- Grosor de la escala en panel: tres reglas (pan:81, mix:221, pan:137) y ninguna lee `.std_grosor`; piso 0,24 in contra
  `grosor.piso_escala_cm` 1,12 cm.
- ☒ Columna del box: `columna_top_two_box` = 1 (pan, mix) contra `composicion.escala.columna_box` = 1,5. No es doble: el
  panel mide media lámina y la escala la entera; son dos llaves para dos contextos, cada una con consumidor.
- ☒ Encaje de la divergente: `.lam_divergentes_cabe` (10,5 pt, 4,5 in) contra `.lam_divergentes_area` (12/11,5/11 pt).
  Medido: en 1–8 filas × 1–5 líneas no hay caso en que `cabe` acepte y la fila de `area` no contenga la afirmación (las
  alturas saltan por línea entera y la tolerancia de 0,06 in absorbe la diferencia). No se unifica.

### Contradicen las reglas ya cerradas en la escala

- F1 **pregunta a Gonzalo**: Conta dibuja el Sí/No solo al largo de la escala (lám. 7: 5,43→11,32 in ≈ 5,9; lám. 34 ≈ 5,5),
  pero el 85 % del ancho fue decisión deliberada (6ec72b494, defecto 3 de la v3 de Renzo). Arte hoy no tiene Sí/No sola. Barras de largo distinto: Sí/No de lámina entera ≈ 11,3 in, partida ≈ 12,1, en panel `w − 0,8`, apilada ≈ 9,7.
- F2 ☑ paneles: «TOP TWO BOX» en mayúsculas y en una línea (la caja crece con la tinta). Queda div:39 a 10,5 pt.
- F3 ☒ decidido (N5 de Gonzalo: «en PPT está bien»; el Word siempre apila; Arte usa `barra_estandar` por config). Cifras del Sí/No partido a 34 pt sobre la barra; la estándar las pone sobre el segmento en azul sin guía.
- F4 ☒ no contradice: lámina de dos columnas (disco y lectura), la leyenda va con su columna, como la del panel (N16). Leyenda centrada en el disco (circ:112) o en el panel (mix:245, 263), no en la lámina.
- F5 **bloqueado, decide Gonzalo**: encabezado «% de encuestados que marcó cada opción» sobre las barras (lamina_compositor.R:330,
  reporte_plan_opciones.R:436). Lo pidió el recetario p72 (CCSS-9b, CCSS-19) y lo guardan 5 tests: avisa que
  en opción múltiple los porcentajes no suman 100. No es un rótulo de eje genérico; quitarlo contradice esa decisión.

## Tablero

| Etapa | Estado |
|---|---|
| E1 inventario de la familia escala | ☑ este documento |
| E2 bloque `ppt.composicion` + accesor `.std_comp()`; sustituir literales (V3) | ◐ escala, multilista, apretada, llenar, filas, tablas: 67769cc73, 6f6ec2d87, 3217e8155, e79c599b1, 4731bd1c3 (geometría idéntica). Queda `.LAM_TEMA_PRIMERA_CHICA` y los literales de cifras chicas, «solo» y filtro |
| E3 quitar lo muerto D1–D7 y corregir S1–S3 | ☑ D5 y D7 en este commit; D1–D4, D6 en f24d862b8; S1 en 3215d1eac (test que falla con la versión vieja); S3 en 96e2a8395 (0,34→0,36, máx 0,06 in); S2 en e7109da7c (geometría idéntica) |
| E4 UI de Gráficos contra el motor | ◐ columna Top Two Box de la maqueta en un bloque Sí/No (la pregunta decide, con las categorías de su bloque, como `.box_decidir`); ayuda de «Grosor mínimo» (f03bf8e3b); tabla y antetítulo de la maqueta (3c23b698c). Lección: la réplica de una regla del motor en el front se desfasa sola |
| E5 resto de familias | ☑ inventario arriba; D8–D11 fuera (geometría idéntica). F2, U1–U5, U7 ☑ (geometría idéntica); D12, U6, F3, F4 cerrados sin cambio, con su porqué. Pregunta del panel y leyenda ☑; divergente, columna del box y mixtas medidos sin cambio. Queda el grosor de la escala en panel (pregunta) y F1, F5 que esperan a Gonzalo |
| E6 cierre: gate amplio y commit | ☑ gate R de lámina, gráficos, estándar, dicotomía, leyenda, radar, graficador, torta, dona y lollipop más contratos transversales: 13501 pass, 0 fail (2026-10-29); gate-front graficos 2239/2240, el rojo es ajeno (inputsDelKit, recopiladores/correos) |
| Abierto | Tres decisiones de Gonzalo: F5 encabezado de opción múltiple, F1 largo del Sí/No solo, grosor de escala en panel (piso 0,24 in contra 1,12 cm) |
