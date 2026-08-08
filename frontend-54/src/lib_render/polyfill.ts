// src/lib_render/polyfill.ts
import { TextDecoder, TextEncoder } from 'text-encoding-polyfill';

// Overwrite Hermes native TextDecoder before any external C/asm.js modules load
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;