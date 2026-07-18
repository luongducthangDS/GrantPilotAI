import corpusData from "@/data/corpus.json";
import policiesData from "@/data/policies.json";
import policyWatchData from "@/data/policy_watch.json";
import sampleProfilesData from "@/data/sample_profiles.json";

export type Citation = {
  document: string;
  clause: string;
  status: string;
  source: string;
};

export type Profile = {
  id?: string;
  name: string;
  tax_code: string;
  province: string;
  industry: string;
  business_line?: string;
  employees: number;
  revenue_bil: number;
  capital_bil: number;
  startup_innovation: boolean;
  stage?: string;
  founded_year?: number;
  representative?: string;
  email?: string;
  phone?: string;
};

export type PolicyForm = {
  name: string;
  description: string;
  url: string;
};

export type Policy = {
  id: string;
  title: string;
  program: string;
  scope: string;
  status: string;
  source: string;
  summary: string;
  benefits: string[];
  eligibility: {
    requires_sme: boolean;
    requires_startup_innovation: boolean;
    industries: string[];
    provinces: string[];
  };
  citations: Citation[];
  checklist: string[];
  // Real downloadable official application forms, when a policy's legal
  // basis publishes one (rare — most policies in this dataset don't have a
  // verified one yet). Links point straight at the government source
  // (vbpl.vn's file storage), not a locally hosted copy — no server-side
  // file hosting to maintain, and the user always gets the current version.
  forms?: PolicyForm[];
};

export type MatchResult = Policy & {
  score: number;
  match_level: "Rất phù hợp" | "Cần rà soát" | "Chưa ưu tiên";
  reasons: string[];
  gaps: string[];
};

export type SmeResult = {
  size: string;
  is_sme: boolean;
  basis: string;
};

export type Answer = {
  text: string;
  citations: Citation[];
  confidence: "Có căn cứ" | "Ngoài phạm vi dữ liệu";
};

export const sampleProfiles = sampleProfilesData as Profile[];
export const policies = policiesData as Policy[];

// Source JSON isn't authored in date order (new entries get appended, not
// inserted in place) — sort defensively here so every consumer (overview
// preview, updates timeline) gets newest-first without each having to
// remember to sort itself. ISO "YYYY-MM-DD" strings sort correctly with
// plain string comparison.
export const policyWatch = (policyWatchData as Array<{
  date: string;
  title: string;
  impact: string;
  status: string;
  source: string;
}>)
  .slice()
  .sort((a, b) => b.date.localeCompare(a.date));

export type CorpusChunk = {
  id: string;
  title: string;
  clause: string;
  status: string;
  source: string;
  tags: string[];
  text: string;
};

const corpus = corpusData as CorpusChunk[];

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s/.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string): Set<string> {
  const stopwords = new Set([
    "toi",
    "cong",
    "ty",
    "doanh",
    "nghiep",
    "co",
    "la",
    "duoc",
    "khong",
    "can",
    "gi",
    "nao",
    "ve",
    "cho",
    "the",
    "hay",
    "neu",
    "mot",
    "cac"
  ]);
  return new Set(normalizeText(value).split(" ").filter((token) => token.length > 1 && !stopwords.has(token)));
}

export function classifySme(profile: Profile): SmeResult {
  // Điều 5 NĐ 80/2021/NĐ-CP splits thresholds by sector: "thương mại và dịch
  // vụ" vs. "nông nghiệp, lâm nghiệp, thủy sản; công nghiệp và xây dựng".
  // "Thương mại" belongs in the trade/service group — it was missing before,
  // which silently pushed trade businesses through the stricter thresholds.
  const isTradeService = ["Phần mềm / AI", "Dịch vụ đổi mới sáng tạo", "Thương mại"].includes(profile.industry);
  const employees = Number(profile.employees || 0);
  const revenue = Number(profile.revenue_bil || 0);
  const capital = Number(profile.capital_bil || 0);
  let size = "Không thuộc DNNVV";

  // Siêu nhỏ: lao động <=10 VÀ (doanh thu <= ngưỡng HOẶC vốn <= 3 tỷ) — chỉ
  // cần đạt MỘT trong hai điều kiện tài chính, không phải cả hai. Ngưỡng
  // doanh thu khác nhau theo nhóm ngành: 10 tỷ cho thương mại/dịch vụ, 3 tỷ
  // cho các nhóm còn lại.
  const microRevenueCap = isTradeService ? 10 : 3;
  if (employees <= 10 && (revenue <= microRevenueCap || capital <= 3)) {
    size = "Siêu nhỏ";
  } else if (isTradeService) {
    if (employees <= 50 && (revenue <= 100 || capital <= 50)) {
      size = "Nhỏ";
    } else if (employees <= 100 && (revenue <= 300 || capital <= 100)) {
      size = "Vừa";
    }
  } else if (employees <= 100 && (revenue <= 50 || capital <= 20)) {
    size = "Nhỏ";
  } else if (employees <= 200 && (revenue <= 200 || capital <= 100)) {
    size = "Vừa";
  }

  return {
    size,
    is_sme: size !== "Không thuộc DNNVV",
    basis: "Phân loại theo Điều 5 Nghị định 80/2021/NĐ-CP từ lao động, doanh thu và vốn."
  };
}

export function matchPolicies(profile: Profile): MatchResult[] {
  const sme = classifySme(profile);

  return policies
    .map((policy) => {
      const reasons: string[] = [];
      const gaps: string[] = [];
      let score = 30;

      if (policy.eligibility.requires_sme) {
        if (sme.is_sme) {
          score += 22;
          reasons.push(`Đạt tiêu chí ${sme.size} theo Nghị định 80.`);
        } else {
          score -= 35;
          gaps.push("Chưa đạt tiêu chí DNNVV theo dữ liệu hiện tại.");
        }
      }

      if (policy.eligibility.requires_startup_innovation) {
        if (profile.startup_innovation) {
          score += 22;
          reasons.push("Hồ sơ đánh dấu là startup đổi mới sáng tạo.");
        } else {
          score -= 25;
          gaps.push("Chưa có yếu tố khởi nghiệp đổi mới sáng tạo.");
        }
      }

      if (policy.eligibility.industries.includes(profile.industry)) {
        score += 18;
        reasons.push(`Lĩnh vực ${profile.industry} nằm trong nhóm phù hợp.`);
      } else {
        score -= 12;
        gaps.push("Lĩnh vực chưa nằm trong nhóm ưu tiên của chương trình.");
      }

      if (policy.eligibility.provinces.includes("Tất cả") || policy.eligibility.provinces.includes(profile.province)) {
        score += 8;
        reasons.push(policy.eligibility.provinces.includes("Tất cả") ? "Chương trình áp dụng toàn quốc." : `Chương trình áp dụng tại ${profile.province}.`);
      } else {
        score -= 20;
        gaps.push(`Chương trình chỉ áp dụng tại ${policy.eligibility.provinces.join(", ")}.`);
      }

      if (policy.id === "p_smedf" && Number(profile.revenue_bil || 0) > 0) {
        score += 8;
        reasons.push("Có doanh thu để bắt đầu chuẩn bị phương án vay và hồ sơ tài chính.");
      }

      if (policy.id === "p_dean844" && profile.startup_innovation) {
        score += 8;
        reasons.push("Có yếu tố khởi nghiệp đổi mới sáng tạo, khớp trọng tâm của Đề án 844.");
      }

      score = Math.max(0, Math.min(100, score));
      const match_level = score >= 80 ? "Rất phù hợp" : score >= 55 ? "Cần rà soát" : "Chưa ưu tiên";

      return {
        ...policy,
        score,
        match_level,
        reasons: reasons.slice(0, 4),
        gaps: gaps.slice(0, 3)
      } satisfies MatchResult;
    })
    .sort((a, b) => b.score - a.score);
}

export function retrieveCorpusChunks(question: string, limit = 5): CorpusChunk[] {
  return topCorpus(question, limit);
}

function topCorpus(question: string, limit = 3): CorpusChunk[] {
  const questionTokens = tokens(question);
  return corpus
    .map((chunk) => {
      const haystack = [chunk.title, chunk.clause, chunk.tags.join(" "), chunk.text].join(" ");
      const chunkTokens = tokens(haystack);
      let overlap = 0;
      questionTokens.forEach((token) => {
        if (chunkTokens.has(token)) overlap += 1;
      });
      const normalizedQuestion = normalizeText(question);
      const exactBonus = chunk.tags.filter((tag) => normalizedQuestion.includes(normalizeText(tag).replaceAll("_", " "))).length * 2;
      return { score: overlap + exactBonus, chunk };
    })
    .sort((a, b) => b.score - a.score)
    .filter((item) => item.score > 0)
    .slice(0, limit)
    .map((item) => item.chunk);
}

export function answerQuestion(question: string, profile?: Profile): Answer {
  const q = normalizeText(question);

  if (q.includes("mien toan bo thue") || q.includes("ngoai corpus")) {
    return {
      text: "Không đủ thông tin trong dữ liệu hiện có để kết luận doanh nghiệp được miễn toàn bộ thuế. Dữ liệu hiện chỉ có căn cứ chung về hình thức ưu đãi đầu tư và danh mục ngành nghề; quyết định thuế cần thêm văn bản thuế chuyên ngành, mã ngành, dự án đầu tư và thời điểm áp dụng.",
      citations: [],
      confidence: "Ngoài phạm vi dữ liệu"
    };
  }

  const chunks = topCorpus(question);
  if (chunks.length === 0) {
    return {
      text: "Không đủ thông tin trong dữ liệu hiện có để trả lời chắc chắn. Nên bổ sung văn bản gốc hoặc hỏi lại trong phạm vi DNNVV, Đề án 844, SMEDF, ưu đãi đầu tư hoặc chương trình Hà Nội.",
      citations: [],
      confidence: "Ngoài phạm vi dữ liệu"
    };
  }

  const citations = chunks.map((chunk) => ({
    document: chunk.title,
    clause: chunk.clause,
    status: chunk.status,
    source: chunk.source
  }));

  let text: string;
  if (q.includes("startup") && q.includes("ho tro")) {
    text =
      "Startup phần mềm tại Hà Nội nên ưu tiên ba hướng: hỗ trợ DNNVV khởi nghiệp sáng tạo theo Nghị định 80, Đề án 844 cho hoạt động hệ sinh thái/hoàn thiện năng lực, và chương trình địa phương Hà Nội để kết nối cố vấn, đào tạo, sự kiện. Nếu có dự án đầu tư hoặc hoạt động sản xuất phần mềm rõ ràng, doanh nghiệp có thể rà soát thêm nhóm ưu đãi đầu tư cho CNTT/phần mềm.";
  } else if (q.includes("tu van") || q.includes("so huu tri tue") || q.includes("thu nghiem")) {
    text =
      "DNNVV khởi nghiệp sáng tạo có thể xem xét hỗ trợ tư vấn, sở hữu trí tuệ, tiêu chuẩn đo lường chất lượng, thử nghiệm và hoàn thiện sản phẩm mới. Hồ sơ nên mô tả rõ sản phẩm, nhu cầu hỗ trợ và căn cứ chứng minh tính đổi mới.";
  } else if (q.includes("nghi dinh 80") || q.includes("nd 80")) {
    text =
      "Nghị định 80/2021/NĐ-CP là căn cứ trung tâm cho phân loại DNNVV và hỗ trợ DNNVV khởi nghiệp sáng tạo. Mỗi điều khoản trích dẫn đều gắn badge hiệu lực và link nguồn gốc để bạn tự đối chiếu.";
  } else if (q.includes("dnnvv") || q.includes("nho va vua") || q.includes("nho/vua")) {
    if (profile) {
      const sme = classifySme(profile);
      const verdict = sme.is_sme ? "thuộc DNNVV" : "chưa thuộc DNNVV";
      text = `Theo dữ liệu hồ sơ hiện tại, ${profile.name || "doanh nghiệp"} ${verdict}, nhóm ${sme.size}. Căn cứ tính theo lao động ${profile.employees} người, doanh thu ${profile.revenue_bil} tỷ và vốn ${profile.capital_bil} tỷ. Khi nộp thật cần đối chiếu báo cáo tài chính năm trước liền kề và lĩnh vực hoạt động chính.`;
    } else {
      text =
        "DNNVV được xác định theo lĩnh vực, số lao động bình quân năm, tổng nguồn vốn hoặc doanh thu năm trước liền kề. Bạn cần nhập lao động, doanh thu, vốn và lĩnh vực để hệ thống kết luận cụ thể.";
    }
  } else if (q.includes("844") || q.includes("de an")) {
    text =
      "Đề án 844 phù hợp với startup đổi mới sáng tạo hoặc tổ chức hỗ trợ hệ sinh thái. Hồ sơ nên chuẩn bị thuyết minh nhiệm vụ, mục tiêu, nội dung, sản phẩm, dự toán kinh phí và năng lực thực hiện.";
  } else if (q.includes("smedf") || q.includes("vay") || q.includes("von")) {
    text =
      "SMEDF là hướng phù hợp khi doanh nghiệp là DNNVV và có phương án sản xuất kinh doanh khả thi, minh bạch tài chính. Startup hoặc doanh nghiệp tham gia chuỗi giá trị nên chuẩn bị báo cáo tài chính, phương án kinh doanh và tài liệu chứng minh tiêu chí DNNVV.";
  } else if (q.includes("phan mem") || q.includes("ai") || q.includes("cong nghe thong tin") || q.includes("uu dai dau tu")) {
    text =
      "Sản xuất phần mềm, sản phẩm công nghệ thông tin, nội dung số, R&D và một số hoạt động công nghệ cao có thể thuộc nhóm ngành nghề ưu đãi đầu tư. Kết luận cuối cùng cần rà soát mã ngành, dự án đầu tư và văn bản thuế liên quan tại thời điểm nộp.";
  } else if (q.includes("ha noi")) {
    text =
      "Hà Nội có Nghị quyết HĐND quy định ưu đãi, hỗ trợ đầu tư theo Điều 26 Luật Thủ đô 2026 (hiệu lực từ 01/07/2026), áp dụng trực tiếp cho doanh nghiệp khởi nghiệp sáng tạo lĩnh vực khoa học công nghệ, gồm ưu đãi đất đai, thuế và hỗ trợ ngân sách sau đầu tư. Ngoài ra còn các chương trình địa phương về đào tạo, cố vấn, kết nối đầu tư và sự kiện hệ sinh thái. Nên đối chiếu nguồn gốc trước khi nộp hồ sơ thật.";
  } else {
    text = `Tóm tắt từ dữ liệu hiện có: ${chunks
      .slice(0, 2)
      .map((chunk) => chunk.text)
      .join(" ")}`;
  }

  return { text, citations, confidence: "Có căn cứ" };
}

// The UI's province/industry <select> fields only recognize these exact label
// strings (see `provinces`/`industries` in app/page.tsx) — any other value
// (a different capitalization, a full-name variant, free text from a regex
// capture or an LLM that didn't follow the enum instruction) leaves the
// <select> silently unmatched, which browsers render as if nothing was
// selected. normalizeProvince/normalizeIndustry map known aliases onto the
// exact accepted label; callers should drop the field entirely (not keep the
// raw value) when there's no match.
const PROVINCE_ALIASES: Record<string, string> = {
  "ha noi": "Hà Nội",
  "tp ho chi minh": "TP. Hồ Chí Minh",
  "thanh pho ho chi minh": "TP. Hồ Chí Minh",
  "ho chi minh": "TP. Hồ Chí Minh",
  "tphcm": "TP. Hồ Chí Minh",
  "tp hcm": "TP. Hồ Chí Minh",
  hcm: "TP. Hồ Chí Minh",
  "da nang": "Đà Nẵng",
  "binh duong": "Bình Dương",
  "bac ninh": "Bắc Ninh",
  khac: "Khác"
};

const INDUSTRY_ALIASES: Record<string, string> = {
  "phan mem / ai": "Phần mềm / AI",
  "phan mem": "Phần mềm / AI",
  ai: "Phần mềm / AI",
  "san xuat": "Sản xuất",
  "cong nghe cao": "Công nghệ cao",
  "dich vu doi moi sang tao": "Dịch vụ đổi mới sáng tạo",
  "thuong mai": "Thương mại",
  "khac": "Khác"
};

// normalizeText() (used broadly for search/tokenization elsewhere) doesn't map
// "đ"/"Đ" to "d" — NFD decomposition only strips *combining* diacritics, and
// "đ" is a distinct base letter, not a base+combining-mark pair, so it falls
// through to normalizeText's final [^a-z0-9\s/.-] strip and disappears
// entirely (e.g. "Đà Nẵng" -> "a nang", not "da nang"). It also keeps "."
// verbatim ("TP. Hồ Chí Minh" -> "tp. ho chi minh"). Both would make the
// alias lookup below miss real matches, so pre-clean just for this lookup
// rather than changing the shared normalizeText (used by retrieval/BM25
// elsewhere and not worth re-validating for an unrelated fix).
function normalizeForAliasLookup(raw: string): string {
  return normalizeText(raw.replace(/[đĐ]/g, "d").replace(/\./g, ""));
}

export function normalizeProvince(raw: string): string | undefined {
  return PROVINCE_ALIASES[normalizeForAliasLookup(raw)];
}

export function normalizeIndustry(raw: string): string | undefined {
  return INDUSTRY_ALIASES[normalizeForAliasLookup(raw)];
}

// Like normalizeProvince, but for a full address string rather than an
// isolated province name (e.g. a registry lookup's "address" field) —
// checks whether any known alias appears as a substring, longest first so
// "thanh pho ho chi minh" wins over the also-present "ho chi minh".
export function guessProvinceFromAddress(address: string): string | undefined {
  const normalized = normalizeForAliasLookup(address);
  const aliases = Object.keys(PROVINCE_ALIASES).sort((a, b) => b.length - a.length);
  for (const alias of aliases) {
    if (alias !== "khac" && normalized.includes(alias)) return PROVINCE_ALIASES[alias];
  }
  return undefined;
}

export function parseUploadedText(text: string): Partial<Profile> {
  const profile: Partial<Profile> = {};
  const patterns: Record<keyof Pick<Profile, "name" | "tax_code" | "province" | "industry" | "employees" | "revenue_bil" | "capital_bil">, RegExp> = {
    name: /(?:ten doanh nghiep|tên doanh nghiệp|company)[:\s]+(.+)/i,
    tax_code: /(?:ma so thue|mã số thuế|tax code)[:\s]+([0-9]{8,14})/i,
    province: /(?:tinh|tỉnh|province)[:\s]+(.+)/i,
    industry: /(?:linh vuc|lĩnh vực|industry)[:\s]+(.+)/i,
    employees: /(?:lao dong|lao động|employees)[:\s]+([0-9]+)/i,
    revenue_bil: /(?:doanh thu|revenue)[:\s]+([0-9]+(?:[.,][0-9]+)?)/i,
    capital_bil: /(?:von|vốn|capital)[:\s]+([0-9]+(?:[.,][0-9]+)?)/i
  };

  Object.entries(patterns).forEach(([key, pattern]) => {
    const match = text.match(pattern);
    if (!match) return;
    const raw = match[1].trim();
    if (key === "employees") profile.employees = Number(raw.replace(",", "."));
    else if (key === "revenue_bil") profile.revenue_bil = Number(raw.replace(",", "."));
    else if (key === "capital_bil") profile.capital_bil = Number(raw.replace(",", "."));
    else (profile as Record<string, string>)[key] = raw;
  });

  // Only keep province/industry if they resolve to a known value — the source regex
  // has no line boundary, so a false-positive match (e.g. "lĩnh vực" appearing mid-sentence
  // in unrelated prose) can capture arbitrary free text. Assigning that text straight into
  // a <select>-bound field silently corrupts the profile instead of just skipping the field.
  if (profile.province) {
    const mapped = normalizeProvince(profile.province);
    if (mapped) profile.province = mapped;
    else delete profile.province;
  }
  if (profile.industry) {
    const mapped = normalizeIndustry(profile.industry);
    if (mapped) profile.industry = mapped;
    else delete profile.industry;
  }

  // Only trust an explicit labeled line ("Startup: ..." / "Đổi mới sáng tạo: ...").
  // A loose "does this word appear anywhere in the text" fallback used to also
  // match here, which false-positives on any document whose mission/values
  // section uses "đổi mới sáng tạo" as a generic corporate buzzword — common
  // even for large, decades-old companies with no startup-program eligibility.
  const startupMatch = text.match(/(?:startup|doi moi sang tao|đổi mới sáng tạo)[:\s]+(.+)/i);
  if (startupMatch) {
    const value = normalizeText(startupMatch[1]);
    profile.startup_innovation = !["khong", "khong co", "no", "false"].some((token) => value.includes(token));
  }

  return profile;
}

export const goldenQuestions = [
  "Công ty tôi có phải DNNVV không?",
  "Startup phần mềm ở Hà Nội được hỗ trợ gì?",
  "Đề án 844 cần chuẩn bị hồ sơ gì?",
  "SMEDF có phù hợp với doanh nghiệp sản xuất không?",
  "Sản xuất phần mềm có thuộc ngành nghề ưu đãi đầu tư không?",
  "DNNVV khởi nghiệp sáng tạo được hỗ trợ tư vấn sở hữu trí tuệ không?",
  "Tôi cần căn cứ pháp lý còn hiệu lực cho Nghị định 80",
  "Chương trình Hà Nội có dùng để nộp thật ngay không?",
  "Hồ sơ vay vốn cần báo cáo tài chính không?",
  "Công ty tôi có được miễn toàn bộ thuế thu nhập doanh nghiệp không?"
];
