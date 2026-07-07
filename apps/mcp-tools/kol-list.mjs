/*
  Curated Solana smart-account roster for xscan's KOL matching.

  This is OURS — the "who counts as a real caller" list is part of the Ape Check
  moat. xscan does a deterministic membership check (handle in this set → a
  `kol_hit` primitive) and the call-taxonomy skill decides what that weighs.
  Matching here is data; the weighting stays in the skill.

  STARTER LIST — curate and grow this. Seed it with callers whose early entries
  have historically meant something, prune the ones that go quiet or turn into
  paid shills. Handles are compared case-insensitively, with or without a
  leading "@". Ships with the toolbox on every deploy (rsync), so an edit is a
  redeploy, not a DB migration.
*/

export const KOL_HANDLES = [
  "ansem",
  "0xMert_",
  "notthreadguy",
  "blknoiz06",
  "MacnBTC",
  "CryptoKaleo",
  "iamkadense",
  "TheMisterFrog",
  "0xRamonos",
  "MoonshotDev",
];
