import { supabase } from "../../lib/supabase"
import { throwIfError } from "../../lib/throw-if-error"

export const updateGroupPositions = async (groupId: string): Promise<void> => {
  const { error } = await supabase.rpc("update_group_positions", {
    p_group_id: groupId,
  })

  throwIfError(error)
}
