# Checklist — Cierre del loop de Cálculo de muestra (egresados, aulas, deuda de E11)

Tipo: Checklist vivo · Fecha: 2026-09-24 · Etapas E12–E14 del loop

Pedido de Gonzalo (textual): «Validos todo», en respuesta a los tres caminos
que quedaron abiertos al cerrar E11: egresados con la regla por precisión,
defectos propios de aulas vistos en la baseline visual y la deuda menor de E11.

## Ítems

| # | Ítem | Dónde vive | Dueño | Estado |
|---|---|---|---|---|
| G1 | Egresados con la regla por precisión del ADR 0091: censo (cobertura mínima 50 %) mientras un MAS a ±5 % pediría ≥ 50 % de la base (hasta N ≈ 385); desde ahí MAS a ±5 % con respuesta 50 %, control por año de egreso. Muestra monótona, salto ≤ 1, un único cambio de técnica | `api/R/calc_muestra_acreditacion_cuadro.R`, `.cm_inferir_acreditacion` | backend-r | ☑ backend-r: censo hasta 385, MAS desde 386 (193/193); 5 000 → 357, 714 a campo; mutantes caen |
| G2 | Metas heredadas de egresados (clamp(50 % N, 30, 150) sin `origen`) se tratan como del cuadro | `.cm_cuadro_meta_legado` | backend-r | ☑ 150 sin origen con N ≥ 301 → del cuadro |
| G3 | ADR 0091 ampliado a egresados; copys C-C30/C-C31; research; tablero | `docs/` | lead | ☑ ADR 0091 ampliado, índice, copys C-C30/C-C31; además el origen y el respaldo siguen a la técnica nueva cuando el cuadro la cambia |
| A1 | «Guardando…» persistente con sólo abrir un proyecto de aulas | por diagnosticar (universidad/**, autosave) | frontend-react | ☑ causa única corregida en `study.ts` (reconcile devolvía workspace nuevo sin cambio); QA: 15/15 aperturas «Guardado», 0 escrituras. El indicador ya no miente: «Cambios sin guardar» en el debounce, «Guardando…» sólo con el PUT, «Error al guardar» si falla |
| A2 | KPIs «—» con «calculado con una versión anterior» al abrir | por diagnosticar | frontend-react | ☑ `{}` de R (resultado NULL) = «falta calcular», no «versión anterior» (`calcMuestraDistribucionI19.ts`); C5 legítimo en la copia sin cálculo |
| A3 | Chip `p 0.3` sin estilo | universidad/** | frontend-react | ☑ clave del glosario corregida + `chipSinGlosario`; 7 chips iguales (28 px) |
| A4 | Cuadrícula de KPIs con celdas huérfanas a 1024 (6 + 2) | universidad/** CSS | frontend-react | ☑ banda ≤ 720 de alto en una fila (8 × 123–155 px), sin huérfanos |
| A5 | C1 sin declarar: `ul.cmv2-salud-lista`, `cmv2-calc-supuestos`, `section.cmv2-generales-card` | universidad/** | frontend-react | ☑ `salud-criterios`, `calculo-supuestos`, `salidas-coincidencia-metodo`; resultado/detalle como miembros (como grupos daban capacity-drift 3.8/11 px) |
| A6 | Contraste: «cifra validada» 1.94:1, «Proyecto activo» 3.02:1, 33 textos < 4.5 en Marco | universidad/**, `didactica/` (BadgeMotor) | frontend-react | ☑ «cifra validada» 6.66:1 (la animación ya no baja opacidad), «Proyecto activo» 6.03:1 (`--pulso-success-fg`), `.cmv2-crit-item-count em` sin opacidad (era 4.2:1) |
| A7 | 8 inputs numéricos de Selección de aulas con rótulo visual no asociado | universidad/aulas/** | frontend-react | ☑ 8 campos con `aria-labelledby`/`aria-describedby` (`CampoNumeroAulas`) |
| D1 | V5: el tooltip del reparto se cierra solo cuando el foco desplaza el contenedor (debe seguir abierto mientras la barra tenga el foco) | `general/RepartoEstratosGrafico.tsx` | frontend-react (ola 2) | ☑ el tooltip sigue abierto y pegado a la barra cuando el foco desplaza (80/580/2080 ms); Escape lo cierra |
| D2 | V10: decimal «0,04» en inputs numéricos | `frontend/index.html` | lead (medido) | ☑ medido, no controlable: Chromium (Playwright, 2026-09-24) pinta «0,04» con `lang` es, es-PE y en, y con locale de contexto es-PE, es-ES y en-US — el separador de `<input type=number>` sale de la configuración regional del sistema operativo. `lang` no lo cambia (los `lang="es-PE"` de W2 quedan como semántica). Controlarlo exige inputs de texto con `inputmode="decimal"` y parseo propio: cambio transversal, fuera de alcance |
| D3 | 1024: fila de aviso del encabezado de Muestra general en su propia línea (cabecera+banda 155–171 px) | `general/EncabezadoSeccion.tsx`, `mesa.css` | frontend-react (ola 2) | ☑ 119 px (marco/método/resultados) y 135 px (selección) a 1024×600; antes 155–171 |
| B1 | Barra superior de Muestra general y Acreditación sin atajos (Gonzalo: «No se si estos botones deberia estar aqui, el calculo de aulas no los tenia alli, porque cada tab y subtab tenia una fucion especificas que no era necesario hacerle bypass»): fuera «Calcular» (ya está en la cabecera de cada sección), «Reporte» pasa a Resultados › Propuesta y traspaso (con motivo si está deshabilitado y «Ver»), «Cambiar tipo» pasa a la ficha del estudio de la primera sección; la barra queda con el indicador de guardado, como aulas | `CalcMuestraPage.tsx` (congelado: sólo baja), `general/MesaGeneral.tsx`, `MesaAcreditacion.tsx`, `PropuestaTraspaso.tsx`, ficha del estudio | lead | ☑ barra de Muestra general y Acreditación sólo con el indicador de guardado; «Generar reporte» en Resultados › Propuesta y traspaso (Acreditación: panel en Resultados); «Cambiar el tipo de estudio» al pie de la ficha del estudio; CalcMuestraPage 3040 → 3002 líneas |

## Evidencia

QA visual independiente `e12_qa/` (aulas 15 capturas, general 12, acreditación
6; 22 PASS · 8 FAIL · 3 DEBT antes de los dos últimos arreglos) y corrida de
cierre `e14/` tras A5/A6/B1: aulas Marco+Salidas, general Marco+Resultados y
acreditación Contexto+Resultados, 1440×1000 y 1024×600, `ok=true`,
`geometryIssues=0`, md5 12/12. Front 261 archivos / 2 418 tests; tsc 0.
DEBT que queda: `span.vlist-r` interno de KaTeX sin declarar (ya en la
baseline) y 14.8 px de capacity-drift en `aulas-objetivo-controles` a 1280 y
1024 (ya en la baseline, no tocado aquí).

