/*
  Merkle tree over a day's chat exchanges — the off-chain half of the daily
  anchor. Anyone holding the day's rows can rebuild this root and compare it
  to the DailyAnchorAccount on-chain; a match proves the usage + rating data
  behind an agent's reputation wasn't rewritten after the fact.

  Construction (documented so it stays reproducible):
  - leaf  = sha256("<messageId>\n<contentHashHex>\n<rating>")
  - level = pairs hashed as sha256(left || right); an odd trailing node is
    promoted to the next level unchanged
  - root of a single leaf is the leaf itself
*/

import { createHash } from "node:crypto";

export function sha256(data: string | Buffer): Buffer {
  return createHash("sha256").update(data).digest();
}

export type ExchangeLeaf = {
  messageId: string;
  /** sha256 hex of the stored reply content (text + blocks JSON). */
  contentHash: string;
  /** Buyer thumbs at anchor time: 1, -1, or 0 when unrated. */
  rating: number;
};

export function leafHash(leaf: ExchangeLeaf): Buffer {
  return sha256(`${leaf.messageId}\n${leaf.contentHash}\n${leaf.rating}`);
}

/** Fold leaf hashes into the Merkle root. Throws on an empty set — the
 *  program rejects task_count == 0, so callers skip empty days entirely. */
export function merkleRoot(leaves: Buffer[]): Buffer {
  if (leaves.length === 0) throw new Error("merkleRoot: empty leaf set");
  let level = leaves;
  while (level.length > 1) {
    const next: Buffer[] = [];
    for (let i = 0; i + 1 < level.length; i += 2) {
      next.push(sha256(Buffer.concat([level[i], level[i + 1]])));
    }
    if (level.length % 2 === 1) next.push(level[level.length - 1]);
    level = next;
  }
  return level[0];
}
