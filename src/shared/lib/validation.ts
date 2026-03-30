export const assertNonEmptyString = (
  value: string | null | undefined,
  message: string,
): void => {
  if (!value?.trim()) {
    throw new Error(message)
  }
}

export const assertPositiveInteger = (
  value: number | null | undefined,
  message: string,
): void => {
  if (value === null || value === undefined || !Number.isInteger(value) || value <= 0) {
    throw new Error(message)
  }
}

export const assertNonNegativeNumber = (
  value: number | null | undefined,
  message: string,
): void => {
  if (value === null || value === undefined || value < 0) {
    throw new Error(message)
  }
}
