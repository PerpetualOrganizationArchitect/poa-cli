/**
 * Dual-mode Output
 * Human-readable (tables, colors, spinners) vs --json (structured stdout).
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import ora, { Ora } from 'ora';

let jsonMode = false;

export function setJsonMode(enabled: boolean): void {
  jsonMode = enabled;
}

export function isJsonMode(): boolean {
  return jsonMode;
}

export function success(message: string, data?: any): void {
  if (jsonMode) {
    console.log(JSON.stringify({ status: 'ok', message, ...data }));
  } else {
    console.log(chalk.green('✓') + ' ' + message);
    if (data) {
      for (const [key, value] of Object.entries(data)) {
        if (value === undefined || value === null) continue;
        // Render explorer links as clickable
        if (key === 'explorerUrl') {
          console.log(`  ${chalk.dim('view:')} ${chalk.underline(String(value))}`);
        } else {
          console.log(`  ${chalk.dim(key + ':')} ${value}`);
        }
      }
    }
  }
}

export function error(message: string, details?: any): void {
  if (jsonMode) {
    const payload: any = { status: 'error', message };
    if (details?.errorCode) payload.code = details.errorCode;
    if (details?.error) payload.detail = details.error;
    if (details?.suggestion) payload.suggestion = details.suggestion;
    console.error(JSON.stringify(payload));
  } else {
    console.error(chalk.red('✗') + ' ' + message);
    if (details?.suggestion) {
      console.error(chalk.dim('  Suggestion: ' + details.suggestion));
    }
  }
}

export function info(message: string): void {
  if (jsonMode) return; // suppressed in json mode
  console.log(chalk.blue('ℹ') + ' ' + message);
}

export function warn(message: string): void {
  if (jsonMode) return;
  console.log(chalk.yellow('⚠') + ' ' + message);
}

/** Remind user that subgraph data lags behind on-chain state after writes */
export function subgraphLagWarning(): void {
  if (jsonMode) return;
  console.log(chalk.dim('  Note: subgraph may take a few seconds to index this transaction'));
}

export function table(headers: string[], rows: string[][]): void {
  if (jsonMode) {
    const objects = rows.map(row => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
    console.log(JSON.stringify(objects));
    return;
  }

  const t = new Table({
    head: headers.map(h => chalk.cyan(h)),
    style: { head: [], border: [] },
  });

  for (const row of rows) {
    t.push(row);
  }

  console.log(t.toString());
}

export function json(data: any): void {
  console.log(JSON.stringify(data, null, jsonMode ? undefined : 2));
}

export function spinner(message: string): Ora {
  if (jsonMode) {
    // Return a chainable no-op spinner in JSON mode
    const noOp: any = { text: message };
    noOp.start = () => noOp;
    noOp.stop = () => noOp;
    noOp.succeed = () => noOp;
    noOp.fail = () => noOp;
    noOp.warn = () => noOp;
    noOp.info = () => noOp;
    noOp.clear = () => noOp;
    noOp.render = () => noOp;
    noOp.isSpinning = false;
    return noOp as Ora;
  }
  return ora(message);
}
