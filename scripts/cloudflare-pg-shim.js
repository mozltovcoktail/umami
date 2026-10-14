export class CloudflareSocket {
  constructor(...args) {
    const Socket = globalThis.__UMAMI_PG_CLOUDFLARE_SOCKET;
    if (!Socket) {
      throw new Error('CloudflareSocket was not initialized by the Worker entrypoint.');
    }
    return new Socket(...args);
  }
}
