import { redirect } from "next/navigation";

/** No shared login form — role doors live on `/`. */
export default function LoginIndexPage() {
  redirect("/");
}
