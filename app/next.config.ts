import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.youtube.com https://s.ytimg.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' blob: https://*.r2.dev https://*.r2.cloudflarestorage.com https://i.ytimg.com https://img.youtube.com data:",
              "media-src 'self' https://*.r2.dev https://*.r2.cloudflarestorage.com https://www.youtube.com",
              "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
              "font-src 'self'",
              "connect-src 'self' https://*.supabase.co https://*.r2.cloudflarestorage.com https://www.youtube.com https://*.googlevideo.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
