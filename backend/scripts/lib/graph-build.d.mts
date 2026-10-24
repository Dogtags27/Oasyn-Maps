/** Type declarations for the build-time graph pipeline (graph-build.mjs). */

export type LatLon = { lat: number; lon: number };
export type Projection = {
  center: LatLon;
  project(lat: number, lon: number): [number, number];
};

export type Edge = {
  u: number;
  v: number;
  len: number;
  name?: string;
  kind: string;
  step?: boolean;
  trees: number;
  park: number;
  bldg: number;
  geom: [number, number][];
};

export type Graph = { nodes: [number, number][]; edges: Edge[] };

export function makeProjection(center: LatLon): Projection;

export function buildPointGrid(
  points: LatLon[],
  project: Projection["project"],
  cellM: number,
): { grid: Map<string, { x: number; y: number }[]>; cellM: number };

export function countWithin(
  grid: ReturnType<typeof buildPointGrid>,
  x: number,
  y: number,
  radiusM: number,
): number;

export function buildParkGrid(
  parkFeatures: any[],
  project: Projection["project"],
  cellM: number,
): { grid: Map<string, number[]>; cellM: number; polys: [number, number][][] };

export function insideAnyPoly(
  parkGrid: ReturnType<typeof buildParkGrid>,
  x: number,
  y: number,
): boolean;

export function bakeEdgeFeatures(
  graph: Graph,
  project: Projection["project"],
  grids: {
    treeGrid: ReturnType<typeof buildPointGrid>;
    parkGrid: ReturnType<typeof buildParkGrid>;
    bldgGrid: ReturnType<typeof buildPointGrid>;
  },
  cfg: { sampleStepM: number; treeM: number; buildingM: number },
): Graph;

export function contract(graph: Graph): Graph;

export function toCSR(
  graph: Graph,
  project: Projection["project"],
): {
  V: number;
  E: number;
  projection?: { center: LatLon };
  arrays: {
    offsets: Int32Array;
    targets: Int32Array;
    edgeOf: Int32Array;
    len: Float32Array;
    trees: Float32Array;
    park: Float32Array;
    bldg: Float32Array;
    step: Uint8Array;
    nodeLat: Float32Array;
    nodeLon: Float32Array;
    nodeX: Float32Array;
    nodeY: Float32Array;
  };
};
