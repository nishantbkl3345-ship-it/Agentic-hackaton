"""Standard Elo update. A separate skill rating alongside cumulative XP:
XP never goes down, Elo moves up or down per mission based on difficulty
and outcome.
"""

DIFFICULTY_RATING = {"Easy": 1000, "Medium": 1200, "Hard": 1400, "Boss": 1600}
K_DEFAULT = 24
K_BOSS = 32


def update_elo(current: int, difficulty: str, won: bool) -> int:
    opponent = DIFFICULTY_RATING.get(difficulty, 1200)
    k = K_BOSS if difficulty == "Boss" else K_DEFAULT
    expected = 1 / (1 + 10 ** ((opponent - current) / 400))
    score = 1.0 if won else 0.0
    return round(current + k * (score - expected))
