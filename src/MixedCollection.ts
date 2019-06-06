export class MixedCollection<K, V = unknown> {
    private items: Map<K, V>;

    constructor(entries?: ReadonlyArray<[K, V]> | null) {
        this.items = new Map<K, V>(entries);
    }

    add(key: K, value: V) {
        this.items.set(key, value);
    }

    get<T extends V>(key: K) {
        if (!this.items.has(key)) {
            throw new Error(`Unknown key "${key}"`);
        }
        // TODO: T | undefined
        return this.items.get(key) as T;
    }

    has(key: K) {
        return this.items.has(key);
    }

    entries() {
        return this.items.entries();
    }

    values() {
        return this.items.values();
    }

    merge(m: this) {
        for (let [k, v] of m.entries()) {
            this.add(k, v);
        }
        return this;
    }
}
