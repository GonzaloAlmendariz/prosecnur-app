# Checklist — letras de cruces bajo diseño muestral (2026-11-03)

Tipo: Checklist de implementación
Estado: En curso
Fecha: 2026-11-03
Autoridad: ADR 0127; lo da por terminado solo el usuario

Contrato: [ADR 0127](../adrs/0127-las-letras-de-los-cruces-se-prueban-bajo-el-diseno-muestral.md). Lo da por terminado
solo el usuario.

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| 0 | ADR que fija el contrato antes de implementar | `docs/adrs/0127-…` | Aceptado 2026-11-03 |
| 1 | Configuración del diseño (conglomerado, estrato, método; por defecto `simple`), persiste en `.pulso` y viaja por el router | `analitica_config$cruces$significancia` (default en `router_analitica.R`), `.cruces_significancia_normalizar`, paso al job y ficha técnica; `columnas_base` en `/variables` | Hecho. El peso es el de Ponderación (ADR §1, aprobado) |
| 2 | Prueba por par bajo diseño, t con gl del diseño, sin fpc, letras por par, corrección Bonferroni/Holm/BH | `api/R/cruces_significancia.R` | Hecho. SE = `survey` (1e-8). También medias de dimensiones |
| 3 | Base mínima en ambos modos (30 casos; 8 conglomerados en diseño) y nota que lo diga | `.cruces_sig_comparar` / `.cruces_sig_medias`, marca `.b` | Hecho |
| 4 | Nota al pie desde la configuración | `.cruces_sig_nota` + `.cruces_sig_ficha` | Hecho. Test de la maqueta actualizado a propósito (supuesto + `.b`) |
| 5 | Gráficos y láminas con la misma configuración | `graficos_significancia.R` (`.graficos_sig_adjuntar_config`, atributo del diseño), `graficos_serie_significancia.R`, lámina entre públicos | **Parcial**: simple usa corrección y base mínima; en diseño el gráfico se abstiene con nota. Falta calcular letras bajo diseño en gráficos (bloqueado por `reporte_plan_ppt.R` congelado). Armonizada sigue simple |
| 6 | `survey` en `DESCRIPTION` si se agrega; job si es pesado | `Suggests` | Hecho. Corre dentro del job de cruces existente |
| 7 | Tests: letra que desaparece bajo diseño, N pequeño sin letra, expansión vs normalizados; los del modo simple siguen verdes | `test-cruces-significancia-diseno.R` | Hecho |
| 8 | UI mínima en `CrucesPane.tsx` | `CrucesSignificanciaDiseno.tsx` + modelo + tests | Hecho en código y vitest; **QA visual pendiente** |

## Notas

- ADR 0114–0126 ya existen en otras ramas; por eso es 0127.
- `comparar_columnas_sig` también lo consumen `analitica_armonizada.R` y el comparativo (`reporte_comparativo.R`);
  entran en el alcance del punto único de entrada.
- El estrato debe estar anidado en el conglomerado; si varía dentro de un aula se rechaza con aviso (ADR §1). En el caso
  real que originó el pedido, el estrato es el nivel del curso del aula y no el del estudiante: 39 de 62 aulas mezclan
  niveles de estudiante.
