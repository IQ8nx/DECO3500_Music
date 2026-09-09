from flask import Flask 
from dotenv import load_dotenv
try:
    from .Models import db
    from .Routes.routes import api
except ImportError:
    from Models import db
    from Routes.routes import api
import os

def create_app(config_overrides=None):
    app = Flask(__name__)
    load_dotenv()
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('SQLITE_URL')
    if config_overrides:
        app.config.update(config_overrides)
    db.init_app(app)
    with app.app_context():
        db.create_all()
    app.register_blueprint(api)
    return app

app = create_app()

if __name__ == "__main__":
	app.run(host="0.0.0.0", port = int(os.environ.get('FLASK_PORT', 3500)))
