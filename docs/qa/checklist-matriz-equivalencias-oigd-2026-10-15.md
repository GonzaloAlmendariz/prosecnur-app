# Checklist — la matriz de equivalencias permite todo lo que propone la OIGD (2026-10-15)

Tipo: Checklist de lote
Estado: En curso
Fecha: 2026-10-15
Autoridad: Pedido de Gonzalo del 2026-10-15; decisión de diseño en ADR 0105 (Propuesto)

Pedido de Gonzalo: «asegurémonos por favor que la UI de la matriz de equivalencias permita hacer todo lo que Nadia
propone incluyendo códigos estándar y etiquetas del tenor estándar y hasta variables agregadas o nuevas estándar para
los cruces», y luego «lánzala» (prueba real con 2024, 2025 y 2026 en una copia).

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| M1 | Códigos estándar por categoría (37 bloques) | `armonizacion.escala` + `mapa` por base (`equivalencias_armonizacion.R`, `ArmonizacionFilaEditor.tsx`) | ☑ ya existía |
| M2 | Etiquetas estándar | `etiqueta_estandar` de la fila y `escala[].etiqueta` | ☑ ya existía |
| M3 | Agrupar categorías (7 bloques: A-05, A-06, S-05…) | varios códigos de la base al mismo código de la escala | ☑ ya existía |
| M4 | Otra lectura de una sola pregunta: dicotomía T-01, tramos S-01, antigüedad S-08 | otra fila sobre la misma variable; S-08 con mapa por base relativo al año | ◐ por comprobar en la prueba real |
| M5 | Indicador compuesto de varias preguntas (AP-12, CO-01, CO-03…) | ADR 0105 (Propuesto), `equivalencias_derivadas.R`, editor «Añadir indicador compuesto» | ◐ código y gate verdes (889 R · 837 carga · 898 gráficos); falta QA visual |
| M6 | Toda fila armonizada sirve de cruce | `armonizada_apilar(cruces=)` | ☑ ya existía |
| M7 | Prueba real: cargar 2024, 2025 y 2026 en una copia, armar la matriz, generar entregables 2, 5, 6, 8 y 9 y comparar con la maqueta | copia de trabajo fuera del repo | ☐ |
| M8 | Insumos 2024 y 2025 para Ulises | `01_Estudios/2026_PUCP_HSyVbG/Procesamiento/Insumos 2024-2025 para la matriz/` | ☑ (XLSForm reemplazados por los aplicados: 2024 v5, 2025 Instrumento2025) |

## Aprendido

- La matriz de la OIGD clasifica sus recomendaciones así: 37 recodificar/homologar, 7 agrupar, 14 nueva variable o
  derivada (de ellas 6 combinan varias preguntas), 2 no comparar, 1 relativa al año.
- En la carpeta de insumos había quedado el XLSForm 2024 v2 y una versión de 2025 sin `banner_1` ni «Fuera del país»;
  los aplicados son `HSYVBG2024_v5.xlsx` y `Historico 2025/Instrumento2025.xlsx`.
