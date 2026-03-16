import type { PostgrestError } from "@supabase/supabase-js"

export const throwIfError = (error: PostgrestError | null): void => {
  if (error) {
    throw new Error(error.message)
  }
}
