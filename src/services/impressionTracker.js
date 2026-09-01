import feedService from './feedService';

/**
 * Rubaru Client Visibility & Feed Impression Tracker
 * Enforces rule: >= 50% visibility for >= 1.0 continuous second while active.
 */
class ImpressionTracker {
  constructor() {
    this.activeTimers = new Map(); // key -> { startTime, item, batchId, position }
    this.qualifiedEvents = []; // Queue of events waiting to flush
    this.seenEventIds = new Set(); // Prevent duplicate client events
    this.flushTimeout = null;
    this.isFlushing = false;
    this.MAX_QUEUE_SIZE = 10;
    this.FLUSH_INTERVAL_MS = 5000;
  }

  /**
   * Handle FlatList onViewableItemsChanged
   */
  onViewableItemsChanged(viewableItems, currentBatchId) {
    if (!currentBatchId || !Array.isArray(viewableItems)) return;

    const currentVisibleKeys = new Set();
    const now = Date.now();

    for (const viewItem of viewableItems) {
      if (!viewItem.isViewable || !viewItem.item) continue;
      const item = viewItem.item;
      const contentId = item.postId || item.id;
      if (!contentId) continue;

      const position = typeof item.feedPosition === 'number' ? item.feedPosition : viewItem.index;
      const trackingKey = `${currentBatchId}_${contentId}_${position}`;
      currentVisibleKeys.add(trackingKey);

      if (!this.activeTimers.has(trackingKey) && !this.seenEventIds.has(trackingKey)) {
        // Start candidate timer
        this.activeTimers.set(trackingKey, {
          startTime: now,
          contentId,
          position,
          batchId: currentBatchId,
        });
      }
    }

    // Check which items left the viewport
    for (const [key, record] of this.activeTimers.entries()) {
      if (!currentVisibleKeys.has(key)) {
        const dwellTimeMs = now - record.startTime;
        if (dwellTimeMs >= 1000) {
          // Qualified impression!
          this.qualifyImpression(record, dwellTimeMs);
        }
        this.activeTimers.delete(key);
      }
    }

    this.scheduleFlush();
  }

  /**
   * Record qualified impression into local queue
   */
  qualifyImpression(record, dwellTimeMs) {
    const key = `${record.batchId}_${record.contentId}_${record.position}`;
    if (this.seenEventIds.has(key)) return;

    this.seenEventIds.add(key);

    const eventId = `ev_${record.batchId}_${record.contentId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    this.qualifiedEvents.push({
      batchId: record.batchId,
      eventId,
      contentId: record.contentId,
      position: record.position,
      visiblePercentage: 100,
      qualifiedAt: new Date().toISOString(),
      dwellTimeMs: Math.min(Math.round(dwellTimeMs), 60000),
    });

    if (this.qualifiedEvents.length >= this.MAX_QUEUE_SIZE) {
      this.flushQueue();
    }
  }

  /**
   * Schedule automatic periodic queue flush
   */
  scheduleFlush() {
    if (this.flushTimeout || this.qualifiedEvents.length === 0) return;
    this.flushTimeout = setTimeout(() => {
      this.flushTimeout = null;
      this.flushQueue();
    }, this.FLUSH_INTERVAL_MS);
  }

  /**
   * Flush queued impressions to backend API
   */
  async flushQueue() {
    if (this.isFlushing || this.qualifiedEvents.length === 0) return;
    this.isFlushing = true;

    // Group events by batchId
    const eventsByBatch = new Map();
    const batchList = [...this.qualifiedEvents];
    this.qualifiedEvents = [];

    for (const ev of batchList) {
      if (!eventsByBatch.has(ev.batchId)) {
        eventsByBatch.set(ev.batchId, []);
      }
      eventsByBatch.get(ev.batchId).push(ev);
    }

    for (const [batchId, events] of eventsByBatch.entries()) {
      try {
        await feedService.recordImpressions({
          batchId,
          events,
        });
      } catch (err) {
        console.warn('[IMPRESSION FLUSH FAILED, RE-QUEUING]', err.message);
        // Re-queue for next retry
        this.qualifiedEvents.push(...events);
      }
    }

    this.isFlushing = false;
  }

  /**
   * Reset / clear on screen unmount or logout
   */
  cleanup() {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    this.flushQueue();
    this.activeTimers.clear();
  }
}

export const impressionTracker = new ImpressionTracker();
export default impressionTracker;
