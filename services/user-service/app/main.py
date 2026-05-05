from flask import Flask

from app.config import Config
from app.extensions import db, jwt, limiter
from app.routes import api

app = Flask(__name__)

app.config.from_object(Config)

db.init_app(app)
jwt.init_app(app)
limiter.init_app(app)

app.register_blueprint(api)

# with app.app_context():
#     db.create_all()


if __name__ == "__main__":
    # Run in development only. Production containers use Gunicorn.
    app.run(
        host="127.0.0.1",
        port=8001
    )