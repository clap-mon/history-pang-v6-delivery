// 칠판 판서 문법 해석기
// - [[정답|오답|오답]] : 빈칸. 누르면 낱말 카드가 나오고 첫 번째가 정답이다(화면에서는 섞는다).
// - ((불교/유교*))     : 두 낱말 중 하나에 동그라미를 친다. *가 붙은 쪽이 정답이다.
// - {{낱말}}            : 빈칸이 아닌 강조 낱말(분홍 글씨).

export type ChalkboardLine = string | { note: string };

export type ChalkboardPhoto = {
  src: string;
  caption: string;
  credit?: string;
};

export type Chalkboard = {
  title: string;
  lines: ChalkboardLine[];
  // 칠판 오른쪽 아래에 작게 붙이는 사진 (칠판당 최대 한 장)
  photo?: ChalkboardPhoto;
};

export type ChalkSegment =
  | { kind: "text"; text: string }
  | { kind: "mark"; text: string }
  | { kind: "blank"; id: string; answer: string; options: string[] }
  | { kind: "circle"; id: string; answer: string; options: string[] };

export type ParsedChalkLine = { note: boolean; segments: ChalkSegment[] };

const TOKEN = /\[\[([^\]]+)\]\]|\(\(([^)]+)\)\)|\{\{([^}]+)\}\}/g;

export function chalkLineText(line: ChalkboardLine) {
  return typeof line === "string" ? line : line.note;
}

export function parseChalkLine(line: ChalkboardLine, lineIndex: number): ParsedChalkLine {
  const source = chalkLineText(line);
  const segments: ChalkSegment[] = [];
  let cursor = 0;
  let slot = 0;
  for (const match of source.matchAll(TOKEN)) {
    const start = match.index ?? 0;
    if (start > cursor) segments.push({ kind: "text", text: source.slice(cursor, start) });
    const [, blank, circle, mark] = match;
    if (blank !== undefined) {
      const options = blank.split("|").map((word) => word.trim());
      segments.push({ kind: "blank", id: `l${lineIndex}-s${slot}`, answer: options[0] ?? "", options });
      slot += 1;
    } else if (circle !== undefined) {
      const raw = circle.split("/").map((word) => word.trim());
      const answer = raw.find((word) => word.endsWith("*"))?.slice(0, -1).trim() ?? "";
      segments.push({ kind: "circle", id: `l${lineIndex}-s${slot}`, answer, options: raw.map((word) => word.replace(/\*$/, "").trim()) });
      slot += 1;
    } else if (mark !== undefined) {
      segments.push({ kind: "mark", text: mark });
    }
    cursor = start + match[0].length;
  }
  if (cursor < source.length) segments.push({ kind: "text", text: source.slice(cursor) });
  return { note: typeof line !== "string", segments };
}

export function parseChalkboard(board: Chalkboard): ParsedChalkLine[] {
  return board.lines.map((line, index) => parseChalkLine(line, index));
}

export type ChalkSlot = Extract<ChalkSegment, { kind: "blank" | "circle" }>;

export function chalkSlots(board: Chalkboard): ChalkSlot[] {
  return parseChalkboard(board).flatMap((line) => line.segments.filter((segment): segment is ChalkSlot => segment.kind === "blank" || segment.kind === "circle"));
}

// 판서 검사: 문제가 있으면 사람이 읽을 수 있는 문장 목록을 돌려준다.
export const CHALKBOARD_LIMITS = { maxLines: 5, maxSlotsPerLine: 3, maxLineLength: 60, minBlankOptions: 3 };

export function checkChalkboard(board: Chalkboard): string[] {
  const problems: string[] = [];
  if (!board.title.trim()) problems.push("칠판 제목이 비어 있음");
  if (board.lines.length > CHALKBOARD_LIMITS.maxLines) problems.push(`줄이 ${board.lines.length}개 (최대 ${CHALKBOARD_LIMITS.maxLines}개)`);
  board.lines.forEach((line, index) => {
    const source = chalkLineText(line);
    const parsed = parseChalkLine(line, index);
    const visible = parsed.segments.map((segment) => (segment.kind === "text" || segment.kind === "mark" ? segment.text : segment.kind === "blank" ? segment.answer : `( ${segment.options.join(" / ")} )`)).join("");
    const where = `${index + 1}번째 줄`;
    if (/\[\[|\]\]|\(\(|\)\)|\{\{|\}\}/.test(parsed.segments.filter((segment) => segment.kind === "text").map((segment) => segment.text).join(""))) problems.push(`${where}: 닫히지 않은 판서 기호 - "${source.slice(0, 30)}"`);
    if (visible.length > CHALKBOARD_LIMITS.maxLineLength) problems.push(`${where}: ${visible.length}자 (최대 ${CHALKBOARD_LIMITS.maxLineLength}자)`);
    const slots = parsed.segments.filter((segment): segment is ChalkSlot => segment.kind === "blank" || segment.kind === "circle");
    if (slots.length > CHALKBOARD_LIMITS.maxSlotsPerLine) problems.push(`${where}: 빈칸 ${slots.length}개 (최대 ${CHALKBOARD_LIMITS.maxSlotsPerLine}개)`);
    for (const slot of slots) {
      if (!slot.answer) problems.push(`${where}: 정답이 비어 있음`);
      if (new Set(slot.options).size !== slot.options.length) problems.push(`${where}: "${slot.answer}" 칸의 정답과 오답이 겹침`);
      if (slot.options.some((option) => !option)) problems.push(`${where}: 빈 낱말 카드가 있음`);
      if (slot.kind === "blank" && slot.options.length < CHALKBOARD_LIMITS.minBlankOptions) problems.push(`${where}: "${slot.answer}" 칸의 낱말 카드가 ${slot.options.length}장 (최소 ${CHALKBOARD_LIMITS.minBlankOptions}장)`);
      if (slot.kind === "circle" && (slot.options.length !== 2 || !slot.options.includes(slot.answer))) problems.push(`${where}: 동그라미 선택지는 두 낱말 중 하나에 *를 붙여야 함`);
    }
  });
  return problems;
}
