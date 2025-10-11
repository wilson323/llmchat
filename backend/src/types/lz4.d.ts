/**
 * LZ4压缩库类型定义
 */

declare module 'lz4' {
  export function compress(input: Buffer): Buffer;
  export function decompress(input: Buffer): Buffer;
}