import { GAME } from "./game-config.ts";
import type { StageId } from "./content";
import type { AdventureDifficulty } from "./game";

export type CharacterId = "bau" | "ara" | "narae";
export type TitleTier = "explorer" | "champion" | "master" | "legend";

export type AdventureTitle = {
  id: string;
  characterId: CharacterId;
  tier: TitleTier;
  name: string;
  condition: string;
  kind: "campaign" | "score";
  badgeColor: string;
  mark: string;
  difficulty?: AdventureDifficulty;
};

export const titleTierDetails: Record<TitleTier, { label: string; mark: string; color: string }> = {
  explorer: { label: "시대 탐험", mark: "🌱", color: "#10b981" },
  champion: { label: "보스 완승", mark: "⚔️", color: "#0284c7" },
  master: { label: "역사 명인", mark: "★", color: "#7c3aed" },
  legend: { label: "전설 수호신", mark: "👑", color: "#d97706" },
};

export const titleDifficultyDetails = {
  easy: titleTierDetails.explorer,
  normal: titleTierDetails.champion,
  hard: titleTierDetails.legend,
} satisfies Record<AdventureDifficulty, { label: string; mark: string; color: string }>;

export const adventureTitles: AdventureTitle[] = [
  // 🛡️ 바우 (용기와 수호의 전사)
  {
    id: "title-bau-easy-1",
    characterId: "bau",
    tier: "explorer",
    name: "의병 고개 지킴이",
    condition: "휴전선의 수호군주 첫 승리",
    kind: "campaign",
    badgeColor: "#10b981",
    mark: "🌱",
    difficulty: "easy",
  },
  {
    id: "title-bau-normal-1",
    characterId: "bau",
    tier: "champion",
    name: "청산리 독립군 용사",
    condition: "휴전선의 수호군주를 한 번 더 이기기",
    kind: "campaign",
    badgeColor: "#0284c7",
    mark: "⚔️",
    difficulty: "normal",
  },
  {
    id: "score-title-bau-normal",
    characterId: "bau",
    tier: "master",
    name: "한국광복군 대원",
    condition: "보스 완승 칭호를 받은 뒤 800점 이상으로 휴전선의 수호군주 승리",
    kind: "score",
    badgeColor: "#7c3aed",
    mark: "★",
    difficulty: "normal",
  },
  {
    id: "title-bau-hard-1",
    characterId: "bau",
    tier: "legend",
    name: "나라를 되찾은 방패",
    condition: "역사 명인 칭호를 받은 뒤 1,000점 이상으로 휴전선의 수호군주 승리",
    kind: "score",
    badgeColor: "#d97706",
    mark: "👑",
    difficulty: "hard",
  },

  // 📜 아라 (지혜와 탐구의 고고학자)
  {
    id: "title-ara-easy-1",
    characterId: "ara",
    tier: "explorer",
    name: "독립 선언서 탐험가",
    condition: "휴전선의 수호군주 첫 승리",
    kind: "campaign",
    badgeColor: "#10b981",
    mark: "🌱",
    difficulty: "easy",
  },
  {
    id: "title-ara-normal-1",
    characterId: "ara",
    tier: "champion",
    name: "우리말 사전 지킴이",
    condition: "휴전선의 수호군주를 한 번 더 이기기",
    kind: "campaign",
    badgeColor: "#0284c7",
    mark: "⚔️",
    difficulty: "normal",
  },
  {
    id: "score-title-ara-normal",
    characterId: "ara",
    tier: "master",
    name: "임시 정부 기록관",
    condition: "보스 완승 칭호를 받은 뒤 800점 이상으로 휴전선의 수호군주 승리",
    kind: "score",
    badgeColor: "#7c3aed",
    mark: "★",
    difficulty: "normal",
  },
  {
    id: "title-ara-hard-1",
    characterId: "ara",
    tier: "legend",
    name: "역사 연구 대학자",
    condition: "역사 명인 칭호를 받은 뒤 1,000점 이상으로 휴전선의 수호군주 승리",
    kind: "score",
    badgeColor: "#d97706",
    mark: "👑",
    difficulty: "hard",
  },

  // ✨ 나래 (조화와 기록의 대현자)
  {
    id: "title-narae-easy-1",
    characterId: "narae",
    tier: "explorer",
    name: "만세 소리 길잡이",
    condition: "휴전선의 수호군주 첫 승리",
    kind: "campaign",
    badgeColor: "#10b981",
    mark: "🌱",
    difficulty: "easy",
  },
  {
    id: "title-narae-normal-1",
    characterId: "narae",
    tier: "champion",
    name: "비밀 연락망 길잡이",
    condition: "휴전선의 수호군주를 한 번 더 이기기",
    kind: "campaign",
    badgeColor: "#0284c7",
    mark: "⚔️",
    difficulty: "normal",
  },
  {
    id: "score-title-narae-normal",
    characterId: "narae",
    tier: "master",
    name: "흥남 기적의 길잡이",
    condition: "보스 완승 칭호를 받은 뒤 800점 이상으로 휴전선의 수호군주 승리",
    kind: "score",
    badgeColor: "#7c3aed",
    mark: "★",
    difficulty: "normal",
  },
  {
    id: "title-narae-hard-1",
    characterId: "narae",
    tier: "legend",
    name: "광복의 빛 전파자",
    condition: "역사 명인 칭호를 받은 뒤 1,000점 이상으로 휴전선의 수호군주 승리",
    kind: "score",
    badgeColor: "#d97706",
    mark: "👑",
    difficulty: "hard",
  },
];

export const scoreTitleThresholds = { easy: 800, normal: 800, hard: 1000 } satisfies Record<AdventureDifficulty, number>;

const titleStorageKey = `${GAME.id}-collected-titles`;

export function getTitleDifficulty(_difficulty?: AdventureDifficulty) {
  return titleTierDetails.champion;
}

// 🏛️ 마지막 보스를 이길 때마다 다음 단계 칭호를 하나만 지급합니다: 시대 탐험 → 보스 완승 → 역사 명인(800점) → 전설 수호신(1,000점)
export function evaluateClearTitles(characterId: CharacterId, score: number, collectedIds: readonly string[]): AdventureTitle[] {
  const order: [TitleTier, boolean][] = [["explorer", true], ["champion", true], ["master", score >= 800], ["legend", score >= 1000]];
  for (const [tier, reached] of order) {
    const title = adventureTitles.find((item) => item.characterId === characterId && item.tier === tier);
    if (!title || collectedIds.includes(title.id)) continue;
    return reached ? [title] : [];
  }
  return [];
}

export function getCampaignClearTitle(characterId: CharacterId, _difficulty?: AdventureDifficulty, _excludedIds?: readonly string[]) {
  const candidates = adventureTitles.filter((title) => title.characterId === characterId && title.tier === "champion");
  return candidates[0] ?? adventureTitles[0];
}

export function getScoreTitle(characterId: CharacterId, _difficulty?: AdventureDifficulty) {
  return adventureTitles.find((title) => title.characterId === characterId && title.tier === "master");
}

export function loadCollectedTitleIds(storage: Storage): string[] {
  try {
    const saved = JSON.parse(storage.getItem(titleStorageKey) ?? "[]") as unknown;
    const validIds = new Set(adventureTitles.map((title) => title.id));
    return Array.isArray(saved) ? [...new Set(saved.filter((id): id is string => typeof id === "string" && validIds.has(id)))] : [];
  } catch {
    return [];
  }
}

export function saveCollectedTitleId(storage: Storage, titleId: string) {
  const next = [...new Set([...loadCollectedTitleIds(storage), titleId])];
  storage.setItem(titleStorageKey, JSON.stringify(next));
  return next;
}

export function clearCollectedTitles(storage: Storage) { storage.removeItem(titleStorageKey); }

const campaignProgressStorageKey = `${GAME.id}-title-campaign-progress`;
export type CampaignProgress = Partial<Record<`${CharacterId}-${AdventureDifficulty}`, StageId[]>>;

export function loadTitleCampaignProgress(storage: Storage): CampaignProgress {
  try {
    const saved = JSON.parse(storage.getItem(campaignProgressStorageKey) ?? "{}") as unknown;
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
    return Object.fromEntries(Object.entries(saved).map(([key, value]) => [key, Array.isArray(value) ? value.filter((id): id is StageId => Number.isInteger(id) && id >= 1 && id <= 5) : []])) as CampaignProgress;
  } catch { return {}; }
}

export function saveTitleCampaignStage(storage: Storage, progress: CampaignProgress, characterId: CharacterId, difficulty: AdventureDifficulty, stageId: StageId) {
  const key = `${characterId}-${difficulty}` as const;
  const next = { ...progress, [key]: [...new Set([...(progress[key] ?? []), stageId])].sort() };
  storage.setItem(campaignProgressStorageKey, JSON.stringify(next));
  return next;
}

export function campaignIsComplete(progress: CampaignProgress, characterId: CharacterId, difficulty: AdventureDifficulty) {
  return (progress[`${characterId}-${difficulty}`] ?? []).length >= 4;
}

export function clearTitleCampaignProgress(storage: Storage) { storage.removeItem(campaignProgressStorageKey); }
