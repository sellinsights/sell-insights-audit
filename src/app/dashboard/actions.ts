"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface CreateBrandState {
  error: string | null;
}

export async function createBrand(
  _prevState: CreateBrandState,
  formData: FormData
): Promise<CreateBrandState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Brand name is required." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("brands").insert({ name, created_by: user.id });
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { error: null };
}
