# Prosecnur 0.10.0 (Procesamiento rediseñado y Validación para el practicante)

- Procesamiento: Carga, Validación, Codificación, Analítica y Gráficos siguen el mismo recorrido con la misma cabecera, y cada fase dice su estado por base y la causa cuando una base quedó desactualizada. Carga empareja con el formulario una base que trae el texto de las preguntas como encabezado.
- Validación: "Sugeridas al mirar la base" propone las reglas que antes se escribían a mano: baterías con la misma respuesta, fechas que deben cuadrar, hora de fin antes que la de inicio, teléfonos repetidos y lugares fuera del catálogo de ubigeos del INEI. Los cruces que dependen del significado de las preguntas los sigue escribiendo el analista.
- Validación: el editor de reglas trae "Duplicar", el operador "es una de", la regla de lugar contra el catálogo de ubigeos y la del valor distinto al habitual en su grupo. Una sección que no correspondía responderse da un solo hallazgo, y cada hallazgo dice qué pasó, qué revisar y qué decidir.
- Validación: un caso puede quedar "Revisar con la ficha física", y Cierre arma la lista de esos casos por número de encuesta para quien digita, descargable en CSV. La corrección de un lugar propone el distrito del catálogo y el analista lo confirma.
- Gráficos: la pestaña Plantillas arma el informe con el estilo ACNUR, con portada, índice y separadores, y las recodificadas salen con sus rótulos. Si el proyecto ya tiene un informe armado, Plantillas lo dice y ofrece crear uno aparte en vez de reemplazarlo.
- Hojas de ruta: Ajustes del diseño reúne recorrido, reemplazos, fase y piloto. Con varias ciudades, cada distrito va bajo su ciudad con su subtotal, y el mapa de Selección muestra solo las rutas por revisar o las que coinciden con la búsqueda.
- Correcciones: las decisiones de limpieza se conservan al codificar la base, y Validación ya no pierde una regla a medio escribir al abrir el proyecto.

Los instalables salen sin firmar: SmartScreen advierte en Windows y Gatekeeper pide "Abrir igualmente" en macOS. Windows conserva su actualizador automático; macOS se actualiza descargando el DMG.
