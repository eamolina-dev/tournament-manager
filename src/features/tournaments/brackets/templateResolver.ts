import type { MatchTemplate } from "./match-template"

type GroupSeedSource = {
  type: "group_seed"
  source: string
}

type WinnerSource = {
  type: "winner"
  matchId: string
}

type TemplateTeamSource = GroupSeedSource | WinnerSource

type BracketTemplateMatch = {
  id: string
  stage: string
  round: number
  order: number
  team1: TemplateTeamSource
  team2: TemplateTeamSource
}

type BracketTemplateFile = {
  id: string
  version: number
  qualifiedCount: number
  groupSizePattern: number[]
  name: string
  description?: string
  matches: BracketTemplateMatch[]
  qualifiedSources?: string[]
}

type JsonModule<T> = {
  default: T
}

type ResolveBracketTemplateOptions = {
  qualifiedTeamSources: string[]
  groupSizePattern: number[]
}

const SUPPORTED_MIN_QUALIFIED_TEAMS = 8
const SUPPORTED_MAX_QUALIFIED_TEAMS = 16

const templateModules = import.meta.glob<unknown>("./templates/qualified-*.json", {
  eager: true,
})

const unwrapJsonModule = <T>(module: unknown): T => {
  if (typeof module === "object" && module !== null && "default" in module) {
    return (module as JsonModule<T>).default
  }

  return module as T
}

const templates = Object.values(templateModules).map((module) =>
  unwrapJsonModule<BracketTemplateFile>(module)
)

const normalizeSource = (source: string): string => source.trim().toUpperCase()

const buildPatternKey = (groupSizePattern: number[]): string =>
  groupSizePattern.join("-")

const assertSupportedQualifiedCount = (qualifiedCount: number): void => {
  if (
    qualifiedCount < SUPPORTED_MIN_QUALIFIED_TEAMS ||
    qualifiedCount > SUPPORTED_MAX_QUALIFIED_TEAMS
  ) {
    throw new Error(
      `Solo se soportan cruces con entre ${SUPPORTED_MIN_QUALIFIED_TEAMS} y ${SUPPORTED_MAX_QUALIFIED_TEAMS} clasificados. Esta configuración tiene ${qualifiedCount}.`
    )
  }
}

const findMatchingTemplate = ({
  qualifiedTeamSources,
  groupSizePattern,
}: ResolveBracketTemplateOptions): BracketTemplateFile => {
  const qualifiedCount = qualifiedTeamSources.length
  assertSupportedQualifiedCount(qualifiedCount)

  const patternKey = buildPatternKey(groupSizePattern)
  const template = templates.find(
    (item) =>
      item.qualifiedCount === qualifiedCount &&
      buildPatternKey(item.groupSizePattern) === patternKey
  )

  if (!template) {
    throw new Error(
      `Todavía no hay una plantilla de cruces para ${qualifiedCount} clasificados con zonas ${patternKey}.`
    )
  }

  return template
}

const assertTemplateUsesQualifiedSources = (
  template: BracketTemplateFile,
  qualifiedTeamSources: string[]
): void => {
  const expectedSources = new Set(qualifiedTeamSources.map(normalizeSource))
  const templateSources = template.matches
    .flatMap((match) => [match.team1, match.team2])
    .filter((source): source is GroupSeedSource => source.type === "group_seed")
    .map((source) => normalizeSource(source.source))

  const uniqueTemplateSources = new Set(templateSources)
  const missingSources = [...expectedSources].filter(
    (source) => !uniqueTemplateSources.has(source)
  )
  const extraSources = [...uniqueTemplateSources].filter(
    (source) => !expectedSources.has(source)
  )

  if (templateSources.length !== uniqueTemplateSources.size) {
    throw new Error(
      `La plantilla ${template.id} tiene clasificados repetidos en los cruces.`
    )
  }

  if (missingSources.length || extraSources.length) {
    throw new Error(
      `La plantilla ${template.id} no coincide con los clasificados esperados.`
    )
  }
}

const resolveTeamSource = (
  source: TemplateTeamSource,
  matchByTemplateId: Map<string, BracketTemplateMatch>
): string => {
  if (source.type === "group_seed") return normalizeSource(source.source)

  const referencedMatch = matchByTemplateId.get(source.matchId)
  if (!referencedMatch) {
    throw new Error(`La plantilla referencia un partido inexistente: ${source.matchId}.`)
  }

  return `W-${referencedMatch.order}-${referencedMatch.round}`
}

export const resolveBracketTemplate = ({
  qualifiedTeamSources,
  groupSizePattern,
}: ResolveBracketTemplateOptions): MatchTemplate[] => {
  const template = findMatchingTemplate({ qualifiedTeamSources, groupSizePattern })
  assertTemplateUsesQualifiedSources(template, qualifiedTeamSources)

  const matchByTemplateId = new Map(
    template.matches.map((match) => [match.id, match])
  )

  return template.matches.map((match, index) => ({
    matchNumber: index + 1,
    round: match.round,
    order: match.order,
    stage: match.stage,
    team1: resolveTeamSource(match.team1, matchByTemplateId),
    team2: resolveTeamSource(match.team2, matchByTemplateId),
  }))
}
