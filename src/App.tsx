import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Trash2, Settings, Car, Flag, Info, Compass } from 'lucide-react';

// --- Constants & Types ---
const GRID_SIZE = 15;
const ACTIONS = [
  { dx: 0, dy: -1, name: 'UP' },    // 0
  { dx: 1, dy: 0, name: 'RIGHT' },  // 1
  { dx: 0, dy: 1, name: 'DOWN' },   // 2
  { dx: -1, dy: 0, name: 'LEFT' }   // 3
];

const REWARD = {
  GOAL: 100,
  WALL: -100,
  STEP: -1,
};

type CellType = 'EMPTY' | 'WALL' | 'START' | 'GOAL';
type QTable = number[][][]; // [y][x][actionIndex]

// --- Helper: Initialize Q-Table ---
// Modified to support Heuristic (Greedy) Initialization
const initQTable = (size: number, useHeuristic: boolean, goal: {x: number, y: number}): QTable => {
  const table = [];
  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) {
      const actions = [];
      for (let a = 0; a < 4; a++) {
        if (!useHeuristic) {
           // Standard RL: Start with 0 (Tabula Rasa)
           actions.push(0); 
        } else {
           // Heuristic: Initialize with negative distance to goal
           // This acts as a "gradient" pulling the agent to the goal
           const dx = ACTIONS[a].dx;
           const dy = ACTIONS[a].dy;
           const nx = x + dx;
           const ny = y + dy;
           
           // Simple Euclidean distance
           const dist = Math.sqrt(Math.pow(nx - goal.x, 2) + Math.pow(ny - goal.y, 2));
           
           // We use negative distance because Q-Learning maximizes value.
           // Being closer (smaller distance) means a "less negative" (higher) value.
           // We multiply by 1.5 to make the gradient steep enough to overcome step costs.
           actions.push(-dist * 2);
        }
      }
      row.push(actions);
    }
    table.push(row);
  }
  return table;
};

// --- Helper: Get max Q value for a cell ---
const getMaxQ = (qValues: number[]) => Math.max(...qValues);

// --- Helper: Get best action index ---
const getBestAction = (qValues: number[]) => {
  let maxVal = -Infinity;
  let maxIndices: number[] = [];
  
  qValues.forEach((val, idx) => {
    if (val > maxVal) {
      maxVal = val;
      maxIndices = [idx];
    } else if (val === maxVal) {
      maxIndices.push(idx);
    }
  });
  
  // Random tie-breaking
  return maxIndices[Math.floor(Math.random() * maxIndices.length)];
};

const App = () => {
  // --- State ---
  const [grid, setGrid] = useState<CellType[][]>([]);
  const [carPos, setCarPos] = useState({ x: 1, y: 1 });
  const [startPos, setStartPos] = useState({ x: 1, y: 1 });
  const [goalPos, setGoalPos] = useState({ x: GRID_SIZE - 2, y: GRID_SIZE - 2 });
  
  // Loop Control
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(50); // ms delay
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Hyperparameters
  const [epsilon, setEpsilon] = useState(0.8); // Exploration rate
  const [alpha, setAlpha] = useState(0.1);     // Learning rate
  const [gamma, setGamma] = useState(0.9);     // Discount factor
  const [useHeuristic, setUseHeuristic] = useState(false); // Greedy toggle

  // Learning State (Refs for performance)
  // We initialize the ref initially, but it gets overwritten in resetLearning
  const qTableRef = useRef<QTable>(initQTable(GRID_SIZE, false, {x:0, y:0}));
  const [episode, setEpisode] = useState(0);
  const [moves, setMoves] = useState(0);
  const [totalReward, setTotalReward] = useState(0);
  
  // UX State
  const [showArrows, setShowArrows] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [drawMode, setDrawMode] = useState<'WALL' | 'EMPTY'>('WALL');

  // --- Initialization ---
  useEffect(() => {
    resetGrid();
  }, []); // Run once on mount

  // We need a separate effect to update Q-table when the heuristic toggle changes
  // IF we havent started learning effectively yet (episode 0, moves 0)
  useEffect(() => {
      if (episode === 0 && moves === 0) {
          resetLearning();
      }
  }, [useHeuristic]);

  const resetGrid = () => {
    const newGrid: CellType[][] = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill('EMPTY'));
    
    // Default Walls (Border)
    for(let i=0; i<GRID_SIZE; i++) {
        newGrid[0][i] = 'WALL';
        newGrid[GRID_SIZE-1][i] = 'WALL';
        newGrid[i][0] = 'WALL';
        newGrid[i][GRID_SIZE-1] = 'WALL';
    }

    // Default positions
    const sPos = { x: 1, y: 1 };
    const gPos = { x: GRID_SIZE - 2, y: GRID_SIZE - 2 };

    newGrid[sPos.y][sPos.x] = 'START';
    newGrid[gPos.y][gPos.x] = 'GOAL';

    setGrid(newGrid);
    setStartPos(sPos);
    setGoalPos(gPos);
    setCarPos(sPos);
    
    // We call resetLearning explicitly here to ensure it uses the new goalPos
    // Note: Since state updates are async, we pass values directly
    resetLearningWithParams(sPos, gPos);
  };

  const resetLearning = () => {
      resetLearningWithParams(startPos, goalPos);
  };

  const resetLearningWithParams = (sPos: {x:number, y:number}, gPos: {x:number, y:number}) => {
    qTableRef.current = initQTable(GRID_SIZE, useHeuristic, gPos);
    setEpisode(0);
    setMoves(0);
    setTotalReward(0);
    setCarPos(sPos);
  };

  const handleCellClick = (x: number, y: number) => {
    if (isRunning) return;
    if ((x === startPos.x && y === startPos.y) || (x === goalPos.x && y === goalPos.y)) return;

    const newGrid = [...grid];
    newGrid[y] = [...newGrid[y]];
    
    // If clicking, decide mode based on current cell
    if (!isDragging) {
        setDrawMode(newGrid[y][x] === 'WALL' ? 'EMPTY' : 'WALL');
        newGrid[y][x] = newGrid[y][x] === 'WALL' ? 'EMPTY' : 'WALL';
    } else {
        newGrid[y][x] = drawMode;
    }
    
    setGrid(newGrid);
  };

  // --- The Q-Learning Step ---
  const step = useCallback(() => {
    setMoves(m => m + 1);
    
    const { x, y } = carPos;
    const currentQ = qTableRef.current[y][x];

    // 1. Choose Action (Epsilon Greedy)
    let actionIdx: number;
    if (Math.random() < epsilon) {
      // Explore
      actionIdx = Math.floor(Math.random() * 4);
    } else {
      // Exploit
      actionIdx = getBestAction(currentQ);
    }

    const action = ACTIONS[actionIdx];
    let nextX = x + action.dx;
    let nextY = y + action.dy;

    // Boundary check
    if (nextX < 0 || nextX >= GRID_SIZE || nextY < 0 || nextY >= GRID_SIZE) {
        nextX = x;
        nextY = y;
    }

    // 2. Observe Reward & Next State
    let reward = 0;
    let isDone = false;
    let hitWall = false;

    const cellType = grid[nextY][nextX];

    if (cellType === 'GOAL') {
      reward = REWARD.GOAL;
      isDone = true;
    } else if (cellType === 'WALL') {
      reward = REWARD.WALL;
      hitWall = true;
      nextX = x; 
      nextY = y; 
    } else {
      reward = REWARD.STEP;
    }

    // 3. Update Q-Table (Bellman Equation)
    const oldVal = currentQ[actionIdx];
    const nextMaxQ = getMaxQ(qTableRef.current[nextY][nextX]);
    
    // Standard Q-Learning update
    const newVal = oldVal + alpha * (reward + gamma * nextMaxQ - oldVal);
    
    qTableRef.current[y][x][actionIdx] = newVal;

    setTotalReward(prev => prev + reward);

    // 4. Move Agent
    setCarPos({ x: nextX, y: nextY });

    // Handle Episode End
    if (isDone) {
        setEpisode(e => e + 1);
        setCarPos(startPos); // Reset to start
        setMoves(0);
        setTotalReward(0);
        // Decay epsilon
        if (epsilon > 0.01) setEpsilon(e => Math.max(0.01, e * 0.995));
    } else if (hitWall) {
         // Reset if stuck in loop or too many moves
         if (moves > GRID_SIZE * GRID_SIZE * 2) {
             setEpisode(e => e + 1);
             setCarPos(startPos);
             setMoves(0);
             setTotalReward(0);
         }
    }

  }, [carPos, epsilon, alpha, gamma, grid, moves, startPos]);


  // --- Game Loop ---
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setTimeout(step, 100 - speed); 
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isRunning, step, speed]);


  // --- Renderer ---
  
  const getCellColor = (x: number, y: number, type: CellType) => {
    if (type === 'WALL') return 'bg-gray-900';
    if (type === 'START') return 'bg-green-500/20'; 
    if (type === 'GOAL') return 'bg-red-500/20';
    
    const qs = qTableRef.current[y][x];
    const maxQ = Math.max(...qs);
    const minQ = Math.min(...qs);

    // Color logic differs if we are using heuristics (values are negative)
    // vs standard (values start at 0).
    
    // Heuristic mode: most values are negative (distance). 
    // MaxQ will be closest to 0 (e.g. -2 is better than -20).
    if (useHeuristic) {
         if (maxQ > -5) return `rgba(34, 197, 94, 0.4)`; // Very close (Green)
         if (maxQ > -15) return `rgba(34, 197, 94, 0.2)`; // Close
         if (maxQ === -Infinity) return 'bg-white';
         return 'bg-white'; // Distant cells remain white for clarity
    }

    // Standard Mode Visualization
    if (maxQ === 0 && minQ === 0) return 'bg-white';

    if (maxQ > 0) {
        const intensity = Math.min(1, maxQ / 50); 
        return `rgba(34, 197, 94, ${0.1 + intensity * 0.5})`; 
    } else {
        const intensity = Math.min(1, Math.abs(minQ) / 100);
        return `rgba(239, 68, 68, ${0.1 + intensity * 0.4})`;
    }
  };

  const getArrow = (x: number, y: number) => {
     if (!showArrows) return null;
     const qs = qTableRef.current[y][x];
     
     // In standard mode, skip . In heuristic mode, arrows always exist.
     if (!useHeuristic && qs.every(v => v === 0)) return null;

     const bestIdx = getBestAction(qs);
     
     // Filter weak signals
     if (!useHeuristic && Math.abs(qs[bestIdx]) < 0.1) return null;

     const rotation = bestIdx * 90; 
     
     return (
        <div 
            className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40"
            style={{ transform: `rotate(${rotation}deg)` }}
        >
            <span className="text-xs font-bold text-gray-800">↑</span>
        </div>
     );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 font-sans text-slate-800">
      
      {/* Header */}
      <div className="w-full max-w-5xl mb-6 flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
                <Car className="w-8 h-8 text-blue-600" />
                Q-Learning Car
            </h1>
            <p className="text-sm text-slate-500">Reinforcement Learning Pathfinder</p>
        </div>
        
        <div className="flex gap-3">
             <button 
                onClick={() => setIsRunning(!isRunning)}
                className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold shadow-sm transition-all ${
                    isRunning ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-green-600 text-white hover:bg-green-700'
                }`}
            >
                {isRunning ? <><Pause size={18}/> Pause</> : <><Play size={18}/> Start Learning</>}
            </button>
            <button 
                onClick={resetLearning}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full hover:bg-slate-50 text-slate-700 transition-all"
            >
                <RotateCcw size={16}/> Reset Agent
            </button>
            <button 
                onClick={resetGrid}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full hover:bg-red-50 text-red-600 transition-all"
            >
                <Trash2 size={16}/> Clear Walls
            </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 w-full max-w-5xl">
        
        {/* Left: The Grid */}
        <div className="flex-1 flex flex-col items-center">
            <div 
                className="bg-white p-2 rounded-xl shadow-lg border border-slate-200 select-none relative"
                onMouseLeave={() => setIsDragging(false)}
            >
                <div 
                    className="grid gap-[1px] bg-slate-200"
                    style={{ 
                        gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
                        width: 'min(600px, 90vw)',
                        height: 'min(600px, 90vw)'
                    }}
                >
                    {grid.map((row, y) => (
                        row.map((cellType, x) => {
                            const isCar = carPos.x === x && carPos.y === y;
                            const isStart = startPos.x === x && startPos.y === y;
                            const isGoal = goalPos.x === x && goalPos.y === y;

                            return (
                                <div 
                                    key={`${x}-${y}`}
                                    onMouseDown={() => { setIsDragging(true); handleCellClick(x, y); }}
                                    onMouseEnter={() => { if(isDragging) handleCellClick(x, y); }}
                                    onMouseUp={() => setIsDragging(false)}
                                    className={`relative transition-colors duration-150 cursor-pointer overflow-hidden ${getCellColor(x, y, cellType)}`}
                                    style={{ backgroundColor: getCellColor(x, y, cellType) }} 
                                >
                                    {isStart && <div className="absolute inset-0 flex items-center justify-center opacity-30 text-green-700 font-bold">S</div>}
                                    {isGoal && <div className="absolute inset-0 flex items-center justify-center text-red-600"><Flag size={20} fill="currentColor"/></div>}
                                    
                                    {!isCar && cellType !== 'WALL' && !isGoal && getArrow(x, y)}

                                    {isCar && (
                                        <div className="absolute inset-0 z-10 flex items-center justify-center transition-all duration-100">
                                            <div className="bg-blue-600 text-white p-1 rounded-full shadow-lg scale-110">
                                                <Car size={16} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    ))}
                </div>
            </div>
            
            <div className="mt-4 flex gap-4 text-xs text-slate-500 font-medium">
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500/30 rounded"></div> Good Path</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500/30 rounded"></div> Bad Path</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-gray-900 rounded"></div> Wall</div>
            </div>
        </div>

        {/* Right: Dashboard */}
        <div className="w-full lg:w-80 space-y-6">
            
            {/* Stats Card */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Info size={18} className="text-blue-500"/> Live Stats
                </h2>
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-3 rounded-lg">
                        <div className="text-xs text-slate-500 uppercase font-bold">Episode</div>
                        <div className="text-2xl font-mono text-slate-900">{episode}</div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg">
                        <div className="text-xs text-slate-500 uppercase font-bold">Moves</div>
                        <div className="text-2xl font-mono text-slate-900">{moves}</div>
                    </div>
                    <div className="col-span-2 bg-slate-50 p-3 rounded-lg">
                         <div className="text-xs text-slate-500 uppercase font-bold">Total Reward</div>
                         <div className={`text-xl font-mono ${totalReward > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {totalReward.toFixed(1)}
                         </div>
                    </div>
                </div>
            </div>

            {/* Controls Card */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                 <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Settings size={18} className="text-slate-500"/> Hyperparameters
                </h2>

                <div className="space-y-5">
                    
                    {/* Heuristic Toggle (Greedy) */}
                     <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                        <div className="flex items-center justify-between mb-2">
                             <label htmlFor="heuristic" className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                                <Compass size={16} /> Greedy Heuristic
                             </label>
                             <input 
                                type="checkbox" 
                                id="heuristic"
                                checked={useHeuristic} 
                                onChange={(e) => {
                                    setUseHeuristic(e.target.checked);
                                    // Auto-adjust epsilon if user turns on heuristic for better UX
                                    if(e.target.checked) setEpsilon(0.2);
                                }}
                                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
                            />
                        </div>
                        <p className="text-xs text-indigo-700 leading-snug">
                            {useHeuristic 
                                ? "ON: Car knows where the flag is (Distance). Lowers difficulty." 
                                : "OFF: Car knows nothing. Blind exploration."}
                        </p>
                    </div>

                    {/* Simulation Speed */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Simulation Speed</span>
                            <span className="font-mono text-slate-900">{speed}%</span>
                        </div>
                        <input 
                            type="range" min="0" max="99" step="1"
                            value={speed} onChange={(e) => setSpeed(Number(e.target.value))}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                    </div>

                    <hr className="border-slate-100"/>

                    {/* Epsilon */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Exploration (Epsilon)</span>
                            <span className="font-mono text-slate-900">{epsilon.toFixed(2)}</span>
                        </div>
                        <input 
                            type="range" min="0" max="1" step="0.01"
                            value={epsilon} onChange={(e) => setEpsilon(Number(e.target.value))}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                        />
                        <p className="text-[10px] text-slate-400 leading-tight">
                            {useHeuristic && epsilon > 0.3 
                                ? "Warning: High Exploration will ignore your Heuristic!" 
                                : "High = Try random moves. Low = Use learned path."}
                        </p>
                    </div>

                    {/* Learning Rate */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Learning Rate (Alpha)</span>
                            <span className="font-mono text-slate-900">{alpha.toFixed(2)}</span>
                        </div>
                        <input 
                            type="range" min="0.01" max="1" step="0.01"
                            value={alpha} onChange={(e) => setAlpha(Number(e.target.value))}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                    </div>
                </div>
            </div>

             <div className="flex items-center gap-2">
                <input 
                    type="checkbox" 
                    id="showArrows"
                    checked={showArrows} 
                    onChange={(e) => setShowArrows(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                />
                <label htmlFor="showArrows" className="text-sm text-slate-600 select-none cursor-pointer">Show Policy Arrows</label>
             </div>

        </div>
      </div>
    </div>
  );
};

export default App;
