import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages（リポジトリ名: fluentpath）向けのbaseパス設定
  base: '/fluentpath/',
  server: {
    port: 5173,
    host: true, // スマホ実機（Pixel 8 Proなど）からのローカルWi-Fi接続もテスト可能
  },
});
