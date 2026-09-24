# Checklist — Aulas como patrón para Muestra general y Acreditación (E15)

Tipo: Checklist vivo · Fecha: 2026-09-24 · Etapa E15 del loop de Cálculo de muestra

Pedido de Gonzalo (textual): «Creo que de todas forma amerita un segunda
revision con captura, de todas las tabs y subtabs de aulas y que lo uses como
ejemplo a seguir para lo demas».

Evidencia: revisión visual independiente sobre copias calculadas
(`scratchpad/e15/`): 32 pestañas de aulas a 1440 (md5 32/32; PASS 24 · FAIL 5 ·
DEBT 2 · INVALID 1) + 4 a 1024; Muestra general y Acreditación con y sin
cálculo a 1440 y 1024 (C1–C4 conformes; brechas de estructura).

## Catálogo de patrones de aulas (lo que se replica)

1. Una pregunta por pestaña: rail de 5–10 pestañas por sección, título + detalle formulan la pregunta (`UniversityTabHeader`, `CALC_MUESTRA_UNIVERSIDAD_PESTANAS`).
2. Banda «Diseño vigente» única y compacta (~95 px), constante entre pestañas (`motor/ResumenDiseno.tsx`).
3. Cifra con origen (`CifraMotor`/`CifraFila`, «cifra validada»).
4. Veredicto primero: franja de conclusión con la cifra grande (`CoberturaObjetivoStrip`).
5. Cadena con mermas (`FlujoVertical`, `MuestraFlowDiagram`).
6. Fórmula viva (`FormulaLatex` + `TerminoChip`).
7. Gráfico por grupo a ancho completo con escala compartida y «x de N».
8. Tabla de decisión por fila.
9. Siguiente condición DENTRO de la pestaña, con un solo botón que resuelve o lleva adonde se resuelve (`AulasStageNotice`).
10. Cada pestaña, su acción; sin atajos globales (`ClassroomLabCommandBar`).
11. Riesgos en columna lateral e inspector.
12. Lo secundario agrupado (`PanelAvanzado`).
13. Vacío que prepara (`ClassroomSelectionPreparationPanel`, `ClassroomEmptyState`).
14. Relato por escenas.

## Ítems

| # | Ítem | Dónde vive | Dueño | Estado |
|---|---|---|---|---|
| P1 | Selección partida en pestañas (patrón 1). General: Sorteo · Corrida · Unidades. Acreditación: Sorteo · Corrida · Unidades del actor en `foco` (el selector de actor queda arriba de las pestañas) | navegación v3 (`lib/navegacion/catalogos/calcMuestra.ts`, `modules.ts`), `general/SeleccionGeneral.tsx`, `SeleccionActores.tsx` | frontend (W-A) | ☐ |
| P2 | Método de General en pestañas: Técnica · Parámetros · Cómo sale el n (memoria con fórmula viva y cadena) · Estratos | `general/MetodoGeneral.tsx` y afines | frontend (W-A) | ☐ |
| P3 | Marco de General: el selector de formas pasa a su pestaña; con el marco declarado se abre en el archivo del marco | `general/MesaGeneral.tsx`, `MarcoShapeSelector.tsx` | frontend (W-A) | ☐ |
| P4 | Sin acción global en la cabecera de sección: la cabecera dice estado y siguiente condición con enlace; «Calcular» vive en Método (y en la pestaña donde se resuelve), como aulas (patrones 9–10) | `EncabezadoSeccion.tsx`, `SiguienteCondicion.tsx`, pestañas | frontend (W-A) | ☐ |
| P5 | Cabecera + banda compactas (≤ ~110 px a 1440), constante entre pestañas (patrón 2) | `BandaDiseno*.tsx`, `mesa.css` | frontend (W-A) | ☐ |
| P6 | C5 Acreditación: un actor cuya técnica actual no da π no puede figurar «SORTEADO» por una corrida vieja (banda vs Selección «Sin sorteo · no da π») | `bandaDisenoModelo.ts` (`vigenciaSorteo`), `BandaDisenoAcreditacion.tsx` | frontend (W-B) | ☐ |
| P7 | Resultados abre con veredicto (n alcanzado vs objetivo, margen vs pedido) — patrón 4 | `ResultadosComponentes.tsx` | frontend (W-B) | ☐ |
| AD1 | Aulas: «Comparar métodos» corre 0 simulaciones (`CM_CORRIDAS_COMPARACION = 0`, `duracionComparacion.ts:~133`) y Método/Simulación/Selección/Auditoría exigen 500 → la UI no deja sortear | por diagnosticar | diagnóstico → dueño | ☐ |
| AD2 | Aulas: ¿Alcanza? devuelve 409 `E_CALC_MUESTRA_ALUMNOS_CH_DECISION` tras confirmar Alumnos por CH; el mensaje «Recalcula» no lo arregla | por diagnosticar | diagnóstico → dueño | ☐ |
| AD3 | Aulas: visitar Histórico deja el proyecto «sin guardar» sin editar | por diagnosticar | diagnóstico → dueño | ☐ |
| AD4 | Aulas: jerga interna en Criterios del estudiante («I18b… React no sustituye…») | `universidad/criterios/**` | frontend | ☐ |
| AD5 | Aulas: cifras borrosas al montar (animación `useValorSwap`) en Población, Sustento, Cierre, Pase | `universidad/ui/useValorSwap.ts` | frontend | ☐ |
| AD6 | Aulas: el Explorador se da por listo con su `data-audit-ready` interna en false | `definicion/**` explorador | frontend | ☐ |
| AD7 | Aulas: ¿Alcanza? y ¿Este sorteo o otro? ponen dos tarjetas de prosa antes del resultado (veredicto primero) | `calculo/**`, `aulas/**` | frontend | ☐ |
| AD8 | Aulas: C3 en Solidez (14 px); rótulos «Reemplazos 1.894» vs «Reservas 2.375» para cifras que parecen la misma; tarjeta con sólo «Probar reemplazos» | `aulas/**`, `salidas/**` | frontend | ☐ |
| AD9 | Aulas: la certeza tardó ~44 min sobre 2.561 CH y la ETA mostró «~190:17» | por diagnosticar (rendimiento) | diagnóstico | ☐ |
