# Identidad visual de Prosecnur

Paquete canónico de la identidad (v1.1, julio 2026). La referencia normativa es
[`direccion-creativa.md`](direccion-creativa.md); el manual interactivo completo
vive en [`manual-identidad.html`](manual-identidad.html) (también publicado como
Artifact). La v1.1 destila como **patrones maestros** los ejemplares más
profesionales que ya viven en la app: command bar de módulo, rail de secciones
centrado, sidebar icon-compressed, switch 44×24, KPI discreto 21/900,
procedencia/herencia de Gráficos v2 e iconografía en dos capas.

## Contenido

| Ruta | Qué es |
| --- | --- |
| `direccion-creativa.md` | Dirección congelada v1.1: concepto «La señal ordenada», marca, paleta, tipografía, espaciado, motion, patrones maestros y economía del chrome. |
| `manual-identidad.html` | Manual interactivo de 8 capítulos (componentes vivos, demos de motion, mockups animados). Autocontenido: se abre en cualquier navegador. |
| `tokens/prosecnur-brand.css` | Tokens de marca (`--prosecnur-*`) espejo 1:1 de los `--pulso-*` de producción, para piezas fuera de la app. |
| `logo/` | Suite completa en SVG (10 variantes) + `preview.html` (contact sheet con prueba de reducción). |

## Suite de logos

| Archivo | Uso |
| --- | --- |
| `prosecnur-isotipo.svg` | Marca base 64×64, navy plano. Mínimo 16px. |
| `prosecnur-isotipo-gradiente.svg` | Solo icono de app e instalador (gradiente `#013371→#002457`). |
| `prosecnur-isotipo-oscuro.svg` | Invertido (squircle blanco) para fondos oscuros. |
| `prosecnur-appicon.svg` | 512×512 en retícula de iconos macOS; fuente del `.icns`/`.ico`. |
| `prosecnur-lockup-horizontal.svg` | Lockup estándar para fondo claro. Mínimo 96px de ancho. |
| `prosecnur-lockup-horizontal-oscuro.svg` | Lockup estándar para fondo navy/oscuro. |
| `prosecnur-lockup-principal.svg` | Presentación: lockup + «SUITE ANALÍTICA · PULSO PUCP». |
| `prosecnur-lockup-vertical.svg` | Apilado para portadas y splash. |
| `prosecnur-mono-negro.svg` | Una tinta negra (impresión). |
| `prosecnur-mono-blanco.svg` | Blanco con pastillas en knockout (fondos fotográficos/navy). |

Reglas duras: dos tintas (navy + blanco), sin recolorear, sin deformar, sin
rotar, sin efectos; clearspace = ¼ de la altura del isotipo; sobre fondos
oscuros siempre la variante invertida o el mono blanco.

## Geometría congelada del isotipo

ViewBox 64: squircle `rx 15.4` (24%) navy `#002457`; cuatro pastillas blancas
`width 7 · rx 3.5 · gap 4` en `x = 12/23/34/45`, baseline `y = 48`, alturas
`18 / 26 / 20 / 32` (el perfil del latido). Toda reproducción nueva parte de
estos SVG, nunca de un redibujo.

## Adopción en la app

Los tokens de color, motion, radios y tipografía ya son los de producción
(`frontend/src/app/theme.css`) — no requieren cambios. Para adoptar el isotipo
unificado: (1) `BrandMark`/`BootBrandMark` en `frontend/src/app/Layout.tsx` y
`BootGate.tsx`; (2) `packaging/windows/brand/{icon,header,wizard}.svg`;
(3) regenerar `icon.icns` desde `prosecnur-appicon.svg`. Outlier conocido:
el PDF de «Monitoreo acreditación» usa navy `#06346f` — unificar a `#002457`.
