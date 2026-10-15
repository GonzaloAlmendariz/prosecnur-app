# Checklist · rediseño de Informe, Identidad, Reglas y Word en Gráficos

Tipo: Checklist de implementación
Estado: Vigente
Fecha: 2026-10-14
Autoridad: Gonzalo (2026-10-14): «todo, absolutamente todo tiene mi aprobación»; D5: «llevarlos también al PPT ahora». Sólo Gonzalo da por terminado un ítem

Concepto, decisiones y fallas del inventario: [plan-revamp-informe-graficos-2026-10-14.md](plan-revamp-informe-graficos-2026-10-14.md). Prototipo aprobado: https://claude.ai/artifact/8vtEx3LmE5V92FfqXxN8ZH (versión 12). Cada ítem cierra con su prueba en la app a medidas reales (1440×1000, 1366×768, 1280×720, 1024×600) sobre el catálogo del recetario y un proyecto real, y con el verificador.

## Decisiones (todas resueltas, 2026-10-14)

| # | Decisión | Resolución |
|---|---|---|
| D1 | Pestañas | Láminas · Word · Informe · Identidad · Reglas, en ese orden. Las claves viejas de la URL (`vista-general`, `estilo`, `estilo-informe`) se leen como alias y no se escriben |
| D2 | Vista Word | Maquetas de página en el Informe; el Word real sólo en la pestaña Word con «Previsualizar» |
| D3 | Línea visual | En Identidad |
| D4 | «Otros» | Pasa a Reglas, con el texto corregido (va en el PPT y en el Word) |
| D5 | Logos y letra | Llegan también al PPT en este rediseño |
| D6 | Multiapiladas en el Word | Elegible por lámina; el informe pone «Un gráfico por tema» por defecto |
| D7 | Líneas visuales propias | Se guardan en la app, para todos los estudios; al aplicarla, el estudio copia sus valores (el `.pulso` sigue portable) |

## Ítems

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| **F0 · Limpieza** | | | |
| L1 | Texto del interruptor «Otros» corregido (el motor sí las pone en el Word) | `vistaGeneral/interruptorOtrosModel.ts`, `compartir/seccionesJson.ts` | hecho, por verificar: rótulo «Respuestas «Otros» en el PowerPoint y el Word»; la ayuda dice lámina en el PPT y tabla numerada en el Word (`reporte_word_otros.R`) |
| L2 | Identidad disponible en el informe compartido (colores e íconos valen para el PPT) | `estilo/disponibilidadEstilo.ts` (`motivoPiezaNoDisponible`), `PestanaEstilo.tsx`, `GraficosPage.tsx` | hecho, por verificar: la pestaña ya no se deshabilita; en el compartido Colores (77 preguntas en 5 bases) e Íconos se ajustan, Logos y Letra dicen que hoy sólo van al Word. El motivo cae con ID9 |
| L3 | Código que nadie pinta: `SeccionWordRecetario.tsx`, `VistaPreviaWord.tsx`, cálculos sin uso de `PestanaEstiloInforme.tsx` | `estilo/`, `estiloInforme/`, `word/` | pendiente: se lista cada archivo y se confirma antes de borrar (regla de borrados) |
| L4 | «Quitar línea» visual | `estiloInforme/SeccionLineaVisual.tsx` → Identidad; `estiloInforme/quitarLineaVisual.ts` (`sinEstiloDePerfil`), acción `quitarPptStyleProfile` del store | hecho, por verificar: el botón aparece con una línea aplicada; quita lo que la línea trajo (presets, paletas, ajustes guardados y reglas que siguen valiendo lo suyo, incluido el `profile_id`) y deja lo cambiado después. En la app: aplicar → «Propio · Quitar línea»; quitar → «Por defecto». Se muda a Identidad con ID3 |
| L5 | Ayudas desfasadas («estilo del cliente», «Cálculos o Paletas») | catálogo de navegación, Línea visual | hecho, por verificar: «Cargando la identidad…», leyenda del ámbito, «Íconos subidos en Identidad» y el valor base «del informe» (ya no «Estilo global», retirado el 2026-10-13); la ayuda de Identidad en el riel nombra los colores de las respuestas; «Cálculos o Paletas» salió con L4. Los rótulos «Vista general» y «Estilo del informe» y sus ayudas cambian con N1 |
| **Navegación** | | | |
| N1 | Riel Láminas · Word · Informe · Identidad · Reglas con alias de las claves viejas | `lib/navegacion/catalogos/procesamiento.ts`, `pestanaGraficos.ts`, contratos de rutas | pendiente |
| N2 | «Previsualizar» en Láminas (antes «Ver cómo queda») | `laminas/VisorLamina.tsx` | hecho, por verificar (019d0ad83) |
| **Informe** | | | |
| I1 | Maquetas en vez de miniaturas del motor, la misma maqueta del editor | `vistaGeneral/` + `laminas/maqueta/` | pendiente |
| I2 | Ícono del tipo de lámina en la cabecera; glifo del gráfico dentro de su espacio, junto a su pregunta | `vistaGeneral/TarjetaLamina.tsx`, `iconos/` | pendiente |
| I3 | Resumen clicable (todas, con avisos, faltan colores, sin gráfico) que filtra, y la cobertura | `vistaGeneral/` | pendiente |
| I4 | Estructura lateral fija con avisos por capítulo; oculta bajo 1280 px | `vistaGeneral/` | pendiente |
| I5 | Capítulos plegables con su separador como primera tarjeta, conteos, subir, bajar y «+ Lámina» | `vistaGeneral/FilaCapitulo.tsx` | pendiente |
| I6 | Bloques cortos (Apertura, «Cómo leer») lado a lado | `vistaGeneral/` | pendiente |
| I7 | Barra de selección: mover a, duplicar ⌘D, eliminar Supr con confirmación, atajos y «Deshacer» | `vistaGeneral/BarraVistaGeneral.tsx` | pendiente |
| I8 | Arrastrar con línea de inserción y animación de lo movido o duplicado | `vistaGeneral/useFlipTarjetas.ts` | pendiente |
| I9 | Maquetas propias de las láminas de estructura (portada, índice, texto, separador, cierre) | `laminas/maqueta/` | pendiente |
| I10 | Tamaño por ancho de tarjeta (300, 220, 160 px), filas que se llenan solas | `vistaGeneral/vistaGeneral.css` | pendiente |
| I11 | Vista Word en maquetas de página con la convención del recetario Word y los glifos de la app | `vistaGeneral/` (nuevo) | pendiente |
| **Identidad** | | | |
| ID1 | Ámbito (todo el estudio / cada base) en la cabecera, rige todas las piezas | `estilo/PestanaEstilo.tsx` | pendiente |
| ID2 | Columna de piezas con estado y «A qué salida llega» | `estilo/` | pendiente |
| ID3 | Línea visual como biblioteca: del recetario y propias (D7), guardar como nueva, guardar cambios, descartar, editar, duplicar, eliminar | `estilo/` + almacén de la app (nuevo) | pendiente |
| ID4 | Colores de las respuestas: filtros, buscador, «Completar todos» aquí, grupos con conteo y ejemplo; abierto con nombre, combinaciones, respuestas, grises, ver preguntas, agrupar y quitar | `estilo/ColoresRespuestas.tsx` | pendiente |
| ID5 | Logos en tres lugares con su miniatura | `estilo/TarjetaLogo.tsx` | pendiente |
| ID6 | Letra: paso general y por rol con el tamaño real y su resultado | `estilo/SeccionLetra.tsx` | pendiente |
| ID7 | Íconos propios con requisitos y grilla | `IconosEditor.tsx` | pendiente |
| ID8 | Muestra viva: portada del PPT, lámina con colores, portada y página del Word | `estilo/` (nuevo) | pendiente |
| ID9 | Logos y letra llegan al PPT: portada y contraportada del PPT, tamaños de las láminas nativas (D5) | motor: `lamina_*.R`, `estandar_tokens.R`, `graficos_estilo_cliente.R` | pendiente (motor nuevo) |
| **Reglas** | | | |
| R1 | Página única con la jerarquía informe › tipo de gráfico › un gráfico | `estiloInforme/PestanaEstiloInforme.tsx` | pendiente |
| R2 | Redondeo y decimales: método, decimales, tabla por tipo y cifras que no suman 100 % | `estiloInforme/SeccionCalculos.tsx` | pendiente |
| R3 | Nota al pie: nunca / sólo si una barra no suma 100 % / siempre; texto automático o propio | front + `graficos_calculos_gobernados.R` | pendiente (condicional y texto propio: motor nuevo) |
| R4 | Método y decimales por gráfico para cualquier tipo, listados como excepciones | tarjeta del gráfico + motor | pendiente (motor nuevo) |
| R5 | Casos junto al porcentaje con sus gráficos con regla propia | `estiloInforme/SeccionCasos.tsx`, `laminas/CasosGrafico.tsx` | pendiente |
| R6 | Texto de la base con su nombre por gráfico | `SeccionTextoBase.tsx`, `datosBase/NombresPorBase.tsx` | pendiente |
| R7 | «Otros» como regla (D4) | Reglas + `interruptorOtrosModel.ts` | pendiente |
| R8 | «Cómo se lee» por regla, con la lámina de ejemplo del redondeo | `estiloInforme/` (nuevo) | pendiente |
| **Word** | | | |
| W1 | Cinco secciones con la maqueta de página en vivo; secciones en fila bajo 1280 px | `word/PestanaWord.tsx` | pendiente |
| W2 | Documento: título corto, fuente, índices, «Cómo leer» (la interfaz de `documento_word`, que hoy no viaja en el autosave) | front + `graficos_documento_word.R` | pendiente |
| W3 | Portada A / B / C con sus textos | front + `reporte_word_portada.R` | pendiente |
| W4 | Apertura de capítulo y su entrada | front + `reporte_word_texto.R` | pendiente |
| W5 | Gráficos: lectura bajo el gráfico, no repetir el título en el eje, sólo los tipos que usa el informe con «Ajustar» | `word/WordPresetsEditor.tsx` | pendiente |
| W6 | Multiapiladas en el Word: un gráfico, por tema, por barra; por lámina con «por tema» por defecto (D6) | front + `reporte_word_graficos_escala.R` | pendiente (por tema y por barra: motor nuevo) |
| W7 | Cierre: contraportada con contacto | front + `reporte_word_portada.R` | pendiente |
| W8 | «Previsualizar»: el Word real por páginas | front + job de Word → imágenes | pendiente |
