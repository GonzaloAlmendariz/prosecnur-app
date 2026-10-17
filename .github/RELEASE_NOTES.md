# Prosecnur 0.9.3 · la serie se arma en la app

- Carga: cada base declara sus variables propias. Incorpora columnas que vienen fuera del formulario, crea variables calculadas («alguna», «recodificar» o una fórmula) y anexa columnas de otro archivo unidas por identificador.
- Carga: una base cargada desde archivo recibe la versión nueva de sus respuestas y conserva su formulario, sus variables y los códigos confirmados. La tarjeta dice qué cambió y lleva a Adaptación si había codificación.
- Carga: la matriz de equivalencias se arma en la app fila por fila, con indicadores compuestos, armonización de una escala que se aplica a las preguntas que la comparten y asignación de códigos en masa.
- Carga: los segmentos de cruce se declaran una vez y se arman en cada base desde la variable que esa base trae, con rangos en línea y nota al pie. Las variables calculadas y de cruce quedan junto a su variable original en la base, el libro y las tablas.
- Analítica: «Qué casos cuentan» define el universo de cada base, por ejemplo la selección aleatoria de una muestra, y tablas, base, libro de códigos y gráficos trabajan con ese N. El encabezado dice cuántos casos cuentan y con qué condición.
- Analítica: Comparativos traen los segmentos del estudio como cruces y leen la ponderación de todas las bases. El libro de códigos documenta las preguntas sin lista de respuestas y sugiere los códigos especiales del estudio en vez de imponer 96 a 99.
- Codificación: cada aviso de Adaptación trae su salida (abrir la pregunta en Codificar, registrar por qué no se codifica o dejar sus textos en «Otro»), y avisa cuando la base cambió después de la última adaptación.
- Gráficos: el Informe muestra maquetas de cada lámina, la pestaña Word se organiza en Portada, Documento, Capítulos, Gráficos y Cierre, y «Previsualizar» abre el Word real.
- Gráficos: las líneas visuales propias se guardan y se reutilizan, Identidad lleva logos y letra del cliente, y el redondeo se declara por informe con excepciones por gráfico.
- Formularios: el editor suma las pestañas Restricciones y Cálculos, que prueban cada regla con valores de ejemplo, y las reglas se leen en español. El impreso reproduce el instrumento con su fuente embebida.
- Correcciones: la base SAV se exporta y se vuelve a abrir con sus fechas y etiquetas, los gráficos usan el mismo N que las tablas, y un Word de más de un millón de caracteres ya no sale dañado.

Los instalables salen sin firmar: SmartScreen advierte en Windows y Gatekeeper pide «Abrir igualmente» en macOS. Windows conserva su actualizador automático; macOS se actualiza descargando el DMG.
