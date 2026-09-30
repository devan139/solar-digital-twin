from backend.app.models.asset_state import AssetState


class PlantStateService:

    def evaluate_plant_status(
        self,
        asset_states: list[AssetState],
    ) -> str:

        if any(
            state.status == "CRITICAL"
            for state in asset_states
        ):
            return "CRITICAL"

        if any(
            state.status == "WARNING"
            for state in asset_states
        ):
            return "WARNING"

        return "NORMAL"
