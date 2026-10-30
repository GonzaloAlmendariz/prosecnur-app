# Checklist — Acreditación: contenedores, relieve y avisos (2026-10-30)

Dictado de Gonzalo (00:0x, con capturas de Insumos › Padrón «Profesores» y
Modelo › Cuotas): «contenedores que se ven vacíos, pobres, que no terminan de
verse bien y con una estructura poco práctica». Referencia pedida: los otros
monitoreos que ya pasaron por su proceso de definición (aulas / Sistema
Pabellón, telefónico, territorial). Continúa el checklist visual del 29/10
(`checklist-monitoreo-acreditacion-visual-2026-10-29.md`, ítems 1–25).

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| K1 | Contenedores que se ven vacíos o pobres: tarjetas estiradas a todo el alto con un hueco blanco abajo (Insumos › Padrón «Profesores») | CSS de las grillas de Insumos/Modelo (`align-self`, alto natural) | Pendiente |
| K2 | «Este resaltado de la izquierda no me gusta»: la franja de color al costado izquierdo como marca de estado o de selección (14 reglas `border-left: 3–4px` en el perfil) | `avance.css`, `modelo.css`, `chromeAcreditacion.css`, `embudoDeCorte.css`, `acreditacionTelefono.css`, `porResolver.css`, `distribucionPorActor.css` | Pendiente: reemplazar por el patrón de las referencias |
| K3 | El relieve 3D del botón en todo el borde del contenedor, «para que se sienta un botón verdadero y no un botón dentro de otro botón» (selector «Cuotas \| Variables de control»; fila elegida con caja dentro de la caja) | control segmentado (`GlidingTabList` en el rótulo), `.acr-in-fuente.is-activo`, `.acr-av-boton` | Pendiente |
| K4 | Contenedores que no choquen: cada fila de una lista lleva su propia caja redondeada dentro de la tarjeta (Modelo › Cuotas, «Variables sin cuota») | `.acr-in-fuente` y listas laterales | Pendiente |
| K5 | Avisos sueltos que no se entienden o parecen aleatorios | `AvisoDeTarjeta` y banners por vista | Pendiente: inventario vista por vista |
| K6 | Estructura práctica: vistas que cambian de lugar (sigue el #19 del checklist del 29/10) | por vista | ◐ Por cuota hecho |
| K7 | Tomar como ejemplo los otros monitoreos | `profiles/aulas` (Sistema Pabellón), `telefonico`, `territorial` | En curso: relevamiento de patrones |

## Lo aprendido

- (se llena al cerrar cada ítem)
