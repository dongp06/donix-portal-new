/* tslint:disable */
/* eslint-disable */

export class SignalDevice {
    free(): void;
    [Symbol.dispose](): void;
    bundle_json(): string;
    decrypt_json(remote_name: string, remote_device_id: number, message_json: string): Promise<Uint8Array>;
    encrypt_json(remote_name: string, remote_device_id: number, plaintext: Uint8Array): Promise<string>;
    static from_snapshot(snapshot_json: string): SignalDevice;
    constructor(user_name: string, device_id: number, pre_key_count: number);
    /**
     * Return every currently available one-time pre-key as public material.
     * The private pre-key records stay inside the local serialized snapshot;
     * this method is intentionally separate from `bundle_json`, because a
     * Signal pre-key bundle carries at most one one-time pre-key per fetch.
     */
    prekey_pool_json(): string;
    process_bundle_json(remote_name: string, remote_device_id: number, bundle_json: string): Promise<void>;
    safety_number_json(remote_name: string, remote_device_id: number): string;
    snapshot_json(): string;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_signaldevice_free: (a: number, b: number) => void;
    readonly signaldevice_bundle_json: (a: number) => [number, number, number, number];
    readonly signaldevice_decrypt_json: (a: number, b: number, c: number, d: number, e: number, f: number) => any;
    readonly signaldevice_encrypt_json: (a: number, b: number, c: number, d: number, e: number, f: number) => any;
    readonly signaldevice_from_snapshot: (a: number, b: number) => [number, number, number];
    readonly signaldevice_generate: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly signaldevice_prekey_pool_json: (a: number) => [number, number, number, number];
    readonly signaldevice_process_bundle_json: (a: number, b: number, c: number, d: number, e: number, f: number) => any;
    readonly signaldevice_safety_number_json: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly signaldevice_snapshot_json: (a: number) => [number, number, number, number];
    readonly wasm_bindgen__convert__closures_____invoke__h2a6fa2616be69765: (a: number, b: number, c: any) => [number, number];
    readonly wasm_bindgen__convert__closures_____invoke__h61925731e5262c66: (a: number, b: number, c: any, d: any) => void;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_destroy_closure: (a: number, b: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
