# Checklist · maqueta como ficha visual (implementación en el editor)

Pedido de Gonzalo (2026-10-13): «Apruebo, impleméntalo en el editor con los casos como test». Contrato:
`docs/qa/contrato-maqueta-lamina-2026-10-13.md` (M1–M10). Galería aprobada: `docs/qa/maqueta-galeria-maquetas-2026-10-13.html`.
Sólo Gonzalo da por terminado un ítem.

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| 1 | Modelo de la ficha: tipo, lectura de multiapiladas, preguntas, públicos, leyendas por escala (paleta o grises), ajustes y avisos; describe la parte que se dibuja | `frontend/src/features/graficos/laminas/maqueta/fichaModelo.ts` (+ `modeloMaqueta.ts`) | hecho, por verificar por Gonzalo |
| 2 | Geometría: retícula común (horizontal / vertical), centrado (M3), ajuste por niveles hasta caber (M4), filas reales del dibujo con su columna de pregunta y su Top Two Box (M2, M5) | `laminas/maqueta/geometriaFicha.ts` | hecho, por verificar por Gonzalo |
| 3 | Render SVG de la ficha con los íconos por tipo de la app; los demás tipos con su glifo de `glifosGrafico.tsx` | `laminas/maqueta/FichaRanura.tsx`, `fichaRanura.css` | hecho, por verificar por Gonzalo |
| 4 | Maqueta de la lámina: fichas en sus ranuras, insignia de la composición (ícono y nombre), título y base editables como hoy | `laminas/MaquetaLamina.tsx` | hecho, por verificar por Gonzalo |
| 5 | Transiciones (M8): barras con clave que transitan 240 ms con curva de salida; sin animación al montar; «reducir movimiento» | `fichaRanura.css`, `FichaRanura.tsx` | hecho, por verificar por Gonzalo |
| 6 | Casos de la galería como tests: multiapiladas 1–11c, composiciones 12–16, vacíos 21; ninguna pieza fuera de su ficha en las 22 composiciones | `laminas/maqueta/*.test.ts` | hecho, por verificar por Gonzalo |
| 7 | Retiro de lo que la ficha reemplaza (`DibujoBloques`, columna de info, `usaFilasCompactas`) y su CSS | `laminas/` | hecho, por verificar por Gonzalo |
| 8 | Láminas de estructura con el dibujo de la galería (portada, índice, separador, objetivo ×3, cómo leer, redondeo, ficha técnica, texto, cierre) | `iconos/dibujosEstructura.tsx` / nuevo | pendiente (siguiente tanda) |
| 9 | Dibujos por tipo que reflejan sus ajustes (promedio, top N, neutro y saldo, con tabla, por grupo…) | `glifosGrafico.tsx` / nuevo | pendiente (siguiente tanda) |
| 10 | Ícono propio de la Matriz FODA dimensional (hoy cae en el marco genérico) | `iconos/iconosGrafico.tsx` | pendiente (hallazgo) |
| 11 | M10: «Respuestas por público» como ajuste (motor + pestaña Gráfico + ficha) | `api/R/lamina_escala.R`, `argsDatosGrafico.ts` | pendiente (siguiente tanda) |

## Notas

- Lecturas de multiapiladas desde los args (`MultiApiladasBuilder.tsx` `detectIntent`): `modo` multilista → Bloques;
  cruce → Una pregunta por grupos; var_cruce con `vars` objeto → Públicos por tema, con lista → Preguntas por grupos;
  si no → Preguntas. Filas: por grupos = categorías de `cruces`; públicos por tema = refs del tema; preguntas = 1.
- Los 28 graficadores tienen glifo propio en la app (`glifosGrafico.tsx`); la ficha los reutiliza.

## Lo que salió al implementar

- Caso que la galería no tenía: la ranura de 8,47 × 1,6 in de «Dos gráficos + texto izquierda» desbordaba la ficha en
  vertical. Las ranuras apaisadas van en horizontal aunque sean bajas, y hay dos niveles más (sin leyendas; sólo
  cabecera y dibujo). Lo fija el test de las 22 composiciones.
- La letra real de la app mide 0,56 em por carácter (no 0,5): con la estimación vieja las leyendas se encimaban.
- `--pulso-primary-bg` y `--pulso-primary-strong` no están definidos en la raíz (el chip salía negro): la ficha usa
  `--pulso-primary-soft` y `--pulso-primary`.
- Lámina 1 de Arte (género): no es «Dicotómica» (4 respuestas) y no lleva Top Two Box; port de `.goc_pistas_orden` a
  `tienePistasDeOrden` para que la maqueta omita el box donde el motor lo omite (`sin_orden`).
