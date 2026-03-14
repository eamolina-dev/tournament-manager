import { supabase } from "../../shared/supabase/client"
import { throwIfError } from "../../shared/supabase/throw-if-error"

export const updateGroupPositions = async (groupId: string): Promise<void> => {
  const { error } = await supabase.rpc("update_group_positions", {
    p_group_id: groupId,
  })

  throwIfError(error)
}
