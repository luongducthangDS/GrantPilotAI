import { NextResponse } from "next/server";

import { classifySme, matchPolicies, type MatchResult, type Profile } from "@/lib/grantpilot";
import { DEFAULT_MODELS, generateJsonAnswer, type LlmConfig } from "@/lib/llmProviders";

// This is Step 3's default analysis layer now (fires automatically after
// matchPolicies() runs), not an opt-in extra — so the prompt has to hold up
// under every profile, not just the ones someone happened to click into
// during testing. Numbered, explicit anti-hallucination rules on purpose:
// a vaguer "don't make things up" instruction is exactly what earlier,
// looser prompts in this app relied on before being tightened.
const SYSTEM_INSTRUCTION = `Bạn là trợ lý phân tích chính sách của GrantPilot, hoạt động như một lớp phân tích bổ sung phía TRÊN một công cụ chấm điểm rule-based đã chạy trước — công cụ đó, không phải bạn, quyết định điểm số/score.

Bạn nhận được: (1) hồ sơ doanh nghiệp, (2) kết quả chấm điểm rule-based cho từng chính sách (score/lý do/điểm cần rà soát).

Nhiệm vụ: với MỖI chính sách được cung cấp, viết đúng một đoạn phân tích ngắn (2-4 câu) bổ sung góc nhìn mà rule-based không diễn đạt được — ví dụ: hồ sơ ở sát ngưỡng phân loại (cần xác nhận lại số liệu), gợi ý thứ tự ưu tiên nếu nhiều chính sách cùng phù hợp, hoặc cảnh báo giả định còn thiếu dữ kiện.

QUY TẮC BẮT BUỘC — vi phạm bất kỳ điều nào dưới đây đều không chấp nhận được:
1. CHỈ được dùng dữ kiện có trong hồ sơ và kết quả chấm điểm đã cho. TUYỆT ĐỐI KHÔNG tự suy diễn, bịa thêm, hoặc dùng kiến thức chung của bạn để "biết trước" bất kỳ điều luật, điều khoản, số liệu, hạn mức hay điều kiện nào không có trong dữ liệu được cung cấp bên dưới — kể cả khi bạn tin điều đó là đúng.
2. KHÔNG tự kết luận doanh nghiệp "chắc chắn đủ điều kiện" hay "chắc chắn không đủ điều kiện" nếu rule-based không kết luận rõ như vậy (match_level "Cần rà soát" nghĩa là chưa chắc chắn — phải giữ nguyên sắc thái đó, không tự tin quá mức).
3. Nếu không có gì đáng bổ sung ngoài những gì rule-based đã nêu trong reasons/gaps, phải nói ngắn gọn là dữ liệu hiện tại đã đủ rõ — KHÔNG lặp lại nguyên văn reasons/gaps chỉ để "cho có nội dung".
4. Nếu hồ sơ có dữ kiện ở ranh giới/mơ hồ (ví dụ năm thành lập gần ngưỡng ưu tiên, doanh thu sát mức phân loại DNNVV), phải nêu đây là điểm người dùng cần tự xác minh — không tự phán đoán thay người dùng.
5. Không thay thế tư vấn pháp lý; nếu phân tích mang tính kết luận, nhắc người dùng đối chiếu văn bản gốc trước khi nộp hồ sơ thật.
6. Văn phong: tiếng Việt, ngắn gọn, chuyên nghiệp, không markdown, không lặp lại nguyên văn tiêu đề chính sách.
7. CHỈ trả về JSON hợp lệ đúng định dạng đã quy định, không kèm giải thích, không markdown. Định dạng:
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
  const { profile } = (await request.json()) as { profile?: Profile };

  if (!profile) {
    return NextResponse.json({ error: "Thiếu hồ sơ doanh nghiệp." }, { status: 400 });
  }

  const matches = matchPolicies(profile);

  const apiKey = process.env.CUSTOM_LLM_API_KEY;
  const config: LlmConfig | null = apiKey ? { provider: "fptai", apiKey, model: DEFAULT_MODELS.fptai } : null;

  if (!config) {
    return NextResponse.json({ explanations: [] });
  }

  try {
    const prompt = buildPrompt(profile, matches);
    const text = await generateJsonAnswer(config, SYSTEM_INSTRUCTION, prompt);
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Không tìm thấy JSON hợp lệ trong phản hồi.");
    const parsed = JSON.parse(jsonMatch[0]) as { policy_id: string; explanation: string }[];

    // Guard against a policy_id that doesn't match anything actually sent —
    // a hallucinated or mistyped id would otherwise silently orphan an
    // explanation with nowhere to render.
    const validIds = new Set(matches.map((m) => m.id));
    const filtered = parsed.filter((item) => validIds.has(item.policy_id));

    return NextResponse.json({ explanations: filtered });
  } catch (error) {
    console.error(`${config.provider} recommend-explain thất bại:`, error);
    return NextResponse.json({ explanations: [] });
  }
}
