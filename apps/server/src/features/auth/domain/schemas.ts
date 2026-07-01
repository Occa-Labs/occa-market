/* Auth request validation (zod). Pure — no Express, no data access. */

import { z } from "zod";

export const privyLoginBody = z.object({
  accessToken: z.string().min(1, "accessToken is required"),
});

export type PrivyLoginBody = z.infer<typeof privyLoginBody>;
