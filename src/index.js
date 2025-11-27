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

    // --- ADDED: Full CRUD interface for variables ---

    // CREATE / UPDATE
    setVariable(key, value) {
        this.runtime.setVariable(key, value);
    }

    setGlobal(key, value) {
        this.runtime.setGlobal(key, value);
    }

    // READ
    /**
     * Gets the value of a local (per-playthrough) variable.
     * @param {string} key The name of the variable.
     * @returns {*} The variable's value or undefined.
     */
    getVariable(key) {
        return this.runtime.getVariable(key);
    }

    /**
     * Gets the value of a global (persistent) variable.
     * @param {string} key The name of the variable.
     * @returns {*} The variable's value or undefined.
     */
    getGlobal(key) {
        return this.runtime.getGlobal(key);
    }

    // DELETE
    /**
     * Deletes a local (per-playthrough) variable.
     * @param {string} key The name of the variable to delete.
     */
    deleteVariable(key) {
        this.runtime.deleteVariable(key);
    }

    /**
     * Deletes a global (persistent) variable.
     * @param {string} key The name of the variable to delete.
     */
    deleteGlobal(key) {
        this.runtime.deleteGlobal(key);
    }
}