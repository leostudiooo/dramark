import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import puppeteer from 'puppeteer-core';

const CHROME_PATHS: Record<string, string[]> = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
  linux: [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
  ],
};

export async function detectChromePath(): Promise<string | null> {
  const configPath = vscode.workspace.getConfiguration('dramark').get<string>('pdf.chromePath', '');
  if (configPath && fs.existsSync(configPath)) {
    return configPath;
  }

  const vscodeChromePath = findVscodeElectronChrome();
  if (vscodeChromePath) {
    return vscodeChromePath;
  }

  const platform = os.platform();
  const candidates = CHROME_PATHS[platform] ?? [];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return null;
}

function findVscodeElectronChrome(): string | null {
  const appRoot = vscode.env.appRoot;
  if (!appRoot) {
    return null;
  }

  const platform = os.platform();
  let electronPath: string;

  if (platform === 'darwin') {
    electronPath = path.join(appRoot, '..', 'Frameworks', 'Electron Framework.framework', 'Versions', 'A', 'Electron Framework');
    if (fs.existsSync(electronPath)) {
      return electronPath;
    }
    electronPath = path.join(appRoot, '..', 'MacOS', 'Electron');
    if (fs.existsSync(electronPath)) {
      return electronPath;
    }
  } else if (platform === 'win32') {
    electronPath = path.join(appRoot, 'electron.exe');
    if (fs.existsSync(electronPath)) {
      return electronPath;
    }
  } else {
    electronPath = path.join(appRoot, 'electron');
    if (fs.existsSync(electronPath)) {
      return electronPath;
    }
  }

  return null;
}

export async function exportToPdf(
  html: string,
  outputPath: string,
  chromePath: string,
): Promise<void> {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  const page = await browser.newPage();
  await page.emulateMediaType('print');
  await page.setContent(html, {
    waitUntil: 'domcontentloaded',
    timeout: 10000,
  });

  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '1cm',
      bottom: '1cm',
      left: '1cm',
      right: '1cm',
    },
  });

  await browser.close();
}
