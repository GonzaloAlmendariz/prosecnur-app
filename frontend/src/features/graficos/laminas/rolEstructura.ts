// Qué hace en el informe una lámina sin gráficos (U7 de CCSS): el Inspector, la Estructura y la Composición decían
// «Estructura del informe» —el nombre del panel lateral— o «sin ranuras de gráfico» bajo Cierre o Ficha técnica.

const ROLES: Readonly<Record<string, string>> = {
  p_slide_portada: "Abre el informe",
  p_slide_indice: "Lista los capítulos del informe",
  p_slide_objetivo_icono: "Presenta el objetivo del estudio",
  p_slide_tabla_tecnica: "Resume el diseño del estudio",
  p_slide_top_two_box: "Explica cómo leer el informe",
  p_slide_redondeo: "Explica cómo leer el informe",
  p_slide_seccion: "Abre un capítulo",
  p_slide_cierre: "Cierra el informe",
  p_slide_texto: "Deja un mensaje en texto",
};

export function rolDeEstructura(tipo: string): string {
  return ROLES[tipo] ?? "Lámina sin gráficos";
}
