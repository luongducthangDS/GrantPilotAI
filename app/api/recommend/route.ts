import { NextResponse } from "next/server";

import { classifySme, matchPolicies, type MatchResult, type Profile } from "@/lib/grantpilot";
import { DEFAULT_MODELS, generateJsonAnswer, type LlmConfig } from "@/lib/llmProviders";

// This is Step 3's default analysis layer now (fires automatically after
// matchPolicies() runs), not an opt-in extra — so the prompt has to hold up
// under every profile, not just the ones someone happened to click into
// during testing. Numbered, explicit anti-hallucination rules on purpose:
// a vaguer "don't make things up" instruction is exactly what earlier,
// looser prompts in this app relied on before being tightened.
const SYSTEM_INSTRUCTION = `Bạn là trợ lý phân tích chính sách và pháp lý của GrantPilot, hoạt động dựa trên các Văn bản Quy phạm Pháp luật chính thức.

Nhiệm vụ: Dựa trên hồ sơ doanh nghiệp và kết quả đối chiếu tiêu chí pháp lý, đưa ra lời giải thích chuyên môn (2-4 câu) cho từng chính sách.

QUY TẮC BẮT BUỘC:
1. MỌI ĐÁNH GIÁ VÀ CẢNH BÁO PHẢI CĂN CỨ TRỰC TIẾP VÀO ĐIỀU KHOẢN VĂN BẢN PHÁP LUẬT VÀ CHÍNH SÁCH CHÍNH THỨC (Nghị định 80/2021/NĐ-CP, Nghị định 268/2025/NĐ-CP, Nghị định 39/2019/NĐ-CP, Quyết định 844/QĐ-TTg, Nghị quyết 15/2023/NQ-HĐND Hà Nội, Thông tư 21/2016/TT-BTC...).
2. BẮT BUỘC ghi rõ căn cứ pháp lý (ví dụ: "Căn cứ Điều 5 Nghị định 80/2021/NĐ-CP...", "Căn cứ Điều 35 Nghị định 268/2025/NĐ-CP..."). TUYỆT ĐỐI KHÔNG đưa ra nhận định chung chung hoặc dùng quy tắc cảm tính ngoài văn bản luật.
3. Không tự khẳng định 100% doanh nghiệp đủ/không đủ điều kiện; chỉ rõ điều khoản văn bản gốc mà doanh nghiệp cần đối chiếu trực tiếp trước khi nộp hồ sơ.
4. Văn phong: tiếng Việt, ngắn gọn, chuẩn xác thuật ngữ pháp lý.
5. CHỈ trả về JSON hợp lệ đúng định dạng:
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
