import { makePrng } from "./quiz-engine.ts";

export type CardEffect = "physical" | "magic" | "guard" | "magic-ward" | "dodge" | "heal" | "analyze" | "accelerate" | "boost" | "focus-guard" | "risky";
export type CardRole = "attack" | "magic" | "defense" | "dodge" | "heal" | "strategy" | "boost";
export type CombatCard = {
  instanceId: string; key: string; name: string; cost: number; effect: CardEffect; power: number; symbol: string;
  role: CardRole; description: string; exposedBonus?: number; burn?: number; pierce?: number;
};

// 카드 이름과 아이콘은 단원에 맞게 바꾼다(효과·수치는 그대로).
const catalog = [
  { key: "strike", name: "의병의 일격", cost: 1, effect: "physical", power: 6, symbol: "🗡️", role: "attack", description: "물리 피해 6" },
  { key: "jab", name: "독립군 기습 찌르기", cost: 1, effect: "physical", power: 4, symbol: "🔱", role: "attack", description: "물리 피해 4 · 방어 0이면 +3", exposedBonus: 3 },
  { key: "factor-slash", name: "청산리 대첩 베기", cost: 1, effect: "physical", power: 5, symbol: "🌲", role: "attack", description: "물리 피해 5 · 방어 0이면 +4", exposedBonus: 4 },
  { key: "product-rush", name: "봉오동 돌격", cost: 1, effect: "physical", power: 3, symbol: "🐎", role: "attack", description: "물리 피해 3 · 방어 0이면 +5", exposedBonus: 5 },
  { key: "risky-bet", name: "훙커우 공원 승부수", cost: 0, effect: "risky", power: 6, symbol: "🎯", role: "attack", description: "물리 피해 0~6 · 집중력 2~5 소모" },
  { key: "spell", name: "대한 독립 만세", cost: 2, effect: "magic", power: 10, symbol: "📣", role: "magic", description: "마법 피해 10" },
  { key: "spark", name: "독립의 불꽃", cost: 1, effect: "magic", power: 3, symbol: "🔥", role: "magic", description: "마법 피해 3 · 화상 피해 2", burn: 2 },
  { key: "guard", name: "한국광복군 방패", cost: 1, effect: "guard", power: 1, symbol: "🛡️", role: "defense", description: "다음 물리 공격 무효" },
  { key: "focus-shield", name: "임시 정부 청사", cost: 2, effect: "focus-guard", power: 2, symbol: "🏛️", role: "defense", description: "물리 무효 · 집중력 2 회복" },
  { key: "dodge", name: "흥남 철수 작전", cost: 2, effect: "dodge", power: 1, symbol: "🚢", role: "dodge", description: "다음 공격 완전 회피" },
  { key: "heal", name: "피란민 밀면", cost: 1, effect: "heal", power: 5, symbol: "🍜", role: "heal", description: "집중력 5 회복" },
  { key: "analyze", name: "신채호 역사 연구", cost: 1, effect: "analyze", power: 3, symbol: "🔍", role: "strategy", description: "방어·결계 3 약화" },
  { key: "accelerate", name: "천막 학교 공부", cost: 1, effect: "accelerate", power: 2, symbol: "⛺", role: "strategy", description: "오래된 카드 버림 · 2장 뽑기" },
  { key: "chain", name: "한인 애국단 선서", cost: 1, effect: "boost", power: 3, symbol: "✍️", role: "boost", description: "다음 공격 피해 +3" },
  { key: "magic-ward", name: "우리말 사전 지키기", cost: 1, effect: "magic-ward", power: 3, symbol: "📖", role: "defense", description: "다음 마법 피해 3 감소" },
  { key: "armor-pierce", name: "인천 상륙 작전", cost: 1, effect: "physical", power: 5, symbol: "⚓", role: "attack", description: "물리 5 · 방어 2 무시", pierce: 2 },
  { key: "rounding-wave", name: "독립 선언서 낭독", cost: 1, effect: "magic", power: 5, symbol: "📜", role: "magic", description: "마법 피해 5" },
] as const;

type CardTemplate = (typeof catalog)[number];
type DrawOptions = { ensureDirectAttack?: boolean };
const openingGroups: CardRole[][] = [["attack"], ["magic", "strategy"], ["defense", "dodge", "heal", "boost"]];
const roleWeights: Record<CardRole, number> = { attack: 35, magic: 25, defense: 10, dodge: 5, heal: 10, strategy: 10, boost: 5 };
const openingFlexWeights: Record<CardRole, number> = { attack: 60, magic: 15, defense: 6, dodge: 3, heal: 6, strategy: 6, boost: 4 };
const maxAttackCardsInHand = 3;

function copy(template: CardTemplate, drawIndex: number, order: number): CombatCard { return { ...template, instanceId: `${template.key}-${drawIndex}-${order}` }; }
function handCount(hand: CombatCard[], key: string) { return hand.filter((card) => card.key === key).length; }
function roleCount(hand: CombatCard[], role: CardRole) { return hand.filter((card) => card.role === role).length; }
function canAdd(hand: CombatCard[], card: CardTemplate) { return handCount(hand, card.key) < 1 && (card.role !== "attack" || roleCount(hand, "attack") < maxAttackCardsInHand); }
function pick(rng: () => number, candidates: CardTemplate[]) { return candidates[Math.floor(rng() * candidates.length)]!; }
function pickWeightedRole(rng: () => number, candidates: CardTemplate[], weights: Record<CardRole, number>, allowedRoles?: CardRole[]) {
  const roles = [...new Set(candidates.map((card) => card.role))].filter((role) => !allowedRoles || allowedRoles.includes(role));
  const total = roles.reduce((sum, role) => sum + weights[role], 0); let point = rng() * total;
  for (const role of roles) { point -= weights[role]; if (point <= 0) return role; }
  return roles[roles.length - 1]!;
}
function pickCardForRole(rng: () => number, candidates: CardTemplate[], role: CardRole) {
  return pick(rng, candidates.filter((card) => card.role === role));
}
function hasDirectAttack(hand: CombatCard[]) { return hand.some((card) => card.role === "attack" || card.role === "magic"); }
function addDraws(hand: CombatCard[], seed: number, count: number, drawIndex: number, groups: CardRole[][] = [], options: DrawOptions = {}) {
  const rng = makePrng(seed + drawIndex * 7919); const next = [...hand];
  for (let order = 0; order < count; order += 1) {
    const pool = catalog.filter((card) => canAdd(next, card));
    const directAttackSafety = options.ensureDirectAttack && order === 0 && !hasDirectAttack(next);
    const openingRoles = directAttackSafety ? ["attack", "magic"] as CardRole[] : groups[order];
    const weights = order === 3 && groups === openingGroups ? openingFlexWeights : roleWeights;
    const role = pickWeightedRole(rng, pool, weights, openingRoles);
    const card = pickCardForRole(rng, pool, role);
    next.push(copy(card, drawIndex, next.length + order));
  }
  return next;
}

export function drawOpeningHand(seed: number, count = 4, drawIndex = 0) { return addDraws([], seed, count, drawIndex, openingGroups); }
export function drawCards(hand: CombatCard[], seed: number, count: number, drawIndex: number, options?: DrawOptions) { return addDraws(hand, seed, count, drawIndex, [], options); }
export function drawHand(seed: number, count = 4, drawIndex = 0) { return drawOpeningHand(seed, count, drawIndex); }
