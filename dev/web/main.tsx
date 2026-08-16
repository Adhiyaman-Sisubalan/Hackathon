// Browser preview entry: install the stand-in bridge, then hand over to the real renderer.
import { installMockBridge } from './mock-bridge.js';

installMockBridge();
await import('../../src/renderer/index.js');
