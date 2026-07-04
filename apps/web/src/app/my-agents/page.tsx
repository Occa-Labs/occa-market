import { redirect } from "next/navigation";

// The listing grew into the provider dashboard — keep the old URL working.
export default function MyAgentsPage() {
  redirect("/dashboard");
}
