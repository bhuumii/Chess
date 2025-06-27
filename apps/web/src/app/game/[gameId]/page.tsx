"use client";

import { useState, useEffect, use } from "react";
import React from 'react';
import { Chess, Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { io, Socket } from "socket.io-client";
import { SessionProvider, useSession } from "next-auth/react";
import Link from 'next/link';


let socket: Socket;


type Piece = 'wP' | 'wN' | 'wB' | 'wR' | 'wQ' | 'wK' | 'bP' | 'bN' | 'bB' | 'bR' | 'bQ' | 'bK';

type Player = {
  id: string;
  name: string | null;
  email: string;
  emailVerified: number | null;
  image: string | null;
} | null;


function PlayerInfo({ name, rating, capturedPieces, image }: { name: string; rating: string; capturedPieces: Piece[]; image?: string | null }) {
  return (
    <div className="flex w-full items-center justify-between rounded-lg bg-gray-700 p-2">
      <div className="flex items-center gap-3">
    
        <div 
          className="h-10 w-10 rounded-full bg-gray-500 bg-cover bg-center"
          style={{ backgroundImage: image ? `url(${image})` : 'none' }}
        ></div>
        <div>
          <h3 className="text-md font-bold text-white">{name}</h3>
          <p className="text-xs text-gray-400">{rating}</p>
        </div>
      </div>
      <CapturedPieces pieces={capturedPieces} />
    </div>
  );
}

function CapturedPieces({ pieces }: { pieces: Piece[] }) {
  return (
    <div className="flex h-6 flex-wrap gap-1">
      {pieces.map((p, index) => (
        <div
          key={index}
          className="h-5 w-5"
          style={{
            backgroundImage: `url(/pieces/${p}.svg)`,
            backgroundSize: "contain",
            backgroundRepeat: "no-repeat",
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
    <div className="mt-4 h-64 overflow-y-auto rounded bg-gray-700 p-2 text-sm">
      <table className="w-full">
        <tbody>
          {movePairs.map((pair, index) => (
            <tr key={index} className="odd:bg-gray-600/50">
              <td className="w-8 p-1 text-right text-gray-400">{index + 1}.</td>
              <td className="p-1 font-semibold text-white">{pair[0]}</td>
              <td className="p-1 font-semibold text-white">{pair[1] || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const createCustomPieces = () => {
  const pieces: { [key in Piece]?: ({ squareWidth }: { squareWidth: number }) => React.ReactNode } = {};
  const pieceList: Piece[] = ["wP", "wN", "wB", "wR", "wQ", "wK", "bP", "bN", "bB", "bR", "bQ", "bK"];
  pieceList.forEach((p) => {
    pieces[p] = ({ squareWidth }) => (
      <div key={p} style={{ width: squareWidth, height: squareWidth, backgroundImage: `url(/pieces/${p}.svg)`, backgroundSize: "100%" }} />
    );
  });
  return pieces;
};

const initialBoard: { [key: string]: number } = { p: 8, n: 2, b: 2, r: 2, q: 1 };
function calculateCapturedPieces(fen: string): { w: Piece[], b: Piece[] } {
  const currentPieces: { [key: string]: number } = { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0, P: 0, N: 0, B: 0, R: 0, Q: 0, K: 0 };
  fen.split(' ')[0].split('').forEach(char => {
    if (/[pnbrqkPNBRQK]/.test(char)) {
      currentPieces[char] = (currentPieces[char] || 0) + 1;
    }
  });
  const captured = { w: [] as Piece[], b: [] as Piece[] };
  for (const piece in initialBoard) {
    const whitePiece = piece.toUpperCase() as 'P' | 'N' | 'B' | 'R' | 'Q';
    const capturedCount = initialBoard[piece] - (currentPieces[whitePiece] || 0);
    for (let i = 0; i < capturedCount; i++) captured.b.push(`w${whitePiece}` as Piece);
  }
  for (const piece in initialBoard) {
    const blackPiece = piece.toLowerCase() as 'p' | 'n' | 'b' | 'r' | 'q';
    const capturedCount = initialBoard[piece] - (currentPieces[blackPiece] || 0);
    for (let i = 0; i < capturedCount; i++) captured.w.push(`b${blackPiece.toUpperCase()}` as Piece);
  }
  return captured;
}


function GamePage({ gameId }: { gameId: string }) {
  const { data: session } = useSession();
  
  const [game, setGame] = useState(new Chess());
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [playerColor, setPlayerColor] = useState<"white" | "black" | "spectator" | null>(null);
  const [gameStatus, setGameStatus] = useState("Connecting to server...");
  const [capturedPieces, setCapturedPieces] = useState<{ w: Piece[], b: Piece[] }>({ w: [], b: [] });
  const [customPieces, setCustomPieces] = useState({});
  const [isGameOver, setIsGameOver] = useState(false);
 const [isDrawOffered, setIsDrawOffered] = useState(false);
 const [gameOverMessage, setGameOverMessage] = useState('');
 const [whitePlayer, setWhitePlayer] = useState<Player>(null);
 const [blackPlayer, setBlackPlayer] = useState<Player>(null);


function handleResign() {
    if (playerColor && playerColor !== 'spectator') {
        socket.emit('resign', { gameId, color: playerColor });
    }
}

function handleDraw() {
    if (isDrawOffered) {
        // Accept the draw
        socket.emit('accept_draw', { gameId });
    } else {
        // Offer a draw
        socket.emit('offer_draw', { gameId });
        // Optionally, give some feedback to the user who offered
        alert("Draw offer sent."); 
    }
}


  useEffect(() => {

    if (session?.user?.id) {
      setCustomPieces(createCustomPieces());
      socket = io("http://localhost:8000");

      socket.emit("join_game", { gameId, userId: session.user.id });


      socket.on('game_state_update', (data) => {
          console.log("Received game_state_update:", data); 
          const newGame = new Chess(data.game.fen);
          setGame(newGame);
          setMoveHistory(newGame.history());
          setCapturedPieces(calculateCapturedPieces(data.game.fen));
          setWhitePlayer(data.whitePlayer);
          setBlackPlayer(data.blackPlayer);
      });

     
      socket.on("assign_color", (color) => {
          setPlayerColor(color);
      });
      
    
      socket.on("game_update", (fen: string) => {
          const newGame = new Chess(fen);
          setGame(newGame);
          setMoveHistory(newGame.history());
          setCapturedPieces(calculateCapturedPieces(fen));
      });

      
    socket.on('draw_offered', () => {
    setIsDrawOffered(true);
    });

    socket.on('game_over', (data: { reason: string, winner: string }) => {
    setIsGameOver(true); // We already have this state!
    let message = '';
    if (data.reason === 'draw') {
        message = 'Game over: Draw agreed.';
    } else {
        message = `Game over: ${data.winner.charAt(0).toUpperCase() + data.winner.slice(1)} wins by resignation.`;
    }
    setGameOverMessage(message);
});

      
      socket.on("game_status", (status) => {
          setGameStatus(status);
      });
      
   
      return () => {
        if(socket) socket.disconnect();
      };
    }
  }, [gameId, session]); 


  useEffect(() => {
    if (playerColor) {
        updateGameStatus();
    }
  }, [game, playerColor]);

  function updateGameStatus() {
    if (game.isCheckmate()) {
      setGameStatus(`Checkmate! ${game.turn() === 'w' ? 'Black' : 'White'} wins.`);
      setIsGameOver(true);
    } else if (game.isDraw()) {
      setGameStatus("Draw!");
      setIsGameOver(true);
    } else {
      setGameStatus(`${game.turn() === 'w' ? 'White' : 'Black'}'s turn`);
      setIsGameOver(false); 
    }
  }

  function onDrop(sourceSquare: Square, targetSquare: Square) {
    if (!playerColor || playerColor === 'spectator' || game.turn() !== playerColor[0] || isGameOver) {
      return false;
    }
    const gameCopy = new Chess(game.fen());
    try {
      const move = gameCopy.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
      if (move) {
        setGame(gameCopy);
        const newHistory = gameCopy.history();
        setMoveHistory(newHistory);
        setCapturedPieces(calculateCapturedPieces(gameCopy.fen())); 
        updateGameStatus();
        socket.emit("move", { gameId, fen: gameCopy.fen() });
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  

  return (
    <div className="relative flex min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto flex flex-col items-center justify-center p-4 lg:flex-row lg:items-start lg:gap-8">
        
        <div className="flex w-full max-w-2xl flex-col items-center lg:w-2/3">
          {/* Opponent's Info Card */}
          <PlayerInfo 
            name={playerColor === 'white' ? blackPlayer?.name || 'Waiting...' : whitePlayer?.name || 'Waiting...'} 
            rating="1200" 
            capturedPieces={playerColor === 'white' ? capturedPieces.w : capturedPieces.b} 
            image={playerColor === 'white' ? blackPlayer?.image : whitePlayer?.image}
          />

          {/* Chessboard */}
          <div className="my-4 w-full shadow-2xl">
            <Chessboard
              id="PlayVsPlay"
              position={game.fen()}
              onPieceDrop={onDrop}
              boardOrientation={playerColor === 'black' ? 'black' : 'white'}
              arePiecesDraggable={!isGameOver}
              customDarkSquareStyle={{ backgroundColor: "#b58863" }}
              customLightSquareStyle={{ backgroundColor: "#f0d9b5" }}
              customPieces={customPieces}
            />
          </div>

          {/* My Info Card */}
          <PlayerInfo 
            name={session?.user?.name || 'You'}
            rating="1200" 
            capturedPieces={playerColor === 'white' ? capturedPieces.b : capturedPieces.w} 
            image={session?.user?.image}
          />
        </div>

        {/* Right Sidebar */}
        <div className="w-full lg:w-1/3 lg:pt-20">
            <div className="rounded-lg bg-gray-800 p-4">
                <h2 className="text-2xl font-bold mb-4 border-b border-gray-700 pb-2">Game Info</h2>
                <div className="flex justify-between text-lg">
                    <span className="font-semibold text-gray-400">Status:</span>
                    <span className="font-bold text-yellow-400">{gameStatus}</span>
                </div>
                <div className="flex justify-between text-lg mt-2">
                    <span className="font-semibold text-gray-400">Your Color:</span>
                    <span className="font-bold capitalize">{playerColor || "Spectator"}</span>
                </div>
                <MoveHistory history={moveHistory} />

                {/*The updated buttons --- */}
                <div className="mt-4 flex gap-4">
                    <button 
                        onClick={handleDraw}
                        disabled={isGameOver}
                        className={`flex-1 rounded-md p-3 font-semibold transition ${
                            isDrawOffered 
                            ? 'bg-yellow-500 hover:bg-yellow-400 text-black' 
                            : 'bg-gray-700 hover:bg-gray-600'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        {isDrawOffered ? 'Accept Draw' : 'Offer Draw'}
                    </button>
                    <button 
                        onClick={handleResign}
                        disabled={isGameOver}
                        className="flex-1 rounded-md bg-red-800 p-3 font-semibold transition hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Resign
                    </button>
                </div>
            </div>
        </div>
      </div>

     
      {isGameOver && gameOverMessage && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75" aria-modal="true" role="dialog">
            <div className="rounded-lg bg-gray-800 p-8 text-center shadow-2xl">
                <h2 className="text-4xl font-bold text-white mb-4">Game Over</h2>
                <p className="text-xl text-gray-300 mb-6">{gameOverMessage}</p>
                <Link href="/" className="rounded-md bg-blue-600 px-6 py-3 font-bold text-white transition hover:bg-blue-500">
                    Back to Lobby
                </Link>
            </div>
        </div>
      )}
    </div>
  );
}
      


export default function GamePageWrapper({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  
  return (
    <SessionProvider>
      <GamePage gameId={gameId} />
    </SessionProvider>
  );
}


