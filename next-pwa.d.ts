declare module 'next-pwa' {
  import { NextConfig } from 'next';
  
  interface PWAConfig {
    dest?: string;
    disable?: boolean;
    register?: boolean;
    scope?: string;
    sw?: string;
    skipWaiting?: boolean;
    [key: string]: any;
  }

  function withPWAInit(config: PWAConfig): (nextConfig: NextConfig) => NextConfig;
  export default withPWAInit;
}
