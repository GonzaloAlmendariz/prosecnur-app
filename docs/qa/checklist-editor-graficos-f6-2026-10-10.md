# Checklist — editor de Gráficos F6 (nueva UI de Láminas y motor nativo)

Tipo: Checklist vivo · Estado: en curso · Fecha: 2026-10-10 · Autoridad: pedidos de Gonzalo en la sesión del loop N8/F6
Dirección aprobada: `docs/qa/direccion-diseno-editor-graficos-f6-2026-10-09.md` · Plan: `docs/qa/plan-integracion-f6-2026-10-10.md`
Decisiones: `docs/qa/decisiones-pendientes-f6-2026-10-10.md`. Solo Gonzalo da un ítem por terminado.

Leyenda: ☑ hecho y verificado · ◐ hecho, en verificación o con pendientes · ☐ por hacer · ⛔ bloqueado por decisión

## Etapas de la nueva UI (plan §4)

| Etapa | Qué es | Estado |
|---|---|---|
| F6.1 Láminas (núcleo) | Pestaña Láminas: Estructura, Visor, Inspector, barra propia | ◐ construida; 2.ª vuelta de correcciones en curso |
| F6.2 Selectores de tipo | Selector de lámina y de gráfico con composiciones y variantes | ☐ siguiente |
| F6.3 Vista general | Clasificador con arrastre, capítulos, miniaturas reales | ☐ |
| F6.4 Word y Estilo del cliente | Esquema y páginas del Word; estilo «Del recetario»/«Propio»; logos | ☐ |
| F6.5 Paridad y retiro | Checklist de paridad, ADR y retiro del editor anterior | ☐ |

## Pedidos de Gonzalo

| # | Pedido (resumido) | Dónde vive | Estado |
|---|---|---|---|
| 1 | Construir la UI nueva aprobada | frontend `features/graficos/laminas/` | ◐ F6.1 |
| 2 | Agentes en paralelo: riesgos de perder funciones + integración profesional | plan §7 (auditoría) y §1–§4 | ☑ |
| 3 | Reloj del loop cada 3 min | `tmp/n8/ENCARGO_LOOP.md` | ☑ |
| 4 | Ícono profesional por tipo de lámina y de gráfico | `graficos/iconos/` (b332b1d2a), 55 íconos | ☑ |
| 5 | K5 ejemplos del recetario en la app | `api/inst/recetario/ejemplos` (9b5bd146a) | ☑ |
| 6 | K6 logos: PULSO por defecto y subir los propios | Estilo del cliente (F6.4) | ☐ |
| 7 | Tipografía: manda el recetario | escala vigente 12/11 | ☑ |
| 8 | FODA fuera del selector | registro (121049046) | ☑ |
| 9 | Un ícono por tipo, variantes en el inspector | íconos + F6.2 | ◐ íconos ☑; variantes en F6.2 |
| 10 | Aprovechar el espacio como Canva/PowerPoint | lienzo 16:9 (ab4a3a632): 95–97 % del eje | ☑ |
| 11 | D17 guías fuera del entregable | exports sin guías (533c19935) | ☑ |
| 12 | Guías con más capas: filtrar, espacios de cada sección, tamaño de letra | backend K11/K12 ☑ verificado (avisos con su lámina real en PPT y Word); frontend por capas (plan §8) ☐; K13 letra por perfil ☐ | ◐ |
| 13 | Población antigua fuera (manda el recetario) | selector ☑; migración ☑ verificada (bases idénticas en acrconta); aviso en pantalla ◐ frontend en curso; aviso al importar config ◐; borrar código con ADR ☐ | ◐ |
| 14 | Corona según la p160 | 19098a732 + bb2fd2a00; verificada: 38 formas a ≤0,001 in de la p160 | ☑ (orden de categorías espera D8) |
| 15 | Repensar los botones de la barra con el motor nuevo | barra propia + Exportar (562dae268) | ☑ |
| 16 | Rail: se queda, inspector ocultable | 511b7117b | ☑ |
| 17 | Inspector «esto me preocupa»: más ancho | 18912fcd9 | ☑ |
| 18 | Estructura e Inspector no abiertos a la vez | 18912fcd9 | ☑ |
| 19 | Reinstalar paquete y reiniciar backend (1.ª vez) | 8821 reiniciado 09:27 | ☑ |
| 20 | Especialista en animaciones elegantes | b9534665b, c1d7570e7 (aprobado con pendientes) | ☑ |
| 21 | «Reducir movimiento»: sin desplazamientos, con fundidos | bbdc4f7ce (medido cuadro a cuadro) | ☑ |
| 22 | Ver los cambios de backend de hoy en la app | requiere 2.º R CMD INSTALL + reinicio de 8821 | ☐ pedir permiso al cerrar la tanda |

## Correcciones en curso (de verificadores)

| Tema | Estado |
|---|---|
| «Lámina N de M» truncado a 1366×768 con Inspector; Escape cierra dos capas | ◐ frontend trabajando |
| Avisos K11/K12: número de lámina en Word, tests faltantes, memoria, base en /ppt-all | ☑ aprobado; queda un test de contrato en rojo por la migración (entregables lo corrige) |
| Migración de población + corona + «(cont.)» | ◐ backend aprobado en sustancia; falta mostrar el aviso en la UI, aviso al importar y «(cont.)» en multilista |

## Bloqueados por decisión de Gonzalo

| Código | Pregunta | Estado |
|---|---|---|
| K15 | Alinear `estandar_pulso.json` con las láminas de ejemplo del recetario en 12 tipos — Gonzalo: «sí» | ☐ en cola (entregables) |
| D8 | Orden de categorías — Gonzalo: frecuencia, instrumento y personalizado, los tres posibles | ☐ en cola (backend + Inspector) |
| — | Etiquetas cortas por categoría de respuesta (sin contrato) | ⛔ |
| — | «Masculino (33)» con n en el rótulo solo en la corona | ⛔ |
| S1–S4 | Base ponderada vs n sin ponderar | ⛔ |
| A2, A3, D1–D16, E2 | Ver `decisiones-pendientes-f6-2026-10-10.md` | ⛔ |
