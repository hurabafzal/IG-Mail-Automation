from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from lingua import Language, LanguageDetectorBuilder
from typing import List

# Initialize FastAPI app
app = FastAPI(title="Language Detection API")

# Define the languages we want to detect
# LANGUAGES = [
#     Language.ENGLISH,
#     Language.FRENCH,
#     Language.GERMAN,
#     Language.SPANISH,
# ]

# Build the language detector
detector = LanguageDetectorBuilder.from_all_spoken_languages().build()


# Define request model
class TextRequest(BaseModel):
    text: str


# Define response model
class LanguageResponse(BaseModel):
    language: str
    iso_code: str


@app.post("/detect", response_model=LanguageResponse)
async def detect_language(request: TextRequest):
    try:
        detected_language = detector.detect_language_of(request.text)
        print(detected_language)
        if detected_language:
            return LanguageResponse(
                language=detected_language.name,
                iso_code=detected_language.iso_code_639_1.name,
            )
        else:
            raise HTTPException(status_code=400, detail="Language detection failed")
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=str(e))


# @app.get("/supported_languages")
# async def get_supported_languages():
#     return {"supported_languages": [lang.name for lang in LANGUAGES]}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
