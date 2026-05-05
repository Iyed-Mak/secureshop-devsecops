from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from typing import List
import os
import json
import requests
from slowapi import Limiter
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from app.database import SessionLocal, engine
from app import models
from app.schemas import ProductCreate, Product, CategoryCreate, Category

models.Base.metadata.create_all(bind=engine)
with engine.begin() as conn:
    conn.execute(text("ALTER TABLE products ALTER COLUMN category_id DROP NOT NULL;"))

INVENTORY_SERVICE_URL = os.getenv("INVENTORY_SERVICE_URL", "http://inventory-service:8006")

app = FastAPI(title="Product Service")

limiter = Limiter(key_func=get_remote_address, default_limits=["1000/day", "200/hour"])
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def seed_inventory(product_id: int, quantity: int):
    try:
        payload = {"quantity": quantity}
        response = requests.put(
            f"{INVENTORY_SERVICE_URL}/inventory/{product_id}",
            json=payload,
            timeout=5
        )
        response.raise_for_status()
        return response.text
    except requests.exceptions.RequestException as exc:
        print(f"Inventory update failure: {exc}")


@app.get("/health")
def health():
    return {"status": "ok", "service": "product-service"}

@app.post("/categories", response_model=Category)
@app.post("/categories/", response_model=Category)
@limiter.limit("20/minute")
def create_category(category: CategoryCreate, db: Session = Depends(get_db)):
    db_category = models.Category(name=category.name, description=category.description)
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category

@app.get("/categories", response_model=List[Category])
@app.get("/categories/", response_model=List[Category])
def get_categories(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    categories = db.query(models.Category).offset(skip).limit(limit).all()
    return categories

@app.post("/products", response_model=Product)
@app.post("/products/", response_model=Product)
@limiter.limit("20/minute")
def create_product(product: ProductCreate, db: Session = Depends(get_db)):
    payload = product.model_dump()
    db_product = models.Product(
        name=payload["name"],
        description=payload.get("description"),
        price=payload["price"],
        stock_quantity=payload.get("stock_quantity", 0),
        category_id=payload.get("category_id")
    )
    db.add(db_product)
    db.commit()
    db.refresh(db_product)

    if db_product.stock_quantity > 0:
        seed_inventory(db_product.id, db_product.stock_quantity)

    return db_product

@app.get("/products", response_model=List[Product])
@app.get("/products/", response_model=List[Product])
def get_products(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    products = db.query(models.Product).offset(skip).limit(limit).all()
    return products

@app.get("/products/{product_id}", response_model=Product)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@app.get("/products/search")
@app.get("/products/search/")
def search_products(q: str, db: Session = Depends(get_db)):
    products = db.query(models.Product).filter(models.Product.name.contains(q)).all()
    return products

@app.get("/categories/{category_id}/products")
@app.get("/categories/{category_id}/products/", response_model=List[Product])
def get_products_by_category(category_id: int, db: Session = Depends(get_db)):
    products = db.query(models.Product).filter(models.Product.category_id == category_id).all()
    return products