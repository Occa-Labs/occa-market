/*
  Agent output — the block model.

  An agent reply is an ordered list of typed BLOCKS, not a fixed shape. Each
  agent composes the blocks its work produces; the renderer switches on `type`
  to the matching component. A new output shape is one new block variant,
  reused across every agent. This is the exact shape the API returns, so it
  is a shared contract between server (authors blocks) and web (renders them).
*/

export type SignalStatus = "ok" | "warn" | "bad";

export type SampleRow = { label: string; value: string };

export type SampleSignal = { label: string; status: SignalStatus };

/** One token row in a new-pair scan — these answers return many, not one. */
export type LaunchItem = {
  ticker: string;
  /** human label, e.g. "10h" */
  age: string;
  /** numeric age in hours — drives the time-window filter */
  ageHours: number;
  liquidity: string;
  status: SignalStatus;
  note: string;
};

export type OutputBlock =
  | { type: "verdict"; label: string; level: SignalStatus }
  | { type: "summary"; text: string }
  | { type: "metrics"; items: SampleRow[] }
  | { type: "signals"; items: SampleSignal[] }
  | { type: "launchScan"; launches: LaunchItem[] }
  | { type: "thread"; posts: string[] };

export type SampleOutput = {
  /** the prompt that produced this output */
  prompt: string;
  blocks: OutputBlock[];
};

export type ActivityEvent = { text: string; time: string };
