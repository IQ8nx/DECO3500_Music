import os

from dotenv import load_dotenv
from flask import Flask
from flask_jwt_extended import JWTManager

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

from .Models import db
from .Routes.routes import api

def create_app(config_overrides=None):
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('SQLITE_URL')
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET')
    if config_overrides:
        app.config.update(config_overrides)
    db.init_app(app)
    JWTManager(app)
    with app.app_context():
        db.drop_all()
        db.create_all()
    app.register_blueprint(api)
    return app

app = create_app()

if __name__ == "__main__":
	app.run(host="0.0.0.0", port = int(os.environ.get('FLASK_PORT', 3500)))
