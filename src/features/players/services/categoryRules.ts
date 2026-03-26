export const isPlayerCategoryCompatible = ({
  isSuma,
  tournamentCategoryLevel,
  playerCategoryLevel,
}: {
  isSuma: boolean;
  tournamentCategoryLevel: number | null;
  playerCategoryLevel: number | null;
}): boolean => {
  if (isSuma || tournamentCategoryLevel == null) return true;
  if (playerCategoryLevel == null) return false;

  return playerCategoryLevel >= tournamentCategoryLevel;
};

export const isCategoryHigherThanTournament = ({
  tournamentCategoryLevel,
  playerCategoryLevel,
}: {
  tournamentCategoryLevel: number | null;
  playerCategoryLevel: number | null;
}): boolean => {
  if (tournamentCategoryLevel == null || playerCategoryLevel == null) return false;
  return playerCategoryLevel < tournamentCategoryLevel;
};
