import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

// Read-only status for the Monitoring Pipeline (scripts/refresh_policy_watch.py
// + .github/workflows/refresh-data.yml). This route does NOT run the
// crawlers itself — Python/Playwright aren't available in this Node.js
// route on Render — it just surfaces the last report the pipeline wrote,
// so the UI can show when policy_watch.json was last checked.
export async function GET() {
  const reportPath = path.join(process.cwd(), "data", "policy_watch_refresh_report.md");

  try {
    const report = await readFile(reportPath, "utf-8");
    const runAtMatch = report.match(/Run at: (.+)/);
    const sourcesLine = report.match(/Checked \d+ sources.+/);
    const newArticlesMatch = report.match(/Found (\d+) new relevant article/);

    return NextResponse.json({
      available: true,
      lastRunAt: runAtMatch?.[1]?.trim() ?? null,
      sourcesSummary: sourcesLine?.[0]?.trim() ?? null,
      newArticlesFound: newArticlesMatch ? Number(newArticlesMatch[1]) : 0
    });
  } catch {
    return NextResponse.json({
      available: false,
      message: "Chưa có lần chạy Monitoring Pipeline nào. Chạy `npm run data:watch` hoặc kích hoạt GitHub Actions workflow."
    });
  }
}
