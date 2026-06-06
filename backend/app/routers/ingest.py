from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import uuid
import aiofiles
import pandas as pd
import json

from app.database import get_db
from app.services import validation_service, mcp_service, ai_service, gateway_service
from app.models import Proposal
from app.schemas import ProposalResponse, DriftItem

router = APIRouter()

@router.post("/ingest", response_model=ProposalResponse)
async def ingest_file(
    file: UploadFile = File(...),
    target_table: str = Form(...),
    db: AsyncSession = Depends(get_db)
):
    file_bytes = await file.read()
    
    # 2. Validate magic bytes
    ext = ""
    if file.filename:
        ext = "." + file.filename.split(".")[-1]
    is_valid, reason = validation_service.validate_magic_bytes(file_bytes, ext)
    if not is_valid:
        raise HTTPException(status_code=400, detail=reason)
        
    # 3. Save file
    file_id = str(uuid.uuid4())
    import os
    try:
        os.makedirs("/tmp", exist_ok=True)
    except Exception:
        pass  # ignore if directory creation fails or not applicable
    tmp_path = f"/tmp/{file_id}_{file.filename}"
    try:
        async with aiofiles.open(tmp_path, 'wb') as f:
            await f.write(file_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {str(e)}")
        
    # 4. Load sample rows
    try:
        df = pd.read_csv(tmp_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid CSV file format: {str(e)}")
        
    sample_rows = df.head(5).to_dict(orient="records")
    
    # 5. Detect incoming schema
    incoming_schema = {col: str(dtype) for col, dtype in df.dtypes.items()}
    
    # 6. Target schema
    try:
        target_schema = await mcp_service.get_target_schema(target_table, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch target schema: {str(e)}")
    
    # Get table metadata
    from app.models import TableMetadata
    from sqlalchemy import select
    stmt = select(TableMetadata).where(TableMetadata.table_name == target_table)
    res = await db.execute(stmt)
    tbl = res.scalars().first()
    table_metadata = {"semantic_description": tbl.semantic_description if tbl else ""}
    
    # 7. AI proposal
    try:
        ai_resp = await ai_service.generate_pipeline_proposal(
            incoming_schema, target_schema, sample_rows, table_metadata
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI Generation Service failed: {str(e)}")
        
    parsed = ai_resp["parsed"]
    generated_code = parsed["generated_code"]
    
    # 8. Validate code
    is_valid_code, code_reason = validation_service.validate_generated_code(generated_code)
    if not is_valid_code:
        # Retry once
        try:
            ai_resp = await ai_service.generate_pipeline_proposal(
                incoming_schema, target_schema, sample_rows, table_metadata,
                retry_msg=f"Code validation failed: {code_reason}. Provide fixed code."
            )
            parsed = ai_resp["parsed"]
            generated_code = parsed["generated_code"]
            is_valid_code, code_reason = validation_service.validate_generated_code(generated_code)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"AI Retry Service failed: {str(e)}")
            
        if not is_valid_code:
            raise HTTPException(status_code=422, detail={"error": "code validation failed", "detail": code_reason})
            
    # 9. Gateway classification
    gateway_status = gateway_service.classify_gateway_state(
        parsed["gateway_recommendation"],
        parsed["drift_detected"],
        parsed["confidence_score"]
    )
    
    # 10. Save proposal
    proposal = Proposal(
        id=file_id,
        filename=file.filename,
        gateway_status=gateway_status,
        drift_detected=parsed["drift_detected"],
        proposed_steps=parsed["proposed_steps"],
        generated_code=generated_code,
        confidence_score=parsed["confidence_score"],
        llm_raw_response=ai_resp["raw_response"],
        llm_prompt_sent=ai_resp["prompt_sent"],
        status="PENDING",
        file_path=tmp_path,
        estimated_rows=len(df),
        pii_columns_found=parsed["pii_columns_found"],
        llm_model_used=ai_resp["model_used"]
    )
    db.add(proposal)
    await db.commit()
    
    drift_items = [DriftItem(**item) for item in parsed["drift_detected"]]
    
    # 11. Return
    return ProposalResponse(
        proposal_id=file_id,
        gateway_status=gateway_status,
        drift_detected=drift_items,
        proposed_steps=parsed["proposed_steps"],
        generated_code=generated_code,
        confidence_score=parsed["confidence_score"],
        pii_columns_found=parsed["pii_columns_found"],
        estimated_rows=len(df),
        llm_model_used=ai_resp["model_used"]
    )
