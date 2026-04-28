from fastapi import FastAPI
import requests
import os

app = FastAPI()
DOOD_KEY = os.getenv("563982bmyup7wk3vkxr6r3")
API_URL = "https://doodapi.co/api"

@app.get("/api/explorer")
async def explorer(fld_id: int = 0):
    # Liste tout pour que l'employé puisse naviguer
    r = requests.get(f"{API_URL}/folder/list?key={DOOD_KEY}&fld_id={fld_id}")
    return r.json()

@app.get("/api/prepare-upload")
async def prepare():
    # Étape CRUCIALE : demande à DoodStream sur quel serveur l'employé doit envoyer la vidéo
    r = requests.get(f"{API_URL}/upload/server?key={DOOD_KEY}")
    return r.json()

@app.get("/api/file-action")
async def action(task: str, code: str, extra: str = ""):
    # Un seul point d'entrée pour renommer, supprimer ou déplacer
    if task == "rename":
        return requests.get(f"{API_URL}/file/rename?key={DOOD_KEY}&file_code={code}&title={extra}").json()
    if task == "move":
        return requests.get(f"{API_URL}/file/move?key={DOOD_KEY}&file_code={code}&fld_id={extra}").json()
