import os
from fastapi import FastAPI
from src import config, db
from src.webhook import router as webhook_router
from src.events import router as events_router
from src.simulator import router as simulator_router
from src.dashboard import router as dashboard_router
from src import scheduler as sched

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    config.validate()
    db.init_db()
    sched.load_model()
    sched.scheduler.start()
    if config.DEMO_MODE and not os.getenv("PYTEST_CURRENT_TEST"):
        from src.seed import seed_database
        seed_database()
    yield
    sched.scheduler.shutdown(wait=False)

app = FastAPI(
    title="recovr — Autonomous Revenue Recovery Engine",
    version="0.1.0",
    lifespan=lifespan,
)

@app.get("/ping")
def ping():
    return {"status": "ok", "demo_mode": config.DEMO_MODE}


app.include_router(webhook_router)
app.include_router(events_router)
app.include_router(simulator_router)
# dashboard_router is included last: it owns the SPA catch-all GET /{full_path:path}
app.include_router(dashboard_router)
