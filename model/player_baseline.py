"""Descriptive full-season role references, with equal weight for each player."""

PROFILE_METRICS = ["dpm", "gold_share", "damage_share", "vision_per_minute"]


def season_role_baselines(player_games, shrinkage_games):
    # A transferred player counts once per season/role, regardless of team or
    # games played. Ordinary metrics include warmup; missing values are omitted.
    groups = player_games.groupby(["season", "role", "player_id"], sort=True)
    profiles = groups[PROFILE_METRICS].mean()
    impact = groups.adjusted_impact.agg(["mean", "count"])
    # Compare the same stabilized metric as the radar's actual Impact axis.
    # Warmup-only players have no impact estimate and do not supply a fake zero.
    profiles["impact"] = impact["mean"] * impact["count"] / (impact["count"] + shrinkage_games)
    return profiles.groupby(level=["season", "role"]).mean().rename(
        columns=lambda metric: f"mean_baseline_{metric}"
    )
