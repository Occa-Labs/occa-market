/*
  User data access — the only place the users table is read or written.
  upsertUserByPrivyDid returns the row whether it was just created or already
  existed, refreshing wallet + email from the latest Privy login.
*/

import { eq } from "drizzle-orm";
import { db } from "../../../infra/database/client";
import { users, type UserRow } from "../../../infra/database/schema";

export async function upsertUserByPrivyDid(input: {
  privyDid: string;
  walletAddress: string | null;
  email: string | null;
}): Promise<UserRow> {
  const [row] = await db
    .insert(users)
    .values(input)
    .onConflictDoUpdate({
      target: users.privyDid,
      set: { walletAddress: input.walletAddress, email: input.email },
    })
    .returning();
  return row;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}
