import fs from 'fs';
import path from 'path';

export interface LLMConfig {
  apiKey: string | undefined;
  baseUrl: string;
  model: string;
  fastModel: string;
}

let memoryConfig: Partial<LLMConfig> | null = null;

function readEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const text = fs.readFileSync(filePath, 'utf-8');
  const vars: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

export function getLLMConfig(): LLMConfig {
  if (memoryConfig) {
    return {
      apiKey: memoryConfig.apiKey ?? process.env.LLM_API_KEY,
      baseUrl: memoryConfig.baseUrl ?? process.env.LLM_BASE_URL ?? 'https://api.deepseek.com/v1',
      model: memoryConfig.model ?? process.env.LLM_MODEL ?? 'deepseek-chat',
      fastModel: memoryConfig.fastModel ?? process.env.LLM_FAST_MODEL ?? 'deepseek-chat',
    };
  }
  const localEnv = readEnvFile(path.resolve(process.cwd(), '.env.local'));
  return {
    apiKey: process.env.LLM_API_KEY || localEnv.LLM_API_KEY || undefined,
    baseUrl: process.env.LLM_BASE_URL || localEnv.LLM_BASE_URL || 'https://api.deepseek.com/v1',
    model: process.env.LLM_MODEL || localEnv.LLM_MODEL || 'deepseek-chat',
    fastModel: process.env.LLM_FAST_MODEL || localEnv.LLM_FAST_MODEL || 'deepseek-chat',
  };
}

export function setLLMConfig(config: Partial<LLMConfig>): void {
  memoryConfig = {
    ...(memoryConfig || {}),
    ...config,
  };
  if (config.apiKey === '') {
    memoryConfig.apiKey = undefined;
  }
  persistLLMConfig(config);
}

function persistLLMConfig(config: Partial<LLMConfig>): void {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    const lines = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8').split(/\r?\n/) : [];
    const keys = ['LLM_API_KEY', 'LLM_BASE_URL', 'LLM_MODEL'];
    const updates: Record<string, string | undefined> = {
      LLM_API_KEY: config.apiKey,
      LLM_BASE_URL: config.baseUrl,
      LLM_MODEL: config.model,
    };
    for (const key of keys) {
      const value = updates[key];
      if (value === undefined) continue;
      let found = false;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim().startsWith(`${key}=`) || line.trim().startsWith(`${key} `)) {
          if (value === '') {
            lines.splice(i, 1);
          } else {
            lines[i] = `${key}="${value}"`;
          }
          found = true;
          break;
        }
      }
      if (!found && value !== '') {
        if (lines.length > 0 && lines[lines.length - 1].trim() !== '') {
          lines.push('');
        }
        lines.push(`${key}="${value}"`);
      }
    }
    fs.writeFileSync(envPath, lines.join('\n'), 'utf-8');
  } catch (err) {
    console.error('persistLLMConfig failed', err);
  }
}

export function maskKey(key: string | undefined): string {
  if (!key) return '';
  if (key.length <= 8) return '********';
  return key.slice(0, 4) + '****' + key.slice(-4);
}
