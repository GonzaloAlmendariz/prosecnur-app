# Checklist — Identidad, Estilo del informe, índice y paletas de Gráficos (2026-10-11)

Tipo: Checklist de pedido con varias indicaciones
Estado: En curso
Fecha: 2026-10-11
Autoridad: Registro de alcance del pedido de Gonzalo; el comportamiento vigente lo fijan los componentes de `frontend/src/features/graficos/{estilo,estiloInforme,indice,word}` y sus tests

Origen: comentarios de Gonzalo del 2026-10-11 (~20:30) sobre la app en vivo (`acrconta_mazo_prueba`). Se trabaja dentro del
loop indefinido «casos+arte» (encargo en el scratchpad de la sesión). Sólo Gonzalo da un ítem por terminado.

| # | Indicación (textual) | Dónde vive | Estado |
|---|---|---|---|
| I1 | «En identidad, por qué sigue habiendo una columna para Word cuando Word debe ser su propia subpestaña» | `estilo/PestanaEstilo.tsx` (aside `VistaPreviaWord`) → pestaña `word/PestanaWord.tsx` | ☐ |
| I2 | «La banda de los logos no está bien estructurada ni se muestra bien y no queda claro qué se debe hacer» | `estilo/PestanaEstilo.tsx` sección logos, `estilo/TarjetaLogo.tsx` | ☐ |
| I3 | «En tamaño de las letras también creo que puede verse mucho mejor» | `estilo/SeccionLetra.tsx` | ☐ |
| I4 | «En íconos no me parece mal la intención pero ya quedamos en que población no lleva ícono» | sección Íconos de Identidad (`IconosEditor`), textos que mencionan población | ☐ |
| I5 | «Voy a índice, la ventana para poner el subcapítulo no se ve muy profesional y me pide poner enters en vez de una UI profesional» | `indice/EditorIndice.tsx` (subcapítulos) | ☐ |
| I6 | «En estilo del informe me pides ponerlo de forma técnica con "Base: %s" cuando eso es algo que el usuario no técnico jamás va a poder hacer» | `estiloInforme/SeccionTextoBase.tsx`, `modeloEstiloInforme.ts` (`formato`, `sufijo_auto`) | ☐ |
| I7 | «Toda la UI que nos permite escoger las paletas se ve bastante mal, choca, contenedores poco profesionales y necesita una forma mucho más inteligente» | `estiloInforme/SeccionPaletas.tsx` (`PaletasEditor` del editor anterior) → rediseño P1–P8 en Identidad | ☐ |
| I8 | (ya acordado) «Cálculos y cifras está bien» | `estiloInforme/SeccionCalculos.tsx` | ☑ sin cambios |

## Lo acordado que condiciona estos ítems

- Paletas: sin deducción automática de familias; en Identidad se reconocen las listas de categorías del proyecto y se definen
  sus colores con una dinámica amable; la tarjeta del gráfico muestra sus colores y lleva a esa lista (P1–P7). La exportación
  se bloquea si un gráfico que pinta por categoría tiene opciones sin color, con arreglo en un clic (P8).
- Barras de un solo color por defecto; resaltar la más alta es opción del gráfico (commit c6731f344).
- Textos sin jerga interna y sin el separador «·».
