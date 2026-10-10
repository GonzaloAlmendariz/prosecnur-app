# LibreOffice incluido en Prosecnur

Prosecnur incluye una copia **sin modificar** de LibreOffice para generar la vista previa de láminas y páginas. La usa
sólo en segundo plano, para convertir presentaciones y documentos a PDF; no forma parte de Prosecnur ni lleva su marca.

- Producto: LibreOffice, de The Document Foundation (https://www.libreoffice.org/).
- Versión: la fijada en `packaging/preview-renderer.lock.json`.
- Licencia: Mozilla Public License 2.0, con partes bajo LGPL-3.0 y componentes de terceros. Los avisos de licencia
  completos viajan dentro de la propia copia de LibreOffice (`LICENSE`, `NOTICE`, `CREDITS` y la carpeta `readmes`) y no se
  alteran.
- Windows: la copia sale del instalador MSI oficial, extraído sin instalar. Las bibliotecas de Microsoft Visual C++
  (`vcruntime140*.dll`, `msvcp140*.dll`, `concrt140.dll`, `vccorlib140.dll`) que ese mismo MSI instalaría en la carpeta
  del sistema se colocan, sin modificar, en `program/` junto a `soffice.exe`. Son redistribuibles de Microsoft.
- Código fuente de esa versión: el enlace `fuente` del mismo archivo de bloqueo (archivo oficial de The Document Foundation).

LibreOffice y su logotipo son marcas de The Document Foundation.
