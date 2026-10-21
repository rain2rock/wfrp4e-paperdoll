// Общий запуск браузера для проверок: локальный playwright или глобальный, свой Chromium через PW_CHROMIUM
let pw;
try { pw = await import("playwright"); } catch { pw = await import("/opt/node-tools/node_modules/playwright/index.mjs"); }
export const chromium = pw.chromium;
export const launch = () => chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}).catch(() => chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }));
