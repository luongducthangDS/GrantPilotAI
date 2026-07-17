"use client";

import {
  AlertCircle,
  BadgeCheck,
  Bot,
  Building2,
  CheckCircle2,
  CircleHelp,
  ClipboardCheck,
  Download,
  FileSearch,
  FileText,
  Landmark,
  Loader2,
  Radar,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Upload
} from "lucide-react";
import { ChangeEvent, useMemo, useState } from "react";

import {
  Answer,
  MatchResult,
  Profile,
  answerQuestion,
  classifySme,
  goldenQuestions,
  matchPolicies,
  parseUploadedText,
  policyWatch,
  sampleProfiles
} from "@/lib/grantpilot";

type TabKey = "match" | "qa" | "grant" | "watch";

const provinces = ["Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng", "Bình Dương", "Bắc Ninh", "Khác"];
const industries = ["Phần mềm / AI", "Sản xuất", "Công nghệ cao", "Dịch vụ đổi mới sáng tạo", "Thương mại", "Khác"];

const tabItems: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
  { key: "match", label: "Hồ sơ & matching", icon: <FileSearch size={17} /> },
  { key: "qa", label: "Q&A pháp lý", icon: <Bot size={17} /> },
  { key: "grant", label: "Hồ sơ 844", icon: <ClipboardCheck size={17} /> },
  { key: "watch", label: "Policy watch", icon: <Radar size={17} /> }
];

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "bad" }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function Field({
  label,
  children,
  compact = false
}: {
  label: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <label className={compact ? "field compact" : "field"}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function CitationList({ citations }: { citations: MatchResult["citations"] }) {
  return (
    <div className="citationList">
      {citations.map((citation) => (
        <a href={citation.source} key={`${citation.document}-${citation.clause}`} target="_blank" rel="noreferrer" className="citation">
          <Badge tone={citation.status.includes("Còn hiệu lực") ? "good" : "warn"}>{citation.status}</Badge>
          <span>{citation.document}</span>
          <small>{citation.clause}</small>
        </a>
      ))}
    </div>
  );
}

function PolicyCard({ policy }: { policy: MatchResult }) {
  const tone = policy.score >= 80 ? "good" : policy.score >= 55 ? "warn" : "bad";
  return (
    <article className={`policyCard ${tone}`}>
      <div className="policyTop">
        <div>
          <div className="badgeLine">
            <Badge tone={tone}>{policy.score}/100</Badge>
            <Badge>{policy.match_level}</Badge>
            <Badge tone={policy.status.includes("Còn hiệu lực") ? "good" : "warn"}>{policy.status}</Badge>
          </div>
          <h3>{policy.title}</h3>
          <p className="muted">
            {policy.program} · {policy.scope}
          </p>
        </div>
        <div className="scoreDial" aria-label={`Điểm khớp ${policy.score}`} style={{ "--score": policy.score } as React.CSSProperties}>
          <span>{policy.score}</span>
        </div>
      </div>
      <p>{policy.summary}</p>
      <div className="twoCol tight">
        <div>
          <h4>Điểm khớp</h4>
          <ul>
            {(policy.reasons.length ? policy.reasons : ["Cần bổ sung dữ liệu để giải thích điểm khớp."]).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4>Cần rà soát</h4>
          <ul>
            {(policy.gaps.length ? policy.gaps : ["Chưa phát hiện khoảng trống lớn trong hồ sơ demo."]).map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        </div>
      </div>
      <CitationList citations={policy.citations} />
    </article>
  );
}

export default function Home() {
  const [profile, setProfile] = useState<Profile>(sampleProfiles[0]);
  const [activeTab, setActiveTab] = useState<TabKey>("match");
  const [question, setQuestion] = useState(goldenQuestions[0]);
  const [answer, setAnswer] = useState<Answer | null>(answerQuestion(goldenQuestions[0], sampleProfiles[0]));
  const [docxLoading, setDocxLoading] = useState(false);

  const sme = useMemo(() => classifySme(profile), [profile]);
  const matches = useMemo(() => matchPolicies(profile), [profile]);
  const topMatch = matches[0];
  const dean844 = matches.find((match) => match.id === "p_dean844") ?? matches[0];

  function updateProfile<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function loadPreset(id: string) {
    const next = sampleProfiles.find((item) => item.id === id);
    if (next) {
      setProfile(next);
      setAnswer(answerQuestion(question, next));
    }
  }

  async function onUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setProfile((current) => ({ ...current, ...parseUploadedText(text) }));
  }

  function ask() {
    setAnswer(answerQuestion(question, profile));
  }

  async function downloadDocx() {
    setDocxLoading(true);
    try {
      const response = await fetch("/api/grant-docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, policy: dean844 })
      });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "grantpilot-de-an-844.docx";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDocxLoading(false);
    }
  }

  return (
    <main className="shell">
      <section className="heroPanel">
        <div className="brandBlock">
          <div className="brandMark">
            <Landmark size={26} />
          </div>
          <div>
            <h1>GrantPilot AI</h1>
            <p>Policy & Grant Navigator cho DNNVV và startup đổi mới sáng tạo</p>
          </div>
        </div>
        <div className="statusStrip">
          <div>
            <span>Phân loại</span>
            <strong>{sme.size}</strong>
          </div>
          <div>
            <span>Top match</span>
            <strong>{topMatch.score}/100</strong>
          </div>
          <div>
            <span>Citation top 3</span>
            <strong>{matches.slice(0, 3).reduce((total, item) => total + item.citations.length, 0)}</strong>
          </div>
          <div>
            <span>Demo mode</span>
            <strong>Offline</strong>
          </div>
        </div>
      </section>

      <section className="workbench">
        <aside className="profilePanel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Company profile</span>
              <h2>Hồ sơ doanh nghiệp</h2>
            </div>
            <Building2 size={22} />
          </div>

          <div className="toolbar">
            <select aria-label="Chọn hồ sơ mẫu" onChange={(event) => loadPreset(event.target.value)} value={profile.id ?? ""}>
              {sampleProfiles.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <label className="iconButton" title="OCR mock từ TXT">
              <Upload size={17} />
              <input type="file" accept=".txt" onChange={onUpload} />
            </label>
            <button className="iconButton" title="Reset NovaMind" onClick={() => loadPreset("tech_hanoi")}>
              <RotateCcw size={17} />
            </button>
          </div>

          <Field label="Tên doanh nghiệp">
            <input value={profile.name} onChange={(event) => updateProfile("name", event.target.value)} />
          </Field>
          <div className="twoCol">
            <Field label="Mã số thuế" compact>
              <input value={profile.tax_code} onChange={(event) => updateProfile("tax_code", event.target.value)} />
            </Field>
            <Field label="Tỉnh/thành" compact>
              <select value={profile.province} onChange={(event) => updateProfile("province", event.target.value)}>
                {provinces.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Lĩnh vực">
            <select value={profile.industry} onChange={(event) => updateProfile("industry", event.target.value)}>
              {industries.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </Field>
          <Field label="Mô tả ngành nghề">
            <textarea value={profile.business_line ?? ""} onChange={(event) => updateProfile("business_line", event.target.value)} rows={3} />
          </Field>

          <div className="threeCol">
            <Field label="Lao động" compact>
              <input type="number" value={profile.employees} onChange={(event) => updateProfile("employees", Number(event.target.value))} />
            </Field>
            <Field label="DT tỷ" compact>
              <input type="number" value={profile.revenue_bil} onChange={(event) => updateProfile("revenue_bil", Number(event.target.value))} />
            </Field>
            <Field label="Vốn tỷ" compact>
              <input type="number" value={profile.capital_bil} onChange={(event) => updateProfile("capital_bil", Number(event.target.value))} />
            </Field>
          </div>

          <label className="toggleRow">
            <input type="checkbox" checked={profile.startup_innovation} onChange={(event) => updateProfile("startup_innovation", event.target.checked)} />
            <span>Startup đổi mới sáng tạo</span>
          </label>

          <div className="twoCol">
            <Field label="Người đại diện" compact>
              <input value={profile.representative ?? ""} onChange={(event) => updateProfile("representative", event.target.value)} />
            </Field>
            <Field label="Giai đoạn" compact>
              <input value={profile.stage ?? ""} onChange={(event) => updateProfile("stage", event.target.value)} />
            </Field>
          </div>
          <div className="twoCol">
            <Field label="Email" compact>
              <input value={profile.email ?? ""} onChange={(event) => updateProfile("email", event.target.value)} />
            </Field>
            <Field label="Điện thoại" compact>
              <input value={profile.phone ?? ""} onChange={(event) => updateProfile("phone", event.target.value)} />
            </Field>
          </div>

          <div className="smeBox">
            <BadgeCheck size={20} />
            <div>
              <strong>{sme.size}</strong>
              <p>{sme.basis}</p>
            </div>
          </div>
        </aside>

        <section className="mainPanel">
          <nav className="tabs" aria-label="Demo tabs">
            {tabItems.map((item) => (
              <button key={item.key} className={activeTab === item.key ? "active" : ""} onClick={() => setActiveTab(item.key)}>
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>

          {activeTab === "match" && (
            <div className="tabBody">
              <div className="sectionHeader">
                <div>
                  <span className="eyebrow">Matching engine</span>
                  <h2>Kết quả chính sách phù hợp</h2>
                </div>
                <Badge tone="good">{matches.filter((match) => match.score >= 55).length} chính sách khả thi</Badge>
              </div>
              <div className="policyList">
                {matches.map((match) => (
                  <PolicyCard policy={match} key={match.id} />
                ))}
              </div>
            </div>
          )}

          {activeTab === "qa" && (
            <div className="tabBody">
              <div className="sectionHeader">
                <div>
                  <span className="eyebrow">RAG demo</span>
                  <h2>Q&A có căn cứ</h2>
                </div>
                <Badge>{goldenQuestions.length}/10 câu hỏi vàng</Badge>
              </div>
              <div className="qaGrid">
                <div className="questionBank">
                  {goldenQuestions.map((item) => (
                    <button
                      key={item}
                      className={question === item ? "selected" : ""}
                      onClick={() => {
                        setQuestion(item);
                        setAnswer(answerQuestion(item, profile));
                      }}
                    >
                      <CircleHelp size={16} />
                      {item}
                    </button>
                  ))}
                </div>
                <div className="answerPanel">
                  <div className="askBar">
                    <Search size={18} />
                    <input value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => event.key === "Enter" && ask()} />
                    <button onClick={ask}>
                      <Send size={17} />
                      Hỏi
                    </button>
                  </div>
                  {answer && (
                    <div className="answerBox">
                      <Badge tone={answer.confidence === "Có căn cứ trong corpus" ? "good" : "bad"}>{answer.confidence}</Badge>
                      <p>{answer.text}</p>
                      {answer.citations.length > 0 ? <CitationList citations={answer.citations} /> : <div className="emptyHint">Không có citation vì câu hỏi ngoài phạm vi corpus demo.</div>}
                      <div className="disclaimer">
                        <AlertCircle size={17} />
                        Thông tin MVP chỉ phục vụ sàng lọc ban đầu, không thay thế tư vấn pháp lý hoặc xác nhận của cơ quan có thẩm quyền.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "grant" && (
            <div className="tabBody">
              <div className="sectionHeader">
                <div>
                  <span className="eyebrow">Grant assist</span>
                  <h2>Checklist & đơn Đề án 844</h2>
                </div>
                <button className="primaryButton" onClick={downloadDocx} disabled={docxLoading}>
                  {docxLoading ? <Loader2 className="spin" size={17} /> : <Download size={17} />}
                  Xuất DOCX
                </button>
              </div>
              <PolicyCard policy={dean844} />
              <div className="checklist">
                {dean844.checklist.map((item, index) => (
                  <label key={item}>
                    <input type="checkbox" defaultChecked={index < 3} />
                    <CheckCircle2 size={18} />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {activeTab === "watch" && (
            <div className="tabBody">
              <div className="sectionHeader">
                <div>
                  <span className="eyebrow">Mock monitor</span>
                  <h2>Policy watch</h2>
                </div>
                <Badge tone="warn">Seed demo</Badge>
              </div>
              <div className="watchList">
                {policyWatch.map((item) => (
                  <article key={`${item.date}-${item.title}`} className="watchItem">
                    <div className="watchIcon">
                      <FileText size={20} />
                    </div>
                    <div>
                      <div className="badgeLine">
                        <Badge>{item.date}</Badge>
                        <Badge tone={item.status === "Theo dõi" ? "good" : "warn"}>{item.status}</Badge>
                      </div>
                      <h3>{item.title}</h3>
                      <p>{item.impact}</p>
                      <a href={item.source} target="_blank" rel="noreferrer">
                        nguồn theo dõi
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
