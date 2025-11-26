import { VisualNovelRuntime } from './engine.js';
import { VNRenderer } from './renderer.js';

export default class HikarinVN {
    constructor(containerId, scriptData, options = {}) {
        this.runtime = new VisualNovelRuntime();
        this.renderer = new VNRenderer(containerId, this.runtime, options);
        
        const savedGlobals = options.globals || {};
        const savedVariables = options.variables || {}; // <--- Extract Variables
        
        // Pass both globals and variables to the runtime
        this.runtime.loadScript(scriptData, savedGlobals, savedVariables);
    }

    start() {
        this.runtime.start();
    }
}