FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    SPEECH_WORKER_PORT=4004 \
    WHISPER_MODEL_SIZE=base \
    WHISPER_COMPUTE_TYPE=int8 \
    WHISPER_CPU_THREADS=4 \
    HF_HOME=/app/models

RUN mkdir -p /app/models

COPY services/speech-worker/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY services/speech-worker/audio_utils.py ./audio_utils.py
COPY services/speech-worker/transcriber.py ./transcriber.py
COPY services/speech-worker/app.py ./app.py

EXPOSE 4004

CMD ["python", "app.py"]
