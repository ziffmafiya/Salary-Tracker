class EventBusClass {
    private _listeners = new Map<string, Function[]>();

    on(event: string, handler: Function): () => void {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, []);
        }
        this._listeners.get(event)!.push(handler);

        return () => this.off(event, handler);
    }

    off(event: string, handler: Function): void {
        if (!this._listeners.has(event)) return;
        const handlers = this._listeners.get(event)!.filter(h => h !== handler);
        this._listeners.set(event, handlers);
    }

    emit(event: string, payload?: any): void {
        if (!this._listeners.has(event)) return;
        this._listeners.get(event)!.forEach(handler => {
            try {
                handler(payload);
            } catch (err) {
                console.error(`EventBus: error in handler for "${event}"`, err);
            }
        });
    }

    once(event: string, handler: Function): void {
        const wrapper = (payload?: any) => {
            handler(payload);
            this.off(event, wrapper);
        };
        this.on(event, wrapper);
    }
}

export const EventBus = new EventBusClass();

export const Events = {
    JOBS_CHANGED:    'jobs:changed',
    ENTRIES_CHANGED: 'entries:changed',
    JOB_SELECTED:    'job:selected',
    ANALYTICS_SETTINGS_CHANGED: 'analytics:settings:changed',
    CHART_SETTINGS_CHANGED:     'chart:settings:changed',
} as const;
