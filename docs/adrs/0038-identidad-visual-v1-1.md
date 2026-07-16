# ADR 0038: Identidad visual v1.1 — marca canónica, patrones maestros y paquete branding/

Estado: Aceptado

Fecha: 2026-07-15

## Contexto

La marca de Prosecnur vivía en trazados divergentes: un círculo con 3 barras
inline en `Layout.tsx`/`BootGate.tsx` y un icono de 4 barras con gradiente en
`packaging/windows/brand/`. No existía dirección de identidad escrita: el
design system operativo (tokens `--pulso-*`, paletas por módulo, motion
tokenizado, gramática de layout) estaba maduro pero repartido entre theme.css,
skills y docs, sin una capa de marca que lo gobernara ni un manual consultable.
Los patrones más profesionales de la app (command bar material de Monitoreo,
pillbar centrado, sidebar icon-compressed, switch 44×24, banda de KPIs
discretos de aulas, procedencia de Gráficos v2) no estaban canonizados como
norma transversal.

## Decisión

Se establece la identidad visual v1.1 «La señal ordenada» con un paquete
canónico versionado en `branding/`:

- **Isotipo único «ecualizador del pulso»**: squircle navy `#002457` rx 24%
  con 4 pastillas blancas (7×{18,26,20,32}, x={12,23,34,45}, baseline 48,
  viewBox 64). Reemplaza a TODOS los trazados anteriores; toda reproducción
  parte de los SVG de `branding/logo/` (10 variantes), nunca de redibujos.
- **Marca en dos tintas** (navy + blanco); el color vivo pertenece al sistema
  (espectro modular, azul señal `#2457D6`), jamás al logo.
- **`branding/direccion-creativa.md` es la referencia normativa** de la
  identidad: paleta, tipografía «Voz nativa», espaciado, Física Pulso,
  patrones maestros y economía del chrome. El manual interactivo
  (`branding/manual-identidad.html`, espejo del Artifact publicado) es la
  versión consultable/demostrable.
- **Patrones maestros**: los ejemplares más profesionales ya construidos se
  elevan a norma para todo módulo — command bar de 3 zonas con material y
  acento por reasignación de variable, rail de secciones centrado (pillbar),
  sidebar icon-compressed con push por grid (nunca overlay), switch maestro
  44×24, KPI discreto 21/900 con hairline (nunca cifras display), procedencia
  de valores (violeta = heredado / verde = override), iconografía en dos capas
  (alias semánticos de `icons.ts` + glifos a mano solo para dominio).
- **Economía del chrome** (heredada del design system, ahora normativa de
  identidad): módulos sin H1 visible, datos en el primer viewport, acento de
  módulo inyectado por CSS var, semánticos nunca sustituidos por el acento.

## Consecuencias

- `Layout.tsx` (BrandMark), `BootGate.tsx` (BootBrandMark, con la firma de
  arranque animada), `packaging/windows/brand/*.svg` y el pipeline del
  `.icns` (`build-dmg.sh` → `branding/logo/prosecnur-appicon.svg`, con
  retícula macOS) ya consumen la marca canónica; los derivados
  `.ico`/`.icns`/`.bmp` se regeneran en el próximo build.
- Piezas nuevas fuera de la app (web, docs, plantillas) usan
  `branding/tokens/prosecnur-brand.css` (espejo 1:1 de `--pulso-*`).
- Cambios de identidad (geometría del isotipo, paleta de marca, patrones
  maestros) requieren actualizar la dirección y republicar el manual; el
  Artifact y `branding/manual-identidad.html` deben mantenerse en paridad.
- Outliers saldados el 2026-07-15: el navy `#06346f` del PDF de acreditación
  ya no existía en código (solo en la tabla del doc, corregida) y
  `--pulso-warn-accent` se unificó de `#d68a00` al canónico `#D97706`.
