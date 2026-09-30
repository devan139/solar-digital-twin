from pydantic import BaseModel


class Asset(BaseModel):
    asset_id: str
    asset_type: str
    capacity_kw: float
