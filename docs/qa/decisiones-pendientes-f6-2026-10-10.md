# Decisiones pendientes de Gonzalo — loop F6 (motor nativo y editor de Gráficos)

Fecha: 2026-10-10. Estado: esperando respuesta. Cada fila trae la recomendación del lead; basta contestar con el código
y «sí», «no» u otra opción («D3 sí, D7 descendente»). Lo que no dependa de estas respuestas ya está hecho y verificado.

## Bloque A — operación (desbloquean el uso en la app)

| Código | Pregunta | Recomendación | Qué bloquea |
|---|---|---|---|
| A1 | ¿Reinstalo el paquete R (`R CMD INSTALL`)? Los jobs de la app usan el paquete instalado (0.8.0) y no ven nada de lo hecho hoy. | Sí, con la app cerrada o sin exportaciones en curso. | Que la app exporte con el motor nuevo; el Word con `documento_word` falla hasta reinstalar. |
| A2 | ¿Reemplazo el fixture `acrconta_mazo` por la versión con Top Two Box declarado (`tmp/n8/fixture/`)? | Sí. | 22 escalas sin Top Two Box en el mazo de referencia. |
| A3 | Release de Windows: ¿P8 (añadir `msitools` y `gcab` en `release.yml`) o revertir `f073f9eb9` antes de pushear? | P8. | Sin uno de los dos, `build-windows` falla y stable no publica. |

## Bloque B — base y metodología (docs/qa/hallazgo-base-ponderada-2026-10-10.md)

| Código | Pregunta | Recomendación |
|---|---|---|
| S1 | ¿La base es el n sin ponderar también en los tabulados XLSX, o sólo en láminas y Word? | Sólo láminas y Word. |
| S2 | ¿La ponderación se declara una vez por documento («Cómo leer» y ficha técnica)? | Sí. |
| S3 | ¿El umbral de bases chicas usa el n sin ponderar? | Sí. |
| S4 | ¿Se renombra «Base ponderada (n_eff = X)» a «Resultados ponderados (n efectivo = X)»? | Sí. |
| D11 | ¿La lámina de población nativa lleva «Base: 52 docentes» al pie, como el recetario p162/p164? | Sí. Además devuelve la vista al detector de «público cruzado» (B6), hoy ciego en la población nativa. |
| D12 | ¿Las láminas de población aplican la regla de menos de 30 casos («12 de 15»)? | Sí, como el recetario p132/p195. |

## Bloque C — orden de categorías

| Código | Pregunta | Recomendación |
|---|---|---|
| D1 | En una multilista, ¿las baterías sin actores se ordenan por Top Two Box (recetario p146/p224), en PPT y Word a la vez? | Sí, en la espec (para que el Word lo herede). |
| D5 | Los rangos de edad de acrconta salen en desorden (30–35 antes que 22–25) porque su instrumento adaptado es anterior al arreglo de codificación del 11-08. ¿Re-codifico el fixture o declaro el orden por lista en Analítica? | Re-codificar el fixture. |
| D6 | ¿Normalizo al cargar las listas `_recod` numéricas de proyectos codificados antes del 11-08 (con aviso y ADR)? | Sí, por código numérico, nunca por etiqueta. |
| D7 | Dirección de los rangos: el recetario p162 muestra docentes de mayor a menor; la codificación los deja de menor a mayor. ¿Cuál manda? | La que declare cada instrumento; ajustar la página del recetario si hace falta. |
| D8 | Nominales de más de dos categorías: ¿por frecuencia con «Otro» al final (p152) o en orden del instrumento? | Por frecuencia, como p152. |
| D9 | «Invertir orden» hoy es un artefacto de cómo dibuja ggplot. ¿Lo redefino en F6.1 como «invertir el orden de lectura» (falso por defecto), migrando los `.pulso` con ADR? | Sí. |
| D15 | La regla de residuales reconoce por prefijo y manda al final respuestas con contenido («Otro(a)s estudiantes me aconsejaron que no denuncie» en hsvg2026; «Otros países…», «Ninguna dificultad»). ¿Cierro la regla (palabra suelta o seguida de paréntesis/coma) o la acepto documentada? | Cerrarla. |

## Bloque D — láminas y plan

| Código | Pregunta | Recomendación |
|---|---|---|
| D2 | En una «(cont.)» con sólo algunos públicos, ¿el pie nombra sólo los presentes o repite el completo (p186–188)? | Repetir el completo, como el recetario. |
| D3 | ¿Aceptas que 6 multilistas de acrconta pasen de 1 a 2 láminas para seguir el recetario? | Sí. |
| D4 | Una torta de dos porciones dentro de una población de 4: ¿se dibuja como dicotomía (p164)? Cambia el tipo de gráfico elegido. | Sí, con aviso. |
| D10 | Paneles mal puestos en el plan de acrconta: lámina 9 (sexo con título «¿Se encuentra trabajando?»), 10 y 11 (panel de docentes en la de administrativos). ¿Los corriges tú en el `.pulso`? | Sí; el motor no debe adivinarlos. |
| D13 | Índice que no declara capítulos: ¿se toman de los separadores del plan (13, como p35)? | Sí. |
| D14 | Títulos del plan en MAYÚSCULAS que no caben en la columna del índice: ¿bajar la letra, dos líneas o tipo oración? | Tipo oración (es lo que dibuja el recetario). |
| D16 | El radar nativo omite «% De acuerdo + Totalmente de Acuerdo»: ¿lo pongo como subtítulo? | Sí. |
| D17 | Guías magenta en láminas por la ruta anterior: ¿la salida al cliente ignora las guías de depuración, o limpias la config del proyecto? | Ignorarlas en la salida (encaja con F6.1: «se van»). |

## Bloque E — editor (F6.1)

| Código | Pregunta | Recomendación |
|---|---|---|
| E1 | ¿El inspector abre por defecto en Gráficos o en Contenido? | Contenido. |
| E2 | ¿La composición del índice y del cierre va también en Estilo del cliente? | Sí. |
