/**
 * Simple synchronous publish/subscribe event bus.
 * Decouples components from each other — they communicate via named events
 * instead of direct method calls.
 *
 * Usage:
 *   EventBus.on('entries:changed', () => historyTable.render());
 *   EventBus.emit('entries:changed');
 */
class EventBusClass {
    constructor() {
        /** @type {Map<string, Function[]>} */
        this._listeners = new Map();
    }

    /**
     * Subscribe to an event.
     * @param {string} event
     * @param {Function} handler
     * @returns {Function} unsubscribe function
     */
    on(event, handler) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, []);
        }
        this._listeners.get(event).push(handler);

        // Return unsubscribe function
        return () => this.off(event, handler);
    }

    /**
     * Unsubscribe a specific handler from an event.
     * @param {string} event
     * @param {Function} handler
     */
    off(event, handler) {
        if (!this._listeners.has(event)) return;
        const handlers = this._listeners.get(event).filter(h => h !== handler);
        this._listeners.set(event, handlers);
    }

    /**
     * Emit an event, calling all subscribed handlers with optional payload.
     * @param {string} event
     * @param {*} [payload]
     */
    emit(event, payload) {
        if (!this._listeners.has(event)) return;
        this._listeners.get(event).forEach(handler => {
            try {
                handler(payload);
            } catch (err) {
                console.error(`EventBus: error in handler for "${event}"`, err);
            }
        });
    }

    /**
     * Subscribe to an event exactly once — unsubscribes after first call.
     * @param {string} event
     * @param {Function} handler
     */
    once(event, handler) {
        const wrapper = (payload) => {
            handler(payload);
            this.off(event, wrapper);
        };
        this.on(event, wrapper);
    }
}

export const EventBus = new EventBusClass();

/**
 * Named application events. Import and use these constants instead of
 * raw strings to avoid typos and make event names discoverable.
 */
export const Events = {
    JOBS_CHANGED:    'jobs:changed',
    ENTRIES_CHANGED: 'entries:changed',
    JOB_SELECTED:    'job:selected',
    ANALYTICS_SETTINGS_CHANGED: 'analytics:settings:changed',
    CHART_SETTINGS_CHANGED:     'chart:settings:changed',
};
