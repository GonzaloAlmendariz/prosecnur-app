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

## Tablero

| Etapa | Estado |
|---|---|
| E1 inventario de la familia escala | ☑ este documento |
| E2 bloque `ppt.composicion` + accesor `.std_comp()`; sustituir literales (V3) | ◐ escala, multilista, apretada, llenar, filas, tablas: 67769cc73, 6f6ec2d87, 3217e8155, e79c599b1, 4731bd1c3 (geometría idéntica). Queda `.LAM_TEMA_PRIMERA_CHICA` y los literales de cifras chicas, «solo» y filtro |
| E3 quitar lo muerto D1–D7 y corregir S1–S3 | ☑ D5 y D7 en este commit; D1–D4, D6 en f24d862b8; S1 en 3215d1eac (test que falla con la versión vieja); S3 en 96e2a8395 (0,34→0,36, máx 0,06 in); S2 en e7109da7c (geometría idéntica) |
| E4 UI de Gráficos contra el motor | ◐ ayuda de «Grosor mínimo» (f03bf8e3b); tabla y antetítulo de la maqueta (3c23b698c). Lección: la réplica de una regla del motor en el front se desfasa sola |
| E5 resto de familias | ☐ |
| E6 cierre: gate amplio y commit | ☐ |
