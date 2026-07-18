import { NextResponse } from "next/server";

import { classifySme, matchPolicies, type MatchResult, type Profile } from "@/lib/grantpilot";
import { DEFAULT_MODELS, generateAnswer, type LlmProvider } from "@/lib/llmProviders";

const SYSTEM_INSTRUCTION = `Bạn là trợ lý phân tích chính sách của GrantPilot. Bạn nhận được: hồ sơ doanh nghiệp, và kết quả một công cụ chấm điểm rule-based (score/lý do/điểm cần rà soát) cho từng chính sách.

Nhiệm vụ: với MỖI chính sách được cung cấp, viết một đoạn phân tích ngắn (2-4 câu) bổ sung góc nhìn mà rule-based không thể diễn đạt tự nhiên — ví dụ: chỉ ra khi hồ sơ ở sát ngưỡng phân loại (nên xác nhận lại số liệu), gợi ý thứ tự ưu tiên nếu nhiều chính sách cùng phù hợp, hoặc cảnh báo giả định còn thiếu dữ kiện.

Quy tắc bắt buộc:
- CHỈ dùng dữ kiện đã cho (hồ sơ + score/reasons/gaps/eligibility của từng chính sách). Không bịa thêm căn cứ pháp lý, số liệu hay điều khoản nào ngoài dữ kiện đã cung cấp.
- Nếu không có gì đáng bổ sung ngoài những gì rule-based đã nêu, hãy nói ngắn gọn là dữ liệu hiện tại đã đủ rõ, đừng lặp lại y nguyên reasons/gaps.
- Không thay thế tư vấn pháp lý; nếu cần, nhắc đối chiếu văn bản gốc.
- CHỈ trả về JSON hợp lệ, không kèm markdown, không giải thích thêm. Định dạng:
[{"policy_id": "...", "explanation": "..."}, ...]`;

function buildPrompt(profile: Profile, matches: MatchResult[]) {
  const sme = classifySme(profile);
  const age = profile.founded_year ? new Date().getFullYear() - profile.founded_year : null;
  const ageNote = age !== null ? `, thành lập năm ${profile.founded_year} (khoảng ${age} năm hoạt động — công cụ chấm điểm rule-based CHƯA dùng số liệu này để tính điểm, một số chương trình khởi nghiệp có thể ưu tiên doanh nghiệp mới thành lập nên hãy nhắc kiểm tra lại điều kiện gốc nếu liên quan, đừng tự suy ra đạt/không đạt)` : "";
  const profileSummary = `Hồ sơ: ${profile.name || "chưa đặt tên"}, lĩnh vực ${profile.industry}, tỉnh/thành ${profile.province}, lao động ${profile.employees}, doanh thu ${profile.revenue_bil} tỷ, vốn ${profile.capital_bil} tỷ, startup đổi mới sáng tạo: ${profile.startup_innovation ? "có" : "không"}${ageNote}. Phân loại DNNVV: ${sme.size} (${sme.basis}).`;

  const policiesSummary = matches
    .map(
      (m) =>
        `- policy_id="${m.id}" | ${m.title} | score=${m.score}/100 (${m.match_level}) | lý do rule-based: ${m.reasons.join("; ") || "(không có)"} | điểm cần rà soát: ${m.gaps.join("; ") || "(không có)"}`
    )
    .join("\n");

  return `${profileSummary}\n\nCác chính sách đã chấm điểm:\n${policiesSummary}`;
}

export async function POST(request: Request) {
  const { profile, llm } = (await request.json()) as {
    profile?: Profile;
    llm?: { provider?: string; apiKey?: string; model?: string };
  };

  if (!profile) {
    return NextResponse.json({ error: "Thiếu hồ sơ doanh nghiệp." }, { status: 400 });
  }

  const matches = matchPolicies(profile);

  const VALID_PROVIDERS: LlmProvider[] = ["google", "openai", "anthropic", "xai"];
  const config = (() => {
    if (llm?.apiKey && llm.provider && VALID_PROVIDERS.includes(llm.provider as LlmProvider)) {
      const provider = llm.provider as LlmProvider;
      return { provider, apiKey: llm.apiKey, model: llm.model?.trim() || DEFAULT_MODELS[provider] };
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    return { provider: "google" as LlmProvider, apiKey, model: process.env.GEMINI_MODEL || DEFAULT_MODELS.google };
  })();

  if (!config) {
    return NextResponse.json({ explanations: [] });
  }

  try {
    const text = await generateAnswer(config, SYSTEM_INSTRUCTION, buildPrompt(profile, matches));
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Không tìm thấy JSON hợp lệ trong phản hồi.");
    const parsed = JSON.parse(jsonMatch[0]) as { policy_id: string; explanation: string }[];
    return NextResponse.json({ explanations: parsed });
  } catch (error) {
    console.error(`${config.provider} recommend-explain thất bại:`, error);
    return NextResponse.json({ explanations: [] });
  }
}
