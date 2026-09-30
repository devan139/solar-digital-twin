from datetime import datetime

from pydantic import BaseModel


class Alert(BaseModel):
    id: str
    asset_id: str
    timestamp: datetime
    severity: str
    type: str
    message: str
    recommendation: str
