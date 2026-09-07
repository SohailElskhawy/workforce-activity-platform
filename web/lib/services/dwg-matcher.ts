import { normalizeFileName } from "@/lib/agent/file-name";

export type ProjectCandidate = {
  id: string;
  code: string;
  name: string;
  tasks?: Array<{ id: string; title: string }>;
};

export type DwgMatchRule =
  | "EXACT_CODE_TOKEN"
  | "NORMALIZED_CODE"
  | "NAME_KEYWORDS"
  | "NONE";

export type DwgMatchResult = {
  fileName: string;
  normalizedFileName: string;
  matchedProject: { id: string; code: string; name: string } | null;
  matchedTask: { id: string; title: string } | null;
  confidence: number; // 0 to 1
  rule: DwgMatchRule;
  explanation: string;
  ambiguous: boolean;
  autoAppliable: boolean; // confidence >= 0.95 && !ambiguous && matchedProject !== null
};

const STOP_WORDS = new Set([
  "project",
  "proje",
  "projesi",
  "drawing",
  "cizim",
  "çizim",
  "plan",
  "plani",
  "planı",
  "detay",
  "rev",
  "revision",
  "revizyon",
  "draft",
  "taslak",
  "autocad",
  "cad",
  "dwg",
  "final",
  "yeni",
  "new",
  "block",
  "blok",
  "floor",
  "kat",
  "sheet",
  "layout",
  "pafta",
  "dosya",
  "file",
]);

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeToken(str: string): string {
  return str
    .toLowerCase()
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .trim();
}

function extractTokens(str: string): string[] {
  const normalized = normalizeToken(str);
  // Split on any non-alphanumeric character
  return normalized
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim())
    .filter(Boolean);
}

function stripSeparators(str: string): string {
  return normalizeToken(str).replace(/[-_.\s/\\+]+/g, "");
}

/**
 * Deterministically scores a DWG file against available company projects.
 * Follows strict rules:
 * Rule A: Exact normalized project code token (95-100%, eligible for auto-apply if unambiguous)
 * Rule B: Normalized code without separators (85-94%, suggestion only)
 * Rule C: Project name significant keywords (75-80%, suggestion only)
 * Rule D: Task title keywords under established project candidate only
 */
export function matchDwgFile(
  fileName: string,
  projects: ProjectCandidate[],
): DwgMatchResult {
  const normalizedFileName = normalizeFileName(fileName);
  if (!projects.length || !fileName.trim()) {
    return {
      fileName,
      normalizedFileName,
      matchedProject: null,
      matchedTask: null,
      confidence: 0,
      rule: "NONE",
      explanation: "No projects available for matching.",
      ambiguous: false,
      autoAppliable: false,
    };
  }

  // Pre-tokenize filename and full path string
  const lowerFileName = fileName.toLowerCase();
  const lowerNormalized = normalizedFileName.toLowerCase();
  const fileTokens = new Set(extractTokens(fileName));
  const fileTokensList = extractTokens(fileName);
  const strippedFile = stripSeparators(fileName);

  type ScoredCandidate = {
    project: ProjectCandidate;
    confidence: number;
    rule: DwgMatchRule;
    explanation: string;
  };

  const scoredCandidates: ScoredCandidate[] = [];

  for (const project of projects) {
    const rawCode = project.code.trim();
    if (!rawCode) continue;

    const lowerCode = rawCode.toLowerCase();
    const strippedCode = stripSeparators(rawCode);

    // Rule A: Exact project code token match (boundary check)
    // Regex matches token surrounded by non-alphanumeric or string start/end
    const exactTokenRegex = new RegExp(
      `(^|[^a-zA-Z0-9])${escapeRegex(lowerCode)}($|[^a-zA-Z0-9])`,
      "i",
    );
    const hasExactToken =
      exactTokenRegex.test(lowerFileName) ||
      exactTokenRegex.test(lowerNormalized);

    if (hasExactToken) {
      scoredCandidates.push({
        project,
        confidence: 1.0,
        rule: "EXACT_CODE_TOKEN",
        explanation: `Project code "${rawCode}" exactly matched filename token.`,
      });
      continue;
    }

    // Rule B: Normalized project code match (ignoring separators like '-' or '_')
    // e.g., code ABC-101 matching ABC101 in filename
    if (strippedCode.length >= 3) {
      const hasNormalizedToken = fileTokensList.some(
        (t) => t === strippedCode || stripSeparators(t) === strippedCode,
      );
      const isSubwordInStripped = strippedFile.includes(strippedCode);

      if (hasNormalizedToken || isSubwordInStripped) {
        scoredCandidates.push({
          project,
          confidence: 0.9,
          rule: "NORMALIZED_CODE",
          explanation: `Project code "${rawCode}" matched normalized code "${strippedCode}".`,
        });
        continue;
      }
    }

    // Rule C: Project name significant keywords
    const nameTokens = extractTokens(project.name).filter(
      (t) => t.length >= 3 && !STOP_WORDS.has(t),
    );

    if (nameTokens.length > 0) {
      const matchedTokens = nameTokens.filter((token) => fileTokens.has(token));
      const matchRatio = matchedTokens.length / nameTokens.length;

      if (matchedTokens.length >= 2 && matchRatio >= 0.75) {
        scoredCandidates.push({
          project,
          confidence: 0.8,
          rule: "NAME_KEYWORDS",
          explanation: `Project name keywords (${matchedTokens.join(", ")}) matched filename.`,
        });
      } else if (matchedTokens.length >= 1 && matchedTokens.some((t) => t.length >= 4)) {
        scoredCandidates.push({
          project,
          confidence: 0.75,
          rule: "NAME_KEYWORDS",
          explanation: `Project keyword "${matchedTokens[0]}" matched filename.`,
        });
      }
    }
  }

  // Sort by confidence descending
  scoredCandidates.sort((a, b) => b.confidence - a.confidence);

  if (!scoredCandidates.length) {
    return {
      fileName,
      normalizedFileName,
      matchedProject: null,
      matchedTask: null,
      confidence: 0,
      rule: "NONE",
      explanation: "No matching project code or name keywords found.",
      ambiguous: false,
      autoAppliable: false,
    };
  }

  const top = scoredCandidates[0];

  // Ambiguity check: if top candidate confidence >= 0.85 and second candidate is within 0.05 or >= 0.85
  let isAmbiguous = false;
  let finalExplanation = top.explanation;

  if (scoredCandidates.length > 1) {
    const second = scoredCandidates[1];
    // Check if second candidate is conflictingly close
    if (
      (top.confidence >= 0.95 && second.confidence >= 0.85) ||
      Math.abs(top.confidence - second.confidence) < 0.08
    ) {
      isAmbiguous = true;
      finalExplanation = `Ambiguous match between "${top.project.name}" (${top.project.code}) and "${second.project.name}" (${second.project.code}). Manager review required.`;
    }
  }

  // Only Rule A exact match with confidence >= 0.95 and NO ambiguity can be auto-applied
  const autoAppliable = top.confidence >= 0.95 && !isAmbiguous;

  // Rule D: Task Title matching under established project candidate only
  let matchedTask: { id: string; title: string } | null = null;
  if (top.project.tasks && top.project.tasks.length > 0) {
    let bestTask: { id: string; title: string } | null = null;
    let bestTaskScore = 0;

    for (const task of top.project.tasks) {
      const taskTokens = extractTokens(task.title).filter(
        (t) => t.length >= 3 && !STOP_WORDS.has(t),
      );
      if (!taskTokens.length) continue;

      const matchedTaskTokens = taskTokens.filter((t) => fileTokens.has(t));
      if (matchedTaskTokens.length > bestTaskScore && matchedTaskTokens.length > 0) {
        bestTaskScore = matchedTaskTokens.length;
        bestTask = { id: task.id, title: task.title };
      }
    }

    if (bestTask && bestTaskScore >= 1) {
      matchedTask = bestTask;
    }
  }

  return {
    fileName,
    normalizedFileName,
    matchedProject: {
      id: top.project.id,
      code: top.project.code,
      name: top.project.name,
    },
    matchedTask,
    confidence: isAmbiguous ? Math.min(top.confidence, 0.88) : top.confidence,
    rule: top.rule,
    explanation: finalExplanation,
    ambiguous: isAmbiguous,
    autoAppliable,
  };
}
