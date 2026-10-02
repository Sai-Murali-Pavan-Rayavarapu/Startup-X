FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-noto-core && rm -rf /var/lib/apt/lists/*
WORKDIR /service
COPY video_mvp/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY video_mvp ./video_mvp
ENV PYTHONUNBUFFERED=1
CMD ["sh", "-c", "uvicorn video_mvp.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
