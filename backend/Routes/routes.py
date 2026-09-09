import os
import json
import requests

from dotenv import load_dotenv
from flask import Blueprint, jsonify, request
from faker import Faker

try:
    from ..Models import db
    from ..Models.user import User
except ImportError:
    from Models import db
    from Models.user import User

api = Blueprint("api", __name__, url_prefix="/api")
load_dotenv()
fake = Faker()
client_id = os.getenv('SPOTIFY_CLIENT_ID')
redirect_uri = os.getenv('SPOTIFY_REDIRECT_URI')
scope = os.getenv('SPOTIFY_SCOPE')

@api.route("/authorise", methods=["POST"])
def authorise_link():
    cred_url = f"https://accounts.spotify.com/authorize?client_id={client_id}&response_type=code&redirect_uri={redirect_uri}&scope={scope}"
    response = requests.get(cred_url)
    redirect_url= response.url
    return jsonify({"redirect_url": redirect_url})

@api.route("/signup", methods=["POST"])
def create_account():
    data = request.json
    location = data.get("location")
    code = data.get("code")
    
    token_url = f"https://accounts.spotify.com/api/token"
    response = requests.post(token_url, data={
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri
    })
    
    song = get_current_playing_song(response.json().get("access_token"))
    
    User.add(username=fake.name(), accessToken=response.json().get("access_token"),currentLocation =location, currentSong=song)
    return jsonify(response.json())

@api.route("/update", methods=["PUT"])
def update_data():
    #takes location data and user id
    data = request.json
    user_id=data.get("user_id")
    if not user_id:
        return jsonify({"error": "User ID is required"}), 400
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