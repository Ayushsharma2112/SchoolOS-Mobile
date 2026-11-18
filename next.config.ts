import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development" && process.env.ENABLE_PWA_DEV !== "true",
  register: true,
  skipWaiting: true,
});

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ['10.81.217.186', '10.81.217.186:3000', '10.199.224.186', '10.199.224.186:3000', 'localhost:3000']
};

export default withPWA(nextConfig);
