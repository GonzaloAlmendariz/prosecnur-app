/**
 * El sexo, escrito como lo lee una persona.
 *
 * **La instrucción es explícita** (Gonzalo, sobre los rótulos de cuota): «cómo
 * vas a poner mayoría hombres o mayoría mujeres cuando eso no me interesa; lo
 * que me interesa es cuántos hombres y cuántas mujeres». El dato viaja como
 * `"F"` / `"M"` —medido sobre `HSVG2026_sem15_como_2025`: 152 y 152 en
 * `control_calidad`— y esa letra no es una etiqueta: puesta en minúscula
 * publicaba «faltan 48 · 38 m», que se lee como 38 metros o 38 minutos.
 *
 * **Vive en un solo sitio porque ya había dos traducciones y una se quedó
 * atrás**: `avanceProyectado.ts` traducía a «Mujeres»/«Hombres» desde siempre y
 * `alertaDeAnticipacion` pasaba la letra cruda hasta el JSX. Es el mismo patrón
 * que los alias del parte de campo: una capa aprende la regla y la de al lado
 * no se entera.
 */
export function etiquetaDeSexo(
  sexo: string | null | undefined,
  { mayuscula = false }: { mayuscula?: boolean } = {},
): string {
  const clave = String(sexo ?? "").trim().toUpperCase();
  const nombre = clave === "F" ? "mujeres" : clave === "M" ? "hombres" : "";
  // Un valor que no reconocemos NO se traduce a un sexo que nadie declaró —es la
  // misma regla que el estado desconocido del corte—, pero sí se le aplica la
  // caja pedida: quien llama lo va a meter en medio de una frase.
  if (!nombre) {
    const crudo = String(sexo ?? "").trim();
    if (!crudo) return "";
    return mayuscula ? crudo.charAt(0).toUpperCase() + crudo.slice(1) : crudo.toLowerCase();
  }
  return mayuscula ? nombre.charAt(0).toUpperCase() + nombre.slice(1) : nombre;
}
