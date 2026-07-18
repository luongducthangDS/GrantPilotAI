"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Lỗi không mong muốn ở giao diện:", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 32,
        textAlign: "center",
        background: "#06111f",
        color: "#ffffff",
        fontFamily: "system-ui, sans-serif"
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: "#0f8b8d",
          display: "grid",
          placeItems: "center",
          fontWeight: 800,
          fontSize: 20
        }}
      >
        G
      </div>
      <h1 style={{ fontSize: 20, margin: 0 }}>Đã có lỗi xảy ra</h1>
      <p style={{ maxWidth: 420, color: "#c8d1db", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
        Rất tiếc, GrantPilot AI gặp sự cố khi hiển thị trang này. Vui lòng thử lại — nếu vẫn lỗi, hồ sơ bạn đang nhập sẽ không bị mất vì
        được lưu ngay trên trình duyệt.
      </p>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={() => reset()}
          style={{
            padding: "10px 20px",
            borderRadius: 9,
            border: "none",
            background: "linear-gradient(135deg, #0f8b8d, #0a7476)",
            color: "#fff",
            fontWeight: 700,
            fontSize: 12,
            cursor: "pointer"
          }}
        >
          Thử lại
        </button>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: "10px 20px",
            borderRadius: 9,
            border: "1px solid #3d5368",
            background: "transparent",
            color: "#fff",
            fontWeight: 700,
            fontSize: 12,
            cursor: "pointer"
          }}
        >
          Tải lại trang
        </button>
      </div>
    </div>
  );
}
