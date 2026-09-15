import os
import requests
from datetime import timedelta
from urllib.parse import urlencode

from dotenv import load_dotenv
from flask import Blueprint, jsonify, request
from faker import Faker
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required

from ..Models import db
from ..Models.user import User

api = Blueprint("api", __name__, url_prefix="/api")
load_dotenv()
fake = Faker()
client_id = os.getenv('SPOTIFY_CLIENT_ID')
client_secret = os.getenv('SPOTIFY_CLIENT_SECRET')
redirect_uri = os.getenv('SPOTIFY_REDIRECT_URI')
scope = os.getenv('SPOTIFY_SCOPES', os.getenv('SPOTIFY_SCOPE', 'user-read-currently-playing'))

@api.route("/authorise", methods=["POST"])
def authorise_link():
    cred_url = "https://accounts.spotify.com/authorize?" + urlencode({
        "client_id": client_id,
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "scope": scope,
    })
    return jsonify({"redirect_url": cred_url})

@api.route("/signup", methods=["POST"])
def create_account():
    data = request.get_json(silent=True) or {}
    location = data.get("location")
    code = data.get("code")
    if not code:
        return jsonify({"error": "Spotify code is required"}), 400
    if not client_id or not client_secret or not redirect_uri or not os.getenv('JWT_SECRET'):
        return jsonify({"error": "Spotify OAuth is not configured on the server"}), 500
    
    token_url = f"https://accounts.spotify.com/api/token"
    response = requests.post(token_url, data={
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri
    }, auth=(client_id, client_secret), timeout=15)
    
    token_data = response.json()
    access_token = token_data.get("access_token")
    if not response.ok or not access_token:
        return jsonify({"error": token_data.get("error_description", "Spotify authorisation failed")}), 400
    
    user = User(
        username=fake.name(),
        accessToken=access_token,
        currentLocation=location,
        currentSong=get_current_playing_song(access_token),
    )
    db.session.add(user)
    db.session.commit()
    token = create_access_token(identity=str(user.id), expires_delta=timedelta(days=7))
    return jsonify({"access_token": token})

@api.route("/session", methods=["GET"])
@jwt_required()
def get_session():
    user_id = get_jwt_identity()
    user = User.query.filter(User.id == user_id).first()
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"authenticated": True})

@api.route("/update", methods=["PUT"])
@jwt_required()
def update_data():
    user_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}
    location = data.get("location")
    if not location:
        return jsonify({"error": "Location is required"}), 400
    user = User.query.filter(User.id == user_id).first()
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    access_token= user.accessToken
    if not access_token:
        return jsonify({"error": "Access not authorised"}), 404
    
    user.currentSong =get_current_playing_song(access_token)
    user.currentLocation = location
    db.session.commit()
    return jsonify({"message": "Data updated successfully"})

@api.route("/poll", methods=["GET"])
def poll_data():
    # Fetch all users with their location and current song
    data = User.query.with_entities(User.username, User.currentLocation, User.currentSong).all()
    #returns the location of every user, name and currently playing song
    return jsonify([{"username": user.username, "location": user.currentLocation, "song": user.currentSong} for user in data])

#HELPERS
def get_current_playing_song(access_token):
    url = "https://api.spotify.com/v1/me/player/currently-playing"
    response = requests.get(url, headers={"Authorization": f"Bearer {access_token}"})
    if response.status_code == 200:
        return response.json().get("item", {}).get("name", "No song playing")
    return "No song playing"