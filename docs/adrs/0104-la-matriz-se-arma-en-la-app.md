# ADR 0104 — La matriz de equivalencias se arma en la app, por la persona

- **Estado**: Aceptado — decisión de Gonzalo del 2026-10-14 («es mejor manejarlo todo desde la aplicación, sin
  plantillas, sin proponer emparejados… recomendarle cosas o automatizar cosas de esa forma evita que la persona piense
  acerca de qué es lo que está haciendo»); confirmado el mismo día: se quitan plantilla, subir matriz y proponer
  emparejados; «Importar por bloques» se queda sólo para series de mediciones.
- **Ámbito**: Carga › Equivalencias y Gráficos (sugerencias en «Comparar públicos por tema» y en el editor de temas)
- **Fecha**: 2026-10-14
- **Relación**: continúa [ADR 0103](0103-la-matriz-de-equivalencias-solo-declara-equivalencias.md) (la matriz sólo
  declara equivalencias; enmienda «la matriz sugiere, la lámina decide») y [ADR 0062](0062-matriz-de-equivalencias-entre-publicos.md)
  (la equivalencia se declara, no se adivina). Checklist: `docs/qa/checklist-importacion-sm-arte-2026-10-14.md` (P22).

## Contexto

La pestaña Equivalencias ofrecía cuatro vías para llenar la matriz además de editarla: «Generar plantilla» y «Subir
matriz» (ida y vuelta por Excel), «Proponer emparejados» (emparejado automático por enunciado) e «Importar por bloques»
(una serie de mediciones ya armada). Probando el informe de Arte y Diseño 2026 se vio que las propuestas automáticas
casi siempre acertaban por enunciado y fallaban justo donde importaba pensar (la misma pregunta redactada distinto entre
públicos, o dos preguntas parecidas que no son la misma), y que confirmarlas en bloque reemplazaba esa reflexión.

## Decisión

1. **La matriz se arma en la app.** La pestaña ofrece un editor directo: «Añadir pregunta equivalente», se elige la
   pregunta de un público y, en cada uno de los otros, se busca la suya por su texto; al lado se ve si las escalas
   coinciden y, si no, se armoniza en la misma fila.
2. **Se retiran** «Generar plantilla», «Subir matriz» y «Proponer emparejados», con su endpoint de sugerencias.
3. **«Importar por bloques» se conserva sólo para series de mediciones** (la misma pregunta a lo largo de varios
   años), donde transcribir a mano una serie larga ya armada no aporta reflexión. No empareja públicos.
4. **En Gráficos sólo se sugiere lo declarado.** La sugerencia «equivalente según tu matriz» se queda porque viene de lo
   que la persona confirmó; la sugerencia «parece la misma pregunta», que salía del emparejado automático, se retira.
5. **Lo ya guardado no se pierde.** Una matriz importada antes por Excel o por bloques sigue en su `.pulso` y se edita
   con el editor nuevo.

## Consecuencias

- Declarar una equivalencia vuelve a ser un acto deliberado, fila por fila.
- Estudios con muchos públicos tardan más en declarar la matriz; a cambio, cada fila tiene un responsable.
- El Excel deja de ser la forma de trabajar la matriz fuera de la app.

## Cumplimiento

- Tests del panel de Equivalencias y del editor de filas (vitest del área carga) y de `sugerenciasMatriz.ts` sin la
  fuerza «parecida»; gates `make gate-front AREA=carga` y `make gate-front AREA=graficos`.

## Notas

- La decisión surge del mismo día en que se aprobó la enmienda «la matriz sugiere, la lámina decide» (ADR 0103): la
  sugerencia que se conserva es la que nace de una declaración, no de una heurística.
