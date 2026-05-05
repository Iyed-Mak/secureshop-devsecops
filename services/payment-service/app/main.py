from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List
import os
from slowapi import Limiter
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from app.database import SessionLocal, engine
from app import models
from app.schemas import PaymentCreate, Payment

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Payment Service")

limiter = Limiter(key_func=get_remote_address, default_limits=["1000/day", "200/hour"])
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/health")
def health():
    return {"status": "ok", "service": "payment-service"}

@app.post("/payments/", response_model=Payment)
@limiter.limit("20/minute")
def create_payment(payment: PaymentCreate, db: Session = Depends(get_db)):
    # Simulate payment processing
    if payment.amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid payment amount")

    # For demo, always approve payments
    status = "completed"

    db_payment = models.Payment(
        order_id=payment.order_id,
        amount=payment.amount,
        currency=payment.currency,
        status=status,
        payment_method=payment.payment_method
    )
    db.add(db_payment)
    db.commit()
    db.refresh(db_payment)
    return db_payment

@app.get("/payments/", response_model=List[Payment])
def get_payments(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    payments = db.query(models.Payment).offset(skip).limit(limit).all()
    return payments

@app.get("/payments/{payment_id}", response_model=Payment)
def get_payment(payment_id: int, db: Session = Depends(get_db)):
    payment = db.query(models.Payment).filter(models.Payment.id == payment_id).first()
    if payment is None:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment

@app.get("/orders/{order_id}/payments", response_model=List[Payment])
def get_payments_by_order(order_id: int, db: Session = Depends(get_db)):
    payments = db.query(models.Payment).filter(models.Payment.order_id == order_id).all()
    return payments