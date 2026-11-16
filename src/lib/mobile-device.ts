export type MobileDeviceNavigator = {
  userAgent?: string;
  userAgentData?: { mobile?: boolean };
};

const SMARTPHONE_USER_AGENT = /iPhone|iPod|Android.+Mobile|Windows Phone|IEMobile|Opera Mini/i;

/**
 * 화면 폭이 아니라 브라우저가 알리는 실제 기기 정보만 사용한다.
 * 따라서 PC의 좁은 창·iframe·크롬북은 스마트폰 안내 대상으로 분류하지 않는다.
 */
export function isActualSmartphone(navigatorInfo?: MobileDeviceNavigator): boolean {
  if (!navigatorInfo) return false;
  if (navigatorInfo.userAgentData?.mobile === true) return true;
  return SMARTPHONE_USER_AGENT.test(navigatorInfo.userAgent ?? "");
}
