"""Shared per-target runtime patch bookkeeping.

Each vulnerable target instance owns one PatchState so multiple independent
instances of the same bot class (e.g. Level 2's AgentBot and the boss's
AgentBot) never share fix state.
"""


class PatchState:
    def __init__(self):
        self._applied = set()

    def apply(self, category: str) -> set:
        self._applied.add(category)
        return set(self._applied)

    def reset(self) -> None:
        self._applied.clear()

    def get(self) -> set:
        return set(self._applied)

    def has(self, category: str) -> bool:
        return category in self._applied
