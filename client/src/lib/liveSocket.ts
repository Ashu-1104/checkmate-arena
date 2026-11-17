// Drop-in replacement for the Socket.IO client used by the game page, built on HTTP so the
// API can run on serverless hosts such as Vercel: events arrive over Server-Sent Events and
// actions are sent as POST requests. Same on/emit/connect/disconnect shape as before.

// eslint-disable-next-line no-unused-vars
type Listener = (payload?: any) => void;

const newClientId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);

export class LiveSocket {
    private listeners = new Map<string, Set<Listener>>();
    private source?: EventSource;
    private code?: string;
    private retry?: ReturnType<typeof setTimeout>;
    private queue: Promise<unknown> = Promise.resolve();
    private apiUrl: string;
    readonly clientId = newClientId();

    constructor(apiUrl: string) {
        this.apiUrl = apiUrl;
    }

    on(event: string, listener: Listener) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
            this.source?.addEventListener(event, this.dispatch);
        }
        this.listeners.get(event)?.add(listener);
        return this;
    }

    removeAllListeners() {
        this.listeners.forEach((_, event) =>
            this.source?.removeEventListener(event, this.dispatch)
        );
        this.listeners.clear();
        return this;
    }

    // Sends an action. Actions go out one at a time, in order, like Socket.IO emits.
    emit(action: string, arg?: unknown) {
        const code = this.code;
        if (!code) return this;
        this.queue = this.queue
            .then(() =>
                fetch(`${this.apiUrl}/v1/live/${encodeURIComponent(code)}/${action}`, {
                    method: "POST",
                    credentials: "include",
                    keepalive: action === "leaveLobby",
                    headers: { "Content-Type": "application/json", "X-Client-Id": this.clientId },
                    body: JSON.stringify({ arg })
                })
            )
            .catch((err) => console.error(`${action} failed`, err));
        return this;
    }

    connect(code: string) {
        this.code = code;
        this.open();
        return this;
    }

    disconnect() {
        clearTimeout(this.retry);
        if (this.source) this.emit("leaveLobby");
        this.source?.close();
        this.source = undefined;
        return this;
    }

    private open() {
        if (!this.code) return;
        this.source?.close();
        const url = `${this.apiUrl}/v1/live/${encodeURIComponent(this.code)}/events?clientId=${this.clientId}`;
        const source = new EventSource(url, { withCredentials: true });
        this.source = source;
        this.listeners.forEach((_, event) => source.addEventListener(event, this.dispatch));
        // the stream ends every few minutes and the browser reopens it: "connect" fires each time,
        // so the game page re-joins and gets the latest game, as after a Socket.IO reconnect
        source.onopen = () => this.fire("connect");
        source.onerror = () => {
            if (source.readyState === EventSource.CLOSED && this.source === source) {
                this.retry = setTimeout(() => this.open(), 3000);
            }
        };
    }

    private dispatch = (e: Event) => {
        const { type, data } = e as MessageEvent<string>;
        this.fire(type, data === undefined ? undefined : JSON.parse(data));
    };

    private fire(event: string, payload?: unknown) {
        this.listeners.get(event)?.forEach((listener) => listener(payload));
    }
}
