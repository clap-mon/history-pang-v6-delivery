import type { StageId, BossPhase } from "./content.ts";
import { getOrDrawTemplateIndex } from "./quiz-deck.ts";

export type Difficulty = "EASY" | "NORMAL" | "HARD";
export type QuizOption = {
  id: string;
  text: string;
  symbol?: string;
  symbols?: string[];
  equation?: { leftIcon: string; rightIcons: string[] };
  isCorrect: boolean;
  isLucky: boolean;
  isBomb: boolean;
  explanation: string;
  misconception?: string;
};

export type ReferenceNote = {
  tag?: string;
  label: string;
  desc: string;
  symbol: string;
  images?: { src: string; label: string }[];
  source?: string;
};

export type Quiz = {
  id: string;
  stageId: StageId;
  prompt: string;
  diagram?: string;
  diagramTitle?: string;
  referenceNote?: ReferenceNote;
  difficulty: Difficulty;
  options: QuizOption[];
};

export function parseEquationOption(_text: string): { leftIcon: string; rightIcons: string[] } | null {
  return null;
}
export function getSymbolsForText(_text: string): string[] {
  return [];
}
export function getSymbolForText(_text: string): string | undefined {
  return undefined;
}

// 문제 화면의 참고 그림은 두지 않는다.
export function getDiagramForStage(_stageId: StageId, _prompt: string): { src: string; title: string } | undefined {
  return undefined;
}

export function makePrng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
}

export function seedForQuiz(stageId: StageId | number, round: number, session = "history-v4"): number {
  let hash = 2166136261;
  for (const char of `${session}:${stageId}:${round}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

function int(rng: () => number, min: number, max: number) {
  return Math.floor(rng() * (max - min + 1)) + min;
}
function pick<T>(rng: () => number, values: T[]): T {
  return values[int(rng, 0, values.length - 1)];
}
function shuffle<T>(rng: () => number, values: T[]): T[] {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = int(rng, 0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function finalize(
  stageId: StageId,
  round: number,
  prompt: string,
  difficulty: Difficulty,
  rows: (Omit<QuizOption, "id" | "isLucky" | "isBomb"> & { symbol?: string })[],
  rng: () => number,
  referenceNote?: ReferenceNote,
): Quiz {
  if (rows.length !== 5 || rows.filter((row) => row.isCorrect).length !== 3 || new Set(rows.map((row) => row.text)).size !== 5) {
    throw new Error("퀴즈는 서로 다른 보기 5개와 정답 3개로 구성해야 합니다.");
  }
  const correct = rows.filter((row) => row.isCorrect);
  const wrong = rows.filter((row) => !row.isCorrect);
  const luckyText = pick(rng, correct).text;
  const bombText = pick(rng, wrong).text;
  const options = rows.map((row, index) => {
    return {
      ...row,
      id: `s${stageId}-r${round}-o${index}`,
      symbol: row.symbol,
      symbols: row.symbol ? [row.symbol] : [],
      isLucky: row.text === luckyText,
      isBomb: row.text === bombText,
    };
  });
  const diagramInfo = getDiagramForStage(stageId, prompt);
  return {
    id: `stage-${stageId}-round-${round}`,
    stageId,
    prompt,
    diagram: diagramInfo?.src,
    diagramTitle: diagramInfo?.title,
    referenceNote,
    difficulty,
    options,
  };
}

// 🏛️ 역사 퀴즈 템플릿 인터페이스
type RawQuizTemplate = {
  prompt: string;
  difficulty: Difficulty;
  correctPool: { text: string; explanation: string; symbol?: string }[];
  wrongPool: { text: string; explanation: string; misconception?: string; symbol?: string }[];
  referenceNote?: ReferenceNote;
};

const right = (text: string, explanation: string, symbol = "✅") => ({ text, explanation, symbol });
const wrong = (text: string, explanation: string) => ({ text, explanation, symbol: "❌" });

// 문제 작성 규칙
// - 정답과 오답 모두 이 단원(교과서 범위) 안의 내용으로만 쓴다.
// - 해설에는 교과서 쪽수를 적지 않는다.

// ==========================================
// 1단계 문제 은행: 빼앗긴 나라와 저항
// 템플릿 하나 = 질문 1개 + 정답 후보 3~4개 + 오답 후보 2~3개. 출제할 때 정답 3개, 오답 2개를 뽑는다.
// ==========================================
const stage1Templates: RawQuizTemplate[] = [
  {
    prompt: "을사늑약에 대한 설명으로 옳은 것을 고르세요.",
    difficulty: "EASY",
    correctPool: [
      right("대한 제국의 외교권을 빼앗아 간 조약이다", "이 조약 뒤로 대한 제국은 일본을 거치지 않고는 다른 나라와 조약을 맺을 수 없었어요.", "📜"),
      right("고종이 동의하지 않았는데도 맺어졌다", "황제의 허락 없이 억지로 맺은 조약이에요.", "👑"),
      right("'늑약'은 억지로 맺은 조약이라는 뜻이다", "이름 속 '늑약'에 강제로 맺었다는 뜻이 담겨 있어요.", "✍️"),
      right("러시아와의 전쟁에서 이긴 일제가 밀어붙였다", "러시아를 이긴 일제가 본격적으로 침략하며 맺은 조약이에요.", "⚓"),
    ],
    wrongPool: [
      wrong("대한 제국이 원해서 맺은 조약이다", "고종은 동의하지 않았어요. 억지로 맺은 조약이에요."),
      wrong("헤이그 평화 회의에서 무효로 인정받았다", "특사들은 일제의 방해로 뜻을 이루지 못했어요."),
      wrong("6·25 전쟁을 멈추려고 맺은 약속이다", "전쟁을 멈춘 약속은 1953년의 정전 협정이에요."),
    ],
  },
  {
    prompt: "을사늑약 소식이 알려진 뒤 사람들이 맞선 모습으로 알맞은 것을 고르세요.",
    difficulty: "EASY",
    correctPool: [
      right("상인들이 가게 문을 닫았다", "상인들은 상점 문을 닫아 반대하는 뜻을 보였어요.", "🏪"),
      right("학생들이 등교를 거부했다", "학생들은 학교에 가지 않는 것으로 맞섰어요.", "🎒"),
      right("곳곳에서 의병이 일어났다", "전국 여러 곳에서 의병들이 일어나 맞섰어요.", "⚔️"),
      right("고종이 특사를 보내 조약이 무효라고 알리려 했다", "고종은 네덜란드 헤이그의 평화 회의에 특사를 보냈어요.", "✉️"),
    ],
    wrongPool: [
      wrong("학생들이 천막 학교를 세웠다", "천막 학교는 6·25 전쟁 중 피란지에서 세운 학교예요."),
      wrong("5·10 총선거에 참여했다", "5·10 총선거는 광복 뒤인 1948년에 치러졌어요."),
      wrong("물산 장려 운동을 벌였다", "물산 장려 운동은 3·1 운동 뒤에 일어난 운동이에요."),
    ],
  },
  {
    prompt: "의병 운동에 대한 설명으로 옳은 것을 고르세요.",
    difficulty: "NORMAL",
    correctPool: [
      right("군대가 해산된 뒤 군인들이 합류해 더 활발해졌다", "해산된 대한 제국 군인들이 의병에 들어가 의병 운동이 커졌어요.", "🪖"),
      right("일제가 큰 부대를 보내 탄압했다", "일제는 대규모 부대를 동원해 의병을 눌렀어요.", "🛡️"),
      right("남은 의병들은 만주와 연해주로 건너가 싸웠다", "나라 안 활동이 어려워지자 나라 밖으로 옮겨 싸움을 이어 갔어요.", "🧭"),
    ],
    wrongPool: [
      wrong("일제의 헌병들이 앞장서서 이끈 군대였다", "헌병은 일제가 한국인을 감시하는 데 쓴 군인이에요. 의병은 백성이 스스로 일어난 것이에요."),
      wrong("대한민국 임시 정부가 상하이에서 만든 군대였다", "임시 정부가 만든 군대는 한국광복군이에요."),
      wrong("을사늑약에 찬성하는 사람들이 일으킨 운동이었다", "의병은 을사늑약과 일제의 침략에 맞서 일어났어요."),
    ],
  },
  {
    prompt: "안중근에 대한 설명으로 옳은 것을 고르세요.",
    difficulty: "NORMAL",
    correctPool: [
      right("연해주에서 의병으로 활동했다", "안중근은 연해주에서 의병 활동을 했어요.", "🧭"),
      right("만주의 기차역에서 침략에 앞장선 인물을 처단했다", "만주 하얼빈역에서 이토 히로부미를 처단했어요.", "🚉"),
      right("이토 히로부미를 처단한 독립운동가다", "우리나라 침략에 앞장선 이토 히로부미를 처단했어요.", "🎯"),
    ],
    wrongPool: [
      wrong("독립군을 기르려고 만주에 학교를 세웠다", "신흥 강습소를 세운 사람은 이회영이에요."),
      wrong("민족의 실력을 키우려고 미국에서 단체를 만들었다", "미국에서 흥사단을 만든 사람은 안창호예요."),
      wrong("한인 애국단을 조직했다", "한인 애국단을 만든 사람은 김구예요."),
    ],
  },
  {
    prompt: "나라를 빼앗긴 뒤 일제가 우리 민족을 다스린 모습으로 옳은 것을 고르세요.",
    difficulty: "EASY",
    correctPool: [
      right("조선 총독부를 설치했다", "일제는 조선 총독부를 두고 우리 민족을 다스렸어요.", "🏛️"),
      right("군인 출신을 총독으로 앉혔다", "군인 출신 총독이 강압적으로 통치했어요.", "🎖️"),
      right("헌병에게 경찰 일을 맡겼다", "헌병이 한국인을 감시하고 독립운동을 탄압했어요.", "👮"),
      right("교사에게도 제복을 입고 칼을 차게 했다", "관리와 교사까지 칼을 차게 해 두려운 분위기를 만들었어요.", "🗡️"),
    ],
    wrongPool: [
      wrong("학생에게 우리 역사를 마음껏 가르쳤다", "일제는 오히려 우리 역사를 제대로 배우지 못하게 했어요."),
      wrong("관리를 국민 선거로 뽑게 했다", "일제의 통치는 강압적이었고, 국민이 선거로 대표를 뽑은 것은 광복 뒤의 일이에요."),
    ],
  },
  {
    prompt: "토지 조사 사업에 대한 설명으로 옳은 것을 고르세요.",
    difficulty: "NORMAL",
    correctPool: [
      right("땅 주인을 확인한다는 구실로 시행되었다", "일제는 토지의 주인을 확인한다며 전국에서 이 사업을 벌였어요.", "📏"),
      right("많은 농민이 농사지을 땅을 잃었다", "이 사업으로 땅을 잃는 농민이 많았어요.", "🌾"),
      right("남의 땅을 빌려 농사짓는 농민이 늘어났다", "땅을 빌려 농사짓는 농민의 비율이 점점 높아졌어요.", "📈"),
      right("농민들이 불리한 조건으로 계약해야 했다", "땅을 빌리려면 불리한 조건을 받아들여야 했어요.", "📄"),
    ],
    wrongPool: [
      wrong("우리나라 농민의 땅이 크게 늘어났다", "반대로 많은 농민이 땅을 잃었어요."),
      wrong("토산품을 아껴 쓰자는 경제 운동이었다", "토산품을 쓰자는 것은 물산 장려 운동이에요."),
    ],
  },
  {
    prompt: "나라 밖에서 독립운동을 이어 간 모습으로 옳은 것을 고르세요.",
    difficulty: "NORMAL",
    correctPool: [
      right("이회영은 신흥 강습소에서 독립군을 길렀다", "신흥 강습소는 뒷날 신흥 무관 학교로 불렸어요.", "🏫"),
      right("안창호는 흥사단으로 민족의 실력을 키웠다", "안창호는 미국에서 흥사단을 만들었어요.", "📘"),
      right("이회영 가족은 재산을 팔고 압록강을 건넜다", "가진 것을 모두 팔아 만주로 떠나 독립운동을 도왔어요.", "🧳"),
      right("독립운동가들은 나라 밖에 학교와 단체를 만들었다", "일제의 감시를 피해 나라 밖에서 독립운동을 이어 갔어요.", "🌏"),
    ],
    wrongPool: [
      wrong("나라 밖 독립운동가들은 넉넉하게 살았다", "끼니를 거를 만큼 힘들게 살면서도 독립을 위해 애썼어요."),
      wrong("안창호는 하얼빈역에서 의거를 일으켰다", "하얼빈역에서 이토 히로부미를 처단한 사람은 안중근이에요."),
    ],
  },
  {
    prompt: "헤이그 특사에 대한 설명으로 옳은 것을 고르세요.",
    difficulty: "HARD",
    correctPool: [
      right("고종이 네덜란드로 보낸 사람들이다", "고종은 네덜란드 헤이그의 평화 회의에 특사를 보냈어요.", "🇳🇱"),
      right("을사늑약이 무효라는 것을 세계에 알리려 했다", "억지로 맺은 조약이라 무효라는 것을 국제 사회에 알리려 했어요.", "📣"),
      right("일제의 방해로 뜻을 이루지 못했다", "일제가 방해해 특사들의 노력은 실패했어요.", "🚧"),
    ],
    wrongPool: [
      wrong("평화 회의에서 을사늑약을 없애는 데 성공했다", "일제의 방해로 실패했어요."),
      wrong("상하이에 임시 정부를 세웠다", "대한민국 임시 정부는 3·1 운동 뒤인 1919년에 세워졌어요."),
    ],
  },
];

// ==========================================
// 2단계 문제 은행: 3·1 운동과 독립을 향한 노력
// ==========================================
const stage2Templates: RawQuizTemplate[] = [
  {
    prompt: "3·1 운동에 대한 설명으로 옳은 것을 고르세요.",
    difficulty: "EASY",
    correctPool: [
      right("1919년 3월 1일에 시작되었다", "1919년 3월 1일 서울에서 시작되었어요.", "📅"),
      right("민족 대표들이 독립 선언서를 발표했다", "민족 대표들이 서울에서 독립 선언서를 발표했어요.", "📜"),
      right("탑골 공원에 모인 학생과 시민이 만세를 외쳤다", "수천 명의 학생과 시민이 선언서를 읽고 만세 시위를 벌였어요.", "🙌"),
      right("전국으로 퍼져 석 달 넘게 이어졌다", "만세 시위는 나라 곳곳으로 번져 오래 이어졌어요.", "🗺️"),
    ],
    wrongPool: [
      wrong("순종의 장례식 날에 일어났다", "순종의 장례식 날 일어난 것은 6·10 만세 운동이에요."),
      wrong("일제가 시위를 평화롭게 지켜보았다", "일제는 시위를 폭력적으로 진압했어요."),
      wrong("광주에서 한일 학생 충돌로 시작되었다", "그것은 광주 학생 항일 운동이에요."),
    ],
  },
  {
    prompt: "유관순에 대한 설명으로 옳은 것을 고르세요.",
    difficulty: "EASY",
    correctPool: [
      right("이화 학당에 다니던 학생이었다", "유관순은 이화 학당 학생이었어요.", "🎒"),
      right("고향 천안에 내려가 만세 시위를 이끌었다", "서울에서 만세 시위가 일어나자 고향으로 가 시위를 이끌었어요.", "🙌"),
      right("붙잡혀 감옥에서 순국했다", "체포된 뒤 감옥에서 목숨을 잃었어요.", "🕯️"),
    ],
    wrongPool: [
      wrong("청산리에서 독립군을 이끌었다", "청산리에서 독립군 연합 부대를 이끈 사람은 김좌진과 홍범도예요."),
      wrong("도쿄에서 일본 왕이 탄 마차에 폭탄을 던졌다", "그 일을 한 사람은 한인 애국단의 이봉창이에요."),
    ],
  },
  {
    prompt: "대한민국 임시 정부에 대한 설명으로 옳은 것을 고르세요.",
    difficulty: "NORMAL",
    correctPool: [
      right("1919년 9월 중국 상하이에 세워졌다", "3·1 운동 뒤 1919년 9월에 상하이에 세워졌어요.", "🏛️"),
      right("여러 곳의 임시 정부를 하나로 합쳤다", "힘을 하나로 모으려고 여러 임시 정부를 통합했어요.", "🤝"),
      right("비밀 연락망으로 독립운동을 지휘했다", "비밀 연락망을 통해 독립운동을 이끌고 자금을 모았어요.", "📡"),
      right("외교 활동으로 독립 의지를 알렸다", "국제 사회에 독립의 의지와 필요성을 알렸어요.", "🌏"),
    ],
    wrongPool: [
      wrong("조선 총독부 건물 안에 세워졌다", "조선 총독부는 일제의 통치 기관이에요."),
      wrong("일제와 함께 나라를 다스렸다", "임시 정부는 일제에 맞서 독립운동을 이끌었어요."),
    ],
  },
  {
    prompt: "대한민국 임시 정부가 상하이에 자리 잡은 까닭으로 알맞은 것을 고르세요.",
    difficulty: "HARD",
    correctPool: [
      right("여러 나라의 외교 기관이 모여 있었다", "각 나라의 외교 기관이 모여 있어 활동하기 좋았어요.", "🏢"),
      right("외교 활동을 펼치기에 유리했다", "세계에 독립 의지를 알리기 좋은 곳이었어요.", "📣"),
      right("일제의 탄압을 피하기 좋았다", "일제의 손길에서 비교적 벗어날 수 있었어요.", "🛡️"),
    ],
    wrongPool: [
      wrong("일본 왕이 사는 곳과 가까웠다", "일본 왕이 사는 도쿄와는 관계가 없어요."),
      wrong("38도선 남쪽에 있었다", "38도선은 광복 무렵의 일이고, 상하이는 중국에 있어요."),
    ],
  },
  {
    prompt: "한인 애국단에 대한 설명으로 옳은 것을 고르세요.",
    difficulty: "NORMAL",
    correctPool: [
      right("김구가 만든 독립운동 단체다", "임시 정부의 활동이 어려워지자 김구가 만들었어요.", "🔥"),
      right("이봉창은 도쿄에서 의거를 일으켰다", "이봉창은 도쿄에서 일본 왕이 탄 마차에 폭탄을 던졌어요.", "💥"),
      right("윤봉길은 훙커우 공원 의거를 일으켰다", "상하이 점령을 기념하는 행사장에 폭탄을 던져 일본군에 큰 타격을 주었어요.", "🎯"),
      right("일제의 주요 인물을 처단하려 했다", "단원들은 일제의 주요 인물을 처단하려 했어요.", "⚡"),
    ],
    wrongPool: [
      wrong("우리말 사전을 만들려고 애썼다", "우리말 사전을 만들려 한 단체는 조선어 학회예요."),
      wrong("미국에서 민족의 실력을 키웠다", "미국에서 활동한 단체는 안창호의 흥사단이에요."),
      wrong("청산리에서 일본군과 싸워 이겼다", "청산리에서 이긴 것은 김좌진과 홍범도의 독립군 연합 부대예요."),
    ],
  },
  {
    prompt: "3·1 운동 뒤 나라 안에서 우리 힘을 기르려 한 노력을 고르세요.",
    difficulty: "NORMAL",
    correctPool: [
      right("물산 장려 운동", "토산품을 쓰고 아껴 경제적으로 독립하자는 운동이에요.", "🧵"),
      right("농촌 계몽 운동", "학생들이 농촌에서 한글을 가르치고 생활이 나아지도록 도왔어요.", "📖"),
      right("조선어 학회의 사전 편찬 노력", "조선어 학회는 한글을 연구하며 우리말 사전을 펴내려 했어요.", "🔤"),
    ],
    wrongPool: [
      wrong("토지 조사 사업", "토지 조사 사업은 일제가 벌인 사업이에요."),
      wrong("흥남 철수 작전", "흥남 철수 작전은 6·25 전쟁 중의 일이에요."),
      wrong("헤이그 특사 파견", "헤이그 특사는 3·1 운동보다 훨씬 앞선 을사늑약 뒤의 일이에요."),
    ],
  },
  {
    prompt: "6·10 만세 운동과 광주 학생 항일 운동의 공통점으로 알맞은 것을 고르세요.",
    difficulty: "HARD",
    correctPool: [
      right("학생들이 중심이 되어 일어났다", "두 운동 모두 학생들이 앞장섰어요.", "🎒"),
      right("일제의 식민 통치에 맞섰다", "두 운동 모두 일제에 맞선 독립운동이에요.", "✊"),
      right("다른 지역 학생들도 함께했다", "소식을 들은 여러 지역 학생들이 함께 참여했어요.", "🗺️"),
    ],
    wrongPool: [
      wrong("만주에서 일본군과 싸운 전투였다", "만주에서 일본군과 싸운 것은 봉오동·청산리 전투예요."),
      wrong("을사늑약 소식을 듣고 일어났다", "을사늑약에 맞선 것은 의병 운동과 상인·학생들의 반발이에요."),
    ],
  },
  {
    prompt: "봉오동 전투와 청산리 전투에 대한 설명으로 옳은 것을 고르세요.",
    difficulty: "NORMAL",
    correctPool: [
      right("홍범도의 독립군이 봉오동에서 이겼다", "홍범도를 중심으로 한 독립군 부대가 일본군을 물리쳤어요.", "🏔️"),
      right("김좌진·홍범도 연합 부대가 청산리에서 이겼다", "독립군 연합 부대가 청산리 일대에서 승리했어요.", "🌲"),
      right("나라 밖에서 일본군과 싸운 무장 투쟁이다", "만주와 연해주를 중심으로 무기를 들고 일본군과 싸웠어요.", "🧭"),
      right("독립군은 굶주림 속에서도 싸웠다", "감자 몇 덩이로 버티며 싸웠다는 기록이 남아 있어요.", "🥔"),
    ],
    wrongPool: [
      wrong("국군과 국제 연합군이 함께 일본군과 싸웠다", "국제 연합군은 6·25 전쟁 때 참전했어요."),
      wrong("서울 탑골 공원 앞에서 벌어진 전투였다", "탑골 공원은 3·1 운동 때 만세를 외친 곳이에요."),
    ],
  },
];

// ==========================================
// 3단계 문제 은행: 일제 통치 시기의 생활
// ==========================================
const stage3Templates: RawQuizTemplate[] = [
  {
    prompt: "일제가 놓은 철도에 대한 설명으로 옳은 것을 고르세요.",
    difficulty: "EASY",
    correctPool: [
      right("사람과 물자가 더 빨리 오가게 되었다", "철도로 이동이 빨라졌어요.", "🚂"),
      right("군대를 빠르게 옮기는 데 쓰였다", "일제는 철도로 군대를 신속하게 옮겼어요.", "🪖"),
      right("빼앗은 자원을 일본으로 실어 날랐다", "철도는 우리 자원을 일본으로 가져가는 데 주로 쓰였어요.", "📦"),
      right("건설에 한국인이 강제로 동원되었다", "일제는 철도를 놓을 때 한국인을 강제로 데려다 일을 시켰어요.", "⛓️"),
    ],
    wrongPool: [
      wrong("한국인의 생활을 돕는 데만 쓰였다", "철도는 주로 일제의 통치와 수탈에 쓰였어요."),
      wrong("6·25 전쟁이 끝난 뒤 처음 놓였다", "경부선은 이미 1905년에 개통되었어요."),
    ],
  },
  {
    prompt: "임피역에 대한 설명으로 옳은 것을 고르세요.",
    difficulty: "NORMAL",
    correctPool: [
      right("군산 쪽 철도에 지은 작은 역이다", "일제가 군산 쪽으로 철도를 놓으며 지은 간이역이에요.", "🚉"),
      right("남부 평야의 쌀을 일본으로 보냈다", "군산은 바다와 가까워 쌀을 일본으로 보내기 편했어요.", "🌾"),
      right("역 주변 길이 일본인 농장과 이어졌다", "역 주변 길은 쌀을 빼앗아 가는 통로가 되었어요.", "🛤️"),
      right("지금도 그때 건물이 남아 있다", "건물만 남아 아픈 역사를 전해 주고 있어요.", "🏚️"),
    ],
    wrongPool: [
      wrong("피란민이 모여든 임시 수도의 역이다", "6·25 전쟁 때 임시 수도는 부산이에요."),
      wrong("독립군을 길러 내던 학교였다", "독립군을 기른 곳은 이회영이 세운 신흥 강습소예요."),
    ],
  },
  {
    prompt: "일제 통치 시기 도시의 모습으로 옳은 것을 고르세요.",
    difficulty: "NORMAL",
    correctPool: [
      right("철도역과 항구를 중심으로 도시가 커졌다", "철도역과 항구 주변에 여러 도시가 발달했어요.", "🏙️"),
      right("대도시에 근대적인 고층 건물이 세워졌다", "서울 같은 대도시에 높은 건물이 들어섰어요.", "🏢"),
      right("일본인과 한국인이 사는 곳이 나뉘어 있었다", "충무로 일대와 청계천 일대처럼 사는 곳이 달랐어요.", "↔️"),
      right("한국인이 많이 살던 곳은 공동 우물을 썼다", "근대 문물의 혜택을 제대로 누리지 못했어요.", "🪣"),
    ],
    wrongPool: [
      wrong("모든 동네에 전기가 고르게 들어왔다", "한국인이 주로 살던 곳은 전기가 잘 들어오지 않았어요."),
      wrong("청계천 일대에 은행과 백화점이 모여 있었다", "은행과 백화점은 일본인이 모여 살던 충무로 일대에 들어섰어요."),
    ],
  },
  {
    prompt: "일제 통치 시기에 볼 수 있었던 생활 모습을 고르세요.",
    difficulty: "EASY",
    correctPool: [
      right("인공 조미료로 국물 맛을 내는 식당", "일본에서 만든 인공 조미료가 이때 처음 들어왔어요.", "🍜"),
      right("자전거로 냉면을 배달하는 사람", "여름이면 냉면 주문 전화가 많아 자전거로 배달했어요.", "🚲"),
      right("도시 변두리의 토막집", "가난한 사람들은 변두리에 토막집을 짓고 살았어요.", "🛖"),
      right("백화점이 들어선 거리", "서울에는 미쓰코시 백화점 같은 큰 상점이 생겼어요.", "🏬"),
    ],
    wrongPool: [
      wrong("피란민 학생들의 천막 교실", "천막 학교는 6·25 전쟁 중의 모습이에요."),
      wrong("부산의 밀면집", "밀면은 6·25 전쟁 때 피란민이 만든 음식이에요."),
      wrong("5·10 총선거 투표소", "5·10 총선거는 광복 뒤인 1948년에 치러졌어요."),
    ],
  },
  {
    prompt: "일제가 우리 민족정신을 없애려고 한 일을 고르세요.",
    difficulty: "EASY",
    correctPool: [
      right("신사에 억지로 절을 하게 했다", "전국에 신사를 세우고 강제로 절하게 했어요.", "⛩️"),
      right("성과 이름을 일본식으로 고치게 했다", "일본식 성과 이름을 쓰도록 강요했어요.", "🏷️"),
      right("일본어를 쓰라고 강요했다", "우리말 대신 일본어를 쓰게 했어요.", "🗣️"),
      right("학교에서 우리 역사를 가르치지 않았다", "학교에서 우리말과 역사를 배우지 못하게 했어요.", "🚫"),
    ],
    wrongPool: [
      wrong("한글 신문을 마음껏 펴내게 했다", "일제는 한글 신문과 잡지를 강제로 없앴어요."),
      wrong("우리말 사전을 만들도록 도왔다", "우리말 사전은 조선어 학회가 일제 아래에서 어렵게 만들려 했어요."),
    ],
  },
  {
    prompt: "일제가 침략 전쟁을 벌이며 우리나라에서 한 일로 옳은 것을 고르세요.",
    difficulty: "NORMAL",
    correctPool: [
      right("전쟁에 필요한 사람을 강제로 끌고 갔다", "일제는 전쟁에 필요한 사람을 강제로 동원했어요.", "⛓️"),
      right("집에서 쓰던 금속 그릇까지 빼앗았다", "무기를 만든다며 놋그릇과 수저까지 가져갔어요.", "🥣"),
      right("학생들에게 목검으로 군사 훈련을 시켰다", "학교에서 학생들에게 군사 훈련을 시켰어요.", "🪵"),
      right("여성들에게 몸뻬를 입도록 강요했다", "물자 절약과 노동을 내세워 치마 대신 입게 했어요.", "👖"),
    ],
    wrongPool: [
      wrong("우리 민족의 독립을 약속했다", "일제는 오히려 우리 민족을 전쟁에 끌어들였어요."),
      wrong("전쟁 물자를 우리나라에 나누어 주었다", "일제는 반대로 우리나라에서 물자를 빼앗아 갔어요."),
    ],
  },
  {
    prompt: "신채호와 한국광복군에 대한 설명으로 옳은 것을 고르세요.",
    difficulty: "HARD",
    correctPool: [
      right("신채호는 고대 국가의 역사를 연구했다", "고대 국가의 역사를 살펴 우리나라가 스스로 발전해 왔다고 밝혔어요.", "📚"),
      right("신채호는 일제의 역사 왜곡에 맞섰다", "역사 연구로 일제의 거짓 역사에 맞섰어요.", "🛡️"),
      right("한국광복군은 대한민국 임시 정부가 만들었다", "임시 정부가 만든 군대예요.", "🎖️"),
      right("한국광복군은 미군과 함께 국내 진입 작전을 세웠다", "미군과 협력해 국내로 들어올 계획을 세웠어요.", "🤝"),
    ],
    wrongPool: [
      wrong("한국광복군은 국내로 들어와 일본군을 몰아냈다", "일제가 먼저 항복해 작전을 펼치지 못했어요."),
      wrong("신채호는 조선 총독부에서 일했다", "신채호는 역사 연구로 일제에 맞선 사람이에요."),
    ],
  },
  {
    prompt: "일제 통치 시기의 학교에 대한 설명으로 알맞은 것을 고르세요.",
    difficulty: "NORMAL",
    correctPool: [
      right("보통학교는 일제가 초등 교육을 하려고 만들었다", "일제가 우리나라 사람에게 초등 교육을 하려고 세운 학교예요.", "🏫"),
      right("선생님이 제복을 입고 칼을 차기도 했다", "교사까지 칼을 차게 해 두려운 분위기를 만들었어요.", "🗡️"),
      right("침략 전쟁을 좋은 일처럼 꾸며 가르쳤다", "전쟁을 세계 평화를 위한 것이라고 꾸며 가르쳤어요.", "📢"),
      right("학생들이 몸뻬 교복을 입고 수업을 받기도 했다", "일제는 전쟁에 대비한다며 몸뻬를 입게 했어요.", "👖"),
    ],
    wrongPool: [
      wrong("우리말로 우리 역사를 자유롭게 배웠다", "그것은 광복 뒤의 모습이에요."),
      wrong("6·25 전쟁 때 천막을 치고 세운 학교다", "천막 학교는 6·25 전쟁 중 피란지에 세워졌어요."),
    ],
  },
];

// ==========================================
// 4단계 문제 은행: 광복과 6·25 전쟁
// ==========================================
const stage4Templates: RawQuizTemplate[] = [
  {
    prompt: "8·15 광복에 대한 설명으로 옳은 것을 고르세요.",
    difficulty: "EASY",
    correctPool: [
      right("1945년 8월 15일에 맞이했다", "1945년 8월 15일 우리 민족은 나라를 되찾았어요.", "🎉"),
      right("제2차 세계 대전에서 연합국이 이긴 것이 계기였다", "연합국의 승리가 광복으로 이어졌어요.", "🌏"),
      right("독립운동가들의 끊임없는 노력이 바탕이 되었다", "임시 정부와 독립운동가들이 쉬지 않고 노력했어요.", "✊"),
      right("사람들이 태극기를 들고 만세를 불렀다", "거리마다 광복을 기뻐하는 사람들로 가득했어요.", "🇰🇷"),
    ],
    wrongPool: [
      wrong("6·25 전쟁이 끝나면서 비로소 찾아왔다", "광복은 6·25 전쟁보다 앞선 1945년의 일이에요."),
      wrong("3·1 운동이 일어난 1919년에 이루어졌다", "1919년은 3·1 운동이 일어난 해이고, 광복은 1945년이에요."),
    ],
  },
  {
    prompt: "광복 뒤 달라진 생활 모습으로 옳은 것을 고르세요.",
    difficulty: "EASY",
    correctPool: [
      right("선생님이 우리말로 수업했다", "학교에서 다시 우리말로 가르치기 시작했어요.", "🗣️"),
      right("학생들이 우리 역사를 배웠다", "우리글과 우리 역사를 배울 수 있게 되었어요.", "📚"),
      right("원래의 성과 이름을 되찾았다", "일본식 이름 대신 본래 이름을 쓰게 되었어요.", "🏷️"),
      right("한글 잡지가 다시 발행되었다", "강제로 폐간되었던 한글 잡지와 신문이 다시 나왔어요.", "📰"),
    ],
    wrongPool: [
      wrong("신사에 절하는 일이 늘었다", "신사 참배는 일제가 강요했던 일이에요."),
      wrong("학교에서 일본어만 쓰게 했다", "광복 뒤에는 우리말로 수업했어요."),
    ],
  },
  {
    prompt: "광복 무렵 38도선과 관련된 설명으로 옳은 것을 고르세요.",
    difficulty: "NORMAL",
    correctPool: [
      right("일본군 무장 해제를 이유로 미군·소련군이 들어왔다", "일본군의 무기를 거두겠다며 미군과 소련군이 들어왔어요.", "🪖"),
      right("38도선 남쪽에는 미군이 들어왔다", "남쪽에는 미군이 머물렀어요.", "⬇️"),
      right("38도선 북쪽에는 소련군이 들어왔다", "북쪽에는 소련군이 머물렀어요.", "⬆️"),
      right("처음에는 38도선 남북을 오갈 수 있었다", "그 무렵에는 남쪽과 북쪽을 오갈 수 있었어요.", "🚶"),
    ],
    wrongPool: [
      wrong("6·25 전쟁 뒤 정전 협정으로 처음 생겼다", "정전 협정으로 생긴 것은 휴전선이에요."),
      wrong("38도선 남쪽에는 중국군이 들어와 머물렀다", "남쪽에는 미군이 들어왔어요. 중국군은 6·25 전쟁 때 북한을 도왔어요."),
    ],
  },
  {
    prompt: "5·10 총선거와 대한민국 정부 수립에 대한 설명으로 옳은 것을 고르세요.",
    difficulty: "NORMAL",
    correctPool: [
      right("국제 연합의 결정에 따라 치러졌다", "선거가 가능한 지역에서만 총선거를 하기로 결정했어요.", "🌐"),
      right("만 21세 이상 모든 국민이 투표할 수 있었다", "만 21세 이상이면 누구나 선거에 참여할 수 있었어요.", "🗳️"),
      right("뽑힌 국회의원들이 헌법을 만들었다", "제헌 국회는 7월 17일에 헌법을 공포했어요.", "📕"),
      right("제헌 국회가 이승만을 첫 대통령으로 뽑았다", "헌법에 따라 국회의원들이 대통령을 뽑았어요.", "🏛️"),
    ],
    wrongPool: [
      wrong("남한과 북한이 동시에 선거를 치렀다", "총선거는 남한에서만 치러졌어요."),
      wrong("조선 총독부가 헌법을 만들었다", "헌법은 제헌 국회가 만들었어요."),
    ],
  },
  {
    prompt: "'대한민국'이라는 나라 이름이 정해진 과정으로 옳은 것을 고르세요.",
    difficulty: "HARD",
    correctPool: [
      right("제헌 국회에서 나라 이름을 정하는 회의를 열었다", "1948년 6월 제헌 국회에서 회의가 열렸어요.", "🏛️"),
      right("여러 의견이 나와 투표로 정했다", "고려 공화국, 조선 공화국 등 여러 의견이 나왔어요.", "🗳️"),
      right("대한민국 임시 정부를 잇는다는 뜻이 담겼다", "임시 정부를 이어받는다는 뜻으로 이 이름을 내세웠어요.", "🔗"),
      right("가장 많은 표를 받아 헌법에 반영되었다", "가장 많은 표를 얻어 공식 이름이 되었어요.", "📕"),
    ],
    wrongPool: [
      wrong("국제 연합이 이름을 정해 주었다", "나라 이름은 제헌 국회의 투표로 정했어요."),
      wrong("고려 공화국이 가장 많은 표를 받았다", "가장 많은 표를 받은 이름은 대한민국이에요."),
    ],
  },
  {
    prompt: "6·25 전쟁의 전개 과정으로 옳은 것을 고르세요.",
    difficulty: "NORMAL",
    correctPool: [
      right("북한군의 기습 남침으로 전쟁이 시작되었다", "1950년 6월 25일 북한군이 38도선을 넘어 쳐들어왔어요.", "⚠️"),
      right("국군은 낙동강 남쪽까지 밀려났다", "국군은 맞서 싸웠지만 낙동강 이남까지 후퇴했어요.", "↩️"),
      right("국군과 국제 연합군이 인천에 상륙해 반격했다", "상륙 작전에 성공해 서울을 되찾고 압록강 부근까지 나아갔어요.", "⚓"),
      right("중국군이 참전하자 다시 서울을 빼앗겼다", "중국군이 북한을 도우면서 국군과 국제 연합군이 후퇴했어요.", "❄️"),
    ],
    wrongPool: [
      wrong("소련군이 남한을 도우려고 참전했다", "남한을 도운 것은 16개 나라가 참여한 국제 연합군이에요."),
      wrong("국군이 전쟁 초부터 압록강까지 밀고 올라갔다", "전쟁 초에는 3일 만에 서울을 빼앗기고 낙동강 남쪽까지 밀려났어요."),
    ],
  },
  {
    prompt: "6·25 전쟁 중 피란민의 생활로 옳은 것을 고르세요.",
    difficulty: "EASY",
    correctPool: [
      right("임시 수도 부산에 많은 피란민이 모였다", "전국에서 온 피란민이 부산에 모여 살았어요.", "🏘️"),
      right("판자로 지은 집에서 살기도 했다", "산등성이에 움막이나 판잣집을 지어 살았어요.", "🪵"),
      right("마실 물을 얻으려고 줄을 섰다", "물과 먹을 것이 부족해 힘들게 지냈어요.", "🚰"),
      right("학생들은 천막을 친 교실에서 배움을 이어 갔다", "어려움 속에서도 배움을 멈추지 않았어요.", "⛺"),
    ],
    wrongPool: [
      wrong("모두 고향에서 편안히 지냈다", "많은 사람이 고향을 떠나 피란길에 올랐어요."),
      wrong("일본인이 살던 충무로로 옮겨 갔다", "충무로 이야기는 일제 통치 시기 도시의 모습이에요."),
    ],
  },
  {
    prompt: "흥남 철수 작전과 밀면에 대한 설명으로 옳은 것을 고르세요.",
    difficulty: "HARD",
    correctPool: [
      right("배 한 척이 피란민 1만 4천 명을 태웠다", "59명이 타도록 만든 메러디스 빅토리호에 1만 4천 명을 태웠어요.", "🚢"),
      right("배에 실은 군수 물자를 버리고 사람을 태웠다", "사람을 살리려고 짐을 내려놓았어요.", "📦"),
      right("'크리스마스의 기적'으로 불린다", "크리스마스 아침 거제도에 피란민을 무사히 내려 주었어요.", "🎄"),
      right("밀면은 피란민이 부산에서 만든 음식이다", "고향의 냉면 대신 밀가루와 고구마 전분으로 만들었어요.", "🍜"),
    ],
    wrongPool: [
      wrong("밀면은 일제 때 일본에서 건너온 음식이다", "밀면은 북한 지역에서 온 피란민들이 부산에서 만든 음식이에요."),
      wrong("흥남 철수 작전으로 서울을 되찾았다", "서울을 되찾은 것은 인천 상륙 작전이에요."),
      wrong("배에는 군인과 무기만 싣고 떠났다", "군수 물자를 내려놓고 피란민 1만 4천 명을 태웠어요."),
    ],
  },
  {
    prompt: "6·25 전쟁이 남긴 영향으로 옳은 것을 고르세요.",
    difficulty: "NORMAL",
    correctPool: [
      right("많은 이산가족과 전쟁고아가 생겼다", "가족과 헤어지거나 부모를 잃은 사람이 많았어요.", "💔"),
      right("도로와 다리, 산업 시설이 파괴되었다", "재산 피해가 무척 컸어요.", "🌉"),
      right("많은 국가유산이 훼손되었다", "수원 화성 같은 국가유산도 망가졌어요.", "🏯"),
      right("남북이 서로를 적으로 여기는 감정이 깊어졌다", "오늘날까지 분단 상황이 이어지고 있어요.", "🚧"),
    ],
    wrongPool: [
      wrong("전쟁 뒤 남북이 곧바로 하나가 되었다", "휴전선을 경계로 분단이 이어지고 있어요."),
      wrong("피해를 입은 사람은 군인뿐이었다", "민간인도 많이 죽거나 다쳤어요."),
    ],
  },
];

// 단계별 문제 은행. 문제를 넣으면 quiz-deck.ts의 ERA_TEMPLATE_COUNTS도 같은 수로 맞춘다.
// 아직 비어 있는 단계는 앞 단계 문제로 대신 출제된다.
const STAGE_TEMPLATES: Record<1 | 2 | 3 | 4, RawQuizTemplate[]> = {
  1: stage1Templates,
  2: stage2Templates,
  3: stage3Templates,
  4: stage4Templates,
};

// 문제가 아직 없는 단계는 문제가 있는 단계 가운데 가장 가까운 앞 단계로 대신 출제한다.
function poolStageFor(stageId: 1 | 2 | 3 | 4): 1 | 2 | 3 | 4 {
  for (let candidate = stageId; candidate >= 1; candidate -= 1) {
    if (STAGE_TEMPLATES[candidate as 1 | 2 | 3 | 4].length) return candidate as 1 | 2 | 3 | 4;
  }
  return 1;
}

export function generateStageQuiz(stageId: StageId, round: number, session = "history-v4"): Quiz {
  const seed = seedForQuiz(stageId, round, session);
  const rng = makePrng(seed);

  // 🏛️ 글로벌 No-Repeat 덱 시스템 연동: 비복원 추출로 덱이 소진될 때까지 중복 없음
  let template: RawQuizTemplate;
  if (stageId >= 1 && stageId <= 4) {
    const deckStage = poolStageFor(stageId as 1 | 2 | 3 | 4);
    const templatePool = STAGE_TEMPLATES[deckStage];
    const drawnIndex = getOrDrawTemplateIndex(deckStage, round, session);
    template = templatePool[drawnIndex % templatePool.length];
  } else {
    // 5단계(종합 모드): 통합 셔플
    const templatePool = [...STAGE_TEMPLATES[1], ...STAGE_TEMPLATES[2], ...STAGE_TEMPLATES[3], ...STAGE_TEMPLATES[4]];
    const shuffledPool = shuffle(makePrng(seedForQuiz(stageId, 999, session)), templatePool);
    template = shuffledPool[(round - 1) % shuffledPool.length];
  }

  const correctOptions = shuffle(rng, template.correctPool).slice(0, 3).map((item) => ({
    text: item.text,
    isCorrect: true,
    explanation: item.explanation,
    symbol: item.symbol,
  }));
  const wrongOptions = shuffle(rng, template.wrongPool).slice(0, 2).map((item) => ({
    text: item.text,
    isCorrect: false,
    explanation: item.explanation,
    misconception: item.misconception,
    symbol: item.symbol,
  }));

  const allRows = shuffle(rng, [...correctOptions, ...wrongOptions]);
  return finalize(stageId, round, template.prompt, template.difficulty, allRows, rng, template.referenceNote);
}

// 보스 단계별 출제 시대: 앞 시대 2라운드 뒤 다음 시대 (시나리오 가이드 4장)
export function bossQuizStage(phase: BossPhase, round: number): StageId {
  return (round <= 2 ? phase : phase + 1) as StageId;
}

// 👹 보스전 단계별 퀴즈 생성기 (Phase 1, 2, 3 글로벌 No-Repeat 덱 연동)
export function generateBossQuiz(phase: BossPhase, round: number, session = "boss-history-v4"): Quiz {
  const simulatedStageId = bossQuizStage(phase, round);

  // 글로벌 No-Repeat 덱에서 비복원 드로우!
  return generateStageQuiz(simulatedStageId, round, session);
}
