// Type declaration for node-fetch module
declare module 'node-fetch' {
  import { RequestInit as NodeRequestInit, Response as NodeResponse, Headers as NodeHeaders } from 'node-fetch';

  export interface RequestInit {
    method?: string;
    body?: string | Buffer | NodeJS.ReadableStream;
    headers?: Record<string, string> | NodeHeaders;
    timeout?: number;
    redirect?: 'follow' | 'manual' | 'error';
  }

  export interface Response {
    ok: boolean;
    status: number;
    statusText: string;
    headers: Headers;
    url: string;
    json(): Promise<any>;
    text(): Promise<string>;
    buffer(): Promise<Buffer>;
    blob(): Promise<Blob>;
  }

  export interface Headers {
    get(name: string): string | null;
    set(name: string, value: string): void;
    append(name: string, value: string): void;
    delete(name: string): void;
    has(name: string): boolean;
    forEach(callback: (value: string, name: string) => void): void;
  }

  export default function fetch(url: string, init?: RequestInit): Promise<Response>;
}
