import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/** dev では next-pwa を一切噛ませない（＝起動安定） */
const nextConfig: NextConfig = {
  turbopack: {},
};

let exportConfig: any = nextConfig;

if (isProd) {
  // prod の時だけ require で読み込む（TS型定義問題も回避）
  const withPWA = require("next-pwa")({
    dest: "public",
    register: true,
    skipWaiting: true,
  });

  exportConfig = withPWA(nextConfig);
}

export default exportConfig;
