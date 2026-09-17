/**
 * Social Lifecycle Background Worker
 * Handles periodic tasks for Rubaru social features:
 * 1. Expiring stories after 24 hours (updating status from PUBLISHED -> EXPIRED)
 * 2. Processing pending OutboxEvent queue to dispatch notifications
 */
const storyService = require('./storyService');
const notificationConsumer = require('./notificationConsumer');

class SocialLifecycleWorker {
  constructor(options = {}) {
    this.storyExpiryIntervalMs = options.storyExpiryIntervalMs || 60000; // 60s
    this.outboxProcessIntervalMs = options.outboxProcessIntervalMs || 5000; // 5s
    this.isRunning = false;
    this.storyTimer = null;
    this.outboxTimer = null;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[SOCIAL LIFECYCLE WORKER] Started social lifecycle worker');
    this.scheduleStoryPass();
    this.scheduleOutboxPass();
  }

  stop() {
    this.isRunning = false;
    if (this.storyTimer) {
      clearTimeout(this.storyTimer);
      this.storyTimer = null;
    }
    if (this.outboxTimer) {
      clearTimeout(this.outboxTimer);
      this.outboxTimer = null;
    }
    console.log('[SOCIAL LIFECYCLE WORKER] Stopped social lifecycle worker');
  }

  scheduleStoryPass() {
    if (!this.isRunning) return;
    this.storyTimer = setTimeout(async () => {
      try {
        const result = await storyService.expireStoriesBatch(100);
        if (result && result.expiredCount > 0) {
          console.log(`[SOCIAL LIFECYCLE WORKER] Expired ${result.expiredCount} stories.`);
        }
      } catch (err) {
        console.warn('[SOCIAL LIFECYCLE WORKER] Error in story expiry pass:', err.message);
      } finally {
        if (this.isRunning) {
          this.scheduleStoryPass();
        }
      }
    }, this.storyExpiryIntervalMs);
  }

  scheduleOutboxPass() {
    if (!this.isRunning) return;
    this.outboxTimer = setTimeout(async () => {
      try {
        const result = await notificationConsumer.processPendingOutboxEvents(50);
        if (result && result.processedCount > 0) {
          console.log(`[SOCIAL LIFECYCLE WORKER] Processed ${result.processedCount} outbox events.`);
        }
      } catch (err) {
        console.warn('[SOCIAL LIFECYCLE WORKER] Error in outbox processing pass:', err.message);
      } finally {
        if (this.isRunning) {
          this.scheduleOutboxPass();
        }
      }
    }, this.outboxProcessIntervalMs);
  }
}

const defaultSocialWorker = new SocialLifecycleWorker();

module.exports = {
  SocialLifecycleWorker,
  defaultSocialWorker,
};
