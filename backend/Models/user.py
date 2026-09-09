from . import db

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    accessToken = db.Column(db.String(255), nullable=False)
    currentLocation = db.Column(db.String(255), nullable=True)
    currentSong = db.Column(db.String(255), nullable=True)

    def __repr__(self):
        return f"<User(username='{self.username}', location='{self.currentLocation}', song='{self.currentSong}')>"
  