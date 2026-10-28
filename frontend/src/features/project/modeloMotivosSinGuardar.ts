// Motivos de «sin guardar» (L22). El backend anota en `project_dirty_reasons`
// la clave de sesión que cambió —o la función que marcó, si el sitio no la
// dio— y `project/status` la devuelve como `dirty_reasons`. Aquí se normaliza
// (llega de backends viejos sin el campo) y se traduce a una frase corta; la
// clave cruda se conserva para quien tenga que rastrearla.

export type MotivoSinGuardar = {
  motivo: string;
  veces: number;
  ultima: string | null;
};

function escalar(valor: unknown): unknown {
  return Array.isArray(valor) && valor.length === 1 ? valor[0] : valor;
}

export function normalizarMotivosSinGuardar(crudo: unknown): MotivoSinGuardar[] {
  if (!Array.isArray(crudo)) return [];
  const salida: MotivoSinGuardar[] = [];
  for (const fila of crudo) {
    if (!fila || typeof fila !== "object") continue;
    const registro = fila as Record<string, unknown>;
    const motivo = escalar(registro.motivo);
    if (typeof motivo !== "string" || !motivo.trim()) continue;
    const veces = Number(escalar(registro.veces));
    const ultima = escalar(registro.ultima);
    salida.push({
      motivo,
      veces: Number.isFinite(veces) && veces > 0 ? Math.round(veces) : 1,
      ultima: typeof ultima === "string" && ultima ? ultima : null,
    });
  }
  return salida;
}

// Prefijo de la clave de sesión → dónde vive el cambio. El orden importa: el
// primero que casa gana (`calc_muestra` antes que cualquier `calc`).
const AREAS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^choice_code_mapping/, "Códigos de respuesta"],
  [/^(estudio|multi|equivalencias|surveymonkey|files|data|inst)/, "Bases y archivos de Carga"],
  [/^instrumento|^xlsform/, "Formulario"],
  [/^(validacion|reglas|evaluacion|explorador)/, "Validación"],
  [/^limpieza/, "Limpieza"],
  [/^codif/, "Codificación"],
  [/^analitica/, "Analítica"],
  [/^(graficos|plan|rp)/, "Gráficos"],
  [/^dashboard|^public/, "Dashboard"],
  [/^monitoreo/, "Monitoreo"],
  [/^(collection|material)/, "Recopiladores"],
  [/^hojas/, "Hojas de ruta"],
  [/^calc/, "Cálculo de muestra"],
  [/^(diseno|bitacora)/, "Bitácora"],
];

export function areaDeMotivo(motivo: string): string {
  const clave = motivo.trim();
  for (const [patron, area] of AREAS) {
    if (patron.test(clave)) return area;
  }
  return "Otro cambio";
}
