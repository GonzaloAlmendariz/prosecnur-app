# Checklist · Monitoreo › Acreditación, mejoras visuales de a pocos (2026-10-29)

Pedido de Gonzalo: «ver cómo se ve este módulo con acreditación y mejorarlo de a pocos».
Proyecto observado: `Monitoreo Acreditación Institucional PUCP 2026.pulso`, primer día de campo
(326 efectivas, 81 parciales, 6 públicos, universo 45 120, corte 29/10 18:09). Viewport 1440x1000.

| # | Hallazgo | Dónde vive | Estado |
|---|---|---|---|
| 1 | Con un solo día de campo, las barras diarias ocupan todo el ancho y se leen como un bloque (Resumen › Últimos 14 días, Por público › columna 14 días, Ritmo › Efectivas por día) | `avance/graficosDeAvance.tsx` (`anchoPorDia`), test `graficosDeAvance.test.tsx` | Hecho: 14 casillas en «últimos 14 días», tope de 44 px por día en Ritmo; verificado en 1440x1000 y 1024x600 |
| 2 | «Universo por estado» exagera las franjas chicas: Rechazos 0.0 % se dibuja como un tramo visible, Efectivas 0.7 % parece un 3 % | `.acr-av-apilada > span` en `avance/avance.css` (el relleno de 6 px daba 12 px mínimos por tramo; también corrige Equipo, Barrido y Personas, que usan la misma barra) | Hecho: tramos con base 0 y relleno solo si llevan cifra; verificado en Resumen y Por público |
| 3 | El embudo del Resumen suma filas de universo y respuestas («45 590 recibidas», «−470 registros fuera del universo»): mezcla dos granos (brecha B9 del diagnóstico del 22/10) | `AcreditacionEmbudoCorte.tsx` + motor | Pendiente, pide decisión de rótulos |
| 4 | Control › Correo dice «AVANCE · Correo» en el antetítulo aunque vive en Control | `AvanceCorreoCabecera.tsx` | Hecho: antetítulo «Control»; verificado en 1024x600 |
| 5 | Pantalla de arranque dice «Preparando Acreditacion» sin tilde; el reporte público para el cliente dice «Monitoreo · Acreditacion» | `profiles/acreditacion/index.ts` (`label`), `public/MonitoreoPublicReportPage.tsx` | Hecho en código; el arranque no volvió a mostrar ese rótulo en la verificación |
| 6 | Curva acumulada del Resumen con dos ejes (acumulado 0–10 000 y por día 0–800): con pocos días casi todo el lienzo queda vacío | `avance/graficosDeAvance.tsx` (`CurvaAcumulada`) | Pendiente, por proponer |
| 8 | Control › Correo lee la audiencia «PULSO PUCP» (la de prueba, 8 contactos) y dice «0 envíos», mientras el lanzamiento salió por otra audiencia | configuración del proyecto (audiencia de Mailchimp) | Pendiente, pide decisión: cambiar la audiencia es mutar el .pulso |
| 9 | Control › Correo en 1024x600: la última columna de la tabla («Alcanzables») queda cortada a la derecha | `AvanceCorreoPublicos.tsx` / `AvanceCorreo.css` | Pendiente, revisar dueño del scroll (C4) |
| 10 | Control › Correo: tres encabezados de la tabla van en cajas de botón y los otros en texto plano | `AvanceCorreoPublicos.tsx` | Pendiente |
| 7 | Arranque del proyecto lento: el `advance_summary` tardó 380 s con la máquina cargada (52 s sin carga) | backend, `monitoreo_acreditacion_*` | Anotado, fuera de lo visual |

Notas:
- «Por resolver» mostraba 19 justo después de actualizar porque los casos llegan después que el avance; al terminar la lectura de Control pasó a 44. No es un defecto.
- Capturas antes/después fuera del repo, en el scratchpad de la sesión (`visual/antes-*.jpg`, `visual/despues-*.jpg`).
