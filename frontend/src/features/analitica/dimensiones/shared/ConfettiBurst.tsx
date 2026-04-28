// Confetti suave CSS-only — 12 partículas que caen con rotación.
// Usa la keyframe `pulso-confetti-fall-kf` definida en theme.css; cada
// partícula recibe un --x (offset horizontal final) y --delay (escalado)
// inline para distribuirse en abanico.
//
// El componente se monta cuando el padre quiere disparar el burst y se
// desmonta tras ~1500ms (responsabilidad del padre).

const COLORS = [
  "#E57E75", // rojo soft (semáforo rojo)
  "#F4CA6A", // ámbar (semáforo)
  "#9DBB6D", // verde (semáforo)
  "#336699", // azul Pulso primary
  "#7c3aed", // morado (Editor XLSForm)
  "#059669", // verde fuerte (Hojas de ruta)
];

export function ConfettiBurst({ origin = "top-center" }: { origin?: "top-center" }) {
  void origin; // reservado para variantes futuras
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {Array.from({ length: 18 }).map((_, i) => {
        const x = (i - 8) * 14 + (Math.random() * 14 - 7); // distribución horizontal en abanico
        const delay = i * 35;
        const color = COLORS[i % COLORS.length];
        return (
          <span
            key={i}
            className="pulso-confetti-particle"
            style={
              {
                background: color,
                "--x": `${x}px`,
                "--delay": `${delay}ms`,
                transform: `translateX(${x}px) rotate(${Math.random() * 60 - 30}deg)`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
