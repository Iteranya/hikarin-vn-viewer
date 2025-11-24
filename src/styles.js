export const defaultStyles = `
  .hvn-stage * { box-sizing: border-box; user-select: none; }
  .hvn-stage {
      position: relative; width: 100%; height: 100%;
      background: #000; overflow: hidden; font-family: Consolas, monospace; color: white;
  }
  .hvn-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
  
  /* Sprites */
  .hvn-sprite {
      position: absolute; background-size: contain; background-repeat: no-repeat;
      background-position: center bottom; transition: opacity 0.2s;
  }

  /* Dialogue Box */
  .hvn-ui-layer { pointer-events: auto; display: flex; flex-direction: column; justify-content: flex-end; padding: 20px; }
  .hvn-dialogue-box {
      background: rgba(0, 0, 0, 0.85); border: 2px solid #555; border-radius: 4px;
      padding: 15px; min-height: 120px; display: none; margin-bottom: 10px;
  }
  .hvn-dialogue-box.active { display: block; }
  .hvn-char-name { color: #ff9999; font-weight: bold; font-size: 1.2em; margin-bottom: 8px; }
  .hvn-char-text { font-size: 1.1em; line-height: 1.4; color: #ddd; }

  /* Choices */
  .hvn-choice-layer {
      pointer-events: auto; display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 12px; background: rgba(0,0,0,0.7); display: none; z-index: 100;
  }
  .hvn-choice-layer.active { display: flex; }
  .hvn-choice-btn {
      background: #eee; color: #222; border: 2px solid #aaa; padding: 10px 40px;
      font-size: 18px; cursor: pointer; min-width: 300px; text-align: center;
      font-family: sans-serif; transition: 0.2s;
  }
  .hvn-choice-btn:hover { background: #ffcc00; border-color: #fff; transform: scale(1.02); }

  /* Debug Panel */
  .hvn-debug-panel {
      position: absolute; bottom: 0; left: 0; width: 100%; height: 150px;
      background: #222; border-top: 1px solid #444; display: flex; font-size: 12px; z-index: 999;
      transform: translateY(100%); transition: transform 0.3s;
  }
  .hvn-debug-panel.visible { transform: translateY(0); }
  .hvn-debug-col { flex: 1; padding: 10px; overflow-y: auto; border-right: 1px solid #333; }
  .hvn-d-title { color: #aaa; border-bottom: 1px solid #555; margin-bottom: 5px; display: block; }
  .hvn-var-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
`;