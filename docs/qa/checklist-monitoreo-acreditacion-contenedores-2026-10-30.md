# Checklist — Acreditación: contenedores, relieve y avisos (2026-10-30)

Dictado de Gonzalo (00:0x, con capturas de Insumos › Padrón «Profesores» y
Modelo › Cuotas): «contenedores que se ven vacíos, pobres, que no terminan de
verse bien y con una estructura poco práctica». Referencia pedida: los otros
monitoreos que ya pasaron por su proceso de definición (aulas / Sistema
Pabellón, telefónico, territorial). Continúa el checklist visual del 29/10
(`checklist-monitoreo-acreditacion-visual-2026-10-29.md`, ítems 1–25).

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| K1 | Contenedores que se ven vacíos o pobres: tarjetas estiradas a todo el alto con un hueco blanco abajo (Insumos › Padrón «Profesores») | CSS de las grillas de Insumos/Modelo (`align-self`, alto natural) | ◐ 0db98c1cf: padrón a alto natural; «Por dónde entra cada público» no se pinta con un solo canal. Falta recorrer el resto de vistas |
| K2 | «Este resaltado de la izquierda no me gusta»: la franja de color al costado izquierdo como marca de estado o de selección (14 reglas `border-left: 3–4px` en el perfil) | `avance.css`, `modelo.css`, `chromeAcreditacion.css`, `embudoDeCorte.css`, `acreditacionTelefono.css`, `porResolver.css`, `distribucionPorActor.css` | ☑ 0db98c1cf: estado en chip (Metas, Por público, Salidas), punto (franja de cierre) o color de la cifra (cifras heredadas); quedan sólo la línea de tiempo del historial (es su eje) y `embudoDeCorte.css` (componente sin montar) |
| K3 | El relieve 3D del botón en todo el borde del contenedor, «para que se sienta un botón verdadero y no un botón dentro de otro botón» (selector «Cuotas \| Variables de control»; fila elegida con caja dentro de la caja) | control segmentado (`GlidingTabList` en el rótulo), `.acr-in-fuente.is-activo`, `.acr-av-boton` | ☑ 0db98c1cf: `SelectorDeSubvistas` es un solo control con relieve (degradado, brillo interior y sombra) y el segmento elegido hundido y teñido; `.acr-av-boton` con el relieve del botón global y su hover |
| K4 | Contenedores que no choquen: cada fila de una lista lleva su propia caja redondeada dentro de la tarjeta (Modelo › Cuotas, «Variables sin cuota») | `.acr-in-fuente` y listas laterales | ☑ 0db98c1cf: la causa era el botón global (theme.css) que daba sombra y relieve a cada fila; filas planas con línea fina y la elegida teñida |
| K5 | Avisos sueltos que no se entienden o parecen aleatorios | `AvisoDeTarjeta` y banners por vista | Pendiente. Casos ya vistos: pantalla de carga de Insumos («Actualizando cache local», casillas «Cache local / Corte reportes / Vista Fuentes») |
| K6 | Estructura práctica: vistas que cambian de lugar (sigue el #19 del checklist del 29/10) | por vista | ◐ Por cuota hecho; Insumos usa la cabecera antigua con ícono fuera de la tarjeta mientras carga |
| K7 | Tomar como ejemplo los otros monitoreos | `profiles/aulas` (Sistema Pabellón), `telefonico`, `territorial` | ☑ Relevamiento hecho (00:1x). Ojo: el selector de Telefónico es justamente la pista gris con segmento blanco que Gonzalo rechaza; Acreditación ya no lo copia |

## Lo aprendido

- Las franjas laterales eran una decisión anterior y deliberada («el estado en el borde lateral sólido»); el criterio nuevo las reemplaza en todo el perfil, no por vista.
- Las «cajas por fila» no venían del CSS de Acreditación sino del `button` global de `theme.css` (sombra + relieve + salto en hover): toda lista hecha de `<button>` lo hereda si no lo anula.
