import type { Chalkboard } from "./chalkboard.ts";

export type StageId = 1 | 2 | 3 | 4 | 5;
export type Speaker = "글별이" | "소리별" | "주인공" | "보스" | "역사별" | "역사별이";

export type DialogueChoice = {
  text: string;
  correct: boolean;
  feedback: string;
  icon?: string;
};

export type DialogueMultiOption = {
  id: string;
  text: string;
  isAnswer: boolean;
  explanation: string;
  icon?: string;
  icons?: string[];
  cardImage?: string;
  measureImage?: string;
  timeBadge?: string;
};

export type DialogueMultiCheck = {
  instruction: string;
  options: DialogueMultiOption[];
  successFeedback: string;
};

export type DialogueVisualItem = {
  src?: string;
  credit?: string;
  title: string;
  zoomable?: boolean;
  beats?: number;
  beatsLabel?: string;
  gridBlocks?: number;
  tag?: string;
  desc?: string;
  icon?: string;
  story?: string;
  meaning?: string;
  // 이미지가 아직 없어 빈칸으로 제목만 보여 줄 카드
  placeholder?: boolean;
  // 칠판에서 크게 보여 줄 핵심 삽화 (칠판당 하나)
  featured?: boolean;
};

export type GrammarConceptCard = {
  title: string;
  badge: string;
  icon: string;
  colorTheme: "rose" | "emerald" | "sky" | "amber" | "purple";
  timeKeywords?: string;
  verbEndings: string;
  goodExample?: string;
  badExample?: string;
  pairLabel1?: string;
  pairLabel2?: string;
  pairDivider?: string;
  goodBadge?: string;
  badBadge?: string;
};

export type GuideSideWings = {
  leftTitle: string;
  leftBadge: string;
  leftIcon: string;
  leftItems: { normal: string; honorific: string }[];
  rightTitle: string;
  rightBadge: string;
  rightIcon: string;
  rightItems: { normal: string; honorific: string }[];
};

export type DialogueVisual = {
  // timeline: items를 tag(연도)와 함께 화살표로 이어 보여 준다.
  type: "symbol" | "diagram" | "compare" | "grammar-table" | "guide-wings" | "timeline";
  src?: string;
  title?: string;
  caption?: string;
  source?: string;
  items?: DialogueVisualItem[];
  grammarTable?: {
    title: string;
    subtitle?: string;
    cards: GrammarConceptCard[];
  };
  guideWings?: GuideSideWings;
};

export type FillBlankSlot = {
  text: string;
  isSlot?: boolean;
  icon?: string;
};

export type FillBlankOption = {
  id: string;
  text: string;
  icon?: string;
  isAnswer: boolean;
  explanation: string;
};

export type FillBlankTask = {
  type: "fill-blank";
  instruction: string;
  equation: FillBlankSlot[];
  options: FillBlankOption[];
  successFeedback: string;
};

export type MatchPairItem = {
  id: string;
  text: string;
  icon?: string;
  emoji?: string;
  matchId: string;
  image?: string;
  accent?: string;
  subText?: string;
  badge?: string;
};

export type MatchPairsTask = {
  type: "match-pairs";
  instruction: string;
  leftItems: MatchPairItem[];
  rightItems: MatchPairItem[];
  successFeedback: string;
  leftTitle?: string;
  rightTitle?: string;
  anchorSide?: "left" | "right";
};

export type OrderSequenceItem = {
  id: string;
  text: string;
  icon?: string;
  order?: number;
  correctIndex?: number;
};

export type OrderSequenceTask = {
  type: "order-sequence";
  instruction: string;
  items: OrderSequenceItem[];
  successFeedback: string;
  allowedOrders?: number[][];
};

export type ActivityReason = {
  prompt: string;
  options: { text: string; correct: boolean; hint: string }[];
};

export type SortExhibitTask = {
  type: "sort-exhibit";
  rooms: { id: string; title: string; icon: string }[];
  cards: { id: string; text: string; icon?: string; image?: string; roomId: string; hint: string }[];
  reason: ActivityReason;
  source?: string;
  successFeedback: string;
};

export type EvidenceCaseTask = {
  type: "evidence-case";
  evidence: { id: string; text: string; icon: string; isEvidence: boolean; note: string }[];
  conclusion: ActivityReason;
  successFeedback: string;
};

// v3에서 가져온 범용 과제: 두 바구니 분류, OX 판정, 문서 복원
export type CategorySortItem = {
  id: string;
  text: string;
  emoji?: string;
  category: "left" | "right";
  explanation: string;
};

export type CategorySortTask = {
  type: "category-sort";
  instruction: string;
  leftBucketTitle: string;
  leftBucketDesc?: string;
  leftBucketEmoji?: string;
  rightBucketTitle: string;
  rightBucketDesc?: string;
  rightBucketEmoji?: string;
  items: CategorySortItem[];
  successFeedback: string;
};

export type OxStatementItem = {
  id: string;
  text: string;
  isTrue: boolean;
  explanation: string;
};

export type OxVerdictTask = {
  type: "ox-verdict";
  instruction: string;
  courtTitle: string;
  statements: OxStatementItem[];
  successFeedback: string;
};

export type DocumentSegment = {
  text: string;
  slotId?: string;
  slotLabel?: string;
};

export type DocumentWordOption = {
  id: string;
  text: string;
  targetSlotId?: string;
  explanation: string;
};

export type DocumentRestoreTask = {
  type: "document-restore";
  instruction: string;
  docTitle: string;
  docBadge: string;
  segments: DocumentSegment[];
  options: DocumentWordOption[];
  successFeedback: string;
};

export type InteractiveTask =
  | FillBlankTask
  | MatchPairsTask
  | OrderSequenceTask
  | SortExhibitTask
  | EvidenceCaseTask
  | CategorySortTask
  | OxVerdictTask
  | DocumentRestoreTask;

export type DialogueNode = {
  speaker: Speaker;
  text: string;
  // 역사별이 설명 바로 앞에 끼워 넣을 주인공의 관찰·질문
  hero?: string;
  bgImage?: string;
  prompt?: string;
  sentence?: string;
  choices?: DialogueChoice[];
  multiCheck?: DialogueMultiCheck;
  task?: InteractiveTask;
  interactiveTask?: InteractiveTask;
  visual?: DialogueVisual;
  conceptId?: string;
  reviewConcept?: string;
  thinkAnswer?: string;
  quizImage?: { src: string; title: string; source: string };
  // 수업 판서처럼 제목과 줄 목록으로 쓰는 칠판 (판서 문법은 src/lib/chalkboard.ts)
  chalkboard?: Chalkboard;
};

export type Stage = {
  id: StageId;
  title: string;
  shortTitle: string;
  concept: string;
  mission: string;
  bossName: string;
  bossTitle: string;
  bossShortName: string;
  color: string;
  background: string;
  // 단계 배경 그림. 파일이 없으면 background 그라데이션만 보인다.
  backgroundImage?: string;
  bossImage: string;
  dialogue: DialogueNode[];
};

const choice = (
  correctText: string,
  wrong: [text: string, hint: string][],
  feedback: string,
): DialogueChoice[] => {
  const choices: DialogueChoice[] = [
    { text: correctText, correct: true, feedback },
    ...wrong.map(([text, hint]) => ({ text, correct: false, feedback: hint })),
  ];
  for (let index = choices.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [choices[index], choices[swapIndex]] = [choices[swapIndex], choices[index]];
  }
  return choices;
};

// 콘텐츠 작성용 도우미(모두 고르기). 지금 단계 내용에는 쓰지 않지만 남겨 둔다.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const multiCheck = (options: DialogueMultiOption[], successFeedback: string, instruction = "조건에 맞는 보기를 모두 고르세요."): DialogueMultiCheck => {
  const shuffled = [...options];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return { instruction, options: shuffled, successFeedback };
};

const matchPair = (
  pairs: { left: string; right: string; emoji?: string }[],
  successFeedback: string,
  instruction = "알맞은 짝을 찾아 연결하세요.",
  leftTitle?: string,
  rightTitle?: string,
  anchorSide: "left" | "right" = "left",
): MatchPairsTask => {
  const leftItems: MatchPairItem[] = pairs.map((p, i) => ({
    id: `pair-${i}`,
    text: p.left,
    emoji: p.emoji,
    matchId: `pair-${i}`,
  }));
  const rightItems: MatchPairItem[] = pairs.map((p, i) => ({
    id: `right-${i}`,
    text: p.right,
    matchId: `pair-${i}`,
  }));
  for (let index = rightItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [rightItems[index], rightItems[swapIndex]] = [rightItems[swapIndex], rightItems[index]];
  }
  return {
    type: "match-pairs",
    instruction,
    leftItems,
    rightItems,
    successFeedback,
    leftTitle,
    rightTitle,
    anchorSide,
  };
};

// 콘텐츠 작성용 도우미(빈칸 하나 채우기). 지금은 정리 노트로 대신하지만 남겨 둔다.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const fillBlank = (
  equation: FillBlankSlot[],
  options: FillBlankOption[],
  successFeedback: string,
  instruction = "빈칸에 들어갈 알맞은 낱말 카드를 선택하세요."
): FillBlankTask => {
  const shuffled = [...options];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return {
    type: "fill-blank",
    instruction,
    equation,
    options: shuffled,
    successFeedback,
  };
};

const orderSequence = (
  items: OrderSequenceItem[],
  successFeedback: string,
  instruction = "역사적 발전 순서에 맞게 카드를 알맞게 배열하세요."
): OrderSequenceTask => {
  return {
    type: "order-sequence",
    instruction,
    items,
    successFeedback,
  };
};

// 🏛️ 3페이즈 보스 정의 (시대의 기운이 뭉친 가상의 수호령)
export type BossPhase = 1 | 2 | 3;
export type HistoryBossInfo = {
  phase: BossPhase;
  name: string;
  title: string;
  shortName: string;
  themeEra: string;
  maxHp: number;
  attackPower: number;
  defense: number;
  barrier: number;
  dialogueIntro: string;
  dialogueDefeat: string;
  icon: string;
  color: string;
  image: string;
};

const withTask = (task: InteractiveTask) => ({ task, interactiveTask: task });


export const bossPhases: Record<BossPhase, HistoryBossInfo> = {
  // 그림 파일은 public/characters/boss-1~3.webp (생성형 이미지로 덮어쓸 때까지 임시 그림)
  1: {
    phase: 1,
    name: "의병 고개의 수호령",
    title: "나라를 지키려던 의병의 기운이 모인 수호령",
    shortName: "의병 고개의 수호령",
    themeEra: "빼앗긴 나라와 저항·3·1 운동과 독립운동",
    maxHp: 28,
    attackPower: 4,
    defense: 3,
    barrier: 3,
    dialogueIntro: "나라를 지키려 고개를 넘던 의병들의 기운이 모인 첫 번째 수호령이다!\n을사늑약과 의병의 이야기를 모르는 자는\n이 고개를 넘을 수 없다!",
    dialogueDefeat: "크윽... 의병들의 용기를 잊지 않았구나...\n하지만 만세 거리의 수호령이 길을 막고 있다!",
    icon: "⛰️",
    color: "#a16207",
    image: "/characters/boss-1.webp",
  },
  2: {
    phase: 2,
    name: "만세 거리의 수호령",
    title: "온 나라에 울린 만세 소리를 품은 수호령",
    shortName: "만세 거리의 수호령",
    themeEra: "3·1 운동과 독립운동·일제 통치 시기의 생활",
    maxHp: 36,
    attackPower: 5,
    defense: 4,
    barrier: 4,
    dialogueIntro: "그날 거리를 가득 메운 만세 소리가 모여 내가 되었다!\n임시 정부와 독립군, 그리고 도시의 생활까지 기억하느냐?\n배운 내용을 증명해 보아라!",
    dialogueDefeat: "만세 소리가 아직 너희 마음에 살아 있구나...\n이제 마지막 수호군주가 기다리고 있다!",
    icon: "📣",
    color: "#0369a1",
    image: "/characters/boss-2.webp",
  },
  3: {
    phase: 3,
    name: "휴전선의 수호군주",
    title: "광복의 기쁨과 전쟁의 아픔을 지켜본 수호군주",
    shortName: "휴전선의 수호군주",
    themeEra: "일제 통치 시기의 생활·광복과 6·25 전쟁",
    maxHp: 44,
    attackPower: 6,
    defense: 4,
    barrier: 4,
    dialogueIntro: "내가 시간의 문을 지키는 마지막 시험관이다!\n광복의 기쁨과 6·25 전쟁의 아픔을 증명하고,\n너희의 세계로 돌아가는 시간의 문을 열어 보아라!",
    dialogueDefeat: "훌륭하다! 노트 속 낱말마다 담긴 뜻을 읽어 냈구나.\n약속대로 시간의 문을 열어 주마. 너희가 살던 집으로 돌아가라!",
    icon: "🕊️",
    color: "#7e22ce",
    image: "/characters/boss-3.webp",
  },
};

// ---------------------------------------------------------------------
// 단계 내용 작성 규칙
// - 정리 노트(chalkboard) 문장은 교과서 문장을 옮기지 않고 새로 정리한다(18자 이상 같은 문구 금지).
// - 빈칸 낱말 카드는 정답·오답 모두 교과서 단원 범위의 낱말로만 쓴다.
// - 역사별이 설명 앞에는 hero(주인공 질문)를 꼭 둔다. 같은 단계에서 hero 문장을 반복하지 않는다.
// - 화면 문구에 교과서 쪽수를 적지 않는다.
// - 제암리 사건, 일본군 '위안부', 전쟁 피해는 사실 설명 수준으로만 노트 보충 줄에 둔다.
// 범위: 초등 5-2 사회 「식민 통치와 저항, 전쟁이 바꾼 사회와 생활」(122~153쪽)
//   1단계 123~127 / 2단계 128~133 / 3단계 134~138 / 4단계 140~152
// ---------------------------------------------------------------------
export const stages: Stage[] = [
  // ==========================================
  // STAGE 1: 빼앗긴 나라와 저항
  // ==========================================
  {
    id: 1,
    title: "1단계: 빼앗긴 나라와 저항",
    shortTitle: "빼앗긴 나라와 저항",
    concept: "을사늑약과 의병, 나라를 빼앗긴 뒤의 통치",
    mission: "대한 제국의 운명이 흔들리던 때에 도착했어요! 노트의 빈칸을 채우며 나라를 지키려던 사람들의 노력을 알아보세요!",
    bossName: bossPhases[1].name,
    bossTitle: bossPhases[1].title,
    bossShortName: bossPhases[1].shortName,
    color: "#9a3412",
    background: "linear-gradient(135deg, #7c2d12, #431407)",
    backgroundImage: "/backgrounds/stage1.webp",
    bossImage: bossPhases[1].image,
    dialogue: [
      {
        speaker: "역사별이",
        hero: "으앗, 또 시간 여행이야? 궁궐 앞에 사람들이 모여서 웅성거리고 있어!",
        text: "수호자님, 이번에 도착한 곳은 고종이 황제가 되어 세운 [대한 제국]이에요.\n나라의 운명이 흔들리는 때예요. 빈칸을 채워 [시간의 조각]을 모아요!",
      },
      {
        speaker: "역사별이",
        conceptId: "eulsa",
        hero: "다른 나라와 마음대로 약속을 못 맺게 됐다고? 그게 무슨 말이야?",
        text: "러시아와의 전쟁에서 이긴 일제가 대한 제국을 본격적으로 침략하기 시작했어요.\n황제가 허락하지 않았는데도 억지로 조약을 맺어 버렸지요.",
        chalkboard: {
          title: "을사늑약과 헤이그 특사",
          lines: [
            "일제가 고종의 동의 없이 억지로 맺은 조약: ( [[을사늑약|정전 협정|헌법]] )",
            "이 조약으로 대한 제국은 ( [[외교권|토지|철도]] )을 빼앗김",
            "고종은 ( [[헤이그|하얼빈|상하이]] )의 평화 회의에 특사를 보내 조약이 무효라고 알리려 함",
            { note: "'늑약'은 억지로 맺은 조약이라는 뜻이에요. 특사들은 일제의 방해로 뜻을 이루지 못했어요." },
          ],
        },
      },
      {
        speaker: "역사별이",
        conceptId: "righteous-army",
        hero: "가게 문을 닫은 상인들, 학교에 안 간 학생들… 모두 그 조약에 반대하는 거야?",
        text: "맞아요. 조약 소식이 퍼지자 곳곳에서 반대의 목소리가 터져 나왔어요.\n스스로 무기를 들고 일어난 사람들도 있었답니다.",
        chalkboard: {
          title: "의병 운동과 안중근",
          lines: [
            "상인은 가게 문을 닫고, 학생은 ( [[등교|선거|만세 시위]] )를 거부하며 맞섬",
            "백성이 스스로 무기를 들고 일어난 ( [[의병|헌병|국군]] ) 운동이 곳곳에서 벌어짐",
            "대한 제국 ( [[군대|흥사단|국회]] )가 해산되자 군인들도 의병에 합류함",
            "( [[안중근|김구|윤봉길]] )은 하얼빈역에서 이토 히로부미를 처단함",
            { note: "일제의 탄압이 심해지자 의병들은 만주와 연해주로 건너가 싸움을 이어 갔어요." },
          ],
        },
      },
      {
        speaker: "역사별이",
        conceptId: "colonial-rule",
        hero: "1910년에 무슨 일이 있었길래 사람들 표정이 이렇게 어두워?",
        text: "많은 사람이 저항했지만 1910년, 대한 제국은 결국 일제에 나라를 빼앗겼어요.\n일제는 우리 민족을 어떤 방식으로 다스렸을까요?",
        chalkboard: {
          title: "나라를 빼앗긴 뒤의 통치",
          lines: [
            "일제는 우리 민족을 다스리려고 ( [[조선 총독부|대한민국 임시 정부|제헌 국회]] )를 설치함",
            "군인 출신 총독이 우리 민족을 ((자유롭게/강압적으로*)) 다스림",
            "군대의 경찰인 ( [[헌병|의병|독립군]] )이 한국인을 감시하고 독립운동을 탄압함",
            "관리와 ( [[교사|상인|농민]] )까지 제복을 입고 칼을 차게 해 두려움을 줌",
          ],
        },
      },
      {
        speaker: "역사별이",
        conceptId: "abroad",
        hero: "나라 밖으로 떠난 사람들은 그곳에서 무엇을 했어?",
        text: "일제의 감시를 피해 많은 독립운동가가 나라 밖에서 학교와 단체를 만들었어요.\n한편 나라 안 농민들은 땅 문제로 큰 어려움을 겪었답니다.",
        chalkboard: {
          title: "국외 독립운동과 토지 조사 사업",
          lines: [
            "( [[이회영|안창호|유관순]] )은 만주에 신흥 강습소를 세워 독립군을 길러 냄",
            "안창호는 미국에서 ( [[흥사단|한인 애국단|조선어 학회]] )을 만들어 민족의 실력을 키움",
            "일제는 땅 주인을 확인한다며 ( [[토지 조사 사업|물산 장려 운동|농촌 계몽 운동]] )을 벌임",
            "땅을 잃은 농민들은 남의 땅을 ((사서/빌려*)) 농사지어야 했음",
            { note: "재산을 팔고 만주로 떠난 이회영 가족은 끼니를 거를 만큼 힘들게 지냈어요." },
          ],
        },
      },
      {
        speaker: "역사별이",
        hero: "노트를 다 채웠어! 정리 카드로 한 번 더 확인해 볼래.",
        text: "★ [확인문제 1] 정리 카드의 빈칸 ①, ②에 들어갈 알맞은 낱말을 고르세요.",
        reviewConcept: "colonial-rule",
        ...withTask({
          type: "document-restore",
          instruction: "",
          docTitle: "1단계 정리 카드",
          docBadge: "📌 빼앗긴 나라와 저항",
          segments: [
            { text: "• 일제는 고종이 허락하지 않은 " },
            { text: "", slotId: "slot-1", slotLabel: "빈칸 ① (조약)" },
            { text: "을 억지로 맺어 대한 제국의 외교권을 가져갔습니다.\n• 1910년 나라를 빼앗은 뒤에는 " },
            { text: "", slotId: "slot-2", slotLabel: "빈칸 ② (통치 기관)" },
            { text: "를 두고 우리 민족을 강압적으로 다스렸습니다." },
          ],
          options: [
            { id: "doc-1", text: "을사늑약", targetSlotId: "slot-1", explanation: "외교권을 빼앗아 간 조약은 을사늑약이에요." },
            { id: "doc-2", text: "조선 총독부", targetSlotId: "slot-2", explanation: "일제가 우리 민족을 다스리려고 설치한 곳은 조선 총독부예요." },
            { id: "doc-3", text: "흥사단", explanation: "흥사단은 안창호가 미국에서 만든 독립운동 단체예요." },
            { id: "doc-4", text: "헤이그 특사", explanation: "헤이그 특사는 조약이 무효라고 알리려고 고종이 보낸 사람들이에요." },
          ],
          successFeedback: "정리 카드 복원 완료! 을사늑약과 조선 총독부를 기억했어요.",
        }),
      },
      {
        speaker: "역사별이",
        hero: "일이 어떤 차례로 벌어졌는지 줄 세워 보자!",
        text: "★ [확인문제 2] 대한 제국에서 일어난 일을 순서대로 놓아 보세요.",
        reviewConcept: "eulsa",
        ...withTask(orderSequence(
          [
            { id: "o1", text: "을사늑약으로 외교권을 빼앗김", icon: "📜", order: 1 },
            { id: "o2", text: "고종이 헤이그에 특사를 보냄", icon: "✉️", order: 2 },
            { id: "o3", text: "군대가 해산되고 군인들이 의병에 합류함", icon: "⚔️", order: 3 },
            { id: "o4", text: "1910년 일제에 나라를 빼앗김", icon: "🏚️", order: 4 },
          ],
          "순서 정리 완료! 나라를 지키려는 노력은 나라를 빼앗긴 뒤에도 이어졌어요.",
          "일이 일어난 순서에 맞게 카드를 배열하세요.",
        )),
      },
      {
        speaker: "역사별이",
        hero: "누가 어디서 무슨 일을 했는지 짝지어 볼래!",
        text: "★ [확인문제 3] 인물과 그 인물이 한 일을 알맞게 연결해 보세요.",
        reviewConcept: "abroad",
        ...withTask(matchPair(
          [
            { left: "안중근", right: "하얼빈역에서 이토 히로부미를 처단함", emoji: "🚉" },
            { left: "이회영", right: "만주에 신흥 강습소를 세움", emoji: "🏫" },
            { left: "안창호", right: "미국에서 흥사단을 만듦", emoji: "📘" },
            { left: "고종", right: "평화 회의가 열린 곳에 특사를 보냄", emoji: "👑" },
          ],
          "짝 맞추기 완료! 나라 안팎에서 많은 사람이 나라를 지키려 애썼어요.",
          "알맞은 짝을 연결하세요.",
          "인물",
          "한 일",
        )),
      },
      {
        speaker: "역사별이",
        hero: "첫 번째 조각이야! 끝까지 포기하지 않은 사람들이 정말 대단해.",
        text: "첫 번째 [시간의 조각]을 찾았어요! 나라를 빼앗긴 뒤에도 독립의 꿈은 이어졌어요.\n다음 단계에서는 온 나라에 울려 퍼진 만세 소리를 따라가 봐요!",
      },
    ],
  },
  // ==========================================
  // STAGE 2: 3·1 운동과 독립을 향한 노력
  // ==========================================
  {
    id: 2,
    title: "2단계: 3·1 운동과 독립을 향한 노력",
    shortTitle: "3·1 운동과 독립운동",
    concept: "3·1 운동과 대한민국 임시 정부, 다양한 독립운동",
    mission: "온 나라에 만세 소리가 울려 퍼지던 때예요! 노트의 빈칸을 채우며 독립을 이루려는 노력이 어떻게 이어졌는지 알아보세요!",
    bossName: bossPhases[1].name,
    bossTitle: bossPhases[1].title,
    bossShortName: bossPhases[1].shortName,
    color: "#0f766e",
    background: "linear-gradient(135deg, #134e4a, #042f2e)",
    backgroundImage: "/backgrounds/stage2.webp",
    bossImage: bossPhases[1].image,
    dialogue: [
      {
        speaker: "역사별이",
        hero: "사람들이 태극기를 흔들면서 다 같이 뭔가를 외치고 있어!",
        text: "지금은 1919년 3월! 사람들이 한목소리로 [만세]를 외치고 있어요.\n이 외침이 어떻게 퍼졌고, 그 뒤 어떤 노력이 이어졌는지 정리해 봐요.",
      },
      {
        speaker: "역사별이",
        conceptId: "march-first",
        hero: "이 만세 시위는 어디서 처음 시작됐어?",
        text: "민족 대표들은 서울에서 독립을 선언했고, 학생과 시민은 공원에서 만세를 외쳤어요.\n그 물결이 전국으로 번져 나갔답니다.",
        chalkboard: {
          title: "3·1 운동",
          lines: [
            "1919년 3월 1일, 민족 대표들이 서울에서 ( [[독립 선언서|을사늑약|헌법]] )를 발표함",
            "학생과 시민은 ( [[탑골 공원|훙커우 공원|임피역]] )에서 선언서를 읽고 만세를 외침",
            "만세 시위는 ((서울에서만/전국 곳곳으로*)) 퍼져 석 달 넘게 이어짐",
            "이화 학당 학생 ( [[유관순|이회영|김좌진]] )은 고향 천안에서 만세 시위를 이끎",
            { note: "일제는 시위를 폭력으로 눌렀고, 화성 제암리에서는 마을 사람들을 해치기도 했어요." },
          ],
        },
      },
      {
        speaker: "역사별이",
        hero: "그날 사람들이 읽은 선언서랑 만세를 외친 곳을 직접 보고 싶어!",
        text: "왼쪽은 민족 대표들이 발표한 [독립 선언서]예요. 오른쪽은 학생과 시민들이 선언서를 읽고 만세를 외친 [탑골 공원]의 팔각정이랍니다.",
        visual: {
          type: "compare",
          title: "3·1 운동의 흔적 살펴보기",
          caption: "사진을 누르면 크게 볼 수 있어요.",
          items: [
            { title: "독립 선언서", tag: "문서", desc: "우리 민족이 독립한 나라임을 세상에 알린 글이에요.", src: "/relics/independence_declaration.webp", credit: "국립중앙박물관 · 공공누리 제1유형", zoomable: true },
            { title: "탑골 공원 팔각정", tag: "장소", desc: "서울 종로의 공원으로, 만세 시위가 시작된 곳 가운데 하나예요.", src: "/sites/tapgol_palgakjeong.webp", credit: "국가유산청 국가유산포털 · 공공누리 제1유형", zoomable: true },
          ],
        },
      },
      {
        speaker: "역사별이",
        conceptId: "provisional-gov",
        hero: "독립운동을 한곳에서 이끌어 줄 곳이 있으면 좋겠다!",
        text: "3·1 운동을 겪으며 사람들은 힘을 하나로 모아야 한다는 것을 깨달았어요.\n그래서 여러 곳에 있던 임시 정부를 하나로 합쳤답니다.",
        chalkboard: {
          title: "대한민국 임시 정부와 한인 애국단",
          lines: [
            "1919년 9월, 중국 ( [[상하이|도쿄|하얼빈]] )에 대한민국 임시 정부를 세움",
            "비밀 ( [[연락망|선거|철도]] )을 만들어 독립운동을 지휘하고 자금을 모음",
            "신문을 펴내고 ( [[외교|무장|선거]] ) 활동으로 독립 의지를 세계에 알림",
            "( [[김구|안창호|홍범도]] )는 한인 애국단을 만들어 독립운동에 힘을 불어넣음",
            { note: "도쿄의 이봉창, 상하이의 윤봉길 의거는 일제에 큰 타격을 안겼어요." },
          ],
        },
      },
      {
        speaker: "역사별이",
        conceptId: "national-movement",
        hero: "만세 운동 뒤에 일제의 통치 방법은 어떻게 바뀌었어?",
        text: "일제는 친일 세력을 늘려 민족을 갈라놓고, 쌀도 더 많이 가져갔어요.\n사람들은 우리 스스로 힘을 길러 이겨 내려 했답니다.",
        chalkboard: {
          title: "우리 힘을 기르는 운동",
          lines: [
            "조선어 학회는 ( [[우리말 사전|독립 선언서|신문]] )을 펴내려고 애씀",
            "학생들이 농촌에서 한글을 가르친 ( [[농촌 계몽|물산 장려|토지 조사]] ) 운동",
            "토산품 쓰기로 경제 독립을 외친 ( [[물산 장려|농촌 계몽|의병]] ) 운동",
            { note: "토산품은 어느 한 지역에서만 나는 물건을 말해요." },
          ],
          photo: { src: "/relics/korean_dictionary_manuscript.webp", caption: "조선말 큰사전 원고", credit: "국가유산청 국가유산포털 · 공공누리 제1유형" },
        },
      },
      {
        speaker: "역사별이",
        conceptId: "students-army",
        hero: "학생들도 독립운동에 나섰다고? 나랑 비슷한 나이였을까?",
        text: "학생들은 사람이 많이 모이는 날 만세를 외치고, 차별에 맞서 거리로 나섰어요.\n나라 밖에서는 독립군이 일본군과 맞서 싸웠답니다.",
        chalkboard: {
          title: "학생 운동과 독립군",
          lines: [
            "순종의 장례식 날 학생들이 만세를 외친 ( [[6·10 만세 운동|3·1 운동|광주 학생 항일 운동]] )",
            "한국 학생만 붙잡은 차별에 맞선 ( [[광주 학생 항일 운동|6·10 만세 운동|물산 장려 운동]] )",
            "( [[홍범도|안중근|이봉창]] )가 이끈 독립군 부대가 봉오동에서 일본군을 물리침",
            "김좌진과 홍범도의 독립군 연합 부대가 ( [[청산리|봉오동|하얼빈]] )에서 승리함",
          ],
        },
      },
      {
        speaker: "역사별이",
        hero: "1919년에 일어난 두 가지 큰일을 정리 카드에 적어 둘래.",
        text: "★ [확인문제 1] 정리 카드의 빈칸 ①, ②에 들어갈 알맞은 낱말을 고르세요.",
        reviewConcept: "provisional-gov",
        ...withTask({
          type: "document-restore",
          instruction: "",
          docTitle: "2단계 정리 카드",
          docBadge: "📌 3·1 운동과 독립을 향한 노력",
          segments: [
            { text: "• 1919년 3월 1일에 시작된 " },
            { text: "", slotId: "slot-1", slotLabel: "빈칸 ① (만세 시위)" },
            { text: "은 나라 곳곳으로 번져 석 달 넘게 이어졌습니다.\n• 그해 9월에는 상하이에 " },
            { text: "", slotId: "slot-2", slotLabel: "빈칸 ② (정부)" },
            { text: "가 세워져 독립운동을 이끌었습니다." },
          ],
          options: [
            { id: "doc-1", text: "3·1 운동", targetSlotId: "slot-1", explanation: "1919년 3월 1일에 시작해 전국으로 퍼진 만세 시위는 3·1 운동이에요." },
            { id: "doc-2", text: "대한민국 임시 정부", targetSlotId: "slot-2", explanation: "상하이에 여러 임시 정부를 합쳐 세운 것은 대한민국 임시 정부예요." },
            { id: "doc-3", text: "6·10 만세 운동", explanation: "6·10 만세 운동은 순종의 장례식 날 학생들이 일으킨 만세 시위예요." },
            { id: "doc-4", text: "조선 총독부", explanation: "조선 총독부는 일제가 우리 민족을 다스리려고 세운 기관이에요." },
          ],
          successFeedback: "정리 카드 복원 완료! 3·1 운동과 대한민국 임시 정부를 기억했어요.",
        }),
      },
      {
        speaker: "역사별이",
        hero: "나라 안에서 한 일이랑 나라 밖에서 한 일을 나눠 보면 좋겠어!",
        text: "★ [확인문제 2] 독립을 위한 노력을 일어난 곳에 따라 나누어 담아 보세요.",
        reviewConcept: "students-army",
        ...withTask({
          type: "category-sort",
          instruction: "",
          leftBucketTitle: "나라 안에서",
          leftBucketDesc: "국내에서 펼친 운동",
          leftBucketEmoji: "🏠",
          rightBucketTitle: "나라 밖에서",
          rightBucketDesc: "국외에서 펼친 활동",
          rightBucketEmoji: "🧭",
          items: [
            { id: "in-1", text: "물산 장려 운동", emoji: "🧵", category: "left", explanation: "토산품을 쓰자는 물산 장려 운동은 나라 안에서 일어났어요." },
            { id: "in-2", text: "우리말 사전 만들기", emoji: "📖", category: "left", explanation: "조선어 학회는 나라 안에서 우리말 사전을 만들려고 애썼어요." },
            { id: "in-3", text: "광주 학생 항일 운동", emoji: "🎒", category: "left", explanation: "광주에서 시작해 전국으로 퍼진 학생 운동이에요." },
            { id: "out-1", text: "청산리 전투", emoji: "🌲", category: "right", explanation: "독립군 연합 부대가 만주의 청산리 일대에서 승리했어요." },
            { id: "out-2", text: "대한민국 임시 정부 수립", emoji: "🏛️", category: "right", explanation: "대한민국 임시 정부는 중국 상하이에 세워졌어요." },
            { id: "out-3", text: "훙커우 공원 의거", emoji: "💥", category: "right", explanation: "윤봉길은 중국 상하이의 훙커우 공원에서 폭탄을 던졌어요." },
          ],
          successFeedback: "분류 완료! 나라 안과 밖에서 독립을 위한 노력이 함께 이어졌어요.",
        }),
      },
      {
        speaker: "역사별이",
        hero: "이봉창과 윤봉길은 어느 단체 소속이었더라?",
        text: "★ [확인문제 3] 이봉창과 윤봉길이 함께 속해 있던 단체를 고르세요.",
        reviewConcept: "provisional-gov",
        choices: choice(
          "한인 애국단",
          [
            ["흥사단", "흥사단은 안창호가 미국에서 민족의 실력을 키우려고 만든 단체예요."],
            ["조선어 학회", "조선어 학회는 우리말 사전을 만들려고 애쓴 한글 연구 단체예요."],
            ["신흥 강습소", "신흥 강습소는 이회영이 만주에 세운, 독립군을 기르는 학교예요."],
          ],
          "김구가 만든 한인 애국단의 단원으로, 일제의 주요 인물을 처단하는 활동을 했어요.",
        ),
      },
      {
        speaker: "역사별이",
        hero: "두 번째 조각도 찾았다! 만세 소리가 아직 귓가에 맴돌아.",
        text: "두 번째 [시간의 조각]을 찾았어요! 독립을 향한 걸음은 나라 안팎에서 이어졌어요.\n다음 단계에서는 일제가 다스리던 때의 생활을 살펴봐요!",
      },
    ],
  },
  // ==========================================
  // STAGE 3: 일제 통치 시기의 생활
  // ==========================================
  {
    id: 3,
    title: "3단계: 일제 통치 시기의 생활",
    shortTitle: "일제 통치 시기 생활",
    concept: "철도와 도시의 변화, 민족정신 말살 정책과 저항",
    mission: "기차와 높은 건물이 생겼지만 모두가 누린 변화는 아니었어요! 노트의 빈칸을 채우며 일제 통치 시기의 생활을 살펴보세요!",
    bossName: bossPhases[2].name,
    bossTitle: bossPhases[2].title,
    bossShortName: bossPhases[2].shortName,
    color: "#1d4ed8",
    background: "linear-gradient(135deg, #1e3a8a, #172554)",
    backgroundImage: "/backgrounds/stage3.webp",
    bossImage: bossPhases[2].image,
    dialogue: [
      {
        speaker: "역사별이",
        hero: "칙칙폭폭! 기차가 쌀가마니를 가득 싣고 항구 쪽으로 달려가!",
        text: "일제가 우리나라를 다스리던 때의 도시에 왔어요. 철도와 항구, 높은 건물이 새로 생겼지요.\n하지만 이 변화가 누구를 위한 것이었는지 잘 살펴봐야 해요.",
      },
      {
        speaker: "역사별이",
        conceptId: "railway",
        hero: "철도가 생기면 사람들이 편해지는 거 아니야?",
        text: "철도 덕분에 사람과 물건이 더 빨리 오갈 수 있게 되었어요.\n그런데 일제는 철도를 주로 어디에 썼을까요?",
        chalkboard: {
          title: "철도와 쌀 수탈",
          lines: [
            "일제는 통치를 위해 도로·항구·( [[철도|천막 학교|신사]] )를 놓음",
            "철도로 ( [[군대|피란민|독립군]] )를 옮기고 자원을 일본에 실어 감",
            "한국인은 철도 공사에 ((강제로*/자유롭게)) 동원됨",
            "( [[군산|부산|상하이]] ) 임피역: 평야의 쌀을 일본으로 보낸 길목",
            { note: "일제는 일본의 쌀 부족을 메우려고 우리 쌀을 더 많이 거두어 갔어요." },
          ],
          photo: { src: "/sites/imp_station.webp", caption: "군산 임피역", credit: "국가유산청 국가유산포털 · 공공누리 제1유형" },
        },
      },
      {
        speaker: "역사별이",
        conceptId: "city",
        hero: "같은 서울인데 이쪽은 번쩍번쩍하고 저쪽은 캄캄해. 왜 이렇게 달라?",
        text: "철도역과 항구 주변으로 도시가 커졌지만, 일본인과 한국인은 따로 살았어요.\n근대 문물의 혜택도 똑같이 누리지 못했지요.",
        chalkboard: {
          title: "둘로 나뉜 도시",
          lines: [
            "일본인이 모여 산 ( [[충무로|청계천|탑골 공원]] ) 일대에는 은행·백화점이 들어섬",
            "한국인이 많이 산 ( [[청계천|충무로|임피역]] ) 일대는 전기도 잘 들어오지 않음",
            "가난한 사람들은 도시 변두리에 ( [[토막집|문화 주택|백화점]] )을 짓고 살았음",
            { note: "일본에서 만든 인공 조미료가 들어왔고, 여름이면 자전거로 냉면을 배달했어요." },
          ],
        },
      },
      {
        speaker: "역사별이",
        conceptId: "erase-spirit",
        hero: "학교에서 우리말을 쓰면 안 된다고? 말도 안 돼!",
        text: "침략 전쟁을 넓힌 일제는 우리 민족이 일본 왕에게 충성하게 만들려 했어요.\n그래서 우리의 민족정신을 지우려는 정책을 폈지요.",
        chalkboard: {
          title: "민족정신을 없애려는 정책",
          lines: [
            "곳곳에 세운 ( [[신사|흥사단|보통학교]] )에 억지로 절을 하게 함",
            "성과 이름을 일본식으로 바꾸고 ( [[일본어|우리말|한글]] ) 사용을 강요함",
            "학교에서는 우리말과 ( [[역사|외교|선거]] )를 배우지 못하게 함",
            "전쟁에 쓸 사람과 ( [[물자|토산품|국가유산]] )를 우리나라에서 강제로 끌어감",
            { note: "놋그릇과 수저까지 빼앗겼고, 일본군 '위안부'로 끌려간 여성들은 큰 고통을 겪었어요." },
          ],
        },
      },
      {
        speaker: "역사별이",
        conceptId: "resistance",
        hero: "그렇게 힘든 때에도 포기하지 않은 사람들이 있었지?",
        text: "그럼요! 우리 역사를 연구하고 글을 써서 민족의식을 일깨운 사람들이 있었어요.\n대한민국 임시 정부는 직접 군대를 만들기도 했답니다.",
        chalkboard: {
          title: "끝까지 이어진 저항",
          lines: [
            "( [[신채호|안창호|이승만]] )는 역사 연구로 우리 역사의 자주성을 밝힘",
            "임시 정부는 ( [[한국광복군|의병|국제 연합군]] )을 만들어 일본과 싸움",
            "광복군은 ( [[미군|소련군|중국군]] )과 국내 진입 작전을 세움",
            { note: "작전을 펼치기 전에 일제가 항복해 계획을 이루지는 못했어요." },
          ],
          photo: { src: "/relics/gwangbokgun_flag.webp", caption: "한국광복군 서명문 태극기", credit: "국가유산청 국가유산포털 · 공공누리 제1유형" },
        },
      },
      {
        speaker: "역사별이",
        hero: "기차와 군대, 두 낱말을 정리 카드에 넣어 볼게!",
        text: "★ [확인문제 1] 정리 카드의 빈칸 ①, ②에 들어갈 알맞은 낱말을 고르세요.",
        reviewConcept: "railway",
        ...withTask({
          type: "document-restore",
          instruction: "",
          docTitle: "3단계 정리 카드",
          docBadge: "📌 일제 통치 시기의 생활",
          segments: [
            { text: "• 일제가 놓은 " },
            { text: "", slotId: "slot-1", slotLabel: "빈칸 ① (교통)" },
            { text: "는 우리나라에서 빼앗은 쌀과 자원을 일본으로 보내는 데 주로 쓰였습니다.\n• 대한민국 임시 정부는 " },
            { text: "", slotId: "slot-2", slotLabel: "빈칸 ② (군대)" },
            { text: "을 만들어 일본과 맞서 싸우려 했습니다." },
          ],
          options: [
            { id: "doc-1", text: "철도", targetSlotId: "slot-1", explanation: "임피역처럼 철도는 쌀과 자원을 실어 나르는 길로 쓰였어요." },
            { id: "doc-2", text: "한국광복군", targetSlotId: "slot-2", explanation: "임시 정부가 만든 군대는 한국광복군이에요." },
            { id: "doc-3", text: "토막집", explanation: "토막집은 가난한 사람들이 도시 변두리에 짓고 살던 집이에요." },
            { id: "doc-4", text: "신사", explanation: "신사는 일제가 억지로 절을 하게 한 곳이에요." },
          ],
          successFeedback: "정리 카드 복원 완료! 철도와 한국광복군을 기억했어요.",
        }),
      },
      {
        speaker: "역사별이",
        hero: "일제가 시킨 일이랑 우리 민족이 지키려 한 일을 나눠 볼래!",
        text: "★ [확인문제 2] 알맞은 바구니에 나누어 담아 보세요.",
        reviewConcept: "erase-spirit",
        ...withTask({
          type: "category-sort",
          instruction: "",
          leftBucketTitle: "일제가 강요한 일",
          leftBucketDesc: "민족정신을 지우려는 정책",
          leftBucketEmoji: "⛓️",
          rightBucketTitle: "우리 민족의 노력",
          rightBucketDesc: "민족을 지키고 나라를 되찾으려는 노력",
          rightBucketEmoji: "🔥",
          items: [
            { id: "force-1", text: "신사에 절하기", emoji: "⛩️", category: "left", explanation: "일제는 전국에 세운 신사에 억지로 절을 하게 했어요." },
            { id: "force-2", text: "일본식 성과 이름 쓰기", emoji: "🏷️", category: "left", explanation: "일제는 성과 이름을 일본식으로 바꾸라고 강요했어요." },
            { id: "force-3", text: "놋그릇과 수저 내놓기", emoji: "🥣", category: "left", explanation: "일제는 무기를 만든다며 금속 물건까지 빼앗아 갔어요." },
            { id: "keep-1", text: "옛 역사 연구하기", emoji: "📚", category: "right", explanation: "신채호는 역사를 연구해 일제의 역사 왜곡에 맞섰어요." },
            { id: "keep-2", text: "한국광복군 만들기", emoji: "🎖️", category: "right", explanation: "임시 정부는 한국광복군을 만들어 일본과의 전쟁에 나섰어요." },
            { id: "keep-3", text: "저항하는 글 쓰기", emoji: "✍️", category: "right", explanation: "일제에 저항하는 글을 써서 민족의식을 일깨웠어요." },
          ],
          successFeedback: "분류 완료! 거센 탄압 속에서도 민족을 지키려는 노력은 멈추지 않았어요.",
        }),
      },
      {
        speaker: "역사별이",
        hero: "도시에서 본 모습이 맞는지 틀린지 가려 볼게!",
        text: "★ [확인문제 3] 일제 통치 시기의 생활에 대한 설명이 맞으면 O, 틀리면 X를 고르세요.",
        reviewConcept: "city",
        ...withTask({
          type: "ox-verdict",
          instruction: "",
          courtTitle: "일제 통치 시기 도시 기록",
          statements: [
            { id: "ox-1", text: "임피역은 넓은 평야에서 거둔 쌀을 모아 일본으로 보내는 길목이었다.", isTrue: true, explanation: "맞아요! 임피역 주변 길은 쌀을 빼앗아 가는 주요 통로였어요." },
            { id: "ox-2", text: "도시의 한국인도 일본인과 똑같이 전기와 근대 시설을 누렸다.", isTrue: false, explanation: "틀렸어요! 한국인이 주로 살던 곳은 전기가 잘 들어오지 않고 공동 우물을 썼어요." },
            { id: "ox-3", text: "인공 조미료가 쓰이면서 음식을 만드는 시간과 비용이 줄었다.", isTrue: true, explanation: "맞아요! 비싼 재료 없이도 국물 맛을 낼 수 있었어요." },
            { id: "ox-4", text: "토막집은 일본인과 부유한 사람들이 살던 집이다.", isTrue: false, explanation: "틀렸어요! 그런 집은 문화 주택이고, 토막집은 가난한 사람들이 변두리에 지은 집이에요." },
          ],
          successFeedback: "정확한 판정이에요! 3단계 노트 내용을 모두 기억하고 있어요.",
        }),
      },
      {
        speaker: "역사별이",
        hero: "세 번째 조각! 어려운 때일수록 우리말과 역사를 지킨 사람들이 고마워.",
        text: "세 번째 [시간의 조각]을 찾았어요! 탄압 속에서도 독립의 노력은 계속됐어요.\n마지막 단계에서는 드디어 찾아온 광복과 그 뒤의 이야기를 만나 봐요!",
      },
    ],
  },
  // ==========================================
  // STAGE 4: 광복과 6·25 전쟁
  // ==========================================
  {
    id: 4,
    title: "4단계: 광복과 6·25 전쟁",
    shortTitle: "광복과 6·25 전쟁",
    concept: "8·15 광복과 정부 수립, 6·25 전쟁과 그 영향",
    mission: "광복의 기쁨과 전쟁의 아픔이 이어지던 때예요! 노트의 빈칸을 채우며 이 시기의 생활과 오늘날까지 남은 영향을 알아보세요!",
    bossName: bossPhases[3].name,
    bossTitle: bossPhases[3].title,
    bossShortName: bossPhases[3].shortName,
    color: "#6d28d9",
    background: "linear-gradient(135deg, #4c1d95, #2e1065)",
    backgroundImage: "/backgrounds/stage4.webp",
    bossImage: bossPhases[3].image,
    dialogue: [
      {
        speaker: "역사별이",
        hero: "전차가 못 지나갈 만큼 사람들이 거리를 꽉 채웠어! 다들 만세를 부르고 있어!",
        text: "1945년 8월이에요! 우리 민족이 드디어 [광복]을 맞이했어요.\n하지만 기쁨 뒤에는 새로운 시련도 기다리고 있었지요. 마지막 조각을 찾으러 가 봐요!",
      },
      {
        speaker: "역사별이",
        conceptId: "liberation",
        hero: "나라를 되찾고 나서 학교랑 생활은 뭐가 달라졌어?",
        text: "독립운동가들의 끊임없는 노력과 제2차 세계 대전에서 연합국이 이긴 덕분에 광복을 맞았어요.\n빼앗겼던 생활도 하나둘 제자리를 찾아갔지요.",
        chalkboard: {
          title: "광복과 달라진 생활",
          lines: [
            "1945년 8월 15일, 나라를 되찾은 일: ( [[광복|정전|분단]] )",
            "( [[김구|홍범도|유관순]] )·이승만 등 임시 정부 지도자들이 나라로 돌아옴",
            "학교에서 ((일본어/우리말*))로 우리글과 역사를 배움",
            "일본식 이름 대신 ( [[원래 성과 이름|일본어|신사]] )을 다시 쓰게 됨",
            { note: "일제가 강제로 없앴던 한글 신문과 잡지도 다시 나오기 시작했어요." },
          ],
          photo: { src: "/relics/hangeul_first_steps.webp", caption: "광복 뒤 펴낸 『한글 첫걸음』", credit: "국립중앙박물관 · 공공누리 제1유형" },
        },
      },
      {
        speaker: "역사별이",
        conceptId: "government",
        hero: "나라를 되찾았으니 이제 정부를 세워야겠네?",
        text: "광복 무렵 38도선을 사이에 두고 남쪽과 북쪽에 서로 다른 나라의 군대가 들어왔어요.\n통일 정부를 세우려 했지만 의견이 엇갈려 쉽지 않았답니다.",
        chalkboard: {
          title: "대한민국 정부 수립",
          lines: [
            "38도선 남쪽에는 미군, 북쪽에는 ( [[소련군|중국군|국제 연합군]] )이 들어옴",
            "( [[국제 연합|조선 총독부|한인 애국단]] )은 선거가 가능한 곳에서만 총선거를 하기로 함",
            "1948년 남한에서만 ( [[5·10 총선거|3·1 운동|6·10 만세 운동]] )를 치러 국회의원을 뽑음",
            "( [[제헌 국회|조선어 학회|임시 정부]] )는 헌법을 만들고 이승만을 대통령으로 뽑음",
            { note: "대한민국 정부는 1948년 8월 15일에 세워졌어요. 나라 이름은 국회의 투표로 정했지요." },
          ],
        },
      },
      {
        speaker: "역사별이",
        conceptId: "korean-war",
        hero: "1950년 6월 25일 새벽에 무슨 일이 일어난 거야?",
        text: "소련의 지원을 받은 북한이 무력으로 한반도를 통일하겠다며 38도선을 넘어 쳐들어왔어요.\n전쟁의 흐름을 차례대로 따라가 봐요.",
        chalkboard: {
          title: "6·25 전쟁의 흐름",
          lines: [
            "북한군의 기습 남침으로 3일 만에 서울을 빼앗기고 ( [[낙동강|압록강|38도선]] ) 남쪽까지 밀림",
            "국군과 국제 연합군이 ( [[인천 상륙 작전|흥남 철수 작전|청산리 대첩]] )으로 서울을 되찾음",
            "( [[중국군|소련군|미군]] )이 북한을 도우러 오자 국군과 국제 연합군은 다시 물러남",
            "1953년 7월 ( [[정전 협정|을사늑약|5·10 총선거]] )이 맺어지고 휴전선이 그어짐",
            { note: "국제 연합군에는 16개 나라가 함께했어요." },
          ],
        },
      },
      {
        speaker: "역사별이",
        conceptId: "refugees",
        hero: "집을 떠난 사람들은 어디서 어떻게 지냈어?",
        text: "많은 피란민이 낙동강 남쪽으로 내려왔고, 임시 수도에는 전국에서 사람들이 모여들었어요.\n먹을 것과 마실 물이 모자라 무척 힘들었지요.",
        chalkboard: {
          title: "피란민의 삶",
          lines: [
            "전쟁 중 피란민이 모여든 임시 수도: ( [[부산|서울|평양]] )",
            "피란민은 산비탈에 움막을 짓거나 ( [[판자|놋그릇|토산품]] )로 집을 지어 살았음",
            "학생들은 ( [[천막 학교|보통학교|신흥 강습소]] )에서 공부를 이어 감",
            "흥남 철수 때 ( [[메러디스 빅토리호|미쓰코시 백화점|임피역]] )는 피란민 1만 4천 명을 태움",
            { note: "고향의 냉면을 그리던 피란민이 부산에서 구한 재료로 만든 음식이 밀면이에요." },
          ],
        },
      },
      {
        speaker: "역사별이",
        conceptId: "war-scars",
        hero: "전쟁이 멈춘 뒤에도 아픔이 계속됐어?",
        text: "6·25 전쟁으로 우리 민족은 엄청난 피해를 입고 오랫동안 아파했어요.\n그 아픔은 오늘날까지 이어지고 있답니다.",
        chalkboard: {
          title: "전쟁이 남긴 상처",
          lines: [
            "많은 민간인과 군인이 다치거나 목숨을 잃고 국토가 황폐해짐",
            "( [[산업 시설|토산품|신사]] )과 도로·다리가 부서지고 수원 화성 같은 국가유산도 훼손됨",
            "가족과 헤어진 ( [[이산가족|의병|독립군]] )과 부모를 잃은 전쟁고아가 생김",
            "남북은 서로를 적으로 여기게 되었고 지금도 ( [[분단|광복|통일]] )이 이어짐",
            { note: "1983년 이산가족 찾기 방송으로 만 명이 넘는 가족이 다시 만났어요." },
          ],
        },
      },
      {
        speaker: "역사별이",
        hero: "두 번의 8월 15일을 정리 카드에 나란히 적어 둘래.",
        text: "★ [확인문제 1] 정리 카드의 빈칸 ①, ②에 들어갈 알맞은 낱말을 고르세요.",
        reviewConcept: "government",
        ...withTask({
          type: "document-restore",
          instruction: "",
          docTitle: "4단계 정리 카드",
          docBadge: "📌 광복과 6·25 전쟁",
          segments: [
            { text: "• 1945년 8월 15일, 우리 민족은 나라를 되찾는 " },
            { text: "", slotId: "slot-1", slotLabel: "빈칸 ① (나라를 되찾음)" },
            { text: "을 맞이했습니다.\n• 3년 뒤 같은 날, 5·10 총선거와 제헌 국회를 거쳐 " },
            { text: "", slotId: "slot-2", slotLabel: "빈칸 ② (나라 이름)" },
            { text: " 정부가 세워졌습니다." },
          ],
          options: [
            { id: "doc-1", text: "광복", targetSlotId: "slot-1", explanation: "일본에 빼앗겼던 나라를 다시 찾은 일을 광복이라고 해요." },
            { id: "doc-2", text: "대한민국", targetSlotId: "slot-2", explanation: "1948년 8월 15일, 새로 세워진 정부의 이름이 대한민국이에요." },
            { id: "doc-3", text: "정전 협정", explanation: "정전 협정은 1953년에 6·25 전쟁의 전투를 멈추며 맺은 약속이에요." },
            { id: "doc-4", text: "조선 공화국", explanation: "나라 이름을 정하는 투표에서 가장 많은 표를 얻은 것은 대한민국이었어요." },
          ],
          successFeedback: "정리 카드 복원 완료! 광복과 대한민국 정부 수립을 기억했어요.",
        }),
      },
      {
        speaker: "역사별이",
        hero: "광복부터 전쟁이 멈출 때까지 차례대로 놓아 볼게!",
        text: "★ [확인문제 2] 일이 일어난 순서대로 카드를 놓아 보세요.",
        reviewConcept: "korean-war",
        ...withTask(orderSequence(
          [
            { id: "o1", text: "8·15 광복", icon: "🎉", order: 1 },
            { id: "o2", text: "5·10 총선거로 국회의원을 뽑음", icon: "🗳️", order: 2 },
            { id: "o3", text: "북한군이 38도선을 넘어 남침함", icon: "⚠️", order: 3 },
            { id: "o4", text: "인천 상륙 작전으로 서울을 되찾음", icon: "⚓", order: 4 },
            { id: "o5", text: "정전 협정으로 휴전선이 생김", icon: "🕊️", order: 5 },
          ],
          "순서 정리 완료! 광복의 기쁨 뒤에 분단과 전쟁의 아픔이 이어졌어요.",
          "일이 일어난 순서에 맞게 카드를 배열하세요.",
        )),
      },
      {
        speaker: "역사별이",
        hero: "여러 나라가 우리나라를 도우러 온 까닭이 궁금해.",
        text: "★ [확인문제 3] 국제 연합이 국제 연합군을 보낸 까닭으로 가장 알맞은 것을 고르세요.",
        reviewConcept: "korean-war",
        choices: choice(
          "북한의 남침을 불법이라고 보았기 때문에",
          [
            ["남한과 북한이 함께 총선거를 치르도록 하려고", "총선거는 전쟁 전인 1948년에 남한에서만 치러졌어요."],
            ["일본군의 무기를 빼앗으려고", "일본군의 무장 해제는 광복 무렵 미군과 소련군이 들어온 이유예요."],
            ["임시 수도를 상하이로 옮기려고", "전쟁 중 임시 수도는 부산이었고, 상하이는 대한민국 임시 정부가 세워진 곳이에요."],
          ],
          "국제 연합은 북한의 남침을 불법이라고 판단해 16개 나라가 참여한 국제 연합군을 보냈어요.",
        ),
      },
      {
        speaker: "역사별이",
        hero: "마지막 확인! 맞는 말과 틀린 말을 골라낼게.",
        text: "★ [확인문제 4] 광복과 6·25 전쟁에 대한 설명이 맞으면 O, 틀리면 X를 고르세요.",
        reviewConcept: "war-scars",
        ...withTask({
          type: "ox-verdict",
          instruction: "",
          courtTitle: "광복과 6·25 전쟁 기록",
          statements: [
            { id: "ox-1", text: "5·10 총선거는 남한과 북한에서 함께 치러졌다.", isTrue: false, explanation: "틀렸어요! 국제 연합의 결정에 따라 남한에서만 치러졌어요." },
            { id: "ox-2", text: "광복 뒤 일제가 없앴던 한글 신문이 다시 나왔다.", isTrue: true, explanation: "맞아요! 강제로 폐간되었던 한글 신문과 잡지가 다시 나왔어요." },
            { id: "ox-3", text: "전쟁 중 학생들은 천막을 친 임시 학교에서 공부했다.", isTrue: true, explanation: "맞아요! 어려운 피란 생활 속에서도 천막 학교에서 배움을 이어 갔어요." },
            { id: "ox-4", text: "정전 협정이 맺어지면서 남한과 북한은 하나로 통일되었다.", isTrue: false, explanation: "틀렸어요! 휴전선을 경계로 분단이 오늘날까지 이어지고 있어요." },
          ],
          successFeedback: "정확한 판정이에요! 4단계 노트 내용을 모두 기억하고 있어요.",
        }),
      },
      {
        speaker: "역사별이",
        hero: "네 조각을 다 모았어! 오늘의 우리나라가 그냥 생긴 게 아니었구나.",
        text: "마지막 [시간의 조각]까지 다 모았어요! 나라를 되찾고 지켜 낸 사람들 덕분이에요.\n이제 세 수호령을 물리쳐야 집으로 가는 문이 열려요!",
      },
    ],
  },
  // ==========================================
  // STAGE 5: 역사 카드배틀 (1~4단계 정복자 무제한 입장 모드)
  // ==========================================
  {
    id: 5,
    title: "5단계: 역사 카드배틀 - 세 수호령과의 결전",
    shortTitle: "역사 카드배틀",
    concept: "전 범위 총력 배틀",
    mission: "1~4단계에서 쌓은 역사 지식과 카드 전략으로 세 수호령을 차례로 물리치세요!",
    bossName: "세 수호령",
    bossTitle: "시간의 문을 지키는 세 수호령",
    bossShortName: "수호령",
    color: "#dc2626",
    background: "linear-gradient(135deg, #450a0a, #1c1917)",
    bossImage: bossPhases[3].image,
    dialogue: [
      {
        speaker: "역사별이",
        text: "수호자님, 1~4단계를 모두 마쳤군요! 이제 시간의 문을 지키는 [세 수호령]과 겨룰 차례예요.\n수호령마다 앞 단계의 내용으로 문제를 내요.\n문제를 맞혀 행동력을 얻고, 보스의 태세에 맞는 카드로 공격해 보세요!",
      },
    ],
  },
];

// 역사별이의 설명 전에는 장면마다 직접 쓴 주인공의 관찰·질문(hero)을 한 차례 둔다.
// 이렇게 만들어진 별도 노드는 화면에서도 실제 발화 순서로 표시된다.
for (const stage of stages.filter((item) => item.id >= 1 && item.id <= 4)) {
  stage.dialogue = stage.dialogue.flatMap((node) => {
    const { hero, ...guideNode } = node;
    if (!hero) return [guideNode];
    return [{ speaker: "주인공", text: hero }, guideNode];
  });
}

// 캐릭터 선택지
export type CharacterId = "bau" | "ara" | "narae";
export type Character = {
  id: CharacterId;
  name: string;
  role: string;
  meaning: string;
  image: string;
  desc?: string;
  avatar?: string;
  physicalDefense: number;
  magicDefense: number;
};

export const characters: Character[] = [
  {
    id: "bau",
    name: "바우",
    role: "역사 지킴이",
    meaning: "바위처럼 단단하게 우리 역사를 지키는 든든한 수호자",
    image: "/characters/bau-historical-v2.webp",
    desc: "단단한 역사 지식으로 동료를 지키는 든든한 지킴이",
    avatar: "🛡️",
    physicalDefense: 4,
    magicDefense: 0,
  },
  {
    id: "ara",
    name: "아라",
    role: "역사 꿈나무",
    meaning: "넓은 바다처럼 깊은 지혜로 옛 유물과 유적의 진실을 찾는 모험가",
    image: "/characters/ara-historical-v2.webp",
    desc: "예리한 눈썰미로 옛 유적과 유물의 비밀을 파헤치는 꿈나무",
    avatar: "🔍",
    physicalDefense: 2,
    magicDefense: 2,
  },
  {
    id: "narae",
    name: "나래",
    role: "시간 길잡이",
    meaning: "역사에 날개를 달아주듯 시간의 흐름과 문명을 꿰뚫어 보는 길잡이",
    image: "/characters/narae-historical-v2.webp",
    desc: "역사의 흐름과 시간을 꿰뚫어 보는 지혜로운 길잡이",
    avatar: "⚡",
    physicalDefense: 0,
    magicDefense: 4,
  },
];
