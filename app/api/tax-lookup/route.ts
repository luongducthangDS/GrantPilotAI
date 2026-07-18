import { NextResponse } from "next/server";

import { guessProvinceFromAddress } from "@/lib/grantpilot";

// Looks up a real Vietnamese business by tax code via VietQR's public
// business registry endpoint (no API key required) — sourced from the tax
// authority's own portal (gdt.gov.vn), refreshed periodically per their
// metadata.disclaimer. This is a plain data lookup, no LLM involved: given a
// tax code, it either exists in the registry or it doesn't.
const VIETQR_BUSINESS_URL = "https://api.vietqr.io/v2/business/";

type VietQrResponse = {
  code: string;
  desc: string;
  data: { id: string; name: string; shortName?: string | null; address?: string; status?: string } | null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const taxCode = searchParams.get("taxCode")?.trim();

  if (!taxCode) {
    return NextResponse.json({ error: "Thiếu mã số thuế." }, { status: 400 });
  }
  if (!/^\d{10}(-\d{3})?$|^\d{13}$/.test(taxCode)) {
    return NextResponse.json({ error: "Mã số thuế không đúng định dạng (10 hoặc 13 chữ số)." }, { status: 400 });
  }

  try {
    const response = await fetch(`${VIETQR_BUSINESS_URL}${encodeURIComponent(taxCode)}`);
    const result = (await response.json()) as VietQrResponse;

    if (result.code !== "00" || !result.data) {
      return NextResponse.json({ error: result.desc || "Không tìm thấy doanh nghiệp với mã số thuế này." }, { status: 404 });
    }

    const address = result.data.address ?? "";
    return NextResponse.json({
      name: result.data.name,
      tax_code: result.data.id,
      province: guessProvinceFromAddress(address),
      address,
      status: result.data.status
    });
  } catch (error) {
    console.error("Tra cứu mã số thuế thất bại:", error);
    return NextResponse.json({ error: "Không kết nối được dịch vụ tra cứu mã số thuế. Thử lại sau." }, { status: 502 });
  }
}
