
🎄 Studio 8 · Christmas Party
Web 8-Bit Game – Design & Implementation Prompt
0. Game Overview（给 Copilot 的总览）

You are helping me build a small web-based 2D 8-bit style game.

Game tone & style

Visual style: 8-bit / pixel art

Camera: Top-down

Vibe: Cozy, playful, narrative-driven (Stardew Valley–like)

No combat, no time pressure

Short playable demo (10–15 minutes)

Theme

Christmas 🎄

Team collaboration

Light humor, warm atmosphere

1. Game Concept（游戏概念）

The player is a Studio 8 designer.

Studio 8 is a design team.
The team is preparing for a Christmas party, but some things are not ready yet.

The player’s goal is to help the team prepare the party by completing three small tasks, each represented by a mini-game.

After completing all tasks, the player enters the party space, chooses a gift, and the game ends.

2. Platform & Technical Constraints（非常重要）

Platform

Web (browser-based)

Tech stack

Vite + TypeScript

HTML Canvas 2D (no WebGL)

No Phaser, no external game engine

No backend, no database

Assets

Placeholder rectangles or simple pixel sprites are acceptable

Visual polish is NOT required for the demo

UI

World rendering: Canvas

Dialogs & mini-games: HTML overlay is allowed and preferred

3. Core Gameplay Loop（整体流程）
Office Map
 ├─ Talk to AA (main quest)
 ├─ Decorator → Mini-game 1
 ├─ Photographer → Mini-game 2
 ├─ Bartender → Mini-game 3
 └─ Switch to Party Map
      ├─ Celebration dialog
      └─ Pick a gift → End

4. Characters & Quest Order（注意顺序）
Main Character

Role: Studio 8 Designer (player)

Controlled by keyboard (WASD / Arrow keys)

Moves on a tile grid

NPCs (in this exact order)

Decorator (布置负责人) – First

Photographer – Second

Bartender – Third

AA – Quest giver & final host

5. Main Quest Definition

Quest Name
Prepare the Christmas Party

Quest Objective
Help Studio 8 by assisting:

the Decorator

the Photographer

the Bartender

Quest progress is linear but can be implemented as flags.

6. Game Start – Task Assignment
NPC: AA

Dialog

“Hey! Christmas party is coming 🎄”

“We still need a few things to get ready.”

“Can you help the team?”

Player response

“Sure.”

AA continues

“Please find the Decorator, the Photographer, and the Bartender.”

→ Quest starts.

7. Mini-game 1 – Decorator (FIRST)
NPC: Decorator

Dialog

“The party space still feels a bit empty…”

“Can you help me place the decorations?”

Mini-game: Place the Decorations

Gameplay

Show a simple room layout

3 decoration items:

Christmas tree

Lights

Gift box

Player drags each item to a highlighted target area

Rules

Drag & drop

Correct placement = success

No timer, no failure state

Completion dialog

“Looks great!”

“Now it finally feels like Christmas.”

Decorator is marked as completed.

8. Mini-game 2 – Photographer (SECOND)
NPC: Photographer

Dialog

“I’d love to help, but I’m stuck in a design review.”

“Can you help me review it?”

Mini-game: Design Review – Find the Differences

Gameplay

Total of 3 rounds

Each round:

Two images (left / right)

3 differences per round

Player clicks differences to mark them

Rules

Click-based interaction

Highlight correct spots

No penalty for mistakes

Completion dialog

“Nice catch. You have a good eye.”

“Thanks! I’ll head to the party.”

Photographer is marked as completed.

9. Mini-game 3 – Bartender (THIRD)
NPC: Bartender

Dialog

“We need drinks for the party.”

“Can you help me mix them?”

Mini-game: Mix the Drinks

Gameplay

Menu shows 3 drink recipes

Each drink must be made 2 times

Player selects ingredients for each drink

Example

Drink A = Juice + Ice

Drink B = Soda + Lemon

Drink C = Coffee + Milk

Rules

Correct ingredient combination = success

Simple click-based UI

Completion dialog

“Perfect mix.”

“Drinks are ready. See you at the party.”

Bartender is marked as completed.

10. Final Stage – Party Map

Trigger condition

All three mini-games completed

Action

Switch to a new map: Party Map

Party Dialog

AA: “You made it!”

Other NPCs: “We were waiting for you.”

AA: “Before we start… pick a gift 🎁”

11. Ending – Pick a Gift

Gameplay

Show 3 gift boxes

Player clicks one

After selection

Show selected gift

Display text:

“Merry Christmas 🎄”

Fade out

End screen

Game ends

12. Implementation Expectations

What I expect from you (Copilot):

Generate a minimal runnable project

Implement:

Tile-based movement

NPC interaction

Quest state management

Three mini-games as HTML overlays

Keep logic simple and readable

Focus on correctness, not polish

Start by:

Creating the Vite + TypeScript project

Implementing the base canvas game loop

Rendering a tile-based office map

Adding one NPC interaction as a pattern

End of Prompt