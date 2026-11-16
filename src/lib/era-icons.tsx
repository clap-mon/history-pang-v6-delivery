import React from "react";

export interface EraIconProps {
  className?: string;
  size?: number;
}

/**
 * ⚔️ 5단계: 파이널 존 — 역사 카드배틀 (Battle Cards)
 * 엇갈린 마법 배틀 카드 2장과 중앙의 빛나는 결전 스파크
 */
export function BattleCardsIcon({ className, size = 20 }: EraIconProps) {
  return (
    <svg
      className={className}
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 뒤 카드 */}
      <rect
        fill="currentColor"
        fillOpacity="0.15"
        height="13.5"
        rx="1.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
        transform="rotate(-14 8 11.5)"
        width="9.5"
        x="3.2"
        y="4.8"
      />
      {/* 앞 카드 */}
      <rect
        fill="currentColor"
        fillOpacity="0.25"
        height="13.5"
        rx="1.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        transform="rotate(12 15.5 12.5)"
        width="9.5"
        x="10.8"
        y="5.8"
      />
      {/* 중앙 결전 스파크 */}
      <path
        d="M 12 7 L 12.8 10.5 L 15.5 11.5 L 12.8 12.5 L 12 16 L 11.2 12.5 L 8.5 11.5 L 11.2 10.5 Z"
        fill="currentColor"
      />
    </svg>
  );
}

// 1단계: 대한 제국의 궁궐 지붕
function PalaceIcon({ className, size = 20 }: EraIconProps) {
  return <svg aria-hidden="true" className={className} fill="none" height={size} viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg">
    <path d="M3.5 10.2 12 4.3l8.5 5.9H3.5Z" fill="currentColor" fillOpacity=".18" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
    <path d="M5.7 10.2v8.4h12.6v-8.4M9.4 18.6v-5h5.2v5M7.9 8.1h8.2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
  </svg>;
}

// 2단계: 만세 시위 때 흔든 깃발
function FlagIcon({ className, size = 20 }: EraIconProps) {
  return <svg aria-hidden="true" className={className} fill="none" height={size} viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg">
    <path d="M6 4.5h12.5v9.5H6V4.5Z" fill="currentColor" fillOpacity=".18" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
    <circle cx="12.25" cy="9.25" r="2.3" stroke="currentColor" strokeWidth="1.5" />
    <path d="M6 4.5v16M8 6.7l1.2 1.2m6.6-1.2-1.2 1.2M8 11.8l1.2-1.2m6.6 1.2-1.2-1.2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
  </svg>;
}

// 3단계: 쌀을 실어 나르던 기차
function TrainIcon({ className, size = 20 }: EraIconProps) {
  return <svg aria-hidden="true" className={className} fill="none" height={size} viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg">
    <path d="M6 5.5h12a1.5 1.5 0 0 1 1.5 1.5v8.5a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V7A1.5 1.5 0 0 1 6 5.5Z" fill="currentColor" fillOpacity=".18" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
    <path d="M4.5 11.5h15M8 14.5h.01M16 14.5h.01M8 17.5l-2 3m10-3 2 3M3.5 20.5h17" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
  </svg>;
}

// 4단계: 피란지의 천막 학교
function TentIcon({ className, size = 20 }: EraIconProps) {
  return <svg aria-hidden="true" className={className} fill="none" height={size} viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg">
    <path d="M12 4.5 3.5 19.5h17L12 4.5Z" fill="currentColor" fillOpacity=".18" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
    <path d="M12 4.5v15m0 0-3.2-5.5M12 19.5l3.2-5.5M12 4.5l1-1.8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
  </svg>;
}

export function StageEraIcon({
  stageId,
  size = 20,
  className,
}: {
  stageId: number;
  size?: number;
  className?: string;
}) {
  switch (stageId) {
    case 1:
      return <PalaceIcon className={className} size={size} />;
    case 2:
      return <FlagIcon className={className} size={size} />;
    case 3:
      return <TrainIcon className={className} size={size} />;
    case 4:
      return <TentIcon className={className} size={size} />;
    case 5:
      return <BattleCardsIcon className={className} size={size} />;
    default:
      return null;
  }
}
