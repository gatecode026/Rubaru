const reconciliationService = require('./reconciliationService');

/**
 * Background worker for continuous financial reconciliation
 */
class ReconciliationWorker {
  constructor(options = {}) {
    this.intervalMs = options.intervalMs || 60000; // Run every 60s
    this.isRunning = false;
    this.timer = null;
    this.latestReport = null;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[RECONCILIATION WORKER] Started scheduled background reconciliation');
    this.scheduleNextRun();
  }

  stop() {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    console.log('[RECONCILIATION WORKER] Stopped scheduled reconciliation');
  }

  scheduleNextRun() {
    if (!this.isRunning) return;
    this.timer = setTimeout(async () => {
      try {
        await this.runPass();
      } catch (err) {
        console.error('[RECONCILIATION WORKER] Error during pass:', err.message);
      } finally {
        if (this.isRunning) {
          this.scheduleNextRun();
        }
      }
    }, this.intervalMs);
  }

  async runPass() {
    const report = await reconciliationService.runFullReconciliation();
    this.latestReport = report;

    if (!report.isHealthy) {
      const criticalIssues = report.allIssues.filter((i) => i.severity === 'CRITICAL');
      if (criticalIssues.length > 0) {
        console.error(`[RECONCILIATION ALERT] Detected ${criticalIssues.length} CRITICAL financial inconsistencies!`, criticalIssues);
      } else {
        console.warn(`[RECONCILIATION WARNING] Detected ${report.summary.totalIssues} financial issues`, report.summary);
      }
    }
    return report;
  }

  getLatestReport() {
    return this.latestReport;
  }
}

const defaultReconciliationWorker = new ReconciliationWorker();

module.exports = {
  ReconciliationWorker,
  defaultReconciliationWorker,
};
