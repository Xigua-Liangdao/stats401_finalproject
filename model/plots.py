"""Three reproducible static figures, using the same exports as the frontend."""
from __future__ import annotations

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import TwoSlopeNorm
from matplotlib.ticker import PercentFormatter
import numpy as np
import pandas as pd

from prepare import ROLES

COLORS = {"top": "#3569ab", "jng": "#0c8979", "mid": "#b58018", "bot": "#c35264", "sup": "#8857ad"}


def style():
    plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 11,
                         "axes.spines.top": False, "axes.spines.right": False,
                         "axes.labelcolor": "#344054", "text.color": "#172b3a",
                         "axes.edgecolor": "#c6cdd5", "xtick.color": "#475467", "ytick.color": "#475467",
                         "figure.facecolor": "white", "axes.facecolor": "white",
                         "svg.fonttype": "none", "svg.hashsalt": "stats401-demo"})


def save(fig, destination, name):
    fig.savefig(destination / f"{name}.png", dpi=160)
    fig.savefig(destination / f"{name}.svg", metadata={"Date": None})
    svg_path = destination / f"{name}.svg"
    svg_path.write_text("\n".join(line.rstrip() for line in svg_path.read_text().splitlines()) + "\n")
    plt.close(fig)


def make_figures(tables, destination):
    style()
    destination.mkdir(parents=True, exist_ok=True)
    players = tables["players"]
    eligible = players[players.eligible]
    if eligible.empty:
        raise ValueError("No players have enough held-out games for static figures.")
    fig, ax = plt.subplots(figsize=(11, 6.6))
    fig.subplots_adjust(top=.80, bottom=.19, left=.11, right=.96)
    fig.text(.06, .94, "Resource share and adjusted damage", fontsize=21, weight="bold")
    fig.text(.06, .885, "2025 LPL · each point is one player, team and role; at least 10 evaluated games on 3 days", fontsize=10)
    ax.axhline(0, color="#8595a6", linestyle="--", linewidth=1)
    for role in ROLES:
        g = eligible[eligible.role == role]
        ax.scatter(g.mean_gold_share, g.mean_impact, s=20 + 1.4*g.n_games, c=COLORS[role], label=role.upper(), alpha=.75, edgecolors="white", linewidth=.6)
    ax.xaxis.set_major_formatter(PercentFormatter(1))
    ax.set_xlabel("Mean share of team total gold (same evaluated games)")
    ax.set_ylabel("Mean adjusted damage (role SD units)")
    ax.grid(alpha=.18, axis="y")
    ax.legend(loc="lower left", bbox_to_anchor=(0, 1.01), ncol=5, fontsize=9, frameon=False, handletextpad=.3)
    fig.text(.06, .065, "Adjusted damage = (actual DPM − predicted DPM) / training-role SD. Point area increases with game count.", fontsize=9)
    fig.text(.06, .03, "Source: Oracle's Elixir, pinned 2025 LPL snapshot. Estimates describe damage output, not overall player value.", fontsize=9, color="#667085")
    save(fig, destination, "01_resource_impact")

    # Selection by coverage, not by strongest-looking residual.
    focus = eligible.sort_values(["n_games", "player_id", "team_id", "role"], ascending=[False, True, True, True]).iloc[0]
    timeline = tables["timeline"]
    t = timeline[(timeline.player_id == focus.player_id) & (timeline.team_id == focus.team_id) & (timeline.role == focus.role)].sort_values("day")
    dates = pd.to_datetime(t.day)
    fig, ax = plt.subplots(figsize=(11, 6.6))
    fig.subplots_adjust(top=.79, bottom=.19, left=.10, right=.97)
    fig.text(.06, .94, f"Actual and expected damage: {focus.player}", fontsize=21, weight="bold")
    fig.text(.06, .885, f"{focus.team} · {focus.role.upper()} · {int(focus.n_games)} evaluated games · selected for largest sample", fontsize=10)
    ax.plot(dates, t.actual_dpm, marker="o", markersize=3, linewidth=1.7, color="#0c8979", label="Actual DPM")
    ax.plot(dates, t.expected_dpm, linestyle="--", linewidth=1.7, color="#3569ab", label="Expected DPM")
    ax.set_ylabel("Damage to champions per minute")
    ax.set_xlabel("Match date (source calendar)")
    ax.legend(frameon=False, loc="best")
    ax.grid(alpha=.18, axis="y")
    fig.text(.06, .065, "Each point averages one match day's games. Lines connect observed dates; gaps may contain no matches.", fontsize=9)
    fig.text(.06, .03, "Expected values come from earlier-date training only. Warmup games are excluded. Source: Oracle's Elixir.", fontsize=9, color="#667085")
    save(fig, destination, "02_performance_timeline")

    team = tables["teams"].sort_values(["n_games", "team_id"], ascending=[False, True]).iloc[0]
    team_players = players[(players.team_id == team.team_id) & (players.n_games > 0)].copy()
    team_players["role_order"] = team_players.role.map({role: i for i, role in enumerate(ROLES)})
    team_players = team_players.sort_values(["role_order", "player_id"]).drop_duplicates("player_id")
    ids = list(team_players.player_id)
    labels = [f"{r.player} ({r.role.upper()})" for r in team_players.itertuples()]
    matrix = np.full((len(ids), len(ids)), np.nan)
    counts = np.zeros(matrix.shape, dtype=int)
    for pair in tables["pairs"].itertuples():
        if pair.team_id == team.team_id and pair.eligible and pair.player_a_id in ids and pair.player_b_id in ids:
            i, j = ids.index(pair.player_a_id), ids.index(pair.player_b_id)
            matrix[i, j] = matrix[j, i] = pair.shrunk_impact
            counts[i, j] = counts[j, i] = pair.n_games
    limit = max(.15, float(np.nanmax(np.abs(matrix))))
    fig, ax = plt.subplots(figsize=(11, 8.4))
    fig.subplots_adjust(top=.79, bottom=.26, left=.23, right=.91)
    fig.text(.06, .95, f"Teammate co-performance: {team.team}", fontsize=20, weight="bold")
    fig.text(.06, .90, "Pairs' mean adjusted damage, shrunk toward zero; team selected for largest evaluated sample", fontsize=10)
    cmap = plt.get_cmap("RdBu").copy()
    cmap.set_bad("#eef1f4")
    plot = ax.imshow(np.ma.masked_invalid(matrix), cmap=cmap, norm=TwoSlopeNorm(vmin=-limit, vcenter=0, vmax=limit))
    ax.set_xticks(range(len(ids)), labels, rotation=50, ha="right", fontsize=9)
    ax.set_yticks(range(len(ids)), labels, fontsize=9)
    for i in range(len(ids)):
        for j in range(len(ids)):
            if np.isfinite(matrix[i, j]):
                ax.text(j, i, f"{matrix[i,j]:+.2f}\nn={counts[i,j]}", ha="center", va="center", fontsize=8,
                        color="white" if abs(matrix[i,j]) > .65*limit else "#172b3a")
    fig.colorbar(plot, ax=ax, fraction=.043, pad=.045, label="Shrunk co-performance (role SD units)")
    fig.text(.06, .105, "Grey = self-pair, no shared evaluated games, or fewer than 10 games / 3 match days. Grey does not mean zero.", fontsize=9)
    fig.text(.06, .067, "Score = mean of the two players' adjusted damage × n/(n+10). Shared team context can affect both players.", fontsize=9)
    fig.text(.06, .03, "This is a descriptive co-performance proxy. It does not isolate a causal synergy effect. Source: Oracle's Elixir.", fontsize=9, color="#667085")
    save(fig, destination, "03_pair_heatmap")
    return {"timeline_player_id": focus.player_id, "timeline_team_id": focus.team_id, "timeline_role": focus.role,
            "heatmap_team_id": team.team_id, "selection_rule": "largest number of evaluated games; stable ID breaks ties"}
