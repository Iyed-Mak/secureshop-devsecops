from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    get_jwt_identity
)
from flask_limiter import Limiter

from app.models import User
from app.extensions import db, limiter
import bcrypt

api = Blueprint("api", __name__)


@api.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


@api.route("/register", methods=["POST"])
@limiter.limit("5 per minute")
def register():

    data = request.get_json()

    username = data.get("username")
    password = data.get("password")

    existing_user = User.query.filter_by(
        username=username
    ).first()

    if existing_user:
        return jsonify({
            "message": "User already exists"
        }), 400

    hashed_password = bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt()
    ).decode("utf-8")

    user = User(
        username=username,
        password=hashed_password
    )

    db.session.add(user)
    db.session.commit()

    return jsonify({
        "message": "User created"
    }), 201


@api.route("/login", methods=["POST"])
@limiter.limit("10 per minute")
def login():

    data = request.get_json()

    username = data.get("username")
    password = data.get("password")

    user = User.query.filter_by(
        username=username
    ).first()

    if not user:
        return jsonify({
            "message": "Invalid credentials"
        }), 401

    if not bcrypt.checkpw(
        password.encode("utf-8"),
        user.password.encode("utf-8")
    ):
        return jsonify({
            "message": "Invalid credentials"
        }), 401

    access_token = create_access_token(
        identity=username
    )

    return jsonify({
        "access_token": access_token
    })


@api.route("/profile", methods=["GET"])
@jwt_required()
def profile():

    current_user = get_jwt_identity()

    return jsonify({
        "user": current_user
    })


# Intentionally vulnerable endpoint for DevSecOps testing (SQL Injection)
# REMOVED: This endpoint contained SQL injection vulnerability
# @api.route("/vulnerable-search", methods=["GET"])
# def vulnerable_search():
#     """
#     WARNING: This endpoint is intentionally vulnerable to SQL injection for testing purposes.
#     DO NOT use in production!
#     """
#     username = request.args.get("username", "")

#     # Vulnerable to SQL injection
#     query = f"SELECT username FROM user WHERE username LIKE '%{username}%'"
#     result = db.session.execute(query).fetchall()

#     users = [row[0] for row in result]
#     return jsonify({"users": users})


# Another vulnerable endpoint (Command Injection)
# REMOVED: This endpoint contained command injection vulnerability
# @api.route("/vulnerable-exec", methods=["POST"])
# def vulnerable_exec():
#     """
#     WARNING: This endpoint is intentionally vulnerable to command injection for testing purposes.
#     DO NOT use in production!
#     """
#     import subprocess
#     import os

#     cmd = request.json.get("cmd", "")

#     # Vulnerable to command injection
#     result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=os.getcwd())

#     return jsonify({
#         "stdout": result.stdout,
#         "stderr": result.stderr,
#         "returncode": result.returncode
#     })