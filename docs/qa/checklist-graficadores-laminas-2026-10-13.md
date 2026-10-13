# Checklist — láminas y graficadores (Gonzalo, 2026-10-13)

Dictado de Gonzalo mientras corría el loop de Arte y Diseño. Un ítem por indicación; sólo él los da por terminados.
Referencia visual de cada estándar: `docs/qa/motor-ppt-2026-10-06/4-recetario/recetario-moderna.pptx` (y `-fiel`).

| # | Indicación (textual o casi) | Dónde vive | Estado |
|---|---|---|---|
| G1 | Portada: «la fecha no es un botón clickeable que me lleva a poder editarlo», como sí lo es el «Texto descriptivo» | Pestaña Láminas: zonas clickeables de la maqueta (`laminas/ZonasTextoLamina.tsx`, `laminas/RanurasSobreLamina.tsx`); rótulos en `laminas/selectores/etiquetas.ts` (`fecha: "Fecha"`) | ◐ hecho 8f7ef1bc8 (zonas Subtítulo, Título, Texto descriptivo y Fecha en maqueta y «Ver cómo queda», 3 composiciones), falta tu revisión |
| G2 | Índice: elegida una ilustración remasterizada, «Ver cómo queda» previsualiza con los focos de la versión antigua | Vista previa de la lámina (`laminas/usePreviewLamina.ts` → backend `graficos_preview_lamina.R`) contra el render del índice (`reporte_plan_ppt.R`, `indice/`) | ☐ |
| G3 | Índice: ofrece antetítulo y no debería llevarlo | Campos de texto por tipo de lámina (`laminas/contenidoLamina.ts`, `ZonasTextoLamina.tsx`) | ☐ |
| G4 | Objetivo: vuelve a pedir antetítulo; no debe haber | Igual que G3 | ☐ |
| G5 | Objetivo: no se escoge ícono; siempre el del tiro al blanco con la flecha | Ranura `icono` de `p_slide_objetivo_icono` (registro de tipos, `iconos/`, `lamina_identidad.R`) | ☐ |
| G6 | Objetivo: falta el catálogo de variantes del recetario (cada una resalta algo distinto; una admitía perfiles o actores) | Recetario (láminas de objetivo) contra `laminas/selectores/tiposLamina.ts` (`VARIANTES_LAMINA`) y `lamina_identidad.R` | ☐ |
| G7 | Lámina de explicación del Top 2 Box: no debe pedir cambios de título ni de texto; es estándar y siempre sale igual | Campos editables del tipo (como G3) y su render | ☐ |
| G8 | Separador de sección: no muestra todas las versiones del recetario | `VARIANTES_LAMINA` del separador contra el recetario | ☐ |
| G9 | Lámina de 4 gráficos: si los cuatro son del mismo actor con el mismo n, basta una base en la esquina de la lámina, no una por gráfico | Base por gráfico en `paneles_4` (`reporte_plan_ppt.R` ~8372, `lamina_paneles.R`, `.base_auto_de_elementos`) | ☐ |
| G10 | Falta el graficador apilado dicotómico del recetario, con las cifras de los polos más grandes | Catálogo de graficadores + motor nativo (`lamina_escala.R` / nuevo) contra el recetario | ☐ |
| G11 | Aún hay gráficos sin motor nativo, p. ej. «puntos comparativos» | `.lam_compositor_aplica` (`lamina_compositor.R`) y catálogo | ☐ |
| G12 | Multiapiladas: «Bloques del gráfico» es poco intuitivo y trae un «Dividir por» además de los modos; definir coherencia y no permitir multiapiladas que además se divida por otra variable | Tarjeta del gráfico (`laminas/tarjetaGrafico/`, `DatosGrafico.tsx`) y args de `p_barras_multiapiladas` | ☐ |
| G13 | «Entre otros»: lo que aparezca al recorrer estos tipos se agrega aquí con su número | — | ☐ abierto |

## Aprendido al investigar

- G1: la portada no tenía NINGUNA zona de texto sobre la lámina salvo el título (`camposTextoDe` devuelve vacío para las láminas de estructura). Las zonas nuevas usan la geometría de `.lam_laminas_portada` por composición (`zonasPortada`).
- Visto al hacer G1: el panel Contenido de la PORTADA también ofrece «Antetítulo» (campo `antetitulo` en el inspector). Misma familia que G3/G4: se resuelve junto con ellos.
- Visto: el selector de composición muestra «Lámina 24 / Lámina 25» (número del recetario) como detalle; es jerga interna → candidato G13.
