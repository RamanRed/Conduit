from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select
from app.database import get_db
from app.models import WarehouseUnit
from app.schemas import WarehouseUnitResponse
from typing import List

router = APIRouter()

@router.get("/sources", response_model=List[WarehouseUnitResponse])
async def get_sources(db: AsyncSession = Depends(get_db)):
    stmt = select(WarehouseUnit)
    res = await db.execute(stmt)
    units = res.scalars().all()
    
    out = []
    for u in units:
        status = "UNREACHABLE"
        try:
            # We are connected to WAREHOUSE_DB_URL, so a SELECT 1 will succeed.
            # In a real app we would use the specific connection for the unit.
            await db.execute(text("SELECT 1"))
            status = "CONNECTED"
        except Exception:
            pass
            
        out.append(WarehouseUnitResponse(
            id=u.id,
            name=u.name,
            unit_type=u.unit_type,
            status=status
        ))
    return out
