import { template_12 } from "./12teams-temp";
import { template_16 } from "./16teams-temp";
import { template_4 } from "./4teams-temp";
import { template_8 } from "./8teams-temp";
import type { MatchTemplate } from "./match-template";

export const templates: Record<number, MatchTemplate[]> = {
  4: template_4,
  8: template_8,
  12: template_12,
  16: template_16,
}
