/* Pure projection from the users row to the public AuthUser wire shape. */

import type { AuthUser } from "@occa-market/shared";
import type { UserRow } from "../../../infra/database/schema";

export function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    privyDid: row.privyDid,
    walletAddress: row.walletAddress,
    email: row.email,
    name: row.name,
  };
}
