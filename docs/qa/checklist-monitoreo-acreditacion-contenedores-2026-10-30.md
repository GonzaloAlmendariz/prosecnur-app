# Checklist — Acreditación: contenedores, relieve y avisos (2026-10-30)

Dictado de Gonzalo (00:0x, con capturas de Insumos › Padrón «Profesores» y
Modelo › Cuotas): «contenedores que se ven vacíos, pobres, que no terminan de
verse bien y con una estructura poco práctica». Referencia pedida: los otros
monitoreos que ya pasaron por su proceso de definición (aulas / Sistema
Pabellón, telefónico, territorial). Continúa el checklist visual del 29/10
(`checklist-monitoreo-acreditacion-visual-2026-10-29.md`, ítems 1–25).

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| K1 | Contenedores que se ven vacíos o pobres: tarjetas estiradas a todo el alto con un hueco blanco abajo (Insumos › Padrón «Profesores») | CSS de las grillas de Insumos/Modelo (`align-self`, alto natural) | ☑ 0db98c1cf padrón y matriz; de401e2d6 Cruce; 5f2348742 Personas; e43ac91f5 Ventana; 2a400588d Por público. Pasada a 1024 (00:4x): 17 pestañas sin contenedores con desplazamiento horizontal (el rail de secciones daba 215/500 sólo durante la transición; en reposo 215/215) |
| K2 | «Este resaltado de la izquierda no me gusta»: la franja de color al costado izquierdo como marca de estado o de selección (14 reglas `border-left: 3–4px` en el perfil) | `avance.css`, `modelo.css`, `chromeAcreditacion.css`, `embudoDeCorte.css`, `acreditacionTelefono.css`, `porResolver.css`, `distribucionPorActor.css` | ☑ 0db98c1cf: estado en chip (Metas, Por público, Salidas), punto (franja de cierre) o color de la cifra (cifras heredadas); quedan sólo la línea de tiempo del historial (es su eje) y `embudoDeCorte.css` (componente sin montar) |
| K3 | El relieve 3D del botón en todo el borde del contenedor, «para que se sienta un botón verdadero y no un botón dentro de otro botón» (selector «Cuotas \| Variables de control»; fila elegida con caja dentro de la caja) | control segmentado (`GlidingTabList` en el rótulo), `.acr-in-fuente.is-activo`, `.acr-av-boton` | ☑ 0db98c1cf: `SelectorDeSubvistas` es un solo control con relieve (degradado, brillo interior y sombra) y el segmento elegido hundido y teñido; `.acr-av-boton` con el relieve del botón global y su hover |
| K4 | Contenedores que no choquen: cada fila de una lista lleva su propia caja redondeada dentro de la tarjeta (Modelo › Cuotas, «Variables sin cuota») | `.acr-in-fuente` y listas laterales | ☑ 0db98c1cf: la causa era el botón global (theme.css) que daba sombra y relieve a cada fila; filas planas con línea fina y la elegida teñida |
| K5 | Avisos sueltos que no se entienden o parecen aleatorios | `AvisoDeTarjeta` y banners por vista | ☑ 8c84647bc carga de sección; 5f2348742 vacío de Calidad; f5a5bc4e0 la carga se anuncia (role=status); el motivo de «Asignar» apagado pasa de recuadro a texto sobre los botones. Inventario: los otros 3 avisos están en su tarjeta y con sentido |
| K6 | Estructura práctica: vistas que cambian de lugar (sigue el #19 del checklist del 29/10) | por vista | ☑ Por cuota (6ccdc1137), carga de sección (8c84647bc) y 1a4e9501d: medido en las 17 pestañas a 1440, el rótulo empieza en x=106 en todas (Por resolver y Respuestas estaban en 367/397) y el selector queda al extremo derecho de su tarjeta. Fuentes usa el rótulo en barra de herramientas (RotuloEnBarra), a propósito |
| K7 | Tomar como ejemplo los otros monitoreos | `profiles/aulas` (Sistema Pabellón), `telefonico`, `territorial` | ☑ Relevamiento hecho (00:1x). Ojo: el selector de Telefónico es justamente la pista gris con segmento blanco que Gonzalo rechaza; Acreditación ya no lo copia |
| K8 | «No me gusta que este botón cambie de lugar conforme aprieto Fuentes o Recopiladores» (captura 30/10) | `insumos/insumos.css` (barra de Insumos › Fuentes y franja heredada de Recopiladores) | ☑ 8e5fdbbe9: las dos en dos filas, botón anclado a la derecha; medido en vivo: el botón pasaba de x≈609 a x≈1347 y ahora difiere menos de 10 px; y el selector de sub-vistas va en su fila bajo el rótulo en todo el perfil (mismo punto en todas las sub-vistas, ±4 px) |

## Lo aprendido

- Las franjas laterales eran una decisión anterior y deliberada («el estado en el borde lateral sólido»); el criterio nuevo las reemplaza en todo el perfil, no por vista.
- Inventario de avisos (K5, 00:2x, 17 pestañas con el proyecto real): sólo cuatro y todos dentro de la tarjeta que afectan: Ritmo «El plan de campo no tiene fases con fechas» (con su acción), Correo «4 destinatarios de Mailchimp no están en el universo», Modelo › Cuotas «las metas por categoría suman 844 y la meta del público es 843», Por resolver «Elige a la persona del padrón» (en el panel del caso). Falta mirar si este último aparece antes de que haya algo que elegir.
- El verificador rechazó 0db98c1cf por el foco recortado del selector (overflow hidden + outline por fuera); corregido en bbdbf8c9a con el foco por dentro.
- Las «cajas por fila» no venían del CSS de Acreditación sino del `button` global de `theme.css` (sombra + relieve + salto en hover): toda lista hecha de `<button>` lo hereda si no lo anula.
