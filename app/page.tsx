"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  Answer,
  Citation,
  MatchResult,
  Profile,
  classifySme,
  goldenQuestions,
  matchPolicies,
  parseUploadedText,
  policies,
  policyWatch,
  sampleProfiles
} from "@/lib/grantpilot";
import {
  DEFAULT_MODELS,
  LlmProvider,
  LlmSettings,
  MODEL_SUGGESTIONS,
  PROVIDER_LABELS,
  clearLlmSettings,
  loadLlmSettings,
  saveLlmSettings
} from "@/lib/llmSettings";

type View = "overview" | "search" | "qa" | "updates";

type ChatMessage =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; text: string; citations: Citation[]; confidence: Answer["confidence"] };

function makeMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const provinces = ["Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng", "Bình Dương", "Bắc Ninh", "Khác"];
const industries = ["Phần mềm / AI", "Sản xuất", "Công nghệ cao", "Dịch vụ đổi mới sáng tạo", "Thương mại", "Khác"];

// Used to reset the form before applying a fresh file/OCR extraction —
// merging onto whatever the *previous* profile happened to hold would let
// stale fields (e.g. a prior company's employee count) linger and look
// like they came from the new document, which they didn't.
const EMPTY_PROFILE: Profile = {
  name: "",
  tax_code: "",
  province: "Khác",
  industry: "Khác",
  business_line: "",
  employees: 0,
  revenue_bil: 0,
  capital_bil: 0,
  startup_innovation: false,
  stage: "",
  founded_year: undefined,
  representative: "",
  email: "",
  phone: ""
};

const navItems: { id: View; label: string; hint: string }[] = [
  { id: "overview", label: "Tổng quan", hint: "01" },
  { id: "search", label: "Tìm chính sách", hint: "02" },
  { id: "qa", label: "Hỏi đáp pháp lý", hint: "03" },
  { id: "updates", label: "Theo dõi cập nhật", hint: "04" }
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}

function statusClass(status: string) {
  const value = status.toLowerCase();
  if (value.includes("cần xác minh") || value.includes("chưa ban hành") || value.includes("đang soạn thảo")) return "warning";
  if (value.includes("seed") || value.includes("nháp")) return "neutral";
  return "success";
}

function matchTone(matchLevel: MatchResult["match_level"]) {
  if (matchLevel === "Rất phù hợp") return "success";
  if (matchLevel === "Cần rà soát") return "warning";
  return "neutral";
}

function ScoreRing({ score }: { score: number }) {
  return (
    <div className="score-ring" style={{ "--score": `${score * 3.6}deg` } as React.CSSProperties} aria-label={`${score}% phù hợp`}>
      <span>{score}</span>
      <small>%</small>
    </div>
  );
}

const PROFILE_STORAGE_KEY = "grantpilot:profile-draft";

// Session-only (not localStorage) — survives an accidental reload/crash
// within the same tab, but doesn't linger indefinitely across visits the
// way a saved LLM API key would need to be scoped to avoid ever doing.
function loadStoredProfile(): Profile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PROFILE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

function saveStoredProfile(profile: Profile) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Storage full/unavailable (private browsing, etc.) — not worth surfacing to the user.
  }
}

export default function Home() {
  const [view, setView] = useState<View>("overview");
  const [profile, setProfile] = useState<Profile>(() => loadStoredProfile() ?? sampleProfiles[0]);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<MatchResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [docxLoading, setDocxLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [aiExplanations, setAiExplanations] = useState<Record<string, string>>({});
  const [aiExplanationLoading, setAiExplanationLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);

  const [taxLookupInput, setTaxLookupInput] = useState("");
  const [taxLookupLoading, setTaxLookupLoading] = useState(false);

  const [checklistMatch, setChecklistMatch] = useState<{ item: string; status: string; note: string }[] | null>(null);
  const [checklistMatchLoading, setChecklistMatchLoading] = useState(false);
  const [checklistMatchError, setChecklistMatchError] = useState("");

  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [answerLoading, setAnswerLoading] = useState(false);
  const chatThreadRef = useRef<HTMLDivElement | null>(null);

  const [llmSettings, setLlmSettings] = useState<LlmSettings | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftProvider, setDraftProvider] = useState<LlmProvider>("google");
  const [draftApiKey, setDraftApiKey] = useState("");
  const [draftModel, setDraftModel] = useState(DEFAULT_MODELS.google);

  const [watchStatus, setWatchStatus] = useState<{
    available: boolean;
    lastRunAt?: string | null;
    newArticlesFound?: number;
  } | null>(null);

  const sme = useMemo(() => classifySme(profile), [profile]);
  const verifiedPolicyCount = useMemo(() => policies.filter((policy) => policy.status.includes("Còn hiệu lực")).length, []);

  useEffect(() => {
    setLlmSettings(loadLlmSettings());
  }, []);

  useEffect(() => {
    saveStoredProfile(profile);
  }, [profile]);

  useEffect(() => {
    const el = chatThreadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, answerLoading]);

  useEffect(() => {
    if (view !== "updates" || watchStatus) return;
    fetch("/api/policy-watch/status")
      .then((response) => response.json())
      .then(setWatchStatus)
      .catch(() => setWatchStatus({ available: false }));
  }, [view, watchStatus]);

  function openSettings() {
    const current = llmSettings;
    setDraftProvider(current?.provider ?? "google");
    setDraftApiKey(current?.apiKey ?? "");
    setDraftModel(current?.model ?? DEFAULT_MODELS.google);
    setSettingsOpen(true);
  }

  function saveSettings() {
    if (!draftApiKey.trim()) {
      clearLlmSettings();
      setLlmSettings(null);
      setSettingsOpen(false);
      setMessage("Đã xoá cấu hình AI riêng — dùng lại cấu hình mặc định của máy chủ (nếu có).");
      return;
    }
    const next: LlmSettings = { provider: draftProvider, apiKey: draftApiKey.trim(), model: draftModel.trim() || DEFAULT_MODELS[draftProvider] };
    saveLlmSettings(next);
    setLlmSettings(next);
    setSettingsOpen(false);
    setMessage(`Đã lưu cấu hình AI: ${PROVIDER_LABELS[next.provider]} · ${next.model}.`);
  }

  useEffect(() => {
    if (!selectedPolicy) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedPolicy(null);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [selectedPolicy]);

  useEffect(() => {
    setChecklistMatch(null);
    setChecklistMatchError("");
  }, [selectedPolicy?.id]);

  async function matchChecklistDocuments(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !selectedPolicy) return;
    const files = Array.from(fileList).filter((file) => file.type.startsWith("image/"));
    if (files.length === 0) {
      setChecklistMatchError("Chỉ hỗ trợ ảnh (JPG/PNG/WebP) cho bước đối chiếu này.");
      return;
    }

    setChecklistMatchLoading(true);
    setChecklistMatchError("");
    try {
      const documents = await Promise.all(
        files.map(
          (file) =>
            new Promise<{ name: string; mimeType: string; data: string }>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve({ name: file.name, mimeType: file.type, data: (reader.result as string).split(",")[1] ?? "" });
              reader.onerror = () => reject(new Error(`Không đọc được tệp ${file.name}.`));
              reader.readAsDataURL(file);
            })
        )
      );

      const response = await fetch("/api/checklist-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklist: selectedPolicy.checklist, documents, llm: llmSettings ?? undefined })
      });
      const data = await response.json();
      if (!response.ok || !data.results) throw new Error(data.error || "Không đối chiếu được checklist.");
      setChecklistMatch(data.results);
    } catch (reason) {
      setChecklistMatchError(reason instanceof Error ? reason.message : "Không đối chiếu được checklist.");
    } finally {
      setChecklistMatchLoading(false);
    }
  }

  function updateProfile<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
    setMessage("");
  }

  function chooseProfile(candidate: Profile) {
    setProfile(candidate);
    setResults([]);
    setMessage(`Đã chọn hồ sơ mẫu ${candidate.name}.`);
    setError("");
  }

  async function handleFile(file?: File) {
    if (!file) return;
    setError("");
    setMessage("");

    const name = file.name.toLowerCase();
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";
    const isText = name.endsWith(".txt");
    // file.type is set from the OS's registered MIME association, which is
    // inconsistent for Office formats on some browser/OS combos (can come
    // through empty) — check the extension too rather than trust file.type alone.
    const isDocx = file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || name.endsWith(".docx");
    const isXlsx = file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || name.endsWith(".xlsx");
    const isLegacyOffice = name.endsWith(".doc") || name.endsWith(".xls");

    if (!isImage && !isPdf && !isText && !isDocx && !isXlsx) {
      setError(
        isLegacyOffice
          ? "Định dạng .doc/.xls cũ chưa hỗ trợ được — vui lòng lưu lại thành .docx/.xlsx rồi thử lại."
          : "Vui lòng chọn tệp TXT, Word (.docx), Excel (.xlsx), ảnh (JPG/PNG) hoặc PDF."
      );
      return;
    }

    if (isText) {
      try {
        const text = await file.text();
        const parsed = parseUploadedText(text);
        setProfile({ ...EMPTY_PROFILE, ...parsed });
        setResults([]);

        // parseUploadedText() only understands the demo's own "key: value" format.
        // Real documents (annual reports, company profiles, free-form text) rarely
        // match it and silently leave most fields unchanged — fall back to AI
        // extraction on the raw text instead of pretending the upload worked.
        const fieldsFound = Object.values(parsed).filter((value) => value !== undefined && value !== "").length;
        if (parsed.name && fieldsFound >= 3) {
          setMessage("Đã đọc hồ sơ từ file .txt theo định dạng chuẩn.");
          return;
        }

        setMessage("File không khớp định dạng chuẩn (key: value) — đang thử đọc bằng AI...");
        setOcrLoading(true);
        try {
          const response = await fetch("/api/ocr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, llm: llmSettings ?? undefined })
          });
          const data = (await response.json()) as { profile?: Partial<Profile>; error?: string };
          if (!response.ok || !data.profile) throw new Error(data.error || "AI không đọc được nội dung.");

          setProfile({ ...EMPTY_PROFILE, ...data.profile });
          setMessage("Đã đọc hồ sơ từ file .txt bằng AI (định dạng tự do). Vui lòng kiểm tra lại các trường trước khi dùng.");
        } catch (aiReason) {
          setMessage(
            `Chỉ đọc được một phần từ file (định dạng không khớp mẫu chuẩn${
              aiReason instanceof Error ? `, AI cũng không đọc được: ${aiReason.message}` : ""
            }). Vui lòng kiểm tra và bổ sung thủ công.`
          );
        } finally {
          setOcrLoading(false);
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Không thể đọc tệp.");
      }
      return;
    }

    setOcrLoading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
        reader.onerror = () => reject(new Error("Không thể đọc tệp."));
        reader.readAsDataURL(file);
      });

      // Don't rely on file.type for Office formats — normalize from the
      // extension check above so the server's mimeType switch works even
      // when the browser reports an empty/generic type.
      const mimeType = isDocx
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : isXlsx
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : file.type;

      const response = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mimeType, llm: llmSettings ?? undefined })
      });
      const data = (await response.json()) as { profile?: Partial<Profile>; error?: string };
      if (!response.ok || !data.profile) throw new Error(data.error || "Không đọc được tài liệu.");

      setProfile({ ...EMPTY_PROFILE, ...data.profile });
      setResults([]);
      const sourceLabel = isPdf ? "PDF" : isDocx ? "Word" : isXlsx ? "Excel" : "ảnh";
      setMessage(`Đã đọc hồ sơ từ ${sourceLabel} bằng AI. Vui lòng kiểm tra lại các trường trước khi dùng.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Đọc tài liệu thất bại.");
    } finally {
      setOcrLoading(false);
    }
  }

  async function lookupByTaxCode() {
    const taxCode = taxLookupInput.trim();
    if (!taxCode) return;
    setError("");
    setMessage("");
    setTaxLookupLoading(true);
    try {
      const response = await fetch(`/api/tax-lookup?taxCode=${encodeURIComponent(taxCode)}`);
      const data = (await response.json()) as { name?: string; tax_code?: string; province?: string; address?: string; error?: string };
      if (!response.ok || !data.name) throw new Error(data.error || "Không tra cứu được mã số thuế này.");

      setProfile((current) => ({
        ...current,
        name: data.name!,
        tax_code: data.tax_code ?? taxCode,
        ...(data.province ? { province: data.province } : {})
      }));
      setResults([]);
      setMessage(
        `Đã tra cứu MST ${taxCode}: điền tên${data.province ? " & địa phương" : ""} từ dữ liệu đăng ký thuế thật${
          data.address ? ` (địa chỉ: ${data.address})` : ""
        }. Vui lòng bổ sung lĩnh vực/lao động/doanh thu/vốn.`
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Tra cứu mã số thuế thất bại.");
    } finally {
      setTaxLookupLoading(false);
    }
  }

  async function analyze() {
    if (!profile.name || !profile.tax_code) {
      setError("Vui lòng hoàn thiện tên doanh nghiệp và mã số thuế.");
      return;
    }
    setError("");
    setMessage("");
    setAnalyzing(true);
    const recommendations = matchPolicies(profile);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setResults(recommendations);
    setAiExplanations({});
    setMessage(`Đã đối chiếu ${policies.length} chính sách theo quy tắc — đang phân tích sâu hơn bằng AI...`);
    setAnalyzing(false);
    // Step 3 is now AI-analyzed by default, not an opt-in per-policy click —
    // fire without awaiting so the rule-based ranking above renders
    // immediately and the AI layer streams in on top of it.
    fetchAiExplanations();
  }

  async function fetchAiExplanations() {
    setAiExplanationLoading(true);
    setError("");
    try {
      const response = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, llm: llmSettings ?? undefined })
      });
      if (!response.ok) throw new Error("Không thể lấy phân tích AI.");
      const data = (await response.json()) as { explanations: { policy_id: string; explanation: string }[] };
      if (data.explanations.length === 0) {
        setMessage("AI không trả về phân tích bổ sung (có thể do thiếu cấu hình AI hoặc lỗi tạm thời) — vẫn còn lý do/điểm rà soát theo quy tắc bên dưới.");
      } else {
        setMessage(`Đã đối chiếu ${policies.length} chính sách, kèm phân tích AI cho từng chính sách.`);
      }
      const next: Record<string, string> = {};
      data.explanations.forEach((item) => {
        next[item.policy_id] = item.explanation;
      });
      setAiExplanations((current) => ({ ...current, ...next }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Phân tích AI thất bại.");
    } finally {
      setAiExplanationLoading(false);
    }
  }

  async function ask(nextQuestion: string) {
    const trimmed = nextQuestion.trim();
    if (!trimmed || answerLoading) return;

    // Snapshot before appending the new user turn — this is exactly the
    // history that should be sent as "prior context" for this question.
    const history = messages.map((m) => ({ role: m.role, text: m.text }));

    setQuestion("");
    setError("");
    setMessages((current) => [...current, { id: makeMessageId(), role: "user", text: trimmed }]);
    setAnswerLoading(true);
    try {
      const response = await fetch("/api/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, history, profile, llm: llmSettings ?? undefined })
      });
      if (!response.ok) throw new Error("Không thể lấy câu trả lời.");
      const result = (await response.json()) as Answer;
      setMessages((current) => [
        ...current,
        { id: makeMessageId(), role: "assistant", text: result.text, citations: result.citations, confidence: result.confidence }
      ]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Hỏi đáp thất bại.");
    } finally {
      setAnswerLoading(false);
    }
  }

  function resetConversation() {
    setMessages([]);
    setQuestion("");
    setError("");
  }

  async function downloadDocx(policy: MatchResult) {
    setDocxLoading(true);
    try {
      const response = await fetch("/api/grant-docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, policy })
      });
      if (!response.ok) throw new Error("Không thể tạo file DOCX.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `grantpilot-${policy.id}.docx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Xuất DOCX thất bại.");
    } finally {
      setDocxLoading(false);
    }
  }

  function navigate(next: View) {
    setView(next);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Điều hướng chính">
        <button className="brand" onClick={() => navigate("overview")}>
          <span className="brand-mark">G</span>
          <span>
            <strong>GrantPilot AI</strong>
            <small>Policy &amp; Grant Navigator</small>
          </span>
        </button>

        <div className="sidebar-label">Không gian làm việc</div>
        <nav>
          {navItems.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "nav-item active" : "nav-item"}
              onClick={() => navigate(item.id)}
              aria-current={view === item.id ? "page" : undefined}
            >
              <span>{item.hint}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-card">
          <span className="status-dot" />
          <div>
            <strong>Bảo mật dữ liệu</strong>
            <p>Hồ sơ được xử lý ngay trên thiết bị.</p>
          </div>
        </div>
        <div className="sidebar-footer">GrantPilot AI · 2026</div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <span className="eyebrow">GRANTPILOT WORKSPACE</span>
            <h1>{navItems.find((item) => item.id === view)?.label}</h1>
          </div>
          <div className="topbar-actions">
            <div className="data-health">
              <span /> {policies.length} chính sách đã kết nối
            </div>
            <button className="settings-button" onClick={openSettings} title="Cài đặt AI">
              ⚙ {llmSettings ? `${PROVIDER_LABELS[llmSettings.provider]}` : "AI mặc định"}
            </button>
            <div className="avatar" aria-label="Hồ sơ người dùng">GP</div>
          </div>
        </header>

        {error && <div className="notice error-notice">{error}</div>}
        {message && <div className="notice success-notice">{message}</div>}

        {view === "overview" && (
          <section className="view-stack">
            <div className="hero-card">
              <div className="hero-copy">
                <span className="hero-kicker">POLICY INTELLIGENCE FOR BUSINESS</span>
                <h2>
                  Tìm đúng chính sách.
                  <br />
                  <em>Chuẩn bị đúng hồ sơ.</em>
                </h2>
                <p>
                  GrantPilot AI giúp doanh nghiệp đối chiếu nhu cầu với chính sách, giải thích điều kiện, trả lời câu hỏi pháp lý có căn
                  cứ và tạo checklist hành động có nguồn dẫn.
                </p>
                <div className="hero-actions">
                  <button className="primary-button" onClick={() => navigate("search")}>
                    Bắt đầu phân tích <span>→</span>
                  </button>
                  <button className="secondary-button" onClick={() => navigate("updates")}>
                    Xem cập nhật mới
                  </button>
                </div>
              </div>
              <div className="hero-visual" aria-hidden="true">
                <div className="visual-glow" />
                <div className="document-card card-back">
                  <span>POLICY</span>
                  <i />
                  <i />
                  <i />
                </div>
                <div className="document-card card-front">
                  <div className="document-check">✓</div>
                  <strong>Hồ sơ phù hợp</strong>
                  <span>Đã đối chiếu điều kiện</span>
                  <div className="match-bar"><b /></div>
                  <small>92% tương thích</small>
                </div>
                <div className="route-line" />
              </div>
            </div>

            <div className="metrics-grid">
              <article className="metric-card">
                <span className="metric-index">01</span>
                <strong>{policies.length}</strong>
                <p>Chương trình hỗ trợ</p>
                <small>Từ {new Set(policies.map((item) => item.source)).size} nguồn</small>
              </article>
              <article className="metric-card">
                <span className="metric-index">02</span>
                <strong>{verifiedPolicyCount}</strong>
                <p>Đang còn hiệu lực</p>
                <small>Có citation và nguồn gốc</small>
              </article>
              <article className="metric-card accent-metric">
                <span className="metric-index">03</span>
                <strong>{sampleProfiles.length}</strong>
                <p>Hồ sơ khởi đầu có sẵn</p>
                <small>Bắt đầu nhanh, không cần nhập tay</small>
              </article>
            </div>

            <div className="overview-grid">
              <section className="panel-card quick-start">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">BẮT ĐẦU NHANH</span>
                    <h3>Chọn một hồ sơ mẫu</h3>
                  </div>
                  <button className="text-button" onClick={() => navigate("search")}>Mở biểu mẫu →</button>
                </div>
                <div className="profile-list">
                  {sampleProfiles.map((candidate, index) => (
                    <button
                      key={candidate.id ?? candidate.tax_code}
                      onClick={() => {
                        chooseProfile(candidate);
                        navigate("search");
                      }}
                    >
                      <span className="company-avatar">{index === 0 ? "N" : "A"}</span>
                      <span>
                        <strong>{candidate.name}</strong>
                        <small>{candidate.industry} · {candidate.province}</small>
                      </span>
                      <b>→</b>
                    </button>
                  ))}
                </div>
              </section>

              <section className="panel-card watch-preview">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">POLICY WATCH</span>
                    <h3>Cập nhật gần đây</h3>
                  </div>
                </div>
                {policyWatch.slice(0, 3).map((item) => (
                  <div className="watch-row" key={`${item.date}-${item.title}`}>
                    <span className={`status-marker ${statusClass(item.status)}`} />
                    <div>
                      <strong>{item.title}</strong>
                      <small>{formatDate(item.date)} · {item.status}</small>
                    </div>
                  </div>
                ))}
              </section>
            </div>
          </section>
        )}

        {view === "search" && (
          <section className="search-layout">
            <div className="profile-column">
              <section className="panel-card upload-panel">
                <div className="section-heading compact">
                  <div>
                    <span className="eyebrow">BƯỚC 01</span>
                    <h3>Nhập hồ sơ doanh nghiệp</h3>
                  </div>
                  <span className="privacy-badge">Xử lý cục bộ</span>
                </div>

                <label
                  className={dragActive ? "dropzone active" : "dropzone"}
                  onDragEnter={(event: DragEvent) => {
                    event.preventDefault();
                    setDragActive(true);
                  }}
                  onDragOver={(event: DragEvent) => event.preventDefault()}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(event: DragEvent) => {
                    event.preventDefault();
                    setDragActive(false);
                    handleFile(event.dataTransfer.files[0]);
                  }}
                >
                  <input
                    type="file"
                    accept=".txt,text/plain,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/png,image/jpeg,image/webp,application/pdf"
                    disabled={ocrLoading}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => handleFile(event.target.files?.[0])}
                  />
                  <span className="upload-icon">{ocrLoading ? <span className="button-spinner" /> : "⇧"}</span>
                  <strong>{ocrLoading ? "Đang đọc tài liệu bằng AI..." : "Thả hồ sơ TXT, Word, Excel, ảnh hoặc PDF vào đây"}</strong>
                  <p>{ocrLoading ? "Có thể mất vài giây" : "TXT: đọc trực tiếp, tự dùng AI nếu không đúng mẫu · Word/Excel/Ảnh/PDF: đọc bằng AI (PDF chỉ đọc trực tiếp qua Gemini)"}</p>
                </label>

                <div className="tax-lookup-row">
                  <input
                    value={taxLookupInput}
                    onChange={(event) => setTaxLookupInput(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && !taxLookupLoading && lookupByTaxCode()}
                    placeholder="Hoặc nhập mã số thuế để tra cứu (VD: 0300741143)"
                    disabled={taxLookupLoading}
                  />
                  <button onClick={lookupByTaxCode} disabled={taxLookupLoading || !taxLookupInput.trim()}>
                    {taxLookupLoading ? "Đang tra cứu..." : "Tra cứu"}
                  </button>
                </div>

                <div className="sample-divider"><span>hoặc dùng hồ sơ mẫu</span></div>
                <div className="sample-buttons">
                  {sampleProfiles.map((candidate, index) => (
                    <button
                      key={candidate.id ?? candidate.tax_code}
                      className={profile.tax_code === candidate.tax_code ? "selected" : ""}
                      onClick={() => chooseProfile(candidate)}
                    >
                      <span>{index === 0 ? "N" : "A"}</span>
                      <div>
                        <strong>{candidate.name}</strong>
                        <small>{candidate.province}</small>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              <section className="panel-card form-panel">
                <div className="section-heading compact">
                  <div>
                    <span className="eyebrow">BƯỚC 02</span>
                    <h3>Kiểm tra thông tin</h3>
                  </div>
                  <span className="size-badge">{sme.size}</span>
                </div>

                <div className="form-grid">
                  <label className="wide-field">
                    Tên doanh nghiệp
                    <input value={profile.name} onChange={(e) => updateProfile("name", e.target.value)} />
                  </label>
                  <label>
                    Mã số thuế
                    <input value={profile.tax_code} onChange={(e) => updateProfile("tax_code", e.target.value)} />
                  </label>
                  <label>
                    Địa phương
                    <select value={profile.province} onChange={(e) => updateProfile("province", e.target.value)}>
                      {provinces.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Lĩnh vực
                    <select value={profile.industry} onChange={(e) => updateProfile("industry", e.target.value)}>
                      {industries.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <label className="wide-field">
                    Ngành nghề / mô tả
                    <textarea value={profile.business_line ?? ""} onChange={(e) => updateProfile("business_line", e.target.value)} rows={3} />
                  </label>
                  <label>
                    Lao động
                    <input type="number" min="0" value={profile.employees} onChange={(e) => updateProfile("employees", Number(e.target.value))} />
                  </label>
                  <label>
                    Doanh thu (tỷ VNĐ)
                    <input type="number" min="0" value={profile.revenue_bil} onChange={(e) => updateProfile("revenue_bil", Number(e.target.value))} />
                  </label>
                  <label>
                    Vốn (tỷ VNĐ)
                    <input type="number" min="0" value={profile.capital_bil} onChange={(e) => updateProfile("capital_bil", Number(e.target.value))} />
                  </label>
                  <label>
                    Năm thành lập
                    <input
                      type="number"
                      min="1990"
                      max={new Date().getFullYear()}
                      value={profile.founded_year ?? ""}
                      onChange={(e) => updateProfile("founded_year", e.target.value ? Number(e.target.value) : undefined)}
                    />
                  </label>
                  <label className="toggle-field">
                    <span>
                      <strong>Startup đổi mới sáng tạo</strong>
                      <small>Dùng để đối chiếu điều kiện chương trình</small>
                    </span>
                    <input type="checkbox" checked={profile.startup_innovation} onChange={(e) => updateProfile("startup_innovation", e.target.checked)} />
                  </label>
                </div>

                <button className="analyze-button" onClick={analyze} disabled={analyzing}>
                  {analyzing ? <><span className="button-spinner" /> Đang đối chiếu chính sách...</> : <>Phân tích và tìm chính sách <span>→</span></>}
                </button>
              </section>
            </div>

            <div className="result-column">
              <section className="result-header">
                <div>
                  <span className="eyebrow">BƯỚC 03 · XẾP HẠNG THEO QUY TẮC + PHÂN TÍCH AI</span>
                  <h2>Kết quả đề xuất</h2>
                </div>
                {results.length > 0 && (
                  <span>
                    {results.length} chính sách
                    {aiExplanationLoading && (
                      <>
                        {" "}
                        · <span className="button-spinner ai-loading-spinner" /> AI đang phân tích...
                      </>
                    )}
                  </span>
                )}
              </section>

              {results.length === 0 ? (
                <div className="empty-results">
                  <div className="compass-shape"><span>✦</span></div>
                  <h3>Sẵn sàng tìm lộ trình phù hợp</h3>
                  <p>Hoàn thiện hồ sơ doanh nghiệp và bắt đầu phân tích. Kết quả sẽ được xếp hạng theo mức độ phù hợp.</p>
                  <div className="empty-steps">
                    <span>01 · Đối chiếu lĩnh vực</span>
                    <span>02 · Kiểm tra phạm vi</span>
                    <span>03 · Xác định điều kiện</span>
                  </div>
                </div>
              ) : (
                <div className="results-list">
                  {results.map((policy, index) => (
                    <article className="policy-card" key={policy.id}>
                      <div className="policy-rank">{String(index + 1).padStart(2, "0")}</div>
                      <ScoreRing score={policy.score} />
                      <div className="policy-body">
                        <div className="policy-meta">
                          <span>{policy.program}</span>
                          <span className={`badge ${matchTone(policy.match_level)}`}>{policy.match_level}</span>
                        </div>
                        <h3>{policy.title}</h3>
                        <p>{policy.summary}</p>
                        <div className="reason-row">
                          {policy.reasons.slice(0, 2).map((reason) => <span key={reason}>✓ {reason}</span>)}
                        </div>
                        {aiExplanations[policy.id] ? (
                          <p className="policy-ai-note">
                            <span className="badge success">AI</span> {aiExplanations[policy.id]}
                          </p>
                        ) : aiExplanationLoading ? (
                          <p className="policy-ai-note policy-ai-note-loading">
                            <span className="button-spinner ai-loading-spinner" /> Đang phân tích bằng AI...
                          </p>
                        ) : null}
                        <div className="policy-footer">
                          <span>{policy.scope}</span>
                          <span>{policy.citations.length} nguồn dẫn</span>
                          <span>{policy.checklist.length} mục hồ sơ</span>
                          <button onClick={() => setSelectedPolicy(policy)}>Xem chi tiết →</button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {view === "qa" && (
          <section className="qa-layout">
            <div className="panel-card">
              <div className="section-heading compact">
                <div>
                  <span className="eyebrow">CÂU HỎI GỢI Ý</span>
                  <h3>Câu hỏi vàng</h3>
                </div>
                <span className="privacy-badge">{goldenQuestions.length}/10</span>
              </div>
              <div className="question-bank">
                {goldenQuestions.map((item) => (
                  <button key={item} onClick={() => ask(item)} disabled={answerLoading}>
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <section className="panel-card chat-panel">
              <div className="section-heading compact">
                <div>
                  <span className="eyebrow">
                    HỘI THOẠI · {llmSettings ? PROVIDER_LABELS[llmSettings.provider].toUpperCase() : "AI MẶC ĐỊNH CỦA MÁY CHỦ"}
                  </span>
                  <h3>Hỏi đáp pháp lý</h3>
                </div>
                <div className="chat-panel-actions">
                  {messages.length > 0 && (
                    <button className="text-button" onClick={resetConversation} disabled={answerLoading}>
                      Cuộc trò chuyện mới
                    </button>
                  )}
                  <button className="text-button" onClick={openSettings}>Đổi AI →</button>
                </div>
              </div>
              <p className="qa-profile-hint">
                Câu trả lời được cá nhân hoá theo hồ sơ:{" "}
                <strong>{profile.name || "chưa có tên"}</strong>
                {profile.province ? ` · ${profile.province}` : ""} — đổi hồ sơ (kể cả tra cứu bằng mã số thuế) ở tab &quot;Tìm chính sách&quot;.
              </p>

              <div className="chat-thread" ref={chatThreadRef}>
                {messages.length === 0 && !answerLoading && (
                  <div className="empty-hint">
                    Chọn một câu hỏi gợi ý hoặc tự nhập câu hỏi rồi bấm &quot;Hỏi&quot;. Các câu hỏi tiếp theo trong cùng hội thoại sẽ được
                    hiểu theo ngữ cảnh trước đó — không cần lặp lại thông tin đã hỏi.
                  </div>
                )}
                {messages.map((message) =>
                  message.role === "user" ? (
                    <div className="chat-bubble chat-bubble-user" key={message.id}>
                      <p>{message.text}</p>
                    </div>
                  ) : (
                    <div className="chat-bubble chat-bubble-assistant" key={message.id}>
                      <span className={`badge ${message.confidence === "Có căn cứ" ? "success" : "warning"}`}>{message.confidence}</span>
                      <p>{message.text}</p>
                      {message.citations.length > 0 ? (
                        <div className="detail-section citation-section">
                          <h3>Nguồn pháp lý</h3>
                          {message.citations.map((citation) => (
                            <a
                              href={citation.source}
                              target="_blank"
                              rel="noopener noreferrer"
                              key={`${message.id}-${citation.document}-${citation.clause}`}
                            >
                              <span className="source-icon">§</span>
                              <span><strong>{citation.document}</strong><small>{citation.clause} · {citation.status}</small></span>
                              <b>↗</b>
                            </a>
                          ))}
                        </div>
                      ) : (
                        <div className="empty-hint">Không có citation vì câu hỏi ngoài phạm vi dữ liệu hiện có.</div>
                      )}
                    </div>
                  )
                )}
                {answerLoading && (
                  <div className="chat-bubble chat-bubble-assistant chat-bubble-loading">
                    <span className="button-spinner" /> Đang truy hồi dữ liệu và gọi{" "}
                    {llmSettings ? PROVIDER_LABELS[llmSettings.provider] : "AI"} để sinh câu trả lời...
                  </div>
                )}
              </div>

              <div className="ask-bar">
                <input
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && !answerLoading && ask(question)}
                  placeholder="Hỏi về DNNVV, Đề án 844, SMEDF, ưu đãi đầu tư..."
                  disabled={answerLoading}
                />
                <button onClick={() => ask(question)} disabled={answerLoading || !question.trim()}>
                  {answerLoading ? <><span className="button-spinner" /> Đang truy hồi...</> : <>Hỏi →</>}
                </button>
              </div>
              <div className="legal-note">
                <strong>Lưu ý:</strong> Thông tin ở đây chỉ phục vụ sàng lọc ban đầu, không thay thế tư vấn pháp lý hoặc xác nhận của cơ
                quan có thẩm quyền.
              </div>
            </section>
          </section>
        )}

        {view === "updates" && (
          <section className="view-stack">
            <div className="updates-hero">
              <div>
                <span className="eyebrow">POLICY WATCH</span>
                <h2>Theo dõi thay đổi,<br /><em>chủ động chuẩn bị.</em></h2>
                <p>Các tín hiệu chính sách dưới đây được tổng hợp từ nguồn chính thống nhưng vẫn cần được xác minh lại tại nguồn gốc trước khi nộp hồ sơ thật.</p>
                {watchStatus && (
                  <p className="watch-status-hint">
                    {watchStatus.available
                      ? `Monitoring Pipeline: lần quét gần nhất ${watchStatus.lastRunAt ? new Date(watchStatus.lastRunAt).toLocaleString("vi-VN") : "?"}${
                          watchStatus.newArticlesFound ? ` · phát hiện ${watchStatus.newArticlesFound} tin mới` : ""
                        }.`
                      : "Monitoring Pipeline: chưa có lần quét nào — chạy `npm run data:watch` hoặc kích hoạt GitHub Actions."}
                  </p>
                )}
              </div>
              <div className="update-counter">
                <strong>{policyWatch.length}</strong>
                <span>tín hiệu đang theo dõi</span>
              </div>
            </div>

            <section className="panel-card timeline-panel">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">DÒNG THỜI GIAN</span>
                  <h3>Cập nhật chính sách gần đây</h3>
                </div>
              </div>
              <div className="timeline">
                {policyWatch.map((item) => (
                  <article key={`${item.date}-${item.title}`}>
                    <div className="timeline-date">
                      <strong>{item.date.slice(8, 10)}</strong>
                      <span>THÁNG {item.date.slice(5, 7)}</span>
                    </div>
                    <div className={`timeline-dot ${statusClass(item.status)}`} />
                    <div className="timeline-content">
                      <div>
                        <span className={`badge ${statusClass(item.status)}`}>{item.status}</span>
                        <small>{formatDate(item.date)}</small>
                      </div>
                      <h3>{item.title}</h3>
                      <p>{item.impact}</p>
                      <a href={item.source} target="_blank" rel="noopener noreferrer">Kiểm tra nguồn chính thức →</a>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </section>
        )}
      </main>

      {selectedPolicy && (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (event.currentTarget === event.target) setSelectedPolicy(null);
        }}>
          <section className="policy-modal" role="dialog" aria-modal="true" aria-labelledby="policy-title">
            <button className="modal-close" onClick={() => setSelectedPolicy(null)} aria-label="Đóng chi tiết">×</button>
            <div className="modal-topline">
              <ScoreRing score={selectedPolicy.score} />
              <div>
                <span className="eyebrow">{selectedPolicy.program}</span>
                <h2 id="policy-title">{selectedPolicy.title}</h2>
                <div className="modal-badges">
                  <span className={`badge ${matchTone(selectedPolicy.match_level)}`}>{selectedPolicy.match_level}</span>
                  <span className="badge neutral">{selectedPolicy.scope}</span>
                  <span className="badge neutral">{selectedPolicy.status}</span>
                </div>
              </div>
            </div>

            <p className="modal-summary">{selectedPolicy.summary}</p>

            <div className="modal-actions">
              <button className="modal-download-button secondary" onClick={fetchAiExplanations} disabled={aiExplanationLoading}>
                {aiExplanationLoading ? "Đang phân tích..." : "✦ Phân tích sâu hơn bằng AI"}
              </button>
              <button className="modal-download-button" onClick={() => downloadDocx(selectedPolicy)} disabled={docxLoading}>
                {docxLoading ? "Đang tạo file..." : "⇩ Xuất đơn .docx"}
              </button>
            </div>

            {aiExplanations[selectedPolicy.id] && (
              <div className="ai-explanation">
                <span className="badge success">PHÂN TÍCH AI</span>
                <p>{aiExplanations[selectedPolicy.id]}</p>
              </div>
            )}

            <div className="modal-grid">
              <div>
                <h3>Lý do phù hợp</h3>
                <ul className="check-list positive">
                  {(selectedPolicy.reasons.length ? selectedPolicy.reasons : ["Chưa có lý do nổi bật được ghi nhận."]).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>Điểm cần xác minh</h3>
                <ul className="check-list caution">
                  {(selectedPolicy.gaps.length ? selectedPolicy.gaps : ["Không có cảnh báo bổ sung."]).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="detail-section">
              <h3>Lợi ích có thể nhận</h3>
              <div className="benefit-grid">
                {selectedPolicy.benefits.map((item, index) => (
                  <div key={item}><span>{String(index + 1).padStart(2, "0")}</span><p>{item}</p></div>
                ))}
              </div>
            </div>

            <div className="detail-section">
              <div className="checklist-heading">
                <h3>Checklist hồ sơ</h3>
                <label className="checklist-upload-button">
                  {checklistMatchLoading ? "Đang đối chiếu..." : "⇪ Tải tài liệu để AI đối chiếu"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    disabled={checklistMatchLoading}
                    onChange={(e) => {
                      matchChecklistDocuments(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              {checklistMatchError && <p className="checklist-error">{checklistMatchError}</p>}
              {checklistMatch && (
                <p className="checklist-hint">
                  Kết quả AI đọc từ tài liệu bạn tải lên — chỉ mang tính gợi ý sơ bộ, không thay thế thẩm định hồ sơ thật.
                </p>
              )}
              <ol className="document-list">
                {selectedPolicy.checklist.map((item, index) => {
                  const match = checklistMatch?.[index];
                  const icon = !match ? "□" : match.status === "co" ? "✓" : match.status === "thieu" ? "✗" : "?";
                  const toneClass = !match ? "" : match.status === "co" ? "have" : match.status === "thieu" ? "missing" : "unsure";
                  return (
                    <li key={item} className={toneClass}>
                      <span>{icon}</span>
                      <div>
                        {item}
                        {match?.note && <small>{match.note}</small>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            {selectedPolicy.forms && selectedPolicy.forms.length > 0 && (
              <div className="detail-section">
                <h3>Biểu mẫu gốc</h3>
                <div className="official-forms-list">
                  {selectedPolicy.forms.map((form) => (
                    <a href={form.url} target="_blank" rel="noopener noreferrer" key={form.url} className="official-form-card">
                      <span className="source-icon">⇩</span>
                      <span>
                        <strong>{form.name}</strong>
                        <small>{form.description}</small>
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="detail-section citation-section">
              <h3>Nguồn pháp lý</h3>
              {selectedPolicy.citations.map((citation) => (
                <a href={citation.source} target="_blank" rel="noopener noreferrer" key={`${citation.document}-${citation.clause}`}>
                  <span className="source-icon">§</span>
                  <span><strong>{citation.document}</strong><small>{citation.clause} · {citation.status}</small></span>
                  <b>↗</b>
                </a>
              ))}
            </div>

            <div className="legal-note">
              <strong>Lưu ý:</strong> Kết quả dựa trên bộ dữ liệu chính sách đã xác minh (phạm vi hiện tại còn giới hạn, chưa bao phủ mọi
              chương trình), không thay thế tư vấn pháp lý. Vui lòng kiểm tra văn bản gốc trước khi chuẩn bị hồ sơ thật.
            </div>
          </section>
        </div>
      )}

      {settingsOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (event.currentTarget === event.target) setSettingsOpen(false);
        }}>
          <section className="policy-modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <button className="modal-close" onClick={() => setSettingsOpen(false)} aria-label="Đóng cài đặt">×</button>
            <span className="eyebrow">CÀI ĐẶT AI</span>
            <h2 id="settings-title">Chọn nhà cung cấp &amp; API key</h2>
            <p className="modal-summary">
              Nhập API key của bạn để Hỏi đáp pháp lý dùng nhà cung cấp bạn chọn thay vì cấu hình mặc định của máy chủ. Key chỉ lưu trên
              trình duyệt này (localStorage) và chỉ được gửi kèm khi bạn gọi Hỏi đáp — không lưu trên máy chủ.
            </p>

            <div className="form-grid">
              <label className="wide-field">
                Nhà cung cấp
                <select
                  value={draftProvider}
                  onChange={(event) => {
                    const next = event.target.value as LlmProvider;
                    setDraftProvider(next);
                    if (!draftModel || Object.values(DEFAULT_MODELS).includes(draftModel)) setDraftModel(DEFAULT_MODELS[next]);
                  }}
                >
                  {(Object.keys(PROVIDER_LABELS) as LlmProvider[]).map((key) => (
                    <option key={key} value={key}>{PROVIDER_LABELS[key]}</option>
                  ))}
                </select>
              </label>
              <label className="wide-field">
                API key
                <input
                  type="password"
                  value={draftApiKey}
                  onChange={(event) => setDraftApiKey(event.target.value)}
                  placeholder="Dán API key của bạn tại đây"
                  autoComplete="off"
                />
              </label>
              <label className="wide-field">
                Model
                <input
                  list="model-suggestions"
                  value={draftModel}
                  onChange={(event) => setDraftModel(event.target.value)}
                  placeholder={DEFAULT_MODELS[draftProvider]}
                />
                <datalist id="model-suggestions">
                  {MODEL_SUGGESTIONS[draftProvider].map((model) => (
                    <option key={model} value={model} />
                  ))}
                </datalist>
              </label>
            </div>

            <div className="settings-actions">
              <button className="analyze-button" onClick={saveSettings}>
                {draftApiKey.trim() ? "Lưu cấu hình" : "Xoá cấu hình (dùng mặc định máy chủ)"}
              </button>
            </div>

            <div className="legal-note">
              <strong>Lưu ý:</strong> Không chia sẻ máy này nếu bạn không muốn người khác thấy key đã lưu. Bỏ trống API key rồi lưu để
              quay lại dùng cấu hình mặc định của máy chủ (nếu quản trị viên đã cấu hình sẵn).
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
