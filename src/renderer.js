export class VNRenderer {
    constructor(containerId, runtime, options = {}) {
        this.container = document.getElementById(containerId);
        if(!this.container) throw new Error(`HikarinVN: Container #${containerId} not found.`);
        
        this.runtime = runtime;
        this.assetsPath = options.assetsPath || "";
        this.debugMode = options.debug || false;

        this.styles = `
            /* RESET */
            .hvn-wrapper * { box-sizing: border-box; user-select: none; -webkit-user-select: none; }
            
            /* WRAPPER */
            .hvn-wrapper {
                width: 100%; height: 100%; display: flex; flex-direction: column;
                background: #111; font-family: 'Segoe UI', Consolas, sans-serif;
            }

            /* STAGE */
            .hvn-stage {
                position: relative; width: 100%; aspect-ratio: 16 / 9; 
                background: #000; overflow: hidden; color: white; flex-shrink: 0; 
            }

            .hvn-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
            
            /* UI Layer */
            .hvn-ui-layer { 
                z-index: 50; pointer-events: auto; display: flex; flex-direction: column; 
                justify-content: flex-end; padding: 20px;
            }

            /* Sprites */
            .hvn-sprite {
                position: absolute; background-size: contain; background-repeat: no-repeat;
                background-position: center bottom; transition: opacity 0.2s; z-index: 10;
            }
            
            /* ERROR STATE FOR MISSING IMAGES */
            .hvn-missing-asset {
                border: 2px solid red !important;
                background-color: rgba(255, 0, 0, 0.2);
            }
            .hvn-missing-asset::after {
                content: 'MISSING'; position: absolute; top: 50%; left: 50%;
                transform: translate(-50%, -50%); color: red; font-weight: bold; background: black;
            }

            /* Dialogue Box */
            .hvn-dialogue-box {
                background: rgba(0, 0, 0, 0.85); border: 2px solid #555; border-radius: 4px;
                padding: 20px; min-height: 140px; display: none; margin-bottom: 0px; 
                pointer-events: auto; box-shadow: 0 4px 10px rgba(0,0,0,0.5);
            }
            .hvn-dialogue-box.active { display: block !important; }
            
            .hvn-char-name { color: #ff9999; font-weight: bold; font-size: 1.4em; margin-bottom: 10px; }
            .hvn-char-text { font-size: 1.2em; line-height: 1.5; color: #eee; }

            /* Choices */
            .hvn-choice-layer {
                z-index: 100; pointer-events: auto; display: flex; flex-direction: column; 
                align-items: center; justify-content: center; gap: 15px; background: rgba(0,0,0,0.8); 
                display: none;
            }
            .hvn-choice-layer.active { display: flex !important; }
            
            .hvn-choice-btn {
                background: #eee; color: #222; border: 2px solid #aaa; padding: 12px 50px;
                font-size: 18px; cursor: pointer; min-width: 300px; text-align: center;
                transition: 0.2s; border-radius: 4px; font-weight: bold;
            }
            .hvn-choice-btn:hover { background: #ffcc00; border-color: #fff; transform: scale(1.05); }

            /* DEBUG PANEL */
            .hvn-debug-panel {
                width: 100%; height: 150px; background: #222; border-top: 1px solid #444;
                display: flex; font-size: 12px; color: #fff; overflow: hidden; flex-shrink: 0; 
            }
            
            .hvn-debug-col { flex: 1; padding: 10px; overflow-y: auto; border-right: 1px solid #333; }
            .hvn-d-title { display:block; border-bottom:1px solid #555; margin-bottom:5px; color:#aaa; font-weight:bold;}
            .hvn-var-row { display: flex; justify-content: space-between; border-bottom: 1px solid #333; padding: 2px 0; }
        `;

        this._injectStyles();
        this._buildDOM();
        this._bindEvents();
    }

    // --- NEW: Image Verification Helper ---
    _verifyImageLoad(url, contextMsg, targetElement) {
        // Create a ghost image to test if the browser can load it
        const img = new Image();
        img.src = url;
        
        img.onerror = () => {
            const errorMsg = `[HikarinVN Error] Failed to load image: "${url}"`;
            const context = `Context: ${contextMsg}`;
            
            // 1. Log to Console
            console.group(errorMsg);
            console.error(context);
            console.warn("Check if the file exists in your assets folder and the path is correct.");
            console.groupEnd();

            // 2. If Debug Mode, visually mark the element on screen
            if(this.debugMode && targetElement) {
                targetElement.classList.add('hvn-missing-asset');
                targetElement.title = `MISSING: ${url}`;
            }
        };

        img.onload = () => {
            // Success: Remove error styling if it was applied previously (in case of re-use)
            if(targetElement) targetElement.classList.remove('hvn-missing-asset');
        };
    }

    _injectStyles() {
        if(!document.getElementById('hvn-embedded-styles')) {
            const style = document.createElement('style');
            style.id = 'hvn-embedded-styles';
            style.innerHTML = this.styles;
            document.head.appendChild(style);
        }
    }

    _buildDOM() {
        this.container.innerHTML = `
            <div class="hvn-wrapper">
                <div class="hvn-stage">
                    <div class="hvn-layer hvn-bg-layer" style="z-index: 1;"></div>
                    <div class="hvn-layer hvn-sprite-layer" style="z-index: 10;"></div>
                    
                    <div class="hvn-layer hvn-ui-layer">
                        <div class="hvn-dialogue-box">
                            <div class="hvn-char-name"></div>
                            <div class="hvn-char-text"></div>
                        </div>
                    </div>

                    <div class="hvn-layer hvn-choice-layer"></div>
                </div>
                
                ${this.debugMode ? `
                <div class="hvn-debug-panel">
                    <div class="hvn-debug-col"><span class="hvn-d-title">GLOBALS</span><div class="d-glob"></div></div>
                    <div class="hvn-debug-col"><span class="hvn-d-title">LOCALS</span><div class="d-loc"></div></div>
                    <div class="hvn-debug-col"><span class="hvn-d-title">STATUS</span><div class="d-stat">IDLE</div></div>
                </div>` : ''}
            </div>
        `;

        this.elBg = this.container.querySelector('.hvn-bg-layer');
        this.elSprites = this.container.querySelector('.hvn-sprite-layer');
        this.elDBox = this.container.querySelector('.hvn-dialogue-box');
        this.elDName = this.container.querySelector('.hvn-char-name');
        this.elDText = this.container.querySelector('.hvn-char-text');
        this.elChoices = this.container.querySelector('.hvn-choice-layer');
        
        if(this.debugMode) {
            this.elDGlobal = this.container.querySelector('.d-glob');
            this.elDLocal = this.container.querySelector('.d-loc');
            this.elDStatus = this.container.querySelector('.d-stat');
        }
    }

    _bindEvents() {
        this.container.querySelector('.hvn-stage').addEventListener('click', (e) => {
            if(e.target.closest('.hvn-choice-layer')) return;
            if(this.runtime.state === this.runtime.STATES.WAITING) {
                this.runtime.advance();
            }
        });

        this.runtime.events.onSay = (char, text) => {
            this.elChoices.classList.remove('active');
            this.elDBox.classList.add('active');
            this.elDName.innerText = char || "???";
            this.elDText.innerText = text || "";
        };

        this.runtime.events.onChoice = (choices) => {
            this.elDBox.classList.remove('active');
            this.elChoices.innerHTML = '';
            this.elChoices.classList.add('active');
            choices.forEach(c => {
                const btn = document.createElement('div');
                btn.className = 'hvn-choice-btn';
                btn.innerText = c.display;
                btn.onclick = (e) => {
                    e.stopPropagation();
                    this.elChoices.classList.remove('active');
                    this.runtime.selectChoice(c.label);
                };
                this.elChoices.appendChild(btn);
            });
        };

        this.runtime.events.onShowSprite = (data) => {
            const id = `sprite-${data.sprite}`;
            let el = this.container.querySelector(`#${id}`);
            if(el) el.remove();

            el = document.createElement('div');
            el.id = id;
            el.className = 'hvn-sprite';
            
            // Positioning Logic
            const leftPct = ((data.column - 1) / data.wRatio) * 100;
            const topPct = ((data.row - 1) / data.hRatio) * 100;
            const widthPct = (data.wFrameRatio / data.wRatio) * 100;
            const heightPct = (data.hFrameRatio / data.hRatio) * 100;
            
            el.style.left = `${leftPct}%`;
            el.style.top = `${topPct}%`;
            el.style.width = `${widthPct}%`;
            el.style.height = `${heightPct}%`;

            const imgUrl = this.assetsPath + data.finalLocation;
            
            // --- UPDATED: Verify Image ---
            this._verifyImageLoad(imgUrl, `Sprite [${data.sprite}]`, el);

            el.style.backgroundImage = `url('${imgUrl}')`;
            
            if(this.debugMode) {
                // If we are debugging, keep the debug border, 
                // but the _verifyImageLoad will override it with RED if broken.
                if(!el.classList.contains('hvn-missing-asset')) {
                    el.style.border = '1px dashed #0ff';
                }
                el.innerText = `${data.sprite}`;
                el.style.display = 'flex'; el.style.alignItems='center'; el.style.justifyContent='center';
                el.style.textShadow = '0 0 4px #000';
                el.title = data.finalLocation;
            }

            this.elSprites.appendChild(el);
        };

       this.runtime.events.onRemoveSprite = (id) => {
            // OLD, PROBLEMATIC WAY:
            // const el = this.container.querySelector(`#sprite-${id}`);

            // NEW, CORRECT WAY using an attribute selector:
            const el = this.container.querySelector(`[id="sprite-${id}"]`); // This treats the ID as a literal string

            if (el) {
                el.remove();
            } else {
                // This should no longer be triggered
                console.warn(`Attempted to remove sprite but could not find element with ID: sprite-${id}`);
            }
        };

        this.runtime.events.onBackground = (path) => {
            const imgUrl = this.assetsPath + path;
            
            // --- UPDATED: Verify Image ---
            this._verifyImageLoad(imgUrl, "Background Layer", this.elBg);

            this.elBg.style.background = `url('${imgUrl}') center/cover no-repeat`;
        };

        this.runtime.events.onFinish = () => {
            this.elDBox.classList.add('active');
            this.elDName.innerText = "SYSTEM";
            this.elDText.innerText = "End of Script.";
        };

        if(this.debugMode) {
            this.runtime.events.onUpdateDebug = (g, v, s) => {
                this.elDStatus.innerText = s;
                const render = (obj, target) => {
                    target.innerHTML = Object.entries(obj).map(([k, val]) => 
                        `<div class="hvn-var-row"><span style="color:#66d9ef">${k}</span><span style="color:${typeof val==='boolean'?(val?'#0f0':'#f00'):'#a6e22e'}">${val}</span></div>`
                    ).join('');
                };
                render(g, this.elDGlobal);
                render(v, this.elDLocal);
            };
        }
    }
}