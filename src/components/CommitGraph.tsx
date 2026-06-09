import { memo } from "react";
import type { GraphNode, GraphSegment } from "@/lib/graph";

/** Row height, in px. CommitList pins each commit row to exactly this so the
 *  per-row SVGs stack seamlessly and lines stay continuous across rows. */
export const ROW_H = 28;
/** Horizontal space per lane/column. */
export const LANE_W = 14;
/** Most lanes we'll widen the gutter to (deeper histories clip rather than
 *  pushing the message column arbitrarily far right). */
const MAX_LANES = 12;

const DOT_R = 3.5;
const LINE_W = 1.5;

const HALF = ROW_H / 2;
/** Center-x of a lane column. */
const cx = (lane: number) => LANE_W / 2 + lane * LANE_W;

/**
 * The graph gutter for a single commit row.
 *
 * Each row draws the node's dot plus the *halves* of the bands that fall inside
 * its box: the lower half of the band above (top edge → center) and the upper
 * half of the band below (center → bottom edge). Adjacent rows meet at the same
 * midpoint on their shared edge, so the segments join into continuous lines.
 */
function GraphCellImpl({
  node,
  above,
  below,
  width,
  selected,
}: {
  node: GraphNode;
  above: GraphSegment[];
  below: GraphSegment[];
  width: number;
  selected: boolean;
}) {
  const cols = Math.min(Math.max(width, 1), MAX_LANES);
  const w = cols * LANE_W;
  const nodeX = cx(node.lane);

  return (
    <svg
      width={w}
      height={ROW_H}
      viewBox={`0 0 ${w} ${ROW_H}`}
      className="shrink-0 overflow-hidden"
      aria-hidden
    >
      {/* Lower half of the band above: boundary (y=0) → this row's center. */}
      {above.map((s, i) => {
        const mid = (cx(s.fromLane) + cx(s.toLane)) / 2;
        return (
          <line
            key={`a${i}`}
            x1={mid}
            y1={0}
            x2={cx(s.toLane)}
            y2={HALF}
            stroke={s.color}
            strokeWidth={LINE_W}
            strokeLinecap="round"
          />
        );
      })}

      {/* Upper half of the band below: this row's center → boundary (y=ROW_H). */}
      {below.map((s, i) => {
        const mid = (cx(s.fromLane) + cx(s.toLane)) / 2;
        return (
          <line
            key={`b${i}`}
            x1={cx(s.fromLane)}
            y1={HALF}
            x2={mid}
            y2={ROW_H}
            stroke={s.color}
            strokeWidth={LINE_W}
            strokeLinecap="round"
          />
        );
      })}

      {/* Selection ring, tied to the lane color. */}
      {selected && (
        <circle cx={nodeX} cy={HALF} r={DOT_R + 2.5} fill="none" stroke={node.color} strokeWidth={1} opacity={0.5} />
      )}
      {/* Halo punches the background through crossing lines so the dot reads cleanly.
          `var()` must go through `style` — it isn't resolved as a plain SVG attribute. */}
      <circle cx={nodeX} cy={HALF} r={DOT_R + 1.5} style={{ fill: "var(--background)" }} />
      <circle cx={nodeX} cy={HALF} r={DOT_R} fill={node.color} />
    </svg>
  );
}

export const GraphCell = memo(GraphCellImpl);
