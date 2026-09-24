# Checklist — Cierre del loop de Cálculo de muestra (egresados, aulas, deuda de E11)

Tipo: Checklist vivo · Fecha: 2026-09-24 · Etapas E12–E14 del loop

Pedido de Gonzalo (textual): «Validos todo», en respuesta a los tres caminos
que quedaron abiertos al cerrar E11: egresados con la regla por precisión,
defectos propios de aulas vistos en la baseline visual y la deuda menor de E11.

## Ítems

| # | Ítem | Dónde vive | Dueño | Estado |
|---|---|---|---|---|
| G1 | Egresados con la regla por precisión del ADR 0091: censo (cobertura mínima 50 %) mientras un MAS a ±5 % pediría ≥ 50 % de la base (hasta N ≈ 385); desde ahí MAS a ±5 % con respuesta 50 %, control por año de egreso. Muestra monótona, salto ≤ 1, un único cambio de técnica | `api/R/calc_muestra_acreditacion_cuadro.R`, `.cm_inferir_acreditacion` | backend-r | ☐ |
| G2 | Metas heredadas de egresados (clamp(50 % N, 30, 150) sin `origen`) se tratan como del cuadro | `.cm_cuadro_meta_legado` | backend-r | ☐ |
| G3 | ADR 0091 ampliado a egresados; copys C-C30/C-C31; research; tablero | `docs/` | lead | ☐ |
| A1 | «Guardando…» persistente con sólo abrir un proyecto de aulas | por diagnosticar (universidad/**, autosave) | frontend-react | ☐ |
| A2 | KPIs «—» con «calculado con una versión anterior» al abrir | por diagnosticar | frontend-react | ☐ |
| A3 | Chip `p 0.3` sin estilo | universidad/** | frontend-react | ☐ |
| A4 | Cuadrícula de KPIs con celdas huérfanas a 1024 (6 + 2) | universidad/** CSS | frontend-react | ☐ |
| A5 | C1 sin declarar: `ul.cmv2-salud-lista`, `cmv2-calc-supuestos`, `section.cmv2-generales-card` | universidad/** | frontend-react | ☐ |
| A6 | Contraste: «cifra validada» 1.94:1, «Proyecto activo» 3.02:1, 33 textos < 4.5 en Marco | universidad/**, `didactica/` (BadgeMotor) | frontend-react | ☐ |
| A7 | 8 inputs numéricos de Selección de aulas con rótulo visual no asociado | universidad/aulas/** | frontend-react | ☐ |
| D1 | V5: el tooltip del reparto no se cierra cuando el foco desplaza el contenedor | `general/RepartoEstratosGrafico.tsx` | frontend-react (ola 2) | ☐ |
| D2 | V10: decimal «0,04» en inputs numéricos | `frontend/index.html` | lead (medido) | ☑ medido, no controlable: Chromium (Playwright, 2026-09-24) pinta «0,04» con `lang` es, es-PE y en, y con locale de contexto es-PE, es-ES y en-US — el separador de `<input type=number>` sale de la configuración regional del sistema operativo. `lang` no lo cambia (los `lang="es-PE"` de W2 quedan como semántica). Controlarlo exige inputs de texto con `inputmode="decimal"` y parseo propio: cambio transversal, fuera de alcance |
| D3 | 1024: fila de aviso del encabezado de Muestra general en su propia línea (cabecera+banda 155–171 px) | `general/EncabezadoSeccion.tsx`, `mesa.css` | frontend-react (ola 2) | ☐ |
