import React, { Component } from "react";
import Board from "../Board.jsx";
import styles from "../../build/Chess.module.css";
import AIEngine from "../../ai/AIEngine";

const DEFAULT_TIME = 300; // 5 minutes (seconds)

// helpers for converting formats
const toUci = (sq) => (sq || "").toLowerCase(); // not used right now, but useful for UCI strings
const toBoard = (uci) => ({
  from: (uci || "").slice(0, 2).toUpperCase(),
  to: (uci || "").slice(2, 4).toUpperCase(),
});

export default class AIChess extends Component {
  state = {
    gameId: Date.now(),        // change this to force Board to reset
    timeLimit: DEFAULT_TIME,
    whiteTime: DEFAULT_TIME,
    blackTime: DEFAULT_TIME,
    winner: null,
    turn: "white",

    enableUndo: true,
    history: [],              // list of moves (used by Board + AI)
    step: 0,                  // current step for undo/rewind
    aiColor: "black",         // what color the AI is playing
  };

  componentDidMount() {
    this.engine = new AIEngine();

    // listen for engine output and catch "bestmove ..."
    this.unsub = this.engine.addMessageListener((line) => {
      if (typeof line === "string" && line.startsWith("bestmove")) {
        const uci = line.split(/\s+/)[1];
        if (uci?.length >= 4) this.makeAIMove(uci);
      }
    });

    this.startTimer();
    this.engine.newGame();

    // if AI starts as white, make the first move
    if (this.state.aiColor === "white" && this.state.turn === "white") {
      this.triggerAIMove();
    }
  }

  componentWillUnmount() {
    clearInterval(this.timer);
    this.unsub?.();              // stop engine listener
    this.engine?.terminate();    // shut down worker/process
  }

  // ----------------- clocks -----------------
  startTimer = () => {
    clearInterval(this.timer);
    if (this.state.winner) return;

    this.timer = setInterval(() => {
      const key = this.state.turn === "white" ? "whiteTime" : "blackTime";

      this.setState((prev) => {
        const t = Math.max(prev[key] - 1, 0);

        // time ran out -> other side wins
        if (t === 0 && !prev.winner) {
          clearInterval(this.timer);
          return { [key]: 0, winner: prev.turn === "white" ? "black" : "white" };
        }

        return { [key]: t };
      });
    }, 1000);
  };

  handleGameEnd = (winner) => {
    this.setState({ winner }, () => clearInterval(this.timer));
  };

  handleTurnChange = (nextTurn) => {
    // Board tells us whose turn it is after each move
    this.setState({ turn: nextTurn }, () => {
      if (nextTurn === this.state.aiColor) this.triggerAIMove();
    });
  };

  // Board calls this whenever any move is made
  handleMoveMade = (move) => {
    this.setState(
      (prev) => ({
        history: [...prev.history, move],
        step: prev.history.length + 1,
      }),
      () => {
        // if the human moved, ask the AI to respond
        if (move.team !== this.state.aiColor) {
          this.triggerAIMove();
        }
      }
    );
  };

  // ----------------- AI -----------------
  triggerAIMove = () => {
    // give engine the current game moves
    this.engine.setPosition(this.state.history);

    // ask engine for best move at fixed difficulty 10
    this.engine.getBestMove((uci) => {
      if (uci) this.makeAIMove(uci);
    }, 10);
  };

  makeAIMove = (uci) => {
    const { from, to } = toBoard(uci);
    // Board has a helper for applying opponent/AI moves
    this.boardRef?.makeOpponentMove({ from, to });
  };

  // ----------------- new game / settings -----------------
  startNewGame = () => {
    clearInterval(this.timer);

    // reset game state
    this.setState(
      {
        gameId: Date.now(),
        whiteTime: this.state.timeLimit,
        blackTime: this.state.timeLimit,
        winner: null,
        turn: "white",
        history: [],
        step: 0,
      },
      () => {
        this.startTimer();
        this.engine.newGame();

        // AI goes first if it is white
        if (this.state.aiColor === "white") this.triggerAIMove();
      }
    );
  };

  handleTimeLimitChange = (e) => {
    // dropdown is in minutes, store in seconds
    const seconds = parseInt(e.target.value, 10) * 60;
    this.setState({ timeLimit: seconds, whiteTime: seconds, blackTime: seconds });
  };

  toggleAIColor = () => {
    // flip which side the AI plays
    this.setState(
      (p) => ({ aiColor: p.aiColor === "black" ? "white" : "black" }),
      () => {
        // if it becomes AI's turn after switching, let it move
        if (this.state.turn === this.state.aiColor) this.triggerAIMove();
      }
    );
  };

  formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  render() {
    const { gameId, whiteTime, blackTime, winner, turn, timeLimit, history, step, aiColor } = this.state;

    return (
      <div className={styles.chessGame}>
        <div className={styles.controls}>
          <h2>Chess vs AI</h2>

          <div className={styles.config}>
            <label>Time Limit (minutes): </label>
            <select
              value={timeLimit / 60}
              onChange={this.handleTimeLimitChange}
              disabled={winner !== null}
            >
              {[1, 3, 5, 10, 15].map((m) => (
                <option key={m} value={m}>{m} min</option>
              ))}
            </select>

            <button className={styles.button} onClick={this.startNewGame}>
              New Game
            </button>

            <button className={styles.button} onClick={this.toggleAIColor}>
              Switch AI Color (AI: {aiColor})
            </button>
          </div>

          <div className={styles.timers}>
            <div className={turn === "white" ? styles.active : ""}>
              ⬜ White: {this.formatTime(whiteTime)}
            </div>
            <div className={turn === "black" ? styles.active : ""}>
              ⬛ Black: {this.formatTime(blackTime)}
            </div>
          </div>

          {winner && <div className={styles.winner}>🏆 {winner.toUpperCase()} wins!</div>}
        </div>

        <Board
          ref={(r) => (this.boardRef = r)}
          key={gameId}
          gameMode="single"
          timeLimit={timeLimit}
          onGameEnd={this.handleGameEnd}
          onTurnChange={this.handleTurnChange}
          onMoveMade={this.handleMoveMade}
          history={history}
          step={step}
          enableUndo={true}
          onStepChange={(s) => this.setState({ step: s })}
          isMultiplayer={false}
          // human always plays the opposite color
          playerColor={aiColor === "white" ? "black" : "white"}
        />
      </div>
    );
  }
}
