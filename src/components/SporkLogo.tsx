import { useId } from "react";

import { cn } from "@/lib/utils";

// Spork app mark — concept G2 ("pixel spork") from the Claude Design handoff.
// Fork prongs fused to a spoon bowl, built from rounded monospace blocks, set
// in a true macOS squircle. Pure monochrome. Ported from the design's icons.jsx.

const INK = "#0B0B0C";
const WHITE = "#F4F4F2";

// macOS-style squircle (continuous-corner superellipse), traced on a 512 box.
function squirclePath(size: number, n = 4.4): string {
  const a = size / 2;
  const steps = 90;
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const x = a + Math.sign(c) * a * Math.pow(Math.abs(c), 2 / n);
    const y = a + Math.sign(s) * a * Math.pow(Math.abs(s), 2 / n);
    d += (i === 0 ? "M" : "L") + x.toFixed(2) + " " + y.toFixed(2);
  }
  return d + "Z";
}
const SQ = squirclePath(512);

// Pixel grid for the mark: [col, row] cells on a 5-wide layout.
const SPORK_CELLS: [number, number][] = [
  [0, 0], [2, 0], [4, 0], [0, 1], [2, 1], [4, 1], // 2-row fork prongs
  [0, 2], [1, 2], [2, 2], [3, 2], [4, 2],         // bowl
  [0, 3], [1, 3], [2, 3], [3, 3], [4, 3],
  [1, 4], [2, 4], [3, 4],                         // rounded base
  [2, 5], [2, 6],                                 // handle
];
const CELL = 34;
const OX = 171;
const OY = 130;
const BS = 28;
const RX = BS * 0.34;

export type SporkVariant = "dark" | "light" | "flat";

export function SporkLogo({
  size = 48,
  variant = "dark",
  className,
}: {
  size?: number;
  variant?: SporkVariant;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const clip = "sporkClip" + uid;
  const grad = "sporkGrad" + uid;

  const dark = variant !== "light";
  const flat = variant === "flat";
  const mark = variant === "light" ? INK : WHITE;

  const topC = dark ? (flat ? "#0B0B0C" : "#161618") : "#F2F2EF";
  const botC = dark ? (flat ? "#0B0B0C" : "#070708") : "#E4E4DF";
  const ring = flat ? "none" : dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      className={cn("block", className)}
      role="img"
      aria-label="Spork"
    >
      <defs>
        <clipPath id={clip}>
          <path d={SQ} />
        </clipPath>
        <linearGradient id={grad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={topC} />
          <stop offset="1" stopColor={botC} />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect x="0" y="0" width="512" height="512" fill={`url(#${grad})`} />
        <g fill={mark}>
          {SPORK_CELLS.map(([col, row], i) => (
            <rect
              key={i}
              x={OX + col * CELL}
              y={OY + row * CELL}
              width={BS}
              height={BS}
              rx={RX}
            />
          ))}
        </g>
      </g>
      <path d={SQ} fill="none" stroke={ring} strokeWidth="3" />
    </svg>
  );
}
