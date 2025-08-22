// src/ai/AIEngine.js
// Classic Web Worker controller for Stockfish loaded via src/ai/stockfish.worker.js
// No npm imports; engine binary is served from public/engines/stockfish.js.

const ENGINE_DEBUG = false; // set true to see all engine lines in console

class AIEngine {
  constructor() {
    const workerUrl = new URL("./stockfish.worker.js", import.meta.url);
    this.engine = new Worker(workerUrl); // classic worker
    this.listeners = [];
    this.ready = false;
    this.queue = [];

    const onLine = (e) => {
      const line = typeof e === "string" ? e : e?.data;
      if (typeof line !== "string") return;

      if (ENGINE_DEBUG) console.log("[SF]", line);

      if (line.trim() === "readyok") {
        this.ready = true;
        while (this.queue.length) this.engine.postMessage(this.queue.shift());
      }
      this.listeners.forEach((fn) => fn(line));
    };

    this.engine.onmessage = onLine;

    // Boot UCI
    this.engine.postMessage("uci");
    this.engine.postMessage("isready");
  }

  send(cmd) {
    if (!cmd) return;
    if (this.ready) this.engine.postMessage(cmd);
    else this.queue.push(cmd);
  }

  addMessageListener(fn) {
    this.listeners.push(fn);
    return () => (this.listeners = this.listeners.filter((f) => f !== fn));
  }

  /** Set the position from a list of {from,to} objects (upper/lower doesn’t matter). */
  setPosition(moves) {
    const moveStr = (moves || [])
      .map((m) => `${(m.from || "").toLowerCase()}${(m.to || "").toLowerCase()}`)
      .join(" ");
    this.send(`position startpos${moveStr ? " moves " + moveStr : ""}`);
  }

  /**
   * Robust search: ensure engine is idle and ready, *then* issue go depth N.
   * Calls `callback(bestMoveUci)` when a bestmove arrives.
   */
  getBestMove(callback, depth = 10) {
    // One-shot bestmove listener
    const bestHandler = (msg) => {
      if (typeof msg === "string" && msg.startsWith("bestmove")) {
        const best = msg.split(/\s+/)[1];
        if (best) callback(best);
        this.listeners = this.listeners.filter((l) => l !== bestHandler);
      }
    };
    this.addMessageListener(bestHandler);

    // Ask engine to confirm readiness, then start search
    const readyHandler = (msg) => {
      if (typeof msg === "string" && msg.trim() === "readyok") {
        this.listeners = this.listeners.filter((l) => l !== readyHandler);
        this.send(`go depth ${depth}`);
      }
    };
    this.addMessageListener(readyHandler);

    // Make sure any previous search is stopped and get fresh readiness
    this.send("stop");
    this.send("isready");
  }

  newGame() {
    // Optional: clear queue and re-sync
    this.ready = false;
    this.queue = [];
    this.engine.postMessage("ucinewgame");
    this.engine.postMessage("isready");
  }

  terminate() {
    try {
      this.engine.terminate();
    } catch {}
  }
}

export default AIEngine;
