# Official Docker CLI includes the Compose plugin. No daemon runs in this image.
FROM docker:28-cli
RUN apk add --no-cache python3
WORKDIR /app
COPY updater.py test_updater.py ./
RUN python3 -m unittest -v
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
ENTRYPOINT ["python3", "/app/updater.py"]
