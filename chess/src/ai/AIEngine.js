

const ENGINE_DEBUG = false; 

class AIEngine {
  constructor() {
    const workerUrl = new URL("./stockfish.worker.js", import.meta.url);
    this.engine = new Worker(workerUrl); 
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

  setPosition(moves) {
    const moveStr = (moves || [])
      .map((m) => `${(m.from || "").toLowerCase()}${(m.to || "").toLowerCase()}`)
      .join(" ");
    this.send(`position startpos${moveStr ? " moves " + moveStr : ""}`);
  }

 
  getBestMove(callback, depth = 10) {
    
    const bestHandler = (msg) => {
      if (typeof msg === "string" && msg.startsWith("bestmove")) {
        const best = msg.split(/\s+/)[1];
        if (best) callback(best);
        this.listeners = this.listeners.filter((l) => l !== bestHandler);
      }
    };
    this.addMessageListener(bestHandler);

    const readyHandler = (msg) => {
      if (typeof msg === "string" && msg.trim() === "readyok") {
        this.listeners = this.listeners.filter((l) => l !== readyHandler);
        this.send(`go depth ${depth}`);
      }
    };
    this.addMessageListener(readyHandler);


    this.send("stop");
    this.send("isready");
  }

  newGame() {
 
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
