# 🚗 Q-Learning Car: Interactive Reinforcement Learning

A visual, interactive demonstration of **Q-Learning** (Reinforcement Learning) built with **React**, **TypeScript**, and **Tailwind CSS**.

Watch an AI agent start with zero knowledge and learn to navigate a grid world, avoid walls, and reach the goal through trial and error.

🔗 **[Live Demo](https://sujeetmadihalli.github.io/q-learning-car/)**

[Project Screenshot](./public/Q_Learning.png) 

## 🧠 What is this?

This project visualizes the **Q-Learning algorithm**, a model-free reinforcement learning technique. The "Car" (agent) learns an optimal policy (path) by interacting with its environment.

### The Algorithm
The agent updates its knowledge based on the **Bellman Equation**:

$$Q(s,a) \leftarrow Q(s,a) + \alpha [R + \gamma \max Q(s',a') - Q(s,a)]$$

* **$s$**: Current State (Position)
* **$a$**: Action (Up, Down, Left, Right)
* **$R$**: Reward (Goal: +100, Wall: -100, Step: -1)
* **$\alpha$ (Alpha)**: Learning Rate (How fast it accepts new info)
* **$\gamma$ (Gamma)**: Discount Factor (Importance of future rewards)

## ✨ Key Features

* **Interactive Grid:** Click and drag to draw walls or clear paths.
* **Real-time Visualization:** Watch the Q-Table update live. Green cells indicate high-value states; arrows show the learned policy.
* **Hyperparameter Tuning:** Adjust parameters on the fly:
    * **Exploration (Epsilon):** Balance between exploring new paths vs. sticking to what works.
    * **Learning Rate (Alpha):** How quickly the agent overwrites old knowledge.
    * **Simulation Speed:** Speed up training or slow down to analyze moves.
* **Heuristic Mode:** Toggle "Greedy Heuristic" to initialize the agent with distance-based knowledge (solving the maze much faster).

## 🛠️ Tech Stack

* **Framework:** React 18 + TypeScript
* **Build Tool:** Vite
* **Styling:** Tailwind CSS
* **Icons:** Lucide React

## 🚀 Getting Started

### Prerequisites
* Node.js (v16 or higher)
* npm

### Installation

1.  **Clone the repository**
    ```bash
    git clone [https://github.com/](https://github.com/)sujeetmadihalli/q-learning-car.git
    cd q-learning-car
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Run the development server**
    ```bash
    npm run dev
    ```

4.  Open `http://localhost:5173` in your browser.

## 🎮 How to Use

1.  **Draw Walls:** Click and drag on the grid to create obstacles.
2.  **Start Learning:** Click the **Play** button. The car will start exploring.
    * *Tip:* Initially, the car moves randomly. As it finds the goal, it will start following the green path.
3.  **Adjust Difficulty:**
    * Turn **Heuristic OFF** for the true "blind" AI experience (hard mode).
    * Turn **Heuristic ON** to give the AI a "sense of smell" for the goal (easy mode).
4.  **View Policy:** Toggle "Show Policy Arrows" to see exactly which direction the AI thinks is best for every cell.

## 🤝 Contributing

Contributions are welcome! If you have ideas for new features (like adding mud/slow tiles, moving obstacles, or different algorithms like A* or SARSA), feel free to fork the repo and submit a PR.

## 📄 License

This project is open source :)
