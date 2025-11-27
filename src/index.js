import { VisualNovelRuntime } from './engine.js';
import { VNRenderer } from './renderer.js';

export default class HikarinVN {
    constructor(containerId, scriptData, options = {}) {
        this.runtime = new VisualNovelRuntime();
        this.renderer = new VNRenderer(containerId, this.runtime, options);
        
        const savedGlobals = options.globals || {};
        const savedVariables = options.variables || {};
        
        this.runtime.loadScript(scriptData, savedGlobals, savedVariables);
    }

    start() {
        this.runtime.start();
    }

    setEnvironment(key, value) {
        this.runtime.setEnvironment(key, value);
    }
}