from backend.app.models.asset_state import AssetState


class PlantStateService:
    TOTAL_REQUIRED_ASSETS = 6

    def evaluate_plant_status(
        self,
        asset_states: list[AssetState],
    ) -> str:
        """Evaluate plant equipment condition decoupled from data condition.

        Rules:
        - If any active fresh asset reports CRITICAL -> CRITICAL
        - Else if any active fresh asset reports WARNING -> WARNING
        - Else if telemetry is missing/stale for any required asset -> UNKNOWN (cannot verify full plant normality)
        - Else -> NORMAL
        """
        # 1. Critical equipment alarm takes precedence
        if any(
            state.equipment_condition == "CRITICAL"
            and state.data_condition == "FRESH"
            for state in asset_states
        ):
            return "CRITICAL"

        # 2. Warning equipment alarm takes precedence next
        if any(
            state.equipment_condition == "WARNING"
            and state.data_condition == "FRESH"
            for state in asset_states
        ):
            return "WARNING"

        # 3. Check data completeness across all 6 arrays
        fresh_count = sum(
            1 for state in asset_states if state.data_condition == "FRESH"
        )
        if fresh_count < self.TOTAL_REQUIRED_ASSETS:
            return "UNKNOWN"

        return "NORMAL"

    def evaluate_plant_data_health(
        self,
        asset_states: list[AssetState],
    ) -> str:
        """Evaluate plant data transmission quality.

        - HEALTHY: All 6 required assets have FRESH data.
        - UNAVAILABLE: No required asset has FRESH data.
        - DEGRADED: Partial data available.
        """
        fresh_count = sum(
            1 for state in asset_states if state.data_condition == "FRESH"
        )
        if fresh_count == self.TOTAL_REQUIRED_ASSETS:
            return "HEALTHY"
        elif fresh_count == 0:
            return "UNAVAILABLE"
        else:
            return "DEGRADED"
