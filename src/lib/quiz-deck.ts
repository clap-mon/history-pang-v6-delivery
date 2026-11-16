import { GAME } from "./game-config.ts";
// 🏛️ 역사팡 글로벌 No-Repeat 덱 시스템 (Global No-Repeat Deck Engine)

export type EraDeckState = {
  drawPile: number[];    // 아직 뽑지 않은 템플릿 인덱스들 (Fisher-Yates 셔플)
  discardPile: number[]; // 이미 출제된 템플릿 인덱스들
};

const DECK_STORAGE_KEY = `${GAME.id}-quiz-deck`;

// 🏛️ 각 단계별 총 문제 수. 0인 단계는 앞 단계 문제로 대신 출제한다(quiz-engine의 poolStageFor).
export const ERA_TEMPLATE_COUNTS: Record<number, number> = {
  1: 8, // 빼앗긴 나라와 저항
  2: 8, // 3·1 운동과 독립을 향한 노력
  3: 8, // 일제 통치 시기의 생활
  4: 9, // 광복과 6·25 전쟁
};

// Fisher-Yates 무작위 셔플
export function shuffleArray<T>(array: T[], rng = Math.random): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 특정 시대의 새 덱 생성
export function createNewEraDeck(stageId: number): EraDeckState {
  const count = ERA_TEMPLATE_COUNTS[stageId] ?? 10;
  const indices = Array.from({ length: count }, (_, i) => i);
  return {
    drawPile: shuffleArray(indices),
    discardPile: [],
  };
}

// 덱 상태 로드 (SSR 안전 및 localStorage 연동)
export function loadGlobalDeck(): Record<number, EraDeckState> {
  if (typeof window === "undefined") {
    return {
      1: createNewEraDeck(1),
      2: createNewEraDeck(2),
      3: createNewEraDeck(3),
      4: createNewEraDeck(4),
    };
  }
  try {
    const raw = localStorage.getItem(DECK_STORAGE_KEY);
    if (!raw) {
      const fresh = {
        1: createNewEraDeck(1),
        2: createNewEraDeck(2),
        3: createNewEraDeck(3),
        4: createNewEraDeck(4),
      };
      localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify(fresh));
      return fresh;
    }
    const parsed = JSON.parse(raw);
    [1, 2, 3, 4].forEach((s) => {
      const expectedCount = ERA_TEMPLATE_COUNTS[s];
      const deck = parsed[s];
      if (
        !deck ||
        !Array.isArray(deck.drawPile) ||
        !Array.isArray(deck.discardPile) ||
        deck.drawPile.length + deck.discardPile.length !== expectedCount
      ) {
        parsed[s] = createNewEraDeck(s);
      }
    });
    return parsed;
  } catch {
    return {
      1: createNewEraDeck(1),
      2: createNewEraDeck(2),
      3: createNewEraDeck(3),
      4: createNewEraDeck(4),
    };
  }
}

// 덱 상태 저장
export function saveGlobalDeck(deckMap: Record<number, EraDeckState>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify(deckMap));
  } catch {}
}

// 세션/라운드 캐시 (동일 라운드 렌더링 중 중복 pop 방지)
const roundDrawnCache: Record<string, number> = {};

// 🎯 특정 시대에서 No-Repeat로 다음 템플릿 인덱스를 드로우
export function getOrDrawTemplateIndex(stageId: number, round: number, session: string): number {
  const cacheKey = `${session}-s${stageId}-r${round}`;
  if (typeof roundDrawnCache[cacheKey] === "number") {
    return roundDrawnCache[cacheKey];
  }

  const deckMap = loadGlobalDeck();
  const { deck, drawnIndex } = drawFromDeck(deckMap[stageId] ?? createNewEraDeck(stageId), ERA_TEMPLATE_COUNTS[stageId] ?? 10);

  deckMap[stageId] = deck;
  saveGlobalDeck(deckMap);

  roundDrawnCache[cacheKey] = drawnIndex;
  return drawnIndex;
}

// 덱에서 1장을 뽑는다(저장소와 분리한 순수 함수라 검증 스크립트에서 바로 시험한다).
// 덱을 다 써서 다시 섞을 때, 직전에 나온 문제가 새 덱의 첫 장이 되지 않게 한다.
export function drawFromDeck(current: EraDeckState, count: number, rng = Math.random): { deck: EraDeckState; drawnIndex: number } {
  const deck: EraDeckState = { drawPile: [...current.drawPile], discardPile: [...current.discardPile] };

  if (deck.drawPile.length === 0) {
    const lastDrawn = deck.discardPile[deck.discardPile.length - 1];
    const sourceIndices = deck.discardPile.length > 0 ? deck.discardPile : Array.from({ length: count }, (_, i) => i);
    deck.drawPile = shuffleArray(sourceIndices, rng);
    deck.discardPile = [];
    // 뽑기는 배열 끝에서 하므로, 끝에 직전 문제가 오면 맨 앞과 맞바꾼다.
    const top = deck.drawPile.length - 1;
    if (top > 0 && deck.drawPile[top] === lastDrawn) {
      [deck.drawPile[0], deck.drawPile[top]] = [deck.drawPile[top], deck.drawPile[0]];
    }
  }

  // 비복원 1장 드로우
  const drawnIndex = deck.drawPile.pop()!;
  deck.discardPile.push(drawnIndex);
  return { deck, drawnIndex };
}

// 덱 완전 초기화 (필요 시 호출)
export function resetGlobalDeck(): void {
  if (typeof window === "undefined") return;
  try {
    const fresh = {
      1: createNewEraDeck(1),
      2: createNewEraDeck(2),
      3: createNewEraDeck(3),
      4: createNewEraDeck(4),
    };
    localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify(fresh));
    Object.keys(roundDrawnCache).forEach((k) => delete roundDrawnCache[k]);
  } catch {}
}

