export class VisualNovelRuntime {
    constructor() {
        this.script = [];
        this.currentIndex = 0;
        this.STATES = { IDLE: "IDLE", PLAYING: "PLAYING", WAITING: "WAITING", CHOICE: "CHOICE", ENDED: "ENDED" };
        this.state = this.STATES.IDLE;
        this.variables = {}; 
        this.globals = {};
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

    loadScript(jsonSource, savedGlobals = {}, savedVariables = {}) {
        this.script = JSON.parse(JSON.stringify(jsonSource));
        
        // Restore Globals
        this.globals = { ...savedGlobals };
        
        // CHANGED: Restore Locals instead of wiping them
        this.variables = { ...savedVariables }; 
        
        this.currentIndex = 0; 
        this.state = this.STATES.IDLE;
        this._log("FLOW", "Script Loaded. Total Steps: " + this.script.length);
        this._updateDebug();
    }

    start(startLabel = null) { 
        if(this.script.length === 0) return;
        
        this.state = this.STATES.PLAYING;

        // 1. If no specific label is forced, check if we have an autosave variable
        if (!startLabel && this.variables['_autosave']) {
            const savedLabel = this.variables['_autosave'];
            this._log("FLOW", `Found '_autosave' variable. Resuming at label: '${savedLabel}'`);
            startLabel = savedLabel;
        }

        // 2. Execute Jump or Start from 0
        if (startLabel) {
            this._log("FLOW", `Starting execution at label: ${startLabel}`);
            this._jump(startLabel);
        } else {
            this.currentIndex = 0;
            this._step();
        }
        
        this._updateDebug();
    }

    stop() {
        this.state = this.STATES.IDLE;
        this._updateDebug();
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

    setEnvironment(key, value) {
        if (this.environment.hasOwnProperty(key)) {
            this._log("FLOW", `Environment updated: ${key} set to ${value}`);
            this.environment[key] = value;
            this._updateDebug(); // So the debug view can see the change
        } else {
            this._log("WARN", `Attempted to set unknown environment key: '${key}'`);
        }
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
                if(step.type === "meta") {
                    // Create var logic
                    if(step.action === "create_var") this.variables[step.var] = step.init;
                    if(step.action === "create_global" && this.globals[step.var] === undefined) this.globals[step.var] = step.init;
                    this._updateDebug();
                }
                proceed();
                break;
            
            case "transition": 
                this._jump(step.label);
                break;
            
            case "next": 
                this.variables['_autosave'] = step.label; // SAVE IT TO VARS
                if(this.events.onAutoSave) this.events.onAutoSave(step.label);
                this._updateDebug(); // Update UI so we see the variable change
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

           // Inside VisualNovelRuntime -> _step()

            case "show_sprite":
                let finalLoc = null;

                // 1. Try to handle dynamic location first
                if (step.dyn_location) {
                    const parsed = this._parseString(step.dyn_location);
                    
                    // CHECK: If the result still contains tags like <key>, 
                    // it means the variable was missing in your _parseString logic.
                    // We only use it if it looks like a clean path.
                    if (!/<.*?>/.test(parsed)) {
                        finalLoc = parsed;
                    } else {
                        this._log("WARN", `Dynamic sprite '${step.dyn_location}' failed to resolve vars. Falling back.`);
                    }
                }

                // 2. Fallback to standard location if dynamic failed or wasn't present
                if (!finalLoc) {
                    finalLoc = this._parseString(step.location);
                }

                if(this.events.onShowSprite) {
                    this.events.onShowSprite({ ...step, finalLocation: finalLoc });
                }
                
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

            case "unlock_dialogues":
                const dialoguesToUnlock = step.events || [];
                // Ensure the variable exists and is an array
                if (!Array.isArray(this.variables._unlocked_dialogues)) {
                    this.variables._unlocked_dialogues = [];
                }

                const newlyAdded = [];
                dialoguesToUnlock.forEach(label => {
                    // Add only if it's not already in the list to avoid duplicates
                    if (!this.variables._unlocked_dialogues.includes(label)) {
                        this.variables._unlocked_dialogues.push(label);
                        newlyAdded.push(label);
                    }
                });

                if (newlyAdded.length > 0) {
                     this._log("VAR", `Unlocked dialogues: ${newlyAdded.join(', ')}`);
                     this._updateDebug();
                }
                
                proceed();
                break;

            case "idle_chat":
                const availableChats = this.variables._unlocked_dialogues;
                if (Array.isArray(availableChats) && availableChats.length > 0) {
                    const randomIndex = Math.floor(Math.random() * availableChats.length);
                    const randomLabel = availableChats[randomIndex];
                    this._log("FLOW", `Performing idle chat. Randomly selected: '${randomLabel}'`);
                    this._jump(randomLabel);
                    // _jump handles the next step, so no proceed() here
                } else {
                    this._log("WARN", "Idle chat triggered, but '_unlocked_dialogues' is empty or not found. Skipping.");
                    proceed();
                }
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

    _modVar(scope, step) {
        const key = step.var;
        if(scope[key] === undefined) scope[key] = 0;

        if(step.action === "modify_var") scope[key] = step.value;
        else if(step.action === "increment_var") scope[key] += step.value;
        else if(step.action === "subtract_var") scope[key] -= step.value;
        
        this._updateDebug(); // Update UI
    }

    _checkCondition(step) {
        const varName = step.var;
        const target = step.value;
        let val; // The value we are checking

        // NEW LOGIC: Check the environment first!
        if (this.environment.hasOwnProperty(varName)) {
            this._log("COND", `Checking Environment property: '${varName}'`);
            val = this.environment[varName];
        } 
        // Then check globals if it's a global conditional
        else if (step.type === "conditional_global") {
            this._log("COND", `Checking Global variable: '${varName}'`);
            val = this.globals[varName] !== undefined ? this.globals[varName] : 0;
        } 
        // Fallback to local variables for a standard "conditional"
        else {
            this._log("COND", `Checking Local variable: '${varName}'`);
            val = this.variables[varName] !== undefined ? this.variables[varName] : 0;
        }

        let result = false;

        // The rest of the logic is the same
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
        if(this.events.onFinish) this.events.onFinish();
        this._updateDebug();
    }
    
    _updateDebug() {
        // This is the hook the Editor will use
        if(this.events.onUpdateDebug) {
            this.events.onUpdateDebug(this.globals, this.variables, this.state);
        }
    }

    
}