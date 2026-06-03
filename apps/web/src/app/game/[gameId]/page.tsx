"use client";

import { useState, useEffect, use } from "react";
import React from "react";
import { Chess, Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import Pusher from "pusher-js";
import { SessionProvider, useSession } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Piece =
  | "wP"
  | "wN"
  | "wB"
  | "wR"
  | "wQ"
  | "wK"
  | "bP"
  | "bN"
  | "bB"
  | "bR"
  | "bQ"
  | "bK";

type Player = {
  id: string;
  name: string | null;
  email: string | null;
  emailVerified?: number | null;
  image: string | null;
} | null;

type FullGameState = {
  game: {
    fen: string;
    whitePlayerId: string | null;
    blackPlayerId: string | null;
  };
  whitePlayer: Player;
  blackPlayer: Player;
};

type JoinResponse = {
  fullState: FullGameState;
  color: "white" | "black" | "spectator";
};

type GameOverPayload = {
  reason: string;
  winner: string;
};

type ChatMessagePayload = {
  id: string;
  userId: string;
  image: string | null;
  message: string;
  createdAt: number;
};

type ReactionPayload = {
  id: string;
  userId: string;
  reaction: "heart" | "clap" | "laugh" | "thumbs-up" | "thumbs-down";
  createdAt: number;
};

const REACTION_OPTIONS: Array<{ id: ReactionPayload["reaction"]; label: string }> = [
  { id: "heart", label: "♥" },
  { id: "clap", label: "👏" },
  { id: "laugh", label: "😂" },
  { id: "thumbs-up", label: "👍" },
  { id: "thumbs-down", label: "👎" },
];

function reactionLabel(reaction: ReactionPayload["reaction"]) {
  return REACTION_OPTIONS.find((option) => option.id === reaction)?.label ?? "";
}

function PlayerInfo({
  name,
  rating,
  capturedPieces,
  image,
  tone = "neutral",
}: {
  name: string;
  rating: string;
  capturedPieces: Piece[];
  image?: string | null;
  tone?: "neutral" | "active";
}) {
  const initials = (name || "Player").charAt(0).toUpperCase();

  return (
    <div className={"flex w-full items-center justify-between gap-4 rounded-lg border p-3 " + (tone === "active" ? "border-[#c89b3c]/45 bg-[#272722]" : "border-white/10 bg-black/20")}>
      <div className="flex min-w-0 items-center gap-3">
        {image ? (
          <div className="h-12 w-12 shrink-0 rounded-lg border border-white/10 bg-cover bg-center" style={{ backgroundImage: "url(" + image + ")" }} />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#4f7f55] text-lg font-extrabold text-white">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="truncate text-base font-extrabold text-[#f1eadc]">{name}</h3>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#b9ae9a]">{rating}</p>
        </div>
      </div>
      <CapturedPieces pieces={capturedPieces} />
    </div>
  );
}

function CapturedPieces({ pieces }: { pieces: Piece[] }) {
  if (pieces.length === 0) {
    return <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#7f735f]">No captures</span>;
  }

  return (
    <div className="flex max-w-[9rem] flex-wrap justify-end gap-1">
      {pieces.map((p, index) => (
        <div
          key={index}
          className="h-6 w-6 rounded bg-[#f8f1dd]/5"
          style={{
            backgroundImage: "url(/pieces/" + p + ".svg)",
            backgroundSize: "contain",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
          }}
        />
      ))}
    </div>
  );
}

function MoveHistory({ history }: { history: string[] }) {
  const movePairs: string[][] = [];
  for (let i = 0; i < history.length; i += 2) {
    movePairs.push(history.slice(i, i + 2));
  }
  return (
    <div className="scrollbar-soft mt-4 max-h-72 overflow-y-auto rounded-lg border border-white/10 bg-black/25 p-3 text-sm">
      {movePairs.length > 0 ? (
        <table className="w-full border-separate border-spacing-y-1">
          <tbody>
            {movePairs.map((pair, index) => (
              <tr key={index} className="rounded-xl bg-white/[0.035]">
                <td className="w-10 rounded-l-xl px-2 py-2 text-right font-mono text-[#b9ae9a]">{index + 1}.</td>
                <td className="px-3 py-2 font-extrabold text-[#f1eadc]">{pair[0]}</td>
                <td className="rounded-r-xl px-3 py-2 font-extrabold text-[#f1eadc]">{pair[1] || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="flex h-40 items-center justify-center text-center text-sm font-bold text-[#7f735f]">
          Moves will appear after the first turn.
        </div>
      )}
    </div>
  );
}

const createCustomPieces = () => {
  const pieces: {
    [key in Piece]?: ({
      squareWidth,
    }: {
      squareWidth: number;
    }) => React.ReactNode;
  } = {};
  const pieceList: Piece[] = [
    "wP",
    "wN",
    "wB",
    "wR",
    "wQ",
    "wK",
    "bP",
    "bN",
    "bB",
    "bR",
    "bQ",
    "bK",
  ];
  pieceList.forEach((p) => {
    pieces[p] = ({ squareWidth }) => (
      <div
        key={p}
        style={{
          width: squareWidth,
          height: squareWidth,
          backgroundImage: `url(/pieces/${p}.svg)`,
          backgroundSize: "100%",
        }}
      />
    );
  });
  return pieces;
};

const initialBoard: { [key: string]: number } = {
  p: 8,
  n: 2,
  b: 2,
  r: 2,
  q: 1,
};
function calculateCapturedPieces(fen: string): { w: Piece[]; b: Piece[] } {
  const currentPieces: { [key: string]: number } = {
    p: 0,
    n: 0,
    b: 0,
    r: 0,
    q: 0,
    k: 0,
    P: 0,
    N: 0,
    B: 0,
    R: 0,
    Q: 0,
    K: 0,
  };
  fen
    .split(" ")[0]
    .split("")
    .forEach((char) => {
      if (/[pnbrqkPNBRQK]/.test(char)) {
        currentPieces[char] = (currentPieces[char] || 0) + 1;
      }
    });
  const captured = { w: [] as Piece[], b: [] as Piece[] };
  for (const piece in initialBoard) {
    const whitePiece = piece.toUpperCase() as "P" | "N" | "B" | "R" | "Q";
    const capturedCount =
      initialBoard[piece] - (currentPieces[whitePiece] || 0);
    for (let i = 0; i < capturedCount; i++)
      captured.b.push(`w${whitePiece}` as Piece);
  }
  for (const piece in initialBoard) {
    const blackPiece = piece.toLowerCase() as "p" | "n" | "b" | "r" | "q";
    const capturedCount =
      initialBoard[piece] - (currentPieces[blackPiece] || 0);
    for (let i = 0; i < capturedCount; i++)
      captured.w.push(`b${blackPiece.toUpperCase()}` as Piece);
  }
  return captured;
}

function GamePage({ gameId }: { gameId: string }) {
  const { data: session } = useSession();

  const [game, setGame] = useState(new Chess());
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [playerColor, setPlayerColor] = useState<
    "white" | "black" | "spectator" | null
  >(null);
  const [gameStatus, setGameStatus] = useState("Connecting to server...");
  const [capturedPieces, setCapturedPieces] = useState<{
    w: Piece[];
    b: Piece[];
  }>({ w: [], b: [] });
  const [customPieces, setCustomPieces] = useState({});
  const [isGameOver, setIsGameOver] = useState(false);
  const [isDrawOffered, setIsDrawOffered] = useState(false);
  const [gameOverMessage, setGameOverMessage] = useState("");
  const [whitePlayer, setWhitePlayer] = useState<Player>(null);
  const [blackPlayer, setBlackPlayer] = useState<Player>(null);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoveSquares, setLegalMoveSquares] = useState<Square[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessagePayload[]>([]);
  const [chatText, setChatText] = useState("");
  const [reactions, setReactions] = useState<ReactionPayload[]>([]);
  const searchParams = useSearchParams();
  const gameType = searchParams.get("type") as "private" | "public" | null;
  const isPrivateGame = gameType === "private";

  async function postGameAction<T>(action: string, body: unknown) {
    const res = await fetch(`/api/games/${gameId}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.error || "Request failed");
    }
    return data as T;
  }

  function clearSelection() {
    setSelectedSquare(null);
    setLegalMoveSquares([]);
  }

  function applyFullGameState(data: FullGameState) {
    const newGame = new Chess(data.game.fen);
    setGame(newGame);
    setMoveHistory(newGame.history());
    setCapturedPieces(calculateCapturedPieces(data.game.fen));
    setWhitePlayer(data.whitePlayer);
    setBlackPlayer(data.blackPlayer);
    clearSelection();
  }

  async function handleResign() {
    if (playerColor && playerColor !== "spectator") {
      try {
        await postGameAction("resign", { color: playerColor });
      } catch (error) {
        console.error("Failed to resign", error);
      }
    }
  }

  async function handleDraw() {
    try {
      if (isDrawOffered) {
        await postGameAction("draw", { action: "accept" });
      } else {
        await postGameAction("draw", { action: "offer" });
        alert("Draw offer sent.");
      }
    } catch (error) {
      console.error("Failed to handle draw", error);
    }
  }

  useEffect(() => {
    if (session?.user?.id) {
      const userId = session.user.id;
      let pusherClient: Pusher | null = null;
      let channel: ReturnType<Pusher["subscribe"]> | null = null;
      let isCancelled = false;

      const connectToGame = async () => {
        setCustomPieces(createCustomPieces());

        const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
        const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
        if (!pusherKey || !pusherCluster) {
          setPlayerColor("spectator");
          setGameStatus("Pusher is not configured.");
          return;
        }

        try {
          const joinData = await postGameAction<JoinResponse>("join", {
            gameType: gameType || "public",
          });
          if (isCancelled) return;

          applyFullGameState(joinData.fullState);
          setPlayerColor(joinData.color);

          pusherClient = new Pusher(pusherKey, {
            cluster: pusherCluster,
            channelAuthorization: {
              endpoint: "/api/pusher/auth",
              transport: "ajax",
            },
          });

          channel = pusherClient.subscribe(`presence-game-${gameId}`);

          channel.bind("game-state-update", (data: FullGameState) => {
            applyFullGameState(data);
          });

          channel.bind("game-update", (data: { fen: string }) => {
            const newGame = new Chess(data.fen);
            setGame(newGame);
            setMoveHistory(newGame.history());
            setCapturedPieces(calculateCapturedPieces(data.fen));
            clearSelection();
          });

          channel.bind("draw-offered", (data: { fromUserId: string }) => {
            if (data.fromUserId !== userId) setIsDrawOffered(true);
          });

          channel.bind("game-over", (data: GameOverPayload) => {
            setIsGameOver(true);
            let message = "";
            if (data.reason === "draw") {
              message = "Game over: Draw agreed.";
            } else if (data.reason === "checkmate") {
              message = `Checkmate! ${data.winner.charAt(0).toUpperCase() + data.winner.slice(1)} wins.`;
            } else {
              message = `Game over: ${data.winner.charAt(0).toUpperCase() + data.winner.slice(1)} wins by resignation.`;
            }
            setGameOverMessage(message);
          });

          channel.bind("game-status", (data: { status: string }) => {
            setGameStatus(data.status);
          });

          channel.bind("chat-message", (data: ChatMessagePayload) => {
            setChatMessages((messages) => [...messages, data].slice(-80));
          });

          channel.bind("reaction", (data: ReactionPayload) => {
            setReactions((items) => [...items, data].slice(-8));
            window.setTimeout(() => {
              setReactions((items) => items.filter((item) => item.id !== data.id));
            }, 3500);
          });
        } catch (error) {
          if (isCancelled) return;
          setPlayerColor("spectator");
          setGameStatus(
            error instanceof Error ? error.message : "Failed to connect to game.",
          );
        }
      };

      connectToGame();

      return () => {
        isCancelled = true;
        channel?.unbind_all();
        pusherClient?.unsubscribe(`presence-game-${gameId}`);
        pusherClient?.disconnect();
      };
    }
  }, [gameId, session, gameType]);

  useEffect(() => {
    if (playerColor) {
      updateGameStatus();
    }
  }, [game, playerColor]);

  function updateGameStatus(currentGame = game) {
    if (currentGame.isCheckmate()) {
      const winner = currentGame.turn() === "w" ? "Black" : "White";
      const message = `Checkmate! ${winner} wins.`;
      setGameStatus(message);
      setGameOverMessage(message);
      setIsGameOver(true);
    } else if (currentGame.isDraw()) {
      setGameStatus("Draw!");
      setGameOverMessage("Game over: Draw.");
      setIsGameOver(true);
    } else if (currentGame.isCheck()) {
      setGameStatus(`Check! ${currentGame.turn() === "w" ? "White" : "Black"} to move.`);
      setGameOverMessage("");
      setIsGameOver(false);
    } else {
      setGameStatus(`${currentGame.turn() === "w" ? "White" : "Black"}'s turn`);
      setGameOverMessage("");
      setIsGameOver(false);
    }
  }

  function canMoveNow(currentGame = game) {
    return Boolean(
      playerColor &&
      playerColor !== "spectator" &&
      currentGame.turn() === playerColor[0] &&
      !isGameOver,
    );
  }

  function getLegalMoveSquares(square: Square, currentGame = game) {
    const piece = currentGame.get(square);
    if (!piece || !canMoveNow(currentGame) || piece.color !== playerColor?.[0]) {
      return [];
    }

    return currentGame.moves({ square, verbose: true }).map((move) => move.to as Square);
  }

  function selectSquare(square: Square) {
    const moves = getLegalMoveSquares(square);
    if (moves.length === 0) {
      clearSelection();
      return;
    }

    setSelectedSquare(square);
    setLegalMoveSquares(moves);
  }

  function makeMove(sourceSquare: Square, targetSquare: Square) {
    if (!canMoveNow()) return false;

    const gameCopy = new Chess(game.fen());
    try {
      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });

      if (!move) return false;

      setGame(gameCopy);
      setMoveHistory(gameCopy.history());
      setCapturedPieces(calculateCapturedPieces(gameCopy.fen()));
      clearSelection();
      updateGameStatus(gameCopy);
      void postGameAction("move", { fen: gameCopy.fen() }).catch((error) => {
        console.error("Failed to send move", error);
      });
      return true;
    } catch {
      return false;
    }
  }

  function onDrop(sourceSquare: Square, targetSquare: Square) {
    return makeMove(sourceSquare, targetSquare);
  }

  async function sendChatMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = chatText.trim();
    if (!message || !isPrivateGame) return;

    setChatText("");
    try {
      await postGameAction("chat", { message });
    } catch (error) {
      console.error("Failed to send chat message", error);
    }
  }

  async function sendReaction(reaction: ReactionPayload["reaction"]) {
    if (isPrivateGame) return;

    try {
      await postGameAction("reaction", { reaction });
    } catch (error) {
      console.error("Failed to send reaction", error);
    }
  }

  function onSquareClick(square: Square) {
    if (!canMoveNow()) {
      clearSelection();
      return;
    }

    if (selectedSquare) {
      if (selectedSquare === square) {
        clearSelection();
        return;
      }

      if (legalMoveSquares.includes(square)) {
        makeMove(selectedSquare, square);
        return;
      }
    }

    selectSquare(square);
  }

  const highlightedSquares = legalMoveSquares.reduce<Record<string, React.CSSProperties>>(
    (styles, square) => {
      styles[square] = {
        backgroundColor: "rgba(200, 155, 60, 0.34)",
        boxShadow: "inset 0 0 0 3px rgba(200, 155, 60, 0.38)",
      };
      return styles;
    },
    selectedSquare
      ? {
          [selectedSquare]: {
            boxShadow: "inset 0 0 0 4px rgba(241, 234, 220, 0.85)",
            backgroundColor: "rgba(200, 155, 60, 0.46)",
          },
        }
      : {},
  );

  const drawButtonClass =
    "ui-button flex-1 px-4 py-3 text-sm " +
    (isDrawOffered
      ? "bg-[#c89b3c] text-[#17130d]"
      : "bg-black/25 text-[#f1eadc] hover:bg-white/10");

  const opponentName =
    playerColor === "white"
      ? blackPlayer?.name || "Waiting for black"
      : whitePlayer?.name || "Waiting for white";
  const opponentImage = playerColor === "white" ? blackPlayer?.image : whitePlayer?.image;
  const myName = session?.user?.name || session?.user?.email || "You";

  return (
    <main className="app-shell min-h-screen px-3 py-5 text-[#f1eadc] sm:px-5 lg:px-8">
      <div className="relative z-10 mx-auto grid w-full max-w-7xl gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link href="/" className="text-xs font-bold uppercase tracking-[0.22em] text-[#c89b3c] hover:text-[#f1eadc]">
                Back to hub
              </Link>
              <h1 className="mt-2 text-2xl font-bold text-[#f1eadc] sm:text-4xl">Game</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-black/25 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.16em] text-[#c89b3c]">
                {gameStatus}
              </span>
              <span className="rounded-full border border-white/10 bg-black/25 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.16em] text-[#b9ae9a]">
                {playerColor || "Spectator"}
              </span>
            </div>
          </div>

          <PlayerInfo
            name={opponentName}
            rating="Opponent"
            capturedPieces={playerColor === "white" ? capturedPieces.w : capturedPieces.b}
            image={opponentImage}
          />

          <div className="board-frame w-full overflow-hidden">
            <Chessboard
              id="PlayVsPlay"
              position={game.fen()}
              onPieceDrop={onDrop}
              onSquareClick={onSquareClick}
              customSquareStyles={highlightedSquares}
              boardOrientation={playerColor === "black" ? "black" : "white"}
              arePiecesDraggable={!isGameOver && playerColor !== "spectator"}
              customDarkSquareStyle={{ backgroundColor: "#8d6748" }}
              customLightSquareStyle={{ backgroundColor: "#e5d1a7" }}
              customPieces={customPieces}
            />
          </div>

          {game.isCheck() && !game.isCheckmate() && (
            <div className="rounded-lg border border-[#c89b3c]/30 bg-[#c89b3c]/10 px-4 py-3 text-sm font-semibold text-[#f1eadc]">
              Check: {game.turn() === "w" ? "White" : "Black"} king is under attack.
            </div>
          )}

          <PlayerInfo
            name={myName}
            rating="You"
            capturedPieces={playerColor === "white" ? capturedPieces.b : capturedPieces.w}
            image={session?.user?.image}
            tone="active"
          />
        </section>

        <aside className="ui-card h-fit rounded-xl p-5 lg:sticky lg:top-5">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#c89b3c]">Game</p>
              <h2 className="mt-2 text-2xl font-bold text-[#f1eadc]">Game Info</h2>
            </div>
            <div className="grid h-12 w-12 grid-cols-2 overflow-hidden rounded-lg border border-white/10">
              <span className="bg-[#e5d1a7]" />
              <span className="bg-[#8d6748]" />
              <span className="bg-[#8d6748]" />
              <span className="bg-[#e5d1a7]" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-lg border border-white/10 bg-black/25 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b9ae9a]">Status</p>
              <p className="mt-2 text-lg font-extrabold text-[#c89b3c]">{gameStatus}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-white/10 bg-black/25 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b9ae9a]">Color</p>
                <p className="mt-2 font-extrabold capitalize text-[#f1eadc]">{playerColor || "Spectator"}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/25 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b9ae9a]">Moves</p>
                <p className="mt-2 font-extrabold text-[#f1eadc]">{moveHistory.length}</p>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-black/25 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b9ae9a]">Game Code</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="truncate font-mono text-xl font-extrabold text-[#4f7f55]">{gameId}</span>
                <button onClick={() => navigator.clipboard.writeText(gameId)} title="Copy Game Code" className="ui-button shrink-0 bg-[#c89b3c] px-3 py-2 text-xs text-[#17130d]">
                  Copy
                </button>
              </div>
            </div>
          </div>

          <MoveHistory history={moveHistory} />

          <div className="mt-4 flex gap-3">
            <button onClick={handleDraw} disabled={isGameOver} className={drawButtonClass + " disabled:cursor-not-allowed disabled:opacity-50"}>
              {isDrawOffered ? "Accept Draw" : "Offer Draw"}
            </button>
            <button onClick={handleResign} disabled={isGameOver} className="ui-button flex-1 bg-[#94443d] px-4 py-3 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50">
              Resign
            </button>
          </div>

          {isPrivateGame ? (
            <div className="mt-5 border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={() => setIsChatOpen((value) => !value)}
                className="ui-button w-full border border-white/10 bg-black/20 px-4 py-3 text-sm text-[#f1eadc] hover:border-[#c89b3c]/50"
              >
                Chat with your friend
              </button>

              {isChatOpen && (
                <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="scrollbar-soft flex max-h-64 flex-col gap-3 overflow-y-auto pr-1">
                    {chatMessages.length > 0 ? (
                      chatMessages.map((message) => {
                        const isMine = message.userId === session?.user?.id;
                        return (
                          <div key={message.id} className={"flex gap-2 " + (isMine ? "justify-end" : "justify-start")}>
                            {!isMine && (
                              <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/10 bg-[#4f7f55]">
                                {message.image && <img src={message.image} alt="" className="h-full w-full object-cover" />}
                              </div>
                            )}
                            <p className={"max-w-[13rem] rounded-lg px-3 py-2 text-sm leading-5 " + (isMine ? "bg-[#c89b3c] text-[#141414]" : "bg-[#272722] text-[#f1eadc]")}>
                              {message.message}
                            </p>
                            {isMine && (
                              <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/10 bg-[#4f7f55]">
                                {message.image && <img src={message.image} alt="" className="h-full w-full object-cover" />}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <p className="py-6 text-center text-sm text-[#b9ae9a]">No messages yet.</p>
                    )}
                  </div>

                  <form onSubmit={sendChatMessage} className="mt-3 flex gap-2">
                    <input
                      value={chatText}
                      onChange={(event) => setChatText(event.target.value)}
                      maxLength={300}
                      placeholder="Message..."
                      className="ui-input min-w-0 flex-1 rounded-lg px-3 py-2 text-sm"
                    />
                    <button type="submit" disabled={!chatText.trim()} className="ui-button bg-[#4f7f55] px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50">
                      Send
                    </button>
                  </form>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-5 border-t border-white/10 pt-4">
              <p className="mb-3 text-sm font-semibold text-[#f1eadc]">Reactions</p>
              <div className="grid grid-cols-5 gap-2">
                {REACTION_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => sendReaction(option.id)}
                    className="rounded-lg border border-white/10 bg-black/20 px-2 py-3 text-xl transition hover:border-[#c89b3c]/50 hover:bg-white/5"
                    aria-label={"Send " + option.id + " reaction"}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {reactions.length > 0 && (
                <div className="mt-4 flex min-h-12 flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-black/20 p-3">
                  {reactions.map((reaction) => (
                    <span key={reaction.id} className="rounded-full bg-[#272722] px-3 py-1 text-xl shadow-sm">
                      {reactionLabel(reaction.reaction)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      {isGameOver && gameOverMessage && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/80 px-4" aria-modal="true" role="dialog">
          <div className="ui-card max-w-md rounded-xl p-8 text-center">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#c89b3c]">Match ended</p>
            <h2 className="mt-3 text-3xl font-bold text-[#f1eadc]">Game Over</h2>
            <p className="mt-4 text-lg leading-7 text-[#b9ae9a]">{gameOverMessage}</p>
            <Link href="/" className="ui-button mt-7 bg-[#536f8f] px-6 py-3 text-white">
              Back to Home
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}

export default function GamePageWrapper({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = use(params);

  return (
    <SessionProvider>
      <GamePage gameId={gameId} />
    </SessionProvider>
  );
}
