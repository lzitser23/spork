//! Commit-graph lane assignment.
//!
//! Turns a flat, child-before-parent ordered commit list (as produced by
//! `git log --date-order`) into the data a renderer needs to draw the classic
//! branch/merge topology: one node per commit (which lane/column its dot sits
//! in) and, for the gap between each pair of adjacent rows, the line segments
//! that cross it.
//!
//! The algorithm is the standard incremental one used by GUI git clients. We
//! walk top-to-bottom keeping a set of "active lanes", where each lane is
//! reserved for the next not-yet-drawn commit it flows toward (a parent we've
//! seen referenced from above). When we reach that commit, its children's lanes
//! converge into it; its first parent continues straight down the same lane and
//! any further parents (a merge) branch off into new or existing lanes.

import type { Commit } from "./git";

/** Lane colors, in Tailwind-400 tones that read well on a pure-black background. */
export const LANE_COLORS = [
  "#38bdf8", // sky
  "#fbbf24", // amber
  "#34d399", // emerald
  "#fb7185", // rose
  "#a78bfa", // violet
  "#2dd4bf", // teal
  "#fb923c", // orange
  "#f472b6", // pink
];

export interface GraphNode {
  /** Column (lane index) the commit's dot sits in. */
  lane: number;
  /** The dot's color (its lane's color). */
  color: string;
}

/** A line crossing the gap between two adjacent rows. */
export interface GraphSegment {
  /** Column at the top row's vertical center. */
  fromLane: number;
  /** Column at the bottom row's vertical center. */
  toLane: number;
  color: string;
}

export interface GraphData {
  /** One node per commit, in the same order as the input. */
  nodes: GraphNode[];
  /** `bands[i]` holds the segments between row `i` and row `i + 1`. */
  bands: GraphSegment[][];
  /** Peak number of concurrent lanes — used to size the gutter. */
  width: number;
}

/**
 * Compute lane/column assignments and connecting segments for `commits`.
 *
 * `commits` must be ordered so that every commit appears before its parents
 * (the guarantee `git log --date-order` / `--topo-order` give).
 */
export function computeGraph(commits: Commit[]): GraphData {
  const n = commits.length;
  const nodes: GraphNode[] = new Array(n);
  const bands: GraphSegment[][] = [];

  // lanes[j] = full hash the lane currently flows toward (next commit downward),
  // or null when the lane is free. colors[j] = that lane's color.
  const lanes: (string | null)[] = [];
  const colors: (string | null)[] = [];

  let colorCounter = 0;
  const nextColor = () => LANE_COLORS[colorCounter++ % LANE_COLORS.length];

  // Reuse a freed lane slot before widening the graph.
  const firstFree = (): number => {
    const i = lanes.indexOf(null);
    if (i !== -1) return i;
    lanes.push(null);
    colors.push(null);
    return lanes.length - 1;
  };

  // Captured per row, then used to build the band *below* that row in a second
  // pass (a band needs both of its endpoint rows to be known).
  const occAfter: (string | null)[][] = []; // lane hashes just after routing row i
  const colAfter: (string | null)[][] = []; // lane colors just after routing row i
  const originated: Set<number>[] = []; // lanes whose line starts at node i
  const mergeExtra: GraphSegment[][] = []; // node i -> an already-existing lane

  let width = 0;

  for (let i = 0; i < n; i++) {
    const c = commits[i];
    const h = c.hash;

    // 1. Lanes that already-drawn children above reserved for this commit.
    const reserved: number[] = [];
    for (let j = 0; j < lanes.length; j++) if (lanes[j] === h) reserved.push(j);

    let myLane: number;
    let myColor: string;
    if (reserved.length > 0) {
      myLane = reserved[0]; // leftmost reserved lane hosts the node
      myColor = colors[myLane] ?? nextColor();
    } else {
      myLane = firstFree(); // a tip: no children in the loaded view
      myColor = nextColor();
    }
    colors[myLane] = myColor;
    nodes[i] = { lane: myLane, color: myColor };

    const origin = new Set<number>();
    const extras: GraphSegment[] = [];

    // 2. Converging children: free their lanes (the node claims `myLane`).
    for (const j of reserved) {
      if (j !== myLane) {
        lanes[j] = null;
        colors[j] = null;
      }
    }

    // 3. Route to parents.
    const parents = c.parents;
    if (parents.length === 0) {
      lanes[myLane] = null; // root commit: close the lane
      colors[myLane] = null;
    } else {
      lanes[myLane] = parents[0]; // first parent continues straight down
      origin.add(myLane);
      for (let k = 1; k < parents.length; k++) {
        const p = parents[k];
        const existing = lanes.indexOf(p);
        if (existing !== -1) {
          // The parent is already tracked: draw a merge diagonal into its lane.
          extras.push({ fromLane: myLane, toLane: existing, color: colors[existing] ?? myColor });
        } else {
          const nl = firstFree();
          lanes[nl] = p;
          colors[nl] = nextColor();
          origin.add(nl);
        }
      }
    }

    occAfter[i] = lanes.slice();
    colAfter[i] = colors.slice();
    originated[i] = origin;
    mergeExtra[i] = extras;
    width = Math.max(width, lanes.length);
  }

  // Build each band from the lane state captured below its top row.
  for (let i = 0; i < n - 1; i++) {
    const occ = occAfter[i];
    const col = colAfter[i];
    const topLane = nodes[i].lane;
    const botLane = nodes[i + 1].lane;
    const nextHash = commits[i + 1].hash;
    const orig = originated[i];
    const segs: GraphSegment[] = [];

    for (let j = 0; j < occ.length; j++) {
      if (occ[j] == null) continue;
      const from = orig.has(j) ? topLane : j; // starts at node i, else passes through
      const to = occ[j] === nextHash ? botLane : j; // ends at node i+1, else passes through
      segs.push({ fromLane: from, toLane: to, color: col[j] ?? nodes[i].color });
    }
    for (const e of mergeExtra[i]) segs.push(e);
    bands.push(segs);
  }

  return { nodes, bands, width: Math.max(1, width) };
}
