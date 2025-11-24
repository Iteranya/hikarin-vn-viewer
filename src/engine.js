export class VisualNovelRuntime {
    constructor() {
        this.script = [];
        this.currentIndex = 0;
        this.STATES = { IDLE: "IDLE", PLAYING: "PLAYING", WAITING: "WAITING", CHOICE: "CHOICE", ENDED: "ENDED" };
        this.state = this.STATES.IDLE;
        this.variables = {}; 
        this.globals = {};
        // Preserved this even though it wasn't used in the logic yet, 
        // in case you want to extend it later.
        this.environment = { isNight: false, isDay: true };
        
        // Hooks
        this.events = {
            onSay: null, onChoice: null, onShowSprite: null, onRemoveSprite: null,
            onBackground: null, onAutoSave: null, onSceneNext: null, onFinish: null,
            onUpdateDebug: null
        };
    }

    // --- LOGGER (Restored) ---
    _log(category, msg, ...args) {
        const styles = {
            STEP: "color: #00ffff; font-weight: bold;",   // Cyan
            FLOW: "color: #adff2f;",                      // GreenYellow
            VAR:  "color: #ffa500;",                      // Orange
            COND: "color: #da70d6;",                      // Orchid
            ERR:  "color: #ff4444; font-weight: bold; background: #220000"
        };
        // We check if console exists just to be safe in weird environments
        if(console && console.log) {
            console.log(`%c[${category}] ${msg}`, styles[category] || "", ...args);
        }
    }

    loadScript(jsonSource, savedGlobals = {}) {
        this.script = JSON.parse(JSON.stringify(jsonSource));
        this.globals = { ...savedGlobals };
        this.variables = {}; 
        this.currentIndex = 0; 
        this.state = this.STATES.IDLE;
        this._log("FLOW", "Script Loaded. Total Steps: " + this.script.length);
        this._updateDebug();
    }

    start() { 
        if(this.script.length === 0) return;
        this.state = this.STATES.PLAYING;
        this._step();
    }

    advance() {
        if (this.state === this.STATES.WAITING) {
            this.state = this.STATES.PLAYING;
            this.currentIndex++;
            this._step();
        }
    }

    selectChoice(labelToJumpTo) {
        if (this.state !== this.STATES.CHOICE) return;
        this._log("FLOW", `Player selected choice -> Jumping to '${labelToJumpTo}'`);
        this._jump(labelToJumpTo);
    }

    // --- CORE ENGINE ---

    _step() {
        if (this.currentIndex >= this.script.length) { this._finish(); return; }
        
        const step = this.script[this.currentIndex];
        
        // Auto-advance helper
        const proceed = () => { 
            this.currentIndex++; 
            setTimeout(() => this._step(), 0); 
        };

        this._log("STEP", `[ID:${step.id}] TYPE: ${step.type}`);

        switch (step.type) {
            // --- LOGIC GATES ---
            case "conditional":
            case "conditional_global":
                const passed = this._checkCondition(step);
                
                if (passed) {
                    this._log("COND", `Condition PASSED. Continuing flow.`);
                    proceed();
                } else {
                    if (step.end !== undefined) {
                        this._log("COND", `Condition FAILED. Skipping to ID: ${step.end}`);
                        this._jumpToId(step.end);
                    } else {
                        this._log("ERR", `Condition Failed but no 'end' ID provided!`);
                        proceed();
                    }
                }
                break;

            // --- FLOW CONTROL ---
            case "label":
            case "start": 
            case "meta":
            case "command":
                if(step.type === "meta") this._processMeta(step);
                proceed();
                break;
            
            case "transition": 
                this._jump(step.label);
                break;
            
            case "next": 
                if(this.events.onAutoSave) this.events.onAutoSave(step.label);
                proceed(); 
                break;

            // --- STANDARD ACTIONS ---
            case "dialogue":
                this.state = this.STATES.WAITING;
                // Parse strings here so the UI gets clean text
                if(this.events.onSay) this.events.onSay(this._parseString(step.label), this._parseString(step.content));
                this._updateDebug();
                break;

            case "choice":
                this.state = this.STATES.CHOICE;
                if(this.events.onChoice) this.events.onChoice(step.choice);
                this._updateDebug();
                break;

            case "show_sprite":
                // Handle dynamic locations (e.g. outfits)
                const finalLoc = this._parseString(step.dyn_location || step.location);
                if(this.events.onShowSprite) this.events.onShowSprite({ ...step, finalLocation: finalLoc });
                proceed();
                break;

            case "remove_sprite":
                if(this.events.onRemoveSprite) this.events.onRemoveSprite(step.sprite);
                proceed();
                break;

            case "modify_background":
                if(this.events.onBackground) this.events.onBackground(step.background);
                proceed();
                break;

            case "modify_variable":
                this._modVar(this.variables, step, "Local");
                proceed();
                break;

            case "modify_global":
                this._modVar(this.globals, step, "Global");
                proceed();
                break;

            case "finish_dialogue":
                this._finish();
                break;

            default:
                this._log("ERR", `Unknown Instruction: ${step.type}`);
                proceed();
                break;
        }
    }

    _jumpToId(targetId) {
        let targetIndex = -1;
        for(let i=0; i<this.script.length; i++) {
            if(this.script[i].id === targetId) {
                targetIndex = i;
                break;
            }
        }

        if(targetIndex !== -1) {
            this.currentIndex = targetIndex;
            this.state = this.STATES.PLAYING;
            setTimeout(() => this._step(), 0);
        } else {
            this._log("ERR", `CRITICAL: Could not find step with ID: ${targetId}`);
        }
    }

    _processMeta(step) {
        if(step.action === "create_var") {
            this.variables[step.var] = step.init;
        } else if(step.action === "create_global") {
            if(this.globals[step.var] === undefined) this.globals[step.var] = step.init;
        }
        this._updateDebug();
    }

    _jump(labelName) {
        let target = -1;
        for(let i=0; i<this.script.length; i++) {
            if(this.script[i].type === "label" && this.script[i].label === labelName) { 
                target = i; 
                break; 
            }
        }

        if (target !== -1) {
            this._log("FLOW", `Jump Successful. Moving Index ${this.currentIndex} -> ${target}`);
            this.currentIndex = target;
            this.state = this.STATES.PLAYING;
            setTimeout(() => this._step(), 0);
        } else {
            this._log("ERR", `CRITICAL: Label '${labelName}' not found!`);
        }
    }

    _modVar(scope, step, scopeName) {
        const key = step.var;
        const oldVal = scope[key];
        
        if(scope[key] === undefined) scope[key] = 0;

        if(step.action === "modify_var") {
            scope[key] = step.value;
        } 
        else if(step.action === "increment_var") {
            scope[key] += step.value;
        } 
        else if(step.action === "subtract_var") {
            scope[key] -= step.value;
        }
        
        this._log("VAR", `${scopeName} '${key}': ${oldVal} -> ${scope[key]}`);
        this._updateDebug();
    }

    _checkCondition(step) {
        const scope = (step.type === "conditional_global") ? this.globals : this.variables;
        const varName = step.var;
        const val = scope[varName] !== undefined ? scope[varName] : 0;
        const target = step.value;
        
        let result = false;

        if(step.condition === "equal") result = (val === target);
        if(step.condition === "not_equal") result = (val !== target);
        if(step.condition === "greater_than") result = (val > target);
        if(step.condition === "less_than") result = (val < target);

        this._log("COND", `Check '${varName}' (${val}) ${step.condition} '${target}'? Result: ${result}`);
        return result;
    }

    _parseString(str) {
        if (!str) return "";
        return str.replace(/<(.+?)>/g, (_, key) => {
            if (this.globals[key] !== undefined) return this.globals[key];
            if (this.variables[key] !== undefined) return this.variables[key];
            return `<${key}>`; 
        });
    }

    _finish() {
        this.state = this.STATES.ENDED;
        this._log("FLOW", "Script Finished");
        if(this.events.onFinish) this.events.onFinish();
        this._updateDebug();
    }
    
    _updateDebug() {
        if(this.events.onUpdateDebug) this.events.onUpdateDebug(this.globals, this.variables, this.state);
    }
}