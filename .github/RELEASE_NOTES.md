# Prosecnur 0.8.0 · el Top 2 Box se declara, y el mazo de acreditación sale del motor

- Gráficos: el Top 2 Box se declara por nombre de categoría y deja de deducirse del orden de la escala. La regla anterior sumaba las dos últimas columnas dando por hecho que la escala iba de peor a mejor; cuando no lo era, sumaba las dos equivocadas sin decir nada. Si hoy no hay categorías declaradas, la columna se omite y el motor avisa por qué.
- Gráficos: las categorías del Top 2 Box se marcan sobre las escalas reales del estudio. El selector fusiona las escalas idénticas, cabe en el panel e ignora mayúsculas y tildes al emparejar, así que «De acuerdo» y «DE ACUERDO» son la misma categoría.
- Gráficos: el Top 2 Box compara contra la medición anterior. La lámina muestra el valor de hoy junto al de la ola previa, que es la lectura que pide un informe de acreditación.
- Gráficos: el estilo de acreditación se enciende desde la interfaz. La paleta se ancla a la etiqueta real de cada categoría y los cortes del semáforo se editan sin salir de la vista.
- Gráficos: buscador de ajustes en la base visual y en el inspector de cada lámina. Encuentra escribiendo sin tildes y solo cuenta los ajustes que de verdad puede mostrar.
- Gráficos: el orden manual de barras se reordena arrastrando, no tecleando. La lista ofrece la escala de esa pregunta en vez de las 23 del estudio, y el orden guardado llega al motor además de al proyecto.
- Gráficos: los arreglos que el motor aplica solo llegan al analista. Antes corregía en silencio y la lámina salía distinta de lo pedido sin que constara en ninguna parte; los avisos repetidos se agrupan en vez de inundar la pantalla.
- Gráficos: el recorte de enunciados deja de ser silencioso, y el aviso lleva al control que lo resuelve.
- Gráficos: cinco tipos nuevos en el catálogo: serie temporal, divergentes, dumbbell, lollipop y puntos comparativos. Las barras agrupadas y las apiladas con cruce marcan las diferencias significativas.
- Gráficos: el texto usa el azul de la marca en los ocho motores. Barras agrupadas ya lo hacía y los otros siete pintaban en negro puro, que era el segundo color más usado del mazo medido.
- Gráficos: la leyenda de dos filas reparte parejo, deja de pisarse en multilista y ya no reserva el doble de la banda que dibuja.
- Gráficos: ranuras con nombre para colores e íconos, tomadas de las secciones del estudio en lugar de una lista fija. Cada campo pide el dato que espera recibir.
- Gráficos: el editor de espacios habla en las medidas de la lámina y no en las del motor.
- Cálculo de muestra: el Relato cuenta la selección escena por escena, del marco al sorteo. Cada cuadro es un hecho de la corrida ejecutada, así que la selección se puede defender mostrando el proceso y no solo la tabla final.
- Cálculo de muestra: la probabilidad publicada es la del sorteo que realmente ocurrió. Tres configuraciones publicaban la del diseño nominal, y con esa cifra se ponderaba todo lo que viniera después.
- Cálculo de muestra: el dimensionamiento responde si el marco alcanza, en vez de apuntar siempre al centro del rango.
- Cálculo de muestra: el mapa de selección dice quién dicta cada curso-horario y muestra sus nombres legibles.
- Cálculo de muestra: los ids de alumno se subrogan al guardar en lugar de borrarse. Sin ellos no había traslape que descontar, así que al reabrir un proyecto la siguiente selección corría sin descontar repetidos. Del proyecto guardado se lee que dos aulas comparten siete alumnos; no se puede nombrar a ninguno.
- Formularios: una base queda ligada a la revisión publicada de su instrumento en cualquier vía de carga, no solo en acreditación. El bloqueo de publicación dice qué hacer y separa los avisos de los impedimentos reales.
- Word: la columna extra recupera su piso y el bloque de multilista conserva la exclusión de opciones. Una batería que excluía «Sin información» la recuperaba al exportar, y el porcentaje cambiaba entre la pantalla y el documento.
- Proyecto: guardar avisa de lo que no pudo viajar dentro del proyecto.

Los instalables salen sin firmar: SmartScreen advierte en Windows y Gatekeeper pide «Abrir igualmente» en macOS. Windows conserva su actualizador automático; macOS se actualiza descargando el DMG.
