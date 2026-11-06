/**
 * Ambient type declaration for jsdom in tools.
 */
declare module 'jsdom' {
  export class JSDOM {
    constructor(html?: string | Buffer, options?: Record<string, unknown>);
    readonly window: any;
    serialize(): string;
  }
}
