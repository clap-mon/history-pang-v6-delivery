"use client";
/* eslint-disable @next/next/no-img-element */

import { Fragment, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { advanceBattleRound, applyRewardItem, battleFinished, battleWon, beginActionPhase, createBattleState, playCombatCard, recoverComboHp, redrawHand, resolveEnemyTurn, retryQuizAfterWrong, rewardQuizAnswer, type BattleState } from "@/lib/battle-engine";
import { clearAdventureProgress, loadRewardItems, loadUnlockedBossPhase, loadUnlockedStage, saveRewardItems, saveUnlockedBossPhase, saveUnlockedStage, saveUsedRewardItems } from "@/lib/adventure-progress";
import type { CombatCard } from "@/lib/card-draw";
import { bossPhases, characters, stages, type BossPhase, type DialogueChoice, type DialogueMultiCheck as DialogueMultiCheckData, type DialogueVisualItem, type GrammarConceptCard, type GuideSideWings, type InteractiveTask, type StageId , type ActivityReason, type EvidenceCaseTask, type SortExhibitTask } from "@/lib/content";
import { chalkSlots, parseChalkboard, type Chalkboard } from "@/lib/chalkboard";
import { GAME } from "@/lib/game-config";
import { type AdventureDifficulty } from "@/lib/game";
import { bossQuizStage, generateStageQuiz, type QuizOption } from "@/lib/quiz-engine";
import { getAudioMuted, toggleAudioMuted, playBattleSound, type BattleSound } from "@/lib/battle-sound";
import { canUseRewardItem, rewardItemById, rewardItemForStage, rewardItems, type RewardItem, type RewardItemId } from "@/lib/reward-items";
import { StageEraIcon } from "@/lib/era-icons";
import { adventureTitles, clearCollectedTitles, clearTitleCampaignProgress, evaluateClearTitles, loadCollectedTitleIds, loadTitleCampaignProgress, saveCollectedTitleId, saveTitleCampaignStage, titleTierDetails, type AdventureTitle, type CampaignProgress } from "@/lib/titles";
import { isActualSmartphone } from "@/lib/mobile-device";

type Screen = "landing" | "setup" | "dialogue" | "route_map" | "boss_alert" | "battle" | "result" | "ending";
type BattleLogKind = "quiz" | "card" | "enemy" | "item" | "draw" | "system";
type BattleLogEntry = { id: number; round: number; kind: BattleLogKind; actor: string; text: string; detail?: string };

const battleLogKindLabel: Record<BattleLogKind, string> = { quiz: "퀴즈", card: "카드", enemy: "적", item: "아이템", draw: "드로우", system: "전투" };
const MOBILE_NOTICE_DISMISSED_KEY = `${GAME.id}-mobile-notice-dismissed`;

// 마지막 글자에 받침이 있으면 "이", 없으면 "가"를 붙인다.
// 스마트폰 안내 여부는 브라우저에서만 알 수 있다. 서버 렌더링에서는 "안내 없음"으로 두고,
// 브라우저에서 처음 그릴 때 실제 값을 읽는다(useSyncExternalStore). 값이 바뀌지 않으므로 구독은 하지 않는다.
const subscribeNothing = () => () => {};
function needsMobileNotice() {
  return sessionStorage.getItem(MOBILE_NOTICE_DISMISSED_KEY) !== "1" && isActualSmartphone(navigator);
}

function subjectParticle(word: string) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return "이(가)";
  return code % 28 ? "이" : "가";
}

// 마지막 글자에 받침이 있으면 "을", 없으면 "를"을 붙인다.
function objectParticle(word: string) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return "을(를)";
  return code % 28 ? "을" : "를";
}

function describeAttackNotice(notice: BattleState["attackNotice"]) {
  if (!notice) return undefined;
  const damageLabel = notice.kind === "physical" ? "물리" : "마법";
  if (notice.defense === 0) return `${damageLabel} 피해 ${notice.damage}`;
  if (notice.brokeShield) return `${damageLabel} 방어막 파괴${notice.damage ? ` · 남은 피해 ${notice.damage}` : ""}`;
  return `${damageLabel} 방어막 -${notice.shieldDamage} · 내구도 ${notice.shieldRemaining}`;
}

function describeEnemyAttack(notice: NonNullable<BattleState["enemyAttackNotice"]>) {
  if (notice.damage > 0) return `집중력 -${notice.damage}`;
  if (notice.outcome === "dodge") return "회피 성공 · 빈틈 포착 +2";
  if (notice.outcome === "shield") return "시험 방패로 완전 방어 · 반격 준비 +2";
  return "방어 성공";
}

function formatBattleLogMeta(log: BattleLogEntry) { return `${log.round}R · ${battleLogKindLabel[log.kind]}${log.kind === "quiz" ? "" : ` · ${log.actor}`}`; }

function describeRoundStart(battle: BattleState, difficulty: AdventureDifficulty) {
  return difficulty === "easy" ? `${battle.bossStance} 태세 · ${battle.intent.label} 예정` : `${battle.bossStance} 태세`;
}

function useDialogKeyboard(open: boolean, onClose: () => void) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFirst = () => dialogRef.current?.querySelector<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')?.focus();
    const timer = window.setTimeout(focusFirst, 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusables = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      if (!focusables.length) return;
      const current = document.activeElement;
      const index = focusables.indexOf(current as HTMLElement);
      if (event.shiftKey && (index <= 0 || current === dialogRef.current)) { event.preventDefault(); focusables.at(-1)?.focus(); }
      else if (!event.shiftKey && index === focusables.length - 1) { event.preventDefault(); focusables[0]?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { window.clearTimeout(timer); document.removeEventListener("keydown", onKeyDown); window.setTimeout(() => returnFocusRef.current?.focus(), 0); };
  }, [open]);
  return dialogRef;
}

function getCardPreview(battle: BattleState, card: CombatCard) {
  if (card.effect === "physical" || card.effect === "magic") {
    const defense = card.effect === "physical" ? battle.bossArmor : battle.bossBarrier;
    const label = card.effect === "physical" ? "물리 방어" : "마법 결계";
    const bonus = card.effect === "physical" && defense === 0 ? card.exposedBonus ?? 0 : 0;
    const power = card.power + battle.attackBoost + bonus;
    const bypass = Math.min(card.pierce ?? 0, power);
    const shieldDamage = Math.min(defense, Math.max(0, power - bypass));
    const damage = defense > 0 ? bypass + Math.max(0, power - bypass - defense) : power * (battle.confusedTurns > 0 ? 2 : 1);
    return defense > 0 ? `${label} ${defense} → ${defense - shieldDamage} · 피해 ${damage}` : `보스 HP ${battle.bossHp} → ${Math.max(0, battle.bossHp - damage)}`;
  }
  if (card.effect === "heal") return `집중력 ${battle.playerHp} → ${Math.min(battle.maxPlayerHp, battle.playerHp + card.power)}`;
  if (card.effect === "analyze") return `방어·결계 ${Math.max(battle.bossArmor, battle.bossBarrier)} → ${Math.max(0, Math.max(battle.bossArmor, battle.bossBarrier) - card.power)}`;
  if (card.effect === "guard" || card.effect === "focus-guard") return "다음 물리 공격 완전 방어";
  if (card.effect === "dodge") return "다음 보스 공격 완전 회피";
  if (card.effect === "magic-ward") return `다음 마법 피해 -${card.power}`;
  if (card.effect === "boost") return `다음 직접 공격 +${card.power}`;
  return "손패 2장 새로 뽑기";
}

// 칠판 판서 중심이라 미리 받아 둘 큰 그림이 없다. 사진을 넣으면 여기에 추가한다.
const PRELOAD_DIAGRAMS: string[] = [];

const preloadedDiagramSet = new Set<string>();
function preloadDiagramImages(urls: string[]) {
  if (typeof window === "undefined") return;
  for (const url of urls) {
    if (!url || preloadedDiagramSet.has(url)) continue;
    preloadedDiagramSet.add(url);
    const img = new Image();
    img.decoding = "async";
    img.src = url;
  }
}

function AudioToggle({ isMuted, onToggle }: { isMuted: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={`audio-toggle-chip ${isMuted ? "muted" : "active"}`}
      onClick={onToggle}
      title={isMuted ? "음소거 해제 (단축키 M)" : "음소거 (단축키 M)"}
      aria-label={isMuted ? "음소거 해제" : "음소거"}
    >
      <span className="audio-icon">{isMuted ? "🔇" : "🔊"}</span>
      <span className="audio-label">{isMuted ? "음소거" : "소리 켬"}</span>
      <span className="audio-key">M</span>
    </button>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [stageId, setStageId] = useState<StageId>(1);
  const [characterId, setCharacterId] = useState<(typeof characters)[number]["id"]>("bau");
  const [difficulty, setDifficulty] = useState<AdventureDifficulty>("normal");
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [resolvedChoice, setResolvedChoice] = useState<number | null>(null);
  const [choiceFeedback, setChoiceFeedback] = useState("");
  const [wrongChoices, setWrongChoices] = useState<number[]>([]);
  const [solvedNodes, setSolvedNodes] = useState<number[]>([]);
  const [reviewReturnIndex, setReviewReturnIndex] = useState<number | null>(null);
  const [unlocked, setUnlocked] = useState<StageId>(1);
  const [routeTargetStage, setRouteTargetStage] = useState<StageId>(2);
  const [resetOpen, setResetOpen] = useState(false);
  const [session, setSession] = useState("history-v2");
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [bossPhase, setBossPhase] = useState<BossPhase>(1);
  const [bossUnlockedPhase, setBossUnlockedPhase] = useState<BossPhase>(1);
  const [showPhaseTransition, setShowPhaseTransition] = useState(false);
  const [battleLogs, setBattleLogs] = useState<BattleLogEntry[]>([]);
  const battleLogId = useRef(0);
  const [answered, setAnswered] = useState<QuizOption | null>(null);
  const [quizHit, setQuizHit] = useState(false);
  const [ownedItems, setOwnedItems] = useState<RewardItemId[]>([]);
  const [usedItems, setUsedItems] = useState<RewardItemId[]>([]);
  const [earnedItem, setEarnedItem] = useState<RewardItem | null>(null);
  const [acquiredRelic, setAcquiredRelic] = useState<RewardItem | null>(null);
  const [pendingRouteTarget, setPendingRouteTarget] = useState<StageId | null>(null);
  const [earnedTitles, setEarnedTitles] = useState<AdventureTitle[]>([]);
  const [collectedTitleIds, setCollectedTitleIds] = useState<string[]>([]);
  const [titleCampaignProgress, setTitleCampaignProgress] = useState<CampaignProgress>({});
  const isSmartphoneVisitor = useSyncExternalStore(subscribeNothing, needsMobileNotice, () => false);
  const [mobileNoticeDismissed, setMobileNoticeDismissed] = useState(false);
  const showMobileNotice = isSmartphoneVisitor && !mobileNoticeDismissed;
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    // 저장된 소리 설정은 화면이 뜬 뒤에 읽는다 (서버 렌더링과 어긋나지 않게).
    const timer = window.setTimeout(() => setIsMuted(getAudioMuted()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleToggleAudio = () => {
    const next = toggleAudioMuted();
    setIsMuted(next);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        handleToggleAudio();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const stage = stages[stageId - 1];
  const character = characters.find((item) => item.id === characterId) ?? characters[0];
  const node = stage.dialogue[dialogueIndex];

  // 전투 중에는 보스 단계에 맞는 시대별 퀴즈를 라운드별로 No-Repeat 생성 (중복 및 타 시대 혼입 방지)
  const quiz = useMemo(() => {
    if (screen === "battle") {
      const mappedStageId = bossQuizStage(bossPhase, battle?.round ?? 1);
      return generateStageQuiz(mappedStageId, battle?.round ?? 1, session);
    }
    return generateStageQuiz(stageId, 1, session);
  }, [screen, bossPhase, stageId, battle?.round, session]);

  const dismissMobileNotice = () => {
    sessionStorage.setItem(MOBILE_NOTICE_DISMISSED_KEY, "1");
    setMobileNoticeDismissed(true);
  };

  useEffect(() => {
    const idleTimer = window.setTimeout(() => {
      preloadDiagramImages(PRELOAD_DIAGRAMS);
    }, 150);
    return () => window.clearTimeout(idleTimer);
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { setUnlocked(loadUnlockedStage(localStorage)); setBossUnlockedPhase(loadUnlockedBossPhase(localStorage)); setOwnedItems(loadRewardItems(localStorage)); setUsedItems([]); saveUsedRewardItems(localStorage, []); setCollectedTitleIds(loadCollectedTitleIds(localStorage)); setTitleCampaignProgress(loadTitleCampaignProgress(localStorage)); }, 0); return () => window.clearTimeout(timer); }, []);
  useEffect(() => { document.documentElement.classList.toggle("quiz-hit", quizHit); return () => document.documentElement.classList.remove("quiz-hit"); }, [quizHit]);
  useEffect(() => { if (!quizHit) return; const timer = window.setTimeout(() => setQuizHit(false), 820); return () => window.clearTimeout(timer); }, [quizHit]);
  useEffect(() => { const enemyTurn = screen === "battle" && battle?.phase === "enemy" && !battleFinished(battle); document.documentElement.classList.toggle("enemy-turn", enemyTurn); return () => document.documentElement.classList.remove("enemy-turn"); }, [battle, screen]);
  useEffect(() => { const recover = (event: Event) => { const amount = event instanceof CustomEvent ? event.detail : 0; if (screen === "battle" && battle) { const next = recoverComboHp(battle, amount); setBattle(next); if (next !== battle) addBattleLog({ actor: "정답 연쇄", detail: `집중력 +${amount}`, kind: "system", round: battle.round, text: "연쇄 보상 회복" }); } }; window.addEventListener("combo-recover", recover); return () => window.removeEventListener("combo-recover", recover); }, [battle, screen]);
  useEffect(() => { if (screen !== "battle" || !battle || battle.phase !== "enemy" || battleFinished(battle)) return; const timer = window.setTimeout(() => { triggerBattleEffect("stance"); const next = advanceBattleRound(battle, stageId, difficulty, session); setBattle(next); addBattleLog({ actor: "시스템", detail: describeRoundStart(next, difficulty), kind: "system", round: next.round, text: `${next.round}라운드 시작` }); setAnswered(null); }, 1100); return () => window.clearTimeout(timer); }, [battle, difficulty, screen, session, stageId]);
  useEffect(() => {
    if (screen !== "battle" || !battle || battle.phase !== "enemy" || !battleFinished(battle)) return;
    const timer = window.setTimeout(() => {
      finishBattleRef.current(battle);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [battle, screen]);
  useEffect(() => {
    if (screen !== "battle" || battle?.phase !== "reward") return;
    if (!answered?.isCorrect) return;
    const timer = window.setTimeout(() => {
      setBattle(beginActionPhase(battle));
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [answered, battle, screen]);

  function beginStage() {
    if (stageId === 5) {
      // 5단계(역사 카드배틀): 1~4단계 정복자를 위한 3페이즈 보스 총력전으로 즉시 출격!
      setScreen("boss_alert");
      return;
    }
    resetDialogueProgress();
    setScreen("dialogue");
  }
  function resetDialogueProgress() {
    setDialogueIndex(0);
    setResolvedChoice(null);
    setChoiceFeedback("");
    setWrongChoices([]);
    setSolvedNodes([]);
    setReviewReturnIndex(null);
  }
  function chooseDialogue(choice: DialogueChoice, index: number) {
    playBattleSound(choice.correct ? "correct" : "wrong");
    setResolvedChoice(choice.correct ? index : -1);
    setChoiceFeedback(choice.feedback);
    if (!choice.correct) setWrongChoices((indexes) => [...indexes, index]);
  }
  // 장면을 떠날 때 맞힌 문제를 기억해, 돌아와도 다시 풀지 않게 합니다.
  function leaveCurrentNode() {
    if (resolvedChoice !== null && resolvedChoice >= 0) setSolvedNodes((nodes) => nodes.includes(dialogueIndex) ? nodes : [...nodes, dialogueIndex]);
    setResolvedChoice(null);
    setChoiceFeedback("");
    setWrongChoices([]);
  }
  function openReview() {
    const target = stage.dialogue.findIndex((item) => item.conceptId === node.reviewConcept);
    if (target < 0) return;
    leaveCurrentNode();
    setReviewReturnIndex(dialogueIndex);
    setDialogueIndex(target);
  }
  
  // 🏛️ 4단계 개념 탐구 순차 진행 로직 (스테이지 클리어 시 노선도 화면으로 이동해 다음 시대로 안내)
  function nextDialogue() {
    if (reviewReturnIndex !== null) {
      setDialogueIndex(reviewReturnIndex);
      setReviewReturnIndex(null);
      return;
    }
    const hasChalkQuiz = Boolean(node.chalkboard && chalkSlots(node.chalkboard).length);
    if ((node.choices || node.multiCheck || node.interactiveTask || hasChalkQuiz) && (resolvedChoice === null || resolvedChoice === -1) && !solvedNodes.includes(dialogueIndex)) return;
    if (dialogueIndex < stage.dialogue.length - 1) {
      leaveCurrentNode();
      setDialogueIndex((value) => value + 1);
      return;
    }
    // 현재 스테이지 탐구 완료!
    if (stageId < 4) {
      const nextStage = (stageId + 1) as StageId;
      setUnlocked((u) => {
        const nextUnlocked = Math.max(u, nextStage) as StageId;
        saveUnlockedStage(localStorage, nextUnlocked);
        return nextUnlocked;
      });
      // 아이템 보상
      const reward = rewardItemForStage(stageId);
      if (reward) {
        if (!ownedItems.includes(reward.id)) {
          const nextItems = [...ownedItems, reward.id];
          setOwnedItems(nextItems);
          saveRewardItems(localStorage, nextItems);
        }
        setPendingRouteTarget(nextStage);
        setAcquiredRelic(reward);
        return;
      }
      setResolvedChoice(null);
      setChoiceFeedback("");
      setRouteTargetStage(nextStage);
      setScreen("route_map");
    } else if (stageId === 4) {
      // 4단계까지 완수! -> 5단계(파이널 존: 역사 카드배틀) 영구 해금 및 노선도 안내!
      setUnlocked((u) => {
        const nextUnlocked = Math.max(u, 5) as StageId;
        saveUnlockedStage(localStorage, nextUnlocked);
        return nextUnlocked;
      });
      const reward = rewardItemForStage(4);
      if (reward) {
        if (!ownedItems.includes(reward.id)) {
          const nextItems = [...ownedItems, reward.id];
          setOwnedItems(nextItems);
          saveRewardItems(localStorage, nextItems);
        }
        setPendingRouteTarget(5);
        setAcquiredRelic(reward);
        return;
      }
      setResolvedChoice(null);
      setChoiceFeedback("");
      setRouteTargetStage(5);
      setScreen("route_map");
    } else {
      // 5단계(역사 카드배틀) 대화 종료 시 즉시 보스전 출격
      setScreen("boss_alert");
    }
  }

  function prevDialogue() { if (dialogueIndex > 0) { leaveCurrentNode(); setReviewReturnIndex(null); setDialogueIndex((value) => value - 1); } }
  function handleCloseRelicModal() {
    const target = pendingRouteTarget;
    setAcquiredRelic(null);
    setResolvedChoice(null);
    setChoiceFeedback("");
    if (target) {
      setRouteTargetStage(target);
      setPendingRouteTarget(null);
      setScreen("route_map");
    }
  }
  function addBattleLog(entry: Omit<BattleLogEntry, "id">) { battleLogId.current += 1; setBattleLogs((logs) => [...logs, { ...entry, id: battleLogId.current }].slice(-10)); }
  
  // 👹 보스전 시작 (Phase 1, 2, 3 지원)
  function startBossBattle(phase: BossPhase = 1) {
    setBossPhase(phase);
    setShowPhaseTransition(false);
    const nextSession = `${Date.now()}-${Math.random()}`;
    const nextBattle = createBattleState(stageId, difficulty, nextSession, character, phase);
    setSession(nextSession);
    battleLogId.current = 0;
    setBattleLogs([]);
    setBattle(nextBattle);
    addBattleLog({ actor: "시스템", detail: `${bossPhases[phase].name} 출현!`, kind: "system", round: 1, text: `${phase}단계 배틀 시작` });
    setAnswered(null);
    setQuizHit(false);
    setEarnedItem(null);
    setEarnedTitles([]);
    // 🏛️ 새로운 전투 시작 시 사용된 아이템 리셋 (새 전투 및 페이즈마다 재사용 가능)
    setUsedItems([]);
    saveUsedRewardItems(localStorage, []);
    setScreen("battle");
  }

  function triggerBattleEffect(effect: BattleSound) {
    try {
      playBattleSound(effect);
    } catch {
      // 효과음 실패가 전투 턴 진행, 공격 모션, HP 변화를 중단시키지 않도록 안전 방어
    }
  }
  function answerQuiz(option: QuizOption) { if (!battle || answered || battle.phase !== "quiz") return; triggerBattleEffect(option.isLucky ? "lucky" : option.isBomb ? "bomb" : option.isCorrect ? "correct" : "wrong"); const next = rewardQuizAnswer(battle, option.isCorrect, option.isLucky, option.isBomb); setAnswered(option); setQuizHit(!option.isCorrect); setBattle(next); addBattleLog({ actor: "퀴즈", detail: option.isCorrect ? `행동력 +${next.energy}${option.isLucky ? " · 럭키 정답" : ""}` : `집중력 -${battle.playerHp - next.playerHp}${option.isBomb ? " · 폭탄 오답" : ""}`, kind: "quiz", round: battle.round, text: option.isCorrect ? "정답 선택" : "오답 선택" }); }
  function continueToAction() { if (!battle || battle.phase !== "reward" || !answered?.isCorrect) return; setBattle(beginActionPhase(battle)); }

  function retryQuiz() { if (!battle || battle.phase !== "reward") return; if (battle.playerHp <= 0) { setScreen("result"); return; } setBattle(retryQuizAfterWrong(battle)); setAnswered(null); }
  function playCard(card: CombatCard) { if (!battle) return; triggerBattleEffect(card.effect === "magic" ? "magic" : card.effect === "guard" || card.effect === "focus-guard" || card.effect === "magic-ward" || card.effect === "heal" ? "guard" : card.effect === "dodge" ? "dodge" : "physical"); const next = playCombatCard(battle, card.instanceId); setBattle(next); const supportDetails: Partial<Record<CombatCard["effect"], string>> = { guard: "다음 물리 공격 무효", "focus-guard": "물리 무효 · 집중력 +2", "magic-ward": `마법 피해 ${card.power} 감소`, dodge: "다음 공격 완전 회피", heal: `집중력 +${card.power}`, boost: `다음 직접 공격 +${card.power}`, analyze: `방어·결계 -${card.power}`, accelerate: "오래된 카드 버림 · 2장 드로우" }; addBattleLog({ actor: battle.playerName, detail: describeAttackNotice(next.attackNotice) ?? supportDetails[card.effect] ?? next.message, kind: "card", round: battle.round, text: `${card.name} 사용` }); }
  function redraw() { if (!battle) return; const next = redrawHand(battle, stageId, session); setBattle(next); addBattleLog({ actor: battle.playerName, detail: `카드 ${battle.hand.length}장 교체 · 행동력 -2`, kind: "draw", round: battle.round, text: "새로 뽑기" }); }
  function useItem(itemId: RewardItemId) {
    if (!battle || !ownedItems.includes(itemId) || usedItems.includes(itemId) || !canUseRewardItem(itemId, battle.phase)) return;
    if (itemId === "gate-guardian-crystal") playBattleSound("relic_compass");
    else if (itemId === "mist-guide-crystal") playBattleSound("relic_urn");
    else if (itemId === "precision-gear-crystal") playBattleSound("relic_key");
    else if (itemId === "truth-mirror-crystal") playBattleSound("relic_mirror");
    triggerBattleEffect(itemId === "mist-guide-crystal" ? "confusion" : "lucky");
    const next = applyRewardItem(battle, itemId); setBattle(next); addBattleLog({ actor: "가방", detail: next.message, kind: "item", round: battle.round, text: rewardItems.find((item) => item.id === itemId)?.name ?? "고유 유물 사용" });
    const nextUsed = [...usedItems, itemId]; setUsedItems(nextUsed); saveUsedRewardItems(localStorage, nextUsed);
  }
  function endTurn() { if (!battle) return; triggerBattleEffect("enemy"); const next = resolveEnemyTurn(battle); setBattle(next); const defeated = next.bossHp <= 0; const bossShortName = bossPhases[bossPhase].shortName; const detail = next.enemyAttackNotice ? describeEnemyAttack(next.enemyAttackNotice) : defeated ? next.message : battle.confusedTurns > 0 ? "혼란으로 공격을 건너뜀" : battle.intent.type === "prepare" ? "공격을 준비함" : next.message; addBattleLog({ actor: bossShortName, detail, kind: "enemy", round: battle.round, text: next.enemyAttackNotice ? battle.intent.label : defeated ? "보스 격파" : battle.confusedTurns > 0 ? "행동 불가" : "행동 준비" }); }
  function continueAfterEnemy() { if (!battle) return; if (battleFinished(battle)) { finishBattle(battle); return; } triggerBattleEffect("stance"); setBattle(advanceBattleRound(battle, stageId, difficulty, session, bossPhase)); setAnswered(null); }
  
  // ⚔️ 보스전 종료 시 진화 및 최종 승리 처리
  function finishBattle(finalState: BattleState) {
    setBattle(finalState);
    if (battleWon(finalState)) {
      if (bossPhase < 3) {
        // 다음 페이즈 해금 및 저장!
        const nextPhase = (bossPhase + 1) as BossPhase;
        setBossUnlockedPhase((prev) => {
          const updated = Math.max(prev, nextPhase) as BossPhase;
          saveUnlockedBossPhase(localStorage, updated);
          return updated;
        });
        // 다음 페이즈로 보스 진화 컷씬 오픈 및 경쾌한 승리 사운드 연출!
        setShowPhaseTransition(true);
        triggerBattleEffect("phase_clear");
      } else {
        // 3페이즈 최종 패왕까지 격파! 전설의 역사 수호자 달성!
        triggerBattleEffect("victory");
        const campaignProgress = saveTitleCampaignStage(localStorage, titleCampaignProgress, characterId, difficulty, 4);
        setTitleCampaignProgress(campaignProgress);
        // 3페이즈 최종 패왕 격파 시에도 5단계(역사 카드배틀) 영구 해금 보존
        setUnlocked((u) => {
          const nextUnlocked = Math.max(u, 5) as StageId;
          saveUnlockedStage(localStorage, nextUnlocked);
          return nextUnlocked;
        });
        let nextCollectedIds = collectedTitleIds;
        const newlyEarned: AdventureTitle[] = [];
        const collectTitle = (title: AdventureTitle | undefined) => {
          if (!title || nextCollectedIds.includes(title.id)) return;
          nextCollectedIds = saveCollectedTitleId(localStorage, title.id);
          newlyEarned.push(title);
        };
        const candidateTitles = evaluateClearTitles(characterId, finalState.score, nextCollectedIds);
        candidateTitles.forEach((t) => collectTitle(t));
        if (newlyEarned.length > 0) {
          setCollectedTitleIds(nextCollectedIds);
          setEarnedTitles(newlyEarned);
        }
        setScreen("ending");
      }
    } else {
      setScreen("result");
    }
  }
  // 전투 종료 타이머가 항상 최신 finishBattle을 부르도록 렌더 뒤에 맞춰 둔다.
  const finishBattleRef = useRef(finishBattle);
  useEffect(() => { finishBattleRef.current = finishBattle; });

  function resetProgress() { clearAdventureProgress(localStorage); clearCollectedTitles(localStorage); clearTitleCampaignProgress(localStorage); setUnlocked(1); setBossUnlockedPhase(1); setStageId(1); setOwnedItems([]); setUsedItems([]); setEarnedItem(null); setEarnedTitles([]); setCollectedTitleIds([]); setTitleCampaignProgress({}); setResetOpen(false); }

  function handleRefreshTitles(): string[] {
    if (typeof window !== "undefined") {
      const latest = loadCollectedTitleIds(localStorage);
      setCollectedTitleIds(latest);
      return latest;
    }
    return collectedTitleIds;
  }

  let currentView: React.ReactNode = null;
  if (screen === "landing") {
    currentView = <Landing collectedTitleIds={collectedTitleIds} isMuted={isMuted} onRefreshTitles={handleRefreshTitles} onStart={() => setScreen("setup")} onToggleAudio={handleToggleAudio} />;
  } else if (screen === "setup") {
    currentView = <Setup characterId={characterId} difficulty={difficulty} isMuted={isMuted} onBack={() => setScreen("landing")} onCancelReset={() => setResetOpen(false)} onCharacter={setCharacterId} onConfirmReset={resetProgress} onDifficulty={setDifficulty} onOpenReset={() => setResetOpen(true)} onStage={setStageId} onStart={beginStage} onToggleAudio={handleToggleAudio} resetOpen={resetOpen} selectedStage={stageId} unlocked={unlocked} />;
  } else if (screen === "dialogue") {
    currentView = (
      <>
        <Dialogue character={character} choiceFeedback={choiceFeedback} isMuted={isMuted} node={node} nodeIndex={dialogueIndex} onBack={() => setScreen("setup")} onChoice={chooseDialogue} onOpenReview={openReview} onMultiResolved={() => { playBattleSound("correct"); setResolvedChoice(0); }} onNext={nextDialogue} onPrev={prevDialogue} onTaskResolved={() => { playBattleSound("correct"); setResolvedChoice(0); }} onToggleAudio={handleToggleAudio} resolvedChoice={resolvedChoice} reviewing={reviewReturnIndex !== null} solved={solvedNodes.includes(dialogueIndex)} stage={stage} wrongChoices={wrongChoices} />
        {acquiredRelic && (
          <RelicAcquiredModal
            onClose={handleCloseRelicModal}
            relic={acquiredRelic}
          />
        )}
      </>
    );
  } else if (screen === "route_map") {
    currentView = (
      <RouteMapScreen
        character={character}
        onBack={() => setScreen("setup")}
        onProceed={(stageToGo) => {
          if (stageToGo === 5) {
            setStageId(5);
            setScreen("boss_alert");
          } else {
            setStageId(stageToGo);
            resetDialogueProgress();
            setScreen("dialogue");
          }
        }}
        targetStage={routeTargetStage}
        unlocked={unlocked}
      />
    );
  } else if (screen === "boss_alert") {
    currentView = <BossAlert character={character} unlockedPhase={bossUnlockedPhase} onStartBattle={(phase) => startBossBattle(phase)} />;
  } else if (screen === "battle" && battle) {
    currentView = (
      <>
        <Battle answered={answered} battle={battle} bossPhase={bossPhase} character={character} difficulty={difficulty} isMuted={isMuted} logs={battleLogs} onAnswer={answerQuiz} onContinueEnemy={continueAfterEnemy} onContinueToAction={continueToAction} onEndTurn={endTurn} onExit={() => { setUsedItems([]); saveUsedRewardItems(localStorage, []); setScreen("setup"); }} onPlayCard={playCard} onRedraw={redraw} onRetryQuiz={retryQuiz} onToggleAudio={handleToggleAudio} onUseItem={useItem} ownedItems={ownedItems} quiz={quiz} stage={stage} usedItems={usedItems} />
        {showPhaseTransition && (
          <BossPhaseModal
            currentPhase={bossPhase}
            onNextPhase={() => startBossBattle((bossPhase + 1) as BossPhase)}
          />
        )}
      </>
    );
  } else if (screen === "result" && battle) {
    currentView = <Result earnedItem={earnedItem} earnedTitles={earnedTitles} onNext={() => startBossBattle(bossPhase)} onSetup={() => setScreen("setup")} score={battle.score} stage={stage} won={battleWon(battle)} />;
  } else {
    currentView = <Ending character={character} collectedTitleIds={collectedTitleIds} earnedTitles={earnedTitles} onMain={() => setScreen("landing")} onRefreshTitles={handleRefreshTitles} score={battle?.score ?? 0} />;
  }

  return (
    <>
      {currentView}
      {showMobileNotice && <MobileRestrictionNotice onContinue={dismissMobileNotice} />}
    </>
  );
}

function Landing({ collectedTitleIds, isMuted, onRefreshTitles, onStart, onToggleAudio }: { collectedTitleIds: string[]; isMuted: boolean; onRefreshTitles: () => string[]; onStart: () => void; onToggleAudio: () => void }) {
  const [guideOpen, setGuideOpen] = useState(false);
  const [titleCollectionOpen, setTitleCollectionOpen] = useState(false);

  const handleOpenTitles = () => {
    onRefreshTitles();
    setTitleCollectionOpen(true);
  };

  return (
    <main className="landing-page">
      <div className="pixel-grid" />
      <section aria-label={GAME.title} className="landing-shell">
        <div className="landing-top-bar">
          <span className="landing-badge">{GAME.gradeBadge}</span>
          <AudioToggle isMuted={isMuted} onToggle={onToggleAudio} />
        </div>
        <div className="landing-art-card">
          <img alt={GAME.landingAlt} className="landing-art" src={GAME.landingImage} />
        </div>
        <div className="landing-actions">
          <button className="landing-button start" onClick={onStart}>
            시작하기! <span aria-hidden="true">🏰</span>
          </button>
          <div className="landing-action-row">
            <button className="landing-button help" onClick={() => setGuideOpen(true)}>
              사용 안내 <span aria-hidden="true">📖</span>
            </button>
            <button
              aria-label={`칭호 도감, ${collectedTitleIds.length}개 획득`}
              className="title-cabinet-button"
              onClick={handleOpenTitles}
              type="button"
            >
              <i aria-hidden="true">🏅</i>
              <b>칭호 도감</b>
              <span>{collectedTitleIds.length} / {adventureTitles.length}</span>
            </button>
          </div>
        </div>
      </section>
      {guideOpen && <LandingGuide onClose={() => setGuideOpen(false)} />}
      {titleCollectionOpen && (
        <TitleCollection
          collectedTitleIds={collectedTitleIds}
          onClose={() => setTitleCollectionOpen(false)}
          onRefresh={onRefreshTitles}
        />
      )}
    </main>
  );
}

function TitleCollection({ collectedTitleIds, onClose, onRefresh }: { collectedTitleIds: string[]; onClose: () => void; onRefresh?: () => string[] }) {
  const [characterId, setCharacterId] = useState<(typeof characters)[number]["id"]>("bau");
  const [currentCollected, setCurrentCollected] = useState<string[]>(collectedTitleIds);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);

  // 모달 진입 시 로컬스토리지 최신 칭호 목록 자동 동기화
  useEffect(() => {
    if (typeof window !== "undefined") {
      const timer = window.setTimeout(() => {
        const latest = onRefresh ? onRefresh() : loadCollectedTitleIds(localStorage);
        setCurrentCollected(latest);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [collectedTitleIds, onRefresh]);

  const handleManualRefresh = () => {
    if (typeof window !== "undefined") {
      const latest = onRefresh ? onRefresh() : loadCollectedTitleIds(localStorage);
      setCurrentCollected(latest);
      setRefreshNotice("✨ 칭호 도감이 최신 상태로 새로고침되었습니다!");
      const timer = window.setTimeout(() => setRefreshNotice(null), 2500);
      return () => window.clearTimeout(timer);
    }
  };

  const collected = new Set(currentCollected);
  const titles = adventureTitles.filter((title) => title.characterId === characterId);

  return (
    <div className="title-collection-backdrop" onMouseDown={onClose}>
      <section aria-labelledby="title-collection-title" aria-modal="true" className="title-collection-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog">
        <div className="title-collection-top-actions">
          <button aria-label="최신 칭호 새로고침" className="title-collection-refresh-btn" onClick={handleManualRefresh} type="button">
            <i aria-hidden="true">🔄</i> 최신 칭호 새로고침
          </button>
          <button aria-label="칭호 도감 닫기" className="title-collection-close" onClick={onClose} type="button">×</button>
        </div>
        <header className="title-collection-header">
          <span aria-hidden="true">🏅</span>
          <div>
            <h2 id="title-collection-title">칭호 도감 <b>{currentCollected.length} / {adventureTitles.length}</b></h2>
            <p>시대 탐험 완주와 보스전 승리, 고득점으로 명예 칭호를 모아요.</p>
          </div>
        </header>
        {refreshNotice && (
          <div aria-live="polite" className="title-refresh-notice" role="status">
            {refreshNotice}
          </div>
        )}
        <div aria-label="캐릭터 선택" className="title-character-tabs">
          {characters.map((character) => (
            <button aria-pressed={characterId === character.id} className={characterId === character.id ? "selected" : ""} key={character.id} onClick={() => setCharacterId(character.id)} type="button">
              <img alt="" src={character.image} />{character.name}
            </button>
          ))}
        </div>

        <div aria-label={`${characters.find((character) => character.id === characterId)?.name} 칭호 목록`} className="title-badge-grid">
          {titles.map((title) => {
            const isCollected = collected.has(title.id);
            return (
              <article className={`title-badge ${isCollected ? "collected" : "locked"}`} key={title.id} style={{ "--title-color": title.badgeColor } as React.CSSProperties}>
                <i>{title.mark}</i>
                <small>{title.condition}</small>
                <strong>{isCollected ? title.name : "???"}</strong>
                <em>{isCollected ? "획득함" : "도전 과제"}</em>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function LandingGuide({ onClose }: { onClose: () => void }) {
  return (
    <div className="landing-guide-backdrop" onMouseDown={onClose}>
      <section aria-labelledby="landing-guide-title" aria-modal="true" className="landing-guide" onMouseDown={(event) => event.stopPropagation()} role="dialog">
        <button aria-label="사용 안내 닫기" className="guide-close" onClick={onClose} type="button">×</button>
        <p className="eyebrow">{GAME.guideEyebrow}</p>
        <h2 id="landing-guide-title">{GAME.title}<br />사용 안내</h2>
        <p style={{ fontSize: "0.92rem", color: "#64748b", margin: "-6px 0 16px 0", fontWeight: 600 }}>
          {GAME.guideSubtitle}
        </p>

        <section className="guide-section">
          <h3>이렇게 모험해요 (시간 여행과 집으로의 귀환)</h3>
          <ol>
            <li><b>1</b><span><strong>시간 여행의 시작:</strong>{GAME.guideStory}</span></li>
            <li><b>2</b><span><strong>역사 탐구와 지식 습득:</strong>{GAME.guideLearning}</span></li>
            <li><b>3</b><span><strong>보스 출현 & 종합 퀴즈 대결:</strong>1~4단계 역사 탐구를 마치면 현대로 향하는 시간의 문을 가로막은 세 수호령이 깨어납니다! 배운 역사 지식 퀴즈를 풀고 행동력을 얻습니다.</span></li>
            <li><b>4</b><span><strong>3단계 보스 격파 & 집으로 귀환!</strong>{bossPhases[1].name} ➔ {bossPhases[2].name} ➔ {bossPhases[3].name}까지 차례로 물리쳐 시간의 문을 열고 따뜻한 집으로 무사히 돌아갑니다!</span></li>
          </ol>
        </section>

        <section className="guide-section">
          <h3>전투는 이렇게 해요 (카드 덱빌딩 전략)</h3>
          <ol>
            <li><b>1</b><span><strong>퀴즈 카드 5장 중 정답은 3장이에요.</strong>일반 정답은 행동력 2, 럭키 정답은 행동력 3을 줘요. 폭탄 카드는 오답이니 조심해서 피하세요!</span></li>
            <li><b>2</b><span><strong>행동력만큼 카드를 조합해요.</strong>카드 왼쪽 위 숫자(비용)만큼 행동력이 필요하며, 남은 행동력 안에서 여러 장의 카드를 전략적으로 조합해 낼 수 있어요.</span></li>
            <li><b>3</b><span><strong>보스 태세와 약점을 살펴봐요.</strong>물리 방어를 올린 보스에게는 마법 카드로 결계를 뚫고, 마법 결계를 두른 보스에게는 공격 카드로 약점을 공략하세요.</span></li>
            <li><b>4</b><span><strong>적 공격 대비 & 손패 새로고침:</strong>내 턴이 끝나면 보스가 반격하므로 수비(방패), 회피, 회복 카드로 대비하세요. 낼 카드가 없다면 행동력 2로 손패 2장을 새로 뽑을 수 있어요.</span></li>
          </ol>
        </section>

        <section className="guide-section">
          <h3>단계별 핵심 학습 목표</h3>
          {GAME.stageGoals.map((goal) => <p key={goal.title}>{goal.icon} <b>{goal.title}</b> — {goal.desc}</p>)}
        </section>

        <section className="guide-section">
          <h3>수호자 캐릭터 특성</h3>
          <p><b>바우</b>는 역사의 든든한 수호자(기본 물리 방어 4), <b>아라</b>는 유물 탐험가(물리·마법 방어 각 2 밸런스), <b>나래</b>는 문명의 조율사(기본 마법 결계 4)예요. 초등 5학년 사회 교육과정에 맞춘 최적의 단일 표준 밸런스(체력 40, 정답 드로우, 카드 상성 전략)로 누구나 몰입감 있게 역사 모험을 완주할 수 있어요.</p>
        </section>

        <section className="guide-section">
          <h3>고유 유물 퀵슬롯과 역사 도전 칭호</h3>
          <p>1~4단계를 마칠 때마다 고유 유물을 하나씩 얻어요. 보스 전투 중 화면 하단 퀵슬롯 버튼이나 단축키(Q, W, E, R)로 즉시 발동하여 오답 봉인, 방어 파괴, 행동력 +2 충전, 럭키 투시 효과를 전략적으로 활용할 수 있어요.</p>
          <p>시대 완주(4종), 보스 연속 완승(4종), 800점 명인(3종), 1,000점 전설 수호신(1종) 등 <b>총 12종의 역사 도전 칭호</b>를 도감에 영구 수집할 수 있어요.</p>
        </section>

        <section className="guide-section">
          <h3>권장 플레이 환경</h3>
          <p>{GAME.title}은(는) 다채로운 역사 개념 탐구와 확인문제 실습, 박진감 넘치는 카드배틀을 위해 <b>PC 및 태블릿(가로 화면) 환경</b>에 최적화되어 있습니다. (스마트폰 접속 시 전용 안내 화면 제공)</p>
        </section>

        <section className="guide-section">
          <h3>🏛️ 유물 및 이미지 저작권·출처 표기</h3>
          <p><b>문화유산 유물 사진 (공공누리 제1유형):</b> 본 게임에 수록하는 문화유산 사진 자료는 <b>국립중앙박물관</b> 및 <b>국가유산청 국가유산포털</b>의 공공저작물(공공누리 제1유형: 출처표시, 상업적 이용 및 변형 가능)을 출처 명시 하에 적법하게 활용하였습니다.</p>
          <p>역사 사료 및 고증에는 초등 5학년 2학기 성취기준과 사회 교과서를 참고하였습니다.</p>
          <p><b>생성형 AI 재구성 역사 복원도 및 창작 일러스트:</b> 오리지널 캐릭터(역사별이·수호대원 3인·3대 수호 보스) 및 배틀 배경은 초등 5학년 사회과 교육과정 고증을 바탕으로 생성형 AI 도구를 활용하여 학습자 눈높이에 맞게 재구성·자체 제작되었습니다.</p>
        </section>

        <button className="guide-confirm" onClick={onClose} type="button">모험 준비 완료</button>
      </section>
    </div>
  );
}

const stageSymbols: Record<number, React.ReactNode> = {
  1: <StageEraIcon size={19} stageId={1} />,
  2: <StageEraIcon size={19} stageId={2} />,
  3: <StageEraIcon size={19} stageId={3} />,
  4: <StageEraIcon size={19} stageId={4} />,
  5: <StageEraIcon size={19} stageId={5} />,
};

const stageDisplayLabels: Record<number, string> = GAME.stageLabels;

function RelicIconDisplay({ item, size = 20 }: { item: RewardItem; size?: number }) {
  return <span style={{ fontSize: size }}>{item.icon}</span>;
};

function Setup({ characterId, isMuted, onBack, onCancelReset, onCharacter, onConfirmReset, onOpenReset, onStage, onStart, onToggleAudio, resetOpen, selectedStage, unlocked }: { characterId: string; difficulty: AdventureDifficulty; isMuted: boolean; onBack: () => void; onCancelReset: () => void; onCharacter: (id: (typeof characters)[number]["id"]) => void; onConfirmReset: () => void; onDifficulty: (id: AdventureDifficulty) => void; onOpenReset: () => void; onStage: (id: StageId) => void; onStart: () => void; onToggleAudio: () => void; resetOpen: boolean; selectedStage: StageId; unlocked: StageId }) {
  const selected = stages[selectedStage - 1]; const selectedCharacter = characters.find((item) => item.id === characterId) ?? characters[0];
  return (
    <main className="setup-page">
      <section className="setup-shell">
        <header className="topbar">
          <button onClick={onBack}>← 처음으로</button>
          <div>
            <h1>모험 준비</h1>
          </div>
          <div className="topbar-actions">
            <AudioToggle isMuted={isMuted} onToggle={onToggleAudio} />
            <button onClick={onOpenReset}>진행 기록 초기화</button>
          </div>
        </header>

        <section className="setup-block">
          <SectionTitle icon="✨" number="01" subtitle="모험을 함께할 수호자를 고르세요" title="수호자 선택" />
          <div className="character-grid">
            {characters.map((item) => (
              <button aria-pressed={characterId === item.id} className={characterId === item.id ? "selected" : ""} key={item.id} onClick={() => onCharacter(item.id)}>
                <img alt="" src={item.image} />
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.role}</small>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="setup-block">
          <SectionTitle icon="📜" number="02" subtitle="도전할 스테이지를 고르세요" title="스테이지 선택" />
          <div className="stage-grid">
            {stages.map((item) => {
              const locked = item.id > unlocked;
              return (
                <button
                  className={`${selectedStage === item.id ? "selected" : ""} ${locked ? "locked" : ""}`}
                  disabled={locked}
                  key={item.id}
                  onClick={() => onStage(item.id)}
                  style={{ "--stage-accent": item.color } as React.CSSProperties}
                >
                  <span>{locked ? "🔒" : (stageSymbols[item.id] ?? item.id)}</span>
                  <strong>{stageDisplayLabels[item.id] ?? item.shortTitle}</strong>
                </button>
              );
            })}
          </div>
        </section>

        <footer className="setup-summary">
          <div>
            <img alt="" src={selectedCharacter.image} />
            <p>
              <small>출격 준비 완료</small>
              <strong>{selectedCharacter.name} (수호자)</strong>
              <em><span style={{ display: "inline-flex", alignItems: "center", verticalAlign: "middle", marginRight: "6px" }}><StageEraIcon size={15} stageId={selected.id} /></span>STAGE {selected.id}. {stageDisplayLabels[selected.id]}</em>
            </p>
          </div>
          <button onClick={onStart}>역사 모험 출발! →</button>
        </footer>
      </section>
      {resetOpen && <ConfirmReset onCancel={onCancelReset} onConfirm={onConfirmReset} />}
    </main>
  );
}

function SectionTitle({ icon = "📜", number, subtitle, title }: { icon?: React.ReactNode; number: string; subtitle: string; title: string }) {
  return (
    <div className="section-title">
      <b>{icon}</b>
      <div>
        <h2><span>{number}.</span> {title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

function ConfirmReset({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="modal-backdrop">
      <section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="reset-title">
        <span>↻</span>
        <p className="eyebrow">PROGRESS RESET</p>
        <h2 id="reset-title">진행 기록을 지울까요?</h2>
        <p>이 기기에 저장된 스테이지 완료 기록이 사라집니다.</p>
        <div>
          <button onClick={onCancel}>아니요</button>
          <button onClick={onConfirm}>초기화할게요</button>
        </div>
      </section>
    </div>
  );
}

/**
 * 인물 대사가 2문장 이상인 경우, 문맥과 호흡에 맞추어 깔끔하게 2줄로 줄바꿈해주는 스마트 포맷터
 * - 이미 \n 개행이 있는 경우: 작성자의 수동 줄바꿈 1순위 존중
 * - 따옴표('...', "...") 내부의 문장부호(!, ?, .)는 분할 지점에서 배제
 * - 문두 6글자 이하의 짧은 감탄사("수호자님!", "아하!", "크히히!") 바로 뒤는 배제 (다음 문장과 함께 묶음)
 * - 2문장이면 첫 문장 끝에서 줄바꿈, 3문장 이상이면 전체 길이의 50%에 가장 가까운 지점에서 2줄 분할
 */
export function formatDialogueSpeech(text: string): string {
  if (!text) return "";
  // 빈 줄(연속된 2개 이상의 개행) 방지: 문장 간 줄바꿈(\n)은 유지하되 공백 줄 제거
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{2,}/g, "\n").trim();
  if (normalized.includes("\n")) return normalized;

  text = normalized;
  const splitPoints: number[] = [];
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < text.length - 1; i += 1) {
    const char = text[i];
    if (char === "'" || char === "‘" || char === "’") inSingleQuote = !inSingleQuote;
    else if (char === '"' || char === "“" || char === "”") inDoubleQuote = !inDoubleQuote;

    // 따옴표 바깥이고 종결 부호([.!?]) 바로 뒤에 공백이 있는 경우
    if (!inSingleQuote && !inDoubleQuote && (char === "." || char === "!" || char === "?")) {
      const nextChar = text[i + 1];
      if (nextChar === " " && i < text.length - 2) {
        // 문두 6자 이하의 짧은 감탄사/호칭 바로 뒤는 단독 분할하지 않고 다음 문장과 묶음
        if (i <= 6) {
          continue;
        }
        splitPoints.push(i + 1);
      }
    }
  }

  if (splitPoints.length === 0) return text;

  if (splitPoints.length === 1) {
    const splitIndex = splitPoints[0]!;
    return `${text.slice(0, splitIndex).trimEnd()}\n${text.slice(splitIndex).trimStart()}`;
  }

  const mid = text.length / 2;
  let bestPoint = splitPoints[0]!;
  let minDiff = Math.abs(bestPoint - mid);

  for (const point of splitPoints) {
    const diff = Math.abs(point - mid);
    if (diff < minDiff) {
      minDiff = diff;
      bestPoint = point;
    }
  }

  return `${text.slice(0, bestPoint).trimEnd()}\n${text.slice(bestPoint).trimStart()}`;
}

// 대화창에는 문제를 되풀이하지 않고 푸는 방법만 안내합니다.
function quizGuideText(node: (typeof stages)[number]["dialogue"][number]) {
  const task = node.task || node.interactiveTask;
  if (node.choices) return "보드의 문제를 읽고 알맞은 답을 골라 보세요.";
  if (node.multiCheck) return "보드의 문제를 읽고 알맞은 것을 모두 골라 보세요.";
  if (task?.type === "fill-blank") return "빈칸에 들어갈 낱말 카드를 골라 보세요.";
  if (task?.type === "match-pairs") return "카드를 하나씩 눌러 알맞은 짝을 연결해 보세요.";
  if (task?.type === "order-sequence") return "카드를 옮겨 순서에 맞게 배열해 보세요.";
  if (task?.type === "sort-exhibit") return "카드를 고른 뒤 알맞은 전시실을 눌러 보세요.";
  if (task?.type === "evidence-case") return "카드를 눌러 증거를 가려내 보세요.";
  if (task?.type === "category-sort") return "카드를 고른 뒤 알맞은 바구니를 눌러 보세요.";
  if (task?.type === "ox-verdict") return "문장마다 O나 X를 고른 뒤 판정을 확정해 보세요.";
  if (task?.type === "document-restore") return "빈칸을 고른 뒤 알맞은 낱말 조각을 눌러 보세요.";
  return node.text;
}

// [핵심어] 표시를 대괄호 없이 강조해서 보여 줍니다.
function renderSpeechLine(line: string) {
  return line.split(/(\[[^\]]+\])/g).map((part, index) => (
    part.startsWith("[") && part.endsWith("]")
      ? <mark className="dialogue-keyword" key={index}>{part.slice(1, -1)}</mark>
      : <Fragment key={index}>{part}</Fragment>
  ));
}

function Dialogue({ character, choiceFeedback, isMuted, node, nodeIndex, onBack, onChoice, onMultiResolved, onNext, onOpenReview, onPrev, onTaskResolved, onToggleAudio, resolvedChoice, reviewing, solved, stage, wrongChoices }: { character: (typeof characters)[number]; choiceFeedback: string; isMuted: boolean; node: (typeof stages)[number]["dialogue"][number]; nodeIndex: number; onBack: () => void; onChoice: (choice: DialogueChoice, index: number) => void; onMultiResolved: () => void; onNext: () => void; onOpenReview: () => void; onPrev: () => void; onTaskResolved: () => void; onToggleAudio: () => void; resolvedChoice: number | null; reviewing: boolean; solved: boolean; stage: (typeof stages)[number]; wrongChoices: number[] }) {
  const [zoomDiagram, setZoomDiagram] = useState<string | null>(null);
  const [thinkOpenNode, setThinkOpenNode] = useState<number | null>(null);
  const [tempoSpeedModalOpen, setTempoSpeedModalOpen] = useState(false);
  const isHero = node.speaker === "주인공";
  const isBoss = node.speaker === "보스";
  const speakerName = isHero
    ? character.name
    : isBoss
      ? stage.bossShortName
      : node.speaker === "역사별" || node.speaker === "역사별이" || node.speaker === "글별이"
        ? "역사별이"
        : node.speaker;
  const portrait = isHero ? character.image : isBoss ? stage.bossImage : "/characters/geulbyeol.webp";
  const hasBoard = Boolean(node.visual || node.chalkboard || node.choices || node.multiCheck || node.task || node.interactiveTask);
  const isIntroScreen = !hasBoard;
  // 빈칸이 있는 판서는 다 채워야 다음으로 넘어간다.
  const hasChalkQuiz = Boolean(node.chalkboard && chalkSlots(node.chalkboard).length);
  const hasQuiz = Boolean(node.choices || node.multiCheck || node.task || node.interactiveTask || hasChalkQuiz);
  const canNext = !hasQuiz || solved || (resolvedChoice !== null && resolvedChoice >= 0);
  const thinkOpen = thinkOpenNode === nodeIndex;
  const [thinkSeenNodes, setThinkSeenNodes] = useState<number[]>([]);
  const speech = thinkOpen && node.thinkAnswer ? node.thinkAnswer : hasQuiz && !node.chalkboard ? quizGuideText(node) : node.text;
  const openThink = () => { setThinkOpenNode(nodeIndex); setThinkSeenNodes((seen) => (seen.includes(nodeIndex) ? seen : [...seen, nodeIndex])); };
  // "짐작해 볼까요?" 질문은 '생각해 보기'를 누르지 않고 넘겨도, 다음을 처음 누를 때 짐작한 답을 먼저 보여 준다.
  const goNext = () => {
    if (node.thinkAnswer && !thinkSeenNodes.includes(nodeIndex)) { openThink(); return; }
    onNext();
  };
  const goNextRef = useRef(goNext);
  useEffect(() => { goNextRef.current = goNext; });

  useEffect(() => {
    document.querySelector(".concept-banner small")?.replaceChildren("스테이지 핵심개념");
    function handleDialogueClick(event: MouseEvent) {
      if (!canNext || !(event.target instanceof Element)) return;
      const dialogueBox = event.target.closest(".dialogue-box");
      if (dialogueBox && !event.target.closest("button")) goNextRef.current();
    }
    document.addEventListener("click", handleDialogueClick);
    return () => document.removeEventListener("click", handleDialogueClick);
  }, [canNext]);

  return (
    <main
      className="dialogue-page"
      onKeyDown={(event) => {
        // 버튼 위의 Enter·Space는 버튼 클릭으로 처리되므로 여기서 또 넘기지 않습니다.
        if ((event.key === "Enter" || event.key === " ") && event.target instanceof Element && event.target.closest("button")) return;
        if ((event.key === "Enter" || event.key === " " || event.key === "ArrowRight") && canNext && !zoomDiagram && !tempoSpeedModalOpen) {
          goNext();
        } else if (event.key === "ArrowLeft" && nodeIndex > 0 && !zoomDiagram && !tempoSpeedModalOpen) {
          onPrev();
        }
      }}
      style={{ "--stage": stage.color } as React.CSSProperties}
      tabIndex={0}
    >
      <header className="dialogue-bar">
        <div className="dialogue-bar-left">
          <button onClick={onBack}>← 메인</button>
          <div className="dialogue-hero-chip" aria-label={`동행 영웅: ${character.name}`}>
            <img alt={character.name} className="hero-chip-img" src={character.image} />
            <div className="hero-chip-info">
              <small>{character.role}</small>
              <strong>{character.name}</strong>
            </div>
          </div>
        </div>
        <div>
          <span>STAGE {stage.id}</span>
          <strong>{stage.title}</strong>
        </div>
        <div className="dialogue-bar-actions">
          <AudioToggle isMuted={isMuted} onToggle={onToggleAudio} />
        </div>
      </header>

      {/* 배경창 (월드 무대 + 중앙 대형 HUD 보드) */}
      <section 
        className={`dialogue-world ${isIntroScreen ? "no-shade intro-mode" : ""}`} 
        style={{ 
          // 단계 배경 그림 위에 단계 색을 깐다. 그림 파일이 없으면 그라데이션만 보인다.
          // 판서·문제 장면은 칠판이 잘 보이도록 배경을 어둡게 덮는다.
          backgroundImage: node.bgImage
            ? `url(${node.bgImage})`
            : [
                isIntroScreen ? "linear-gradient(180deg, rgba(8, 9, 29, 0) 55%, rgba(8, 9, 29, 0.45) 100%)" : "linear-gradient(180deg, rgba(8, 9, 29, 0.55) 0%, rgba(8, 9, 29, 0.82) 100%)",
                stage.backgroundImage ? `url(${stage.backgroundImage})` : "",
                stage.background,
              ].filter(Boolean).join(", "),
          backgroundSize: "cover",
          backgroundPosition: node.bgImage ? "center top" : "center",
        }}
      >
        <img className={`world-hero ${hasBoard || isIntroScreen ? "board-mode" : ""} ${isHero ? "speaking" : "dim"}`} alt="" src={character.image} />
        <img className={`world-guide ${hasBoard || isIntroScreen ? "board-mode" : ""} ${node.speaker === "역사별" || node.speaker === "역사별이" || node.speaker === "글별이" || node.speaker === "소리별" ? "speaking" : "dim"}`} alt="역사별이" src="/characters/geulbyeol.webp" />
        <img className={`world-boss ${hasBoard || isIntroScreen ? "board-mode" : ""} ${isBoss ? "speaking" : "dim"}`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} src={stage.bossImage} />

        {/* 글별이 양옆 높임표현 듀얼 윙 패널 */}
        {node.visual?.type === "guide-wings" && node.visual.guideWings && (
          <GuideSideWingsVisual wings={node.visual.guideWings} />
        )}

        <div className="concept-banner">
          <small>오늘의 핵심</small>
          <strong>{stage.concept}</strong>
        </div>

        {/* 배경창 중앙 대형 HUD 보드 (개념 다이어그램 및 시각 조작 퀴즈) */}
        {hasBoard && (
          <DialogueStageBoard
            choiceFeedback={choiceFeedback}
            key={`board-${nodeIndex}`}
            node={node}
            nodeIndex={nodeIndex}
            onChoice={onChoice}
            onMultiResolved={onMultiResolved}
            onOpenTempoSpeedModal={() => setTempoSpeedModalOpen(true)}
            onTaskResolved={onTaskResolved}
            onZoomDiagram={(src) => setZoomDiagram(src)}
            resolvedChoice={resolvedChoice}
            solved={solved}
            stageId={stage.id}
            wrongChoices={wrongChoices}
          />
        )}
      </section>

      {/* 하단 대화창: 오직 순수 대사(스토리)와 진행 버튼만 표시 */}
      <section className="dialogue-box">
        <img alt={`${speakerName} 초상`} src={portrait} />
        <div className="dialogue-copy">
          <header>
            {isBoss ? (
              <div className="dialogue-boss-name">
                <small>{stage.bossTitle}</small>
                <strong>{stage.bossShortName}</strong>
              </div>
            ) : (
              <strong>{speakerName}</strong>
            )}
            <span>{node.text.includes("[탐구 활동]") ? "탐구 활동" : node.chalkboard ? "정리 노트" : hasQuiz ? "확인문제" : "이야기"}</span>
            <i>{nodeIndex + 1} / {stage.dialogue.length}</i>
          </header>
          <p className="dialogue-speech-text">
            {formatDialogueSpeech(speech)
              .split("\n")
              .map((line, idx, arr) => (
                <Fragment key={idx}>
                  {renderSpeechLine(line)}
                  {idx < arr.length - 1 && <br />}
                </Fragment>
              ))}
          </p>
        </div>
        <div className="dialogue-nav-buttons">
          {node.thinkAnswer && (
            <button className="dialogue-extra-button" onClick={() => (thinkOpen ? setThinkOpenNode(null) : openThink())} type="button">
              {thinkOpen ? "↩ 질문 다시 보기" : "💡 생각해 보기"}
            </button>
          )}
          {node.reviewConcept && !canNext && (
            <button className="dialogue-extra-button" onClick={onOpenReview} type="button">📖 설명 다시 보기</button>
          )}
          <button
            className="prev-button"
            disabled={nodeIndex === 0}
            onClick={onPrev}
            type="button"
          >
            ← 이전
          </button>
          <button
            className="next-button"
            disabled={!canNext}
            onClick={goNext}
            type="button"
          >
            {reviewing
              ? "문제로 돌아가기"
              : nodeIndex === stage.dialogue.length - 1
              ? stage.id < 4
                ? "다음 시대로 이동"
                : stage.id === 4
                  ? "카드배틀 도전"
                  : "전투 시작"
              : "다음"} →
          </button>
        </div>
      </section>

      <p className="dialogue-hint">대화창을 선택한 뒤 [Enter / Space / →] 다음, [←] 이전으로 이동할 수 있어요</p>

      {zoomDiagram && (
        <div className="diagram-modal-backdrop" onClick={() => setZoomDiagram(null)}>
          <div className="diagram-modal" onClick={(event) => event.stopPropagation()}>
            <header>
              <h3>📖 역사 탐구 개념 안내표</h3>
              <button onClick={() => setZoomDiagram(null)} type="button">닫기 ✕</button>
            </header>
            <div className="diagram-modal-body">
              <img alt="역사 탐구 개념 안내표 크게 보기" decoding="async" src={zoomDiagram} />
            </div>
          </div>
        </div>
      )}

      {tempoSpeedModalOpen && (
        <div className="diagram-modal-backdrop" onClick={() => setTempoSpeedModalOpen(false)}>
          <div aria-modal="true" className="tempo-speed-modal" onClick={(event) => event.stopPropagation()} role="dialog">
            <header className="tempo-speed-modal-header">
              <div className="header-title-box">
                <span className="tempo-modal-icon">🎵</span>
                <h3>&apos;♩ = 숫자&apos; 속도 표시는 무슨 뜻일까요?</h3>
              </div>
              <button onClick={() => setTempoSpeedModalOpen(false)} type="button">닫기 ✕</button>
            </header>
            <div className="tempo-speed-modal-body">
              <div className="tempo-concept-card">
                <span className="concept-badge">메트로놈(박자기) 속도</span>
                <p className="concept-lead">
                  <b>1분(60초) 동안 4분음표(♩) 박자를 몇 번 치는지</b>를 나타내는 음악의 표준 속도 표시예요! 숫자가 클수록 박자가 빨라집니다.
                </p>
              </div>
              <div className="tempo-examples-grid">
                <div className="tempo-example-card slow">
                  <span className="speed-num">♩ = 60</span>
                  <div className="speed-desc">
                    <strong>1초에 딱 1번 박자</strong>
                    <small>시계 초침 소리 (&apos;똑-딱&apos;)와 같은 차분한 빠르기예요.</small>
                  </div>
                </div>
                <div className="tempo-example-card normal">
                  <span className="speed-num">♩ = 120</span>
                  <div className="speed-desc">
                    <strong>1초에 2번 박자</strong>
                    <small>신나게 발맞춰 씩씩하게 걷는 경쾌한 행진 속도예요!</small>
                  </div>
                </div>
                <div className="tempo-example-card fast">
                  <span className="speed-num">♩ = 180</span>
                  <div className="speed-desc">
                    <strong>1초에 3번 박자</strong>
                    <small>전속력으로 숨차게 질주하는 아주 빠른 속도예요!</small>
                  </div>
                </div>
              </div>
            </div>
            <footer className="tempo-speed-modal-footer">
              <button onClick={() => setTempoSpeedModalOpen(false)} type="button">이해했어요! 확인 완료 👍</button>
            </footer>
          </div>
        </div>
      )}
    </main>
  );
}

function GuideSideWingsVisual({ wings }: { wings: GuideSideWings }) {
  return (
    <div className="guide-side-wings-container">
      {/* 좌측 날개: 특별한 높임 낱말 */}
      <div className="guide-wing-panel wing-left">
        <div className="wing-header">
          <span className="wing-icon">{wings.leftIcon}</span>
          <strong className="wing-title">{wings.leftTitle}</strong>
          <span className="wing-badge">{wings.leftBadge}</span>
        </div>
        <div className="wing-items-list">
          {wings.leftItems.map((item, idx) => (
            <div className="wing-item-row" key={idx}>
              <span className="item-normal">{item.normal}</span>
              <span className="item-arrow">➔</span>
              <strong className="item-honorific">{item.honorific}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* 우측 날개: 특별한 높임 서술어 */}
      <div className="guide-wing-panel wing-right">
        <div className="wing-header">
          <span className="wing-icon">{wings.rightIcon}</span>
          <strong className="wing-title">{wings.rightTitle}</strong>
          <span className="wing-badge">{wings.rightBadge}</span>
        </div>
        <div className="wing-items-list">
          {wings.rightItems.map((item, idx) => (
            <div className="wing-item-row" key={idx}>
              <span className="item-normal">{item.normal}</span>
              <span className="item-arrow">➔</span>
              <strong className="item-honorific">{item.honorific}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GrammarConceptTableView({ table }: { table: { title: string; subtitle?: string; cards: GrammarConceptCard[] } }) {
  return (
    <div className={`grammar-table-view count-${table.cards.length}`}>
      <div className="grammar-table-header">
        <h3 className="grammar-table-title">{table.title}</h3>
        {table.subtitle && <p className="grammar-table-subtitle">{table.subtitle}</p>}
      </div>

      <div className="grammar-cards-grid">
        {table.cards.map((card, idx) => (
          <div className={`grammar-concept-card theme-${card.colorTheme}`} key={idx}>
            <div className="card-top-row">
              <span className="card-icon">{card.icon}</span>
              <strong className="card-title">{card.title}</strong>
              <span className="card-badge">{card.badge}</span>
            </div>

            <div className="card-match-pairs">
              {card.timeKeywords && (
                <div className="pair-item time-item">
                  <span className="pair-label">{card.pairLabel1 ?? "⏱️ 시간 표현"}</span>
                  <span className="pair-val">{card.timeKeywords}</span>
                </div>
              )}
              {card.timeKeywords && card.verbEndings && card.pairDivider !== "" && (
                <div className="pair-divider">{card.pairDivider ?? "↕ 짝꿍 결합 ↕"}</div>
              )}
              {card.verbEndings && (
                <div className="pair-item verb-item">
                  <span className="pair-label">{card.pairLabel2 ?? "🔗 어울리는 서술어의 형태"}</span>
                  <span className="pair-val">{card.verbEndings}</span>
                </div>
              )}
            </div>

            {(card.goodExample || card.badExample) && (
              <div className="card-examples-box">
                {card.goodExample && (
                  <div className="example-row good">
                    <span className="example-badge good">⭕ {card.goodBadge ?? "바른 역사"}</span>
                    <span className="example-text">{card.goodExample}</span>
                  </div>
                )}
                {card.badExample && (
                  <div className="example-row bad">
                    <span className="example-badge bad">❌ {card.badBadge ?? "틀린 역사"}</span>
                    <span className="example-text">{card.badExample}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SingleVisualShowcase({ item, onZoom }: { item: DialogueVisualItem; onZoom?: (src: string) => void }) {
  return (
    <div className={`single-relic-showcase ${item.src ? "has-image" : ""}`}>
      <div className="showcase-relic-card relic-card">
        {item.tag && <span className="relic-showcase-tag">{item.tag}</span>}
        <div className="showcase-relic-media relic-symbol-wrapper">
          {item.src ? (
            <img alt={item.title} className="relic-showcase-img zoomable" decoding="async" onClick={() => onZoom?.(item.src!)} src={item.src} title="눌러서 크게 보기" />
          ) : (
            <span className="relic-icon-emblem showcase-emblem" aria-label={item.title}>{item.icon || "🏺"}</span>
          )}
        </div>
        <div className="showcase-relic-info">
          <strong className="showcase-relic-title">{item.title}<AiImageNote src={item.src} /></strong>
          {item.desc && <p className="showcase-relic-desc relic-desc">{item.desc}</p>}
          {item.credit && <small className="visual-item-credit card-bottom-credit">{item.credit}</small>}
        </div>
      </div>
      <div className="showcase-mini-tip">
        <span className="mini-bulb">⭐</span>
        <small>대화창 우측의 [다음 →] 버튼을 눌러 역사 탐구를 계속 진행하세요!</small>
      </div>
    </div>
  );
}

// 생성형 AI로 만든 그림은 제목 옆에 학습용 그림이라는 표시를 붙인다.
function AiImageNote({ src }: { src?: string }) {
  if (!src?.startsWith("/ai-illustrations/")) return null;
  return <span className="ai-image-note">(이해를 돕기 위한 생성형 AI 이미지)</span>;
}

function VisualCompareCard({ item, onZoom }: { item: DialogueVisualItem; onZoom: (src: string) => void }) {
  return (
    <div className={`visual-compare-card relic-card ${item.story ? "storybook-card" : ""}`}>
      <div className="visual-card-left">
        {item.tag && <span className="visual-card-tag">{item.tag}</span>}
        <div className="visual-card-symbol-wrapper relic-symbol-wrapper">
          {item.src ? (
            <img alt={item.title} className={`visual-card-img relic-img ${item.zoomable === false ? "" : "zoomable"}`} decoding="async" onClick={item.zoomable === false ? undefined : () => onZoom(item.src!)} src={item.src} title={item.zoomable === false ? undefined : "눌러서 크게 보기"} />
          ) : item.placeholder ? (
            <span className="relic-image-placeholder" aria-label={`${item.title} 이미지 준비 중`} />
          ) : (
            <span className="relic-icon-emblem" aria-label={item.title}>{item.icon || "🏺"}</span>
          )}
        </div>
        <strong className="visual-card-title">{item.title}<AiImageNote src={item.src} /></strong>
      </div>

      <div className="visual-card-right">
        {item.story ? (
          <div className="storybook-card-content">
            <div className="storybook-narrative-box">
              <span className="story-badge">📖 신화 이야기</span>
              <p className="story-text">{item.story}</p>
            </div>
            {item.meaning && (
              <div className="storybook-meaning-box">
                <span className="meaning-badge">💡 역사적 의미</span>
                <p className="meaning-text">{item.meaning}</p>
              </div>
            )}
          </div>
        ) : (
          item.desc && <p className="visual-card-desc relic-desc">{item.desc}</p>
        )}
      </div>
      {/* 출처 표기는 카드 안 맨 아래에 둔다 */}
      {item.credit && <small className="visual-item-credit card-bottom-credit">{item.credit}</small>}
    </div>
  );
}

function DialogueStageBoard({
  choiceFeedback,
  node,
  nodeIndex,
  onChoice,
  onMultiResolved,
  onTaskResolved,
  onZoomDiagram,
  resolvedChoice,
  solved,
  stageId = 1,
  wrongChoices,
}: {
  choiceFeedback: string;
  node: (typeof stages)[number]["dialogue"][number];
  nodeIndex: number;
  onChoice: (choice: DialogueChoice, index: number) => void;
  onMultiResolved: () => void;
  onOpenTempoSpeedModal?: () => void;
  onTaskResolved: () => void;
  onZoomDiagram: (src: string) => void;
  resolvedChoice: number | null;
  solved: boolean;
  stageId?: StageId;
  wrongChoices: number[];
}) {
  const currentTask = node.task || node.interactiveTask;
  const hasQuiz = Boolean(node.choices || node.multiCheck || currentTask);
  const questionRaw = node.prompt || node.text || "";
  const matchQuestion = questionRaw.match(/^(?:★\s*)?\[(확인문제\s*\d+(?:-\d+)?|탐구 활동)\]\s*(.*)$/);
  const quizBadge = matchQuestion ? matchQuestion[1] : (hasQuiz ? "확인문제" : "");
  const quizQuestion = matchQuestion ? matchQuestion[2] : (node.prompt || (hasQuiz ? node.text : ""));
  // 두 바구니 분류와 OX 판정은 판서처럼 칠판 위에서 푼다.
  const isChalkTask = currentTask ? ["category-sort", "ox-verdict", "document-restore", "match-pairs", "order-sequence"].includes(currentTask.type) : false;
  // 사진이나 인용문이 없는 객관식도 칠판 위에서 푼다.
  const isChalkChoice = Boolean(node.choices && !node.quizImage && !node.sentence);

  return (
    <section className={`dialogue-stage-board stage-board-theme-${stageId} ${node.chalkboard || isChalkTask || isChalkChoice ? "has-chalkboard" : ""}`} aria-label="역사 탐구 대형 전시 보드">
      {solved && <p className="stage-solved-notice">✅ 이미 맞힌 문제예요. 바로 다음으로 넘어가도 좋아요.</p>}
      {/* 상단 타이틀 배너 (다이어그램이 아니고 task/choices/multiCheck가 없을 때만 렌더링) */}
      {node.visual?.title && node.visual.type !== "diagram" && !currentTask && !node.choices && !node.multiCheck && (
        <div className="stage-board-title-banner">
          <div className="banner-left">
            <span className="banner-icon">📜</span>
            <span className="banner-title">{node.visual.title}</span>
          </div>
          <span className="banner-tag">역사 유물 탐구</span>
        </div>
      )}

      {/* 1. 시각 자료 영역 (단독 쇼케이스, 비교 그리드, 기호, 대형 악보 다이어그램, 문법 개념표) */}
      {node.visual && (
        node.visual.type === "timeline" && node.visual.items ? (
          <div className="stage-visual-timeline">
            <ol className={`timeline-track items-${node.visual.items.length}`}>
              {node.visual.items.map((item, idx) => (
                <li className={`timeline-step ${idx === node.visual!.items!.length - 1 ? "is-final" : ""}`} key={item.title}>
                  <span className="timeline-year">{item.tag}</span>
                  <span className="timeline-dot" aria-hidden="true">{idx + 1}</span>
                  <strong className="timeline-step-title">{item.title}</strong>
                  {item.desc && <p className="timeline-step-desc">{item.desc}</p>}
                </li>
              ))}
            </ol>
            {node.visual.caption && <p className="timeline-caption">{node.visual.caption}</p>}
          </div>
        ) : node.visual.type === "grammar-table" && node.visual.grammarTable ? (
          <GrammarConceptTableView table={node.visual.grammarTable} />
        ) : (
          <div className={`stage-visual-container ${node.visual.type} ${node.visual.items?.length === 1 ? "is-single" : ""}`}>
            {node.visual.items && node.visual.items.length === 1 ? (
              <SingleVisualShowcase item={node.visual.items[0]} onZoom={onZoomDiagram} />
            ) : node.visual.items && node.visual.items.length > 1 ? (
              <div className="stage-visual-compare-wrapper">
                {node.visual.items.some((item) => item.featured) ? (
                  // 핵심 삽화 하나를 크게, 나머지는 옆에 작게 둔다.
                  <div className="stage-visual-featured-layout">
                    {node.visual.items.filter((item) => item.featured).slice(0, 1).map((item) => (
                      <figure className="featured-visual-card" key={item.title}>
                        <button
                          aria-label={`${item.title} 크게 보기`}
                          className="featured-visual-media"
                          onClick={() => item.src && onZoomDiagram(item.src)}
                          type="button"
                        >
                          {item.src ? (
                            <img alt={item.title} decoding="async" src={item.src} />
                          ) : (
                            <span className="relic-icon-emblem" aria-label={item.title}>{item.icon || "🏺"}</span>
                          )}
                        </button>
                        <figcaption>
                          <strong className="visual-card-title">{item.title}<AiImageNote src={item.src} /></strong>
                          {item.desc && <p className="relic-desc">{item.desc}</p>}
                        </figcaption>
                        {item.credit && <small className="visual-item-credit card-bottom-credit">{item.credit}</small>}
                      </figure>
                    ))}
                    <div className={`featured-side-grid items-${node.visual.items.length - 1}`}>
                      {node.visual.items.filter((item) => !item.featured).map((item, idx) => (
                        <VisualCompareCard item={item} key={idx} onZoom={onZoomDiagram} />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className={`stage-visual-compare-grid items-${node.visual.items.length}`}>
                    {node.visual.items.map((item, idx) => (
                      <VisualCompareCard item={item} key={idx} onZoom={onZoomDiagram} />
                    ))}
                  </div>
                )}
                {node.visual.source && (
                  <div className="relic-source-notice">
                    <span>{/^[🎨📷🗺️🏛️]/.test(node.visual.source) ? "" : "🏛️ "}{node.visual.source}</span>
                  </div>
                )}
              </div>
            ) : node.visual.type === "symbol" ? (
              <div className="stage-visual-symbol">
                <img alt={node.visual.title} decoding="async" src={node.visual.src} />
                <span>{node.visual.title}</span>
              </div>
            ) : (
              <div className="stage-visual-diagram-wrapper">
                <div
                  className="stage-visual-diagram"
                  onClick={() => onZoomDiagram(node.visual?.src ?? "")}
                  role="button"
                  tabIndex={0}
                >
                  <div className="diagram-top-badge">
                    <b>📜 {node.visual.title}</b>
                    <small>🔍 크게 보기</small>
                  </div>
                  <img alt={node.visual.title} decoding="async" src={node.visual.src} />
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* 판서형 칠판 (빈칸 채우기·동그라미 치기) */}
      {node.chalkboard && <ChalkboardTask board={node.chalkboard} key={`cb-${nodeIndex}`} onResolved={onTaskResolved} solved={solved} />}

      {/* 칠판형 확인문제 (두 바구니 분류, OX 판정) */}
      {currentTask?.type === "category-sort" && <CategorySortTaskComponent key={`cs-${nodeIndex}`} onResolved={onTaskResolved} question={quizQuestion} solved={solved} task={currentTask} />}
      {currentTask?.type === "ox-verdict" && <OxVerdictTaskComponent key={`ox-${nodeIndex}`} onResolved={onTaskResolved} question={quizQuestion} solved={solved} task={currentTask} />}
      {currentTask?.type === "document-restore" && <DocumentRestoreTaskComponent key={`dr-${nodeIndex}`} onResolved={onTaskResolved} question={quizQuestion} solved={solved} task={currentTask} />}
      {currentTask?.type === "match-pairs" && <MatchPairsTaskComponent key={`mp-${nodeIndex}`} onResolved={onTaskResolved} question={quizQuestion} solved={solved} task={currentTask} />}
      {currentTask?.type === "order-sequence" && <SequenceOrderTaskComponent key={`os-${nodeIndex}`} onResolved={onTaskResolved} question={quizQuestion} solved={solved} task={currentTask} />}
      {node.choices && isChalkChoice && <ChalkChoiceTask choiceFeedback={choiceFeedback} choices={node.choices} key={`ch-${nodeIndex}`} onChoice={onChoice} question={quizQuestion} resolvedChoice={resolvedChoice} wrongChoices={wrongChoices} />}

      {/* 2. 인터랙티브 조작 영역 (빈칸 맞추기, 연결하기, 순서 정렬하기) */}
      {currentTask && !isChalkTask && (
        <div className="stage-task-container">
          {quizQuestion && (
            <div className="stage-quest-card">
              <div className="stage-quest-prompt">
                <span className="quest-badge">🎯 {quizBadge || "역사 확인문제"}</span>
                <h4>{quizQuestion}</h4>
              </div>
            </div>
          )}
          {currentTask.type === "fill-blank" && <SlotFillTaskComponent key={`fb-${nodeIndex}`} onResolved={onTaskResolved} task={currentTask} />}
          {currentTask.type === "sort-exhibit" && <SortExhibitComponent key={`se-${nodeIndex}`} onResolved={onTaskResolved} task={currentTask} />}
          {currentTask.type === "evidence-case" && <EvidenceCaseComponent key={`ec-${nodeIndex}`} onResolved={onTaskResolved} task={currentTask} />}
        </div>
      )}

      {/* 3. 4지선다 퀴즈 영역 (제시 역사 카드 + 프롬프트 + 카드 그리드) */}
      {node.choices && !isChalkChoice && (
        <div className="stage-choices-container">
          {quizQuestion && (
            <div className="stage-quest-card">
              <div className="stage-quest-prompt">
                <span className="quest-badge">🎯 {quizBadge || "역사 확인문제"}</span>
                <h4>{quizQuestion}</h4>
              </div>
              {node.quizImage && (
                <figure className="stage-quest-image">
                  <img alt={node.quizImage.title} decoding="async" src={node.quizImage.src} />
                  <figcaption>{node.quizImage.title} · {node.quizImage.source}</figcaption>
                </figure>
              )}
              {node.sentence && (
                <div className="stage-quest-sentence-box">
                  <span className="sentence-quote-mark">“</span>
                  <p className="sentence-text">{node.sentence}</p>
                  <span className="sentence-quote-mark">”</span>
                </div>
              )}
            </div>
          )}
          <div className="stage-choices-grid">
            {node.choices.map((item, index) => (
              <button
                className={`stage-choice-btn ${resolvedChoice === index ? "correct" : ""} ${wrongChoices.includes(index) ? "wrong" : ""}`}
                disabled={(resolvedChoice !== null && resolvedChoice >= 0) || wrongChoices.includes(index)}
                key={item.text}
                onClick={() => onChoice(item, index)}
                type="button"
              >
                {item.icon && <img alt="" className="choice-icon" src={item.icon} />}
                <span className="choice-index-num">{index + 1}</span>
                <span className="choice-btn-text">{item.text}</span>
              </button>
            ))}
          </div>
          {choiceFeedback && (
            <div className={`stage-feedback ${resolvedChoice === -1 ? "wrong" : "correct"}`}>
              <div className="feedback-text-wrap">
                <span className="feedback-prefix">{resolvedChoice === -1 ? "⚠️ 다시 생각해 봐요! " : "🎉 정답! "}</span>
                <span>{choiceFeedback}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. 다중 선택 체크 문제 영역 (아이콘 지원) */}
      {node.multiCheck && (
        <div className="stage-multicheck-container">
          {quizQuestion && (
            <div className="stage-quest-card">
              <div className="stage-quest-prompt">
                <span className="quest-badge">🎯 {quizBadge || "역사 확인문제"}</span>
                <h4>{quizQuestion}</h4>
              </div>
            </div>
          )}
          <DialogueMultiCheck key={`multi-${nodeIndex}`} check={node.multiCheck} onResolved={onMultiResolved} />
        </div>
      )}
    </section>
  );
}

{/* 판서형 칠판: [[빈칸]]은 낱말 카드로, ((A/B*))는 동그라미 치기로 푼다. */}
function ChalkboardTask({ board, onResolved, solved }: { board: Chalkboard; onResolved: () => void; solved: boolean }) {
  const lines = useMemo(() => parseChalkboard(board), [board]);
  const slots = useMemo(() => chalkSlots(board), [board]);
  const [shuffledOptions] = useState<Record<string, string[]>>(() => {
    const entries = slots.map((slot) => {
      const options = [...slot.options];
      for (let i = options.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
      }
      return [slot.id, options] as const;
    });
    return Object.fromEntries(entries);
  });
  const [filled, setFilled] = useState<Record<string, boolean>>(() => (solved ? Object.fromEntries(slots.map((slot) => [slot.id, true])) : {}));
  const [activeId, setActiveId] = useState<string | null>(() => (solved ? null : slots.find((slot) => slot.kind === "blank")?.id ?? null));
  const [miss, setMiss] = useState<{ id: string; word: string; count: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const remaining = slots.filter((slot) => !filled[slot.id]);
  const isComplete = slots.length > 0 && remaining.length === 0;
  const activeBlank = slots.find((slot) => slot.id === activeId && slot.kind === "blank" && !filled[slot.id])
    ?? remaining.find((slot) => slot.kind === "blank");

  function choose(slotId: string, word: string) {
    const slot = slots.find((item) => item.id === slotId);
    if (!slot || filled[slot.id] || isComplete) return;
    if (word !== slot.answer) {
      setMiss((prev) => ({ id: slot.id, word, count: (prev?.count ?? 0) + 1 }));
      setMessage(`'${word}'은(는) 알맞지 않아요. 판서의 앞뒤 문장을 다시 읽어 보세요.`);
      playBattleSound("wrong");
      return;
    }
    const next = { ...filled, [slot.id]: true };
    setFilled(next);
    setMiss(null);
    const nextBlank = slots.find((item) => item.kind === "blank" && !next[item.id]);
    setActiveId(nextBlank?.id ?? null);
    if (slots.every((item) => next[item.id])) {
      setMessage("판서 완성! 다음으로 넘어가요.");
      onResolved();
    } else {
      setMessage(null);
    }
  }

  return (
    <div className={`chalkboard-frame ${board.photo ? "with-photo" : ""}`}>
      <div className="chalkboard-surface">
        <h3 className="chalk-title">{board.title}</h3>
        <ul className="chalk-lines">
          {lines.map((line, lineIndex) => (
            <li className={line.note ? "chalk-note" : "chalk-line"} key={lineIndex}>
              {line.segments.map((segment, segmentIndex) => {
                if (segment.kind === "text") return <Fragment key={segmentIndex}>{segment.text}</Fragment>;
                if (segment.kind === "mark") return <span className="chalk-mark" key={segmentIndex}>{segment.text}</span>;
                const done = Boolean(filled[segment.id]);
                const shaking = miss?.id === segment.id;
                if (segment.kind === "circle") {
                  return (
                    <span className="chalk-circle-group" key={segmentIndex}>
                      ({" "}
                      {segment.options.map((word, wordIndex) => (
                        <Fragment key={word}>
                          {wordIndex > 0 && <span className="chalk-slash"> / </span>}
                          <button
                            aria-label={`${word}에 동그라미 치기`}
                            className={`chalk-circle-word ${done && word === segment.answer ? "circled" : ""} ${shaking && miss?.word === word ? "shake" : ""}`}
                            disabled={done}
                            key={shaking && miss?.word === word ? `${word}-${miss.count}` : word}
                            onClick={() => choose(segment.id, word)}
                            type="button"
                          >
                            {word}
                          </button>
                        </Fragment>
                      ))}
                      {" "})
                    </span>
                  );
                }
                return done ? (
                  <span className="chalk-answer" key={segmentIndex}>{segment.answer}</span>
                ) : (
                  <button
                    aria-label="빈칸 채우기"
                    className={`chalk-blank ${activeBlank?.id === segment.id ? "active" : ""} ${shaking ? "shake" : ""}`}
                    key={shaking ? `${segment.id}-${miss?.count}` : segment.id}
                    onClick={() => { setActiveId(segment.id); setMessage(null); }}
                    type="button"
                  >
                    ?
                  </button>
                );
              })}
            </li>
          ))}
        </ul>
        {board.photo && (
          <figure className="chalk-photo">
            <img alt={board.photo.caption} decoding="async" src={board.photo.src} />
            <figcaption>{board.photo.caption}{board.photo.credit && <small>{board.photo.credit}</small>}</figcaption>
          </figure>
        )}
      </div>
      {slots.length > 0 && (
        <div className="chalk-tray" aria-live="polite">
          {activeBlank && !isComplete ? (
            <>
              <span className="chalk-tray-label">빈칸에 알맞은 낱말</span>
              <div className="chalk-tray-words">
                {shuffledOptions[activeBlank.id]?.map((word) => (
                  <button
                    className={`chalk-word-card ${miss?.id === activeBlank.id && miss.word === word ? "missed" : ""}`}
                    key={word}
                    onClick={() => choose(activeBlank.id, word)}
                    type="button"
                  >
                    {word}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <span className="chalk-tray-label">{isComplete ? "모든 빈칸을 채웠어요" : "괄호 안의 두 낱말 중 알맞은 것에 동그라미를 쳐 보세요"}</span>
          )}
          <span className="chalk-tray-count">{isComplete ? "✓ 완성" : `남은 칸 ${remaining.length}`}</span>
          {message && <p className={`chalk-message ${isComplete ? "correct" : "wrong"}`}>{message}</p>}
        </div>
      )}
    </div>
  );
}

{/* 빈칸 채우기 컴포넌트 */}
function SlotFillTaskComponent({ onResolved, task }: { onResolved: () => void; task: Extract<InteractiveTask, { type: "fill-blank" }> }) {
  const [selectedOption, setSelectedOption] = useState<typeof task.options[number] | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSelect = (option: typeof task.options[number]) => {
    if (isSuccess) return;
    setSelectedOption(option);
    if (option.isAnswer) {
      setIsSuccess(true);
      setFeedback(task.successFeedback);
      onResolved();
    } else {
      setFeedback(option.explanation);
    }
  };

  const handleRetry = () => {
    setSelectedOption(null);
    setFeedback(null);
  };

  return (
    <div className="task-slot-fill">
      <p className="task-instruction">💡 {task.instruction}</p>
      {/* 수식 / 슬롯 디스플레이 */}
      <div className="slot-equation-row">
        {task.equation.map((slot, idx) => (
          <div className={`equation-item ${slot.isSlot ? "is-slot" : ""}`} key={idx}>
            {slot.isSlot ? (
              <div className={`slot-box ${selectedOption ? (isSuccess ? "filled-success" : "filled-wrong") : "empty"}`}>
                {selectedOption ? (
                  <>
                    {selectedOption.icon && <img alt="" className="slot-icon" src={selectedOption.icon} />}
                    <b>{selectedOption.text}</b>
                  </>
                ) : (
                  <span className="slot-placeholder">? 빈칸</span>
                )}
              </div>
            ) : (
              <div className="equation-text">
                {slot.icon && <img alt="" className="equation-icon" src={slot.icon} />}
                <span>{slot.text}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 보기 카드 풀 */}
      <div className="slot-options-pool">
        {task.options.map((option) => (
          <button
            className={`slot-option-card ${selectedOption?.id === option.id ? "selected" : ""} ${isSuccess && option.isAnswer ? "is-answer" : ""}`}
            disabled={isSuccess}
            key={option.id}
            onClick={() => handleSelect(option)}
            type="button"
          >
            {option.icon && <img alt="" className="option-icon" src={option.icon} />}
            <span>{option.text}</span>
          </button>
        ))}
      </div>

      {feedback && (
        <div className={`stage-feedback ${isSuccess ? "correct" : "wrong"}`}>
          <div className="feedback-text-wrap">
            <span>{isSuccess ? `🎉 정답! ${feedback}` : `⚠️ 다시 확인해 봐요: ${feedback}`}</span>
          </div>
          {!isSuccess && (
            <button className="task-retry-btn" onClick={handleRetry} type="button">🔄 다시 풀기</button>
          )}
        </div>
      )}
    </div>
  );
}

function shuffleOnce<T>(items: T[]): T[] {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

const CIRCLED_NUMBERS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧"];

{/* 칠판형 짝 맞추기: 왼쪽과 오른쪽에서 하나씩 고르면 짝이 지어진다. */}
function MatchPairsTaskComponent({ onResolved, question, solved, task }: { onResolved: () => void; question: string; solved: boolean; task: Extract<InteractiveTask, { type: "match-pairs" }> }) {
  const [rightItems] = useState(() => shuffleOnce(task.rightItems));
  const [matched, setMatched] = useState<string[]>(() => (solved ? task.leftItems.map((item) => item.matchId) : []));
  const [leftId, setLeftId] = useState<string | null>(null);
  const [rightId, setRightId] = useState<string | null>(null);
  const [miss, setMiss] = useState<{ ids: string[]; count: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const isComplete = matched.length === task.leftItems.length;

  function tryPair(nextLeft: string | null, nextRight: string | null) {
    setLeftId(nextLeft);
    setRightId(nextRight);
    if (!nextLeft || !nextRight) return;
    const left = task.leftItems.find((item) => item.id === nextLeft)!;
    const right = rightItems.find((item) => item.id === nextRight)!;
    if (left.matchId === right.matchId) {
      const next = [...matched, left.matchId];
      setMatched(next);
      setMiss(null);
      setLeftId(null);
      setRightId(null);
      if (next.length === task.leftItems.length) {
        setMessage(task.successFeedback);
        onResolved();
      } else {
        setMessage(null);
      }
    } else {
      setMiss((prev) => ({ ids: [left.id, right.id], count: (prev?.count ?? 0) + 1 }));
      setMessage(`'${left.text}'의 짝이 아니에요. 다시 골라 보세요.`);
      setRightId(null);
      playBattleSound("wrong");
    }
  }

  const numberOf = (matchId: string) => CIRCLED_NUMBERS[matched.indexOf(matchId)] ?? "";

  return (
    <div className="chalkboard-frame chalk-task">
      <div className="chalkboard-surface">
        <h3 className="chalk-title">{question}</h3>
        <div className="chalk-match-grid">
          <div className="chalk-match-col">
            {task.leftTitle && <span className="chalk-sort-heading">{task.leftTitle}</span>}
            {task.leftItems.map((item) => {
              const done = matched.includes(item.matchId);
              const shaking = miss?.ids.includes(item.id);
              return (
                <button
                  className={`chalk-match-item ${leftId === item.id ? "active" : ""} ${done ? "done" : ""} ${shaking ? "shake" : ""}`}
                  disabled={done || isComplete}
                  key={shaking ? `${item.id}-${miss?.count}` : item.id}
                  onClick={() => { setMessage(null); tryPair(item.id, rightId); }}
                  type="button"
                >
                  {done && <b className="chalk-match-num">{numberOf(item.matchId)}</b>}
                  {item.emoji && <span aria-hidden="true">{item.emoji}</span>} {item.text}
                </button>
              );
            })}
          </div>
          <div className="chalk-match-col">
            {task.rightTitle && <span className="chalk-sort-heading">{task.rightTitle}</span>}
            {rightItems.map((item) => {
              const done = matched.includes(item.matchId);
              const shaking = miss?.ids.includes(item.id);
              return (
                <button
                  className={`chalk-match-item ${rightId === item.id ? "active" : ""} ${done ? "done" : ""} ${shaking ? "shake" : ""}`}
                  disabled={done || isComplete}
                  key={shaking ? `${item.id}-${miss?.count}` : item.id}
                  onClick={() => { setMessage(null); tryPair(leftId, item.id); }}
                  type="button"
                >
                  {done && <b className="chalk-match-num">{numberOf(item.matchId)}</b>}
                  {item.text}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="chalk-tray" aria-live="polite">
        <span className="chalk-tray-label">{isComplete ? "모든 짝을 찾았어요" : "왼쪽과 오른쪽에서 하나씩 골라 짝을 지어 보세요"}</span>
        <span className="chalk-tray-count">{isComplete ? "✓ 완성" : `찾은 짝 ${matched.length} / ${task.leftItems.length}`}</span>
        {message && <p className={`chalk-message ${isComplete ? "correct" : "wrong"}`}>{message}</p>}
      </div>
    </div>
  );
}

{/* 칠판형 순서 정하기: 아래 카드를 일어난 차례대로 눌러 칠판에 적는다. */}
function SequenceOrderTaskComponent({ onResolved, question, solved, task }: { onResolved: () => void; question: string; solved: boolean; task: Extract<InteractiveTask, { type: "order-sequence" }> }) {
  const sorted = useMemo(() => [...task.items].sort((a, b) => (a.order ?? a.correctIndex ?? 0) - (b.order ?? b.correctIndex ?? 0)), [task.items]);
  const [pool] = useState(() => shuffleOnce(task.items));
  const [written, setWritten] = useState<string[]>(() => (solved ? sorted.map((item) => item.id) : []));
  const [miss, setMiss] = useState<{ id: string; count: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const isComplete = written.length === sorted.length;

  function choose(id: string) {
    if (isComplete || written.includes(id)) return;
    const expected = sorted[written.length];
    if (expected.id !== id) {
      setMiss((prev) => ({ id, count: (prev?.count ?? 0) + 1 }));
      setMessage(`${written.length + 1}번째로 올 카드가 아니에요. 앞뒤 순서를 다시 생각해 보세요.`);
      playBattleSound("wrong");
      return;
    }
    const next = [...written, id];
    setWritten(next);
    setMiss(null);
    if (next.length === sorted.length) {
      setMessage(task.successFeedback);
      onResolved();
    } else {
      setMessage(null);
    }
  }

  const textOf = (id: string) => task.items.find((item) => item.id === id);

  return (
    <div className="chalkboard-frame chalk-task">
      <div className="chalkboard-surface">
        <h3 className="chalk-title">{question}</h3>
        <ol className="chalk-order-list">
          {sorted.map((_, index) => {
            const item = written[index] ? textOf(written[index]) : undefined;
            return (
              <li className={item ? "written" : "empty"} key={index}>
                <span className="chalk-ox-num">{index + 1}.</span>
                {item ? <span className="chalk-answer">{item.icon && !item.icon.startsWith("/") && <span aria-hidden="true">{item.icon} </span>}{item.text}</span> : <span className="chalk-order-blank" />}
              </li>
            );
          })}
        </ol>
      </div>
      <div className="chalk-tray" aria-live="polite">
        {!isComplete ? (
          <>
            <span className="chalk-tray-label">{written.length + 1}번째 카드</span>
            <div className="chalk-tray-words">
              {pool.filter((item) => !written.includes(item.id)).map((item) => (
                <button
                  className={`chalk-word-card chalk-order-card ${miss?.id === item.id ? "missed shake" : ""}`}
                  key={miss?.id === item.id ? `${item.id}-${miss.count}` : item.id}
                  onClick={() => choose(item.id)}
                  type="button"
                >
                  {item.icon && !item.icon.startsWith("/") && <span aria-hidden="true">{item.icon} </span>}{item.text}
                </button>
              ))}
            </div>
          </>
        ) : (
          <span className="chalk-tray-label">순서대로 모두 적었어요</span>
        )}
        <span className="chalk-tray-count">{isComplete ? "✓ 완성" : `${written.length} / ${sorted.length}`}</span>
        {message && <p className={`chalk-message ${isComplete ? "correct" : "wrong"}`}>{message}</p>}
      </div>
    </div>
  );
}

{/* 칠판형 문서 복원: 정리 카드의 빈칸에 알맞은 낱말 조각을 채운다. */}
function DocumentRestoreTaskComponent({ onResolved, question, solved, task }: { onResolved: () => void; question: string; solved: boolean; task: Extract<InteractiveTask, { type: "document-restore" }> }) {
  const slotIds = task.segments.filter((segment) => segment.slotId).map((segment) => segment.slotId as string);
  const [options] = useState(() => shuffleOnce(task.options));
  const answerOf = (slotId: string) => task.options.find((option) => option.targetSlotId === slotId)?.text ?? "";
  const [filled, setFilled] = useState<Record<string, string>>(() => (solved ? Object.fromEntries(slotIds.map((id) => [id, answerOf(id)])) : {}));
  const [activeSlotId, setActiveSlotId] = useState<string | null>(() => (solved ? null : slotIds[0] ?? null));
  const [miss, setMiss] = useState<{ id: string; count: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const isComplete = slotIds.every((id) => Boolean(filled[id]));
  const target = activeSlotId && !filled[activeSlotId] ? activeSlotId : slotIds.find((id) => !filled[id]) ?? null;

  function choose(option: (typeof task.options)[number]) {
    if (isComplete || !target) return;
    if (option.targetSlotId !== target) {
      setMiss((prev) => ({ id: target, count: (prev?.count ?? 0) + 1 }));
      setMessage(option.explanation);
      playBattleSound("wrong");
      return;
    }
    const next = { ...filled, [target]: option.text };
    setFilled(next);
    setMiss(null);
    const nextEmpty = slotIds.find((id) => !next[id]) ?? null;
    setActiveSlotId(nextEmpty);
    if (!nextEmpty) {
      setMessage(task.successFeedback);
      onResolved();
    } else {
      setMessage(null);
    }
  }

  // segments의 줄바꿈을 기준으로 칠판 줄을 나눈다.
  const lines: (typeof task.segments)[] = [[]];
  for (const segment of task.segments) {
    if (segment.slotId) { lines[lines.length - 1].push(segment); continue; }
    const parts = segment.text.split("\n");
    parts.forEach((part, index) => {
      if (index > 0) lines.push([]);
      if (part) lines[lines.length - 1].push({ text: part });
    });
  }

  return (
    <div className="chalkboard-frame chalk-task">
      <div className="chalkboard-surface">
        <h3 className="chalk-title">{question}</h3>
        <ul className="chalk-lines">
          {lines.filter((line) => line.length).map((line, lineIndex) => (
            <li className="chalk-line" key={lineIndex}>
              {line.map((segment, index) => {
                if (!segment.slotId) return <Fragment key={index}>{segment.text.replace(/^•\s*/, "")}</Fragment>;
                const value = filled[segment.slotId];
                if (value) return <span className="chalk-answer" key={index}>{value}</span>;
                const shaking = miss?.id === segment.slotId;
                return (
                  <button
                    aria-label={segment.slotLabel ?? "빈칸"}
                    className={`chalk-blank ${target === segment.slotId ? "active" : ""} ${shaking ? "shake" : ""}`}
                    key={shaking ? `${segment.slotId}-${miss?.count}` : segment.slotId}
                    onClick={() => { setActiveSlotId(segment.slotId!); setMessage(null); }}
                    type="button"
                  >
                    {CIRCLED_NUMBERS[slotIds.indexOf(segment.slotId)] ?? "?"}
                  </button>
                );
              })}
            </li>
          ))}
        </ul>
      </div>
      <div className="chalk-tray" aria-live="polite">
        {!isComplete ? (
          <>
            <span className="chalk-tray-label">빈칸 {target ? CIRCLED_NUMBERS[slotIds.indexOf(target)] : ""}에 알맞은 낱말</span>
            <div className="chalk-tray-words">
              {options.filter((option) => !Object.values(filled).includes(option.text)).map((option) => (
                <button className="chalk-word-card" key={option.id} onClick={() => choose(option)} type="button">{option.text}</button>
              ))}
            </div>
          </>
        ) : (
          <span className="chalk-tray-label">빈칸을 모두 채웠어요</span>
        )}
        <span className="chalk-tray-count">{isComplete ? "✓ 완성" : `남은 칸 ${slotIds.filter((id) => !filled[id]).length}`}</span>
        {message && <p className={`chalk-message ${isComplete ? "correct" : "wrong"}`}>{message}</p>}
      </div>
    </div>
  );
}

{/* 칠판형 객관식: 보기 가운데 하나에 동그라미를 친다. */}
function ChalkChoiceTask({ choiceFeedback, choices, onChoice, question, resolvedChoice, wrongChoices }: { choiceFeedback: string; choices: DialogueChoice[]; onChoice: (choice: DialogueChoice, index: number) => void; question: string; resolvedChoice: number | null; wrongChoices: number[] }) {
  const solved = resolvedChoice !== null && resolvedChoice >= 0;
  return (
    <div className="chalkboard-frame chalk-task">
      <div className="chalkboard-surface">
        <h3 className="chalk-title">{question}</h3>
        <ol className="chalk-choice-list">
          {choices.map((item, index) => {
            const isWrong = wrongChoices.includes(index);
            return (
              <li key={item.text}>
                <button
                  className={`chalk-choice ${resolvedChoice === index ? "circled" : ""} ${isWrong ? "crossed" : ""}`}
                  disabled={solved || isWrong}
                  onClick={() => onChoice(item, index)}
                  type="button"
                >
                  <span className="chalk-ox-num">{CIRCLED_NUMBERS[index]}</span> {item.text}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="chalk-tray" aria-live="polite">
        <span className="chalk-tray-label">{solved ? "정답을 찾았어요" : "알맞은 답에 동그라미를 쳐 보세요"}</span>
        <span className="chalk-tray-count">{solved ? "✓ 완성" : "한 개 고르기"}</span>
        {choiceFeedback && <p className={`chalk-message ${solved ? "correct" : "wrong"}`}>{choiceFeedback}</p>}
      </div>
    </div>
  );
}

function ReasonPicker({ onDone, step }: { onDone: () => void; step: ActivityReason }) {
  const [wrong, setWrong] = useState<string[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const pick = (option: ActivityReason["options"][number]) => {
    if (done) return;
    if (option.correct) {
      setDone(true);
      setHint(null);
      onDone();
    } else {
      setWrong((items) => [...items, option.text]);
      setHint(option.hint);
    }
  };
  return (
    <div className="activity-reason">
      <strong>🤔 {step.prompt}</strong>
      <div className="activity-reason-options">
        {step.options.map((option) => (
          <button
            className={`${wrong.includes(option.text) ? "wrong" : ""} ${done && option.correct ? "correct" : ""}`}
            disabled={done || wrong.includes(option.text)}
            key={option.text}
            onClick={() => pick(option)}
            type="button"
          >
            {option.text}
          </button>
        ))}
      </div>
      {hint && <p className="activity-hint">💡 {hint}</p>}
    </div>
  );
}

function ActivityFeedback({ text, tone }: { text: string; tone: "correct" | "wrong" }) {
  return (
    <div className={`stage-feedback ${tone}`}>
      <div className="feedback-text-wrap"><span>{text}</span></div>
    </div>
  );
}

{/* 유물 분류 전시실 */}
function SortExhibitComponent({ onResolved, task }: { onResolved: () => void; task: SortExhibitTask }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [placed, setPlaced] = useState<string[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);
  const allPlaced = placed.length === task.cards.length;
  const selected = task.cards.find((card) => card.id === selectedId);

  const placeInRoom = (roomId: string) => {
    if (!selected) {
      setHint("먼저 위에서 카드를 하나 골라 보세요.");
      return;
    }
    if (selected.roomId === roomId) {
      setPlaced((ids) => [...ids, selected.id]);
      setHint(null);
    } else {
      setHint(selected.hint);
    }
    setSelectedId(null);
  };

  const renderCard = (card: SortExhibitTask["cards"][number]) => (
    <>
      {card.image ? <img alt={card.text} src={card.image} /> : <span className="activity-card-icon">{card.icon}</span>}
      <b>{card.text}</b>
    </>
  );

  return (
    <div className="activity-sort">
      <div className="activity-sort-cards">
        {task.cards.filter((card) => !placed.includes(card.id)).map((card) => (
          <button className={selectedId === card.id ? "selected" : ""} key={card.id} onClick={() => { setSelectedId(card.id); setHint(null); }} type="button">
            {renderCard(card)}
          </button>
        ))}
      </div>
      <div className="activity-sort-rooms">
        {task.rooms.map((room) => (
          <button className={selected ? "target-waiting" : ""} disabled={allPlaced} key={room.id} onClick={() => placeInRoom(room.id)} type="button">
            <strong>{room.icon} {room.title}</strong>
            <span className="activity-room-items">
              {task.cards.filter((card) => placed.includes(card.id) && card.roomId === room.id).map((card) => <em key={card.id}>{card.text}</em>)}
            </span>
          </button>
        ))}
      </div>
      {hint && <p className="activity-hint">💡 {hint}</p>}
      {allPlaced && !resolved && <ReasonPicker onDone={() => { setResolved(true); onResolved(); }} step={task.reason} />}
      {resolved && <ActivityFeedback text={`🎉 ${task.successFeedback}`} tone="correct" />}
      {task.source && <small className="activity-source">{task.source}</small>}
    </div>
  );
}

{/* 증거 모으기 수사 */}
function EvidenceCaseComponent({ onResolved, task }: { onResolved: () => void; task: EvidenceCaseTask }) {
  const [collected, setCollected] = useState<string[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [note, setNote] = useState<{ text: string; tone: "correct" | "wrong" } | null>(null);
  const [resolved, setResolved] = useState(false);
  const needed = task.evidence.filter((item) => item.isEvidence).length;
  const allCollected = collected.length === needed;

  const inspect = (item: EvidenceCaseTask["evidence"][number]) => {
    if (item.isEvidence) {
      setCollected((ids) => [...ids, item.id]);
      setNote({ text: `🔎 증거 확보! ${item.note}`, tone: "correct" });
    } else {
      setRejected((ids) => [...ids, item.id]);
      setNote({ text: `⚠️ 증거가 아니에요. ${item.note}`, tone: "wrong" });
    }
  };

  return (
    <div className="activity-evidence">
      <span className="activity-step">📁 모은 증거 {collected.length} / {needed}</span>
      <div className="activity-evidence-cards">
        {task.evidence.map((item) => (
          <button
            className={`${collected.includes(item.id) ? "collected" : ""} ${rejected.includes(item.id) ? "rejected" : ""}`}
            disabled={allCollected || collected.includes(item.id) || rejected.includes(item.id)}
            key={item.id}
            onClick={() => inspect(item)}
            type="button"
          >
            <span className="activity-card-icon">{item.icon}</span>
            <b>{item.text}</b>
          </button>
        ))}
      </div>
      {note && !resolved && <ActivityFeedback text={note.text} tone={note.tone} />}
      {allCollected && !resolved && <ReasonPicker onDone={() => { setResolved(true); onResolved(); }} step={task.conclusion} />}
      {resolved && <ActivityFeedback text={`🎉 ${task.successFeedback}`} tone="correct" />}
    </div>
  );
}

{/* ===== v3에서 이식한 범용 과제: 두 바구니 분류, OX 판정, 문서 복원 ===== */}
function CategorySortTaskComponent({ onResolved, question, solved, task }: { onResolved: () => void; question: string; solved: boolean; task: Extract<InteractiveTask, { type: "category-sort" }> }) {
  const [shuffledItems] = useState(() => {
    const list = [...task.items];
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  });
  const [sortedMap, setSortedMap] = useState<Record<string, "left" | "right">>(() => (solved ? Object.fromEntries(task.items.map((item) => [item.id, item.category])) : {}));
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [miss, setMiss] = useState<{ side: "left" | "right"; count: number } | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; tone: "correct" | "wrong" } | null>(null);

  const remainingItems = shuffledItems.filter((item) => !sortedMap[item.id]);
  const isComplete = remainingItems.length === 0;
  const activeId = selectedItemId && !sortedMap[selectedItemId] ? selectedItemId : (remainingItems[0]?.id ?? null);

  const handleColumnClick = (side: "left" | "right") => {
    if (isComplete || !activeId) return;
    const item = shuffledItems.find((it) => it.id === activeId);
    if (!item) return;
    if (item.category !== side) {
      setMiss((prev) => ({ side, count: (prev?.count ?? 0) + 1 }));
      setFeedback({ text: item.explanation, tone: "wrong" });
      playBattleSound("wrong");
      return;
    }
    const nextMap = { ...sortedMap, [item.id]: side };
    setSortedMap(nextMap);
    setMiss(null);
    const nextRemaining = shuffledItems.filter((it) => !nextMap[it.id]);
    setSelectedItemId(nextRemaining[0]?.id ?? null);
    if (nextRemaining.length === 0) {
      setFeedback({ text: task.successFeedback, tone: "correct" });
      onResolved();
    } else {
      setFeedback(null);
    }
  };

  const column = (side: "left" | "right") => {
    const title = side === "left" ? task.leftBucketTitle : task.rightBucketTitle;
    const desc = side === "left" ? task.leftBucketDesc : task.rightBucketDesc;
    const emoji = side === "left" ? task.leftBucketEmoji : task.rightBucketEmoji;
    const items = shuffledItems.filter((it) => sortedMap[it.id] === side);
    return (
      <button
        className={`chalk-sort-column ${activeId && !isComplete ? "ready" : ""} ${miss?.side === side ? "shake" : ""}`}
        disabled={isComplete}
        key={miss?.side === side ? `${side}-${miss.count}` : side}
        onClick={() => handleColumnClick(side)}
        type="button"
      >
        <span className="chalk-sort-heading">{emoji} {title}</span>
        {desc && <small className="chalk-sort-desc">{desc}</small>}
        <span className="chalk-sort-items">
          {items.map((it) => <span className="chalk-answer" key={it.id}>{it.text}</span>)}
          {!items.length && <span className="chalk-sort-empty">{activeId ? "여기에 담기" : ""}</span>}
        </span>
      </button>
    );
  };

  return (
    <div className="chalkboard-frame chalk-task">
      <div className="chalkboard-surface">
        <h3 className="chalk-title">{question}</h3>
        {!isComplete && (
          <div className="chalk-sort-pool">
            {remainingItems.map((item) => (
              <button
                className={`chalk-sort-chip ${item.id === activeId ? "active" : ""}`}
                key={item.id}
                onClick={() => { setSelectedItemId(item.id); setFeedback(null); }}
                type="button"
              >
                {item.emoji && <span aria-hidden="true">{item.emoji}</span>} {item.text}
              </button>
            ))}
          </div>
        )}
        <div className="chalk-sort-columns">
          {column("left")}
          {column("right")}
        </div>
      </div>
      <div className="chalk-tray" aria-live="polite">
        <span className="chalk-tray-label">{isComplete ? "모두 나누었어요" : "낱말을 고른 뒤 알맞은 칸을 눌러 보세요"}</span>
        <span className="chalk-tray-count">{isComplete ? "✓ 완성" : `남은 낱말 ${remainingItems.length}`}</span>
        {feedback && <p className={`chalk-message ${feedback.tone}`}>{feedback.text}</p>}
      </div>
    </div>
  );
}

{/* 칠판형 OX 판정: 문장마다 O나 X에 동그라미를 친 뒤 한꺼번에 확인한다. */}
function OxVerdictTaskComponent({ onResolved, question, solved, task }: { onResolved: () => void; question: string; solved: boolean; task: Extract<InteractiveTask, { type: "ox-verdict" }> }) {
  const [verdicts, setVerdicts] = useState<Record<string, boolean>>(() => (solved ? Object.fromEntries(task.statements.map((stmt) => [stmt.id, stmt.isTrue])) : {}));
  const [isSuccess, setIsSuccess] = useState(solved);
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [checkCount, setCheckCount] = useState(0);

  const allSelected = task.statements.every((stmt) => verdicts[stmt.id] !== undefined);

  const handleStamp = (id: string, value: boolean) => {
    if (isSuccess) return;
    setVerdicts((prev) => ({ ...prev, [id]: value }));
    setWrongIds((prev) => prev.filter((item) => item !== id));
  };

  const handleConfirm = () => {
    if (!allSelected || isSuccess) return;
    const wrongStmts = task.statements.filter((stmt) => verdicts[stmt.id] !== stmt.isTrue);
    setCheckCount((count) => count + 1);
    if (wrongStmts.length === 0) {
      setIsSuccess(true);
      setWrongIds([]);
      onResolved();
    } else {
      setWrongIds(wrongStmts.map((stmt) => stmt.id));
      playBattleSound("wrong");
    }
  };

  const wrongStmts = task.statements.filter((stmt) => wrongIds.includes(stmt.id));

  return (
    <div className="chalkboard-frame chalk-task">
      <div className="chalkboard-surface">
        <h3 className="chalk-title">{question}</h3>
        <ol className="chalk-ox-list">
          {task.statements.map((stmt, idx) => {
            const picked = verdicts[stmt.id];
            const isWrong = wrongIds.includes(stmt.id);
            return (
              <li className={`chalk-ox-row ${isWrong ? "shake" : ""}`} key={isWrong ? `${stmt.id}-${checkCount}` : stmt.id}>
                <span className="chalk-ox-num">{idx + 1}.</span>
                <span className="chalk-ox-text">{stmt.text}</span>
                <span className="chalk-ox-choices">
                  ({" "}
                  <button aria-label={`${idx + 1}번 맞음`} className={`chalk-circle-word ${picked === true ? "circled" : ""}`} disabled={isSuccess} onClick={() => handleStamp(stmt.id, true)} type="button">O</button>
                  <span className="chalk-slash"> / </span>
                  <button aria-label={`${idx + 1}번 틀림`} className={`chalk-circle-word ${picked === false ? "circled" : ""}`} disabled={isSuccess} onClick={() => handleStamp(stmt.id, false)} type="button">X</button>
                  {" "})
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="chalk-tray" aria-live="polite">
        {isSuccess ? (
          <span className="chalk-tray-label">모두 바르게 판정했어요</span>
        ) : (
          <button className="chalk-word-card chalk-confirm" disabled={!allSelected} onClick={handleConfirm} type="button">판정 확인하기</button>
        )}
        <span className="chalk-tray-count">{isSuccess ? "✓ 완성" : `고른 문장 ${Object.keys(verdicts).length} / ${task.statements.length}`}</span>
        {isSuccess && checkCount > 0 && <p className="chalk-message correct">{task.successFeedback}</p>}
        {!isSuccess && wrongStmts.length > 0 && (
          <p className="chalk-message wrong">다시 생각해 볼 문장이 있어요. {wrongStmts.map((stmt) => `${task.statements.indexOf(stmt) + 1}번: ${stmt.explanation}`).join(" ")}</p>
        )}
      </div>
    </div>
  );
}

function DialogueMultiCheck({ check, onResolved }: { check: DialogueMultiCheckData; onResolved: () => void }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string[]>([]);
  const [passed, setPassed] = useState(false);
  const toggleOption = (id: string) => { if (passed) return; setFeedback([]); setSelectedIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]); };
  const submit = () => {
    const selected = new Set(selectedIds); const missed = check.options.filter((option) => option.isAnswer && !selected.has(option.id)); const incorrect = check.options.filter((option) => !option.isAnswer && selected.has(option.id));
    if (!missed.length && !incorrect.length) { setPassed(true); setFeedback([check.successFeedback]); onResolved(); return; }
    // 틀린 보기는 이유를 알려 주고, 빠뜨린 정답은 개수만 알려 줘서 다시 생각해 보게 한다.
    const messages = [...incorrect.map((option) => `[틀린 보기] ${option.text} → ${option.explanation}`), ...(missed.length ? [`맞는 보기가 ${missed.length}개 더 있어요. 다시 읽어 보세요.`] : [])];
    setFeedback(messages);
  };
  const retry = () => { setSelectedIds([]); setFeedback([]); };
  const hasMeasure = check.options.some((opt) => opt.measureImage);
  const hasCard = check.options.some((opt) => opt.cardImage);
  return (
    <section className={`dialogue-multi-check ${hasMeasure ? "is-measure-quiz" : ""} ${hasCard ? "is-card-quiz" : ""}`} aria-label="여러 개 선택 확인문제">
      <small>💡 {check.instruction}</small>
      <div className={`dialogue-multi-options ${hasMeasure ? "has-measure" : ""} ${hasCard ? "has-staff-cards" : ""}`}>
        {check.options.map((option) => (
          <button
            aria-pressed={selectedIds.includes(option.id)}
            className={`${selectedIds.includes(option.id) ? "selected" : ""} ${passed && option.isAnswer ? "answer" : ""} ${option.measureImage || option.cardImage ? "is-measure-card" : ""}`}
            disabled={passed}
            key={option.id}
            onClick={() => toggleOption(option.id)}
            type="button"
          >
            {option.cardImage ? (
              <div className="staff-card-content">
                <div className="staff-card-header">
                  <b className="measure-check-mark">{selectedIds.includes(option.id) ? "✓" : "+"}</b>
                </div>
                <div className="staff-score-wrapper">
                  <img alt={option.text} className="staff-score-img" src={option.cardImage} />
                </div>
                <div className="staff-card-footer">
                  <strong className="staff-opt-name">{option.text}</strong>
                </div>
              </div>
            ) : option.measureImage ? (
              <div className="measure-card-content">
                <div className="measure-card-header">
                  {option.timeBadge && <span className={`measure-time-badge badge-${option.timeBadge.replace(/[^0-9]/g, "")}`}>{option.timeBadge}</span>}
                  <b className="measure-check-mark">{selectedIds.includes(option.id) ? "✓" : "+"}</b>
                </div>
                <div className="measure-score-wrapper">
                  <img alt={option.text} className="measure-score-img" src={option.measureImage} />
                </div>
                <div className="measure-card-footer">
                  <strong className="measure-opt-name">{option.text}</strong>
                </div>
              </div>
            ) : (
              <>
                {option.icons && option.icons.length > 0 ? (
                  <span className="multi-option-icons-row">
                    {option.icons.map((iconSrc, idx) => (
                      <img alt="" className="multi-option-icon" key={idx} src={iconSrc} />
                    ))}
                  </span>
                ) : option.icon ? (
                  <img alt="" className="multi-option-icon" src={option.icon} />
                ) : null}
                <b>{selectedIds.includes(option.id) ? "✓" : "+"}</b>
                <span>{option.text}</span>
              </>
            )}
          </button>
        ))}
      </div>
      <div className="dialogue-multi-actions">
        <button disabled={!selectedIds.length || passed} onClick={submit} type="button">선택 완료</button>
        {feedback.length > 0 && !passed && <button className="retry" onClick={retry} type="button">🔄 다시 풀기</button>}
      </div>
      {feedback.length > 0 && !passed && (
        <div className="multi-feedback wrong" role="status">
          <div className="multi-feedback-header">
            <strong>⚠️ 다시 확인해 봐요!</strong>
            <button className="task-retry-btn" onClick={retry} type="button">🔄 다시 풀기</button>
          </div>
          <ul>{feedback.map((message) => <li key={message}>{message}</li>)}</ul>
        </div>
      )}
    </section>
  );
}

function Battle({ answered, battle, bossPhase = 1, character, difficulty, isMuted, logs, onAnswer, onContinueEnemy, onContinueToAction, onEndTurn, onExit, onPlayCard, onRedraw, onRetryQuiz, onToggleAudio, onUseItem, ownedItems, quiz, stage, usedItems }: { answered: QuizOption | null; battle: BattleState; bossPhase?: BossPhase; character: (typeof characters)[number]; difficulty: AdventureDifficulty; isMuted?: boolean; logs: BattleLogEntry[]; onAnswer: (option: QuizOption) => void; onContinueEnemy: () => void; onContinueToAction: () => void; onEndTurn: () => void; onExit: () => void; onPlayCard: (card: CombatCard) => void; onRedraw: () => void; onRetryQuiz: () => void; onToggleAudio?: () => void; onUseItem: (itemId: RewardItemId) => void; ownedItems: RewardItemId[]; quiz: ReturnType<typeof generateStageQuiz>; stage: (typeof stages)[number]; usedItems: RewardItemId[] }) {
  const [logOpen, setLogOpen] = useState(false);
  const [minimizedQuizRound, setMinimizedQuizRound] = useState<number | null>(null);
  const quizMinimized = battle.phase === "quiz" && minimizedQuizRound === battle.round;
  const latestCombatLog = logs.at(-1);
  const logDialogRef = useDialogKeyboard(logOpen, () => setLogOpen(false));
  const currentBoss = bossPhases[bossPhase];

  return <main className="battle-page" style={{ "--stage": currentBoss.color, backgroundImage: `linear-gradient(#070a1baa,#070a1bee),url(${stage.background})` } as React.CSSProperties}>
    <header className="combat-header"><strong>{GAME.title}</strong><span>보스전 {bossPhase}단계 (총 3단계) · {currentBoss.name}</span><div className="combat-header-actions">{onToggleAudio && <AudioToggle isMuted={Boolean(isMuted)} onToggle={onToggleAudio} />}<button aria-expanded={logOpen} onClick={() => setLogOpen(true)} type="button">전투 로그</button><button onClick={onExit}>메뉴로 나가기</button></div></header>
    <section className="combat-stats"><Stat label={`${character.name} HP`} value={`${battle.playerHp} / ${battle.maxPlayerHp}`} /><Stat label={battle.physicalShield ? "물리 방패" : "물리 방어"} value={battle.physicalShield ? `${battle.basePhysicalDefense} · 준비` : battle.basePhysicalDefense + battle.physicalGuard} /><Stat label="마법 방어" value={battle.baseMagicDefense + battle.magicGuard} /><Stat label="정답 연쇄" value={`${battle.combo} / 3`} /><BagStat battle={battle} onUseItem={onUseItem} ownedItems={ownedItems} usedItems={usedItems} /><Stat label="보스 방어" value={`물리 ${battle.bossArmor} · 마법 ${battle.bossBarrier}`} /><Stat label="BOSS HP" value={`${battle.bossHp} / ${battle.maxBossHp}`} /></section>
    <section className="battlefield">
      <Fighter battle={battle} bossPhase={bossPhase} image={character.image} label={character.name} side="hero" />
      <div className="battlefield-center">
        {quizMinimized && <button className="quiz-reopen" onClick={() => setMinimizedQuizRound(null)} type="button">문제 보기</button>}
        <div className={`turn-energy ${battle.phase === "action" ? "active" : ""}`}><small>이번 턴 행동력</small><strong>{battle.energy}<i>/3</i></strong><span>{battle.phase === "action" ? "카드를 낼 수 있어요" : battle.phase.toUpperCase()}</span></div>
      </div>
      <Fighter battle={battle} bossPhase={bossPhase} image={currentBoss.image || stage.bossImage} label={currentBoss.name} showIntent={difficulty === "easy"} side="boss" />
    </section>
    <p aria-atomic="true" aria-live="polite" className="sr-only">{battle.message}</p><button aria-haspopup="dialog" className="battle-message" onClick={() => setLogOpen(true)} type="button">{battle.message}</button>
    {logOpen && <div className="battle-log-backdrop" onMouseDown={() => setLogOpen(false)}><section aria-labelledby="battle-log-title" aria-modal="true" className="battle-log-modal" onMouseDown={(event) => event.stopPropagation()} ref={logDialogRef} role="dialog"><header><div><p>RECENT BATTLE LOG</p><h2 id="battle-log-title">최근 전투 기록 <span>{logs.length} / 10</span></h2></div><button aria-label="전투 로그 닫기" onClick={() => setLogOpen(false)} type="button">×</button></header>{logs.length === 0 ? <p className="empty-battle-log">아직 전투 기록이 없어요. 문제를 풀거나 카드를 사용하면 여기에 표시됩니다.</p> : <ol>{[...logs].reverse().map((log, index) => <li key={log.id}><b>{logs.length - index}</b><div><span className="battle-log-meta">{formatBattleLogMeta(log)}</span><strong>{log.text}</strong>{log.detail && <small>{log.detail}</small>}</div></li>)}</ol>}<small>최근 10개까지 기록됩니다.</small></section></div>}
    {(battle.phase === "action" || quizMinimized) && <ActionPanel battle={battle} difficulty={difficulty} onEndTurn={onEndTurn} onPlayCard={onPlayCard} onRedraw={onRedraw} onUseItem={onUseItem} ownedItems={ownedItems} preview={quizMinimized} usedItems={usedItems} />}
    {(battle.phase === "quiz" || battle.phase === "reward") && !quizMinimized && <QuizModal answered={answered} battle={battle} battleLog={latestCombatLog} difficulty={difficulty} onAnswer={onAnswer} onContinueToAction={onContinueToAction} onMinimize={() => setMinimizedQuizRound(battle.round)} onRetryQuiz={onRetryQuiz} onUseItem={onUseItem} ownedItems={ownedItems} quiz={quiz} usedItems={usedItems} />}
    {battle.phase === "enemy" && (
      <div className="phase-banner-backdrop">
        <section aria-label="전투 진행 안내" className={`phase-banner ${battleFinished(battle) ? (battleWon(battle) ? "victory" : "defeat") : "enemy"}`}>
          <p className="phase-banner-badge">{battleFinished(battle) ? (battleWon(battle) ? "🏆 보스 격파 성공!" : "💀 전투 패배") : "⚔️ 보스의 차례"}</p>
          <h2 className="phase-banner-msg">{battle.message}</h2>
          <button className="phase-banner-btn" onClick={onContinueEnemy} type="button">
            {battleFinished(battle) ? (battleWon(battle) ? "다음 단계로 진행하기 →" : "결과 보기 →") : "다음 문제 →"}
          </button>
        </section>
      </div>
    )}
  </main>;
}
function Stat({ label, value }: { label: string; value: number | string }) { if (label === "정답 연쇄") return <ComboStat combo={Number(String(value).split("/")[0].trim())} />; const detail = ["물리 방어", "물리 방패", "마법 방어", "보스 방어"].includes(label); return <div className={detail ? "detail-stat" : "primary-stat"}><span>{label}</span><strong>{value}</strong></div>; }
function ComboStat({ combo }: { combo: number }) { const ready = combo >= 3; function recover() { window.dispatchEvent(new CustomEvent("combo-recover", { detail: Math.floor(Math.random() * 5) + 1 })); } return <div className="combo-stat primary-stat"><span>정답 연쇄</span><strong>{combo} / 3</strong>{ready ? <button onClick={recover}>HP 회복</button> : <small>오답 시 절반으로 감소</small>}</div>; }
function BagStat({ battle, onUseItem, ownedItems, usedItems }: { battle: BattleState; onUseItem: (itemId: RewardItemId) => void; ownedItems: RewardItemId[]; usedItems: RewardItemId[] }) {
  const [open, setOpen] = useState(false);
  const usableCount = ownedItems.filter((id) => !usedItems.includes(id)).length;
  const bagDialogRef = useDialogKeyboard(open, () => setOpen(false));
  return <div className="bag-stat"><button aria-expanded={open} onClick={() => setOpen(true)} type="button"><span>ITEMS</span><strong>가방 <b>{usableCount}</b></strong></button>{open && <div className="bag-modal-backdrop" onMouseDown={() => setOpen(false)}><section aria-labelledby="bag-title" aria-modal="true" className="bag-modal" onMouseDown={(event) => event.stopPropagation()} ref={bagDialogRef} role="dialog"><span>🎒</span><p className="eyebrow">RELIC BAG</p><h2 id="bag-title">고유 유물 가방 (도감)</h2><p>한 게임에서 각 유물은 한 번만 사용할 수 있어요. 퀴즈와 배틀 화면 상단 퀵슬롯에서도 원클릭으로 바로 쓸 수 있습니다!</p><div className="reward-item-list">{rewardItems.map((item) => { const owned = ownedItems.includes(item.id); const used = usedItems.includes(item.id); const usable = owned && !used && canUseRewardItem(item.id, battle.phase); return <article className={`${owned ? "owned" : "locked"} ${used ? "used" : ""}`} key={item.id} style={{ "--item": item.color } as React.CSSProperties}><i>{owned ? <RelicIconDisplay item={item} size={20} /> : "?"}</i><div><strong>{item.name}</strong><small>{owned ? item.description : `스테이지 ${item.stageId} 완주 보상`}</small><em>{used ? "사용 완료" : usable ? "지금 사용 가능" : owned ? item.timing : "미획득"}</em></div>{owned && !used && <button disabled={!usable} onClick={() => onUseItem(item.id)} type="button">사용하기</button>}</article>; })}</div><button onClick={() => setOpen(false)} type="button">닫기</button></section></div>}</div>;
}
function Fighter({ battle, bossPhase = 1, image, label, showIntent = false, side }: { battle: BattleState; bossPhase?: BossPhase; image: string; label: string; showIntent?: boolean; side: "hero" | "boss" }) {
  const currentBoss = bossPhases[bossPhase];
  const displayTitle = side === "hero" ? characters.find((character) => character.name === label)?.role ?? "역사 수호자" : currentBoss.title;
  const displayName = side === "hero" ? label : currentBoss.name;
  const hp = side === "hero" ? battle.playerHp : battle.bossHp;
  const max = side === "hero" ? battle.maxPlayerHp : battle.maxBossHp;
  const attackNotice = side === "boss" ? battle.attackNotice : undefined;
  const enemyAttack = side === "hero" ? battle.enemyAttackNotice : undefined;
  const bossAttack = side === "boss" ? battle.enemyAttackNotice : undefined;
  const quizDamage = side === "hero" ? battle.quizDamageNotice : undefined;
  const selfDamage = side === "hero" ? battle.selfDamageNotice : undefined;
  const wrongAnswer = side === "hero" && battle.phase === "reward" && battle.message.includes("오답");
  const bossConfused = side === "boss" && battle.bossEffect === "confusion";
  const confusionBurst = bossConfused && battle.phase === "action";
  const heroStance = battle.dodge ? "회피 준비" : battle.physicalShield ? "물리 방패 준비" : battle.magicGuard > 0 ? `마법 결계 +${battle.magicGuard}` : battle.attackBoost > 0 ? `공격 강화 +${battle.attackBoost}` : null;
  const bossStance = bossConfused ? "혼란" : battle.bossArmor > 0 ? `물리 방어 ${battle.bossArmor}` : battle.bossBarrier > 0 ? `마법 결계 ${battle.bossBarrier}` : battle.bossStance;
  return <article className={`fighter ${side} ${attackNotice ? `impact ${attackNotice.kind}-impact` : ""} ${side === "boss" && bossAttack ? `enemy-attacking ${bossAttack.kind}` : ""} ${side === "hero" && battle.playerEffect ? `player-effect ${battle.playerEffect}` : ""} ${wrongAnswer ? "wrong-answer" : ""} ${bossConfused ? "boss-confused" : ""} ${confusionBurst ? "confusion-burst" : ""}`}>
    <img alt={displayName} key={side === "boss" ? `boss-impact-${attackNotice?.sequence ?? 0}` : "hero"} src={image} />
    {side === "hero" && heroStance && <span className="fighter-stance hero-stance">{heroStance}</span>}
    {attackNotice && <><span aria-hidden="true" className={`boss-impact-flash ${attackNotice.kind}`} key={`flash-${attackNotice.sequence}`} /><div className={`battle-damage-pop ${attackNotice.kind}`} key={attackNotice.sequence}><strong>{attackNotice.defense > 0 ? attackNotice.brokeShield ? `${attackNotice.kind === "physical" ? "물리 방어막" : "마법 결계"} 파괴!` : `${attackNotice.kind === "physical" ? "물리 방어막" : "마법 결계"} -${attackNotice.shieldDamage}` : `${attackNotice.kind === "physical" ? "물리" : "마법"} 피해 ${attackNotice.damage}`}</strong>{attackNotice.defense > 0 && <small>{attackNotice.brokeShield ? `남은 피해 ${attackNotice.damage}` : `남은 내구도 ${attackNotice.shieldRemaining}`}</small>}</div></>}
    {enemyAttack && <div className={`battle-damage-pop ${enemyAttack.damage > 0 ? "player-hit" : "player-defense"} ${enemyAttack.kind}`} key={`${battle.round}-${enemyAttack.damage}-${enemyAttack.outcome ?? "hit"}`}><strong>{enemyAttack.damage > 0 ? `피해 ${enemyAttack.damage}` : enemyAttack.outcome === "dodge" ? "회피 성공!" : enemyAttack.outcome === "shield" ? "방패 방어!" : "방어 성공!"}</strong></div>}
    {quizDamage && <div className="battle-damage-pop player-hit physical" key={`quiz-${quizDamage}-${battle.score}`}><strong>피해 ${quizDamage}</strong></div>}
    {selfDamage && <div className="battle-damage-pop self-hit" key={`self-${battle.round}-${selfDamage}-${battle.impactSequence}`}><strong>반동 피해 ${selfDamage}</strong></div>}
    {wrongAnswer && <div className="wrong-pop">? ? ?</div>}
    {bossConfused && <div className="confusion-questions"><b>?</b><b>?</b><b>?</b></div>}
    <div className="fighter-name"><span className="fighter-title">{displayTitle}</span><strong>{displayName}</strong>{side === "boss" && showIntent && <small className="next-intent">다음 공격 · {battle.intent.label}</small>}{side === "boss" && <span className="fighter-stance boss-stance">{bossStance}</span>}<div className="hp-bar"><i style={{ width: `${Math.max(0, hp / max * 100)}%` }} /></div><div className="fighter-hp-row"><small>{hp} / {max}</small></div></div>
  </article>;
}

// 🚨 보스 출현 경보 컷씬 화면 (단계별 선택 및 출정)
function BossAlert({ unlockedPhase = 1, onStartBattle }: { character: (typeof characters)[number]; unlockedPhase: BossPhase; onStartBattle: (phase: BossPhase) => void }) {
  const [selectedPhase, setSelectedPhase] = useState<BossPhase>(unlockedPhase);
  const currentBoss = bossPhases[selectedPhase];

  const phaseCards: { phase: BossPhase; icon: string; name: string; title: string; color: string; activeBorder: string }[] = [
    { phase: 1, icon: bossPhases[1].icon, name: `1단계: ${bossPhases[1].name}`, title: bossPhases[1].title, color: "#b45309", activeBorder: "#f59e0b" },
    { phase: 2, icon: bossPhases[2].icon, name: `2단계: ${bossPhases[2].name}`, title: bossPhases[2].title, color: "#0284c7", activeBorder: "#38bdf8" },
    { phase: 3, icon: bossPhases[3].icon, name: `3단계: ${bossPhases[3].name}`, title: bossPhases[3].title, color: "#a855f7", activeBorder: "#c084fc" },
  ];

  return (
    <main className="landing-page" style={{ background: "radial-gradient(circle at center, #3b0764, #18032b 75%, #05010a)" }}>
      <div className="pixel-grid" />
      <section className="landing-shell" style={{ width: "100%", maxWidth: "1020px", textAlign: "center", padding: "1.2rem 1.5rem", margin: "auto" }}>
        <div style={{ display: "inline-block", background: "#f43f5e", color: "white", padding: "0.35rem 1.1rem", borderRadius: "999px", fontWeight: "900", fontSize: "0.9rem", marginBottom: "0.6rem", boxShadow: "0 0 20px #f43f5e88", animation: "pulse 1.5s infinite" }}>
          🚨 시공간 왜곡 경보 발령!
        </div>
        <h1 style={{ fontSize: "1.85rem", fontWeight: "900", color: "#fef08a", textShadow: "0 4px 12px rgba(0,0,0,0.8)", marginBottom: "0.4rem" }}>
          시간의 문 수호령 각성
        </h1>
        <p style={{ color: "#e2e8f0", fontSize: "0.95rem", lineHeight: "1.5", marginBottom: "1.2rem" }}>
          {GAME.bossAlertCleared}<br />
          출정할 보스 단계를 선택하고, 배운 역사 지식 카드로 <strong style={{ color: "#facc15" }}>수호령을 물리쳐 시간의 문을 여세요!</strong>
        </p>

        {/* 3대 보스 선택 카드 그리드 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.2rem", marginBottom: "1.4rem" }}>
          {phaseCards.map((card) => {
            const isUnlocked = card.phase <= unlockedPhase;
            const isSelected = card.phase === selectedPhase;

            return (
              <button
                key={card.phase}
                type="button"
                disabled={!isUnlocked}
                onClick={() => isUnlocked && setSelectedPhase(card.phase)}
                style={{
                  background: isSelected ? "rgba(250, 204, 21, 0.16)" : isUnlocked ? "rgba(255,255,255,0.07)" : "rgba(15, 23, 42, 0.6)",
                  border: isSelected ? `3px solid ${card.activeBorder}` : isUnlocked ? `2px solid ${card.color}` : "2px dashed #475569",
                  borderRadius: "16px",
                  padding: "1rem 0.8rem",
                  textAlign: "center",
                  cursor: isUnlocked ? "pointer" : "not-allowed",
                  opacity: isUnlocked ? 1 : 0.45,
                  transform: isSelected ? "scale(1.04)" : "scale(1)",
                  boxShadow: isSelected ? `0 0 24px ${card.activeBorder}88, 0 8px 16px rgba(0,0,0,0.6)` : "none",
                  transition: "all 0.18s ease",
                  color: "#fff",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div style={{ fontSize: "2.2rem", marginBottom: "0.35rem" }}>
                  {isUnlocked ? card.icon : "🔒"}
                </div>
                <strong style={{ color: isSelected ? "#fef08a" : isUnlocked ? "#fde68a" : "#94a3b8", display: "block", fontSize: "1.05rem", marginBottom: "0.2rem" }}>
                  {card.name}
                </strong>
                <small style={{ color: isUnlocked ? "#cbd5e1" : "#64748b", fontSize: "0.82rem", marginBottom: "0.4rem" }}>
                  {card.title}
                </small>
                <span
                  style={{
                    display: "inline-block",
                    fontSize: "0.72rem",
                    fontWeight: "900",
                    padding: "2px 8px",
                    borderRadius: "999px",
                    background: isSelected ? "#facc15" : isUnlocked ? "rgba(255,255,255,0.15)" : "#334155",
                    color: isSelected ? "#000" : isUnlocked ? "#f8fafc" : "#94a3b8",
                  }}
                >
                  {isSelected ? "선택됨 ✨" : isUnlocked ? "출정 가능" : `${card.phase - 1}단계 클리어 시 개방 🔒`}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => onStartBattle(selectedPhase)}
          style={{
            background: "linear-gradient(135deg, #f59e0b, #d97706)",
            color: "#000",
            fontWeight: "900",
            fontSize: "1.18rem",
            padding: "0.85rem 2.4rem",
            borderRadius: "999px",
            border: "3px solid #000",
            boxShadow: "0 5px 0 #78350f, 0 8px 18px rgba(0,0,0,0.5)",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          ⚔️ {selectedPhase}단계 [{currentBoss.shortName}] 카드배틀 출정!
        </button>
      </section>
    </main>
  );
}

// ⚡ 보스 진화 컷씬 모달
function BossPhaseModal({ currentPhase, onNextPhase }: { currentPhase: BossPhase; onNextPhase: () => void }) {
  const nextPhase = (currentPhase + 1) as BossPhase;
  const prevBoss = bossPhases[currentPhase];
  const nextBoss = bossPhases[nextPhase];

  return (
    <div className="bag-modal-backdrop" style={{ zIndex: 9999, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}>
      <section
        style={{
          background: "linear-gradient(145deg, #1e1b4b, #0f172a)",
          border: "4px solid #facc15",
          borderRadius: "28px",
          padding: "2.5rem 2rem",
          maxWidth: "540px",
          width: "90%",
          textAlign: "center",
          color: "white",
          boxShadow: "0 0 50px rgba(250, 204, 21, 0.3)",
          animation: "zoomIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div style={{ display: "inline-block", background: "#10b981", color: "white", padding: "0.3rem 1rem", borderRadius: "999px", fontWeight: "900", fontSize: "0.85rem", marginBottom: "1rem" }}>
          🏆 {currentPhase}단계 격파 성공!
        </div>
        <h2 style={{ fontSize: "1.8rem", fontWeight: "900", color: "#fef08a", marginBottom: "0.5rem" }}>
          {prevBoss.name}{objectParticle(prevBoss.name)} 격파했습니다!
        </h2>
        <p style={{ color: "#94a3b8", fontSize: "0.95rem", fontStyle: "italic", marginBottom: "1.5rem", whiteSpace: "pre-line", lineHeight: 1.5 }}>
          “{prevBoss.dialogueDefeat}”
        </p>

        <div style={{ background: "rgba(255,255,255,0.06)", border: "2px dashed #facc15", borderRadius: "20px", padding: "1.25rem 1.5rem", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem", marginBottom: "0.8rem" }}>
            <div style={{ position: "relative", width: "96px", height: "96px", borderRadius: "50%", overflow: "hidden", border: `3px solid ${nextBoss.color}`, boxShadow: `0 0 20px ${nextBoss.color}66` }}>
              <img src={nextBoss.image} alt={nextBoss.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div style={{ textAlign: "left" }}>
              <strong style={{ color: "#f87171", fontSize: "0.85rem", display: "block" }}>
                ⚠️ 다음 수호령 각성 경고!
              </strong>
              <h3 style={{ fontSize: "1.4rem", fontWeight: "900", color: nextBoss.color, margin: "0.2rem 0" }}>
                [{nextBoss.name}]
              </h3>
              <p style={{ color: "#cbd5e1", fontSize: "0.85rem", margin: 0 }}>{nextBoss.title}</p>
              <span style={{ display: "inline-block", background: "rgba(255,255,255,0.1)", padding: "0.15rem 0.6rem", borderRadius: "6px", fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.3rem" }}>
                {nextBoss.themeEra}
              </span>
            </div>
          </div>
          <p style={{ color: "#fef08a", fontSize: "0.85rem", fontStyle: "italic", background: "rgba(0,0,0,0.3)", padding: "0.6rem 0.8rem", borderRadius: "10px", margin: 0, textAlign: "left", lineHeight: 1.45, whiteSpace: "pre-line" }}>
            “{nextBoss.dialogueIntro}”
          </p>
        </div>

        <button
          onClick={onNextPhase}
          style={{
            background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
            color: "white",
            fontWeight: "900",
            fontSize: "1.15rem",
            padding: "0.9rem 2.2rem",
            borderRadius: "999px",
            border: "3px solid #000",
            boxShadow: "0 5px 0 #1e3a8a",
            cursor: "pointer",
            width: "100%",
          }}
        >
          ⚔️ {nextPhase}단계 [{nextBoss.name}] 결전 돌입! →
        </button>
      </section>
    </div>
  );
}

function isImageUrl(val?: string): boolean {
  if (!val) return false;
  return val.startsWith("/") || val.startsWith("http") || /\.(png|jpe?g|webp|svg|gif)$/i.test(val);
}

function renderQuizPrompt(prompt: string) {
  const parts = prompt.split(/(\[[^\]]+\][가-힣]*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("[")) {
      return (
        <span key={i} className="quiz-keyword-chunk">
          {part}
        </span>
      );
    }
    return part;
  });
}

function QuizModal({ answered, battle, onAnswer, onContinueToAction, onMinimize, onRetryQuiz, onUseItem, ownedItems, quiz, usedItems }: { answered: QuizOption | null; battle: BattleState; battleLog: BattleLogEntry | undefined; difficulty: AdventureDifficulty; onAnswer: (option: QuizOption) => void; onContinueToAction: () => void; onMinimize: () => void; onRetryQuiz: () => void; onUseItem: (itemId: RewardItemId) => void; ownedItems: RewardItemId[]; quiz: ReturnType<typeof generateStageQuiz>; usedItems: RewardItemId[] }) {
  const [zoomDiagram, setZoomDiagram] = useState<string | null>(null);
  const isLongOption = quiz.options.some((option) => 
    option.text.length > 7 || 
    option.text.includes(" ") || 
    option.text.includes("→") || 
    option.text.includes(",") || 
    option.text.includes("=") || 
    option.text.includes("\n")
  );
  const optionLayout = isLongOption ? "long" : "short";
  const mirrorActive = battle.mirrorTurns > 0;
  const sealedHintId = battle.quizHint ? quiz.options.find((option) => !option.isCorrect)?.id : undefined;
  const quizDialogRef = useDialogKeyboard(true, onMinimize);
  const feedbackRef = useRef<HTMLDivElement>(null);

  // 📜 정답/오답 제출 시 하단 해설 및 이동 버튼 영역으로 부드럽게 자동 스크롤
  useEffect(() => {
    if (answered) {
      feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [answered]);

  // ⌨️ 키보드 단축키 지원 (숫자 1~5로 보기 선택, Q/W/E/R로 4대 유물 퀵슬롯 발동)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (answered || zoomDiagram) return;

      // 1) 퀴즈 보기 선택: 숫자 1 ~ 5
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= quiz.options.length) {
        const targetOption = quiz.options[num - 1];
        const hintSealed = targetOption.id === sealedHintId;
        const sealed = (mirrorActive && targetOption.isBomb) || hintSealed;
        if (!sealed) {
          e.preventDefault();
          onAnswer(targetOption);
          return;
        }
      }

      // 2) 유물 퀵슬롯 단축키: Q, W, E, R (1~4단계 고유 유물 순서)
      const keyUpper = e.key.toUpperCase();
      const relicKeys: Record<string, RewardItemId> = {
        Q: "gate-guardian-crystal",  // 1단계 유물
        W: "mist-guide-crystal",      // 2단계 유물
        E: "precision-gear-crystal",  // 3단계 유물
        R: "truth-mirror-crystal",    // 4단계 유물
      };
      if (relicKeys[keyUpper]) {
        const itemId = relicKeys[keyUpper];
        const owned = ownedItems.includes(itemId);
        const used = usedItems.includes(itemId);
        const isCompassActive = itemId === "gate-guardian-crystal" && battle.quizHint;
        const isMirrorActive = itemId === "truth-mirror-crystal" && mirrorActive;
        const isMistActive = itemId === "mist-guide-crystal" && (battle.bossEffect === "confusion" || battle.confusedTurns > 0);
        const isBuffActive = isCompassActive || isMirrorActive || isMistActive;
        const canClick = owned && !used && !isBuffActive && !Boolean(answered);
        if (canClick) {
          e.preventDefault();
          onUseItem(itemId);
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [answered, battle, mirrorActive, onAnswer, onUseItem, ownedItems, quiz.options, sealedHintId, usedItems, zoomDiagram]);

  return (
    <div className="quiz-modal-backdrop">
      <section aria-labelledby="quiz-title" aria-modal="true" className={`quiz-modal ${optionLayout}`} ref={quizDialogRef} role="dialog">
        <header className="quiz-header">
          <div className="quiz-header-left">
            <span className="quiz-stage-badge">
              <span className="quiz-stage-dot"></span>
              {battle.round}라운드
            </span>
            <span className="quiz-gate-title">⚔️ 퀴즈 관문</span>
          </div>

          {/* ⚡ 컴팩트 유물 퀵슬롯 바 (4대 고유 유물 상시 일원화) */}
          <div className="quiz-relic-quickbar" aria-label="고유 유물 퀵슬롯">
            {rewardItems.map((item, rIdx) => {
              const owned = ownedItems.includes(item.id);
              const used = usedItems.includes(item.id);
              const isCompassActive = item.id === "gate-guardian-crystal" && battle.quizHint;
              const isMirrorActive = item.id === "truth-mirror-crystal" && mirrorActive;
              const isMistActive = item.id === "mist-guide-crystal" && (battle.bossEffect === "confusion" || battle.confusedTurns > 0);
              const isBuffActive = isCompassActive || isMirrorActive || isMistActive;
              const canClick = owned && !used && !isBuffActive && !Boolean(answered);
              const shortcutKey = ["Q", "W", "E", "R"][rIdx] || "";

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`quiz-quick-relic-btn ${owned ? "owned" : "locked"} ${used ? "used" : ""} ${isBuffActive ? "active-buff" : ""}`}
                  disabled={!canClick}
                  onClick={() => onUseItem(item.id)}
                  title={owned ? `[단축키 ${shortcutKey}] ${item.name}: ${item.description}\n[효과] ${item.howToUse}` : `${item.name}: ${item.stageId}단계 클리어 시 획득`}
                >
                  <kbd className="quick-relic-key-tag">{shortcutKey}</kbd>
                  <span className="quick-relic-icon"><RelicIconDisplay item={item} size={13} /></span>
                  <span className="quick-relic-name">{item.name}</span>
                  <small className="quick-relic-status">
                    {used ? "사용됨" : isBuffActive ? "발동 중" : owned ? "사용" : "잠김"}
                  </small>
                </button>
              );
            })}
          </div>

          <div className="quiz-header-right">
            <span className="quiz-goal-badge">🎯 정답 3 · 오답 2</span>
            {!answered && <button className="quiz-minimize" onClick={onMinimize} type="button">전장 보기 👁️</button>}
          </div>
        </header>

        {/* 🌟 사용자 맞춤형 2열 분할(Split Grid) 레이아웃: 좌측 문제&자료 / 우측 5지선다 */}
        <div className={`quiz-split-container${quiz.referenceNote ? "" : " quiz-split-container-no-reference"}`}>
          {/* [좌측 패널: 질문 지문 + 유물 탐구 카드 + 행동력 팁 바] */}
          <div className="quiz-left-col">
            <h1 id="quiz-title" className="quiz-title">{renderQuizPrompt(quiz.prompt)}</h1>

            {quiz.referenceNote && (
              <aside aria-label="역사 개념 참고 카드" className="quiz-reference-card">
                {quiz.referenceNote.tag && <span className="quiz-reference-tag">💡 {quiz.referenceNote.tag}</span>}
                <div className={`quiz-reference-img-frame${quiz.referenceNote.images?.length ? " quiz-reference-img-frame-multi" : ""}`}>
                  {quiz.referenceNote.images?.length ? (
                    <div className="quiz-reference-image-grid">
                      {quiz.referenceNote.images.map((image) => (
                        <figure className="quiz-reference-image-item" key={image.src}>
                          <img alt={image.label} className="quiz-reference-img" decoding="async" src={image.src} />
                          <figcaption>{image.label}</figcaption>
                        </figure>
                      ))}
                    </div>
                  ) : isImageUrl(quiz.referenceNote.symbol) ? (
                    <img alt={quiz.referenceNote.label} className="quiz-reference-img" decoding="async" src={quiz.referenceNote.symbol} />
                  ) : (
                    <span className="quiz-reference-emoji" aria-hidden="true">{quiz.referenceNote.symbol || "📜"}</span>
                  )}
                </div>
                <div className="quiz-reference-meta">
                  <strong className="quiz-reference-name">{quiz.referenceNote.label}</strong>
                  <p className="quiz-reference-desc">{quiz.referenceNote.desc}</p>
                  {quiz.referenceNote.source && (() => {
                    const src = quiz.referenceNote.source;
                    const isKogl = src.includes("공공누리") || src.includes("박물관") || src.includes("국가유산");
                    const isWiki = src.includes("위키미디어");
                    const icon = isKogl ? "📷" : isWiki ? "🗺️" : "🎨";
                    const badgeClass = isKogl ? "kogl" : isWiki ? "wikimedia" : "illustration";
                    return (
                      <span className={`quiz-reference-source ${badgeClass}`}>
                        <i aria-hidden="true">{icon}</i>
                        <span>{src}</span>
                      </span>
                    );
                  })()}
                </div>
              </aside>
            )}

            {/* 💡 세련된 행동력 팁 인디케이터 바 */}
            <div className="quiz-tip-bar">
              <span className="quiz-tip-icon">💡</span>
              <span className="quiz-tip-text">
                {mirrorActive ? (
                  <><b>{rewardItemById("truth-mirror-crystal")?.name}</b> 발동 중! 남은 {battle.mirrorTurns}턴 동안 정답을 투시합니다.</>
                ) : battle.quizHint ? (
                  <><b>{rewardItemById("gate-guardian-crystal")?.name}</b> 발동 중! 오답 선택지 1개를 봉인했습니다.</>
                ) : (
                  <>일반 정답은 <b>행동력 +2</b>, 숨겨진 🍀 럭키 정답은 <b>행동력 +3</b>을 얻습니다.</>
                )}
              </span>
            </div>
          </div>

          {/* [우측 패널: 1~5번 세로 스택 선택지 리스트] */}
          <div className="quiz-right-col">
            <div className={`quiz-options ${optionLayout}`}>
              {quiz.options.map((option, oIdx) => {
                const hintSealed = option.id === sealedHintId;
                const sealed = (mirrorActive && option.isBomb) || hintSealed;
                const luckyMarked = mirrorActive && option.isLucky;
                const hasOptionImage = Boolean(
                  option.equation ||
                  (option.symbols && option.symbols.some(isImageUrl)) ||
                  isImageUrl(option.symbol)
                );
                return (
                  <button
                    className={`quiz-option-btn ${answered?.id === option.id ? option.isCorrect ? "correct" : "wrong" : ""} ${luckyMarked ? "lucky-revealed" : ""} ${sealed ? "bomb-sealed" : ""} ${hasOptionImage ? "has-symbol" : ""}`}
                    disabled={Boolean(answered) || sealed}
                    key={option.id}
                    onClick={() => onAnswer(option)}
                  >
                    {luckyMarked && <small className="quiz-option-tag lucky">🍀 럭키</small>}
                    {hintSealed ? <small className="quiz-option-tag sealed">🔒 제외</small> : sealed && <small className="quiz-option-tag sealed">🔒 봉인</small>}
                    {option.equation ? (
                      <div
                        className={`quiz-option-equation-cluster ${option.equation.rightIcons.length >= 3 ? "many-items" : ""}`}
                        aria-hidden="true"
                      >
                        <img alt="" className="quiz-option-symbol left-symbol" src={option.equation.leftIcon} />
                        <span className="equation-eq-sign">=</span>
                        <div className="equation-right-icons">
                          {option.equation.rightIcons.map((sym, sIdx) => (
                            <img alt="" className="quiz-option-symbol" key={sIdx} src={sym} />
                          ))}
                        </div>
                      </div>
                    ) : option.symbols && option.symbols.some(isImageUrl) ? (
                      <div className={`quiz-option-symbols-cluster ${option.symbols.length >= 4 ? "dense-cluster" : option.symbols.length === 3 ? "medium-cluster" : ""}`} aria-hidden="true">
                        {option.symbols.filter(isImageUrl).map((sym, sIdx) => (
                          <img alt="" className="quiz-option-symbol" key={sIdx} src={sym} />
                        ))}
                      </div>
                    ) : isImageUrl(option.symbol) ? (
                      <img alt="" className="quiz-option-symbol" src={option.symbol} />
                    ) : null}
                    <span className="quiz-option-num-badge">{oIdx + 1}</span>
                    <span className="quiz-option-text">{option.text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {answered && (
          <div ref={feedbackRef} aria-live="polite" className={`quiz-feedback ${answered.isCorrect ? "correct" : "wrong"}`} role="status">
            <strong>{answered.isLucky ? "🍀 보너스 정답!" : answered.isCorrect ? "✓ 정답이에요!" : answered.isBomb ? "💣 폭탄 오답!" : "다시 확인해 봐요."}</strong>
            <p>{answered.explanation}</p>
            {answered.misconception && <small>오개념 진단: {answered.misconception}</small>}
            {answered.isCorrect ? (
              <button className="quiz-continue" onClick={onContinueToAction} type="button">전투로 이동 →</button>
            ) : battle.playerHp <= 0 ? (
              <button className="quiz-retry" onClick={onRetryQuiz} type="button">전투 결과 확인 →</button>
            ) : (
              <button className="quiz-retry" onClick={onRetryQuiz} type="button">🔄 다시 도전하기</button>
            )}
          </div>
        )}
      </section>
      {zoomDiagram && (
        <div className="diagram-modal-backdrop" onClick={() => setZoomDiagram(null)}>
          <div className="diagram-modal" onClick={(event) => event.stopPropagation()}>
            <header>
              <h3>📖 {quiz.diagramTitle ?? "국어 문법 개념 안내표"}</h3>
              <button onClick={() => setZoomDiagram(null)} type="button">닫기 ✕</button>
            </header>
            <div className="diagram-modal-body">
              <img alt="국어 문법 개념 안내표 크게 보기" decoding="async" src={zoomDiagram} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function getCardRole(card: CombatCard) { return ({ attack: "공격", magic: "마법", defense: "수비", dodge: "회피", heal: "회복", strategy: "전략", boost: "강화" } as const)[card.role]; }
function getCardRoleColor(card: CombatCard) { return ({ attack: "coral", magic: "violet", defense: "cyan", dodge: "mint", heal: "cyan", strategy: "amber", boost: "orange" } as const)[card.role]; }
function ActionPanel({ battle, difficulty, onEndTurn, onPlayCard, onRedraw, onUseItem, ownedItems, preview = false, usedItems }: { battle: BattleState; difficulty: AdventureDifficulty; onEndTurn: () => void; onPlayCard: (card: CombatCard) => void; onRedraw: () => void; onUseItem: (itemId: RewardItemId) => void; ownedItems: RewardItemId[]; preview?: boolean; usedItems: RewardItemId[] }) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const rulesDialogRef = useDialogKeyboard(rulesOpen, () => setRulesOpen(false));
  const showCardPreview = difficulty === "easy";
  return <section className={`action-panel ${preview ? "preview" : ""}`}><header><div className="hand-heading"><p>YOUR HAND · {battle.hand.length}/5 · 버림 {battle.discardCount}</p><strong>{preview ? "문제를 푸는 동안에는 손패를 확인만 할 수 있어요." : "행동력 안에서 공격·방어·회피·마법 카드를 조합하세요."}</strong></div><div className="action-controls">{!preview && (
          <div className="action-relic-quickbar" aria-label="고유 유물 퀵슬롯">
            {rewardItems.map((item) => {
              const owned = ownedItems.includes(item.id);
              const used = usedItems.includes(item.id);
              const isCompassActive = item.id === "gate-guardian-crystal" && battle.quizHint;
              const isMirrorActive = item.id === "truth-mirror-crystal" && battle.mirrorTurns > 0;
              const isMistActive = item.id === "mist-guide-crystal" && (battle.bossEffect === "confusion" || battle.confusedTurns > 0);
              const isBuffActive = isCompassActive || isMirrorActive || isMistActive;
              const canUse = owned && !used && battle.phase === "action";
              const statusLabel = used
                ? "사용됨"
                : isBuffActive
                ? "발동 중 ✨"
                : owned
                ? (item.id === "precision-gear-crystal"
                    ? "+2 행동력"
                    : item.id === "mist-guide-crystal"
                    ? "방어 파괴"
                    : item.id === "gate-guardian-crystal"
                    ? "오답 봉인"
                    : "럭키 투시")
                : "잠김";

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`action-quick-relic-btn relic-${item.id} ${owned ? "owned" : "locked"} ${used ? "used" : ""} ${isBuffActive ? "active-buff" : ""}`}
                  disabled={!canUse}
                  onClick={() => onUseItem(item.id)}
                  title={owned ? `${item.name}: ${item.description}\n[효과] ${item.howToUse}` : `${item.name}: ${item.stageId}단계 클리어 시 획득`}
                >
                  <i><RelicIconDisplay item={item} size={14} /></i>
                  <span>{item.name}</span>
                  <small>{statusLabel}</small>
                </button>
              );
            })}
          </div>
        )}
        <button aria-haspopup="dialog" className="card-draw-rules" onClick={() => setRulesOpen(true)} type="button">☷ 카드 뽑기 규칙</button>{!preview && <><button className="redraw-button" disabled={battle.energy < 2} onClick={onRedraw}>↻ 새로 뽑기 <b>2</b></button><button className="end-turn-button" onClick={onEndTurn}>{battle.bossHp <= 0 ? "승리 확인" : "턴 종료"} →</button></>}</div></header><div className="combat-hand">{battle.hand.map((card: CombatCard) => { const cardPreview = getCardPreview(battle, card); const ariaLabel = `${card.name}: 비용 ${card.cost}, ${getCardRole(card)}, ${card.description}${showCardPreview ? `. 예상 결과: ${cardPreview}` : ""}`; return <button aria-label={ariaLabel} className={getCardRoleColor(card)} disabled={preview || card.cost > battle.energy || battle.bossHp <= 0} key={card.instanceId} onClick={() => onPlayCard(card)}><span className="card-cost">{card.cost}</span><small className="card-role">{getCardRole(card)}</small><i aria-hidden="true">{card.symbol}</i><strong className="card-name">{card.name}</strong><em>{card.description}</em>{showCardPreview && <small className="card-preview">{cardPreview}</small>}</button>; })}</div>{rulesOpen && <div className="card-rules-backdrop" onMouseDown={() => setRulesOpen(false)}><section aria-labelledby="card-rules-title" aria-modal="true" className="card-rules-modal" onMouseDown={(event) => event.stopPropagation()} ref={rulesDialogRef} role="dialog"><header><div><p>CARD DRAW RULES</p><h2 id="card-rules-title">카드 뽑기 규칙</h2></div><button aria-label="카드 뽑기 규칙 닫기" onClick={() => setRulesOpen(false)} type="button">×</button></header><ol><li><b>1</b><div><strong>시작 손패 공격 보장</strong><span>시작할 때 공격 카드는 1~2장만 들어와요.</span></div></li><li><b>2</b><div><strong>정답 보상 드로우</strong><span>정답을 맞히면 빈 손패 자리에 카드 1장을 뽑아요.</span></div></li><li><b>3</b><div><strong>턴 시작 손패 보충</strong><span>다음 문제를 풀기 전 손패를 최소 4장까지 채워요.</span></div></li><li><b>4</b><div><strong>같은 카드 중복 제한</strong><span>같은 이름의 카드는 손에 1장만 뽑아요.</span></div></li></ol><button className="card-rules-close" onClick={() => setRulesOpen(false)} type="button">확인했어요</button></section></div>}</section>;
}
function Result({ earnedItem, earnedTitles, onNext, onSetup, score, stage, won }: { earnedItem: RewardItem | null; earnedTitles: AdventureTitle[]; onNext: () => void; onSetup: () => void; score: number; stage: (typeof stages)[number]; won: boolean }) { return <main className="result-page"><section><span className="result-icon">{won ? "✦" : "↻"}</span><p className="eyebrow">보스전 결과</p><h1>{won ? `${stage.bossName} 격파!` : "집중력이 모두 소진됐어요"}</h1><p>{won ? `시간의 조각을 하나 더 되찾았습니다. 퀴즈로 얻은 행동력을 카드 전략으로 바꾸는 데 성공했어요.` : "개념 설명을 다시 확인하고 방어·회피 카드로 보스 행동에 대비해 보세요."}</p>{earnedItem && <div className="reward-item-earned" style={{ "--item": earnedItem.color } as React.CSSProperties}><i><RelicIconDisplay item={earnedItem} size={24} /></i><span><small>새 고유 유물 획득</small><strong>{earnedItem.name}</strong><em>{earnedItem.description}</em></span></div>}{earnedTitles.map((title) => <EarnedTitleCard key={title.id} title={title} />)}<div className="result-score"><span>획득 점수</span><strong>{score}</strong></div><div className="result-actions"><button onClick={onNext}>{won ? stage.id === 4 ? "엔딩 보기" : "다음 구역" : "다시 도전"} →</button><button className="secondary" onClick={onSetup}>구역 선택</button></div></section></main>; }
function Ending({ character, collectedTitleIds, earnedTitles, onMain, onRefreshTitles, score }: { character: (typeof characters)[number]; collectedTitleIds: string[]; earnedTitles: AdventureTitle[]; onMain: () => void; onRefreshTitles: () => string[]; score: number }) {
  const [step, setStep] = useState<"dialogue" | "epilogue" | "celebration">("dialogue");
  const [epilogueIndex, setEpilogueIndex] = useState(0);
  const [titleCabinetOpen, setTitleCabinetOpen] = useState(false);

  const heroSpeech = GAME.ending.heroSpeech[character.id] ?? GAME.ending.heroSpeech.bau;

  const epilogueDialogue = [
    {
      speaker: bossPhases[3].name,
      roleTag: `👑 시간의 문을 지키는 수호령, ${bossPhases[3].name}`,
      portrait: bossPhases[3].image,
      title: "시간의 문 개방과 수호의 증명",
      speech: GAME.ending.bossSpeech,
    },
    {
      speaker: character.name,
      roleTag: `✨ ${character.role || "역사 수호대장"}`,
      portrait: character.image,
      title: "집으로 돌아가는 시간의 문 앞에서",
      speech: heroSpeech,
    },
    {
      speaker: "역사별이",
      roleTag: "✨ 역사 시간 여행의 별빛 안내자",
      portrait: "/characters/geulbyeol.webp",
      title: "현대로 이어지는 눈부신 빛의 통로",
      speech: "보세요! 현대로 이어지는 시간의 문이 활짝 열렸어요! 역사 탐험과 보스 대결을 멋지게 승리한 수호자님 덕분이에요! 자, 모두 집으로 출발!",
    },
    {
      speaker: bossPhases[3].name,
      roleTag: "👑 배웅하는 수호령",
      portrait: bossPhases[3].image,
      title: "현대로 돌아가는 후손들에게 바치는 축복",
      speech: "잘 가거라, 자랑스러운 후손들이여. 역사 시간 여행 동안 배운 우리 조상들의 지혜와 역사는 현대에 돌아가서도 너희 삶을 밝히는 가장 큰 힘이 될 것이다. 언제나 우리 역사를 잊지 말거라!",
    },
    {
      speaker: "역사 수호대 모두 함께",
      roleTag: "👑 역사별이 · 바우 · 아라 · 나래",
      portrait: "/characters/geulbyeol.webp",
      title: "시공간을 넘어 집으로! 대단원 피날레",
      speech: "시간의 문 속으로 출발! 집으로 돌아갑니다! 우리가 함께 달린 기적 같은 역사 시간 여행을 영원히 잊지 않을게요, 수호자님!",
    },
  ];

  const currentDialogue = epilogueDialogue[epilogueIndex];

  if (step === "dialogue") {
    return (
      <main className="ending-epilogue-page">
        <div className="epilogue-overlay" />
        <section aria-label="엔딩 에필로그 대화" className="epilogue-dialogue-shell">
          <header className="epilogue-header">
            <span className="epilogue-badge">🌟 대단원의 막</span>
            <div className="epilogue-header-right">
              <span className="epilogue-step-indicator">{epilogueIndex + 1} / {epilogueDialogue.length}</span>
              <button className="epilogue-skip-btn" onClick={() => setStep("celebration")} type="button">
                스킵하고 결과 보기 ⏭️
              </button>
            </div>
          </header>

          <div className="epilogue-stage">
            <div className="epilogue-portrait-box">
              <img alt={currentDialogue.speaker} className="epilogue-portrait-img" src={currentDialogue.portrait} />
              <div className="portrait-glow" />
            </div>

            <div className="epilogue-speech-card">
              <div className="speaker-header">
                <span className="speaker-role">{currentDialogue.roleTag}</span>
                <strong className="speaker-name">{currentDialogue.speaker}</strong>
              </div>
              <h3 className="speech-title">{currentDialogue.title}</h3>
              <p className="speech-body">&ldquo;{currentDialogue.speech}&rdquo;</p>

              <div className="epilogue-controls">
                {epilogueIndex > 0 ? (
                  <button className="epilogue-prev-btn" onClick={() => setEpilogueIndex((prev) => prev - 1)} type="button">
                    ← 이전 이야기
                  </button>
                ) : <span />}

                {epilogueIndex < epilogueDialogue.length - 1 ? (
                  <button className="epilogue-next-btn" onClick={() => setEpilogueIndex((prev) => prev + 1)} type="button">
                    다음 이야기 →
                  </button>
                ) : (
                  <button className="epilogue-next-btn finish" onClick={() => setStep("celebration")} type="button">
                    🎉 영광의 엔딩 확인하기 →
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="ending-page">
      <section className="ending-card">
        <div className="ending-party">
          <img alt="바우" src="/characters/bau-historical-v2.webp" />
          <img alt="역사별이" src="/characters/geulbyeol.webp" />
          <img alt="아라" src="/characters/ara-historical-v2.webp" />
          <img alt="나래" src="/characters/narae-historical-v2.webp" />
        </div>
        <p className="eyebrow">시간 여행 완료 · 대단원</p>
        <h1>시공간의 문을 열고 무사히 집으로 귀환했습니다!</h1>
        <p className="ending-lead-desc">
          {GAME.ending.lead}
        </p>

        {/* 4대 역사 탐구 및 보스전 완주 훈장 그리드 */}
        <div className="ending-chapters-grid">
          {GAME.ending.chapters.map((chapter, index) => (
            <div className="chapter-badge-item" key={chapter.title}>
              <span className="chapter-num">{index + 1}장 완료</span>
              <strong>{chapter.title}</strong>
              <small>{chapter.desc}</small>
            </div>
          ))}
          <div className="chapter-badge-item">
            <span className="chapter-num">보스전 완승</span>
            <strong>{bossPhases[3].name} 격파</strong>
            <small>세 수호령 모두 격파</small>
          </div>
        </div>

        <div className="ending-title-card">
          <span className="title-shine">👑 최종 수여 칭호</span>
          <strong className="ending-title">위대한 역사의 대수호자</strong>
          <p className="title-desc">{GAME.ending.finalTitleDesc}</p>
        </div>

        {earnedTitles.map((title) => <EarnedTitleCard key={title.id} title={title} />)}

        <div className="ending-score-box">
          <span>마지막 전투 점수</span>
          <strong>{score}</strong>
        </div>

        <div className="ending-action-buttons">
          <button className="replay-story-btn" onClick={() => { setStep("dialogue"); setEpilogueIndex(0); }} type="button">
            이야기 다시 보기 ↺
          </button>
          <button
            className="ending-title-btn"
            onClick={() => {
              onRefreshTitles();
              setTitleCabinetOpen(true);
            }}
            type="button"
          >
            칭호 보관함 확인 🏅
          </button>
          <button className="primary-button" onClick={onMain} type="button">
            메인 화면으로 🏰
          </button>
        </div>
      </section>
      {titleCabinetOpen && (
        <TitleCollection
          collectedTitleIds={collectedTitleIds}
          onClose={() => setTitleCabinetOpen(false)}
          onRefresh={onRefreshTitles}
        />
      )}
    </main>
  );
}

function MobileRestrictionNotice({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="mobile-restriction-backdrop" role="presentation">
      <section aria-labelledby="mobile-restriction-title" aria-modal="true" className="mobile-restriction-card" role="dialog">
        <button aria-label="안내 닫기" className="mobile-restriction-close" onClick={onContinue} type="button">✕</button>
        {/* 상단 안내 뱃지 */}
        <div className="mobile-restriction-badge">
          <span>⚠️</span>
          <span>스마트폰 이용 안내</span>
        </div>

        {/* 디바이스 아이콘 */}
        <div className="mobile-restriction-icon-box">
          <span>🖥️</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <h3 className="mobile-restriction-title" id="mobile-restriction-title">
            스마트폰에서도 이용할 수 있어요
          </h3>
          <p className="mobile-restriction-desc">
            역사팡은 <strong>PC 및 태블릿 환경</strong>에 가장 알맞게 설계되어 있어요. 작은 화면에서는 일부 내용이 작게 보일 수 있지만, 원하면 계속 진행할 수 있어요.
          </p>
        </div>

        {/* 권장 기기 안내 박스 */}
        <div className="mobile-restriction-device-guide">
          <div className="mobile-restriction-device-row">
            <span className="device-emoji">💻</span>
            <div className="device-info">
              <div className="device-name-wrap">
                <span className="device-name">PC / 노트북 / 크롬북</span>
                <span className="recommend-tag">★ 가장 추천</span>
              </div>
              <span className="device-tip">🖱️ <b>마우스와 키보드로 실습</b>할 때 가장 쾌적하고 편리해요!</span>
            </div>
          </div>
          <div className="mobile-restriction-device-row">
            <span className="device-emoji">📱</span>
            <div className="device-info">
              <span className="device-name">태블릿 (iPad, 갤럭시 탭)</span>
              <span className="device-tip" style={{ color: "#64748b" }}>넓은 대화면 터치로 원활하게 플레이 가능</span>
            </div>
          </div>
        </div>

        <button className="mobile-restriction-continue" onClick={onContinue} type="button">계속 진행하기</button>

        {/* 하단 안내 문구 */}
        <div className="mobile-restriction-footer-note">
          📜 이 안내는 현재 접속 중에는 다시 표시되지 않아요.
        </div>
      </section>
    </div>
  );
}

// 🗺️ 스테이지 클리어 노선도 안내 화면 (슈퍼마리오 / 교육콘텐츠 스타일 타임라인 맵)
const ROUTE_STAGES_INFO = GAME.routeStages;

function RouteMapScreen({
  character,
  targetStage,
  unlocked,
  onBack,
  onProceed,
}: {
  character: (typeof characters)[number];
  targetStage: StageId;
  unlocked: StageId;
  onBack: () => void;
  onProceed: (stage: StageId) => void;
}) {
  const currentTarget = ROUTE_STAGES_INFO.find((s) => s.id === targetStage) ?? ROUTE_STAGES_INFO[1];
  const isFinal = targetStage === 5;

  return (
    <main className="route-map-screen">
      {/* 상단 헤더부 */}
      <header className="route-map-header">
        <button className="route-back-btn" onClick={onBack} type="button">
          ← 시대 선택
        </button>
        <div className="route-header-center">
          <span className="route-sub-badge">
            {isFinal ? "마지막 길 열림" : "다음 시대 열림"}
          </span>
          <h1 className="route-main-title">
            {isFinal ? "파이널 존이 열렸어요" : `${currentTarget.name}${subjectParticle(currentTarget.name)} 열렸어요`}
          </h1>
          <p className="route-sub-desc">
            {character.name}와 역사별이가 {isFinal ? "마지막 전투 구역으로" : "다음 역사 구역으로"} 향합니다.
          </p>
        </div>
        <div className="route-header-placeholder" />
      </header>

      {/* 중앙 노선도 (스테이지 트랙) */}
      <div className="route-track-container">
        <div className="route-track-line" />
        <div className="route-nodes-row">
          {ROUTE_STAGES_INFO.map((item) => {
            const isCurrentTarget = item.id === targetStage;
            const isCompleted = !isCurrentTarget && unlocked > item.id;
            const isLocked = !isCurrentTarget && item.id > unlocked;

            return (
              <div
                className={`route-node-col ${isCurrentTarget ? "is-active" : isCompleted ? "is-completed" : "is-locked"}`}
                key={item.id}
              >
                <div
                  className="route-node-circle"
                  onClick={() => !isLocked && onProceed(item.id as StageId)}
                  role={isLocked ? undefined : "button"}
                  tabIndex={isLocked ? undefined : 0}
                >
                  {isCurrentTarget ? (
                    <span className="node-star-icon" style={{ color: item.color }}><StageEraIcon size={28} stageId={item.id} /></span>
                  ) : isCompleted ? (
                    <span className="node-check-icon">✓</span>
                  ) : (
                    <span className="node-lock-icon">🔒</span>
                  )}
                </div>

                <div className="route-node-labels">
                  <strong className="node-name">{item.name}</strong>
                  <span className="node-status">
                    {isCurrentTarget ? ("isFinal" in item && item.isFinal ? "최종 전투" : "진행대기") : isCompleted ? "완료" : "잠김"}
                  </span>
                </div>

                {isCurrentTarget && (
                  <button
                    className="route-action-cta-btn"
                    onClick={() => onProceed(item.id as StageId)}
                    type="button"
                  >
                    {item.actionBtnLabel}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 하단 다음 임무 안내 카드 */}
      <section className="route-mission-card">
        <div className="mission-char-left">
          <img alt={character.name} className="mission-char-img" src={character.image} />
        </div>

        <div className="mission-text-center">
          <span className="mission-badge-pill">
            {isFinal ? "최종 임무" : "다음 역사 탐구"}
          </span>
          <h2 className="mission-stage-title">{currentTarget.missionTitle}</h2>
          <p className="mission-stage-desc">{currentTarget.missionDesc}</p>
        </div>

        <div className="mission-char-right">
          <img alt="역사별이" className="mission-fairy-img" src="/characters/geulbyeol.webp" />
        </div>
      </section>
    </main>
  );
}


// 🎉 고유 유물 획득 안내 축하 모달 컴포넌트
function EarnedTitleCard({ title }: { title: AdventureTitle }) {
  const tier = titleTierDetails[title.tier];
  return (
    <div className="earned-title" style={{ "--title-color": tier.color } as React.CSSProperties}>
      <i>{tier.mark}</i>
      <span><small>새 칭호 획득 · {tier.label}</small><strong>{title.name}</strong><em>{title.condition}</em></span>
    </div>
  );
}

function RelicAcquiredModal({ onClose, relic }: { onClose: () => void; relic: RewardItem }) {
  const dialogRef = useDialogKeyboard(true, onClose);
  return (
    <div className="modal-backdrop relic-acquired-backdrop" onMouseDown={onClose} style={{ zIndex: 9999 }}>
      <section
        aria-labelledby="relic-acquired-title"
        aria-modal="true"
        className="relic-acquired-modal"
        onMouseDown={(e) => e.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        style={{ "--relic-glow": relic.color } as React.CSSProperties}
      >
        <div className="relic-burst-effect" aria-hidden="true">✦ ✧ ✦</div>
        <div className="relic-big-icon" style={{ borderColor: relic.color }}>
          <RelicIconDisplay item={relic} size={50} />
        </div>
        <p className="eyebrow" style={{ color: relic.color }}>새로운 유물 획득</p>
        <h2 id="relic-acquired-title">{relic.name}</h2>
        <div className="relic-effect-card">
          <div className="effect-header">
            <span className="effect-badge">고유 능력</span>
            <strong>{relic.description}</strong>
          </div>
          <div className="effect-guide">
            <span className="guide-title">⚔️ 보스전 전투 활용 가이드</span>
            <p className="guide-text">{relic.howToUse}</p>
          </div>
        </div>
        <button className="relic-confirm-btn" onClick={onClose} type="button">
          가방에 보관하고 계속하기 →
        </button>
      </section>
    </div>
  );
}
